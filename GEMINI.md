# GEMINI.md

> Last updated: 2026-07-30  
> For **Gemini CLI / Gemini Code Assist** and Google Labs-style agents.  
> Follow **`AGENTS.md` first**. This file only adds Gemini-specific deltas.

## Hierarchy

1. `AGENTS.md` — shared workflow, principles, verification, task paths  
2. `DESIGN.md` — visual identity in the official [DESIGN.md](https://github.com/google-labs-code/design.md) format  
3. `GEMINI.md` — this file (Gemini / Google tooling)

## Gemini workflow

### Plan → implement → verify

1. For non-trivial tasks, write a checkable plan to `tasks/todo.md`.
2. Confirm the plan when the change is large or architectural.
3. Implement with minimal diffs.
4. Verify with project checks; never claim done without evidence.
5. Record a short **Review** in `tasks/todo.md`.

### Subagents / parallel work

- Offload research and exploration when available.
- One tack (single objective) per subagent for focused execution.
- Merge results into a single coherent change set in the main thread.

### Self-improvement

- After any user correction, update `tasks/lessons.md`.
- Review lessons at session start.

## DESIGN.md (required for UI)

This project uses the Google Labs **DESIGN.md** format:

- YAML front matter = machine-readable tokens (normative)
- Markdown body = rationale and usage rules
- Spec / CLI: https://github.com/google-labs-code/design.md

### When creating or changing UI

1. Read `DESIGN.md` before writing styles or components.
2. Use token references like `{colors.primary}` instead of hard-coded one-offs when a token exists.
3. Keep section order compatible with the design.md spec when editing prose sections.
4. Lint after token or structure changes:

```bash
npx @google/design.md lint DESIGN.md
```

Optional exports (Tailwind / DTCG):

```bash
npx @google/design.md export --format css-tailwind DESIGN.md
npx @google/design.md export --format dtcg DESIGN.md
```

### Creating a new DESIGN.md (greenfield)

If the design system must be recreated from scratch, base it on:

https://github.com/google-labs-code/design.md

Minimum structure:

```yaml
---
name: <Name>
version: alpha
description: <one line>
colors:
  primary: "#..."
typography:
  body:
    fontFamily: Inter
    fontSize: 1rem
rounded:
  md: 8px
spacing:
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview
...
## Colors
...
## Typography
...
## Components
...
```

Do **not** invent a parallel design doc format; keep a single `DESIGN.md`.

## Task paths

| File | Purpose |
|------|---------|
| `tasks/todo.md` | Plans, checklists, review notes |
| `tasks/lessons.md` | Durable rules after corrections |

## Core principles (reminder)

- Simplicity first — minimal code impact  
- Root causes — no temporary fixes left behind  
- Minimal blast radius — only necessary files  
- Verify before done — tests, logs, or explicit gap  
