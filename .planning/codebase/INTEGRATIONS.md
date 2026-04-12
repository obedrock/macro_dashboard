# External Integrations

**Analysis Date:** 2026-04-08

## APIs & External Services

### Twelve Data
- **Purpose:** Real-time and historical quotes for equities (ETFs as index proxies), FX pairs, commodities, and US Treasury rates; also provides a WebSocket feed for live tick-level price streaming
- **SDK/Client:** Native `fetch` for REST; native `WebSocket` for streaming
- **REST Base URL:** `https://api.twelvedata.com`
- **WebSocket URL:** `wss://ws.twelvedata.com/v1/quotes/price?apikey=...`
- **Auth:** API key appended as `?apikey={key}` on all requests; env var `VITE_TWELVEDATA_API_KEY`
- **Implementation:** `src/services/twelveDataService.ts`
- **Endpoints used:**
  - `GET /quote?symbol={sym}&dp=4` — single and batch closing quotes
  - `GET /time_series?symbol={sym}&interval={i}&outputsize={n}&dp=4` — OHLCV history
  - WebSocket subscription with `{action: "subscribe", params: {symbols: "SPY,QQQ,DIA,IWM,CL1:COM,XAU/USD,XAG/USD,HG1:COM"}}`
- **Refresh cadence:** REST polls every 60 seconds; WebSocket is persistent with 5-second auto-reconnect on close
- **Widgets served:** Equities panel, FX panel, Commodities panel, Rates panel (Treasury yields), Summary Ribbon (live ticks)
- **Cache TTL:** 60,000 ms (1 minute) for REST responses via in-memory cache in `src/services/cache.ts`

### FRED (Federal Reserve Bank of St. Louis)
- **Purpose:** Macroeconomic time series — Fed Funds rate, Treasury yields (full curve), TIPS breakeven rates, VIX, CPI, Core CPI, PCE, Core PCE, HY/IG credit spreads, Fed balance sheet assets
- **SDK/Client:** Native `fetch`
- **Base URL:** `https://api.stlouisfed.org/fred`
- **Auth:** `?api_key={key}` query parameter; env var `VITE_FRED_API_KEY`
- **Implementation:** `src/services/fredService.ts`
- **Endpoints used:**
  - `GET /fred/series/observations?series_id={id}&api_key={key}&file_type=json&sort_order=desc&limit={n}`
- **Series fetched:**
  - `DFEDTARU` — Fed Funds rate (upper bound)
  - `DGS1MO`, `DGS3MO`, `DGS6MO`, `DGS1`, `DGS2`, `DGS3`, `DGS5`, `DGS7`, `DGS10`, `DGS20`, `DGS30` — Treasury yield curve maturities
  - `T10YIE` — 10-year TIPS breakeven
  - `T5YIE` — 5-year TIPS breakeven
  - `EXPINF1YR` — 1-year inflation expectation (Cleveland Fed model)
  - `VIXCLS` — VIX closing price
  - `BAMLH0A0HYM2` — High-yield OAS spread
  - `BAMLC0A0CM` — Investment-grade OAS spread
  - `CPIAUCSL`, `CPILFESL` — CPI (All Items, Core)
  - `PCEPI`, `PCEPILFE` — PCE (All Items, Core)
  - `WALCL`, `TREAST`, `WSHOMCB` — Fed balance sheet (total assets, Treasuries, MBS)
- **Refresh cadence:** 24-hour interval for all FRED data; overlay yield curve data cached per target date
- **Widgets served:** Rates panel, Yield Curve panel, Credit Spreads panel, Inflation panel
- **Cache TTL:** 86,400,000 ms (24 hours) for observations; individual yield-on-date fetches also cached 24 hours

### Finnhub
- **Purpose:** Financial news headlines and economic calendar events; FOMC meeting dates are hardcoded (2026 schedule) with Finnhub used as calendar source for US macro events
- **SDK/Client:** Native `fetch`
- **Base URL:** `https://finnhub.io/api/v1`
- **Auth:** `X-Finnhub-Token` request header; env var `VITE_FINNHUB_API_KEY`
- **Implementation:** `src/services/finnhubService.ts`
- **Endpoints used:**
  - `GET /news?category=general` — general financial news (up to 20 items)
  - `GET /calendar/economic?from={date}&to={date}` — US economic events for next 45 days
- **Refresh cadence:** News refreshes every 5 minutes; economic calendar refreshes at the earlier of 2-hour intervals or 8:35 AM ET daily
- **Widgets served:** Macro News widget, Economic Calendar widget, Fed Watch widget
- **Cache TTL:** 300,000 ms (5 min) for news; 21,600,000 ms (6 hours) for calendar and Fed Watch

### Massive.com
- **Purpose:** Previous-day forex aggregates (used for Gold and Silver spot prices) and US Treasury yield snapshots
- **SDK/Client:** `@massive.com/client-js` ^10.6.0 — `restClient` factory; aliased in `vite.config.ts` to `node_modules/@massive.com/client-js/dist/main.js`
- **Auth:** API key passed to `restClient(API_KEY)`; env var `VITE_MASSIVE_API_KEY`
- **Implementation:** `src/services/massiveService.ts`
- **Client methods used:**
  - `client.getPreviousForexAggregates({ forexTicker })` — previous session OHLCV for `C:XAUUSD`, `C:XAGUSD`
  - `client.getFedV1TreasuryYields({ limit: 2, sort: 'date.desc' })` — latest Treasury yield snapshot (all maturities)
- **Rate limiting:** 1,500 ms enforced between API calls (module-level `lastCallTime` guard in `massiveService.ts`)
- **Widgets served:** Commodities panel (Gold, Silver), Rates panel (Treasury yield fallback), Yield Curve panel (current curve fallback)
- **Cache TTL:** 300,000 ms (5 minutes)

## Data Storage

**Databases:**
- None — no database is used at runtime

**In-Memory Cache:**
- Custom `DataCache` class in `src/services/cache.ts`
- TTL-based, Map-backed, per-widget keyed entries
- Scoped to browser session; cleared on page reload
- TTL constants: `TWELVEDATA_REST` (1 min), `FINNHUB` (5 min), `FINNHUB_CALENDAR` (6 hr), `FRED` (24 hr), `MASSIVE` (5 min)

**Browser Persistence:**
- `localStorage` key `macro-dashboard-settings` — stores widget visibility, order, and default time range (managed by `src/context/DashboardContext.tsx`)
- `localStorage` key `macro-theme` — stores `'dark'` or `'light'` preference (managed by `src/context/ThemeContext.tsx`)

**File Storage:**
- Local filesystem only — mock data in `src/data/mockData.ts` used as fallback when APIs fail or return insufficient data

## Authentication & Identity

**Auth Provider:**
- None — the app has no user authentication or session management
- `@supabase/supabase-js` ^2.57.4 is listed as a dependency in `package.json` but is not imported anywhere in `src/`; it appears to be an unused/planned dependency

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or similar service is configured

**Logs:**
- No structured logging; errors from API calls are caught silently and trigger fallback to `mockData.ts`. Widget-level error state is surfaced to the UI via `WidgetStatus` (`state: 'error'`, `error: string`) in `src/hooks/useMarketData.ts`

## CI/CD & Deployment

**Hosting:**
- Not configured — no deployment config files present (no Vercel, Netlify, or similar config)
- App built with `vite build` as a static SPA into `dist/`

**CI Pipeline:**
- None detected — no GitHub Actions workflows or CI config present

## Environment Configuration

**Required env vars (all prefixed `VITE_` for Vite client exposure):**
- `VITE_FINNHUB_API_KEY` — Finnhub REST API key
- `VITE_FRED_API_KEY` — FRED API key (St. Louis Fed)
- `VITE_MASSIVE_API_KEY` — Massive.com client key
- `VITE_TWELVEDATA_API_KEY` — Twelve Data REST + WebSocket key

**Secrets location:**
- `.env` file at project root (not committed; not present in working tree)
- All keys are exposed to the browser bundle at build time (standard Vite `VITE_*` pattern — suitable only for public API keys with CORS-level protection)

## Webhooks & Callbacks

**Incoming:**
- None — the app does not expose any webhook endpoints (it is a purely client-side SPA)

**Outgoing:**
- WebSocket subscription to Twelve Data (`wss://ws.twelvedata.com/v1/quotes/price`) is the only persistent outbound connection; it is reconnected automatically in `src/services/twelveDataService.ts`

---

*Integration audit: 2026-04-08*
