/**
 * Модуль аналитики и расчёта финансовых показателей
 */

import { store } from './store.js';
import { categoryManager } from './categories.js';
import { getMonthKey, formatDateISO } from './utils.js';

/**
 * Короткая подпись дня недели для графиков (Пн, Вт, ...)
 * @param {Date} d
 * @returns {string}
 */
function formatDayLabel(d) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(d);
}

export class Analytics {
  /**
   * Отфильтровать транзакции по периоду
   * @param {'day'|'week'|'month'|'custom'|'all'} period 
   * @param {Date|string} [refDate] 
   * @param {{ startDate?: string, endDate?: string }} [customRange]
   * @returns {Array}
   */
  static getFilteredTransactions(period = 'month', refDate = new Date(), customRange = {}) {
    const transactions = store.getTransactions();
    const target = new Date(refDate);

    return transactions.filter(t => {
      const txDate = new Date(t.date);
      
      switch (period) {
        case 'day': {
          return txDate.toDateString() === target.toDateString();
        }
        case 'week': {
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
        case 'custom': {
          if (customRange.startDate && t.date < customRange.startDate) return false;
          if (customRange.endDate && t.date > customRange.endDate) return false;
          return true;
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
  static getSummary(period = 'month', refDate = new Date()) {
    const list = this.getFilteredTransactions(period, refDate);
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
  static getCategoryBreakdown(period = 'month', refDate = new Date(), customRange = {}) {
    const list = this.getFilteredTransactions(period, refDate, customRange).filter(t => t.type !== 'income');
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
  static getTimeSeriesBreakdown(period = 'month', refDate = new Date(), customRange = {}) {
    const list = this.getFilteredTransactions(period, refDate, customRange);
    const target = new Date(refDate);
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

    // Формируем непрерывный ряд по дням периода
    const result = [];
    const cursor = new Date(target);

    if (period === 'week') {
      const day = cursor.getDay() || 7;
      cursor.setDate(cursor.getDate() - day + 1); // понедельник
      for (let i = 0; i < 7; i++) {
        const key = formatDateISO(cursor);
        result.push({
          date: key,
          label: formatDayLabel(cursor),
          expense: map[key]?.expense || 0,
          income: map[key]?.income || 0
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (period === 'month') {
      cursor.setDate(1);
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      for (let i = 0; i < daysInMonth; i++) {
        const key = formatDateISO(cursor);
        result.push({
          date: key,
          label: String(cursor.getDate()),
          expense: map[key]?.expense || 0,
          income: map[key]?.income || 0
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (period === 'custom' && customRange.startDate && customRange.endDate) {
      const start = new Date(customRange.startDate);
      const end = new Date(customRange.endDate);
      const curr = new Date(start);
      while (curr <= end) {
        const key = formatDateISO(curr);
        result.push({
          date: key,
          label: key.slice(8, 10) + '.' + key.slice(5, 7),
          expense: map[key]?.expense || 0,
          income: map[key]?.income || 0
        });
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      // day / all — только дни с данными, по возрастанию
      const keys = Object.keys(map).sort();
      keys.forEach(key => {
        result.push({
          date: key,
          label: key.slice(8, 10) + '.' + key.slice(5, 7),
          expense: map[key].expense,
          income: map[key].income
        });
      });
    }

    return result;
  }

  /**
   * Прогноз расходов к концу текущего месяца
   * @param {Date|string} [refDate] 
   * @returns {{ spentSoFar: number, projectedTotal: number, daysPassed: number, totalDays: number }}
   */
  static getMonthForecast(refDate = new Date()) {
    const target = new Date(refDate);
    const now = new Date();
    
    // Если выбран прошлый месяц — прогноз равен фактическим расходам
    if (target.getFullYear() < now.getFullYear() || 
       (target.getFullYear() === now.getFullYear() && target.getMonth() < now.getMonth())) {
      const summary = this.getSummary('month', target);
      return {
        spentSoFar: summary.totalExpense,
        projectedTotal: summary.totalExpense,
        daysPassed: new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate(),
        totalDays: new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      };
    }

    const summary = this.getSummary('month', target);
    const totalDays = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, target.getDate());

    const spentSoFar = summary.totalExpense;
    const projectedTotal = Math.round((spentSoFar / daysPassed) * totalDays);

    return {
      spentSoFar,
      projectedTotal,
      daysPassed,
      totalDays
    };
  }

  /**
   * Получить статус бюджетов по категориям
   * @param {Date|string} [refDate] 
   * @returns {Array<{ category: Object, spent: number, limit: number, percent: number, status: 'ok'|'warning'|'danger' }>}
   */
  static getBudgetProgress(refDate = new Date()) {
    const breakdown = this.getCategoryBreakdown('month', refDate);
    const allCategories = categoryManager.getAll();

    return allCategories.map(cat => {
      const item = breakdown.find(b => b.category.id === cat.id);
      const spent = item ? item.amount : 0;
      const limit = Number(cat.budgetLimit) || 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;

      let status = 'ok';
      if (limit > 0) {
        if (percent >= 100) status = 'danger';
        else if (percent >= 75) status = 'warning';
      }

      return {
        category: cat,
        spent,
        limit,
        percent,
        status
      };
    }).filter(b => b.limit > 0 || b.spent > 0);
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
