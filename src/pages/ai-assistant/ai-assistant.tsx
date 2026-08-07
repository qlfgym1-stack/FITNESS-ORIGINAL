import { useState, useMemo } from "react"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { useAssistantData } from "./hooks/useAssistantData"
import { PriorityActions } from "./components/priority-actions"
import { PeakHoursSection } from "./components/peak-hours-section"
import { FlagshipProducts } from "./components/flagship-products"
import { SubscriptionSection } from "./components/subscription-section"
import { ForecastSection } from "./components/forecast-section"
import { InsightsSection } from "./components/insights-section"
import { ChatSection } from "./components/chat-section"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, BrainCircuit, Wallet, TrendingUp, Receipt } from "lucide-react"
import { format, subDays } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import type { AssistantFilters, AssistantPeriod } from "./hooks/types"

export default function AiAssistantPage() {
  const t = useT()
  const { organization } = useAuth()
  const orgId = organization?.id

  const [period, setPeriod] = useState<AssistantPeriod>("monthly")
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"))
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"))

  const filters: AssistantFilters = useMemo(
    () => ({ period, dateFrom, dateTo }),
    [period, dateFrom, dateTo]
  )

  const data = useAssistantData(orgId, filters)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            {t("aiAssistant.title")}
          </h1>
          <p className="text-muted-foreground">
            {organization?.name} · {t("aiAssistant.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["monthly", "quarterly", "custom"] as const).map((p) => (
          <Button
            key={p}
            variant={period === p ? "selected" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {t(`aiAssistant.${p}`)}
          </Button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm"
            />
          </div>
        )}
      </div>

      {data.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("aiAssistant.kpiRevenue")}</p>
                  <p className="text-lg font-bold">{formatCurrency(data.totalRevenue)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className={`h-8 w-8 ${data.netProfit >= 0 ? "text-success" : "text-destructive"}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{t("aiAssistant.kpiProfit")}</p>
                  <p className="text-lg font-bold">{formatCurrency(data.netProfit)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Receipt className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("aiAssistant.kpiActions")}</p>
                  <p className="text-lg font-bold">{data.actions.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <BrainCircuit className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("aiAssistant.kpiForecast")}</p>
                  <p className="text-lg font-bold">{formatCurrency(data.revenueForecast.next3Months.reduce((s, p) => s + p.value, 0))}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <PriorityActions actions={data.actions} t={t} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PeakHoursSection data={data.peakHours} t={t} />
            <FlagshipProducts data={data.flagship} t={t} />
          </div>

          <SubscriptionSection data={data.subscription} t={t} />

          <ForecastSection revenue={data.revenueForecast} attendance={data.attendanceForecast} t={t} />

          <InsightsSection insights={data.insights} t={t} />

          <ChatSection data={data} t={t} />
        </>
      )}
    </div>
  )
}
