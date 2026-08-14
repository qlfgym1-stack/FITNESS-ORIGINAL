import { describe, it, expect } from "vitest"
import { periodRange, previousRange, inRange, type PeriodId } from "./period"
import { computeComparison, pctChange } from "./comparison"
import type { MemberRow, PaymentRow, SubscriptionRow, AttendanceRow, PosTransactionRow } from "./raw"

const DAY = 86400000
const NOW = new Date("2026-08-14T12:00:00Z")

describe("period", () => {
  it("builds a range ending now with the requested length", () => {
    const r = periodRange("30d", NOW)
    expect(r.end).toBe(NOW.toISOString())
    expect(new Date(r.start).getTime()).toBe(NOW.getTime() - 30 * DAY)
  })

  it("previousRange mirrors the same length before the range", () => {
    const r = periodRange("90d", NOW)
    const prev = previousRange(r)
    expect(prev.end).toBe(r.start)
    expect(new Date(r.end).getTime() - new Date(r.start).getTime()).toBe(
      new Date(prev.end).getTime() - new Date(prev.start).getTime()
    )
  })

  it("inRange respects boundaries (start inclusive, end exclusive)", () => {
    const r = periodRange("30d", NOW)
    expect(inRange(r.start, r)).toBe(true)
    expect(inRange(r.end, r)).toBe(false)
    expect(inRange(new Date(NOW.getTime() - 15 * DAY).toISOString(), r)).toBe(true)
  })
})

describe("pctChange", () => {
  it("computes a percentage change", () => {
    expect(pctChange(100, 150)).toBe(50)
    expect(pctChange(100, 80)).toBe(-20)
  })

  it("handles zero baselines", () => {
    expect(pctChange(0, 0)).toBeNull()
    expect(pctChange(0, 5)).toBe(100)
  })
})

describe("computeComparison", () => {
  function member(createdDaysAgo: number): MemberRow {
    return {
      id: `m-${createdDaysAgo}`,
      first_name: "Jean",
      last_name: "Dupont",
      full_name: "Jean Dupont",
      status: "active",
      last_visit: null,
      created_at: new Date(NOW.getTime() - createdDaysAgo * DAY).toISOString(),
      coach_id: null,
      corporate_id: null,
    }
  }

  function payment(daysAgo: number, amount = 2500): PaymentRow {
    return {
      id: `p-${daysAgo}`,
      member_id: "m1",
      subscription_id: "s1",
      amount,
      payment_method: "cash",
      payment_date: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      status: "completed",
    }
  }

  function attendance(daysAgo: number): AttendanceRow {
    return {
      member_id: "m1",
      check_in: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      check_out: null,
      type: "check-in",
    }
  }

  function pos(daysAgo: number, total = 1200): PosTransactionRow {
    return {
      id: `pos-${daysAgo}`,
      member_id: "m1",
      total,
      created_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      items: null,
    }
  }

  function sub(daysAgo: number): SubscriptionRow {
    return {
      id: `s-${daysAgo}`,
      member_id: "m1",
      subscription_type_id: "t1",
      start_date: new Date(NOW.getTime() - daysAgo * DAY).toISOString().slice(0, 10),
      end_date: new Date(NOW.getTime() + 30 * DAY).toISOString().slice(0, 10),
      total_amount: 2500,
      amount_paid: 2500,
      status: "active",
      type_name: "Mensuel",
      type_duration: 30,
      type_price: 2500,
    }
  }

  const range = periodRange("30d", NOW) // current = [30d ago, now], previous = [60d ago, 30d ago]

  it("splits data between the current and previous period", () => {
    const res = computeComparison(
      [payment(10, 2500), payment(40, 3000), payment(100, 900)], // current: 2500, previous: 3000, older: ignored
      [member(5), member(45)], // current: 1 new, previous: 1 new
      [attendance(2), attendance(35), attendance(80)], // current: 1, previous: 1
      [pos(8, 1200), pos(50, 600)], // current: 1200, previous: 600
      [sub(3), sub(33)], // current: 1, previous: 1
      range
    )
    expect(res.revenue.current).toBe(2500)
    expect(res.revenue.previous).toBe(3000)
    expect(res.revenue.deltaPct).toBeCloseTo(-16.67, 2)
    expect(res.newMembers.current).toBe(1)
    expect(res.newMembers.previous).toBe(1)
    expect(res.checkIns.current).toBe(1)
    expect(res.checkIns.previous).toBe(1)
    expect(res.posSales.current).toBe(1200)
    expect(res.posSales.previous).toBe(600)
    expect(res.subscriptions.current).toBe(1)
    expect(res.subscriptions.previous).toBe(1)
  })

  it("ignores payments that are not completed", () => {
    const res = computeComparison(
      [payment(10, 2500), { ...payment(5, 5000), status: "refunded" }],
      [],
      [],
      [],
      [],
      range
    )
    expect(res.revenue.current).toBe(2500)
  })

  it("returns null delta when both periods are empty", () => {
    const res = computeComparison([], [], [], [], [], range)
    expect(res.revenue.deltaPct).toBeNull()
    expect(res.posSales.deltaPct).toBeNull()
  })

  it("returns 100% delta when previous is empty but current is not", () => {
    const res = computeComparison(
      [payment(5, 1000)],
      [],
      [],
      [],
      [],
      range
    )
    expect(res.revenue.deltaPct).toBe(100)
  })
})
