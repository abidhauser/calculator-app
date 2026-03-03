import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar'
import { calculatePergola, type PergolaInput, type PergolaType } from '@/lib/pergola/pergolaEngine'
import { cn } from '@/lib/utils'

const toFeet = (value: number, unit: 'ft' | 'mm') => (unit === 'ft' ? value : value / 304.8)

const makeDefaultInput = (): PergolaInput => ({
  dimensions: { lengthFt: 12, depthFt: 10, heightFt: 9 },
  type: 'Pergola',
  electrical: 'No',
  roof: {
    material: 'Aluminum',
    orientation: 'Horizontal',
    size: '2x4',
    customSize: '',
    alignment: 'Parallel to length',
    coveragePct: 80,
    gapIn: 4,
  },
  privacy: {
    material: 'Aluminum',
    orientation: 'Vertical',
    size: '2x4',
    customSize: '',
    alignment: 'Parallel to top',
    panelCountLength: 2,
    panelCountDepth: 2,
    groundClearanceIn: 4,
    topClearanceIn: 4,
    coveragePct: 70,
    gapIn: 3,
  },
})

const formatValidationLabel = (value: '<------------' | 'INVALID' | '') => {
  if (value === '<------------') return 'Valid'
  if (value === 'INVALID') return 'Invalid'
  return '-'
}
const PIECE_ROWS = [
  { key: 'verticalColumns', label: 'Vertical Columns' },
  { key: 'beamsLength', label: 'Beams on length' },
  { key: 'beamsDepth', label: 'Beams on depth' },
  { key: 'roofPurlins', label: 'Roof Purlins' },
  { key: 'sidePurlinsLength', label: 'Side Purlins on length' },
  { key: 'sidePurlinsDepth', label: 'Side Purlins on depth' },
  { key: 'standardBlocks', label: 'Standard Blocks' },
  { key: 'feet', label: 'Feet' },
  { key: 'endCaps', label: 'End Caps' },
  { key: 'canopies', label: 'Canopies' },
] as const

type PieceCountKey = (typeof PIECE_ROWS)[number]['key']
type PieceCounts = ReturnType<typeof calculatePergola>['pieceCounts']

const PergolaCalculator = () => {
  const [unit, setUnit] = useState<'ft' | 'mm'>('ft')
  const [input, setInput] = useState<PergolaInput>(makeDefaultInput)
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'settings'>('input')
  const [pieceQtyEdits, setPieceQtyEdits] = useState<Partial<Record<PieceCountKey, string>>>({})

  const result = useMemo(() => calculatePergola(input), [input])

  const effectivePieceCounts = useMemo<PieceCounts>(() => {
    const base = result.pieceCounts
    const next = { ...base } as Record<PieceCountKey, number | null>

    for (const row of PIECE_ROWS) {
      const raw = pieceQtyEdits[row.key]
      if (raw === undefined) continue
      const trimmed = raw.trim()
      if (trimmed === '') {
        next[row.key] = null
        continue
      }
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) {
        next[row.key] = parsed
      }
    }

    return next as PieceCounts
  }, [pieceQtyEdits, result.pieceCounts])

  const resetAll = () => {
    setInput(makeDefaultInput())
    setPieceQtyEdits({})
  }

  const setDimension = (key: keyof PergolaInput['dimensions'], raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    setInput((prev) => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [key]: toFeet(parsed, unit),
      },
    }))
  }

  const dimensionDisplay = (valueFt: number) =>
    unit === 'ft' ? valueFt.toString() : Math.round(valueFt * 304.8).toString()

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'input' | 'results' | 'settings')} className="space-y-6">
          <div className="space-y-3 bg-background py-3">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Fabrication cost engine</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-semibold text-foreground">Pergola</h1>
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
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Length ({unit})</Label>
                    <Input value={dimensionDisplay(input.dimensions.lengthFt)} onChange={(e) => setDimension('lengthFt', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Depth ({unit})</Label>
                    <Input value={dimensionDisplay(input.dimensions.depthFt)} onChange={(e) => setDimension('depthFt', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Height ({unit})</Label>
                    <Input value={dimensionDisplay(input.dimensions.heightFt)} onChange={(e) => setDimension('heightFt', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={input.type} onValueChange={(value) => setInput((prev) => ({ ...prev, type: value as PergolaType }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pergola">Pergola</SelectItem>
                        <SelectItem value="Grand Pergola">Grand Pergola</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Electrical</Label>
                    <Select value={input.electrical} onValueChange={(value) => setInput((prev) => ({ ...prev, electrical: value as 'Yes' | 'No' }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Roof Purlins</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <Field label="Material" value={input.roof.material} onChange={(v) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, material: v as PergolaInput['roof']['material'] } }))} options={['Aluminum', 'Alumiwood', 'Cedar']} />
                      <Field label="Orientation" value={input.roof.orientation} onChange={(v) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, orientation: v as PergolaInput['roof']['orientation'] } }))} options={['Horizontal', 'Vertical']} />
                      <Field label="Size" value={input.roof.size} onChange={(v) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, size: v } }))} options={result.availableRoofSizes} />
                      <div className="space-y-2">
                        <Label>Custom Size (AxB)</Label>
                        <Input value={input.roof.customSize} onChange={(e) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, customSize: e.target.value } }))} placeholder="optional" />
                      </div>
                      <Field label="Alignment" value={input.roof.alignment} onChange={(v) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, alignment: v as PergolaInput['roof']['alignment'] } }))} options={['Parallel to length', 'Parallel to depth']} />
                      <NumberField label="Coverage (%)" value={input.roof.coveragePct} onChange={(v) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, coveragePct: v } }))} />
                      <NumberField label="Gap (in)" value={input.roof.gapIn} onChange={(v) => setInput((prev) => ({ ...prev, roof: { ...prev.roof, gapIn: v } }))} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Privacy Panel Purlins</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <Field label="Material" value={input.privacy.material} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, material: v as PergolaInput['privacy']['material'] } }))} options={['Aluminum', 'Alumiwood', 'Cedar']} />
                      <Field label="Orientation" value={input.privacy.orientation} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, orientation: v as PergolaInput['privacy']['orientation'] } }))} options={['Horizontal', 'Vertical']} />
                      <Field label="Size" value={input.privacy.size} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, size: v } }))} options={result.availablePrivacySizes} />
                      <div className="space-y-2">
                        <Label>Custom Size (AxB)</Label>
                        <Input value={input.privacy.customSize} onChange={(e) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, customSize: e.target.value } }))} placeholder="optional" />
                      </div>
                      <Field label="Alignment" value={input.privacy.alignment} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, alignment: v as PergolaInput['privacy']['alignment'] } }))} options={['Parallel to top', 'Parallel to height']} />
                      <NumberField label="# Panels on length" value={input.privacy.panelCountLength} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, panelCountLength: v } }))} />
                      <NumberField label="# Panels on depth" value={input.privacy.panelCountDepth} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, panelCountDepth: v } }))} />
                      <NumberField label="Ground clearance (in)" value={input.privacy.groundClearanceIn} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, groundClearanceIn: v } }))} />
                      <NumberField label="Top clearance (in)" value={input.privacy.topClearanceIn} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, topClearanceIn: v } }))} />
                      <NumberField label="Coverage (%)" value={input.privacy.coveragePct} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, coveragePct: v } }))} />
                      <NumberField label="Gap (in)" value={input.privacy.gapIn} onChange={(v) => setInput((prev) => ({ ...prev, privacy: { ...prev.privacy, gapIn: v } }))} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Piece Breakdown</CardTitle>
                    <CardDescription>Qty column is editable from Inputs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part</TableHead>
                          <TableHead>Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PIECE_ROWS.map((row) => {
                          const baseValue = result.pieceCounts[row.key]
                          const currentValue = pieceQtyEdits[row.key] ?? (baseValue == null ? '' : String(baseValue))

                          return (
                            <TableRow key={row.key}>
                              <TableCell>{row.label}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={currentValue}
                                  onChange={(event) =>
                                    setPieceQtyEdits((prev) => ({
                                      ...prev,
                                      [row.key]: event.target.value,
                                    }))
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

                <div className="flex justify-end">
                  <Button type="button" onClick={() => setActiveTab('results')}>View results</Button>
                </div>
              </TabsContent>

              <TabsContent value="results" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <ReadField label="Suggested Type" value={result.suggestedType} />
                  <ReadField label="Beam Size" value={result.beamSize} />
                  <ReadField label="Roof # Required" value={result.roofPurlinsRequired ?? '-'} />
                  <ReadField label="Side # Required (Length/Depth)" value={`${result.sidePurlinsLengthRequired ?? '-'} / ${result.sidePurlinsDepthRequired ?? '-'}`} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Piece Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Part</TableHead>
                            <TableHead>Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {PIECE_ROWS.map((row) => (
                            <TableRow key={row.key}>
                              <TableCell>{row.label}</TableCell>
                              <TableCell>{effectivePieceCounts[row.key] ?? '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Pricing Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ReadField label="Roof size validation" value={formatValidationLabel(result.roofSizeValidity)} />
                      <ReadField label="Privacy size validation" value={formatValidationLabel(result.privacySizeValidity)} />
                      <ReadField label="Column/Beam thickness" value={result.thickness.columnBeam ?? '-'} />
                      <ReadField label="Roof thickness" value={result.thickness.roof} />
                      <ReadField label="Privacy thickness" value={result.thickness.privacy} />
                      <ReadField label="Total Cost" value={result.totalCost} />
                      <ReadField label="Sell (60%)" value={result.sell60} />
                      <ReadField label="Sell (50%)" value={result.sell50} />
                      {result.errors.map((error) => (
                        <p key={error} className="text-sm text-destructive">{error}</p>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Materials / Pricing Lines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.pricingRows.map((row) => (
                          <TableRow key={row.row}>
                            <TableCell>{row.row}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.quantity ?? '-'}</TableCell>
                            <TableCell>{row.unitCost ?? '-'}</TableCell>
                            <TableCell>{row.total ?? '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calculator Settings</CardTitle>
                <CardDescription>
                  Optional controls for display units and resetting all workbook-style defaults.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Units</Label>
                  <Select value={unit} onValueChange={(value) => setUnit(value as 'ft' | 'mm')}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">Feet</SelectItem>
                      <SelectItem value="mm">Millimeters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Actions</Label>
                  <Button type="button" variant="outline" onClick={resetAll}>
                    Reset all pergola inputs
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

type FieldProps = {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}

const Field = ({ label, value, options, onChange }: FieldProps) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)

type NumberFieldProps = {
  label: string
  value: number
  onChange: (value: number) => void
}

const NumberField = ({ label, value, onChange }: NumberFieldProps) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input
      type="number"
      value={value}
      onChange={(e) => {
        const parsed = Number(e.target.value)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    />
  </div>
)

const ReadField = ({ label, value }: { label: string; value: string | number }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input readOnly value={String(value)} />
  </div>
)

export default PergolaCalculator






