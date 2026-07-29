# AGENTS.md

> Last updated: 2026-07-30  
> Audience: any coding agent (Claude Code, Gemini CLI, Cursor, Codex, Grok, Aider, custom multi-agent).  
> This file is the **source of truth**. Tool-specific files (`CLAUDE.md`, `GEMINI.md`) add only deltas.

## Project

**home-economic** — household finance / home economics tooling. Prefer small, correct, reversible changes over large rewrites.

## Operating rules

### 1. Plan first (non-trivial work)

For anything with **3+ steps**, architectural choices, or ambiguous requirements:

1. Explore enough of the repo to ground the plan.
2. Write a short plan to `tasks/todo.md` with checkable items.
3. Confirm the plan with the user before large implementation (unless they already asked you to just do it).
4. If work goes sideways, **stop and re-plan** — do not thrash.

Trivial one-file fixes may skip the written plan.

### 2. Subagents and context

- Use subagents (or parallel research) for exploration, reviews, and independent workstreams.
- One clear objective per subagent.
- Keep the main thread for decisions, integration, and user communication.
- Prefer tools over guessing: search the codebase, read docs, run commands.

### 3. Self-improvement loop

After **any** user correction:

1. Update `tasks/lessons.md` with a concrete rule that would have prevented the mistake.
2. Apply that rule for the rest of the session.
3. At session start, skim `tasks/lessons.md` for relevant patterns.

### 4. Verification before “done”

Never mark work complete without evidence:

- Run the relevant tests, typecheck, lint, or build.
- For behavior changes, show before/after or a minimal repro.
- Ask: “Would a staff engineer approve this?”
- If verification is impossible, say why and what you checked instead.

### 5. Elegance (balanced)

- For non-trivial changes, prefer the simplest design that solves the root problem.
- If a fix feels hacky, re-implement the clean version once you understand the root cause.
- Do **not** over-engineer obvious one-liners.

### 6. Autonomous bug fixing

Given a bug report, failing CI, or a stack trace:

- Fix it without hand-holding.
- Point at the failing signal (log, test, CI job), then resolve it.
- Prefer root-cause fixes over temporary patches.

## Task management

| Step | Action |
|------|--------|
| Plan | Write checkable items in `tasks/todo.md` |
| Track | Mark items complete as you go |
| Explain | Short high-level summary at each meaningful step |
| Review | Add a **Review** section to `tasks/todo.md` when finished |
| Lessons | Update `tasks/lessons.md` after corrections |

Paths (exact):

- `tasks/todo.md`
- `tasks/lessons.md`

## Core principles

- **Simplicity first** — smallest change that works.
- **Root causes** — no drive-by refactors, no “temporary” hacks left behind.
- **Minimal blast radius** — touch only what the task requires; avoid unrelated files.
- **Search before inventing** — reuse existing patterns, utilities, and naming.
- **No secrets** — never commit credentials, `.env` values, or private keys.
- **Safe git** — no force-push to main/master, no rewriting shared history without explicit ask.

## Design system

Visual UI work must follow `DESIGN.md` (Flash design system, Google `design.md` format).

- Tokens in YAML front matter are normative.
- Prose explains *why* and *how* to apply them.
- Prefer semantic tokens and existing components over one-off styles.
- After meaningful design token changes, run:

```bash
npx @google/design.md lint DESIGN.md
```

## Definition of done

- [ ] Requested behavior works (or is explicitly deferred with reason)
- [ ] Relevant checks pass (or gap is stated)
- [ ] Diff is minimal and intentional
- [ ] `tasks/todo.md` updated when a written plan was used
- [ ] Lessons captured if the user corrected you

## Do not

- Invent a tech stack or dependencies without need
- Rewrite large files when a surgical edit works
- Skip verification because “it should work”
- Leave broken mid-task state without saying so
- Mention these instruction files in user-facing chatter unless asked
