import type { ExpiringSubscription, SubscriptionInsight } from "../hooks/types"
import type { MemberRow, SubscriptionRow } from "./raw"

export function analyzeSubscriptions(
  rows: SubscriptionRow[],
  members: MemberRow[]
): SubscriptionInsight {
  const now = new Date()
  const active = rows.filter((r) => r.status === "active")

  const expiring: ExpiringSubscription[] = []
  for (const r of active) {
    const end = new Date(r.end_date + "T23:59:59")
    if (isNaN(end.getTime())) continue
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000)
    if (daysLeft >= 0 && daysLeft <= 60) {
      expiring.push({
        memberId: r.member_id,
        memberName: r.member_name,
        subscriptionName: r.type_name,
        endDate: r.end_date,
        daysLeft,
        amount: r.total_amount,
      })
    }
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft)

  const byType = new Map<string, { revenue: number; count: number }>()
  for (const r of rows) {
    const t = byType.get(r.type_name) ?? { revenue: 0, count: 0 }
    t.revenue += Number(r.amount_paid) || 0
    t.count += 1
    byType.set(r.type_name, t)
  }
  let bestType: SubscriptionInsight["bestType"] = null
  for (const [name, v] of byType) {
    if (!bestType || v.revenue > bestType.revenue) bestType = { name, ...v }
  }

  const inactiveMembers = members.filter((m) => m.status === "inactive").length
  const churnRisk = members.length > 0 ? Math.round((inactiveMembers / members.length) * 100) : 0
  const paidTotal = rows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const avgRevenuePerMember = members.length > 0 ? paidTotal / members.length : 0

  return {
    bestType,
    expiring30: expiring.filter((e) => e.daysLeft <= 30),
    expiring60: expiring,
    activeCount: active.length,
    avgRevenuePerMember,
    inactiveMembers,
    churnRisk,
  }
}
