# Phase 2: Data Layer Hardening - Research

**Researched:** 2026-04-11
**Domain:** TypeScript service layer error propagation, Zod schema validation, rate limit backoff
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** DataResult<T> is a discriminated union: `{ status: 'ok', data: T, source: DataSource, timestamp: number } | { status: 'error', error: string, source: DataSource, timestamp: number }` where `DataSource = 'live' | 'cache' | 'fallback'`.
- **D-02:** Every service function (getTwelveEquities, getTwelveRates, getTwelveFX, getTwelveCommodities, getFredRates, getFredCredit, getFredInflation, getFredYieldCurve, getFinnhubNews, getFinnhubCalendar, getFinnhubFedWatch) must return `DataResult<T>` instead of raw `T`.
- **D-03:** Custom per-provider backoff — no new dependencies (no p-queue). Track 429 timestamps per provider (TwelveData, FRED, Finnhub). Exponential backoff with jitter. Integrated into the existing `tdFetch`, `fredFetch`, and `finnhubFetch` wrapper functions.
- **D-04:** Backoff state lives in a module-level singleton (similar pattern to `cache.ts`) — not in React state.
- **D-05:** All external API responses validated with Zod schemas. One schema per endpoint return type. Use `.passthrough()` so extra fields from API changes don't cause validation failures.
- **D-06:** Validation failure triggers `DataResult.error` — the widget shows error state, not NaN/undefined. The raw API response is not exposed to components.
- **D-07:** Centralized error mapping module (`src/services/errorMessages.ts` or similar). Maps provider + HTTP status code + error type → user-friendly string.
- **D-08:** Error strings stored in DataResult.error, consumed by Widget.tsx error UI. No raw HTTP codes or stack traces shown to users.
- **D-09:** For multi-source widgets, when one source fails: return available data with a `source: 'partial'` or warning flag. Widget renders what it has with a visible indicator.
- **D-10:** The existing `Promise.allSettled` pattern in fredService.ts is the right foundation — extend it to populate DataResult with partial success metadata.

### Claude's Discretion

- Exact Zod schema definitions for each API response type — Claude defines based on actual API response shapes
- Internal rate limit backoff timing parameters (initial delay, max delay, jitter range)
- File organization for new modules (schemas, error mapping, rate limiter) — Claude decides based on codebase conventions
- Whether DataSource includes 'partial' as a distinct value or uses a separate `warnings` field

### Deferred Ideas (OUT OF SCOPE)

- Fake period multipliers in EquitiesPanel
- Hardcoded spread strings in RatesPanel/YieldCurveChart
- Duplicate CreditItem/InflationItem type declarations
- FedWatch mock probabilities (tracked as EXP-01 in v2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Services return DataResult<T> wrapper with source metadata (live/fallback/error) instead of raw data | DataResult type design, TypeScript discriminated union patterns, hook adaptation |
| DATA-02 | Per-widget error states surface clearly — no silent failures or mock substitution | Remove mock fallback from service functions, propagate errors to hook layer |
| DATA-03 | Rate limit detection (429 response) with per-provider exponential backoff | Custom RateLimiter singleton, tdFetch/fredFetch/finnhubFetch integration |
| DATA-04 | Zod schema validation on API responses — malformed data triggers error state, not NaN | Zod 4.x schema design, .passthrough() usage, parse-or-error pattern |
| DATA-05 | Partial success handling — when one source fails in a multi-source widget, show available data with warning | DataResult shape with partial/warnings, Promise.allSettled extension |
| DATA-06 | User-friendly error messages mapped from HTTP status codes and provider error codes | errorMessages.ts module, HTTP status → string mapping |
</phase_requirements>

## Summary

Phase 2 converts the service layer from a "swallow errors, return mock data" model to a typed `DataResult<T>` propagation model. The key structural change is that service functions stop returning raw domain types and start returning a discriminated union that the hook layer can narrow. This means `useMarketData.ts` takes on the responsibility of deciding whether to surface the data or set an error status — a responsibility that currently lives silently inside each service function.

Three new modules are needed: a `RateLimiter` singleton (`src/services/rateLimiter.ts`) that tracks 429 responses per provider and enforces exponential backoff with jitter; a Zod schema file (`src/services/schemas.ts`) that validates raw API responses before they are transformed into domain types; and an error message mapping module (`src/services/errorMessages.ts`) that converts HTTP status codes and error categories into user-readable strings. The `DataResult<T>` type and `DataSource` union go into `src/types/index.ts`.

The implementation touches every service file and the hook, but the widget components themselves are unchanged — the `WidgetStatus` error messages they already render just become more accurate and human-readable. The most complex part is the partial success path for multi-source widgets (rates uses both TwelveData and FRED; credit uses two FRED series), where `DataResult` needs to carry both partial data and a warnings collection.

**Primary recommendation:** Add `DataResult<T>` to `src/types/index.ts` first, then work service-by-service (Finnhub first — simplest, one source each), then FRED (multi-series with partial), then TwelveData (batch fetch adaptation), then adapt `useMarketData.ts` last to unwrap results.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 | Runtime schema validation of API responses | Only peer-reviewed schema library with TypeScript-first design; eliminates unsafe `as T` casts; `.passthrough()` handles API schema drift |
| TypeScript (existing) | 5.5.3 | Discriminated union narrowing for DataResult | Already in project; `status: 'ok' | 'error'` pattern is idiomatic TS narrowing |

Zod is not yet installed. It must be added as a dependency.

**Installation:**
```bash
npm install zod@4.3.6
```

**Version verification:**
```
npm view zod version → 4.3.6 (verified 2026-01-25)
```

No other new runtime dependencies. Rate limiter and error messages are pure TypeScript modules.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | All other functionality is pure TypeScript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod | valibot | valibot is smaller but less ecosystem momentum; zod has Context7 docs and broader community |
| zod | manual type guards | Manual guards (like existing `isTdQuote`) scale poorly to 10+ endpoint shapes; Zod is declarative and self-documenting |
| custom backoff | p-queue | p-queue adds a dependency (locked out by D-03); custom singleton is 50 lines and sufficient for 3-provider use case |

## Architecture Patterns

### Recommended File Structure

```
src/
├── types/
│   └── index.ts             # Add DataResult<T>, DataSource, ResultWarning
├── services/
│   ├── cache.ts             # Unchanged
│   ├── rateLimiter.ts       # NEW: RateLimiter singleton (per-provider 429 backoff)
│   ├── schemas.ts           # NEW: Zod schemas for all three provider API shapes
│   ├── errorMessages.ts     # NEW: HTTP status + error type → user string mapping
│   ├── twelveDataService.ts # MODIFIED: tdFetch wraps rateLimiter; returns DataResult<T>
│   ├── fredService.ts       # MODIFIED: fredFetch wraps rateLimiter; returns DataResult<T>
│   └── finnhubService.ts    # MODIFIED: finnhubFetch wraps rateLimiter; returns DataResult<T>
└── hooks/
    └── useMarketData.ts     # MODIFIED: unwrap DataResult, set widget statuses from it
```

### Pattern 1: DataResult<T> Discriminated Union

**What:** A typed wrapper around every service return that encodes success, error, or partial success.

**When to use:** Return from every exported service function. Never from internal helpers.

```typescript
// src/types/index.ts additions

export type DataSource = 'live' | 'cache' | 'partial' | 'fallback';

export interface ResultWarning {
  field: string;
  message: string;
}

export type DataResult<T> =
  | { status: 'ok'; data: T; source: DataSource; timestamp: number; warnings?: ResultWarning[] }
  | { status: 'error'; error: string; source: DataSource; timestamp: number };
```

**Key decision:** `source: 'partial'` lives inside the `status: 'ok'` branch, not a third branch. This way the hook always has data to render when `status === 'ok'`, even if incomplete. A `warnings` array carries per-field gap descriptions ("HY spread unavailable — FRED returned 500").

**TypeScript narrowing in hook:**
```typescript
const result = await getFinnhubNews();
if (result.status === 'error') {
  setStatus('news', errorStatus(result.error));
  return;
}
setData(prev => ({ ...prev, news: result.data }));
setStatus('news', result.warnings?.length ? warnStatus(result.warnings) : loadedStatus);
```

### Pattern 2: RateLimiter Singleton

**What:** Module-level singleton tracking 429 timestamps per provider. Wraps fetch calls to block requests during backoff window.

**When to use:** Called inside `tdFetch`, `fredFetch`, and `finnhubFetch` — never by service functions directly.

```typescript
// src/services/rateLimiter.ts

export type Provider = 'twelvedata' | 'fred' | 'finnhub';

interface BackoffState {
  blockedUntil: number;
  attempt: number;
}

const INITIAL_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60 * 1000; // 5 minutes cap
const JITTER_MS = 1_000; // ±500ms random jitter

class RateLimiter {
  private state: Record<Provider, BackoffState> = {
    twelvedata: { blockedUntil: 0, attempt: 0 },
    fred:       { blockedUntil: 0, attempt: 0 },
    finnhub:    { blockedUntil: 0, attempt: 0 },
  };

  isBlocked(provider: Provider): boolean {
    return Date.now() < this.state[provider].blockedUntil;
  }

  onRateLimit(provider: Provider): void {
    const s = this.state[provider];
    s.attempt += 1;
    const baseDelay = Math.min(INITIAL_DELAY_MS * 2 ** (s.attempt - 1), MAX_DELAY_MS);
    const jitter = (Math.random() - 0.5) * JITTER_MS;
    s.blockedUntil = Date.now() + baseDelay + jitter;
  }

  onSuccess(provider: Provider): void {
    this.state[provider] = { blockedUntil: 0, attempt: 0 };
  }

  msUntilUnblocked(provider: Provider): number {
    return Math.max(0, this.state[provider].blockedUntil - Date.now());
  }
}

export const rateLimiter = new RateLimiter();
```

**Integrated into fetch wrappers:**
```typescript
// inside tdFetch (twelveDataService.ts)
async function tdFetch<T>(path: string): Promise<T> {
  if (rateLimiter.isBlocked('twelvedata')) {
    const ms = rateLimiter.msUntilUnblocked('twelvedata');
    throw new RateLimitError(`Rate limit reached — retrying in ${Math.ceil(ms / 1000)}s`);
  }
  const res = await fetch(`${REST_BASE}${path}...`);
  if (res.status === 429) {
    rateLimiter.onRateLimit('twelvedata');
    throw new RateLimitError('Rate limit reached — retrying shortly');
  }
  if (!res.ok) throw new HttpError(res.status, path);
  rateLimiter.onSuccess('twelvedata');
  // ... rest of fetch
}
```

### Pattern 3: Zod Schema Validation

**What:** One Zod schema per API endpoint response shape. Parse happens inside the fetch wrapper or immediately after, before any transformation.

**When to use:** On every raw `res.json()` call. Never on domain types (those are already typed by construction).

```typescript
// src/services/schemas.ts (selected examples)
import { z } from 'zod';

// TwelveData single quote
export const TdQuoteSchema = z.object({
  symbol: z.string(),
  close: z.string(),
  change: z.string(),
  percent_change: z.string(),
  name: z.string().optional(),
  open: z.string().optional(),
  high: z.string().optional(),
  low: z.string().optional(),
}).passthrough();

// TwelveData batch — a record of symbol → quote or error
export const TdBatchResultSchema = z.record(
  z.string(),
  z.union([TdQuoteSchema, z.object({ status: z.string(), message: z.string() }).passthrough()])
).passthrough();

// FRED observations response
export const FredObservationSchema = z.object({
  date: z.string(),
  value: z.string(),
}).passthrough();

export const FredResponseSchema = z.object({
  observations: z.array(FredObservationSchema),
}).passthrough();

// Finnhub news item
export const FinnhubNewsItemSchema = z.object({
  id: z.number(),
  headline: z.string(),
  source: z.string(),
  datetime: z.number(),
  url: z.string(),
  summary: z.string().optional(),
}).passthrough();

// Finnhub calendar response
export const FinnhubCalendarEventSchema = z.object({
  event: z.string(),
  time: z.string(),
  date: z.string(),
  country: z.string(),
  impact: z.string(),
  prev: z.string().nullable(),
  estimate: z.string().nullable(),
  actual: z.string().nullable(),
}).passthrough();

export const FinnhubCalendarResponseSchema = z.object({
  economicCalendar: z.array(FinnhubCalendarEventSchema).optional(),
}).passthrough();
```

**Validation triggers DataResult.error, not NaN:**
```typescript
// Inside fredFetch or service function
const raw = await res.json();
const parsed = FredResponseSchema.safeParse(raw);
if (!parsed.success) {
  throw new ValidationError('Unexpected data format');
}
// parsed.data is now typed as FredResponse
```

### Pattern 4: Error Message Mapping

**What:** Centralized lookup converting HTTP status codes and error categories into user-readable strings.

**When to use:** In service fetch wrappers when throwing typed errors. Error type determines which message key to look up.

```typescript
// src/services/errorMessages.ts

export type ErrorCategory =
  | 'rate_limit'
  | 'server_error'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'timeout'
  | 'unknown';

export function httpStatusToCategory(status: number): ErrorCategory {
  if (status === 429) return 'rate_limit';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  rate_limit:   'Rate limit reached — retrying shortly',
  server_error: 'Data unavailable — provider error',
  not_found:    'Data series not found',
  validation:   'Unexpected data format',
  network:      'Network error — check connection',
  timeout:      'Request timed out',
  unknown:      'Failed to load data',
};

export function toUserMessage(category: ErrorCategory): string {
  return ERROR_MESSAGES[category];
}
```

### Pattern 5: useMarketData Hook Adaptation

**What:** Each fetch callback in `useMarketData` is updated to unwrap `DataResult<T>` instead of catching throws.

**Current pattern (Phase 1):**
```typescript
const fetchEquities = useCallback(async () => {
  setStatus('equities', loadingStatus);
  try {
    const equities = await getTwelveEquities();  // returns PriceItem[] or throws
    setData(prev => ({ ...prev, equities }));
    setStatus('equities', loadedStatus);
  } catch (e) {
    setStatus('equities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
  }
}, []);
```

**New pattern (Phase 2):**
```typescript
const fetchEquities = useCallback(async () => {
  setStatus('equities', loadingStatus);
  const result = await getTwelveEquities();  // returns DataResult<PriceItem[]>
  if (result.status === 'error') {
    setStatus('equities', errorStatus(result.error));
    return;
  }
  setData(prev => ({ ...prev, equities: result.data }));
  setStatus('equities', loadedStatus);
}, []);
```

Note: Service functions no longer throw at the public API boundary. They catch internally and return `DataResult.error`. The hook's try/catch becomes unnecessary for normal flow (it can remain as a safety net for truly unexpected throws from infrastructure).

### Pattern 6: Partial Success in Multi-Source Widgets

**What:** Rates and credit widgets aggregate multiple sources. When some sources succeed and others fail, return available data with `source: 'partial'` and populate `warnings`.

**Rates widget example (TwelveData + FRED):**
```typescript
export async function getTwelveRates(): Promise<DataResult<TwelveRatesResult>> {
  // If rate-limited, return error immediately
  // If fetch succeeds, parse with Zod schema
  // If parse fails, return DataResult.error
  // If all ok, return DataResult.ok with source: 'live'
}

// In useMarketData fetchRates callback:
const [tdResult, fredResult, fedFundsResult, tipsResult, vixResult] = await Promise.allSettled([
  getTwelveRates(),
  getFredTreasuryYields(),
  getFredFedFundsRate(),
  getFredTipsBreakeven(),
  getFredVix(),
]);

const warnings: ResultWarning[] = [];
const tdRates = tdResult.status === 'fulfilled' && tdResult.value.status === 'ok'
  ? tdResult.value.data
  : (warnings.push({ field: 'treasury_rates', message: 'TwelveData rates unavailable' }), null);

// ... assemble rates array using fallback values for null sources ...
// Set 'rates' widget status with warnings if any sources failed
```

### Anti-Patterns to Avoid

- **Returning mock data from service functions on error:** Replace all `catch { return mockMarketData.X }` with `return { status: 'error', error: toUserMessage('unknown'), source: 'fallback', timestamp: Date.now() }`.
- **Catching DataResult.error in the hook:** The hook reads `result.status`, it does not catch. Only genuine infrastructure throws (fetch API crash, network down) need try/catch in the hook.
- **Zod `.parse()` instead of `.safeParse()`:** `.parse()` throws a ZodError with internal details. Use `.safeParse()` and convert `!parsed.success` to `DataResult.error` with a human-readable message, never exposing `parsed.error.issues` to users.
- **Validating domain types with Zod:** Zod schemas validate raw API response shapes (before transformation). Do not add Zod schemas on `PriceItem`, `MarketData`, or other internal domain types — TypeScript handles those.
- **Blocking the UI thread during backoff:** The rate limiter checks `blockedUntil` synchronously and throws immediately — it does NOT sleep or await. The hook sets an error status and moves on. Retry happens on the next polling interval or manual retry click.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API response validation | Custom type guards for 10+ endpoint shapes | Zod schemas with `.safeParse()` | Manual guards like `isTdQuote` only check a subset of fields; Zod validates entire shape with composable, self-documenting schemas |
| Error type discrimination | `instanceof Error` string parsing | Typed error classes + `ErrorCategory` enum + `ERROR_MESSAGES` record | String parsing is brittle; typed errors allow the message mapper to produce consistent user strings without inspecting error message content |

**Key insight:** The current `isTdQuote()` guard checks only `'close' in v && 'percent_change' in v`. A response with `close: null` or `percent_change: undefined` passes the guard and produces `NaN` downstream. Zod's `z.string()` on those fields catches that case.

## Common Pitfalls

### Pitfall 1: DataResult Propagation Breaks Multi-Level Internal Helpers

**What goes wrong:** `fetchSeries` in `fredService.ts` is called by multiple exported functions. If `fetchSeries` is changed to return `DataResult<TimeSeriesPoint[]>`, every caller must unwrap it, adding noise. Alternatively, if it continues to throw, callers must catch and convert — also noisy.

**Why it happens:** Internal helpers are shared by multiple callers; the DataResult boundary is not at the internal helper level but at the exported function level.

**How to avoid:** Keep internal helpers (`fetchSeries`, `fetchLatestValue`, `fetchBatchQuotes`, `fetchSingleQuote`) as throw-on-failure functions. Only the exported public functions (`getLiveInflation`, `getLiveCreditSpreads`, etc.) return `DataResult<T>`. The exported functions catch throws from internal helpers and convert them to `DataResult.error`.

**Warning signs:** Finding `DataResult` imports inside `fetchSeries` or `fetchLatestValue` — these helpers should not produce DataResults.

### Pitfall 2: Zod Version 4 Breaking Changes

**What goes wrong:** Zod 4.x changed several APIs from Zod 3.x. Training data may describe Zod 3 patterns. The latest version is 4.3.6 (published 2026-01-25).

**Why it happens:** Many tutorials and Stack Overflow answers document Zod 3.

**How to avoid:** Key Zod 4 changes that affect this codebase:
- `z.object().passthrough()` still works the same way in Zod 4
- `safeParse()` still returns `{ success: boolean, data?: T, error?: ZodError }` in Zod 4
- Import is still `import { z } from 'zod'`
- `z.string().nullable()` and `z.string().optional()` still work the same
- Zod 4 removed some internal APIs (`ZodIssueCode` etc.) — only use the public `.safeParse()`, `.parse()`, `.schema` surface

**Warning signs:** Using `z.instanceof()` or `z.function()` for API validation — these are never appropriate for HTTP response validation.

### Pitfall 3: Silent Partial Success Looks Like Full Success

**What goes wrong:** A widget shows data without indicating some sources failed. The user sees partial data but thinks it is complete.

**Why it happens:** The `status: 'ok'` branch in `DataResult` does not require all sources to have succeeded. Without a visible warning, partial data looks like live data.

**How to avoid:** When `result.warnings` is non-empty, set a distinct widget status (not just `loadedStatus`). The `Widget.tsx` error UI does not need to change for Phase 2 — the existing `status.error` string field can carry the warning text with a lighter presentation treatment. Document in the plan that a proper `warnedStatus` UI treatment is a Phase 5 concern (UI-02).

**Warning signs:** `fetchRates` or `fetchCredit` setting `loadedStatus` even when one of the five input sources returned `DataResult.error`.

### Pitfall 4: TypeScript noUnusedLocals Breaks During Migration

**What goes wrong:** During transition, service functions have updated signatures but callers (the hook) still have the old unwrapping pattern. TypeScript strict mode flags `error` variable as unused, or flags that `equities: PriceItem[]` is no longer assignable where `DataResult<PriceItem[]>` is now returned.

**Why it happens:** The migration is incremental — services change before the hook is updated.

**How to avoid:** Update services and hook in the same wave or ensure that intermediate states compile. Keep `npm run typecheck` passing at each step. The order: types first → schemas → rateLimiter → errorMessages → service files → hook.

**Warning signs:** TypeScript errors about `DataResult<PriceItem[]>` not assignable to `PriceItem[]` in `useMarketData`.

### Pitfall 5: Rate Limiter State Shared Across React StrictMode Double-Mount

**What goes wrong:** React StrictMode double-invokes effects in development. If the rate limiter singleton records a "blocked" state from the first mount's fetch, the second mount's fetch sees a blocked state and returns error instead of data.

**Why it happens:** Module-level singletons persist across React unmount/remount cycles in dev. The `cache.ts` singleton has the same characteristic but is harmless (it just returns cached data). The rate limiter is harmful if it enters backoff state from a first-mount fetch attempt.

**How to avoid:** Only `onRateLimit()` sets a blocked state — it only fires on an actual 429 response from the provider. During normal StrictMode double-mount, no 429 occurs, so backoff state is never triggered. This pitfall is only real if the API actually returns 429 during dev. Document this in the plan as awareness, not a code change required.

**Warning signs:** Rate limiter blocking in dev without ever hitting a real 429.

### Pitfall 6: Zod Parse Errors Leak API Details

**What goes wrong:** `parsed.error.issues` contains field names and expected types from the raw API response shape. If this is put directly into `DataResult.error`, it exposes internal schema details to the UI.

**Why it happens:** Developer uses `parsed.error.message` or `JSON.stringify(parsed.error.issues)` as the error string.

**How to avoid:** Always use `toUserMessage('validation')` → `"Unexpected data format"` as the error string for Zod parse failures. Never expose `parsed.error.issues` to `DataResult.error`.

## Code Examples

Verified patterns from official sources:

### Zod safeParse Pattern (Zod 4.x)

```typescript
// Source: https://zod.dev — verified against Zod 4.x public API
import { z } from 'zod';

const TdQuoteSchema = z.object({
  symbol: z.string(),
  close: z.string(),
  change: z.string(),
  percent_change: z.string(),
}).passthrough();

// Inside tdFetch or service function, after res.json():
const raw = await res.json();
const parsed = TdQuoteSchema.safeParse(raw);
if (!parsed.success) {
  // parsed.error.issues contains details — do NOT forward to user
  throw new ValidationError('Unexpected data format');
}
// parsed.data is typed as z.infer<typeof TdQuoteSchema>
return parsed.data;
```

### DataResult Construction in a Service Function

```typescript
// Exported service function — always returns DataResult, never throws
export async function getFinnhubNews(): Promise<DataResult<NewsItem[]>> {
  const cacheKey = 'finnhub:news:general';
  const cached = cache.get<NewsItem[]>(cacheKey);
  if (cached) {
    return { status: 'ok', data: cached, source: 'cache', timestamp: Date.now() };
  }

  try {
    const items = await fetchAndValidateNews(); // internal, throws on error
    cache.set(cacheKey, items, TTL.FINNHUB);
    return { status: 'ok', data: items, source: 'live', timestamp: Date.now() };
  } catch (e) {
    const category = e instanceof RateLimitError ? 'rate_limit'
      : e instanceof ValidationError ? 'validation'
      : e instanceof HttpError ? httpStatusToCategory(e.status)
      : 'unknown';
    return {
      status: 'error',
      error: toUserMessage(category),
      source: 'fallback',
      timestamp: Date.now(),
    };
  }
}
```

### Typed Error Classes

```typescript
// src/services/errorMessages.ts (or a shared errors module)

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class HttpError extends Error {
  constructor(public status: number, path: string) {
    super(`HTTP ${status}: ${path}`);
    this.name = 'HttpError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Exponential Backoff with Jitter

```typescript
// Backoff formula: delay = min(INITIAL * 2^(attempt-1), MAX) ± jitter/2
// attempt=1: 5s ± 0.5s
// attempt=2: 10s ± 0.5s
// attempt=3: 20s ± 0.5s
// attempt=5: 80s ± 0.5s
// attempt=7: 320s → capped at 300s ± 0.5s

onRateLimit(provider: Provider): void {
  const s = this.state[provider];
  s.attempt += 1;
  const baseDelay = Math.min(INITIAL_DELAY_MS * Math.pow(2, s.attempt - 1), MAX_DELAY_MS);
  const jitter = (Math.random() - 0.5) * JITTER_MS;
  s.blockedUntil = Date.now() + baseDelay + jitter;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual type guards (`isTdQuote`) | Zod schema validation | Zod v1 → current | Validates full response shape, not just field presence |
| `as T` cast on `res.json()` | `.safeParse()` with error propagation | Phase 2 | Eliminates silent NaN from malformed responses |
| `catch { return mockData }` | `catch { return DataResult.error }` | Phase 2 | Errors surface to widget UI instead of silently substituting stale data |
| Flat 5-second reconnect (WebSocket) | Exponential backoff | Phase 3 (not Phase 2) | Noted here: rate limit backoff is Phase 2; WS backoff is Phase 3 |

**Deprecated/outdated:**
- `isTdQuote()` type guard in `twelveDataService.ts`: superseded by `TdQuoteSchema.safeParse()` in Phase 2. Remove after schemas are in place.
- Mock data returns in service-level `catch` blocks: all replaced by `DataResult.error` returns.
- Unused `fetchSingleQuote` in `twelveDataService.ts`: should be confirmed as still needed or removed during Phase 2 (currently only `fetchBatchQuotes` is used by exported functions).

## Open Questions

1. **Should `DataSource` include `'partial'` or should partial success use `source: 'live'` with a non-empty `warnings` array?**
   - What we know: D-09 says "return available data with a `source: 'partial'` or warning flag" — left to Claude's discretion
   - Recommendation: Use `source: 'partial'` as a distinct `DataSource` value for clarity. The hook can check `result.source === 'partial'` to set a distinct widget status without inspecting `warnings` length. This is cleaner than checking `warnings?.length > 0` everywhere.

2. **Where does Zod import go — `schemas.ts` or inline in each service?**
   - What we know: D-05 says "one schema per endpoint return type"; codebase convention is no barrel files
   - Recommendation: One `src/services/schemas.ts` file containing all Zod schemas grouped by provider. Each service file imports only its needed schemas. This follows the existing `cache.ts` singleton pattern for shared service infrastructure.

3. **How should `retryWidget` in useMarketData interact with rate limit backoff?**
   - What we know: If a widget is in error state from a 429, clicking "Retry" will call `retryWidget(key)` which immediately calls the service again, which will hit the rate limiter check and return `DataResult.error` again with "retrying shortly"
   - Recommendation: This is acceptable behavior for Phase 2. The error message "Rate limit reached — retrying shortly" tells the user not to keep clicking. A future enhancement (Phase 5 REL-05) adds a countdown display. No code change needed beyond accurate error message.

## Environment Availability

> Step 2.6: Environment check — zod is the only new external dependency.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | v24.14.0 | — |
| npm | package install | ✓ | (via Node 24) | — |
| zod | DATA-04 schema validation | ✗ (not yet installed) | — | None — must install |
| TypeScript strict mode | DataResult narrowing | ✓ | 5.5.3 | — |

**Missing dependencies with no fallback:**
- `zod` — required for DATA-04. Install with `npm install zod@4.3.6` before implementing schemas.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently installed — Vitest planned for Phase 6 (TEST-01) |
| Config file | none — Wave 0 of Phase 2 does not install test framework |
| Quick run command | `npm run typecheck` (TypeScript compilation check) |
| Full suite command | `npm run typecheck && npm run lint` |

**Note:** `nyquist_validation` is enabled in config, but Phase 6 is dedicated to TEST-01 through TEST-05 (Vitest + MSW setup). Phase 2 has no automated test infrastructure to run unit tests against. Validation for Phase 2 is TypeScript compilation and ESLint, plus manual browser verification that widgets show error states on API failure.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Service functions return DataResult<T> not raw T | TypeScript compile | `npm run typecheck` | ✓ (tsconfig.app.json) |
| DATA-02 | Widget error state shown — no silent mock substitution | Manual browser test | — | ✗ manual only |
| DATA-03 | 429 response triggers backoff, subsequent requests blocked | Manual (need 429 from provider) | — | ✗ manual only |
| DATA-04 | Malformed JSON triggers error state not NaN | TypeScript + manual | `npm run typecheck` | ✓ |
| DATA-05 | Partial source failure shows available data + warning | Manual browser test | — | ✗ manual only |
| DATA-06 | User-readable error messages in widget error UI | Manual browser test | — | ✗ manual only |

### Sampling Rate

- **Per task commit:** `npm run typecheck && npm run lint`
- **Per wave merge:** `npm run typecheck && npm run lint && npm run build`
- **Phase gate:** `npm run build` succeeds with zero type errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No test files needed for Phase 2 (testing deferred to Phase 6)
- [ ] `npm install zod@4.3.6` — must run before schema implementation tasks

*(Test infrastructure gaps are intentional: Phase 6 installs Vitest + MSW and writes service tests retroactively)*

## Sources

### Primary (HIGH confidence)

- Zod official docs (https://zod.dev) — `.passthrough()`, `safeParse()`, schema composition, Zod 4.x API surface verified
- `npm view zod version` — 4.3.6 (latest, published 2026-01-25), verified live from npm registry
- `src/services/fredService.ts` — `Promise.allSettled` partial success pattern already in use, confirms D-10 foundation
- `src/hooks/useMarketData.ts` — current try/catch error handling pattern, confirms hook adaptation scope
- `src/types/index.ts` — existing `WidgetStatus` discriminated union, confirms DataResult alignment approach
- `src/services/cache.ts` — existing singleton pattern, confirms rateLimiter singleton approach
- CONTEXT.md decisions D-01 through D-10 — locked decisions verified as internally consistent

### Secondary (MEDIUM confidence)

- Exponential backoff with jitter algorithm — standard distributed systems pattern; timing parameters (5s initial, 5min cap, 1s jitter range) are within the range used by major API client libraries
- `DataSource: 'partial'` as distinct value — recommendation based on TypeScript narrowing ergonomics; not from an external source

### Tertiary (LOW confidence)

- None — all claims are either from official docs, live registry queries, or direct source code analysis

## Metadata

**Confidence breakdown:**
- Standard stack (Zod): HIGH — version verified from npm registry, official docs consulted
- DataResult type design: HIGH — grounded in existing WidgetStatus pattern and locked decisions
- RateLimiter pattern: HIGH — grounded in existing cache.ts singleton pattern; backoff formula is standard
- Zod schema shapes: MEDIUM — schemas are derived from reading the existing TypeScript types and current service code; actual API response shapes not verified against live API (no keys available in this environment)
- Backoff timing parameters: MEDIUM — reasonable defaults, not benchmarked against actual provider rate limit windows

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable domain; Zod 4.x API unlikely to change significantly in 30 days)
