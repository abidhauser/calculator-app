export type PlanterInput = {
  length: number
  width: number
  height: number
  marginPct: number
  thickness: number
  lip: number
  linerEnabled: boolean
  linerDepth: number
  linerThickness: number
  weightPlateEnabled: boolean
  floorEnabled: boolean
  shelfEnabled: boolean
}

export type CostThreshold = {
  category: string
  lowThreshold: number
  lowPrice: number
  mediumThreshold: number
  mediumPrice: number
  highPrice: number
}

export type CostBreakdownPreview = {
  category: string
  tierUsed: 'Low' | 'Medium' | 'High' | 'Not Selected'
  basePrice: number
  overridePrice: number | null
}
