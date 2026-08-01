/**
 * @module Analytics Engine
 * @description High-performance financial analytics, category breakdown, and forecasting.
 * 
 * Refactored to modern ES2024 standards:
 *  - O(1) Map lookups for budget status calculation.
 *  - Zero-heap-allocation ISO string date matching (eliminating GC thrashing).
 *  - Tree-shakable functional exports with backward-compatible Analytics facade.
 * 
 * @version 2.0.0
 */

import { store } from './store.js';
import { categoryManager } from './categories.js';

// ─── Private Helper Utilities ────────────────────────────────────────

/**
 * Formats a Date object into a localized short weekday (e.g., "Пн", "Вт").
 * Uses a cached Intl.DateTimeFormat instance to avoid re-creation overhead.
 */
const dayLabelFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

function formatDayLabel(date) {
  return dayLabelFormatter.format(date);
}

/**
 * Formats a Date object as ISO date string (YYYY-MM-DD) without timezone offset drift.
 * 
 * @param {Date} date 
 * @returns {string} ISO Date string
 */
function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Core Exported Analytics Functions ─────────────────────────────────

/**
 * Efficiently filters transactions by period without allocating Date objects in the hot loop.
 * 
 * @param {'day'|'week'|'month'|'custom'|'all'} [period='month']
 * @param {Date|string} [refDate=new Date()]
 * @param {{ startDate?: string, endDate?: string }} [customRange={}]
 * @returns {Array<Object>} Filtered transactions array
 */
export function getFilteredTransactions(period = 'month', refDate = new Date(), customRange = {}) {
  const transactions = store.getTransactions();
  if (transactions.length === 0) return [];

  const targetDate = typeof refDate === 'string' ? new Date(refDate) : refDate;
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetMonthKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  switch (period) {
    case 'day': {
      const targetDayStr = toISODateString(targetDate);
      return transactions.filter(t => t.date === targetDayStr);
    }

    case 'month': {
      // Fast path: String prefix matching (O(N) character check, zero Date allocations)
      return transactions.filter(t => t.date?.startsWith(targetMonthKey));
    }

    case 'week': {
      // Calculate Monday 00:00:00 to Sunday 23:59:59 bounds
      const startOfWeek = new Date(targetDate);
      const dayOfWeek = startOfWeek.getDay() || 7; // Convert Sunday=0 to Sunday=7
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const startISO = toISODateString(startOfWeek);
      const endISO = toISODateString(endOfWeek);

      return transactions.filter(t => t.date >= startISO && t.date <= endISO);
    }

    case 'custom': {
      const { startDate, endDate } = customRange;
      if (!startDate && !endDate) return transactions;
      return transactions.filter(t => {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        return true;
      });
    }

    case 'all':
    default:
      return transactions;
  }
}

/**
 * Calculates total income, expense, and balance in a single pass.
 * 
 * @param {'day'|'week'|'month'|'all'} [period='month']
 * @param {Date|string} [refDate=new Date()]
 * @returns {{ totalExpense: number, totalIncome: number, balance: number, count: number }}
 */
export function getSummary(period = 'month', refDate = new Date()) {
  const transactions = getFilteredTransactions(period, refDate);
  let totalExpense = 0;
  let totalIncome = 0;

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  }

  return {
    totalExpense,
    totalIncome,
    balance: totalIncome - totalExpense,
    count: transactions.length
  };
}

/**
 * Aggregates expenses by category for the given period.
 * 
 * @param {'day'|'week'|'month'|'all'|'custom'} [period='month']
 * @param {Date|string} [refDate=new Date()]
 * @param {{ startDate?: string, endDate?: string }} [customRange={}]
 * @returns {Array<{ category: Object, amount: number, percent: number, count: number }>}
 */
export function getCategoryBreakdown(period = 'month', refDate = new Date(), customRange = {}) {
  const transactions = getFilteredTransactions(period, refDate, customRange);
  
  // Use Map for O(1) hash map operations
  const totalsMap = new Map();
  const countsMap = new Map();
  let totalExpense = 0;

  for (const t of transactions) {
    if (t.type === 'income') continue; // Expense breakdown only

    const catId = t.category || 'other';
    const amount = Number(t.amount) || 0;

    totalsMap.set(catId, (totalsMap.get(catId) ?? 0) + amount);
    countsMap.set(catId, (countsMap.get(catId) ?? 0) + 1);
    totalExpense += amount;
  }

  const result = [];
  for (const [catId, amount] of totalsMap.entries()) {
    const category = categoryManager.getById(catId);
    const percent = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
    result.push({
      category,
      amount,
      percent,
      count: countsMap.get(catId) ?? 0
    });
  }

  // Sort descending by total spent amount
  return result.sort((a, b) => b.amount - a.amount);
}

/**
 * Generates continuous daily time series data for charts.
 * 
 * @param {'week'|'month'|'custom'|'all'} [period='month']
 * @param {Date|string} [refDate=new Date()]
 * @param {{ startDate?: string, endDate?: string }} [customRange={}]
 * @returns {Array<{ date: string, label: string, expense: number, income: number }>}
 */
export function getTimeSeriesBreakdown(period = 'month', refDate = new Date(), customRange = {}) {
  const list = getFilteredTransactions(period, refDate, customRange);
  const targetDate = typeof refDate === 'string' ? new Date(refDate) : refDate;
  
  // Fast accumulator map: ISO Date -> { expense, income }
  const map = new Map();
  for (const t of list) {
    const entry = map.get(t.date) ?? { expense: 0, income: 0 };
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      entry.income += amt;
    } else {
      entry.expense += amt;
    }
    map.set(t.date, entry);
  }

  const result = [];
  const cursor = new Date(targetDate);

  if (period === 'week') {
    const day = cursor.getDay() || 7;
    cursor.setDate(cursor.getDate() - day + 1); // Reset to Monday
    for (let i = 0; i < 7; i++) {
      const key = toISODateString(cursor);
      const data = map.get(key);
      result.push({
        date: key,
        label: formatDayLabel(cursor),
        expense: data?.expense ?? 0,
        income: data?.income ?? 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (period === 'month') {
    cursor.setDate(1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let i = 0; i < daysInMonth; i++) {
      const key = toISODateString(cursor);
      const data = map.get(key);
      result.push({
        date: key,
        label: String(cursor.getDate()),
        expense: data?.expense ?? 0,
        income: data?.income ?? 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (period === 'custom' && customRange.startDate && customRange.endDate) {
    const start = new Date(customRange.startDate);
    const end = new Date(customRange.endDate);
    const curr = new Date(start);
    while (curr <= end) {
      const key = toISODateString(curr);
      const data = map.get(key);
      result.push({
        date: key,
        label: `${key.slice(8, 10)}.${key.slice(5, 7)}`,
        expense: data?.expense ?? 0,
        income: data?.income ?? 0
      });
      curr.setDate(curr.getDate() + 1);
    }
  } else {
    // Sort populated dates chronologically
    const sortedKeys = Array.from(map.keys()).sort();
    for (const key of sortedKeys) {
      const data = map.get(key);
      result.push({
        date: key,
        label: `${key.slice(8, 10)}.${key.slice(5, 7)}`,
        expense: data.expense,
        income: data.income
      });
    }
  }

  return result;
}

/**
 * Calculates spending forecast for the current month based on daily velocity.
 * 
 * @param {Date|string} [refDate=new Date()]
 * @returns {{ spentSoFar: number, projectedTotal: number, daysPassed: number, totalDays: number }}
 */
export function getMonthForecast(refDate = new Date()) {
  const target = new Date(refDate);
  const now = new Date();
  
  // Past months return actual final totals
  const isPastMonth = target.getFullYear() < now.getFullYear() || 
    (target.getFullYear() === now.getFullYear() && target.getMonth() < now.getMonth());

  const summary = getSummary('month', target);
  const totalDays = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

  if (isPastMonth) {
    return {
      spentSoFar: summary.totalExpense,
      projectedTotal: summary.totalExpense,
      daysPassed: totalDays,
      totalDays
    };
  }

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
 * Computes category budget status with O(N + M) complexity using a Hash Lookup Table.
 * 
 * Optimization: Replaced O(N * M) nested .find() calls with an O(1) Map lookup.
 * 
 * @param {Date|string} [refDate=new Date()]
 * @returns {Array<{ category: Object, spent: number, limit: number, percent: number, status: 'ok'|'warning'|'danger' }>}
 */
export function getBudgetProgress(refDate = new Date()) {
  const breakdown = getCategoryBreakdown('month', refDate);
  
  // Build O(1) lookup table: categoryId -> spent amount
  const spentMap = new Map(breakdown.map(b => [b.category.id, b.amount]));

  const expenseCategories = categoryManager.getByKind
    ? categoryManager.getByKind('expense')
    : categoryManager.getAll().filter(c => c.kind !== 'income');

  return expenseCategories
    .map(cat => {
      const spent = spentMap.get(cat.id) ?? 0;
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
    })
    .filter(b => b.limit > 0 || b.spent > 0);
}

/**
 * Calculates percentage velocity changes compared to the previous period.
 * 
 * @param {'day'|'week'|'month'} [period='month']
 * @returns {{ currentExpense: number, prevExpense: number, changePercent: number }}
 */
export function getComparisonWithPrevious(period = 'month') {
  const now = new Date();
  const currentSummary = getSummary(period, now);
  
  const prevDate = new Date(now);
  if (period === 'day') {
    prevDate.setDate(prevDate.getDate() - 1);
  } else if (period === 'week') {
    prevDate.setDate(prevDate.getDate() - 7);
  } else if (period === 'month') {
    prevDate.setMonth(prevDate.getMonth() - 1);
  }

  const prevSummary = getSummary(period, prevDate);

  let changePercent = 0;
  if (prevSummary.totalExpense > 0) {
    changePercent = ((currentSummary.totalExpense - prevSummary.totalExpense) / prevSummary.totalExpense) * 100;
  }

  return {
    currentExpense: currentSummary.totalExpense,
    prevExpense: prevSummary.totalExpense,
    changePercent
  };
}

// ─── Backward Compatibility Facade ─────────────────────────────────────

/**
 * Analytics Class Facade
 * Maintains 100% backward compatibility for legacy callers referencing Analytics.method()
 */
export class Analytics {
  static getFilteredTransactions = getFilteredTransactions;
  static getSummary = getSummary;
  static getCategoryBreakdown = getCategoryBreakdown;
  static getTimeSeriesBreakdown = getTimeSeriesBreakdown;
  static getMonthForecast = getMonthForecast;
  static getBudgetProgress = getBudgetProgress;
  static getMonthlyBreakdown = function() {
    const list = store.getTransactions();
    const map = new Map();

    for (const t of list) {
      if (!t.date) continue;
      const monthKey = t.date.slice(0, 7); // "YYYY-MM"
      const entry = map.get(monthKey) ?? { expense: 0, income: 0 };
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        entry.income += amt;
      } else {
        entry.expense += amt;
      }
      map.set(monthKey, entry);
    }

    const sortedMonths = Array.from(map.keys()).sort();
    return sortedMonths.map(m => {
      const [y, mm] = m.split('-');
      const entry = map.get(m);
      return {
        monthKey: m,
        label: `${mm}.${y}`,
        expense: entry.expense,
        income: entry.income
      };
    });
  };
  static getComparisonWithPrevious = getComparisonWithPrevious;
}
