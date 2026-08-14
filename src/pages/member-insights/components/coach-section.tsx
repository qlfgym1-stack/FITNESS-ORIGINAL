import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Users, Wallet, CalendarCheck, AlertTriangle, ShieldCheck } from "lucide-react"
import type { CoachAnalysis } from "../lib/coach"

interface CoachSectionProps {
  analysis: CoachAnalysis
  t: (key: string) => string
}

function fmt(v: number): string {
  return Math.round(v).toLocaleString()
}

export function CoachSection({ analysis, t }: CoachSectionProps) {
  const rows = [...analysis.coaches]
  if (analysis.noCoach && analysis.noCoach.memberCount > 0) {
    rows.push(analysis.noCoach)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("memberInsights.coach.title")}</CardTitle>
        <CardDescription>{t("memberInsights.coach.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.coach.empty")}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <div
                key={c.coachId}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/40 p-4"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.memberCount} {t("memberInsights.coach.members")} · {c.activeCount}{" "}
                      {t("memberInsights.coach.active")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    {formatCurrency(c.totalRevenue)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {fmt(c.avgAttendancePerMember)} {t("memberInsights.coach.avgAttendance")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {t("memberInsights.coach.ltvAvg")} {formatCurrency(c.ltvAvg)}
                  </span>
                  {c.atRiskCount > 0 && (
                    <Badge variant="outline" className="text-destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {c.atRiskCount} {t("memberInsights.coach.atRisk")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
