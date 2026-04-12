# Technology Stack: Reliability Refactor

**Project:** MacroPulse — reliability milestone
**Researched:** 2026-04-08
**Research basis:** Codebase analysis (full read) + training knowledge (cutoff August 2025). External tools (WebSearch, WebFetch) were denied. Version claims are flagged with confidence levels; verify with `npm view <pkg> version` before pinning.

---

## Context: What the Codebase Already Has

This is a brownfield refactor. The stack is locked (React 18 + TypeScript 5.5 + Vite 5.4 + Tailwind 3.4). The reliability work adds to this stack — it does not replace any of it.

**What already works:**
- In-memory TTL cache (`cache.ts`) — deduplicates API calls per TTL window
- Per-widget error/retry state model (`WidgetStatus` discriminated union)
- `Promise.allSettled` isolation so one source does not block others
- Manual retry via `retryWidget(key)` dispatch

**What is broken and needs new tooling:**
- WebSocket reconnects on a fixed 5-second timer — no backoff, no retry cap, no "gave up" state
- HTTP fetches have no retry logic at all — a single transient failure means mock data
- TwelveData REST is within ~1 request of the 8/min free tier limit — hitting it silently returns mock data
- API responses are cast unsafely (`res.json() as Promise<T>`) — malformed shapes produce `NaN` silently
- No error boundaries — a render panic in one widget crashes the whole dashboard
- Zero test coverage — any refactor of service logic is undetectable regression risk

---

## Recommended Stack Additions

### 1. WebSocket Reconnection

**Recommended:** Write a custom `ReconnectingWebSocket` class (200 lines, zero dependencies)

**Rationale:** The existing `twelveDataService.ts` already implements a custom WebSocket singleton with `onopen`, `onclose`, `onerror`, `onmessage`, and a reconnect timer. The gap is purely the reconnection algorithm. Adding a library means a new abstraction layer over native `WebSocket` that complicates the subscription model (`wsCallbacks: Set<WsCallback>`) the codebase already uses.

The fix is straightforward: replace the flat `wsReconnectTimer = setTimeout(connectWebSocket, 5000)` with an exponential backoff calculation. This is ~30 lines of code — not a library problem.

**Algorithm to implement (no library needed):**

```typescript
// State to add alongside existing ws module-level vars:
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 5 * 60 * 1000; // 5 minutes

function getReconnectDelay(): number {
  // Full-jitter exponential backoff — avoids thundering herd from multiple tabs
  const exp = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempts), MAX_DELAY_MS);
  return Math.random() * exp;
}

// In ws.onclose:
ws.onclose = () => {
  wsConnected = false;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    // Stop retrying — surface "live data unavailable" state to callers
    wsCallbacks.forEach(cb => cb({ type: 'disconnected' }));
    return;
  }
  const delay = getReconnectDelay();
  reconnectAttempts++;
  wsReconnectTimer = setTimeout(connectWebSocket, delay);
};

// In ws.onopen (reset counter on successful connect):
ws.onopen = () => {
  wsConnected = true;
  reconnectAttempts = 0;
  // ... existing subscribe send
};
```

**Confidence:** HIGH — this is a standard algorithm, no library required, fits the existing code shape.

**If you still want a library:**

| Library | npm version | Why it's inferior here |
|---------|-------------|----------------------|
| `reconnecting-websocket` | ~4.4.0 (MEDIUM confidence on version) | Wraps the native WebSocket constructor, would require refactoring the existing singleton and subscription model. Also has an open issue tracker with long-inactive maintenance. |
| `@stomp/stompjs` | — | STOMP protocol — not what TwelveData uses. Wrong tool. |
| `socket.io-client` | — | Requires a Socket.IO server. TwelveData uses plain WebSocket. Wrong tool. |

**Verdict:** Implement the algorithm directly. Do not add a library for this.

---

### 2. HTTP Retry with Exponential Backoff

**Recommended:** `p-retry` ^7.0.0

**Confidence:** MEDIUM (version approximate — verify with `npm view p-retry version`)

**Rationale:**

The existing `tdFetch`, `finnhubFetch`, and the FRED fetch helpers all use native `fetch` with no retry. A transient 429/503 response sets mock data immediately. The fix requires: detect retriable errors (network failure, 429, 500-503), wait with jitter, retry N times, then rethrow.

`p-retry` is the right choice because:
- It is the canonical retry primitive in the Node/browser ecosystem, authored by the `sindresorhus` quality tier
- It has no browser dependencies, is ESM-native (important for Vite), and has zero transitive dependencies
- It accepts an `AbortSignal` — critical for cancelling retries when the component unmounts
- It gives per-attempt callbacks for observability (can update widget status to show "retrying…")
- API is minimal and fits the existing service pattern: wrap the `fetch` call, pass `shouldRetry` predicate

**Usage pattern for this codebase:**

```typescript
import pRetry, { AbortError } from 'p-retry';

// Replace tdFetch's inner fetch call:
async function tdFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  return pRetry(
    async () => {
      const res = await fetch(`${REST_BASE}${path}&apikey=${API_KEY}`, { signal });
      if (res.status === 429) throw new AbortError('Rate limited'); // do not retry 429 — escalate immediately
      if (!res.ok) throw new Error(`TwelveData ${res.status}`);
      const json = await res.json();
      if ((json as { status?: string }).status === 'error') {
        throw new AbortError(`TwelveData API error: ${(json as { message?: string }).message}`);
      }
      return json as T;
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 10000,
      randomize: true, // adds jitter
      onFailedAttempt: (error) => {
        console.warn(`[tdFetch] attempt ${error.attemptNumber} failed: ${error.message}`);
      },
    }
  );
}
```

**What NOT to use:**

| Library | Why not |
|---------|---------|
| `axios-retry` | Requires `axios`. Codebase uses native `fetch` — do not add axios just for retry. |
| `retry` (npm) | Lower-level callback API, not promise-native, requires more boilerplate. |
| `got` | Full HTTP client — would replace `fetch` everywhere. Overkill; introduces two abstractions. |
| `ky` | Also a full `fetch` wrapper. Same problem — too wide a change for a reliability patch. |
| Rolling your own retry loop | Tempting but error-prone: easy to forget jitter, easy to not handle `AbortSignal`, easy to retry non-retriable errors. Use `p-retry`. |

**Installation:**

```bash
npm install p-retry
```

---

### 3. Rate Limit Handling

**Recommended:** Implement a lightweight in-process request queue using `p-queue` ^8.0.0

**Confidence:** MEDIUM (version approximate — verify with `npm view p-queue version`)

**Rationale:**

TwelveData free tier is 8 requests/minute. The codebase currently fires 5–9 REST calls per 60-second polling cycle, verified from `CONCERNS.md`. There is no coordination — all calls fire in parallel. A full load triggers 30+ FRED requests simultaneously.

`p-queue` is the right choice because:
- Same author as `p-retry` (sindresorhus), same quality tier, ESM-native, zero transitive dependencies
- `concurrency` option limits simultaneous in-flight requests
- `intervalCap` + `interval` options enforce a rate cap (e.g., 7 requests per 60 seconds for TwelveData, leaving 1 request of headroom)
- Integrates with `p-retry` — queued items can be retried without double-counting against the queue

**Usage pattern:**

```typescript
import PQueue from 'p-queue';

// In twelveDataService.ts — one queue per API provider:
const tdQueue = new PQueue({
  concurrency: 2,       // at most 2 in-flight at once
  intervalCap: 7,       // at most 7 requests...
  interval: 60 * 1000,  // ...per 60 seconds
});

// Wrap all tdFetch calls through the queue:
async function tdFetchQueued<T>(path: string): Promise<T> {
  return tdQueue.add(() => tdFetch<T>(path)) as Promise<T>;
}
```

**What NOT to use:**

| Approach | Why not |
|----------|---------|
| `bottleneck` | Heavier library, more complex API, CommonJS-first (Vite ESM incompatibility risk). |
| `limiter` | Older, less maintained, CommonJS. |
| Rolling a token-bucket in the cache module | Feasible but significantly more code than `p-queue`; `p-queue` is purpose-built. |
| Relying on longer polling intervals alone | The bottleneck is burst concurrency on first load — polling interval does not fix the 30+ parallel FRED requests at startup. |

**Installation:**

```bash
npm install p-queue
```

---

### 4. Runtime API Response Validation

**Recommended:** `zod` ^3.23.0

**Confidence:** HIGH — Zod is the dominant TypeScript validation library as of August 2025; v3.x API is stable.

**Rationale:**

Every API service in the codebase casts responses with `res.json() as Promise<T>` or `json as T`. A malformed or changed API response passes silently into state, producing `NaN` values displayed to users (confirmed in `CONCERNS.md`). Zod adds parse-at-the-boundary validation that converts malformed shapes into explicit errors rather than silent data corruption.

The existing `isTdQuote` type guard in `twelveDataService.ts` is the right pattern — Zod automates generating these guards from schemas, with better error messages.

**Scope for this milestone:** Validate the three most critical response shapes first:
1. `TdBatchQuote` (drives equities, FX, commodities — all price panels)
2. `FredSeriesResponse` (drives yields, inflation, credit spreads)
3. `FinnhubNewsItem[]` (drives news widget)

**Usage pattern:**

```typescript
import { z } from 'zod';

const TdQuoteSchema = z.object({
  symbol: z.string(),
  close: z.string(),
  change: z.string(),
  percent_change: z.string(),
  open: z.string().optional(),
  high: z.string().optional(),
  low: z.string().optional(),
});

// In tdFetch, after res.json():
const parsed = TdQuoteSchema.safeParse(json);
if (!parsed.success) {
  console.error('[TwelveData] unexpected response shape:', parsed.error.format());
  throw new Error('TwelveData response schema mismatch');
}
return parsed.data;
```

**What NOT to use:**

| Library | Why not |
|---------|---------|
| `io-ts` | Functional programming style — steep learning curve, verbose schemas, does not match this codebase's conventions. |
| `yup` | Validation-only, not schema-first TypeScript inference. Zod's type inference is tighter. |
| `valibot` | Newer, smaller bundle, but smaller ecosystem and fewer adoption examples. Zod is the safer bet for a project with existing TypeScript patterns. |
| Manual type guards | Already started (`isTdQuote`) but do not scale — each field must be checked manually, easy to miss nested objects. |

**Installation:**

```bash
npm install zod
```

---

### 5. React Error Boundaries

**Recommended:** `react-error-boundary` ^4.0.0

**Confidence:** HIGH — this is the standard library for React error boundaries; class component pattern is well established.

**Rationale:**

There are no error boundaries anywhere in the codebase. An unhandled render panic in any widget (confirmed as a missing critical feature in `CONCERNS.md`) produces a white screen. `react-error-boundary` provides:
- `ErrorBoundary` component with `fallback` or `FallbackComponent` props — drop-in around each widget
- `useErrorBoundary()` hook — allows errors thrown in event handlers or async code to be caught by the nearest boundary
- `resetKeys` prop — allows the boundary to auto-reset when data changes (e.g., when `retryWidget` fires)
- Compatible with React 18 concurrent mode

**Usage pattern for this codebase:**

```tsx
import { ErrorBoundary } from 'react-error-boundary';

// In DashboardGrid.tsx, wrap each widget:
<ErrorBoundary
  fallback={<WidgetErrorFallback widgetId={id} onRetry={() => retryWidget(id)} />}
  resetKeys={[statuses[id]]} // reset boundary when status changes (e.g., after retry)
>
  <YieldCurveChart data={data.yields} status={statuses.yields} />
</ErrorBoundary>
```

**What NOT to use:**

| Approach | Why not |
|----------|---------|
| Writing a class component ErrorBoundary manually | Tedious, easy to miss `componentDidCatch` vs `getDerivedStateFromError` distinctions. `react-error-boundary` encapsulates this correctly. |
| Relying on `WidgetStatus` error state alone | `WidgetStatus` catches async data errors. It does NOT catch synchronous render exceptions (e.g., `Cannot read properties of undefined`). Both layers are needed. |

**Installation:**

```bash
npm install react-error-boundary
```

---

### 6. Testing Framework

**Recommended:** Vitest ^2.0 + Testing Library ^16.0 + MSW ^2.0

**Confidence:** HIGH for Vitest and Testing Library. MEDIUM for MSW version (verify).

**Rationale:**

The project already uses Vite 5.4 and has no test infrastructure. The existing `TESTING.md` analysis already recommends this stack — this research confirms it.

**Why Vitest (not Jest):**

- Vitest reuses Vite's module resolution and transform pipeline — no separate Babel/SWC config, no `moduleNameMapper` for CSS/assets
- Vitest supports native ESM — the codebase is `"type": "module"` and uses `import.meta.env.*`, both of which are problematic in Jest without additional shims
- Watch mode is faster than Jest because Vitest only re-runs files affected by the changed module graph
- The `vitest.config.ts` can import from `vite.config.ts` directly to share plugin configuration
- API is Jest-compatible (`describe`, `it`, `expect`, `vi.fn()`, `vi.mock()`) — near-zero learning curve

**Why Testing Library (not Enzyme or manual rendering):**

- `@testing-library/react` renders components into jsdom and exposes queries by accessible role/text — tests resemble real user interactions
- `@testing-library/user-event` for simulated clicks/keyboard events
- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveTextContent`) work with Vitest's `expect`

**Why MSW v2 (not `vi.mock(fetch)` or nock):**

- MSW intercepts `fetch` at the service worker level in the browser and at `node:http` in Node — the same handler code works in both environments
- Critical for this codebase: the service functions call `fetch` directly with real URLs. MSW handlers can simulate 429 responses, network errors, and malformed JSON — the exact failure modes this milestone addresses
- MSW v2 (released late 2023, stable through 2025) uses a `http.get/post` handler API that is TypeScript-native
- Alternative (`vi.mock('node:fetch')`) produces brittle tests tied to internal fetch implementation details

**Package breakdown:**

```bash
# Test runner + coverage
npm install -D vitest @vitest/coverage-v8

# Browser environment simulation
npm install -D jsdom

# React component testing
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom

# API mocking (service layer tests)
npm install -D msw

# Type support
npm install -D @types/node
```

**Minimal `vitest.config.ts`:**

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/services/**', 'src/hooks/**'],
    },
  },
}));
```

**`src/test/setup.ts`:**

```typescript
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

**`package.json` scripts to add:**

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "coverage": "vitest run --coverage"
}
```

**Test priority order (from `TESTING.md` analysis):**

1. `cache.ts` — pure class, no mocks needed
2. `finnhubService.ts` — `classifySentiment`, `getUpcomingFomcDates` (pure functions)
3. `fredService.ts` — `isoDateOffset`, `buildRibbonFromWs` (pure functions)
4. `twelveDataService.ts` — WebSocket reconnect state machine (mock WebSocket)
5. `useMarketData.ts` — retry dispatch, status transitions (MSW + fake timers)

**What NOT to use:**

| Tool | Why not |
|------|---------|
| Jest | `import.meta.env` requires `vite-jest` or `babel-jest` transforms. The `"type": "module"` package causes Jest config complexity. No shared config with Vite. Viable but harder to set up correctly. |
| Playwright / Cypress | E2E tools — wrong scope for unit/integration testing of service layer and hooks. Add later for smoke tests. |
| `nock` | Intercepts Node's `http` module, not `fetch`. Codebase uses `fetch`. Does not work here. |
| `jest-fetch-mock` | Jest-specific, not Vitest-compatible. |

---

## Alternatives Considered (Summary)

| Category | Recommended | Considered | Why Not |
|----------|-------------|------------|---------|
| WebSocket reconnect | Custom algorithm | `reconnecting-websocket` | Library adds abstraction over an existing singleton; 30 lines solves it |
| HTTP retry | `p-retry` | `axios-retry`, custom loop | `axios-retry` requires replacing `fetch`; custom loops miss jitter and `AbortSignal` |
| Rate limiting | `p-queue` | `bottleneck`, `limiter` | Both are CommonJS-first with Vite ESM risk |
| Response validation | `zod` | `io-ts`, `yup`, manual guards | `io-ts` too verbose; `yup` weaker TS inference; manual guards don't scale |
| Error boundaries | `react-error-boundary` | Class component DIY | Library handles `resetKeys` and concurrent mode correctly |
| Test runner | Vitest | Jest, Playwright | Jest requires transform config for `import.meta.env`; Playwright is E2E scope |
| API mocking | MSW | `vi.mock(fetch)`, `nock` | `vi.mock` brittle; `nock` intercepts Node `http`, not `fetch` |

---

## Complete Installation

```bash
# Runtime additions (3 packages):
npm install p-retry p-queue zod react-error-boundary

# Dev additions (testing, 7 packages):
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw @types/node

# Removals (dead dependencies from CONCERNS.md):
npm uninstall @massive.com/client-js @supabase/supabase-js
```

---

## Version Verification Checklist

These versions are from training data (cutoff August 2025) and must be verified before pinning:

| Package | Expected version | Verify command |
|---------|-----------------|----------------|
| `p-retry` | ^7.x | `npm view p-retry version` |
| `p-queue` | ^8.x | `npm view p-queue version` |
| `zod` | ^3.23.x | `npm view zod version` |
| `react-error-boundary` | ^4.x | `npm view react-error-boundary version` |
| `vitest` | ^2.x | `npm view vitest version` |
| `@testing-library/react` | ^16.x | `npm view @testing-library/react version` |
| `msw` | ^2.x | `npm view msw version` |

**Compatibility note:** `p-retry` and `p-queue` are ESM-only packages (`sindresorhus` policy since 2021). Vite 5.4 handles ESM-only dependencies correctly. Jest would require additional transform config — another reason to use Vitest.

---

## What This Stack Does NOT Address

These are out of scope for the reliability milestone per `PROJECT.md`:

- **API key exposure** — keys in browser bundle is a security concern noted in `CONCERNS.md`. Fix requires a server-side proxy (Cloudflare Worker, Vercel Edge Function). This milestone is client-side only.
- **Persistent server-side cache** — multi-tab deduplication requires a backend. Out of scope.
- **Authentication** — personal dashboard, not needed.
- **Brent Crude / DXY fabricated data** — data correctness issues, not reliability infrastructure.

---

*Research basis: Codebase analysis (full read of all service files, architecture, concerns, testing docs) + training knowledge August 2025. No external search tools available during research session. Confidence levels assigned per finding. All version claims require verification.*
