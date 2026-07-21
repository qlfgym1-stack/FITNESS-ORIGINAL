import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import type { RevenueSource, RevenueTransaction } from "../hooks/types"

interface RevenueSectionProps {
  totalRevenue: number
  subscriptionRevenue: number
  posRevenue: number
  revenueBySource: RevenueSource[]
  revenueTransactions: RevenueTransaction[]
  t: (key: string) => string
}

const sourceColors: Record<string, string> = {
  subscriptions: "bg-success",
  pos: "bg-primary",
  coaching: "bg-warning",
  classes: "bg-info",
  other: "bg-muted-foreground",
}

const sourceLabels: Record<string, string> = {
  subscriptions: "assistantComptable.subscriptions",
  pos: "assistantComptable.pos",
  coaching: "assistantComptable.coaching",
  classes: "assistantComptable.classes",
  other: "assistantComptable.other",
}

export function RevenueSection({
  totalRevenue,
  revenueBySource,
  revenueTransactions,
  t,
}: RevenueSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-inside">
      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("assistantComptable.revenueBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {revenueBySource.map((source) => (
            <div key={source.type} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t(sourceLabels[source.type] || source.type)}</span>
                <span className="text-muted-foreground">{source.count} {t("assistantComptable.entries")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{formatCurrency(source.amount)}</span>
                <span className="text-muted-foreground">{source.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-success/20">
                <div
                  className={`h-full rounded-full ${sourceColors[source.type] || "bg-primary"}`}
                  style={{ width: `${Math.min(source.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
          {revenueBySource.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("assistantComptable.noRevenue")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("assistantComptable.details")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("assistantComptable.member")}</TableHead>
                <TableHead className="text-right">{t("assistantComptable.amount")}</TableHead>
                <TableHead>{t("assistantComptable.date")}</TableHead>
                <TableHead>{t("assistantComptable.method")}</TableHead>
                <TableHead>{t("assistantComptable.source")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    {t("assistantComptable.noRevenue")}
                  </TableCell>
                </TableRow>
              ) : (
                revenueTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.memberName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell>{tx.method}</TableCell>
                    <TableCell>{t(sourceLabels[tx.source] || tx.source)}</TableCell>
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
    </div>
  )
}
