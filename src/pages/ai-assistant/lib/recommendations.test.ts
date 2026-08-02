import { describe, it, expect } from "vitest"
import { buildRecommendations } from "./recommendations"
import type { RecommendationsInput } from "./recommendations"
import type { FlagshipResult, PeakHoursResult, RevenueForecast, SubscriptionInsight } from "../hooks/types"

const EMPTY_PEAK: PeakHoursResult = {
  hourly: [],
  daily: [],
  peakHours: [],
  offPeakHours: [],
  busiestDay: 0,
  quietestDay: 0,
}

const EMPTY_FLAGSHIP: FlagshipResult = {
  topByRevenue: [],
  topByMargin: [],
  flagship: null,
  fastMovers: [],
  deadStock: [],
  slowMovers: [],
}

const EMPTY_SUBS: SubscriptionInsight = {
  bestType: null,
  expiring30: [],
  expiring60: [],
  activeCount: 0,
  avgRevenuePerMember: 0,
  inactiveMembers: 0,
  churnRisk: 0,
}

const EMPTY_FORECAST: RevenueForecast = {
  next3Months: [{ label: "M1", value: 0 }, { label: "M2", value: 0 }, { label: "M3", value: 0 }],
  confidence: 0,
  trend: "stable",
  percentChange: 0,
}

function input(overrides: Partial<RecommendationsInput> = {}): RecommendationsInput {
  return {
    netProfit: 1000,
    totalRevenue: 10000,
    totalExpenses: 5000,
    revenueForecast: { ...EMPTY_FORECAST, next3Months: [{ label: "M1", value: 8000 }, { label: "M2", value: 9000 }, { label: "M3", value: 10000 }] },
    peakHours: EMPTY_PEAK,
    flagship: EMPTY_FLAGSHIP,
    subscription: EMPTY_SUBS,
    hasData: true,
    ...overrides,
  }
}

describe("buildRecommendations", () => {
  it("emits P0 when profit is negative", () => {
    const actions = buildRecommendations(input({ netProfit: -500 }))
    expect(actions.find((a) => a.id === "profit-negative")?.priority).toBe("p0")
  })

  it("emits P0 when expenses exceed 85% of revenue", () => {
    const actions = buildRecommendations(input({ totalExpenses: 9000, totalRevenue: 10000 }))
    expect(actions.find((a) => a.id === "expense-ratio")?.priority).toBe("p0")
  })

  it("emits P1 off-peak action when off-peak hours exist", () => {
    const peak: PeakHoursResult = {
      ...EMPTY_PEAK,
      peakHours: [18],
      offPeakHours: [9, 15],
    }
    const actions = buildRecommendations(input({ peakHours: peak }))
    const offPeak = actions.find((a) => a.id === "off-peak")
    expect(offPeak?.priority).toBe("p1")
    expect(offPeak?.detailParams?.hours).toContain("9h")
  })

  it("emits P1 flagship action when a profitable flagship exists", () => {
    const flagship: FlagshipResult = {
      ...EMPTY_FLAGSHIP,
      flagship: { productId: "p1", name: "Whey", category: null, quantity: 5, orders: 5, revenue: 22500, cost: 14500, profit: 8000, marginPct: 35.5, stock: 10, score: 1000 },
    }
    const actions = buildRecommendations(input({ flagship }))
    expect(actions.find((a) => a.id === "flagship")?.priority).toBe("p1")
  })

  it("emits P1 renewal action when subscriptions expire within 30 days", () => {
    const subscription: SubscriptionInsight = {
      ...EMPTY_SUBS,
      expiring30: [{ memberId: "m1", memberName: "A", subscriptionName: "Mensuel", endDate: "2026-08-01", daysLeft: 5, amount: 2500 }],
    }
    const actions = buildRecommendations(input({ subscription }))
    expect(actions.find((a) => a.id === "renewal")?.priority).toBe("p1")
  })

  it("emits maintenance action when everything is healthy", () => {
    const actions = buildRecommendations(input())
    expect(actions.find((a) => a.id === "maintain")).toBeDefined()
  })
})
