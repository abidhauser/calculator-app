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

const MAX_DISPLAY_DIMENSION = 260
const MIN_DISPLAY_SCALE = 0.55
const MAX_DISPLAY_SCALE = 2.2

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

const formatSheetDimensions = (width: number, height: number) =>
  `${width.toFixed(2)}" × ${height.toFixed(2)}"`

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const computeSheetScale = (sheet: SheetInstanceUsage) => {
  const maxDimension = Math.max(sheet.width, sheet.height, 1)
  const suggestedScale = MAX_DISPLAY_DIMENSION / maxDimension
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
}

export default function CutPlanView({ sheetUsages, formatCurrency }: CutPlanViewProps) {
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
            Run Calculate + Generate to see the cut plan for the chosen inventory.
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
          const scale = computeSheetScale(sheet)
          const displayWidth = sheet.width * scale
          const displayHeight = sheet.height * scale
          const sheetAreaSqft = (sheet.width * sheet.height) / 144
          const usedSqft = sheet.areaUsedSqft
          const unusedSqft = Math.max(sheetAreaSqft - usedSqft, 0)
          const utilizationPct = sheetAreaSqft ? (usedSqft / sheetAreaSqft) * 100 : 0
          const sheetCost = sheetAreaSqft * sheet.costPerSqft

          const sortedPlacements = [...sheet.placements].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y
            return a.x - b.x
          })

          return (
        <div key={sheet.id} className="space-y-4 border border-border/60 bg-muted/40 p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sheet type</p>
                    <p className="text-lg font-semibold text-foreground">{sheet.name}</p>
                    <p className="text-xs text-muted-foreground">Instance {sheet.id}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sortedPlacements.length} panels · {formatSheetDimensions(sheet.width, sheet.height)}
                  </p>
                  <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>
                      <p className="text-[0.6rem] uppercase tracking-[0.3em]">Cost / sheet</p>
                      <p className="text-sm text-foreground">{formatCurrency(sheetCost)}</p>
                    </div>
                    <div>
                      <p className="text-[0.6rem] uppercase tracking-[0.3em]">Area used</p>
                      <p className="text-sm text-foreground">{usedSqft.toFixed(2)} sq ft</p>
                    </div>
                    <div>
                      <p className="text-[0.6rem] uppercase tracking-[0.3em]">Utilization</p>
                      <p className="text-sm text-foreground">{formatPercent(utilizationPct)}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground sm:grid-cols-2">
                    <p>Waste {unusedSqft.toFixed(2)} sq ft</p>
                    <p>Sheet cost/sq ft {formatCurrency(sheet.costPerSqft)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-center">
                  <div
                    className="relative overflow-hidden border border-border/70 bg-background shadow-inner"
                    style={{
                      width: `${displayWidth}px`,
                      height: `${displayHeight}px`,
                      minWidth: 140,
                      minHeight: 140,
                    }}
                  >
                    {sortedPlacements.map((placement) => {
                      const placementStyle = getPlacementStyle(placement)
                      return (
                    <div
                      key={placement.id}
                      className="absolute flex flex-col justify-between border px-1 pb-0.5 pt-1 text-[0.55rem] leading-none"
                          style={{
                            left: `${placement.x * scale}px`,
                            top: `${placement.y * scale}px`,
                            width: `${placement.width * scale}px`,
                            height: `${placement.height * scale}px`,
                            background: placementStyle.background,
                            borderColor: placementStyle.border,
                            color: placementStyle.text,
                          }}
                        >
                          <span className="font-semibold tracking-tight">{placement.name}</span>
                          <span className="text-[0.5rem]">{`${placement.width.toFixed(1)}" × ${placement.height.toFixed(1)}"`}</span>
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
              <div className="grid gap-2 text-[0.7rem] text-muted-foreground max-w-2xl">
                    {sortedPlacements.map((placement) => {
                      const placementStyle = getPlacementStyle(placement)
                      return (
                        <div
                          key={`${placement.id}-detail`}
                          className="rounded-xl border border-border/30 bg-background/60 px-3 py-1 text-[0.7rem]"
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
                            {placement.isLiner && <span className="text-[0.55rem] text-muted-foreground">(liner)</span>}
                            {placement.panelType === 'shelf' && <span className="text-[0.55rem] text-muted-foreground">(shelf)</span>}
                            <span className="text-xs text-muted-foreground">
                              {placement.width.toFixed(1)}" × {placement.height.toFixed(1)}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-3 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
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
                <span className="text-[0.65rem] text-muted-foreground">{entry.label}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
