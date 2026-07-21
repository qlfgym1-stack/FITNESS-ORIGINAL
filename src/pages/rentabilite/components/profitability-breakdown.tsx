import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { ProfitabilityItem } from "../hooks/types"

interface ProfitabilityBreakdownProps {
  profitabilityByProduct: ProfitabilityItem[]
  profitabilityByCategory: ProfitabilityItem[]
  profitabilityBySupplier: ProfitabilityItem[]
  profitabilityBySubscription: ProfitabilityItem[]
  profitabilityByCoach: ProfitabilityItem[]
  profitabilityByMonth: ProfitabilityItem[]
  profitabilityByYear: ProfitabilityItem[]
  t: (key: string) => string
}

const TABS = [
  { key: "product", dataKey: "profitabilityByProduct" },
  { key: "category", dataKey: "profitabilityByCategory" },
  { key: "supplier", dataKey: "profitabilityBySupplier" },
  { key: "subscription", dataKey: "profitabilityBySubscription" },
  { key: "coach", dataKey: "profitabilityByCoach" },
  { key: "month", dataKey: "profitabilityByMonth" },
  { key: "year", dataKey: "profitabilityByYear" },
] as const

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

export function ProfitabilityBreakdown({
  profitabilityByProduct,
  profitabilityByCategory,
  profitabilityBySupplier,
  profitabilityBySubscription,
  profitabilityByCoach,
  profitabilityByMonth,
  profitabilityByYear,
  t,
}: ProfitabilityBreakdownProps) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key)

  const dataMap: Record<string, ProfitabilityItem[]> = {
    product: profitabilityByProduct,
    category: profitabilityByCategory,
    supplier: profitabilityBySupplier,
    subscription: profitabilityBySubscription,
    coach: profitabilityByCoach,
    month: profitabilityByMonth,
    year: profitabilityByYear,
  }

  const items = dataMap[activeTab] ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("rentabilite.breakdownTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="text-xs"
              >
                {t(`rentabilite.tab_${tab.key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rentabilite.col_name")}</TableHead>
                <TableHead className="text-right">{t("rentabilite.col_revenue")}</TableHead>
                <TableHead className="text-right">{t("rentabilite.col_cost")}</TableHead>
                <TableHead className="text-right">{t("rentabilite.col_profit")}</TableHead>
                <TableHead className="text-right">{t("rentabilite.col_margin")}</TableHead>
                <TableHead className="text-right">{t("rentabilite.col_trend")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    {t("rentabilite.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, i) => (
                  <TableRow key={`${item.label}-${i}`}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.profit)}</TableCell>
                    <TableCell className="text-right">{item.margin.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end">
                        <TrendIcon trend={item.trend} />
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
