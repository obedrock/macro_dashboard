# Roadmap: MacroPulse Reliability Refactor

## Overview

A brownfield refactor of an existing, functional dashboard. The work proceeds in six phases ordered to minimize breakage risk: dead code removal and known bug fixes come first, followed by data layer hardening, WebSocket reliability, architectural decomposition, user-facing transparency indicators, and finally a test suite that locks in all gains. Every existing panel continues working throughout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Cleanup** - Remove dead integrations and fix known data bugs before any hardening work
- [ ] **Phase 2: Data Layer Hardening** - Wrap all service calls in typed results, add error surfacing, rate limit handling, and schema validation
- [ ] **Phase 3: WebSocket Reliability** - Replace the flat-retry loop with exponential backoff, expose connection state, encapsulate globals
- [ ] **Phase 4: Architecture Decomposition** - Decompose monolithic hook into domain-specific hooks, add error boundaries
- [ ] **Phase 5: UI Transparency** - Surface data freshness, fallback badges, WebSocket status, and market hours context to users
- [ ] **Phase 6: Test Infrastructure** - Install Vitest + MSW and write tests for services, hooks, cache, and WebSocket logic

## Phase Details

### Phase 1: Cleanup
**Goal**: Dead code is gone, known data fabrication bugs are fixed, and all panels still work
**Depends on**: Nothing (first phase)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04
**Success Criteria** (what must be TRUE):
  1. Massive/Polygon imports do not appear anywhere in the codebase and the app builds cleanly
  2. TwelveData equity/rate/commodity calls are batched — network tab shows at most one batch request per group, never exceeding 8 req/min
  3. DXY displays a real fetched value (not always-mock), and Brent Crude shows its own fetched price instead of WTI+2.57
  4. Economic calendar events are scheduled with America/New_York timezone — no DST-induced off-by-one-hour shifts
**Plans**: TBD

### Phase 2: Data Layer Hardening
**Goal**: Every service returns a typed DataResult wrapper so errors propagate clearly instead of silently becoming mock data
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. When a provider API returns a non-2xx response, the affected widget shows an error state — no silent fallback to mock values
  2. When an API returns a 429, requests to that provider pause and resume after exponential backoff — no burst retries
  3. When an API response fails Zod schema validation, the widget shows an error state rather than rendering NaN or undefined values
  4. When one source in a multi-source widget fails, the widget renders available data with a visible warning rather than going fully blank
  5. Error messages shown to the user are human-readable (e.g., "Data unavailable — rate limit reached") not raw HTTP status codes
**Plans**: TBD

### Phase 3: WebSocket Reliability
**Goal**: WebSocket connections recover automatically from drops with bounded retry behavior and visible connection state
**Depends on**: Phase 2
**Requirements**: WS-01, WS-02, WS-03, WS-04
**Success Criteria** (what must be TRUE):
  1. When the WebSocket drops, the client attempts reconnection with increasing delays (exponential backoff with jitter) — no flat 5-second polling
  2. After 10 failed reconnection attempts, the client stops retrying and enters a permanent "failed" state rather than looping forever
  3. The ribbon or connection indicator reflects the current WebSocket state (connected / connecting / reconnecting / failed) in real time
  4. No mutable global variables for lastPrices or prevPrices are exported — price state is encapsulated inside WebSocketManager
**Plans**: TBD

### Phase 4: Architecture Decomposition
**Goal**: The monolithic useMarketData hook is broken into composable domain hooks, with error boundaries ensuring widget failures are isolated
**Depends on**: Phase 3
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):
  1. Each data domain (equities, rates, FX, commodities, etc.) has its own hook — useMarketData is not a single 800-line file
  2. All existing widgets continue receiving the same context shape — zero widget component changes required
  3. A runtime error inside one widget panel does not crash the whole dashboard — other panels keep rendering
  4. Polling intervals do not re-register on every render — useEffect dependency arrays are stable and intervals fire at their intended cadence
**Plans**: TBD
**UI hint**: yes

### Phase 5: UI Transparency
**Goal**: Users can always tell whether data is live, stale, loading, or errored — no ambiguous states
**Depends on**: Phase 4
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. Each widget displays a "Updated X min ago" timestamp that updates as data ages
  2. Any widget serving mock or cached fallback data shows a visible badge distinguishing it from live data
  3. The ribbon displays a WebSocket connection indicator that reflects the state exposed by Phase 3 (connected / reconnecting / failed)
  4. Widgets correctly display a "Market closed" label outside of US equity trading hours
  5. Widgets serving from a degraded cache show "Cached X min ago" rather than presenting stale data as fresh
**Plans**: TBD
**UI hint**: yes

### Phase 6: Test Infrastructure
**Goal**: A test framework is installed and critical data service paths are covered so reliability improvements don't silently regress
**Depends on**: Phase 5
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. Running `npm test` (or `vitest`) executes a test suite with no configuration errors
  2. Service layer tests verify retry logic fires correctly on failures and rate limit handling pauses as expected
  3. Hook tests verify status machine transitions (loading → live, live → error, error → reconnecting) without requiring a live API
  4. Cache TTL tests verify that entries expire and trigger re-fetch at the configured interval
  5. WebSocket reconnection tests verify backoff timing and the "gave up" terminal state after 10 attempts
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cleanup | 0/TBD | Not started | - |
| 2. Data Layer Hardening | 0/TBD | Not started | - |
| 3. WebSocket Reliability | 0/TBD | Not started | - |
| 4. Architecture Decomposition | 0/TBD | Not started | - |
| 5. UI Transparency | 0/TBD | Not started | - |
| 6. Test Infrastructure | 0/TBD | Not started | - |
