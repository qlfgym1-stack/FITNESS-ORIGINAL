import type { ActionItem, FlagshipResult, PeakHoursResult, RevenueForecast, SubscriptionInsight } from "../hooks/types"

export interface RecommendationsInput {
  netProfit: number
  totalRevenue: number
  totalExpenses: number
  revenueForecast: RevenueForecast
  peakHours: PeakHoursResult
  flagship: FlagshipResult
  subscription: SubscriptionInsight
  hasData: boolean
}

export function buildRecommendations(input: RecommendationsInput): ActionItem[] {
  const actions: ActionItem[] = []
  const { netProfit, totalRevenue, totalExpenses, revenueForecast, peakHours, flagship, subscription } = input

  if (netProfit < 0) {
    actions.push({
      id: "profit-negative",
      priority: "p0",
      categoryKey: "aiAssistant.category.finance",
      titleKey: "aiAssistant.actProfitNegativeTitle",
      detailKey: "aiAssistant.actProfitNegativeDetail",
      detailParams: { amount: Math.abs(Math.round(netProfit)) },
      gainKey: "aiAssistant.actProfitNegativeGain",
    })
  }

  if (totalRevenue > 0 && totalExpenses / totalRevenue > 0.85) {
    actions.push({
      id: "expense-ratio",
      priority: "p0",
      categoryKey: "aiAssistant.category.finance",
      titleKey: "aiAssistant.actExpenseRatioTitle",
      detailKey: "aiAssistant.actExpenseRatioDetail",
      detailParams: { pct: Math.round((totalExpenses / totalRevenue) * 100) },
      gainKey: "aiAssistant.actExpenseRatioGain",
    })
  }

  const cashNext3 = revenueForecast.next3Months.reduce((s, p) => s + p.value, 0)
  if (totalExpenses > 0 && totalRevenue > 0 && cashNext3 > 0 && cashNext3 < totalExpenses * 1.5) {
    actions.push({
      id: "cash-low",
      priority: "p0",
      categoryKey: "aiAssistant.category.finance",
      titleKey: "aiAssistant.actCashLowTitle",
      detailKey: "aiAssistant.actCashLowDetail",
      detailParams: { amount: Math.round(cashNext3) },
      gainKey: "aiAssistant.actCashLowGain",
    })
  }

  if (peakHours.offPeakHours.length > 0) {
    actions.push({
      id: "off-peak",
      priority: "p1",
      categoryKey: "aiAssistant.category.revenue",
      titleKey: "aiAssistant.actOffPeakTitle",
      detailKey: "aiAssistant.actOffPeakDetail",
      detailParams: { hours: peakHours.offPeakHours.map((h) => `${h}h`).join(", ") },
      gainKey: "aiAssistant.actOffPeakGain",
    })
  }

  if (flagship.flagship && flagship.flagship.profit > 0) {
    actions.push({
      id: "flagship",
      priority: "p1",
      categoryKey: "aiAssistant.category.revenue",
      titleKey: "aiAssistant.actFlagshipTitle",
      detailKey: "aiAssistant.actFlagshipDetail",
      detailParams: { name: flagship.flagship.name, margin: Math.round(flagship.flagship.marginPct) },
      gainKey: "aiAssistant.actFlagshipGain",
    })
  }

  if (subscription.expiring30.length > 0) {
    actions.push({
      id: "renewal",
      priority: "p1",
      categoryKey: "aiAssistant.category.members",
      titleKey: "aiAssistant.actRenewalTitle",
      detailKey: "aiAssistant.actRenewalDetail",
      detailParams: { count: subscription.expiring30.length },
      gainKey: "aiAssistant.actRenewalGain",
    })
  }

  if (flagship.fastMovers.length > 0) {
    actions.push({
      id: "restock",
      priority: "p1",
      categoryKey: "aiAssistant.category.stock",
      titleKey: "aiAssistant.actRestockTitle",
      detailKey: "aiAssistant.actRestockDetail",
      detailParams: { name: flagship.fastMovers[0].name, count: flagship.fastMovers.length },
      gainKey: "aiAssistant.actRestockGain",
    })
  }

  if (flagship.deadStock.length > 0) {
    actions.push({
      id: "dead-stock",
      priority: "p2",
      categoryKey: "aiAssistant.category.stock",
      titleKey: "aiAssistant.actDeadStockTitle",
      detailKey: "aiAssistant.actDeadStockDetail",
      detailParams: { count: flagship.deadStock.length, value: Math.round(flagship.deadStock.reduce((s, p) => s + (p.stock ?? 0) * (p.revenue > 0 ? p.revenue / p.quantity : 0), 0)) },
      gainKey: "aiAssistant.actDeadStockGain",
    })
  }

  if (flagship.slowMovers.length > 0) {
    actions.push({
      id: "slow-movers",
      priority: "p2",
      categoryKey: "aiAssistant.category.stock",
      titleKey: "aiAssistant.actSlowMoversTitle",
      detailKey: "aiAssistant.actSlowMoversDetail",
      detailParams: { count: flagship.slowMovers.length },
      gainKey: "aiAssistant.actSlowMoversGain",
    })
  }

  if (subscription.bestType && subscription.bestType.count > 0) {
    actions.push({
      id: "best-type",
      priority: "p2",
      categoryKey: "aiAssistant.category.members",
      titleKey: "aiAssistant.actBestTypeTitle",
      detailKey: "aiAssistant.actBestTypeDetail",
      detailParams: { name: subscription.bestType.name },
      gainKey: "aiAssistant.actBestTypeGain",
    })
  }

  if (actions.length === 0 && input.hasData) {
    actions.push({
      id: "maintain",
      priority: "p2",
      categoryKey: "aiAssistant.category.growth",
      titleKey: "aiAssistant.actMaintainTitle",
      detailKey: "aiAssistant.actMaintainDetail",
      gainKey: "aiAssistant.actMaintainGain",
    })
  }

  return actions
}
