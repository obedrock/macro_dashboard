# Phase 2: Data Layer Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 02-data-layer-hardening
**Areas discussed:** DataResult wrapper shape, Rate limit backoff strategy, Zod validation scope, Error message design
**Mode:** Auto (--auto flag active — all defaults auto-selected)

---

## DataResult Wrapper Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union | `{ status: 'ok', data: T, ... } \| { status: 'error', error: string, ... }` with DataSource metadata | auto |
| Status-field object | Single object with nullable data and error fields | |
| Result tuple | `[data, error]` Go-style tuple returns | |

**User's choice:** [auto] Discriminated union (recommended — aligns with existing WidgetStatus pattern, TypeScript narrows cleanly)
**Notes:** Source metadata ('live'/'cache'/'fallback') enables downstream UI transparency phase.

---

## Rate Limit Backoff Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Custom per-provider backoff | Module-level singleton tracking 429s per provider, exponential backoff + jitter | auto |
| p-queue library | Third-party concurrency/rate-limit queue | |
| Fetch interceptor | Global fetch wrapper with rate limit middleware | |

**User's choice:** [auto] Custom per-provider backoff (recommended — zero new dependencies, consistent with project constraint of minimal deps)
**Notes:** Integrated into existing tdFetch/fredFetch/finnhubFetch wrappers.

---

## Zod Validation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All API responses | One schema per endpoint, passthrough mode | auto |
| Critical paths only | Only validate TwelveData (most volatile) | |
| Response sampling | Validate first response per session, skip subsequent | |

**User's choice:** [auto] All API responses with passthrough mode (recommended — catches malformed data everywhere, passthrough avoids breakage from API additions)
**Notes:** Replaces existing isTdQuote() type guards with proper Zod schemas.

---

## Error Message Design

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized error map | Single module mapping provider + status → user-friendly string | auto |
| Per-service mapping | Each service defines its own error messages | |
| Error class hierarchy | Custom Error subclasses with user-facing messages | |

**User's choice:** [auto] Centralized error map (recommended — single source of truth, easy to extend)
**Notes:** Error strings stored in DataResult.error, consumed by Widget.tsx.

---

## Claude's Discretion

- Zod schema definitions per API response type
- Rate limit backoff timing parameters
- File organization for new modules
- DataSource enum design details

## Deferred Ideas

None — discussion stayed within phase scope.
