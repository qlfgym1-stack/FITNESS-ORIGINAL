import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Layers } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { SubscriptionTypeStats } from "../lib/kpi"

interface SubscriptionTypesProps {
  stats: SubscriptionTypeStats[]
  t: (key: string) => string
}

export function SubscriptionTypes({ stats, t }: SubscriptionTypesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          {t("memberInsights.types.title")}
        </CardTitle>
        <CardDescription>{t("memberInsights.types.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {stats.map((s: SubscriptionTypeStats) => (
              <li key={s.typeId} className="rounded-md bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{s.name}</span>
                  <Badge variant="outline" className="shrink-0">
                    {s.activeCount} {t("memberInsights.types.active")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5 gap-2">
                  <span>{s.totalSubscriptions} {t("memberInsights.types.subscriptions")}</span>
                  <span>{t("memberInsights.types.revenue")} : {formatCurrency(s.totalRevenue)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("memberInsights.types.renewalRate")} : {s.renewalRate.toFixed(0)}%
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
