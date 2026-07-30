/**
 * Интеграция и визуализация Chart.js для Home Economic
 * Анимации соответствуют motion-токенам DESIGN.md.
 * При prefers-reduced-motion анимации графиков отключаются.
 */

import { prefersReducedMotion } from './motion.js';

function chartAnimationConfig() {
  return prefersReducedMotion()
    ? { duration: 0 }
    : { duration: 700, easing: 'easeOutCubic' };
}

function getThemeColors() {
  const isMidnight = document.documentElement.getAttribute('data-theme') === 'midnight';
  return {
    isMidnight,
    textColor: isMidnight ? '#E8E8ED' : '#1D1D1F',
    gridColor: isMidnight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    borderColor: isMidnight ? '#141418' : '#FFFFFF',
    accent: isMidnight ? '#2F6FCB' : '#0071E3',
    accentFill: isMidnight ? 'rgba(47, 111, 203, 0.15)' : 'rgba(0, 113, 227, 0.12)'
  };
}

class ChartManager {
  constructor() {
    this.instances = {};
  }

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  }

  /**
   * Построение Pie/Doughnut диаграммы по категориям
   * @param {HTMLCanvasElement} canvasEl 
   * @param {Array<{ category: Object, amount: number }>} data 
   * @param {Function} [onSliceClick] 
   */
  renderCategoryPieChart(canvasEl, data, onSliceClick) {
    if (!canvasEl || typeof Chart === 'undefined') return;
    const canvasId = canvasEl.id || 'categoryPieChart';
    this.destroyChart(canvasId);

    if (!data || data.length === 0) {
      const ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      return;
    }

    const labels = data.map(item => `${item.category.icon} ${item.category.name}`);
    const amounts = data.map(item => item.amount);
    const bgColors = data.map(item => item.category.color);

    const theme = getThemeColors();

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: amounts,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: theme.borderColor,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          ...chartAnimationConfig(),
          animateRotate: true,
          animateScale: true
        },
        onClick: (event, activeElements) => {
          if (activeElements.length > 0 && typeof onSliceClick === 'function') {
            const index = activeElements[0].index;
            const clickedCategory = data[index]?.category;
            if (clickedCategory) {
              onSliceClick(clickedCategory);
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { family: 'Inter, sans-serif', size: 12 },
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw || 0;
                return ` ${value.toLocaleString('he-IL')} ₪`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  /**
   * Построение Bar Chart по дням или месяцам
   * @param {HTMLCanvasElement} canvasEl 
   * @param {Array<{ label: string, expense: number, income: number }>} data 
   */
  renderBarChart(canvasEl, data) {
    if (!canvasEl || typeof Chart === 'undefined') return;
    const canvasId = canvasEl.id || 'expensesBarChart';
    this.destroyChart(canvasId);

    if (!data || data.length === 0) return;

    const labels = data.map(item => item.label);
    const expenses = data.map(item => item.expense);
    const theme = getThemeColors();

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Расходы (₪)',
          data: expenses,
          backgroundColor: theme.accent,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          ...chartAnimationConfig(),
          delay: (context) => context.dataIndex * 30
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Расходы: ${context.raw.toLocaleString('he-IL')} ₪`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Inter, sans-serif', size: 11 } }
          },
          y: {
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
  }

  /**
   * Построение Line Chart тренда расходов
   * @param {HTMLCanvasElement} canvasEl 
   * @param {Array<{ label: string, expense: number }>} data 
   */
  renderLineChart(canvasEl, data) {
    if (!canvasEl || typeof Chart === 'undefined') return;
    const canvasId = canvasEl.id || 'trendLineChart';
    this.destroyChart(canvasId);

    if (!data || data.length === 0) return;

    const labels = data.map(item => item.label);
    const expenses = data.map(item => item.expense);
    const theme = getThemeColors();

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Тренд расходов (₪)',
          data: expenses,
          borderColor: theme.accent,
          backgroundColor: theme.accentFill,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: theme.accent,
          pointBorderColor: theme.borderColor,
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationConfig(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Сумма: ${context.raw.toLocaleString('he-IL')} ₪`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Inter, sans-serif', size: 11 } }
          },
          y: {
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
  }
}

export const chartManager = new ChartManager();
