import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Activity } from "lucide-react"
import type { ActivitySegment } from "../lib/kpi"

interface ActivitySectionProps {
  activity: ActivitySegment
  total: number
  t: (key: string) => string
}

interface ActivityRow {
  key: string
  label: string
  count: number
}

export function ActivitySection({ activity, total, t }: ActivitySectionProps) {
  const rows: ActivityRow[] = [
    { key: "veryActive", label: t("memberInsights.activity.veryActive"), count: activity.veryActive },
    { key: "active", label: t("memberInsights.activity.active"), count: activity.active },
    { key: "moderate", label: t("memberInsights.activity.moderate"), count: activity.moderate },
    { key: "low", label: t("memberInsights.activity.low"), count: activity.low },
    { key: "inactive", label: t("memberInsights.activity.inactive"), count: activity.inactive },
  ]
  const denominator = total || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t("memberInsights.activity.title")}
        </CardTitle>
        <CardDescription>{t("memberInsights.activity.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row: ActivityRow) => (
          <div key={row.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{row.label}</span>
              <span className="text-sm text-muted-foreground">{row.count}</span>
            </div>
            <Progress value={(row.count / denominator) * 100} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
