# Calculator App

React + Vite calculator hub for fabrication and pricing workflows. The app currently includes Terrace Planter, Pergola, and Timber Bench calculators behind a lightweight password gate.

## Stack

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- shadcn/ui primitives
- Static deployment to GitHub Pages

## App Structure

- `src/App.tsx`: calculator hub and route switching
- `src/LoginGate.tsx`: session-based password gate using `VITE_APP_PASSWORD_HASH`
- `src/calculators/terrace_planter/TerracePlanterCalculator.tsx`: planter UI, settings, and results
- `src/calculators/pergola/PergolaCalculator.tsx`: pergola configurator, pricing editor, and print/export flow
- `src/calculators/timber_bench/TimberBenchCalculator.tsx`: timber bench sizing and pricing estimator
- `src/lib/terrace_planter/planterSolver.ts`: planter sheet-layout and cost solver
- `src/lib/pergola/pergolaEngine.ts`: pergola sizing, counts, and pricing engine
- `src/data/pergola/*.json`: pergola source tables and parity fixtures

## Available Calculators

### Terrace Planter

- Calculates fabrication dimensions, sheet usage, material utilization, and pricing
- Supports inch/mm input
- Includes configurable cost thresholds, sheet inventory, cut-plan output, and print formatting
- Settings can be imported/exported as CSV
- Stores thresholds and result-color preferences in `localStorage`

### Pergola

- Calculates pergola type recommendations, beam sizes, purlin requirements, piece counts, thickness values, and pricing totals
- Supports editable source tables for tubing, connectors, end caps, angle, and flatbar pricing
- Includes CSV import/export for pergola settings
- Includes print-friendly results output
- Backed by extracted workbook data in `src/data/pergola`

### Timber Bench

- Estimates unit cost, total cost, final cost, and suggested sell price
- Supports inch/mm input, timber/finish options, quantity, backrest/armrest options, and editable labor items
- This module is currently lighter-weight than the planter and pergola tools and uses in-app pricing heuristics rather than external source tables

## Routes

The app uses a small client-side router and is deployed under the GitHub Pages base path `/calculator-app/`.

- `/calculator-app/calculators/`
- `/calculator-app/calculators/terrace-planter`
- `/calculator-app/calculators/pergola`
- `/calculator-app/calculators/timber-bench`

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure the password gate in `.env`:

```env
VITE_APP_PASSWORD_HASH=<sha256-lowercase-hex>
```

The login gate compares the entered password to this SHA-256 hash in the browser and stores the authenticated state in `sessionStorage` for the current tab/session.

3. Start the dev server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

5. Preview the production build locally:

```bash
npm run preview
```

## Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: type-check, build, and generate the GitHub Pages SPA fallback
- `npm run preview`: preview the production build
- `npm run lint`: run ESLint
- `npm run check:encoding`: run the encoding validation script
- `npm run test:pergola`: run pergola parity checks against fixture data
- `npm run test:quote-sync`: run quote conversion/sync checks
- `npm run deploy`: publish `dist/` with `gh-pages`

## Deployment Notes

- `vite.config.ts` sets `base: '/calculator-app/'` for GitHub Pages hosting
- `npm run build` also runs `scripts/create-gh-pages-fallback.mjs` so direct links work on Pages
- `homepage` in `package.json` points to `https://abidhauser.github.io/calculator-app`

## Pergola Data and Parity

The pergola calculator depends on workbook-derived JSON tables in `src/data/pergola`:

- `Pricing.json`
- `Connectors.json`
- `EndCaps.json`
- `Angle.json`
- `Flatbar.json`
- `Settings.json`
- `defined-names.json`
- `key-cells.json`
- `quoting-cells.json`
- `parity-cases.json`

`scripts/pergola-parity-check.mjs` compares `calculatePergola()` output against the expected cases in `parity-cases.json`. If workbook values change, update the extracted JSON and parity fixtures together, then rerun:

```bash
npm run test:pergola
```

## CSV-Based Settings Workflows

- Terrace Planter settings can be imported/exported from the calculator settings tab
- Pergola settings and source tables can also be imported/exported from the settings tab
- CSV parsing helpers live in `src/lib/csv.ts`

## Notes for Maintainers

- Routing helpers live in `src/lib/routing.ts`
- Print styles are defined in `src/styles/globals.css`
- The app is currently front-end only; there is no backend or server-side auth
