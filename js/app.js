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
import { initRipples, countUp, staggerChildren, playViewEnter, animateProgressBars } from './motion.js';
import { syncManager } from './sync.js';
import { wageSettings, isLikelyShabatonDate } from './wage.js';
import { calculatePayslip, TAX_YEAR, formatILS } from './tax-il.js';

// Текущее выбранное состояние периодов
let currentDashboardPeriod = 'month';
let currentAnalyticsPeriod = 'month';
let selectedCategoryForAdd = null;
let currentTransactionType = 'expense';
let currentAnalyticsRefDate = new Date();
let customAnalyticsRange = { startDate: '', endDate: '' };
let pendingHistoryCategoryId = null;
/** When salary hours drive the amount field */
let amountFromSalaryCalc = false;
/** Kind for new category form */
let newCategoryKind = 'expense';
/** Активный id view-секции (для enter-анимации только при смене маршрута) */
let activeViewId = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Apply theme silently (without notify) to avoid triggering refreshCurrentView
  // before router.start() has set currentRoute.
  const savedTheme = store.loadTheme();
  store.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  store.updateThemeToggleIcon();

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
  initSyncUi();

  // Cloud sync is always-on (shared room on Vercel) — phone + desktop same data
  syncManager.init();
  updateSyncUi(syncManager.getState());

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

  // Кнопка расчёта зарплаты (только при наличии зарплатных транзакций)
  renderPayslipCta();

  // Индикаторы бюджетов категорий
  renderBudgetProgressList();

  // Pie Chart (Интерактивный клик)
  const categoryData = Analytics.getCategoryBreakdown(currentDashboardPeriod);
  const pieCanvas = document.getElementById('dashboard-pie-chart');
  chartManager.renderCategoryPieChart(pieCanvas, categoryData, (clickedCat) => {
    openCategoryHistory(clickedCat.id);
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
        <span>${escapeHTML(item.category.icon)} ${escapeHTML(item.category.name)}</span>
        <span>${formatCurrency(item.spent)} <span style="color: var(--color-text-muted);">${limitLabel}</span></span>
      </div>
      ${item.limit > 0 ? `
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${item.status}" data-target-width="${percentClamped}%" style="width: 0%;"></div>
        </div>
      ` : ''}
    `;

    container.appendChild(row);
  });

  // Каскадная анимация появления индикаторов + fill progress bars
  staggerChildren(container);
  animateProgressBars(container);
}

function initDashboardEvents() {
  const selector = document.getElementById('dashboard-period-selector');
  selector.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-btn')) {
      selector.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentDashboardPeriod = e.target.dataset.period;
      // Полный recreate графиков → entry-анимация снова
      ['dashboard-pie-chart', 'dashboard-bar-chart'].forEach(id => chartManager.destroyChart(id));
      renderDashboardView();
    }
  });
}

/* ==========================================================================
   VIEW 2: ADD TRANSACTION
   ========================================================================== */

function renderAddView() {
  showView('view-add');

  // Очистить форму если не режим редактирования
  const form = document.getElementById('transaction-form');
  const idInput = document.getElementById('tx-id');
  if (!idInput.value) {
    form.reset();
    document.getElementById('tx-date').value = formatDateISO(new Date());
    currentTransactionType = 'expense';
    selectedCategoryForAdd = null;
    amountFromSalaryCalc = false;
    clearSalaryFields();
    updateTypeButtons();
    document.getElementById('add-form-title').textContent = 'Новая операция';
  }

  renderCategoryGrid();
  updateIncomeUi();
  updateShabatonDateHint();
}

function clearSalaryFields() {
  const r = document.getElementById('tx-hours-regular');
  const s = document.getElementById('tx-hours-shabaton');
  const t = document.getElementById('tx-tips-extra');
  if (r) r.value = '';
  if (s) s.value = '';
  if (t) t.value = '';
  const total = document.getElementById('salary-calc-total');
  if (total) total.textContent = formatCurrency(0);
}

function renderCategoryGrid() {
  const grid = document.getElementById('tx-category-grid');
  grid.innerHTML = '';
  const kind = currentTransactionType === 'income' ? 'income' : 'expense';
  const categories = categoryManager.getByKind(kind);

  // If previously selected category is wrong kind, reset
  if (selectedCategoryForAdd) {
    const sel = categoryManager.getById(selectedCategoryForAdd);
    if (sel.kind && sel.kind !== kind && !categories.some((c) => c.id === selectedCategoryForAdd)) {
      selectedCategoryForAdd = null;
    }
  }

  categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = `category-card ${selectedCategoryForAdd === cat.id ? 'selected' : ''}`;
    card.dataset.id = cat.id;

    card.innerHTML = `
      <span class="cat-icon">${escapeHTML(cat.icon)}</span>
      <span class="cat-name">${escapeHTML(cat.name)}</span>
    `;

    card.addEventListener('click', () => {
      grid.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCategoryForAdd = cat.id;
      document.getElementById('tx-category').value = cat.id;
      updateIncomeUi();
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
  } else if (selectedCategoryForAdd) {
    document.getElementById('tx-category').value = selectedCategoryForAdd;
  }

  updateIncomeUi();
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

function isSalaryCategory(catId) {
  return catId === 'salary';
}

function updateIncomeUi() {
  const panel = document.getElementById('salary-calculator');
  const amountLabel = document.getElementById('tx-amount-label');
  const noteInput = document.getElementById('tx-note');
  const rates = wageSettings.get();

  const regularLabel = document.getElementById('rate-regular-label');
  const shabatonLabel = document.getElementById('rate-shabaton-label');
  if (regularLabel) regularLabel.textContent = String(rates.regularRate);
  if (shabatonLabel) shabatonLabel.textContent = String(rates.shabatonRate);

  const hint = document.getElementById('salary-hint');
  if (hint) {
    hint.textContent =
      `Обычное время — ${rates.regularRate} ₪/ч. Шабатон (шаббат / праздник, 150%) — ${rates.shabatonRate} ₪/ч.`;
  }

  const showSalary = currentTransactionType === 'income' && isSalaryCategory(selectedCategoryForAdd);
  if (panel) {
    panel.hidden = !showSalary;
  }

  if (amountLabel) {
    if (showSalary) {
      amountLabel.textContent = 'Сумма зарплаты (считается из часов, можно править)';
    } else if (currentTransactionType === 'income' && selectedCategoryForAdd === 'tips') {
      amountLabel.textContent = 'Сумма чаевых (₪)';
    } else if (currentTransactionType === 'income') {
      amountLabel.textContent = 'Сумма дохода (₪)';
    } else {
      amountLabel.textContent = 'Сумма в шекелях (₪)';
    }
  }

  if (noteInput && !document.getElementById('tx-id').value) {
    if (showSalary) {
      noteInput.placeholder = 'необязательно — часы подставятся сами';
    } else if (currentTransactionType === 'income' && selectedCategoryForAdd === 'tips') {
      noteInput.placeholder = 'например: чаевые за вечер';
    } else if (currentTransactionType === 'income') {
      noteInput.placeholder = 'например: возврат / подарок';
    } else {
      noteInput.placeholder = 'например: Закупка на неделю';
    }
  }

  if (showSalary) {
    recomputeSalaryAmount();
  }
}

function recomputeSalaryAmount({ force = false } = {}) {
  const r = Number(document.getElementById('tx-hours-regular')?.value) || 0;
  const s = Number(document.getElementById('tx-hours-shabaton')?.value) || 0;
  const calc = wageSettings.calcSalary(r, s);
  const totalEl = document.getElementById('salary-calc-total');
  if (totalEl) totalEl.textContent = formatCurrency(calc.amount);

  const amountInput = document.getElementById('tx-amount');
  if (!amountInput) return;

  // Overwrite amount when hours drive it, or amount empty
  if (force || amountFromSalaryCalc || !amountInput.value) {
    amountInput.value = calc.amount > 0 ? String(calc.amount) : '';
    amountFromSalaryCalc = true;
  }
}

function updateShabatonDateHint() {
  const hint = document.getElementById('shabaton-date-hint');
  const dateVal = document.getElementById('tx-date')?.value;
  if (!hint) return;
  const show =
    currentTransactionType === 'income' &&
    isSalaryCategory(selectedCategoryForAdd) &&
    isLikelyShabatonDate(dateVal);
  hint.hidden = !show;
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

  amountInput.addEventListener('input', () => {
    // User typed amount manually — stop overwriting from hours until hours change
    amountFromSalaryCalc = false;
  });

  const expenseBtn = document.getElementById('type-expense-btn');
  const incomeBtn = document.getElementById('type-income-btn');

  expenseBtn.addEventListener('click', () => {
    currentTransactionType = 'expense';
    selectedCategoryForAdd = null;
    amountFromSalaryCalc = false;
    clearSalaryFields();
    updateTypeButtons();
    renderCategoryGrid();
  });

  incomeBtn.addEventListener('click', () => {
    currentTransactionType = 'income';
    selectedCategoryForAdd = null;
    amountFromSalaryCalc = false;
    clearSalaryFields();
    updateTypeButtons();
    renderCategoryGrid();
  });

  ['tx-hours-regular', 'tx-hours-shabaton'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      amountFromSalaryCalc = true;
      recomputeSalaryAmount({ force: true });
    });
  });

  document.getElementById('tx-date')?.addEventListener('change', updateShabatonDateHint);

  const form = document.getElementById('transaction-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('tx-id').value;
    const category = selectedCategoryForAdd || document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    let note = document.getElementById('tx-note').value;
    const isSalary =
      currentTransactionType === 'income' && isSalaryCategory(category) && !id;

    let evaluatedAmount;
    let meta;

    if (currentTransactionType === 'income' && isSalaryCategory(category)) {
      const regularHours = Number(document.getElementById('tx-hours-regular')?.value) || 0;
      const shabatonHours = Number(document.getElementById('tx-hours-shabaton')?.value) || 0;
      const calc = wageSettings.calcSalary(regularHours, shabatonHours);
      const rawAmount = document.getElementById('tx-amount').value;
      evaluatedAmount = evaluateMathExpression(rawAmount) || Number(rawAmount) || calc.amount;

      if (regularHours > 0 || shabatonHours > 0) {
        meta = {
          source: 'salary',
          regularHours: calc.regularHours,
          shabatonHours: calc.shabatonHours,
          regularRate: calc.regularRate,
          shabatonRate: calc.shabatonRate
        };
        // On edit keep user's note; only auto-build when empty or pure auto note
        if (!String(note || '').trim()) {
          note = wageSettings.buildSalaryNote(regularHours, shabatonHours);
        } else if (!id) {
          note = wageSettings.buildSalaryNote(regularHours, shabatonHours, note);
        }
      }
    } else {
      const rawAmount = document.getElementById('tx-amount').value;
      evaluatedAmount = evaluateMathExpression(rawAmount) || Number(rawAmount);
    }

    const tipsAmount = isSalary
      ? Math.max(0, Number(document.getElementById('tx-tips-extra')?.value) || 0)
      : 0;

    // Salary panel: tips-only shift (no hours) → just tips transaction
    if (isSalary && (!evaluatedAmount || evaluatedAmount <= 0) && tipsAmount > 0) {
      const tipsResult = TransactionController.createTransaction({
        amount: tipsAmount,
        type: 'income',
        category: 'tips',
        date,
        note: note || 'Чаевые за смену',
        meta: { source: 'tips' }
      });
      if (!tipsResult.success) {
        alert(tipsResult.message || 'Ошибка сохранения');
        return;
      }
      form.reset();
      document.getElementById('tx-id').value = '';
      selectedCategoryForAdd = null;
      amountFromSalaryCalc = false;
      clearSalaryFields();
      document.getElementById('add-form-title').textContent = 'Новая операция';
      router.navigate('dashboard');
      return;
    }

    const formData = {
      amount: evaluatedAmount,
      type: currentTransactionType,
      category,
      date,
      note
    };
    if (meta) formData.meta = meta;

    let result;
    if (id) {
      result = TransactionController.editTransaction(id, formData);
    } else {
      result = TransactionController.createTransaction(formData);
    }

    if (!result.success) {
      alert(result.message || 'Ошибка сохранения');
      return;
    }

    // Optional tips as separate income transaction (new salary only)
    if (isSalary && tipsAmount > 0) {
      TransactionController.createTransaction({
        amount: tipsAmount,
        type: 'income',
        category: 'tips',
        date,
        note: 'Чаевые за смену',
        meta: { source: 'tips', linkedTo: result.tx?.id || null }
      });
    }

    form.reset();
    document.getElementById('tx-id').value = '';
    selectedCategoryForAdd = null;
    amountFromSalaryCalc = false;
    clearSalaryFields();
    document.getElementById('add-form-title').textContent = 'Новая операция';
    router.navigate('dashboard');
  });
}

/* ==========================================================================
   VIEW 3: HISTORY
   ========================================================================== */

function renderHistoryView() {
  showView('view-history');
  updateHistoryCategoryFilterOptions();
  if (pendingHistoryCategoryId) {
    document.getElementById('history-filter-category').value = pendingHistoryCategoryId;
    pendingHistoryCategoryId = null;
  }
  applyHistoryFilters();
}

function openCategoryHistory(categoryId) {
  pendingHistoryCategoryId = categoryId;
  router.navigate('history');
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
    openCategoryHistory(clickedCat.id);
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
          <td style="padding: 10px 4px;">${escapeHTML(item.category.icon)} ${escapeHTML(item.category.name)}</td>
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
    const timeSeries = Analytics.getTimeSeriesBreakdown(
      currentAnalyticsPeriod,
      currentAnalyticsRefDate,
      customAnalyticsRange
    );
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
      ['analytics-pie-chart', 'analytics-line-chart'].forEach(id => chartManager.destroyChart(id));
      renderAnalyticsView();
    }
  });

  // Переключатель месяцев ◀ ▶
  // Create new Date to avoid in-place mutation of shared reference.
  document.getElementById('analytics-prev-month').addEventListener('click', () => {
    const d = new Date(currentAnalyticsRefDate);
    d.setMonth(d.getMonth() - 1);
    currentAnalyticsRefDate = d;
    ['analytics-pie-chart', 'analytics-line-chart'].forEach(id => chartManager.destroyChart(id));
    renderAnalyticsView();
  });

  document.getElementById('analytics-next-month').addEventListener('click', () => {
    const d = new Date(currentAnalyticsRefDate);
    d.setMonth(d.getMonth() + 1);
    currentAnalyticsRefDate = d;
    ['analytics-pie-chart', 'analytics-line-chart'].forEach(id => chartManager.destroyChart(id));
    renderAnalyticsView();
  });

  // Кастомный диапазон
  document.getElementById('analytics-apply-custom-btn').addEventListener('click', () => {
    customAnalyticsRange.startDate = document.getElementById('analytics-start-date').value;
    customAnalyticsRange.endDate = document.getElementById('analytics-end-date').value;
    ['analytics-pie-chart', 'analytics-line-chart'].forEach(id => chartManager.destroyChart(id));
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
    // Validate color to prevent CSS injection (only allow #RRGGBB / #RGB and named safe values)
    const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(cat.color) ? cat.color : '#607D8B';
    const isIncome = cat.kind === 'income';
    const limitDisplay = isIncome
      ? 'Доход'
      : (cat.budgetLimit > 0 ? `Лимит: ${cat.budgetLimit} ₪` : 'Без лимита');
    const kindClass = isIncome ? 'kind-badge income' : 'kind-badge';
    const kindLabel = isIncome ? 'доход' : 'расход';

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <span style="font-size: 1.5rem;">${escapeHTML(cat.icon)}</span>
        <div>
          <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
            ${escapeHTML(cat.name)}
            <span class="${kindClass}">${kindLabel}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${limitDisplay}</div>
        </div>
        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${safeColor}; margin-left: auto;"></span>
      </div>
      <div style="display: flex; gap: 4px; margin-left: 8px;">
        ${isIncome ? '' : '<button class="btn-icon edit-cat-limit-btn" title="Изменить лимит">✏️</button>'}
        <button class="btn-icon delete-cat-btn" title="Удалить">🗑️</button>
      </div>
    `;

    row.querySelector('.edit-cat-limit-btn')?.addEventListener('click', () => {
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
  const expenseKindBtn = document.getElementById('cat-kind-expense');
  const incomeKindBtn = document.getElementById('cat-kind-income');

  const setKindUi = (kind) => {
    newCategoryKind = kind;
    expenseKindBtn?.classList.toggle('active', kind === 'expense');
    incomeKindBtn?.classList.toggle('active', kind === 'income');
    const limitInput = document.getElementById('cat-limit-input');
    if (limitInput) {
      limitInput.disabled = kind === 'income';
      limitInput.placeholder = kind === 'income' ? '—' : 'Лимит ₪ (опц.)';
    }
  };

  expenseKindBtn?.addEventListener('click', () => setKindUi('expense'));
  incomeKindBtn?.addEventListener('click', () => setKindUi('income'));

  const form = document.getElementById('new-category-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const icon = document.getElementById('cat-icon-input').value.trim() || '🏷️';
    const name = document.getElementById('cat-name-input').value.trim();
    const limit = newCategoryKind === 'income' ? 0 : (document.getElementById('cat-limit-input')?.value || 0);
    const color = document.getElementById('cat-color-input').value;

    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    const added = categoryManager.addCategory({
      id,
      name,
      icon,
      color,
      budgetLimit: limit,
      kind: newCategoryKind
    });

    if (added) {
      form.reset();
      setKindUi('expense');
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
  updateSyncUi(syncManager.getState());
  const rates = wageSettings.get();
  const r = document.getElementById('settings-rate-regular');
  const s = document.getElementById('settings-rate-shabaton');
  if (r) r.value = rates.regularRate;
  if (s) s.value = rates.shabatonRate;
  const status = document.getElementById('settings-wage-status');
  if (status) status.textContent = '';
}

function initSettingsEvents() {
  document.getElementById('settings-theme-toggle').addEventListener('click', () => {
    store.toggleTheme();
  });

  document.getElementById('settings-wage-save')?.addEventListener('click', () => {
    const regularRate = Number(document.getElementById('settings-rate-regular')?.value);
    const shabatonRate = Number(document.getElementById('settings-rate-shabaton')?.value);
    wageSettings.set({ regularRate, shabatonRate });
    const status = document.getElementById('settings-wage-status');
    if (status) {
      const saved = wageSettings.get();
      status.textContent = `Сохранено: ${saved.regularRate} ₪ / ${saved.shabatonRate} ₪ (шабатон). Синхронизируется с другими устройствами.`;
    }
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
   CROSS-DEVICE SYNC UI
   ========================================================================== */

function initSyncUi() {
  syncManager.subscribe(updateSyncUi);

  const toggleBtn = document.getElementById('sync-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      const state = syncManager.getState();
      toggleBtn.disabled = true;
      try {
        if (state.enabled) {
          if (confirm('Отключить облачную синхронизацию на этом устройстве?')) {
            syncManager.disconnect();
          }
        } else {
          await syncManager.enable();
          refreshCurrentView();
        }
        updateSyncUi(syncManager.getState());
      } finally {
        toggleBtn.disabled = false;
      }
    });
  }

  const forceBtn = document.getElementById('sync-force-btn');
  if (forceBtn) {
    forceBtn.addEventListener('click', async () => {
      forceBtn.disabled = true;
      try {
        await syncManager.queuePull();
        await syncManager.queuePush();
        updateSyncUi(syncManager.getState());
        refreshCurrentView();
      } finally {
        forceBtn.disabled = false;
      }
    });
  }
}

function syncStatusLabel(state) {
  switch (state.status) {
    case 'synced': return 'Облако подключено — телефон и web в одном списке';
    case 'syncing': return 'Отправка изменений…';
    case 'connecting': return 'Подключение к облаку…';
    case 'offline': return 'Нет сети — изменения сохранятся локально';
    case 'error': return state.lastError ? `Ошибка: ${state.lastError}` : 'Ошибка синхронизации';
    case 'idle':
    default:
      return state.enabled ? 'Ожидание…' : 'Синхронизация выключена';
  }
}

function updateSyncUi(state) {
  const badge = document.getElementById('sync-status-badge');
  const statusEl = document.getElementById('sync-status-text');
  const lastEl = document.getElementById('sync-last-text');
  const toggleBtn = document.getElementById('sync-toggle-btn');

  if (badge) {
    if (state.enabled) {
      badge.hidden = false;
      badge.dataset.status = state.status;
      badge.title = 'Облачная синхронизация';
      badge.textContent =
        state.status === 'synced' ? '☁️' :
        state.status === 'syncing' || state.status === 'connecting' ? '🔄' :
        state.status === 'error' || state.status === 'offline' ? '⚠️' : '☁️';
    } else {
      badge.hidden = true;
    }
  }

  if (statusEl) statusEl.textContent = syncStatusLabel(state);
  if (toggleBtn) {
    toggleBtn.textContent = state.enabled ? 'Отключить синхронизацию' : 'Включить синхронизацию';
    toggleBtn.className = state.enabled ? 'btn btn-secondary' : 'btn btn-primary btn-block';
  }
  if (lastEl) {
    if (state.lastSyncedAt) {
      try {
        const d = new Date(state.lastSyncedAt);
        lastEl.textContent = `Последняя синхронизация: ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      } catch {
        lastEl.textContent = '';
      }
    } else {
      lastEl.textContent = state.enabled ? 'Идёт первая синхронизация…' : '';
    }
  }
}

/* ==========================================================================
   PAYSLIP / TAX CALCULATOR
   ========================================================================== */

/**
 * Получить сумму зарплаты (не чаевых) за текущий месяц
 * @returns {number}
 */
function getMonthSalaryTotal() {
  const txs = store.getTransactions();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== 'income') continue;
    if (tx.category !== 'salary') continue;
    if (tx.date && tx.date.startsWith(currentMonthKey)) {
      total += Number(tx.amount) || 0;
    }
  }
  return total;
}

/** Показать / скрыть кнопку расчёта зарплаты */
function renderPayslipCta() {
  const container = document.getElementById('payslip-cta-container');
  if (!container) return;

  const salaryTotal = getMonthSalaryTotal();

  if (salaryTotal <= 0) {
    container.innerHTML = '';
    return;
  }

  // Показываем кнопку
  container.innerHTML = `
    <button class="payslip-cta" id="payslip-open-btn">
      <span class="cta-icon">📋</span>
      Расчёт зарплаты и налогов · ${formatCurrency(salaryTotal)} брутто
    </button>
  `;

  container.querySelector('#payslip-open-btn')?.addEventListener('click', () => {
    openPayslipModal(salaryTotal);
  });
}

/** Текущие настройки расчёта (сохраняются в localStorage) */
function loadPayslipSettings() {
  try {
    const saved = localStorage.getItem('he_payslip_settings');
    if (saved) return JSON.parse(saved);
  } catch (_) { /* ignore */ }
  return { creditPoints: 2.25, hasPension: true };
}

function savePayslipSettings(settings) {
  try {
    localStorage.setItem('he_payslip_settings', JSON.stringify(settings));
  } catch (_) { /* ignore */ }
}

/** Открыть модальное окно расчёта */
function openPayslipModal(grossSalary) {
  const overlay = document.getElementById('payslip-overlay');
  if (!overlay) return;

  document.getElementById('payslip-tax-year').textContent = TAX_YEAR;
  renderPayslipBody(grossSalary);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Закрытие
  const closeBtn = document.getElementById('payslip-close-btn');
  const handleClose = () => {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    closeBtn.removeEventListener('click', handleClose);
    overlay.removeEventListener('click', handleOverlayClick);
  };
  const handleOverlayClick = (e) => {
    if (e.target === overlay) handleClose();
  };
  closeBtn.addEventListener('click', handleClose);
  overlay.addEventListener('click', handleOverlayClick);
}

/** Рендер содержимого расчётного листа */
function renderPayslipBody(grossSalary) {
  const body = document.getElementById('payslip-body');
  if (!body) return;

  const settings = loadPayslipSettings();
  const result = calculatePayslip(grossSalary, {
    creditPoints: settings.creditPoints,
    hasPension: settings.hasPension,
  });

  const netPercent = result.grossSalary > 0
    ? Math.round((result.netSalary / result.grossSalary) * 100)
    : 0;

  const deductionPercent = 100 - netPercent;

  body.innerHTML = `
    <!-- Сравнение Брутто / Нетто -->
    <div class="payslip-hero">
      <div class="payslip-hero-card gross">
        <div class="payslip-hero-label">Брутто</div>
        <div class="payslip-hero-value">${formatCurrency(result.grossSalary)}</div>
      </div>
      <div class="payslip-hero-card net">
        <div class="payslip-hero-label">На руки</div>
        <div class="payslip-hero-value">${formatCurrency(result.netSalary)}</div>
      </div>
    </div>

    <!-- Визуальная шкала -->
    <div class="payslip-bar-wrap">
      <div class="payslip-bar-label">
        <span>Чистая зарплата — ${netPercent}%</span>
        <span>Отчисления — ${deductionPercent}%</span>
      </div>
      <div class="payslip-bar">
        <div class="payslip-bar-fill" id="payslip-bar-fill" style="width: 0%;"></div>
      </div>
    </div>

    <!-- Отчисления -->
    <div class="payslip-section-title">Отчисления с зарплаты</div>

    <div class="payslip-row">
      <span class="payslip-row-icon">🏛️</span>
      <div class="payslip-row-label">
        Подоходный налог
        <div class="payslip-row-hint">מס הכנסה · после вычета ${settings.creditPoints} баллов</div>
      </div>
      <span class="payslip-row-amount">−${formatCurrency(result.incomeTaxNet)}</span>
    </div>

    <div class="payslip-row">
      <span class="payslip-row-icon">🛡️</span>
      <div class="payslip-row-label">
        Нац. страхование
        <div class="payslip-row-hint">ביטוח לאומי · 0.4% / 7%</div>
      </div>
      <span class="payslip-row-amount">−${formatCurrency(result.nationalInsurance)}</span>
    </div>

    <div class="payslip-row">
      <span class="payslip-row-icon">🏥</span>
      <div class="payslip-row-label">
        Мед. страхование
        <div class="payslip-row-hint">ביטוח בריאות · 3.1% / 5%</div>
      </div>
      <span class="payslip-row-amount">−${formatCurrency(result.healthInsurance)}</span>
    </div>

    <div class="payslip-row">
      <span class="payslip-row-icon">🏦</span>
      <div class="payslip-row-label">
        Пенсия
        <div class="payslip-row-hint">פנסיה · ${settings.hasPension ? '6% от работника' : 'не учитывается'}</div>
      </div>
      <span class="payslip-row-amount">−${formatCurrency(result.pension)}</span>
    </div>

    <div class="payslip-row total">
      <span class="payslip-row-icon">💸</span>
      <div class="payslip-row-label">Итого отчислений</div>
      <span class="payslip-row-amount">−${formatCurrency(result.totalDeductions)}</span>
    </div>

    <!-- Настройки -->
    <div class="payslip-settings">
      <div class="payslip-section-title" style="border-bottom: none; margin-bottom: var(--space-xs);">⚙️ Параметры расчёта</div>
      <div class="form-group">
        <label class="form-label" for="payslip-credit-points">Налоговые баллы (נקודות זיכוי)</label>
        <input type="number" id="payslip-credit-points" class="form-control" value="${settings.creditPoints}" min="0" max="20" step="0.25" inputmode="decimal">
        <span style="font-size: 0.75rem; color: var(--color-text-muted);">Резидент — 2.25 (муж) / 2.75 (жен). Один балл = 242 ₪/мес.</span>
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: var(--space-sm);">
        <input type="checkbox" id="payslip-has-pension" ${settings.hasPension ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-primary);">
        <label for="payslip-has-pension" style="font-size: 0.9rem; font-weight: 500; cursor: pointer;">Учитывать пенсию (6%)</label>
      </div>
      <button class="btn btn-primary btn-block" id="payslip-recalc-btn" style="margin-top: var(--space-sm);">Пересчитать</button>
    </div>
  `;

  // Анимация заполнения шкалы
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const barFill = document.getElementById('payslip-bar-fill');
      if (barFill) barFill.style.width = `${netPercent}%`;
    });
  });

  // Кнопка пересчёта
  document.getElementById('payslip-recalc-btn')?.addEventListener('click', () => {
    const cp = Number(document.getElementById('payslip-credit-points')?.value) || 2.25;
    const hp = document.getElementById('payslip-has-pension')?.checked !== false;
    savePayslipSettings({ creditPoints: cp, hasPension: hp });
    renderPayslipBody(grossSalary);
  });
}

/* ==========================================================================
   HELPERS & RENDER UTILS
   ========================================================================== */

function showView(viewId) {
  const isRouteChange = activeViewId !== viewId;
  activeViewId = viewId;

  let activeEl = null;
  document.querySelectorAll('.view').forEach(el => {
    const isActive = el.id === viewId;
    el.style.display = isActive ? 'block' : 'none';
    if (!isActive) {
      el.classList.remove('view-enter', 'view-enter-cascade');
    } else {
      activeEl = el;
    }
  });

  // Enter-анимация при смене экрана
  if (isRouteChange && activeEl) {
    activeEl.querySelectorAll('canvas').forEach(canvas => {
      if (canvas.id) chartManager.destroyChart(canvas.id);
    });

    // После display:block — каскад секций (double-rAF внутри playViewEnter)
    playViewEnter(activeEl, true);
  }
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
        const escapedTag = escapeHTML(tag);
        const regex = new RegExp(`(?<=^|\\s)(${escapedTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=\\s|$)`, 'g');
        noteHtml = noteHtml.replace(regex, '<span class="tag-chip">$1</span>');
      });
    }

    const item = document.createElement('div');
    item.className = 'tx-item';

    item.innerHTML = `
      <div class="tx-info">
        <div class="tx-icon">${escapeHTML(cat.icon)}</div>
        <div>
          <div class="tx-title">${escapeHTML(cat.name)} ${tx.note ? `<span style="font-weight: 400; color: var(--color-text-muted);">— ${noteHtml}</span>` : ''}</div>
          <div class="tx-meta">${formatDateHuman(tx.date)}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="tx-amount ${amountClass}">${amountPrefix}${formatCurrency(tx.amount)}</div>
        ${allowActions ? `
          <div class="tx-actions">
            <button class="btn-icon repeat-tx-btn" title="Повторить операцию">🔄</button>
            <button class="btn-icon edit-tx-btn" title="Редактировать">✏️</button>
            <button class="btn-icon delete-tx-btn" title="Удалить">🗑️</button>
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
        amountFromSalaryCalc = false;
        clearSalaryFields();
        if (tx.meta && tx.meta.source === 'salary') {
          const hr = document.getElementById('tx-hours-regular');
          const hs = document.getElementById('tx-hours-shabaton');
          if (hr) hr.value = tx.meta.regularHours ?? '';
          if (hs) hs.value = tx.meta.shabatonHours ?? '';
          amountFromSalaryCalc = true;
        }
        updateTypeButtons();
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
        amountFromSalaryCalc = false;
        clearSalaryFields();
        if (tx.meta && tx.meta.source === 'salary') {
          const hr = document.getElementById('tx-hours-regular');
          const hs = document.getElementById('tx-hours-shabaton');
          if (hr) hr.value = tx.meta.regularHours ?? '';
          if (hs) hs.value = tx.meta.shabatonHours ?? '';
          amountFromSalaryCalc = true;
        }
        updateTypeButtons();
        router.navigate('add');
      });
    }

    container.appendChild(item);
  });

  // Каскадная анимация появления элементов списка
  staggerChildren(container);
}
