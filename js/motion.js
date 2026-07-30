/**
 * Модуль анимаций и микровзаимодействий (Motion)
 * Реализует ripple, count-up и stagger в соответствии с DESIGN.md.
 * Все анимации — только transform/opacity (композитор GPU).
 * При prefers-reduced-motion все эффекты отключаются.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Проверка, запросил ли пользователь уменьшение движения
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Ripple-эффект на кнопке (композитный, один элемент).
 * Игнорируется при prefers-reduced-motion.
 * @param {MouseEvent|PointerEvent} event
 */
export function addRipple(event) {
  if (prefersReducedMotion()) return;

  const target = event.currentTarget;
  if (!target || typeof target.getBoundingClientRect !== 'function') return;

  const rect = target.getBoundingClientRect();
  const diameter = Math.max(rect.width, rect.height) * 2.2;
  const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - diameter / 2;
  const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - diameter / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${diameter}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  // Удалить предыдущий ripple, если он ещё существует
  const existing = target.querySelector('.ripple');
  if (existing) existing.remove();

  target.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

/**
 * Подключить ripple ко всем кнопкам с классом .btn
 */
export function initRipples() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('pointerdown', addRipple, { passive: true });
  });
}

/**
 * Плавная анимация числа от текущего значения к целевому (count-up).
 * Использует rAF; при prefers-reduced-motion устанавливает значение мгновенно.
 * @param {HTMLElement} el — целевой элемент
 * @param {number} toValue — конечное число
 * @param {(v: number) => string} formatter — функция форматирования
 * @param {number} [duration=600] — длительность в мс
 */
export function countUp(el, toValue, formatter, duration = 600) {
  if (!el) return;

  const format = typeof formatter === 'function' ? formatter : (v) => String(Math.round(v));

  if (prefersReducedMotion() || duration <= 0) {
    el.textContent = format(toValue);
    return;
  }

  // Попытаться извлечь предыдущее числовое значение из data-атрибута
  const fromValue = Number(el.dataset.countValue) || 0;
  el.dataset.countValue = String(toValue);

  if (fromValue === toValue) {
    el.textContent = format(toValue);
    return;
  }

  const startTime = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 3); // cubic ease-out

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOut(progress);
    const current = fromValue + (toValue - fromValue) * eased;
    el.textContent = format(current);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.textContent = format(toValue);
    }
  }

  requestAnimationFrame(frame);
}

/**
 * Каскадная (stagger) анимация появления дочерних элементов контейнера.
 * Каждый следующий элемент задерживается на step мс; общая задержка ограничена.
 * При prefers-reduced-motion элементы появляются мгновенно.
 * @param {HTMLElement} container
 * @param {number} [step=40] — задержка между элементами (мс)
 * @param {number} [maxDelay=300] — максимальная суммарная задержка (мс)
 */
export function staggerChildren(container, step = 40, maxDelay = 300) {
  if (!container) return;

  const children = Array.from(container.children);
  if (children.length === 0) return;

  if (prefersReducedMotion()) {
    children.forEach(child => {
      child.style.animationDelay = '';
    });
    return;
  }

  const cappedStep = Math.min(step, maxDelay / Math.max(1, children.length));

  container.classList.add('anim-stagger');
  children.forEach((child, index) => {
    child.style.animationDelay = `${Math.round(index * cappedStep)}ms`;
  });
}

/**
 * Сброс stagger-анимации (например, перед повторным рендером списка)
 * @param {HTMLElement} container
 */
export function resetStagger(container) {
  if (!container) return;
  container.classList.remove('anim-stagger');
  Array.from(container.children).forEach(child => {
    child.style.animationDelay = '';
  });
}
