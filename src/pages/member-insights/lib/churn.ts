import type { MemberKpi } from "./kpi"

export type ChurnRiskLevel = "low" | "medium" | "high"

export interface ChurnRisk {
  memberId: string
  fullName: string
  score: number
  level: ChurnRiskLevel
  reasons: string[]
}

const REASON_DROPPING_ATTENDANCE = -20
const REASON_LONG_ABSENCE = -25
const REASON_EXPIRY_SOON = -25
const REASON_EXPIRED_NO_RENEWAL = -30
const REASON_NO_RENEWAL_HISTORY = -15
const REASON_LOW_HISTORY = -10
const REASON_LOW_CONSUMPTION_DROP = -10

export function churnRiskFor(k: MemberKpi): ChurnRisk {
  let score = 50
  const reasons: string[] = []

  if (k.currentSub?.status === "expired") {
    score += REASON_EXPIRED_NO_RENEWAL
    reasons.push("abonnement expiré non renouvelé")
  } else if (k.currentSub?.status === "active" && k.currentSub.end_date) {
    const daysLeft = Math.floor((new Date(k.currentSub.end_date).getTime() - Date.now()) / 86400000)
    if (daysLeft >= 0 && daysLeft <= 14) {
      score += REASON_EXPIRY_SOON
      reasons.push(`abonnement expire dans ${daysLeft} jour(s)`)
    }
  }

  if (k.daysSinceLastVisit !== null) {
    if (k.daysSinceLastVisit > 60) {
      score += REASON_LONG_ABSENCE
      reasons.push(`absence depuis ${k.daysSinceLastVisit} jour(s)`)
    } else if (k.daysSinceLastVisit > 30) {
      score += REASON_DROPPING_ATTENDANCE
      reasons.push(`dernière visite il y a ${k.daysSinceLastVisit} jour(s)`)
    }
  }

  if (k.totalSubscriptionsCount <= 1 && k.currentSub?.status === "expired") {
    score += REASON_NO_RENEWAL_HISTORY
    reasons.push("aucun historique de renouvellement")
  }

  if (k.attendanceFrequency > 0 && k.attendanceFrequency < 0.5) {
    score += REASON_LOW_HISTORY
    reasons.push(`fréquentation très faible (${k.attendanceFrequency.toFixed(1)}/souscription)`)
  }

  if (k.posCount > 0 && k.posCount < 2 && k.attendanceCount >= 5) {
    score += REASON_LOW_CONSUMPTION_DROP
    reasons.push("consommation POS en baisse")
  }

  score = Math.max(0, Math.min(100, score))
  const level: ChurnRiskLevel = score >= 70 ? "low" : score >= 40 ? "medium" : "high"
  return { memberId: k.memberId, fullName: k.fullName, score, level, reasons }
}

export function churnRiskBatch(kpis: MemberKpi[]): ChurnRisk[] {
  return kpis.map(churnRiskFor).sort((a, b) => a.score - b.score)
}

export interface ChurnDistribution {
  low: number
  medium: number
  high: number
}

export function churnDistribution(risks: ChurnRisk[]): ChurnDistribution {
  const d: ChurnDistribution = { low: 0, medium: 0, high: 0 }
  for (const r of risks) d[r.level] += 1
  return d
}
