---
phase: 5
slug: ui-transparency
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — Phase 6 installs Vitest (TEST-01) |
| **Config file** | None yet |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npm run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | UI-01, UI-05 | type check | `npm run typecheck` | N/A | ⬜ pending |
| 05-01-02 | 01 | 1 | UI-02 | type check | `npm run typecheck` | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | UI-04 | type check | `npm run typecheck` | N/A | ⬜ pending |
| 05-02-01 | 02 | 2 | UI-01, UI-02, UI-05 | type check + manual | `npm run typecheck` | N/A | ⬜ pending |
| 05-02-02 | 02 | 2 | UI-03 | type check + manual | `npm run typecheck` | N/A | ⬜ pending |
| 05-02-03 | 02 | 2 | UI-04 | type check + manual | `npm run typecheck` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers type checking and linting. No test framework needed for Phase 5.

- [ ] `npm run typecheck` — verify no type errors after each hook extension
- [ ] `npm run lint` — verify no unused locals/params after context changes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FreshnessLabel renders correct relative time text | UI-01 | No test framework until Phase 6 | Open dashboard, verify each widget shows "Updated Xm ago" in header right |
| DataSourceBadge shows pill for non-live data | UI-02 | No test framework until Phase 6 | Disconnect network, verify widgets show "Fallback" badge |
| WS indicator shows attempt count during reconnect | UI-03 | Visual inspection | Kill WS connection, verify "WS... N/10" appears in ribbon |
| "Market closed" label on Equities panel | UI-04 | Time-dependent | Check during market closed hours, verify subtitle shows "Market closed" |
| Very stale data shows "Cached Xm ago" in red | UI-05 | No test framework until Phase 6 | Wait >30 min or mock timestamp, verify red cached label |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
