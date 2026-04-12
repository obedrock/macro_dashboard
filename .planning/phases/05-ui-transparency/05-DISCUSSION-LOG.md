# Phase 5: UI Transparency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 05-ui-transparency
**Areas discussed:** Freshness timestamps, Fallback/cache badges, Market hours detection, WS indicator enhancement
**Mode:** Auto (all decisions selected by recommended defaults)

---

## Freshness Timestamps (UI-01, UI-05)

### Q1: Where should "Updated X min ago" appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Widget header right slot | Use existing `headerRight` prop on Widget.tsx | ✓ |
| Below widget title | Add a new line under the title bar |  |
| Footer of each widget | Add timestamp to widget bottom |  |

**User's choice:** [auto] Widget header right slot (recommended default)
**Notes:** Leverages existing Widget.tsx prop, minimal visual disruption, consistent placement.

### Q2: How should staleness be indicated?

| Option | Description | Selected |
|--------|-------------|----------|
| Relative time with color aging | Fresh=slate, aging=slate, stale=amber, very stale=red | ✓ |
| Absolute timestamp only | Show "10:42:15 AM" without aging colors |  |
| Traffic light dot | Green/amber/red dot next to timestamp |  |

**User's choice:** [auto] Relative time with color aging (recommended default)
**Notes:** Merges UI-05 naturally — very stale data shows "Cached Xm ago" in red.

### Q3: Per-widget timestamps or single global?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-widget | Each domain hook tracks its own lastFetched | ✓ |
| Single global | One lastUpdated for the whole dashboard |  |

**User's choice:** [auto] Per-widget (recommended default)
**Notes:** Domain hooks already have independent fetch lifecycles from Phase 4 decomposition.

---

## Fallback/Cache Badge (UI-02)

### Q1: How should fallback data be indicated?

| Option | Description | Selected |
|--------|-------------|----------|
| Small badge pill in widget header | Use existing `badge` prop, colored pills | ✓ |
| Banner across widget top | Full-width warning stripe |  |
| Icon overlay | Semi-transparent overlay on widget content |  |

**User's choice:** [auto] Small badge pill in widget header (recommended default)
**Notes:** Live data shows no badge (clean default). Cache=amber "Cached", Partial=amber "Partial", Fallback=red "Fallback".

### Q2: Should DataSource propagate through context?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, per-widget source tracking | Add source to each hook return, compose in context | ✓ |
| No, derive from status only | Infer from WidgetStatus.state |  |

**User's choice:** [auto] Yes, per-widget source tracking (recommended default)
**Notes:** DataResult.source already carries this metadata from Phase 2.

---

## Market Hours Detection (UI-04)

### Q1: Which markets should show open/closed status?

| Option | Description | Selected |
|--------|-------------|----------|
| US equity market hours only | NYSE/NASDAQ 9:30 AM - 4:00 PM ET, Mon-Fri | ✓ |
| All markets with known hours | FX 24h, commodities, bonds |  |
| No market hours — just show data age | Let freshness timestamps imply staleness |  |

**User's choice:** [auto] US equity market hours only (recommended default)
**Notes:** FX (24h) and commodities (complex hours) deferred to v2 if needed.

### Q2: Where should "Market closed" appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Widget subtitle | Use `subtitle` prop on Equities panel | ✓ |
| Badge pill | Add "Closed" badge |  |
| Header right alongside timestamp | Combine with freshness indicator |  |

**User's choice:** [auto] Widget subtitle (recommended default)
**Notes:** Leverages existing Widget.tsx prop. Simple, visible.

### Q3: How to detect market hours?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side Intl.DateTimeFormat | Pure JS timezone check, no API | ✓ |
| External market status API | Call a provider endpoint |  |

**User's choice:** [auto] Client-side Intl.DateTimeFormat (recommended default)
**Notes:** Same pattern as Phase 1 DST fix. No external dependency.

---

## WS Indicator Enhancement (UI-03)

### Q1: What needs to change in the existing WS indicator?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal enhancement | Add attempt count + clickable retry on failure | ✓ |
| Full redesign | New indicator with detailed connection info |  |
| No change needed | Existing indicator is sufficient |  |

**User's choice:** [auto] Minimal enhancement (recommended default)
**Notes:** Existing indicator already covers basic states. Add attempt count ("WS... 3/10") and clickable retry.

---

## Claude's Discretion

- Exact Tailwind classes for timestamp aging thresholds
- Whether lastFetched extends WidgetStatus or is a separate field
- Shared vs per-widget timer for auto-updating timestamps
- Whether US holidays are included in market hours check (weekday-only acceptable for v1)
- Internal naming of WidgetSources type
- Whether WS attempt count extends onStatusChange payload or uses a new getter

## Deferred Ideas

- TTL countdown ring (REL-01), tick lag indicator (REL-02), confidence score (REL-03), rate limit quota (REL-04), auto-retry label (REL-05) — all v2
- FX/commodity exchange hours — complex, defer to v2
