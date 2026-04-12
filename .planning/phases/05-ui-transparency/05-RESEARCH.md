# Phase 5: UI Transparency - Research

**Researched:** 2026-04-12
**Domain:** React UI patterns for data freshness, fallback badging, WebSocket status, and market hours detection
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Freshness Timestamps (UI-01, UI-05)**
- D-01: Per-widget "Updated X min ago" displayed in the `headerRight` slot of `Widget.tsx`. Each domain hook adds a `lastFetched: number` (epoch ms) to its return value; `MarketDataContext` composes these into a per-widget timestamps map.
- D-02: Relative time with color aging: fresh (<1 min) slate "Just now", aging (1-5 min) slate "Updated Xm ago", stale (>5 min) amber "Updated Xm ago", very stale (>30 min) red "Cached Xm ago". The very-stale threshold merges UI-05's degraded cache label naturally — no separate "Cached X min ago" widget needed.
- D-03: Timestamps auto-update via a lightweight interval (e.g., every 30s) so "Updated 2m ago" advances without re-fetching data.

**Fallback/Cache Badge (UI-02)**
- D-04: Use the existing `badge` prop on `Widget.tsx` to show a colored pill when data is not live. Live data shows no badge (clean default). Cache: amber pill "Cached". Partial: amber pill "Partial". Fallback: red pill "Fallback".
- D-05: Each domain hook already returns `DataResult.source`. Add a `source: DataSource` to each hook's return value. `MarketDataContext` composes these into a `WidgetSources` map (keyed by widget ID) alongside the existing `WidgetStatuses`.

**WebSocket Indicator Enhancement (UI-03)**
- D-06: The existing WS indicator in `SummaryRibbon.tsx` (colored dot + label) already covers the basic requirement. Enhance with: (a) show reconnect attempt count during reconnecting state ("WS... 3/10"), (b) make the indicator clickable when in "failed" state to trigger `wsManager.reconnect()`.
- D-07: `wsManager` already exposes `reconnect()` and tracks attempt count internally. Surface attempt count via a new getter or include it in the status callback payload.

**Market Hours Context (UI-04)**
- D-08: Scope to US equity market hours only (NYSE/NASDAQ: 9:30 AM - 4:00 PM ET, Monday-Friday). FX markets (24h) and commodities (complex exchange hours) are out of scope for v1.
- D-09: Create an `isMarketOpen()` utility using `Intl.DateTimeFormat` with `America/New_York` timezone (same pattern as Phase 1 DST fix). No external API needed — pure client-side check.
- D-10: Display "Market closed" as the `subtitle` prop on the Equities panel when outside trading hours. Consider also showing on the summary ribbon if equities data is stale.

### Claude's Discretion
- Exact color values and Tailwind classes for timestamp aging thresholds
- Whether `lastFetched` lives as a separate field or extends the existing `WidgetStatus` interface
- Whether the auto-updating interval for timestamps is a single shared timer or per-widget
- Whether market hours check includes US holidays (simple weekday-only check is acceptable for v1)
- Internal naming of the `WidgetSources` map type and its integration into the context shape
- Whether the WS attempt count is exposed via a new method or by extending the existing `onStatusChange` callback payload

### Deferred Ideas (OUT OF SCOPE)
- TTL countdown ring visual — tracked as REL-01 in v2 requirements
- WebSocket tick lag indicator — tracked as REL-02 in v2 requirements
- Per-panel data confidence score (green/amber/red dot) — tracked as REL-03 in v2 requirements
- Rate limit quota indicator — tracked as REL-04 in v2 requirements
- Automatic retry with "Retrying in Xs" label — tracked as REL-05 in v2 requirements
- FX/commodity exchange hours — complex multi-exchange schedules, defer to v2 if needed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Per-widget "Updated X min ago" freshness timestamps | `lastFetched: number` added to domain hook return values; composed into `WidgetTimestamps` map in context; rendered via `headerRight` slot on `Widget.tsx`; auto-advanced by a 30s shared interval |
| UI-02 | Fallback data badge — clearly marks when data is mock/cached vs live | `source: DataSource` added to domain hook return values; `WidgetSources` map composed in context; `badge` prop on `Widget.tsx` renders colored pill based on source value |
| UI-03 | WebSocket connection status indicator (connected/reconnecting/failed) in ribbon | Existing dot+label in `SummaryRibbon.tsx` enhanced with attempt count during reconnecting; "failed" state becomes clickable button calling `wsManager.reconnect()`; requires exposing attempt count from `wsManager` |
| UI-04 | Market hours context — "Market closed" label when outside trading hours | `isMarketOpen()` utility using `Intl.DateTimeFormat` + `America/New_York`; result passed as `subtitle` override on `EquitiesPanel`; weekday-only check acceptable for v1 |
| UI-05 | Degraded mode label when serving from cache ("Cached X min ago") | Merged into UI-01 via D-02: very stale (>30 min) threshold uses red "Cached Xm ago" label — no separate badge required |
</phase_requirements>

---

## Summary

Phase 5 is a pure UI surface layer. All data infrastructure (DataResult with source metadata, WsStatus state machine, domain hook decomposition, Widget.tsx prop slots) was built in Phases 2–4 specifically to enable this phase. The implementation work is limited to: adding two fields (`lastFetched`, `source`) to domain hook return values, composing two new maps (`WidgetTimestamps`, `WidgetSources`) in MarketDataContext, wiring those maps into DashboardGrid and widget props, building a small FreshnessLabel component and a DataSourceBadge component, creating an `isMarketOpen()` utility, and enhancing the existing WS indicator in SummaryRibbon.

No new services, no new API calls, no schema changes beyond `src/types/index.ts`, and no changes to `Widget.tsx`'s interface (the `badge`, `headerRight`, and `subtitle` props already exist). The scope is intentionally narrow: surface existing data quality signals to the user.

The highest-complexity task is the timestamp auto-update interval. A single shared 30s `setInterval` in MarketDataContext (calling `setNow(Date.now())`) is the simplest correct approach — it drives all FreshnessLabel instances without per-widget timers and avoids stale closure problems.

**Primary recommendation:** Follow the locked decisions exactly. Build in dependency order: types first, then hook extensions, then context composition, then UI components, then wire-up in DashboardGrid.

## Standard Stack

No new dependencies required. All implementation uses existing project stack.

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Component rendering, useState/useEffect for interval | Already project standard |
| TypeScript | 5.5.3 | Type safety for new map types | Already project standard |
| Tailwind CSS | 3.4.1 | Utility classes for freshness color aging | Already project standard |
| Lucide React | 0.344.0 | Icons for WS indicator (already imported in SummaryRibbon) | Already project standard |

**No `npm install` commands required for this phase.**

## Architecture Patterns

### Recommended Project Structure (Phase 5 additions only)

```
src/
├── hooks/
│   ├── useEquities.ts          # Add lastFetched: number, source: DataSource to return
│   ├── useFX.ts                # Add lastFetched: number, source: DataSource to return
│   ├── useCommodities.ts       # Add lastFetched: number, source: DataSource to return
│   ├── useRates.ts             # Add lastFetched: number, source: DataSource to return
│   ├── useYields.ts            # Add lastFetched: number, source: DataSource to return
│   ├── useCredit.ts            # Add lastFetched: number, source: DataSource to return
│   ├── useInflation.ts         # Add lastFetched: number, source: DataSource to return
│   ├── useNews.ts              # Add lastFetched: number, source: DataSource to return
│   └── useCalendar.ts          # Add lastFetched: number, source: DataSource to return
├── utils/
│   └── marketHours.ts          # NEW: isMarketOpen() utility
├── components/
│   └── shared/
│       ├── FreshnessLabel.tsx  # NEW: renders "Updated Xm ago" with color aging
│       └── DataSourceBadge.tsx # NEW: renders colored pill for cache/partial/fallback
├── context/
│   └── MarketDataContext.tsx   # Add WidgetTimestamps + WidgetSources maps, now: state
└── types/
    └── index.ts                # Add WidgetTimestamps, WidgetSources types
```

### Pattern 1: Domain Hook Extension (lastFetched + source)

**What:** Each domain hook tracks the epoch ms of its last successful fetch and the DataSource of the last result.
**When to use:** All 9 domain hooks need identical treatment.

```typescript
// Current return interface (useEquities.ts as example):
export interface EquitiesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

// Extended return interface:
export interface EquitiesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
  lastFetched: number;    // epoch ms, 0 = never fetched
  source: DataSource;     // 'live' | 'cache' | 'partial' | 'fallback'
}

// Inside the hook:
const [lastFetched, setLastFetched] = useState<number>(0);
const [source, setSource] = useState<DataSource>('fallback');

// On successful fetch, after setData:
setLastFetched(Date.now());
setSource(result.source);

// Return:
return { data, status, fetch, lastFetched, source };
```

**Note on ribbon:** The ribbon is WS-driven, not a domain hook. Its `lastFetched` is the timestamp of the last WS tick received. Expose it from MarketDataContext as `ribbonLastFetched: number` tracked in the WS tick handler.

### Pattern 2: MarketDataContext Composition

**What:** Context adds two new maps (`widgetTimestamps`, `widgetSources`) and a `now` clock state.
**When to use:** Single composition point — all consumers read from context.

```typescript
// New types in src/types/index.ts:
export type WidgetTimestamps = Record<keyof WidgetStatuses, number>;
export type WidgetSources = Record<keyof WidgetStatuses, DataSource>;

// In MarketDataContextType:
widgetTimestamps: WidgetTimestamps;
widgetSources: WidgetSources;

// In MarketDataProvider — single shared clock:
const [now, setNow] = useState<number>(Date.now());
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 30_000);
  return () => clearInterval(id);
}, []);

// Composition:
const widgetTimestamps: WidgetTimestamps = {
  ribbon: ribbonLastFetched,
  equities: equities.lastFetched,
  fx: fx.lastFetched,
  // ... etc
};

const widgetSources: WidgetSources = {
  ribbon: 'live',  // WS is always live when connected
  equities: equities.source,
  fx: fx.source,
  // ... etc
};
```

### Pattern 3: FreshnessLabel Component

**What:** Presentational component taking `lastFetched: number` and `now: number`, outputting colored relative time string.
**When to use:** Passed as `headerRight` node to `Widget.tsx`.

```typescript
// src/components/shared/FreshnessLabel.tsx
interface Props {
  lastFetched: number;  // epoch ms, 0 = never
  now: number;          // epoch ms current time
}

export default function FreshnessLabel({ lastFetched, now }: Props) {
  if (lastFetched === 0) return null;
  const ageMs = now - lastFetched;
  const ageMins = Math.floor(ageMs / 60_000);

  let label: string;
  let colorClass: string;

  if (ageMins < 1) {
    label = 'Just now';
    colorClass = 'text-slate-500';
  } else if (ageMins < 5) {
    label = `Updated ${ageMins}m ago`;
    colorClass = 'text-slate-500';
  } else if (ageMins < 30) {
    label = `Updated ${ageMins}m ago`;
    colorClass = 'text-amber-400';
  } else {
    label = `Cached ${ageMins}m ago`;
    colorClass = 'text-red-400';
  }

  return <span className={`text-xs font-mono tabular-nums ${colorClass}`}>{label}</span>;
}
```

**Key:** `now` is passed from context, not computed inside the component. This means the component re-renders when the 30s interval fires rather than managing its own timer.

### Pattern 4: DataSourceBadge Component

**What:** Renders a pill only when source is not 'live'. Live = no badge rendered (clean default per D-04).

```typescript
// src/components/shared/DataSourceBadge.tsx
import { DataSource } from '../../types';

interface Props {
  source: DataSource;
}

export default function DataSourceBadge({ source }: Props) {
  if (source === 'live') return null;

  const config: Record<Exclude<DataSource, 'live'>, { label: string; classes: string }> = {
    cache: { label: 'Cached', classes: 'bg-amber-400/10 text-amber-400 border-amber-500/20' },
    partial: { label: 'Partial', classes: 'bg-amber-400/10 text-amber-400 border-amber-500/20' },
    fallback: { label: 'Fallback', classes: 'bg-red-400/10 text-red-400 border-red-500/20' },
  };

  const { label, classes } = config[source];

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${classes}`}>
      {label}
    </span>
  );
}
```

### Pattern 5: isMarketOpen() Utility

**What:** Pure function, no external API. Uses `Intl.DateTimeFormat` with `America/New_York` — same pattern used in Phase 1 calendar scheduling fix.

```typescript
// src/utils/marketHours.ts
export function isMarketOpen(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(now).map(p => [p.type, p.value])
  );

  const day = parts['weekday'];           // 'Mon' | 'Tue' | ... | 'Sat' | 'Sun'
  const hour = parseInt(parts['hour']);   // 0–23
  const minute = parseInt(parts['minute']); // 0–59

  if (day === 'Sat' || day === 'Sun') return false;

  const openMinutes = 9 * 60 + 30;   // 9:30 AM
  const closeMinutes = 16 * 60;       // 4:00 PM
  const nowMinutes = hour * 60 + minute;

  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}
```

**Holiday exclusion:** Out of scope for v1 per D-08. Weekday-only check is sufficient.

### Pattern 6: WS Indicator Enhancement

**What:** Expose reconnect attempt count from `wsManager`, display "WS... 3/10" during reconnecting, make "failed" state clickable.

**How to expose attempt count:** Two options exist within Claude's Discretion:

Option A — New getter method on `WebSocketManager`:
```typescript
getAttempt(): number { return this.attempt; }
```
Called at render time. Simple but not reactive.

Option B — Extend `StatusCallback` payload. Currently `StatusCallback = (status: WsStatus) => void`. Change to carry attempt count:
```typescript
export type StatusPayload = { status: WsStatus; attempt: number };
export type StatusCallback = (payload: StatusPayload) => void;
```
Reactive but requires updating all `onStatusChange` callers.

**Recommendation:** Option A (new getter). The SummaryRibbon re-renders whenever `wsStatus` changes (via context), so calling `wsManager.getAttempt()` at render time is always current without needing callback signature changes. This is the simpler path.

```typescript
// SummaryRibbon.tsx — enhanced WS section
const wsLabel = wsStatus === 'connected' ? 'WS' :
  wsStatus === 'connecting' ? 'WS...' :
  wsStatus === 'reconnecting' ? `WS... ${wsManager.getAttempt()}/10` :
  'WS off';

// Only "failed" state is clickable:
const wsElement = wsStatus === 'failed' ? (
  <button onClick={() => wsManager.reconnect()} className="...">
    <span className="..." />
    <span className="text-xs text-red-400 hover:text-red-300">WS off</span>
  </button>
) : (
  <div className="...">
    <span className={`inline-flex rounded-full h-2 w-2 ${wsColorClass}`} />
    <span className="text-xs text-slate-500">{wsLabel}</span>
  </div>
);
```

### Pattern 7: DashboardGrid Wiring

**What:** DashboardGrid receives `widgetTimestamps`, `widgetSources`, and `now` as props (or reads from context). Each widget call gets its `badge` and `headerRight` populated.

**Preferred approach:** Pass from context via App.tsx through DashboardGrid props, following the existing prop-drilling pattern. This keeps DashboardGrid consistent with the established architecture.

```typescript
// DashboardGrid Props extension:
interface Props {
  // ...existing props...
  widgetTimestamps: WidgetTimestamps;
  widgetSources: WidgetSources;
  now: number;
}

// Per-widget in renderWidget():
const freshnessLabel = (
  <FreshnessLabel lastFetched={widgetTimestamps[widget.id as keyof WidgetTimestamps]} now={now} />
);
const sourceBadge = (
  <DataSourceBadge source={widgetSources[widget.id as keyof WidgetSources]} />
);

// Then pass to the widget:
<EquitiesPanel
  ...
  badge={sourceBadge}
  headerRight={freshnessLabel}
  subtitle={isMarketOpen() ? 'US Markets' : 'Market closed'}
/>
```

**Note:** `EquitiesPanel` currently has `headerRight` occupied by the D/W/M period selector. The D/W/M selector and FreshnessLabel need to coexist. EquitiesPanel already passes a custom `headerRight` to `Widget.tsx` — the freshness label must be composed alongside the D/W/M buttons, not replace them. The planner must account for this: either FreshnessLabel goes into the `badge` slot for equities, or EquitiesPanel renders a compound `headerRight` node containing both the D/W/M selector and FreshnessLabel.

### Anti-Patterns to Avoid

- **Per-widget setInterval for timestamp display:** Creates up to 10 concurrent timers. Use a single shared `now` state in MarketDataContext instead.
- **Computing relative time inside `Widget.tsx`:** Widget.tsx is a shared primitive and should not contain freshness logic. Keep FreshnessLabel as a separate component.
- **Setting `lastFetched = Date.now()` in the setStatus call:** `Date.now()` in state-setters may diverge from when data was actually received. Set `lastFetched` immediately after `setData()`, not inside error paths.
- **Setting `source` to 'live' as default state:** Default should be 'fallback' since initial state is always mock data. Only set to 'live'/'cache'/'partial' after a successful API response.
- **Calling `isMarketOpen()` in useEffect:** It is a pure synchronous function of the current time. Call it directly during render. No need to memoize it — it runs in microseconds.
- **Importing `wsManager` in DashboardGrid:** Keep wsManager access limited to MarketDataContext and SummaryRibbon. DashboardGrid works only with statuses/timestamps/sources.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative time formatting | Custom "2 hours ago" formatter | Simple `Math.floor(ageMs / 60_000)` with thresholds | For 3 thresholds, a bespoke function is simpler than importing a library; libraries like `date-fns/formatDistance` add bundle weight for functionality we don't need |
| Timezone-aware time check | Manual UTC offset calculations | `Intl.DateTimeFormat` with `America/New_York` | DST-safe, already proven in codebase (Phase 1), no library needed |
| WS status reactive state | Direct `wsManager.status` polling | `wsManager.onStatusChange(cb)` subscription | Already implemented and wired; polling would miss fast transitions |

**Key insight:** This phase requires no new infrastructure. Every problem has an already-built solution in the codebase. The work is strictly wiring existing outputs to existing UI slots.

## Common Pitfalls

### Pitfall 1: EquitiesPanel headerRight Collision

**What goes wrong:** `EquitiesPanel` already uses `headerRight` for the D/W/M period selector. If DashboardGrid passes a `headerRight` containing FreshnessLabel, it will silently override the period selector because Widget.tsx renders `{headerRight}` directly.

**Why it happens:** Widget.tsx has one `headerRight` slot. EquitiesPanel passes its own `headerRight` to `Widget.tsx` internally. DashboardGrid does not currently pass `headerRight` at all — it passes it to the widget component (EquitiesPanel), not to Widget.tsx directly. EquitiesPanel then ignores the prop if it doesn't accept it.

**How to avoid:** Either:
1. Have EquitiesPanel accept a `freshnessNode?: React.ReactNode` prop and compose it inside its own `headerRight`: `headerRight={<div className="flex items-center gap-2">{freshnessNode}{periodSelector}</div>}`
2. Or pass FreshnessLabel via the `badge` slot for EquitiesPanel only, since `badge` is currently unused there.

**Warning signs:** D/W/M period selector disappears from Equities widget after phase implementation.

### Pitfall 2: lastFetched remains 0 on error paths

**What goes wrong:** The hook sets `lastFetched` only on the success branch. If data was previously loaded and then a refetch errors, `lastFetched` correctly reflects the last successful fetch time — this is actually correct behavior. But if the initial fetch errors, `lastFetched` stays 0 and FreshnessLabel renders nothing (`if (lastFetched === 0) return null`), leaving the header empty for error states.

**Why it happens:** The 0 sentinel means "never fetched". An errored widget shows error UI via `WidgetStatus.state === 'error'` anyway, so no freshness label is appropriate.

**How to avoid:** This is correct behavior. Document it clearly in the FreshnessLabel component. Do not set `lastFetched` in error paths.

### Pitfall 3: WidgetTimestamps key coverage

**What goes wrong:** `WidgetTimestamps` is `Record<keyof WidgetStatuses, number>`. `WidgetStatuses` has 10 keys including `ribbon`. The ribbon's `lastFetched` comes from the WS tick handler in MarketDataContext, not from a domain hook. It's easy to accidentally leave `ribbon` as `0` forever.

**Why it happens:** The ribbon has no domain hook — its data is assembled directly in MarketDataContext from WS ticks and domain hook cross-references. `lastFetched` for the ribbon needs a separate `useRef` or `useState` inside MarketDataContext, updated on each WS tick.

**How to avoid:** Add `const [ribbonLastFetched, setRibbonLastFetched] = useState<number>(0)` in MarketDataContext. Call `setRibbonLastFetched(Date.now())` inside the WS tick handler (in the `subscribe` effect), same place where `setRibbonStatus(loadedStatus)` is called.

### Pitfall 4: WS reconnect() while already connecting

**What goes wrong:** Clicking the "WS off" button in `SummaryRibbon` calls `wsManager.reconnect()`. `reconnect()` resets `this.attempt = 0` and calls `connect()`. But `connect()` has a guard: if `ws.readyState === CONNECTING`, it returns early. If a reconnect attempt is already in-flight, the button click does nothing.

**Why it happens:** `reconnect()` sets `this.ws = null` before calling `connect()`, so the guard won't block it on `null`. This is correct — the explicit null-set before `connect()` means the guard passes. Verify by re-reading wsManager.ts lines 116-120: `this.ws = null` followed by `this.connect()`. Status will briefly be 'connecting' after click. This is correct behavior.

**How to avoid:** No code change needed. The existing `reconnect()` implementation handles this correctly. The button should only appear when `wsStatus === 'failed'` (not during 'reconnecting'), which prevents double-reconnect naturally.

### Pitfall 5: TypeScript noUnusedLocals with wsManager import

**What goes wrong:** If `wsManager` is imported in SummaryRibbon.tsx only to call `wsManager.getAttempt()` and `wsManager.reconnect()`, but those calls are conditional (`wsStatus === 'reconnecting'` / `wsStatus === 'failed'`), TypeScript's strict mode may not complain. But the `wsStatus` value is already passed as a prop — SummaryRibbon must also import `wsManager` for direct method calls, or the parent must pass the values.

**How to avoid:** The cleanest approach is importing `wsManager` directly in SummaryRibbon.tsx. The singleton is already module-level. This is consistent with how wsManager is already imported in MarketDataContext.tsx. Alternatively, pass `onWsReconnect: () => void` and `wsAttempt: number` as props from App.tsx, keeping SummaryRibbon free of direct singleton access.

**Recommendation:** Pass `onWsReconnect` and `wsAttempt` as props (add to `SummaryRibbon`'s `Props` interface). This keeps the component purely presentational and avoids a direct module coupling to `wsManager`.

## Code Examples

### Relative time thresholds (verified against D-02 decisions)

```typescript
// FreshnessLabel.tsx
if (ageMins < 1) {
  label = 'Just now';
  colorClass = 'text-slate-500';            // fresh: neutral slate
} else if (ageMins < 5) {
  label = `Updated ${ageMins}m ago`;
  colorClass = 'text-slate-500';            // aging: still neutral
} else if (ageMins < 30) {
  label = `Updated ${ageMins}m ago`;
  colorClass = 'text-amber-400';            // stale: amber warning
} else {
  label = `Cached ${ageMins}m ago`;         // very stale: UI-05 merged here
  colorClass = 'text-red-400';              // very stale: red error
}
```

### Intl.DateTimeFormat market hours (DST-safe, matches Phase 1 pattern)

```typescript
// Source: Phase 1 DST fix decision — same Intl.DateTimeFormat pattern
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});
const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
```

### Domain hook extension (useEquities.ts as template for all 9 hooks)

```typescript
// New state variables at top of hook function body:
const [lastFetched, setLastFetched] = useState<number>(0);
const [source, setSource] = useState<DataSource>('fallback');

// Inside the successful fetch branch, after setData():
setLastFetched(Date.now());
setSource(result.source);

// Updated return:
return { data, status, fetch, lastFetched, source };
```

### MarketDataContext now clock (single shared timer)

```typescript
// Single shared clock state in MarketDataProvider:
const [now, setNow] = useState<number>(Date.now());
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 30_000);
  return () => clearInterval(id);
}, []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useMarketData` monolithic hook | Domain hooks (`useEquities`, `useFX`, etc.) + `MarketDataContext` | Phase 4 | `lastFetched` and `source` can now be tracked per-domain without polluting a single giant hook |
| Raw API responses, no source metadata | `DataResult<T>` with `source: DataSource` | Phase 2 | `source` field is already populated on every successful service call — hooks just need to forward it |
| Flat 5s WS reconnect loop | `WebSocketManager` with exponential backoff, `attempt` counter, `reconnect()` method | Phase 3 | All the WS indicator enhancement infrastructure is already built |
| `Widget.tsx` without prop slots | `Widget.tsx` with `badge`, `headerRight`, `subtitle` props | Phase 4 | Zero Widget.tsx interface changes needed in Phase 5 |

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is purely code/config changes with no new external dependencies. No new API calls, no CLI tools, no databases.

## Validation Architecture

### Test Framework

No test framework is currently installed. `package.json` has no vitest, jest, or testing library. The project has `nyquist_validation: true` in config.json, meaning a test framework should be installed, but that is Phase 6's responsibility (TEST-01 through TEST-05). Phase 5 is a UI-only phase.

| Property | Value |
|----------|-------|
| Framework | None installed — Phase 6 installs Vitest (TEST-01) |
| Config file | None yet |
| Quick run command | `npm run typecheck` (TypeScript type check as proxy validation) |
| Full suite command | `npm run typecheck && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | FreshnessLabel renders correct text at each age threshold | unit | Not possible until Phase 6 sets up Vitest | N/A |
| UI-02 | DataSourceBadge renders null for 'live', pill for others | unit | Not possible until Phase 6 | N/A |
| UI-03 | WS indicator shows attempt count; failed state is clickable | manual visual | — | N/A |
| UI-04 | isMarketOpen() returns false on weekends and outside 9:30-16:00 ET | unit | `npm run typecheck` (type safety only pre-Phase 6) | N/A |
| UI-05 | Very stale threshold shows "Cached Xm ago" in red | unit | Not possible until Phase 6 | N/A |

### Sampling Rate

- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npm run lint`
- **Phase gate:** `npm run typecheck && npm run lint` green before `/gsd:verify-work`

### Wave 0 Gaps

Unit tests for UI components require Vitest + `@testing-library/react`, which are Phase 6 deliverables. Phase 5 validation relies on TypeScript compilation and manual visual inspection in the browser.

- [ ] `npm run typecheck` — verify no type errors after each hook extension
- [ ] `npm run lint` — verify no unused locals/params after context changes
- Manual browser check: widget headers show timestamps, badges appear for non-live data, WS indicator shows attempt count during reconnect

## Sources

### Primary (HIGH confidence)
- Direct source file analysis: `src/components/shared/Widget.tsx` — confirmed `badge`, `headerRight`, `subtitle` props exist and are React.ReactNode/string types
- Direct source file analysis: `src/services/wsManager.ts` — confirmed `reconnect()` is public, `attempt` is private (needs getter), `onStatusChange` callback exists
- Direct source file analysis: `src/context/MarketDataContext.tsx` — confirmed composition pattern, hook wiring, where to add `now`, `widgetTimestamps`, `widgetSources`
- Direct source file analysis: `src/types/index.ts` — confirmed `DataSource` union and `DataResult<T>` with `.source` field exist from Phase 2
- Direct source file analysis: `src/components/widgets/EquitiesPanel.tsx` — confirmed `headerRight` collision risk (D/W/M period selector occupies that slot)
- Direct source file analysis: `src/hooks/useEquities.ts` — confirmed current return interface shape to extend

### Secondary (MEDIUM confidence)
- Phase context decisions (05-CONTEXT.md) — all implementation decisions verified against actual source code above

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed and verified
- Architecture: HIGH — all target files read; slot availability confirmed; collision risk identified and documented
- Pitfalls: HIGH — all pitfalls derived from direct code inspection, not hypothetical

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable codebase, decisions locked)
