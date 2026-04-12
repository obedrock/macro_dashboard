# Phase 3: WebSocket Reliability - Research

**Researched:** 2026-04-11
**Domain:** WebSocket lifecycle management, exponential backoff, React state integration
**Confidence:** HIGH

## Summary

Phase 3 replaces the current flat-5s reconnect loop in `twelveDataService.ts` with a `WebSocketManager` class that encapsulates connection lifecycle, exponential backoff, retry capping, connection-state exposure, price-state encapsulation, and heartbeat keep-alive. All four WS-01 through WS-04 requirements are addressed by a single new file (`src/services/wsManager.ts`) and coordinated changes to `twelveDataService.ts`, `useMarketData.ts`, and `src/types/index.ts`.

The implementation pattern is already established in this codebase: `rateLimiter.ts` (Phase 2) is a singleton class with the exact backoff formula specified in D-03. `WebSocketManager` follows the same module-level singleton export pattern (`export const wsManager = new WebSocketManager()`). No new dependencies are needed — all primitives are native `WebSocket`, `setTimeout`, and `clearTimeout`.

TwelveData's WebSocket server expects the client to send application-level `{"event":"heartbeat"}` messages every 10 seconds to prevent the server from dropping an idle connection. The server does not send its own ping frames; the client drives keep-alive. This must be wired into `WebSocketManager` alongside the reconnection logic.

**Primary recommendation:** Build `WebSocketManager` as a TypeScript class in `src/services/wsManager.ts`, copy the backoff formula from `rateLimiter.ts`, use the callback pattern for both tick delivery and status change notification, and migrate `twelveDataService.ts` consumers in-place.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single `WebSocketManager` class encapsulating all WebSocket state: connection lifecycle, reconnection with backoff, price tracking (lastPrices/prevPrices), and status. Follows the same singleton pattern as `cache.ts` and `rateLimiter.ts` — module-level instance exported as `export const wsManager = new WebSocketManager()`.
- **D-02:** The class replaces the current module-level variables (`ws`, `wsReconnectTimer`, `wsCallbacks`, `lastPrices`, `prevPrices`) and standalone functions (`connectWebSocket`, `subscribeWebSocket`). No new dependencies needed — uses native `WebSocket` API.
- **D-03:** Same backoff formula as Phase 2 RateLimiter: `min(initialDelay * 2^(attempt-1), maxDelay) + jitter`. Initial delay: 1s, max delay: 30s, jitter: 0-1s random. This is tuned for WebSocket reconnection (shorter initial delay than HTTP rate limiting since WS drops need faster recovery).
- **D-04:** Backoff resets to 0 on successful `onopen` — a successful connection proves the server is reachable again.
- **D-05:** After 10 consecutive failed reconnection attempts, enter terminal `'failed'` state. No further automatic reconnection. The WebSocketManager exposes a `reconnect()` method for manual retry (Phase 5 wires this to a UI button).
- **D-06:** The attempt counter resets on any successful connection. If a connection succeeds after 5 attempts then later drops, the counter restarts at 0.
- **D-07:** WebSocketManager tracks state as `wsStatus: 'connected' | 'connecting' | 'reconnecting' | 'failed'`. Exposed via callback: `onStatusChange(cb: (status: WsStatus) => void)`. The hook reads this into React state. No new React context needed — the callback pattern keeps the WS module framework-agnostic.
- **D-08:** Initial state is `'connecting'` when `connect()` is first called. Transitions: connecting→connected (onopen), connected→reconnecting (onclose), reconnecting→connected (onopen), reconnecting→failed (attempt >= 10).
- **D-09:** Replace exported `lastPrices` and `prevPrices` objects with `getPrice(symbol: string): number | undefined` and `getPrevPrice(symbol: string): number | undefined` methods on WebSocketManager. Internal state is private — no direct mutation from outside.
- **D-10:** Existing consumers (`wsToItem`, `buildRibbonFromWs` in `twelveDataService.ts`) update to call `wsManager.getPrice(sym)` instead of `lastPrices[sym]`. The `useMarketData.ts` hook updates its `subscribeWebSocket` call to use the new `wsManager.subscribe()` API.
- **D-11:** WebSocketManager sends application-level ping messages on a periodic interval and expects a response within a timeout. If no pong arrives, treat the connection as dead and trigger reconnection (same backoff logic as onclose).
- **D-12:** Ping interval and pong timeout parameters are Claude's discretion — pick values that balance detection speed with minimal traffic overhead for TwelveData's WS endpoint.

### Claude's Discretion
- Internal WebSocketManager method naming and organization
- Whether to keep `WS_SYMBOLS` as a module constant or move it into WebSocketManager constructor config
- Error logging strategy (console.warn on WS errors or silent)
- Whether `subscribe()` returns an unsubscribe function or uses a separate `unsubscribe()` method
- Heartbeat ping interval and pong timeout values (see D-12)

### Deferred Ideas (OUT OF SCOPE)
- **WebSocket status indicator in ribbon** — Phase 5 (UI-03) adds the visual indicator; Phase 3 only exposes the state
- **Reconnect button UI** — Phase 5 wires the `reconnect()` method to a user-facing button
- **WebSocket tick lag indicator** — v2 requirement REL-02, not in scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-01 | Exponential backoff reconnection with jitter (replace flat 5s loop) | Backoff formula verified in `rateLimiter.ts`; same `min(initial * 2^(attempt-1), max) + jitter` pattern applies directly |
| WS-02 | Max retry cap (10 attempts) with "gave up" terminal state | Standard pattern: attempt counter in class private state; terminal guard before scheduling reconnect |
| WS-03 | Connection state exposed as wsStatus (connected/connecting/reconnecting/failed) | Callback-based subscription pattern matches existing `subscribeWebSocket` return-unsubscribe convention |
| WS-04 | WebSocketManager encapsulates lastPrices/prevPrices (no exported mutable globals) | `getPrice()`/`getPrevPrice()` getter methods; three callsites in `twelveDataService.ts` identified for migration |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `WebSocket` | Browser built-in | WebSocket connection and lifecycle | Already used; no dependency to add |
| Native `setTimeout` / `clearTimeout` | Browser built-in | Reconnect scheduling with backoff | Same pattern as existing `wsReconnectTimer` |
| TypeScript class | 5.5.3 | Encapsulate WS state | Matches `DataCache` and `RateLimiter` class patterns in this codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/types/index.ts` | project | `WsStatus` type union | Add `export type WsStatus = 'connected' \| 'connecting' \| 'reconnecting' \| 'failed'` here |
| `src/services/rateLimiter.ts` | project | Backoff formula reference | Copy formula verbatim, adjust constants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom class | `reconnecting-websocket` npm package | Package adds 3rd-party dep; decisions prohibit new dependencies (D-02) |
| Callback-based status | React Context or EventEmitter | Callback keeps module framework-agnostic per D-07 |
| Application-level heartbeat | WebSocket protocol-level Ping frames | TwelveData does not send server-side pings; application-level heartbeat is required per their docs |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Structure
```
src/services/
├── wsManager.ts       # NEW — WebSocketManager class + singleton export
├── twelveDataService.ts  # MODIFIED — remove module-level WS vars, import wsManager
├── cache.ts           # unchanged
├── rateLimiter.ts     # unchanged (reference pattern)
src/hooks/
├── useMarketData.ts   # MODIFIED — subscribe via wsManager, read wsStatus into state
src/types/
├── index.ts           # MODIFIED — add WsStatus type export
```

### Pattern 1: WebSocketManager Class Skeleton

**What:** Singleton class owning all WS state. Follows `RateLimiter` class structure exactly.

**When to use:** Only one instance should exist per application lifetime; the module singleton pattern enforces this.

```typescript
// src/services/wsManager.ts
// Source: rateLimiter.ts singleton pattern (this codebase)

export type WsStatus = 'connected' | 'connecting' | 'reconnecting' | 'failed';

export type WsCallback = (update: RibbonTickUpdate) => void;
export type StatusCallback = (status: WsStatus) => void;

const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const JITTER_MS = 1_000;
const MAX_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 10_000;
const PONG_TIMEOUT_MS = 5_000;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private status: WsStatus = 'connecting';
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPrices: Record<string, number> = {};
  private prevPrices: Record<string, number> = {};
  private tickCallbacks: Set<WsCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  connect(): void { /* ... */ }
  subscribe(cb: WsCallback): () => void { /* ... return unsubscribe */ }
  onStatusChange(cb: StatusCallback): () => void { /* ... return unsubscribe */ }
  getPrice(symbol: string): number | undefined { return this.lastPrices[symbol]; }
  getPrevPrice(symbol: string): number | undefined { return this.prevPrices[symbol]; }
  reconnect(): void { /* manual retry — clears terminal state, resets attempt to 0 */ }
  disconnect(): void { /* used by unsubscribe when no callbacks remain */ }
}

export const wsManager = new WebSocketManager();
```

### Pattern 2: Backoff Formula (from rateLimiter.ts)

**What:** Identical formula to Phase 2 rate limiter — min(initial * 2^(attempt-1), max) + jitter.

**Key difference from rateLimiter:** WebSocket backoff uses `attempt` to schedule the *next* reconnect delay, not a `blockedUntil` timestamp. Timer is cancelled and rescheduled each time.

```typescript
// Source: src/services/rateLimiter.ts (verified in codebase)
private nextDelay(): number {
  const base = Math.min(INITIAL_DELAY_MS * Math.pow(2, this.attempt - 1), MAX_DELAY_MS);
  const jitter = Math.random() * JITTER_MS;
  return base + jitter;
}
```

Delay sequence for reference:
| Attempt | Base (ms) | +Jitter | Approx |
|---------|-----------|---------|--------|
| 1 | 1,000 | 0-1,000 | 1-2s |
| 2 | 2,000 | 0-1,000 | 2-3s |
| 3 | 4,000 | 0-1,000 | 4-5s |
| 4 | 8,000 | 0-1,000 | 8-9s |
| 5 | 16,000 | 0-1,000 | 16-17s |
| 6-10 | 30,000 (cap) | 0-1,000 | ~30s |

### Pattern 3: TwelveData Application-Level Heartbeat

**What:** Client sends `{"event":"heartbeat"}` every 10 seconds. TwelveData server requires this to keep the connection alive — the server does not send its own protocol-level Pings.

**Decision D-11 implementation:** Start a `setInterval` on `onopen`. On each tick, send heartbeat and arm a `pong-timeout` (`setTimeout` for PONG_TIMEOUT_MS). If the pong timeout fires before the next real price tick or heartbeat acknowledgement arrives, treat as dead and call `ws.close()` to trigger the `onclose` handler and reconnection flow.

**Recommended values (Claude's discretion, D-12):**
- Heartbeat interval: **10,000ms** (matches TwelveData documentation recommendation exactly)
- Pong timeout: **5,000ms** — gives 5 seconds for the server to respond before declaring the connection dead. Short enough to detect silent drops quickly; long enough to avoid false positives on slow networks.

**Rationale:** 10s interval matches TwelveData's stated guidance. 5s pong timeout stays well under the 10s heartbeat interval so the pong timer expires and triggers reconnect before the next heartbeat fires. This prevents simultaneous timer confusion.

```typescript
// Heartbeat pattern
private startHeartbeat(): void {
  this.stopHeartbeat();
  this.heartbeatTimer = setInterval(() => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: 'heartbeat' }));
      this.pongTimer = setTimeout(() => this.handleSilentDrop(), PONG_TIMEOUT_MS);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

private stopHeartbeat(): void {
  if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  if (this.pongTimer) clearTimeout(this.pongTimer);
  this.heartbeatTimer = null;
  this.pongTimer = null;
}

// In onmessage: any incoming message (price or heartbeat-ack) clears the pong timer
// so only truly silent connections trigger the dead-connection path.
private clearPongTimer(): void {
  if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
}
```

### Pattern 4: Status State Machine

**What:** `wsStatus` transitions driven by WebSocket lifecycle events.

```
Initial call to connect()
       │
       ▼
  'connecting'
       │
  onopen fires
       │
       ▼
  'connected'  ──────────────────────────────────────────────────────────┐
       │                                                                  │
  onclose fires or silent-drop detected                                   │
       │                                                                  │
       ▼                                                                  │
  'reconnecting'  ──── attempt < 10 ──── schedule reconnect ──── onopen  │
       │                                                                  │
  attempt >= 10                                                           │
       │                                                                  │
       ▼                                                                  │
   'failed'  ──── manual reconnect() called ──── reset attempt=0 ────────┘
```

### Pattern 5: Hook Integration (useMarketData.ts)

**What:** Replace `subscribeWebSocket` import with `wsManager.subscribe()` and add `wsStatus` state.

```typescript
// In useMarketData.ts (MODIFIED)
import { wsManager } from '../services/wsManager';
import type { WsStatus } from '../types';

const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

useEffect(() => {
  const unsubTick = wsManager.subscribe((update) => {
    // existing ribbon update logic unchanged
  });
  const unsubStatus = wsManager.onStatusChange(setWsStatus);
  wsManager.connect();

  return () => {
    unsubTick();
    unsubStatus();
  };
}, []);
```

**Note:** `wsStatus` is already exposed from the hook for Phase 5 (UI-03) to consume — Phase 3 wires it into state but no UI component reads it yet.

### Anti-Patterns to Avoid

- **Calling `ws.close()` in `onerror` handler without guarding:** The current code does `ws?.close()` in `onerror`. This triggers `onclose` immediately, which in the new class should be fine since `onclose` drives reconnect. But avoid *also* scheduling a reconnect in `onerror` — that would double-schedule.
- **Reconnecting when no callbacks are subscribed:** If all subscribers have unsubscribed (zero tick callbacks), the connection should be cleanly closed and NOT automatically reconnected. The `disconnect()` path handles this — do not call `connect()` again until `subscribe()` is called.
- **Clearing the pong timer only on heartbeat-ack:** Any incoming message (including price ticks) proves the connection is alive. Clear the pong timer on every `onmessage`, not just heartbeat responses.
- **Forgetting to clear timers on `disconnect()`:** `reconnectTimer`, `heartbeatTimer`, and `pongTimer` must all be cleared in the disconnect path to prevent dangling timers after component unmount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backoff formula | Custom delay math | Copy from `rateLimiter.ts` | Already verified, tested conceptually by Phase 2 |
| Singleton enforcement | Module registry, DI container | Module-level `export const wsManager = new WebSocketManager()` | Node/browser module system guarantees single instance |
| Status change subscription | EventEmitter, RxJS | Simple `Set<StatusCallback>` + `forEach` | Matches existing `wsCallbacks` pattern; no new deps |

**Key insight:** The codebase already has every primitive needed. The work is reorganization and encapsulation, not invention.

---

## Common Pitfalls

### Pitfall 1: Double-reconnect on onerror + onclose
**What goes wrong:** `ws.onerror` fires, then `ws.onclose` fires. If both schedule reconnects, the backoff timer fires twice and `attempt` increments twice per drop event.
**Why it happens:** Browser WebSocket always fires `onclose` after `onerror`. Both handlers see the connection as needing reconnect.
**How to avoid:** Only schedule reconnect in `onclose`. In `onerror`, call `ws.close()` (which triggers `onclose`) but do NOT schedule reconnect directly.
**Warning signs:** `attempt` reaching 10 after only 5 real network drops.

### Pitfall 2: Race between onopen and pending reconnectTimer
**What goes wrong:** `onopen` fires while a `setTimeout(reconnect, delay)` is still pending from a previous `onclose`. Two simultaneous connections are created.
**Why it happens:** Rapid reconnects can resolve before the timer expires if the timer delay is short.
**How to avoid:** In `onopen`, call `clearTimeout(this.reconnectTimer)` and reset `this.reconnectTimer = null` before any other logic. At the start of the reconnect function, guard with `if (ws?.readyState === WebSocket.CONNECTING || ws?.readyState === WebSocket.OPEN) return`.
**Warning signs:** Duplicate price ticks, doubled ribbon updates.

### Pitfall 3: Heartbeat fires after disconnect
**What goes wrong:** `setInterval` for heartbeat continues after `ws.close()` is called intentionally. Next tick attempts `ws.send()` on a closed socket, triggering `onerror` and an unexpected reconnect.
**Why it happens:** `stopHeartbeat()` not called in the intentional `disconnect()` path.
**How to avoid:** Always call `stopHeartbeat()` in `disconnect()` and in the beginning of `onclose` handler before deciding whether to reconnect.
**Warning signs:** App reconnects after a clean page navigation/unmount.

### Pitfall 4: useEffect cleanup not removing statusCallback
**What goes wrong:** React StrictMode in development mounts effects twice. If `onStatusChange(cb)` doesn't return a proper unsubscribe, stale callbacks accumulate and `setWsStatus` is called on an unmounted component.
**Why it happens:** `onStatusChange` returns `void` instead of an unsubscribe function.
**How to avoid:** Both `subscribe()` and `onStatusChange()` must return `() => void` that removes the callback from the Set.
**Warning signs:** React warning "Can't perform a state update on an unmounted component" in dev.

### Pitfall 5: `wsManager.connect()` called every render instead of once
**What goes wrong:** If `wsManager.connect()` is called outside a `useEffect` or inside a callback that fires on re-renders, multiple connections are created.
**Why it happens:** Forgetting that module-level code in services runs once, but hook logic can re-run.
**How to avoid:** Call `wsManager.connect()` exactly once — inside the `useEffect(()=>{...},[])` cleanup-returning effect. The guard `if (ws?.readyState === WebSocket.CONNECTING || readyState === WebSocket.OPEN) return` provides a second safety net.

---

## Code Examples

### Current Code to Replace (twelveDataService.ts lines 22-81)
```typescript
// Source: src/services/twelveDataService.ts (current, lines 22-81)
// These module-level variables and standalone functions are the migration target:
let ws: WebSocket | null = null;
const wsCallbacks: Set<WsCallback> = new Set();
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsConnected = false;
export const lastPrices: Record<string, number> = {};
export const prevPrices: Record<string, number> = {};

// connectWebSocket() — replace with wsManager.connect()
// subscribeWebSocket(cb) — replace with wsManager.subscribe(cb)
// isWsConnected() — replace with wsManager status callback
```

### Consumer Migration (twelveDataService.ts)
```typescript
// BEFORE (current)
const wsPrice = lastPrices[sym];
const prev = prevPrices[sym];

// AFTER
const wsPrice = wsManager.getPrice(sym);
const prev = wsManager.getPrevPrice(sym);
```

Three callsites in `twelveDataService.ts` require this change:
- Line 186: `wsToItem()` reads `lastPrices[sym]` and `prevPrices[sym]`
- Line 373-376: `buildRibbonFromWs()` reads four entries from `lastPrices` and `prevPrices`

### WsStatus Type Addition (types/index.ts)
```typescript
// Add after WidgetLoadState (line 93):
export type WsStatus = 'connected' | 'connecting' | 'reconnecting' | 'failed';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat 5s reconnect loop | Exponential backoff with jitter | Phase 3 | Prevents thundering-herd if server is down |
| Infinite retry | 10-attempt cap + terminal state | Phase 3 | Stops silent resource drain on permanent failures |
| Module-level mutable globals | Class-private state + getter methods | Phase 3 | Eliminates external mutation risk |
| No status visibility | `WsStatus` callback exposed to hook | Phase 3 | Enables Phase 5 UI indicator without coupling |
| No keep-alive | Application-level heartbeat every 10s | Phase 3 | Detects silent drops that onclose never fires for |

---

## Open Questions

1. **Does TwelveData send a heartbeat-ack message back?**
   - What we know: TwelveData docs say to send `{"event":"heartbeat"}` every 10 seconds; the server does not send its own Pings.
   - What's unclear: Whether the server echoes a heartbeat-ack event or simply uses any message (price ticks) as implicit proof of life. The Python client only sends heartbeats, does not appear to wait for an ack.
   - Recommendation: Treat *any* incoming message (price tick OR server-side response of any kind) as proof the connection is alive. Clear `pongTimer` on every `onmessage`. This is the safest approach regardless of whether TwelveData sends explicit acks. Confidence: MEDIUM (not verified with official docs).

2. **Does `wsManager.connect()` need to be called explicitly or should `subscribe()` call it implicitly?**
   - What we know: Current `subscribeWebSocket(cb)` calls `connectWebSocket()` internally — subscribe drives connection.
   - Recommendation (Claude's discretion): `subscribe()` should implicitly call `connect()` to preserve the existing behavior. The `connect()` guard (`if already CONNECTING/OPEN return`) makes this safe. This maintains backward-compatible call sites in the hook.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is code-only; no external tools, CLIs, or services beyond those already in use (native WebSocket API, existing TwelveData endpoint).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (TEST-01, Phase 6 — not yet installed) |
| Config file | none — Wave 0 gap |
| Quick run command | `npx vitest run src/services/wsManager.test.ts` (once installed) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-01 | Reconnect delay grows exponentially with jitter | unit | `npx vitest run src/services/wsManager.test.ts -t "backoff"` | Wave 0 |
| WS-01 | Backoff resets to 0 on successful onopen | unit | `npx vitest run src/services/wsManager.test.ts -t "backoff reset"` | Wave 0 |
| WS-02 | After 10 failed attempts, status becomes 'failed' | unit | `npx vitest run src/services/wsManager.test.ts -t "terminal state"` | Wave 0 |
| WS-02 | No further reconnect scheduled after 'failed' | unit | `npx vitest run src/services/wsManager.test.ts -t "no reconnect after failed"` | Wave 0 |
| WS-02 | manual reconnect() clears terminal state | unit | `npx vitest run src/services/wsManager.test.ts -t "manual reconnect"` | Wave 0 |
| WS-03 | Status transitions: connecting→connected→reconnecting→failed | unit | `npx vitest run src/services/wsManager.test.ts -t "status transitions"` | Wave 0 |
| WS-03 | onStatusChange callback fires on each transition | unit | `npx vitest run src/services/wsManager.test.ts -t "status callback"` | Wave 0 |
| WS-04 | getPrice returns undefined before first tick | unit | `npx vitest run src/services/wsManager.test.ts -t "getPrice"` | Wave 0 |
| WS-04 | prevPrice is previous value after second tick | unit | `npx vitest run src/services/wsManager.test.ts -t "prevPrice"` | Wave 0 |
| WS-04 | lastPrices/prevPrices not exported from twelveDataService | unit (type-check) | `npx tsc --noEmit` | automated |

**Note:** TEST-05 in REQUIREMENTS.md ("WebSocket reconnection logic tests") maps to this phase's WS-01/WS-02 tests above. Vitest is not installed yet — Phase 6 installs it (TEST-01). The planner should add a Wave 0 task to stub the test file structure so it can be filled in without Phase 6 blocking verification.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type safety gate, always available)
- **Per wave merge:** `npx vitest run src/services/wsManager.test.ts` (once Wave 0 creates the file)
- **Phase gate:** Full TypeScript compile clean + all wsManager tests green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/wsManager.test.ts` — unit tests for WS-01 through WS-04 behaviors (mock WebSocket class needed)
- [ ] Vitest not installed — `npm install -D vitest` (or defer to Phase 6 TEST-01; if deferred, type-check is the only automated gate)

*(If Vitest installation is deferred to Phase 6, the phase gate becomes: TypeScript compile clean + manual smoke test of reconnection behavior in browser DevTools by closing the WebSocket tab network connection.)*

---

## Sources

### Primary (HIGH confidence)
- `src/services/rateLimiter.ts` — backoff formula, singleton class pattern (verified directly in codebase)
- `src/services/twelveDataService.ts` lines 22-81 — exact current WebSocket code being replaced
- `src/services/cache.ts` — singleton export pattern reference
- `src/hooks/useMarketData.ts` lines 346-368 — current hook WebSocket subscription and ribbon update logic

### Secondary (MEDIUM confidence)
- [TwelveData "How to stream the data" support article](https://support.twelvedata.com/en/articles/5620516-how-to-stream-the-data) — confirms `{"event":"heartbeat"}` message, 10-second interval recommendation, subscribe/unsubscribe/reset event types

### Tertiary (LOW confidence)
- TwelveData WebSocket FAQ — partial information, does not describe server-side heartbeat ack behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tooling is native browser APIs already in use
- Architecture: HIGH — class structure mirrors existing `rateLimiter.ts` exactly; callsites identified
- Backoff formula: HIGH — copy from verified codebase implementation
- Heartbeat values: MEDIUM — interval from official docs; pong timeout is reasoned estimate, not from official source
- Test validation: MEDIUM — test structure is clear; Vitest not yet installed

**Research date:** 2026-04-11
**Valid until:** 2026-07-11 (stable domain — WebSocket API and TwelveData endpoint unlikely to change)
