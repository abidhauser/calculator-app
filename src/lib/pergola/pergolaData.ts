import pricingRaw from '../../data/pergola/Pricing.json' with { type: 'json' }
import connectorsRaw from '../../data/pergola/Connectors.json' with { type: 'json' }
import endCapsRaw from '../../data/pergola/EndCaps.json' with { type: 'json' }
import angleRaw from '../../data/pergola/Angle.json' with { type: 'json' }
import flatbarRaw from '../../data/pergola/Flatbar.json' with { type: 'json' }
import settingsRaw from '../../data/pergola/Settings.json' with { type: 'json' }

export type TubeRow = {
  label: string
  partNumber: string
  size: string
  gauge: number | null
  costPerFt: number | null
  supplyFt: number | null
  perSupply: number | null
}

export type ConnectorRow = {
  label: string
  partNumber: string
  totalDepth: string | null
  costEach: number | null
  size: string | null
}

export type EndCapRow = {
  label: string
  partNumber: string
  totalDepth: string | null
  costEach: number | null
  size: string | null
}

export type AngleRow = {
  label: string
  partNumber: string
  gauge: number | null
  costPerFt: number | null
  supplyFt: number | null
  perSupply: number | null
}

export type FlatbarRow = {
  label: string
  gauge: number | null
  costPerFt: number | null
  supplyFt: number | null
  perSupply: number | null
}

export type SizeRow = {
  size: string
  smallSide: number
  largeSide: number
}

type WorkbookRow = {
  value: unknown[]
}

const unwrapRows = (rows: unknown): unknown[][] =>
  Array.isArray(rows)
    ? (rows as WorkbookRow[]).map((row) => (Array.isArray(row?.value) ? row.value : []))
    : []

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const pricingRows = unwrapRows(pricingRaw)
const connectorRowsRaw = unwrapRows(connectorsRaw)
const endCapRowsRaw = unwrapRows(endCapsRaw)
const angleRowsRaw = unwrapRows(angleRaw)
const flatbarRowsRaw = unwrapRows(flatbarRaw)
const settingsRows = unwrapRows(settingsRaw)

export const tubingRows: TubeRow[] = pricingRows
  .slice(1)
  .map((row) => ({
    label: toString(row[0]),
    partNumber: toString(row[1]),
    size: toString(row[2]).toLowerCase(),
    gauge: toNumber(row[3]),
    costPerFt: toNumber(row[4]),
    supplyFt: toNumber(row[5]),
    perSupply: toNumber(row[6]),
  }))
  .filter((row) => row.label)

export const connectorRows: ConnectorRow[] = connectorRowsRaw
  .slice(1)
  .map((row) => ({
    label: toString(row[0]),
    partNumber: toString(row[1]),
    totalDepth: toString(row[2]) || null,
    costEach: toNumber(row[3]),
    size: toString(row[4]).toLowerCase() || null,
  }))
  .filter((row) => row.label)

export const endCapRows: EndCapRow[] = endCapRowsRaw
  .slice(1)
  .map((row) => ({
    label: toString(row[0]),
    partNumber: toString(row[1]),
    totalDepth: toString(row[2]) || null,
    costEach: toNumber(row[3]),
    size: toString(row[4]).toLowerCase() || null,
  }))
  .filter((row) => row.label)

export const angleRows: AngleRow[] = angleRowsRaw
  .slice(1)
  .map((row) => ({
    label: toString(row[0]),
    partNumber: toString(row[1]),
    gauge: toNumber(row[2]),
    costPerFt: toNumber(row[3]),
    supplyFt: toNumber(row[4]),
    perSupply: toNumber(row[5]),
  }))
  .filter((row) => row.label)

export const flatbarRows: FlatbarRow[] = flatbarRowsRaw
  .slice(1)
  .map((row) => ({
    label: toString(row[0]),
    gauge: toNumber(row[1]),
    costPerFt: toNumber(row[2]),
    supplyFt: toNumber(row[3]),
    perSupply: toNumber(row[4]),
  }))
  .filter((row) => row.label)

export const settingsSizes: SizeRow[] = settingsRows
  .slice(1)
  .map((row) => ({
    size: toString(row[0]).toLowerCase(),
    smallSide: toNumber(row[1]) ?? 0,
    largeSide: toNumber(row[2]) ?? 0,
  }))
  .filter((row) => row.size)

export const beamThicknessBySize: Record<string, number> = {
  '4x4': toNumber(settingsRows[1]?.[6]) ?? 0.125,
  '6x6': toNumber(settingsRows[1]?.[7]) ?? 0.25,
}


