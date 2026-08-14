import { describe, it, expect } from "vitest"
import { analyzeCoaches } from "./coach"
import type { MemberRow, StaffRow, PaymentRow, AttendanceRow } from "./raw"
import type { MemberKpi } from "./kpi"

const DAY = 86400000
const NOW = new Date("2026-08-14T12:00:00Z")

function member(id: string, over: Partial<MemberRow> = {}): MemberRow {
  return {
    id,
    first_name: "Jean",
    last_name: "Dupont",
    full_name: "Jean Dupont",
    status: "active",
    last_visit: new Date(NOW.getTime() - 2 * DAY).toISOString(),
    created_at: new Date(NOW.getTime() - 90 * DAY).toISOString(),
    coach_id: null,
    corporate_id: null,
    ...over,
  }
}

function staff(id: string, over: Partial<StaffRow> = {}): StaffRow {
  return {
    id,
    first_name: "Coach",
    last_name: "A",
    role: "coach",
    ...over,
  }
}

function kpi(memberId: string, over: Partial<MemberKpi> = {}): MemberKpi {
  return {
    memberId,
    fullName: "Jean Dupont",
    status: "active",
    lastVisit: new Date(NOW.getTime() - 2 * DAY).toISOString(),
    createdAt: new Date(NOW.getTime() - 90 * DAY).toISOString(),
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

function payment(memberId: string, amount: number, daysAgo = 5): PaymentRow {
  return {
    id: `p-${memberId}-${daysAgo}`,
    member_id: memberId,
    subscription_id: null,
    amount,
    payment_method: "cash",
    payment_date: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    status: "completed",
  }
}

function attendanceRow(memberId: string): AttendanceRow {
  return {
    member_id: memberId,
    check_in: new Date(NOW.getTime() - DAY).toISOString(),
    check_out: null,
    type: "check-in",
  }
}

describe("analyzeCoaches", () => {
  it("groups members by coach and aggregates revenue/attendance", () => {
    const c1 = staff("c1", { first_name: "Karim", last_name: "Slimani" })
    const c2 = staff("c2", { first_name: "Nadia", last_name: "Bekkar" })
    const members = [
      member("m1", { coach_id: "c1" }),
      member("m2", { coach_id: "c1" }),
      member("m3", { coach_id: "c2" }),
      member("m4", { coach_id: null }),
    ]
    const kpis = [
      kpi("m1", { lifetimeValue: 10000, daysSinceLastVisit: 2 }),
      kpi("m2", { lifetimeValue: 5000, daysSinceLastVisit: 2 }),
      kpi("m3", { lifetimeValue: 2000, daysSinceLastVisit: 2 }),
      kpi("m4", { lifetimeValue: 0, daysSinceLastVisit: 2 }),
    ]
    const payments = [payment("m1", 2500), payment("m2", 2500), payment("m3", 6000)]
    const attendance = [attendanceRow("m1"), attendanceRow("m1"), attendanceRow("m2")]

    const result = analyzeCoaches(members, [c1, c2], kpis, payments, attendance)

    expect(result.coaches).toHaveLength(2)
    const coach1 = result.coaches.find((c) => c.coachId === "c1")
    expect(coach1?.fullName).toBe("Karim Slimani")
    expect(coach1?.memberCount).toBe(2)
    expect(coach1?.activeCount).toBe(2)
    expect(coach1?.totalRevenue).toBe(5000)
    expect(coach1?.attendanceCount).toBe(3)
    expect(coach1?.avgAttendancePerMember).toBe(1.5)
    expect(coach1?.ltvAvg).toBe(7500)
    expect(coach1?.atRiskCount).toBe(0)

    const coach2 = result.coaches.find((c) => c.coachId === "c2")
    expect(coach2?.memberCount).toBe(1)
    expect(coach2?.totalRevenue).toBe(6000)

    expect(result.noCoach?.memberCount).toBe(1)
    expect(result.totalMembers).toBe(4)
  })

  it("counts at-risk members per coach", () => {
    const c1 = staff("c1")
    const members = [member("m1", { coach_id: "c1" }), member("m2", { coach_id: "c1" })]
    const kpis = [
      kpi("m1", { daysSinceLastVisit: 60 }),
      kpi("m2", { daysSinceLastVisit: 2, currentSub: { id: "s", member_id: "m2", subscription_type_id: "t", start_date: "2026-01-01", end_date: "2026-06-01", total_amount: 100, amount_paid: 0, status: "expired", type_name: "M", type_duration: 30, type_price: 100 } }),
    ]
    const result = analyzeCoaches(members, [c1], kpis, [], [])
    expect(result.coaches[0]?.atRiskCount).toBe(2)
  })

  it("ignores staff who are not coaches", () => {
    const c1 = staff("c1", { role: "manager" })
    const result = analyzeCoaches([member("m1", { coach_id: "c1" })], [c1], [kpi("m1")], [], [])
    expect(result.coaches).toHaveLength(0)
    expect(result.noCoach?.memberCount).toBe(1)
  })

  it("sorts coaches by member count descending", () => {
    const a = staff("a")
    const b = staff("b")
    const result = analyzeCoaches(
      [
        member("m1", { coach_id: "b" }),
        member("m2", { coach_id: "a" }),
        member("m3", { coach_id: "a" }),
      ],
      [a, b],
      [kpi("m1"), kpi("m2"), kpi("m3")],
      [],
      []
    )
    expect(result.coaches[0]?.coachId).toBe("a")
    expect(result.coaches[1]?.coachId).toBe("b")
  })
})
