# Phase 04: Architecture Decomposition - Research

**Researched:** 2026-04-11
**Domain:** React hook decomposition, React Context API, React Error Boundaries, useEffect dependency stabilization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Hook Decomposition Strategy (ARCH-01)
- **D-01:** Split by data domain aligned with widget boundaries: `useEquities`, `useRates` (includes yields, VIX, TIPS from FRED + TwelveData), `useFX`, `useCommodities`, `useCredit`, `useInflation`, `useNews`, `useCalendar` (includes FOMC). Each hook owns its own fetch function, status state, and polling interval.
- **D-02:** `fetchRates` stays as a single hook (`useRates`) despite sourcing from both TwelveData and FRED — it serves one widget and the multi-provider composition is internal. Same for `useCalendar` which combines calendar + FOMC.
- **D-03:** The WebSocket ribbon subscription stays in the composing context (not a domain hook) since it reads from `wsManager` and updates `ribbonBase` which is a cross-cutting concern.

#### Context Composition Pattern (ARCH-02)
- **D-04:** Single `MarketDataContext` that composes all domain hooks internally. The context provider calls each domain hook and assembles the unified `{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus }` shape. Widgets consume via `useMarketData()` hook that reads from context — zero widget API changes required.
- **D-05:** Cross-domain state updates (rates→ribbon 10Y value, rates→equities VIX) live in the composing context, not in individual domain hooks. Domain hooks return their raw domain data; the context merges into the MarketData shape.
- **D-06:** Each domain hook returns `{ data, status, fetch, retry }` (or similar). The composing context maps these into the existing `WidgetStatuses` keys and `MarketData` fields.

#### Error Boundary Granularity (ARCH-03)
- **D-07:** One React error boundary per widget panel. `DashboardGrid.tsx` wraps each widget component in an `<ErrorBoundary>` that shows a fallback UI (error message + retry) when the wrapped widget throws during render.
- **D-08:** Error boundaries only catch render errors (React limitation). The existing per-widget `WidgetStatus.error` state continues to handle async/fetch errors. These are complementary, not overlapping.
- **D-09:** Create a reusable `WidgetErrorBoundary` component in `src/components/shared/`. It should display a card-shaped fallback matching the Widget shell aesthetic (same sizing, background, border) with an error icon and "Retry" button that re-mounts the widget.

#### Dependency Array Stabilization (ARCH-04)
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

### Deferred Ideas (OUT OF SCOPE)
- **ribbonBase.current mutation inside setData updater** — acknowledged debt from Phase 3, may be naturally resolved when ribbon subscription moves to composing context
- **Fake period multipliers in EquitiesPanel** — deferred from Phase 1, not in scope
- **FedWatch mock probabilities** — tracked as EXP-01 in v2 requirements
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Decompose useMarketData into domain-specific hooks (one per data group) | Hook decomposition pattern, domain boundaries, stable useCallback pattern |
| ARCH-02 | MarketDataContext composes domain hooks — zero widget API changes required | React Context composition pattern, identical public interface shape |
| ARCH-03 | Error boundaries around each widget — render panics don't crash dashboard | React class-based error boundary pattern, WidgetErrorBoundary component design |
| ARCH-04 | useEffect dependency arrays stabilized to prevent interval re-registration | useCallback with empty deps, split timer refs for calendarTimer |
</phase_requirements>

---

## Summary

Phase 4 decomposes the monolithic `useMarketData.ts` (444 lines, 8 fetch functions, 5 polling intervals) into 8 domain-specific hooks, a composing `MarketDataContext`, and adds per-widget React error boundaries. The current hook structure already follows a clean pattern — each fetch uses `useCallback([])` returning stable references — which makes the decomposition straightforward: extract each `fetchX` callback plus its `setStatus` and `setData` calls into a dedicated hook file, then wire them through a context provider.

The highest-risk step is ARCH-02: the composing context must produce an identical `{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus }` shape to the current `useMarketData()` return, so `App.tsx` can switch from `useMarketData()` to `useContext(MarketDataContext)` with zero downstream widget changes. Cross-domain state bleed — specifically `fetchRates` writing back into `ribbon` and `equities.vix` — must remain in the composing context rather than domain hooks to avoid coupling.

ARCH-03 requires a class-based `WidgetErrorBoundary` component (React error boundaries cannot be function components as of React 18). The boundary should re-mount the child on retry, which requires a `key` increment pattern. ARCH-04 is the lowest-risk item: splitting the `calendarTimer` union into separate `timeoutRef` and `intervalRef` is a purely local change inside `useCalendar`.

**Primary recommendation:** Extract domain hooks one at a time from bottom-to-top dependency order (utilities first, then independent domains, then `useRates` which has cross-domain side effects), validate each compiles before wiring into the context, then switch `App.tsx` last.

---

## Project Constraints (from CLAUDE.md)

- Tech stack: React + TypeScript + Vite + Tailwind — no framework changes
- API sources: Twelve Data, FRED, Finnhub only
- Environment variables: `import.meta.env.VITE_*` pattern only
- No breaking changes: all existing panels must continue working throughout refactor
- Named exports only for services and hooks — no default exports from hook/service files
- Components: `export default function ComponentName`
- Hooks: camelCase with `use` prefix
- Module-level constants: SCREAMING_SNAKE_CASE
- `useCallback` with `[]` deps for stable fetch references (established pattern)
- `setData(prev => ({ ...prev, [key]: value }))` merge pattern for partial state updates
- `setStatus(key, status)` pattern for per-widget status updates
- Error handling via `DataResult<T>` discriminated union — no exceptions at service boundary
- No `console.log`/`console.error` in production code
- TypeScript strict mode, `noUnusedLocals`, `noUnusedParameters` enforced

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 (installed) | Error boundaries, Context API, hooks | Already in project |
| TypeScript | 5.5.3 (installed) | Domain hook return types, context interface | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | 0.344.0 (installed) | Error icon in WidgetErrorBoundary | Same icon set as Widget.tsx |

### No New Dependencies Required
This phase is purely a structural reorganization of existing code. No new npm packages are needed.

**Version verification:** All packages are already installed. No new installations required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   ├── useMarketData.ts          ← becomes thin re-export of useContext(MarketDataContext)
│   ├── useEquities.ts            ← new: fetchEquities + status + polling
│   ├── useFX.ts                  ← new: fetchFX + status + polling
│   ├── useCommodities.ts         ← new: fetchCommodities + status + polling
│   ├── useRates.ts               ← new: fetchRates + status + polling (multi-provider, cross-domain output)
│   ├── useYields.ts              ← new: fetchYields + status + polling
│   ├── useCredit.ts              ← new: fetchCredit + status + polling
│   ├── useInflation.ts           ← new: fetchInflation + lastInflationDate ref + polling
│   ├── useNews.ts                ← new: fetchNews + status + polling
│   ├── useCalendar.ts            ← new: fetchCalendar + split timer refs + smart scheduling
│   └── statusUtils.ts            ← new: loadingStatus, loadedStatus, errorStatus, warnedStatus shared constants
├── context/
│   ├── ThemeContext.tsx           ← unchanged
│   ├── DashboardContext.tsx       ← unchanged
│   └── MarketDataContext.tsx      ← new: composes all domain hooks, exposes MarketDataContext + useMarketData
└── components/
    └── shared/
        ├── Widget.tsx             ← unchanged
        └── WidgetErrorBoundary.tsx ← new: class-based error boundary
```

### Pattern 1: Domain Hook Structure

Each domain hook owns its state, fetch callback, and owns reporting its data + status back to the caller. The return type is a consistent interface across all hooks.

**What:** Each hook is a self-contained data unit: local `useState` for data slice + `WidgetStatus`, stable `useCallback` fetch function.
**When to use:** All 8 domain hooks follow this pattern.

```typescript
// Source: Extracted from existing useMarketData.ts patterns
import { useState, useCallback } from 'react';
import { WidgetStatus } from '../types';
import { getTwelveEquities } from '../services/twelveDataService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';
import { mockMarketData } from '../data/mockData';
import type { PriceItem } from '../types';

export interface EquitiesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useEquities(): EquitiesHookResult {
  const [data, setData] = useState<PriceItem[]>(mockMarketData.equities);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const result = await getTwelveEquities();
      if (result.status === 'error') {
        setStatus(errorStatus(result.error));
        return;
      }
      setData(result.data);
      setStatus(result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  return { data, status, fetch };
}
```

### Pattern 2: Shared Status Utilities Module

Extract the four status factory constants/functions from `useMarketData.ts` into a shared module so all domain hooks import from the same source.

```typescript
// src/hooks/statusUtils.ts
import { WidgetStatus, ResultWarning } from '../types';

export const loadingStatus: WidgetStatus = { state: 'loading' };
export const loadedStatus: WidgetStatus = { state: 'loaded' };
export function errorStatus(msg: string): WidgetStatus {
  return { state: 'error', error: msg };
}
export function warnedStatus(warnings: ResultWarning[]): WidgetStatus {
  return { state: 'loaded', error: warnings.map(w => w.message).join('; ') };
}
```

### Pattern 3: MarketDataContext Composition

The context provider calls all domain hooks and assembles the unified shape. This is the single place where cross-domain data flows (rates → ribbon 10Y, rates → equities VIX) are handled.

**What:** `MarketDataContext.tsx` calls all domain hooks inside the provider function body, assembles `MarketData` and `WidgetStatuses` from domain hook outputs, manages ribbon WebSocket subscription, and exposes `useMarketData()` as a context consumer hook.

```typescript
// src/context/MarketDataContext.tsx (simplified structure)
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { MarketData, WidgetStatuses, WsStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { wsManager } from '../services/wsManager';
import { buildRibbonFromWs } from '../services/twelveDataService';
import { useEquities } from '../hooks/useEquities';
import { useFX } from '../hooks/useFX';
// ... other domain hook imports
import { loadingStatus, loadedStatus } from '../hooks/statusUtils';

interface MarketDataContextType {
  data: MarketData;
  statuses: WidgetStatuses;
  loading: boolean;
  lastUpdated: Date;
  refresh: () => Promise<void>;
  retryWidget: (key: keyof WidgetStatuses) => void;
  wsStatus: WsStatus;
}

const MarketDataContext = createContext<MarketDataContextType>(/* ... default value ... */);

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const equities = useEquities();
  const fx = useFX();
  // ... other domain hooks

  const [ribbonData, setRibbonData] = useState(mockMarketData.ribbon);
  const [ribbonStatus, setRibbonStatus] = useState(loadingStatus);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const ribbonBase = useRef(mockMarketData.ribbon);

  // Cross-domain: rates hook provides 10Y and VIX for ribbon/equities merge
  // This effect runs when rates.data changes and patches ribbon + equities
  // (implementation in composing context, not in useRates)

  const data: MarketData = {
    ribbon: ribbonData,
    equities: equities.data,
    fx: fx.data,
    // ... assembled from domain hooks
    lastUpdated,
  };

  const statuses: WidgetStatuses = {
    ribbon: ribbonStatus,
    equities: equities.status,
    fx: fx.status,
    // ...
  };

  const loading = Object.values(statuses).some(s => s.state === 'loading');

  const refresh = useCallback(async () => {
    await Promise.all([
      equities.fetch(),
      fx.fetch(),
      // commodities.fetch() -- fast REST sources only
    ]);
    setLastUpdated(new Date());
  }, [equities.fetch, fx.fetch /* ... */]);

  const retryWidget = useCallback((key: keyof WidgetStatuses) => {
    switch (key) {
      case 'equities': equities.fetch(); break;
      // ...
    }
  }, [equities.fetch /* ... */]);

  return (
    <MarketDataContext.Provider value={{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus }}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
```

### Pattern 4: useMarketData as Thin Re-export

After context creation, `src/hooks/useMarketData.ts` becomes a one-line re-export so all existing import paths continue to resolve.

```typescript
// src/hooks/useMarketData.ts — after refactor
export { useMarketData } from '../context/MarketDataContext';
```

This preserves `import { useMarketData } from './hooks/useMarketData'` in `App.tsx` with zero change to `App.tsx`.

### Pattern 5: WidgetErrorBoundary (Class Component)

React error boundaries must be class components. The standard React 18 pattern uses `getDerivedStateFromError` to capture the error into state, and a `key` prop increment on the wrapper to force child re-mount on retry.

**What:** Class component that catches render errors and shows card-shaped fallback. Retry re-mounts the child via state key increment.

```typescript
// src/components/shared/WidgetErrorBoundary.tsx
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  widgetTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  mountKey: number;
}

export default class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, mountKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      mountKey: prev.mountKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-semibold text-slate-200 tracking-wide">
              {this.props.widgetTitle ?? 'Widget'}
            </span>
          </div>
          <div className="p-4 flex flex-col items-center justify-center py-6 gap-3 text-center">
            <AlertCircle size={20} className="text-amber-500" />
            <p className="text-xs text-slate-400">Widget encountered an error</p>
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.mountKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
```

### Pattern 6: calendarTimer Split (ARCH-04)

The current unsafe type cast is in `useMarketData.ts` lines 406-422. In `useCalendar`, split into two typed refs.

```typescript
// src/hooks/useCalendar.ts — timer section
const calendarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const calendarIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

function scheduleCalendar() {
  const delay = msUntilNextCalendarRefresh();
  calendarTimeoutRef.current = setTimeout(() => {
    fetchCalendar();
    calendarIntervalRef.current = setInterval(fetchCalendar, CALENDAR_REFRESH_MS);
  }, delay);
}

// In cleanup:
return () => {
  if (calendarTimeoutRef.current) clearTimeout(calendarTimeoutRef.current);
  if (calendarIntervalRef.current) clearInterval(calendarIntervalRef.current);
};
```

### Pattern 7: DashboardGrid Error Boundary Wrapping

Each widget `<div>` in `renderWidget` is wrapped with `<WidgetErrorBoundary>`. The widget title is passed as a prop to show in the fallback card header.

```typescript
// src/components/layout/DashboardGrid.tsx — renderWidget change
return (
  <div key={widget.id} className={wrapClass}>
    <WidgetErrorBoundary widgetTitle={widget.label}>
      <YieldCurveChart ... />
    </WidgetErrorBoundary>
  </div>
);
```

### Anti-Patterns to Avoid

- **Putting polling intervals inside domain hooks:** The intervals belong in a single `useEffect` in the composing context (or per-hook if each hook manages its own). The key constraint is that `useCallback([])` ensures stable refs so the `useEffect` dep array doesn't re-register. Each domain hook should own its own `useEffect` for its polling interval — this is cleaner than one giant effect.
- **Cross-domain dependencies between domain hooks:** `useRates` must not import from `useEquities`. The composing context handles the VIX and 10Y ribbon patching after receiving data from domain hooks.
- **Triggering re-render in context for every ribbon tick:** The ribbon subscription fires on every WS message. Updating `MarketData.ribbon` state on every tick causes re-render of all consumers. This is the existing behavior — do not change the pattern in this phase.
- **Default exports from hook files:** Codebase convention requires named exports from service/hook files. Use `export function useEquities()`, not `export default function`.
- **React.Fragment with key prop:** The `key` prop on `React.Fragment` is valid React for force-remounting but requires the full `React.Fragment` form (not `<>`). This is the correct re-mount trigger for error boundary retry.
- **Using `componentDidCatch` instead of `getDerivedStateFromError` for error capture:** `getDerivedStateFromError` is synchronous and sets state before the next render, preventing flash of child. `componentDidCatch` is for side effects (logging) only. Since this project has no logging, only `getDerivedStateFromError` is needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary | Custom error detection in each widget | React class-based ErrorBoundary with `getDerivedStateFromError` | Only mechanism to catch render errors in React; cannot be replicated with hooks |
| Re-mount on retry | State reset + unmount tricks | `key` prop increment on the boundary's child | React's official documented approach for remounting components |
| Cross-domain state merging | Complex pub/sub between domain hooks | Direct composition in context provider function body | Hooks in a provider are called in the same render; reading hook outputs and merging is trivial and avoids coupling |

**Key insight:** React class-based error boundaries are the only standard mechanism for catching render-time exceptions. There is no hook equivalent in React 18.

---

## Common Pitfalls

### Pitfall 1: Context Default Value Diverges from Runtime Shape
**What goes wrong:** `createContext<MarketDataContextType>(defaultValue)` — if the default value's `data` or `statuses` object is not type-compatible with the live provider output, TypeScript may miss type drift if the default is cast with `as`.
**Why it happens:** Developers use `{} as MarketDataContextType` as the default to avoid writing out the full mock value.
**How to avoid:** Use `mockMarketData` and `DEFAULT_STATUSES` (same values as the current hook's initial state) as the context default value. These already satisfy `MarketData` and `WidgetStatuses` types.
**Warning signs:** `useMarketData()` called outside a provider returns blank data silently.

### Pitfall 2: Domain Hook useEffect Dep Array Instability
**What goes wrong:** Domain hook's polling `useEffect` depends on `fetch` callback. If `fetch` is not wrapped in `useCallback([])`, it is a new function reference every render, causing the effect to teardown+restart on every render — intervals fire at wrong cadence.
**Why it happens:** Forgetting `useCallback` or including state variables in `useCallback`'s dep array.
**How to avoid:** Every domain hook's fetch function must use `useCallback(async () => { ... }, [])` with an empty dependency array. The hook reads `setData`/`setStatus` from local `useState` — React guarantees `setState` is stable and need not be in deps.
**Warning signs:** `react-hooks/exhaustive-deps` lint warning on a `useEffect` that contains an unstable `fetch` reference.

### Pitfall 3: Cross-Domain State Mutation in Domain Hook
**What goes wrong:** `useRates` directly calls `setRibbonData` or patches `equities.vix` from within the hook. This creates a dependency between hooks that is invisible to TypeScript and breaks the single-responsibility of each hook.
**Why it happens:** The current `fetchRates` in the monolithic hook does mutate `ribbon` and `equities` state. When extracting, the developer copies this behavior into `useRates`.
**How to avoid:** `useRates` returns its raw data including `y10Val` and `vix`. The composing context uses a `useEffect` that watches `rates.data` and applies the cross-domain patches to `ribbon` and `equities` state.
**Warning signs:** `useRates.ts` imports from `useEquities.ts` or references state setters from other hooks.

### Pitfall 4: App.tsx Import Not Updated After Context Migration
**What goes wrong:** `App.tsx` still imports `useMarketData` from `./hooks/useMarketData`. After moving `useMarketData()` to `MarketDataContext.tsx`, if the hook file is deleted instead of converted to a re-export, the import breaks.
**Why it happens:** The plan migrates the implementation but forgets the re-export step.
**How to avoid:** Keep `src/hooks/useMarketData.ts` but replace its content with `export { useMarketData } from '../context/MarketDataContext';`. `App.tsx` import path stays valid with zero changes.
**Warning signs:** TypeScript error `Module '...hooks/useMarketData' has no exported member 'useMarketData'`.

### Pitfall 5: Error Boundary key Prop on Fragment
**What goes wrong:** Using `<>{children}</>` shorthand does not accept a `key` prop. The key must be on `<React.Fragment key={mountKey}>`.
**Why it happens:** JSX shorthand fragments (`<>`) do not support attributes.
**How to avoid:** Use `React.Fragment` explicitly when the re-mount key pattern is needed.
**Warning signs:** TypeScript error `Property 'key' does not exist on type 'IntrinsicAttributes'`.

### Pitfall 6: Provider Placement in App.tsx
**What goes wrong:** `MarketDataProvider` is placed inside `DashboardApp` (the component that calls `useMarketData`), causing the provider to remount whenever `DashboardApp` re-renders.
**Why it happens:** Following the existing `ThemeProvider` → `DashboardProvider` → `DashboardApp` pattern incorrectly.
**How to avoid:** Add `MarketDataProvider` to the provider chain in `App()` function body, wrapping `DashboardApp`. `DashboardApp` calls `useMarketData()` (reads from context) — it must be a descendant, not the same component.
**Warning signs:** All data resets on any state change in `DashboardApp`.

### Pitfall 7: ribbonBase.current Timing in Context
**What goes wrong:** `ribbonBase.current` is mutated inside the WS tick callback but also read by `useRates`'s cross-domain patch. If the patch runs after a tick, it may overwrite the tick's ribbon state.
**Why it happens:** The existing code already has this ordering sensitivity; the refactor must preserve the existing mutation order.
**How to avoid:** Keep the `ribbonBase` ref and its mutation logic exactly as-is, just moved from the monolithic hook to the composing context's WebSocket `useEffect`. Do not add new mutation paths.

---

## Code Examples

### Verified Pattern: useCallback with empty deps (from existing useMarketData.ts)

```typescript
// Source: src/hooks/useMarketData.ts lines 94-107 (existing, verified working)
const fetchEquities = useCallback(async () => {
  setStatus('equities', loadingStatus);
  try {
    const result = await getTwelveEquities();
    if (result.status === 'error') {
      setStatus('equities', errorStatus(result.error));
      return;
    }
    setData(prev => ({ ...prev, equities: result.data }));
    setStatus('equities', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
  } catch (e) {
    setStatus('equities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
  }
}, []);
```

### Verified Pattern: React Context + Provider + hook (from ThemeContext.tsx)

```typescript
// Source: src/context/ThemeContext.tsx (existing, verified working)
const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // ... state
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Verified Pattern: setInterval cleanup (from existing useMarketData.ts)

```typescript
// Source: src/hooks/useMarketData.ts lines 389-424 (existing, verified working)
useEffect(() => {
  const restInterval = setInterval(() => {
    fetchEquities();
    fetchFX();
    fetchCommodities();
    setLastUpdated(new Date());
  }, TWELVE_REST_REFRESH_MS);

  return () => {
    clearInterval(restInterval);
  };
}, [fetchEquities, fetchFX, fetchCommodities]);
// Note: with useCallback([]) these deps are stable — effect runs once
```

### Verified Pattern: wsManager subscription lifecycle (from existing useMarketData.ts)

```typescript
// Source: src/hooks/useMarketData.ts lines 347-373 (existing, verified working)
useEffect(() => {
  setStatus('ribbon', loadingStatus);
  const unsubTick = wsManager.subscribe((update) => {
    setData(prev => {
      if (update.symbol === 'SPY' || update.symbol === 'CL1:COM' || update.symbol === 'XAU/USD') {
        const newRibbon = buildRibbonFromWs(ribbonBase.current);
        setStatus('ribbon', loadedStatus);
        ribbonBase.current = newRibbon;
        return { ...prev, ribbon: newRibbon };
      }
      return prev;
    });
  });
  const unsubStatus = wsManager.onStatusChange(setWsStatus);

  return () => {
    unsubTick();
    unsubStatus();
  };
}, []);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Monolithic data hook (all domains in one file) | Composable domain hooks assembled via Context | Isolation, testability, readable files |
| `calendarTimer` union type cast | Separate `timeoutRef` + `intervalRef` | Eliminates semantic incorrectness in cleanup |
| No render error isolation | Per-widget `WidgetErrorBoundary` | One widget crash cannot cascade to whole dashboard |
| `useMarketData()` direct in App.tsx | `useMarketData()` reads from `MarketDataContext` | Same API, different backing — zero widget changes |

**Deprecated/outdated:**
- Union `ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>` with type cast: replaced by two typed refs per D-11.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is purely code restructuring with no new CLI tools, services, or runtimes required beyond the already-installed Node.js and npm).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — Vitest + MSW planned for Phase 6 (TEST-01) |
| Config file | None |
| Quick run command | `npm run typecheck` (TypeScript type check as proxy) |
| Full suite command | `npm run build` (full compile + bundle as proxy) |

**Note:** `nyquist_validation` is enabled in config.json but no test framework exists yet (Phase 6 adds TEST-01 through TEST-05). For Phase 4, validation is via TypeScript compilation and build success. The test framework installation is explicitly out of scope for this phase.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Domain hooks exist as separate files, useMarketData.ts is no longer monolithic | structural | `npm run typecheck` (imports must resolve) | ❌ Wave 0 — verify by file existence + compile |
| ARCH-02 | All widgets receive same context shape, zero widget file changes | structural | `npm run typecheck` + `npm run build` | ❌ Wave 0 — verify no widget files modified |
| ARCH-03 | WidgetErrorBoundary wraps each widget in DashboardGrid | structural | `npm run typecheck` | ❌ Wave 0 — verify by code review |
| ARCH-04 | calendarTimer split into two refs, no unsafe type cast | structural | `npm run typecheck` (lint via eslint) | ❌ Wave 0 — verify by code review + `npm run lint` |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + no widget files modified + `npm run lint` clean before `/gsd:verify-work`

### Wave 0 Gaps
- No test files to create (test framework not yet installed)
- Validation relies on TypeScript compiler and build toolchain
- `npm run lint` should be added to dev scripts or run via `npx eslint .` for hook rule verification

*(No test infrastructure gaps blocking implementation — compiler is the validator for this phase)*

---

## Open Questions

1. **Per-hook polling vs. central polling useEffect**
   - What we know: D-10 says each domain hook uses `useCallback([])` for fetch. The composing context's `useEffect` sets up polling.
   - What's unclear: Should each domain hook manage its own `setInterval` (fully self-contained), or should the composing context manage all intervals? The CONTEXT.md says "Each hook owns its own fetch function, status state, and **polling interval**" (D-01) but D-10 says "The composing context's `useEffect` for initial fetch uses the stable callbacks."
   - Recommendation: Interpret D-01 as meaning each hook owns the polling logic (interval ref + `useEffect`). The composing context's `useEffect` handles only the initial fetch calls on mount, and the ribbon WebSocket subscription. This gives true isolation — unmounting a domain hook cleans up its own interval.

2. **Cross-domain rates → ribbon/equities patch mechanism**
   - What we know: `fetchRates` currently mutates `ribbon[1]` (10Y), `ribbon[5]` (VIX), and `equities[4]` (VIX) after a successful fetch. D-05 says this lives in the composing context.
   - What's unclear: The trigger — should the context watch `rates.data` via `useEffect` and apply the patch, or should `useRates` expose `y10Val` and `vix` as separate fields and the context applies them?
   - Recommendation: `useRates` return type includes `y10Val: number | null` and `vix: number | null` alongside the full `data: PriceItem[]`. The composing context's `useEffect` watching `rates.data` applies the ribbon and equities patches. This keeps `useRates` pure and the context responsible for cross-domain merging.

3. **useMarketData.ts fate: re-export vs. delete**
   - What we know: `App.tsx` imports `useMarketData` from `./hooks/useMarketData`. D-04 says `useMarketData()` reads from context.
   - What's unclear: The CONTEXT.md marks this as Claude's discretion.
   - Recommendation: Convert `useMarketData.ts` to a single-line re-export (`export { useMarketData } from '../context/MarketDataContext'`). This preserves the import path in `App.tsx` with zero change, satisfies the "zero widget API changes" requirement of ARCH-02, and avoids hunting for all callsites.

---

## Sources

### Primary (HIGH confidence)
- `src/hooks/useMarketData.ts` — Source of truth for current hook structure, all fetch patterns, interval setup
- `src/context/ThemeContext.tsx` / `DashboardContext.tsx` — Reference implementations for React Context + Provider + consumer hook in this project
- `src/components/shared/Widget.tsx` — Reference for Widget shell aesthetic (WidgetErrorBoundary must match)
- `src/App.tsx` — Current consumer, shows the exact destructured shape that must be preserved
- `src/components/layout/DashboardGrid.tsx` — Error boundary insertion point
- React 18 official docs on Error Boundaries and React.Component class pattern (well-established, HIGH confidence)

### Secondary (MEDIUM confidence)
- React documentation on `getDerivedStateFromError` vs `componentDidCatch` — standard React class boundary pattern
- `key` prop for remounting components — documented React technique for resetting component state

### Tertiary (LOW confidence)
- None — all findings are based on reading the actual source files and established React patterns.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages needed; all existing
- Architecture: HIGH — directly derived from reading source code and locked decisions
- Pitfalls: HIGH — derived from reading existing code and CONCERNS.md
- Test validation: HIGH — TypeScript compiler is the gate; no new test framework needed for this phase

**Research date:** 2026-04-11
**Valid until:** Stable (this is internal refactoring of well-understood code)
