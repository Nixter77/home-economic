# CLAUDE.md

> Last updated: 2026-07-30  
> For **Claude Code** (and Claude-based coding sessions).  
> Follow **`AGENTS.md` first**. This file only adds Claude-specific deltas.

## Hierarchy

1. `AGENTS.md` — shared workflow, principles, verification, task paths  
2. `DESIGN.md` — UI tokens and visual rules  
3. `CLAUDE.md` — this file (Claude Code behavior)

If anything conflicts, prefer `AGENTS.md` for process and `DESIGN.md` for UI.

## Claude Code defaults

### Plan mode

- Enter plan mode for non-trivial work (3+ steps, architecture, multi-file).
- Use plan mode for verification strategy, not only for building.
- Write detailed enough specs that implementation is unambiguous.
- If blocked or surprised by the codebase, stop and re-plan.

### Tools and context

- Prefer dedicated file tools over shell for read/edit when available.
- Use subagents for research, exploration, and parallel analysis so the main context stays clean.
- One objective per subagent; return a crisp handoff (what found, what remains, risks).
- Do not dump huge file contents into chat; summarize and cite paths.

### Edits

- Prefer precise patches over full-file rewrites.
- Match existing style, naming, and import patterns.
- Keep comments rare and only for non-obvious *why*.

### Verification

Before claiming done:

```text
1. Identify the project’s real check commands (package scripts, Makefile, etc.)
2. Run the smallest set that proves the change
3. Fix failures you introduced
4. Report what you ran and the outcome
```

### Task files

- Plan checklist: `tasks/todo.md`
- Corrections / anti-patterns: `tasks/lessons.md`
- After user corrections, always append a durable lesson rule.

## Self-check (Claude)

Before the final reply on a non-trivial task:

- [ ] Did I follow `AGENTS.md` workflow?
- [ ] Did I prove it works (or explain why I could not)?
- [ ] Is the diff minimal?
- [ ] Would I ship this to main?
