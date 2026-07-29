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
