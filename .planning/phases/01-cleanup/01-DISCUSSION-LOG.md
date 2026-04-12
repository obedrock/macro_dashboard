# Phase 1: Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 01-cleanup
**Areas discussed:** Brent Crude fix, Adjacent fixes, Batch strategy, Build verification

---

## Brent Crude Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch real Brent (Recommended) | Find a valid TwelveData symbol for Brent and fetch alongside WTI | |
| Drop Brent from panel | Remove Brent entirely from commodities panel | |
| You decide | Claude picks based on TwelveData support | ✓ |

**User's choice:** You decide — Claude's discretion
**Notes:** User deferred to Claude to research TwelveData symbol availability and pick the best approach.

---

## Adjacent Fixes

| Option | Description | Selected |
|--------|-------------|----------|
| Strict CLEAN-01–04 only (Recommended) | Only fix the 4 defined requirements. Adjacent issues deferred. | ✓ |
| Bundle small fixes | Include duplicate types, hardcoded spreads, fake multipliers | |
| Bundle type fixes only | Include just duplicate type declarations, defer data fabrication fixes | |

**User's choice:** Strict CLEAN-01–04 only
**Notes:** Adjacent issues (fake period multipliers, hardcoded spreads, duplicate types) noted as deferred ideas.

---

## Batch Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Logical groups (Recommended) | One batch per domain: equities, FX, commodities. ~3 calls/cycle. | ✓ |
| Single mega-batch | All symbols in one API call. Fewest requests but mixes domains. | |
| You decide | Claude picks based on API limits and codebase patterns | |

**User's choice:** Logical groups
**Notes:** Matches existing panel structure. FX panel already batches correctly — equities and commodities to follow same pattern.

---

## Build Verification

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript + build (Recommended) | Strict TS compiler + Vite build + grep for dead imports | ✓ |
| Build + manual smoke test | TS + build plus manual browser checklist | |
| Quick smoke script | Automated script to verify build output and import graph | |

**User's choice:** TypeScript + build
**Notes:** Lightweight and automated. No manual smoke test needed.

---

## Claude's Discretion

- Brent Crude approach — fetch real data or drop, based on TwelveData availability
- DXY symbol selection for live data
- Timezone approach for DST fix (native Intl API vs library)

## Deferred Ideas

- Fake period multipliers in EquitiesPanel (daily × 5 for weekly)
- Hardcoded spread strings in RatesPanel/YieldCurveChart
- Duplicate CreditItem/InflationItem type declarations
