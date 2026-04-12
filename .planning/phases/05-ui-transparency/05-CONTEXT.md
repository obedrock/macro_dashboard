# Phase 5: UI Transparency - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface data freshness, fallback badges, WebSocket status, and market hours context to users so they can always tell whether data is live, stale, loading, or errored. Scope is strictly UI-01 through UI-05 — no new data sources, no service layer changes, no new panels.

</domain>

<decisions>
## Implementation Decisions

### Freshness Timestamps (UI-01, UI-05)
- **D-01:** Per-widget "Updated X min ago" displayed in the `headerRight` slot of `Widget.tsx`. Each domain hook adds a `lastFetched: number` (epoch ms) to its return value; `MarketDataContext` composes these into a per-widget timestamps map.
- **D-02:** Relative time with color aging: fresh (<1 min) slate "Just now", aging (1-5 min) slate "Updated Xm ago", stale (>5 min) amber "Updated Xm ago", very stale (>30 min) red "Cached Xm ago". The very-stale threshold merges UI-05's degraded cache label naturally — no separate "Cached X min ago" widget needed.
- **D-03:** Timestamps auto-update via a lightweight interval (e.g., every 30s) so "Updated 2m ago" advances without re-fetching data.

### Fallback/Cache Badge (UI-02)
- **D-04:** Use the existing `badge` prop on `Widget.tsx` to show a colored pill when data is not live. Live data shows no badge (clean default). Cache: amber pill "Cached". Partial: amber pill "Partial". Fallback: red pill "Fallback".
- **D-05:** Each domain hook already returns `DataResult.source`. Add a `source: DataSource` to each hook's return value. `MarketDataContext` composes these into a `WidgetSources` map (keyed by widget ID) alongside the existing `WidgetStatuses`.

### WebSocket Indicator Enhancement (UI-03)
- **D-06:** The existing WS indicator in `SummaryRibbon.tsx` (colored dot + label) already covers the basic requirement. Enhance with: (a) show reconnect attempt count during reconnecting state ("WS... 3/10"), (b) make the indicator clickable when in "failed" state to trigger `wsManager.reconnect()`.
- **D-07:** `wsManager` already exposes `reconnect()` and tracks attempt count internally. Surface attempt count via a new getter or include it in the status callback payload.

### Market Hours Context (UI-04)
- **D-08:** Scope to US equity market hours only (NYSE/NASDAQ: 9:30 AM - 4:00 PM ET, Monday-Friday). FX markets (24h) and commodities (complex exchange hours) are out of scope for v1.
- **D-09:** Create an `isMarketOpen()` utility using `Intl.DateTimeFormat` with `America/New_York` timezone (same pattern as Phase 1 DST fix). No external API needed — pure client-side check.
- **D-10:** Display "Market closed" as the `subtitle` prop on the Equities panel when outside trading hours. Consider also showing on the summary ribbon if equities data is stale.

### Claude's Discretion
- Exact color values and Tailwind classes for timestamp aging thresholds
- Whether `lastFetched` lives as a separate field or extends the existing `WidgetStatus` interface
- Whether the auto-updating interval for timestamps is a single shared timer or per-widget
- Whether market hours check includes US holidays (simple weekday-only check is acceptable for v1)
- Internal naming of the `WidgetSources` map type and its integration into the context shape
- Whether the WS attempt count is exposed via a new method or by extending the existing `onStatusChange` callback payload

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UI-01 through UI-05 definitions and acceptance criteria

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Service layer and hook data flow, key abstractions
- `.planning/codebase/CONVENTIONS.md` — Naming, module design, Tailwind patterns
- `.planning/codebase/STRUCTURE.md` — File layout and component organization

### Prior Phase Context
- `.planning/phases/02-data-layer-hardening/02-CONTEXT.md` — DataResult<T> with source metadata, partial success handling
- `.planning/phases/03-websocket-reliability/03-CONTEXT.md` — WsStatus type, wsManager singleton, reconnect() method
- `.planning/phases/04-architecture-decomposition/04-CONTEXT.md` — Domain hooks pattern, MarketDataContext composition, Widget.tsx slots

### Source Files (primary targets)
- `src/components/shared/Widget.tsx` — Card shell with `badge`, `headerRight`, `subtitle` props (UI-01, UI-02 attachment points)
- `src/components/layout/SummaryRibbon.tsx` — Existing WS indicator to enhance (UI-03)
- `src/context/MarketDataContext.tsx` — Context that composes domain hooks; add sources/timestamps here
- `src/types/index.ts` — DataSource, WidgetStatus, WsStatus types
- `src/services/wsManager.ts` — WebSocket manager with reconnect() and attempt tracking
- `src/hooks/statusUtils.ts` — Status utility functions (loadingStatus, loadedStatus, etc.)
- `src/components/widgets/EquitiesPanel.tsx` — Primary target for market hours label (UI-04)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Widget.tsx` `badge` prop: React node slot — ready for fallback/cache badge pills
- `Widget.tsx` `headerRight` prop: React node slot — ready for freshness timestamps
- `Widget.tsx` `subtitle` prop: string — ready for "Market closed" label
- `SummaryRibbon.tsx` WS indicator: already shows colored dot + label for all 4 WsStatus states
- `DataResult.source` field: already carries `'live' | 'cache' | 'partial' | 'fallback'` from Phase 2
- `Intl.DateTimeFormat` with `America/New_York`: already used in calendar scheduling (Phase 1)

### Established Patterns
- Domain hooks return `{ data, status, fetch, retry }` — extend with `lastFetched` and `source`
- `MarketDataContext` composes hooks into unified shape — add sources/timestamps maps
- Tailwind color scheme: `emerald-400` positive, `red-400` negative, `amber-400` warning, `slate-*` neutral
- `font-mono tabular-nums` on all numeric values

### Integration Points
- Each domain hook's return value → MarketDataContext composition → Widget props
- `Widget.tsx` receives `badge`, `headerRight`, `subtitle` → `DashboardGrid.tsx` passes them per-widget
- `SummaryRibbon.tsx` receives `wsStatus` prop → already wired from MarketDataContext
- `wsManager.reconnect()` method → wire to clickable WS indicator in ribbon

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **TTL countdown ring visual** — tracked as REL-01 in v2 requirements
- **WebSocket tick lag indicator** — tracked as REL-02 in v2 requirements
- **Per-panel data confidence score (green/amber/red dot)** — tracked as REL-03 in v2 requirements
- **Rate limit quota indicator** — tracked as REL-04 in v2 requirements
- **Automatic retry with "Retrying in Xs" label** — tracked as REL-05 in v2 requirements
- **FX/commodity exchange hours** — complex multi-exchange schedules, defer to v2 if needed

</deferred>

---

*Phase: 05-ui-transparency*
*Context gathered: 2026-04-12*
