/**
 * Хранилище данных приложения (Store)
 * Взаимодействие с localStorage и управление состоянием
 */

import { generateUUID } from './utils.js';

const TRANSACTIONS_KEY = 'he_transactions';
const THEME_KEY = 'he_theme';

class Store {
  constructor() {
    this.listeners = [];
    this.transactions = this.loadTransactions();
    this.theme = this.loadTheme();
    this._onDelete = null;
  }

  /** Optional hook for sync tombstones (id) => void */
  setOnDelete(fn) {
    this._onDelete = typeof fn === 'function' ? fn : null;
  }

  loadTransactions() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const saved = localStorage.getItem(TRANSACTIONS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed : [];
        }
      }
    } catch (e) {
      console.error('Ошибка чтения транзакций:', e);
    }
    return [];
  }

  saveTransactions() {
    try {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(this.transactions));
      this.notify();
    } catch (e) {
      console.error('Ошибка сохранения транзакций:', e);
    }
  }

  loadTheme() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'midnight' || saved === 'light') return saved;
      }
    } catch (e) { /* ignore */ }
    // Уважаем системное предпочтение, по умолчанию — светлая тема
    try {
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'midnight';
      }
    } catch (e) { /* ignore */ }
    return 'light';
  }

  setTheme(themeName) {
    this.theme = themeName;
    localStorage.setItem(THEME_KEY, themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    this.updateThemeToggleIcon();
    this.notify();
  }

  updateThemeToggleIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.textContent = this.theme === 'midnight' ? '☀️' : '🌙';
      btn.title = this.theme === 'midnight' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
    }
  }

  toggleTheme() {
    const newTheme = this.theme === 'midnight' ? 'light' : 'midnight';
    this.setTheme(newTheme);
  }

  getTransactions() {
    return [...this.transactions];
  }

  getTransactionById(id) {
    return this.transactions.find(t => t.id === id) || null;
  }

  createUniqueId(candidate, usedIds = new Set(this.transactions.map(t => t.id))) {
    const preferred = typeof candidate === 'string' ? candidate.trim() : '';
    const id = preferred && !usedIds.has(preferred) ? preferred : generateUUID();
    usedIds.add(id);
    return id;
  }

  normalizeTransaction(tx, usedIds) {
    const now = new Date().toISOString();
    const meta = (tx.meta && typeof tx.meta === 'object') ? { ...tx.meta } : undefined;
    const row = {
      id: this.createUniqueId(tx.id, usedIds),
      amount: Math.max(0, Number(tx.amount) || 0),
      type: tx.type === 'income' ? 'income' : (tx.type || 'expense'),
      category: String(tx.category || 'other'),
      tags: Array.isArray(tx.tags) ? tx.tags : [],
      note: tx.note ? String(tx.note).trim() : '',
      date: tx.date || now.split('T')[0],
      createdAt: tx.createdAt || now,
      updatedAt: tx.updatedAt || tx.createdAt || now
    };
    if (meta && Object.keys(meta).length > 0) {
      row.meta = meta;
    }
    return row;
  }

  addTransaction(tx) {
    const now = new Date().toISOString();
    const newTx = this.normalizeTransaction(
      {
        ...tx,
        createdAt: tx.createdAt || now,
        updatedAt: now
      },
      new Set(this.transactions.map(t => t.id))
    );

    this.transactions.unshift(newTx); // Новые транзакции в начало
    this.saveTransactions();
    return newTx;
  }

  updateTransaction(id, updatedFields) {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) return false;

    const prev = this.transactions[index];
    const next = {
      ...prev,
      ...updatedFields,
      amount: updatedFields.amount !== undefined ? Number(updatedFields.amount) : prev.amount,
      note: updatedFields.note !== undefined ? String(updatedFields.note).trim() : prev.note,
      updatedAt: new Date().toISOString()
    };

    if (updatedFields.meta !== undefined) {
      if (updatedFields.meta && typeof updatedFields.meta === 'object') {
        next.meta = { ...updatedFields.meta };
      } else {
        delete next.meta;
      }
    }

    this.transactions[index] = next;
    this.saveTransactions();
    return true;
  }

  deleteTransaction(id) {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== id);
    if (this.transactions.length !== initialLength) {
      if (this._onDelete) {
        try { this._onDelete(id); } catch (e) { /* ignore */ }
      }
      this.saveTransactions();
      return true;
    }
    return false;
  }

  clearAll() {
    if (this._onDelete) {
      this.transactions.forEach(t => {
        try { this._onDelete(t.id); } catch (e) { /* ignore */ }
      });
    }
    this.transactions = [];
    localStorage.removeItem(TRANSACTIONS_KEY);
    this.notify();
  }

  /**
   * Replace entire transaction list (used by cloud sync).
   * @param {Array} list
   * @param {{ silent?: boolean }} options — silent skips notify (caller will notify)
   */
  replaceAll(list, options = {}) {
    const usedIds = new Set();
    this.transactions = (Array.isArray(list) ? list : [])
      .filter(t => t && typeof t === 'object')
      .map(t => this.normalizeTransaction(t, usedIds))
      .filter(t => t.amount > 0 || t.type === 'income'); // keep valid rows

    try {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(this.transactions));
    } catch (e) {
      console.error('Ошибка сохранения транзакций:', e);
    }
    if (!options.silent) this.notify();
  }

  importData(data) {
    if (data && Array.isArray(data.transactions)) {
      this.replaceAll(data.transactions);
      return true;
    }
    return false;
  }

  exportData() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: this.transactions
    };
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this));
  }
}

export const store = new Store();
