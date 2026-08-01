/**
 * Chart.js — анимации entry всегда при (пере)создании.
 * duration ~900ms, easeOutQuart. reduced-motion → off.
 */

import { prefersReducedMotion, MOTION, revealChart } from './motion.js';

let defaultsApplied = false;

function applyChartDefaults() {
  if (defaultsApplied || typeof Chart === 'undefined') return;
  defaultsApplied = true;

  const reduced = prefersReducedMotion();
  Chart.defaults.animation = reduced
    ? false
    : { duration: MOTION.chart, easing: 'easeOutQuart' };
  Chart.defaults.transitions = {
    active: { animation: { duration: reduced ? 0 : 160 } },
    resize: { animation: { duration: 0 } }
  };
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
}

function chartAnim(extra = {}) {
  if (prefersReducedMotion()) return false;
  return {
    duration: MOTION.chart,
    easing: 'easeOutQuart',
    ...extra
  };
}

function getThemeColors() {
  const isMidnight = document.documentElement.getAttribute('data-theme') === 'midnight';
  return {
    isMidnight,
    textColor: isMidnight ? '#E8E8ED' : '#1D1D1F',
    gridColor: isMidnight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    borderColor: isMidnight ? '#141418' : '#FFFFFF',
    accent: isMidnight ? '#2F6FCB' : '#0071E3',
    accentHover: isMidnight ? '#5E9FFF' : '#005BB5',
    accentFill: isMidnight ? 'rgba(47, 111, 203, 0.18)' : 'rgba(0, 113, 227, 0.14)',
    tooltipBg: isMidnight ? 'rgba(20, 20, 24, 0.94)' : 'rgba(29, 29, 31, 0.92)'
  };
}

class ChartManager {
  constructor() {
    this.instances = {};
  }

  get(id) {
    return this.instances[id];
  }

  destroyChart(id) {
    const fromMap = this.instances[id];
    const fromDom = (typeof Chart !== 'undefined' && Chart.getChart)
      ? Chart.getChart(id)
      : null;
    const chart = fromMap || fromDom;
    if (chart) {
      try { chart.destroy(); } catch (_) { /* ignore */ }
    }
    delete this.instances[id];
  }

  /** Всегда полный recreate — entry-анимация гарантирована */
  _forceFresh(canvasEl, fallbackId) {
    const canvasId = canvasEl.id || fallbackId;
    this.destroyChart(canvasId);
    return canvasId;
  }

  renderCategoryPieChart(canvasEl, data, onSliceClick) {
    if (!canvasEl || typeof Chart === 'undefined') return;
    applyChartDefaults();

    const canvasId = this._forceFresh(canvasEl, 'categoryPieChart');
    const theme = getThemeColors();
    const reduced = prefersReducedMotion();

    if (!data || data.length === 0) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        const rect = canvasEl.parentElement?.getBoundingClientRect?.() || { width: 300, height: 280 };
        const dpr = window.devicePixelRatio || 1;
        canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
        canvasEl.height = Math.max(1, Math.floor((rect.height || 280) * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height || 280);
        ctx.fillStyle = theme.textColor;
        ctx.globalAlpha = 0.45;
        ctx.font = '500 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Нет данных за период', rect.width / 2, (rect.height || 280) / 2);
        ctx.globalAlpha = 1;
      }
      return;
    }

    const labels = data.map(item => `${item.category.icon} ${item.category.name}`);
    const amounts = data.map(item => item.amount);
    const bgColors = data.map(item => item.category.color);

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: amounts,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: theme.borderColor,
          hoverOffset: reduced ? 0 : 14,
          hoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnim({
          animateRotate: true,
          animateScale: true
        }),
        onClick: (_event, activeElements) => {
          if (activeElements.length > 0 && typeof onSliceClick === 'function') {
            const index = activeElements[0].index;
            const clickedCategory = data[index]?.category;
            if (clickedCategory) onSliceClick(clickedCategory);
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { family: 'Inter, sans-serif', size: 12 },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
            bodyFont: { family: 'Inter, sans-serif', size: 12 },
            callbacks: {
              label: (context) => ` ${(context.raw || 0).toLocaleString('he-IL')} ₪`
            }
          }
        },
        cutout: '65%'
      }
    });

    revealChart(canvasEl);
  }

  renderBarChart(canvasEl, data) {
    if (!canvasEl || typeof Chart === 'undefined') return;
    applyChartDefaults();

    const canvasId = this._forceFresh(canvasEl, 'expensesBarChart');
    if (!data || data.length === 0) return;

    const labels = data.map(item => item.label);
    const expenses = data.map(item => item.expense);
    const theme = getThemeColors();
    const reduced = prefersReducedMotion();
    const barCount = Math.max(1, expenses.length);
    const barStep = reduced ? 0 : Math.min(40, Math.floor(MOTION.staggerMax / barCount));

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Расходы (₪)',
          data: expenses,
          backgroundColor: theme.accent,
          hoverBackgroundColor: theme.accentHover,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnim({
          delay: (context) => {
            if (reduced || context.type !== 'data') return 0;
            return context.dataIndex * barStep;
          }
        }),
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
            bodyFont: { family: 'Inter, sans-serif', size: 12 },
            callbacks: {
              label: (context) => `Расходы: ${context.raw.toLocaleString('he-IL')} ₪`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Inter, sans-serif', size: 11 }, maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: 'Inter, sans-serif', size: 11 },
              callback: (val) => `${val} ₪`
            }
          }
        }
      }
    });

    revealChart(canvasEl);
  }

  renderLineChart(canvasEl, data) {
    if (!canvasEl || typeof Chart === 'undefined') return;
    applyChartDefaults();

    const canvasId = this._forceFresh(canvasEl, 'trendLineChart');
    if (!data || data.length === 0) return;

    const labels = data.map(item => item.label);
    const expenses = data.map(item => item.expense);
    const theme = getThemeColors();

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Тренд расходов (₪)',
          data: expenses,
          borderColor: theme.accent,
          backgroundColor: theme.accentFill,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: theme.accent,
          pointBorderColor: theme.borderColor,
          pointBorderWidth: 2,
          pointHitRadius: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnim(),
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
            bodyFont: { family: 'Inter, sans-serif', size: 12 },
            callbacks: {
              label: (context) => `Сумма: ${context.raw.toLocaleString('he-IL')} ₪`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Inter, sans-serif', size: 11 }, maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: 'Inter, sans-serif', size: 11 },
              callback: (val) => `${val} ₪`
            }
          }
        }
      }
    });

    revealChart(canvasEl);
  }

  replayChartsIn(viewEl) {
    if (!viewEl || prefersReducedMotion()) return;
    Object.values(this.instances).forEach(chart => {
      if (!chart?.canvas || !viewEl.contains(chart.canvas)) return;
      try {
        chart.resize();
        if (typeof chart.reset === 'function') chart.reset();
        chart.update();
      } catch (_) { /* ignore */ }
    });
  }
}

export const chartManager = new ChartManager();
