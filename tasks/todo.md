# TODO

## Completed
- [x] Basic transaction tracking
- [x] Category management
- [x] Wage card with hourly rate
- [x] Monthly navigation
- [x] Analytics with charts
- [x] Calendar view
- [x] Data sync
- [x] Export to CSV
- [x] Motion/animation system
- [x] Bottom sheet for quick add

## Current: Israeli Tax / Payslip Calculator ✅
- [x] Create `js/tax-il.js` — Israeli tax engine (income tax brackets, bituach leumi, health insurance, pension, credit points)
- [x] Add payslip modal HTML to `index.html`
- [x] Add payslip CTA button to dashboard (visible when salary income exists for current month)
- [x] Add CSS for payslip modal (`.payslip-*` classes)
- [x] Wire button + modal logic in `app.js`
- [x] Verify the calculator with test salaries (7K, 10K, 15K NIS)

## Current: Date Month-End Overflow Bug Fix 🐛
- [x] Identify root cause of month comparison / navigation date overflow on 31st (setMonth overflow)
- [x] Fix `getComparisonWithPrevious` in `js/analytics.js` (`setDate(1)` before `setMonth(-1)`)
- [x] Fix month navigation listeners in `js/app.js` (`setDate(1)` before `setMonth`)
- [x] Run syntax checks and verification tests

## Current: Git History Cleanup 🧹
- [ ] Create backup branch `backup-main-history`
- [ ] Rebuild Git history with only first commit + last 2 commits
- [ ] Verify zero code diff against backup branch
- [ ] Force push clean `main` branch to GitHub (`origin/main`)
- [ ] Clean up temporary backup/work branches

## Review
- **Issue**: `setMonth(prevDate.getMonth() - 1)` on month-end dates (e.g. May 31) caused JavaScript `Date` to overflow into the current month (May 1 instead of April 30), resulting in zero percentage change calculation and broken month navigation.
- **Fix**: Reset day of month to `1` (`setDate(1)`) before performing `setMonth(+/- 1)`.
- **Verification**: Verified using Node syntax check (`node --input-type=module --check`) across all JS files and executed automated date boundary test script for all 12 month-end edge cases.

