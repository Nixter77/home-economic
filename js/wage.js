/**
 * Ставки зарплаты (обычные часы / шабатон 150%)
 * Израиль: работа в недельный выходной (шаббат) или в праздник — не менее 150%.
 */

const WAGE_KEY = 'he_wage_settings';

export const DEFAULT_WAGE = {
  regularRate: 40,
  shabatonRate: 60
};

function clampRate(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  // Keep money readable: up to 2 decimals
  return Math.round(n * 100) / 100;
}

function normalizeWage(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  return {
    regularRate: clampRate(base.regularRate, DEFAULT_WAGE.regularRate),
    shabatonRate: clampRate(base.shabatonRate, DEFAULT_WAGE.shabatonRate)
  };
}

class WageSettings {
  constructor() {
    this.settings = this.load();
    this.listeners = [];
  }

  load() {
    try {
      if (typeof localStorage === 'undefined') return { ...DEFAULT_WAGE };
      const saved = localStorage.getItem(WAGE_KEY);
      if (saved) {
        return normalizeWage(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Ошибка загрузки ставок:', e);
    }
    return { ...DEFAULT_WAGE };
  }

  save({ silent = false } = {}) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.error('Ошибка сохранения ставок:', e);
    }
    if (!silent) this.notify();
  }

  get() {
    return { ...this.settings };
  }

  set(partial, options = {}) {
    this.settings = normalizeWage({ ...this.settings, ...partial });
    this.save(options);
    return this.get();
  }

  replaceAll(raw, options = {}) {
    this.settings = normalizeWage(raw);
    this.save(options);
    return this.get();
  }

  /**
   * Salary = regularHours * regularRate + shabatonHours * shabatonRate
   */
  calcSalary(regularHours = 0, shabatonHours = 0) {
    const r = Math.max(0, Number(regularHours) || 0);
    const s = Math.max(0, Number(shabatonHours) || 0);
    const { regularRate, shabatonRate } = this.settings;
    const amount = r * regularRate + s * shabatonRate;
    return {
      regularHours: r,
      shabatonHours: s,
      regularRate,
      shabatonRate,
      amount: Math.round(amount * 100) / 100
    };
  }

  /**
   * Build a human note for history, e.g. "6ч обычн. + 2ч шабатон"
   */
  buildSalaryNote(regularHours = 0, shabatonHours = 0, extraNote = '') {
    const r = Math.max(0, Number(regularHours) || 0);
    const s = Math.max(0, Number(shabatonHours) || 0);
    const parts = [];
    if (r > 0) parts.push(`${formatHours(r)}ч обычн.`);
    if (s > 0) parts.push(`${formatHours(s)}ч шабатон`);
    const base = parts.length ? parts.join(' + ') : 'Смена';
    const extra = String(extraNote || '').trim();
    if (!extra) return base;
    // Avoid duplicating auto note if user already typed similar text
    if (extra.includes('обычн') || extra.includes('шабатон')) return extra;
    return `${base} · ${extra}`;
  }

  subscribe(listener) {
    if (typeof listener === 'function') this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try { listener(this); } catch (e) { /* ignore */ }
    });
  }
}

function formatHours(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Heuristic: Saturday (local calendar) is typically full shabaton day for hourly work.
 * Shabbat legally starts Friday evening — user can still enter regular vs shabaton hours manually.
 */
export function isLikelyShabatonDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === 6; // Saturday
}

export const wageSettings = new WageSettings();
