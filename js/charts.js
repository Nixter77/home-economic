/**
 * Интеграция и визуализация Chart.js для Home Economic
 */

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
   */
  renderCategoryPieChart(canvasEl, data) {
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

    const isMidnight = document.documentElement.getAttribute('data-theme') === 'midnight';
    const textColor = isMidnight ? '#E8E8ED' : '#1D1D1F';

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: amounts,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: isMidnight ? '#141418' : '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
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
    const isMidnight = document.documentElement.getAttribute('data-theme') === 'midnight';
    const textColor = isMidnight ? '#E8E8ED' : '#1D1D1F';
    const gridColor = isMidnight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Расходы (₪)',
          data: expenses,
          backgroundColor: '#0071E3',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            ticks: { color: textColor, font: { family: 'Inter, sans-serif', size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
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
    const isMidnight = document.documentElement.getAttribute('data-theme') === 'midnight';
    const textColor = isMidnight ? '#E8E8ED' : '#1D1D1F';
    const gridColor = isMidnight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    this.instances[canvasId] = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Тренд расходов (₪)',
          data: expenses,
          borderColor: '#2F6FCB',
          backgroundColor: 'rgba(47, 111, 203, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#2F6FCB'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            ticks: { color: textColor, font: { family: 'Inter, sans-serif', size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
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
