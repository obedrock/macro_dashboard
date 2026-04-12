# Domain Pitfalls: Financial Dashboard Reliability Refactor

**Domain:** Real-time financial data dashboard (React + TypeScript + Vite)
**Researched:** 2026-04-08
**Confidence:** HIGH — findings derived directly from codebase audit, not hypothetical

---

## Critical Pitfalls

Mistakes that cause rewrites, lost data integrity, or regressions that are hard to detect.

---

### Pitfall 1: Silent Mock Fallback Masks Real Failures

**What goes wrong:** Every service catch-block currently returns `mockMarketData.*` instead of re-throwing. When you add proper error surfacing, any path that previously silently fell back now throws to the UI. If a refactor adds a new failure mode (e.g., stricter response validation), users suddenly see error states on widgets that "always worked" — because they were always showing stale mock data without anyone noticing.

**Why it happens:** The mock fallback pattern is used defensively throughout: `getLiveCreditSpreads` returns `mockMarketData.credit` in its catch, `getFinnhubNews` returns `mockNews`, `getTwelveFX` returns `fb[0]` (the fake DXY mock) unconditionally before the function even makes network calls. Removing or changing fallbacks during a refactor will expose failure modes that were previously invisible.

**Consequences:** Widget appears broken post-refactor when in fact it was always broken — just silently. Team blames the refactor rather than the underlying API issue.

**Prevention:**
- Before touching any fallback, audit whether the widget currently shows real or mock data (the CONCERNS.md documents which widgets are entirely mock: DXY, FedWatch CME probabilities, Brent Crude).
- Add explicit `isMockData: boolean` flags or a `dataSource: 'live' | 'mock' | 'stale'` field to all widget data shapes before changing error handling — this creates a clear "before" baseline.
- Introduce error boundaries at the widget level before removing mock fallbacks, so a failure is contained.

**Detection:** Before each refactor step, render the dashboard with `VITE_TWELVEDATA_API_KEY=invalid` and check which widgets show error states vs which still show data. The ones still showing data are on mock.

**Phase:** Address in Phase 1 (mock data boundary audit) before any reliability work in later phases.

---

### Pitfall 2: useMarketData useEffect Dependency Array Re-fires All Intervals on Every Render

**What goes wrong:** The primary `useEffect` in `useMarketData.ts` (line 285–334) lists every `fetchX` callback in its dependency array. Each `fetchX` is wrapped in `useCallback` with an empty `[]` dependency, so they are stable. However, if any `fetchX` is ever changed to depend on a piece of state (e.g., a selected time range), its identity will change on every render, causing the entire useEffect to re-fire: all intervals cleared and re-registered, and all data re-fetched simultaneously. This would cause a burst of ~9 simultaneous API calls every render cycle.

**Why it happens:** The hook is already structured correctly today, but refactors that add time-range-awareness to individual fetch functions will break the stability guarantee of `useCallback`. This is the most dangerous single change the refactor could introduce.

**Consequences:** Infinite re-render loop; rate limits hit immediately; TwelveData free tier (8 req/min) exhausted in seconds.

**Prevention:**
- Never add reactive state to `useCallback` dependencies inside `useMarketData` without re-evaluating the parent `useEffect` dependency array.
- If time range selection needs to affect fetches, pass it as a parameter to a `refresh()` call rather than baking it into the callback identity.
- Write a test that verifies the interval setup fires exactly once per mount.

**Detection:** React DevTools Profiler "why did this render?" on the hook; count `setInterval` calls in tests using `vi.useFakeTimers()`.

**Phase:** Risk highest in Phase 2 (time-range wiring) and Phase 3 (WebSocket refactor).

---

### Pitfall 3: Twelve Data Free Tier Rate Limit Burst on Page Load

**What goes wrong:** On initial mount, `useMarketData` fires all fetch functions simultaneously via `Promise.all` (line 286–295). This includes `getTwelveEquities` (4 individual `fetchSingleQuote` calls), `getTwelveFX` (1 batch), `getTwelveCommodities` (5 individual `fetchSingleQuote` calls), and `getTwelveRates` (5 individual `fetchSingleQuote` calls) — totaling 15 REST requests to Twelve Data in a single tick. Twelve Data free tier allows 8 credits/minute; a `/quote` batch counts as 1 credit but each `/quote?symbol=single` counts as 1 credit each. 15 simultaneous single-symbol calls will immediately exhaust the limit and return 429 errors on the remaining calls.

**Why it happens:** `getTwelveEquities` and `getTwelveRates` use `fetchSingleQuote` per symbol rather than `fetchBatchQuotes`. The FX function correctly uses batch. The inconsistency means some panels stay within quota and others blow it.

**Consequences:** Equities, Commodities, and Rates panels fail on every cold page load. The error is transient (clears after 60 seconds when cache TTL expires and is refetched), so it may be missed in testing but consistently hits users.

**Prevention:**
- Consolidate `getTwelveEquities` (SPY, QQQ, DIA, IWM) into a single `fetchBatchQuotes` call.
- Consolidate `getTwelveRates` (US2Y, US5Y, US10Y, US20Y, US30Y) into a single `fetchBatchQuotes` call.
- Consolidate `getTwelveCommodities` (CL1:COM, XAU/USD, XAG/USD, HG1:COM, GAS/USD) into a single `fetchBatchQuotes` call.
- Verify batch call cost with Twelve Data docs before assuming 1 credit per batch regardless of symbol count — at high symbol counts some plans charge per symbol even in batch mode.

**Detection:** Open browser DevTools Network tab on cold load and count requests to `api.twelvedata.com`. Any response with HTTP 429 or `{"status":"error","message":"You have run out of API credits"}` confirms this.

**Phase:** Phase 1 (API consolidation sprint). Must be fixed before adding any new Twelve Data calls.

---

### Pitfall 4: WebSocket Reconnect Loop Causes Infinite Backoff-Free Retries

**What goes wrong:** `ws.onclose` in `twelveDataService.ts` (line 52–60) schedules `connectWebSocket` after a flat 5-second delay, forever, regardless of consecutive failure count. When the Twelve Data WebSocket endpoint is unavailable (maintenance, key revocation, network loss), the browser enters an infinite 5-second reconnect cycle for the lifetime of the tab. Each reconnect attempt creates a new `WebSocket` object, consumes memory, and may count against API connection limits.

**Why it happens:** No retry counter, no exponential backoff, no maximum retry ceiling, no "give up and show degraded state" path.

**Consequences:** Silent battery/CPU drain on mobile. If Twelve Data counts WebSocket connection attempts toward rate limits, a key could be throttled or suspended. Users see "ribbon loading" indefinitely with no explanation.

**Prevention:**
- Implement exponential backoff with jitter: `delay = Math.min(baseDelay * 2^attempt + jitter, maxDelay)` where `baseDelay = 2s`, `maxDelay = 5min`.
- Add a `maxAttempts` cap (e.g., 10). After max attempts, set ribbon status to `{ state: 'error', error: 'Live data unavailable — retrying in 5m' }` and schedule a single retry after a long interval.
- Track attempt count in a module-level variable alongside `wsReconnected` — reset on successful connection (`ws.onopen`).

**Detection:** Disconnect network after page load. Watch DevTools WebSocket inspector — successful reconnect should back off; currently it reconnects every 5 seconds precisely.

**Phase:** Phase 2 (WebSocket hardening).

---

### Pitfall 5: Removing massiveService.ts Breaks the Vite Build Alias

**What goes wrong:** `vite.config.ts` contains a manual alias that resolves `@massive.com/client-js` to its `dist/main.js` entry point. If `massiveService.ts` is deleted but the alias and the `@massive.com/client-js` package are left in `package.json`, Vite's alias resolution will still try to process that path during bundling if anything accidentally imports it. Conversely, if the alias is removed first but `massiveService.ts` still exists, the file itself breaks to a build error.

**Why it happens:** The alias is a workaround for a non-standard ESM package. The two removals (alias + file + package.json entries) must happen atomically or the build breaks mid-refactor.

**Consequences:** CI build fails; other devs can't build the project between commits; `npm install` after `package.json` edit but before `vite.config.ts` edit may produce a broken dev server.

**Prevention:**
- Remove the file, alias, and `package.json` entries (`@massive.com/client-js`, `@supabase/supabase-js`, and `VITE_MASSIVE_API_KEY` from `.env.example` if one exists) in a single atomic commit.
- Run `vite build` locally before committing the removal to confirm no leftover import path resolves to the old alias.
- Search the codebase for any string `massive` or `supabase` before committing (`grep -r "massive\|supabase" src/`).

**Detection:** After removal, run `npm run build` and verify clean output with no unresolved module warnings.

**Phase:** Phase 1 (cleanup). First commit in the milestone.

---

### Pitfall 6: InflationPanel Positional Array Destructuring Breaks Silently on Shape Change

**What goes wrong:** `InflationPanel.tsx` line 36–37 does `const [cpi, coreCpi, pce, corePce] = data.slice(0, 4)` and `const expectations = data.slice(4)`. `getLiveInflation()` in `fredService.ts` uses `Promise.allSettled` to build a 6-element array in a fixed order. Any refactor that adds a new metric before index 4 (e.g., inserting a `Trimmed Mean PCE` series), reorders the `Promise.allSettled` calls, or removes a failing series from the returned array will silently map the wrong data to the wrong label in the UI with no TypeScript error.

**Why it happens:** The array shape is not enforced by a named type. The positional coupling between service and component is invisible at compile time.

**Consequences:** CPI panel shows PCE values, or breakeven panel shows CPI. Wrong data labeled with wrong name — this is worse than showing an error.

**Prevention:**
- Before touching `getLiveInflation`, change the return type from `InflationItem[]` (positional) to a named object: `{ cpi, coreCpi, pce, corePce, breakeven5y, breakeven1y }`.
- Update `InflationPanel` to destructure by name, not position.
- Alternatively, add a `metricId: string` field to `InflationItem` and have the panel match by `metricId`.
- Export and share the `InflationItem` type (currently duplicated between `fredService.ts` and `InflationPanel.tsx`).

**Detection:** TypeScript will not catch this — it only shows up visually. Test: change the order in `getLiveInflation` and verify the panel labels are still correct.

**Phase:** Phase 1 (type cleanup) before Phase 3 (inflation data fixes).

---

### Pitfall 7: fetchRates Mixes Twelve Data + FRED With ?? Fallback Chain — One Partial Failure Corrupts Spreads

**What goes wrong:** `fetchRates` in `useMarketData.ts` (lines 116–177) uses a `??` chain: `tdRates.y2Val ?? fredYields.y2 ?? fb[1].value`. If Twelve Data returns a value for y2 but FRED returns a different (more accurate) value, the Twelve Data value always wins regardless of quality. More critically: the spread calculations (`spread2s10s`, `spread2s30s`) on lines 132–133 are computed from this blended result. If one source is stale (e.g., Twelve Data returns yesterday's close after market hours while FRED has today's value), the computed spread is mathematically consistent but factually wrong.

**Why it happens:** The multi-source waterfall was added to increase resilience, but there is no "last-updated" comparison — the priority is hardcoded by position in the `??` chain.

**Consequences:** 2s10s spread shows a value that doesn't match either source's actual data, with no indication of data source or freshness.

**Prevention:**
- When refactoring `fetchRates`, decide on a single authoritative source per metric and document it. Use FRED for yields (more accurate, published T+1) and Twelve Data only as an intraday supplement when markets are open.
- Add a `source: 'twelvedata' | 'fred' | 'mock'` tag to rate items so the UI can show data provenance.
- Add a `dataAsOf: string` timestamp so users can see when the yield data was last published.

**Detection:** Compare the displayed 2s10s spread against Bloomberg or the CME site. If it differs by more than a few bps, the waterfall is mixing stale and fresh data.

**Phase:** Phase 3 (rates panel data quality).

---

## Moderate Pitfalls

---

### Pitfall 8: calendarTimer Re-assignment From setTimeout to setInterval is a Cleanup Landmine

**What goes wrong:** In `useMarketData.ts` lines 316–332, `calendarTimer` is first assigned a `setTimeout` handle, then reassigned to a `setInterval` handle inside the timeout callback. The cleanup function calls both `clearTimeout` and `clearInterval` on whatever value `calendarTimer` holds. If the component unmounts before the first timeout fires (e.g., during hot module replacement in development), only the `setTimeout` handle exists — this is handled correctly. But during future refactors, developers assuming `calendarTimer` is always an interval handle will call `clearInterval` on a stale `setTimeout` handle, leaking the interval.

**Prevention:**
- Split into two separate `useRef` variables: `calendarTimeoutRef` and `calendarIntervalRef`. Clear each independently. This makes the lifecycle state unambiguous.
- Add a comment documenting the two-phase scheduling (initial align-to-8:35am, then hourly interval).

**Detection:** In development with React StrictMode (double-invoke of effects), look for duplicate calendar fetch calls — if the interval is not being cleared correctly, calendar will refresh twice.

**Phase:** Phase 2 (timer/scheduling cleanup).

---

### Pitfall 9: msUntilNextCalendarRefresh Uses UTC-5 Instead of America/New_York — Wrong Half the Year

**What goes wrong:** `msUntilNextCalendarRefresh()` in `useMarketData.ts` line 36 hardcodes `etOffset = -5 * 60`. EDT (daylight saving time, roughly March–November) is UTC-4. During this 8-month window, the calendar "8:35 AM ET" refresh fires at 9:35 AM ET instead. Economic events (CPI, payrolls, FOMC) are typically released at 8:30 AM ET — the calendar would miss the day-of data by an hour.

**Prevention:**
- Replace the manual offset calculation with:
  ```typescript
  const etHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
  );
  ```
- Or use the `Intl.DateTimeFormat` API to get ET time components directly.

**Detection:** Test in April (EDT). The refresh should fire at 8:35 AM ET local time — if it fires at 9:35 AM ET, the bug is confirmed.

**Phase:** Phase 2 (scheduling fixes).

---

### Pitfall 10: FRED Yield Curve Overlay Makes 22 Requests Per fetchYields Call — All Wasted on Cache Miss

**What goes wrong:** `getFredYieldCurveOverlays` makes 22 individual FRED API calls (11 maturities × 2 historical dates). On the first page load of the day, all 22 cache entries are cold. FRED's API imposes a soft rate limit of approximately 120 requests per 10 seconds per IP; 22 simultaneous requests are safe for a single user but will fail immediately if the same user opens multiple dashboard tabs simultaneously or if a future multi-user deployment serves several sessions.

**Prevention:**
- The 24-hour cache TTL already mitigates the repeat-load problem. The risk area is cold cache in multi-tab scenarios.
- Add a per-session "overlay already fetched today" guard using `sessionStorage`. If `sessionStorage.getItem('overlayFetchDate') === todayISO`, skip the overlay fetch entirely and use cached values.
- Consider reducing overlay dates from 2 historical dates to 1 for the MVP (e.g., only 1-year-ago curve, not 5-year-ago), cutting the call count to 11.

**Detection:** Open the dashboard in three tabs simultaneously. Check Network panel for FRED 429 or CORS errors on overlay requests.

**Phase:** Phase 3 (FRED performance hardening).

---

### Pitfall 11: Testing Async Fetch Code With vitest/jest — Stale Closure + Fake Timer Interaction

**What goes wrong:** When writing tests for `useMarketData` using `vi.useFakeTimers()`, the `setInterval` and `setTimeout` calls inside the effect can interact with async fetch mocks in non-obvious ways. A common mistake: calling `vi.runAllTimers()` before `await Promise.resolve()` means the interval fires but the mock fetch promise hasn't settled yet, so state updates happen in the wrong order and assertions fail intermittently (flaky tests).

**Why it happens:** Fake timers and microtask queues are separate. `vi.runAllTimers()` only advances macro timers; the promise microtask queue still needs to be flushed separately via `await Promise.resolve()` or `await vi.runAllTimersAsync()`.

**Consequences:** Tests pass locally but fail on CI due to timing differences. Or tests always pass but don't actually verify the behavior they claim to (false green).

**Prevention:**
- Use `vi.runAllTimersAsync()` (Vitest ≥ 0.34) instead of `vi.runAllTimers()` when tests involve both timers and promises.
- Always `await act(async () => { vi.advanceTimersByTime(X); })` when testing React hook state updates triggered by timers.
- Test fetch logic in the service layer (pure async functions) independently from the hook timing logic. This separates two hard problems.

**Detection:** Run the test suite with `--reporter=verbose` and look for intermittent failures. Any test that passes 9/10 runs is a fake-timer/microtask interaction.

**Phase:** Phase 4 (test infrastructure).

---

### Pitfall 12: Adding Error Boundaries Without Handling Uncontrolled State Resets

**What goes wrong:** When a React error boundary catches an error in a widget component, it replaces the widget's subtree with a fallback UI. However, the widget's corresponding state in `useMarketData` (e.g., `data.equities`) is still populated from the last successful fetch. When the user clicks "retry", the error boundary resets, the component remounts, and `useMarketData` immediately supplies the stale data — the widget appears to "recover" without actually re-fetching. Users may not realize the displayed data is from before the error.

**Prevention:**
- When an error boundary resets (via `onReset`), trigger `retryWidget(key)` to force a re-fetch, not just a remount.
- Wire `retryWidget` to the error boundary's reset callback.
- Consider showing a "Data as of [timestamp]" indicator so users can judge staleness themselves.

**Detection:** Manually throw in a widget's render function, wait for error boundary to catch it, then dismiss — verify Network tab shows a new API request.

**Phase:** Phase 2 (error boundary addition).

---

### Pitfall 13: Removing Massive/Polygon Also Removes VITE_MASSIVE_API_KEY — Break on Missing Env Var

**What goes wrong:** If `massiveService.ts` is deleted but `.env` still contains `VITE_MASSIVE_API_KEY`, there is no problem. But if a developer clones the repo fresh and creates `.env` from a new template that omits `VITE_MASSIVE_API_KEY`, and then a stale import path somewhere still references the service, the build will fail silently (the variable will be `undefined` at runtime, not a build error). More likely: a future developer adds a new `.env.example` file and forgets to include the now-removed key — then wonders why the dashboard behaves strangely after env regeneration.

**Prevention:**
- Add an `.env.example` file at the same time as the removal that documents only the three remaining keys: `VITE_FINNHUB_API_KEY`, `VITE_FRED_API_KEY`, `VITE_TWELVEDATA_API_KEY`.
- Add a startup assertion that validates required env vars are present and non-empty, logging a clear error before any API call is made.

**Phase:** Phase 1 (cleanup).

---

## Minor Pitfalls

---

### Pitfall 14: DataCache Grows Unboundedly During Long Sessions

**What goes wrong:** The `DataCache` `Map` in `src/services/cache.ts` has no max-size enforcement. In a long browser session (8+ hours), expired entries accumulate. The yield curve overlay alone adds ~22 entries; FRED data adds many more. Over time, memory usage grows silently.

**Prevention:** Add an LRU eviction policy with a max entry cap (200–500 entries is sufficient). Or add a periodic `setInterval` sweep every 30 minutes that calls `cache.purgeExpired()`.

**Phase:** Phase 1 or Phase 4 (low priority, correctness not affected).

---

### Pitfall 15: DashboardContext localStorage Parse Swallows Migration Errors

**What goes wrong:** If the widget settings schema changes (e.g., a new widget key is added), old localStorage values from before the migration will be silently discarded on next load, resetting all user preferences. No error is logged, no migration path exists.

**Prevention:** Add a `schemaVersion` field to the settings object. On parse, check version and migrate if stale. Log parse failures to the console so they are visible during development.

**Phase:** Phase 2 (settings schema versioning).

---

### Pitfall 16: finnhubFetch Casts Response as Promise<T> Without Runtime Validation

**What goes wrong:** `finnhubFetch` (line 13 of `finnhubService.ts`) returns `res.json() as Promise<T>` — this is not a type cast at runtime, it's a TypeScript lie. If Finnhub returns an error body (`{ error: "API limit reached" }`) with HTTP 200, the response passes the `!res.ok` guard, gets cast to `T`, and the downstream map operations will throw on undefined fields — but the error will surface as an unhelpful "Cannot read properties of undefined" rather than "API limit reached".

**Prevention:** After parsing JSON, check for the Finnhub error pattern: `if (json && typeof json === 'object' && 'error' in json) throw new Error(json.error)`. This surfaces Finnhub-specific soft errors (rate limit, auth failure) that arrive as HTTP 200.

**Phase:** Phase 2 (error handling hardening).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Cleanup / remove Massive | Vite alias left orphaned (Pitfall 5) | Atomic commit: file + alias + package.json + env |
| Mock data boundary | Mock fallbacks hide real API failures (Pitfall 1) | Audit which widgets are live vs mock before touching error paths |
| WebSocket hardening | Infinite reconnect loop (Pitfall 4) | Implement backoff + max-retry before any other WS changes |
| useMarketData refactor | useEffect re-fires all intervals (Pitfall 2) | Keep fetchX callbacks stable; never add reactive state to their deps |
| Rate limit fixes | TwelveData burst on page load (Pitfall 3) | Consolidate to batch calls before adding any new TwelveData endpoints |
| Rates data quality | ?? fallback chain mixes stale sources (Pitfall 7) | Define single authoritative source per metric |
| InflationPanel work | Positional array breaks silently (Pitfall 6) | Migrate to named-field return type first |
| Error boundary addition | Retry doesn't re-fetch (Pitfall 12) | Wire onReset to retryWidget |
| Scheduling fixes | Hardcoded UTC-5 offset wrong during EDT (Pitfall 9) | Use America/New_York timezone API |
| Timer lifecycle | calendarTimer dual-type mutation (Pitfall 8) | Split into two refs before touching scheduling code |
| Test infrastructure | Fake timer + promise microtask flakiness (Pitfall 11) | Use vi.runAllTimersAsync(); test service layer separately from hook |
| Test infrastructure | Finnhub soft errors arrive as HTTP 200 (Pitfall 16) | Add error-body guard in finnhubFetch before writing tests that expect throws |

---

## Sources

Findings derived from direct codebase audit:
- `src/services/twelveDataService.ts` — lines 23–60 (WebSocket, mutable state), 158–286 (individual vs batch quotes)
- `src/services/fredService.ts` — lines 182–248 (inflation positional array), 343–376 (overlay burst)
- `src/services/finnhubService.ts` — lines 8–13 (unsafe cast), 155–202 (mock FOMC data)
- `src/hooks/useMarketData.ts` — lines 34–48 (DST bug), 116–177 (rates waterfall), 285–334 (interval deps), 316–332 (calendarTimer)
- `src/components/widgets/InflationPanel.tsx` — lines 36–37 (positional destructuring)
- `.planning/codebase/CONCERNS.md` — full tech debt and fragile areas audit
- `.planning/codebase/INTEGRATIONS.md` — API rate limits and caching strategy

**Confidence levels:**
- Pitfalls 1–10, 12–16: HIGH (sourced from direct code reading + CONCERNS.md audit)
- Pitfall 11 (vitest async): MEDIUM (standard vitest/React Testing Library behavior, training data + vitest docs pattern — recommend verifying against vitest 2.x changelog)
