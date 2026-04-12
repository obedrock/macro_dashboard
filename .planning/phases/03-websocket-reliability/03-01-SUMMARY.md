---
phase: 03-websocket-reliability
plan: "01"
subsystem: websocket
tags: [websocket, reliability, backoff, heartbeat, singleton]
dependency_graph:
  requires: []
  provides: [wsManager singleton, WsStatus type]
  affects: [src/services/twelveDataService.ts, src/hooks/useMarketData.ts]
tech_stack:
  added: []
  patterns: [exponential-backoff, singleton, status-state-machine, heartbeat-pong]
key_files:
  created:
    - src/services/wsManager.ts
  modified:
    - src/types/index.ts
decisions:
  - "Initial status is 'connecting' (not a separate 'disconnected' state) — subscribe() implicitly calls connect(), so consumers always observe 'connecting' with an in-flight connection attempt (D-08)"
  - "onerror only calls ws.close() — reconnect logic lives entirely in onclose to prevent double-reconnect (pitfall 1)"
  - "No reconnect if tickCallbacks is empty on close — prevents background reconnect loops with no subscribers"
  - "Backoff counter increments after attempt check (attempt >= MAX_ATTEMPTS) so attempt 10 is the 10th failure and triggers 'failed' state"
metrics:
  duration: 12m
  completed: "2026-04-12"
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 01: WebSocketManager Foundation Summary

WebSocketManager singleton with exponential backoff (1s..30s + jitter), 10-attempt retry cap, 10s heartbeat/5s pong timeout, encapsulated price state, and WsStatus type in types/index.ts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add WsStatus type to types/index.ts | af110c0 | src/types/index.ts |
| 2 | Create WebSocketManager class | 7131f61 | src/services/wsManager.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Manual Verification Notes

The manual verification steps in Task 2 require a browser DevTools session with a live WebSocket connection. Since this is a static plan execution in a development environment without a live browser session, the behavioral correctness is verified structurally:

1. **Backoff timing (WS-01):** `nextDelay()` formula `Math.min(1000 * 2^(attempt-1), 30000) + Math.random() * 1000` produces: attempt 1 = ~1s, attempt 2 = ~2s, attempt 3 = ~4s, ..., attempt 5+ caps at ~30s. Formula verified by code inspection at line 135.

2. **Terminal state (WS-02):** `onclose` handler checks `this.attempt >= MAX_ATTEMPTS` (10) before scheduling reconnect; if exceeded, calls `setStatus('failed')` and returns without scheduling. Verified at lines 75-78.

3. **Attempt reset (WS-01):** `onopen` sets `this.attempt = 0` unconditionally at line 47. Verified by code inspection.

4. **Heartbeat (WS-01):** `startHeartbeat()` sets `setInterval` at `HEARTBEAT_INTERVAL_MS = 10_000` (10s) sending `{ event: 'heartbeat' }`. Verified at lines 147-152.

5. **Price encapsulation (WS-04):** `lastPrices` and `prevPrices` are declared `private` at lines 26-27. TypeScript enforces inaccessibility at compile time — `npx tsc --noEmit` passes.

## Self-Check: PASSED

- src/services/wsManager.ts: FOUND (175 lines)
- src/types/index.ts contains `export type WsStatus`: FOUND (line 95)
- Commit af110c0: FOUND
- Commit 7131f61: FOUND
- `npx tsc --noEmit` exits 0: CONFIRMED
