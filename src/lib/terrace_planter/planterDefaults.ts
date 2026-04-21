import type { CostThreshold, PlanterInput } from '@/types'
import settingsRaw from '../../data/terrace_planter/Settings.json' with { type: 'json' }

export const CATEGORY_LIST = [
  'Weld',
  'Grind',
  'Paint',
  'Assembly',
  'Saw',
  'Laser Bend',
  'Weight Plate',
  'Liner',
  'Shelf',
] as const

export type Category = (typeof CATEGORY_LIST)[number]

export type ResultColorThresholds = {
  marginWarnMax: number
  marginGoodMin: number
  deltaNegativeMax: number
  deltaPositiveMin: number
  utilizationWarnMax: number
  utilizationGoodMin: number
  wasteGoodMax: number
  wasteWarnMax: number
}

export type SheetInventoryDefaultRow = {
  id: string
  name: string
  thickness: number
  width: number
  height: number
  costPerSqft: number
  quantity: number
  limitQuantity: boolean
}

type SettingsFile = {
  defaultPlanterInput?: Partial<Record<keyof PlanterInput, unknown>>
  defaultThresholds?: Partial<Record<Category, Partial<Record<keyof CostThreshold, unknown>>>>
  defaultResultColorThresholds?: Partial<Record<keyof ResultColorThresholds, unknown>>
  defaultSheetInventory?: Array<Partial<Record<keyof SheetInventoryDefaultRow, unknown>>>
}

const settings = (settingsRaw ?? {}) as SettingsFile

const toNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const toString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback

const defaultPlanterInputFallback: PlanterInput = {
  length: Number.NaN,
  width: Number.NaN,
  height: Number.NaN,
  marginPct: 50,
  thickness: 0.125,
  lip: 2.125,
  linerEnabled: false,
  linerDepth: 1,
  linerThickness: 0.125,
  weightPlateEnabled: false,
  floorEnabled: true,
  shelfEnabled: false,
  allowSplitting: false,
}

const planterInputRaw = settings.defaultPlanterInput ?? {}

export const DEFAULT_PLANTER_INPUT: PlanterInput = {
  length: toNumber(planterInputRaw.length, defaultPlanterInputFallback.length),
  width: toNumber(planterInputRaw.width, defaultPlanterInputFallback.width),
  height: toNumber(planterInputRaw.height, defaultPlanterInputFallback.height),
  marginPct: toNumber(planterInputRaw.marginPct, defaultPlanterInputFallback.marginPct),
  thickness: toNumber(planterInputRaw.thickness, defaultPlanterInputFallback.thickness),
  lip: toNumber(planterInputRaw.lip, defaultPlanterInputFallback.lip),
  linerEnabled: toBoolean(planterInputRaw.linerEnabled, defaultPlanterInputFallback.linerEnabled),
  linerDepth: toNumber(planterInputRaw.linerDepth, defaultPlanterInputFallback.linerDepth),
  linerThickness: toNumber(planterInputRaw.linerThickness, defaultPlanterInputFallback.linerThickness),
  weightPlateEnabled: toBoolean(
    planterInputRaw.weightPlateEnabled,
    defaultPlanterInputFallback.weightPlateEnabled,
  ),
  floorEnabled: toBoolean(planterInputRaw.floorEnabled, defaultPlanterInputFallback.floorEnabled),
  shelfEnabled: toBoolean(planterInputRaw.shelfEnabled, defaultPlanterInputFallback.shelfEnabled),
  allowSplitting: toBoolean(planterInputRaw.allowSplitting, defaultPlanterInputFallback.allowSplitting),
}

const thresholdFallbacks: Record<Category, CostThreshold> = {
  Weld: {
    category: 'Weld',
    lowThreshold: 10000,
    lowPrice: 125,
    mediumThreshold: 28000,
    mediumPrice: 165,
    highPrice: 210,
  },
  Grind: {
    category: 'Grind',
    lowThreshold: 8000,
    lowPrice: 85,
    mediumThreshold: 22000,
    mediumPrice: 115,
    highPrice: 145,
  },
  Paint: {
    category: 'Paint',
    lowThreshold: 6000,
    lowPrice: 75,
    mediumThreshold: 20000,
    mediumPrice: 100,
    highPrice: 135,
  },
  Assembly: {
    category: 'Assembly',
    lowThreshold: 5000,
    lowPrice: 140,
    mediumThreshold: 22000,
    mediumPrice: 180,
    highPrice: 215,
  },
  Saw: {
    category: 'Saw',
    lowThreshold: 7000,
    lowPrice: 60,
    mediumThreshold: 24000,
    mediumPrice: 85,
    highPrice: 110,
  },
  'Laser Bend': {
    category: 'Laser Bend',
    lowThreshold: 9000,
    lowPrice: 110,
    mediumThreshold: 26000,
    mediumPrice: 150,
    highPrice: 195,
  },
  'Weight Plate': {
    category: 'Weight Plate',
    lowThreshold: 3000,
    lowPrice: 40,
    mediumThreshold: 15000,
    mediumPrice: 60,
    highPrice: 95,
  },
  Liner: {
    category: 'Liner',
    lowThreshold: 5000,
    lowPrice: 95,
    mediumThreshold: 15000,
    mediumPrice: 140,
    highPrice: 180,
  },
  Shelf: {
    category: 'Shelf',
    lowThreshold: 5000,
    lowPrice: 120,
    mediumThreshold: 15000,
    mediumPrice: 160,
    highPrice: 200,
  },
}

const thresholdsRaw = settings.defaultThresholds ?? {}

export const DEFAULT_THRESHOLDS: Record<Category, CostThreshold> = CATEGORY_LIST.reduce<
  Record<Category, CostThreshold>
>((acc, category) => {
  const fallback = thresholdFallbacks[category]
  const row = thresholdsRaw[category] ?? {}
  acc[category] = {
    category,
    lowThreshold: toNumber(row.lowThreshold, fallback.lowThreshold),
    lowPrice: toNumber(row.lowPrice, fallback.lowPrice),
    mediumThreshold: toNumber(row.mediumThreshold, fallback.mediumThreshold),
    mediumPrice: toNumber(row.mediumPrice, fallback.mediumPrice),
    highPrice: toNumber(row.highPrice, fallback.highPrice),
  }
  return acc
}, {} as Record<Category, CostThreshold>)

const resultColorFallbacks: ResultColorThresholds = {
  marginWarnMax: 20,
  marginGoodMin: 35,
  deltaNegativeMax: -25,
  deltaPositiveMin: 25,
  utilizationWarnMax: 60,
  utilizationGoodMin: 80,
  wasteGoodMax: 20,
  wasteWarnMax: 40,
}

const resultColorRaw = settings.defaultResultColorThresholds ?? {}

export const DEFAULT_RESULT_COLOR_THRESHOLDS: ResultColorThresholds = {
  marginWarnMax: toNumber(resultColorRaw.marginWarnMax, resultColorFallbacks.marginWarnMax),
  marginGoodMin: toNumber(resultColorRaw.marginGoodMin, resultColorFallbacks.marginGoodMin),
  deltaNegativeMax: toNumber(resultColorRaw.deltaNegativeMax, resultColorFallbacks.deltaNegativeMax),
  deltaPositiveMin: toNumber(resultColorRaw.deltaPositiveMin, resultColorFallbacks.deltaPositiveMin),
  utilizationWarnMax: toNumber(resultColorRaw.utilizationWarnMax, resultColorFallbacks.utilizationWarnMax),
  utilizationGoodMin: toNumber(resultColorRaw.utilizationGoodMin, resultColorFallbacks.utilizationGoodMin),
  wasteGoodMax: toNumber(resultColorRaw.wasteGoodMax, resultColorFallbacks.wasteGoodMax),
  wasteWarnMax: toNumber(resultColorRaw.wasteWarnMax, resultColorFallbacks.wasteWarnMax),
}

const sheetInventoryFallback: SheetInventoryDefaultRow[] = [
  {
    id: 'sheet-4x8-4-976',
    name: '4 x 8',
    thickness: 0.125,
    width: 48,
    height: 96,
    costPerSqft: 4.976,
    quantity: Number.NaN,
    limitQuantity: false,
  },
  {
    id: 'sheet-5x10-5-06',
    name: '5 x 10',
    thickness: 0.125,
    width: 60,
    height: 120,
    costPerSqft: 5.06,
    quantity: Number.NaN,
    limitQuantity: false,
  },
  {
    id: 'sheet-4x10-5-06',
    name: '4 x 10',
    thickness: 0.125,
    width: 48,
    height: 120,
    costPerSqft: 5.06,
    quantity: Number.NaN,
    limitQuantity: false,
  },
]

const toSheetQuantity = (value: unknown, fallback: number): number => {
  if (value === null) return Number.NaN
  return toNumber(value, fallback)
}

const normalizeSheetRow = (
  row: Partial<Record<keyof SheetInventoryDefaultRow, unknown>>,
  fallback: SheetInventoryDefaultRow,
): SheetInventoryDefaultRow => ({
  id: toString(row.id, fallback.id),
  name: toString(row.name, fallback.name),
  thickness: toNumber(row.thickness, fallback.thickness),
  width: toNumber(row.width, fallback.width),
  height: toNumber(row.height, fallback.height),
  costPerSqft: toNumber(row.costPerSqft, fallback.costPerSqft),
  quantity: toSheetQuantity(row.quantity, fallback.quantity),
  limitQuantity: toBoolean(row.limitQuantity, fallback.limitQuantity),
})

const sheetInventoryRaw = settings.defaultSheetInventory

export const DEFAULT_SHEET_INVENTORY_SETTINGS: SheetInventoryDefaultRow[] =
  Array.isArray(sheetInventoryRaw) && sheetInventoryRaw.length > 0
    ? sheetInventoryRaw.map((row, index) => normalizeSheetRow(row, sheetInventoryFallback[index] ?? sheetInventoryFallback[0]))
    : sheetInventoryFallback.map((row) => ({ ...row }))
