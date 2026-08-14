import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownRight, ArrowUpRight, Minus, Wallet, UserPlus, CalendarCheck, ShoppingCart, RefreshCcw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { ElementType } from "react"
import type { MemberRow, PaymentRow, SubscriptionRow, AttendanceRow, PosTransactionRow } from "../lib/raw"
import { periodRange, type PeriodId } from "../lib/period"
import { computeComparison, type ComparisonMetricKey } from "../lib/comparison"

interface PeriodSectionProps {
  members: MemberRow[]
  subscriptions: SubscriptionRow[]
  payments: PaymentRow[]
  attendance: AttendanceRow[]
  posTransactions: PosTransactionRow[]
  t: (key: string) => string
}

const PERIOD_IDS: PeriodId[] = ["30d", "90d", "6m", "12m", "all"]

interface MetricConfig {
  key: ComparisonMetricKey
  icon: ElementType
  iconClass: string
  currency: boolean
}

const METRICS: MetricConfig[] = [
  { key: "revenue", icon: Wallet, iconClass: "text-success", currency: true },
  { key: "newMembers", icon: UserPlus, iconClass: "text-primary", currency: false },
  { key: "checkIns", icon: CalendarCheck, iconClass: "text-warning", currency: false },
  { key: "posSales", icon: ShoppingCart, iconClass: "text-primary", currency: true },
  { key: "subscriptions", icon: RefreshCcw, iconClass: "text-success", currency: false },
]

function formatCount(v: number): string {
  return Math.round(v).toLocaleString()
}

function formatDelta(pct: number | null): string {
  if (pct === null) return "—"
  const rounded = Math.abs(Math.round(pct))
  return `${pct >= 0 ? "+" : "-"}${rounded}%`
}

export function PeriodSection({ members, subscriptions, payments, attendance, posTransactions, t }: PeriodSectionProps) {
  const [periodId, setPeriodId] = useState<PeriodId>("90d")

  const comparison = useMemo(() => {
    const range = periodRange(periodId)
    return computeComparison(payments, members, attendance, posTransactions, subscriptions, range)
  }, [periodId, payments, members, attendance, posTransactions, subscriptions])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>{t("memberInsights.period.title")}</CardTitle>
          <CardDescription>{t("memberInsights.period.subtitle")}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("memberInsights.period.select")}:</span>
          <Select value={periodId} onValueChange={(v) => setPeriodId(v as PeriodId)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_IDS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`memberInsights.period.options.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {METRICS.map((m: MetricConfig) => {
            const v = comparison[m.key]
            const value = m.currency ? formatCurrency(v.current) : formatCount(v.current)
            const previous = m.currency ? formatCurrency(v.previous) : formatCount(v.previous)
            const positive = v.deltaPct === null || v.deltaPct >= 0
            const DeltaIcon = v.deltaPct === null ? Minus : positive ? ArrowUpRight : ArrowDownRight
            return (
              <Card key={m.key} className="bg-muted/40">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <m.icon className={`h-4 w-4 shrink-0 ${m.iconClass}`} />
                    <p className="text-xs text-muted-foreground truncate">
                      {t(`memberInsights.period.metric.${m.key}`)}
                    </p>
                  </div>
                  <p className="text-lg font-bold truncate">{value}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={
                        v.deltaPct === null
                          ? "text-muted-foreground"
                          : positive
                            ? "text-success"
                            : "text-destructive"
                      }
                    >
                      <DeltaIcon className="h-3 w-3 mr-1" />
                      {formatDelta(v.deltaPct)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {t("memberInsights.period.vsPrevious")} {previous}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
