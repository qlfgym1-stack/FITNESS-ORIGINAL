import type { MemberKpi } from "./kpi"

export type BehaviorQuadrant =
  | "activeHighSpend"
  | "activeLowSpend"
  | "inactiveHighSpend"
  | "inactiveLowSpend"

export interface BehaviorBucket {
  quadrant: BehaviorQuadrant
  count: number
  totalLtv: number
  avgLtv: number
}

const HIGH_SPEND = 10000
const LOW_VISIT = 3

export function classifyBehaviorQuadrant(k: MemberKpi): BehaviorQuadrant | null {
  if (k.attendanceCount === 0 && k.posTotal === 0) return null
  const active = k.attendanceCount >= LOW_VISIT
  const highSpend = k.posTotal >= HIGH_SPEND
  if (active && highSpend) return "activeHighSpend"
  if (active && !highSpend) return "activeLowSpend"
  if (!active && highSpend) return "inactiveHighSpend"
  return "inactiveLowSpend"
}

export function behaviorMatrix(kpis: MemberKpi[]): Record<BehaviorQuadrant, BehaviorBucket> {
  const out: Record<BehaviorQuadrant, BehaviorBucket> = {
    activeHighSpend: { quadrant: "activeHighSpend", count: 0, totalLtv: 0, avgLtv: 0 },
    activeLowSpend: { quadrant: "activeLowSpend", count: 0, totalLtv: 0, avgLtv: 0 },
    inactiveHighSpend: { quadrant: "inactiveHighSpend", count: 0, totalLtv: 0, avgLtv: 0 },
    inactiveLowSpend: { quadrant: "inactiveLowSpend", count: 0, totalLtv: 0, avgLtv: 0 },
  }
  for (const k of kpis) {
    const q = classifyBehaviorQuadrant(k)
    if (!q) continue
    out[q].count += 1
    out[q].totalLtv += k.lifetimeValue
  }
  for (const k of Object.keys(out) as BehaviorQuadrant[]) {
    out[k].avgLtv = out[k].count > 0 ? out[k].totalLtv / out[k].count : 0
  }
  return out
}

export function highValueAtRisk(kpis: MemberKpi[]): MemberKpi[] {
  return kpis.filter((k) => k.lifetimeValue >= HIGH_SPEND && k.currentSub?.status === "expired")
}
