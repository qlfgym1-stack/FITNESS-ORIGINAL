import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp } from "lucide-react"
import type { RevenueSource } from "../hooks/types"

interface RevenueSectionProps {
  totalRevenue: number
  revenueBySource: RevenueSource[]
  t: (key: string) => string
}

export function RevenueSection({
  totalRevenue,
  revenueBySource,
  t,
}: RevenueSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("rentabilite.revenue")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {revenueBySource.map((source) => (
            <div key={source.source} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t("rentabilite." + source.source)}</span>
                <span className="text-muted-foreground">{source.count} entrées</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{formatCurrency(source.amount)}</span>
                <span className="text-muted-foreground">{source.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(source.percentage, 100)}%`,
                    backgroundColor: source.color,
                  }}
                />
              </div>
            </div>
          ))}
          {revenueBySource.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("rentabilite.noRevenue")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="print-break-inside">
        <CardContent className="flex flex-col items-center justify-center py-12 relative">
          <TrendingUp className="h-16 w-16 text-primary/10 absolute top-4 right-4" />
          <span className="text-4xl font-bold text-primary">{formatCurrency(totalRevenue)}</span>
          <span className="text-sm text-muted-foreground mt-2">{t("rentabilite.totalRevenue")}</span>
        </CardContent>
      </Card>
    </div>
  )
}
