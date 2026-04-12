# Requirements: MacroPulse Reliability Refactor

**Defined:** 2026-04-11
**Core Value:** All panels reliably display real, current market data with clear indication of data freshness and error states

## v1 Requirements

### Cleanup

- [x] **CLEAN-01**: Remove Massive/Polygon integration (massiveService.ts, @massive.com/client-js, @supabase/supabase-js)
- [x] **CLEAN-02**: Batch TwelveData API calls (equities, rates, commodities) to stay within 8 req/min limit
- [x] **CLEAN-03**: Fix DST bug in calendar scheduling (hardcoded UTC-5 → America/New_York)
- [x] **CLEAN-04**: Fix DXY always-mock and Brent Crude fabrication (WTI+2.57)

### Data Layer

- [x] **DATA-01**: Services return DataResult<T> wrapper with source metadata (live/fallback/error) instead of raw data
- [x] **DATA-02**: Per-widget error states surface clearly — no silent failures or mock substitution
- [x] **DATA-03**: Rate limit detection (429 response) with per-provider exponential backoff via p-queue
- [x] **DATA-04**: Zod schema validation on API responses — malformed data triggers error state, not NaN
- [x] **DATA-05**: Partial success handling — when one source fails in a multi-source widget, show available data with warning
- [x] **DATA-06**: User-friendly error messages mapped from HTTP status codes and provider error codes

### WebSocket

- [x] **WS-01**: Exponential backoff reconnection with jitter (replace flat 5s loop)
- [x] **WS-02**: Max retry cap (10 attempts) with "gave up" terminal state
- [x] **WS-03**: Connection state exposed as wsStatus (connected/connecting/reconnecting/failed)
- [x] **WS-04**: WebSocketManager encapsulates lastPrices/prevPrices (no exported mutable globals)

### Architecture

- [x] **ARCH-01**: Decompose useMarketData into domain-specific hooks (one per data group)
- [x] **ARCH-02**: MarketDataContext composes domain hooks — zero widget API changes required
- [x] **ARCH-03**: Error boundaries around each widget — render panics don't crash dashboard
- [x] **ARCH-04**: useEffect dependency arrays stabilized to prevent interval re-registration

### UI Transparency

- [x] **UI-01**: Per-widget "Updated X min ago" freshness timestamps
- [x] **UI-02**: Fallback data badge — clearly marks when data is mock/cached vs live
- [x] **UI-03**: WebSocket connection status indicator (connected/reconnecting/failed) in ribbon
- [x] **UI-04**: Market hours context — "Market closed" label when outside trading hours
- [x] **UI-05**: Degraded mode label when serving from cache ("Cached X min ago")

### Testing

- [ ] **TEST-01**: Vitest + MSW test framework installed and configured
- [ ] **TEST-02**: Service layer tests — retry logic, rate limit handling, error scenarios
- [ ] **TEST-03**: Hook state machine tests — status transitions, polling lifecycle
- [ ] **TEST-04**: Cache TTL behavior tests
- [ ] **TEST-05**: WebSocket reconnection logic tests

## v2 Requirements

### Enhanced Reliability

- **REL-01**: TTL countdown ring visual indicator per widget
- **REL-02**: WebSocket tick lag indicator
- **REL-03**: Per-panel data confidence score (green/amber/red dot)
- **REL-04**: Rate limit quota indicator (remaining API budget)
- **REL-05**: Automatic retry with backoff + "Retrying in Xs" label

### Expanded Data

- **EXP-01**: Real CME FedWatch probabilities (currently entirely mock)
- **EXP-02**: ExpandedModal connected to live data (currently always mock)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New panels or widgets | Focus is reliability, not feature additions |
| Backend/server | Stays client-side only, personal dashboard |
| User authentication | Not needed for personal use |
| IndexedDB offline caching | Over-engineering for personal dashboard |
| Global toast notifications | Anti-feature per research — adds noise without trust |
| API key rotation | Out of scope for client-side app |
| OAuth/social login | No user system |
| Mobile app | Web only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 1 | Complete |
| CLEAN-02 | Phase 1 | Complete |
| CLEAN-03 | Phase 1 | Complete |
| CLEAN-04 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| DATA-04 | Phase 2 | Complete |
| DATA-05 | Phase 2 | Complete |
| DATA-06 | Phase 2 | Complete |
| WS-01 | Phase 3 | Complete |
| WS-02 | Phase 3 | Complete |
| WS-03 | Phase 3 | Complete |
| WS-04 | Phase 3 | Complete |
| ARCH-01 | Phase 4 | Complete |
| ARCH-02 | Phase 4 | Complete |
| ARCH-03 | Phase 4 | Complete |
| ARCH-04 | Phase 4 | Complete |
| UI-01 | Phase 5 | Complete |
| UI-02 | Phase 5 | Complete |
| UI-03 | Phase 5 | Complete |
| UI-04 | Phase 5 | Complete |
| UI-05 | Phase 5 | Complete |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| TEST-04 | Phase 6 | Pending |
| TEST-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-08 after roadmap creation*
