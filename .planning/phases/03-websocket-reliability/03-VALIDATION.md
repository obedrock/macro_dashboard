---
phase: 3
slug: websocket-reliability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest not installed (Phase 6) — TypeScript compiler is the automated gate |
| **Config file** | `tsconfig.app.json` (strict mode) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | WS-01, WS-02 | compile + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | WS-04 | compile + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | WS-01 | compile + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | WS-03, WS-04 | compile + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | WS-03 | compile + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Vitest installation deferred to Phase 6 (TEST-01).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Exponential backoff delays increase on WS drop | WS-01 | No test framework; timing-dependent | DevTools Network tab: disconnect WiFi, observe reconnect delays doubling from 1s to 30s |
| Terminal "failed" state after 10 attempts | WS-02 | Requires sustained network failure | DevTools: block wss:// in Network tab, count 10 reconnection attempts, verify no further attempts |
| Connection state reflects real-time status | WS-03 | Requires visual inspection | DevTools Console: `wsManager.status` shows 'connected', disconnect → 'reconnecting', block → 'failed' |
| Price state not exported as mutable globals | WS-04 | Structural verification | `grep -r "export.*lastPrices\|export.*prevPrices" src/` returns 0 results |
| Heartbeat detects silent disconnects | WS-01 | Requires network simulation | DevTools: throttle to offline after connection, verify reconnect triggers within heartbeat timeout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
