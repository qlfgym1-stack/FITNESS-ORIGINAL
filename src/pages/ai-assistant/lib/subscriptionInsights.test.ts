import { describe, it, expect } from "vitest"
import { analyzeSubscriptions } from "./subscriptionInsights"
import type { MemberRow, SubscriptionRow } from "./raw"

function endDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86400000)
  return d.toISOString().slice(0, 10)
}

function sub(id: string, opts: Partial<Omit<SubscriptionRow, "id">>): SubscriptionRow {
  return {
    id,
    total_amount: 2500,
    amount_paid: 2500,
    status: "active",
    start_date: "2026-01-01",
    end_date: endDate(45),
    member_id: id,
    member_name: id,
    type_name: "Mensuel",
    ...opts,
  }
}

const MEMBERS: MemberRow[] = [
  { id: "m1", status: "active", created_at: "2026-01-01", last_visit: null },
  { id: "m2", status: "inactive", created_at: "2026-01-01", last_visit: null },
  { id: "m3", status: "active", created_at: "2026-01-01", last_visit: null },
]

describe("analyzeSubscriptions", () => {
  it("separates expirations within 30 vs 60 days", () => {
    const rows = [
      sub("m1", { member_name: "A", end_date: endDate(10) }),
      sub("m2", { member_name: "B", end_date: endDate(45) }),
      sub("m3", { member_name: "C", end_date: endDate(90) }),
    ]
    const result = analyzeSubscriptions(rows, MEMBERS)
    expect(result.expiring30.map((e) => e.memberName)).toEqual(["A"])
    expect(result.expiring60.map((e) => e.memberName)).toEqual(["A", "B"])
  })

  it("identifies the best subscription by paid revenue", () => {
    const rows = [
      sub("m1", { member_name: "A", type_name: "Mensuel", amount_paid: 2500 }),
      sub("m2", { member_name: "B", type_name: "Trimestriel", amount_paid: 7000 }),
      sub("m3", { member_name: "C", type_name: "Mensuel", amount_paid: 2500 }),
    ]
    const result = analyzeSubscriptions(rows, MEMBERS)
    expect(result.bestType?.name).toBe("Trimestriel")
    expect(result.bestType?.count).toBe(1)
  })

  it("computes churn risk from inactive members", () => {
    const result = analyzeSubscriptions([], MEMBERS)
    expect(result.churnRisk).toBe(33)
  })

  it("ignores expired subscriptions in expirations list", () => {
    const rows = [sub("m1", { member_name: "A", status: "expired", end_date: endDate(5) })]
    const result = analyzeSubscriptions(rows, MEMBERS)
    expect(result.expiring30.length).toBe(0)
  })
})
