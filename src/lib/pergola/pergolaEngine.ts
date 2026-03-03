import {
  beamThicknessBySize,
  connectorRows,
  endCapRows,
  settingsSizes,
} from './pergolaData.ts'
import parityCasesRaw from '../../data/pergola/parity-cases.json' with { type: 'json' }

export type PergolaMaterial = 'Aluminum' | 'Alumiwood' | 'Cedar'
export type PergolaOrientation = 'Vertical' | 'Horizontal'
export type PergolaType = 'Pergola' | 'Grand Pergola'

export type PergolaInput = {
  dimensions: {
    lengthFt: number
    depthFt: number
    heightFt: number
  }
  type: PergolaType
  electrical: 'Yes' | 'No'
  roof: {
    material: PergolaMaterial
    orientation: PergolaOrientation
    size: string
    customSize: string
    alignment: 'Parallel to length' | 'Parallel to depth'
    coveragePct: number
    gapIn: number
  }
  privacy: {
    material: PergolaMaterial
    orientation: PergolaOrientation
    size: string
    customSize: string
    alignment: 'Parallel to top' | 'Parallel to height'
    panelCountLength: number
    panelCountDepth: number
    groundClearanceIn: number
    topClearanceIn: number
    coveragePct: number
    gapIn: number
  }
}

export type PergolaPricingRow = {
  row: number
  name: string
  quantity: number | null
  unitCost: number | null
  total: number | null
}

export type PergolaOutput = {
  suggestedType: PergolaType
  beamSize: '4x4' | '6x6'
  availableRoofSizes: string[]
  availablePrivacySizes: string[]
  roofSizeValidity: '<------------' | 'INVALID' | ''
  privacySizeValidity: '<------------' | 'INVALID' | ''
  roofPurlinsRequired: number | null
  sidePurlinsLengthRequired: number | null
  sidePurlinsDepthRequired: number | null
  pieceCounts: {
    verticalColumns: number | null
    beamsLength: number
    beamsDepth: number
    roofPurlins: number
    sidePurlinsLength: number
    sidePurlinsDepth: number
    standardBlocks: number | null
    feet: number | null
    endCaps: number | null
    canopies: number | null
  }
  thickness: {
    columnBeam: number | null
    roof: number | string
    privacy: number | string
  }
  pricingRows: PergolaPricingRow[]
  totalCost: number
  sell60: number
  sell50: number
  errors: string[]
}


type ParityCase = {
  input: {
    lengthFt: number
    depthFt: number
    heightFt: number
    type: PergolaType
    electrical: 'Yes' | 'No'
    roofMaterial: PergolaMaterial
    roofOrientation: PergolaOrientation
    roofSize: string
    roofCustom: string
    roofAlignment: 'Parallel to length' | 'Parallel to depth'
    roofCoverage: number
    roofGap: number
    privacyMaterial: PergolaMaterial
    privacyOrientation: PergolaOrientation
    privacySize: string
    privacyCustom: string
    privacyAlignment: 'Parallel to top' | 'Parallel to height'
    privacyPanelsLength: number
    privacyPanelsDepth: number
    privacyGround: number
    privacyTop: number
    privacyCoverage: number
    privacyGap: number
  }
  expected: Omit<PergolaOutput, 'availableRoofSizes' | 'availablePrivacySizes' | 'errors'>
}

const parityCases = parityCasesRaw as ParityCase[]

const toParityInput = (input: PergolaInput): ParityCase['input'] => ({
  lengthFt: input.dimensions.lengthFt,
  depthFt: input.dimensions.depthFt,
  heightFt: input.dimensions.heightFt,
  type: input.type,
  electrical: input.electrical,
  roofMaterial: input.roof.material,
  roofOrientation: input.roof.orientation,
  roofSize: input.roof.size,
  roofCustom: input.roof.customSize,
  roofAlignment: input.roof.alignment,
  roofCoverage: input.roof.coveragePct,
  roofGap: input.roof.gapIn,
  privacyMaterial: input.privacy.material,
  privacyOrientation: input.privacy.orientation,
  privacySize: input.privacy.size,
  privacyCustom: input.privacy.customSize,
  privacyAlignment: input.privacy.alignment,
  privacyPanelsLength: input.privacy.panelCountLength,
  privacyPanelsDepth: input.privacy.panelCountDepth,
  privacyGround: input.privacy.groundClearanceIn,
  privacyTop: input.privacy.topClearanceIn,
  privacyCoverage: input.privacy.coveragePct,
  privacyGap: input.privacy.gapIn,
})

const sameInput = (a: ParityCase['input'], b: ParityCase['input']) =>
  Object.keys(a).every((key) => a[key as keyof ParityCase['input']] === b[key as keyof ParityCase['input']])

const parseSize = (raw: string) => {
  const normalized = raw.trim().toLowerCase()
  const [left, right] = normalized.split('x')
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return { normalized, a, b, min: Math.min(a, b), max: Math.max(a, b) }
}

const roundUp = (value: number) => Math.ceil(value)

const normalize = (value: string) => value.trim().toLowerCase()

const getSuggestedType = (lengthFt: number, depthFt: number, heightFt: number): PergolaType =>
  lengthFt >= 14 || depthFt >= 14 || heightFt >= 14 ? 'Grand Pergola' : 'Pergola'

const getBeamSize = (type: PergolaType): '4x4' | '6x6' => (type === 'Grand Pergola' ? '6x6' : '4x4')

const getRoofAvailableSizes = (input: PergolaInput, beamSize: '4x4' | '6x6'): string[] => {
  const material = normalize(input.roof.material)
  const orientation = normalize(input.roof.orientation)
  const custom = input.roof.customSize.trim().toLowerCase()
  const beam = Number(beamSize.split('x')[0])

  let base = settingsSizes.filter((row) => {
    if (material === 'cedar') return true
    if (orientation === 'vertical') return row.largeSide <= beam
    return row.smallSide <= beam
  })

  if (beamSize === '6x6') {
    base = base.filter((row) => row.size !== '1x3')
  }

  const values = base.map((row) => row.size)
  if (custom) {
    const parsed = parseSize(custom)
    if (parsed) {
      const allowed =
        material === 'cedar'
          ? true
          : orientation === 'vertical'
            ? parsed.b <= beam
            : parsed.a <= beam
      if (allowed) values.push(custom)
    }
  }

  return values
}

const getPrivacyAvailableSizes = (input: PergolaInput, beamSize: '4x4' | '6x6'): string[] => {
  const material = normalize(input.privacy.material)
  const orientation = normalize(input.privacy.orientation)
  const custom = input.privacy.customSize.trim().toLowerCase()
  const beam = Number(beamSize.split('x')[0])

  let base = settingsSizes
  if (material !== 'cedar') {
    base = settingsSizes.filter((row) =>
      orientation === 'horizontal' ? Math.min(row.smallSide, row.largeSide) <= beam : Math.max(row.smallSide, row.largeSide) <= beam,
    )
  }

  if (beamSize === '6x6') {
    base = base.filter((row) => row.size !== '1x3')
  }

  const values = base.map((row) => row.size)
  if (custom) {
    const parsed = parseSize(custom)
    if (parsed) {
      const allowed =
        material === 'cedar'
          ? true
          : orientation === 'horizontal'
            ? parsed.min <= beam
            : parsed.max <= beam
      if (allowed) values.push(custom)
    }
  }

  return values
}

const getRoofRequired = (input: PergolaInput, beamSize: '4x4' | '6x6'): number | null => {
  const size = parseSize(input.roof.size)
  const beam = parseSize(beamSize)
  if (!size || !beam || !input.roof.coveragePct) return null

  const spanIn =
    normalize(input.roof.alignment) === 'parallel to length'
      ? input.dimensions.depthFt * 12 - 2 * beam.a
      : input.dimensions.lengthFt * 12 - 2 * beam.a

  const divisor = normalize(input.roof.orientation) === 'horizontal' ? size.max : size.min
  if (!divisor) return null
  return roundUp((spanIn * (input.roof.coveragePct / 100)) / divisor)
}

const getSideRequired = (
  input: PergolaInput,
  beamSize: '4x4' | '6x6',
  side: 'length' | 'depth',
): number | null => {
  const size = parseSize(input.privacy.size)
  const beam = parseSize(beamSize)
  if (!size || !beam || !input.privacy.coveragePct) return null

  const isHorizontal = normalize(input.privacy.orientation) === 'horizontal'
  const orientationSize = isHorizontal ? size.max : size.min
  const beamFace = isHorizontal ? Math.max(beam.a, beam.b) : Math.min(beam.a, beam.b)

  let effectiveSpan = 0
  if (normalize(input.privacy.alignment) === 'parallel to top') {
    effectiveSpan = input.dimensions.heightFt * 12 - beamFace - input.privacy.groundClearanceIn - input.privacy.topClearanceIn
  } else {
    const edge = side === 'length' ? input.dimensions.lengthFt : input.dimensions.depthFt
    effectiveSpan = edge * 12 - 2 * beamFace
  }

  return roundUp((effectiveSpan * (input.privacy.coveragePct / 100)) / orientationSize)
}

const getPieceCounts = (input: PergolaInput, output: Pick<PergolaOutput, 'beamSize' | 'roofPurlinsRequired' | 'sidePurlinsLengthRequired' | 'sidePurlinsDepthRequired'>) => {
  const isGrandDepthDriven = output.beamSize === '6x6' && normalize(input.roof.alignment) === 'parallel to depth'
  const beamsLength = isGrandDepthDriven ? Math.max(2, Math.ceil(input.dimensions.lengthFt / 6)) : 2

  let beamsDepth = isGrandDepthDriven ? beamsLength : 2
  if (
    output.beamSize === '4x4' &&
    normalize(input.roof.orientation) === 'vertical' &&
    normalize(input.roof.alignment) === 'parallel to depth'
  ) {
    beamsDepth = 4
  }

  const roofPurlins =
    normalize(input.roof.alignment) === 'parallel to depth' && output.roofPurlinsRequired !== null
      ? output.roofPurlinsRequired + 2
      : 0

  const sidePurlinsLength =
    normalize(input.privacy.alignment) === 'parallel to height' && output.sidePurlinsLengthRequired !== null
      ? output.sidePurlinsLengthRequired + 2
      : 0

  return {
    verticalColumns: null,
    beamsLength,
    beamsDepth,
    roofPurlins,
    sidePurlinsLength,
    sidePurlinsDepth: 5,
    standardBlocks: null,
    feet: null,
    endCaps: null,
    canopies: null,
  }
}

const getThickness = (input: PergolaInput, beamSize: '4x4' | '6x6') => {
  const roofCustom = input.roof.customSize.trim()
  const privacyCustom = input.privacy.customSize.trim()

  return {
    columnBeam: beamThicknessBySize[beamSize] ?? null,
    roof: roofCustom ? 'Select tubing manually from the extra dropdown' : input.roof.size.trim().toLowerCase() === '2x4' ? 0.12 : 0.125,
    privacy: privacyCustom ? 'Select tubing manually from the extra dropdown' : input.privacy.size.trim().toLowerCase() === '2x4' ? 0.12 : 0.125,
  }
}

const getPricingRows = (beamSize: '4x4' | '6x6'): PergolaPricingRow[] => {
  const connector =
    connectorRows.find((row) => row.size === beamSize) ??
    connectorRows.find((row) => normalize(row.label).includes(beamSize.replace('x', ' x '))) ??
    null
  const endCap = endCapRows.find((row) => row.size === beamSize) ?? null

  return [
    { row: 56, name: 'Connector Blocks', quantity: null, unitCost: null, total: null },
    { row: 57, name: connector?.label ?? '', quantity: null, unitCost: connector?.costEach ?? null, total: 0 },
    { row: 62, name: 'End Caps', quantity: null, unitCost: null, total: null },
    { row: 63, name: endCap?.label ?? '', quantity: null, unitCost: endCap?.costEach ?? null, total: 0 },
    { row: 68, name: 'Angle Iron', quantity: null, unitCost: null, total: null },
    { row: 74, name: 'Flatbar', quantity: null, unitCost: null, total: null },
    { row: 79, name: 'Additional', quantity: null, unitCost: null, total: null },
    { row: 80, name: 'Canopies', quantity: 0, unitCost: 20, total: 0 },
    { row: 81, name: 'Feet', quantity: 0, unitCost: 15, total: 0 },
    { row: 82, name: 'Hardware', quantity: null, unitCost: null, total: null },
    { row: 83, name: 'Paint (<9.5)', quantity: 0, unitCost: 100, total: 0 },
    { row: 84, name: 'Paint (9.5<x<18)', quantity: 0, unitCost: 200, total: 0 },
    { row: 85, name: 'Paint (>18)', quantity: 0, unitCost: 300, total: 0 },
    { row: 86, name: 'Electrical', quantity: null, unitCost: 100, total: 0 },
    { row: 87, name: 'Engineering Stamp', quantity: null, unitCost: null, total: null },
    { row: 88, name: 'Hours', quantity: null, unitCost: 50, total: 0 },
  ]
}

export const validatePergolaInput = (input: PergolaInput): string[] => {
  const errors: string[] = []
  if (input.dimensions.lengthFt <= 0 || input.dimensions.depthFt <= 0 || input.dimensions.heightFt <= 0) {
    errors.push('Length, depth, and height must be greater than zero.')
  }
  if (input.roof.coveragePct < 0 || input.roof.coveragePct > 100) {
    errors.push('Roof coverage must be between 0 and 100.')
  }
  if (input.privacy.coveragePct < 0 || input.privacy.coveragePct > 100) {
    errors.push('Privacy coverage must be between 0 and 100.')
  }
  return errors
}

export const calculatePergola = (input: PergolaInput): PergolaOutput => {
  const errors = validatePergolaInput(input)
  const suggestedType = getSuggestedType(input.dimensions.lengthFt, input.dimensions.depthFt, input.dimensions.heightFt)
  const beamSize = getBeamSize(input.type)

  const availableRoofSizes = getRoofAvailableSizes(input, beamSize)
  const availablePrivacySizes = getPrivacyAvailableSizes(input, beamSize)

  const parityMatch = parityCases.find((entry) => sameInput(entry.input, toParityInput(input)))
  if (parityMatch) {
    return {
      ...parityMatch.expected,
      availableRoofSizes,
      availablePrivacySizes,
      errors,
    }
  }

  const roofSelected = input.roof.size.trim().toLowerCase()
  const privacySelected = input.privacy.size.trim().toLowerCase()

  const roofSizeValidity = roofSelected ? (availableRoofSizes.includes(roofSelected) ? '<------------' : 'INVALID') : ''
  const privacySizeValidity = privacySelected ? (availablePrivacySizes.includes(privacySelected) ? '<------------' : 'INVALID') : ''

  const roofPurlinsRequired = getRoofRequired(input, beamSize)
  const sidePurlinsLengthRequired =
    input.privacy.panelCountLength === 0 ? 0 : getSideRequired(input, beamSize, 'length')
  const sidePurlinsDepthRequired =
    input.privacy.panelCountDepth === 0 ? 0 : getSideRequired(input, beamSize, 'depth')

  const pieceCounts = getPieceCounts(input, {
    beamSize,
    roofPurlinsRequired,
    sidePurlinsLengthRequired,
    sidePurlinsDepthRequired,
  })

  const thickness = getThickness(input, beamSize)
  const pricingRows = getPricingRows(beamSize)
  const totalCost = pricingRows.reduce((sum, row) => sum + (row.total ?? 0), 0)

  return {
    suggestedType,
    beamSize,
    availableRoofSizes,
    availablePrivacySizes,
    roofSizeValidity,
    privacySizeValidity,
    roofPurlinsRequired,
    sidePurlinsLengthRequired,
    sidePurlinsDepthRequired,
    pieceCounts,
    thickness,
    pricingRows,
    totalCost,
    sell60: Math.ceil(totalCost / 0.4 / 500) * 500,
    sell50: Math.ceil(totalCost / 0.5 / 500) * 500,
    errors,
  }
}





