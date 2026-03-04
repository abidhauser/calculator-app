import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type TimberType = 'Cedar' | 'Pressure Treated' | 'Ipe'
type FinishType = 'Natural' | 'Stained' | 'Painted'
type MeasurementUnit = 'in' | 'mm'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const TimberBenchCalculator = () => {
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'settings'>('input')
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
  const [laborRatePerUnit, setLaborRatePerUnit] = useState('150')
  const [wastePct, setWastePct] = useState('8')

  const displayDimension = (inches: number) =>
    measurementUnit === 'in' ? String(inches) : (inches * 25.4).toFixed(2)

  const handleDimensionChange = (setter: (value: number) => void, raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    setter(measurementUnit === 'in' ? parsed : parsed / 25.4)
  }

  const summary = useMemo(() => {
    const length = lengthInches
    const depth = depthInches
    const height = heightInches
    const qty = Math.max(Number(quantity) || 0, 0)
    const margin = Math.min(Math.max((Number(marginPct) || 0) / 100, 0), 0.99)
    const laborRate = Math.max(Number(laborRatePerUnit) || 0, 0)
    const waste = Math.max((Number(wastePct) || 0) / 100, 0)

    const materialFactor = timberType === 'Ipe' ? 2.2 : timberType === 'Pressure Treated' ? 0.9 : 1.25
    const finishFactor = finish === 'Painted' ? 1.1 : finish === 'Stained' ? 1.06 : 1
    const backrestFactor = backrestEnabled === 'Yes' ? 1.18 : 1
    const armrestFactor = armrestEnabled === 'Yes' ? 1.08 : 1
    const volumeFactor = (length * depth * height) / 10000

    const baseMaterial = volumeFactor * 55 * materialFactor * finishFactor * backrestFactor * armrestFactor
    const unitCost = baseMaterial * (1 + waste) + laborRate
    const totalCost = unitCost * qty
    const sellPrice = totalCost / (1 - margin)

    return { unitCost, totalCost, sellPrice }
  }, [
    armrestEnabled,
    backrestEnabled,
    depthInches,
    finish,
    heightInches,
    laborRatePerUnit,
    lengthInches,
    marginPct,
    quantity,
    timberType,
    wastePct,
  ])

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'input' | 'results' | 'settings')} className="space-y-6">
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

            <Menubar className="grid h-auto w-full grid-cols-3 rounded-full p-1">
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
              <MenubarMenu>
                <MenubarTrigger
                  onClick={() => setActiveTab('settings')}
                  className={cn(
                    'w-full cursor-pointer justify-center rounded-full text-foreground',
                    activeTab === 'settings' && 'border border-border bg-background shadow-sm',
                  )}
                >
                  Settings
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
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost summary</CardTitle>
                <CardDescription>Preview from initial formulas pending Excel parity.</CardDescription>
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
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Suggested sell</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.sellPrice)}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pricing controls</CardTitle>
                <CardDescription>Temporary values until Excel mapping is implemented.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Labor rate per bench (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={laborRatePerUnit}
                    onChange={(event) => setLaborRatePerUnit(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waste factor (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={wastePct}
                    onChange={(event) => setWastePct(event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setActiveTab('input')}>
                    Return to inputs
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

export default TimberBenchCalculator

