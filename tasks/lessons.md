# Lessons

Durable rules for coding agents. Append after any user correction.

## Format

```text
## YYYY-MM-DD — short title
- Mistake: what went wrong
- Rule: what to do instead
```

## Entries

### 2026-07-30 — Agent instruction hygiene

- Mistake: Root `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` had broken line wraps, typos, and invalid paths (`tasks/todo md`, `Lessons-md*`), so agents could not follow them reliably.
- Rule: Keep agent instruction files short, well-formed Markdown, with exact paths and a single source of truth (`AGENTS.md`). Tool-specific files only add deltas. Keep `DESIGN.md` aligned with the Google design.md section order and token schema.
