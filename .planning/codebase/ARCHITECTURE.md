# Architecture

**Analysis Date:** 2026-04-08

## Pattern Overview

**Overall:** Single-Page Application (SPA) with a service-layer data pipeline

**Key Characteristics:**
- React component tree with two React Context providers at root for global state
- A single custom hook (`useMarketData`) owns all async data fetching, polling, and per-widget load state
- External API calls are isolated in dedicated service modules; components never call APIs directly
- Mock data in `src/data/mockData.ts` doubles as both dev fallback and type-conforming default state
- In-memory TTL cache (`src/services/cache.ts`) sits between hooks and services to deduplicate API calls

## Layers

**Entry / Bootstrap:**
- Purpose: Mount React root, apply global CSS
- Location: `src/main.tsx`, `index.html`
- Contains: ReactDOM render call, CSS import
- Depends on: App component, Tailwind base styles
- Used by: Browser

**Context (Global State):**
- Purpose: Theme preference and dashboard widget configuration (visibility, order)
- Location: `src/context/ThemeContext.tsx`, `src/context/DashboardContext.tsx`
- Contains: React Context + Provider components, localStorage persistence
- Depends on: `src/types/index.ts`
- Used by: All layout and widget components via `useTheme()` and `useDashboard()` hooks

**Data Hook:**
- Purpose: Orchestrate all market data fetching, manage per-widget load state, schedule polling intervals
- Location: `src/hooks/useMarketData.ts`
- Contains: Per-widget fetch functions wrapped in `useCallback`, interval and WebSocket lifecycle via `useEffect`, `retryWidget` dispatch
- Depends on: All three service modules, `src/data/mockData.ts`, `src/types/index.ts`
- Used by: `src/App.tsx` (single consumer; data and statuses are prop-drilled down)

**Services:**
- Purpose: Fetch and normalise data from external APIs; apply cache
- Location: `src/services/`
  - `twelveDataService.ts` — REST quotes and WebSocket tick feed (equities, FX, commodities, rates)
  - `fredService.ts` — FRED series observations (yields, inflation, credit spreads)
  - `finnhubService.ts` — News headlines, economic calendar, FOMC dates
  - `massiveService.ts` — Alternative Forex/treasury data provider (secondary/unused in main hook)
  - `cache.ts` — In-memory TTL cache singleton shared by all services
- Depends on: `src/types/index.ts`, `src/data/mockData.ts`, `src/services/cache.ts`
- Used by: `src/hooks/useMarketData.ts`

**Mock / Fallback Data:**
- Purpose: Provide shape-correct default values that prevent blank renders when APIs fail
- Location: `src/data/mockData.ts`
- Contains: `mockMarketData` (full `MarketData` object), `mockNews`, `mockEconomicCalendar`, `mockFomcData`, and named time-series exports (`rateHistorySeries`, `sp500Series`, `dxySeries`, `wtiSeries`)
- Depends on: `src/types/index.ts`
- Used by: `useMarketData` initial state, all service modules as error fallback, `ExpandedModal` for chart series

**Layout Components:**
- Purpose: Structural chrome — header, sticky ribbon ticker, responsive widget grid, modal overlay, bottom nav, settings panel
- Location: `src/components/layout/`
- Contains: `Header.tsx`, `SummaryRibbon.tsx`, `DashboardGrid.tsx`, `ExpandedModal.tsx`, `SettingsPanel.tsx`, `BottomNav.tsx`
- Depends on: Context hooks, types, shared components, widget components (DashboardGrid imports all widgets)
- Used by: `src/App.tsx`

**Widget Components:**
- Purpose: Domain-specific data display panels, each receiving typed props from DashboardGrid
- Location: `src/components/widgets/`
- Contains: `YieldCurveChart.tsx`, `RatesPanel.tsx`, `EquitiesPanel.tsx`, `FXPanel.tsx`, `CommoditiesPanel.tsx`, `CreditPanel.tsx`, `InflationPanel.tsx`, `EconomicCalendar.tsx`, `FedWatchWidget.tsx`, `NewsWidget.tsx`
- Depends on: `src/components/shared/Widget.tsx`, `src/types/index.ts`, Recharts
- Used by: `src/components/layout/DashboardGrid.tsx`

**Shared Components:**
- Purpose: Reusable primitives used across multiple widgets
- Location: `src/components/shared/`
- Contains: `Widget.tsx` (card shell with drag handle, skeleton loader, error/retry UI), `SparklineChart.tsx` (mini Recharts line chart), `ChangeIndicator.tsx`
- Depends on: `src/types/index.ts`, Recharts, Lucide icons
- Used by: All widget components

**Type Definitions:**
- Purpose: Single source of truth for all shared interfaces and union types
- Location: `src/types/index.ts`
- Contains: `PriceItem`, `TimeSeriesPoint`, `YieldCurveData`, `EconomicEvent`, `NewsItem`, `MarketData`, `WidgetId`, `WidgetConfig`, `DashboardSettings`, `WidgetStatus`, `WidgetStatuses`, `FomcData`
- Depends on: nothing
- Used by: Every other module in the codebase

## Data Flow

**Initial Load:**
1. `src/main.tsx` mounts `<App>` inside `ThemeProvider` and `DashboardProvider`
2. `App.tsx` calls `useMarketData()` which initialises state to `mockMarketData` and `DEFAULT_STATUSES` (all `loading`)
3. On mount, `useMarketData` fires parallel fetch callbacks for all data categories and opens a WebSocket to TwelveData
4. Each fetch function calls the appropriate service function (which checks the in-memory cache first)
5. On success, `setData` merges the new slice into the `MarketData` object via `prev => ({ ...prev, [key]: value })`
6. The corresponding `WidgetStatus` entry flips from `loading` to `loaded`
7. `App.tsx` passes `data`, `statuses`, `lastUpdated`, `refresh`, and `retryWidget` as props to layout components

**Live Updates (WebSocket):**
1. `twelveDataService.ts` maintains a module-level WebSocket singleton (`ws`) with auto-reconnect
2. Price ticks for `SPY`, `CL1:COM`, `XAU/USD` (and others) update `lastPrices` and `prevPrices` maps in the service module
3. The `subscribeWebSocket` callback in `useMarketData` calls `buildRibbonFromWs` to reconstruct the ribbon array on each tick
4. The ribbon `WidgetStatus` is set to `loaded` on first qualifying tick (or after an 8-second timeout)

**Polling:**
- Equities, FX, commodities: every 60 seconds via `TWELVE_REST_REFRESH_MS`
- News: every 5 minutes via `NEWS_REFRESH_MS`
- Rates, yields, credit: every 24 hours via `FRED_REFRESH_MS`
- Inflation: every 24 hours, skipping update if `dataThrough` date is unchanged
- Calendar/FOMC: smart scheduling — fires at 8:35 AM ET or every 2 hours, whichever comes first

**State Management:**
- Server data: owned by `useMarketData` hook (local `useState`), passed down as props — no global data store
- Theme preference: `ThemeContext` backed by `localStorage` key `macro-theme`
- Widget layout settings: `DashboardContext` backed by `localStorage` key `macro-dashboard-settings`, with `DEFAULT_WIDGETS` merged on load to handle new widget additions

## Key Abstractions

**`Widget` shell (`src/components/shared/Widget.tsx`):**
- Purpose: Provides the standard card chrome for every panel — title bar, drag handle, expand button, skeleton loader, and error/retry state
- Pattern: Render-prop style — wraps `children` and shows skeleton or error UI based on `status.state`
- Examples: Used by every file in `src/components/widgets/`

**`WidgetStatus` (`src/types/index.ts`):**
- Purpose: Per-widget loading state discriminated union (`loading | loaded | error`)
- Pattern: Each async fetch in `useMarketData` sets its widget's status before, on success, and on failure; `Widget` reads the status to decide what to render

**`DataCache` (`src/services/cache.ts`):**
- Purpose: Prevent duplicate API calls within TTL windows across re-renders and intervals
- Pattern: Module-level singleton, string keys formatted as `provider:seriesId:params`, TTL constants exported as `TTL.*`

**Service modules:**
- Pattern: Each service exports named async functions returning typed domain objects. All use the shared `cache` singleton. All fall back to `mockMarketData` values on error rather than throwing to callers.

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves module graph
- Responsibilities: Creates React root, renders `<App>` in StrictMode

**App Shell:**
- Location: `src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Wraps providers, calls `useMarketData`, manages `settingsOpen` and `expandedWidget` UI state, composes layout

**Data Orchestration:**
- Location: `src/hooks/useMarketData.ts`
- Triggers: Called in `DashboardApp` component body
- Responsibilities: Mounts WebSocket, schedules all polling intervals, exposes `{ data, statuses, loading, lastUpdated, refresh, retryWidget }`

## Error Handling

**Strategy:** Per-widget degradation with mock data fallback; errors do not propagate to the global tree

**Patterns:**
- Service functions wrap API calls in try/catch and return `mockMarketData` values on failure rather than rethrowing
- `useMarketData` fetch callbacks catch errors, set `errorStatus(message)` for the relevant widget key
- `Widget` renders an `AlertCircle` + "Retry" button when `status.state === 'error'`
- `retryWidget(key)` dispatches the appropriate fetch callback to allow per-widget manual retry
- `Promise.allSettled` is used in multi-source fetches (e.g. `fetchRates`, `fetchCalendar`) so one failing source does not block others

## Cross-Cutting Concerns

**Logging:** No structured logging framework; all errors are silently caught and surfaced through `WidgetStatus.error` strings in the UI

**Validation:** No runtime schema validation of API responses; type guards (e.g. `isTdQuote`) used selectively in `twelveDataService.ts`

**Authentication:** API keys loaded from Vite env vars (`import.meta.env.VITE_*`); passed directly in query strings or request headers — no OAuth flows

**Theming:** `ThemeContext` provides `isDark: boolean`; Tailwind dark-mode classes applied inline via template literals; no CSS variables

---

*Architecture analysis: 2026-04-08*
