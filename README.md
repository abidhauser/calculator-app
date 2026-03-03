# Calculator App

## Run
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Pergola parity test: `npm run test:pergola`

## Pergola Module
- UI: `src/calculators/PergolaCalculator.tsx`
- Engine: `src/lib/pergola/pergolaEngine.ts`
- Workbook data tables: `src/data/pergola/*.json`
- Router integration: `src/App.tsx`

## Input Schema
`PergolaInput` in [`src/lib/pergola/pergolaEngine.ts`](src/lib/pergola/pergolaEngine.ts) includes:
- `dimensions.lengthFt/depthFt/heightFt`
- `type`, `electrical`
- `roof`: material, orientation, size/custom size, alignment, coverage, gap
- `privacy`: material, orientation, size/custom size, alignment, panel counts, clearances, coverage, gap

## Output Schema
`PergolaOutput` returns:
- Suggested type, beam size
- Roof/privacy available sizes and `INVALID`/valid markers
- Roof and privacy purlin requirements
- Piece breakdown counts
- Thickness values
- Pricing rows + totals (`totalCost`, `sell60`, `sell50`)
- Validation errors

## Extracted Workbook Tables
Loaded from:
- `Pricing.json` (tubing)
- `Connectors.json`
- `EndCaps.json`
- `Angle.json`
- `Flatbar.json`
- `Settings.json`
- `parity-cases.json` (10 Excel-generated expected cases)

## Add or Update Price Rows / Parts
1. Edit the corresponding JSON in `src/data/pergola`.
2. Keep row structure consistent with workbook sheet columns.
3. Re-run `npm run test:pergola`.

## Parity Workflow
- `src/data/pergola/parity-cases.json` stores 10 workbook-generated expected outputs.
- `scripts/pergola-parity-check.mjs` executes engine outputs against those expected values.
- If workbook values change, regenerate fixture values from Excel and update `parity-cases.json` before re-running parity.
