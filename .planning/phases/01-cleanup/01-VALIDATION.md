---
phase: 1
slug: cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (not yet installed — Wave 0 installs) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CLEAN-01 | build | `npx tsc --noEmit && npx vite build` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | CLEAN-01 | grep | `grep -r "massive\|polygon\|supabase" src/ --include="*.ts" --include="*.tsx"` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | CLEAN-02 | unit | `npx vitest run src/services/__tests__/twelveDataService.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | CLEAN-03 | unit | `npx vitest run src/hooks/__tests__/useMarketData.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | CLEAN-04 | unit | `npx vitest run src/services/__tests__/twelveDataService.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 2 | CLEAN-04 | manual | curl TwelveData symbol check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` — install test framework
- [ ] `vitest.config.ts` — configure with jsdom environment
- [ ] `src/services/__tests__/twelveDataService.test.ts` — stubs for CLEAN-02, CLEAN-04
- [ ] `src/hooks/__tests__/useMarketData.test.ts` — stubs for CLEAN-03

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DXY displays real fetched value | CLEAN-04 | Requires live API key and browser | Open dashboard, verify DXY value is not always 104.15 (mock) |
| Brent Crude shows independent price | CLEAN-04 | Requires live API key and browser | Open dashboard, verify Brent price differs from WTI+2.57 |
| Network tab shows batched calls | CLEAN-02 | Requires browser DevTools | Open Network tab, verify at most 1 batch request per domain group |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
