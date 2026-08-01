# Lessons

Durable rules for coding agents. Append after any user correction.

## Format

```text
## YYYY-MM-DD — short title
- Mistake: what went wrong
- Rule: what to do instead
```

## Entries

### 2026-07-30 — Проверять синтаксис ES-модулей правильно

- Mistake: `node --check file.js` проверяет файл как CommonJS-скрипт и не ловит
  ошибки, специфичные для строгого режима ES-модулей (например, незакрытый
  метод класса). Из-за этого баг в `js/analytics.js` (незакрытая функция
  `getTimeSeriesBreakdown`) попал в коммит 5500fdb и убил весь рендеринг.
- Rule: Для ES-модулей проверять синтаксис через
  `node --input-type=module --check < file.js`, а в браузере — всегда смотреть
  консоль на ошибки парсинга модулей перед визуальной проверкой.

### 2026-07-30 — Agent instruction hygiene

- Mistake: Root `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` had broken line wraps, typos, and invalid paths (`tasks/todo md`, `Lessons-md*`), so agents could not follow them reliably.
- Rule: Keep agent instruction files short, well-formed Markdown, with exact paths and a single source of truth (`AGENTS.md`). Tool-specific files only add deltas. Keep `DESIGN.md` aligned with the Google design.md section order and token schema.
