import type { CostBreakdownPreview, PlanterInput } from '@/types'

export type FabricationDimensions = {
  length: number
  width: number
  height: number
}

export type SheetInventoryRow = {
  id: string
  name: string
  thickness: number
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
  isLiner: boolean
  isBundle: boolean
  panelType: PanelBlueprint['type']
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
  solverTimestamp: string
}

export type SolverOptions = {
  inventory?: SheetInventoryRow[]
  linerHeightPercent?: number
}

const LINER_HEIGHT_PERCENT = 0.5
const LASER_OFFSET_PER_SIDE = 0.5
const LASER_OFFSET_TOTAL = LASER_OFFSET_PER_SIDE * 2
const REQUIRED_L_CUT_PANEL_IDS = new Set([
  'panel-long-a',
  'panel-short-a',
  'panel-long-b',
  'panel-short-b',
])
const getBreakdownPrice = (row: CostBreakdownPreview) => row.overridePrice ?? row.basePrice

export const DEFAULT_SHEET_INVENTORY: SheetInventoryRow[] = [
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

type PanelBlueprint = {
  id: string
  name: string
  width: number
  height: number
  cutWidth: number
  cutHeight: number
  type: 'floor' | 'long' | 'short' | 'liner' | 'shelf'
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
    length: input.length,
    width: input.width,
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

  const sheetRows = buildOrderedSheetRows(inventory)
  if (sheetRows.length === 0) {
    throw new Error('No sheet inventory provided to the solver.')
  }

  const panels = buildPanels(fabricationDims, planterInput, linerHeightPercent)
  const cheapestCostPerSqft = Math.min(...sheetRows.map((row) => row.costPerSqft))
  const { singleCandidates, bundleCandidates } = buildCandidates(panels, cheapestCostPerSqft)
  const unplaceableCandidates = [...bundleCandidates, ...singleCandidates].filter(
    (candidate) => !candidateFitsAnySheet(candidate, sheetRows),
  )

  if (unplaceableCandidates.length > 0) {
    const details = unplaceableCandidates
      .map((candidate) => describeCandidateSize(candidate))
      .join('; ')
    throw new Error(`Current sheet inventory cannot fit: ${details}.`)
  }

  const candidateQueue = [
    ...bundleCandidates.sort(compareCandidates),
    ...singleCandidates.sort(compareCandidates),
  ]

  const sheetInstances: SheetInstance[] = []
  const rowUsage: Record<string, number> = {}
  const placements: Placement[] = []
  const placedPanels = new Set<string>()
  let bundleSavings = 0

  for (let queueIndex = 0; queueIndex < candidateQueue.length; queueIndex += 1) {
    const candidate = candidateQueue[queueIndex]
    if (candidate.panels.some((panel) => placedPanels.has(panel.id))) {
      continue
    }

    const remainingCandidates = candidateQueue
      .slice(queueIndex + 1)
      .filter((queued) => queued.panels.every((panel) => !placedPanels.has(panel.id)))

    const commit = placeCandidateOnSheets(
      candidate,
      sheetInstances,
      sheetRows,
      rowUsage,
      remainingCandidates,
    )

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
    const sheetAreaSqft = (usage.width * usage.height) / 144
    return (total += sheetAreaSqft * usage.costPerSqft)
  }, 0)

  const fabricationRows = breakdowns.filter((row) => row.category !== 'Liner')
  const baseFabricationCost = fabricationRows.reduce((total, row) => total + getBreakdownPrice(row), 0)
  const linerAreaSqft = panels
    .filter((panel) => panel.isLiner)
    .reduce((total, panel) => total + panel.width * panel.height, 0) / 144
  const linerRow = breakdowns.find((row) => row.category === 'Liner')
  const linerExtraCost = linerRow ? getBreakdownPrice(linerRow) : 0
  const totalFabricationCost = totalMaterialCost + baseFabricationCost + linerExtraCost

  return {
    placements,
    sheetUsages,
    totalMaterialCost,
    totalFabricationCost,
    materialAreaSqft,
    bundleSavings,
    linerAreaSqft,
    linerExtraCost,
    solverTimestamp: new Date().toISOString(),
  }
}

function buildPanels(
  fabrication: FabricationDimensions,
  input: PlanterInput,
  linerHeightPercent: number,
): PanelBlueprint[] {
  const panels: PanelBlueprint[] = []
  if (input.floorEnabled) {
    panels.push(...buildSplitFloorPanels(fabrication))
  }
  panels.push(
    {
      id: 'panel-long-a',
      name: 'Long A',
      width: fabrication.length,
      height: fabrication.height,
      cutWidth: fabrication.length,
      cutHeight: fabrication.height,
      type: 'long',
      isLiner: false,
    },
    {
      id: 'panel-long-b',
      name: 'Long B',
      width: fabrication.length,
      height: fabrication.height,
      cutWidth: fabrication.length,
      cutHeight: fabrication.height,
      type: 'long',
      isLiner: false,
    },
    {
      id: 'panel-short-a',
      name: 'Short A',
      width: fabrication.width,
      height: fabrication.height,
      cutWidth: fabrication.width,
      cutHeight: fabrication.height,
      type: 'short',
      isLiner: false,
    },
    {
      id: 'panel-short-b',
      name: 'Short B',
      width: fabrication.width,
      height: fabrication.height,
      cutWidth: fabrication.width,
      cutHeight: fabrication.height,
      type: 'short',
      isLiner: false,
    },
  )

  if (input.shelfEnabled) {
    panels.push({
      id: 'panel-shelf',
      name: 'Shelf',
      width: fabrication.width,
      height: fabrication.length,
      cutWidth: fabrication.width + LASER_OFFSET_TOTAL,
      cutHeight: fabrication.length + LASER_OFFSET_TOTAL,
      type: 'shelf',
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
          id: 'panel-liner-long-a',
          name: 'Liner Long A',
          width: linerLength,
          height: linerHeight,
          cutWidth: linerLength,
          cutHeight: linerHeight,
          type: 'long',
          isLiner: true,
        },
        {
          id: 'panel-liner-long-b',
          name: 'Liner Long B',
          width: linerLength,
          height: linerHeight,
          cutWidth: linerLength,
          cutHeight: linerHeight,
          type: 'long',
          isLiner: true,
        },
        {
          id: 'panel-liner-short-a',
          name: 'Liner Short A',
          width: linerWidth,
          height: linerHeight,
          cutWidth: linerWidth,
          cutHeight: linerHeight,
          type: 'short',
          isLiner: true,
        },
        {
          id: 'panel-liner-short-b',
          name: 'Liner Short B',
          width: linerWidth,
          height: linerHeight,
          cutWidth: linerWidth,
          cutHeight: linerHeight,
          type: 'short',
          isLiner: true,
        },
      )
    }
  }

  return panels
}

function buildSplitFloorPanels(fabrication: FabricationDimensions): PanelBlueprint[] {
  const splitAlongLength = fabrication.length >= fabrication.width
  const primaryDimension = splitAlongLength ? fabrication.length : fabrication.width
  const secondaryDimension = splitAlongLength ? fabrication.width : fabrication.length
  const firstHalf = primaryDimension / 2
  const secondHalf = primaryDimension - firstHalf

  const buildFloorPanel = (id: string, name: string, splitDimension: number): PanelBlueprint => {
    const width = splitAlongLength ? secondaryDimension : splitDimension
    const height = splitAlongLength ? splitDimension : secondaryDimension

    return {
      id,
      name,
      width,
      height,
      cutWidth: width + LASER_OFFSET_TOTAL,
      cutHeight: height + LASER_OFFSET_TOTAL,
      type: 'floor',
      isLiner: false,
    }
  }

  return [
    buildFloorPanel('panel-floor-a', 'Floor A', firstHalf),
    buildFloorPanel('panel-floor-b', 'Floor B', secondHalf),
  ]
}

function buildCandidates(
  panels: PanelBlueprint[],
  baseCostPerSqft: number,
): { singleCandidates: Candidate[]; bundleCandidates: Candidate[] } {
  const panelMap = new Map(panels.map((panel) => [panel.id, panel]))
  const singles: Candidate[] = panels
    .filter((panel) => !REQUIRED_L_CUT_PANEL_IDS.has(panel.id))
    .map((panel) => ({
      id: `candidate-${panel.id}`,
      name: panel.name,
      panels: [panel],
      totalArea: panel.cutWidth * panel.cutHeight,
      longestSide: Math.max(panel.cutWidth, panel.cutHeight),
      costImpact: (panel.cutWidth * panel.cutHeight) / 144 * baseCostPerSqft,
      bundleSavings: 0,
      isBundle: false,
    }))

  const bundles: Candidate[] = []
  const adjacency: Array<{ anchor: string; partner: string; label: string }> = [
    { anchor: 'panel-long-a', partner: 'panel-short-a', label: 'L-cut (Long A + Short A)' },
    { anchor: 'panel-long-b', partner: 'panel-short-b', label: 'L-cut (Long B + Short B)' },
  ]

  for (const { anchor, partner, label } of adjacency) {
    const anchorPanel = panelMap.get(anchor)
    const partnerPanel = panelMap.get(partner)
    if (!anchorPanel || !partnerPanel) {
      continue
    }

    const areaSum = isLCutBundlePair(anchor, partner)
      ? getLCutOccupiedArea(anchorPanel, partnerPanel)
      : anchorPanel.cutWidth * anchorPanel.cutHeight + partnerPanel.cutWidth * partnerPanel.cutHeight
    const bundleImpact = (areaSum / 144) * baseCostPerSqft

    bundles.push({
      id: `bundle-${anchor}-${partner}`,
      name: label,
      panels: [anchorPanel, partnerPanel],
      totalArea: areaSum,
      longestSide: getBundleLongestSide(anchor, partner, anchorPanel, partnerPanel),
      costImpact: bundleImpact,
      bundleSavings: 0,
      isBundle: true,
    })
  }

  return { singleCandidates: singles, bundleCandidates: bundles }
}

function getBundleLongestSide(
  anchorId: string,
  partnerId: string,
  anchorPanel: PanelBlueprint,
  partnerPanel: PanelBlueprint,
) {
  if (isLCutBundlePair(anchorId, partnerId)) {
    return Math.max(
      anchorPanel.width + partnerPanel.width + LASER_OFFSET_TOTAL,
      anchorPanel.height + LASER_OFFSET_TOTAL,
    )
  }

  return Math.max(anchorPanel.cutWidth, anchorPanel.cutHeight, partnerPanel.cutWidth, partnerPanel.cutHeight)
}

function compareCandidates(a: Candidate, b: Candidate) {
  const aIsLCut = isLCutBundleCandidate(a.id)
  const bIsLCut = isLCutBundleCandidate(b.id)
  if (aIsLCut !== bIsLCut) return aIsLCut ? -1 : 1
  if (a.costImpact !== b.costImpact) return a.costImpact - b.costImpact
  if (a.totalArea !== b.totalArea) return a.totalArea - b.totalArea
  if (a.longestSide !== b.longestSide) return a.longestSide - b.longestSide
  return a.name.localeCompare(b.name)
}

function isLCutBundleCandidate(candidateId: string) {
  return (
    candidateId === 'bundle-panel-long-a-panel-short-a' ||
    candidateId === 'bundle-panel-long-b-panel-short-b'
  )
}

function isLCutBundlePair(anchorId: string, partnerId: string) {
  return (
    (anchorId === 'panel-long-a' && partnerId === 'panel-short-a') ||
    (anchorId === 'panel-long-b' && partnerId === 'panel-short-b')
  )
}

function getLCutOccupiedArea(longPanel: PanelBlueprint, shortPanel: PanelBlueprint) {
  return (
    (longPanel.width + shortPanel.width + LASER_OFFSET_TOTAL) *
    (longPanel.height + LASER_OFFSET_TOTAL)
  )
}

function buildOrderedSheetRows(inventory: SheetInventoryRow[]) {
  return [...inventory].sort((a, b) => {
    const sheetCostA = getSheetCost(a.width, a.height, a.costPerSqft)
    const sheetCostB = getSheetCost(b.width, b.height, b.costPerSqft)
    if (sheetCostA !== sheetCostB) {
      return sheetCostA - sheetCostB
    }
    if (a.costPerSqft !== b.costPerSqft) {
      return a.costPerSqft - b.costPerSqft
    }
    return a.id.localeCompare(b.id)
  })
}

function candidateFitsAnySheet(candidate: Candidate, sheetRows: SheetInventoryRow[]) {
  return sheetRows.some((row) => {
    const tempSheet: SheetInstance = {
      id: 'validation-sheet',
      rowId: row.id,
      name: row.name,
      width: row.width,
      height: row.height,
      costPerSqft: row.costPerSqft,
      placements: [],
      usedAreaIn2: 0,
    }
    return Boolean(tryPlaceCandidate(tempSheet, candidate))
  })
}

function describeCandidateSize(candidate: Candidate) {
  if (candidate.panels.length === 1) {
    const panel = candidate.panels[0]
    return `${panel.name} (${panel.cutWidth}" x ${panel.cutHeight}")`
  }

  const [panelA, panelB] = candidate.panels
  const lCutBundle = getLCutBundleLayout(candidate, panelA, panelB)
  if (lCutBundle) {
    return `${candidate.name} (${lCutBundle.totalLength}" x ${lCutBundle.height}")`
  }

  return `${candidate.name} (${candidate.longestSide}" max side)`
}

function placeCandidateOnSheets(
  candidate: Candidate,
  sheetInstances: SheetInstance[],
  sheetRows: SheetInventoryRow[],
  rowUsage: Record<string, number>,
  remainingCandidates: Candidate[],
): Placement[] | null {
  let bestExisting: { instance: SheetInstance; attempt: Placement[]; wasteAfterIn2: number } | null = null
  for (const instance of sheetInstances) {
    const attempt = tryPlaceCandidate(instance, candidate)
    if (!attempt) {
      continue
    }
    const attemptArea = attempt.reduce((sum, placement) => sum + placement.width * placement.height, 0)
    const sheetAreaIn2 = instance.width * instance.height
    const wasteAfterIn2 = Math.max(0, sheetAreaIn2 - (instance.usedAreaIn2 + attemptArea))
    if (!bestExisting || wasteAfterIn2 < bestExisting.wasteAfterIn2) {
      bestExisting = { instance, attempt, wasteAfterIn2 }
    }
  }

  if (bestExisting) {
    bestExisting.instance.placements.push(...bestExisting.attempt)
    bestExisting.instance.usedAreaIn2 += bestExisting.attempt.reduce(
      (sum, placement) => sum + placement.width * placement.height,
      0,
    )
    return bestExisting.attempt
  }

  let bestNewSheet:
    | {
        row: SheetInventoryRow
        usage: number
        attempt: Placement[]
        sheetCost: number
        wasteAfterIn2: number
        canFitAllRemaining: boolean
      }
    | null = null

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

    const attemptArea = attempt.reduce((sum, placement) => sum + placement.width * placement.height, 0)
    const sheetAreaIn2 = row.width * row.height
    const wasteAfterIn2 = Math.max(0, sheetAreaIn2 - attemptArea)
    const sheetCost = getSheetCost(row.width, row.height, row.costPerSqft)
    const canFitAllRemaining = canFitCandidatesOnSingleSheet(row, [candidate, ...remainingCandidates])

    if (
      !bestNewSheet ||
      (canFitAllRemaining && !bestNewSheet.canFitAllRemaining) ||
      (canFitAllRemaining === bestNewSheet.canFitAllRemaining && sheetCost < bestNewSheet.sheetCost) ||
      (canFitAllRemaining === bestNewSheet.canFitAllRemaining &&
        sheetCost === bestNewSheet.sheetCost &&
        wasteAfterIn2 < bestNewSheet.wasteAfterIn2)
    ) {
      bestNewSheet = { row, usage, attempt, sheetCost, wasteAfterIn2, canFitAllRemaining }
    }
  }

  if (bestNewSheet) {
    const sheetInstance: SheetInstance = {
      id: `${bestNewSheet.row.id}-${bestNewSheet.usage + 1}`,
      rowId: bestNewSheet.row.id,
      name: bestNewSheet.row.name,
      width: bestNewSheet.row.width,
      height: bestNewSheet.row.height,
      costPerSqft: bestNewSheet.row.costPerSqft,
      placements: [],
      usedAreaIn2: 0,
    }

    rowUsage[bestNewSheet.row.id] = bestNewSheet.usage + 1
    sheetInstance.placements.push(...bestNewSheet.attempt)
    sheetInstance.usedAreaIn2 += bestNewSheet.attempt.reduce(
      (sum, placement) => sum + placement.width * placement.height,
      0,
    )
    sheetInstances.push(sheetInstance)
    return bestNewSheet.attempt
  }

  return null
}

function canFitCandidatesOnSingleSheet(row: SheetInventoryRow, candidates: Candidate[]) {
  const tempSheet: SheetInstance = {
    id: 'temp-sheet',
    rowId: row.id,
    name: row.name,
    width: row.width,
    height: row.height,
    costPerSqft: row.costPerSqft,
    placements: [],
    usedAreaIn2: 0,
  }
  const tempPlacedPanels = new Set<string>()

  for (const nextCandidate of candidates) {
    if (nextCandidate.panels.some((panel) => tempPlacedPanels.has(panel.id))) {
      continue
    }

    const attempt = tryPlaceCandidate(tempSheet, nextCandidate)
    if (!attempt) {
      return false
    }

    for (const panel of nextCandidate.panels) {
      tempPlacedPanels.add(panel.id)
    }

    tempSheet.placements.push(...attempt)
    tempSheet.usedAreaIn2 += attempt.reduce((sum, placement) => sum + placement.width * placement.height, 0)
  }

  return true
}

function getSheetCost(width: number, height: number, costPerSqft: number) {
  return (width * height) / 144 * costPerSqft
}

function tryPlaceCandidate(sheet: SheetInstance, candidate: Candidate): Placement[] | null {
  if (candidate.panels.length === 1) {
    const panel = candidate.panels[0]
    const placement = findPlacementOnSheet(sheet, panel.cutWidth, panel.cutHeight)
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
        isLiner: panel.isLiner,
        panelType: panel.type,
      },
    ]
  }

  const [panelA, panelB] = candidate.panels
  const lCutBundle = getLCutBundleLayout(candidate, panelA, panelB)
  if (lCutBundle) {
    for (const orientation of getOrientations(lCutBundle.totalLength, lCutBundle.height)) {
      const anchor = findPlacementOnSheet(sheet, orientation.width, orientation.height)
      if (!anchor) {
        continue
      }

      const firstPlacement: Placement = {
        x: anchor.x,
        y: anchor.y,
        width: orientation.rotated ? lCutBundle.height : lCutBundle.longLength + LASER_OFFSET_PER_SIDE,
        height: orientation.rotated ? lCutBundle.longLength + LASER_OFFSET_PER_SIDE : lCutBundle.height,
        rotated: orientation.rotated,
        id: `${candidate.id}-${panelA.id}`,
        candidateId: candidate.id,
        panelId: panelA.id,
        name: panelA.name,
        sheetInstanceId: sheet.id,
        rowId: sheet.rowId,
        isBundle: true,
        isLiner: panelA.isLiner,
        panelType: panelA.type,
      }

      const secondPlacement: Placement = {
        x: orientation.rotated ? anchor.x : anchor.x + lCutBundle.longLength + LASER_OFFSET_PER_SIDE,
        y: orientation.rotated ? anchor.y + lCutBundle.longLength + LASER_OFFSET_PER_SIDE : anchor.y,
        width: orientation.rotated ? lCutBundle.height : lCutBundle.shortWidth + LASER_OFFSET_PER_SIDE,
        height: orientation.rotated ? lCutBundle.shortWidth + LASER_OFFSET_PER_SIDE : lCutBundle.height,
        rotated: orientation.rotated,
        id: `${candidate.id}-${panelB.id}`,
        candidateId: candidate.id,
        panelId: panelB.id,
        name: panelB.name,
        sheetInstanceId: sheet.id,
        rowId: sheet.rowId,
        isBundle: true,
        isLiner: panelB.isLiner,
        panelType: panelB.type,
      }

      if (!arePlacementsValidForSheet(sheet, [firstPlacement, secondPlacement])) {
        continue
      }

      return [firstPlacement, secondPlacement]
    }
  }

  const panelAOrientations = getOrientations(panelA.width, panelA.height)
  const panelBOrientations = getOrientations(panelB.cutWidth, panelB.cutHeight)

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
        isLiner: panelA.isLiner,
        panelType: panelA.type,
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
        isLiner: panelB.isLiner,
        panelType: panelB.type,
      }

      if (!arePlacementsValidForSheet(sheet, [firstPlacement, secondPlacement])) {
        continue
      }

      return [firstPlacement, secondPlacement]
    }
  }

  return null
}

function getLCutBundleLayout(candidate: Candidate, panelA: PanelBlueprint, panelB: PanelBlueprint) {
  const lCutBundleIds = new Set(['bundle-panel-long-a-panel-short-a', 'bundle-panel-long-b-panel-short-b'])

  if (!lCutBundleIds.has(candidate.id)) {
    return null
  }

  const [longPanel, shortPanel] = panelA.type === 'long' ? [panelA, panelB] : [panelB, panelA]
  if (longPanel.type !== 'long' || shortPanel.type !== 'short') {
    return null
  }
  if (longPanel.height !== shortPanel.height) {
    return null
  }

  return {
    totalLength: longPanel.width + shortPanel.width + LASER_OFFSET_TOTAL,
    height: longPanel.height + LASER_OFFSET_TOTAL,
    longLength: longPanel.width,
    shortWidth: shortPanel.width,
  }
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

function arePlacementsValidForSheet(sheet: SheetInstance, placements: Placement[]) {
  for (const placement of placements) {
    if (!isPlacementInsideSheet(sheet, placement)) {
      return false
    }
  }

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i]
      const b = placements[j]
      if (rectanglesOverlap(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height)) {
        return false
      }
    }
  }

  for (const placement of placements) {
    const overlapsExisting = sheet.placements.some((existing) =>
      rectanglesOverlap(
        placement.x,
        placement.y,
        placement.width,
        placement.height,
        existing.x,
        existing.y,
        existing.width,
        existing.height,
      ),
    )
    if (overlapsExisting) {
      return false
    }
  }

  return true
}

function isPlacementInsideSheet(sheet: SheetInstance, placement: Placement) {
  return (
    placement.x >= 0 &&
    placement.y >= 0 &&
    placement.x + placement.width <= sheet.width &&
    placement.y + placement.height <= sheet.height
  )
}

