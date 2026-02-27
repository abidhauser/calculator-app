import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import CutPlanView from '@/components/cut-plan-view'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CostBreakdownPreview, CostThreshold, PlanterInput } from '../types'
import {
  DEFAULT_SHEET_INVENTORY,
  buildFabricationDimensions,
  runPlanterSolver,
  type SheetInventoryRow,
  type SolverResult,
} from '../lib/planterSolver'

type Category =
  | 'Weld'
  | 'Grind'
  | 'Paint'
  | 'Assembly'
  | 'Saw'
  | 'Laser Bend'
  | 'Weight Plate'
  | 'Liner'
  | 'Shelf'

type SheetSummaryRow = {
  rowId: string
  name: string
  quantityUsed: number
  costPerSqft: number
  totalAreaAvailable: number
  totalAreaUsed: number
  costPerSheet: number
  utilizationPct: number
  unusedMaterialCost: number
  totalMaterialCost: number
}

type ResultsCategory =
  | 'Material'
  | 'Weld'
  | 'Grind'
  | 'Paint'
  | 'Assembly'
  | 'Saw'
  | 'Laser Bend'
  | 'Weight Plate'
  | 'Liner'
  | 'Shelf'

type ResultsSectionKey = 'planterDetails' | 'costBreakdown' | 'sheetBreakdown' | 'cutPlan'

type ResultColorThresholds = {
  marginWarnMax: number
  marginGoodMin: number
  deltaNegativeMax: number
  deltaPositiveMin: number
  utilizationWarnMax: number
  utilizationGoodMin: number
  wasteGoodMax: number
  wasteWarnMax: number
}

const RESULTS_CATEGORY_ORDER: ResultsCategory[] = [
  'Material',
  'Weld',
  'Grind',
  'Paint',
  'Assembly',
  'Saw',
  'Laser Bend',
  'Weight Plate',
  'Liner',
  'Shelf',
]

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const formatCurrencyValue = (value: number) =>
  CURRENCY_FORMATTER.format(Number.isFinite(value) ? value : 0)

const formatPercentValue = (value: number) =>
  `${PERCENT_FORMATTER.format(Number.isFinite(value) ? value : 0)}%`

const thicknessOptions = [
  { label: '1/8" (0.125")', value: 0.125 },
  { label: '3/16" (0.1875")', value: 0.1875 },
]

const defaultPlanterInput: PlanterInput = {
  length: 36,
  width: 24,
  height: 24,
  marginPct: 50,
  thickness: 0.125,
  lip: 2.125,
  linerEnabled: false,
  linerDepth: 1,
  linerThickness: 0.125,
  weightPlateEnabled: false,
  floorEnabled: true,
  shelfEnabled: false,
}

const defaultThresholds: Record<Category, CostThreshold> = {
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

const categoryList: Category[] = [
  'Weld',
  'Grind',
  'Paint',
  'Assembly',
  'Saw',
  'Laser Bend',
  'Weight Plate',
  'Liner',
  'Shelf',
]

const generateSheetId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sheet-${crypto.randomUUID()}`
  }
  return `sheet-${Math.random().toString(36).slice(2, 8)}`
}

const createSheetRow = (overrides?: Partial<SheetInventoryRow>): SheetInventoryRow => ({
  id: overrides?.id ?? generateSheetId(),
  name: overrides?.name ?? 'Custom sheet',
  width: overrides?.width ?? 48,
  height: overrides?.height ?? 96,
  costPerSqft: overrides?.costPerSqft ?? 5,
  quantity: overrides?.quantity ?? 1,
  limitQuantity: overrides?.limitQuantity ?? true,
})

const LOCAL_STORAGE_KEY = 'planterCostThresholds-v1'
const RESULT_COLOR_STORAGE_KEY = 'planterResultColorThresholds-v1'

const DEFAULT_RESULTS_SECTION_STATE: Record<ResultsSectionKey, boolean> = {
  planterDetails: false,
  costBreakdown: false,
  sheetBreakdown: false,
  cutPlan: false,
}

const DEFAULT_RESULT_COLOR_THRESHOLDS: ResultColorThresholds = {
  marginWarnMax: 20,
  marginGoodMin: 35,
  deltaNegativeMax: -25,
  deltaPositiveMin: 25,
  utilizationWarnMax: 60,
  utilizationGoodMin: 80,
  wasteGoodMax: 20,
  wasteWarnMax: 40,
}

const RESULT_SECTION_ID_MAP: Record<string, ResultsSectionKey> = {
  'results-planter-details': 'planterDetails',
  'results-cost-breakdown': 'costBreakdown',
  'results-sheet-breakdown': 'sheetBreakdown',
  'results-cut-plan': 'cutPlan',
}

const normalizeResultColorThresholds = (
  source?: Partial<ResultColorThresholds>,
): ResultColorThresholds => ({
  marginWarnMax: Number.isFinite(source?.marginWarnMax)
    ? (source?.marginWarnMax as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.marginWarnMax,
  marginGoodMin: Number.isFinite(source?.marginGoodMin)
    ? (source?.marginGoodMin as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.marginGoodMin,
  deltaNegativeMax: Number.isFinite(source?.deltaNegativeMax)
    ? (source?.deltaNegativeMax as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.deltaNegativeMax,
  deltaPositiveMin: Number.isFinite(source?.deltaPositiveMin)
    ? (source?.deltaPositiveMin as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.deltaPositiveMin,
  utilizationWarnMax: Number.isFinite(source?.utilizationWarnMax)
    ? (source?.utilizationWarnMax as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.utilizationWarnMax,
  utilizationGoodMin: Number.isFinite(source?.utilizationGoodMin)
    ? (source?.utilizationGoodMin as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.utilizationGoodMin,
  wasteGoodMax: Number.isFinite(source?.wasteGoodMax)
    ? (source?.wasteGoodMax as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.wasteGoodMax,
  wasteWarnMax: Number.isFinite(source?.wasteWarnMax)
    ? (source?.wasteWarnMax as number)
    : DEFAULT_RESULT_COLOR_THRESHOLDS.wasteWarnMax,
})

const cloneThresholds = (source?: Partial<Record<Category, CostThreshold>>) =>
  categoryList.reduce<Record<Category, CostThreshold>>((acc, category) => {
    const template = source?.[category] ?? defaultThresholds[category]
    acc[category] = { ...template, category }
    return acc
  }, {} as Record<Category, CostThreshold>)

const determineTier = (volume: number, threshold: CostThreshold) => {
  if (volume <= threshold.lowThreshold) {
    return { tier: 'Low' as const, price: threshold.lowPrice }
  }
  if (volume <= threshold.mediumThreshold) {
    return { tier: 'Medium' as const, price: threshold.mediumPrice }
  }
  return { tier: 'High' as const, price: threshold.highPrice }
}

const validatePlanterInput = (input: PlanterInput) => {
  if (!Number.isFinite(input.length)) return 'Length must be a valid number.'
  if (input.length <= 0) return 'Length must be greater than zero.'
  if (!Number.isFinite(input.width)) return 'Width must be a valid number.'
  if (input.width <= 0) return 'Width must be greater than zero.'
  if (!Number.isFinite(input.height)) return 'Height must be a valid number.'
  if (input.height <= 0) return 'Height must be greater than zero.'
  if (!Number.isFinite(input.lip)) return 'Lip must be a valid number.'
  if (input.lip < 0) return 'Lip must be zero or greater.'
  if (!Number.isFinite(input.marginPct)) return 'Margin % must be a valid number.'
  if (input.marginPct < 0) return 'Margin % must be zero or greater.'
  if (!Number.isFinite(input.thickness)) return 'Thickness must be a valid number.'
  if (input.thickness <= 0) return 'Thickness must be greater than zero.'
  if (input.linerEnabled && !Number.isFinite(input.linerDepth)) return 'Liner depth must be a valid number.'
  if (input.linerEnabled && input.linerDepth < 0) return 'Liner depth must be zero or greater.'
  if (input.linerEnabled && !Number.isFinite(input.linerThickness))
    return 'Liner thickness must be a valid number.'
  if (input.linerEnabled && input.linerThickness <= 0) return 'Liner thickness must be greater than zero.'
  return null
}

type NumericPlanterField = Exclude<
  keyof PlanterInput,
  'linerEnabled' | 'weightPlateEnabled' | 'shelfEnabled'
>
type BooleanPlanterField = 'linerEnabled' | 'weightPlateEnabled' | 'shelfEnabled' | 'floorEnabled'
type ThresholdField = 'lowThreshold' | 'lowPrice' | 'mediumThreshold' | 'mediumPrice' | 'highPrice'
type MeasurementUnit = 'in' | 'mm'

const INCH_TO_MM = 25.4
const DIMENSION_INPUT_FIELDS: NumericPlanterField[] = ['length', 'width', 'height', 'lip', 'linerDepth']

const isDimensionInputField = (field: NumericPlanterField) => DIMENSION_INPUT_FIELDS.includes(field)

const inchesToDisplay = (value: number, unit: MeasurementUnit) => (unit === 'mm' ? value * INCH_TO_MM : value)
const displayToInches = (value: number, unit: MeasurementUnit) => (unit === 'mm' ? value / INCH_TO_MM : value)

const parseNumberInput = (rawValue: string) => {
  if (rawValue.trim() === '') return Number.NaN
  return Number(rawValue)
}

const displayNumberInput = (value: number) => (Number.isFinite(value) ? value : '')
const getBreakdownPrice = (row: CostBreakdownPreview) => row.overridePrice ?? row.basePrice

const escapeCsvCell = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const serializeCsv = (rows: string[][]) =>
  rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n')

const parseCsv = (source: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let index = 0
  let inQuotes = false

  while (index < source.length) {
    const char = source[index]

    if (inQuotes) {
      if (char === '"') {
        const next = source[index + 1]
        if (next === '"') {
          cell += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      cell += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      index += 1
      continue
    }
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      index += 1
      continue
    }
    if (char === '\r') {
      index += 1
      continue
    }

    cell += char
    index += 1
  }

  if (inQuotes) {
    return { rows: [], error: 'CSV contains an unmatched quote.' }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return { rows, error: null as string | null }
}

const parseBooleanCell = (rawValue: string) => {
  const value = rawValue.trim().toLowerCase()
  if (value === 'true' || value === '1' || value === 'yes') return true
  if (value === 'false' || value === '0' || value === 'no') return false
  return null
}

const parseNumberCell = (rawValue: string) => {
  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}

function App() {
  const [planterInput, setPlanterInput] = useState<PlanterInput>(() => ({ ...defaultPlanterInput }))
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('in')
  const [thresholds, setThresholds] = useState<Record<Category, CostThreshold>>(() => cloneThresholds())
  const [thresholdErrors, setThresholdErrors] = useState<Record<Category, string | undefined>>(
    {} as Record<Category, string | undefined>,
  )
  const [fabricationDims, setFabricationDims] = useState({ length: 0, width: 0, height: 0 })
  const [breakdowns, setBreakdowns] = useState<CostBreakdownPreview[]>([])
  const [calculationError, setCalculationError] = useState<string | null>(null)
  const [isCalculated, setIsCalculated] = useState(false)
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null)
  const [resultBanner, setResultBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'settings'>('input')
  const [sheetInventory, setSheetInventory] = useState<SheetInventoryRow[]>(() =>
    DEFAULT_SHEET_INVENTORY.map((row) => ({ ...row })),
  )
  const [userSalePriceInput, setUserSalePriceInput] = useState('')
  const [saleBufferInput, setSaleBufferInput] = useState('')
  const [saleDiscountInput, setSaleDiscountInput] = useState('')
  const [isPrintMode, setIsPrintMode] = useState(false)
  const [resultsSectionState, setResultsSectionState] = useState<Record<ResultsSectionKey, boolean>>(
    DEFAULT_RESULTS_SECTION_STATE,
  )
  const [resultColorThresholds, setResultColorThresholds] = useState<ResultColorThresholds>(
    DEFAULT_RESULT_COLOR_THRESHOLDS,
  )
  const [detailNotes, setDetailNotes] = useState<Record<ResultsCategory, string>>(() =>
    RESULTS_CATEGORY_ORDER.reduce(
      (acc, category) => {
        acc[category] = ''
        return acc
      },
      {} as Record<ResultsCategory, string>,
    ),
  )
  const [settingsBanner, setSettingsBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const settingsImportInputRef = useRef<HTMLInputElement | null>(null)

  const hasThresholdErrors = useMemo(
    () => Object.values(thresholdErrors).some((message) => Boolean(message)),
    [thresholdErrors],
  )
  const dimensionStep = measurementUnit === 'mm' ? '1' : '0.25'
  const lipStep = measurementUnit === 'mm' ? '1' : '0.125'
  const unitLabel = measurementUnit === 'mm' ? 'mm' : 'in'

  const displayDimensionValue = (value: number) => displayNumberInput(inchesToDisplay(value, measurementUnit))

  const formatDimension = (valueInInches: number, fractionDigits = 2) =>
    `${inchesToDisplay(valueInInches, measurementUnit).toFixed(fractionDigits)} ${unitLabel}`

  const linerDimensions = useMemo(() => {
    if (!planterInput.linerEnabled) return null
    const length = Math.max(planterInput.length - planterInput.linerDepth, 0)
    const width = Math.max(planterInput.width - planterInput.linerDepth, 0)
    const height = planterInput.height * 0.5
    return { length, width, height }
  }, [planterInput])

  const breakdownLookup = useMemo(
    () =>
      breakdowns.reduce<Record<string, CostBreakdownPreview>>((acc, row) => {
        acc[row.category] = row
        return acc
      }, {}),
    [breakdowns],
  )

  const sheetSummaries = useMemo<SheetSummaryRow[]>(() => {
    if (!solverResult) return []
    const buckets = new Map<
      string,
      {
        rowId: string
        name: string
        costPerSqft: number
        quantityUsed: number
        totalAreaAvailable: number
        totalAreaUsed: number
      }
    >()

    for (const usage of solverResult.sheetUsages) {
      const areaAvailable = (usage.width * usage.height) / 144
      const entry = buckets.get(usage.rowId)
      if (entry) {
        entry.quantityUsed += 1
        entry.totalAreaAvailable += areaAvailable
        entry.totalAreaUsed += usage.areaUsedSqft
        continue
      }
      buckets.set(usage.rowId, {
        rowId: usage.rowId,
        name: usage.name,
        costPerSqft: usage.costPerSqft,
        quantityUsed: 1,
        totalAreaAvailable: areaAvailable,
        totalAreaUsed: usage.areaUsedSqft,
      })
    }

    return [...buckets.values()]
          .sort((a, b) => {
            if (a.name !== b.name) return a.name.localeCompare(b.name)
            return a.rowId.localeCompare(b.rowId)
          })
          .map((entry) => {
            const areaPerSheet = entry.quantityUsed ? entry.totalAreaAvailable / entry.quantityUsed : 0
            const costPerSheet = areaPerSheet * entry.costPerSqft
            return {
              rowId: entry.rowId,
              name: entry.name,
              quantityUsed: entry.quantityUsed,
              costPerSqft: entry.costPerSqft,
              totalAreaAvailable: entry.totalAreaAvailable,
              totalAreaUsed: entry.totalAreaUsed,
              costPerSheet,
              utilizationPct: entry.totalAreaAvailable ? (entry.totalAreaUsed / entry.totalAreaAvailable) * 100 : 0,
              unusedMaterialCost: Math.max(0, entry.totalAreaAvailable - entry.totalAreaUsed) * entry.costPerSqft,
              totalMaterialCost: costPerSheet * entry.quantityUsed,
            }
          })
  }, [solverResult])

  const sheetMaterialCost = sheetSummaries.reduce((total, sheet) => total + sheet.totalMaterialCost, 0)

  const totalSheetAreaAvailable = sheetSummaries.reduce(
    (total, sheet) => total + sheet.totalAreaAvailable,
    0,
  )
  const totalMaterialArea = solverResult?.materialAreaSqft ?? 0
  const utilizationPct = totalSheetAreaAvailable > 0 ? (totalMaterialArea / totalSheetAreaAvailable) * 100 : 0
  const wastePct = totalSheetAreaAvailable > 0 ? 100 - utilizationPct : 0
  const sheetCount = sheetSummaries.reduce((total, sheet) => total + sheet.quantityUsed, 0)

  const totalMaterialCost = sheetMaterialCost
  const sheetInstanceAreaCost = useMemo(() => {
    if (!solverResult) return new Map<string, number>()
    return new Map(
      solverResult.sheetUsages.map((usage) => {
        const area = (usage.width * usage.height) / 144
        return [usage.id, area * usage.costPerSqft]
      }),
    )
  }, [solverResult])
  const linerSheetInstanceIds = useMemo(() => {
    if (!solverResult) return new Set<string>()
    return new Set(solverResult.placements.filter((placement) => placement.isLiner).map((placement) => placement.sheetInstanceId))
  }, [solverResult])
  const linerMaterialCost = useMemo(() => {
    let total = 0
    for (const id of linerSheetInstanceIds) {
      total += sheetInstanceAreaCost.get(id) ?? 0
    }
    return total
  }, [linerSheetInstanceIds, sheetInstanceAreaCost])
  const linerBreakdown = breakdownLookup['Liner']
  const linerLaborCost = linerBreakdown ? getBreakdownPrice(linerBreakdown) : 0
  const breakdownTotal = breakdowns.reduce((total, row) => {
    if (row.category === 'Liner' && !planterInput.linerEnabled) return total
    if (row.category === 'Shelf' && !planterInput.shelfEnabled) return total
    return total + getBreakdownPrice(row)
  }, 0)
  const totalFabricationCost = totalMaterialCost + breakdownTotal
  const totalNonMaterialCost = breakdownTotal

  const targetMarginFraction = Math.min(Math.max(planterInput.marginPct / 100, 0), 0.99)
  const suggestedSalePrice =
    totalFabricationCost > 0 ? totalFabricationCost / (1 - targetMarginFraction) : totalFabricationCost
  const parsedUserSalePrice = Number(userSalePriceInput)
  const hasUserSalePrice = Number.isFinite(parsedUserSalePrice) && parsedUserSalePrice > 0
  const userSalePrice = hasUserSalePrice ? parsedUserSalePrice : 0
  const userSaleMarginPct =
    hasUserSalePrice && userSalePrice > 0 ? ((userSalePrice - totalFabricationCost) / userSalePrice) * 100 : 0
  const userSalePriceDelta = hasUserSalePrice ? userSalePrice - suggestedSalePrice : 0
  const parsedSaleBuffer = Number(saleBufferInput)
  const bufferAmount = Number.isFinite(parsedSaleBuffer) && parsedSaleBuffer > 0 ? parsedSaleBuffer : 0
  const parsedSaleDiscount = Number(saleDiscountInput)
  const discountAmount = Number.isFinite(parsedSaleDiscount) && parsedSaleDiscount > 0 ? parsedSaleDiscount : 0
  const hasSaleAdjustmentsInput = saleBufferInput.trim() !== '' || saleDiscountInput.trim() !== ''
  const finalTotal = Math.max(0, suggestedSalePrice + bufferAmount - discountAmount)
  const actualMarginPct = finalTotal > 0 ? ((finalTotal - totalFabricationCost) / finalTotal) * 100 : 0

  const detailRows = useMemo(
    () =>
      RESULTS_CATEGORY_ORDER.map((category) => {
        if (category === 'Material') {
          const cheapestSheet = sheetSummaries.reduce<SheetSummaryRow | null>((current, next) => {
            if (!current) return next
            if (next.costPerSqft !== current.costPerSqft) {
              return next.costPerSqft < current.costPerSqft ? next : current
            }
            return next.name.localeCompare(current.name) < 0 ? next : current
          }, null)
          const sheetNames = sheetSummaries.map((entry) => entry.name).join(', ')
          const baseNote = `Material tier driven by ${cheapestSheet?.name ?? 'inventory'}`
          return {
            category,
            tierUsed: cheapestSheet ? cheapestSheet.name : 'Awaiting calculation',
            basePrice: totalMaterialCost,
            overridePrice: null,
            notes: solverResult
              ? `${baseNote}${sheetNames ? ` (${sheetNames})` : ''}.`
              : 'Run calculation to assign material tier.',
          }
        }

        if (category === 'Liner') {
          const breakdown = linerBreakdown
          const tierUsed = planterInput.linerEnabled
            ? breakdown?.tierUsed ?? 'Awaiting calculation'
            : 'Disabled'
          const basePrice = planterInput.linerEnabled ? breakdown?.basePrice ?? 0 : 0
          const overridePrice = planterInput.linerEnabled ? breakdown?.overridePrice ?? null : null
          const notes = breakdown
            ? breakdown.tierUsed === 'Not Selected'
              ? 'Liner is not selected yet.'
              : 'Liner labor tier applied.'
            : planterInput.linerEnabled
              ? 'Run calculation to assign tier.'
              : 'Liner feature disabled.'
          return {
            category,
            tierUsed,
            basePrice,
            overridePrice,
            notes,
          }
        }

        if (category === 'Shelf') {
          const breakdown = breakdownLookup['Shelf']
          const tierUsed = planterInput.shelfEnabled
            ? breakdown?.tierUsed ?? 'Awaiting calculation'
            : 'Disabled'
          const basePrice = planterInput.shelfEnabled ? breakdown?.basePrice ?? 0 : 0
          const overridePrice = planterInput.shelfEnabled ? breakdown?.overridePrice ?? null : null
          const notes = breakdown
            ? breakdown.tierUsed === 'Not Selected'
              ? 'Shelf is not selected yet.'
              : 'Shelf tier applied.'
            : planterInput.shelfEnabled
              ? 'Run calculation to assign tier.'
              : 'Shelf feature disabled.'
          return {
            category,
            tierUsed,
            basePrice,
            overridePrice,
            notes,
          }
        }

        if (category === 'Weight Plate') {
          const breakdown = breakdownLookup['Weight Plate']
          const tierUsed = planterInput.weightPlateEnabled
            ? breakdown?.tierUsed ?? 'Awaiting calculation'
            : 'Disabled'
          const basePrice = planterInput.weightPlateEnabled ? breakdown?.basePrice ?? 0 : 0
          const overridePrice = planterInput.weightPlateEnabled ? breakdown?.overridePrice ?? null : null
          const notes = breakdown
            ? breakdown.tierUsed === 'Not Selected'
              ? 'Weight plate is not selected yet.'
              : 'Weight plate tier applied.'
            : planterInput.weightPlateEnabled
              ? 'Run calculation to assign tier.'
              : 'Weight plate feature disabled.'
          return {
            category,
            tierUsed,
            basePrice,
            overridePrice,
            notes,
          }
        }

        const breakdown = breakdownLookup[category]
        const tierUsed = breakdown?.tierUsed ?? '—'
        const notes = breakdown
          ? breakdown.tierUsed === 'Not Selected'
            ? `${category} is not selected yet.`
            : `${breakdown.tierUsed} tier applied.`
          : 'Run calculation to assign tier.'
        return {
          category,
          tierUsed,
          basePrice: breakdown?.basePrice ?? 0,
          overridePrice: breakdown?.overridePrice ?? null,
          notes: solverResult ? notes : 'Run calculation to assign tier.',
        }
      }),
    [
      breakdownLookup,
      linerBreakdown,
      planterInput.linerEnabled,
      planterInput.weightPlateEnabled,
      planterInput.shelfEnabled,
      sheetSummaries,
      solverResult,
      totalMaterialCost,
    ],
  )

  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Partial<Record<Category, CostThreshold>>
      const isValid = categoryList.every((category) => {
        const candidate = parsed[category]
        return (
          typeof candidate?.lowThreshold === 'number' &&
          typeof candidate?.mediumThreshold === 'number' &&
          typeof candidate?.lowPrice === 'number' &&
          typeof candidate?.mediumPrice === 'number' &&
          typeof candidate?.highPrice === 'number'
        )
      })
      if (isValid) {
        setThresholds(cloneThresholds(parsed))
      }
    } catch {
      // ignore malformed persistence
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(RESULT_COLOR_STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Partial<ResultColorThresholds>
      setResultColorThresholds(normalizeResultColorThresholds(parsed))
    } catch {
      // ignore malformed persistence
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  useEffect(() => {
    localStorage.setItem(RESULT_COLOR_STORAGE_KEY, JSON.stringify(resultColorThresholds))
  }, [resultColorThresholds])

  useEffect(() => {
    const nextErrors: Record<Category, string | undefined> = {} as Record<Category, string | undefined>
    categoryList.forEach((category) => {
      const entry = thresholds[category]
      if (
        !Number.isFinite(entry.lowThreshold) ||
        !Number.isFinite(entry.mediumThreshold) ||
        !Number.isFinite(entry.lowPrice) ||
        !Number.isFinite(entry.mediumPrice) ||
        !Number.isFinite(entry.highPrice)
      ) {
        nextErrors[category] = 'All threshold and price values must be valid numbers.'
      } else if (entry.lowThreshold >= entry.mediumThreshold) {
        nextErrors[category] = 'Low threshold must be smaller than the medium threshold.'
      } else {
        nextErrors[category] = undefined
      }
    })
    setThresholdErrors(nextErrors)
  }, [thresholds])

  const handleInputChange = (field: NumericPlanterField, value: number) => {
    setPlanterInput((prev) => {
      if (!Number.isFinite(value)) return { ...prev, [field]: Number.NaN }
      if (!isDimensionInputField(field)) return { ...prev, [field]: value }
      return { ...prev, [field]: Math.max(0, displayToInches(value, measurementUnit)) }
    })
  }

  const handleInputBlur = (field: NumericPlanterField) => {
    setPlanterInput((prev) => {
      const currentValue = prev[field]
      return Number.isFinite(currentValue) ? prev : { ...prev, [field]: 0 }
    })
  }

  const handleCheckbox = (field: BooleanPlanterField, checked: boolean) => {
    setPlanterInput((prev) => ({ ...prev, [field]: checked }))
  }

  const handleThresholdChange = (category: Category, field: ThresholdField, value: number) => {
    setThresholds((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }))
  }

  const handleThresholdBlur = (category: Category, field: ThresholdField) => {
    setThresholds((prev) => {
      const currentValue = prev[category][field]
      if (Number.isFinite(currentValue)) return prev
      return {
        ...prev,
        [category]: { ...prev[category], [field]: 0 },
      }
    })
  }

  const handleSheetNameChange = (rowId: string, value: string) => {
    setSheetInventory((prev) => prev.map((row) => (row.id === rowId ? { ...row, name: value } : row)))
  }

  const handleSheetDimensionChange = (rowId: string, field: 'width' | 'height', value: number) => {
    setSheetInventory((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        if (!Number.isFinite(value)) return { ...row, [field]: Number.NaN }
        return { ...row, [field]: Math.max(0, displayToInches(value, measurementUnit)) }
      }),
    )
  }

  const handleSheetDimensionBlur = (rowId: string, field: 'width' | 'height') => {
    setSheetInventory((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        return Number.isFinite(row[field]) ? row : { ...row, [field]: 0 }
      }),
    )
  }


  const handleSheetCostChange = (rowId: string, value: number) => {
    setSheetInventory((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, costPerSqft: Number.isFinite(value) ? value : Number.NaN } : row,
      ),
    )
  }

  const handleSheetCostBlur = (rowId: string) => {
    setSheetInventory((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        return Number.isFinite(row.costPerSqft) ? row : { ...row, costPerSqft: 0 }
      }),
    )
  }

  const handleSheetQuantityChange = (rowId: string, value: number) => {
    setSheetInventory((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        return {
          ...row,
          quantity: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Number.NaN,
        }
      }),
    )
  }

  const handleSheetQuantityBlur = (rowId: string) => {
    setSheetInventory((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        return Number.isFinite(row.quantity) ? row : { ...row, quantity: 0 }
      }),
    )
  }

  const handleSheetLimitToggle = (rowId: string, restricted: boolean) => {
    setSheetInventory((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, limitQuantity: restricted } : row)),
    )
  }

  const handleAddSheetRow = () => {
    setSheetInventory((prev) => [...prev, createSheetRow()])
  }

  const handleRemoveSheetRow = (rowId: string) => {
    setSheetInventory((prev) => prev.filter((row) => row.id !== rowId))
  }

  const handleResetThresholds = () => {
    setThresholds(cloneThresholds())
  }

  const handleResetSheetInventory = () => {
    setSheetInventory(DEFAULT_SHEET_INVENTORY.map((row) => ({ ...row })))
  }

  const setAllResultsSections = (isOpen: boolean) => {
    setResultsSectionState({
      planterDetails: isOpen,
      costBreakdown: isOpen,
      sheetBreakdown: isOpen,
      cutPlan: isOpen,
    })
  }

  const toggleResultsSection = (section: ResultsSectionKey) => {
    setResultsSectionState((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleExportSettingsCsv = () => {
    const rows: string[][] = [
      [
        'section',
        'key',
        'low threshold',
        'low price',
        'medium threshold',
        'medium price',
        'high threshold',
        'high price',
      ],
      ['meta', 'version', '1', '', '', '', '', ''],
    ]

    categoryList.forEach((category) => {
      const threshold = thresholds[category]
      rows.push([
        'threshold',
        category,
        String(threshold.lowThreshold),
        String(threshold.lowPrice),
        String(threshold.mediumThreshold),
        String(threshold.mediumPrice),
        'Automatic',
        String(threshold.highPrice),
      ])
    })

    rows.push(['resultColorHeader', 'metric', 'risk/low', 'warn/high', '', '', '', ''])
    rows.push([
      'resultColor',
      'margin',
      String(resultColorThresholds.marginWarnMax),
      String(resultColorThresholds.marginGoodMin),
      '',
      '',
      '',
      '',
    ])
    rows.push([
      'resultColor',
      'delta',
      String(resultColorThresholds.deltaNegativeMax),
      String(resultColorThresholds.deltaPositiveMin),
      '',
      '',
      '',
      '',
    ])
    rows.push([
      'resultColor',
      'utilization',
      String(resultColorThresholds.utilizationWarnMax),
      String(resultColorThresholds.utilizationGoodMin),
      '',
      '',
      '',
      '',
    ])
    rows.push([
      'resultColor',
      'waste',
      String(resultColorThresholds.wasteGoodMax),
      String(resultColorThresholds.wasteWarnMax),
      '',
      '',
      '',
      '',
    ])

    rows.push(['sheetMode', 'unit', measurementUnit, '', '', '', '', ''])

    rows.push([
      'sheetHeader',
      'name',
      `width (${unitLabel})`,
      `height (${unitLabel})`,
      'cost / sqft',
      'quantity',
      'enforce',
      '',
    ])

    sheetInventory.forEach((row) => {
      rows.push([
        'sheet',
        row.name,
        String(inchesToDisplay(row.width, measurementUnit)),
        String(inchesToDisplay(row.height, measurementUnit)),
        String(row.costPerSqft),
        String(row.quantity),
        String(row.limitQuantity),
        '',
      ])
    })

    const csv = serializeCsv(rows)
    // Include UTF-8 BOM so Excel and other Windows tools decode symbols like × correctly.
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    anchor.href = url
    anchor.download = `planter-settings-${timestamp}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setSettingsBanner({ type: 'success', message: 'Settings CSV exported.' })
  }

  const handleImportSettingsCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      if (parsed.error) {
        setSettingsBanner({ type: 'error', message: parsed.error })
        return
      }

      const thresholdDraft: Partial<Record<Category, CostThreshold>> = {}
      const resultColorDraft: Partial<ResultColorThresholds> = {}
      const importedSheets: SheetInventoryRow[] = []
      let importedSheetUnit: MeasurementUnit = 'in'

      for (const rawRow of parsed.rows) {
        if (!rawRow.length) continue
        const row = rawRow.map((cell) => cell.trim())
        if (row.every((cell) => cell === '')) continue

        const section = row[0]?.toLowerCase()
        if (section === 'section') continue
        if (section === 'sheetheader') continue
        if (section === 'resultcolorheader') continue
        if (!section) continue

        if (section === 'sheetmode') {
          const parsedUnit = row[2]?.toLowerCase()
          if (parsedUnit === 'in' || parsedUnit === 'mm') {
            importedSheetUnit = parsedUnit
          }
          continue
        }

        if (section === 'threshold') {
          const category = categoryList.find((item) => item.toLowerCase() === row[1]?.toLowerCase())
          if (!category) {
            setSettingsBanner({ type: 'error', message: `Unknown threshold category "${row[1] ?? ''}".` })
            return
          }

          const lowThreshold = parseNumberCell(row[2] ?? '')
          const lowPrice = parseNumberCell(row[3] ?? '')
          const mediumThreshold = parseNumberCell(row[4] ?? '')
          const mediumPrice = parseNumberCell(row[5] ?? '')
          const highPrice = parseNumberCell(row[7] ?? '')
          const numericValues = [lowThreshold, lowPrice, mediumThreshold, mediumPrice, highPrice]
          if (numericValues.some((value) => value === null)) {
            setSettingsBanner({ type: 'error', message: `Threshold values for "${category}" must be valid numbers.` })
            return
          }

          thresholdDraft[category] = {
            category,
            lowThreshold: lowThreshold as number,
            lowPrice: lowPrice as number,
            mediumThreshold: mediumThreshold as number,
            mediumPrice: mediumPrice as number,
            highPrice: highPrice as number,
          }
          continue
        }

        if (section === 'resultcolor') {
          const metric = row[1]?.toLowerCase()
          const firstValue = parseNumberCell(row[2] ?? '')
          const secondValue = parseNumberCell(row[3] ?? '')
          if (firstValue === null || secondValue === null) {
            setSettingsBanner({ type: 'error', message: `Result color values for "${row[1] ?? ''}" must be numbers.` })
            return
          }

          if (metric === 'margin') {
            resultColorDraft.marginWarnMax = firstValue
            resultColorDraft.marginGoodMin = secondValue
            continue
          }
          if (metric === 'delta') {
            resultColorDraft.deltaNegativeMax = firstValue
            resultColorDraft.deltaPositiveMin = secondValue
            continue
          }
          if (metric === 'utilization') {
            resultColorDraft.utilizationWarnMax = firstValue
            resultColorDraft.utilizationGoodMin = secondValue
            continue
          }
          if (metric === 'waste') {
            resultColorDraft.wasteGoodMax = firstValue
            resultColorDraft.wasteWarnMax = secondValue
            continue
          }

          setSettingsBanner({ type: 'error', message: `Unknown result color metric "${row[1] ?? ''}".` })
          return
        }

        if (section === 'sheet') {
          const name = row[1] ?? ''
          const width = parseNumberCell(row[2] ?? '')
          const height = parseNumberCell(row[3] ?? '')
          const costPerSqft = parseNumberCell(row[4] ?? '')
          const quantityRaw = parseNumberCell(row[5] ?? '')
          const limitQuantity = parseBooleanCell(row[6] ?? '')

          if (!name) {
            setSettingsBanner({ type: 'error', message: 'Sheet rows must include a name.' })
            return
          }
          if ([width, height, costPerSqft, quantityRaw].some((value) => value === null)) {
            setSettingsBanner({ type: 'error', message: `Sheet "${name}" has invalid numeric values.` })
            return
          }
          if (limitQuantity === null) {
            setSettingsBanner({
              type: 'error',
              message: `Sheet "${name}" has invalid limitQuantity. Use true/false.`,
            })
            return
          }

          importedSheets.push(
            createSheetRow({
              name,
              width: Math.max(0, displayToInches(width as number, importedSheetUnit)),
              height: Math.max(0, displayToInches(height as number, importedSheetUnit)),
              costPerSqft: costPerSqft as number,
              quantity: Math.max(0, Math.floor(quantityRaw as number)),
              limitQuantity,
            }),
          )
          continue
        }
      }

      const hasAllThresholds = categoryList.every((category) => Boolean(thresholdDraft[category]))
      if (!hasAllThresholds) {
        setSettingsBanner({
          type: 'error',
          message: 'CSV is missing one or more threshold categories.',
        })
        return
      }
      setThresholds(cloneThresholds(thresholdDraft))
      if (Object.keys(resultColorDraft).length > 0) {
        setResultColorThresholds(normalizeResultColorThresholds(resultColorDraft))
      }
      setSheetInventory(importedSheets.length ? importedSheets : [createSheetRow()])
      setMeasurementUnit(importedSheetUnit)
      setSettingsBanner({ type: 'success', message: 'Settings imported from CSV and applied to the form.' })
    } catch {
      setSettingsBanner({ type: 'error', message: 'Unable to read the selected CSV file.' })
    }
  }

  const buildBreakdownResults = (volume: number): CostBreakdownPreview[] =>
    categoryList.map((category) => {
      if (category === 'Weight Plate' && !planterInput.weightPlateEnabled) {
        return { category, tierUsed: 'Not Selected', basePrice: 0, overridePrice: null }
      }
      if (category === 'Liner' && !planterInput.linerEnabled) {
        return { category, tierUsed: 'Not Selected', basePrice: 0, overridePrice: null }
      }
      if (category === 'Shelf' && !planterInput.shelfEnabled) {
        return { category, tierUsed: 'Not Selected', basePrice: 0, overridePrice: null }
      }

      const threshold = thresholds[category]
      const { tier, price } = determineTier(volume, threshold)
      return { category, tierUsed: tier, basePrice: price, overridePrice: null }
    })

  const handleCalculate = () => {
    setActiveTab('results')
    setCalculationError(null)
    setSolverResult(null)
    setResultBanner(null)
    const validationMessage = validatePlanterInput(planterInput)
    if (validationMessage) {
      setCalculationError(validationMessage)
      setIsCalculated(false)
      return
    }
    if (hasThresholdErrors) {
      setCalculationError('Resolve invalid threshold settings before calculating.')
      setIsCalculated(false)
      return
    }

    const dims = buildFabricationDimensions(planterInput)
    const volume = dims.length * dims.width * dims.height
    const breakdownResults = buildBreakdownResults(volume)

    setFabricationDims(dims)
    setBreakdowns(breakdownResults)
    setIsCalculated(true)

    try {
      const result = runPlanterSolver({
        planterInput,
        fabricationDims: dims,
        breakdowns: breakdownResults,
        options: {
          inventory: sheetInventory,
        },
      })
      setSolverResult(result)
      const generatedMaterialCost = result.sheetUsages.reduce(
        (total, usage) => total + ((usage.width * usage.height) / 144) * usage.costPerSqft,
        0,
      )
      const generatedBreakdownTotal = breakdownResults.reduce((total, row) => {
        if (row.category === 'Liner' && !planterInput.linerEnabled) return total
        if (row.category === 'Shelf' && !planterInput.shelfEnabled) return total
        return total + getBreakdownPrice(row)
      }, 0)
      const generatedTotalFabricationCost = generatedMaterialCost + generatedBreakdownTotal
      setResultBanner({
        type: 'success',
        message: `Solver locked the lowest total fabrication cost (${formatCurrencyValue(
          generatedTotalFabricationCost,
        )}) by preferring the cheapest sheets.`,
      })
      console.log('Solver result', result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown solver failure.'
      setCalculationError(`Solver failure: ${message}`)
      setResultBanner({
        type: 'error',
        message: `Solver failure: ${message}`,
      })
    }
  }

  const handlePriceOverride = (category: Category, value: number) => {
    setBreakdowns((prev) =>
      prev.map((row) =>
        row.category === category
          ? { ...row, overridePrice: Number.isFinite(value) ? Math.max(0, value) : null }
          : row,
      ),
    )
  }

  const handlePriceOverrideBlur = (category: Category) => {
    setBreakdowns((prev) =>
      prev.map((row) =>
        row.category === category && row.overridePrice !== null && !Number.isFinite(row.overridePrice)
          ? { ...row, overridePrice: null }
          : row,
      ),
    )
  }

  const fabricationSizeLabel = isCalculated
    ? `${formatDimension(fabricationDims.length)} × ${formatDimension(fabricationDims.width)} × ${formatDimension(
        fabricationDims.height,
      )}`
    : '—'
  const exportDateLabel = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const isPlanterDetailsOpen = isPrintMode || resultsSectionState.planterDetails
  const isCostBreakdownOpen = isPrintMode || resultsSectionState.costBreakdown
  const isSheetBreakdownOpen = isPrintMode || resultsSectionState.sheetBreakdown
  const isCutPlanOpen = isPrintMode || resultsSectionState.cutPlan

  const scrollToResultsSection = (id: string) => {
    const sectionKey = RESULT_SECTION_ID_MAP[id]
    if (sectionKey) {
      setResultsSectionState((prev) => ({ ...prev, [sectionKey]: true }))
    }
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 10)
  }

  const handleExportResultsPdf = () => {
    const previousTitle = document.title
    const cleanup = () => {
      document.title = previousTitle
      document.body.classList.remove('results-print-mode')
      setIsPrintMode(false)
      window.removeEventListener('afterprint', cleanup)
    }

    document.title = 'Terrace-Planter-Results'
    document.body.classList.add('results-print-mode')
    setIsPrintMode(true)
    window.addEventListener('afterprint', cleanup)

    window.setTimeout(() => {
      window.print()
    }, 100)
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      {activeTab === 'results' && (
        <aside className="results-print-hide fixed top-44 left-4 z-20 hidden xl:block">
          <div className="w-56 rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Results nav</p>
            <nav className="mt-3 flex flex-col gap-1 text-sm">
              <button type="button" onClick={() => scrollToResultsSection('results-overview')} className="rounded-md px-2 py-1 text-left text-foreground hover:bg-muted">
                Pricing
              </button>
              <button type="button" onClick={() => scrollToResultsSection('results-planter-details')} className="rounded-md px-2 py-1 text-left text-foreground hover:bg-muted">
                Planter details
              </button>
              <button type="button" onClick={() => scrollToResultsSection('results-cost-breakdown')} className="rounded-md px-2 py-1 text-left text-foreground hover:bg-muted">
                Cost details
              </button>
              <button type="button" onClick={() => scrollToResultsSection('results-sheet-breakdown')} className="rounded-md px-2 py-1 text-left text-foreground hover:bg-muted">
                Sheet breakdown
              </button>
              <button type="button" onClick={() => scrollToResultsSection('results-cut-plan')} className="rounded-md px-2 py-1 text-left text-foreground hover:bg-muted">
                Cut plan
              </button>
            </nav>
            <div className="mt-3 border-t border-border/70 pt-3">
              <Button className="w-full" variant="outline" onClick={handleExportResultsPdf}>
                Export PDF
              </Button>
            </div>
          </div>
        </aside>
      )}
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'input' | 'results' | 'settings')} className="space-y-6">
          <div className="results-print-hide space-y-3 bg-background py-3">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Fabrication cost engine</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-semibold text-foreground">Terrace Planter</h1>
                <div className="flex items-center gap-2">
                  <Label htmlFor="measurementUnit-global">Units</Label>
                  <Select
                    value={measurementUnit}
                    onValueChange={(value: string) => setMeasurementUnit(value as MeasurementUnit)}
                  >
                    <SelectTrigger id="measurementUnit-global" className="w-[120px] bg-background">
                      <SelectValue placeholder="Units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">in</SelectItem>
                      <SelectItem value="mm">mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </header>

            <TabsList className="grid h-auto w-full grid-cols-3 overflow-hidden rounded-full border border-border/80 bg-muted p-1 text-sm font-medium text-muted-foreground">
              <TabsTrigger
                value="input"
                className="rounded-full text-foreground data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Input
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="rounded-full text-foreground data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Results
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="rounded-full text-foreground data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="input" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card className="space-y-4">
                <CardHeader>
                  <CardTitle>Dimensions</CardTitle>
                  <CardDescription>Switch between inches and millimeters for dimensional inputs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="length">Length ({unitLabel})</Label>
                      <Input
                        id="length"
                        type="number"
                        min="0"
                        step={dimensionStep}
                        value={displayDimensionValue(planterInput.length)}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('length', parseNumberInput(event.target.value))
                        }
                        onBlur={() => handleInputBlur('length')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="width">Width ({unitLabel})</Label>
                      <Input
                        id="width"
                        type="number"
                        min="0"
                        step={dimensionStep}
                        value={displayDimensionValue(planterInput.width)}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('width', parseNumberInput(event.target.value))
                        }
                        onBlur={() => handleInputBlur('width')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="height">Height ({unitLabel})</Label>
                      <Input
                        id="height"
                        type="number"
                        min="0"
                        step={dimensionStep}
                        value={displayDimensionValue(planterInput.height)}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('height', parseNumberInput(event.target.value))
                        }
                        onBlur={() => handleInputBlur('height')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marginPct">Margin %</Label>
                      <Input
                        id="marginPct"
                        type="number"
                        min="0"
                        step="1"
                        value={displayNumberInput(planterInput.marginPct)}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('marginPct', parseNumberInput(event.target.value))
                        }
                        onBlur={() => handleInputBlur('marginPct')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="userSalePrice">User sale price</Label>
                      <Input
                        id="userSalePrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={userSalePriceInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setUserSalePriceInput(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="thickness">Thickness</Label>
                      <Select
                        value={String(planterInput.thickness)}
                        onValueChange={(value: string) => handleInputChange('thickness', Number(value))}
                      >
                        <SelectTrigger id="thickness" className="w-full">
                          <SelectValue placeholder="Select thickness" />
                        </SelectTrigger>
                        <SelectContent>
                          {thicknessOptions.map((option) => (
                            <SelectItem key={option.value} value={String(option.value)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lip">Lip ({unitLabel})</Label>
                      <Input
                        id="lip"
                        type="number"
                        min="0"
                        step={lipStep}
                        value={displayDimensionValue(planterInput.lip)}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('lip', parseNumberInput(event.target.value))
                        }
                        onBlur={() => handleInputBlur('lip')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="space-y-6">
                <CardHeader>
                  <CardTitle>Features</CardTitle>
                  <CardDescription>Toggle special fabrication add-ons.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="weightPlate"
                        checked={planterInput.weightPlateEnabled}
                        onCheckedChange={(value: boolean | 'indeterminate') =>
                          handleCheckbox('weightPlateEnabled', Boolean(value))
                        }
                      />
                      <Label htmlFor="weightPlate" className="text-sm font-semibold text-foreground">
                        Weight Plate
                      </Label>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="floor"
                        checked={planterInput.floorEnabled}
                        onCheckedChange={(value: boolean | 'indeterminate') =>
                          handleCheckbox('floorEnabled', Boolean(value))
                        }
                      />
                        <div>
                          <Label htmlFor="floor" className="text-sm font-semibold text-foreground">
                            Floor panel
                          </Label>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="shelf"
                        checked={planterInput.shelfEnabled}
                        onCheckedChange={(value: boolean | 'indeterminate') =>
                          handleCheckbox('shelfEnabled', Boolean(value))
                        }
                      />
                      <Label htmlFor="shelf" className="text-sm font-semibold text-foreground">
                        Shelf
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="liner"
                        checked={planterInput.linerEnabled}
                        onCheckedChange={(value: boolean | 'indeterminate') =>
                          handleCheckbox('linerEnabled', Boolean(value))
                        }
                      />
                      <Label htmlFor="liner" className="text-sm font-semibold text-foreground">
                        Liner
                      </Label>
                    </div>
                  </div>

                  {planterInput.linerEnabled && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="linerDepth">Liner Depth ({unitLabel})</Label>
                          <Input
                            id="linerDepth"
                            type="number"
                            min="0"
                            step={dimensionStep}
                            value={displayDimensionValue(planterInput.linerDepth)}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleInputChange('linerDepth', parseNumberInput(event.target.value))
                            }
                            onBlur={() => handleInputBlur('linerDepth')}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="linerThickness">Liner Thickness</Label>
                          <Select
                            value={String(planterInput.linerThickness)}
                            onValueChange={(value: string) =>
                              handleInputChange('linerThickness', Number(value))
                            }
                          >
                            <SelectTrigger id="linerThickness" className="w-full">
                              <SelectValue placeholder="Select thickness" />
                            </SelectTrigger>
                            <SelectContent>
                              {thicknessOptions.map((option) => (
                                <SelectItem key={option.value} value={String(option.value)}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {linerDimensions && (
                        <p className="text-sm text-muted-foreground">
                          Derived liner dims: {formatDimension(linerDimensions.length)} ×{' '}
                          {formatDimension(linerDimensions.width)} × {formatDimension(linerDimensions.height)} (length × width ×
                          height). Height is half of the planter height for now.
                        </p>
                      )}
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        <p>
                          <span className="font-semibold text-foreground">Liner labor tier:</span>{' '}
                          {linerBreakdown?.tierUsed ?? 'Awaiting calculation'}
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">Liner labor cost:</span>{' '}
                          {formatCurrencyValue(linerLaborCost)}
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">Liner material cost:</span>{' '}
                          {solverResult ? formatCurrencyValue(linerMaterialCost) : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <Button onClick={handleCalculate}>Calculate</Button>
              {solverResult && (
                <p className="text-sm text-muted-foreground">
                  Solver placed {solverResult.placements.length} panels across {solverResult.sheetUsages.length} sheet instances; total fabrication cost ${totalFabricationCost.toFixed(2)}.
                </p>
              )}
              {calculationError && (
                <p className="text-sm text-destructive">{calculationError}</p>
              )}
              {hasThresholdErrors && (
                <p className="text-sm text-warning">
                  Fix threshold ordering on the Settings tab before recalculating.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <div id="results-export-root" className="space-y-6">
              <div className="results-print-only results-print-cover">
                <div className="space-y-3 text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Terrace Planter</p>
                  <p className="text-4xl font-semibold text-foreground">Results Report</p>
                  <p className="text-base text-muted-foreground">{exportDateLabel}</p>
                </div>
              </div>
              {resultBanner && (
                <Card
                    className={`border ${
                      resultBanner.type === 'success'
                        ? 'border-emerald-400/70 bg-emerald-400/10 results-print-hide'
                        : 'border-destructive/70 bg-destructive/10'
                    }`}
                  >
                    <CardContent className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                            {resultBanner.type === 'success' ? 'Success' : 'Failure'}
                          </p>
                          <p
                            className={`text-sm font-semibold ${
                              resultBanner.type === 'success' ? 'text-foreground' : 'text-destructive'
                            }`}
                          >
                            {resultBanner.message}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setResultBanner(null)}>
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

              <section id="results-overview" className="results-print-keep scroll-mt-24 space-y-4">
                <Card className="results-strip-card">
                  <CardHeader>
                      <CardTitle>Pricing</CardTitle>
                      <CardDescription>Core pricing model first, followed by immediate decision signals.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="results-grid-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Suggested sale price</p>
                          <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(suggestedSalePrice)}</p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Target margin %</p>
                          <p className="text-xl font-semibold text-foreground">{formatPercentValue(planterInput.marginPct)}</p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total fabrication cost</p>
                          <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(totalFabricationCost)}</p>
                        </div>
                      </div>
                      <div className="results-grid-3 mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">User sale price</p>
                          <p className="text-2xl font-semibold text-foreground">
                            {hasUserSalePrice ? formatCurrencyValue(userSalePrice) : '—'}
                          </p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">User margin %</p>
                          <p className="text-2xl font-semibold text-foreground">
                            {hasUserSalePrice ? formatPercentValue(userSaleMarginPct) : '—'}
                          </p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">User vs suggested</p>
                          <p className="text-2xl font-semibold text-foreground">
                            {hasUserSalePrice ? formatCurrencyValue(userSalePriceDelta) : '—'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="results-strip-card">
                    <CardHeader>
                      <CardTitle>Cost composition</CardTitle>
                      <CardDescription>Material and labor structure.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="results-grid-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Material cost</p>
                          <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(totalMaterialCost)}</p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Non-material cost</p>
                          <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(totalNonMaterialCost)}</p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sheet count</p>
                          <p className="text-xl font-semibold text-foreground">{sheetCount.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="results-strip-card">
                    <CardHeader>
                      <CardTitle>Efficiency</CardTitle>
                      <CardDescription>Operational quality indicators.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="results-grid-2 grid gap-4 sm:grid-cols-2">
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Utilization %</p>
                          <p className="text-xl font-semibold text-foreground">{formatPercentValue(utilizationPct)}</p>
                        </div>
                        <div className="result-metric result-metric-neutral rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Waste %</p>
                          <p className="text-xl font-semibold text-foreground">{formatPercentValue(wastePct)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <div className="results-print-hide flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAllResultsSections(true)}>
                    Expand all sections
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAllResultsSections(false)}>
                    Collapse all sections
                  </Button>
                </div>

                <section id="results-planter-details" className="results-print-keep scroll-mt-24">
                <Card className="space-y-4">
                  <CardHeader
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleResultsSection('planterDetails')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleResultsSection('planterDetails')
                      }
                    }}
                    className="flex cursor-pointer flex-row items-center justify-between gap-3"
                  >
                    <div>
                      <CardTitle>Planter details</CardTitle>
                      <CardDescription>
                        Snapshot of the current planter inputs, dimensions, and add-on feature selections.
                      </CardDescription>
                    </div>
                    <Button
                      className="results-print-hide"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleResultsSection('planterDetails')
                      }}
                    >
                      {isPlanterDetailsOpen ? 'Collapse' : 'Expand'}
                    </Button>
                  </CardHeader>
                  {isPlanterDetailsOpen && <CardContent className="space-y-4">
                    <div className="results-grid-3 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Length</p>
                        <p className="text-base font-semibold text-foreground">{formatDimension(planterInput.length)}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Width</p>
                        <p className="text-base font-semibold text-foreground">{formatDimension(planterInput.width)}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Height</p>
                        <p className="text-base font-semibold text-foreground">{formatDimension(planterInput.height)}</p>
                      </div>
                    </div>
                    <div className="results-grid-3 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Lip</p>
                        <p className="text-base font-semibold text-foreground">{formatDimension(planterInput.lip, 3)}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Thickness</p>
                        <p className="text-base font-semibold text-foreground">{formatDimension(planterInput.thickness, 3)}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Target margin</p>
                        <p className="text-base font-semibold text-foreground">{formatPercentValue(planterInput.marginPct)}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Fabrication size</p>
                      <p className="text-base font-semibold text-foreground">{fabricationSizeLabel}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Features</p>
                    <div className="results-grid-3 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Liner</p>
                        <p className="text-base font-semibold text-foreground">{planterInput.linerEnabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Weight plate</p>
                        <p className="text-base font-semibold text-foreground">{planterInput.weightPlateEnabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Shelf</p>
                        <p className="text-base font-semibold text-foreground">{planterInput.shelfEnabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Floor</p>
                        <p className="text-base font-semibold text-foreground">{planterInput.floorEnabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Liner depth</p>
                        <p className="text-base font-semibold text-foreground">
                          {planterInput.linerEnabled ? formatDimension(planterInput.linerDepth) : 'Disabled'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Liner thickness</p>
                        <p className="text-base font-semibold text-foreground">
                          {planterInput.linerEnabled ? formatDimension(planterInput.linerThickness, 3) : 'Disabled'}
                        </p>
                      </div>
                    </div>
                  </CardContent>}
                </Card>
                </section>

            <section id="results-cost-breakdown" className="results-print-keep scroll-mt-24">
            <Card className="space-y-3">
              <CardHeader
                role="button"
                tabIndex={0}
                onClick={() => toggleResultsSection('costBreakdown')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleResultsSection('costBreakdown')
                  }
                }}
                className="flex cursor-pointer flex-row items-center justify-between gap-3"
              >
                <div>
                  <CardTitle>Cost details</CardTitle>
                  <CardDescription>
                    Material and fabrication tiers are shown alongside liner/add-on costs. Tier selections follow the
                    calculated volume.
                  </CardDescription>
                </div>
                <Button
                  className="results-print-hide"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleResultsSection('costBreakdown')
                  }}
                >
                  {isCostBreakdownOpen ? 'Collapse' : 'Expand'}
                </Button>
              </CardHeader>
              {isCostBreakdownOpen && <CardContent>
                <Table className="border border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Tier used</TableHead>
                      <TableHead>Base price</TableHead>
                      <TableHead>Override price</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-semibold text-foreground">{row.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.tierUsed}</TableCell>
                        <TableCell>{formatCurrencyValue(row.basePrice)}</TableCell>
                        <TableCell>
                          {row.category === 'Material' ? (
                            <span className="text-sm text-muted-foreground">Not applicable</span>
                          ) : (
                            <Input
                              type="number"
                              value={row.overridePrice === null ? '' : displayNumberInput(row.overridePrice)}
                              step="0.5"
                              min="0"
                              disabled={
                                !isCalculated ||
                                (row.category === 'Weight Plate' && !planterInput.weightPlateEnabled) ||
                                (row.category === 'Liner' && !planterInput.linerEnabled) ||
                                (row.category === 'Shelf' && !planterInput.shelfEnabled)
                              }
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handlePriceOverride(
                                  row.category as Category,
                                  parseNumberInput(event.target.value),
                                )
                              }
                              onBlur={() => handlePriceOverrideBlur(row.category as Category)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={detailNotes[row.category as ResultsCategory]}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              setDetailNotes((prev) => ({
                                ...prev,
                                [row.category as ResultsCategory]: event.target.value,
                              }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="results-summary-block mt-4 space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="results-grid-3 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total cost</p>
                      <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(totalFabricationCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Target margin</p>
                      <p className="text-lg font-semibold text-foreground">{formatPercentValue(planterInput.marginPct)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Suggested sale price</p>
                      <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(suggestedSalePrice)}</p>
                    </div>
                  </div>
                  <div className="results-grid-2 grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="sale-buffer">Buffer</Label>
                      <Input
                        id="sale-buffer"
                        type="number"
                        min="0"
                        step="0.01"
                        value={saleBufferInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setSaleBufferInput(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sale-discount">Discounts</Label>
                      <Input
                        id="sale-discount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={saleDiscountInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setSaleDiscountInput(event.target.value)}
                      />
                    </div>
                  </div>
                  {hasSaleAdjustmentsInput && (
                    <div className="results-grid-2 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Final total</p>
                        <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(finalTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Actual margin</p>
                        <p className="text-lg font-semibold text-foreground">{formatPercentValue(actualMarginPct)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>}
            </Card>
            </section>

            <section id="results-sheet-breakdown" className="results-print-keep scroll-mt-24">
            <Card className="space-y-3">
              <CardHeader
                role="button"
                tabIndex={0}
                onClick={() => toggleResultsSection('sheetBreakdown')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleResultsSection('sheetBreakdown')
                  }
                }}
                className="flex cursor-pointer flex-row items-center justify-between gap-3"
              >
                <div>
                  <CardTitle>Sheet breakdown</CardTitle>
                  <CardDescription>
                    Each sheet type's utilization, unused material, and per-sheet cost encourage deterministic reuse and
                    transparency.
                  </CardDescription>
                </div>
                <Button
                  className="results-print-hide"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleResultsSection('sheetBreakdown')
                  }}
                >
                  {isSheetBreakdownOpen ? 'Collapse' : 'Expand'}
                </Button>
              </CardHeader>
              {isSheetBreakdownOpen && <CardContent>
                {sheetSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Run Calculate to collect sheet usage data.</p>
                ) : (
                  <Table className="border border-border">
                    <TableHeader>
                      <TableRow>
                    <TableHead>Sheet type</TableHead>
                    <TableHead>Quantity used</TableHead>
                    <TableHead>Cost / sheet</TableHead>
                    <TableHead>Total material cost</TableHead>
                    <TableHead>Utilization %</TableHead>
                    <TableHead>Unused material cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheetSummaries.map((sheet) => (
                        <TableRow key={sheet.rowId}>
                          <TableCell className="font-semibold text-foreground">{sheet.name}</TableCell>
                          <TableCell>{sheet.quantityUsed.toLocaleString()}</TableCell>
                          <TableCell>{formatCurrencyValue(sheet.costPerSheet)}</TableCell>
                          <TableCell>{formatCurrencyValue(sheet.totalMaterialCost)}</TableCell>
                          <TableCell>{formatPercentValue(sheet.utilizationPct)}</TableCell>
                          <TableCell>{formatCurrencyValue(sheet.unusedMaterialCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>}
            </Card>
            </section>

            <section id="results-cut-plan" className="results-print-keep scroll-mt-24">
            <Card className="space-y-3">
              <CardHeader
                role="button"
                tabIndex={0}
                onClick={() => toggleResultsSection('cutPlan')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleResultsSection('cutPlan')
                  }
                }}
                className="flex cursor-pointer flex-row items-center justify-between gap-3"
              >
                <div>
                  <CardTitle>Cut plan</CardTitle>
                  <CardDescription>Sheet-level panel placement and legend.</CardDescription>
                </div>
                <Button
                  className="results-print-hide"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleResultsSection('cutPlan')
                  }}
                >
                  {isCutPlanOpen ? 'Collapse' : 'Expand'}
                </Button>
              </CardHeader>
              {isCutPlanOpen && <CardContent>
                <CutPlanView
                  sheetUsages={solverResult?.sheetUsages ?? []}
                  formatCurrency={formatCurrencyValue}
                  measurementUnit={measurementUnit}
                  compact={isPrintMode}
                  embedded
                />
              </CardContent>}
            </Card>
            </section>

            </div>
          </TabsContent>
          <TabsContent value="settings" className="space-y-6">
            {settingsBanner && (
              <Card
                className={`border ${
                  settingsBanner.type === 'success'
                    ? 'border-emerald-400/70 bg-emerald-400/10'
                    : 'border-destructive/70 bg-destructive/10'
                }`}
              >
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        {settingsBanner.type === 'success' ? 'Success' : 'Failure'}
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          settingsBanner.type === 'success' ? 'text-foreground' : 'text-destructive'
                        }`}
                      >
                        {settingsBanner.message}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSettingsBanner(null)}>
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Settings import/export</CardTitle>
                  <CardDescription>
                    Import or export all settings on this tab, including thresholds and sheet inventory.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={settingsImportInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleImportSettingsCsv}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => settingsImportInputRef.current?.click()}
                  >
                    Import CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportSettingsCsv}>
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
            </Card>
            <Card className="space-y-4">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Cost thresholds</CardTitle>
                  <CardDescription>
                    Volume thresholds in cubic inches drive which tier applies for each fabrication category.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={handleResetThresholds}>
                    Reset to defaults
                  </Button>
                </div>
              </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground sm:grid-cols-3 text-center">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                  <div className="space-y-4">
                    {categoryList.map((category) => {
                      const error = thresholdErrors[category]
                      return (
                        <div
                          key={category}
                          className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-foreground">{category}</span>
                            {error && (
                              <p className="text-xs text-destructive">{error}</p>
                            )}
                          </div>
                          <div className="grid gap-3 text-sm sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label htmlFor={`${category}-lowThreshold`}>Threshold</Label>
                              <Input
                                id={`${category}-lowThreshold`}
                                type="number"
                                min="0"
                                step="100"
                                value={displayNumberInput(thresholds[category].lowThreshold)}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(
                                    category,
                                    'lowThreshold',
                                    parseNumberInput(event.target.value),
                                  )
                                }
                                onBlur={() => handleThresholdBlur(category, 'lowThreshold')}
                              />
                              <Label htmlFor={`${category}-lowPrice`}>Price</Label>
                              <Input
                                id={`${category}-lowPrice`}
                                type="number"
                                min="0"
                                step="1"
                                value={displayNumberInput(thresholds[category].lowPrice)}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'lowPrice', parseNumberInput(event.target.value))
                                }
                                onBlur={() => handleThresholdBlur(category, 'lowPrice')}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`${category}-mediumThreshold`}>Threshold</Label>
                              <Input
                                id={`${category}-mediumThreshold`}
                                type="number"
                                min="0"
                                step="100"
                                value={displayNumberInput(thresholds[category].mediumThreshold)}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(
                                    category,
                                    'mediumThreshold',
                                    parseNumberInput(event.target.value),
                                  )
                                }
                                onBlur={() => handleThresholdBlur(category, 'mediumThreshold')}
                              />
                              <Label htmlFor={`${category}-mediumPrice`}>Price</Label>
                              <Input
                                id={`${category}-mediumPrice`}
                                type="number"
                                min="0"
                                step="1"
                                value={displayNumberInput(thresholds[category].mediumPrice)}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(
                                    category,
                                    'mediumPrice',
                                    parseNumberInput(event.target.value),
                                  )
                                }
                                onBlur={() => handleThresholdBlur(category, 'mediumPrice')}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`${category}-highThreshold`}>Threshold</Label>
                              <Input
                                id={`${category}-highThreshold`}
                                type="text"
                                inputMode="none"
                                value="Automatic"
                                readOnly
                                className="cursor-not-allowed bg-muted/30"
                                aria-label={`${category} high threshold is automatic`}
                              />
                              <Label htmlFor={`${category}-highPrice`}>Price</Label>
                              <Input
                                id={`${category}-highPrice`}
                                type="number"
                                min="0"
                                step="1"
                                value={displayNumberInput(thresholds[category].highPrice)}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'highPrice', parseNumberInput(event.target.value))
                                }
                                onBlur={() => handleThresholdBlur(category, 'highPrice')}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                <p className="text-sm text-muted-foreground">
                  Settings persist locally and are reused on every visit.
                </p>
              </CardContent>
            </Card>
            <Card className="space-y-4">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Sheet inventory</CardTitle>
                  <CardDescription>
                    Solver only considers the rows below (per the dimensions/cost values) and can place multiple copies of the same sheet up to the listed quantity.
                  </CardDescription>
                </div>
                <div className="flex flex-col items-stretch gap-2 text-right sm:flex-row sm:items-center sm:gap-3">
                  <Button size="sm" variant="ghost" onClick={handleResetSheetInventory}>
                    Reset inventory
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  Solver uses the sheet rows below, applies quantity limits when enforced, and searches for the lowest-cost combination.
                </p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-sm font-bold text-foreground">Sheet name</TableHead>
                        <TableHead className="text-sm font-bold text-foreground">Width ({unitLabel})</TableHead>
                        <TableHead className="text-sm font-bold text-foreground">Height ({unitLabel})</TableHead>
                        <TableHead className="text-sm font-bold text-foreground">Cost / sqft</TableHead>
                        <TableHead className="text-sm font-bold text-foreground">Quantity</TableHead>
                        <TableHead className="w-[96px] text-sm font-bold text-foreground">Enforce</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheetInventory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Input
                              id={`${row.id}-name`}
                              type="text"
                              aria-label="Sheet name"
                              value={row.name}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handleSheetNameChange(row.id, event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              id={`${row.id}-width`}
                              type="number"
                              aria-label={`Width (${unitLabel})`}
                              min="0"
                              step={dimensionStep}
                              value={displayDimensionValue(row.width)}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handleSheetDimensionChange(
                                  row.id,
                                  'width',
                                  parseNumberInput(event.target.value),
                                )
                              }
                              onBlur={() => handleSheetDimensionBlur(row.id, 'width')}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              id={`${row.id}-height`}
                              type="number"
                              aria-label={`Height (${unitLabel})`}
                              min="0"
                              step={dimensionStep}
                              value={displayDimensionValue(row.height)}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handleSheetDimensionChange(
                                  row.id,
                                  'height',
                                  parseNumberInput(event.target.value),
                                )
                              }
                              onBlur={() => handleSheetDimensionBlur(row.id, 'height')}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              id={`${row.id}-cost`}
                              type="number"
                              aria-label="Cost per square foot"
                              min="0"
                              step="0.01"
                              value={displayNumberInput(row.costPerSqft)}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handleSheetCostChange(row.id, parseNumberInput(event.target.value))
                              }
                              onBlur={() => handleSheetCostBlur(row.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              id={`${row.id}-quantity`}
                              type="number"
                              aria-label="Quantity"
                              min="0"
                              step="1"
                              value={displayNumberInput(row.quantity)}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handleSheetQuantityChange(row.id, parseNumberInput(event.target.value))
                              }
                              onBlur={() => handleSheetQuantityBlur(row.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex h-9 items-center justify-start">
                              <Checkbox
                                id={`${row.id}-limit`}
                                aria-label="Enforce quantity"
                                checked={row.limitQuantity}
                                onCheckedChange={(value: boolean | 'indeterminate') =>
                                  handleSheetLimitToggle(row.id, Boolean(value))
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveSheetRow(row.id)}>
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <Button variant="secondary" size="sm" onClick={handleAddSheetRow}>
                    Add sheet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App


