import type { FlagshipResult, ProductPerformance } from "../hooks/types"
import type { PosTransactionRow, ProductRow } from "./raw"

const VIRTUAL_PREFIXES = ["__subscription__", "__renewal__", "__dropin__"]

export function isVirtualItem(id: string): boolean {
  return VIRTUAL_PREFIXES.some((p) => id.startsWith(p))
}

function emptyPerformance(productId: string, name: string, category: string | null, stock: number | null): ProductPerformance {
  return {
    productId,
    name,
    category,
    quantity: 0,
    orders: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    marginPct: 0,
    stock,
    score: 0,
  }
}

export function analyzeFlagshipProducts(
  transactions: PosTransactionRow[],
  products: ProductRow[]
): FlagshipResult {
  const productMap = new Map(products.map((p) => [p.id, p]))
  const stats = new Map<string, ProductPerformance>()

  for (const tx of transactions) {
    for (const item of tx.items ?? []) {
      if (isVirtualItem(item.id)) continue
      const prod = productMap.get(item.id)
      const existing = stats.get(item.id) ?? emptyPerformance(item.id, item.name, prod?.category ?? null, prod?.stock ?? null)
      const revenue = item.price * item.quantity
      const cost = (prod?.cost ?? 0) * item.quantity
      existing.quantity += item.quantity
      existing.orders += 1
      existing.revenue += revenue
      existing.cost += cost
      existing.profit += revenue - cost
      existing.marginPct = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0
      stats.set(item.id, existing)
    }
  }

  const list = Array.from(stats.values())
  for (const p of list) p.score = Math.round(p.revenue * Math.max(p.marginPct, 0))

  const topByRevenue = [...list].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  const topByMargin = [...list].sort((a, b) => b.marginPct - a.marginPct).slice(0, 10)

  const flagship =
    topByMargin.find((p) => p.profit > 0 && p.marginPct > 0) ?? topByRevenue[0] ?? null

  const fastMovers = [...list]
    .filter((p) => p.stock != null && p.quantity >= 5 && p.stock <= p.quantity)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const soldIds = new Set(list.map((p) => p.productId))
  const deadStock = products
    .filter((p) => p.stock != null && p.stock > 0 && !soldIds.has(p.id))
    .map((p) => emptyPerformance(p.id, p.name, p.category, p.stock))
    .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
    .slice(0, 10)

  const slowMovers = [...list]
    .filter((p) => p.stock != null && p.quantity > 0 && p.quantity < 3 && p.stock > p.quantity * 5)
    .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
    .slice(0, 5)

  return { topByRevenue, topByMargin, flagship, fastMovers, deadStock, slowMovers }
}
