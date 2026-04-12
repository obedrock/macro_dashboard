---
phase: 04-architecture-decomposition
plan: 02
subsystem: context
tags: [decomposition, context, error-boundary, MarketDataContext, WidgetErrorBoundary]
dependency_graph:
  requires:
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
  provides:
    - src/context/MarketDataContext.tsx
    - src/components/shared/WidgetErrorBoundary.tsx
  affects:
    - src/hooks/useMarketData.ts
    - src/App.tsx
    - src/components/layout/DashboardGrid.tsx
    - src/hooks/useEquities.ts
    - src/hooks/useFX.ts
    - src/hooks/useCommodities.ts
    - src/hooks/useCredit.ts
    - src/hooks/useNews.ts
    - src/hooks/useRates.ts
    - src/hooks/useYields.ts
    - src/hooks/useInflation.ts
    - src/hooks/useCalendar.ts
    - src/types/index.ts
tech_stack:
  added: []
  patterns:
    - Context composition: MarketDataContext composes 9 domain hooks into single provider
    - Cross-domain merging via useEffect watching rates.y10Val and rates.vix
    - Ribbon WebSocket subscription in context (per D-03)
    - Class-based React error boundary with getDerivedStateFromError + mountKey retry
    - Thin re-export: hooks/useMarketData.ts is a single re-export line preserving import paths
key_files:
  created:
    - src/context/MarketDataContext.tsx
    - src/components/shared/WidgetErrorBoundary.tsx
  modified:
    - src/hooks/useMarketData.ts
    - src/App.tsx
    - src/components/layout/DashboardGrid.tsx
    - src/hooks/useEquities.ts
    - src/hooks/useFX.ts
    - src/hooks/useCommodities.ts
    - src/hooks/useCredit.ts
    - src/hooks/useNews.ts
    - src/hooks/useRates.ts
    - src/hooks/useYields.ts
    - src/hooks/useInflation.ts
    - src/hooks/useCalendar.ts
    - src/types/index.ts
decisions:
  - "Domain hooks fixed to handle DataResult<T> before wiring into context — Plan 01 hooks used pre-Phase-02 service API"
  - "Duplicate ResultWarning type removed from types/index.ts — was defined at line 93 and again at line 124"
  - "eslint-disable react-refresh/only-export-components added to MarketDataContext.tsx — file correctly exports both provider and hook per architectural design"
  - "fetch functions destructured from domain hook results before useCallback deps to satisfy exhaustive-deps rule"
metrics:
  duration: 480s
  completed: 2026-04-12
  tasks_completed: 2
  files_changed: 15
---

# Phase 04 Plan 02: Context Wiring and Error Boundaries Summary

MarketDataContext composing all 9 domain hooks into an identical useMarketData return shape — monolith replaced with a 1-line re-export, all widgets wrapped in WidgetErrorBoundary class components with getDerivedStateFromError retry isolation.

## Tasks Completed

### Task 1: Create MarketDataContext, replace useMarketData.ts, wire into App.tsx

Created `src/context/MarketDataContext.tsx` which:
- Calls all 9 domain hooks (useEquities, useFX, useCommodities, useRates, useYields, useCredit, useInflation, useNews, useCalendar)
- Manages ribbon WebSocket subscription via wsManager.subscribe + onStatusChange
- Merges cross-domain state: y10Val updates ribbon[1], vix updates ribbon[5] and equities[4] via separate useEffects watching rates.y10Val and rates.vix
- Assembles complete MarketData and WidgetStatuses from domain hook state
- Exposes identical { data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus } shape

Replaced `src/hooks/useMarketData.ts` with a single line: `export { useMarketData } from '../context/MarketDataContext'`

Added `<MarketDataProvider>` to App.tsx provider chain wrapping DashboardApp.

**Commit:** `9394bbc`

### Task 2: Create WidgetErrorBoundary and wrap widgets in DashboardGrid

Created `src/components/shared/WidgetErrorBoundary.tsx`:
- Class component with getDerivedStateFromError for React 18 error boundary
- mountKey state incremented on retry to re-mount children
- Fallback UI matches Widget.tsx error aesthetic: card chrome, AlertCircle at 20px amber-500, retry button with same styling
- widgetTitle prop for card header during error state

Updated DashboardGrid.tsx to wrap all 10 widget cases in `<WidgetErrorBoundary widgetTitle={widget.label}>`.

**Commit:** `ab7048b`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed domain hooks to use DataResult<T> from services**
- **Found during:** Task 1 — domain hooks from Plan 01 called service functions expecting raw data, but all services now return DataResult<T> after Phase 02
- **Issue:** useEquities, useFX, useCommodities, useCredit, useNews, useYields, useInflation, useCalendar, useRates all called services and used the return value as raw data instead of unwrapping DataResult
- **Fix:** Updated all 9 domain hooks to check result.status === 'error', use result.data on success, and propagate warnedStatus when result.warnings exist
- **Files modified:** src/hooks/useEquities.ts, useFX.ts, useCommodities.ts, useCredit.ts, useNews.ts, useYields.ts, useInflation.ts, useCalendar.ts, useRates.ts
- **Commit:** 9394bbc

**2. [Rule 1 - Bug] Removed duplicate ResultWarning type from types/index.ts**
- **Found during:** Task 1
- **Issue:** ResultWarning interface was declared twice — at line 93-96 and again at line 124-127. TypeScript accepted this silently but it would cause confusion.
- **Fix:** Removed the first declaration (before WidgetLoadState), kept the one after the Phase 2 comment block
- **Files modified:** src/types/index.ts
- **Commit:** 9394bbc

## Known Stubs

None. All context data flows from real service calls through domain hooks. mockMarketData is used only as initial useState value (not as silent fallback for live data).

## Self-Check: PASSED

Files verified:
- src/context/MarketDataContext.tsx — FOUND
- src/components/shared/WidgetErrorBoundary.tsx — FOUND
- src/hooks/useMarketData.ts — FOUND (1 line, thin re-export)

Commits verified:
- 9394bbc — feat(04-02): create MarketDataContext, fix domain hooks, thin re-export
- ab7048b — feat(04-02): add WidgetErrorBoundary and wrap all widgets in DashboardGrid
