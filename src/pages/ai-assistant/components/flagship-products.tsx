import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Star, Truck, AlertTriangle, TrendingDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { FlagshipResult } from "../hooks/types"

interface FlagshipProductsProps {
  data: FlagshipResult
  t: (key: string) => string
}

export function FlagshipProducts({ data, t }: FlagshipProductsProps) {
  const { flagship, topByRevenue, fastMovers, deadStock, slowMovers } = data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          {t("aiAssistant.flagshipTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("aiAssistant.flagshipSubtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {flagship && flagship.profit > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 flex items-center gap-3">
            <Star className="h-6 w-6 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <Badge className="bg-amber-500">{t("aiAssistant.flagshipBadge")}</Badge>
              <p className="font-semibold mt-1 truncate">{flagship.name}</p>
              <p className="text-xs text-muted-foreground">
                {t("aiAssistant.flagshipMeta")}
              </p>
              <p className="text-xs mt-1">
                <span className="font-semibold text-success">{t("aiAssistant.flagshipAction")}</span>
              </p>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-2">{t("aiAssistant.topProducts")}</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>{t("aiAssistant.product")}</TableHead>
                <TableHead className="text-right">{t("aiAssistant.qty")}</TableHead>
                <TableHead className="text-right">{t("aiAssistant.revenue")}</TableHead>
                <TableHead className="text-right">{t("aiAssistant.margin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topByRevenue.map((p, idx) => (
                <TableRow key={p.productId}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{p.name}</TableCell>
                  <TableCell className="text-right">{p.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                  <TableCell className="text-right">
                    <span className={p.marginPct >= 50 ? "text-success" : "text-muted-foreground"}>
                      {Math.round(p.marginPct)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {topByRevenue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t("aiAssistant.noProducts")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fastMovers.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm font-medium flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-warning" /> {t("aiAssistant.fastMovers")}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {fastMovers.map((p) => (
                  <li key={p.productId} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0">{t("aiAssistant.stockLeft")}: {p.stock}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deadStock.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive" /> {t("aiAssistant.deadStock")}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {deadStock.slice(0, 5).map((p) => (
                  <li key={p.productId} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0">{p.stock} {t("aiAssistant.units")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {slowMovers.length > 0 && (
            <div className="rounded-md border border-muted bg-muted/20 p-3 sm:col-span-2">
              <p className="text-sm font-medium flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4" /> {t("aiAssistant.slowMovers")}
              </p>
              <p className="text-xs text-muted-foreground">
                {slowMovers.map((p) => p.name).join(" · ")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
