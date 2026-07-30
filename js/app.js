/**
 * Главный модуль приложения (Entrypoint)
 * Инициализация роутера, связывание UI и хранилища
 */

import { router } from './router.js';
import { store } from './store.js';
import { categoryManager } from './categories.js';
import { TransactionController } from './transactions.js';
import { Analytics } from './analytics.js';
import { chartManager } from './charts.js';
import { exportDataToJSON, importDataFromJSON } from './export.js';
import { formatCurrency, formatDateHuman, formatDateISO, escapeHTML, evaluateMathExpression, extractHashtags } from './utils.js';
import { initRipples, countUp, staggerChildren } from './motion.js';

// Текущее выбранное состояние периодов
let currentDashboardPeriod = 'month';
let currentAnalyticsPeriod = 'month';
let selectedCategoryForAdd = null;
let currentTransactionType = 'expense';
let currentAnalyticsRefDate = new Date();
let customAnalyticsRange = { startDate: '', endDate: '' };

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const savedTheme = store.loadTheme();
  store.setTheme(savedTheme);

  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    store.toggleTheme();
  });

  // Ripple-эффект на всех кнопках .btn
  initRipples();

  router.addRoute('dashboard', renderDashboardView);
  router.addRoute('add', renderAddView);
  router.addRoute('history', renderHistoryView);
  router.addRoute('analytics', renderAnalyticsView);
  router.addRoute('categories', renderCategoriesView);
  router.addRoute('settings', renderSettingsView);
  router.setDefaultRoute('dashboard');

  store.subscribe(() => {
    refreshCurrentView();
  });

  initFormEvents();
  initDashboardEvents();
  initAnalyticsEvents();
  initHistoryEvents();
  initCategoriesEvents();
  initSettingsEvents();

  router.start();
}

function refreshCurrentView() {
  const currentRoute = router.currentRoute || 'dashboard';
  switch (currentRoute) {
    case 'dashboard': renderDashboardView(); break;
    case 'history': renderHistoryView(); break;
    case 'analytics': renderAnalyticsView(); break;
    case 'categories': renderCategoriesView(); break;
  }
}

/* ==========================================================================
   VIEW 1: DASHBOARD
   ========================================================================== */

function renderDashboardView() {
  showView('view-dashboard');

  const summary = Analytics.getSummary(currentDashboardPeriod);
  const comp = Analytics.getComparisonWithPrevious(currentDashboardPeriod);
  const forecast = Analytics.getMonthForecast();

  // Суммы (с count-up анимацией)
  countUp(document.getElementById('dashboard-total-expense'), summary.totalExpense, formatCurrency);
  countUp(document.getElementById('dashboard-total-income'), summary.totalIncome, formatCurrency);

  // Прогноз
  countUp(document.getElementById('dashboard-forecast-total'), forecast.projectedTotal, formatCurrency);
  document.getElementById('dashboard-forecast-sub').textContent = `Прошло ${forecast.daysPassed} из ${forecast.totalDays} дней`;

  // Изменение
  const changeEl = document.getElementById('dashboard-expense-change');
  if (comp.prevExpense > 0) {
    const diffSign = comp.changePercent > 0 ? '+' : '';
    const dirClass = comp.changePercent > 0 ? 'up' : 'down';
    changeEl.textContent = `${diffSign}${comp.changePercent.toFixed(1)}% к пред. периоду`;
    changeEl.className = `stat-change ${dirClass}`;
  } else {
    changeEl.textContent = 'Нет данных за пред. период';
    changeEl.className = 'stat-change';
  }

  // Индикаторы бюджетов категорий
  renderBudgetProgressList();

  // Pie Chart (Интерактивный клик)
  const categoryData = Analytics.getCategoryBreakdown(currentDashboardPeriod);
  const pieCanvas = document.getElementById('dashboard-pie-chart');
  chartManager.renderCategoryPieChart(pieCanvas, categoryData, (clickedCat) => {
    // Переход на историю с фильтром по этой категории
    document.getElementById('history-filter-category').value = clickedCat.id;
    router.navigate('history');
  });

  // Bar Chart
  const timeSeries = Analytics.getTimeSeriesBreakdown(currentDashboardPeriod);
  const barCanvas = document.getElementById('dashboard-bar-chart');
  chartManager.renderBarChart(barCanvas, timeSeries);

  // Последние 5 транзакций
  const recentList = store.getTransactions().slice(0, 5);
  const recentContainer = document.getElementById('dashboard-recent-list');
  renderTransactionList(recentContainer, recentList, true);
}

function renderBudgetProgressList() {
  const container = document.getElementById('dashboard-budget-progress-list');
  const progressData = Analytics.getBudgetProgress();
  container.innerHTML = '';

  if (progressData.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.85rem;">Лимиты категорий не заданы</p>';
    return;
  }

  progressData.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'padding: 8px 0; border-bottom: 1px solid var(--color-surface-border);';

    const percentClamped = Math.min(100, Math.round(item.percent));
    const limitLabel = item.limit > 0 ? `/ ${formatCurrency(item.limit)}` : '';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 500;">
        <span>${item.category.icon} ${escapeHTML(item.category.name)}</span>
        <span>${formatCurrency(item.spent)} <span style="color: var(--color-text-muted);">${limitLabel}</span></span>
      </div>
      ${item.limit > 0 ? `
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${item.status}" style="width: ${percentClamped}%;"></div>
        </div>
      ` : ''}
    `;

    container.appendChild(row);
  });

  // Каскадная анимация появления индикаторов бюджетов
  staggerChildren(container);
}

function initDashboardEvents() {
  const selector = document.getElementById('dashboard-period-selector');
  selector.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-btn')) {
      selector.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentDashboardPeriod = e.target.dataset.period;
      renderDashboardView();
    }
  });
}

/* ==========================================================================
   VIEW 2: ADD TRANSACTION
   ========================================================================== */

function renderAddView() {
  showView('view-add');

  // Установка сегодняшней даты по умолчанию
  document.getElementById('tx-date').value = formatDateISO(new Date());

  // Очистить форму если не режим редактирования
  const form = document.getElementById('transaction-form');
  const idInput = document.getElementById('tx-id');
  if (!idInput.value) {
    form.reset();
    document.getElementById('tx-date').value = formatDateISO(new Date());
    currentTransactionType = 'expense';
    updateTypeButtons();
  }

  renderCategoryGrid();
}

function renderCategoryGrid() {
  const grid = document.getElementById('tx-category-grid');
  grid.innerHTML = '';
  const categories = categoryManager.getAll();

  categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = `category-card ${selectedCategoryForAdd === cat.id ? 'selected' : ''}`;
    card.dataset.id = cat.id;

    card.innerHTML = `
      <span class="cat-icon">${cat.icon}</span>
      <span class="cat-name">${escapeHTML(cat.name)}</span>
    `;

    card.addEventListener('click', () => {
      grid.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCategoryForAdd = cat.id;
      document.getElementById('tx-category').value = cat.id;
    });

    grid.appendChild(card);
  });

  // Каскадная анимация появления карточек категорий
  staggerChildren(grid, 30);

  // Выбрать первую по умолчанию, если не выбрано
  if (!selectedCategoryForAdd && categories.length > 0) {
    selectedCategoryForAdd = categories[0].id;
    document.getElementById('tx-category').value = categories[0].id;
    const firstCard = grid.querySelector('.category-card');
    if (firstCard) firstCard.classList.add('selected');
  }
}

function updateTypeButtons() {
  const expenseBtn = document.getElementById('type-expense-btn');
  const incomeBtn = document.getElementById('type-income-btn');

  if (currentTransactionType === 'expense') {
    expenseBtn.classList.add('active');
    incomeBtn.classList.remove('active');
  } else {
    incomeBtn.classList.add('active');
    expenseBtn.classList.remove('active');
  }
}

function initFormEvents() {
  const amountInput = document.getElementById('tx-amount');
  
  // Калькулятор математических выражений в поле суммы
  amountInput.addEventListener('blur', () => {
    const raw = amountInput.value;
    if (raw && (raw.includes('+') || raw.includes('-') || raw.includes('*') || raw.includes('/'))) {
      const calcResult = evaluateMathExpression(raw);
      if (calcResult !== null) {
        amountInput.value = calcResult;
      }
    }
  });

  const expenseBtn = document.getElementById('type-expense-btn');
  const incomeBtn = document.getElementById('type-income-btn');

  expenseBtn.addEventListener('click', () => {
    currentTransactionType = 'expense';
    updateTypeButtons();
  });

  incomeBtn.addEventListener('click', () => {
    currentTransactionType = 'income';
    updateTypeButtons();
  });

  const form = document.getElementById('transaction-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('tx-id').value;
    const rawAmount = document.getElementById('tx-amount').value;
    const evaluatedAmount = evaluateMathExpression(rawAmount) || Number(rawAmount);

    const formData = {
      amount: evaluatedAmount,
      type: currentTransactionType,
      category: selectedCategoryForAdd || document.getElementById('tx-category').value,
      date: document.getElementById('tx-date').value,
      note: document.getElementById('tx-note').value
    };

    let result;
    if (id) {
      result = TransactionController.editTransaction(id, formData);
    } else {
      result = TransactionController.createTransaction(formData);
    }

    if (result.success) {
      form.reset();
      document.getElementById('tx-id').value = '';
      selectedCategoryForAdd = null;
      router.navigate('dashboard');
    } else {
      alert(result.message || 'Ошибка сохранения');
    }
  });
}

/* ==========================================================================
   VIEW 3: HISTORY
   ========================================================================== */

function renderHistoryView() {
  showView('view-history');
  updateHistoryCategoryFilterOptions();
  applyHistoryFilters();
}

function updateHistoryCategoryFilterOptions() {
  const select = document.getElementById('history-filter-category');
  const currentVal = select.value;
  select.innerHTML = '<option value="all">Все категории</option>';

  categoryManager.getAll().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    select.appendChild(opt);
  });

  select.value = currentVal || 'all';
}

function applyHistoryFilters() {
  const categoryId = document.getElementById('history-filter-category').value;
  const type = document.getElementById('history-filter-type').value;
  const search = document.getElementById('history-search').value;

  const filtered = TransactionController.filterTransactions({
    categoryId,
    type,
    search
  });

  document.getElementById('history-total-count').textContent = `${filtered.length} записей`;
  const container = document.getElementById('history-tx-list');
  renderTransactionList(container, filtered, true);
}

function initHistoryEvents() {
  document.getElementById('history-filter-category').addEventListener('change', applyHistoryFilters);
  document.getElementById('history-filter-type').addEventListener('change', applyHistoryFilters);
  document.getElementById('history-search').addEventListener('input', applyHistoryFilters);
}

/* ==========================================================================
   VIEW 4: ANALYTICS
   ========================================================================== */

function renderAnalyticsView() {
  showView('view-analytics');

  // Обновление метки месяца
  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(currentAnalyticsRefDate);
  document.getElementById('analytics-month-label').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const customRangeBox = document.getElementById('analytics-custom-range-box');
  const monthNav = document.getElementById('analytics-month-nav');

  if (currentAnalyticsPeriod === 'custom') {
    customRangeBox.style.display = 'block';
    monthNav.style.display = 'none';
  } else if (currentAnalyticsPeriod === 'month') {
    customRangeBox.style.display = 'none';
    monthNav.style.display = 'flex';
  } else {
    customRangeBox.style.display = 'none';
    monthNav.style.display = 'none';
  }

  // Category Pie Chart
  const categoryData = currentAnalyticsPeriod === 'custom' 
    ? Analytics.getCategoryBreakdown('custom', currentAnalyticsRefDate, customAnalyticsRange)
    : Analytics.getCategoryBreakdown(currentAnalyticsPeriod, currentAnalyticsRefDate);

  const pieCanvas = document.getElementById('analytics-pie-chart');
  chartManager.renderCategoryPieChart(pieCanvas, categoryData, (clickedCat) => {
    document.getElementById('history-filter-category').value = clickedCat.id;
    router.navigate('history');
  });

  // Таблица категорий
  const tableContainer = document.getElementById('analytics-category-table');
  if (categoryData.length === 0) {
    tableContainer.innerHTML = '<p style="color: var(--color-text-muted);">Нет данных за этот период</p>';
  } else {
    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--color-divider); text-align: left; color: var(--color-text-muted);">
            <th style="padding: 8px 4px;">Категория</th>
            <th style="padding: 8px 4px; text-align: right;">Сумма</th>
            <th style="padding: 8px 4px; text-align: right;">Доля</th>
          </tr>
        </thead>
        <tbody>
    `;

    categoryData.forEach(item => {
      html += `
        <tr style="border-bottom: 1px solid var(--color-surface-border);">
          <td style="padding: 10px 4px;">${item.category.icon} ${escapeHTML(item.category.name)}</td>
          <td style="padding: 10px 4px; text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
          <td style="padding: 10px 4px; text-align: right; color: var(--color-text-muted);">${item.percent.toFixed(1)}%</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
  }

  // Trend Line Chart
  const lineCanvas = document.getElementById('analytics-line-chart');
  if (currentAnalyticsPeriod === 'all') {
    const monthly = Analytics.getMonthlyBreakdown();
    chartManager.renderLineChart(lineCanvas, monthly);
  } else {
    const timeSeries = Analytics.getTimeSeriesBreakdown(currentAnalyticsPeriod, currentAnalyticsRefDate);
    chartManager.renderLineChart(lineCanvas, timeSeries);
  }
}

function initAnalyticsEvents() {
  const selector = document.getElementById('analytics-period-selector');
  selector.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-btn')) {
      selector.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentAnalyticsPeriod = e.target.dataset.period;
      renderAnalyticsView();
    }
  });

  // Переключатель месяцев ◀ ▶
  document.getElementById('analytics-prev-month').addEventListener('click', () => {
    currentAnalyticsRefDate.setMonth(currentAnalyticsRefDate.getMonth() - 1);
    renderAnalyticsView();
  });

  document.getElementById('analytics-next-month').addEventListener('click', () => {
    currentAnalyticsRefDate.setMonth(currentAnalyticsRefDate.getMonth() + 1);
    renderAnalyticsView();
  });

  // Кастомный диапазон
  document.getElementById('analytics-apply-custom-btn').addEventListener('click', () => {
    customAnalyticsRange.startDate = document.getElementById('analytics-start-date').value;
    customAnalyticsRange.endDate = document.getElementById('analytics-end-date').value;
    renderAnalyticsView();
  });
}

/* ==========================================================================
   VIEW 5: CATEGORIES
   ========================================================================== */

function renderCategoriesView() {
  showView('view-categories');
  const container = document.getElementById('categories-list');
  container.innerHTML = '';

  categoryManager.getAll().forEach(cat => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--color-card-bg); border: 1px solid var(--color-surface-border); border-radius: var(--radius-md);';

    const limitDisplay = cat.budgetLimit > 0 ? `${cat.budgetLimit} ₪` : 'Без лимита';

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <span style="font-size: 1.5rem;">${cat.icon}</span>
        <div>
          <div style="font-weight: 600;">${escapeHTML(cat.name)}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">Лимит: ${limitDisplay}</div>
        </div>
        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${cat.color}; margin-left: auto;"></span>
      </div>
      <div style="display: flex; gap: 4px; margin-left: 8px;">
        <button class="btn-icon edit-cat-limit-btn" data-id="${cat.id}" title="Изменить лимит">✏️</button>
        <button class="btn-icon delete-cat-btn" data-id="${cat.id}" title="Удалить">🗑️</button>
      </div>
    `;

    row.querySelector('.edit-cat-limit-btn').addEventListener('click', () => {
      const newLimit = prompt(`Укажите лимит бюджета в шекелях (₪) для категории "${cat.name}":`, cat.budgetLimit || 0);
      if (newLimit !== null) {
        categoryManager.setBudgetLimit(cat.id, newLimit);
        renderCategoriesView();
      }
    });

    row.querySelector('.delete-cat-btn').addEventListener('click', () => {
      if (confirm(`Удалить категорию "${cat.name}"?`)) {
        categoryManager.deleteCategory(cat.id);
        renderCategoriesView();
      }
    });

    container.appendChild(row);
  });

  // Каскадная анимация появления категорий
  staggerChildren(container);
}

function initCategoriesEvents() {
  const form = document.getElementById('new-category-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const icon = document.getElementById('cat-icon-input').value.trim() || '🏷️';
    const name = document.getElementById('cat-name-input').value.trim();
    const limit = document.getElementById('cat-limit-input')?.value || 0;
    const color = document.getElementById('cat-color-input').value;

    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    const added = categoryManager.addCategory({ id, name, icon, color, budgetLimit: limit });

    if (added) {
      form.reset();
      renderCategoriesView();
    } else {
      alert('Категория с таким именем уже существует');
    }
  });
}

/* ==========================================================================
   VIEW 6: SETTINGS
   ========================================================================== */

function renderSettingsView() {
  showView('view-settings');
}

function initSettingsEvents() {
  document.getElementById('settings-theme-toggle').addEventListener('click', () => {
    store.toggleTheme();
  });

  document.getElementById('export-json-btn').addEventListener('click', () => {
    exportDataToJSON();
  });

  document.getElementById('import-json-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await importDataFromJSON(file);
        alert('Данные успешно импортированы!');
        router.navigate('dashboard');
      } catch (err) {
        alert(`Ошибка импорта: ${err.message}`);
      }
    }
  });

  document.getElementById('reset-data-btn').addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите сбросить ВСЕ данные? Это действие нельзя отменить.')) {
      if (confirm('Подтвердите удаление ещё раз.')) {
        store.clearAll();
        categoryManager.resetToDefaults();
        alert('Данные очищены!');
        router.navigate('dashboard');
      }
    }
  });
}

/* ==========================================================================
   HELPERS & RENDER UTILS
   ========================================================================== */

function showView(viewId) {
  document.querySelectorAll('.view').forEach(el => {
    el.style.display = el.id === viewId ? 'block' : 'none';
  });
}

function renderTransactionList(container, list, allowActions = false) {
  container.innerHTML = '';

  if (!list || list.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-muted); padding: 12px 0;">Нет транзакций</p>';
    return;
  }

  list.forEach(tx => {
    const cat = categoryManager.getById(tx.category);
    const isExpense = tx.type === 'expense';
    const amountPrefix = isExpense ? '-' : '+';
    const amountClass = isExpense ? 'expense' : 'income';

    const hashtags = extractHashtags(tx.note || '');
    let noteHtml = escapeHTML(tx.note || '');
    if (hashtags.length > 0) {
      hashtags.forEach(tag => {
        noteHtml = noteHtml.replace(tag, `<span class="tag-chip">${tag}</span>`);
      });
    }

    const item = document.createElement('div');
    item.className = 'tx-item';

    item.innerHTML = `
      <div class="tx-info">
        <div class="tx-icon">${cat.icon}</div>
        <div>
          <div class="tx-title">${escapeHTML(cat.name)} ${tx.note ? `<span style="font-weight: 400; color: var(--color-text-muted);">— ${noteHtml}</span>` : ''}</div>
          <div class="tx-meta">${formatDateHuman(tx.date)}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="tx-amount ${amountClass}">${amountPrefix}${formatCurrency(tx.amount)}</div>
        ${allowActions ? `
          <div class="tx-actions">
            <button class="btn-icon repeat-tx-btn" data-id="${tx.id}" title="Повторить операцию">🔄</button>
            <button class="btn-icon edit-tx-btn" data-id="${tx.id}" title="Редактировать">✏️</button>
            <button class="btn-icon delete-tx-btn" data-id="${tx.id}" title="Удалить">🗑️</button>
          </div>
        ` : ''}
      </div>
    `;

    // Клик по тегам для фильтрации
    item.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('history-search').value = chip.textContent;
        router.navigate('history');
      });
    });

    if (allowActions) {
      item.querySelector('.repeat-tx-btn')?.addEventListener('click', () => {
        // Подставить данные для повтора
        document.getElementById('tx-id').value = '';
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-date').value = formatDateISO(new Date());
        document.getElementById('tx-note').value = tx.note || '';
        currentTransactionType = tx.type;
        selectedCategoryForAdd = tx.category;
        document.getElementById('tx-category').value = tx.category;
        document.getElementById('add-form-title').textContent = 'Повтор операции';

        router.navigate('add');
      });

      item.querySelector('.delete-tx-btn')?.addEventListener('click', () => {
        if (confirm('Удалить эту операцию?')) {
          TransactionController.deleteTransaction(tx.id);
          renderHistoryView();
        }
      });

      item.querySelector('.edit-tx-btn')?.addEventListener('click', () => {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-date').value = tx.date;
        document.getElementById('tx-note').value = tx.note || '';
        currentTransactionType = tx.type;
        selectedCategoryForAdd = tx.category;
        document.getElementById('tx-category').value = tx.category;
        document.getElementById('add-form-title').textContent = 'Редактирование операции';

        router.navigate('add');
      });
    }

    container.appendChild(item);
  });

  // Каскадная анимация появления элементов списка
  staggerChildren(container);
}
