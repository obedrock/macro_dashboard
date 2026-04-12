---
phase: 04
slug: architecture-decomposition
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — Vitest + MSW planned for Phase 6 (TEST-01) |
| **Config file** | None |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx vite build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vite build`
- **Before `/gsd:verify-work`:** Full build must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ARCH-01 | structural | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ARCH-02, ARCH-04 | structural | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | ARCH-03 | structural | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test files to create (test framework not yet installed — Phase 6)
- Validation relies on TypeScript compiler and Vite build toolchain
- `npx eslint .` for hook rule verification (react-hooks/exhaustive-deps)

*Existing infrastructure covers all phase requirements via compiler checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error boundary isolates widget crash | ARCH-03 | Requires triggering a render error in browser | Temporarily add `throw new Error()` in one widget, verify others still render |
| Polling intervals fire at intended cadence | ARCH-04 | Requires observing network tab timing | Open dev tools Network tab, verify 60s REST intervals and 24h FRED intervals |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
