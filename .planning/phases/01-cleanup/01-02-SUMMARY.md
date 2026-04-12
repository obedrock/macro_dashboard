---
phase: 01-cleanup
plan: 02
subsystem: twelveDataService
tags: [api-calls, batching, data-quality, DXY, brent-crude]
dependency_graph:
  requires: []
  provides: [batched-twelve-data-calls, real-dxy, real-brent]
  affects: [useMarketData, FXPanel, CommoditiesPanel, EquitiesPanel, RatesPanel]
tech_stack:
  added: []
  patterns: [batch-api-calls, isTdQuote-guard, module-scope-helpers]
key_files:
  created: []
  modified:
    - src/services/twelveDataService.ts
decisions:
  - "etfScaled moved to module scope per CLAUDE.md module-design conventions"
  - "DX-Y.NYB added to FX batch — graceful fallback to fb[0] if symbol not on plan"
  - "BZ:COM used for Brent Crude ICE futures — same naming convention as CL1:COM for WTI"
  - "fetchSingleQuote retained (still used by getTwelveTimeSeries path)"
metrics:
  duration: 98s
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 1
---

# Phase 01 Plan 02: Batch TwelveData Calls and Fix DXY/Brent Summary

Batched all four TwelveData REST functions from 14 individual fetchSingleQuote calls down to 4 fetchBatchQuotes calls, and replaced DXY mock fallback and WTI+2.57 Brent fabrication with real API fetches.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Batch equities and rates calls (CLEAN-02) | 2b623f3 | src/services/twelveDataService.ts |
| 2 | Fix DXY mock, Brent fabrication, batch FX/commodities (CLEAN-02 + CLEAN-04) | 4e89b67 | src/services/twelveDataService.ts |

## What Changed

**Task 1 — Equities and Rates batching:**
- `getTwelveEquities`: Replaced `Promise.allSettled([fetchSingleQuote('SPY'), fetchSingleQuote('QQQ'), fetchSingleQuote('DIA'), fetchSingleQuote('IWM')])` (4 API calls) with single `fetchBatchQuotes(['SPY', 'QQQ', 'DIA', 'IWM'])` (1 API call)
- `getTwelveRates`: Replaced `Promise.allSettled([fetchSingleQuote('US2Y'), ...])` (5 API calls) with single `fetchBatchQuotes(['US2Y', 'US5Y', 'US10Y', 'US20Y', 'US30Y'])` (1 API call)
- Moved `etfScaled` helper to module scope (was inline inside `getTwelveEquities`) per CLAUDE.md conventions
- VIX mock fallback preserved at equities index 4

**Task 2 — FX and Commodities batching + data quality fixes:**
- `getTwelveFX`: Added `DX-Y.NYB` to existing 4-symbol batch — DXY now fetched from API via `toItem(dxyQ, fb[0], 'DXY')`, falls back to `fb[0]` if symbol unavailable on plan
- `getTwelveCommodities`: Replaced `Promise.allSettled` (5 API calls) with `fetchBatchQuotes(['CL1:COM', 'BZ:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM', 'GAS/USD'])` (1 API call), added `BZ:COM` for real Brent price, removed `wtiQ.close + 2.57` fabrication

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All functions have graceful fallback to `mockMarketData` values via `isTdQuote` guard when API symbols are unavailable, which is the intended behavior (not a stub — documented in the plan as correct fallback pattern).

## Verification Results

- `fetchSingleQuote` only appears in its own function definition, not in any `getTwelve*` function
- `Promise.allSettled` — zero occurrences
- `DX-Y.NYB` — present in FX batch (lines 189, 193)
- `BZ:COM` — present in commodities batch (lines 209, 214)
- `2.57` fabrication — zero occurrences
- `dxyFallback` variable — zero occurrences
- `npx tsc --noEmit` — exits 0
- `npx vite build` — exits 0

## Self-Check: PASSED

- src/services/twelveDataService.ts exists and modified
- Commit 2b623f3 exists
- Commit 4e89b67 exists
