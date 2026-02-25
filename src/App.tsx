import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
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
  doubleBottomEnabled: false,
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
}

const categoryList: Category[] = [
  'Weld',
  'Grind',
  'Paint',
  'Assembly',
  'Saw',
  'Laser Bend',
  'Weight Plate',
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
  'linerEnabled' | 'weightPlateEnabled' | 'doubleBottomEnabled'
>
type BooleanPlanterField = 'linerEnabled' | 'weightPlateEnabled' | 'doubleBottomEnabled'
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
  const [sheetInventory, setSheetInventory] = useState<SheetInventoryRow[]>(() =>
    DEFAULT_SHEET_INVENTORY.map((row) => ({ ...row })),
  )
  const [sheetMode, setSheetMode] = useState<'auto' | 'manual'>('manual')

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

  const handleCalculate = () => {
    setCalculationError(null)
    setSolverResult(null)
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
      console.log('Solver result', result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown solver failure.'
      setCalculationError(`Solver failure: ${message}`)
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
          <p className="text-base text-muted-foreground">
            Phase 1: capture inputs, volume-driven tiers, and persistable thresholds before the solver arrives.
          </p>
        </header>

        <Tabs defaultValue="input" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-full border border-border bg-muted/60 p-1 text-sm font-medium text-muted-foreground">
            <TabsTrigger value="input" className="text-foreground">
              Input
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
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="doubleBottom"
                        checked={planterInput.doubleBottomEnabled}
                        onCheckedChange={(value: boolean | 'indeterminate') =>
                          handleCheckbox('doubleBottomEnabled', Boolean(value))
                        }
                      />
                      <Label htmlFor="doubleBottom" className="text-sm font-semibold text-foreground">
                        Double Shelf / Bottom
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
                      const priceDisabled = !isCalculated || (isWeightPlate && !planterInput.weightPlateEnabled)
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

          <TabsContent value="settings" className="space-y-6">
            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>Cost thresholds</CardTitle>
                <CardDescription>
                  Volume thresholds drive which tier applies for each fabrication category.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground md:grid-cols-[repeat(6,minmax(0,1fr))]">
                  <span className="font-semibold text-foreground">Category</span>
                  <span>Low threshold</span>
                  <span>Low price</span>
                  <span>Medium threshold</span>
                  <span>Medium price</span>
                  <span>High price</span>
                </div>
                <div className="space-y-4">
                  {categoryList.map((category) => {
                    const error = thresholdErrors[category]
                    return (
                      <div
                        key={category}
                        className="grid gap-3 text-sm md:grid-cols-6 md:items-end"
                      >
                        <span className="font-semibold text-foreground">{category}</span>
                        <div className="space-y-1">
                          <Label htmlFor={`${category}-lowThreshold`}>Low threshold</Label>
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
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${category}-lowPrice`}>Low price</Label>
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
                          <Label htmlFor={`${category}-mediumThreshold`}>Medium threshold</Label>
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
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${category}-mediumPrice`}>Medium price</Label>
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
                          <Label htmlFor={`${category}-highPrice`}>High price</Label>
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
                        {error && (
                          <p className="md:col-span-6 text-xs text-destructive">{error}</p>
                        )}
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
              <CardHeader>
                <CardTitle>Sheet inventory</CardTitle>
                <CardDescription>
                  Solver only considers the rows below (per the dimensions/cost values) and can place multiple copies of the same sheet up to the listed quantity.
                </CardDescription>
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
