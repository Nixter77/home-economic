/**
 * Cross-device cloud sync — always on for this personal app.
 *
 * Uses shared room "main" on /api/sync so phone + desktop share one cloud store
 * without pairing codes. LocalStorage remains a cache; cloud is source of truth
 * for multi-device (merged with local on conflict).
 */

import { store } from './store.js';
import { categoryManager } from './categories.js';
import { wageSettings } from './wage.js';

const SYNC_ROOM = 'main';
const SYNC_ETAG_KEY = 'he_sync_etag';
const SYNC_DELETED_KEY = 'he_sync_deleted_ids';
const SYNC_ENABLED_KEY = 'he_sync_enabled'; // '0' to opt out
const SYNC_SCHEMA_KEY = 'he_sync_schema';
const SYNC_SCHEMA_VERSION = '2'; // bump clears stale etags from code-based sync
const POLL_MS = 2000;
const PUSH_DEBOUNCE_MS = 300;
const MAX_DELETED_IDS = 500;

function loadDeletedIds() {
  try {
    const raw = localStorage.getItem(SYNC_DELETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveDeletedIds(ids) {
  const trimmed = [...new Set(ids.map(String))].slice(-MAX_DELETED_IDS);
  localStorage.setItem(SYNC_DELETED_KEY, JSON.stringify(trimmed));
  return trimmed;
}

function buildPayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    transactions: store.getTransactions(),
    categories: categoryManager.getAll(),
    wage: wageSettings.get(),
    deletedTransactionIds: loadDeletedIds()
  };
}

/**
 * Merge remote + local snapshots.
 */
export function mergePayloads(local, remote) {
  const localDel = new Set([
    ...(local.deletedTransactionIds || []).map(String),
    ...loadDeletedIds().map(String)
  ]);
  const remoteDel = new Set((remote.deletedTransactionIds || []).map(String));
  const deleted = new Set([...localDel, ...remoteDel]);

  const byId = new Map();

  const consider = (tx) => {
    if (!tx || !tx.id) return;
    const id = String(tx.id);
    if (deleted.has(id)) return;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, tx);
      return;
    }
    const prevTs = Date.parse(prev.updatedAt || prev.createdAt || 0) || 0;
    const nextTs = Date.parse(tx.updatedAt || tx.createdAt || 0) || 0;
    if (nextTs >= prevTs) byId.set(id, tx);
  };

  (remote.transactions || []).forEach(consider);
  (local.transactions || []).forEach(consider);

  const transactions = [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.createdAt || a.date || 0) || 0;
    const tb = Date.parse(b.createdAt || b.date || 0) || 0;
    return tb - ta;
  });

  const localUpdated = Date.parse(local.updatedAt || 0) || 0;
  const remoteUpdated = Date.parse(remote.updatedAt || 0) || 0;
  const localCats = Array.isArray(local.categories) ? local.categories : [];
  const remoteCats = Array.isArray(remote.categories) ? remote.categories : [];

  let categories;
  if (remoteCats.length === 0) {
    categories = localCats;
  } else if (localCats.length === 0) {
    categories = remoteCats;
  } else if (JSON.stringify(localCats) === JSON.stringify(remoteCats)) {
    categories = localCats;
  } else {
    const catMap = new Map();
    const order = remoteUpdated >= localUpdated
      ? [...localCats, ...remoteCats]
      : [...remoteCats, ...localCats];
    order.forEach((c) => {
      if (c && c.id) catMap.set(String(c.id), c);
    });
    categories = [...catMap.values()];
  }

  // Wage rates: prefer newer snapshot
  let wage = null;
  if (remote.wage && local.wage) {
    wage = remoteUpdated >= localUpdated ? remote.wage : local.wage;
  } else {
    wage = remote.wage || local.wage || null;
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    transactions,
    categories,
    wage,
    deletedTransactionIds: [...deleted].slice(-MAX_DELETED_IDS)
  };
}

function stableTxKey(list) {
  return (list || [])
    .map((t) => `${t.id}|${t.amount}|${t.type}|${t.category}|${t.note}|${t.date}|${t.updatedAt || ''}`)
    .sort()
    .join(';');
}

function stableCatKey(list) {
  return (list || [])
    .map((c) => `${c.id}|${c.name}|${c.icon}|${c.color}|${c.budgetLimit || 0}|${c.kind || 'expense'}`)
    .sort()
    .join(';');
}

function stableWageKey(wage) {
  if (!wage || typeof wage !== 'object') return '';
  return `${wage.regularRate}|${wage.shabatonRate}`;
}

function applyPayload(payload, { silent = false } = {}) {
  if (!payload) return false;

  if (Array.isArray(payload.deletedTransactionIds)) {
    saveDeletedIds(payload.deletedTransactionIds);
  }

  if (Array.isArray(payload.categories) && payload.categories.length > 0) {
    categoryManager.replaceAll(payload.categories, { silent: true });
  }

  if (Array.isArray(payload.transactions)) {
    store.replaceAll(payload.transactions, { silent: true });
  }

  if (payload.wage && typeof payload.wage === 'object') {
    wageSettings.replaceAll(payload.wage, { silent: true });
  }

  if (!silent) {
    store.notify();
  }
  return true;
}

class SyncManager {
  constructor() {
    this.room = SYNC_ROOM;
    this.etag = null;
    this.enabled = true;
    this.status = 'idle';
    this.lastError = null;
    this.lastSyncedAt = null;
    this.listeners = [];
    this.pollTimer = null;
    this.pushTimer = null;
    this.busy = false;
    this.pendingPush = false;
    this.pendingPull = false;
    this.applyingRemote = false;
    this.started = false;
    this.boundOnVisibility = () => this.onVisibility();
    this.boundOnOnline = () => {
      this.queuePull();
      this.schedulePush();
    };
  }

  init() {
    if (this.started) return;
    this.started = true;

    try {
      // Migrate from household-code sync → always-on shared room
      if (localStorage.getItem(SYNC_SCHEMA_KEY) !== SYNC_SCHEMA_VERSION) {
        localStorage.removeItem(SYNC_ETAG_KEY);
        localStorage.removeItem('he_sync_code');
        localStorage.setItem(SYNC_SCHEMA_KEY, SYNC_SCHEMA_VERSION);
      }
      const optOut = localStorage.getItem(SYNC_ENABLED_KEY) === '0';
      this.enabled = !optOut;
      this.etag = localStorage.getItem(SYNC_ETAG_KEY) || null;
    } catch {
      this.enabled = true;
      this.etag = null;
    }

    store.setOnDelete((id) => {
      const ids = loadDeletedIds();
      ids.push(String(id));
      saveDeletedIds(ids);
    });

    store.subscribe(() => {
      if (this.applyingRemote) return;
      this.schedulePush();
    });

    categoryManager.subscribe(() => {
      if (this.applyingRemote) return;
      this.schedulePush();
    });

    wageSettings.subscribe(() => {
      if (this.applyingRemote) return;
      this.schedulePush();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundOnVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundOnOnline);
    }

    if (this.enabled) {
      this.setStatus('connecting');
      this.startPolling();
      // Initial: pull cloud, merge local, push if needed
      this.queuePull().then(() => this.schedulePush());
    } else {
      this.setStatus('idle');
    }
  }

  subscribe(listener) {
    if (typeof listener === 'function') this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    const snapshot = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(snapshot);
      } catch (e) {
        console.error('[sync] listener error', e);
      }
    });
  }

  getState() {
    return {
      code: this.room,
      room: this.room,
      status: this.status,
      lastError: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
      enabled: this.enabled
    };
  }

  setStatus(status, error = null) {
    this.status = status;
    this.lastError = error;
    this.notify();
  }

  setEtag(etag) {
    this.etag = etag || null;
    try {
      if (this.etag) localStorage.setItem(SYNC_ETAG_KEY, this.etag);
      else localStorage.removeItem(SYNC_ETAG_KEY);
    } catch { /* ignore */ }
  }

  enable() {
    try {
      localStorage.setItem(SYNC_ENABLED_KEY, '1');
    } catch { /* ignore */ }
    this.enabled = true;
    this.setStatus('connecting');
    this.startPolling();
    return this.queuePull().then(() => this.schedulePush());
  }

  disconnect() {
    this.stopPolling();
    this.enabled = false;
    try {
      localStorage.setItem(SYNC_ENABLED_KEY, '0');
    } catch { /* ignore */ }
    this.setStatus('idle');
  }

  /** @deprecated pairing codes no longer required */
  async createHousehold() {
    await this.enable();
    return this.room;
  }

  /** @deprecated pairing codes no longer required */
  async joinHousehold() {
    await this.enable();
    return this.room;
  }

  startPolling() {
    this.stopPolling();
    if (!this.enabled) return;
    this.pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      this.queuePull();
    }, POLL_MS);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
  }

  onVisibility() {
    if (typeof document === 'undefined') return;
    if (!document.hidden && this.enabled) {
      this.queuePull().then(() => this.schedulePush());
    }
  }

  schedulePush() {
    if (!this.enabled) return;
    if (this.applyingRemote) return;
    this.pendingPush = true;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.queuePush();
    }, PUSH_DEBOUNCE_MS);
  }

  async queuePull() {
    if (!this.enabled) return;
    this.pendingPull = true;
    return this.drain();
  }

  async queuePush() {
    if (!this.enabled) return;
    this.pendingPush = true;
    return this.drain();
  }

  /**
   * Serialize pull/push so a local add during poll is never dropped.
   */
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.pendingPull || this.pendingPush) {
        if (this.pendingPull) {
          this.pendingPull = false;
          await this.pullOnce();
        }
        if (this.pendingPush) {
          this.pendingPush = false;
          await this.pushOnce();
        }
      }
    } finally {
      this.busy = false;
      // Work may have been queued while finishing
      if (this.pendingPull || this.pendingPush) {
        this.drain();
      }
    }
  }

  async fetchRemote() {
    const params = new URLSearchParams({ code: this.room });
    const headers = {};
    if (this.etag) headers['If-None-Match'] = this.etag;

    const res = await fetch(`/api/sync?${params.toString()}`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    if (res.status === 304) {
      return { status: 304, etag: this.etag };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const etag = data.etag || res.headers.get('x-sync-etag') || res.headers.get('etag');
    return { status: 200, payload: data.payload, etag: etag || null };
  }

  async pullOnce() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setStatus('offline');
      return;
    }

    try {
      const remote = await this.fetchRemote();
      if (remote.status === 304) {
        this.setStatus('synced');
        return;
      }

      if (remote.status === 200 && remote.payload) {
        const isEmptyCloud =
          remote.payload.empty ||
          ((!remote.payload.transactions || remote.payload.transactions.length === 0) &&
            !remote.etag);

        const local = buildPayload();
        const hasLocal =
          (local.transactions && local.transactions.length > 0) ||
          (local.categories && local.categories.length > 0);

        // First cloud seed: push local only
        if (isEmptyCloud && hasLocal) {
          this.setEtag(null);
          this.pendingPush = true;
          this.setStatus('syncing');
          return;
        }

        const merged = mergePayloads(local, remote.payload);

        const txChanged = stableTxKey(store.getTransactions()) !== stableTxKey(merged.transactions);
        const catChanged = stableCatKey(categoryManager.getAll()) !== stableCatKey(merged.categories);
        const wageChanged = stableWageKey(wageSettings.get()) !== stableWageKey(merged.wage);

        if (txChanged || catChanged || wageChanged) {
          this.applyingRemote = true;
          try {
            applyPayload(merged, { silent: false });
          } finally {
            this.applyingRemote = false;
          }
        }

        this.setEtag(remote.etag);
        this.lastSyncedAt = new Date().toISOString();
        this.setStatus('synced');

        const needPushBack =
          stableTxKey(remote.payload.transactions || []) !== stableTxKey(merged.transactions) ||
          stableCatKey(remote.payload.categories || []) !== stableCatKey(merged.categories) ||
          stableWageKey(remote.payload.wage) !== stableWageKey(merged.wage);

        if (needPushBack) {
          this.pendingPush = true;
        }
      }
    } catch (err) {
      console.error('[sync] pull failed', err);
      this.setStatus('error', err.message || String(err));
    }
  }

  async pushOnce() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setStatus('offline');
      return;
    }
    if (this.applyingRemote) {
      this.pendingPush = true;
      return;
    }

    this.setStatus('syncing');

    try {
      const payload = buildPayload();
      const res = await fetch('/api/sync', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(this.etag ? { 'If-Match': this.etag } : {})
        },
        body: JSON.stringify({
          code: this.room,
          payload,
          baseEtag: this.etag || undefined
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.payload) {
        const merged = mergePayloads(payload, data.payload);
        this.applyingRemote = true;
        try {
          applyPayload(merged, { silent: false });
        } finally {
          this.applyingRemote = false;
        }
        this.setEtag(data.etag || null);

        const retry = await fetch('/api/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: this.room,
            payload: merged,
            baseEtag: data.etag || undefined
          })
        });
        const retryData = await retry.json().catch(() => ({}));
        if (!retry.ok) {
          throw new Error(retryData.error || `HTTP ${retry.status}`);
        }
        this.setEtag(retryData.etag || null);
        this.lastSyncedAt = retryData.updatedAt || new Date().toISOString();
        this.setStatus('synced');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      this.setEtag(data.etag || null);
      this.lastSyncedAt = data.updatedAt || new Date().toISOString();
      this.setStatus('synced');
    } catch (err) {
      console.error('[sync] push failed', err);
      this.setStatus('error', err.message || String(err));
    }
  }
}

export const syncManager = new SyncManager();

// Back-compat exports used by older UI
export function generateHouseholdCode() {
  return SYNC_ROOM;
}

export function normalizeHouseholdCode(raw) {
  if (raw == null || raw === '' || raw === 'main' || raw === 'default') return SYNC_ROOM;
  return String(raw).trim() || SYNC_ROOM;
}

export function householdShareUrl() {
  if (typeof location === 'undefined') return '';
  return location.origin + '/';
}

export function readSyncCodeFromUrl() {
  return null;
}
