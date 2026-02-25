import type { CostBreakdownPreview, PlanterInput } from '@/types'

export type FabricationDimensions = {
  length: number
  width: number
  height: number
}

export type SheetInventoryRow = {
  id: string
  name: string
  width: number
  height: number
  costPerSqft: number
  quantity: number
  limitQuantity: boolean
}

export type SheetInstanceUsage = {
  id: string
  rowId: string
  name: string
  width: number
  height: number
  costPerSqft: number
  placements: Placement[]
  areaUsedSqft: number
}

export type Placement = {
  id: string
  candidateId: string
  panelId: string
  sheetInstanceId: string
  rowId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
  isBundle: boolean
}

export type SolverResult = {
  placements: Placement[]
  sheetUsages: SheetInstanceUsage[]
  totalMaterialCost: number
  totalFabricationCost: number
  materialAreaSqft: number
  bundleSavings: number
  linerAreaSqft: number
  linerExtraCost: number
  doubleBottomExtraCost: number
  solverTimestamp: string
}

export type SolverOptions = {
  inventory?: SheetInventoryRow[]
  mode?: 'auto' | 'manual'
  manualRowOrder?: string[]
  linerHeightPercent?: number
}

const LINER_HEIGHT_PERCENT = 0.5
const LINER_EXTRA_LABOR_PER_SQFT = 4.25
const DOUBLE_BOTTOM_LABOR = 120
const BUNDLE_SHARED_EDGE_SAVINGS_PER_INCH = 0.4

export const DEFAULT_SHEET_INVENTORY: SheetInventoryRow[] = [
  {
    id: 'sheet-4x8-2-73',
    name: "4' × 8' @ $2.73",
    width: 48,
    height: 96,
    costPerSqft: 2.73,
    quantity: 10,
    limitQuantity: true,
  },
  {
    id: 'sheet-4x8-3-45',
    name: "4' × 8' @ $3.45",
    width: 48,
    height: 96,
    costPerSqft: 3.45,
    quantity: 10,
    limitQuantity: true,
  },
  {
    id: 'sheet-4x8-5-1',
    name: "4' × 8' @ $5.10",
    width: 48,
    height: 96,
    costPerSqft: 5.1,
    quantity: 10,
    limitQuantity: true,
  },
  {
    id: 'sheet-4x8-9-25',
    name: "4' × 8' @ $9.25",
    width: 48,
    height: 96,
    costPerSqft: 9.25,
    quantity: 6,
    limitQuantity: true,
  },
  {
    id: 'sheet-4x8-20-5',
    name: "4' × 8' @ $20.50",
    width: 48,
    height: 96,
    costPerSqft: 20.5,
    quantity: 4,
    limitQuantity: true,
  },
  {
    id: 'sheet-5x10-3-25',
    name: "5' × 10' @ $3.25",
    width: 60,
    height: 120,
    costPerSqft: 3.25,
    quantity: 6,
    limitQuantity: true,
  },
  {
    id: 'sheet-5x12-15',
    name: "5' × 12' @ $15.00",
    width: 60,
    height: 144,
    costPerSqft: 15,
    quantity: 3,
    limitQuantity: true,
  },
]

type PanelBlueprint = {
  id: string
  name: string
  width: number
  height: number
  type: 'bottom' | 'long' | 'short' | 'liner'
  isLiner: boolean
}

type Candidate = {
  id: string
  name: string
  panels: PanelBlueprint[]
  totalArea: number
  longestSide: number
  costImpact: number
  bundleSavings: number
  isBundle: boolean
}

type SheetInstance = {
  id: string
  rowId: string
  name: string
  width: number
  height: number
  costPerSqft: number
  placements: Placement[]
  usedAreaIn2: number
}

export function buildFabricationDimensions(input: PlanterInput): FabricationDimensions {
  return {
    length: input.length + input.lip,
    width: input.width + input.lip,
    height: input.height + input.lip,
  }
}

export function runPlanterSolver({
  planterInput,
  fabricationDims,
  breakdowns,
  options,
}: {
  planterInput: PlanterInput
  fabricationDims: FabricationDimensions
  breakdowns: CostBreakdownPreview[]
  options?: SolverOptions
}): SolverResult {
  const linerHeightPercent = options?.linerHeightPercent ?? LINER_HEIGHT_PERCENT
  const inventory = options?.inventory ?? DEFAULT_SHEET_INVENTORY

  const sheetRows = buildOrderedSheetRows(inventory, options)
  if (sheetRows.length === 0) {
    throw new Error('No sheet inventory provided to the solver.')
  }

  const panels = buildPanels(fabricationDims, planterInput, linerHeightPercent)
  const cheapestCostPerSqft = Math.min(...sheetRows.map((row) => row.costPerSqft))
  const { singleCandidates, bundleCandidates } = buildCandidates(panels, fabricationDims, cheapestCostPerSqft)

  const candidateQueue = [
    ...bundleCandidates.sort(compareCandidates),
    ...singleCandidates.sort(compareCandidates),
  ]

  const sheetInstances: SheetInstance[] = []
  const rowUsage: Record<string, number> = {}
  const placements: Placement[] = []
  const placedPanels = new Set<string>()
  let bundleSavings = 0

  for (const candidate of candidateQueue) {
    if (candidate.panels.some((panel) => placedPanels.has(panel.id))) {
      continue
    }

    const commit = placeCandidateOnSheets(candidate, sheetInstances, sheetRows, rowUsage)

    if (!commit) {
      continue
    }

    for (const placed of commit) {
      placements.push(placed)
      const panelId = placed.panelId
      placedPanels.add(panelId)
    }

    bundleSavings += candidate.bundleSavings
  }

  const sheetUsages = sheetInstances.map((instance) => ({
    id: instance.id,
    rowId: instance.rowId,
    name: instance.name,
    width: instance.width,
    height: instance.height,
    costPerSqft: instance.costPerSqft,
    placements: [...instance.placements],
    areaUsedSqft: instance.usedAreaIn2 / 144,
  }))

  const materialAreaSqft = placements.reduce((total, placement) => {
    return (total += (placement.width * placement.height) / 144)
  }, 0)

  const totalMaterialCost = sheetUsages.reduce((total, usage) => {
    return (total += usage.areaUsedSqft * usage.costPerSqft)
  }, 0)

  const baseFabricationCost = breakdowns.reduce((total, row) => total + row.price, 0)
  const linerAreaSqft = panels
    .filter((panel) => panel.isLiner)
    .reduce((total, panel) => total + panel.width * panel.height, 0) / 144
  const linerExtraCost = linerAreaSqft * LINER_EXTRA_LABOR_PER_SQFT
  const doubleBottomExtraCost = planterInput.doubleBottomEnabled ? DOUBLE_BOTTOM_LABOR : 0
  const totalFabricationCost =
    totalMaterialCost + baseFabricationCost + linerExtraCost + doubleBottomExtraCost

  return {
    placements,
    sheetUsages,
    totalMaterialCost,
    totalFabricationCost,
    materialAreaSqft,
    bundleSavings,
    linerAreaSqft,
    linerExtraCost,
    doubleBottomExtraCost,
    solverTimestamp: new Date().toISOString(),
  }
}

function buildPanels(
  fabrication: FabricationDimensions,
  input: PlanterInput,
  linerHeightPercent: number,
): PanelBlueprint[] {
  const panels: PanelBlueprint[] = [
    {
      id: 'panel-bottom',
      name: 'Bottom',
      width: fabrication.width,
      height: fabrication.length,
      type: 'bottom',
      isLiner: false,
    },
    {
      id: 'panel-long-a',
      name: 'Long A',
      width: fabrication.length,
      height: fabrication.height,
      type: 'long',
      isLiner: false,
    },
    {
      id: 'panel-long-b',
      name: 'Long B',
      width: fabrication.length,
      height: fabrication.height,
      type: 'long',
      isLiner: false,
    },
    {
      id: 'panel-short-a',
      name: 'Short A',
      width: fabrication.width,
      height: fabrication.height,
      type: 'short',
      isLiner: false,
    },
    {
      id: 'panel-short-b',
      name: 'Short B',
      width: fabrication.width,
      height: fabrication.height,
      type: 'short',
      isLiner: false,
    },
  ]

  if (input.doubleBottomEnabled) {
    panels.push({
      id: 'panel-bottom-2',
      name: 'Bottom 2',
      width: fabrication.width,
      height: fabrication.length,
      type: 'bottom',
      isLiner: false,
    })
  }

  if (input.linerEnabled) {
    const linerLength = Math.max(input.length - input.linerDepth, 0)
    const linerWidth = Math.max(input.width - input.linerDepth, 0)
    const linerHeight = Math.max(input.height * linerHeightPercent, 0)

    if (linerLength > 0 && linerWidth > 0 && linerHeight > 0) {
      panels.push(
        {
          id: 'panel-liner-bottom',
          name: 'Liner Bottom',
          width: linerWidth,
          height: linerLength,
          type: 'bottom',
          isLiner: true,
        },
        {
          id: 'panel-liner-long-a',
          name: 'Liner Long A',
          width: linerLength,
          height: linerHeight,
          type: 'long',
          isLiner: true,
        },
        {
          id: 'panel-liner-long-b',
          name: 'Liner Long B',
          width: linerLength,
          height: linerHeight,
          type: 'long',
          isLiner: true,
        },
        {
          id: 'panel-liner-short-a',
          name: 'Liner Short A',
          width: linerWidth,
          height: linerHeight,
          type: 'short',
          isLiner: true,
        },
        {
          id: 'panel-liner-short-b',
          name: 'Liner Short B',
          width: linerWidth,
          height: linerHeight,
          type: 'short',
          isLiner: true,
        },
      )
    }
  }

  return panels
}

function buildCandidates(
  panels: PanelBlueprint[],
  dims: FabricationDimensions,
  baseCostPerSqft: number,
): { singleCandidates: Candidate[]; bundleCandidates: Candidate[] } {
  const panelMap = new Map(panels.map((panel) => [panel.id, panel]))
  const singles: Candidate[] = panels.map((panel) => ({
    id: `candidate-${panel.id}`,
    name: panel.name,
    panels: [panel],
    totalArea: panel.width * panel.height,
    longestSide: Math.max(panel.width, panel.height),
    costImpact: (panel.width * panel.height) / 144 * baseCostPerSqft,
    bundleSavings: 0,
    isBundle: false,
  }))

  const bundles: Candidate[] = []
  const adjacency: Array<{ anchor: string; partner: string; label: string; sharedEdge: number }> = [
    { anchor: 'panel-bottom', partner: 'panel-long-a', label: 'Bottom + Long A', sharedEdge: dims.length },
    { anchor: 'panel-bottom', partner: 'panel-long-b', label: 'Bottom + Long B', sharedEdge: dims.length },
    { anchor: 'panel-bottom', partner: 'panel-short-a', label: 'Bottom + Short A', sharedEdge: dims.width },
    { anchor: 'panel-bottom', partner: 'panel-short-b', label: 'Bottom + Short B', sharedEdge: dims.width },
  ]

  for (const { anchor, partner, label, sharedEdge } of adjacency) {
    const anchorPanel = panelMap.get(anchor)
    const partnerPanel = panelMap.get(partner)
    if (!anchorPanel || !partnerPanel) {
      continue
    }

    const areaSum = anchorPanel.width * anchorPanel.height + partnerPanel.width * partnerPanel.height
    const baseImpact = (areaSum / 144) * baseCostPerSqft
    const bundleDiscount =
      ((sharedEdge * BUNDLE_SHARED_EDGE_SAVINGS_PER_INCH) / 144) * baseCostPerSqft
    if (bundleDiscount <= 0) {
      continue
    }

    const bundleImpact = Math.max(baseImpact - bundleDiscount, 0)
    const singleCosts = ((anchorPanel.width * anchorPanel.height) / 144) * baseCostPerSqft +
      ((partnerPanel.width * partnerPanel.height) / 144) * baseCostPerSqft
    if (bundleImpact >= singleCosts) {
      continue
    }

    bundles.push({
      id: `bundle-${anchor}-${partner}`,
      name: label,
      panels: [anchorPanel, partnerPanel],
      totalArea: areaSum,
      longestSide: Math.max(
        anchorPanel.width,
        anchorPanel.height,
        partnerPanel.width,
        partnerPanel.height,
      ),
      costImpact: bundleImpact,
      bundleSavings: singleCosts - bundleImpact,
      isBundle: true,
    })
  }

  return { singleCandidates: singles, bundleCandidates: bundles }
}

function compareCandidates(a: Candidate, b: Candidate) {
  if (a.costImpact !== b.costImpact) return a.costImpact - b.costImpact
  if (a.totalArea !== b.totalArea) return a.totalArea - b.totalArea
  if (a.longestSide !== b.longestSide) return a.longestSide - b.longestSide
  return a.name.localeCompare(b.name)
}

function buildOrderedSheetRows(inventory: SheetInventoryRow[], options?: SolverOptions) {
  if (options?.mode === 'manual' && options.manualRowOrder?.length) {
    return options.manualRowOrder
      .map((rowId) => inventory.find((row) => row.id === rowId))
      .filter((row): row is SheetInventoryRow => Boolean(row))
  }

  return [...inventory].sort((a, b) => {
    if (a.costPerSqft !== b.costPerSqft) {
      return a.costPerSqft - b.costPerSqft
    }
    return a.id.localeCompare(b.id)
  })
}

function placeCandidateOnSheets(
  candidate: Candidate,
  sheetInstances: SheetInstance[],
  sheetRows: SheetInventoryRow[],
  rowUsage: Record<string, number>,
): Placement[] | null {
  for (const instance of sheetInstances) {
    const attempt = tryPlaceCandidate(instance, candidate)
    if (attempt) {
      instance.placements.push(...attempt)
      instance.usedAreaIn2 += attempt.reduce((sum, placement) => sum + placement.width * placement.height, 0)
      return attempt
    }
  }

  for (const row of sheetRows) {
    const usage = rowUsage[row.id] ?? 0
    const limitActive = row.limitQuantity
    const limit = limitActive ? Math.max(0, row.quantity) : Infinity
    if (usage >= limit) {
      continue
    }

    const sheetInstance: SheetInstance = {
      id: `${row.id}-${usage + 1}`,
      rowId: row.id,
      name: row.name,
      width: row.width,
      height: row.height,
      costPerSqft: row.costPerSqft,
      placements: [],
      usedAreaIn2: 0,
    }

    const attempt = tryPlaceCandidate(sheetInstance, candidate)
    if (!attempt) {
      continue
    }

    rowUsage[row.id] = usage + 1
    sheetInstance.placements.push(...attempt)
    sheetInstance.usedAreaIn2 += attempt.reduce((sum, placement) => sum + placement.width * placement.height, 0)
    sheetInstances.push(sheetInstance)
    return attempt
  }

  return null
}

function tryPlaceCandidate(sheet: SheetInstance, candidate: Candidate): Placement[] | null {
  if (candidate.panels.length === 1) {
    const panel = candidate.panels[0]
    const placement = findPlacementOnSheet(sheet, panel.width, panel.height)
    if (!placement) {
      return null
    }
    return [
      {
        ...placement,
        id: `${candidate.id}-${panel.id}`,
        candidateId: candidate.id,
        panelId: panel.id,
        name: panel.name,
        sheetInstanceId: sheet.id,
        rowId: sheet.rowId,
        rotated: placement.rotated,
        isBundle: false,
      },
    ]
  }

  const [panelA, panelB] = candidate.panels
  const panelAOrientations = getOrientations(panelA.width, panelA.height)
  const panelBOrientations = getOrientations(panelB.width, panelB.height)

  for (const orientationA of panelAOrientations) {
    const first = findPlacementOnSheet(sheet, orientationA.width, orientationA.height)
    if (!first) continue

    const simulatedPlacements = [...sheet.placements]
    const firstPlacement: Placement = {
      ...first,
      id: `${candidate.id}-${panelA.id}`,
      candidateId: candidate.id,
      panelId: panelA.id,
      name: panelA.name,
      sheetInstanceId: sheet.id,
      rowId: sheet.rowId,
      rotated: orientationA.rotated,
      isBundle: true,
    }

    for (const orientationB of panelBOrientations) {
      const second = findPlacementOnSheet(
        {
          ...sheet,
          placements: [...simulatedPlacements, firstPlacement],
        },
        orientationB.width,
        orientationB.height,
      )
      if (!second) {
        continue
      }

      const secondPlacement: Placement = {
        ...second,
        id: `${candidate.id}-${panelB.id}`,
        candidateId: candidate.id,
        panelId: panelB.id,
        name: panelB.name,
        sheetInstanceId: sheet.id,
        rowId: sheet.rowId,
        rotated: orientationB.rotated,
        isBundle: true,
      }

      return [firstPlacement, secondPlacement]
    }
  }

  return null
}

function findPlacementOnSheet(
  sheet: SheetInstance,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number; rotated: boolean } | null {
  const xOptions = new Set<number>([0])
  const yOptions = new Set<number>([0])

  for (const placement of sheet.placements) {
    xOptions.add(placement.x + placement.width)
    yOptions.add(placement.y + placement.height)
  }

  const sortedX = [...xOptions].sort((a, b) => a - b)
  const sortedY = [...yOptions].sort((a, b) => a - b)

  const orientations = getOrientations(width, height)

  for (const candidate of orientations) {
    for (const y of sortedY) {
      if (y + candidate.height > sheet.height) {
        continue
      }
      for (const x of sortedX) {
        if (x + candidate.width > sheet.width) {
          continue
        }
        const overlaps = sheet.placements.some((existing) =>
          rectanglesOverlap(x, y, candidate.width, candidate.height, existing.x, existing.y, existing.width, existing.height),
        )
        if (!overlaps) {
          return { x, y, width: candidate.width, height: candidate.height, rotated: candidate.rotated }
        }
      }
    }
  }

  return null
}

function getOrientations(width: number, height: number) {
  const options = [{ width, height, rotated: false }]
  if (width !== height) {
    options.push({ width: height, height: width, rotated: true })
  }
  return options
}

function rectanglesOverlap(
  x: number,
  y: number,
  width: number,
  height: number,
  ox: number,
  oy: number,
  owidth: number,
  oheight: number,
) {
  return !(x + width <= ox || ox + owidth <= x || y + height <= oy || oy + oheight <= y)
}
