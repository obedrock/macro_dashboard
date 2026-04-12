---
phase: 01-cleanup
plan: 01
subsystem: infra
tags: [vite, typescript, npm, dst, intl, cleanup]

# Dependency graph
requires: []
provides:
  - Massive.com integration fully removed (service file, package, alias, TTL constant)
  - Supabase package uninstalled
  - vite.config.ts simplified to minimal config without path aliases
  - DST-aware calendar scheduling using native Intl.DateTimeFormat API
affects: [02-error-handling, 03-websocket, 04-decomposition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use Intl.DateTimeFormat with timeZone: 'America/New_York' for ET-relative scheduling"

key-files:
  created: []
  modified:
    - vite.config.ts
    - package.json
    - package-lock.json
    - src/services/cache.ts
    - src/hooks/useMarketData.ts
  deleted:
    - src/services/massiveService.ts

key-decisions:
  - "Remove TTL.MASSIVE from cache.ts alongside massiveService.ts deletion to avoid dead constants"
  - "Use Intl.DateTimeFormat formatToParts (not toLocaleString) for reliable hour/minute/second extraction"

patterns-established:
  - "DST-safe ET scheduling: Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' }).formatToParts()"

requirements-completed: [CLEAN-01, CLEAN-03]

# Metrics
duration: 12min
completed: 2026-04-11
---

# Phase 01 Plan 01: Remove Dead Integrations + Fix DST Bug Summary

**Massive.com service deleted, both unused packages uninstalled, vite.config.ts simplified, and DST-aware calendar scheduling implemented via native Intl.DateTimeFormat**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-11T02:34:59Z
- **Completed:** 2026-04-11T19:37:29Z
- **Tasks:** 2
- **Files modified:** 5 (+ 1 deleted)

## Accomplishments
- Deleted `src/services/massiveService.ts` and uninstalled `@massive.com/client-js` and `@supabase/supabase-js`
- Simplified `vite.config.ts` from 20 lines (with path alias) to 8 lines (no alias, no path import)
- Fixed DST scheduling bug: replaced hardcoded UTC-5 offset with `Intl.DateTimeFormat('America/New_York')` — calendar now fires at 8:35 AM ET correctly during both EST (UTC-5) and EDT (UTC-4)
- Removed dead `TTL.MASSIVE` constant from `cache.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Massive.com and Supabase dead code** - `943e9f4` (feat)
2. **Task 2: Fix DST bug in calendar scheduling** - `4b76d85` (fix)

## Files Created/Modified
- `src/services/massiveService.ts` - DELETED (Massive.com API integration, 162 lines)
- `vite.config.ts` - Removed `import path`, `resolve.alias`, `optimizeDeps.include`
- `package.json` - Removed `@massive.com/client-js` and `@supabase/supabase-js` dependencies
- `package-lock.json` - Updated after uninstall
- `src/services/cache.ts` - Removed `MASSIVE: 5 * 60 * 1000` from TTL object
- `src/hooks/useMarketData.ts` - Replaced `msUntilNextCalendarRefresh()` with DST-aware Intl implementation

## Decisions Made
- Removed `TTL.MASSIVE` from `cache.ts` alongside service deletion — the property was only consumed by `massiveService.ts`, leaving it in place would be dead code
- Used `Intl.DateTimeFormat` `formatToParts` (not `toLocaleString`) for reliable part extraction; applied `% 24` on hour to handle browser edge case where midnight returns `'24'` instead of `'0'`
- Used `now.getTime()` (not a synthesized ET epoch) for the two-hour modulo since `CALENDAR_REFRESH_MS` is a wall-clock interval

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed dead TTL.MASSIVE constant from cache.ts**
- **Found during:** Task 1 (removing Massive dead code)
- **Issue:** `cache.ts` exported `TTL.MASSIVE` which was only used by `massiveService.ts`. After deleting the service, the constant was orphaned dead code
- **Fix:** Removed `MASSIVE: 5 * 60 * 1000` from the `TTL` export object in `cache.ts`
- **Files modified:** `src/services/cache.ts`
- **Verification:** `grep -ri "massive" src/` returns 0 results
- **Committed in:** `943e9f4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical cleanup)
**Impact on plan:** Minor cleanup extending the plan's own intent — no scope creep.

## Issues Encountered
- Pre-existing TypeScript errors (TS6133 unused variable warnings) in component files — these existed before plan execution and are unrelated to changes. The build (`vite build`) succeeds cleanly; `tsc --noEmit` in strict mode reports pre-existing issues only.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dead code removed, bundle simplified, and build clean
- `useMarketData.ts` calendar scheduling is now DST-correct — ready for further hook work in later phases
- Pre-existing TypeScript strict-mode warnings in components should be addressed in a future cleanup plan

---
*Phase: 01-cleanup*
*Completed: 2026-04-11*
