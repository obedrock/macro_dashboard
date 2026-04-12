# Codebase Structure

**Analysis Date:** 2026-04-08

## Directory Layout

```
macro_dashboard/
├── index.html                        # Vite HTML entry point
├── package.json                      # Dependencies and scripts
├── vite.config.ts                    # Vite build configuration
├── tsconfig.json                     # Root TS config (references app + node)
├── tsconfig.app.json                 # App TypeScript config
├── tsconfig.node.json                # Node/Vite plugin TypeScript config
├── tailwind.config.js                # Tailwind CSS configuration
├── postcss.config.js                 # PostCSS (Tailwind + Autoprefixer)
├── eslint.config.js                  # ESLint flat config
├── .gitignore
├── README.md
├── .bolt/                            # Bolt.new project metadata (not committed source)
├── .planning/
│   └── codebase/                     # GSD analysis documents
└── src/
    ├── main.tsx                      # React root mount
    ├── App.tsx                       # Root component, provider composition
    ├── index.css                     # Global styles / Tailwind directives
    ├── vite-env.d.ts                 # Vite env type declarations
    ├── types/
    │   └── index.ts                  # All shared TypeScript interfaces and types
    ├── data/
    │   └── mockData.ts               # Static fallback data + time-series fixtures
    ├── context/
    │   ├── ThemeContext.tsx           # Dark/light theme (localStorage-backed)
    │   └── DashboardContext.tsx      # Widget visibility and order (localStorage-backed)
    ├── hooks/
    │   └── useMarketData.ts          # Data fetching orchestration hook
    ├── services/
    │   ├── cache.ts                  # In-memory TTL cache singleton
    │   ├── twelveDataService.ts      # TwelveData REST + WebSocket (equities, FX, commodities)
    │   ├── fredService.ts            # FRED API (yields, inflation, credit spreads)
    │   ├── finnhubService.ts         # Finnhub API (news, calendar, FOMC)
    │   └── massiveService.ts         # Massive.com API (alternative forex/treasury)
    └── components/
        ├── layout/
        │   ├── Header.tsx            # Top bar with logo, theme toggle, settings button
        │   ├── SummaryRibbon.tsx     # Sticky scrollable ticker strip
        │   ├── DashboardGrid.tsx     # Responsive grid, drag-to-reorder, widget switcher
        │   ├── ExpandedModal.tsx     # Full-screen chart modal for any widget
        │   ├── SettingsPanel.tsx     # Widget visibility and order configuration panel
        │   └── BottomNav.tsx         # Mobile bottom navigation bar
        ├── shared/
        │   ├── Widget.tsx            # Card shell: header, drag handle, skeleton, error UI
        │   ├── SparklineChart.tsx    # Mini Recharts line chart for inline trends
        │   └── ChangeIndicator.tsx   # Coloured up/down change display
        └── widgets/
            ├── YieldCurveChart.tsx   # Multi-overlay yield curve (Recharts)
            ├── RatesPanel.tsx        # Treasury yields + spreads list
            ├── EquitiesPanel.tsx     # Major equity index prices
            ├── FXPanel.tsx           # FX pair prices
            ├── CommoditiesPanel.tsx  # Commodity prices
            ├── CreditPanel.tsx       # HY/IG OAS credit spread sparklines
            ├── InflationPanel.tsx    # CPI/PCE/breakeven metrics with sparklines
            ├── EconomicCalendar.tsx  # Upcoming economic events table
            ├── FedWatchWidget.tsx    # FOMC meeting rate probabilities
            └── NewsWidget.tsx        # Macro news headlines with sentiment tags
```

## Directory Purposes

**`src/types/`:**
- Purpose: Single-file type registry for the entire application
- Contains: All exported interfaces and union types (`MarketData`, `PriceItem`, `WidgetId`, `WidgetStatus`, etc.)
- Key files: `src/types/index.ts`
- Rule: Every shared type lives here. No inline types that need reuse elsewhere.

**`src/data/`:**
- Purpose: Static mock/fallback data used as initial state and API error fallbacks
- Contains: `mockMarketData` (full `MarketData`), named series (`rateHistorySeries`, `sp500Series`, `dxySeries`, `wtiSeries`), `mockNews`, `mockEconomicCalendar`, `mockFomcData`
- Key files: `src/data/mockData.ts`
- Rule: Never import from services in this directory. Data here must be pure static values.

**`src/context/`:**
- Purpose: React Context providers for cross-cutting app state that does not belong to any single component
- Contains: `ThemeContext.tsx` (dark/light mode), `DashboardContext.tsx` (widget layout settings)
- Rule: Contexts persist to `localStorage` and expose typed hook exports (`useTheme`, `useDashboard`).

**`src/hooks/`:**
- Purpose: Custom React hooks encapsulating stateful logic
- Contains: `useMarketData.ts` — the only hook currently; owns all market data state, polling, and WebSocket lifecycle
- Rule: Hooks call services; components call hooks. Components never call services directly.

**`src/services/`:**
- Purpose: External API integration and shared in-memory caching
- Contains: One file per external data source, plus `cache.ts`
- Rule: All service functions must handle errors internally and return mock/fallback values rather than rethrowing. All cacheable calls go through `cache.get` / `cache.set` using `TTL.*` constants.

**`src/components/layout/`:**
- Purpose: Structural components that compose the overall page chrome
- Contains: Header, ribbon, grid, modal, settings panel, bottom nav
- Rule: Layout components receive data as props from `App.tsx`. They orchestrate widget rendering but contain no data-fetching logic.

**`src/components/widgets/`:**
- Purpose: One component per dashboard panel, responsible for presenting a specific market data category
- Contains: Ten domain-specific display panels
- Rule: Every widget must accept a `status: WidgetStatus` prop and delegate loading/error rendering to `Widget.tsx`. Widgets receive typed data slices as props — they never access `MarketData` directly.

**`src/components/shared/`:**
- Purpose: Reusable UI primitives shared across multiple widgets
- Contains: `Widget.tsx` (card shell), `SparklineChart.tsx` (inline chart), `ChangeIndicator.tsx`
- Rule: Shared components must be purely presentational — no context access, no API calls.

## Key File Locations

**Entry Points:**
- `index.html`: Vite HTML shell, mounts `#root`
- `src/main.tsx`: React root, `createRoot` + `StrictMode`
- `src/App.tsx`: Provider composition, `useMarketData` call, layout assembly

**Configuration:**
- `vite.config.ts`: Vite + React plugin config
- `tailwind.config.js`: Tailwind content paths and theme extensions
- `tsconfig.app.json`: TypeScript strict settings for source code
- `eslint.config.js`: ESLint flat config

**Core Logic:**
- `src/hooks/useMarketData.ts`: All data fetching, polling, WebSocket, per-widget statuses
- `src/services/cache.ts`: TTL cache + TTL constants used by all services
- `src/types/index.ts`: All shared types

**Data Fallbacks:**
- `src/data/mockData.ts`: Default values used as initial state and error fallbacks

**Shared UI:**
- `src/components/shared/Widget.tsx`: Card shell — wrap every new widget in this
- `src/components/shared/SparklineChart.tsx`: Use for any inline trend line

**Grid / Routing:**
- `src/components/layout/DashboardGrid.tsx`: Switch statement mapping `WidgetId` to component instances; add new widgets here

## Naming Conventions

**Files:**
- React components: PascalCase matching the component name — `YieldCurveChart.tsx`, `SummaryRibbon.tsx`
- Hooks: camelCase prefixed with `use` — `useMarketData.ts`
- Services: camelCase with `Service` or `service` suffix — `fredService.ts`, `twelveDataService.ts`
- Utilities/data: camelCase — `mockData.ts`, `cache.ts`

**Components:**
- Named exports for context providers and hooks; default export for every component file
- Props interfaces named `Props` (local to each file, not exported)

**Types:**
- Interfaces: PascalCase — `PriceItem`, `MarketData`, `WidgetStatus`
- Union types: PascalCase — `WidgetId`, `WidgetLoadState`
- Exported type aliases: PascalCase

**Variables / Functions:**
- camelCase throughout — `fetchEquities`, `buildRibbonFromWs`, `lastPrices`
- Constants: SCREAMING_SNAKE_CASE for module-level timing constants — `TWELVE_REST_REFRESH_MS`, `NEWS_REFRESH_MS`
- Cache keys: colon-namespaced strings — `"fred:CPIAUCSL:60"`, `"finnhub:news:general"`

## Where to Add New Code

**New widget panel:**
1. Create `src/components/widgets/MyNewWidget.tsx` — accept typed data props and `status: WidgetStatus`, wrap content in `<Widget>`
2. Add the widget's data slice to `MarketData` in `src/types/index.ts`
3. Add the `WidgetId` union member to `WidgetId` in `src/types/index.ts`
4. Add the status key to `WidgetStatuses` in `src/types/index.ts`
5. Add mock/fallback data to `src/data/mockData.ts`
6. Add a fetch function in the appropriate service file (or create a new one in `src/services/`)
7. Add the fetch callback and polling interval to `src/hooks/useMarketData.ts`
8. Register the widget in `src/components/layout/DashboardGrid.tsx` switch statement
9. Add default `WidgetConfig` entry to `DEFAULT_WIDGETS` in `src/context/DashboardContext.tsx`

**New external API integration:**
1. Create `src/services/myProviderService.ts`
2. Import and use the `cache` singleton from `src/services/cache.ts` with a TTL from `TTL.*` (add a new constant if needed)
3. Return fallback from `src/data/mockData.ts` in all catch blocks
4. Export named async functions returning types from `src/types/index.ts`
5. Import and call from `src/hooks/useMarketData.ts`

**New shared UI primitive:**
- Place in `src/components/shared/` — keep it purely presentational (no context, no hooks beyond `useState`)

**New time-series chart fixture:**
- Add to `src/data/mockData.ts` using the existing `genSeries` helper

## Special Directories

**`.planning/`:**
- Purpose: GSD architecture and planning documents
- Generated: No (manually maintained by GSD tooling)
- Committed: Yes

**`.bolt/`:**
- Purpose: Bolt.new IDE project metadata
- Generated: Yes (by Bolt.new)
- Committed: Yes (present in repo), but not application source

---

*Structure analysis: 2026-04-08*
