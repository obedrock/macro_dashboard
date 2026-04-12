---
phase: 02
slug: data-layer-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Phase 6 installs Vitest. Phase 2 uses TypeScript compiler + Vite build as validation |
| **Config file** | tsconfig.app.json (strict mode) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx vite build` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx vite build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DATA-01 | type-check | `npx tsc --noEmit` | N/A | pending |
| 02-01-02 | 01 | 1 | DATA-04 | type-check + grep | `npx tsc --noEmit && grep "z.object" src/services/schemas.ts` | N/A | pending |
| 02-01-03 | 01 | 1 | DATA-03 | type-check | `npx tsc --noEmit` | N/A | pending |
| 02-01-04 | 01 | 1 | DATA-06 | type-check + grep | `npx tsc --noEmit && grep "errorMessages" src/services/errorMessages.ts` | N/A | pending |
| 02-02-01 | 02 | 1 | DATA-01, DATA-02 | type-check + build | `npx tsc --noEmit && npx vite build` | N/A | pending |
| 02-02-02 | 02 | 1 | DATA-05 | type-check + grep | `npx tsc --noEmit && grep "partial" src/hooks/useMarketData.ts` | N/A | pending |

*Status: pending — will be filled during execution*

---

## Wave 0 Requirements

- [ ] `npm install zod` — Zod validation library (only new dependency for this phase)

*Existing TypeScript strict mode and Vite build cover all other infrastructure needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Widget shows error state on API failure | DATA-02 | Requires live browser with revoked API key | Open app, clear API key from .env, observe widget error states |
| Rate limit backoff pauses requests | DATA-03 | Requires triggering real 429 from provider | Exceed TwelveData rate limit, observe backoff behavior in network tab |
| Partial data renders with warning | DATA-05 | Requires simulating one provider down | Block one API endpoint in browser devtools, observe partial rendering |
| Human-readable error messages display | DATA-06 | Requires visual inspection | Trigger various error states, verify user-facing messages are friendly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
