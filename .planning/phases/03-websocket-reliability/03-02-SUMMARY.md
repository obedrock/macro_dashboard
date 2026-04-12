---
phase: 03-websocket-reliability
plan: 02
subsystem: websocket
tags: [websocket, migration, encapsulation, consumer-migration]
dependency_graph:
  requires: [03-01]
  provides: [wsManager-consumer-migration]
  affects: [src/services/twelveDataService.ts, src/hooks/useMarketData.ts]
tech_stack:
  added: []
  patterns: [singleton-consumer, status-state, cleanup-unsubscribe]
key_files:
  modified:
    - src/services/twelveDataService.ts
    - src/hooks/useMarketData.ts
decisions:
  - "Preserve ribbonBase.current mutation inside setData updater — identical to prior behavior, cleanup deferred to Phase 4"
  - "wsStatus initial state is 'connecting' per D-08 — subscribe() calls connect() implicitly"
metrics:
  duration: ~8min
  completed: 2026-04-12
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 02: Consumer Migration — Remove Old WS Code Summary

**One-liner:** Migrated twelveDataService and useMarketData from module-level WebSocket globals to the WebSocketManager singleton, exposing wsStatus in the hook return value.

## What Was Built

Completed the WebSocket encapsulation (WS-04) by removing all module-level WS globals from `twelveDataService.ts` and wiring both consumers to `wsManager`. The `useMarketData` hook now tracks connection status via `wsStatus: WsStatus` state and exposes it in its return value for Phase 5 (UI-03) consumption.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove old WS code from twelveDataService and wire wsManager | 224255c | src/services/twelveDataService.ts |
| 2 | Wire useMarketData to wsManager and expose wsStatus | 80eaf2c | src/hooks/useMarketData.ts |

## Changes Made

### src/services/twelveDataService.ts
- Removed `WS_URL` constant (moved to wsManager.ts in Plan 01)
- Removed `RibbonTickUpdate` and `WsCallback` type exports (now live in wsManager.ts)
- Removed `WS_SYMBOLS` constant
- Removed module-level mutable variables: `ws`, `wsCallbacks`, `wsReconnectTimer`, `wsConnected`, `lastPrices`, `prevPrices`
- Removed functions: `connectWebSocket`, `subscribeWebSocket`, `isWsConnected`
- Added `import { wsManager } from './wsManager'`
- Updated `wsToItem` to use `wsManager.getPrice(sym)` and `wsManager.getPrevPrice(sym)`
- Updated `buildRibbonFromWs` to use `wsManager.getPrice/getPrevPrice` for all four price reads

### src/hooks/useMarketData.ts
- Removed `subscribeWebSocket` from the `twelveDataService` import
- Added `WsStatus` to the types import
- Added `import { wsManager } from '../services/wsManager'`
- Added `const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')`
- Replaced `subscribeWebSocket(cb)` useEffect with `wsManager.subscribe(cb)` + `wsManager.onStatusChange(setWsStatus)`
- Cleanup now calls both `unsubTick()` and `unsubStatus()`
- Return value now includes `wsStatus`

## Deviations from Plan

None — plan executed exactly as written.

**Note:** The `ribbonBase.current` mutation inside `setData(prev => ...)` updater is preserved from existing code per plan specification. This is a known StrictMode concern acknowledged in the plan — cleanup is deferred to Phase 4 (code quality improvements).

## Known Stubs

None. All wsManager calls are fully wired. The `wsStatus` value in the hook return is intentionally unused by components until Phase 5 (UI-03) implements the status indicator — this is by design, not a stub.

## Verification

- `npx tsc --noEmit` exits 0 — zero TypeScript errors
- `grep -r "export const lastPrices|export const prevPrices|subscribeWebSocket|isWsConnected" src/` returns 0 matches
- `grep -r "wsManager.getPrice|wsManager.getPrevPrice" src/services/twelveDataService.ts` returns 6 matches (lines 115, 116, 302, 303, 304, 305)
- `grep -r "wsManager.subscribe|wsManager.onStatusChange" src/hooks/useMarketData.ts` returns matches
- `grep "wsStatus" src/hooks/useMarketData.ts` returns matches (state declaration + return value)

## Self-Check: PASSED
