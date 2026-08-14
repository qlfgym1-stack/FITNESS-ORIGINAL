import type { MemberRow, PaymentRow, SubscriptionRow, AttendanceRow, PosTransactionRow } from "./raw"
import { previousRange, inRange, type DateRange } from "./period"

export type ComparisonMetricKey =
  | "revenue"
  | "newMembers"
  | "checkIns"
  | "posSales"
  | "subscriptions"

export interface MetricValue {
  current: number
  previous: number
  deltaPct: number | null
}

export type MetricMap = Record<ComparisonMetricKey, MetricValue>

export interface ComparisonResult extends MetricMap {
  range: DateRange
  prevRange: DateRange
}

export function pctChange(previous: number, current: number): number | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return 100
  return ((current - previous) / previous) * 100
}

export function computeComparison(
  payments: PaymentRow[],
  members: MemberRow[],
  attendance: AttendanceRow[],
  pos: PosTransactionRow[],
  subs: SubscriptionRow[],
  range: DateRange
): ComparisonResult {
  const prevRange = previousRange(range)

  const metrics: MetricMap = {
    revenue: { current: 0, previous: 0, deltaPct: null },
    newMembers: { current: 0, previous: 0, deltaPct: null },
    checkIns: { current: 0, previous: 0, deltaPct: null },
    posSales: { current: 0, previous: 0, deltaPct: null },
    subscriptions: { current: 0, previous: 0, deltaPct: null },
  }

  for (const p of payments) {
    if (p.status !== "completed") continue
    if (inRange(p.payment_date, range)) metrics.revenue.current += p.amount
    else if (inRange(p.payment_date, prevRange)) metrics.revenue.previous += p.amount
  }

  for (const m of members) {
    if (inRange(m.created_at, range)) metrics.newMembers.current += 1
    else if (inRange(m.created_at, prevRange)) metrics.newMembers.previous += 1
  }

  for (const a of attendance) {
    if (!a.check_in) continue
    if (inRange(a.check_in, range)) metrics.checkIns.current += 1
    else if (inRange(a.check_in, prevRange)) metrics.checkIns.previous += 1
  }

  for (const tx of pos) {
    if (inRange(tx.created_at, range)) metrics.posSales.current += tx.total
    else if (inRange(tx.created_at, prevRange)) metrics.posSales.previous += tx.total
  }

  for (const s of subs) {
    if (inRange(s.start_date, range)) metrics.subscriptions.current += 1
    else if (inRange(s.start_date, prevRange)) metrics.subscriptions.previous += 1
  }

  const keys = Object.keys(metrics) as ComparisonMetricKey[]
  for (const key of keys) {
    metrics[key].deltaPct = pctChange(metrics[key].previous, metrics[key].current)
  }

  return { ...metrics, range, prevRange }
}
