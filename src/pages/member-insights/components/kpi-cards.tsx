import { Card, CardContent } from "@/components/ui/card"
import { Users, UserCheck, UserX, UserMinus, RotateCcw, AlertTriangle, Gem, Wallet } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { ElementType } from "react"
import type { AggregateKpis } from "../lib/kpi"
import type { ChurnDistribution } from "../lib/churn"

interface KpiCardsProps {
  aggregate: AggregateKpis
  churnDist: ChurnDistribution
  t: (key: string) => string
}

interface KpiCardItem {
  label: string
  value: string
  icon: ElementType
  iconClass: string
}

export function KpiCards({ aggregate, churnDist, t }: KpiCardsProps) {
  const totalRisks = churnDist.low + churnDist.medium + churnDist.high
  const churnPct = totalRisks > 0 ? Math.round(((churnDist.high + churnDist.medium) / totalRisks) * 100) : 0

  const items: KpiCardItem[] = [
    { label: t("memberInsights.kpi.total"), value: String(aggregate.totalMembers), icon: Users, iconClass: "text-primary" },
    { label: t("memberInsights.kpi.active"), value: String(aggregate.activeMembers), icon: UserCheck, iconClass: "text-success" },
    { label: t("memberInsights.kpi.inactive"), value: String(aggregate.inactiveMembers), icon: UserX, iconClass: "text-muted-foreground" },
    { label: t("memberInsights.kpi.suspended"), value: String(aggregate.suspendedMembers), icon: UserMinus, iconClass: "text-warning" },
    { label: t("memberInsights.kpi.renewalRate"), value: `${aggregate.renewalRate.toFixed(0)}%`, icon: RotateCcw, iconClass: "text-primary" },
    { label: t("memberInsights.kpi.churnRisk"), value: `${churnPct}%`, icon: AlertTriangle, iconClass: "text-destructive" },
    { label: t("memberInsights.kpi.ltvAvg"), value: formatCurrency(aggregate.ltvAvg), icon: Gem, iconClass: "text-warning" },
    { label: t("memberInsights.kpi.avgRevenue"), value: formatCurrency(aggregate.avgRevenuePerMember), icon: Wallet, iconClass: "text-success" },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item: KpiCardItem) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <item.icon className={`h-8 w-8 shrink-0 ${item.iconClass}`} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
              <p className="text-lg font-bold">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
