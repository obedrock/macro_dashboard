<!-- GSD:project-start source:PROJECT.md -->
## Project

**MacroPulse**

A real-time macroeconomic dashboard built with React, TypeScript, and Vite. It aggregates financial data from multiple APIs (Twelve Data, FRED, Finnhub) and displays it across 10 widget panels — yield curves, interest rates, equities, FX, commodities, credit spreads, inflation, economic calendar, fed watch, and macro news. Features dark/light theme, customizable widget layout, and WebSocket real-time updates.

**Core Value:** All panels reliably display real, current market data with clear indication of data freshness and error states — no silent failures, no ambiguous mock data.

### Constraints

- **Tech stack**: Keep React + TypeScript + Vite + Tailwind — no framework changes
- **API sources**: Twelve Data, FRED, Finnhub — drop Massive/Polygon
- **Environment variables**: API keys stay in `.env` via `import.meta.env.VITE_*`
- **No breaking changes**: All existing panels must continue working throughout refactor
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.5.3 - All application source code in `src/`
- TSX - React component files throughout `src/components/`
- JavaScript - Config files only (`tailwind.config.js`, `postcss.config.js`, `eslint.config.js`)
- HTML - Single entry point `index.html`
- CSS - Global styles in `src/index.css`
## Runtime
- Node.js v24.14.0 (detected in environment)
- Browser target: ES2020, DOM, DOM.Iterable (per `tsconfig.app.json`)
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)
## Frameworks
- React 18.3.1 - UI framework, `src/main.tsx` entry point with `createRoot`
- React DOM 18.3.1 - DOM rendering
- Recharts 3.8.1 - Data visualization for yield curve, credit spreads, inflation time series
- Lucide React 0.344.0 - Icon library (excluded from Vite pre-bundling optimization)
- Tailwind CSS 3.4.1 - Utility-first CSS, configured in `tailwind.config.js`
- PostCSS 8.4.35 - CSS processing with autoprefixer, configured in `postcss.config.js`
- Inter font (sans) and JetBrains Mono / Fira Code (mono) — declared in `tailwind.config.js`
- Dark mode via `class` strategy (`darkMode: 'class'` in `tailwind.config.js`)
- Vite 5.4.2 - Dev server and production bundler, configured in `vite.config.ts`
- `@vitejs/plugin-react` 4.3.1 - React Fast Refresh support
## Key Dependencies
- `@massive.com/client-js` ^10.6.0 - REST client for Massive.com market data API (forex aggregates, treasury yields); aliased in `vite.config.ts` to resolve `node_modules/@massive.com/client-js/dist/main.js`
- `@supabase/supabase-js` ^2.57.4 - Listed as dependency but **not actively used** in any source file (no imports found in `src/`)
- Native `fetch` API - Used for all HTTP calls to Finnhub, FRED, and Twelve Data REST endpoints (no axios or similar)
- Native `WebSocket` API - Used in `src/services/twelveDataService.ts` for live price streaming
## Configuration
- `tsconfig.json` - Project references config (references `tsconfig.app.json` and `tsconfig.node.json`)
- `tsconfig.app.json` - App source config: strict mode, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, bundler module resolution, `jsx: react-jsx`
- `tsconfig.node.json` - Node/config files config
- `vite.config.ts` - Vite config with React plugin, path alias for `@massive.com/client-js`, and `optimizeDeps` exclusion for `lucide-react`
- `postcss.config.js` - PostCSS with tailwindcss and autoprefixer plugins
- `tailwind.config.js` - Tailwind scanning `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`
- `eslint.config.js` - ESLint flat config with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Key rules: react-hooks recommended, `react-refresh/only-export-components` warning
- `.env` file expected at project root (not present in repo)
- Required keys consumed via `import.meta.env`:
## Dev Scripts
## Platform Requirements
- Node.js (v24.x detected), npm
- All four API keys set in `.env` (Finnhub, FRED, Massive, Twelve Data)
- Static SPA — output is `dist/` directory from `vite build`
- No server-side runtime required
- All API calls made directly from browser to third-party APIs (CORS must be permitted by each provider)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase matching the exported default (e.g., `EquitiesPanel.tsx`, `Widget.tsx`, `ChangeIndicator.tsx`)
- Hooks: camelCase prefixed with `use` (e.g., `useMarketData.ts`)
- Services: camelCase descriptive of provider (e.g., `fredService.ts`, `finnhubService.ts`, `twelveDataService.ts`)
- Context files: PascalCase with `Context` suffix (e.g., `DashboardContext.tsx`, `ThemeContext.tsx`)
- Data/utility files: camelCase (e.g., `mockData.ts`, `cache.ts`)
- Exported async service functions: camelCase with `get`/`fetch` prefix (e.g., `getFredFedFundsRate`, `getFinnhubNews`, `getTwelveEquities`)
- Internal async helpers: camelCase with `fetch` prefix (e.g., `fetchSeries`, `fetchLatestValue`, `fetchBatchQuotes`)
- React components: PascalCase (e.g., `SkeletonRows`, `MomBadge`)
- Event handlers: camelCase with `handle` prefix (e.g., `handleDragStart`, `handleDragEnter`, `handleDragEnd`)
- Context hooks: `use` + context name (e.g., `useDashboard`, `useTheme`)
- Module-level constants: SCREAMING_SNAKE_CASE for configuration (e.g., `TWELVE_REST_REFRESH_MS`, `NEWS_REFRESH_MS`, `FRED_REFRESH_MS`, `WS_SYMBOLS`, `YIELD_CURVE_MATURITIES`)
- Boolean flags: `is`/`was` prefix (e.g., `isDark`, `isPositive`, `isNeutral`, `wsConnected`)
- Environment variables: accessed via `import.meta.env.VITE_*` pattern, cast with `as string`
- Component prop interfaces: named `Props` (not `[ComponentName]Props`) within the file scope
- Domain types: PascalCase interfaces in `src/types/index.ts` (e.g., `PriceItem`, `TimeSeriesPoint`, `MarketData`)
- API response shapes: PascalCase prefixed with provider (e.g., `FredObservation`, `FredResponse`, `FinnhubNewsRaw`, `TdQuote`)
- Type unions for literals: `type` aliases (e.g., `type Period = 'D' | 'W' | 'M'`, `type WidgetLoadState = 'loading' | 'loaded' | 'error'`)
## Code Style
- No Prettier config detected — formatting is implicit
- 2-space indentation (consistent throughout)
- Single quotes for strings in TypeScript
- Trailing commas in multi-line objects and arrays
- No semicolons in component JSX attribute values; standard TS semicolons in statements
- ESLint via `eslint.config.js` using flat config format
- `typescript-eslint` recommended rules enabled
- `eslint-plugin-react-hooks` recommended rules enforced (exhaustive-deps, rules-of-hooks)
- `eslint-plugin-react-refresh` with `allowConstantExport: true`
- TypeScript `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`
## Import Organization
- No path aliases configured — all imports use relative paths (`../`, `../../`)
- Types always imported from `'../../types'` (relative from component) or `'../types'` (relative from hooks/services)
- Explicit `import React` required (not using JSX transform auto-import)
## Error Handling
- Service functions return `DataResult<T>` (discriminated union with `status: 'ok' | 'error'`) — errors propagate as typed results, not exceptions
- `useMarketData` fetch callbacks unwrap DataResult via `result.status === 'error'` narrowing, not try/catch
- Use `e instanceof Error ? e.message : 'Failed to load'` pattern only in infrastructure-level safety-net catches (not at the service boundary)
- Bare `catch {}` (empty catch) is used in internal helpers where failure is non-critical (e.g., `fetchLatestValue`)
- `Promise.allSettled` is preferred over `Promise.all` when partial failure is acceptable
- Every service function falls back to `DataResult` error on failure — no silent mock substitution
- Human-readable error messages via `toUserMessage()` from `src/services/errorMessages.ts`
- Widget statuses propagate `loading | loaded | error` state to UI via `WidgetStatus` type
## Logging
- No `console.log`, `console.error`, or observability calls detected in production code
- Errors are surfaced to UI via widget status state, not logged
## Comments
- No JSDoc or TSDoc comments are present in the codebase
- Inline comments are not used
- Code is self-documenting through descriptive naming
## Function Design
- Components receive a single `Props` interface object (destructured in signature)
- Service functions use positional parameters with descriptive names
- Default parameter values are used where appropriate (e.g., `limit = 365`, `color = '#38bdf8'`, `forceRefresh = false`)
- Service functions return domain types or `null` — never raw API shapes
- Functions that may fail silently return `T | null` (e.g., `fetchLatestValue`, `getFredFedFundsRate`)
- Functions that always return something use non-nullable types with fallbacks
## Module Design
- Components: `export default function ComponentName`
- Services: named exports only — no default exports from service files
- Contexts: named exports for provider + hook (e.g., `export function DashboardProvider`, `export const useDashboard`)
- Types: named exports from `src/types/index.ts`
- Cache: singleton instance exported as `export const cache = new DataCache()`
## State Management
- `ThemeContext` (`src/context/ThemeContext.tsx`) — persists `isDark` to `localStorage`
- `DashboardContext` (`src/context/DashboardContext.tsx`) — persists widget settings to `localStorage` under `'macro-dashboard-settings'`
- `useMarketData` (`src/hooks/useMarketData.ts`) — all live data state, polling intervals, and WebSocket subscription management
## Caching Pattern
- `TTL.TWELVEDATA_REST`: 60 seconds
- `TTL.FINNHUB`: 5 minutes
- `TTL.FINNHUB_CALENDAR`: 6 hours
- `TTL.FRED`: 24 hours
- `TTL.MASSIVE`: 5 minutes
## Tailwind CSS Usage
- Dark mode via `isDark` boolean and conditional class strings (not `dark:` variant in most places)
- Color palette: `slate-*` for backgrounds/text, `emerald-400` for positive, `red-400` for negative, `amber-400` for warnings, `sky-*` for active/selected states
- `font-mono` applied to all numeric/financial values
- `tabular-nums` applied to values that need alignment
- Transition classes (`transition-all`, `transition-colors`, `duration-200`) on interactive elements
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React component tree with two React Context providers at root for global state
- A single custom hook (`useMarketData`) owns all async data fetching, polling, and per-widget load state
- External API calls are isolated in dedicated service modules; components never call APIs directly
- Mock data in `src/data/mockData.ts` doubles as both dev fallback and type-conforming default state
- In-memory TTL cache (`src/services/cache.ts`) sits between hooks and services to deduplicate API calls
## Layers
- Purpose: Mount React root, apply global CSS
- Location: `src/main.tsx`, `index.html`
- Contains: ReactDOM render call, CSS import
- Depends on: App component, Tailwind base styles
- Used by: Browser
- Purpose: Theme preference and dashboard widget configuration (visibility, order)
- Location: `src/context/ThemeContext.tsx`, `src/context/DashboardContext.tsx`
- Contains: React Context + Provider components, localStorage persistence
- Depends on: `src/types/index.ts`
- Used by: All layout and widget components via `useTheme()` and `useDashboard()` hooks
- Purpose: Orchestrate all market data fetching, manage per-widget load state, schedule polling intervals
- Location: `src/hooks/useMarketData.ts`
- Contains: Per-widget fetch functions wrapped in `useCallback`, interval and WebSocket lifecycle via `useEffect`, `retryWidget` dispatch
- Depends on: All three service modules, `src/data/mockData.ts`, `src/types/index.ts`
- Used by: `src/App.tsx` (single consumer; data and statuses are prop-drilled down)
- Purpose: Fetch and normalise data from external APIs; apply cache
- Location: `src/services/`
- Depends on: `src/types/index.ts`, `src/data/mockData.ts`, `src/services/cache.ts`
- Used by: `src/hooks/useMarketData.ts`
- Purpose: Provide shape-correct default values that prevent blank renders when APIs fail
- Location: `src/data/mockData.ts`
- Contains: `mockMarketData` (full `MarketData` object), `mockNews`, `mockEconomicCalendar`, `mockFomcData`, and named time-series exports (`rateHistorySeries`, `sp500Series`, `dxySeries`, `wtiSeries`)
- Depends on: `src/types/index.ts`
- Used by: `useMarketData` initial state, all service modules as error fallback, `ExpandedModal` for chart series
- Purpose: Structural chrome — header, sticky ribbon ticker, responsive widget grid, modal overlay, bottom nav, settings panel
- Location: `src/components/layout/`
- Contains: `Header.tsx`, `SummaryRibbon.tsx`, `DashboardGrid.tsx`, `ExpandedModal.tsx`, `SettingsPanel.tsx`, `BottomNav.tsx`
- Depends on: Context hooks, types, shared components, widget components (DashboardGrid imports all widgets)
- Used by: `src/App.tsx`
- Purpose: Domain-specific data display panels, each receiving typed props from DashboardGrid
- Location: `src/components/widgets/`
- Contains: `YieldCurveChart.tsx`, `RatesPanel.tsx`, `EquitiesPanel.tsx`, `FXPanel.tsx`, `CommoditiesPanel.tsx`, `CreditPanel.tsx`, `InflationPanel.tsx`, `EconomicCalendar.tsx`, `FedWatchWidget.tsx`, `NewsWidget.tsx`
- Depends on: `src/components/shared/Widget.tsx`, `src/types/index.ts`, Recharts
- Used by: `src/components/layout/DashboardGrid.tsx`
- Purpose: Reusable primitives used across multiple widgets
- Location: `src/components/shared/`
- Contains: `Widget.tsx` (card shell with drag handle, skeleton loader, error/retry UI), `SparklineChart.tsx` (mini Recharts line chart), `ChangeIndicator.tsx`
- Depends on: `src/types/index.ts`, Recharts, Lucide icons
- Used by: All widget components
- Purpose: Single source of truth for all shared interfaces and union types
- Location: `src/types/index.ts`
- Contains: `PriceItem`, `TimeSeriesPoint`, `YieldCurveData`, `EconomicEvent`, `NewsItem`, `MarketData`, `WidgetId`, `WidgetConfig`, `DashboardSettings`, `WidgetStatus`, `WidgetStatuses`, `FomcData`
- Depends on: nothing
- Used by: Every other module in the codebase
## Data Flow
- Equities, FX, commodities: every 60 seconds via `TWELVE_REST_REFRESH_MS`
- News: every 5 minutes via `NEWS_REFRESH_MS`
- Rates, yields, credit: every 24 hours via `FRED_REFRESH_MS`
- Inflation: every 24 hours, skipping update if `dataThrough` date is unchanged
- Calendar/FOMC: smart scheduling — fires at 8:35 AM ET or every 2 hours, whichever comes first
- Server data: owned by `useMarketData` hook (local `useState`), passed down as props — no global data store
- Theme preference: `ThemeContext` backed by `localStorage` key `macro-theme`
- Widget layout settings: `DashboardContext` backed by `localStorage` key `macro-dashboard-settings`, with `DEFAULT_WIDGETS` merged on load to handle new widget additions
## Key Abstractions
- Purpose: Provides the standard card chrome for every panel — title bar, drag handle, expand button, skeleton loader, and error/retry state
- Pattern: Render-prop style — wraps `children` and shows skeleton or error UI based on `status.state`
- Examples: Used by every file in `src/components/widgets/`
- Purpose: Per-widget loading state discriminated union (`loading | loaded | error`)
- Pattern: Each async fetch in `useMarketData` sets its widget's status before, on success, and on failure; `Widget` reads the status to decide what to render
- Purpose: Prevent duplicate API calls within TTL windows across re-renders and intervals
- Pattern: Module-level singleton, string keys formatted as `provider:seriesId:params`, TTL constants exported as `TTL.*`
- Pattern: Each service exports named async functions returning typed domain objects. All use the shared `cache` singleton. All fall back to `mockMarketData` values on error rather than throwing to callers.
## Entry Points
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves module graph
- Responsibilities: Creates React root, renders `<App>` in StrictMode
- Location: `src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Wraps providers, calls `useMarketData`, manages `settingsOpen` and `expandedWidget` UI state, composes layout
- Location: `src/hooks/useMarketData.ts`
- Triggers: Called in `DashboardApp` component body
- Responsibilities: Mounts WebSocket, schedules all polling intervals, exposes `{ data, statuses, loading, lastUpdated, refresh, retryWidget }`
## Error Handling
- Service functions return `DataResult<T>` instead of raw `T` — discriminated union with `status: 'ok'` (data) or `status: 'error'` (message)
- Internal service helpers (e.g., `fetchSeries`, `tdFetch`, `finnhubFetch`) throw on failure; exported functions catch and wrap in DataResult
- `useMarketData` fetch callbacks unwrap DataResult via status narrowing and set per-widget `WidgetStatus`
- `Widget` renders an `AlertCircle` + "Retry" button when `status.state === 'error'`
- `retryWidget(key)` dispatches the appropriate fetch callback to allow per-widget manual retry
- `Promise.allSettled` is used in multi-source fetches; partial success returns `source: 'partial'` with warnings
- Rate limit 429 responses trigger exponential backoff via `rateLimiter` singleton
- Zod schemas validate all raw API responses; validation failures produce `DataResult.error`
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
