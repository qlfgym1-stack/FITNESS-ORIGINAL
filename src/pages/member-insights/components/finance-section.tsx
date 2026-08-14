import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Package, CreditCard, TrendingUp } from "lucide-react"
import type { FinanceStats } from "../lib/finance"

interface FinanceSectionProps {
  stats: FinanceStats
  t: (key: string) => string
}

function methodLabel(method: string, t: (key: string) => string): string {
  const key = `memberInsights.finance.method.${method}`
  const value = t(key)
  return value && !value.startsWith("memberInsights.") ? value : method
}

export function FinanceSection({ stats, t }: FinanceSectionProps) {
  const maxProduct = stats.topProducts[0]?.revenue ?? 0
  const maxMethod = stats.paymentMethods[0]?.total ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("memberInsights.finance.title")}</CardTitle>
        <CardDescription>{t("memberInsights.finance.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.totalRevenue === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.finance.empty")}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-success" />
                <h3 className="text-sm font-semibold">{t("memberInsights.finance.revenueBreakdown")}</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("memberInsights.finance.subscriptions")}</span>
                  <span className="font-semibold">{formatCurrency(stats.totalSubscriptionRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("memberInsights.finance.pos")}</span>
                  <span className="font-semibold">{formatCurrency(stats.totalPosRevenue)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">{t("memberInsights.finance.totalRevenue")}</span>
                  <span className="font-bold">{formatCurrency(stats.totalRevenue)}</span>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{t("memberInsights.finance.topProducts")}</h3>
                </div>
                {stats.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("memberInsights.finance.noProducts")}</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topProducts.map((p) => (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate mr-2">{p.name}</span>
                          <span className="text-muted-foreground shrink-0">
                            {formatCurrency(p.revenue)} · {p.quantity} u.
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                            style={{ width: `${maxProduct > 0 ? Math.max((p.revenue / maxProduct) * 100, 2) : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold">{t("memberInsights.finance.paymentMethods")}</h3>
              </div>
              {stats.paymentMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("memberInsights.finance.noPayments")}</p>
              ) : (
                <div className="space-y-3">
                  {stats.paymentMethods.map((m) => (
                    <div key={m.method} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{methodLabel(m.method, t)}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(m.total)} · {m.count} · {m.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600"
                          style={{ width: `${maxMethod > 0 ? Math.max((m.total / maxMethod) * 100, 2) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
