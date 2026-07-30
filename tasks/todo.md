# План: Редизайн в светлом Apple-стиле с анимациями

## Цель
Светлая тема в духе Apple (чистый белый/костяной фон, мягкие многослойные тени,
закруглённые карточки), плавные spring-анимации без вреда интерфейсу
(только transform/opacity, prefers-reduced-motion, GPU-композитор).

## Фаза 1: Токены и документация
- [x] DESIGN.md: добавить elevation-тени (sm/md/lg/xl), motion-токены
  (spring curves, durations, stagger), обновить описание светлой темы.
- [x] Линт DESIGN.md: `npx @google/design.md lint DESIGN.md`.

## Фаза 2: CSS (css/style.css)
- [x] Светлая тема по умолчанию (`:root` = light), midnight сохранить как альтернативу.
- [x] Мягкие объёмные тени: многослойные box-shadow (ambient + key light).
- [x] Карточки: увеличенный радиус (20px), hover-lift с углублением тени.
- [x] Анимации: view-enter (fade+slide), stagger для списков, hover/active
  micro-interactions, ripple на кнопках, spring cubic-bezier кривые.
- [x] `prefers-reduced-motion`: отключить все несущественные анимации.
- [x] Плавная смена тем (transition по CSS-переменным где безопасно).

## Фаза 3: JS (js/)
- [x] store.js: тема по умолчанию 'light', иконка переключателя темы.
- [x] app.js: анимация переходов между экранами (showView с классами),
  stagger-анимация элементов списка транзакций и категорий, count-up
  анимация сумм на дашборде.
- [x] charts.js: плавные анимации Chart.js (animation duration/easing),
  цвета под светлую тему.
- [x] Новый модуль js/motion.js: ripple-эффект, count-up, stagger helper.

## Фаза 4: HTML
- [x] index.html: data-theme="light" по умолчанию, иконка ☀️/🌙.

## Фаза 5: Проверка и деплой
- [x] Локальная проверка (python3 http.server), скриншот/контроль.
- [ ] Push в GitHub → автодеплой Vercel.

## Review

Выполнено:
- DESIGN.md: добавлены elevation-токены (shadow-sm/md/lg/xl, accent, midnight),
  motion-компоненты (кривые spring/standard/decelerate, длительности, stagger),
  радиус card 20px; разделы Elevation & Depth и Motion переписаны. Линт чистый.
- css/style.css: светлая Apple-тема по умолчанию (фон #F5F5F7, белые карточки,
  многослойные мягкие тени, glass-шапка и сайдбар с blur+saturate),
  spring-анимации hover/press, view-enter переходы, stagger появление списков,
  ripple на .btn, полная поддержка prefers-reduced-motion, macOS-скроллбары,
  safe-area-inset для мобильных. Midnight-тема сохранена как [data-theme="midnight"].
- js/motion.js (новый): prefersReducedMotion(), addRipple(), initRipples(),
  countUp() на rAF с cubic ease-out, staggerChildren() с ограничением задержки.
- js/store.js: тема по умолчанию light, уважение prefers-color-scheme,
  автоматическое обновление иконки переключателя (🌙/☀️) и title.
- js/app.js: подключены initRipples, countUp для трёх stat-сумм дашборда,
  staggerChildren для списка транзакций, категорий, бюджетов, сетки выбора.
- js/charts.js: getThemeColors() (акцент и сетка по теме), chartAnimationConfig()
  (700ms easeOutCubic, 0ms при reduced-motion), stagger-delay в bar-chart,
  hoverOffset 8 в doughnut, точки line-chart с белой обводкой.
- js/analytics.js: ИСПРАВЛЕН синтаксический баг — незакрытая функция
  getTimeSeriesBreakdown (было в коммите 5500fdb); восстановлено тело функции
  с непрерывными рядами по дням (неделя/месяц), добавлены refDate-параметры
  в getSummary/getCategoryBreakdown/getTimeSeriesBreakdown для навигации по месяцам.
- index.html: data-theme="light", inline-скрипт применения темы до отрисовки
  (без FOUC), title и иконка переключателя по умолчанию.

Проверено:
- node --check по всем 10 JS-модулям: OK.
- design.md lint: 0 ошибок, 0 предупреждений.
- Локальный запуск (python3 http.server): дашборд, добавление, история,
  аналитика — все рендерятся, данные считаются, графики рисуются,
  переключение light/midnight работает, JS-ошибок в консоли нет.
