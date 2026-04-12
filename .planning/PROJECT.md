# MacroPulse

## What This Is

A real-time macroeconomic dashboard built with React, TypeScript, and Vite. It aggregates financial data from multiple APIs (Twelve Data, FRED, Finnhub) and displays it across 10 widget panels — yield curves, interest rates, equities, FX, commodities, credit spreads, inflation, economic calendar, fed watch, and macro news. Features dark/light theme, customizable widget layout, and WebSocket real-time updates.

## Core Value

All panels reliably display real, current market data with clear indication of data freshness and error states — no silent failures, no ambiguous mock data.

## Requirements

### Validated

- ✓ Summary ribbon with scrolling ticker of key asset prices — existing
- ✓ Yield Curve panel with interactive US Treasury yield visualization — existing
- ✓ Interest Rates panel with fed funds, Treasury yields, TIPS breakeven — existing
- ✓ Equities panel with S&P 500, Nasdaq, Dow, Russell 2000, VIX — existing
- ✓ FX Markets panel with major currency pairs and DXY — existing
- ✓ Commodities panel with energy, precious metals, base metals — existing
- ✓ Credit Spreads panel with HY OAS, IG OAS, differentials — existing
- ✓ Inflation panel with CPI, PCE, expectations, YoY/MoM — existing
- ✓ Economic Calendar with upcoming events and importance levels — existing
- ✓ Fed Watch with FOMC meeting dates and policy rate — existing
- ✓ Macro News with headlines and sentiment classification — existing
- ✓ Dark/light theme toggle with localStorage persistence — existing
- ✓ Customizable widget visibility and ordering — existing
- ✓ Time range selection (1D, 1W, 1M, 3M, 1Y, 5Y) — existing
- ✓ WebSocket real-time price updates — existing
- ✓ In-memory TTL cache for API deduplication — existing

### Active

- ✓ Robust error handling — API failures surface clearly to users, never fail silently — Validated in Phase 02: data-layer-hardening
- ✓ WebSocket reconnection — automatic reconnect with backoff on connection drops — Validated in Phase 03: websocket-reliability
- ✓ Clear data state indicators — users can tell if data is live, stale, loading, or errored — Validated in Phase 05: ui-transparency
- ✓ Rate limit handling — graceful degradation when API limits are hit — Validated in Phase 02: data-layer-hardening
- ✓ Remove Massive/Polygon integration — simplify to 3 core data sources — Validated in Phase 01: cleanup
- [ ] Test infrastructure — add test framework and tests for critical data services
- ✓ Better mock data boundary — clear separation between real and fallback data — Validated in Phase 02: data-layer-hardening

### Out of Scope

- New panels or widgets — focus is reliability, not features
- Mobile app — web only
- Backend/server — stays client-side only
- User authentication — not needed for personal dashboard
- Database/persistence — beyond localStorage for preferences

## Context

This is a brownfield refactor of an existing, functional dashboard. The codebase has:
- Domain-specific hooks (useEquities, useRates, useFX, etc.) composed via MarketDataContext with per-widget error boundaries
- 4 API service modules but Massive/Polygon is effectively unused
- Mock data that silently substitutes for real data on any API failure
- No test infrastructure whatsoever
- WebSocket connections managed by wsManager with exponential backoff, terminal state, and UI status indicator
- No rate limit awareness — services hit APIs without backoff

The codebase map is at `.planning/codebase/` with detailed analysis of architecture, stack, conventions, integrations, concerns, and structure.

## Constraints

- **Tech stack**: Keep React + TypeScript + Vite + Tailwind — no framework changes
- **API sources**: Twelve Data, FRED, Finnhub — drop Massive/Polygon
- **Environment variables**: API keys stay in `.env` via `import.meta.env.VITE_*`
- **No breaking changes**: All existing panels must continue working throughout refactor

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Refactor in place (not rebuild) | Preserve working functionality, lower risk | — Pending |
| Drop Massive/Polygon integration | Unused secondary source, adds complexity | Done (Phase 01) |
| Batch TwelveData REST calls by domain | Reduce ~14 calls/cycle to 4 batch requests | Done (Phase 01) |
| Use Intl.DateTimeFormat for ET timezone | Native DST-aware scheduling, no hardcoded UTC offset | Done (Phase 01) |
| Fetch real DXY (DX-Y.NYB) and Brent (BZ:COM) | Eliminate data fabrication, graceful fallback if unavailable | Done (Phase 01) |
| Add test infrastructure | Ensure reliability fixes hold up over time | — Pending |
| Keep client-side only | No backend needed for personal dashboard | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after Phase 04 (architecture-decomposition) completion*
