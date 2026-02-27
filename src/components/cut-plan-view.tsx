import type { Placement, SheetInstanceUsage } from '@/lib/planterSolver'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type PaletteEntry = {
  background: string
  border: string
  text: string
}

const MAX_DISPLAY_DIMENSION = 500
const MIN_DISPLAY_SCALE = 0.95
const MAX_DISPLAY_SCALE = 4.25

const PANEL_PALETTE: Record<string, PaletteEntry> = {
  floor: {
    background: 'rgba(59, 130, 246, 0.25)',
    border: 'rgba(59, 130, 246, 0.85)',
    text: '#0f172a',
  },
  long: {
    background: 'rgba(79, 70, 229, 0.25)',
    border: 'rgba(79, 70, 229, 0.85)',
    text: '#312e81',
  },
  short: {
    background: 'rgba(6, 182, 212, 0.22)',
    border: 'rgba(6, 182, 212, 0.8)',
    text: '#0f172a',
  },
  liner: {
    background: 'rgba(34, 197, 94, 0.28)',
    border: 'rgba(16, 185, 129, 0.95)',
    text: '#064e3b',
  },
  shelf: {
    background: 'rgba(251, 113, 133, 0.35)',
    border: 'rgba(220, 38, 38, 0.9)',
    text: '#7f1d1d',
  },
  other: {
    background: 'rgba(148, 163, 184, 0.25)',
    border: 'rgba(148, 163, 184, 0.85)',
    text: '#0f172a',
  },
}

const LEGEND_GROUPS = [
  { label: 'Floor', group: 'floor' },
  { label: 'Shelf', group: 'shelf' },
  { label: 'Long side', group: 'long' },
  { label: 'Short side', group: 'short' },
  { label: 'Liner', group: 'liner' },
]


const INCH_TO_MM = 25.4
const toDisplayDimension = (valueInInches: number, unit: 'in' | 'mm') =>
  unit === 'mm' ? valueInInches * INCH_TO_MM : valueInInches
const formatPanelLengthWidthDimensions = (width: number, height: number, unit: 'in' | 'mm') =>
  `${toDisplayDimension(width, unit).toFixed(1)} ${unit} × ${toDisplayDimension(height, unit).toFixed(1)} ${unit}`
const formatDisplaySheetDimensions = (width: number, height: number, unit: 'in' | 'mm') =>
  `${toDisplayDimension(width, unit).toFixed(2)} ${unit} × ${toDisplayDimension(height, unit).toFixed(2)} ${unit}`

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const computeSheetScale = (sheet: SheetInstanceUsage, maxDisplayDimension: number) => {
  const maxDimension = Math.max(sheet.width, sheet.height, 1)
  const suggestedScale = maxDisplayDimension / maxDimension
  return Math.max(MIN_DISPLAY_SCALE, Math.min(MAX_DISPLAY_SCALE, suggestedScale))
}

const getPanelGroup = (placement: Placement) => {
  if (placement.isLiner || placement.panelType === 'liner' || placement.panelId.includes('liner')) {
    return 'liner'
  }
  if (placement.panelType === 'shelf' || placement.panelId.includes('shelf')) {
    return 'shelf'
  }
  if (
    placement.panelType === 'floor' ||
    placement.panelId.includes('floor') ||
    placement.panelId.includes('bottom')
  ) {
    return 'floor'
  }
  if (placement.panelId.includes('long')) {
    return 'long'
  }
  if (placement.panelId.includes('short')) {
    return 'short'
  }
  return 'other'
}

const getPlacementStyle = (placement: Placement): PaletteEntry => {
  const group = getPanelGroup(placement)
  return PANEL_PALETTE[group] ?? PANEL_PALETTE.other
}

type CutPlanViewProps = {
  sheetUsages: SheetInstanceUsage[]
  formatCurrency: (value: number) => string
  measurementUnit: 'in' | 'mm'
  compact?: boolean
}

export default function CutPlanView({ sheetUsages, formatCurrency, measurementUnit, compact = false }: CutPlanViewProps) {
  if (!sheetUsages.length) {
    return (
      <Card className="space-y-3">
        <CardHeader>
          <CardTitle>Cut plan</CardTitle>
          <CardDescription>
            Visualizes how the solver nests panels on each sheet to minimize material cost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run Calculate to see the cut plan for the chosen inventory.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>Cut plan</CardTitle>
        <CardDescription>
          Each sheet card shows how panels stack and ties the layout back to the lowest material cost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sheetUsages.map((sheet) => {
          const scale = computeSheetScale(sheet, compact ? MAX_DISPLAY_DIMENSION * 0.58 : MAX_DISPLAY_DIMENSION)
          const displayWidth = sheet.width * scale
          const displayHeight = sheet.height * scale
          const sheetAreaSqft = (sheet.width * sheet.height) / 144
          const usedSqft = sheet.areaUsedSqft
          const utilizationPct = sheetAreaSqft ? (usedSqft / sheetAreaSqft) * 100 : 0
          const sheetCost = sheetAreaSqft * sheet.costPerSqft

          const sortedPlacements = [...sheet.placements].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y
            return a.x - b.x
          })

          return (
        <div
          key={sheet.id}
          className={`cut-plan-sheet space-y-4 border border-border/60 bg-muted/40 p-4 shadow-sm ${
            compact ? 'text-xs' : ''
          }`}
        >
              <div className={`flex gap-4 ${compact ? 'flex-row items-start' : 'flex-col lg:flex-row'}`}>
                <div className="flex flex-1 flex-col gap-3">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sheet type</p>
                      <p className="text-lg font-semibold text-foreground">{sheet.name}</p>
                      <p className="text-xs text-muted-foreground">Instance {sheet.id}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {sortedPlacements.length} panels · {formatDisplaySheetDimensions(sheet.width, sheet.height, measurementUnit)}
                    </p>
                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                      <div>
                        <p className="text-[0.72rem] uppercase tracking-[0.25em]">Cost / sheet</p>
                        <p className="text-base font-semibold text-foreground">{formatCurrency(sheetCost)}</p>
                      </div>
                      <div>
                        <p className="text-[0.72rem] uppercase tracking-[0.25em]">Area used</p>
                        <p className="text-base font-semibold text-foreground">{usedSqft.toFixed(2)} sq ft</p>
                      </div>
                      <div>
                        <p className="text-[0.72rem] uppercase tracking-[0.25em]">Utilization</p>
                        <p className="text-base font-semibold text-foreground">{formatPercent(utilizationPct)}</p>
                      </div>
                    </div>
                  </div>
                  {compact ? (
                    <p className="mt-auto text-xs text-muted-foreground">
                      Panels: {sortedPlacements.map((placement) => placement.name).join(', ')}
                    </p>
                  ) : (
                    <div className="mt-auto grid gap-2.5 text-[0.9rem] text-muted-foreground max-w-3xl">
                      {sortedPlacements.map((placement) => {
                        const placementStyle = getPlacementStyle(placement)
                        return (
                          <div
                            key={`${placement.id}-detail`}
                            className="inline-flex w-fit max-w-full rounded-xl border border-border/30 bg-background/60 px-3.5 py-1.5 text-[0.9rem]"
                          >
                            <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                              <span
                                className="h-2 w-6 rounded-full border"
                                style={{
                                  backgroundColor: placementStyle.background,
                                  borderColor: placementStyle.border,
                                }}
                              />
                              {placement.name}
                              {placement.panelType === 'shelf' && <span className="text-[0.65rem] text-muted-foreground">(shelf)</span>}
                              <span className="text-sm text-muted-foreground">
                                {formatPanelLengthWidthDimensions(
                                  placement.width,
                                  placement.height,
                                  measurementUnit,
                                )}
                              </span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-end justify-center">
                  <div
                    className="cut-plan-canvas relative overflow-hidden border border-border/70 bg-background shadow-inner"
                    style={{
                      width: `${displayWidth}px`,
                      height: `${displayHeight}px`,
                      minWidth: compact ? 180 : 280,
                      minHeight: compact ? 180 : 280,
                    }}
                  >
                    {sortedPlacements.map((placement) => {
                      const placementStyle = getPlacementStyle(placement)
                      const panelDisplayWidth = placement.width * scale
                      const panelDisplayHeight = placement.height * scale
                      const minPanelSide = Math.min(panelDisplayWidth, panelDisplayHeight)
                      const panelFontSize = Math.max(7, Math.min(compact ? 10 : 11, minPanelSide * (compact ? 0.16 : 0.14)))
                      const showDimensions = minPanelSide >= (compact ? 28 : 34)
                      return (
                    <div
                      key={placement.id}
                      className="absolute flex flex-col justify-between overflow-hidden border px-1.5 pb-1 pt-1.5 leading-none"
                          style={{
                            left: `${placement.x * scale}px`,
                            top: `${placement.y * scale}px`,
                            width: `${panelDisplayWidth}px`,
                            height: `${panelDisplayHeight}px`,
                            background: placementStyle.background,
                            borderColor: placementStyle.border,
                            color: placementStyle.text,
                            fontSize: `${panelFontSize}px`,
                          }}
                        >
                          <span className="whitespace-normal break-words font-semibold tracking-tight">{placement.name}</span>
                          {showDimensions && (
                            <span className="whitespace-normal break-words">
                              {formatPanelLengthWidthDimensions(
                                placement.width,
                                placement.height,
                                measurementUnit,
                              )}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {!sortedPlacements.length && (
                      <p className="absolute inset-0 flex items-center justify-center text-[0.65rem] text-muted-foreground">
                        No placements recorded.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div
          className={`flex flex-wrap gap-3 uppercase tracking-[0.3em] text-muted-foreground ${
            compact ? 'text-[0.55rem]' : 'text-[0.65rem]'
          }`}
        >
          {LEGEND_GROUPS.map((entry) => {
            const palette = PANEL_PALETTE[entry.group] ?? PANEL_PALETTE.other
            return (
              <div key={entry.label} className="flex items-center gap-2">
                <span
                  className="h-2 w-7 rounded-full border"
                  style={{
                    backgroundColor: palette.background,
                    borderColor: palette.border,
                  }}
                />
                <span className={compact ? 'text-[0.55rem] text-muted-foreground' : 'text-[0.65rem] text-muted-foreground'}>
                  {entry.label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}


