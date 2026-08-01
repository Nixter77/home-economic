/**
 * Модуль экспорта и импорта данных
 */

import { store } from './store.js';
import { categoryManager } from './categories.js';
import { wageSettings } from './wage.js';

export function exportDataToJSON() {
  const data = {
    app: 'home-economic',
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: store.getTransactions(),
    categories: categoryManager.getAll(),
    wage: wageSettings.get()
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `home-economic-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importDataFromJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('Файл не выбран'));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Некорректный формат JSON');
        }

        if (Array.isArray(parsed.transactions)) {
          store.importData({ transactions: parsed.transactions });
        }

        if (Array.isArray(parsed.categories)) {
          parsed.categories.forEach(cat => {
            categoryManager.addCategory(cat);
          });
        }

        if (parsed.wage && typeof parsed.wage === 'object') {
          wageSettings.replaceAll(parsed.wage);
        }

        resolve(true);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file);
  });
}
