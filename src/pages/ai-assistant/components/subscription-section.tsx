import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Crown, BellRing, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { SubscriptionInsight } from "../hooks/types"

interface SubscriptionSectionProps {
  data: SubscriptionInsight
  t: (key: string) => string
}

export function SubscriptionSection({ data, t }: SubscriptionSectionProps) {
  const { bestType, expiring30, expiring60, activeCount, avgRevenuePerMember, churnRisk } = data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("aiAssistant.subscriptionsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("aiAssistant.activeSubs")}</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("aiAssistant.avgRevenueMember")}</p>
            <p className="text-2xl font-bold">{formatCurrency(avgRevenuePerMember)}</p>
          </div>
        </div>

        {bestType && (
          <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
            <Crown className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">{t("aiAssistant.bestType")}: {bestType.name}</p>
              <p className="text-xs text-muted-foreground">
                {t("aiAssistant.bestTypeCount")}: {bestType.count} · {formatCurrency(bestType.revenue)}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
          <p className="text-sm font-medium flex items-center gap-2 mb-1">
            <BellRing className="h-4 w-4 text-warning" />
            {t("aiAssistant.expiringSoon")} ({expiring30.length})
          </p>
          {expiring30.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("aiAssistant.noExpiring")}</p>
          ) : (
            <ul className="text-xs space-y-1">
              {expiring30.slice(0, 5).map((e) => (
                <li key={e.memberId} className="flex justify-between gap-2">
                  <span className="truncate">{e.memberName} · {e.subscriptionName}</span>
                  <span className="shrink-0 text-warning">
                    {e.daysLeft === 0 ? t("aiAssistant.today") : `${e.daysLeft}${t("aiAssistant.daysUnit")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {churnRisk > 20 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs">
              {t("aiAssistant.churnRisk")}: {churnRisk}% · {expiring60.length} {t("aiAssistant.expiring60")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
