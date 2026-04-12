---
phase: 02-data-layer-hardening
plan: 02
subsystem: api
tags: [zod, typescript, error-handling, rate-limiting, data-result, finnhub, fred, twelvedata]

requires:
  - phase: 02-data-layer-hardening plan 01
    provides: DataResult type, RateLimiter, errorMessages, Zod schemas

provides:
  - finnhubService: getFinnhubNews, getFinnhubEconomicCalendar, getFinnhubFedWatch returning DataResult
  - fredService: all 9 exported functions returning DataResult with partial success support
  - twelveDataService: all 5 exported functions returning DataResult with Zod validation
  - Rate limiter integrated into all three API fetch wrappers
  - Zod validation on all raw API responses before transformation
  - Human-readable error messages via toUserMessage() in all catch blocks

affects:
  - 02-data-layer-hardening plan 03 (hook migration — must unwrap DataResult from all service calls)

tech-stack:
  added: []
  patterns:
    - "Services return DataResult<T> discriminated union — callers check status before accessing data"
    - "Internal fetch helpers throw on failure; exported functions return DataResult errors"
    - "Promise.allSettled with partial success: if some sources fail, return source: partial with ResultWarning[]"
    - "Rate limiter checked before fetch; onRateLimit called on 429; onSuccess called on 200"
    - "Zod safeParse replaces type guard functions (isTdQuote removed)"

key-files:
  created: []
  modified:
    - src/services/finnhubService.ts
    - src/services/fredService.ts
    - src/services/twelveDataService.ts

key-decisions:
  - "Internal helpers (finnhubFetch, fetchSeries, tdFetch) still throw — only exported functions return DataResult"
  - "fetchSingleQuote kept as internal helper (not a plan-breaking export removal)"
  - "getLiveInflation keeps hardcoded breakeven fallback values (2.4/2.8) only when entire series fails — partial success with warnings for mixed results"
  - "getFredYieldCurve returns DataResult<YieldCurveData[]> with source: partial and 0-value placeholders for missing maturities (not null)"
  - "Mock data still used as fallback values in equities/fx/commodities fb arrays (individual symbol fallback, not overall error fallback)"

patterns-established:
  - "Error categorization: RateLimitError -> rate_limit, HttpError -> httpStatusToCategory(status), ValidationError -> validation, else unknown"
  - "Partial success pattern: Promise.allSettled + warnings array + source: partial when some sources fail"
  - "Cache-first DataResult: cached.ok return uses source: cache; fresh fetch uses source: live"

requirements-completed: [DATA-02, DATA-04, DATA-05]

duration: 11min
completed: 2026-04-12
---

# Phase 02 Plan 02: Service Migration to DataResult Summary

**All 17 exported service functions across finnhubService, fredService, and twelveDataService now return DataResult<T> with Zod validation, rate limit backoff, and typed partial-success for multi-source FRED functions**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-12T03:22:12Z
- **Completed:** 2026-04-12T03:33:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migrated all 3 Finnhub exported functions to DataResult with FinnhubNewsResponseSchema and FinnhubCalendarResponseSchema Zod validation
- Migrated all 9 FRED exported functions to DataResult with partial success support — getLiveCreditSpreads, getLiveInflation, getFredBalanceSheet, getFredTreasuryYields return source: 'partial' with warnings when individual series fail
- Migrated all 5 TwelveData exported functions to DataResult with TdBatchResultSchema, TdQuoteSchema, TdTimeSeriesSchema validation; removed isTdQuote type guard in favor of Zod
- Rate limiter (isBlocked/onRateLimit/onSuccess) integrated into all three fetch wrappers — blocks requests when provider is cooling down and marks 429 responses for backoff
- All mock fallbacks removed from service catch blocks — errors now surface as DataResult errors with toUserMessage() human-readable strings

## Task Commits

1. **Task 1: Migrate finnhubService.ts to DataResult** - `c382779` (feat)
2. **Task 2: Migrate fredService.ts and twelveDataService.ts** - `f04e8af` (feat)

## Files Created/Modified

- `src/services/finnhubService.ts` - 3 exported functions return DataResult; finnhubFetch integrates rate limiter; Zod validates news and calendar responses
- `src/services/fredService.ts` - 9 exported functions return DataResult; fetchSeries integrates rate limiter + FredResponseSchema; getLiveCreditSpreads/getLiveInflation/getFredFedBalanceSheet/getFredTreasuryYields use partial success with ResultWarning[]
- `src/services/twelveDataService.ts` - 5 exported functions return DataResult; tdFetch integrates rate limiter; isTdQuote replaced by TdQuoteSchema.safeParse; TdBatchResultSchema validates batch fetches

## Decisions Made

- Internal fetch helpers throw on failure; only exported functions return DataResult — following Pitfall 1 from research to avoid double-wrapping errors
- getFredYieldCurve returns 0-value placeholders for missing maturities (not null) and marks them with warnings, so the UI always has a complete data shape
- fetchSingleQuote kept as internal unexported helper (used only within twelveDataService)
- Mock fallback arrays (fb[]) in equities/fx/commodities are still used as individual-symbol fallbacks when a single symbol in a batch returns an error — this is within-batch graceful degradation, not service-level mock substitution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in getLiveInflation warning loop**
- **Found during:** Task 2 (fredService migration)
- **Issue:** `const seriesNames: [typeof cpi, string][]` used `cpi`'s type (inflation series shape) for all entries, but `breakeven5y` and `breakeven1y` return a different shape (level series). TypeScript error TS2322 at lines 285-286.
- **Fix:** Changed to `[PromiseSettledResult<unknown>, string][]` — we only need `.status === 'rejected'` on the result, not any value-specific fields
- **Files modified:** src/services/fredService.ts
- **Verification:** `npx tsc -p tsconfig.app.json --noEmit` shows no service-layer TS errors
- **Committed in:** f04e8af (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Type error fix was required for correctness. No scope creep.

## Issues Encountered

- The worktree (`worktree-agent-a241ed56`) was at an old commit (02dcb01) that predated Plan 01 artifacts. Rebased onto main (`git rebase main`) before starting work — Plan 01 files (schemas.ts, errorMessages.ts, rateLimiter.ts) then became available.
- TypeScript errors exist in `useMarketData.ts` because it still expects raw return types from services. This is expected and intentional — Plan 03 will update the hook to handle DataResult unwrapping.

## Known Stubs

None — all DataResult returns are wired to real API data or structured error responses. The `vixFallback = fb[4]` in getTwelveEquities is documented: VIX comes from FRED via the hook, not from the TwelveData equities batch. This pre-existing behavior is tracked separately.

## Next Phase Readiness

- Plan 03 (hook migration) can proceed — all service signatures are now DataResult<T>
- useMarketData.ts currently has TypeScript errors because it destructures service returns as raw values — Plan 03 adds unwrapping logic
- The `noUnusedLocals` TypeScript errors in component files are pre-existing, not introduced by this plan

---
*Phase: 02-data-layer-hardening*
*Completed: 2026-04-12*
