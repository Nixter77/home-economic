/**
 * Управление операциями с транзакциями
 */

import { store } from './store.js';
import { categoryManager } from './categories.js';

export class TransactionController {
  /**
   * Добавить новую транзакцию
   * @param {Object} formData 
   * @returns {{ success: boolean, message?: string, tx?: Object }}
   */
  static createTransaction(formData) {
    const amount = Number(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'Пожалуйста, введите корректную сумму > 0' };
    }

    if (!formData.category) {
      return { success: false, message: 'Пожалуйста, выберите категорию' };
    }

    if (!formData.date) {
      return { success: false, message: 'Пожалуйста, укажите дату' };
    }

    const tx = store.addTransaction({
      amount: amount,
      type: formData.type || 'expense',
      category: formData.category,
      note: formData.note || '',
      date: formData.date
    });

    return { success: true, tx };
  }

  /**
   * Обновить имеющуюся транзакцию
   * @param {string} id 
   * @param {Object} formData 
   * @returns {{ success: boolean, message?: string }}
   */
  static editTransaction(id, formData) {
    const amount = Number(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'Пожалуйста, введите корректную сумму > 0' };
    }

    const updated = store.updateTransaction(id, {
      amount,
      type: formData.type || 'expense',
      category: formData.category,
      note: formData.note || '',
      date: formData.date
    });

    if (updated) {
      return { success: true };
    }
    return { success: false, message: 'Транзакция не найдена' };
  }

  /**
   * Удалить транзакцию по ID
   * @param {string} id 
   * @returns {boolean}
   */
  static deleteTransaction(id) {
    return store.deleteTransaction(id);
  }

  /**
   * Отфильтровать транзакции для страницы истории
   * @param {Object} filters { categoryId, type, search, startDate, endDate }
   * @returns {Array}
   */
  static filterTransactions(filters = {}) {
    let list = store.getTransactions();

    if (filters.type && filters.type !== 'all') {
      list = list.filter(t => t.type === filters.type);
    }

    if (filters.categoryId && filters.categoryId !== 'all') {
      list = list.filter(t => t.category === filters.categoryId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(t => {
        const cat = categoryManager.getById(t.category);
        return (t.note && t.note.toLowerCase().includes(q)) ||
               (cat.name && cat.name.toLowerCase().includes(q));
      });
    }

    if (filters.startDate) {
      list = list.filter(t => t.date >= filters.startDate);
    }

    if (filters.endDate) {
      list = list.filter(t => t.date <= filters.endDate);
    }

    return list;
  }
}
