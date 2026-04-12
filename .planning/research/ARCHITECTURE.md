# Architecture Patterns: Data Layer Reliability

**Project:** MacroPulse — React macro dashboard
**Researched:** 2026-04-08
**Scope:** Refactoring the data layer of an existing, functional dashboard for reliability

---

## Recommended Architecture

The target architecture decomposes the current monolithic `useMarketData` hook into four distinct layers:
WebSocket Manager → Provider Services → Domain Hooks → Context/Consumers.

Each layer has a single concern, a clear boundary, and a defined direction of data flow. Nothing flows backward.

```
┌─────────────────────────────────────────────────────┐
│                   Browser / UI                      │
│   Widget Components  ←  DashboardGrid  ←  App.tsx  │
└──────────────────────┬──────────────────────────────┘
                       │ reads from
┌──────────────────────▼──────────────────────────────┐
│              MarketDataContext (Provider)            │
│   Assembles { data, statuses, refresh, retry }      │
│   from domain hooks; exposes single API surface     │
└──────────────────────┬──────────────────────────────┘
                       │ composed of
┌──────────────────────▼──────────────────────────────┐
│              Domain Hooks (one per data group)       │
│   useEquitiesData  useRatesData  useYieldsData       │
│   useFXData  useCommoditiesData  useCreditData       │
│   useInflationData  useNewsData  useCalendarData     │
│                                                     │
│   Each hook owns:                                   │
│     • fetch + poll scheduling for its domain        │
│     • WidgetStatus state machine (idle→loading      │
│       →loaded / error)                              │
│     • retry function exposed upward                 │
│     • data slice (typed subset of MarketData)       │
└──────────────────────┬──────────────────────────────┘
                       │ calls
┌──────────────────────▼──────────────────────────────┐
│              Provider Services (existing, hardened) │
│   twelveDataService  fredService  finnhubService    │
│                                                     │
│   Each service:                                     │
│     • never falls back to mock data silently         │
│     • throws on failure (lets hook decide fallback) │
│     • validates response shape before returning     │
│     • uses shared DataCache singleton               │
└──────────────────────┬──────────────────────────────┘
                       │ uses
┌──────────────────────▼──────────────────────────────┐
│              Infrastructure (cross-cutting)          │
│   DataCache (TTL, LRU cap)                          │
│   WebSocketManager (exponential backoff, state)     │
│   RetryOrchestrator (per-domain backoff policy)     │
│   ErrorBoundary (React, per widget)                 │
└─────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### 1. WebSocketManager (`src/services/websocketManager.ts`)

**Responsibility:** Own the entire WebSocket lifecycle: connect, authenticate, subscribe, receive ticks, reconnect with exponential backoff, and publish a connection-state signal.

**Communicates with:** `useTwelveDataTicks` hook (one-to-one); no other consumers.

**State it owns:**
- Connection state: `disconnected | connecting | connected | reconnecting | failed`
- Retry count and current backoff delay
- Subscriber callbacks (internal `Set<WsCallback>`)

**What it does NOT own:** Price accumulation, ribbon construction, React state.

**Key boundary:** The current `lastPrices` and `prevPrices` module-level exports in `twelveDataService.ts` must move inside this manager and become private. External code receives price ticks only through the subscription callback. This closes the mutable-global-state fragility identified in CONCERNS.md.

**Backoff policy:** Start at 2s, double on each failure, cap at 5 minutes. Stop auto-retrying after 10 attempts and emit `failed` state. Callers can trigger a manual reconnect to reset the counter.

---

### 2. Provider Services (`src/services/*.ts`) — hardened

**Responsibility:** Fetch and normalize data for one external provider. Apply cache. Return typed domain objects or throw — never silently return mock data.

**Communicates with:** Domain hooks (callers); `DataCache` singleton.

**Key change from current behavior:** Services currently catch errors internally and return `mockMarketData` values. This hides failures from callers and makes the `WidgetStatus` error path unreachable. Services must throw on failure. Mock data decisions belong to domain hooks, not services.

**Validation pattern:** Each service adds a lightweight guard after `res.json()`:

```typescript
// Before: unsafe cast
return res.json() as Promise<TdBatchQuote>;

// After: validated
const raw = await res.json();
if (!isTdBatchQuote(raw)) throw new Error('TwelveData: unexpected response shape');
return raw;
```

Type guards already exist selectively in `twelveDataService.ts` (`isTdQuote`). Extend this pattern to all service return points.

**`massiveService.ts`:** Delete. Drop `@massive.com/client-js` and `@supabase/supabase-js` from `package.json` and the Vite alias.

---

### 3. DataCache (`src/services/cache.ts`) — hardened

**Responsibility:** In-memory TTL store with bounded size. Prevent duplicate API calls within TTL windows across re-renders and intervals.

**Communicates with:** Services (only); no direct access from hooks or components.

**Key change:** Add a max-entry cap (500 entries) with passive LRU eviction. On `set()`, if the store is at capacity, evict the entry with the oldest `expiresAt`. Remove the unused `TTL.MASSIVE` constant.

---

### 4. Domain Hooks (`src/hooks/use*Data.ts`) — new

**Responsibility:** One hook per data group. Own:
- The fetch function for its domain
- Poll scheduling with the correct interval constant
- `WidgetStatus` state machine transitions
- The retry function
- The typed data slice returned to the context

**Communicates with:** MarketDataContext (exposes data + status + retry); Provider Services (calls fetch functions).

**State machine per hook:**

```
idle ──fetch()──► loading ──success──► loaded
                     │                   │
                     └──error──► error ◄─┘
                                   │
                             retryWidget()
                                   │
                               loading
```

This state machine replaces the current ad-hoc `setStatus('equities', loadingStatus)` calls scattered inline in callback bodies. Each hook manages its own status without touching other hooks' state.

**Decomposition from `useMarketData`:**

| Current callback in `useMarketData` | New hook | Provider |
|--------------------------------------|----------|----------|
| `fetchEquities` | `useEquitiesData` | TwelveData |
| `fetchFX` | `useFXData` | TwelveData |
| `fetchCommodities` | `useCommoditiesData` | TwelveData |
| `fetchRates` | `useRatesData` | TwelveData + FRED |
| `fetchYields` | `useYieldsData` | FRED |
| `fetchCredit` | `useCreditData` | FRED |
| `fetchInflation` | `useInflationData` | FRED |
| `fetchNews` | `useNewsData` | Finnhub |
| `fetchCalendar` | `useCalendarData` | Finnhub |
| WebSocket ribbon | `useRibbonData` | WebSocketManager |

Each hook is independently testable. Polling intervals remain constants in their respective hooks, not a shared module-level block.

**`useCalendarData` note:** The current `calendarTimer` pattern (a `setTimeout` that reassigns to `setInterval` mid-lifecycle) must be replaced with two separate `useRef` values — one for the initial delay, one for the recurring interval. The ET offset bug (`-5` fixed) must be corrected using `toLocaleString('en-US', { timeZone: 'America/New_York' })`.

**`useRatesData` note:** The current hook performs cross-domain state writes — it updates `data.equities` (VIX) and `data.ribbon` as side effects. In the decomposed model, `useRatesData` returns raw rate values. VIX and ribbon receive their own hooks. If shared derived state is needed (VIX feeds both rates and equities panels), surface it through the context assembly layer.

---

### 5. MarketDataContext (`src/context/MarketDataContext.tsx`) — new

**Responsibility:** Compose all domain hooks into the single API surface that `App.tsx` and components currently receive from `useMarketData`. This is the only place that assembles the full `MarketData` object and `WidgetStatuses` map.

**Communicates with:** All domain hooks (consumes); `App.tsx` and `DashboardGrid` (provides).

**Why a Context, not a hook:** `useMarketData` is currently called once in `App.tsx` and prop-drilled. Moving to Context lets widget components reach their own status and data directly, removing the 4-level prop-drilling chain. Widgets that don't need equities data don't receive equities data.

**Shape of provided value:**

```typescript
interface MarketDataContextValue {
  data: MarketData;
  statuses: WidgetStatuses;
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  lastUpdated: Date;
  refresh: () => void;
  retryWidget: (key: keyof WidgetStatuses) => void;
}
```

The `wsStatus` field is new — it is read from `WebSocketManager` and surfaced so the ribbon and summary can display a "live data unavailable" indicator when WebSocket is in `failed` state.

---

### 6. React Error Boundaries (`src/components/shared/`)

**Responsibility:** Catch render-time exceptions thrown by any widget component and display a contained error UI instead of crashing the full dashboard.

**Communicates with:** Individual widget components (wraps them); `DashboardGrid` (applies one boundary per widget slot).

**Pattern:** A class component `WidgetErrorBoundary` wraps each widget in `DashboardGrid`. On caught error it renders the same error UI as `Widget.tsx`'s `status.state === 'error'` path, maintaining visual consistency.

**Why class component:** React error boundaries require `componentDidCatch` and `getDerivedStateFromError`, which are only available as class lifecycle methods (as of React 18 / 2026).

---

## Data Flow

### REST Data Flow (polling)

```
setInterval tick (per domain hook)
  │
  ▼
Domain Hook calls service function
  │
  ▼
Service checks DataCache
  ├── HIT → return cached value immediately
  └── MISS → fetch() to external API
               ├── success → validate shape → cache → return typed value
               └── failure → throw Error
                              │
                        Domain Hook catch block
                          → setStatus(error) + retain previous data slice
```

The key change from current behavior: services throw on failure. Domain hooks catch and decide whether to retain stale data or show an error state. **Stale data is explicitly kept** — on error, the hook does `setStatus(error)` but does NOT replace `data` with mock values. Users see real (possibly stale) data plus an error indicator, not silently wrong data.

### WebSocket Data Flow

```
Browser WebSocket connection
  │
  ▼
WebSocketManager.onmessage
  → validates message shape
  → updates internal lastPrices / prevPrices (private)
  → calls subscriber callbacks with RibbonTickUpdate
  │
  ▼
useRibbonData callback
  → builds ribbon array from tick + existing REST data
  → setStatus('ribbon', loaded)
  → updates ribbon slice in context
```

WebSocket connection state changes (connect, reconnect, fail) flow separately to `wsStatus` in context, allowing UI components to show the connection indicator without polling.

### Manual Retry Flow

```
User clicks "Retry" in Widget.tsx
  │
  ▼
Widget calls retryWidget(key) from context
  │
  ▼
MarketDataContext.retryWidget delegates to domain hook's retry fn
  │
  ▼
Domain hook setStatus(loading) → re-fetch → success/error
```

---

## Patterns to Follow

### Pattern 1: Opaque Status State Machine per Hook

Each domain hook manages its own status independently. No hook reads or writes another hook's status. This prevents the current situation where `fetchRates` side-effects equities and ribbon statuses.

```typescript
// Inside useEquitiesData
const [status, setStatus] = useState<WidgetStatus>({ state: 'loading' });
const [data, setData] = useState<PriceItem[]>(mockMarketData.equities);

const fetch = useCallback(async () => {
  setStatus({ state: 'loading' });
  try {
    const result = await getTwelveEquities(); // throws on failure
    setData(result);
    setStatus({ state: 'loaded' });
  } catch (e) {
    // data is NOT reset — keep last known good value
    setStatus({ state: 'error', error: e instanceof Error ? e.message : 'Failed' });
  }
}, []);
```

### Pattern 2: Services Throw, Hooks Decide Fallback

The boundary between service and hook is: services are pure data-fetchers with no knowledge of React state or mock data. Hooks own the fallback decision.

```typescript
// Service — throws, no mock fallback
export async function getTwelveEquities(): Promise<PriceItem[]> {
  const data = await tdFetch<TdBatchQuote>('/quote?symbol=SPY,...');
  if (!isTdBatchQuote(data)) throw new Error('Unexpected shape');
  return normalizeEquities(data);
}

// Hook — decides what to show on failure
} catch (e) {
  // Keep current data (may be mock initial or last good fetch)
  setStatus({ state: 'error', error: ... });
}
```

### Pattern 3: WebSocket Exponential Backoff

Replace the fixed 5-second reconnect with a backoff sequence. The retry count is stored in a `useRef` inside `WebSocketManager` to survive reconnects without triggering re-renders.

```typescript
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRIES = 10;

function getBackoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
}
```

After `MAX_RETRIES`, set connection state to `failed`, stop auto-reconnecting, and expose a `reconnect()` function for manual trigger.

### Pattern 4: Explicit Mock Data Boundary

Mock data serves one purpose: providing the initial `useState` default so components never render with `undefined`. It must not be returned from service functions or injected mid-lifecycle.

```typescript
// Good: mock as initial state only
const [data, setData] = useState<PriceItem[]>(mockMarketData.equities);

// Bad: mock as error fallback (current behavior in services)
} catch {
  return mockMarketData.equities; // hides failure, looks like real data
}
```

### Pattern 5: Response Validation at Service Boundary

Every service function that calls a third-party API must validate the response shape before returning. This prevents `NaN` values from reaching the UI when APIs change their response format.

```typescript
function isTdBatchQuote(v: unknown): v is TdBatchQuote {
  return typeof v === 'object' && v !== null;
  // extend with field checks per provider contract
}
```

The existing `isTdQuote` guard in `twelveDataService.ts` is the right pattern; it needs to be extended to cover all response paths.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Silent Mock Substitution

**What it is:** Service catch blocks return `mockMarketData` values instead of throwing.

**Why it's harmful:** The `WidgetStatus` error path is never reached. Users see plausible-looking numbers that are actually fictional. Debuggers cannot distinguish a working API call from a silently-failed one.

**Instead:** Services throw. Hooks catch. The UI shows stale-but-real data plus an error badge.

---

### Anti-Pattern 2: Cross-Domain State Writes in a Single Hook

**What it is:** `fetchRates` in `useMarketData` writes to `data.equities` (VIX) and `data.ribbon` as side effects.

**Why it's harmful:** The equities and ribbon widgets now have invisible dependencies on the rates fetch completing successfully. If rates fail, VIX in the equities panel freezes at mock value, but the equities status shows `loaded`. No way to know.

**Instead:** VIX is fetched and owned by `useEquitiesData`. The rates hook returns yield values only. Derived cross-domain values (e.g., ribbon) are assembled in the context layer.

---

### Anti-Pattern 3: Module-Level Mutable Exports

**What it is:** `export const lastPrices` and `export const prevPrices` in `twelveDataService.ts`.

**Why it's harmful:** Any module can read or write these at any time with no coordination. Two rapid WebSocket ticks can interleave, making `prevPrices[sym]` stale before `buildRibbonFromWs` reads it.

**Instead:** Encapsulate price state inside `WebSocketManager`. Expose prices only through the tick callback. Remove the exports.

---

### Anti-Pattern 4: The Monolithic Orchestrator Hook

**What it is:** All fetch logic, all polling intervals, all WebSocket lifecycle, and all status management in one 350-line `useMarketData`.

**Why it's harmful:** Untestable in isolation. Any change risks side-effecting unrelated widgets. Growing the dashboard means the hook grows unboundedly.

**Instead:** One hook per domain, composed in the context layer. Each hook is testable independently.

---

## Build Order (Dependency Graph)

The refactor must not break any existing panel at any intermediate step. The build order follows a bottom-up approach: harden infrastructure first, then decompose upward.

```
Step 1 ──► Infrastructure (no React, no breaking changes)
           • Harden DataCache: add LRU cap, remove TTL.MASSIVE
           • Build WebSocketManager: replaces module-level WS code
             in twelveDataService.ts; keep subscribeWebSocket as thin
             adapter until migration is complete

Step 2 ──► Service Layer (harden existing, no new hooks yet)
           • Remove massiveService.ts, dead deps
           • Services throw instead of silently returning mock data
           • Add response shape validation (extend isTdQuote pattern)
           • Fix DXY: add to batch quote call
           • Fix Brent: fetch UKOIL or drop from commodities

Step 3 ──► Domain Hook Extraction (one hook at a time, low-risk first)
           • Start with leaf hooks that have no cross-domain side effects:
             useNewsData, useCreditData, useInflationData, useYieldsData
           • Then hooks with provider dependencies:
             useFXData, useCommoditiesData, useEquitiesData
           • Then the cross-domain hook: useRatesData (requires VIX
             extraction to useEquitiesData first)
           • Fix useCalendarData timer pattern (two refs, ET DST fix)
           • Last: useRibbonData (depends on WebSocketManager being stable)

Step 4 ──► MarketDataContext
           • Create MarketDataContext that composes all domain hooks
           • Replace prop-drilling: App.tsx uses Context Provider,
             components use useMarketData() context hook
           • Keep old useMarketData.ts shim during transition if needed

Step 5 ──► Error Boundaries
           • Add WidgetErrorBoundary class component
           • Apply one boundary per widget slot in DashboardGrid
           • Verify each panel can fail independently without crashing others

Step 6 ──► UI Transparency Layer
           • Surface wsStatus in ribbon and header
           • Add data freshness timestamps per widget
           • Ensure stale-data indicators are visible when status === error
             but data is present from last successful fetch
```

Each step is independently shippable. A working dashboard is maintained throughout.

---

## Scalability Considerations

| Concern | Current | After Refactor | At Scale |
|---------|---------|----------------|----------|
| Adding a new widget | Requires editing monolithic hook | Add one domain hook + wire in context | No change to other hooks |
| TwelveData rate limit (8 req/min free tier) | 5–9 REST calls per 60s cycle via separate fetches | Consolidate equities to one `fetchBatchQuotes` call; already done for FX | Extend batch pattern to rates |
| WebSocket drops | Fixed 5-second reconnect loop forever | Exponential backoff, max 10 retries, `failed` state surfaced | No change needed |
| Cache memory growth | Unbounded Map, grows forever | LRU cap at 500 entries | No change needed |
| Test isolation | Nothing is testable (monolith) | Each service and hook testable independently | Standard unit test per hook |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Decomposition approach | HIGH | Directly grounded in codebase analysis; patterns are industry-standard |
| State machine design | HIGH | The `loading/loaded/error` states already exist; formalizing transitions is additive |
| WebSocket backoff | HIGH | Well-documented pattern; `ws.onclose` + retry counter is straightforward |
| Context vs prop-drilling | HIGH | React Context for cross-cutting server state is standard; no external library needed |
| Error Boundaries | HIGH | React class component requirement is stable through React 19 |
| Response validation with Zod | MEDIUM | Zod would be the cleanest option; however the project has no validation dep. Lightweight hand-written type guards avoid adding a dependency and are sufficient for 3 well-known providers |

---

## Sources

- Codebase analysis: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`
- Live code review: `src/hooks/useMarketData.ts`, `src/services/twelveDataService.ts`, `src/services/cache.ts`, `src/types/index.ts`
- React Error Boundaries: stable React documentation pattern, class lifecycle `componentDidCatch` / `getDerivedStateFromError`
- WebSocket exponential backoff: standard practice; base 2 doubling with cap is the IETF-recommended approach (RFC 6455 commentary, widely implemented)
- State machine for async UI: XState documentation (though XState itself is not recommended here — the state space is small enough that plain `useState` with discriminated union matches the existing `WidgetStatus` type without adding a dependency)
