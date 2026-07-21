import { TrendingUp, DollarSign, Percent, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface KpiCardsProps {
  totalRevenue: number
  netProfit: number
  grossMargin: number
  netMargin: number
  roi: number
  totalInvestment: number
  t: (key: string) => string
}

function profitColor(value: number): string {
  return value >= 0 ? "text-success" : "text-destructive"
}

function marginColor(value: number): string {
  if (value > 20) return "text-success"
  if (value > 0) return "text-warning"
  return "text-destructive"
}

function roiColor(value: number): string {
  if (value > 50) return "text-success"
  if (value > 0) return "text-warning"
  return "text-destructive"
}

interface CardData {
  icon: React.ElementType
  label: string
  value: string
  color: string
}

export default function KpiCards({
  totalRevenue,
  netProfit,
  grossMargin,
  netMargin,
  roi,
  totalInvestment,
  t,
}: KpiCardsProps) {
  const cards: CardData[] = [
    {
      icon: TrendingUp,
      label: t("rentabilite.totalRevenue"),
      value: formatCurrency(totalRevenue),
      color: "text-success",
    },
    {
      icon: DollarSign,
      label: t("rentabilite.netProfit"),
      value: (netProfit >= 0 ? "+" : "") + formatCurrency(netProfit),
      color: profitColor(netProfit),
    },
    {
      icon: Percent,
      label: t("rentabilite.grossMargin"),
      value: grossMargin.toFixed(1) + "%",
      color: marginColor(grossMargin),
    },
    {
      icon: Percent,
      label: t("rentabilite.netMargin"),
      value: netMargin.toFixed(1) + "%",
      color: marginColor(netMargin),
    },
    {
      icon: TrendingUp,
      label: t("rentabilite.roi"),
      value: roi.toFixed(1) + "%",
      color: roiColor(roi),
    },
    {
      icon: Wallet,
      label: t("rentabilite.totalInvestment"),
      value: formatCurrency(totalInvestment),
      color: "text-muted-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className="print-break-inside">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.label}
              </CardTitle>
              <Icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
