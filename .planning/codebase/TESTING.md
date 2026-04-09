# Testing Patterns

**Analysis Date:** 2026-04-08

## Test Framework

**Runner:** None installed.

No testing framework, test runner, or assertion library is present in this codebase.

**Confirmed absent:**
- No `jest`, `vitest`, `@testing-library/*`, `mocha`, or similar packages in `package.json`
- No `jest.config.*`, `vitest.config.*`, or equivalent config files
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files anywhere in the project

**Run Commands:** None — no test scripts are defined in `package.json`.

```json
// Current scripts in package.json (no test command):
{
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit -p tsconfig.app.json"
}
```

## Type Checking as a Quality Gate

The only automated code quality checks available are:

**TypeScript strict mode** (`tsconfig.app.json`):
```bash
npm run typecheck   # tsc --noEmit -p tsconfig.app.json
```
- `strict: true` enforces null checks, strict function types, etc.
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

**ESLint** (`eslint.config.js`):
```bash
npm run lint        # eslint .
```
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` rules (exhaustive-deps enforced)
- `eslint-plugin-react-refresh` warnings

## Test File Organization

**Location:** Not applicable — no tests exist.

**Recommended pattern if tests are added:**
- Co-locate unit tests with source files: `src/services/fredService.test.ts`
- Place integration/hook tests near hooks: `src/hooks/useMarketData.test.ts`
- Component tests alongside components: `src/components/shared/Widget.test.tsx`

## Mocking

**Framework:** Not applicable — no tests exist.

**Recommended mocking approach when tests are added:**

The codebase has a well-structured fallback system that makes testing straightforward:

- `src/data/mockData.ts` exports `mockMarketData`, `mockNews`, `mockEconomicCalendar`, and `mockFomcData` — these are already used as fallbacks throughout the service layer and as initial hook state. They are the natural test fixtures.
- `src/services/cache.ts` exports a singleton `cache` instance — a test could call `cache.invalidate(key)` or replace the module with a no-op cache to avoid cross-test contamination.
- All service functions accept no configuration and rely on `import.meta.env.VITE_*` for API keys — environment variables would need mocking in a test environment.

## Fixtures and Factories

**Test Data:**
Mock data already exists at `src/data/mockData.ts` and exports:
- `mockMarketData` — complete `MarketData` object with all widget data
- `mockNews` — array of `NewsItem` objects
- `mockEconomicCalendar` — array of `EconomicEvent` objects
- `mockFomcData` — `FomcData` object

These are used as initial state in `useMarketData` hook and as error fallbacks in all service functions — making them the canonical test fixtures for any future tests.

## Coverage

**Requirements:** None — no coverage tooling configured.

**View Coverage:** Not applicable.

## Test Types

**Unit Tests:** None.

**Integration Tests:** None.

**E2E Tests:** None.

## Areas to Test if Tests Are Added (by priority)

**High priority:**

1. **Service functions** — pure data transformation functions are fully testable without HTTP mocking:
   - `classifySentiment` in `src/services/finnhubService.ts` (keyword scoring logic)
   - `formatNewsTime` in `src/services/finnhubService.ts` (time formatting)
   - `mapImpact` in `src/services/finnhubService.ts` (impact string → union)
   - `getUpcomingFomcDates` in `src/services/finnhubService.ts` (date filtering)
   - `isoDateOffset` in `src/services/fredService.ts` (date arithmetic)
   - `buildRibbonFromWs` in `src/services/twelveDataService.ts` (WebSocket price → PriceItem)

2. **Cache** — `src/services/cache.ts` `DataCache` class logic (TTL expiry, key invalidation)

3. **Hook** — `useMarketData` in `src/hooks/useMarketData.ts`:
   - Status transitions (`loading` → `loaded` / `error`)
   - `retryWidget` switch dispatch
   - Interval cleanup on unmount

**Medium priority:**

4. **Context** — `DashboardContext` persistence logic (`localStorage` read/write, settings merge)
5. **Components** — `Widget` rendering states (loading skeleton, error state, content)
6. **ChangeIndicator** — formatting and color logic

## Recommended Setup if Adding Tests

```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom @vitest/coverage-v8
```

Minimal `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

Add to `package.json` scripts:
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "coverage": "vitest run --coverage"
}
```

---

*Testing analysis: 2026-04-08*
