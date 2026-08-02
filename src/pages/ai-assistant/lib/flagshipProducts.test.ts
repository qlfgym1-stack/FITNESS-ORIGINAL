import { describe, it, expect } from "vitest"
import { analyzeFlagshipProducts, isVirtualItem } from "./flagshipProducts"
import type { PosTransactionRow, ProductRow } from "./raw"

const PRODUCTS: ProductRow[] = [
  { id: "p1", name: "Whey", price: 4500, cost: 2900, stock: 20, category: "Nutrition" },
  { id: "p2", name: "Shaker", price: 800, cost: 350, stock: 2, category: "Accessoires" },
  { id: "p3", name: "Bandages", price: 600, cost: 250, stock: 40, category: "Accessoires" },
  { id: "p4", name: "DeadProd", price: 1000, cost: 500, stock: 15, category: "Autre" },
]

function tx(items: { id: string; name: string; price: number; quantity: number }[]): PosTransactionRow {
  return {
    id: "t",
    total: items.reduce((s, it) => s + it.price * it.quantity, 0),
    created_at: "2026-07-01T10:00:00.000Z",
    items,
  }
}

describe("isVirtualItem", () => {
  it("detects virtual subscription/renewal/dropin items", () => {
    expect(isVirtualItem("__subscription__abc")).toBe(true)
    expect(isVirtualItem("__renewal__abc")).toBe(true)
    expect(isVirtualItem("__dropin__abc")).toBe(true)
    expect(isVirtualItem("p1")).toBe(false)
  })
})

describe("analyzeFlagshipProducts", () => {
  it("aggregates quantity, revenue and margin per product", () => {
    const result = analyzeFlagshipProducts(
      [tx([{ id: "p1", name: "Whey", price: 4500, quantity: 2 }])],
      PRODUCTS
    )
    expect(result.topByRevenue[0].revenue).toBe(9000)
    expect(result.topByRevenue[0].quantity).toBe(2)
    expect(result.topByRevenue[0].marginPct).toBeCloseTo((9000 - 5800) / 9000 * 100, 1)
  })

  it("excludes virtual items from ranking", () => {
    const result = analyzeFlagshipProducts(
      [
        tx([
          { id: "__subscription__s1", name: "Mensuel", price: 2500, quantity: 1 },
          { id: "p2", name: "Shaker", price: 800, quantity: 1 },
        ]),
      ],
      PRODUCTS
    )
    expect(result.topByRevenue.map((p) => p.productId)).not.toContain("__subscription__s1")
    expect(result.topByRevenue[0].productId).toBe("p2")
  })

  it("flags dead stock (no sales) and fast movers (low stock)", () => {
    const result = analyzeFlagshipProducts(
      [tx([{ id: "p2", name: "Shaker", price: 800, quantity: 5 }])],
      PRODUCTS
    )
    expect(result.fastMovers.map((p) => p.productId)).toContain("p2")
    expect(result.deadStock.map((p) => p.productId)).toContain("p4")
  })

  it("selects a flagship among profitable products", () => {
    const result = analyzeFlagshipProducts(
      [tx([{ id: "p1", name: "Whey", price: 4500, quantity: 1 }])],
      PRODUCTS
    )
    expect(result.flagship?.productId).toBe("p1")
    expect(result.flagship && result.flagship.profit > 0).toBe(true)
  })
})
