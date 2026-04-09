# Codebase Concerns

**Analysis Date:** 2026-04-08

---

## Tech Debt

**Brent Crude price is fabricated from WTI + a fixed spread:**
- Issue: Brent Crude is never fetched from any API. Instead it is always set to `WTI close + 2.57`. This constant offset does not reflect the real Brent/WTI spread, which fluctuates.
- Files: `src/services/twelveDataService.ts` (lines 237–244)
- Impact: The Brent Crude value displayed to users is always wrong except by coincidence. The change/changePct values copied from WTI are also incorrect for Brent.
- Fix approach: Fetch `UKOIL` or `BNO` from TwelveData, or drop Brent from the commodities panel.

**DXY is always served as a fallback value and never fetched live:**
- Issue: `getTwelveFX()` immediately sets `dxyFallback` from `mockMarketData.fx[0]` and returns it unconditionally. No API call is made for DXY.
- Files: `src/services/twelveDataService.ts` (lines 203–211)
- Impact: DXY shown in the FX panel is permanently stale mock data.
- Fix approach: Add DXY to the batch quote call using symbol `DX-Y.NYB` or the TwelveData equivalent.

**`massiveService.ts` is dead code:**
- Issue: The Massive.com service (`src/services/massiveService.ts`) is fully implemented but never imported or called anywhere in `useMarketData.ts` or any other file. The `@massive.com/client-js` package is bundled but unused.
- Files: `src/services/massiveService.ts`, `package.json`, `vite.config.ts`
- Impact: Adds dead weight to the bundle and a vite alias workaround that serves no purpose. The `@supabase/supabase-js` dependency in `package.json` is similarly unused — no supabase import exists anywhere in `src/`.
- Fix approach: Remove `massiveService.ts`, the `@massive.com/client-js` and `@supabase/supabase-js` dependencies, and the vite alias.

**`EquitiesPanel` period multiplier is a fake approximation:**
- Issue: The `PERIOD_MULT` multiplier (`{ D: 1, W: 5, M: 22 }`) naively multiplies the daily change by 5 or 22 to simulate weekly/monthly change. Real weekly and monthly changes require historical close data, not arithmetic scaling.
- Files: `src/components/widgets/EquitiesPanel.tsx` (lines 7–25)
- Impact: The 1W and 1M values in the equities panel are fabricated and will mislead users. This is especially misleading for VIX, whose weekly/monthly behavior is non-linear.
- Fix approach: Fetch time-series data for each equity and compute real period returns. Remove the multiplier approach.

**`RatesPanel` and `YieldCurveChart` hardcode spread values instead of computing them from live data:**
- Issue: Both widgets display hardcoded strings (`"+30.5 bps"`, `"+49.6 bps"`, `"-72.7 bps"`) for 2s10s, 2s30s, and 3m10y spreads. These do not update even when live rate data loads successfully.
- Files: `src/components/widgets/RatesPanel.tsx` (line 51), `src/components/widgets/YieldCurveChart.tsx` (lines 133–143)
- Impact: The spread labels at the bottom of both widgets display stale placeholder data indefinitely, contradicting the live data shown above them.
- Fix approach: Derive spread values from the `data` prop at render time: `(y10 - y2) * 100`, etc.

**`FedWatchWidget` CME probabilities are entirely mock data:**
- Issue: `getFinnhubFedWatch()` in `src/services/finnhubService.ts` (lines 185–202) never makes an API call. It only adjusts FOMC meeting *dates* from a hardcoded 2026 list and then re-returns `mockFomcData` probabilities unchanged. The widget subtitle "CME Implied Probabilities" is therefore false.
- Files: `src/services/finnhubService.ts` (lines 185–202), `src/data/mockData.ts`
- Impact: All rate-cut/hold/hike probabilities displayed to users are fictional. This is the highest-value widget for a macro dashboard and it displays no real data.
- Fix approach: Integrate a real CME FedWatch data source (e.g., CME Group API, or a third-party feed), or clearly label the widget as "Illustrative" until a real source is available.

**`FOMC_DATES_2026` is a static list that will go stale:**
- Issue: FOMC meeting dates for 2026 are hardcoded in `src/services/finnhubService.ts` (lines 155–164). The year 2027 and beyond have no dates.
- Files: `src/services/finnhubService.ts` (lines 155–183)
- Impact: After December 2026, `getUpcomingFomcDates()` will fall back to returning the first three 2026 dates, which will all be in the past.
- Fix approach: Either fetch FOMC dates dynamically from a source (Finnhub calendar, FRED), or maintain a multi-year static list updated annually.

**`InflationPanel` re-declares a local `InflationItem` interface that duplicates the one in `fredService.ts`:**
- Issue: `src/components/widgets/InflationPanel.tsx` defines its own local `InflationItem` interface instead of importing `InflationItem` from `src/services/fredService.ts`. They are structurally identical.
- Files: `src/components/widgets/InflationPanel.tsx` (lines 6–13), `src/services/fredService.ts` (lines 128–135)
- Impact: If the shape of `InflationItem` changes in `fredService.ts`, the panel interface must be updated separately. Drift between the two is likely.
- Fix approach: Export `InflationItem` from `fredService.ts` and import it in `InflationPanel.tsx`.

**`CreditPanel` re-declares a local `CreditItem` interface that duplicates the one in `fredService.ts`:**
- Issue: Same pattern as above — `src/components/widgets/CreditPanel.tsx` defines `CreditItem` locally instead of importing `CreditItem` from `src/services/fredService.ts`.
- Files: `src/components/widgets/CreditPanel.tsx` (lines 7–11), `src/services/fredService.ts` (lines 89–94)
- Impact: Type drift between service and component is silent at compile time because the shapes currently match, but any future divergence will not produce a type error at the service boundary.
- Fix approach: Export `CreditItem` from `fredService.ts` and import it where needed.

**`useMarketData` `calendarTimer` type cast is unsafe:**
- Issue: In `src/hooks/useMarketData.ts` (lines 316–332), `calendarTimer` is declared with a union type `ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>`, then force-cast in both cleanup calls. When the timer is a `setInterval` handle, calling `clearTimeout` on it (and vice versa) is a runtime no-op in Node but may behave unexpectedly in some environments.
- Files: `src/hooks/useMarketData.ts` (lines 316–332)
- Impact: Low — browsers silently tolerate mismatched clear calls — but the code is semantically incorrect.
- Fix approach: Store the timeout and interval handles separately with distinct variables.

**`msUntilNextCalendarRefresh()` hardcodes ET as UTC-5, ignoring daylight saving time:**
- Issue: The function computes Eastern Time by subtracting 5 hours from UTC (`etOffset = -5 * 60`). EDT is UTC-4.
- Files: `src/hooks/useMarketData.ts` (lines 34–48)
- Impact: During EDT (March–November), the calendar refresh targeted at 8:35 AM ET will fire at 9:35 AM ET instead.
- Fix approach: Use `toLocaleString('en-US', { timeZone: 'America/New_York' })` to obtain the true ET hour instead of a fixed offset.

---

## Known Bugs

**`ExpandedModal` always shows mock/static data regardless of which widget is expanded:**
- Symptoms: Opening any widget's expanded view always charts the same static time-series from `mockData.ts` (e.g., `rateHistorySeries`, `sp500Series`, `dxySeries`). Live credit spread or inflation data loaded into the app is never passed through to the modal chart.
- Files: `src/components/layout/ExpandedModal.tsx` (lines 43–55)
- Trigger: Click any widget's expand icon.
- Workaround: None. The expanded modal is purely decorative with respect to live data.

**`getCountdown()` in `EconomicCalendar` parses the date string it formatted itself — brittle round-trip:**
- Symptoms: `getCountdown` receives `event.date` (formatted by `formatEventDate` as "Apr 8, 2026") and `event.time` (formatted by `formatEventTime` as "8:30 AM ET"). It attempts to manually parse the time string by splitting on `:` and space. If `formatEventDate` produces an unrecognized format, `new Date(dateStr)` will return an invalid date and the countdown shows `'--'`.
- Files: `src/components/widgets/EconomicCalendar.tsx` (lines 14–38), `src/services/finnhubService.ts` (lines 95–113)
- Trigger: Any event with a `time` string that contains "TBD" will cause the split on `':'` to fail at `rest.split(' ')` because `rest` will be undefined.
- Workaround: None — TBD events display `'--'` which is the catch fallback.

**`NewsWidget` "Load more headlines" button has no implementation:**
- Symptoms: Clicking the button does nothing — there is no `onClick` handler and no state change.
- Files: `src/components/widgets/NewsWidget.tsx` (line 69)
- Trigger: Click "Load more headlines" in the News widget.
- Workaround: None.

---

## Security Considerations

**API keys embedded directly in client-side JavaScript bundle:**
- Risk: `VITE_FINNHUB_API_KEY`, `VITE_FRED_API_KEY`, `VITE_TWELVEDATA_API_KEY`, and `VITE_MASSIVE_API_KEY` are accessed via `import.meta.env.*` and are therefore inlined into the browser bundle at build time. Anyone who loads the page can inspect the network requests or the compiled JS and extract these keys.
- Files: `src/services/finnhubService.ts` (line 5), `src/services/fredService.ts` (line 6), `src/services/twelveDataService.ts` (line 5), `src/services/massiveService.ts` (line 6)
- Current mitigation: None. There is no proxy server, no backend, and no key rotation mechanism.
- Recommendations: Route all third-party API requests through a server-side proxy (e.g., a Cloudflare Worker, Vercel Edge Function, or lightweight Express server) that holds the keys in server-side environment variables. Never expose secret keys to the browser bundle.

**`@ts-ignore`-free but all API response types use unsafe casts (`as Promise<T>`):**
- Risk: `finnhubFetch` casts responses via `res.json() as Promise<T>` and `tdFetch` casts via `json as T` without runtime validation. A malformed API response will not throw — it will silently pass malformed data into state.
- Files: `src/services/finnhubService.ts` (line 13), `src/services/twelveDataService.ts` (lines 85–89)
- Current mitigation: Fallback to mock data in catch blocks limits user-visible impact, but parsing errors inside mapped fields (e.g., `parseFloat` on undefined) could still produce `NaN` values displayed to users.
- Recommendations: Add lightweight runtime type guards or use a validation library (e.g., `zod`) for API response schemas.

**External news URLs are opened in `_blank` without additional sanitization:**
- Risk: News `url` values come from the Finnhub API and are passed directly into `href`. The code adds `rel="noopener noreferrer"` which prevents tab-napping. However, URLs are not validated for scheme (e.g., a `javascript:` URL would execute). Finnhub is trusted but this is a latent concern if the news source is ever substituted.
- Files: `src/components/widgets/NewsWidget.tsx` (lines 34–42)
- Current mitigation: `rel="noopener noreferrer"` is present.
- Recommendations: Add a scheme check: only allow `http:` and `https:` URLs before rendering as an anchor.

---

## Performance Bottlenecks

**`getFredYieldCurveOverlays` makes 22 sequential-then-parallel FRED API calls on every `fetchYields` invocation:**
- Problem: `getFredYieldCurveOverlays` maps 11 maturities × 2 historical dates = 22 individual FRED API fetches per call (via `fetchYieldOnDate`). These are batched within each maturity but still generate 22 network requests.
- Files: `src/services/fredService.ts` (lines 343–376)
- Cause: FRED's API does not support multi-series batch requests. Each `series_id` requires its own HTTP call.
- Improvement path: Cache aggressively (already done per TTL.FRED = 24h). Consider reducing the call to once per session for overlay data since it changes very slowly. Alternatively, pre-compute the overlay dates at startup and skip refetches within the same calendar day.

**`getLiveInflation` makes 6 parallel FRED API calls fetching 60 observations each:**
- Problem: Every inflation refresh fires 6 × `fetchSeries('...', 60)` calls. Combined with the yield curve overlay calls, a full data load triggers 30+ simultaneous FRED requests on the first page load.
- Files: `src/services/fredService.ts` (lines 182–248)
- Cause: Each metric requires its own series fetch since FRED has no batch endpoint.
- Improvement path: These are already cached with `TTL.FRED = 24h`, so the 30+ calls only happen once per day. The real fix is to avoid re-fetching inflation data until the cache has expired (the `lastInflationDate` ref in `useMarketData.ts` partially addresses this but does not prevent the initial 6-call burst).

**In-memory cache has no size cap and grows unboundedly:**
- Problem: `DataCache` in `src/services/cache.ts` uses a `Map` with no maximum entry count. Over a long browser session, cache entries accumulate. The yield curve overlay alone adds ~22 entries per day; across all services, hundreds of keys can accumulate.
- Files: `src/services/cache.ts`
- Cause: No LRU eviction, no max size, and expired entries are only pruned on cache read (passive invalidation).
- Improvement path: Add a max-size limit (e.g., 500 entries) with LRU eviction, or add a periodic sweep that deletes all expired entries.

**WebSocket reconnect loop has no backoff or maximum retry limit:**
- Problem: `ws.onclose` immediately schedules `connectWebSocket` after a fixed 5-second delay regardless of how many reconnects have already been attempted. A persistent server-side failure will cause infinite 5-second reconnect cycles for the lifetime of the tab.
- Files: `src/services/twelveDataService.ts` (lines 52–60)
- Cause: No exponential backoff, no retry counter, no max-retry guard.
- Improvement path: Implement exponential backoff (e.g., 5s → 10s → 20s → ... up to 5 minutes) with a cap, and stop retrying after a configurable maximum (e.g., 10 attempts), showing a "live data unavailable" state instead.

---

## Fragile Areas

**`InflationPanel` destructures `data` by fixed positional index:**
- Files: `src/components/widgets/InflationPanel.tsx` (lines 36–37)
- Why fragile: `const [cpi, coreCpi, pce, corePce] = data.slice(0, 4)` and `const expectations = data.slice(4)` assume the array from `getLiveInflation()` always returns exactly 6 items in a fixed order. If any `Promise.allSettled` result in `fredService.ts` changes the returned array shape (e.g., a new metric is added before index 4), the panel will silently display the wrong labels for the wrong data.
- Safe modification: Destructure by `label` property rather than by index. Or enforce the array shape with a named tuple type.
- Test coverage: No tests exist for this mapping.

**`DashboardContext` `localStorage` parse swallows all errors silently:**
- Files: `src/context/DashboardContext.tsx` (lines 42–54)
- Why fragile: The `try/catch` around `JSON.parse(saved)` discards any exception and falls back to `DEFAULT_SETTINGS`. If a user has corrupted or partially-migrated settings in `localStorage` (e.g., from an older version), the widget order and visibility preferences are silently reset on every page load.
- Safe modification: Log the parse error and optionally show a notification; consider versioning the settings schema with a `version` field to detect and migrate stale formats.
- Test coverage: None.

**`calendarTimer` in `useMarketData` is re-assigned from `setTimeout` to `setInterval` mid-lifecycle:**
- Files: `src/hooks/useMarketData.ts` (lines 316–332)
- Why fragile: `calendarTimer` starts as a `setTimeout` handle, then inside the timeout callback it is re-assigned to a `setInterval` handle. The cleanup function calls `clearTimeout(calendarTimer)` and `clearInterval(calendarTimer)` on whatever value `calendarTimer` holds at the time of unmount. If the component unmounts before the first timeout fires, both clears operate on the `setTimeout` handle (correct). If it unmounts after the setInterval is running, the `clearTimeout` is a no-op and `clearInterval` works. The dual-clear is a latent confusion point and easy to break during refactoring.
- Safe modification: Use two separate refs — one for the initial timeout, one for the recurring interval.
- Test coverage: None.

**`buildRibbonFromWs` and `wsToItem` rely on module-level mutable state (`lastPrices`, `prevPrices`):**
- Files: `src/services/twelveDataService.ts` (lines 23–24, 317–339)
- Why fragile: `lastPrices` and `prevPrices` are exported mutable objects. Any code can read or write them, and there is no synchronization guarantee. If the WebSocket fires two messages rapidly, `prevPrices[sym]` may already have been overwritten before `buildRibbonFromWs` reads it.
- Safe modification: Encapsulate price state inside the WebSocket manager and expose it only via callback. Remove the `export const lastPrices` and `prevPrices` exports.
- Test coverage: None.

---

## Scaling Limits

**Three separate API keys with independent rate limits, no request coordination:**
- Current capacity: TwelveData REST refreshes every 60 seconds (equities, FX, commodities = ~9 calls/min); Finnhub refreshes every 5 minutes (news, calendar); FRED refreshes once per 24 hours.
- Limit: TwelveData free tier allows 8 requests/min. The current code makes 5–9 REST calls per 60-second cycle. Heavy usage or multiple open tabs will hit the rate limit and produce error state on all affected widgets.
- Scaling path: Consolidate the TwelveData equities batch call (currently 4 separate `fetchSingleQuote` calls) into one `fetchBatchQuotes` call; the FX panel already does this correctly.

---

## Dependencies at Risk

**`@massive.com/client-js` — unused and requires a vite alias workaround:**
- Risk: The package is bundled but its code is never executed. The `vite.config.ts` contains a manual path alias to resolve its main entry point, suggesting the package does not work with standard ESM resolution. This is a non-standard dependency pattern.
- Files: `package.json`, `vite.config.ts`
- Impact: Increases bundle size, complicates the build config, and any version upgrade of the package may break the alias path.
- Migration plan: Remove the package and the alias. If Massive.com data is needed in the future, re-evaluate the package's ESM support at that time.

**`@supabase/supabase-js` — declared as a dependency but never imported:**
- Risk: The package adds ~120KB to the dependency tree for zero benefit.
- Files: `package.json`
- Impact: Longer `npm install` times, potential supply chain attack surface for an unused dependency.
- Migration plan: Remove from `package.json`.

**`recharts` pinned at `^3.8.1` — major version is relatively new:**
- Risk: Recharts v3 is a significant API change from v2. Breaking changes in minor releases within the `^3.x` range are possible during the early lifecycle of a major version.
- Files: `package.json`
- Impact: A future `npm install` after a recharts patch/minor release could introduce a regression in the `YieldCurveChart`, `SparklineChart`, or `ExpandedModal` charts.
- Migration plan: Pin to an exact version (`3.8.1`) until the chart components are covered by snapshot or integration tests.

---

## Missing Critical Features

**No authentication or access control:**
- Problem: The dashboard is fully public. There is no login, no API key management UI, and no mechanism to prevent unauthorized users from consuming the owner's API quota.
- Blocks: Multi-user deployment, protecting paid API key quotas.

**No error boundary at the application level:**
- Problem: React error boundaries are not used anywhere. An unhandled render exception in any widget will crash the entire dashboard (white screen).
- Files: `src/App.tsx`, `src/components/layout/DashboardGrid.tsx`
- Blocks: Graceful degradation when one widget panics.

**No persistent server-side cache or backend proxy:**
- Problem: All API calls are made directly from the browser. There is no shared cache across users or sessions. Each new page load triggers the full suite of API fetches, consuming quota from all three providers.
- Blocks: Multi-user scenarios, staying within free-tier API limits.

---

## Test Coverage Gaps

**No tests exist anywhere in the codebase:**
- What's not tested: All service layer logic (API parsing, fallback logic, cache behavior), all React components (rendering, interaction, error states), all data transformation utilities (spread calculation, inflation YoY computation, FOMC date filtering).
- Files: Entire `src/` directory
- Risk: Any refactoring of the service layer or data transformation logic could silently break displayed values with no automated detection.
- Priority: High — especially for `src/services/fredService.ts` inflation/yield calculations, `src/hooks/useMarketData.ts` refresh scheduling, and `src/services/finnhubService.ts` FOMC date logic.

---

*Concerns audit: 2026-04-08*
