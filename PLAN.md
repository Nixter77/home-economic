# D³ Code Review Plan

## Discover

- Trace imported JSON through storage, rendering, and analytics.
- Reproduce only issues that can alter results or execute untrusted markup.

## Define

- Pass the selected custom range into the analytics time-series calculation.
- Validate category fields at the persistence boundary and render category icons
  as text rather than HTML.

## Deliver

- Apply the smallest edits in the affected modules.
- Run module syntax checks and focused browser-level checks where available.
- Inspect the staged diff, commit with Conventional Commits, and push the
  current branch.
