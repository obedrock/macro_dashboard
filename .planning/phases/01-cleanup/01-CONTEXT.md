# Phase 1: Cleanup - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove dead integrations (Massive/Polygon, Supabase) and fix known data bugs (DXY always-mock, Brent Crude fabrication, DST scheduling bug, TwelveData rate limit violations). All existing panels must continue working. No new features, no adjacent bug fixes beyond CLEAN-01 through CLEAN-04.

</domain>

<decisions>
## Implementation Decisions

### Brent Crude Resolution (CLEAN-04)
- **D-01:** Claude's discretion — research what TwelveData supports for Brent Crude and pick the best approach (fetch real data if a valid symbol exists, or drop from panel if not feasible)

### Cleanup Scope
- **D-02:** Strictly limited to CLEAN-01 through CLEAN-04. Adjacent issues found in the codebase audit (fake period multipliers in EquitiesPanel, hardcoded spread strings in RatesPanel/YieldCurveChart, duplicate CreditItem/InflationItem type declarations) are deferred to future phases.

### Batch Strategy (CLEAN-02)
- **D-03:** Logical groups — one TwelveData batch call per domain (equities batch, FX batch, commodities batch). This matches the existing panel structure, keeps error handling per-widget clean, and reduces calls from 5-9 per cycle to ~3.

### Build Verification
- **D-04:** TypeScript compiler (strict mode) + clean Vite build + grep to confirm no dead imports or references to removed code. No manual smoke test or script required.

### Claude's Discretion
- Brent Crude approach (D-01) — Claude picks based on TwelveData API availability
- DXY symbol selection — Claude picks the correct TwelveData symbol for live DXY data
- Timezone library choice for DST fix — Claude picks the approach (native Intl API vs library)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CLEAN-01 through CLEAN-04 definitions and acceptance criteria

### Codebase Analysis
- `.planning/codebase/INTEGRATIONS.md` — Full API integration details (Twelve Data, FRED, Finnhub, Massive.com endpoints, auth, refresh cadence)
- `.planning/codebase/CONCERNS.md` — Tech debt and known bugs relevant to cleanup targets (Brent fabrication, DXY mock, DST bug, Massive dead code)

### Source Files (primary targets)
- `src/services/massiveService.ts` — Dead code to remove (CLEAN-01)
- `src/services/twelveDataService.ts` — Batch consolidation (CLEAN-02), DXY fix, Brent fix (CLEAN-04)
- `src/hooks/useMarketData.ts` — DST bug in `msUntilNextCalendarRefresh()` (CLEAN-03), Massive import removal
- `vite.config.ts` — Massive.com alias to remove (CLEAN-01)
- `package.json` — `@massive.com/client-js` and `@supabase/supabase-js` dependencies to remove (CLEAN-01)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/cache.ts` — In-memory TTL cache already used by all services; batch calls should continue using it
- FX batch pattern in `twelveDataService.ts` — `getTwelveFX()` already correctly batches multiple symbols into one API call; equities and commodities should follow the same pattern

### Established Patterns
- All services use native `fetch` — no HTTP client library
- Cache keys follow `provider:seriesId:params` format
- Services fall back to `mockMarketData` on error (this pattern stays for now; Phase 2 replaces it with DataResult)
- Environment variables accessed via `import.meta.env.VITE_*`

### Integration Points
- `useMarketData.ts` imports from all service modules — Massive imports must be cleanly removed
- `vite.config.ts` has a resolve alias for `@massive.com/client-js` — must be removed alongside the dependency
- `DashboardGrid.tsx` renders all widget panels — no changes expected since panels stay the same

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **Fake period multipliers** — `EquitiesPanel.tsx` uses `daily * 5` for weekly, `daily * 22` for monthly. Needs real time-series data. Defer to a later phase.
- **Hardcoded spread strings** — `RatesPanel.tsx` and `YieldCurveChart.tsx` show static `"+30.5 bps"` etc. Should be computed from live data. Defer to a later phase.
- **Duplicate type declarations** — `InflationItem` and `CreditItem` defined in both service files and component files. Trivial fix but out of scope per D-02.

</deferred>

---

*Phase: 01-cleanup*
*Context gathered: 2026-04-11*
