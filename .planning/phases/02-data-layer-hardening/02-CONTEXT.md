# Phase 2: Data Layer Hardening - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wrap all service calls in typed DataResult<T> wrappers so errors propagate clearly to widgets instead of silently becoming mock data. Add rate limit handling (429 detection with backoff), Zod schema validation on API responses, partial success handling for multi-source widgets, and human-readable error messages. Scope is strictly DATA-01 through DATA-06 — no UI changes, no WebSocket changes, no new data sources.

</domain>

<decisions>
## Implementation Decisions

### DataResult<T> Wrapper Shape (DATA-01)
- **D-01:** Discriminated union: `{ status: 'ok', data: T, source: DataSource, timestamp: number } | { status: 'error', error: string, source: DataSource, timestamp: number }` where `DataSource = 'live' | 'cache' | 'fallback'`. This aligns with the existing `WidgetStatus` discriminated union pattern and enables clean TypeScript narrowing in consuming code.
- **D-02:** Every service function (getTwelveEquities, getTwelveRates, getTwelveFX, getTwelveCommodities, getFredRates, getFredCredit, getFredInflation, getFredYieldCurve, getFinnhubNews, getFinnhubCalendar, getFinnhubFedWatch) must return `DataResult<T>` instead of raw `T`.

### Rate Limit Backoff Strategy (DATA-03)
- **D-03:** Custom per-provider backoff — no new dependencies (no p-queue). Track 429 timestamps per provider (TwelveData, FRED, Finnhub). Exponential backoff with jitter. Integrated into the existing `tdFetch`, `fredFetch`, and `finnhubFetch` wrapper functions so all downstream callers get rate limit protection automatically.
- **D-04:** Backoff state lives in a module-level singleton (similar pattern to `cache.ts`) — not in React state. This keeps it stable across re-renders and accessible from any service function.

### Zod Validation Scope (DATA-04)
- **D-05:** All external API responses validated with Zod schemas. One schema per endpoint return type. Use passthrough mode (`.passthrough()`) so extra fields from API changes don't cause validation failures.
- **D-06:** Validation failure triggers `DataResult.error` — the widget shows error state, not NaN/undefined values. The raw API response is not exposed to components.

### Error Message Design (DATA-06)
- **D-07:** Centralized error mapping module (`src/services/errorMessages.ts` or similar). Maps provider + HTTP status code + error type → user-friendly string. Examples: 429 → "Rate limit reached — retrying shortly", 500 → "Data unavailable — provider error", validation failure → "Unexpected data format".
- **D-08:** Error strings stored in DataResult.error, consumed by Widget.tsx error UI. No raw HTTP codes or stack traces shown to users.

### Partial Success Handling (DATA-05)
- **D-09:** For multi-source widgets (e.g., rates from both FRED and TwelveData, credit spreads from multiple FRED series), when one source fails: return available data with a `source: 'partial'` or warning flag. The widget renders what it has with a visible indicator that some data is missing.
- **D-10:** The existing `Promise.allSettled` pattern in fredService.ts is the right foundation — extend it to populate DataResult with partial success metadata rather than silently falling back to mock.

### Claude's Discretion
- Exact Zod schema definitions for each API response type — Claude defines these based on actual API response shapes
- Internal rate limit backoff timing parameters (initial delay, max delay, jitter range)
- File organization for new modules (schemas, error mapping, rate limiter) — Claude decides based on codebase conventions
- Whether DataSource includes 'partial' as a distinct value or uses a separate `warnings` field

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-06 definitions and acceptance criteria

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Service layer architecture, data flow, hook structure
- `.planning/codebase/CONCERNS.md` — Known error handling gaps, silent mock fallback pattern
- `.planning/codebase/INTEGRATIONS.md` — API endpoint details, auth patterns, response shapes for all three providers
- `.planning/codebase/CONVENTIONS.md` — Naming, module design, error handling conventions

### Prior Phase Context
- `.planning/phases/01-cleanup/01-CONTEXT.md` — Phase 1 decisions (batch strategy, build verification)
- `.planning/phases/01-cleanup/01-01-SUMMARY.md` — What was done in cleanup (dead code removal, DST fix)
- `.planning/phases/01-cleanup/01-02-SUMMARY.md` — What was done in cleanup (batch TwelveData, DXY/Brent fixes)

### Source Files (primary targets)
- `src/services/twelveDataService.ts` — TwelveData REST and WebSocket service (batch calls from Phase 1)
- `src/services/fredService.ts` — FRED series service (yields, inflation, credit)
- `src/services/finnhubService.ts` — Finnhub news, calendar, fed watch service
- `src/services/cache.ts` — TTL cache singleton (will need awareness of DataResult)
- `src/hooks/useMarketData.ts` — Consuming hook that must adapt to DataResult returns
- `src/types/index.ts` — Type definitions (DataResult type goes here)
- `src/components/shared/Widget.tsx` — Error/retry UI that consumes error states

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/cache.ts` — TTL cache singleton; rate limiter can follow same singleton pattern
- `WidgetStatus` type in `src/types/index.ts` — Existing discriminated union (`loading | loaded | error`) that DataResult should align with
- `Widget.tsx` error/retry UI — Already renders `AlertCircle` + "Retry" button on `status.state === 'error'`; will consume new error messages
- `isTdQuote()` type guard in `twelveDataService.ts` — Pattern for runtime type checking that Zod replaces

### Established Patterns
- All services use native `fetch` with provider-specific wrapper functions (`tdFetch`, `fredFetch`, `finnhubFetch`)
- Cache keys follow `provider:seriesId:params` format
- Services currently fall back to `mockMarketData` on any error — Phase 2 replaces this with DataResult.error
- `Promise.allSettled` used for multi-source fetches (fredService.ts credit, rates)
- Environment variables via `import.meta.env.VITE_*`

### Integration Points
- `useMarketData.ts` calls all service functions and manages per-widget `WidgetStatus` — must adapt to DataResult returns
- `retryWidget(key)` dispatches per-widget fetch — retry logic should integrate with rate limit backoff
- `DashboardGrid.tsx` passes data + statuses to widget components — no changes expected at this layer

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **Fake period multipliers in EquitiesPanel** — from Phase 1 deferred, not in Phase 2 scope
- **Hardcoded spread strings in RatesPanel/YieldCurveChart** — from Phase 1 deferred, not in Phase 2 scope
- **Duplicate CreditItem/InflationItem type declarations** — from Phase 1 deferred, could be addressed as part of type cleanup but not required by DATA-* requirements
- **FedWatch mock probabilities** — Known concern from CONCERNS.md, out of scope (requires new data source, tracked as EXP-01 in v2 requirements)

</deferred>

---

*Phase: 02-data-layer-hardening*
*Context gathered: 2026-04-11*
