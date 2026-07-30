/**
 * Вспомогательные утилиты для Home Economic
 */

/**
 * Форматирует число в валюту Израильских Шекелей (₪)
 * @param {number} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Генерирует уникальный идентификатор (UUID v4)
 * @returns {string}
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Возвращает строковый ключ месяца в формате YYYY-MM
 * @param {Date|string} dateInput 
 * @returns {string}
 */
export function getMonthKey(dateInput = new Date()) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Возвращает дату в формате YYYY-MM-DD для input[type="date"]
 * @param {Date|string} dateInput 
 * @returns {string}
 */
export function formatDateISO(dateInput = new Date()) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Форматирует дату для отображения человеку (например, "30 июля 2026")
 * @param {string|Date} dateInput 
 * @returns {string}
 */
export function formatDateHuman(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

/**
 * Форматирует дату коротко (например, "30.07")
 * @param {string|Date} dateInput 
 * @returns {string}
 */
export function formatDateShort(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

/**
 * Безопасное вычисление математического выражения (например "50 + 30.5 * 2")
 * @param {string} expr 
 * @returns {number|null}
 */
export function evaluateMathExpression(expr) {
  if (typeof expr !== 'string') return null;

  const cleanExpr = expr.replace(/,/g, '.').trim();
  if (!cleanExpr) return null;

  const tokens = cleanExpr.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens || tokens.join('') !== cleanExpr.replace(/\s+/g, '')) {
    return null;
  }

  let index = 0;

  function parsePrimary() {
    const token = tokens[index];
    if (!token) return null;

    if (token === '(') {
      index++;
      const val = parseExpression();
      if (tokens[index] !== ')') return null;
      index++;
      return val;
    }

    if (token === '-') {
      index++;
      const val = parsePrimary();
      return val !== null ? -val : null;
    }

    const num = parseFloat(token);
    if (isNaN(num)) return null;
    index++;
    return num;
  }

  function parseTerm() {
    let left = parsePrimary();
    if (left === null) return null;

    while (index < tokens.length && (tokens[index] === '*' || tokens[index] === '/')) {
      const operator = tokens[index++];
      const right = parsePrimary();
      if (right === null) return null;

      if (operator === '*') {
        left *= right;
      } else if (operator === '/') {
        if (right === 0) return null;
        left /= right;
      }
    }
    return left;
  }

  function parseExpression() {
    let left = parseTerm();
    if (left === null) return null;

    while (index < tokens.length && (tokens[index] === '+' || tokens[index] === '-')) {
      const operator = tokens[index++];
      const right = parseTerm();
      if (right === null) return null;

      if (operator === '+') {
        left += right;
      } else if (operator === '-') {
        left -= right;
      }
    }
    return left;
  }

  try {
    const result = parseExpression();
    if (index !== tokens.length || result === null || !isFinite(result)) {
      return null;
    }
    return Math.max(0, result);
  } catch (e) {
    return null;
  }
}

/**
 * Извлекает хештеги из текста заметок (например "#супермаркет #праздник")
 * @param {string} text 
 * @returns {string[]}
 */
export function extractHashtags(text) {
  if (typeof text !== 'string') return [];
  const matches = text.match(/#[a-zA-Z0-9а-яА-ЯёЁ_]+/g);
  return matches ? Array.from(new Set(matches.map(t => t.toLowerCase()))) : [];
}

/**
 * Возвращает количество дней в месяце
 * @param {number} year 
 * @param {number} monthIndex (0-11)
 * @returns {number}
 */
export function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Безопасное экранирование HTML для предотвращения XSS
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
