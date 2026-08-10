import { describe, it, expect } from 'vitest'
import { computeStockSummary, stockIsConsistent } from './stock'

describe('computeStockSummary', () => {
  it('empty movements returns stock initial', () => {
    expect(computeStockSummary(10, [])).toEqual({ stockInitial: 10, totalIn: 0, totalOut: 0, expected: 10 })
  })

  it('multiple individual entries are summed, never merged', () => {
    const summary = computeStockSummary(0, [
      { type: 'in', quantity: 5 },
      { type: 'in', quantity: 3 },
      { type: 'in', quantity: 2 },
    ])
    expect(summary.totalIn).toBe(10)
    expect(summary.expected).toBe(10)
  })

  it('mixed entries and exits compute final stock', () => {
    const summary = computeStockSummary(20, [
      { type: 'in', quantity: 10 },
      { type: 'out', quantity: 4 },
      { type: 'in', quantity: 2 },
      { type: 'out', quantity: 8 },
    ])
    expect(summary.totalIn).toBe(12)
    expect(summary.totalOut).toBe(12)
    expect(summary.expected).toBe(20 + 12 - 12)
  })

  it('stock final can be zero', () => {
    const summary = computeStockSummary(5, [
      { type: 'out', quantity: 3 },
      { type: 'out', quantity: 2 },
    ])
    expect(summary.expected).toBe(0)
  })

  it('stock final is never influenced by order (idempotent sum)', () => {
    const a = computeStockSummary(10, [
      { type: 'out', quantity: 7 },
      { type: 'in', quantity: 4 },
    ])
    const b = computeStockSummary(10, [
      { type: 'in', quantity: 4 },
      { type: 'out', quantity: 7 },
    ])
    expect(a.expected).toBe(b.expected)
    expect(a.expected).toBe(7)
  })
})

describe('stockIsConsistent', () => {
  it('returns true when expected equals actual', () => {
    const summary = computeStockSummary(10, [{ type: 'in', quantity: 5 }])
    expect(stockIsConsistent(summary, 15)).toBe(true)
  })

  it('returns false when expected differs from actual (anomaly, never silently fixed)', () => {
    const summary = computeStockSummary(10, [{ type: 'in', quantity: 5 }])
    expect(stockIsConsistent(summary, 12)).toBe(false)
  })
})
