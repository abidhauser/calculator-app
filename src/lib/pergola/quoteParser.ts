export type ParsedDimension = {
  a: number
  b: number
  min: number
  max: number
  raw: string
  valid: boolean
}

export const parseDimension = (raw: string): ParsedDimension => {
  const normalized = String(raw ?? '').trim().toLowerCase()

  // Accept dimensions like "2x4" or "2 x 4" and reject everything else.
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/)
  if (!match) {
    return {
      a: 0,
      b: 0,
      min: 0,
      max: 0,
      raw: normalized,
      valid: false,
    }
  }

  const a = Number(match[1])
  const b = Number(match[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return {
      a: 0,
      b: 0,
      min: 0,
      max: 0,
      raw: normalized,
      valid: false,
    }
  }

  return {
    a,
    b,
    min: Math.min(a, b),
    max: Math.max(a, b),
    raw: normalized,
    valid: true,
  }
}

export const dimensionThickness = (raw: string): number => {
  const parsed = parseDimension(raw)
  return parsed.valid ? parsed.max : 0
}
