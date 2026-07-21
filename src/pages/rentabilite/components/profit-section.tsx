import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import type { ProfitData } from "../hooks/types"

interface ProfitSectionProps {
  profitData: ProfitData
  t: (key: string) => string
}

export function ProfitSection({ profitData, t }: ProfitSectionProps) {
  const {
    totalRevenue,
    costOfSales,
    grossProfit,
    grossMargin,
    totalExpenses,
    netProfit,
    netMargin,
  } = profitData

  const costPct = totalRevenue > 0 ? (costOfSales / totalRevenue) * 100 : 0
  const expensesPct = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("rentabilite.profits")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("rentabilite.revenue")}</span>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatCurrency(totalRevenue)}</span>
              <span className="text-sm text-muted-foreground w-12 text-right">100%</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("rentabilite.costOfSales")}</span>
            <div className="flex items-center gap-3">
              <span className="text-destructive">{formatCurrency(costOfSales)}</span>
              <span className="text-sm text-muted-foreground w-12 text-right">{costPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="border-t" />

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t("rentabilite.grossProfit")}</span>
            <div className="flex items-center gap-3">
              <span className="font-bold">{formatCurrency(grossProfit)}</span>
              <span className="text-sm text-muted-foreground w-12 text-right">{grossMargin.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("rentabilite.totalExpenses")}</span>
            <div className="flex items-center gap-3">
              <span className="text-destructive">{formatCurrency(totalExpenses)}</span>
              <span className="text-sm text-muted-foreground w-12 text-right">{expensesPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="border-t" />

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t("rentabilite.netProfit")}</span>
            <div className="flex items-center gap-3">
              <span className={`font-bold ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(netProfit)}
              </span>
              <span className="text-sm text-muted-foreground w-12 text-right">{netMargin.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rentabilite.margins")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">{t("rentabilite.grossMargin")}</span>
              <span className={`text-3xl font-bold ${grossMargin >= 0 ? "text-success" : "text-destructive"}`}>
                {grossMargin.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${grossMargin >= 0 ? "bg-success" : "bg-destructive"}`}
                style={{ width: `${Math.min(Math.max(grossMargin, 0), 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">{t("rentabilite.netMargin")}</span>
              <span className={`text-3xl font-bold ${netMargin >= 0 ? "text-success" : "text-destructive"}`}>
                {netMargin.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${netMargin >= 0 ? "bg-success" : "bg-destructive"}`}
                style={{ width: `${Math.min(Math.max(netMargin, 0), 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
