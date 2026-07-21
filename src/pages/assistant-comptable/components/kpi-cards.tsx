import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface KpiCardsProps {
  totalRevenue: number
  totalExpenses: number
  profit: number
  cashFlow: number
  t: (key: string) => string
}

const kpis = [
  { key: "totalRevenue", icon: TrendingUp, color: "text-success" as const, labelKey: "assistantComptable.revenue", desc: "assistantComptable.revenue" },
  { key: "totalExpenses", icon: TrendingDown, color: "text-destructive" as const, labelKey: "assistantComptable.expenses", desc: "assistantComptable.expenses" },
  { key: "profit", icon: DollarSign, color: null, labelKey: "assistantComptable.profit", desc: "assistantComptable.profit" },
  { key: "cashFlow", icon: Wallet, color: null, labelKey: "assistantComptable.cashFlow", desc: "assistantComptable.cashFlow" },
] as const

export function KpiCards({ totalRevenue, totalExpenses, profit, cashFlow, t }: KpiCardsProps) {
  const values: Record<string, number> = { totalRevenue, totalExpenses, profit, cashFlow }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const value = values[kpi.key]
        const Icon = kpi.icon
        const isPositive = value >= 0
        const colorClass = kpi.color ?? (isPositive ? "text-success" : "text-destructive")

        return (
          <Card key={kpi.key} className="print-break-inside">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Icon className={`h-4 w-4 ${colorClass}`} />
                {t(kpi.labelKey)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${colorClass}`}>
                {kpi.key === "profit" && isPositive ? "+" : ""}{formatCurrency(value)}
              </p>
              <p className="text-xs text-muted-foreground">{t(kpi.desc)}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
