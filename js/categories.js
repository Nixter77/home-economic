/**
 * Реестр категорий расходов/доходов
 * kind: 'expense' | 'income'
 */

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Еда', icon: '🍕', color: '#FF6B35', budgetLimit: 2000, kind: 'expense' },
  { id: 'alcohol', name: 'Алкоголь', icon: '🍷', color: '#9B59B6', budgetLimit: 500, kind: 'expense' },
  { id: 'fruits-vegetables', name: 'Фрукты-овощи', icon: '🥦', color: '#27AE60', budgetLimit: 800, kind: 'expense' },
  { id: 'meat', name: 'Мясо', icon: '🥩', color: '#E74C3C', budgetLimit: 1000, kind: 'expense' },
  { id: 'transport', name: 'Транспорт', icon: '🚌', color: '#3498DB', budgetLimit: 600, kind: 'expense' },
  { id: 'housing', name: 'Жильё', icon: '🏠', color: '#F39C12', budgetLimit: 4000, kind: 'expense' },
  { id: 'utilities', name: 'Коммунальные', icon: '💡', color: '#1ABC9C', budgetLimit: 900, kind: 'expense' },
  { id: 'health', name: 'Здоровье', icon: '💊', color: '#E91E63', budgetLimit: 500, kind: 'expense' },
  { id: 'entertainment', name: 'Развлечения', icon: '🎬', color: '#FF9800', budgetLimit: 700, kind: 'expense' },
  { id: 'clothes', name: 'Одежда', icon: '👕', color: '#795548', budgetLimit: 600, kind: 'expense' },
  { id: 'other', name: 'Другое', icon: '📦', color: '#607D8B', budgetLimit: 0, kind: 'expense' }
];

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: 'Зарплата', icon: '💼', color: '#27AE60', budgetLimit: 0, kind: 'income' },
  { id: 'tips', name: 'Чаевые', icon: '💵', color: '#2ECC71', budgetLimit: 0, kind: 'income' },
  { id: 'other-income', name: 'Прочий доход', icon: '💰', color: '#16A085', budgetLimit: 0, kind: 'income' }
];

export const DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES
];

const CATEGORIES_KEY = 'he_categories';
const DEFAULT_COLOR = '#607D8B';
const INCOME_IDS = new Set(DEFAULT_INCOME_CATEGORIES.map((c) => c.id));

function normalizeKind(kind, id) {
  if (kind === 'income' || kind === 'expense') return kind;
  // Known income ids (and legacy without kind)
  if (INCOME_IDS.has(id) || id === 'income' || id === 'salary' || id === 'tips') {
    return 'income';
  }
  return 'expense';
}

function normalizeCategory(category) {
  if (!category || typeof category !== 'object') return null;

  const id = String(category.id || '').trim();
  const name = String(category.name || '').trim();
  if (!id || !name) return null;

  const rawIcon = String(category.icon || '🏷️').replace(/<[^>]*>/g, '').trim();
  const color = String(category.color || '');
  return {
    id,
    name,
    icon: rawIcon || '🏷️',
    color: /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : DEFAULT_COLOR,
    budgetLimit: Math.max(0, Number(category.budgetLimit) || 0),
    kind: normalizeKind(category.kind, id)
  };
}

/**
 * Merge saved list with missing default categories (esp. new income cats).
 */
function mergeWithDefaults(list) {
  const byId = new Map();
  (Array.isArray(list) ? list : []).forEach((c) => {
    const n = normalizeCategory(c);
    if (n) byId.set(n.id, n);
  });

  DEFAULT_CATEGORIES.forEach((def) => {
    if (!byId.has(def.id)) {
      byId.set(def.id, normalizeCategory(def));
    }
  });

  // Keep user order for known ids, append new defaults at end by default order
  const ordered = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((c) => {
    const id = c && c.id;
    if (id && byId.has(id) && !seen.has(id)) {
      ordered.push(byId.get(id));
      seen.add(id);
    }
  });
  DEFAULT_CATEGORIES.forEach((def) => {
    if (!seen.has(def.id) && byId.has(def.id)) {
      ordered.push(byId.get(def.id));
      seen.add(def.id);
    }
  });
  // Any remaining custom categories
  byId.forEach((cat, id) => {
    if (!seen.has(id)) ordered.push(cat);
  });

  return ordered.filter(Boolean);
}

class CategoryManager {
  constructor() {
    this.categories = this.loadCategories();
    this.listeners = [];
  }

  loadCategories() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const saved = localStorage.getItem(CATEGORIES_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const categories = mergeWithDefaults(parsed);
            if (categories.length > 0) {
              try {
                localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
              } catch (e) { /* ignore */ }
              return categories;
            }
          }
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки категорий из localStorage:', e);
    }
    return DEFAULT_CATEGORIES.map((c) => normalizeCategory(c));
  }

  saveCategories({ silent = false } = {}) {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categories));
    } catch (e) {
      console.error('Ошибка сохранения категорий:', e);
    }
    if (!silent) this.notify();
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
    this.listeners.forEach(listener => {
      try { listener(this); } catch (e) { /* ignore */ }
    });
  }

  /**
   * Replace all categories (cloud sync).
   * @param {Array} list
   * @param {{ silent?: boolean }} options
   */
  replaceAll(list, options = {}) {
    const categories = mergeWithDefaults(list);
    if (categories.length === 0) return false;
    this.categories = categories;
    this.saveCategories({ silent: Boolean(options.silent) });
    return true;
  }

  getAll() {
    return this.categories;
  }

  /**
   * @param {'expense'|'income'|'all'} kind
   */
  getByKind(kind = 'all') {
    if (kind === 'all') return this.categories;
    return this.categories.filter((c) => c.kind === kind);
  }

  getById(id) {
    return this.categories.find(cat => cat.id === id) || {
      id: id,
      name: id,
      icon: '🏷️',
      color: '#9E9E9E',
      kind: INCOME_IDS.has(id) ? 'income' : 'expense'
    };
  }

  addCategory(category) {
    const normalized = normalizeCategory(category);
    if (!normalized || this.categories.some(c => c.id === normalized.id)) {
      return false;
    }
    this.categories.push(normalized);
    this.saveCategories();
    return true;
  }

  updateCategory(id, updatedData) {
    const index = this.categories.findIndex(c => c.id === id);
    if (index === -1) return false;
    const merged = {
      ...this.categories[index],
      ...updatedData
    };
    const normalized = normalizeCategory(merged);
    if (!normalized) return false;
    this.categories[index] = normalized;
    this.saveCategories();
    return true;
  }

  setBudgetLimit(id, limit) {
    return this.updateCategory(id, { budgetLimit: Math.max(0, Number(limit) || 0) });
  }

  deleteCategory(id) {
    // Не даём удалить единственную оставшуюся категорию
    if (this.categories.length <= 1) return false;
    this.categories = this.categories.filter(c => c.id !== id);
    this.saveCategories();
    return true;
  }

  resetToDefaults() {
    this.categories = DEFAULT_CATEGORIES.map((c) => normalizeCategory(c));
    this.saveCategories();
  }
}

export const categoryManager = new CategoryManager();
