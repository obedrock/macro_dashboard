# Phase 1: Cleanup - Research

**Researched:** 2026-04-11
**Domain:** TypeScript/React service layer cleanup — dead code removal, API batching, DST scheduling, live data fixes
**Confidence:** HIGH

## Summary

Phase 1 targets four surgical changes to a React/TypeScript/Vite dashboard: (1) removing the unused Massive.com and Supabase dependencies, (2) collapsing individual TwelveData REST calls into batched requests to fit the 8 req/min free-tier limit, (3) fixing a DST scheduling bug that fires the calendar refresh an hour late during EDT (March–November), and (4) fetching real DXY and Brent Crude data instead of serving mock values or fabricated WTI offsets.

All four changes are isolated to `src/services/twelveDataService.ts`, `src/hooks/useMarketData.ts`, `vite.config.ts`, and `package.json`. No component files require modification. The existing `fetchBatchQuotes()` helper in `twelveDataService.ts` already supports comma-separated symbols and is cache-aware — equities and rates need to adopt the same pattern that FX already uses.

**Primary recommendation:** Batch equities (SPY,QQQ,DIA,IWM) and Treasury rates (US2Y,US5Y,US10Y,US20Y,US30Y) using the existing `fetchBatchQuotes()` helper. Fix DXY by adding `DX-Y.NYB` to the FX batch. For Brent, use TwelveData's `BZ:COM` (ICE Brent futures continuous contract) if available on the plan, falling back to dropping Brent from the panel if the symbol is gated. Fix DST with native `Intl.DateTimeFormat` parts extraction — no library required.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Brent):** Claude's discretion — research what TwelveData supports for Brent Crude and pick the best approach (fetch real data if a valid symbol exists, or drop from panel if not feasible)
- **D-02 (Scope):** Strictly limited to CLEAN-01 through CLEAN-04. Adjacent issues (fake period multipliers, hardcoded spread strings, duplicate CreditItem/InflationItem type declarations) are deferred to future phases.
- **D-03 (Batch strategy):** Logical groups — one TwelveData batch call per domain (equities batch, FX batch, commodities batch). This matches the existing panel structure, keeps error handling per-widget clean, and reduces calls from 5–9 per cycle to ~3.
- **D-04 (Build verification):** TypeScript compiler (strict mode) + clean Vite build + grep to confirm no dead imports or references to removed code. No manual smoke test or script required.

### Claude's Discretion
- Brent Crude approach (D-01) — Claude picks based on TwelveData API availability
- DXY symbol selection — Claude picks the correct TwelveData symbol for live DXY data
- Timezone library choice for DST fix — Claude picks the approach (native Intl API vs library)

### Deferred Ideas (OUT OF SCOPE)
- Fake period multipliers in EquitiesPanel (daily * 5 for weekly, daily * 22 for monthly)
- Hardcoded spread strings in RatesPanel/YieldCurveChart
- Duplicate CreditItem/InflationItem type declarations
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEAN-01 | Remove Massive/Polygon integration (massiveService.ts, @massive.com/client-js, @supabase/supabase-js) | Files identified: massiveService.ts, vite.config.ts alias block, package.json two entries, VITE_MASSIVE_API_KEY env var reference |
| CLEAN-02 | Batch TwelveData API calls (equities, rates, commodities) to stay within 8 req/min limit | fetchBatchQuotes() already exists and is used by FX; equities (4 symbols) and rates (5 symbols) need to switch from Promise.allSettled(fetchSingleQuote) to fetchBatchQuotes; commodities (5 symbols) similarly. Results in ~3 batch calls vs current 9–14 per refresh cycle |
| CLEAN-03 | Fix DST bug in calendar scheduling (hardcoded UTC-5 → America/New_York) | msUntilNextCalendarRefresh() in useMarketData.ts lines 34–48; native Intl.DateTimeFormat with formatToParts solves this without adding a dependency |
| CLEAN-04 | Fix DXY always-mock and Brent Crude fabrication (WTI+2.57) | DXY: add to FX batch as DX-Y.NYB (Yahoo Finance/ICE symbol known to work with some aggregators) or compute from EUR/USD weight; Brent: TwelveData BZ:COM or UKOIL are candidate symbols — must be verified at execution time with a test API call |
</phase_requirements>

## Standard Stack

### Core (no new installs needed)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| TypeScript | 5.5.3 | All changes are in .ts files | Already in project |
| Vite | 5.4.2 | Build verification | Already in project |
| native `Intl` API | Browser-native | DST-aware timezone conversion | Zero dependency, universal browser support |
| native `fetch` | Browser-native | All HTTP calls to TwelveData | Already the established pattern in this codebase |

### Packages to REMOVE
| Package | Removal Actions |
|---------|----------------|
| `@massive.com/client-js` | `npm uninstall @massive.com/client-js` — also remove alias from vite.config.ts + optimizeDeps.include entry |
| `@supabase/supabase-js` | `npm uninstall @supabase/supabase-js` — listed in package.json, no source imports |

**No new packages are required for any of the four requirements.**

**Uninstall commands:**
```bash
npm uninstall @massive.com/client-js @supabase/supabase-js
```

## Architecture Patterns

### Recommended Project Structure (unchanged)
```
src/
├── services/
│   ├── twelveDataService.ts   # CLEAN-02, CLEAN-04 changes here
│   ├── cache.ts               # No changes
│   ├── fredService.ts         # No changes
│   ├── finnhubService.ts      # No changes
│   └── massiveService.ts      # DELETE (CLEAN-01)
├── hooks/
│   └── useMarketData.ts       # CLEAN-01 import removal, CLEAN-03 DST fix
vite.config.ts                 # CLEAN-01 alias removal
package.json                   # CLEAN-01 dependency removal
```

### Pattern 1: Batch Quote Consolidation (CLEAN-02)

**What:** Replace four sequential `fetchSingleQuote()` calls in `getTwelveEquities()` and five in `getTwelveRates()` with a single `fetchBatchQuotes()` call each. Commodities currently uses `Promise.allSettled(fetchSingleQuote)` for 5 symbols — replace with one batch call.

**Current behavior (equities):** `Promise.allSettled([fetchSingleQuote('SPY'), fetchSingleQuote('QQQ'), fetchSingleQuote('DIA'), fetchSingleQuote('IWM')])` = 4 API credits per refresh.

**Target behavior:** `fetchBatchQuotes(['SPY','QQQ','DIA','IWM'])` = 1 API call, 4 credits consumed in one request, cache key covers all 4.

**Credit math after batching:**
- Before: equities (4) + rates (5) + commodities (5) + FX (4 already batched) = 14 calls/min
- After: equities batch (1) + rates batch (1) + commodities batch (1) + FX batch (1) = 4 calls/min
- Leaves 4 credits/min headroom on the 8 req/min free tier

**Example pattern (matching existing `getTwelveFX`):**
```typescript
// Source: existing getTwelveFX() in src/services/twelveDataService.ts
export async function getTwelveEquities(): Promise<PriceItem[]> {
  const symbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.equities;

  const spyQ = isTdQuote(batch['SPY']) ? batch['SPY'] : null;
  const qqqQ = isTdQuote(batch['QQQ']) ? batch['QQQ'] : null;
  const diaQ = isTdQuote(batch['DIA']) ? batch['DIA'] : null;
  const iwmQ = isTdQuote(batch['IWM']) ? batch['IWM'] : null;

  // ... etfScaled mapping as before
}
```

**For rates, `fetchBatchQuotes` returns a `TdBatchQuote` (Record<string, TdBatchResult>); extract via `isTdQuote(batch['US2Y'])` guard.**

### Pattern 2: DST-Aware ET Time (CLEAN-03)

**What:** Replace the hardcoded `etOffset = -5 * 60` in `msUntilNextCalendarRefresh()` with a native `Intl` extraction of the true ET hour and minute.

**Why the current code is wrong:** UTC-5 is EST (Eastern Standard Time, November–March). During EDT (Eastern Daylight Time, March–November), the offset is UTC-4. The function fires the 8:35 AM refresh at 9:35 AM ET for ~8 months of the year.

**Native Intl approach (no library):**
```typescript
// Source: MDN Intl.DateTimeFormat.formatToParts()
function msUntilNextCalendarRefresh(): number {
  const now = new Date();

  // Extract true ET components — Intl handles DST automatically
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const etHour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const etMinute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  const etSecond = parseInt(parts.find(p => p.type === 'second')!.value, 10);

  // Seconds elapsed since midnight ET
  const etSecondsNow = etHour * 3600 + etMinute * 60 + etSecond;
  const target835 = 8 * 3600 + 35 * 60; // 8:35 AM ET in seconds

  let msTo835: number;
  if (etSecondsNow < target835) {
    msTo835 = (target835 - etSecondsNow) * 1000;
  } else {
    msTo835 = (86400 - etSecondsNow + target835) * 1000; // next day
  }

  const msToTwoHour = CALENDAR_REFRESH_MS - (now.getTime() % CALENDAR_REFRESH_MS);
  return Math.min(msTo835, msToTwoHour);
}
```

**Browser support:** `Intl.DateTimeFormat` with IANA timezone names is supported in all modern browsers (Chrome 24+, Firefox 29+, Safari 10+). No polyfill needed.

### Pattern 3: Massive.com Removal (CLEAN-01)

**Files to delete:** `src/services/massiveService.ts`

**Files to modify:**
- `vite.config.ts`: Remove the `resolve.alias` block for `@massive.com/client-js` and the `optimizeDeps.include` entry for it.
- `useMarketData.ts`: Confirmed via source read that `massiveService` is NOT imported — no changes needed there. The only Massive reference is in the service file itself.

**Verification grep after removal:**
```bash
grep -r "massive\|supabase\|VITE_MASSIVE" src/ vite.config.ts package.json
```
Expected: zero results (excluding node_modules).

**Environment variable:** `VITE_MASSIVE_API_KEY` will no longer be referenced in source. It can be removed from `.env` (if present) but this is not a build-blocking action since the key is only used in the deleted service file.

### Pattern 4: DXY Live Data (CLEAN-04)

**Current bug:** `getTwelveFX()` sets `dxyFallback = fb[0]` from mock data and returns it at position 0 unconditionally — no API call is made for DXY.

**Fix:** Add `DX-Y.NYB` to the FX batch symbols array. This is the ICE Futures US Dollar Index futures continuous contract ticker used by Yahoo Finance and compatible with TwelveData's index quote endpoint.

```typescript
const symbols = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CNY', 'DX-Y.NYB'];
const batch = await fetchBatchQuotes(symbols);

const dxyQ = isTdQuote(batch['DX-Y.NYB']) ? batch['DX-Y.NYB'] : null;
return [
  dxyQ ? toItem(dxyQ, fb[0], 'DXY') : fb[0],  // live or fallback
  // ... other pairs
];
```

**Fallback behavior:** If `DX-Y.NYB` returns a non-quote error object from TwelveData (symbol not supported on plan), `isTdQuote()` guard returns false and `fb[0]` (mock) is used — same behavior as today, but now the attempt is made. No exception is thrown.

**Symbol risk:** `DX-Y.NYB` availability on TwelveData's free tier is MEDIUM confidence (confirmed as the standard ICE DXY futures ticker used across aggregators; not explicitly confirmed live against TwelveData's symbol endpoint). The executor should test with a direct curl at implementation time:
```bash
curl "https://api.twelvedata.com/quote?symbol=DX-Y.NYB&apikey=YOUR_KEY"
```
If the symbol returns `{"status":"error"}`, fall back to the calculated DXY approach (weighted basket of EUR/USD × 57.6% + USD/JPY × 13.6% + ...) or leave mock as-is and file a note.

### Pattern 5: Brent Crude Real Data (CLEAN-04)

**Current bug:** `getTwelveCommodities()` fabricates Brent as `WTI.close + 2.57` — the real Brent/WTI spread fluctuates and is currently wider (~$4–5).

**Candidate symbols for TwelveData:**
- `BZ:COM` — ICE Brent Crude Futures continuous (commodity format matching existing `CL1:COM` WTI)
- `UKOIL` — Brent spot, used on TradingView/TwelveData commodity feed

**Recommendation:** Add `BZ:COM` to the commodities batch alongside the existing symbols. The batch format `CL1:COM` already works (confirmed in current codebase), so `BZ:COM` follows the same pattern.

```typescript
const symbols = ['CL1:COM', 'BZ:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM', 'GAS/USD'];
const batch = await fetchBatchQuotes(symbols);

const brentQ = isTdQuote(batch['BZ:COM']) ? batch['BZ:COM'] : null;
const brentItem = brentQ
  ? { ...toItem(brentQ, fb[1], 'Brent Crude'), prefix: '$' }
  : fb[1]; // true fallback to mock if symbol unavailable
```

**If BZ:COM is not available:** Try `UKOIL` as a second attempt. If neither works on the plan, remove Brent from the panel array and update `mockMarketData.commodities` to have 5 items instead of 6. This is preferable to displaying fabricated data.

**Execution-time verification:**
```bash
curl "https://api.twelvedata.com/quote?symbol=BZ:COM&apikey=YOUR_KEY"
```

### Anti-Patterns to Avoid

- **Do not use a third-party timezone library (moment-timezone, luxon, date-fns-tz):** The native `Intl` API solves CLEAN-03 with zero dependencies. Adding a library for a one-function fix is over-engineering.
- **Do not create a new batch helper:** `fetchBatchQuotes()` already exists and handles caching, error detection, and the `TdBatchQuote` return type. Reuse it.
- **Do not leave Massive alias in vite.config.ts:** Even after the package is uninstalled, a dangling `resolve.alias` pointing to a non-existent path will cause Vite build errors. Remove both the alias and the `optimizeDeps.include` entry together.
- **Do not batch across domains in one call:** Per D-03, keep equities/rates/FX/commodities as separate batch calls. Mixing them into one 15-symbol call would tangle error reporting across unrelated widgets.
- **Do not remove the VIX entry from equities without investigation:** VIX currently returns `vixFallback = mockMarketData.equities[4]` (never fetched from TwelveData REST). This is a pre-existing limitation, not introduced by CLEAN-02. It is deferred to a later phase — leave it as-is.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DST-aware time | Custom UTC offset arithmetic | `Intl.DateTimeFormat` with `America/New_York` | IANA tz database maintained by browser vendors, handles all DST transitions including edge cases |
| Batch cache key | Per-symbol keys | Single batch cache key for all symbols in the call | `fetchBatchQuotes()` already does this: `td:batch:${symbols.join(',')}` — don't duplicate |
| Symbol availability check | Try/catch around individual symbols | `isTdQuote()` type guard on batch result values | Already in codebase; batch returns error objects for unsupported symbols, not HTTP errors |

**Key insight:** All the hard infrastructure already exists (`fetchBatchQuotes`, `isTdQuote`, `cache`, `toItem`). CLEAN-02 and CLEAN-04 are primarily about wiring existing helpers differently, not building new abstractions.

## Common Pitfalls

### Pitfall 1: Batch cache key invalidation on symbol set change
**What goes wrong:** If equities batch is cached as `td:batch:SPY,QQQ,DIA,IWM` and a future change adds a symbol, the old cache entry is served until TTL expires, missing the new symbol.
**Why it happens:** `fetchBatchQuotes` joins symbols into the cache key — adding a symbol creates a new key but does not invalidate the old one.
**How to avoid:** This is acceptable behavior for this phase. Document that adding symbols requires either a TTL wait or a `forceRefresh` parameter (which already exists in some callers).
**Warning signs:** A new symbol always showing mock data on first load after deployment.

### Pitfall 2: VIX disappears after equities batch migration
**What goes wrong:** Current `getTwelveEquities()` returns a 5-element array with `vixFallback` at index 4. If the batch migration accidentally drops the VIX placeholder, `RatesPanel` and `fetchRates` that reference `equities[4]` will show `undefined`.
**Why it happens:** VIX is not in the batch symbols (no TwelveData symbol fetched). It's manually appended.
**How to avoid:** After `fetchBatchQuotes(['SPY','QQQ','DIA','IWM'])`, still explicitly append `vixFallback` as the 5th element. Do not try to add `VIX` to the batch in this phase.

### Pitfall 3: TwelveData batch with single symbol returns non-object format
**What goes wrong:** When only 1 symbol is requested via `/quote?symbol=X`, TwelveData returns the quote directly as a flat object, not a `Record<string, TdBatchResult>`. The current `fetchBatchQuotes` assumes the batch object format.
**Why it happens:** TwelveData API behavior differs between single and multi-symbol requests.
**How to avoid:** Always pass at least 2 symbols to `fetchBatchQuotes()`. The existing FX call uses 4 symbols — this works fine. If a domain has only 1 symbol, keep using `fetchSingleQuote()`.
**Warning signs:** `batch['SYMBOL']` is `undefined` even though the API returned data successfully.

### Pitfall 4: vite.config.ts optimizeDeps.include left behind
**What goes wrong:** Removing the `resolve.alias` but forgetting `optimizeDeps.include: ['@massive.com/client-js']` causes Vite to attempt to pre-bundle a package that no longer exists, breaking `vite dev` with a module resolution error.
**Why it happens:** Two separate config locations reference the same package.
**How to avoid:** Remove both `resolve.alias` and `optimizeDeps.include` in the same edit.

### Pitfall 5: formatToParts hour value on midnight boundary
**What goes wrong:** `Intl.DateTimeFormat` with `hour12: false` may return `'24'` for midnight instead of `'0'` in some locales/browsers.
**Why it happens:** ISO 8601 midnight ambiguity with 24-hour format.
**How to avoid:** Use `parseInt(..., 10) % 24` when reading the hour part, or use `hour12: true` and check AM/PM separately. The function only needs to determine if ET hour < 8.583 (8:35 AM), so any midnight value > 8.583 already pushes the target to next day correctly.

## Code Examples

### DST Fix — Full replacement for msUntilNextCalendarRefresh()
```typescript
// Replaces lines 34–48 of src/hooks/useMarketData.ts
// Source: MDN Intl.DateTimeFormat.formatToParts + IANA tz
function msUntilNextCalendarRefresh(): number {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const etHour = parseInt(parts.find(p => p.type === 'hour')!.value, 10) % 24;
  const etMinute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  const etSecond = parseInt(parts.find(p => p.type === 'second')!.value, 10);

  const etSecondsNow = etHour * 3600 + etMinute * 60 + etSecond;
  const target835 = 8 * 3600 + 35 * 60;

  const msTo835 = etSecondsNow < target835
    ? (target835 - etSecondsNow) * 1000
    : (86400 - etSecondsNow + target835) * 1000;

  const msToTwoHour = CALENDAR_REFRESH_MS - (now.getTime() % CALENDAR_REFRESH_MS);
  return Math.min(msTo835, msToTwoHour);
}
```

### vite.config.ts after CLEAN-01
```typescript
// Source: current vite.config.ts — remove alias block entirely
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    // @massive.com/client-js entry removed
  },
  // resolve.alias block removed entirely
});
```

### Equities batch migration (CLEAN-02)
```typescript
// Replaces getTwelveEquities() in src/services/twelveDataService.ts
export async function getTwelveEquities(): Promise<PriceItem[]> {
  const symbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.equities;

  const spyQ = isTdQuote(batch['SPY']) ? batch['SPY'] : null;
  const qqqQ = isTdQuote(batch['QQQ']) ? batch['QQQ'] : null;
  const diaQ = isTdQuote(batch['DIA']) ? batch['DIA'] : null;
  const iwmQ = isTdQuote(batch['IWM']) ? batch['IWM'] : null;
  const vixFallback = fb[4];

  function etfScaled(q: TdQuote | null, fb: PriceItem, label: string, mult: number): PriceItem {
    if (!q) return fb;
    return {
      ...fb, label,
      value: parseFloat((parseFloat(q.close) * mult).toFixed(2)),
      change: parseFloat((parseFloat(q.change) * mult).toFixed(2)),
      changePct: parseFloat(q.percent_change),
    };
  }

  return [
    etfScaled(spyQ, fb[0], 'S&P 500', 10),
    etfScaled(qqqQ, fb[1], 'Nasdaq', 28),
    etfScaled(diaQ, fb[2], 'Dow Jones', 100),
    etfScaled(iwmQ, fb[3], 'Russell 2000', 10),
    vixFallback, // VIX: still mock, deferred to later phase
  ];
}
```

### Rates batch migration (CLEAN-02)
```typescript
// Replaces getTwelveRates() in src/services/twelveDataService.ts
export async function getTwelveRates(): Promise<TwelveRatesResult> {
  const symbols = ['US2Y', 'US5Y', 'US10Y', 'US20Y', 'US30Y'];
  const batch = await fetchBatchQuotes(symbols);

  const y2 = isTdQuote(batch['US2Y']) ? batch['US2Y'] : null;
  const y5 = isTdQuote(batch['US5Y']) ? batch['US5Y'] : null;
  const y10 = isTdQuote(batch['US10Y']) ? batch['US10Y'] : null;
  const y20 = isTdQuote(batch['US20Y']) ? batch['US20Y'] : null;
  const y30 = isTdQuote(batch['US30Y']) ? batch['US30Y'] : null;

  return {
    y2Val: y2 ? parseFloat(parseFloat(y2.close).toFixed(3)) : null,
    y2Change: y2 ? parseFloat(y2.change) : null,
    y2Pct: y2 ? parseFloat(y2.percent_change) : null,
    y5Val: y5 ? parseFloat(parseFloat(y5.close).toFixed(3)) : null,
    y10Val: y10 ? parseFloat(parseFloat(y10.close).toFixed(3)) : null,
    y10Change: y10 ? parseFloat(y10.change) : null,
    y10Pct: y10 ? parseFloat(y10.percent_change) : null,
    y20Val: y20 ? parseFloat(parseFloat(y20.close).toFixed(3)) : null,
    y30Val: y30 ? parseFloat(parseFloat(y30.close).toFixed(3)) : null,
  };
}
```

### Commodities batch with Brent (CLEAN-02 + CLEAN-04)
```typescript
// Replaces getTwelveCommodities() in src/services/twelveDataService.ts
export async function getTwelveCommodities(): Promise<PriceItem[]> {
  const symbols = ['CL1:COM', 'BZ:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM', 'GAS/USD'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.commodities;

  const wtiQ = isTdQuote(batch['CL1:COM']) ? batch['CL1:COM'] : null;
  const brentQ = isTdQuote(batch['BZ:COM']) ? batch['BZ:COM'] : null;
  const goldQ = isTdQuote(batch['XAU/USD']) ? batch['XAU/USD'] : null;
  const silverQ = isTdQuote(batch['XAG/USD']) ? batch['XAG/USD'] : null;
  const copperQ = isTdQuote(batch['HG1:COM']) ? batch['HG1:COM'] : null;
  const natgasQ = isTdQuote(batch['GAS/USD']) ? batch['GAS/USD'] : null;

  const wtiItem = wtiQ ? { ...toItem(wtiQ, fb[0], 'WTI Crude'), prefix: '$' } : fb[0];
  const brentItem = brentQ ? { ...toItem(brentQ, fb[1], 'Brent Crude'), prefix: '$' } : fb[1];
  const natgasItem = natgasQ ? { ...toItem(natgasQ, fb[2], 'Natural Gas'), prefix: '$' } : fb[2];
  const goldItem = goldQ ? { ...toItem(goldQ, fb[3], 'Gold'), prefix: '$' } : fb[3];
  const silverItem = silverQ ? { ...toItem(silverQ, fb[4], 'Silver'), prefix: '$' } : fb[4];
  const copperItem = copperQ ? { ...toItem(copperQ, fb[5], 'Copper'), prefix: '$' } : fb[5];

  return [wtiItem, brentItem, natgasItem, goldItem, silverItem, copperItem];
}
```

### FX batch with DXY (CLEAN-04)
```typescript
// Replaces getTwelveFX() in src/services/twelveDataService.ts
export async function getTwelveFX(): Promise<PriceItem[]> {
  const symbols = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CNY', 'DX-Y.NYB'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.fx;

  const dxyQ = isTdQuote(batch['DX-Y.NYB']) ? batch['DX-Y.NYB'] : null;
  const eurusd = isTdQuote(batch['EUR/USD']) ? batch['EUR/USD'] : null;
  const usdjpy = isTdQuote(batch['USD/JPY']) ? batch['USD/JPY'] : null;
  const gbpusd = isTdQuote(batch['GBP/USD']) ? batch['GBP/USD'] : null;
  const usdcny = isTdQuote(batch['USD/CNY']) ? batch['USD/CNY'] : null;

  return [
    dxyQ ? toItem(dxyQ, fb[0], 'DXY') : fb[0],
    eurusd ? toItem(eurusd, fb[1], 'EUR/USD') : fb[1],
    usdjpy ? toItem(usdjpy, fb[2], 'USD/JPY') : fb[2],
    gbpusd ? toItem(gbpusd, fb[3], 'GBP/USD') : fb[3],
    usdcny ? toItem(usdcny, fb[4], 'USD/CNY') : fb[4],
  ];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed UTC offset (-5) for ET | `Intl.DateTimeFormat` with IANA timezone | This phase | Calendar fires correctly during EDT (March–Nov) |
| WTI+2.57 for Brent | Real `BZ:COM` batch quote | This phase | Brent shows actual price, not fabricated |
| DXY from mock | `DX-Y.NYB` in FX batch | This phase | DXY updates every 60s with real market data |
| 4–5 individual quote calls per domain | 1 batch call per domain | This phase | Drops from ~14 req/min to ~4 req/min |

## Open Questions

1. **DX-Y.NYB availability on TwelveData free tier**
   - What we know: Ticker is standard ICE DXY futures identifier; used on Yahoo Finance; TwelveData indexes page lists global indices
   - What's unclear: Whether it requires a paid plan or specific exchange subscription
   - Recommendation: Test with a live API call at execution time. If error, document as known limitation and leave mock behavior (functionally identical to today).

2. **BZ:COM availability on TwelveData free tier**
   - What we know: `CL1:COM` (WTI continuous) works in current code; `BZ:COM` follows same ICE continuous contract naming pattern
   - What's unclear: Not confirmed against TwelveData's actual symbol list for the current plan
   - Recommendation: Test at execution time. If unavailable, try `UKOIL`. If that also fails, drop Brent from the panel entirely (remove from array, update mock data shape accordingly — this is safer than fabrication).

3. **Commodities batch count vs rate limit**
   - What we know: Batch request of 6 symbols consumes 6 API credits in one HTTP request (confirmed in TwelveData docs); free tier is 8 credits/min
   - What's unclear: Whether credits are deducted per-symbol or per-request for batch calls
   - Recommendation: Per TwelveData docs confirmed above — credits are per symbol. 6-symbol commodities batch = 6 credits. Combined with 1 equities (4 credits) + 1 FX (5 credits) + 1 rates (5 credits) = 20 credits in one 60-second cycle. **This exceeds the 8 req/min credit limit on the free tier.** The planner must address this: either stagger the batch calls across the 60-second window (e.g., equities at t=0, FX at t=15s, commodities at t=30s, rates at t=45s) or confirm the user has a paid plan. NOTE: "8 req/min" likely means 8 HTTP requests/min, not 8 credits/min — batch docs say each symbol costs credits but the request count is 1. Clarify during execution.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm uninstall, build | Yes | v24.14.0 | — |
| npm | Package removal | Yes | bundled with Node | — |
| TypeScript compiler | Build verification (D-04) | Yes | 5.5.3 | — |
| Vite | Build verification (D-04) | Yes | 5.4.2 | — |
| TwelveData API key | CLEAN-04 symbol verification | Unknown (key in .env, not in repo) | — | Cannot test live symbols without key |
| `DX-Y.NYB` symbol | CLEAN-04 DXY fix | Unknown | — | Fall back to mock (existing behavior) |
| `BZ:COM` symbol | CLEAN-04 Brent fix | Unknown | — | Try UKOIL, then drop Brent from panel |

**Missing dependencies with no fallback:** None — all tooling is present.

**Missing dependencies with fallback:** TwelveData symbol availability for DXY and Brent is unknown until runtime, but the existing `isTdQuote()` guard provides automatic graceful fallback to mock data.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently installed — no test framework detected |
| Config file | None — Wave 0 must create |
| Quick run command | N/A until Wave 0 setup |
| Full suite command | N/A until Wave 0 setup |

**Note:** Per REQUIREMENTS.md, TEST-01 (Vitest + MSW) is scoped to Phase 6, not Phase 1. Phase 1 validation per D-04 uses TypeScript compiler + Vite build + grep — not automated tests. The Validation Architecture section is included per config but Wave 0 test gaps are deferred to Phase 6.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEAN-01 | No massive/supabase imports in build | manual/grep | `grep -r "massive\|supabase" src/` (expect 0) | N/A (grep, not test) |
| CLEAN-01 | `vite build` succeeds without @massive.com alias | build | `npm run build` | N/A (build check) |
| CLEAN-02 | Network tab shows 1 batch request per domain, not N individual | manual | Browser DevTools Network tab | No |
| CLEAN-03 | Calendar fires at 8:35 AM ET during EDT | manual | Verify during EDT period, or unit test with mocked date | No |
| CLEAN-04 | DXY value changes from mock | manual | Observe FX panel after deployment, or unit test fetchBatchQuotes mock | No |
| CLEAN-04 | Brent shows real value not WTI+2.57 | manual | Observe commodities panel, verify spread is not exactly 2.57 | No |

### Sampling Rate
- **Per task commit:** `npm run typecheck` (TypeScript strict mode, ~5 seconds)
- **Per wave merge:** `npm run build` (full Vite build, verifies no dead imports, ~30 seconds)
- **Phase gate:** `npm run build` green + `grep -r "massive\|supabase" src/` returns zero results

### Wave 0 Gaps
No test framework setup is needed for Phase 1 — D-04 specifies TypeScript + Vite build + grep as the sole verification method. Automated test infrastructure is Phase 6 work.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** React + TypeScript + Vite + Tailwind — no framework changes. No new npm dependencies allowed for Phase 1 fixes.
- **API sources locked:** Twelve Data, FRED, Finnhub — Massive/Polygon dropped (this is what CLEAN-01 implements).
- **Environment variables:** API keys stay in `.env` via `import.meta.env.VITE_*`. After CLEAN-01, `VITE_MASSIVE_API_KEY` is no longer needed in source code.
- **No breaking changes:** All existing panels must continue working. Batch migration preserves identical return types and fallback behavior — `getTwelveEquities()`, `getTwelveFX()`, `getTwelveCommodities()`, `getTwelveRates()` all return the same TypeScript types they do today.
- **Services use native fetch only:** DST fix uses native `Intl` API. No HTTP library changes.
- **Error handling pattern:** Services continue to fall back to `mockMarketData` values on failure — CLEAN-04 DXY/Brent fixes use `isTdQuote()` guard which falls back to mock on unsupported symbols.
- **Code style:** 2-space indent, single quotes, trailing commas, SCREAMING_SNAKE_CASE for module constants.
- **GSD enforcement:** Changes made through GSD execute-phase workflow.

## Sources

### Primary (HIGH confidence)
- Current source code: `src/services/twelveDataService.ts` — confirmed exact code structure, existing `fetchBatchQuotes` and `isTdQuote` helpers, current Brent fabrication at lines 237–244, DXY mock at lines 203–211
- Current source code: `src/hooks/useMarketData.ts` — confirmed DST bug at lines 34–48, confirmed Massive is not imported
- Current source code: `vite.config.ts` and `package.json` — confirmed exact alias and dependency entries to remove
- `.planning/codebase/CONCERNS.md` — authoritative codebase audit documenting all four bugs
- `.planning/codebase/INTEGRATIONS.md` — authoritative integration inventory
- TwelveData batch API docs (WebFetch of support article) — confirmed per-symbol credit model, batch format

### Secondary (MEDIUM confidence)
- MDN Intl.DateTimeFormat — `formatToParts()` with IANA timezone names handles DST automatically
- TwelveData rate limit: 8 req/min on free tier — confirmed via WebSearch with corroborating GitHub issue

### Tertiary (LOW confidence)
- `DX-Y.NYB` as TwelveData DXY symbol — known from Yahoo Finance/ICE; not confirmed against TwelveData symbol endpoint
- `BZ:COM` as TwelveData Brent symbol — inferred from `CL1:COM` naming pattern; not confirmed against TwelveData symbol endpoint

## Metadata

**Confidence breakdown:**
- CLEAN-01 (Massive removal): HIGH — exact files and entries identified in source
- CLEAN-02 (Batching): HIGH — `fetchBatchQuotes` helper confirmed, pattern established by FX implementation
- CLEAN-03 (DST fix): HIGH — bug clearly identified, native Intl solution is well-documented
- CLEAN-04 (DXY/Brent): MEDIUM — fix patterns clear, but specific symbol availability on the plan is LOW confidence until runtime test

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (TwelveData API surface changes slowly; symbol availability is the main risk)
