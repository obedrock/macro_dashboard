---
status: partial
phase: 05-ui-transparency
source: [05-VERIFICATION.md]
started: 2026-04-12T08:25:00Z
updated: 2026-04-12T08:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. All 10 widget headers display freshness label in browser
expected: Every widget card header shows a relative time string (Just now / Updated Xm ago / Cached Xm ago) that updates every 30 seconds
result: [pending]

### 2. EquitiesPanel D/W/M period selector coexists with FreshnessLabel in header
expected: Header right side shows freshness text AND period buttons side-by-side without overlap or displacement
result: [pending]

### 3. YieldCurveChart Today/+1M/+1Y overlay selector coexists with FreshnessLabel in header
expected: Header right side shows freshness text AND overlay buttons side-by-side without overlap or displacement
result: [pending]

### 4. DataSourceBadge amber/red pills appear for non-live widgets
expected: Widgets serving cached or fallback data show a colored pill badge (Cached/Partial amber, Fallback red) in their header
result: [pending]

### 5. EquitiesPanel shows 'Market closed' outside 9:30-16:00 ET on weekdays
expected: Subtitle toggles between 'US Markets' and 'Market closed' based on current ET time
result: [pending]

### 6. SummaryRibbon WS indicator shows 'WS... N/10' during reconnecting and is clickable when failed
expected: During reconnecting state the dot animates amber and text shows attempt count; during failed state the entire indicator is a clickable button
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
