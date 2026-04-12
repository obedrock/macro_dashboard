# Technology Stack

**Analysis Date:** 2026-04-08

## Languages

**Primary:**
- TypeScript 5.5.3 - All application source code in `src/`
- TSX - React component files throughout `src/components/`

**Secondary:**
- JavaScript - Config files only (`tailwind.config.js`, `postcss.config.js`, `eslint.config.js`)
- HTML - Single entry point `index.html`
- CSS - Global styles in `src/index.css`

## Runtime

**Environment:**
- Node.js v24.14.0 (detected in environment)
- Browser target: ES2020, DOM, DOM.Iterable (per `tsconfig.app.json`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- React 18.3.1 - UI framework, `src/main.tsx` entry point with `createRoot`
- React DOM 18.3.1 - DOM rendering

**Charting:**
- Recharts 3.8.1 - Data visualization for yield curve, credit spreads, inflation time series

**Icons:**
- Lucide React 0.344.0 - Icon library (excluded from Vite pre-bundling optimization)

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS, configured in `tailwind.config.js`
- PostCSS 8.4.35 - CSS processing with autoprefixer, configured in `postcss.config.js`
- Inter font (sans) and JetBrains Mono / Fira Code (mono) — declared in `tailwind.config.js`
- Dark mode via `class` strategy (`darkMode: 'class'` in `tailwind.config.js`)

**Build/Dev:**
- Vite 5.4.2 - Dev server and production bundler, configured in `vite.config.ts`
- `@vitejs/plugin-react` 4.3.1 - React Fast Refresh support

## Key Dependencies

**Critical:**
- `@massive.com/client-js` ^10.6.0 - REST client for Massive.com market data API (forex aggregates, treasury yields); aliased in `vite.config.ts` to resolve `node_modules/@massive.com/client-js/dist/main.js`
- `@supabase/supabase-js` ^2.57.4 - Listed as dependency but **not actively used** in any source file (no imports found in `src/`)

**Infrastructure:**
- Native `fetch` API - Used for all HTTP calls to Finnhub, FRED, and Twelve Data REST endpoints (no axios or similar)
- Native `WebSocket` API - Used in `src/services/twelveDataService.ts` for live price streaming

## Configuration

**TypeScript:**
- `tsconfig.json` - Project references config (references `tsconfig.app.json` and `tsconfig.node.json`)
- `tsconfig.app.json` - App source config: strict mode, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, bundler module resolution, `jsx: react-jsx`
- `tsconfig.node.json` - Node/config files config

**Build:**
- `vite.config.ts` - Vite config with React plugin, path alias for `@massive.com/client-js`, and `optimizeDeps` exclusion for `lucide-react`
- `postcss.config.js` - PostCSS with tailwindcss and autoprefixer plugins
- `tailwind.config.js` - Tailwind scanning `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`

**Linting:**
- `eslint.config.js` - ESLint flat config with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Key rules: react-hooks recommended, `react-refresh/only-export-components` warning

**Environment Variables:**
- `.env` file expected at project root (not present in repo)
- Required keys consumed via `import.meta.env`:
  - `VITE_FINNHUB_API_KEY` — used in `src/services/finnhubService.ts`
  - `VITE_FRED_API_KEY` — used in `src/services/fredService.ts`
  - `VITE_MASSIVE_API_KEY` — used in `src/services/massiveService.ts`
  - `VITE_TWELVEDATA_API_KEY` — used in `src/services/twelveDataService.ts`

## Dev Scripts

```bash
npm run dev        # Vite dev server
npm run build      # Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build
npm run typecheck  # tsc --noEmit on tsconfig.app.json
```

## Platform Requirements

**Development:**
- Node.js (v24.x detected), npm
- All four API keys set in `.env` (Finnhub, FRED, Massive, Twelve Data)

**Production:**
- Static SPA — output is `dist/` directory from `vite build`
- No server-side runtime required
- All API calls made directly from browser to third-party APIs (CORS must be permitted by each provider)

---

*Stack analysis: 2026-04-08*
