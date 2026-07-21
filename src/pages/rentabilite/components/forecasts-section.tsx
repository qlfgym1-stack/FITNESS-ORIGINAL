import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BrainCircuit, TrendingUp, DollarSign, TrendingDown, Package, Wallet, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { Forecast } from "../hooks/types"

interface ForecastsSectionProps {
  forecasts: Forecast
  t: (key: string) => string
}

function confidenceColor(confidence: number) {
  if (confidence > 80) return "bg-success/10 text-success"
  if (confidence > 60) return "bg-warning/10 text-warning"
  return "bg-destructive/10 text-destructive"
}

interface ForecastCard {
  icon: typeof TrendingUp
  value: string
  label: string
  color: string
}

export function ForecastsSection({ forecasts, t }: ForecastsSectionProps) {
  const cards: ForecastCard[] = [
    {
      icon: TrendingUp,
      value: formatCurrency(forecasts.revenueForecast),
      label: "CA estimé",
      color: "text-primary",
    },
    {
      icon: DollarSign,
      value: formatCurrency(forecasts.profitForecast),
      label: "Bénéfice estimé",
      color: "text-success",
    },
    {
      icon: TrendingDown,
      value: formatCurrency(forecasts.expenseForecast),
      label: "Dépenses estimées",
      color: "text-destructive",
    },
    {
      icon: Package,
      value: forecasts.stockDays + " jours",
      label: "Stock actuel",
      color: "text-warning",
    },
    {
      icon: Wallet,
      value: formatCurrency(forecasts.cashFlowForecast),
      label: "Trésorerie estimée",
      color: "text-info",
    },
    {
      icon: RefreshCw,
      value: forecasts.renewalForecast + " abonnements",
      label: "Renouvellements estimés",
      color: "text-muted-foreground",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5" />
            {t("rentabilite.forecasts")}
          </CardTitle>
          <Badge className={confidenceColor(forecasts.confidence)}>
            Confiance : {forecasts.confidence}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="p-4 rounded-lg border space-y-2">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <div className="text-xl font-bold">{card.value}</div>
              <div className="text-sm text-muted-foreground">{card.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
