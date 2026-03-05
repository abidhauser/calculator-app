import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type TimberType = 'Cedar' | 'Pressure Treated' | 'Ipe'
type FinishType = 'Natural' | 'Stained' | 'Painted'
type MeasurementUnit = 'in' | 'mm'
type LaborItem = {
  description: string
  labourHours: string
  costPerHour: string
}

const DESCRIPTION_OPTIONS = [
  'Number or Slats (2.5 wide x 5.5 high)',
  "Number or Bases Req'd",
  'Glides',
  'Final Assy (Drill wood/oil/assy)',
  'Angle and Flatbar Material',
  'Hardware',
  '# of Backs required',
  '# of Arms required',
] as const

const CUSTOM_DESCRIPTION_VALUE = '__custom__'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const TimberBenchCalculator = () => {
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input')
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('in')
  const [lengthInches, setLengthInches] = useState(72)
  const [depthInches, setDepthInches] = useState(18)
  const [heightInches, setHeightInches] = useState(18)
  const [quantity, setQuantity] = useState('1')
  const [marginPct, setMarginPct] = useState('40')
  const [timberType, setTimberType] = useState<TimberType>('Cedar')
  const [finish, setFinish] = useState<FinishType>('Natural')
  const [backrestEnabled, setBackrestEnabled] = useState<'Yes' | 'No'>('No')
  const [armrestEnabled, setArmrestEnabled] = useState<'Yes' | 'No'>('No')
  const [laborItems, setLaborItems] = useState<LaborItem[]>([
    { description: 'Bench fabrication', labourHours: '3', costPerHour: '50' },
  ])
  const [wastePct, setWastePct] = useState('8')
  const [bufferInput, setBufferInput] = useState('')

  const displayDimension = (inches: number) =>
    measurementUnit === 'in' ? String(inches) : (inches * 25.4).toFixed(2)

  const handleDimensionChange = (setter: (value: number) => void, raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    setter(measurementUnit === 'in' ? parsed : parsed / 25.4)
  }

  const updateLaborItem = (rowIndex: number, field: keyof LaborItem, value: string) => {
    setLaborItems((previous) =>
      previous.map((item, index) => (index === rowIndex ? { ...item, [field]: value } : item)),
    )
  }

  const addLaborItemBelow = (rowIndex: number) => {
    setLaborItems((previous) => {
      const next = [...previous]
      next.splice(rowIndex + 1, 0, { description: '', labourHours: '0', costPerHour: '0' })
      return next
    })
  }

  const removeLaborItem = (rowIndex: number) => {
    setLaborItems((previous) => previous.filter((_, index) => index !== rowIndex))
  }

  const getDescriptionSelectValue = (description: string) =>
    DESCRIPTION_OPTIONS.includes(description as (typeof DESCRIPTION_OPTIONS)[number])
      ? description
      : CUSTOM_DESCRIPTION_VALUE

  const summary = useMemo(() => {
    const length = lengthInches
    const depth = depthInches
    const height = heightInches
    const qty = Math.max(Number(quantity) || 0, 0)
    const margin = Math.min(Math.max((Number(marginPct) || 0) / 100, 0), 0.99)
    const laborCostPerUnit = laborItems.reduce((sum, item) => {
      const labourHours = Math.max(Number(item.labourHours) || 0, 0)
      const costPerHour = Math.max(Number(item.costPerHour) || 0, 0)
      return sum + labourHours * costPerHour
    }, 0)
    const waste = Math.max((Number(wastePct) || 0) / 100, 0)
    const buffer = Math.max(Number(bufferInput) || 0, 0)

    const materialFactor = timberType === 'Ipe' ? 2.2 : timberType === 'Pressure Treated' ? 0.9 : 1.25
    const finishFactor = finish === 'Painted' ? 1.1 : finish === 'Stained' ? 1.06 : 1
    const backrestFactor = backrestEnabled === 'Yes' ? 1.18 : 1
    const armrestFactor = armrestEnabled === 'Yes' ? 1.08 : 1
    const volumeFactor = (length * depth * height) / 10000

    const baseMaterial = volumeFactor * 55 * materialFactor * finishFactor * backrestFactor * armrestFactor
    const unitCost = baseMaterial * (1 + waste) + laborCostPerUnit
    const totalCost = unitCost * qty
    const finalCost = totalCost + buffer
    const sellPrice = finalCost / (1 - margin)

    return { laborCostPerUnit, unitCost, totalCost, finalCost, sellPrice }
  }, [
    armrestEnabled,
    backrestEnabled,
    bufferInput,
    depthInches,
    finish,
    heightInches,
    laborItems,
    lengthInches,
    marginPct,
    quantity,
    timberType,
    wastePct,
  ])

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'input' | 'results')} className="space-y-6">
          <div className="space-y-3 bg-background py-3">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Fabrication cost engine</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-semibold text-foreground">Timber Bench</h1>
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

            <Menubar className="grid h-auto w-full grid-cols-2 rounded-full p-1">
              <MenubarMenu>
                <MenubarTrigger
                  onClick={() => setActiveTab('input')}
                  className={cn(
                    'w-full cursor-pointer justify-center rounded-full text-foreground',
                    activeTab === 'input' && 'border border-border bg-background shadow-sm',
                  )}
                >
                  Input
                </MenubarTrigger>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger
                  onClick={() => setActiveTab('results')}
                  className={cn(
                    'w-full cursor-pointer justify-center rounded-full text-foreground',
                    activeTab === 'results' && 'border border-border bg-background shadow-sm',
                  )}
                >
                  Results
                </MenubarTrigger>
              </MenubarMenu>
            </Menubar>
          </div>

          <TabsContent value="input" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bench dimensions</CardTitle>
                <CardDescription>Enter base dimensions in the selected unit.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Length ({measurementUnit})</Label>
                  <Input
                    type="number"
                    value={displayDimension(lengthInches)}
                    onChange={(event) => handleDimensionChange(setLengthInches, event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Depth ({measurementUnit})</Label>
                  <Input
                    type="number"
                    value={displayDimension(depthInches)}
                    onChange={(event) => handleDimensionChange(setDepthInches, event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height ({measurementUnit})</Label>
                  <Input
                    type="number"
                    value={displayDimension(heightInches)}
                    onChange={(event) => handleDimensionChange(setHeightInches, event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Choose timber and feature options.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Timber type</Label>
                  <Select value={timberType} onValueChange={(value) => setTimberType(value as TimberType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cedar">Cedar</SelectItem>
                      <SelectItem value="Pressure Treated">Pressure Treated</SelectItem>
                      <SelectItem value="Ipe">Ipe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Finish</Label>
                  <Select value={finish} onValueChange={(value) => setFinish(value as FinishType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Natural">Natural</SelectItem>
                      <SelectItem value="Stained">Stained</SelectItem>
                      <SelectItem value="Painted">Painted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Backrest</Label>
                  <Select value={backrestEnabled} onValueChange={(value) => setBackrestEnabled(value as 'Yes' | 'No')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Armrests</Label>
                  <Select value={armrestEnabled} onValueChange={(value) => setArmrestEnabled(value as 'Yes' | 'No')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target margin (%)</Label>
                  <Input type="number" value={marginPct} onChange={(event) => setMarginPct(event.target.value)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>Labor line items used in the unit-cost calculation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table className="border border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Description</TableHead>
                      <TableHead>Labour hours</TableHead>
                      <TableHead>Cost/hr</TableHead>
                      <TableHead>Total cost</TableHead>
                      <TableHead className="w-[110px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laborItems.map((item, rowIndex) => {
                      const labourHours = Math.max(Number(item.labourHours) || 0, 0)
                      const costPerHour = Math.max(Number(item.costPerHour) || 0, 0)
                      const totalCost = labourHours * costPerHour

                      return (
                        <TableRow key={`labor-item-${rowIndex}`}>
                          <TableCell>
                            <div className="space-y-2">
                              <Select
                                value={getDescriptionSelectValue(item.description)}
                                onValueChange={(value) =>
                                  updateLaborItem(
                                    rowIndex,
                                    'description',
                                    value === CUSTOM_DESCRIPTION_VALUE ? '' : value,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Description" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DESCRIPTION_OPTIONS.map((descriptionOption) => (
                                    <SelectItem key={descriptionOption} value={descriptionOption}>
                                      {descriptionOption}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={CUSTOM_DESCRIPTION_VALUE}>Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {getDescriptionSelectValue(item.description) === CUSTOM_DESCRIPTION_VALUE ? (
                                <Input
                                  value={item.description}
                                  onChange={(event) => updateLaborItem(rowIndex, 'description', event.target.value)}
                                  placeholder="Custom description"
                                />
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.labourHours}
                              onChange={(event) => updateLaborItem(rowIndex, 'labourHours', event.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.costPerHour}
                              onChange={(event) => updateLaborItem(rowIndex, 'costPerHour', event.target.value)}
                            />
                          </TableCell>
                          <TableCell>{formatCurrency(totalCost)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xl font-bold text-emerald-600 hover:text-emerald-700"
                                onClick={() => addLaborItemBelow(rowIndex)}
                              >
                                +
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xl font-bold text-red-600 hover:text-red-700"
                                onClick={() => removeLaborItem(rowIndex)}
                                disabled={laborItems.length === 1}
                              >
                                -
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="font-semibold">{formatCurrency(summary.laborCostPerUnit)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost summary</CardTitle>
                <CardDescription>Estimated bench pricing with labor, buffer, and margin.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Unit cost</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.unitCost)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total cost</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.totalCost)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Final cost</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.finalCost)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Suggested sell</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.sellPrice)}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </div>
  )
}

export default TimberBenchCalculator







