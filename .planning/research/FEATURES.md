# Feature Landscape: Reliability & Error Handling

**Domain:** Real-time financial dashboard — macroeconomic data aggregation
**Project:** MacroPulse
**Researched:** 2026-04-08
**Confidence:** HIGH (based on direct codebase audit + domain patterns from Bloomberg Terminal, TradingView, Refinitiv Eikon, and financial data SaaS products)

---

## Current State Baseline

Before categorizing features, it is important to know what already exists vs what is absent.
This informs which "table stakes" are gaps vs already covered.

| Capability | Current State | Gap |
|------------|--------------|-----|
| Loading skeleton per widget | YES — `Widget.tsx` renders `SkeletonRows` when `state === 'loading'` | None |
| Error state per widget | YES — `AlertCircle` + "Retry" button when `state === 'error'` | Error message is raw API string, not user-friendly |
| Per-widget manual retry | YES — `retryWidget(key)` dispatches correct fetch | None |
| Global refresh button | YES — spinning `RefreshCw` in `SummaryRibbon` | Only refreshes equities/FX/commodities, not FRED panels |
| Live/offline WebSocket indicator | YES — pulsing green dot + `Wifi`/`WifiOff` icon in ribbon | Indicator is only for ribbon WebSocket; REST panel health invisible |
| Last-updated timestamp | YES — `formatTime(lastUpdated)` shown in ribbon control area | Single global timestamp; per-panel freshness not shown |
| WebSocket reconnect | PARTIAL — `ws.onclose` sets a flat 5-second reconnect timer | No exponential backoff, no reconnect attempt counter, no user-visible reconnect status |
| Mock data fallback | YES — services return `mockMarketData` values on failure | Silent substitution — user sees plausible-looking data with no indication it is mock |
| Rate limit handling | NO — no 429 detection, no backoff | Services throw generic HTTP error; widget lands in error state without rate-limit-specific messaging |
| Stale data warning | NO — no timestamp on individual widgets | Users cannot tell if FRED data (24h TTL) is from this morning or yesterday |
| API response validation | PARTIAL — `isTdQuote` guard in TwelveData only | FRED and Finnhub responses unchecked; malformed data silently produces NaN values |
| Market hours awareness | NO — polling runs identically during and after market hours | REST calls during weekends/after-hours return stale close prices with no indication |
| Differentiated data source attribution | NO — no per-item source label | User cannot tell if a value came from TwelveData vs FRED |

---

## Table Stakes

Features users expect from any production financial dashboard. Missing = product loses trust or becomes misleading.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-widget data source attribution | Users need to know whether a value is live REST, live WebSocket, or cached FRED | Low | A small "FRED" or "TD" badge per panel. Already have TTL info to derive this |
| Stale data age indicator per widget | Financial data has very different latency — equity quotes vs TIPS breakeven are not equivalent | Low–Medium | `lastUpdated` exists globally; need per-widget timestamps stored in `WidgetStatuses` or alongside data slices |
| Mock/fallback data boundary visibility | If a service fails silently and returns mock data, the user sees plausible but fake values — this destroys trust | Medium | Current services return `mockMarketData` on catch without telling the hook. Need a `DataResult<T>` wrapper that distinguishes `{source: 'live', data}` from `{source: 'fallback', data}` |
| User-friendly error messages | Raw API error strings like "TwelveData 429: /quote" are opaque | Low | Map HTTP status codes and provider error codes to plain-English messages: "Rate limit reached — retrying in 60s", "API key invalid", "Data unavailable during market close" |
| Rate limit detection and backoff | Hitting a 429 without backoff causes cascading rate limit exhaustion | Medium | Detect 429 in `tdFetch`/`finnhubFetch`; surface remaining quota hint if header present; implement per-provider exponential backoff with jitter |
| WebSocket reconnection with visible status | Flat 5-second reconnect exists but user has no visibility into reconnection attempts | Low–Medium | Add reconnect attempt counter and max-attempts cap; expose `wsStatus: 'connected' \| 'reconnecting' \| 'failed'` from service; show in ribbon indicator |
| Degraded mode label when using cached data | TTL cache means users see old data that looks live | Low | When serving from cache, the ribbon/widget should indicate "Cached X min ago" rather than showing the live indicator |
| Market hours context | FRED data updates on business days; equity REST quotes during market hours only | Low | Display "Market closed — showing last close" next to equities/FX when outside NYSE hours (9:30–16:00 ET, Mon–Fri) |

---

## Differentiators

Features that set this dashboard apart from a generic charting tool. Not expected, but meaningfully improve trust and usability.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-widget refresh age ring / countdown | Visual indicator of how stale each panel is relative to its TTL — turns invisible data timing into explicit UI | Medium | A thin arc around the widget card that drains from full to empty as TTL expires. Requires per-widget `fetchedAt` timestamps |
| Automatic retry with exponential backoff + user visibility | Instead of leaving widget in permanent error state, retry silently at 5s → 15s → 60s → 5min intervals, with a "Retrying in Xs" label | Medium | Requires retry state machine per widget. Current `retryWidget` is purely manual |
| Rate limit quota indicator | Show remaining API call budget for TwelveData (which has plan-level limits); warn before exhaustion | High | Requires tracking calls made vs plan limits; TwelveData API does not expose remaining quota directly — would need client-side accounting |
| Per-panel data confidence score | Composite indicator: is the data from live REST? From cache within TTL? From fallback mock? Surfaced as a colored dot (green/amber/red) | Low | High trust-building feature; low implementation cost once `DataResult<T>` wrapper exists |
| WebSocket tick lag indicator | Show how many ms since last WebSocket message to surface feed latency | Low | `lastPrices` timestamps already stored in `timestamp` field of `RibbonTickUpdate`; gap from `Date.now()` is the lag |
| Partial load state | When a multi-source fetch partially succeeds (e.g. TwelveData works but FRED is down), show loaded data with a warning badge rather than treating the whole widget as errored | Medium | `fetchRates` already uses `Promise.allSettled` internally; the status propagation does not distinguish partial from total failure |

---

## Anti-Features

Features to deliberately NOT build in this reliability milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Global error toast/notification system | Adds a new UI layer; financial dashboards surface errors in context (per-widget), not as flying toasts that interrupt reading | Keep per-widget error states; add a subtle global error count badge in the header only if multiple widgets are errored simultaneously |
| Retry all button | "Refresh everything" already exists on the ribbon. A second "retry all errors" button creates confusion about what it does vs the global refresh | Rely on per-widget retry and the existing global refresh |
| Offline mode with full local cache | This is a personal dashboard with no backend. Building IndexedDB persistence for offline use is out of scope and adds significant complexity | Accept that the dashboard requires network access; focus on graceful degradation when individual APIs are unavailable |
| Automatic API key rotation | Multiple API key cycling adds infrastructure complexity and security surface area | A clear "API key invalid" error message with a link to the provider dashboard is sufficient |
| User-configurable polling intervals | Exposing polling configuration creates support burden and tempts users into rate limit violations | Keep intervals as constants; document them in a tooltip or settings panel if needed |
| Synthetic data during market close | Generating artificial interpolated prices after hours to maintain "live-looking" data is misleading | Show explicit "Market closed" state with the last known close price |

---

## Feature Dependencies

Understanding these dependencies determines implementation order.

```
DataResult<T> wrapper (distinguishes live vs fallback)
  └─► Mock data boundary visibility (table stakes)
  └─► Per-panel data confidence score (differentiator)
  └─► Partial load state (differentiator)

Per-widget fetchedAt timestamps (stored in WidgetStatuses or parallel map)
  └─► Stale data age indicator per widget (table stakes)
  └─► Per-widget refresh age ring (differentiator)
  └─► Degraded mode label when using cached data (table stakes)

HTTP status code mapping in tdFetch / finnhubFetch / fredService
  └─► User-friendly error messages (table stakes)
  └─► Rate limit detection and backoff (table stakes)
  └─► Rate limit quota indicator (differentiator — needs accounting layer on top)

wsStatus exposed from twelveDataService
  └─► WebSocket reconnection with visible status (table stakes)
  └─► WebSocket tick lag indicator (differentiator)

Market hours utility (NYSE calendar check)
  └─► Market hours context label (table stakes)
  └─► Anti-feature: Synthetic data during market close (explicitly avoided)
```

### Critical path for trust restoration

The single highest-leverage sequence is:

1. **DataResult wrapper** — eliminates silent mock fallback, the root cause of the biggest trust problem
2. **User-friendly error messages + rate limit detection** — surfaces what is actually wrong
3. **Per-widget timestamps + stale data label** — makes data age explicit
4. **WebSocket reconnect visibility** — closes the gap between actual connection state and what the ribbon indicator shows

Everything else is layered on top of these four foundations.

---

## MVP Recommendation for This Milestone

### Prioritize (table stakes, high trust impact)

1. **DataResult wrapper in services** — changes `catch → return mockData` to `catch → return { source: 'fallback', data: mockData }`, enables all downstream trust features
2. **User-friendly HTTP/API error messages** — low effort, high clarity gain; covers 429 rate limit, 401 invalid key, 503 provider down
3. **Per-widget `fetchedAt` timestamp** — add `fetchedAt?: Date` to `WidgetStatus`; set on each successful fetch; display as "Updated Xm ago" below widget title
4. **Mock/fallback badge on widget** — amber "Fallback data" chip when widget is loaded but sourced from mock; uses DataResult
5. **WebSocket reconnect status in ribbon indicator** — extend `wsStatus` export from `twelveDataService`; update the ribbon pulsing dot to show `reconnecting` amber state

### Defer (differentiators, second pass)

- Age ring / countdown timer
- Automatic retry with backoff (manual retry is sufficient for MVP)
- Partial load state per widget
- Rate limit quota accounting
- WebSocket tick lag ms display

### Out of scope for this milestone

All anti-features listed above.

---

## Sources

This analysis is based on:
- Direct codebase audit of `src/hooks/useMarketData.ts`, `src/services/twelveDataService.ts`, `src/services/fredService.ts`, `src/services/finnhubService.ts`, `src/services/cache.ts`, `src/components/shared/Widget.tsx`, `src/components/layout/SummaryRibbon.tsx`, `src/types/index.ts`
- Observed patterns from Bloomberg Terminal, TradingView, Refinitiv Eikon, Koyfin, and financial data SaaS products (HIGH confidence — domain conventions are stable and well-established)
- `.planning/PROJECT.md` active requirements list
- `.planning/codebase/ARCHITECTURE.md` architectural analysis
