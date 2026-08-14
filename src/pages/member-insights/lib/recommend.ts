import type { MemberKpi } from "./kpi"

export type RecommendationType =
  | "renew-soon"
  | "expired"
  | "at-risk"
  | "no-consumption"
  | "upsell"
  | "reactivate-high-value"

export interface MemberRecommendation {
  memberId: string
  fullName: string
  type: RecommendationType
  priority: number
  days: number | null
}

const RENEW_SOON_DAYS = 7
const AT_RISK_DAYS = 21
const UPSELL_POS_TOTAL = 10000
const REACTIVATE_LTV = 30000

export function generateRecommendations(kpis: MemberKpi[], limitPerType = 20): MemberRecommendation[] {
  const now = Date.now()
  const out: MemberRecommendation[] = []
  const counters = new Map<RecommendationType, number>()

  for (const k of kpis) {
    const push = (type: RecommendationType, priority: number, days: number | null): boolean => {
      const count = counters.get(type) ?? 0
      if (count >= limitPerType) return false
      counters.set(type, count + 1)
      out.push({ memberId: k.memberId, fullName: k.fullName, type, priority, days })
      return true
    }

    if (k.currentSub?.status === "active" && k.currentSub.end_date) {
      const daysLeft = Math.floor((new Date(k.currentSub.end_date).getTime() - now) / 86400000)
      if (daysLeft >= 0 && daysLeft <= RENEW_SOON_DAYS) {
        push("renew-soon", 0, daysLeft)
      }
    }

    if (k.currentSub?.status === "expired") {
      push("expired", 0, k.daysSinceLastPayment)
    }

    if (k.daysSinceLastVisit !== null && k.daysSinceLastVisit > AT_RISK_DAYS) {
      push("at-risk", 1, k.daysSinceLastVisit)
    }

    if (k.currentSub && k.currentSub.status === "active" && k.attendanceCount === 0) {
      push("no-consumption", 1, null)
    }

    if (k.status === "inactive" && k.lifetimeValue >= REACTIVATE_LTV) {
      push("reactivate-high-value", 1, null)
    }

    if (k.posTotal >= UPSELL_POS_TOTAL && k.currentSub && k.currentSub.type_duration <= 30) {
      push("upsell", 2, null)
    }
  }

  return out.sort((a, b) => a.priority - b.priority || a.fullName.localeCompare(b.fullName))
}

export function recommendationGroups(
  recommendations: MemberRecommendation[]
): Record<number, MemberRecommendation[]> {
  return {
    0: recommendations.filter((r) => r.priority === 0),
    1: recommendations.filter((r) => r.priority === 1),
    2: recommendations.filter((r) => r.priority === 2),
  }
}
