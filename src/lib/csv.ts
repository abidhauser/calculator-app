export type CsvParseResult = {
  rows: string[][]
  error: string | null
}

export const escapeCsvCell = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const serializeCsv = (rows: string[][]) =>
  rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n')

export const parseCsv = (source: string): CsvParseResult => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let index = 0
  let inQuotes = false

  while (index < source.length) {
    const char = source[index]

    if (inQuotes) {
      if (char === '"') {
        const next = source[index + 1]
        if (next === '"') {
          cell += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      cell += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      index += 1
      continue
    }
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      index += 1
      continue
    }
    if (char === '\r') {
      index += 1
      continue
    }

    cell += char
    index += 1
  }

  if (inQuotes) {
    return { rows: [], error: 'CSV contains an unmatched quote.' }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return { rows, error: null }
}

