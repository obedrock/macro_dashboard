---
phase: 1
slug: cleanup
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler + Vite build + grep |
| **Config file** | tsconfig.app.json (existing) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx vite build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx vite build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | CLEAN-01 | grep+build | `grep -ri "massive\|supabase" src/ vite.config.ts 2>/dev/null \| wc -l && npx tsc --noEmit && npx vite build` | ✅ | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | CLEAN-03 | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 01-02-T1 | 01-02 | 1 | CLEAN-02 | typecheck+build | `npx tsc --noEmit && npx vite build` | ✅ | ⬜ pending |
| 01-02-T2 | 01-02 | 1 | CLEAN-04 | build | `npx tsc --noEmit && npx vite build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 1 uses TypeScript compiler, Vite build, and grep for verification — no test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DXY displays real fetched value | CLEAN-04 | Requires live API key and browser | Open dashboard, verify DXY value is not always 104.15 (mock) |
| Brent Crude shows independent price | CLEAN-04 | Requires live API key and browser | Open dashboard, verify Brent price differs from WTI+2.57 |
| Network tab shows batched calls | CLEAN-02 | Requires browser DevTools | Open Network tab, verify at most 1 batch request per domain group |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-11
