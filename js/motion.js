/**
 * Motion — заметные, мягкие анимации (WAAPI + CSS).
 * Hot path: transform / opacity.
 * prefers-reduced-motion → выкл.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Заметно, но не медленно */
export const MOTION = {
  fast: 160,
  normal: 360,
  slow: 520,
  countUp: 640,
  chart: 900,
  staggerStep: 55,
  staggerMax: 400
};

const EASING_SOFT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASING_SPRING = 'cubic-bezier(0.34, 1.45, 0.64, 1)';

/** @type {WeakMap<Element, IntersectionObserver>} */
const revealObservers = new WeakMap();

export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch (_) {
    return false;
  }
}

/**
 * @param {Element} el
 * @param {Keyframe[]} keyframes
 * @param {KeyframeAnimationOptions} options
 * @returns {Animation|null}
 */
function animateEl(el, keyframes, options) {
  if (!el || prefersReducedMotion()) return null;
  if (typeof el.animate !== 'function') return null;

  try {
    if (typeof el.getAnimations === 'function') {
      el.getAnimations().forEach(a => {
        try { a.cancel(); } catch (_) { /* ignore */ }
      });
    }

    const anim = el.animate(keyframes, options);

    // Зафиксировать финальные стили и снять WAAPI-эффект (не ломает hover CSS)
    anim.addEventListener('finish', () => {
      try {
        if (typeof anim.commitStyles === 'function') anim.commitStyles();
      } catch (_) { /* ignore */ }
      try { anim.cancel(); } catch (_) { /* ignore */ }
      // Убрать inline opacity/transform, чтобы CSS hover снова работал
      if (el instanceof HTMLElement) {
        el.style.opacity = '';
        el.style.transform = '';
      }
    }, { once: true });

    return anim;
  } catch (_) {
    return null;
  }
}

/**
 * Сброс возможных «залипших» inline opacity/transform
 * @param {HTMLElement} root
 */
function clearInlineMotion(root) {
  if (!root) return;
  const nodes = [root, ...root.querySelectorAll('[style]')];
  nodes.forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    // only clear if they look like our motion leftovers
    if (node.style.opacity === '0' || node.style.opacity === '1') {
      node.style.opacity = '';
    }
    if (node.style.transform) {
      node.style.transform = '';
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Ripple                                                                     */
/* -------------------------------------------------------------------------- */

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

  const existing = target.querySelector('.ripple');
  if (existing) existing.remove();

  target.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

export function initRipples() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('pointerdown', addRipple, { passive: true });
  });
}

/* -------------------------------------------------------------------------- */
/* Count-up                                                                   */
/* -------------------------------------------------------------------------- */

export function countUp(el, toValue, formatter, duration = MOTION.countUp) {
  if (!el) return;
  const format = typeof formatter === 'function' ? formatter : (v) => String(Math.round(v));

  if (prefersReducedMotion() || duration <= 0) {
    el.textContent = format(toValue);
    el.dataset.countValue = String(toValue);
    return;
  }

  const fromValue = Number(el.dataset.countValue) || 0;
  el.dataset.countValue = String(toValue);
  if (fromValue === toValue) {
    el.textContent = format(toValue);
    return;
  }

  const startTime = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function frame(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    el.textContent = format(fromValue + (toValue - fromValue) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(frame);
    else el.textContent = format(toValue);
  }
  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------------------- */
/* Stagger lists                                                              */
/* -------------------------------------------------------------------------- */

export function staggerChildren(container, step = MOTION.staggerStep, maxDelay = MOTION.staggerMax) {
  if (!container) return;
  const children = Array.from(container.children);
  if (children.length === 0) return;

  if (prefersReducedMotion()) {
    children.forEach(child => {
      if (child instanceof HTMLElement) {
        child.style.opacity = '';
        child.style.transform = '';
        child.style.animationDelay = '';
      }
    });
    return;
  }

  const cappedStep = Math.min(step, maxDelay / Math.max(1, children.length));
  let usedWaapi = false;

  children.forEach((child, index) => {
    const delay = Math.round(index * cappedStep);
    const anim = animateEl(
      child,
      [
        { opacity: 0, transform: 'translateY(16px) scale(0.97)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ],
      { duration: MOTION.normal, delay, easing: EASING_SOFT, fill: 'forwards' }
    );
    if (anim) usedWaapi = true;
  });

  if (!usedWaapi) {
    container.classList.remove('anim-stagger');
    void container.offsetWidth;
    container.classList.add('anim-stagger');
    children.forEach((child, index) => {
      if (child instanceof HTMLElement) {
        child.style.animationDelay = `${Math.round(index * cappedStep)}ms`;
      }
    });
  } else {
    container.classList.remove('anim-stagger');
  }
}

export function resetStagger(container) {
  if (!container) return;
  container.classList.remove('anim-stagger');
  Array.from(container.children).forEach(child => {
    if (!(child instanceof HTMLElement)) return;
    child.style.animationDelay = '';
    if (typeof child.getAnimations === 'function') {
      child.getAnimations().forEach(a => {
        try { a.cancel(); } catch (_) { /* ignore */ }
      });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* View enter                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Каскадное появление секций экрана.
 * Всегда сбрасывает залипшие стили и играет заново.
 * @param {HTMLElement} viewEl
 * @param {boolean} [cascadeChildren=true]
 */
export function playViewEnter(viewEl, cascadeChildren = true) {
  if (!viewEl) return;

  clearInlineMotion(viewEl);
  viewEl.classList.remove('view-enter', 'view-enter-cascade');

  if (prefersReducedMotion()) {
    Array.from(viewEl.children).forEach(child => {
      if (child instanceof HTMLElement) {
        child.style.opacity = '';
        child.style.transform = '';
      }
    });
    return;
  }

  const targets = cascadeChildren && viewEl.children.length > 0
    ? Array.from(viewEl.children)
    : [viewEl];

  // Сначала спрятать (иначе flash full content)
  targets.forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(22px)';
    }
  });

  // Двойной rAF: paint hidden → animate in (критично после display:none→block)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      let usedWaapi = false;

      targets.forEach((el, index) => {
        const delay = Math.min(index * MOTION.staggerStep, MOTION.staggerMax);
        const anim = animateEl(
          el,
          [
            { opacity: 0, transform: 'translateY(22px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          {
            duration: MOTION.slow,
            delay,
            easing: EASING_SOFT,
            fill: 'forwards'
          }
        );
        if (anim) usedWaapi = true;
      });

      if (!usedWaapi) {
        targets.forEach(el => {
          if (el instanceof HTMLElement) {
            el.style.opacity = '';
            el.style.transform = '';
          }
        });
        void viewEl.offsetWidth;
        if (cascadeChildren && viewEl.children.length > 0) {
          viewEl.classList.add('view-enter-cascade');
        } else {
          viewEl.classList.add('view-enter');
        }
        window.setTimeout(() => {
          viewEl.classList.remove('view-enter', 'view-enter-cascade');
        }, MOTION.slow + MOTION.staggerMax + 100);
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Chart container reveal                                                     */
/* -------------------------------------------------------------------------- */

export function revealChart(canvasEl) {
  if (!canvasEl || prefersReducedMotion()) return;
  const container = canvasEl.closest('.chart-container') || canvasEl.parentElement;
  if (!container) return;

  container.classList.remove('chart-reveal');
  if (container instanceof HTMLElement) {
    container.style.opacity = '0';
    container.style.transform = 'translateY(12px) scale(0.97)';
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const anim = animateEl(
        container,
        [
          { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ],
        { duration: MOTION.chart, easing: EASING_SOFT, fill: 'forwards' }
      );
      if (!anim) {
        if (container instanceof HTMLElement) {
          container.style.opacity = '';
          container.style.transform = '';
        }
        void container.offsetWidth;
        container.classList.add('chart-reveal');
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Progress bars                                                              */
/* -------------------------------------------------------------------------- */

export function animateProgressBars(container) {
  if (!container) return;
  const fills = container.querySelectorAll('.progress-bar-fill');
  if (fills.length === 0) return;

  fills.forEach(fill => {
    if (!(fill instanceof HTMLElement)) return;
    const target = fill.dataset.targetWidth || fill.style.width || '0%';
    fill.dataset.targetWidth = target;
    fill.style.transition = 'none';
    fill.style.width = '0%';
  });

  if (prefersReducedMotion()) {
    fills.forEach(fill => {
      if (fill instanceof HTMLElement) {
        fill.style.width = fill.dataset.targetWidth || '0%';
      }
    });
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fills.forEach((fill, index) => {
        if (!(fill instanceof HTMLElement)) return;
        const delay = Math.min(index * MOTION.staggerStep, MOTION.staggerMax);
        fill.style.transition = `width ${MOTION.chart}ms ${EASING_SOFT} ${delay}ms`;
        fill.style.width = fill.dataset.targetWidth || '0%';
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Scroll / mount reveal for cards                                            */
/* -------------------------------------------------------------------------- */

/**
 * Один раз анимировать появление элемента (карточки и т.п.)
 * @param {HTMLElement} el
 * @param {number} [delay=0]
 */
export function revealOnce(el, delay = 0) {
  if (!el || prefersReducedMotion()) return;
  if (el.dataset.revealed === '1') return;
  el.dataset.revealed = '1';

  animateEl(
    el,
    [
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    { duration: MOTION.slow, delay, easing: EASING_SOFT, fill: 'forwards' }
  );
}

/**
 * Наблюдать карточки во view: появление при скролле / первом показе.
 * @param {HTMLElement} viewEl
 */
export function observeViewReveals(viewEl) {
  if (!viewEl || prefersReducedMotion()) return;

  // cleanup previous observer for this view
  const prev = revealObservers.get(viewEl);
  if (prev) {
    prev.disconnect();
    revealObservers.delete(viewEl);
  }

  const candidates = viewEl.querySelectorAll('.card, .stat-card, .stat-grid, .chip-bar');
  if (candidates.length === 0) return;

  // reset so re-enter can animate again
  candidates.forEach(el => {
    delete el.dataset.revealed;
  });

  if (typeof IntersectionObserver !== 'function') {
    candidates.forEach((el, i) => revealOnce(el, Math.min(i * MOTION.staggerStep, MOTION.staggerMax)));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (!(el instanceof HTMLElement)) return;
      revealOnce(el, 0);
      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  candidates.forEach(el => io.observe(el));
  revealObservers.set(viewEl, io);
}

export function pulse(el) {
  if (!el || prefersReducedMotion()) return;
  animateEl(
    el,
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.02)' },
      { transform: 'scale(1)' }
    ],
    { duration: MOTION.normal, easing: EASING_SPRING }
  );
}

export { EASING_SOFT, EASING_SPRING };
