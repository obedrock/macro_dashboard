---
phase: 05-ui-transparency
plan: 01
subsystem: ui
tags: [react, typescript, context, hooks, freshness, data-source]

# Dependency graph
requires:
  - phase: 04-architecture-decomposition
    provides: domain hooks (useEquities, useFX, useCommodities, useRates, useYields, useCredit, useInflation, useNews, useCalendar) and MarketDataContext
provides:
  - WidgetTimestamps and WidgetSources type aliases in src/types/index.ts
  - isMarketOpen() utility in src/utils/marketHours.ts
  - FreshnessLabel component with 4-state color aging
  - DataSourceBadge component with live/cache/partial/fallback rendering
  - All 9 domain hooks expose lastFetched and source fields
  - MarketDataContext exposes widgetTimestamps, widgetSources, and now clock
  - wsManager.getAttempt() public getter
affects: [05-02, plan-02-ui-wiring, widget components, SummaryRibbon]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Each domain hook maintains lastFetched (epoch ms) and source (DataSource) state initialized to 0/'fallback', updated in the fetch success path"
    - "MarketDataContext composes per-widget timestamp and source maps from hook return values"
    - "Shared 30s clock interval (setNow) drives FreshnessLabel freshness calculations"
    - "Multi-source hooks (useRates, useYields, useCalendar) derive source as 'partial' when warnings present, 'live' otherwise"

key-files:
  created:
    - src/utils/marketHours.ts
    - src/components/shared/FreshnessLabel.tsx
    - src/components/shared/DataSourceBadge.tsx
  modified:
    - src/types/index.ts
    - src/services/wsManager.ts
    - src/hooks/useEquities.ts
    - src/hooks/useFX.ts
    - src/hooks/useCommodities.ts
    - src/hooks/useRates.ts
    - src/hooks/useYields.ts
    - src/hooks/useCredit.ts
    - src/hooks/useInflation.ts
    - src/hooks/useNews.ts
    - src/hooks/useCalendar.ts
    - src/context/MarketDataContext.tsx

key-decisions:
  - "Multi-source hooks (useRates, useYields, useCalendar) derive DataSource as 'partial' when warnings present and 'live' otherwise — these hooks aggregate multiple services so there is no single result.source to use"
  - "useInflation early-return path (same dataThrough date) does NOT update lastFetched — skipping an update means data is not refreshed, so timestamp should reflect last actual update"
  - "ribbonLastFetched set inside wsManager subscribe tick callback, only on key symbol updates (SPY, CL1:COM, XAU/USD) to avoid excessive state churn"

patterns-established:
  - "Hook freshness pattern: add lastFetched/source state initialized to 0/'fallback', set in fetch success path after setData, before setStatus"
  - "Context composition pattern: widen MarketDataContextType with widgetTimestamps/widgetSources/now, compose maps from hook fields, pass in Provider value"

requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05]

# Metrics
duration: 15min
completed: 2026-04-12
---

# Phase 5 Plan 01: UI Transparency Plumbing Summary

**All data-freshness plumbing built: 9 domain hooks extended with lastFetched/source, FreshnessLabel and DataSourceBadge components created, MarketDataContext composes widgetTimestamps/widgetSources/now clock**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-12T08:15:00Z
- **Completed:** 2026-04-12T08:30:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Added `WidgetTimestamps` and `WidgetSources` type aliases to `src/types/index.ts`
- Created `isMarketOpen()` utility with DST-safe `America/New_York` timezone using `Intl.DateTimeFormat`
- Created `FreshnessLabel` component rendering 4 distinct aging states: "Just now" (slate), "Updated Xm ago" (slate <5m), "Updated Xm ago" (amber <30m), "Cached Xm ago" (red >=30m)
- Created `DataSourceBadge` component rendering nothing for `live`, amber pill for `cache`/`partial`, red pill for `fallback`
- Added `getAttempt(): number` public getter to `WebSocketManager` class
- Extended all 9 domain hooks with `lastFetched: number` and `source: DataSource` in their return interface
- Composed `widgetTimestamps`, `widgetSources`, and `now` (30s clock) into `MarketDataContext` value

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, utility, presentational components, and wsManager getter** - `073edd5` (feat)
2. **Task 2: Extend all 9 domain hooks with lastFetched/source and compose into MarketDataContext** - `83f1c3a` (feat)

## Files Created/Modified

- `src/types/index.ts` - Added `WidgetTimestamps` and `WidgetSources` type aliases
- `src/utils/marketHours.ts` - New: `isMarketOpen()` utility with ET timezone
- `src/components/shared/FreshnessLabel.tsx` - New: relative freshness display with color aging
- `src/components/shared/DataSourceBadge.tsx` - New: colored pill badge for non-live sources
- `src/services/wsManager.ts` - Added `getAttempt(): number` public getter
- `src/hooks/useEquities.ts` - Extended with `lastFetched`, `source`
- `src/hooks/useFX.ts` - Extended with `lastFetched`, `source`
- `src/hooks/useCommodities.ts` - Extended with `lastFetched`, `source`
- `src/hooks/useRates.ts` - Extended with `lastFetched`, `source` (multi-source: derives `partial` on warnings)
- `src/hooks/useYields.ts` - Extended with `lastFetched`, `source` (multi-source: derives `partial` on warnings)
- `src/hooks/useCredit.ts` - Extended with `lastFetched`, `source`
- `src/hooks/useInflation.ts` - Extended with `lastFetched`, `source` (skips lastFetched update on same-date early return)
- `src/hooks/useNews.ts` - Extended with `lastFetched`, `source`
- `src/hooks/useCalendar.ts` - Extended with `lastFetched`, `source` (multi-source: derives `partial` on warnings)
- `src/context/MarketDataContext.tsx` - Added `widgetTimestamps`, `widgetSources`, `now`, `ribbonLastFetched`

## Decisions Made

- Multi-source hooks (useRates, useYields, useCalendar) aggregate multiple services and have no single `result.source` — source is derived as `'partial'` when any warnings present and `'live'` otherwise
- `useInflation` early-return (same `dataThrough` date) intentionally skips `setLastFetched` since no actual data refresh occurred
- `ribbonLastFetched` only updates on key WS symbol ticks (SPY, CL1:COM, XAU/USD) to avoid excessive state updates on every price tick

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree was behind main branch (Phase 4 changes not present) — merged `main` into worktree branch before starting. No code conflicts.

## Known Stubs

None — all new components and hooks have functional implementations. FreshnessLabel and DataSourceBadge are purely presentational and will be wired into widgets in Plan 02.

## Next Phase Readiness

- All data plumbing complete. Plan 02 can wire `FreshnessLabel` and `DataSourceBadge` into widget headers using `widgetTimestamps[key]`, `widgetSources[key]`, and `now` from context.
- `isMarketOpen()` available for market hours display in UI.
- `wsManager.getAttempt()` available for reconnect counter display.

---
*Phase: 05-ui-transparency*
*Completed: 2026-04-12*
