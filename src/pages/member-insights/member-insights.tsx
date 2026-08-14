import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { useMemberInsightsData } from "./hooks/useMemberInsightsData"
import { PageHeader } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { KpiCards } from "./components/kpi-cards"
import { ActivitySection } from "./components/activity-section"
import { ChurnSection } from "./components/churn-section"
import { BehaviorMatrix } from "./components/behavior-matrix"
import { AttendanceSection } from "./components/attendance-section"
import { SubscriptionTypes } from "./components/subscription-types"
import { TopMembers } from "./components/top-members"
import { PeriodSection } from "./components/period-section"
import { SegmentationSection } from "./components/segmentation-section"
import { CoachSection } from "./components/coach-section"
import { RecommendationsSection } from "./components/recommendations-section"
import { FinanceSection } from "./components/finance-section"

export default function MemberInsights() {
  const t = useT()
  const { organization } = useAuth()
  const data = useMemberInsightsData()

  const hasData =
    data.members.length > 0 || data.subscriptions.length > 0 || data.payments.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("memberInsights.title")}
        description={`${organization?.name ?? ""} · ${t("memberInsights.subtitle")}`}
      />

      {data.loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data.error ? (
        <Card>
          <CardContent className="p-6 text-destructive">{t("memberInsights.empty")}</CardContent>
        </Card>
      ) : !hasData ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">{t("memberInsights.empty")}</CardContent>
        </Card>
      ) : (
        <>
          <KpiCards aggregate={data.aggregate} churnDist={data.churnDist} t={t} />

          <PeriodSection
            members={data.members}
            subscriptions={data.subscriptions}
            payments={data.payments}
            attendance={data.attendance}
            posTransactions={data.posTransactions}
            t={t}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActivitySection activity={data.activity} total={data.members.length} t={t} />
            <ChurnSection risks={data.risks} churnDist={data.churnDist} highValue={data.highValue} t={t} />
          </div>

          <BehaviorMatrix behavior={data.behavior} t={t} />

          <SegmentationSection segmentSummary={data.segmentSummary} total={data.members.length} t={t} />

          <CoachSection analysis={data.coachAnalysis} t={t} />

          <RecommendationsSection recommendations={data.recommendations} t={t} />

          <FinanceSection stats={data.finance} t={t} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AttendanceSection stats={data.attendanceStats} t={t} />
            <SubscriptionTypes stats={data.typeStats} t={t} />
          </div>

          <TopMembers kpis={data.memberKpis} t={t} />
        </>
      )}
    </div>
  )
}
