import { describe, it, expect } from "vitest"
import { computeMemberKpis, aggregateKpis, analyzeSubscriptionTypes, analyzeAttendance, activitySegment } from "./kpi"
import type { MemberKpi } from "./kpi"
import type { MemberRow, SubscriptionRow, PaymentRow, AttendanceRow, PosTransactionRow } from "./raw"

const DAY = 86400000

function member(over: Partial<MemberRow> = {}): MemberRow {
  return {
    id: "m1",
    first_name: "Jean",
    last_name: "Dupont",
    full_name: "Jean Dupont",
    status: "active",
    last_visit: new Date(Date.now() - 2 * DAY).toISOString(),
    created_at: new Date(Date.now() - 90 * DAY).toISOString(),
    coach_id: null,
    corporate_id: null,
    ...over,
  }
}

function subscription(over: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "s1",
    member_id: "m1",
    subscription_type_id: "t1",
    start_date: new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
    total_amount: 2500,
    amount_paid: 2500,
    status: "active",
    type_name: "Mensuel",
    type_duration: 30,
    type_price: 2500,
    ...over,
  }
}

function payment(over: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "p1",
    member_id: "m1",
    subscription_id: "s1",
    amount: 2500,
    payment_method: "cash",
    payment_date: new Date(Date.now() - 30 * DAY).toISOString(),
    status: "completed",
    ...over,
  }
}

function attendanceRow(over: Partial<AttendanceRow> = {}): AttendanceRow {
  return {
    member_id: "m1",
    check_in: new Date(Date.now() - DAY).toISOString(),
    check_out: null,
    type: "check-in",
    ...over,
  }
}

function pos(over: Partial<PosTransactionRow> = {}): PosTransactionRow {
  return {
    id: "pos1",
    member_id: "m1",
    total: 12000,
    created_at: new Date(Date.now() - 3 * DAY).toISOString(),
    items: [
      { id: "prod1", name: "Whey", price: 6000, quantity: 2 },
      { id: "prod2", name: "Shaker", price: 800, quantity: 1 },
    ],
    ...over,
  }
}

describe("computeMemberKpis", () => {
  it("computes lifetime value as paid + pos total", () => {
    const kpis = computeMemberKpis(
      [member()],
      [subscription()],
      [payment({ amount: 3000 })],
      [attendanceRow()],
      [pos()]
    )
    expect(kpis).toHaveLength(1)
    expect(kpis[0]?.totalPaid).toBe(3000)
    expect(kpis[0]?.posTotal).toBe(12000)
    expect(kpis[0]?.lifetimeValue).toBe(15000)
  })

  it("counts renewals as subscriptions minus one", () => {
    const kpis = computeMemberKpis(
      [member()],
      [subscription({ id: "s1" }), subscription({ id: "s2", start_date: new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10) })],
      [],
      [],
      []
    )
    expect(kpis[0]?.renewalsCount).toBe(1)
    expect(kpis[0]?.totalSubscriptionsCount).toBe(2)
  })

  it("counts attendance and top pos products sorted by revenue", () => {
    const kpis = computeMemberKpis(
      [member()],
      [subscription()],
      [],
      [attendanceRow(), attendanceRow(), attendanceRow()],
      [pos()]
    )
    expect(kpis[0]?.attendanceCount).toBe(3)
    expect(kpis[0]?.topPosProducts.map((p) => p.id)).toEqual(["prod1", "prod2"])
    expect(kpis[0]?.topPosProducts[0]?.quantity).toBe(2)
  })

  it("computes days since last visit from a recent visit", () => {
    const kpis = computeMemberKpis([member()], [], [], [], [])
    expect(kpis[0]?.daysSinceLastVisit).not.toBeNull()
    expect(kpis[0]?.daysSinceLastVisit).toBeLessThanOrEqual(3)
  })
})

describe("aggregateKpis", () => {
  it("returns zeroes when no members", () => {
    const agg = aggregateKpis([])
    expect(agg.totalMembers).toBe(0)
    expect(agg.ltvAvg).toBe(0)
    expect(agg.renewalRate).toBe(0)
  })

  it("counts active/inactive/suspended and averages ltv", () => {
    const kpiA: MemberKpi = kpiFixture({ memberId: "a", fullName: "A", status: "active", lifetimeValue: 10000, renewalsCount: 1 })
    const kpiB: MemberKpi = kpiFixture({ memberId: "b", fullName: "B", status: "inactive", lifetimeValue: 20000 })
    const kpiC: MemberKpi = kpiFixture({ memberId: "c", fullName: "C", status: "suspended", lifetimeValue: 0 })
    const agg = aggregateKpis([kpiA, kpiB, kpiC])
    expect(agg.totalMembers).toBe(3)
    expect(agg.activeMembers).toBe(1)
    expect(agg.inactiveMembers).toBe(1)
    expect(agg.suspendedMembers).toBe(1)
    expect(agg.ltvAvg).toBe(10000)
    expect(agg.renewalRate).toBeCloseTo(33.33, 2)
  })
})

describe("analyzeSubscriptionTypes", () => {
  it("groups subscriptions by type and sums revenue", () => {
    const stats = analyzeSubscriptionTypes([
      subscription({ id: "s1", subscription_type_id: "t1", amount_paid: 2500, status: "active" }),
      subscription({ id: "s2", subscription_type_id: "t1", amount_paid: 2500, status: "expired" }),
      subscription({ id: "s3", subscription_type_id: "t2", amount_paid: 6000, status: "active" }),
    ])
    expect(stats).toHaveLength(2)
    const t1 = stats.find((s) => s.typeId === "t1")
    expect(t1?.totalSubscriptions).toBe(2)
    expect(t1?.activeCount).toBe(1)
    expect(t1?.expiredCount).toBe(1)
    expect(t1?.totalRevenue).toBe(5000)
    const t2 = stats.find((s) => s.typeId === "t2")
    expect(t2?.totalRevenue).toBe(6000)
  })

  it("sorts types by revenue descending", () => {
    const stats = analyzeSubscriptionTypes([
      subscription({ id: "s1", subscription_type_id: "t1", amount_paid: 1000 }),
      subscription({ id: "s2", subscription_type_id: "t2", amount_paid: 5000 }),
    ])
    expect(stats[0]?.typeId).toBe("t2")
  })
})

describe("analyzeAttendance", () => {
  it("counts entries and buckets by month", () => {
    const rows = [attendanceRow(), attendanceRow({ check_in: new Date(Date.now() - 40 * DAY).toISOString() })]
    const stats = analyzeAttendance(rows, 2)
    expect(stats.totalEntries).toBe(2)
    expect(stats.avgEntriesPerMember).toBe(1)
    expect(stats.entriesByMonth.length).toBeGreaterThanOrEqual(1)
    const total = stats.entriesByMonth.reduce((sum, e) => sum + e.count, 0)
    expect(total).toBe(2)
  })

  it("tracks the last entry", () => {
    const stats = analyzeAttendance([attendanceRow({ check_in: new Date(Date.now() - 5 * DAY).toISOString() })], 1)
    expect(stats.lastEntry).not.toBeNull()
  })
})

describe("activitySegment", () => {
  it("buckets members by attendance count", () => {
    const seg = activitySegment([
      kpiFixture({ memberId: "a", attendanceCount: 25 }),
      kpiFixture({ memberId: "b", attendanceCount: 12 }),
      kpiFixture({ memberId: "c", attendanceCount: 5 }),
      kpiFixture({ memberId: "d", attendanceCount: 1 }),
      kpiFixture({ memberId: "e", status: "inactive", attendanceCount: 0 }),
    ])
    expect(seg.veryActive).toBe(1)
    expect(seg.active).toBe(1)
    expect(seg.moderate).toBe(1)
    expect(seg.low).toBe(1)
    expect(seg.inactive).toBe(1)
  })
})

function kpiFixture(over: Partial<MemberKpi> = {}): MemberKpi {
  return {
    memberId: "a",
    fullName: "A",
    status: "active",
    lastVisit: new Date(Date.now() - DAY).toISOString(),
    createdAt: new Date(Date.now() - 90 * DAY).toISOString(),
    currentSub: null,
    renewalsCount: 0,
    totalSubscriptionsCount: 1,
    totalPaid: 0,
    paymentsCount: 0,
    attendanceCount: 0,
    posTotal: 0,
    posCount: 0,
    uniquePosProducts: 0,
    topPosProducts: [],
    daysSinceLastVisit: 1,
    daysSinceLastPayment: null,
    avgDaysBetweenSubs: null,
    subGaps: [],
    attendanceFrequency: 0,
    posPerAttendance: 0,
    lifetimeValue: 0,
    ...over,
  }
}
