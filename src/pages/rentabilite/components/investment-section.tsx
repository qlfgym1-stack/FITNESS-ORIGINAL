import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import type { InvestmentCategory, RoiEntry } from "../hooks/types"

interface InvestmentSectionProps {
  totalInvestment: number
  investmentsByCategory: InvestmentCategory[]
  roiData: RoiEntry[]
  t: (key: string) => string
}

function roiColor(roi: number): string {
  if (roi > 50) return "text-success"
  if (roi > 0) return "text-warning"
  return "text-destructive"
}

export function InvestmentSection({
  totalInvestment,
  investmentsByCategory,
  roiData,
  t,
}: InvestmentSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-inside">
      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("rentabilite.investments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-bold">{formatCurrency(totalInvestment)}</p>
          {investmentsByCategory.map((cat) => (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t("rentabilite.inv_" + cat.category)}</span>
                <span className="text-muted-foreground">{formatCurrency(cat.amount)}</span>
              </div>
              <div className="h-2 rounded-full bg-primary/20">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{cat.percentage.toFixed(1)}%</p>
            </div>
          ))}
          {investmentsByCategory.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("rentabilite.noInvestments")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("rentabilite.roi")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {roiData.map((entry) => (
            <div key={entry.category} className="space-y-1.5">
              <p className="font-medium text-sm">{entry.label}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{formatCurrency(entry.invested)}</span>
                <span className="text-muted-foreground mx-1">→</span>
                <span>{formatCurrency(entry.returnAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-lg font-bold ${roiColor(entry.roi)}`}>
                  {entry.roi > 0 ? "+" : ""}{entry.roi.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("rentabilite.recoupIn")} {entry.monthsToRecoup} {t("rentabilite.months")}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${entry.roi > 0 ? "bg-success" : "bg-destructive"}`}
                  style={{ width: `${Math.min(Math.max(entry.roi, 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
          {roiData.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("rentabilite.noRoi")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
