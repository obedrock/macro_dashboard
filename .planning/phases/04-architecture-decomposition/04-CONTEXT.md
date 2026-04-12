# Phase 4: Architecture Decomposition - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose the monolithic `useMarketData` hook (444 lines, 10 fetch functions, 5 polling intervals) into composable domain-specific hooks, wrap widgets in per-widget error boundaries, and stabilize useEffect dependency arrays. Scope is strictly ARCH-01 through ARCH-04 — no UI changes, no new data sources, no service layer changes.

</domain>

<decisions>
## Implementation Decisions

### Hook Decomposition Strategy (ARCH-01)
- **D-01:** Split by data domain aligned with widget boundaries: `useEquities`, `useRates` (includes yields, VIX, TIPS from FRED + TwelveData), `useFX`, `useCommodities`, `useCredit`, `useInflation`, `useNews`, `useCalendar` (includes FOMC). Each hook owns its own fetch function, status state, and polling interval.
- **D-02:** `fetchRates` stays as a single hook (`useRates`) despite sourcing from both TwelveData and FRED — it serves one widget and the multi-provider composition is internal. Same for `useCalendar` which combines calendar + FOMC.
- **D-03:** The WebSocket ribbon subscription stays in the composing context (not a domain hook) since it reads from `wsManager` and updates `ribbonBase` which is a cross-cutting concern.

### Context Composition Pattern (ARCH-02)
- **D-04:** Single `MarketDataContext` that composes all domain hooks internally. The context provider calls each domain hook and assembles the unified `{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus }` shape. Widgets consume via `useMarketData()` hook that reads from context — zero widget API changes required.
- **D-05:** Cross-domain state updates (rates→ribbon 10Y value, rates→equities VIX) live in the composing context, not in individual domain hooks. Domain hooks return their raw domain data; the context merges into the MarketData shape.
- **D-06:** Each domain hook returns `{ data, status, fetch, retry }` (or similar). The composing context maps these into the existing `WidgetStatuses` keys and `MarketData` fields.

### Error Boundary Granularity (ARCH-03)
- **D-07:** One React error boundary per widget panel. `DashboardGrid.tsx` wraps each widget component in an `<ErrorBoundary>` that shows a fallback UI (error message + retry) when the wrapped widget throws during render.
- **D-08:** Error boundaries only catch render errors (React limitation). The existing per-widget `WidgetStatus.error` state continues to handle async/fetch errors. These are complementary, not overlapping.
- **D-09:** Create a reusable `WidgetErrorBoundary` component in `src/components/shared/`. It should display a card-shaped fallback matching the Widget shell aesthetic (same sizing, background, border) with an error icon and "Retry" button that re-mounts the widget.

### Dependency Array Stabilization (ARCH-04)
- **D-10:** Each domain hook uses `useCallback` with empty dependency arrays for its fetch function (matching current pattern). Polling intervals use the stable callback refs. The composing context's `useEffect` for initial fetch uses the stable callbacks.
- **D-11:** The `calendarTimer` setTimeout→setInterval pattern should be split into separate refs (one for timeout, one for interval) in the `useCalendar` hook to eliminate the unsafe type cast.
- **D-12:** The `ribbonBase` ref and `lastInflationDate` ref stay as `useRef` — they don't trigger re-renders and are stable by nature.

### Claude's Discretion
- Internal naming of domain hook return types
- File organization for domain hooks (one file per hook vs grouped by provider)
- Whether `MarketDataContext` is a new file or replaces the existing `useMarketData.ts`
- How `refresh()` aggregates domain hook refreshes (Promise.all of domain-level refresh methods)
- Whether error boundary uses `getDerivedStateFromError` or `componentDidCatch` for state reset
- Whether to keep utility functions (`msUntilNextCalendarRefresh`, `loadingStatus`, `errorStatus`, `warnedStatus`) in a shared file or duplicate per hook

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ARCH-01 through ARCH-04 definitions

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Service layer and hook data flow, key abstractions
- `.planning/codebase/CONCERNS.md` — calendarTimer type cast, ribbonBase mutation, known fragile areas
- `.planning/codebase/CONVENTIONS.md` — Module design patterns, naming conventions

### Prior Phase Context
- `.planning/phases/02-data-layer-hardening/02-CONTEXT.md` — DataResult<T> pattern, Promise.allSettled usage
- `.planning/phases/03-websocket-reliability/03-CONTEXT.md` — wsManager singleton, WsStatus callback pattern

### Source Files (primary targets)
- `src/hooks/useMarketData.ts` — The monolithic hook to decompose (444 lines)
- `src/App.tsx` — Current consumer of useMarketData, will switch to context
- `src/types/index.ts` — MarketData, WidgetStatuses, WidgetStatus types
- `src/components/layout/DashboardGrid.tsx` — Widget rendering, error boundary wrapping point
- `src/components/shared/Widget.tsx` — Existing card shell with error/retry UI
- `src/services/wsManager.ts` — WebSocket manager used for ribbon subscription

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/context/ThemeContext.tsx` — Context + Provider + hook pattern reference
- `src/context/DashboardContext.tsx` — Context + Provider + hook pattern reference
- `src/components/shared/Widget.tsx` — Error/retry UI for async errors; WidgetErrorBoundary should complement this
- Status utilities (`loadingStatus`, `loadedStatus`, `errorStatus`, `warnedStatus`) — extract to shared module

### Established Patterns
- Context providers at root in App.tsx: `ThemeProvider` → `DashboardProvider` → `DashboardApp`
- Hooks export named functions, not default exports
- `useCallback` with `[]` deps for stable fetch references
- `setData(prev => ({ ...prev, [key]: value }))` merge pattern for partial state updates
- `setStatus(key, status)` for per-widget status updates

### Integration Points
- `App.tsx` calls `useMarketData()` directly — must switch to `useContext(MarketDataContext)` while preserving the same destructured shape
- `DashboardGrid.tsx` receives `data`, `statuses`, `onRetry` as props — wrapping in error boundaries happens here
- `SummaryRibbon.tsx` receives `wsStatus` prop — no change needed
- `ExpandedModal.tsx` receives `data` prop — no change needed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **ribbonBase.current mutation inside setData updater** — acknowledged debt from Phase 3, may be naturally resolved when ribbon subscription moves to composing context
- **Fake period multipliers in EquitiesPanel** — deferred from Phase 1, not in scope
- **FedWatch mock probabilities** — tracked as EXP-01 in v2 requirements

</deferred>

---

*Phase: 04-architecture-decomposition*
*Context gathered: 2026-04-11*
