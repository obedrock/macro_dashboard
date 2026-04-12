---
phase: 04-architecture-decomposition
plan: 01
subsystem: hooks
tags: [decomposition, hooks, domain-hooks, statusUtils, typescript]
dependency_graph:
  requires: []
  provides:
    - src/hooks/statusUtils.ts
    - src/hooks/useEquities.ts
    - src/hooks/useFX.ts
    - src/hooks/useCommodities.ts
    - src/hooks/useCredit.ts
    - src/hooks/useNews.ts
    - src/hooks/useRates.ts
    - src/hooks/useYields.ts
    - src/hooks/useInflation.ts
    - src/hooks/useCalendar.ts
  affects:
    - src/types/index.ts
tech_stack:
  added: []
  patterns:
    - Domain hook pattern: useState + useCallback([]) + useEffect polling per hook
    - Shared status factories via statusUtils.ts
    - Split timer refs for calendar scheduling (no unsafe type cast)
key_files:
  created:
    - src/hooks/statusUtils.ts
    - src/hooks/useEquities.ts
    - src/hooks/useFX.ts
    - src/hooks/useCommodities.ts
    - src/hooks/useCredit.ts
    - src/hooks/useNews.ts
    - src/hooks/useRates.ts
    - src/hooks/useYields.ts
    - src/hooks/useInflation.ts
    - src/hooks/useCalendar.ts
  modified:
    - src/types/index.ts
decisions:
  - "useRates exposes y10Val and vix as separate state fields for cross-domain merging in Plan 02 context"
  - "ResultWarning type added to types/index.ts since statusUtils.ts requires it and it belongs in the shared types module"
  - "useCalendar performs initial fetch() on mount plus schedules the smart timer — matches existing behavior in useMarketData"
metrics:
  duration: 142s
  completed: 2026-04-11
  tasks_completed: 2
  files_changed: 11
---

# Phase 04 Plan 01: Domain Hook Extraction Summary

10 new files created in `src/hooks/` — shared status utilities plus 9 domain-specific hooks — extracted from the monolithic `useMarketData.ts` (354 lines). The monolith is untouched and continues to serve the app until Plan 02 switches wiring to the new context.

## Tasks Completed

### Task 1: statusUtils.ts and 5 simple domain hooks

Created `src/hooks/statusUtils.ts` with 4 status factories (`loadingStatus`, `loadedStatus`, `errorStatus`, `warnedStatus`) consumed by all domain hooks.

Created 5 simple domain hooks following identical pattern:
- `useEquities.ts` — polls TwelveData at 60s
- `useFX.ts` — polls TwelveData at 60s
- `useCommodities.ts` — polls TwelveData at 60s
- `useCredit.ts` — polls FRED at 24h
- `useNews.ts` — polls Finnhub at 5min

Each hook: named exports only, `useCallback([])` for stable fetch ref, own `useEffect` with `setInterval` cleanup.

**Commit:** `678c07b`

### Task 2: 4 complex domain hooks

Created 4 hooks with non-trivial logic:

- **`useRates.ts`**: Combines TwelveData + FRED (5 parallel calls), computes y2/y5/y10/y20/y30 values with fallback chain, 2s10s/2s30s spreads. Exposes `y10Val: number | null` and `vix: number | null` as extra state fields for the composing context (no ribbon/equities mutation per D-05).
- **`useYields.ts`**: Fetches FRED yield curve then overlays with historical date data.
- **`useInflation.ts`**: Preserves `lastInflationDate = useRef<string>('')` and `forceRefresh` pattern per D-12. Initial mount calls `fetch(true)`, interval calls `fetch(false)`.
- **`useCalendar.ts`**: Split timer refs per D-11 — `calendarTimeoutRef` and `calendarIntervalRef` as separate `useRef` declarations, eliminating the unsafe `as ReturnType<typeof setTimeout>` type cast. Contains extracted `msUntilNextCalendarRefresh()` function.

**Commit:** `e067a6d`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Type] Added ResultWarning to types/index.ts**
- **Found during:** Task 1
- **Issue:** `statusUtils.ts` imports `ResultWarning` from `../types` but the type did not exist in `src/types/index.ts`
- **Fix:** Added `export interface ResultWarning { field: string; message: string; }` to `src/types/index.ts` before the existing `WidgetLoadState` type, following CLAUDE.md convention (domain types are named exports from `src/types/index.ts`)
- **Files modified:** `src/types/index.ts`
- **Commit:** `678c07b`

## Known Stubs

None. All hooks wire directly to real service functions with `mockMarketData` as initial state only (not as silent fallback for live data — that's handled at the service layer).

## Verification Results

- `npx tsc --noEmit`: exits 0, no errors
- `npx vite build`: exits 0, built in 6.87s (app still builds, monolith untouched)
- All 10 new files exist in `src/hooks/`
- No file in `src/hooks/` uses `export default`
- `useMarketData.ts` unchanged at 354 lines
- `useRates.ts` contains no `ribbonBase`, `ribbon[1]`, or `ribbon[5]` references
- `useCalendar.ts` contains no `as ReturnType<typeof setTimeout>` cast

## Self-Check: PASSED

Files verified:
- src/hooks/statusUtils.ts — FOUND
- src/hooks/useEquities.ts — FOUND
- src/hooks/useFX.ts — FOUND
- src/hooks/useCommodities.ts — FOUND
- src/hooks/useCredit.ts — FOUND
- src/hooks/useNews.ts — FOUND
- src/hooks/useRates.ts — FOUND
- src/hooks/useYields.ts — FOUND
- src/hooks/useInflation.ts — FOUND
- src/hooks/useCalendar.ts — FOUND

Commits verified:
- 678c07b — feat(04-01): create statusUtils and 5 simple domain hooks
- e067a6d — feat(04-01): create 4 complex domain hooks
