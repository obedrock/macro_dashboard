---
phase: 05-ui-transparency
plan: "02"
subsystem: ui
tags: [transparency, freshness, data-source, websocket, market-hours]
dependency_graph:
  requires: ["05-01"]
  provides: ["UI-01", "UI-02", "UI-03", "UI-04", "UI-05"]
  affects: ["src/App.tsx", "src/components/layout/DashboardGrid.tsx", "src/components/layout/SummaryRibbon.tsx", "src/components/widgets/EquitiesPanel.tsx", "src/components/widgets/YieldCurveChart.tsx"]
tech_stack:
  added: []
  patterns: ["badge/headerRight prop forwarding", "composed headerRight with freshnessNode", "isMarketOpen market hours check"]
key_files:
  created: []
  modified:
    - src/App.tsx
    - src/components/layout/DashboardGrid.tsx
    - src/components/layout/SummaryRibbon.tsx
    - src/components/widgets/EquitiesPanel.tsx
    - src/components/widgets/YieldCurveChart.tsx
    - src/components/widgets/RatesPanel.tsx
    - src/components/widgets/FXPanel.tsx
    - src/components/widgets/CommoditiesPanel.tsx
    - src/components/widgets/CreditPanel.tsx
    - src/components/widgets/InflationPanel.tsx
    - src/components/widgets/EconomicCalendar.tsx
    - src/components/widgets/FedWatchWidget.tsx
    - src/components/widgets/NewsWidget.tsx
decisions:
  - "EquitiesPanel/YieldCurveChart compose freshnessNode into their own headerRight to avoid displacing existing period/overlay selectors"
  - "DashboardGrid creates freshnessLabel and sourceBadge per widget using widgetTimestamps and widgetSources keyed by widget.id"
  - "App.tsx reads wsManager.getAttempt() at render time (not via state) — sufficient since wsStatus context change triggers re-render"
  - "SummaryRibbon renders clickable button only for failed state — other states show static indicator"
metrics:
  duration: 480
  completed_date: "2026-04-12"
  tasks_completed: 3
  files_modified: 13
---

# Phase 05 Plan 02: UI Transparency Wiring Summary

All 10 widget headers now display FreshnessLabel showing relative data age, non-live widgets show DataSourceBadge pills, SummaryRibbon WS indicator shows attempt count during reconnecting and is clickable when failed, and EquitiesPanel shows "Market closed" outside US equity trading hours.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add badge/headerRight props to 7 simple widget components | 7000423 |
| 2 | Wire transparency into App, DashboardGrid, SummaryRibbon, EquitiesPanel, YieldCurveChart | 4e74534 |
| 3 | Visual verification checkpoint (auto-approved) | — |

## What Was Built

**Task 1:** Added `badge?: React.ReactNode` and `headerRight?: React.ReactNode` to the Props interface and Widget forwarding in all 7 simple widget components: RatesPanel, FXPanel, CommoditiesPanel, CreditPanel, InflationPanel, EconomicCalendar, FedWatchWidget, NewsWidget.

**Task 2:** Five-file wiring pass:
- `App.tsx`: Destructures `widgetTimestamps`, `widgetSources`, `now` from `useMarketData()`. Imports `wsManager`. Passes new props to `DashboardGrid` and `SummaryRibbon` (including `onWsReconnect` and `wsAttempt`).
- `DashboardGrid.tsx`: Imports `FreshnessLabel`, `DataSourceBadge`, `WidgetTimestamps`, `WidgetSources`. Creates per-widget `freshnessLabel` and `sourceBadge` helpers. Passes `badge={sourceBadge}` and `headerRight={freshnessLabel}` to the 8 simple widgets; passes `badge={sourceBadge}` and `freshnessNode={freshnessLabel}` to EquitiesPanel and YieldCurveChart.
- `SummaryRibbon.tsx`: Extended Props with `onWsReconnect?` and `wsAttempt?`. WS indicator now shows `WS... N/10` during reconnecting and a clickable reconnect button when failed.
- `EquitiesPanel.tsx`: Imports `isMarketOpen`. Props extended with `badge`, `freshnessNode`, `now`. Subtitle dynamically shows `'US Markets'` or `'Market closed'`. `headerRight` now composes `freshnessNode` + D/W/M period selector in a flex container.
- `YieldCurveChart.tsx`: Props extended with `badge`, `freshnessNode`. `headerRight` now composes `freshnessNode` + Today/+1M/+1Y overlay selector in a flex container.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired from context through to widget headers.

## Self-Check: PASSED

- src/App.tsx: FOUND (modified)
- src/components/layout/DashboardGrid.tsx: FOUND (modified)
- src/components/layout/SummaryRibbon.tsx: FOUND (modified)
- src/components/widgets/EquitiesPanel.tsx: FOUND (modified)
- src/components/widgets/YieldCurveChart.tsx: FOUND (modified)
- Commit 7000423: FOUND
- Commit 4e74534: FOUND
- TypeScript: 0 errors
