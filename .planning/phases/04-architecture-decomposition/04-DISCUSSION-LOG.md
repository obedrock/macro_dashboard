# Phase 4: Architecture Decomposition - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 04-architecture-decomposition
**Areas discussed:** Hook decomposition strategy, Context composition pattern, Error boundary granularity, Shared state coupling
**Mode:** Auto (all areas auto-selected, recommended defaults auto-picked)

---

## Hook Decomposition Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| By data domain | One hook per widget data group (equities, rates, FX, etc.) | ✓ |
| By API provider | One hook per provider (useTwelveData, useFRED, useFinnhub) | |
| Hybrid | Mix domain and provider grouping | |

**User's choice:** [auto] By data domain (recommended default)
**Notes:** Aligns with widget boundaries and ARCH-01 language. fetchRates stays unified despite multi-provider sourcing since it serves one widget.

---

## Context Composition Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Single MarketDataContext | One context composing all domain hooks, preserving current API shape | ✓ |
| Multiple per-domain contexts | One context per data domain, widgets consume multiple | |
| No context (prop drilling) | Keep current prop-drilling from App.tsx | |

**User's choice:** [auto] Single MarketDataContext (recommended default)
**Notes:** ARCH-02 requires zero widget API changes. Single context preserving `{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus }` is safest.

---

## Error Boundary Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per widget | One ErrorBoundary wrapping each widget panel in DashboardGrid | ✓ |
| Per grid section | One ErrorBoundary per grid row/section | |
| Single app-level | One ErrorBoundary wrapping entire DashboardGrid | |

**User's choice:** [auto] Per widget (recommended default)
**Notes:** ARCH-03 explicitly requires isolated widget failures. Per-widget boundaries provide finest isolation.

---

## Shared State Coupling

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-updates in composing context | Domain hooks return raw data; context merges ribbon/VIX | ✓ |
| Cross-updates in domain hooks | Hooks receive refs to other hooks' state for cross-updates | |
| Event bus | Hooks publish events, others subscribe for cross-domain sync | |

**User's choice:** [auto] Cross-updates in composing context (recommended default)
**Notes:** Ribbon and VIX cross-updates are composition concerns. Domain hooks stay pure and independent.

---

## Claude's Discretion

- Internal naming of domain hook return types
- File organization for domain hooks
- MarketDataContext file placement
- refresh() aggregation strategy
- Error boundary implementation details
- Utility function extraction

## Deferred Ideas

- ribbonBase.current mutation cleanup — may resolve naturally during decomposition
