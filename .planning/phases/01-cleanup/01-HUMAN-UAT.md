---
status: partial
phase: 01-cleanup
source: [01-VERIFICATION.md]
started: 2026-04-11T20:00:00Z
updated: 2026-04-11T20:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. DXY Real Data Display
expected: Open the app with a valid VITE_TWELVEDATA_API_KEY. DXY in the FX panel shows a real current value (~100-106 range), not a static mock value that never changes across page refreshes when the market is open.
result: [pending]

### 2. Brent Crude Real Data Display
expected: Open the app with a valid API key. Brent shows a distinct price from WTI (typically $2-4 higher), and both change independently over time.
result: [pending]

### 3. DST Calendar Scheduling Accuracy
expected: During EDT months (March-November), calendar data refreshes at 8:35 AM ET, not 9:35 AM ET.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
