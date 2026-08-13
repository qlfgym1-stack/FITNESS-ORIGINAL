import type { MemberRow, PaymentRow, SubscriptionRow, AttendanceRow, PosTransactionRow } from "../lib/raw"
import type { MemberKpi, AggregateKpis, SubscriptionTypeStats, AttendancePeriod, ActivitySegment } from "../lib/kpi"
import type { ChurnRisk, ChurnDistribution } from "../lib/churn"
import type { SegmentAssignment, SegmentSummary } from "../lib/segmentation"
import type { BehaviorQuadrant, BehaviorBucket } from "../lib/behaviorMatrix"

export interface MemberInsightsData {
  loading: boolean
  error: Error | null
  members: MemberRow[]
  subscriptions: SubscriptionRow[]
  payments: PaymentRow[]
  attendance: AttendanceRow[]
  posTransactions: PosTransactionRow[]
  memberKpis: MemberKpi[]
  aggregate: AggregateKpis
  risks: ChurnRisk[]
  churnDist: ChurnDistribution
  segments: SegmentAssignment[]
  segmentSummary: SegmentSummary[]
  behavior: Record<BehaviorQuadrant, BehaviorBucket>
  activity: ActivitySegment
  attendanceStats: AttendancePeriod
  typeStats: SubscriptionTypeStats[]
  highValue: MemberKpi[]
}
