---
phase: 02-data-layer-hardening
plan: 03
subsystem: api
tags: [typescript, error-handling, data-result, react-hooks, useMarketData, partial-success]

requires:
  - phase: 02-data-layer-hardening plan 01
    provides: DataResult type, ResultWarning, DataSource types in src/types/index.ts
  - phase: 02-data-layer-hardening plan 02
    provides: All service functions returning DataResult<T> with Zod validation and rate limiting

provides:
  - useMarketData hook fully adapted to DataResult pattern — all 9 fetch callbacks unwrap DataResult
  - warnedStatus helper for partial success (state loaded with warning text in error field)
  - fetchRates, fetchCalendar handle multi-source partial success with ResultWarning aggregation
  - CLAUDE.md error handling conventions updated to document DataResult as the service-boundary standard

affects:
  - All future phases that modify useMarketData.ts
  - UI-02 (phase 5) — will add distinct visual treatment for warnedStatus

tech-stack:
  added: []
  patterns:
    - "useMarketData unwraps DataResult via result.status === 'error' narrowing, not try/catch at service boundary"
    - "warnedStatus helper: state loaded with warnings joined as error string — phase 5 adds distinct UI treatment"
    - "Multi-source partial success: collect warnings from all sources, only error if all primary sources fail"
    - "Infrastructure safety-net try/catch retained in callbacks — catches unexpected non-DataResult errors"

key-files:
  created: []
  modified:
    - src/hooks/useMarketData.ts
    - CLAUDE.md

key-decisions:
  - "Infrastructure safety-net catch blocks retained in all callbacks — they catch unexpected errors (WebSocket crash, etc.) that bypass DataResult, not service errors"
  - "warnedStatus stores warning text in WidgetStatus.error field with state loaded — Phase 5 (UI-02) will add amber badge treatment"
  - "fetchCalendar switches from Promise.allSettled to Promise.all since services now return DataResult not throw"
  - "fetchRates propagates both per-source DataResult errors and within-source warnings (e.g., FRED partial yields) into unified warnings array"

patterns-established:
  - "DataResult unwrapping pattern: result = await service(); if result.status === 'error' -> setErrorStatus, return; else setData(result.data); setStatus(warnedStatus or loadedStatus)"
  - "Multi-source warning aggregation: collect warnings from all sources, only error widget if both primary sources failed"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-05, DATA-06]

duration: 8min
completed: 2026-04-12
---

# Phase 02 Plan 03: Hook Migration to DataResult Summary

**useMarketData fully migrated to DataResult unwrapping — all 9 fetch callbacks use status narrowing, partial success surfaces warnings to WidgetStatus, app builds with zero TypeScript errors**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-12T03:32:00Z
- **Completed:** 2026-04-12T03:40:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `warnedStatus` helper and `ResultWarning` import to useMarketData — enables partial success display without blocking widget render
- Migrated all 5 simple fetch callbacks (fetchEquities, fetchFX, fetchCommodities, fetchNews, fetchCredit) to DataResult status narrowing
- Migrated all 4 complex multi-source callbacks (fetchRates, fetchYields, fetchInflation, fetchCalendar) with full partial success support
- Updated CLAUDE.md both Error Handling sections to document DataResult as the service-boundary standard, replacing the old mock-fallback and e instanceof Error patterns

## Task Commits

1. **Task 1: Adapt simple 1:1 fetch callbacks to unwrap DataResult** - `0130629` (feat)
2. **Task 2: Adapt complex multi-source fetch callbacks and update CLAUDE.md** - `7575cda` (feat)

## Files Created/Modified

- `src/hooks/useMarketData.ts` - All 9 fetch callbacks unwrap DataResult; warnedStatus helper added; ResultWarning imported; fetchCalendar switched from Promise.allSettled to Promise.all
- `CLAUDE.md` - Both Error Handling sections updated: Conventions section documents DataResult and toUserMessage(); Architecture section documents service boundary pattern, Zod validation, rate limiter

## Decisions Made

- Infrastructure safety-net try/catch blocks retained in all callbacks — they catch unexpected non-DataResult errors (e.g., WebSocket crash, unexpected runtime failures) not service errors
- `warnedStatus` stores warning text in `WidgetStatus.error` field with `state: 'loaded'` — Phase 5 (UI-02) will add amber badge treatment for partial success
- `fetchCalendar` switched from `Promise.allSettled` to `Promise.all` since both services return DataResult rather than throwing — the DataResult discriminated union replaces the allSettled fulfilled/rejected pattern
- `fetchRates` aggregates warnings from both per-source DataResult errors and within-source warnings (e.g., FRED partial yields from getFredTreasuryYields), giving a complete warning picture

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree was at an old commit before rebasing onto main — resolved by running `git rebase main` before starting (same issue as Plan 02, same solution)
- Pre-existing lint errors exist in component files (FedWatchWidget.tsx, DashboardContext.tsx) and in finnhubService.ts (unused `e` parameter in catch at line 214, introduced by Plan 02) — these are out of scope for this plan. Deferred to deferred-items tracking.

## Known Stubs

None — all DataResult unwrapping is complete. The `vixFallback = fb[4]` in getTwelveEquities is pre-existing behavior (VIX comes from FRED via fetchRates, not TwelveData equities batch) and is tracked separately.

## Next Phase Readiness

- Full data layer hardening chain is complete: types → services → hook → docs
- Phase 02 is done: app builds cleanly, all panels use DataResult error propagation
- Phase 03 (WebSocket reconnection) or Phase 04 (hook decomposition) can proceed
- Phase 5 (UI-02) should add distinct amber visual treatment for warnedStatus to distinguish partial success from full success

---
*Phase: 02-data-layer-hardening*
*Completed: 2026-04-12*
