import { useEffect, useMemo, useState } from 'react'
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
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { CostBreakdownPreview, CostThreshold, PlanterInput } from './types'
import {
  DEFAULT_SHEET_INVENTORY,
  buildFabricationDimensions,
  runPlanterSolver,
  type SheetInventoryRow,
  type SolverResult,
} from './lib/planterSolver'

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
  { label: '1/4" (0.25")', value: 0.25 },
  { label: '5/16" (0.3125")', value: 0.3125 },
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
  if (input.length <= 0) return 'Length must be greater than zero.'
  if (input.width <= 0) return 'Width must be greater than zero.'
  if (input.height <= 0) return 'Height must be greater than zero.'
  if (input.lip < 0) return 'Lip must be zero or greater.'
  if (input.marginPct < 0) return 'Margin % must be zero or greater.'
  if (input.thickness <= 0) return 'Thickness must be greater than zero.'
  if (input.linerEnabled && input.linerDepth < 0) return 'Liner depth must be zero or greater.'
  if (input.linerEnabled && input.linerThickness <= 0) return 'Liner thickness must be greater than zero.'
  return null
}

type NumericPlanterField = Exclude<
  keyof PlanterInput,
  'linerEnabled' | 'weightPlateEnabled' | 'shelfEnabled'
>
type BooleanPlanterField = 'linerEnabled' | 'weightPlateEnabled' | 'shelfEnabled' | 'floorEnabled'
type ThresholdField = 'lowThreshold' | 'lowPrice' | 'mediumThreshold' | 'mediumPrice' | 'highPrice'

function App() {
  const [planterInput, setPlanterInput] = useState<PlanterInput>(() => ({ ...defaultPlanterInput }))
  const [thresholds, setThresholds] = useState<Record<Category, CostThreshold>>(() => cloneThresholds())
  const [thresholdErrors, setThresholdErrors] = useState<Record<Category, string | undefined>>(
    {} as Record<Category, string | undefined>,
  )
  const [fabricationDims, setFabricationDims] = useState({ length: 0, width: 0, height: 0 })
  const [fabricationVolume, setFabricationVolume] = useState<number | null>(null)
  const [breakdowns, setBreakdowns] = useState<CostBreakdownPreview[]>([])
  const [calculationError, setCalculationError] = useState<string | null>(null)
  const [isCalculated, setIsCalculated] = useState(false)
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null)
  const [resultBanner, setResultBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'settings'>('input')
  const [sheetInventory, setSheetInventory] = useState<SheetInventoryRow[]>(() =>
    DEFAULT_SHEET_INVENTORY.map((row) => ({ ...row })),
  )
  const [sheetMode, setSheetMode] = useState<'auto' | 'manual'>('manual')
  const [customSalePrice, setCustomSalePrice] = useState('')

  const hasThresholdErrors = useMemo(
    () => Object.values(thresholdErrors).some((message) => Boolean(message)),
    [thresholdErrors],
  )

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
  const totalFabricationCost = solverResult?.totalFabricationCost ?? 0
  const linerExtraCost = solverResult?.linerExtraCost ?? 0
  const baseFabricationCoreCost = breakdowns
    .filter((row) => row.category !== 'Weight Plate')
    .reduce((total, row) => total + row.price, 0)
  const weightPlateCost = breakdownLookup['Weight Plate']?.price ?? 0
  const totalNonMaterialCost = totalFabricationCost - totalMaterialCost
  const planterStructuralCost = totalMaterialCost + baseFabricationCoreCost
  const linerStructuralCost = linerExtraCost
  const addOnStructuralCost = weightPlateCost
  const combinedStructuralTotal = planterStructuralCost + linerStructuralCost + addOnStructuralCost

  const linerBreakdown = breakdownLookup['Liner']
  const linerLaborCost = linerBreakdown?.price ?? 0

  const saleMarginFraction = Math.min(Math.max(planterInput.marginPct / 100, 0), 0.99)
  const estimatedSalePrice =
    totalFabricationCost > 0 ? totalFabricationCost / (1 - saleMarginFraction) : totalFabricationCost
  const profit = estimatedSalePrice - totalFabricationCost

  const parsedCustomSalePrice = Number(customSalePrice)
  const hasCustomSalePrice =
    Number.isFinite(parsedCustomSalePrice) && parsedCustomSalePrice > 0
  const salePriceForMargin = hasCustomSalePrice ? parsedCustomSalePrice : estimatedSalePrice
  const userSaleMarginPct =
    salePriceForMargin > 0
      ? ((salePriceForMargin - totalFabricationCost) / salePriceForMargin) * 100
      : 0
  const salePriceDelta = hasCustomSalePrice ? parsedCustomSalePrice - estimatedSalePrice : 0
  const salePriceDeltaColorClass = hasCustomSalePrice
    ? salePriceDelta > 0
      ? 'text-emerald-500'
      : salePriceDelta < 0
        ? 'text-destructive'
        : 'text-muted-foreground'
    : 'text-muted-foreground'
  const salePriceDeltaCopy = hasCustomSalePrice
    ? salePriceDelta === 0
      ? 'Sale price matches the estimate.'
      : `Sale price is ${salePriceDelta > 0 ? 'above' : 'below'} the estimate by ${formatCurrencyValue(
          Math.abs(salePriceDelta),
        )}.`
    : 'Enter a sale price to compare against the estimate.'
  const salePriceDeltaIcon = hasCustomSalePrice ? (
    salePriceDelta > 0 ? (
      <ArrowUpRight className="h-4 w-4 text-emerald-500" aria-hidden />
    ) : salePriceDelta < 0 ? (
      <ArrowDownRight className="h-4 w-4 text-destructive" aria-hidden />
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  ) : (
    <span className="text-muted-foreground">—</span>
  )
  const salePriceMarginDisplay = hasCustomSalePrice ? formatPercentValue(userSaleMarginPct) : '—'
  const salePriceMarginNote = hasCustomSalePrice
    ? 'Margin computed from the entered sale price.'
    : 'Enter a sale price to compute the resulting margin.'

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
            price: totalMaterialCost,
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
          const price = planterInput.linerEnabled ? breakdown?.price ?? 0 : 0
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
            price,
            notes,
          }
        }

        if (category === 'Shelf') {
          const breakdown = breakdownLookup['Shelf']
          const tierUsed = planterInput.shelfEnabled
            ? breakdown?.tierUsed ?? 'Awaiting calculation'
            : 'Disabled'
          const price = planterInput.shelfEnabled ? breakdown?.price ?? 0 : 0
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
            price,
            notes,
          }
        }

        const breakdown = breakdownLookup[category]
        const price = breakdown?.price ?? 0
        const tierUsed = breakdown?.tierUsed ?? '—'
        const notes = breakdown
          ? breakdown.tierUsed === 'Not Selected'
            ? `${category} is not selected yet.`
            : `${breakdown.tierUsed} tier applied.`
          : 'Run calculation to assign tier.'
        return {
          category,
          tierUsed,
          price,
          notes: solverResult ? notes : 'Run calculation to assign tier.',
        }
      }),
    [
      breakdownLookup,
      linerBreakdown,
      planterInput.linerEnabled,
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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  useEffect(() => {
    const nextErrors: Record<Category, string | undefined> = {} as Record<Category, string | undefined>
    categoryList.forEach((category) => {
      const entry = thresholds[category]
      if (entry.lowThreshold >= entry.mediumThreshold) {
        nextErrors[category] = 'Low threshold must be smaller than the medium threshold.'
      } else {
        nextErrors[category] = undefined
      }
    })
    setThresholdErrors(nextErrors)
  }, [thresholds])

  const handleInputChange = (field: NumericPlanterField, value: number) => {
    setPlanterInput((prev) => ({ ...prev, [field]: value }))
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

  const handleSheetNameChange = (rowId: string, value: string) => {
    setSheetInventory((prev) => prev.map((row) => (row.id === rowId ? { ...row, name: value } : row)))
  }

  const handleSheetDimensionChange = (rowId: string, field: 'width' | 'height', value: number) => {
    if (Number.isNaN(value)) return
    setSheetInventory((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: Math.max(0, value) } : row)),
    )
  }


  const handleSheetCostChange = (rowId: string, value: number) => {
    setSheetInventory((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, costPerSqft: Number.isNaN(value) ? row.costPerSqft : value } : row,
      ),
    )
  }

  const handleSheetQuantityChange = (rowId: string, value: number) => {
    setSheetInventory((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        if (Number.isNaN(value)) return row
        return { ...row, quantity: Math.max(0, Math.floor(value)) }
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

  const handleToggleEnforceQuantity = (enforce: boolean) => {
    setSheetInventory((prev) =>
      prev.map((row) => ({
        ...row,
        limitQuantity: enforce,
      })),
    )
  }

  const handleCalculate = () => {
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

    const breakdownResults: CostBreakdownPreview[] = categoryList.map((category) => {
      if (category === 'Weight Plate' && !planterInput.weightPlateEnabled) {
        return { category, tierUsed: 'Not Selected', price: 0 }
      }
      if (category === 'Liner') {
        if (!planterInput.linerEnabled) {
          return { category, tierUsed: 'Not Selected', price: 0 }
        }
        const threshold = thresholds[category]
        const { tier, price } = determineTier(volume, threshold)
        return { category, tierUsed: tier, price }
      }
      if (category === 'Shelf') {
        if (!planterInput.shelfEnabled) {
          return { category, tierUsed: 'Not Selected', price: 0 }
        }
        const threshold = thresholds[category]
        const { tier, price } = determineTier(volume, threshold)
        return { category, tierUsed: tier, price }
      }
      const threshold = thresholds[category]
      const { tier, price } = determineTier(volume, threshold)
      return { category, tierUsed: tier, price }
    })

    setFabricationDims(dims)
    setFabricationVolume(volume)
    setBreakdowns(breakdownResults)
    setIsCalculated(true)
  }

  const handleGenerate = () => {
    setActiveTab('results')
    if (!isCalculated) {
      return
    }

    setCalculationError(null)
    try {
      const result = runPlanterSolver({
        planterInput,
        fabricationDims,
        breakdowns,
        options: {
          inventory: sheetInventory,
          mode: sheetMode,
          manualRowOrder: sheetInventory.map((row) => row.id),
        },
      })
      setSolverResult(result)
      setResultBanner({
        type: 'success',
        message: `Solver locked the lowest total fabrication cost (${formatCurrencyValue(
          result.totalFabricationCost,
        )}) by preferring the cheapest sheets and bundling savings (${formatCurrencyValue(result.bundleSavings)}).`,
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
      prev.map((row) => (row.category === category ? { ...row, price: Number.isNaN(value) ? row.price : value } : row)),
    )
  }

  const fabricationSizeLabel = isCalculated
    ? `${fabricationDims.length.toFixed(2)}" × ${fabricationDims.width.toFixed(2)}" × ${fabricationDims.height.toFixed(2)}"`
    : '—'

  const formatVolume = fabricationVolume
    ? fabricationVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : '—'

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Fabrication cost engine</p>
          <h1 className="text-3xl font-semibold text-foreground">Planter Cut Planner</h1>
        </header>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'input' | 'results' | 'settings')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-full border border-border bg-muted/60 p-1 text-sm font-medium text-muted-foreground">
            <TabsTrigger value="input" className="text-foreground">
              Input
            </TabsTrigger>
            <TabsTrigger value="results" className="text-foreground">
              Results
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-foreground">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card className="space-y-4">
                <CardHeader>
                  <CardTitle>Dimensions</CardTitle>
                  <CardDescription>All measurements are in inches.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="length">Length</Label>
                      <Input
                        id="length"
                        type="number"
                        min="0"
                        step="0.25"
                        value={planterInput.length}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('length', Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="width">Width</Label>
                      <Input
                        id="width"
                        type="number"
                        min="0"
                        step="0.25"
                        value={planterInput.width}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('width', Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="height">Height</Label>
                      <Input
                        id="height"
                        type="number"
                        min="0"
                        step="0.25"
                        value={planterInput.height}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('height', Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marginPct">Margin %</Label>
                      <Input
                        id="marginPct"
                        type="number"
                        min="0"
                        step="1"
                        value={planterInput.marginPct}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('marginPct', Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="salePrice">Sale price</Label>
                      <Input
                        id="salePrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={customSalePrice}
                        placeholder={estimatedSalePrice > 0 ? formatCurrencyValue(estimatedSalePrice) : undefined}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomSalePrice(event.target.value)}
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
                      <Label htmlFor="lip">Lip (default 2 1/8")</Label>
                      <Input
                        id="lip"
                        type="number"
                        min="0"
                        step="0.125"
                        value={planterInput.lip}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('lip', Number(event.target.value))
                        }
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
                          <Label htmlFor="linerDepth">Liner Depth</Label>
                          <Input
                            id="linerDepth"
                            type="number"
                            min="0"
                            step="0.25"
                            value={planterInput.linerDepth}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleInputChange('linerDepth', Number(event.target.value))
                            }
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
                          Derived liner dims: {linerDimensions.length.toFixed(2)}" ×{' '}
                          {linerDimensions.width.toFixed(2)}" × {linerDimensions.height.toFixed(2)}" (length × width ×
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

            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>Calculation</CardTitle>
                <CardDescription>Lip is added after validation, then volume determines the tier selection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleCalculate}>Calculate</Button>
                  <Button variant="outline" disabled={!isCalculated} onClick={handleGenerate}>
                    Generate
                  </Button>
                </div>
                {solverResult && (
                  <p className="text-sm text-muted-foreground">
                    Solver placed {solverResult.placements.length} panels across {solverResult.sheetUsages.length} sheet instances; total fabrication cost ${solverResult.totalFabricationCost.toFixed(2)}.
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
                <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em]">Fabrication size</p>
                    <p className="text-base text-foreground">{fabricationSizeLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em]">Volume</p>
                    <p className="text-base text-foreground">{formatVolume} in³</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>Cost breakdown preview</CardTitle>
                <CardDescription>
                  Tiers populate after calculation; edit prices manually once the tiers are assigned.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table className="border border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Price (override)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryList.map((category) => {
                      const row = breakdowns.find((entry) => entry.category === category)
                      const tierLabel = row?.tierUsed ?? '—'
                      const price = row?.price ?? 0
                      const isWeightPlate = category === 'Weight Plate'
                      const isLinerCategory = category === 'Liner'
                      const priceDisabled =
                        !isCalculated ||
                        (isWeightPlate && !planterInput.weightPlateEnabled) ||
                        (isLinerCategory && !planterInput.linerEnabled)
                      return (
                        <TableRow key={category}>
                          <TableCell className="font-semibold text-foreground">{category}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tierLabel}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={price}
                              step="0.5"
                              min="0"
                              disabled={priceDisabled}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                handlePriceOverride(category, Number(event.target.value))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {resultBanner && (
              <Card
                className={`border ${
                  resultBanner.type === 'success'
                    ? 'border-emerald-400/70 bg-emerald-400/10'
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

            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>Results overview</CardTitle>
                <CardDescription>
                  Solver highlights the lowest total fabrication cost configuration while waste metrics remain
                  visible but secondary.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total fabrication cost</p>
                    <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(totalFabricationCost)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Material cost</p>
                    <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(totalMaterialCost)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total non-material cost</p>
                    <p className="text-xl font-semibold text-foreground">
                      {formatCurrencyValue(totalNonMaterialCost)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Waste %</p>
                    <p className="text-xl font-semibold text-muted-foreground">{formatPercentValue(wastePct)}</p>
                    <p className="text-xs text-muted-foreground">Material waste is secondary to cost.</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Utilization %</p>
                    <p className="text-xl font-semibold text-foreground">{formatPercentValue(utilizationPct)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sheet count</p>
                    <p className="text-xl font-semibold text-foreground">{sheetCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Estimated sale price</p>
                    <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(estimatedSalePrice)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Profit</p>
                    <p className="text-xl font-semibold text-foreground">{formatCurrencyValue(profit)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Margin %</p>
                    <p className="text-xl font-semibold text-foreground">{formatPercentValue(planterInput.marginPct)}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sale price margin</p>
                    <p className="text-xl font-semibold text-foreground">{salePriceMarginDisplay}</p>
                    <p className="text-xs text-muted-foreground">{salePriceMarginNote}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sale price vs estimate</p>
                    <div className="flex items-center gap-2">
                      {salePriceDeltaIcon}
                      <p className={`text-lg font-semibold ${salePriceDeltaColorClass}`}>
                        {formatCurrencyValue(Math.abs(salePriceDelta))}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{salePriceDeltaCopy}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Sale price = total fabrication cost / (1 - margin %)</p>
              </CardContent>
            </Card>

            <Card className="space-y-3">
              <CardHeader>
                <CardTitle>Detailed cost breakdown</CardTitle>
                <CardDescription>
                  Material and fabrication tiers are shown alongside liner/add-on costs. Tier selections follow the
                  calculated volume.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="border border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Tier used</TableHead>
                      <TableHead>Base price</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-semibold text-foreground">{row.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.tierUsed}</TableCell>
                        <TableCell>{formatCurrencyValue(row.price)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="space-y-3">
              <CardHeader>
                <CardTitle>Sheet breakdown</CardTitle>
                <CardDescription>
                  Each sheet type's utilization, unused material, and per-sheet cost encourage deterministic reuse and
                  transparency.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sheetSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Run Calculate + Generate to collect sheet usage data.</p>
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
              </CardContent>
            </Card>

            <CutPlanView sheetUsages={solverResult?.sheetUsages ?? []} formatCurrency={formatCurrencyValue} />

            <Card className="space-y-3">
              <CardHeader>
                <CardTitle>Structural cost summary</CardTitle>
                <CardDescription>
                  Split totals keep planter (material + core fabrication), liner, and add-ons obvious before the combined
                  total.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Planter cost</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(planterStructuralCost)}</p>
                    <p className="text-xs text-muted-foreground">Material plus core fabrication categories.</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Liner cost</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(linerStructuralCost)}</p>
                    <p className="text-xs text-muted-foreground">Liner labor only.</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Add-on cost</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(addOnStructuralCost)}</p>
                    <p className="text-xs text-muted-foreground">Weight plate extras.</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Combined total</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrencyValue(combinedStructuralTotal)}</p>
                    <p className="text-xs text-muted-foreground">Matches total fabrication cost.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="space-y-6">
            <Card className="space-y-4">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Cost thresholds</CardTitle>
                  <CardDescription>
                    Volume thresholds drive which tier applies for each fabrication category.
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
                                value={thresholds[category].lowThreshold}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'lowThreshold', Number(event.target.value))
                                }
                              />
                              <Label htmlFor={`${category}-lowPrice`}>Price</Label>
                              <Input
                                id={`${category}-lowPrice`}
                                type="number"
                                min="0"
                                step="1"
                                value={thresholds[category].lowPrice}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'lowPrice', Number(event.target.value))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`${category}-mediumThreshold`}>Threshold</Label>
                              <Input
                                id={`${category}-mediumThreshold`}
                                type="number"
                                min="0"
                                step="100"
                                value={thresholds[category].mediumThreshold}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'mediumThreshold', Number(event.target.value))
                                }
                              />
                              <Label htmlFor={`${category}-mediumPrice`}>Price</Label>
                              <Input
                                id={`${category}-mediumPrice`}
                                type="number"
                                min="0"
                                step="1"
                                value={thresholds[category].mediumPrice}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'mediumPrice', Number(event.target.value))
                                }
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
                                value={thresholds[category].highPrice}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleThresholdChange(category, 'highPrice', Number(event.target.value))
                                }
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleToggleEnforceQuantity(true)}>
                      Enforce all quantities
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleEnforceQuantity(false)}>
                      Allow unlimited
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleResetSheetInventory}>
                    Reset inventory
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-1">
                    <Label htmlFor="sheet-mode">Sheet selection mode</Label>
                    <Select value={sheetMode} onValueChange={(value) => setSheetMode(value as 'auto' | 'manual')}>
                      <SelectTrigger id="sheet-mode" className="w-full">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual (use these sheets only)</SelectItem>
                        <SelectItem value="auto">Auto (solver may reorder)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manual mode restricts the solver to this list and honors each quantity; auto mode will still prefer the cheapest configured rows.
                  </p>
                </div>
                <div className="space-y-4">
                  {sheetInventory.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
                    >
                      <div className="space-y-1">
                        <Label htmlFor={`${row.id}-name`}>Sheet name</Label>
                        <Input
                          id={`${row.id}-name`}
                          type="text"
                          value={row.name}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleSheetNameChange(row.id, event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${row.id}-width`}>Width (in)</Label>
                        <Input
                          id={`${row.id}-width`}
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.width}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleSheetDimensionChange(row.id, 'width', Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${row.id}-height`}>Height (in)</Label>
                        <Input
                          id={`${row.id}-height`}
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.height}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleSheetDimensionChange(row.id, 'height', Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${row.id}-cost`}>Cost / sqft</Label>
                        <Input
                          id={`${row.id}-cost`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.costPerSqft}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleSheetCostChange(row.id, Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${row.id}-quantity`} className="flex items-center gap-2">
                          Quantity available
                          <Checkbox
                            id={`${row.id}-limit`}
                            checked={row.limitQuantity}
                            onCheckedChange={(value: boolean | 'indeterminate') =>
                              handleSheetLimitToggle(row.id, Boolean(value))
                            }
                          />
                          <span className="text-xs font-semibold">Enforce quantity</span>
                        </Label>
                        <Input
                          id={`${row.id}-quantity`}
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleSheetQuantityChange(row.id, Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveSheetRow(row.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
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
