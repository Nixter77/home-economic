/**
 * @module tax-il
 * @description Модуль расчёта израильских налогов (שכר נטו).
 *
 * Реализует налоговое законодательство Израиля на 2024-2025 год:
 *
 *  1. Подоходный налог (מס הכנסה) — 7 прогрессивных ступеней от 10% до 50%.
 *  2. Национальное страхование (ביטוח לאומי) — взносы работника:
 *     пониженная ставка до порога, повышенная — выше порога (до потолка).
 *  3. Медицинское страхование (ביטוח בריאות) — аналогичная двухуровневая шкала.
 *  4. Пенсионные отчисления (פנסיה) — процент от брутто.
 *  5. Налоговые льготные баллы (נקודות זיכוי) — уменьшают подоходный налог.
 *
 * Все суммы — в новых израильских шекелях (₪), помесячно.
 * Модуль не использует DOM и не импортирует другие модули.
 */

// ─── Tax Year ────────────────────────────────────────────────────────

/** @type {string} Налоговый год */
export const TAX_YEAR = '2024-2025';

// ─── Income Tax Brackets (מס הכנסה) ─────────────────────────────────

/**
 * Прогрессивная шкала подоходного налога (помесячные пороги).
 * Каждая ступень: { from, to, rate }.
 * `to: Infinity` означает неограниченный верхний предел.
 *
 * @type {Array<{from: number, to: number, rate: number}>}
 */
export const TAX_BRACKETS = [
  { from: 0,      to: 7010,     rate: 0.10 },
  { from: 7010,   to: 10060,    rate: 0.14 },
  { from: 10060,  to: 16150,    rate: 0.20 },
  { from: 16150,  to: 22440,    rate: 0.31 },
  { from: 22440,  to: 46690,    rate: 0.35 },
  { from: 46690,  to: 60130,    rate: 0.47 },
  { from: 60130,  to: Infinity, rate: 0.50 },
];

// ─── National Insurance (ביטוח לאומי) ────────────────────────────────

/**
 * Ставки национального страхования (работник).
 * @type {{threshold: number, ceiling: number, reducedRate: number, fullRate: number}}
 */
export const BITUACH_LEUMI = {
  /** Порог пониженной ставки (₪/мес) */
  threshold: 7522,
  /** Потолок облагаемого дохода (₪/мес) */
  ceiling: 49030,
  /** Пониженная ставка (до порога) — 0.40% */
  reducedRate: 0.004,
  /** Полная ставка (выше порога, до потолка) — 7.00% */
  fullRate: 0.07,
};

// ─── Health Insurance (ביטוח בריאות) ─────────────────────────────────

/**
 * Ставки медицинского страхования (работник).
 * @type {{threshold: number, ceiling: number, reducedRate: number, fullRate: number}}
 */
export const BITUACH_BRIUT = {
  /** Порог пониженной ставки (₪/мес) — совпадает с порогом ביטוח לאומי */
  threshold: 7522,
  /** Потолок (совпадает с ביטוח לאומי) */
  ceiling: 49030,
  /** Пониженная ставка (до порога) — 3.10% */
  reducedRate: 0.031,
  /** Полная ставка (выше порога) — 5.00% */
  fullRate: 0.05,
};

// ─── Pension (פנסיה) ─────────────────────────────────────────────────

/** @type {number} Ставка пенсионных отчислений работника по умолчанию */
export const PENSION_DEFAULT_RATE = 0.06;

// ─── Tax Credit Points (נקודות זיכוי) ───────────────────────────────

/** @type {number} Стоимость одного налогового балла (₪/мес) */
export const CREDIT_POINT_VALUE = 242;

/** @type {number} Базовое количество баллов для резидента Израиля */
export const DEFAULT_CREDIT_POINTS = 2.25;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Округление до двух знаков после запятой.
 * @param {number} x
 * @returns {number}
 */
function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * Форматирует сумму в шекелях с символом ₪.
 * @param {number} amount — сумма в NIS
 * @returns {string} например «1,234 ₪»
 */
export function formatILS(amount) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Tax Calculation Internals ───────────────────────────────────────

/**
 * Рассчитывает подоходный налог по прогрессивной шкале.
 * Использует непрерывные интервалы [from, to) для корректного расчёта.
 *
 * @param {number} gross — месячная зарплата брутто (₪)
 * @returns {{total: number, brackets: Array<{from: number, to: number, rate: number, taxable: number, tax: number}>}}
 */
function calcIncomeTax(gross) {
  const brackets = [];
  let remaining = Math.max(0, gross);
  let total = 0;

  for (const bracket of TAX_BRACKETS) {
    if (remaining <= 0) break;
    const width = bracket.to === Infinity
      ? remaining
      : (bracket.to - bracket.from);
    const taxable = Math.min(remaining, width);
    const tax = round2(taxable * bracket.rate);

    brackets.push({
      from: bracket.from,
      to: bracket.to === Infinity ? null : bracket.to,
      rate: bracket.rate,
      taxable: round2(taxable),
      tax,
    });

    total += tax;
    remaining -= taxable;
  }

  return { total: round2(total), brackets };
}

/**
 * Рассчитывает двухуровневый взнос (ביטוח לאומי или ביטוח בריאות).
 *
 * @param {number} gross
 * @param {{threshold: number, ceiling: number, reducedRate: number, fullRate: number}} config
 * @returns {{total: number, tiers: Array<{label: string, base: number, rate: number, amount: number}>}}
 */
function calcTwoTier(gross, config) {
  const tiers = [];
  const capped = Math.min(gross, config.ceiling);

  // Часть до порога
  const reducedBase = Math.min(capped, config.threshold);
  const reducedAmount = round2(reducedBase * config.reducedRate);
  tiers.push({
    label: 'до порога',
    base: round2(reducedBase),
    rate: config.reducedRate,
    amount: reducedAmount,
  });

  // Часть выше порога (до потолка)
  if (capped > config.threshold) {
    const fullBase = capped - config.threshold;
    const fullAmount = round2(fullBase * config.fullRate);
    tiers.push({
      label: 'выше порога',
      base: round2(fullBase),
      rate: config.fullRate,
      amount: fullAmount,
    });
  }

  const total = tiers.reduce((sum, t) => sum + t.amount, 0);
  return { total: round2(total), tiers };
}

// ─── Main Export ─────────────────────────────────────────────────────

/**
 * Рассчитывает полный расчётный лист (תלוש שכר) на основе брутто-зарплаты.
 *
 * @param {number} grossSalary — месячная зарплата брутто (₪)
 * @param {object} [options={}]
 * @param {number}  [options.creditPoints=2.25]  — количество налоговых баллов
 * @param {number}  [options.pensionRate=0.06]   — ставка пенсии работника
 * @param {boolean} [options.hasPension=true]    — учитывать ли пенсию
 * @returns {{
 *   grossSalary: number,
 *   incomeTax: number,
 *   creditPointsValue: number,
 *   incomeTaxNet: number,
 *   nationalInsurance: number,
 *   healthInsurance: number,
 *   pension: number,
 *   totalDeductions: number,
 *   netSalary: number,
 *   breakdown: object
 * }}
 */
export function calculatePayslip(grossSalary, options = {}) {
  const salary = Math.max(0, Number(grossSalary) || 0);
  const {
    creditPoints = DEFAULT_CREDIT_POINTS,
    pensionRate = PENSION_DEFAULT_RATE,
    hasPension = true,
  } = options;

  // 1. Подоходный налог
  const incomeTaxResult = calcIncomeTax(salary);
  const incomeTax = incomeTaxResult.total;

  // 2. Налоговые баллы
  const creditPointsTotal = round2(creditPoints * CREDIT_POINT_VALUE);
  const incomeTaxNet = round2(Math.max(0, incomeTax - creditPointsTotal));

  // 3. Национальное страхование
  const niResult = calcTwoTier(salary, BITUACH_LEUMI);
  const nationalInsurance = niResult.total;

  // 4. Медицинское страхование
  const hiResult = calcTwoTier(salary, BITUACH_BRIUT);
  const healthInsurance = hiResult.total;

  // 5. Пенсия
  const pensionAmount = hasPension ? round2(salary * pensionRate) : 0;

  // Итого
  const totalDeductions = round2(
    incomeTaxNet + nationalInsurance + healthInsurance + pensionAmount
  );
  const netSalary = round2(salary - totalDeductions);

  return {
    grossSalary: salary,
    incomeTax,
    creditPointsValue: creditPointsTotal,
    incomeTaxNet,
    nationalInsurance,
    healthInsurance,
    pension: pensionAmount,
    totalDeductions,
    netSalary,
    breakdown: {
      incomeTax: incomeTaxResult,
      nationalInsurance: niResult,
      healthInsurance: hiResult,
      creditPoints: {
        points: creditPoints,
        valuePerPoint: CREDIT_POINT_VALUE,
        totalValue: creditPointsTotal,
      },
      pension: {
        rate: hasPension ? pensionRate : 0,
        amount: pensionAmount,
      },
    },
  };
}
