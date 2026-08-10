export interface StockMovementLine {
  type: 'in' | 'out'
  quantity: number
}

export interface StockSummary {
  stockInitial: number
  totalIn: number
  totalOut: number
  expected: number
}

export function computeStockSummary(stockInitial: number, movements: StockMovementLine[]): StockSummary {
  let totalIn = 0
  let totalOut = 0
  for (const m of movements) {
    if (m.type === 'in') totalIn += m.quantity
    else totalOut += m.quantity
  }
  return {
    stockInitial,
    totalIn,
    totalOut,
    expected: stockInitial + totalIn - totalOut,
  }
}

export function stockIsConsistent(summary: StockSummary, actual: number): boolean {
  return summary.expected === actual
}
