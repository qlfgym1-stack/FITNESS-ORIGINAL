import type { MemberKpi } from "./kpi"

export type SegmentId =
  | "vip"
  | "veryActive"
  | "active"
  | "occasional"
  | "lowActivity"
  | "atRisk"
  | "expired"
  | "new"
  | "loyal"
  | "bigSpender"
  | "bigPayer"
  | "subNoConsumption"
  | "subHighAttendance"

export interface SegmentAssignment {
  memberId: string
  fullName: string
  segments: SegmentId[]
  score: number
}

const VIP_LTV = 50000
const BIG_SPENDER_POS = 20000
const BIG_PAYER_PAID = 30000
const LOYAL_RENEWALS = 2
const NEW_DAYS = 30
const AT_RISK_DAYS = 30
const AT_RISK_EXPIRY = 14
const HIGH_ATTENDANCE = 15
const OCCASIONAL_ATTENDANCE = 4

export function segmentMembers(kpis: MemberKpi[]): SegmentAssignment[] {
  const now = Date.now()
  const result: SegmentAssignment[] = []
  for (const k of kpis) {
    const segments = new Set<SegmentId>()
    let score = 0
    if (k.lifetimeValue >= VIP_LTV && k.attendanceCount >= HIGH_ATTENDANCE) {
      segments.add("vip")
      score += 40
    }
    if (k.attendanceCount >= HIGH_ATTENDANCE) {
      segments.add("veryActive")
      score += 10
    }
    if (k.attendanceCount >= 10 && k.attendanceCount < HIGH_ATTENDANCE) {
      segments.add("active")
      score += 5
    }
    if (k.attendanceCount >= OCCASIONAL_ATTENDANCE && k.attendanceCount < 10) {
      segments.add("occasional")
    }
    if (k.attendanceCount >= 1 && k.attendanceCount < OCCASIONAL_ATTENDANCE) {
      segments.add("lowActivity")
    }
    if (k.posTotal >= BIG_SPENDER_POS) {
      segments.add("bigSpender")
      score += 15
    }
    if (k.totalPaid >= BIG_PAYER_PAID) {
      segments.add("bigPayer")
      score += 15
    }
    if (k.renewalsCount >= LOYAL_RENEWALS) {
      segments.add("loyal")
      score += 20
    }
    if (k.currentSub && k.attendanceCount === 0) {
      segments.add("subNoConsumption")
      score -= 10
    }
    if (k.currentSub && k.currentSub.status === "active" && k.attendanceCount >= HIGH_ATTENDANCE) {
      segments.add("subHighAttendance")
      score += 15
    }
    if (k.currentSub?.status === "expired") {
      segments.add("expired")
      score -= 5
    }
    const created = new Date(k.createdAt).getTime()
    const daysSinceCreated = Math.floor((now - created) / 86400000)
    if (daysSinceCreated <= NEW_DAYS) {
      segments.add("new")
    }
    const lastVisitDays = k.daysSinceLastVisit
    const subEnd = k.currentSub?.end_date
    let expirySoon = false
    if (subEnd && k.currentSub?.status === "active") {
      const daysLeft = Math.floor((new Date(subEnd).getTime() - now) / 86400000)
      if (daysLeft >= 0 && daysLeft <= AT_RISK_EXPIRY) expirySoon = true
    }
    const noVisitLong = lastVisitDays === null || lastVisitDays > AT_RISK_DAYS
    const lowRenewalHistory = k.totalSubscriptionsCount <= 1 && k.currentSub?.status === "expired"
    if ((noVisitLong && (expirySoon || k.currentSub?.status === "expired")) || lowRenewalHistory) {
      segments.add("atRisk")
      score -= 25
    }
    result.push({
      memberId: k.memberId,
      fullName: k.fullName,
      segments: Array.from(segments),
      score,
    })
  }
  return result
}

export interface SegmentSummary {
  segment: SegmentId
  count: number
}

export function summarizeSegments(assignments: SegmentAssignment[]): SegmentSummary[] {
  const map = new Map<SegmentId, number>()
  for (const a of assignments) {
    for (const s of a.segments) map.set(s, (map.get(s) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([segment, count]) => ({ segment, count }))
    .sort((a, b) => b.count - a.count)
}

export function membersWithSegment(assignments: SegmentAssignment[], segment: SegmentId): SegmentAssignment[] {
  return assignments.filter((a) => a.segments.includes(segment))
}
