# Coding Conventions

**Analysis Date:** 2026-04-08

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported default (e.g., `EquitiesPanel.tsx`, `Widget.tsx`, `ChangeIndicator.tsx`)
- Hooks: camelCase prefixed with `use` (e.g., `useMarketData.ts`)
- Services: camelCase descriptive of provider (e.g., `fredService.ts`, `finnhubService.ts`, `twelveDataService.ts`)
- Context files: PascalCase with `Context` suffix (e.g., `DashboardContext.tsx`, `ThemeContext.tsx`)
- Data/utility files: camelCase (e.g., `mockData.ts`, `cache.ts`)

**Functions:**
- Exported async service functions: camelCase with `get`/`fetch` prefix (e.g., `getFredFedFundsRate`, `getFinnhubNews`, `getTwelveEquities`)
- Internal async helpers: camelCase with `fetch` prefix (e.g., `fetchSeries`, `fetchLatestValue`, `fetchBatchQuotes`)
- React components: PascalCase (e.g., `SkeletonRows`, `MomBadge`)
- Event handlers: camelCase with `handle` prefix (e.g., `handleDragStart`, `handleDragEnter`, `handleDragEnd`)
- Context hooks: `use` + context name (e.g., `useDashboard`, `useTheme`)

**Variables and Constants:**
- Module-level constants: SCREAMING_SNAKE_CASE for configuration (e.g., `TWELVE_REST_REFRESH_MS`, `NEWS_REFRESH_MS`, `FRED_REFRESH_MS`, `WS_SYMBOLS`, `YIELD_CURVE_MATURITIES`)
- Boolean flags: `is`/`was` prefix (e.g., `isDark`, `isPositive`, `isNeutral`, `wsConnected`)
- Environment variables: accessed via `import.meta.env.VITE_*` pattern, cast with `as string`

**Types and Interfaces:**
- Component prop interfaces: named `Props` (not `[ComponentName]Props`) within the file scope
- Domain types: PascalCase interfaces in `src/types/index.ts` (e.g., `PriceItem`, `TimeSeriesPoint`, `MarketData`)
- API response shapes: PascalCase prefixed with provider (e.g., `FredObservation`, `FredResponse`, `FinnhubNewsRaw`, `TdQuote`)
- Type unions for literals: `type` aliases (e.g., `type Period = 'D' | 'W' | 'M'`, `type WidgetLoadState = 'loading' | 'loaded' | 'error'`)

## Code Style

**Formatting:**
- No Prettier config detected — formatting is implicit
- 2-space indentation (consistent throughout)
- Single quotes for strings in TypeScript
- Trailing commas in multi-line objects and arrays
- No semicolons in component JSX attribute values; standard TS semicolons in statements

**Linting:**
- ESLint via `eslint.config.js` using flat config format
- `typescript-eslint` recommended rules enabled
- `eslint-plugin-react-hooks` recommended rules enforced (exhaustive-deps, rules-of-hooks)
- `eslint-plugin-react-refresh` with `allowConstantExport: true`
- TypeScript `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`

## Import Organization

**Order (consistent across files):**
1. React imports (explicit `import React, { ... } from 'react'`)
2. Third-party library imports (lucide-react, recharts, etc.)
3. Internal type imports from `'../../types'` or `'../types'`
4. Internal context imports
5. Internal service imports
6. Internal component imports

**Path aliases:**
- No path aliases configured — all imports use relative paths (`../`, `../../`)
- Types always imported from `'../../types'` (relative from component) or `'../types'` (relative from hooks/services)

**React import style:**
- Explicit `import React` required (not using JSX transform auto-import)

## Error Handling

**Service layer pattern — catch and return fallback:**
```typescript
// Standard service function pattern
export async function getFinnhubNews(): Promise<NewsItem[]> {
  try {
    const raw = await finnhubFetch<FinnhubNewsRaw[]>('/news?category=general');
    // ... transform
    return items.length > 0 ? items : mockNews;
  } catch {
    return mockNews;  // always return mock data, never throw from public service functions
  }
}
```

**Hook layer pattern — set error status, never throw:**
```typescript
const fetchEquities = useCallback(async () => {
  setStatus('equities', loadingStatus);
  try {
    const equities = await getTwelveEquities();
    setData(prev => ({ ...prev, equities }));
    setStatus('equities', loadedStatus);
  } catch (e) {
    setStatus('equities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
  }
}, []);
```

**Error type narrowing:**
- Always use `e instanceof Error ? e.message : 'Failed to load'` pattern before accessing `.message`
- Bare `catch {}` (empty catch) is used in internal helpers where failure is non-critical (e.g., `fetchLatestValue`)
- `Promise.allSettled` is preferred over `Promise.all` when partial failure is acceptable

**Fallback data strategy:**
- Every service function falls back to `mockMarketData` values on failure
- Mock data is imported from `src/data/mockData.ts` and used as the initial state in `useMarketData`
- Widget statuses propagate `loading | loaded | error` state to UI via `WidgetStatus` type

## Logging

**Framework:** None — no logging library is used.
- No `console.log`, `console.error`, or observability calls detected in production code
- Errors are surfaced to UI via widget status state, not logged

## Comments

**When to Comment:**
- No JSDoc or TSDoc comments are present in the codebase
- Inline comments are not used
- Code is self-documenting through descriptive naming

## Function Design

**Size:** Functions are kept small and single-purpose; complex logic is extracted into helper functions (e.g., `fetchSeries`, `fetchLatestValue`, `getInflationSeries`, `isoDateOffset`)

**Parameters:**
- Components receive a single `Props` interface object (destructured in signature)
- Service functions use positional parameters with descriptive names
- Default parameter values are used where appropriate (e.g., `limit = 365`, `color = '#38bdf8'`, `forceRefresh = false`)

**Return Values:**
- Service functions return domain types or `null` — never raw API shapes
- Functions that may fail silently return `T | null` (e.g., `fetchLatestValue`, `getFredFedFundsRate`)
- Functions that always return something use non-nullable types with fallbacks

## Module Design

**Exports:**
- Components: `export default function ComponentName`
- Services: named exports only — no default exports from service files
- Contexts: named exports for provider + hook (e.g., `export function DashboardProvider`, `export const useDashboard`)
- Types: named exports from `src/types/index.ts`
- Cache: singleton instance exported as `export const cache = new DataCache()`

**Barrel Files:** Not used — all imports reference specific files directly.

## State Management

**Pattern:** React Context + custom hook
- `ThemeContext` (`src/context/ThemeContext.tsx`) — persists `isDark` to `localStorage`
- `DashboardContext` (`src/context/DashboardContext.tsx`) — persists widget settings to `localStorage` under `'macro-dashboard-settings'`
- `useMarketData` (`src/hooks/useMarketData.ts`) — all live data state, polling intervals, and WebSocket subscription management

**Immutable update pattern:**
```typescript
setData(prev => ({ ...prev, equities }));
setSettings(prev => ({
  ...prev,
  widgets: prev.widgets.map(w => (w.id === id ? { ...w, visible } : w)),
}));
```

## Caching Pattern

**In-memory cache with TTL** via `src/services/cache.ts`:
```typescript
// Check cache before fetching
const cached = cache.get<TimeSeriesPoint[]>(cacheKey);
if (cached) return cached;
// ... fetch ...
cache.set(cacheKey, points, TTL.FRED);
```

Cache keys follow `provider:resource:params` convention (e.g., `'fred:DGS10:365'`, `'finnhub:news:general'`, `'td:batch:EUR/USD,USD/JPY'`)

TTL constants defined in `src/services/cache.ts`:
- `TTL.TWELVEDATA_REST`: 60 seconds
- `TTL.FINNHUB`: 5 minutes
- `TTL.FINNHUB_CALENDAR`: 6 hours
- `TTL.FRED`: 24 hours
- `TTL.MASSIVE`: 5 minutes

## Tailwind CSS Usage

**Approach:** Utility-first with Tailwind class strings inline in JSX
- Dark mode via `isDark` boolean and conditional class strings (not `dark:` variant in most places)
- Color palette: `slate-*` for backgrounds/text, `emerald-400` for positive, `red-400` for negative, `amber-400` for warnings, `sky-*` for active/selected states
- `font-mono` applied to all numeric/financial values
- `tabular-nums` applied to values that need alignment
- Transition classes (`transition-all`, `transition-colors`, `duration-200`) on interactive elements

---

*Convention analysis: 2026-04-08*
