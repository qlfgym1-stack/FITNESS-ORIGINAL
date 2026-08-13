import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useOpenMember } from "@/hooks/useOpenMember"
import type { ChurnRisk, ChurnRiskLevel, ChurnDistribution } from "../lib/churn"
import type { MemberKpi } from "../lib/kpi"

interface ChurnSectionProps {
  risks: ChurnRisk[]
  churnDist: ChurnDistribution
  highValue: MemberKpi[]
  t: (key: string) => string
}

const levelBadge: Record<ChurnRiskLevel, string> = {
  low: "bg-success text-success-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
}

interface DistRow {
  level: ChurnRiskLevel
  count: number
}

export function ChurnSection({ risks, churnDist, highValue, t }: ChurnSectionProps) {
  const openMember = useOpenMember()
  const atRisk = risks.slice(0, 6)
  const highRisk = highValue.slice(0, 5)
  const dist: DistRow[] = [
    { level: "low", count: churnDist.low },
    { level: "medium", count: churnDist.medium },
    { level: "high", count: churnDist.high },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {t("memberInsights.churn.title")}
        </CardTitle>
        <CardDescription>{t("memberInsights.churn.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {dist.map((d: DistRow) => (
            <Badge key={d.level} className={levelBadge[d.level]}>
              {t(`memberInsights.churn.${d.level}`)} · {d.count}
            </Badge>
          ))}
        </div>

        {atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.churn.noRisk")}</p>
        ) : (
          <ul className="space-y-3">
            {atRisk.map((risk: ChurnRisk) => (
              <li key={risk.memberId} className="rounded-md bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openMember(risk.memberId)}
                    title="Ouvrir la fiche adhérent"
                    className="text-sm font-medium truncate text-left cursor-pointer hover:text-primary hover:underline transition-colors"
                  >
                    {risk.fullName}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={levelBadge[risk.level]}>{t(`memberInsights.churn.${risk.level}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{risk.score}/100</span>
                  </div>
                </div>
                {risk.reasons.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t("memberInsights.churn.reasons")} : {risk.reasons.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {highRisk.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">{t("memberInsights.churn.highValueTitle")}</p>
            <ul className="space-y-1.5">
              {highRisk.map((k: MemberKpi) => (
                <li key={k.memberId} className="flex items-center justify-between text-sm gap-2">
                  <button
                    type="button"
                    onClick={() => openMember(k.memberId)}
                    title="Ouvrir la fiche adhérent"
                    className="truncate text-left cursor-pointer hover:text-primary hover:underline transition-colors"
                  >
                    {k.fullName}
                  </button>
                  <span className="text-muted-foreground shrink-0">{formatCurrency(k.lifetimeValue)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
