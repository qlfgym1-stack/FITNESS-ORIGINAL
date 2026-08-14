import { describe, it, expect } from "vitest"
import { analyzeFinance } from "./finance"
import type { PaymentRow, PosTransactionRow } from "./raw"

function payment(over: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "p1",
    member_id: "m1",
    subscription_id: null,
    amount: 1000,
    payment_method: "cash",
    payment_date: "2026-08-01T10:00:00Z",
    status: "completed",
    ...over,
  }
}

function pos(over: Partial<PosTransactionRow> = {}): PosTransactionRow {
  return {
    id: "tx1",
    member_id: "m1",
    total: 3000,
    created_at: "2026-08-02T10:00:00Z",
    items: [
      { id: "a", name: "Whey", price: 2000, quantity: 1 },
      { id: "b", name: "Shaker", price: 1000, quantity: 1 },
    ],
    ...over,
  }
}

describe("analyzeFinance", () => {
  it("aggregates pos products by revenue and keeps the top ones", () => {
    const stats = analyzeFinance(
      [],
      [
        pos({ total: 5000, items: [
          { id: "a", name: "Whey", price: 2000, quantity: 2 },
          { id: "c", name: "Gants", price: 1000, quantity: 1 },
        ] }),
        pos({ total: 2000, items: [
          { id: "a", name: "Whey", price: 2000, quantity: 1 },
        ] }),
      ]
    )
    expect(stats.topProducts).toHaveLength(2)
    expect(stats.topProducts[0]).toEqual({ id: "a", name: "Whey", quantity: 3, revenue: 6000 })
    expect(stats.topProducts[1]).toEqual({ id: "c", name: "Gants", quantity: 1, revenue: 1000 })
    expect(stats.totalPosRevenue).toBe(7000)
  })

  it("groups completed payments by method with percentages", () => {
    const stats = analyzeFinance(
      [
        payment({ amount: 4000, payment_method: "cash" }),
        payment({ amount: 6000, payment_method: "card" }),
        payment({ amount: 2000, payment_method: "card" }),
        payment({ amount: 9999, status: "cancelled" }),
      ],
      []
    )
    expect(stats.totalSubscriptionRevenue).toBe(12000)
    expect(stats.totalRevenue).toBe(12000)
    expect(stats.paymentMethods).toHaveLength(2)
    const card = stats.paymentMethods.find((m) => m.method === "card")
    expect(card?.total).toBe(8000)
    expect(card?.count).toBe(2)
    expect(card?.pct).toBeCloseTo(66.67, 2)
    const cash = stats.paymentMethods.find((m) => m.method === "cash")
    expect(cash?.pct).toBeCloseTo(33.33, 2)
  })

  it("falls back to other for empty payment method", () => {
    const stats = analyzeFinance([payment({ payment_method: "" })], [])
    expect(stats.paymentMethods[0]?.method).toBe("other")
  })
})
