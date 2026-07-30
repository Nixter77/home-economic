/**
 * Хранилище данных приложения (Store)
 * Взаимодействие с localStorage и управление состоянием
 */

const TRANSACTIONS_KEY = 'he_transactions';
const THEME_KEY = 'he_theme';

class Store {
  constructor() {
    this.listeners = [];
    this.transactions = this.loadTransactions();
    this.theme = this.loadTheme();
  }

  loadTransactions() {
    try {
      const saved = localStorage.getItem(TRANSACTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
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
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'midnight' || saved === 'light') return saved;
    // Уважаем системное предпочтение, по умолчанию — светлая тема
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
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

  addTransaction(tx) {
    const newTx = {
      id: tx.id || String(Date.now()),
      amount: Number(tx.amount) || 0,
      type: tx.type || 'expense', // 'expense' | 'income'
      category: tx.category || 'other',
      tags: Array.isArray(tx.tags) ? tx.tags : [],
      note: tx.note ? String(tx.note).trim() : '',
      date: tx.date || new Date().toISOString().split('T')[0],
      createdAt: tx.createdAt || new Date().toISOString()
    };

    this.transactions.unshift(newTx); // Новые транзакции в начало
    this.saveTransactions();
    return newTx;
  }

  updateTransaction(id, updatedFields) {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.transactions[index] = {
      ...this.transactions[index],
      ...updatedFields,
      amount: updatedFields.amount !== undefined ? Number(updatedFields.amount) : this.transactions[index].amount,
      note: updatedFields.note !== undefined ? String(updatedFields.note).trim() : this.transactions[index].note
    };

    this.saveTransactions();
    return true;
  }

  deleteTransaction(id) {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== id);
    if (this.transactions.length !== initialLength) {
      this.saveTransactions();
      return true;
    }
    return false;
  }

  clearAll() {
    this.transactions = [];
    localStorage.removeItem(TRANSACTIONS_KEY);
    this.notify();
  }

  importData(data) {
    if (data && Array.isArray(data.transactions)) {
      this.transactions = data.transactions;
      this.saveTransactions();
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
