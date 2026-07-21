import { useState, useMemo } from "react"
import { useQuery } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Printer, TrendingUp, TrendingDown } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"

type Period = "daily" | "weekly" | "monthly" | "custom"

export default function AssistantComptablePage() {
  const t = useT()
  const supabase = useSupabase()
  const { organization } = useAuth()
  const orgId = organization?.id

  const today = new Date()
  const [period, setPeriod] = useState<Period>("monthly")
  const [dateFrom, setDateFrom] = useState(format(subMonths(today, 2), "yyyy-MM-dd"))
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"))

  const periodLabel = useMemo(() => {
    switch (period) {
      case "daily": return format(today, "yyyy-MM-dd")
      case "weekly": {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        return `${format(weekAgo, "yyyy-MM-dd")} - ${format(today, "yyyy-MM-dd")}`
      }
      case "monthly": return format(today, "yyyy-MM")
      case "custom": return `${dateFrom} - ${dateTo}`
    }
  }, [period, dateFrom, dateTo, today])

  const dateFilter = useMemo(() => {
    const from = period === "custom" ? dateFrom : period === "daily" ? format(today, "yyyy-MM-dd") : period === "weekly" ? format(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") : format(startOfMonth(today), "yyyy-MM-dd")
    const to = period === "custom" ? dateTo : period === "monthly" ? format(endOfMonth(today), "yyyy-MM-dd") : format(today, "yyyy-MM-dd")
    return { from, to }
  }, [period, dateFrom, dateTo, today])

  const { data: revenues, isLoading: revLoading } = useQuery({
    queryKey: ["assistant-revenus", orgId, dateFilter.from, dateFilter.to],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("payments")
        .select("amount, payment_date, payment_method, members(first_name, last_name)")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("payment_date", dateFilter.from)
        .lte("payment_date", dateFilter.to)
        .order("payment_date", { ascending: false })
      return data || []
    },
    enabled: !!orgId,
  })

  const { data: expenses, isLoading: expLoading } = useQuery({
    queryKey: ["assistant-depenses", orgId, dateFilter.from, dateFilter.to],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("organization_id", orgId)
        .gte("expense_date", dateFilter.from)
        .lte("expense_date", dateFilter.to)
        .order("expense_date", { ascending: false })
      return data || []
    },
    enabled: !!orgId,
  })

  const { data: monthlyHistory } = useQuery({
    queryKey: ["assistant-monthly", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const months: { label: string; from: string; to: string }[] = []
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(today, i)
        months.push({
          label: format(m, "yyyy-MM"),
          from: format(startOfMonth(m), "yyyy-MM-dd"),
          to: format(endOfMonth(m), "yyyy-MM-dd"),
        })
      }
      const result: { label: string; revenue: number; expense: number; profit: number }[] = []
      for (const m of months) {
        const [revRes, expRes] = await Promise.all([
          supabase
            .from("payments")
            .select("amount")
            .eq("organization_id", orgId)
            .eq("status", "completed")
            .gte("payment_date", m.from)
            .lte("payment_date", m.to),
          supabase
            .from("expenses")
            .select("amount")
            .eq("organization_id", orgId)
            .gte("expense_date", m.from)
            .lte("expense_date", m.to),
        ])
        const revenue = (revRes.data || []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)
        const expense = (expRes.data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0)
        result.push({ label: m.label, revenue, expense, profit: revenue - expense })
      }
      return result
    },
    enabled: !!orgId,
  })

  const totalRevenue = useMemo(() => (revenues || []).reduce((s, r) => s + Number(r.amount), 0), [revenues])
  const totalExpenses = useMemo(() => (expenses || []).reduce((s, e) => s + Number(e.amount), 0), [expenses])
  const profit = totalRevenue - totalExpenses

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    ;(expenses || []).forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenses])

  const categoryLabel = (cat: string): string => {
    const map: Record<string, string> = {
      rent: t("expenses.rent"),
      salaries: t("expenses.salaries"),
      electricity: t("expenses.electricity"),
      water: t("expenses.water"),
      equipment: t("expenses.equipment"),
      maintenance: t("expenses.maintenance"),
      marketing: t("expenses.marketing"),
      insurance: t("expenses.insurance"),
      taxes: t("expenses.taxes"),
      other: t("expenses.other"),
    }
    return map[cat] || cat
  }

  const handlePrint = () => window.print()

  const loading = revLoading || expLoading

  return (
    <div className="space-y-6 print:space-y-4">
      <style>{`
        @media print {
          body { font-size: 12px; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-break-inside { break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold">{t("assistantComptable.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {organization?.name || "INFINITY GYM CENTER"} · {t("app.tagline") || "gym.tagline"}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          {t("assistantComptable.print")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 no-print">
        {(["daily", "weekly", "monthly", "custom"] as Period[]).map((p) => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
            {t(`assistantComptable.${p}`)}
          </Button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">{t("assistantComptable.to")}</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
        )}
      </div>

      <div className="text-center print-only">
        <h2 className="text-xl font-bold">{organization?.name || "INFINITY GYM CENTER"}</h2>
        <p className="text-sm text-muted-foreground">{t("assistantComptable.subtitle")}</p>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {t("assistantComptable.dateRange").replace("{from}", dateFilter.from).replace("{to}", dateFilter.to)} {format(today, "dd MMMM yyyy")}
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print-break-inside">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("assistantComptable.revenue")}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-success">{formatCurrency(totalRevenue)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("assistantComptable.expenses")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">{(expenses || []).length} {t("assistantComptable.entries")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("assistantComptable.profit")}</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-inside">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("assistantComptable.revenueDetails")}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("assistantComptable.member")}</TableHead>
                      <TableHead>{t("assistantComptable.amount")}</TableHead>
                      <TableHead>{t("assistantComptable.date")}</TableHead>
                      <TableHead>{t("assistantComptable.method")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!revenues || revenues.length === 0) ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("assistantComptable.noRevenue")}</TableCell></TableRow>
                    ) : (
                      revenues.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{r.members ? `${r.members.first_name || ""} ${r.members.last_name || ""}` : "-"}</TableCell>
                          <TableCell>{formatCurrency(r.amount)}</TableCell>
                          <TableCell>{r.payment_date}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <div className="flex justify-between items-center px-4 py-3 border-t font-semibold">
                <span>{t("assistantComptable.total")}</span>
                <span>{formatCurrency(totalRevenue)}</span>
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("assistantComptable.expensesByCategory")}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("assistantComptable.category")}</TableHead>
                      <TableHead className="text-right">{t("assistantComptable.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesByCategory.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">{t("assistantComptable.noExpenses")}</TableCell></TableRow>
                    ) : (
                      expensesByCategory.map(([cat, amt]) => (
                        <TableRow key={cat}>
                          <TableCell>{categoryLabel(cat)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(amt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <div className="flex justify-between items-center px-4 py-3 border-t font-semibold">
                <span>{t("assistantComptable.total")}</span>
                <span>{formatCurrency(totalExpenses)}</span>
              </div>
            </Card>
          </div>

          <Card className="print-break-inside">
            <CardHeader><CardTitle className="text-base">{t("assistantComptable.monthlyHistory")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("assistantComptable.month")}</TableHead>
                    <TableHead className="text-right">{t("assistantComptable.revenue")}</TableHead>
                    <TableHead className="text-right">{t("assistantComptable.expenses")}</TableHead>
                    <TableHead className="text-right">{t("assistantComptable.profit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(monthlyHistory || []).map((m) => (
                    <TableRow key={m.label}>
                      <TableCell>{m.label}</TableCell>
                      <TableCell className="text-right text-success">{formatCurrency(m.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(m.expense)}</TableCell>
                      <TableCell className={`text-right font-semibold ${m.profit >= 0 ? "text-success" : "text-destructive"}`}>
                        {m.profit >= 0 ? "+" : ""}{formatCurrency(m.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
