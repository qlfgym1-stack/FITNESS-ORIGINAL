import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { MemberKpi } from "../lib/kpi"

interface TopMembersProps {
  kpis: MemberKpi[]
  t: (key: string) => string
}

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: "active", className: "bg-success text-success-foreground" },
  inactive: { label: "inactive", className: "bg-muted text-muted-foreground" },
  suspended: { label: "suspended", className: "bg-warning text-warning-foreground" },
  blocked: { label: "suspended", className: "bg-warning text-warning-foreground" },
}

export function TopMembers({ kpis, t }: TopMembersProps) {
  const top = [...kpis]
    .sort((a: MemberKpi, b: MemberKpi) => b.lifetimeValue - a.lifetimeValue)
    .slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t("memberInsights.topMembers.title")}
        </CardTitle>
        <CardDescription>{t("memberInsights.topMembers.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {top.map((k: MemberKpi) => {
              const badge = statusBadge[k.status] ?? { label: k.status, className: "bg-muted text-muted-foreground" }
              return (
                <li key={k.memberId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{k.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {k.attendanceCount} {t("memberInsights.topMembers.visits")} · {k.renewalsCount} {t("memberInsights.topMembers.renewals")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(k.lifetimeValue)}</p>
                    <Badge className={badge.className}>{t(`memberInsights.status.${badge.label}`)}</Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
