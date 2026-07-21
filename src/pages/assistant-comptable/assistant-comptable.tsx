import { useState, useMemo } from "react"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { useAccountingData } from "./hooks/useAccountingData"
import { KpiCards } from "./components/kpi-cards"
import { RevenueSection } from "./components/revenue-section"
import { ExpensesSection } from "./components/expenses-section"
import { MonthlyHistory } from "./components/monthly-history"
import { Journals } from "./components/journals"
import { Alerts } from "./components/alerts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Printer, Download, TrendingUp, TrendingDown } from "lucide-react"
import { format, subMonths } from "date-fns"
import type { AccountingFilters } from "./hooks/types"
import { formatCurrency } from "@/lib/utils"

export default function AssistantComptablePage() {
  const t = useT()
  const { organization } = useAuth()
  const orgId = organization?.id
  const today = useMemo(() => new Date(), [])

  const [period, setPeriod] = useState<AccountingFilters["period"]>("monthly")
  const [dateFrom, setDateFrom] = useState(() => format(subMonths(today, 2), "yyyy-MM-dd"))
  const [dateTo, setDateTo] = useState(() => format(today, "yyyy-MM-dd"))

  const filters: AccountingFilters = useMemo(() => ({ period, dateFrom, dateTo }), [period, dateFrom, dateTo])
  const data = useAccountingData(orgId, filters)

  const handlePrint = () => window.print()

  const handleExportCsv = () => {
    const rows = data.revenueTransactions.map(r => `${r.date},${r.memberName},${r.amount},${r.method},${r.source}`).join("\n")
    const csv = `Date,Membre,Montant,Moyen,Source\n${rows}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `assistant-comptable-${filters.dateFrom}-${filters.dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const TrendIcon = data.aiAnalysis.trend === "up" ? TrendingUp : data.aiAnalysis.trend === "down" ? TrendingDown : null

  return (
    <div className="space-y-6 print:space-y-4">
      <style>{`@media print { body { font-size: 12px; } .no-print { display: none !important; } .print-only { display: block !important; } .print-break-inside { break-inside: avoid; } } .print-only { display: none; }`}</style>

      <div className="flex flex-col sm:flex-row justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold">{t("assistantComptable.title")}</h1>
          <p className="text-sm text-muted-foreground">{organization?.name} · {t("assistantComptable.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="mr-1 h-4 w-4" />{t("assistantComptable.print")}</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        {(["daily", "weekly", "monthly", "custom"] as const).map(p => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>{t(`assistantComptable.${p}`)}</Button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            <span className="text-sm text-muted-foreground">{t("assistantComptable.to")}</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          </div>
        )}
      </div>

      <div className="text-center print-only">
        <h2 className="text-xl font-bold">{organization?.name}</h2>
        <p className="text-sm text-muted-foreground">{t("assistantComptable.subtitle")}</p>
        <p className="text-xs text-muted-foreground">{filters.dateFrom} — {filters.dateTo}</p>
      </div>

      {data.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Alerts alerts={data.alerts} t={t} />

          <KpiCards totalRevenue={data.totalRevenue} totalExpenses={data.totalExpenses} profit={data.profit} cashFlow={data.cashFlow} t={t} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-inside">
            <RevenueSection totalRevenue={data.totalRevenue} subscriptionRevenue={data.subscriptionRevenue} posRevenue={data.posRevenue} revenueBySource={data.revenueBySource} revenueTransactions={data.revenueTransactions} t={t} />
            <ExpensesSection totalExpenses={data.totalExpenses} expensesByCategory={data.expensesByCategory} expenseTransactions={data.expenseTransactions} t={t} />
          </div>

          <MonthlyHistory monthlyHistory={data.monthlyHistory} t={t} />

          <Card className="print-break-inside">
            <CardHeader><CardTitle className="text-base">{t("assistantComptable.aiAssistant")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                {TrendIcon && <TrendIcon className={`h-5 w-5 mt-0.5 ${data.aiAnalysis.trend === "up" ? "text-success" : "text-destructive"}`} />}
                <p className="font-medium">{data.aiAnalysis.summary}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground mb-1">{t("assistantComptable.dailySummary")}</p><p>{data.aiAnalysis.dailySummary}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground mb-1">{t("assistantComptable.weeklySummary")}</p><p>{data.aiAnalysis.weeklySummary}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground mb-1">{t("assistantComptable.monthlySummary")}</p><p>{data.aiAnalysis.monthlySummary}</p></div>
              </div>
              {data.aiAnalysis.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{t("assistantComptable.recommendations")}</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {data.aiAnalysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Journals
            salesJournal={data.salesJournal}
            expenseJournal={data.expenseJournal}
            cashReceiptsJournal={data.cashReceiptsJournal}
            generalLedger={data.generalLedger}
            balance={data.balance}
            vatSummary={data.vatSummary}
            t={t}
          />
        </>
      )}
    </div>
  )
}
