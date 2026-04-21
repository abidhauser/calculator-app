# Calculator App Documentation

## 1) What this app is

This is a front-end-only fabrication calculator platform built with React + TypeScript + Vite. It provides three production calculators inside one UI:

- Terrace Planter
- Pergola
- Timber Bench

The app is deployed as a static site and uses a lightweight password gate for controlled access.

Primary entry points:

- `src/main.tsx`
- `src/LoginGate.tsx`
- `src/App.tsx`

## 2) Why we need this app

This app centralizes sizing, fabrication logic, and pricing in one place so teams can:

- Reduce manual spreadsheet work and repetitive quoting steps.
- Standardize pricing logic across estimators.
- Keep editable defaults/settings in versioned source files.
- Generate clear, print-ready outputs for fabrication and review.

In short, it converts ad hoc estimating into repeatable, auditable workflows.

## 3) How it works (system overview)

### 3.1 App boot and access control

1. `src/main.tsx` mounts `<LoginGate><App /></LoginGate>`.
2. `src/LoginGate.tsx` validates entered password against `VITE_APP_PASSWORD_HASH` (SHA-256 in browser).
3. Auth state is stored in `sessionStorage` (`calculator_app_authenticated`) for the current session.

### 3.2 Routing model

- Routing is intentionally simple and client-side in `src/App.tsx`.
- Paths are normalized against GitHub Pages base path using:
  - `src/lib/routing.ts` (`APP_BASE_PATH`, `stripAppBasePath`, `withAppBasePath`).
- Supported routes:
  - `/calculators/`
  - `/calculators/terrace-planter`
  - `/calculators/pergola`
  - `/calculators/timber-bench`

### 3.3 Calculator architecture pattern

Each calculator follows a similar pattern:

- Input tab -> user configuration
- Results tab -> computed output + pricing summary
- Settings tab (where applicable) -> tunable defaults/source tables + CSV import/export

Shared helper modules:

- CSV parsing/serialization: `src/lib/csv.ts`
- Utility styling helper: `src/lib/utils.ts`

## 4) Major features

## 4.1 Terrace Planter

Core files:

- UI/controller: `src/calculators/terrace_planter/TerracePlanterCalculator.tsx`
- Solver: `src/lib/terrace_planter/planterSolver.ts`
- Defaults + settings schema normalization: `src/lib/terrace_planter/planterDefaults.ts`
- Developer-editable defaults JSON: `src/data/terrace_planter/Settings.json`
- Cut plan renderer: `src/calculators/terrace_planter/components/cut-plan-view.tsx`

Key capabilities:

- Unit switching (`in`/`mm`) while maintaining internal inch-based math.
- Configurable planter geometry and options (liner, floor, shelf, splitting behavior).
- Tiered fabrication pricing thresholds by category.
- Sheet inventory controls (dimensions, cost/sqft, quantity, enforce quantity).
- Greedy sheet nesting solver with candidate validation and fit checks.
- Material usage, utilization, waste, and cost summaries.
- Visual cut plan per sheet instance.
- CSV import/export for settings.
- Print mode for reporting.
- Local persistence for thresholds and result color thresholds (`localStorage`).

### Terrace Planter solver flow

The solver pipeline in `runPlanterSolver()` is:

1. Build fabrication dimensions (`buildFabricationDimensions`).
2. Build panel set (`buildPanels`) including optional floor/liner/shelf panels.
3. Build single and bundled candidates (`buildCandidates`), including L-cut bundle logic.
4. Validate placeability across available inventory (`candidateFitsAnySheet`).
5. Greedy placement across existing/new sheet instances (`placeCandidateOnSheets` + `findPlacementOnSheet`).
6. Aggregate outputs: placements, sheet usage, area, material cost, fabrication totals.

Important behavior:

- Throws explicit errors when inventory cannot fit required candidates.
- Uses quantity limits only when `limitQuantity` is enabled.
- Prefers lower-cost/less-waste sheet decisions based on sorted sheet rows and fit outcomes.

## 4.2 Pergola

Core files:

- UI/controller: `src/calculators/pergola/PergolaCalculator.tsx`
- Engine bridge: `src/lib/pergola/pergolaEngine.ts`
- Data loading/normalization: `src/lib/pergola/pergolaData.ts`
- Source JSON tables: `src/data/pergola/*.json`

Key capabilities:

- Dimensional and type configuration with roof/privacy controls.
- Piece counts, thickness selection, and pricing breakdown.
- Editable source tables (tubing/connectors/end caps/angle/flatbar).
- CSV import/export of settings and source table data.
- Print mode for outputs.
- Parity-calibrated behavior via `parity-cases.json` when an exact case matches.

Verification scripts:

- `scripts/pergola-parity-check.mjs`
- `scripts/quote-sync-check.mjs`

## 4.3 Timber Bench

Core file:

- `src/calculators/timber_bench/TimberBenchCalculator.tsx`

Key capabilities:

- Bench dimensions and options (timber, finish, configuration, backrest, armrest).
- Labor line-item editor with dynamic row management.
- Cost summary outputs (unit, total, final, suggested sell).
- Simpler heuristic model compared with Terrace Planter and Pergola.

## 5) Terrace Planter completion status

The Terrace Planter calculator is functionally complete for production quoting workflows in the current architecture.

Completed scope:

- End-to-end input -> calculation -> results pipeline.
- Robust validation and user-facing error messaging.
- Full sheet-inventory-driven nesting and cost computation.
- Optional panel features (liner/floor/shelf) and split behavior controls.
- Settings management (reset, import/export, persistence).
- Cut-plan visualization and print support.

Operational note:

- Terrace Planter currently does not have a dedicated parity-test script like Pergola. Validation exists at runtime and through code-level guardrails, but no standalone `npm run test:*` script specific to planter is present.

## 6) Key architectural decisions (and rationale)

1. Front-end-only deployment
- Decision: Keep logic in the browser and deploy static assets to GitHub Pages.
- Why: Minimal hosting complexity and fast iteration for internal tooling.
- Tradeoff: Auth is lightweight (session gate), not server-enforced security.

2. Lightweight custom routing instead of a routing framework
- Decision: Use a small pathname + `history.pushState` router in `App.tsx`.
- Why: Few routes, low complexity, direct control over base-path handling.
- Tradeoff: Fewer built-in features than full router libraries.

3. Data-driven defaults for Terrace Planter
- Decision: Put defaults in `src/data/terrace_planter/Settings.json` and normalize in `planterDefaults.ts`.
- Why: Non-invasive tuning without rewriting solver/controller logic.
- Tradeoff: Need strict normalization/fallback guards for malformed values.

4. Parity fixture strategy for Pergola
- Decision: Use workbook-derived data + parity cases to preserve expected historical behavior.
- Why: Protects quoting outcomes while modernizing code.
- Tradeoff: Requires fixture maintenance when business logic changes.

5. Local persistence for user-adjusted settings
- Decision: Store thresholds/display thresholds in browser `localStorage`.
- Why: Fast UX, no backend dependency.
- Tradeoff: Settings are per-browser and not shared across users.

## 7) Developer map: where to change what

### App shell and navigation

- Calculator hub/route map: `src/App.tsx`
- Base path helpers: `src/lib/routing.ts`
- Login gate/password handling: `src/LoginGate.tsx`

### Terrace Planter

- Main UI logic/events/tabs: `src/calculators/terrace_planter/TerracePlanterCalculator.tsx`
- Solver algorithm and placement functions: `src/lib/terrace_planter/planterSolver.ts`
- Developer defaults mapping + safety fallbacks: `src/lib/terrace_planter/planterDefaults.ts`
- Change default planter settings here: `src/data/terrace_planter/Settings.json`

If you need to change specific defaults:

- Default planter input values: `defaultPlanterInput` in `src/data/terrace_planter/Settings.json`
- Cost thresholds by category: `defaultThresholds` in `src/data/terrace_planter/Settings.json`
- Result color thresholds: `defaultResultColorThresholds` in `src/data/terrace_planter/Settings.json`
- Default sheet inventory rows: `defaultSheetInventory` in `src/data/terrace_planter/Settings.json`

Important: `src/lib/terrace_planter/planterDefaults.ts` contains code-level fallback constants that apply if JSON values are missing/invalid.

### Pergola

- Calculator UI + settings editor: `src/calculators/pergola/PergolaCalculator.tsx`
- Engine adapter + parity integration: `src/lib/pergola/pergolaEngine.ts`
- Source-table normalizers: `src/lib/pergola/pergolaData.ts`
- Workbook-derived source files: `src/data/pergola/*.json`
- Parity verification script: `scripts/pergola-parity-check.mjs`

### Timber Bench

- Entire calculator and cost model: `src/calculators/timber_bench/TimberBenchCalculator.tsx`

### Shared imports/exports/helpers

- CSV helpers used by calculator settings tabs: `src/lib/csv.ts`
- Global styles and print behavior classes: `src/styles/globals.css`

## 8) Build, test, and deploy

Commands (from `package.json`):

- `npm run dev` -> local development
- `npm run build` -> type-check + production build + GH Pages fallback generation
- `npm run lint` -> linting
- `npm run test:pergola` -> pergola parity verification
- `npm run test:quote-sync` -> quote conversion sanity checks
- `npm run deploy` -> publish `dist/` via `gh-pages`

Deployment-specific behavior:

- Vite base path and app pathing are configured for GitHub Pages.
- `scripts/create-gh-pages-fallback.mjs` ensures SPA deep-link fallback behavior.
