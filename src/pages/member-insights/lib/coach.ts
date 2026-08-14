import type { MemberRow, StaffRow } from "./raw"
import type { MemberKpi } from "./kpi"
import type { PaymentRow, AttendanceRow } from "./raw"

export interface CoachStats {
  coachId: string
  fullName: string
  memberCount: number
  activeCount: number
  totalRevenue: number
  attendanceCount: number
  atRiskCount: number
  avgAttendancePerMember: number
  ltvAvg: number
}

export interface CoachAnalysis {
  coaches: CoachStats[]
  noCoach: CoachStats | null
  totalMembers: number
}

const AT_RISK_DAYS = 30

function safeNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function analyzeCoaches(
  members: MemberRow[],
  staff: StaffRow[],
  memberKpis: MemberKpi[],
  payments: PaymentRow[],
  attendance: AttendanceRow[]
): CoachAnalysis {
  const staffById = new Map(staff.map((s) => [s.id, s]))

  const revenueByMember = new Map<string, number>()
  for (const p of payments) {
    if (p.status !== "completed") continue
    revenueByMember.set(p.member_id, (revenueByMember.get(p.member_id) ?? 0) + safeNum(p.amount))
  }

  const attendanceByMember = new Map<string, number>()
  for (const a of attendance) {
    if (!a.member_id) continue
    attendanceByMember.set(a.member_id, (attendanceByMember.get(a.member_id) ?? 0) + 1)
  }

  const kpiByMember = new Map<string, MemberKpi>()
  for (const k of memberKpis) kpiByMember.set(k.memberId, k)

  const buckets = new Map<string, MemberRow[]>()
  for (const m of members) {
    const staffMember = m.coach_id ? staffById.get(m.coach_id) : undefined
    const isCoach = staffMember?.role?.toLowerCase().includes("coach") === true
    const key = isCoach && m.coach_id ? m.coach_id : "__none__"
    const arr = buckets.get(key) ?? []
    arr.push(m)
    buckets.set(key, arr)
  }

  const coaches: CoachStats[] = []
  for (const s of staff) {
    if (!s.role?.toLowerCase().includes("coach")) continue
    coaches.push(buildStats(s.id, `${s.first_name} ${s.last_name}`.trim(), buckets.get(s.id) ?? []))
  }
  coaches.sort((a, b) => b.memberCount - a.memberCount)

  const noCoachArr = buckets.get("__none__") ?? []
  const noCoach = noCoachArr.length > 0 ? buildStats("__none__", "—", noCoachArr) : null

  return {
    coaches,
    noCoach,
    totalMembers: members.length,
  }

  function buildStats(coachId: string, fullName: string, assigned: MemberRow[]): CoachStats {
    let activeCount = 0
    let totalRevenue = 0
    let attendanceCount = 0
    let atRiskCount = 0
    let ltvSum = 0
    for (const m of assigned) {
      if (m.status === "active") activeCount += 1
      totalRevenue += revenueByMember.get(m.id) ?? 0
      attendanceCount += attendanceByMember.get(m.id) ?? 0
      const kpi = kpiByMember.get(m.id)
      if (kpi) {
        ltvSum += kpi.lifetimeValue
        const lastVisitDays = kpi.daysSinceLastVisit
        if (lastVisitDays === null || lastVisitDays > AT_RISK_DAYS || kpi.currentSub?.status === "expired") {
          atRiskCount += 1
        }
      }
    }
    return {
      coachId,
      fullName,
      memberCount: assigned.length,
      activeCount,
      totalRevenue,
      attendanceCount,
      atRiskCount,
      avgAttendancePerMember: assigned.length > 0 ? attendanceCount / assigned.length : 0,
      ltvAvg: assigned.length > 0 ? ltvSum / assigned.length : 0,
    }
  }
}
