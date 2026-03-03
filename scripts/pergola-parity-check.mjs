import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { calculatePergola } from '../src/lib/pergola/pergolaEngine.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const parityPath = path.resolve(__dirname, '../src/data/pergola/parity-cases.json')
const raw = fs.readFileSync(parityPath, 'utf8').replace(/^\uFEFF/, '')
const cases = JSON.parse(raw)

const getActualForComparison = (actual) => ({
  suggestedType: actual.suggestedType,
  beamSize: actual.beamSize,
  roofSizeValidity: actual.roofSizeValidity,
  privacySizeValidity: actual.privacySizeValidity,
  roofPurlinsRequired: actual.roofPurlinsRequired,
  sidePurlinsLengthRequired: actual.sidePurlinsLengthRequired,
  sidePurlinsDepthRequired: actual.sidePurlinsDepthRequired,
  pieceCounts: actual.pieceCounts,
  thickness: actual.thickness,
  pricingRows: actual.pricingRows,
  totalCost: actual.totalCost,
  sell60: actual.sell60,
  sell50: actual.sell50,
})

const normalizeExpected = (expected) => ({
  suggestedType: expected.suggestedType,
  beamSize: expected.beamSize,
  roofSizeValidity: expected.roofSizeValidity,
  privacySizeValidity: expected.privacySizeValidity,
  roofPurlinsRequired: expected.roofPurlinsRequired,
  sidePurlinsLengthRequired: expected.sidePurlinsLengthRequired,
  sidePurlinsDepthRequired: expected.sidePurlinsDepthRequired,
  pieceCounts: expected.pieceCounts,
  thickness: expected.thickness,
  pricingRows: expected.pricingRows,
  totalCost: expected.totalCost,
  sell60: expected.sell60,
  sell50: expected.sell50,
})

const failures = []

for (const entry of cases) {
  const input = {
    dimensions: {
      lengthFt: entry.input.lengthFt,
      depthFt: entry.input.depthFt,
      heightFt: entry.input.heightFt,
    },
    type: entry.input.type,
    electrical: entry.input.electrical,
    roof: {
      material: entry.input.roofMaterial,
      orientation: entry.input.roofOrientation,
      size: entry.input.roofSize,
      customSize: entry.input.roofCustom,
      alignment: entry.input.roofAlignment,
      coveragePct: entry.input.roofCoverage,
      gapIn: entry.input.roofGap,
    },
    privacy: {
      material: entry.input.privacyMaterial,
      orientation: entry.input.privacyOrientation,
      size: entry.input.privacySize,
      customSize: entry.input.privacyCustom,
      alignment: entry.input.privacyAlignment,
      panelCountLength: entry.input.privacyPanelsLength,
      panelCountDepth: entry.input.privacyPanelsDepth,
      groundClearanceIn: entry.input.privacyGround,
      topClearanceIn: entry.input.privacyTop,
      coveragePct: entry.input.privacyCoverage,
      gapIn: entry.input.privacyGap,
    },
  }

  const actual = getActualForComparison(calculatePergola(input))
  const expected = normalizeExpected(entry.expected)

  try {
    assert.deepEqual(actual, expected)
  } catch (error) {
    failures.push({ id: entry.id, error })
  }
}

if (failures.length > 0) {
  console.error(`Pergola parity failed for ${failures.length} case(s).`)
  for (const failure of failures) {
    console.error(`- ${failure.id}: ${failure.error.message}`)
  }
  process.exit(1)
}

console.log(`Pergola parity passed (${cases.length} cases).`)

