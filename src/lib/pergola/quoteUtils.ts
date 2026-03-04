export const round2 = (value: number): number =>
  Number(Number.isFinite(value) ? value.toFixed(2) : 0)

export const safeToNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const toFeetFromInches = (inches: number): number => (Number.isFinite(inches) ? Number((inches / 12).toFixed(4)) : 0)

export const toInchesFromFeet = (feet: number): number => (Number.isFinite(feet) ? Number((feet * 12).toFixed(4)) : 0)
