import { describe, it, expect } from "vitest"
import { segmentMembers, summarizeSegments, membersWithSegment } from "./segmentation"
import type { SegmentAssignment } from "./segmentation"
import type { MemberKpi } from "./kpi"
import type { SubscriptionRow } from "./raw"

const DAY = 86400000

function sub(status: string, daysToEnd: number): SubscriptionRow {
  return {
    id: "s1",
    member_id: "m1",
    subscription_type_id: "t1",
    start_date: new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10),
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
    currentSub: sub("active", 30),
    renewalsCount: 0,
    totalSubscriptionsCount: 1,
    totalPaid: 0,
    paymentsCount: 0,
    attendanceCount: 0,
    posTotal: 0,
    posCount: 0,
    uniquePosProducts: 0,
    topPosProducts: [],
    daysSinceLastVisit: 2,
    daysSinceLastPayment: null,
    avgDaysBetweenSubs: null,
    subGaps: [],
    attendanceFrequency: 0,
    posPerAttendance: 0,
    lifetimeValue: 0,
    ...over,
  }
}

describe("segmentMembers", () => {
  it("assigns vip and veryActive to high-value frequent members", () => {
    const assignments = segmentMembers([
      kpi({ memberId: "vip", lifetimeValue: 60000, attendanceCount: 20, renewalsCount: 3 }),
    ])
    const a = assignments[0]!
    expect(a.segments).toContain("vip")
    expect(a.segments).toContain("veryActive")
    expect(a.segments).toContain("loyal")
    expect(a.segments).toContain("subHighAttendance")
  })

  it("assigns atRisk to members with an expired subscription and long absence", () => {
    const assignments = segmentMembers([
      kpi({ memberId: "risk", currentSub: sub("expired", -10), totalSubscriptionsCount: 1, daysSinceLastVisit: 40 }),
    ])
    expect(assignments[0]?.segments).toContain("atRisk")
    expect(assignments[0]?.segments).toContain("expired")
  })

  it("assigns new to members created recently", () => {
    const assignments = segmentMembers([
      kpi({ memberId: "new", createdAt: new Date(Date.now() - 10 * DAY).toISOString() }),
    ])
    expect(assignments[0]?.segments).toContain("new")
  })

  it("assigns bigSpender and bigPayer based on spend", () => {
    const assignments = segmentMembers([
      kpi({ memberId: "spender", posTotal: 25000, totalPaid: 35000 }),
    ])
    expect(assignments[0]?.segments).toContain("bigSpender")
    expect(assignments[0]?.segments).toContain("bigPayer")
  })
})

describe("summarizeSegments", () => {
  it("counts members per segment", () => {
    const summary = summarizeSegments([
      { memberId: "a", fullName: "A", segments: ["vip", "veryActive"], score: 50 },
      { memberId: "b", fullName: "B", segments: ["veryActive"], score: 10 },
      { memberId: "c", fullName: "C", segments: ["atRisk"], score: 0 },
    ])
    expect(summary.find((s) => s.segment === "vip")?.count).toBe(1)
    expect(summary.find((s) => s.segment === "veryActive")?.count).toBe(2)
    expect(summary.find((s) => s.segment === "atRisk")?.count).toBe(1)
  })
})

describe("membersWithSegment", () => {
  it("filters assignments by segment", () => {
    const assignments: SegmentAssignment[] = [
      { memberId: "a", fullName: "A", segments: ["vip"], score: 40 },
      { memberId: "b", fullName: "B", segments: ["active"], score: 5 },
    ]
    const vips = membersWithSegment(assignments, "vip")
    expect(vips).toHaveLength(1)
    expect(vips[0]?.memberId).toBe("a")
  })
})
