---
phase: 02-data-layer-hardening
plan: 01
subsystem: api
tags: [zod, typescript, rate-limiting, error-handling, validation]

# Dependency graph
requires:
  - phase: 01-cleanup
    provides: Cleaned service files (massiveService removed, batch API calls)
provides:
  - DataResult<T> discriminated union type with ok/error branches and DataSource
  - ResultWarning interface for partial-data scenarios
  - RateLimiter singleton with exponential backoff and jitter for per-provider 429 handling
  - Error category mapping with typed error classes (RateLimitError, HttpError, ValidationError)
  - Zod schemas for all three provider API response shapes (TwelveData, FRED, Finnhub)
affects: [02-02-service-migration, 02-03-hook-adaptation]

# Tech tracking
tech-stack:
  added: [zod@4]
  patterns:
    - DataResult<T> discriminated union for typed success/error — narrow on status field
    - Module-level singleton pattern for RateLimiter (mirrors cache.ts singleton)
    - .passthrough() on all Zod object schemas to tolerate upstream API schema drift
    - Typed error class hierarchy (RateLimitError, HttpError, ValidationError) extending Error

key-files:
  created:
    - src/services/errorMessages.ts
    - src/services/rateLimiter.ts
    - src/services/schemas.ts
  modified:
    - src/types/index.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Use zod@4 (not v3) — latest stable version with improved tree-shaking"
  - "DataResult uses 'source' field with 'partial' as a distinct value to indicate mixed-quality data"
  - "RateLimiter initial delay 5s, max 5min, jitter up to 1s — conservative for browser-side clients"
  - "All Zod schemas use .passthrough() to avoid ValidationError on API schema drift"
  - "Separate TdErrorSchema for TwelveData batch error branch vs TdQuoteSchema for success branch"

patterns-established:
  - "Pattern: DataResult<T> — all service functions in Plan 02 will return DataResult<T> not raw T"
  - "Pattern: rateLimiter.isBlocked(provider) check before every API fetch in Plan 02"
  - "Pattern: schema.safeParse(json) before using API response data in Plan 02"

requirements-completed: [DATA-01, DATA-03, DATA-04, DATA-06]

# Metrics
duration: 8min
completed: 2026-04-11
---

# Phase 2 Plan 1: Data Layer Foundation Summary

**Zod v4 schemas, DataResult<T> discriminated union, per-provider RateLimiter singleton with exponential backoff, and typed error classes ready for service migration**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-11T03:17:46Z
- **Completed:** 2026-04-11T03:25:00Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Installed zod@4 and created Zod schemas matching all three provider API response shapes
- Extended src/types/index.ts with DataResult<T>, DataSource, and ResultWarning without touching existing types
- Created RateLimiter singleton with exponential backoff formula: min(5000 * 2^(attempt-1), 300000) + random jitter up to 1000ms
- Created error infrastructure with 7 error categories, HTTP status mapping, and 3 typed error classes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Zod and create DataResult types + error infrastructure** - `4be116c` (feat)
2. **Task 2: Create Zod validation schemas for all API response shapes** - `097664e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/types/index.ts` - Appended DataResult<T>, DataSource, ResultWarning types after existing exports
- `src/services/errorMessages.ts` - ErrorCategory, ERROR_MESSAGES, httpStatusToCategory, toUserMessage, RateLimitError, HttpError, ValidationError
- `src/services/rateLimiter.ts` - Provider type, RateLimiter class, rateLimiter singleton export
- `src/services/schemas.ts` - TdQuoteSchema, TdErrorSchema, TdBatchResultSchema, TdTimeSeriesSchema, FredObservationSchema, FredResponseSchema, FinnhubNewsItemSchema, FinnhubNewsResponseSchema, FinnhubCalendarEventSchema, FinnhubCalendarResponseSchema
- `package.json` - Added zod@4 dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used zod@4 (latest) not zod@3 — forward-looking, improved tree-shaking
- DataResult uses `'partial'` as a distinct DataSource value (not just ok/error) — enables mixed-quality responses when one of multiple series succeeds
- RateLimiter attempt counter resets to 0 on any success — prevents permanent backoff accumulation
- All Zod object schemas use `.passthrough()` — API providers add fields without notice; validation errors for extra fields would cause unnecessary fallbacks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TS6133 (unused variable) errors in several component files were present before this plan. These are out of scope and not introduced by this plan's changes. All new files compile cleanly.

## Known Stubs

None — these are pure infrastructure modules with no UI rendering path.

## Next Phase Readiness
- All foundation contracts ready for Plan 02 (service migration)
- Services can import DataResult from types, rateLimiter from rateLimiter.ts, error classes from errorMessages.ts, schemas from schemas.ts
- No blockers for Plan 02

---
*Phase: 02-data-layer-hardening*
*Completed: 2026-04-11*
