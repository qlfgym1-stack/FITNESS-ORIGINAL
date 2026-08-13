import { describe, it, expect } from "vitest"
import { classifyBehaviorQuadrant, behaviorMatrix, highValueAtRisk } from "./behaviorMatrix"
import type { MemberKpi } from "./kpi"
import type { SubscriptionRow } from "./raw"

const DAY = 86400000

function sub(status: string): SubscriptionRow {
  return {
    id: "s1",
    member_id: "m1",
    subscription_type_id: "t1",
    start_date: new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
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
    currentSub: sub("active"),
    renewalsCount: 1,
    totalSubscriptionsCount: 2,
    totalPaid: 5000,
    paymentsCount: 2,
    attendanceCount: 5,
    posTotal: 12000,
    posCount: 3,
    uniquePosProducts: 2,
    topPosProducts: [],
    daysSinceLastVisit: 2,
    daysSinceLastPayment: 10,
    avgDaysBetweenSubs: null,
    subGaps: [],
    attendanceFrequency: 2,
    posPerAttendance: 0.6,
    lifetimeValue: 17000,
    ...over,
  }
}

describe("classifyBehaviorQuadrant", () => {
  it("classifies active & high spend", () => {
    const q = classifyBehaviorQuadrant(kpi({ attendanceCount: 6, posTotal: 15000 }))
    expect(q).toBe("activeHighSpend")
  })

  it("classifies active & low spend", () => {
    const q = classifyBehaviorQuadrant(kpi({ attendanceCount: 6, posTotal: 500 }))
    expect(q).toBe("activeLowSpend")
  })

  it("classifies inactive & high spend", () => {
    const q = classifyBehaviorQuadrant(kpi({ attendanceCount: 2, posTotal: 12000 }))
    expect(q).toBe("inactiveHighSpend")
  })

  it("returns null for a member with no activity", () => {
    const q = classifyBehaviorQuadrant(kpi({ attendanceCount: 0, posTotal: 0 }))
    expect(q).toBeNull()
  })
})

describe("behaviorMatrix", () => {
  it("buckets members and computes avg ltv", () => {
    const matrix = behaviorMatrix([
      kpi({ memberId: "a", attendanceCount: 6, posTotal: 15000, lifetimeValue: 20000 }),
      kpi({ memberId: "b", attendanceCount: 6, posTotal: 15000, lifetimeValue: 40000 }),
      kpi({ memberId: "c", attendanceCount: 6, posTotal: 500, lifetimeValue: 5000 }),
      kpi({ memberId: "d", attendanceCount: 0, posTotal: 0, lifetimeValue: 0 }),
    ])
    expect(matrix.activeHighSpend.count).toBe(2)
    expect(matrix.activeHighSpend.totalLtv).toBe(60000)
    expect(matrix.activeHighSpend.avgLtv).toBe(30000)
    expect(matrix.activeLowSpend.count).toBe(1)
    expect(matrix.inactiveLowSpend.count).toBe(0)
  })
})

describe("highValueAtRisk", () => {
  it("returns high-ltv members with an expired subscription", () => {
    const atRisk = highValueAtRisk([
      kpi({ memberId: "a", lifetimeValue: 50000, currentSub: sub("expired") }),
      kpi({ memberId: "b", lifetimeValue: 50000, currentSub: sub("active") }),
      kpi({ memberId: "c", lifetimeValue: 500, currentSub: sub("expired") }),
    ])
    expect(atRisk).toHaveLength(1)
    expect(atRisk[0]?.memberId).toBe("a")
  })
})
