/**
 * Реестр категорий расходов/доходов
 */

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Еда', icon: '🍕', color: '#FF6B35' },
  { id: 'alcohol', name: 'Алкоголь', icon: '🍷', color: '#9B59B6' },
  { id: 'fruits-vegetables', name: 'Фрукты-овощи', icon: '🥦', color: '#27AE60' },
  { id: 'meat', name: 'Мясо', icon: '🥩', color: '#E74C3C' },
  { id: 'transport', name: 'Транспорт', icon: '🚌', color: '#3498DB' },
  { id: 'housing', name: 'Жильё', icon: '🏠', color: '#F39C12' },
  { id: 'utilities', name: 'Коммунальные', icon: '💡', color: '#1ABC9C' },
  { id: 'health', name: 'Здоровье', icon: '💊', color: '#E91E63' },
  { id: 'entertainment', name: 'Развлечения', icon: '🎬', color: '#FF9800' },
  { id: 'clothes', name: 'Одежда', icon: '👕', color: '#795548' },
  { id: 'other', name: 'Другое', icon: '📦', color: '#607D8B' }
];

const CATEGORIES_KEY = 'he_categories';

class CategoryManager {
  constructor() {
    this.categories = this.loadCategories();
  }

  loadCategories() {
    try {
      const saved = localStorage.getItem(CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки категорий из localStorage:', e);
    }
    return [...DEFAULT_CATEGORIES];
  }

  saveCategories() {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categories));
    } catch (e) {
      console.error('Ошибка сохранения категорий:', e);
    }
  }

  getAll() {
    return this.categories;
  }

  getById(id) {
    return this.categories.find(cat => cat.id === id) || {
      id: id,
      name: id,
      icon: '🏷️',
      color: '#9E9E9E'
    };
  }

  addCategory(category) {
    if (!category.id || !category.name) return false;
    if (this.categories.some(c => c.id === category.id)) {
      return false;
    }
    this.categories.push({
      id: category.id,
      name: category.name,
      icon: category.icon || '🏷️',
      color: category.color || '#607D8B'
    });
    this.saveCategories();
    return true;
  }

  updateCategory(id, updatedData) {
    const index = this.categories.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.categories[index] = {
      ...this.categories[index],
      ...updatedData
    };
    this.saveCategories();
    return true;
  }

  deleteCategory(id) {
    // Не даём удалить единственную оставшуюся категорию
    if (this.categories.length <= 1) return false;
    this.categories = this.categories.filter(c => c.id !== id);
    this.saveCategories();
    return true;
  }

  resetToDefaults() {
    this.categories = [...DEFAULT_CATEGORIES];
    this.saveCategories();
  }
}

export const categoryManager = new CategoryManager();
