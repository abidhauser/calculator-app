export type PergolaType = 'Pergola' | 'Grand Pergola'

export type MaterialType = 'Aluminum' | 'Alumiwood' | 'Cedar'
export type RoofOrientation = 'Vertical' | 'Horizontal'
export type RoofAlignment = 'Parallel to length' | 'Parallel to depth'
export type SideOrientation = 'Vertical' | 'Horizontal'
export type SideAlignment = 'Parallel to top' | 'Parallel to height'
export type BeamSize = '4x4' | '6x6'
export type CoverageSource = 'coverage' | 'gap'

export interface AxisMeasurement {
  ft: number
  in: number
}

export interface PergolaDimensions {
  length: AxisMeasurement
  depth: AxisMeasurement
  height: AxisMeasurement
}

export interface RoofPurlinConfig {
  materialType: MaterialType
  orientation: RoofOrientation
  size: string
  customSize: string
  alignment: RoofAlignment
  coveragePct: number
  gapIn: number
}

export interface SidePurlinConfig {
  materialType: MaterialType
  orientation: SideOrientation
  size: string
  customSize: string
  alignment: SideAlignment
  countOnLength: number
  countOnDepth: number
  groundClearanceIn: number
  topClearanceIn: number
  coveragePct: number
  gapIn: number
}

export interface PrivacyPanelConfig {
  countOnLength: number
  countOnDepth: number
  groundClearanceIn: number
  topClearanceIn: number
}

export interface PieceCounter {
  qty: number
}

export interface PieceBreakdown {
  verticalColumns: PieceCounter
  beamsOnLength: PieceCounter
  beamsOnDepth: PieceCounter
  roofPurlins: PieceCounter
  sidePurlinsOnLength: PieceCounter
  sidePurlinsOnDepth: PieceCounter
  standardBlocks: PieceCounter
  feet: PieceCounter
  endCaps: PieceCounter
  canopies: PieceCounter
}

export interface QuotePricingItem {
  label: string
  unitCost: number | null
  supplyFt: number | null
  partNumber: string | null
  size: string
  gauge: number | null
}

export interface QuotePricing {
  stockItems: QuotePricingItem[]
  connectors: QuotePricingItem[]
  endCaps: QuotePricingItem[]
  angleIron: QuotePricingItem[]
  flatbar: QuotePricingItem[]
}

export interface PieceSizeSummary {
  smallPiecesInches: number
  mediumPiecesInches: number
  largePiecesInches: number
}

export interface StockOptimization {
  stockCounts: Record<string, number>
  cutPlan: number[][]
}

export interface PricingRow {
  row: number
  name: string
  quantity: number | null
  unitCost: number | null
  total: number | null
}

export interface QuoteState {
  pergola: {
    dimensions: PergolaDimensions
    type: PergolaType
  }
  beam: {
    size: BeamSize
  }
  roofPurlins: RoofPurlinConfig
  sidePurlins: SidePurlinConfig
  privacyPanels: PrivacyPanelConfig
  pieces: PieceBreakdown
  pricing: QuotePricing

  suggestedType: PergolaType
  availableRoofSizes: string[]
  availableSideSizes: string[]
  roofPurlinsRequired: number | null
  sidePurlinsLengthRequired: number | null
  sidePurlinsDepthRequired: number | null
  columnBeamThickness: number | null
  roofPurlinThickness: number
  sidePurlinThickness: number
  pieceSizeSummary: PieceSizeSummary
  stockOptimization: StockOptimization
  pricingRows: PricingRow[]
  totalCost: number
  sell60: number
  sell50: number
  errors: string[]
}

export type QuoteFieldChange =
  | 'privacyPanelsToggle'
  | `pergola.length.${'ft' | 'in'}`
  | `pergola.depth.${'ft' | 'in'}`
  | `pergola.height.${'ft' | 'in'}`
  | 'pergola.type'
  | 'roofPurlins.materialType'
  | 'sidePurlins.materialType'
  | 'roofPurlins.orientation'
  | 'sidePurlins.orientation'
  | 'roofPurlins.alignment'
  | 'sidePurlins.alignment'
  | 'roofPurlins.size'
  | 'sidePurlins.size'
  | 'roofPurlins.customSize'
  | 'sidePurlins.customSize'
  | 'roofPurlins.coveragePct'
  | 'roofPurlins.gapIn'
  | 'sidePurlins.coveragePct'
  | 'sidePurlins.gapIn'
  | 'sidePurlins.countOnLength'
  | 'sidePurlins.countOnDepth'
  | 'sidePurlins.groundClearanceIn'
  | 'sidePurlins.topClearanceIn'

export interface QuoteEnginePrivateState {
  lastRoofSync?: CoverageSource
  lastSideSync?: CoverageSource
}

export interface QuoteEngineState extends QuoteState {
  private?: QuoteEnginePrivateState
}
