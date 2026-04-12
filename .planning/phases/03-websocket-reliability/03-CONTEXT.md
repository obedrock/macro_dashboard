# Phase 3: WebSocket Reliability - Context

**Gathered:** 2026-04-11 (updated 2026-04-11)
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the flat 5-second reconnect loop with exponential backoff, expose connection state, encapsulate mutable globals, and add a terminal "gave up" state after 10 failed attempts. Scope is strictly WS-01 through WS-04 — no UI changes (Phase 5 adds status indicators), no REST service changes, no new data sources.

</domain>

<decisions>
## Implementation Decisions

### WebSocketManager Class Design (WS-01, WS-02, WS-04)
- **D-01:** Single `WebSocketManager` class encapsulating all WebSocket state: connection lifecycle, reconnection with backoff, price tracking (lastPrices/prevPrices), and status. Follows the same singleton pattern as `cache.ts` and `rateLimiter.ts` — module-level instance exported as `export const wsManager = new WebSocketManager()`.
- **D-02:** The class replaces the current module-level variables (`ws`, `wsReconnectTimer`, `wsCallbacks`, `lastPrices`, `prevPrices`) and standalone functions (`connectWebSocket`, `subscribeWebSocket`). No new dependencies needed — uses native `WebSocket` API.

### Exponential Backoff Parameters (WS-01)
- **D-03:** Same backoff formula as Phase 2 RateLimiter: `min(initialDelay * 2^(attempt-1), maxDelay) + jitter`. Initial delay: 1s, max delay: 30s, jitter: 0-1s random. This is tuned for WebSocket reconnection (shorter initial delay than HTTP rate limiting since WS drops need faster recovery).
- **D-04:** Backoff resets to 0 on successful `onopen` — a successful connection proves the server is reachable again.

### Max Retry Cap and Terminal State (WS-02)
- **D-05:** After 10 consecutive failed reconnection attempts, enter terminal `'failed'` state. No further automatic reconnection. The WebSocketManager exposes a `reconnect()` method for manual retry (Phase 5 wires this to a UI button).
- **D-06:** The attempt counter resets on any successful connection. If a connection succeeds after 5 attempts then later drops, the counter restarts at 0.

### Connection State Exposure (WS-03)
- **D-07:** WebSocketManager tracks state as `wsStatus: 'connected' | 'connecting' | 'reconnecting' | 'failed'`. Exposed via callback: `onStatusChange(cb: (status: WsStatus) => void)`. The hook reads this into React state. No new React context needed — the callback pattern keeps the WS module framework-agnostic.
- **D-08:** Initial state is `'connecting'` when `connect()` is first called. Transitions: connecting→connected (onopen), connected→reconnecting (onclose), reconnecting→connected (onopen), reconnecting→failed (attempt >= 10).

### Price State Encapsulation (WS-04)
- **D-09:** Replace exported `lastPrices` and `prevPrices` objects with `getPrice(symbol: string): number | undefined` and `getPrevPrice(symbol: string): number | undefined` methods on WebSocketManager. Internal state is private — no direct mutation from outside.
- **D-10:** Existing consumers (`wsToItem`, `buildRibbonFromWs` in twelveDataService.ts) update to call `wsManager.getPrice(sym)` instead of `lastPrices[sym]`. The `useMarketData.ts` hook updates its `subscribeWebSocket` call to use the new `wsManager.subscribe()` API.

### Heartbeat / Keep-Alive (Silent Disconnect Detection)
- **D-11:** WebSocketManager sends application-level ping messages on a periodic interval and expects a response within a timeout. If no pong arrives, treat the connection as dead and trigger reconnection (same backoff logic as onclose).
- **D-12:** Ping interval and pong timeout parameters are Claude's discretion — pick values that balance detection speed with minimal traffic overhead for TwelveData's WS endpoint.

### Claude's Discretion
- Internal WebSocketManager method naming and organization
- Whether to keep `WS_SYMBOLS` as a module constant or move it into WebSocketManager constructor config
- Error logging strategy (console.warn on WS errors or silent)
- Whether `subscribe()` returns an unsubscribe function or uses a separate `unsubscribe()` method
- Heartbeat ping interval and pong timeout values (see D-12)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — WS-01 through WS-04 definitions

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Service layer and hook data flow
- `.planning/codebase/INTEGRATIONS.md` — WebSocket connection details (TwelveData WSS endpoint, symbols, message format)
- `.planning/codebase/CONCERNS.md` — Known WebSocket issues (flat retry, exported globals)

### Prior Phase Context
- `.planning/phases/02-data-layer-hardening/02-CONTEXT.md` — Phase 2 decisions (singleton pattern, backoff formula, no new deps)

### Source Files (primary targets)
- `src/services/twelveDataService.ts` — Current WebSocket code (lines 10-90), price state, wsToItem, buildRibbonFromWs
- `src/hooks/useMarketData.ts` — WebSocket subscription in useEffect, wsConnected state
- `src/types/index.ts` — Type definitions (WsStatus type goes here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/rateLimiter.ts` — Phase 2 singleton with exponential backoff formula; same pattern for WebSocketManager
- `src/services/cache.ts` — Singleton pattern reference
- `src/types/index.ts` — Type home for WsStatus

### Established Patterns
- Module-level singletons exported as `const instance = new Class()` (cache, rateLimiter)
- Callback-based subscriptions with unsubscribe returns (existing `subscribeWebSocket` returns `() => void`)
- Native APIs preferred over libraries (WebSocket, Intl.DateTimeFormat, fetch)

### Integration Points
- `useMarketData.ts` calls `subscribeWebSocket(cb)` and reads `lastPrices`/`prevPrices` — must migrate to `wsManager.subscribe()` and `wsManager.getPrice()`
- `twelveDataService.ts` `wsToItem()` and `buildRibbonFromWs()` read `lastPrices`/`prevPrices` — must migrate to getter methods
- `wsConnected` boolean in hook — replace with `wsStatus` from WebSocketManager callback

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **WebSocket status indicator in ribbon** — Phase 5 (UI-03) adds the visual indicator; Phase 3 only exposes the state
- **Reconnect button UI** — Phase 5 wires the `reconnect()` method to a user-facing button
- **WebSocket tick lag indicator** — v2 requirement REL-02, not in scope

</deferred>

---

*Phase: 03-websocket-reliability*
*Context gathered: 2026-04-11 (updated 2026-04-11)*
