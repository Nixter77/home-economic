/**
 * Модуль аналитики и расчёта финансовых показателей
 */

import { store } from './store.js';
import { categoryManager } from './categories.js';
import { getMonthKey } from './utils.js';

export class Analytics {
  /**
   * Отфильтровать транзакции по периоду
   * @param {'day'|'week'|'month'|'all'} period 
   * @param {Date|string} [refDate] 
   * @returns {Array}
   */
  static getFilteredTransactions(period = 'month', refDate = new Date()) {
    const transactions = store.getTransactions();
    const target = new Date(refDate);

    return transactions.filter(t => {
      const txDate = new Date(t.date);
      
      switch (period) {
        case 'day': {
          return txDate.toDateString() === target.toDateString();
        }
        case 'week': {
          // Начало недели (понедельник)
          const startOfWeek = new Date(target);
          const day = startOfWeek.getDay() || 7;
          startOfWeek.setDate(startOfWeek.getDate() - day + 1);
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          return txDate >= startOfWeek && txDate <= endOfWeek;
        }
        case 'month': {
          return txDate.getFullYear() === target.getFullYear() &&
                 txDate.getMonth() === target.getMonth();
        }
        case 'all':
        default:
          return true;
      }
    });
  }

  /**
   * Общий итог расходов и доходов за период
   * @param {'day'|'week'|'month'|'all'} period 
   * @returns {{ totalExpense: number, totalIncome: number, balance: number }}
   */
  static getSummary(period = 'month') {
    const list = this.getFilteredTransactions(period);
    let totalExpense = 0;
    let totalIncome = 0;

    list.forEach(t => {
      if (t.type === 'income') {
        totalIncome += Number(t.amount) || 0;
      } else {
        totalExpense += Number(t.amount) || 0;
      }
    });

    return {
      totalExpense,
      totalIncome,
      balance: totalIncome - totalExpense,
      count: list.length
    };
  }

  /**
   * Разбивка расходов по категориям за период
   * @param {'day'|'week'|'month'|'all'} period 
   * @returns {Array<{ category: Object, amount: number, percent: number, count: number }>}
   */
  static getCategoryBreakdown(period = 'month') {
    const list = this.getFilteredTransactions(period).filter(t => t.type !== 'income');
    const totalsByCategory = {};
    const countsByCategory = {};
    let totalExpense = 0;

    list.forEach(t => {
      const catId = t.category || 'other';
      const amt = Number(t.amount) || 0;
      totalsByCategory[catId] = (totalsByCategory[catId] || 0) + amt;
      countsByCategory[catId] = (countsByCategory[catId] || 0) + 1;
      totalExpense += amt;
    });

    const result = Object.keys(totalsByCategory).map(catId => {
      const category = categoryManager.getById(catId);
      const amount = totalsByCategory[catId];
      const percent = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        category,
        amount,
        percent,
        count: countsByCategory[catId]
      };
    });

    // Сортируем по убыванию суммы
    return result.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Разбивка расходов по дням для выбранного месяца/недели
   * @param {'week'|'month'} period 
   * @returns {Array<{ date: string, label: string, expense: number, income: number }>}
   */
  static getTimeSeriesBreakdown(period = 'month') {
    const list = this.getFilteredTransactions(period);
    const map = {};

    list.forEach(t => {
      const dateStr = t.date;
      if (!map[dateStr]) {
        map[dateStr] = { expense: 0, income: 0 };
      }
      if (t.type === 'income') {
        map[dateStr].income += Number(t.amount) || 0;
      } else {
        map[dateStr].expense += Number(t.amount) || 0;
      }
    });

    const sortedDates = Object.keys(map).sort();
    return sortedDates.map(d => ({
      date: d,
      label: d.split('-').slice(1).reverse().join('.'), // DD.MM
      expense: map[d].expense,
      income: map[d].income
    }));
  }

  /**
   * Разбивка расходов по месяцам (для вкладки "Всё время")
   * @returns {Array<{ monthKey: string, label: string, expense: number, income: number }>}
   */
  static getMonthlyBreakdown() {
    const list = store.getTransactions();
    const map = {};

    list.forEach(t => {
      const monthKey = getMonthKey(t.date);
      if (!map[monthKey]) {
        map[monthKey] = { expense: 0, income: 0 };
      }
      if (t.type === 'income') {
        map[monthKey].income += Number(t.amount) || 0;
      } else {
        map[monthKey].expense += Number(t.amount) || 0;
      }
    });

    const sortedMonths = Object.keys(map).sort();
    return sortedMonths.map(m => {
      const [y, mm] = m.split('-');
      return {
        monthKey: m,
        label: `${mm}.${y}`,
        expense: map[m].expense,
        income: map[m].income
      };
    });
  }

  /**
   * Расчёт динамики по сравнению с предыдущим периодом
   * @param {'day'|'week'|'month'} period 
   * @returns {{ currentExpense: number, prevExpense: number, changePercent: number }}
   */
  static getComparisonWithPrevious(period = 'month') {
    const now = new Date();
    const currentList = this.getFilteredTransactions(period, now);
    
    // Вычисляем референсную дату для предыдущего периода
    const prevDate = new Date(now);
    if (period === 'day') {
      prevDate.setDate(prevDate.getDate() - 1);
    } else if (period === 'week') {
      prevDate.setDate(prevDate.getDate() - 7);
    } else if (period === 'month') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    }

    const prevList = this.getFilteredTransactions(period, prevDate);

    const currentExpense = currentList.filter(t => t.type !== 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const prevExpense = prevList.filter(t => t.type !== 'income').reduce((sum, t) => sum + Number(t.amount), 0);

    let changePercent = 0;
    if (prevExpense > 0) {
      changePercent = ((currentExpense - prevExpense) / prevExpense) * 100;
    }

    return {
      currentExpense,
      prevExpense,
      changePercent
    };
  }
}
