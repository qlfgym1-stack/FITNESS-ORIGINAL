import type { FlagshipResult, KeyedInsight, PeakHoursResult, RevenueForecast, SubscriptionInsight } from "../hooks/types"

export interface InsightsInput {
  netProfit: number
  totalRevenue: number
  totalExpenses: number
  posRevenue: number
  revenueForecast: RevenueForecast
  peakHours: PeakHoursResult
  flagship: FlagshipResult
  subscription: SubscriptionInsight
  hasData: boolean
}

export function buildInsights(input: InsightsInput): KeyedInsight[] {
  const insights: KeyedInsight[] = []
  const { netProfit, totalRevenue, totalExpenses, posRevenue, revenueForecast, peakHours, flagship, subscription, hasData } = input

  if (!hasData || totalRevenue <= 0) {
    insights.push({
      type: "neutral",
      messageKey: "aiAssistant.insNoData",
    })
    return insights
  }

  if (netProfit < 0) {
    insights.push({
      type: "negative",
      messageKey: "aiAssistant.insNegativeProfit",
      messageParams: { amount: Math.abs(Math.round(netProfit)) },
      actionKey: "aiAssistant.insNegativeProfitAction",
    })
  } else if (netProfit > 0) {
    insights.push({
      type: "positive",
      messageKey: "aiAssistant.insPositiveProfit",
      messageParams: { amount: Math.round(netProfit) },
    })
  }

  const ratio = Math.round((totalExpenses / totalRevenue) * 100)
  if (ratio > 80) {
    insights.push({
      type: "warning",
      messageKey: "aiAssistant.insExpenseRatio",
      messageParams: { pct: ratio },
    })
  } else if (ratio > 0) {
    insights.push({
      type: "neutral",
      messageKey: "aiAssistant.insExpenseOk",
      messageParams: { pct: ratio },
    })
  }

  if (peakHours.peakHours.length > 0) {
    insights.push({
      type: "neutral",
      messageKey: "aiAssistant.insPeakHours",
      messageParams: { hours: peakHours.peakHours.map((h) => `${h}h`).join(", ") },
      actionKey: "aiAssistant.insPeakHoursAction",
    })
  }

  if (peakHours.offPeakHours.length > 0) {
    insights.push({
      type: "positive",
      messageKey: "aiAssistant.insOffPeak",
      messageParams: { hours: peakHours.offPeakHours.map((h) => `${h}h`).join(", ") },
      actionKey: "aiAssistant.insOffPeakAction",
    })
  }

  if (flagship.flagship && flagship.flagship.profit > 0) {
    insights.push({
      type: "positive",
      messageKey: "aiAssistant.insFlagship",
      messageParams: {
        name: flagship.flagship.name,
        margin: Math.round(flagship.flagship.marginPct),
        revenue: Math.round(flagship.flagship.revenue),
      },
      actionKey: "aiAssistant.insFlagshipAction",
    })
  }

  if (subscription.expiring30.length > 0) {
    insights.push({
      type: "warning",
      messageKey: "aiAssistant.insExpiring",
      messageParams: { count: subscription.expiring30.length },
      actionKey: "aiAssistant.insExpiringAction",
    })
  }

  if (subscription.churnRisk > 20) {
    insights.push({
      type: "warning",
      messageKey: "aiAssistant.insChurn",
      messageParams: { pct: subscription.churnRisk },
    })
  }

  if (posRevenue > 0 && totalRevenue > 0) {
    const share = Math.round((posRevenue / totalRevenue) * 100)
    insights.push({
      type: "neutral",
      messageKey: "aiAssistant.insPosShare",
      messageParams: { pct: share },
    })
  }

  if (revenueForecast.confidence >= 50 && revenueForecast.percentChange !== 0) {
    insights.push({
      type: revenueForecast.percentChange > 0 ? "positive" : "warning",
      messageKey:
        revenueForecast.percentChange > 0 ? "aiAssistant.insGrowth" : "aiAssistant.insDecline",
      messageParams: { pct: Math.abs(revenueForecast.percentChange) },
      actionKey: revenueForecast.percentChange < 0 ? "aiAssistant.insDeclineAction" : undefined,
    })
  }

  if (flagship.deadStock.length > 0) {
    insights.push({
      type: "warning",
      messageKey: "aiAssistant.insDeadStock",
      messageParams: { count: flagship.deadStock.length },
      actionKey: "aiAssistant.insDeadStockAction",
    })
  }

  return insights
}
