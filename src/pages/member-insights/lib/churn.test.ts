import { describe, it, expect } from "vitest"
import { churnRiskFor, churnRiskBatch, churnDistribution } from "./churn"
import type { MemberKpi } from "./kpi"
import type { SubscriptionRow } from "./raw"

const DAY = 86400000

function activeSub(daysToEnd: number, status: string = "active"): SubscriptionRow {
  return {
    id: "s1",
    member_id: "m1",
    subscription_type_id: "t1",
    start_date: new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + daysToEnd * DAY).toISOString().slice(0, 10),
    total_amount: 2500,
    amount_paid: 2500,
    status,
    type_name: "Mensuel",
    type_duration: 30,
    type_price: 2500,
  }
}

function kpi(over: Partial<MemberKpi> = {}): MemberKpi {
  return {
    memberId: "m1",
    fullName: "Jean Dupont",
    status: "active",
    lastVisit: new Date(Date.now() - 2 * DAY).toISOString(),
    createdAt: new Date(Date.now() - 90 * DAY).toISOString(),
    currentSub: activeSub(30),
    renewalsCount: 1,
    totalSubscriptionsCount: 2,
    totalPaid: 5000,
    paymentsCount: 2,
    attendanceCount: 15,
    posTotal: 12000,
    posCount: 3,
    uniquePosProducts: 2,
    topPosProducts: [],
    daysSinceLastVisit: 2,
    daysSinceLastPayment: 10,
    avgDaysBetweenSubs: null,
    subGaps: [],
    attendanceFrequency: 7,
    posPerAttendance: 0.2,
    lifetimeValue: 17000,
    ...over,
  }
}

describe("churnRiskFor", () => {
  it("flags an expired non-renewed subscription as high risk", () => {
    const risk = churnRiskFor(
      kpi({
        currentSub: activeSub(-10, "expired"),
        totalSubscriptionsCount: 1,
        daysSinceLastVisit: 70,
      })
    )
    expect(risk.level).toBe("high")
    expect(risk.reasons.some((r) => r.includes("abonnement expiré"))).toBe(true)
  })

  it("flags an active subscription expiring within days as high risk", () => {
    const risk = churnRiskFor(kpi({ currentSub: activeSub(5) }))
    expect(risk.level).toBe("high")
    expect(risk.reasons.some((r) => r.includes("expire"))).toBe(true)
  })

  it("returns medium risk for a healthy member (maximum attainable score)", () => {
    const risk = churnRiskFor(kpi())
    expect(risk.score).toBe(50)
    expect(risk.level).toBe("medium")
  })

  it("clamps the score between 0 and 100", () => {
    const risk = churnRiskFor(
      kpi({
        currentSub: activeSub(-10, "expired"),
        totalSubscriptionsCount: 1,
        daysSinceLastVisit: 200,
      })
    )
    expect(risk.score).toBe(0)
  })
})

describe("churnRiskBatch", () => {
  it("sorts risks by ascending score (most at risk first)", () => {
    const low: MemberKpi = kpi({ memberId: "a", currentSub: activeSub(-10, "expired"), totalSubscriptionsCount: 1, daysSinceLastVisit: 70 })
    const high: MemberKpi = kpi({ memberId: "b" })
    const batch = churnRiskBatch([high, low])
    expect(batch[0]?.memberId).toBe("a")
    expect(batch[0]?.score).toBeLessThan(batch[1]?.score ?? 100)
  })
})

describe("churnDistribution", () => {
  it("counts risks per level", () => {
    const dist = churnDistribution([
      churnRiskFor(kpi({ memberId: "a", currentSub: activeSub(-10, "expired"), totalSubscriptionsCount: 1, daysSinceLastVisit: 70 })),
      churnRiskFor(kpi({ memberId: "b" })),
      churnRiskFor(kpi({ memberId: "c" })),
    ])
    expect(dist.high).toBe(1)
    expect(dist.medium).toBe(2)
    expect(dist.low).toBe(0)
  })
})
