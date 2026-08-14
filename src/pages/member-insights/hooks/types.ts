import type { MemberRow, PaymentRow, SubscriptionRow, AttendanceRow, PosTransactionRow, StaffRow } from "../lib/raw"
import type { MemberKpi, AggregateKpis, SubscriptionTypeStats, AttendancePeriod, ActivitySegment } from "../lib/kpi"
import type { ChurnRisk, ChurnDistribution } from "../lib/churn"
import type { SegmentAssignment, SegmentSummary } from "../lib/segmentation"
import type { BehaviorQuadrant, BehaviorBucket } from "../lib/behaviorMatrix"
import type { CoachAnalysis } from "../lib/coach"
import type { MemberRecommendation } from "../lib/recommend"
import type { FinanceStats } from "../lib/finance"

export interface MemberInsightsData {
  loading: boolean
  error: Error | null
  members: MemberRow[]
  subscriptions: SubscriptionRow[]
  payments: PaymentRow[]
  attendance: AttendanceRow[]
  posTransactions: PosTransactionRow[]
  staff: StaffRow[]
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
  coachAnalysis: CoachAnalysis
  recommendations: MemberRecommendation[]
  finance: FinanceStats
}
