import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import type { ExpenseCategory, ExpenseTransaction } from "../hooks/types"

interface ExpensesSectionProps {
  totalExpenses: number
  expensesByCategory: ExpenseCategory[]
  expenseTransactions: ExpenseTransaction[]
  t: (key: string) => string
}

export function ExpensesSection({
  totalExpenses,
  expensesByCategory,
  expenseTransactions,
  t,
}: ExpensesSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("expenses.byCategory")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("assistantComptable.noExpenses")}
            </p>
          ) : (
            expensesByCategory.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{t("expenses." + cat.category)}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(cat.amount)} · {cat.count} {t("assistantComptable.entries")}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-destructive/20">
                  <div
                    className="h-full rounded-full bg-destructive transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {cat.percentage.toFixed(1)}%
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="print-break-inside">
        <CardHeader>
          <CardTitle className="text-base">{t("assistantComptable.expenses")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("assistantComptable.description")}</TableHead>
                <TableHead className="text-right">{t("assistantComptable.amount")}</TableHead>
                <TableHead>{t("assistantComptable.date")}</TableHead>
                <TableHead>{t("assistantComptable.category")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    {t("assistantComptable.noExpenses")}
                  </TableCell>
                </TableRow>
              ) : (
                expenseTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell>{t("expenses." + tx.category)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex justify-between items-center px-4 py-3 border-t font-semibold">
          <span>{t("assistantComptable.total")}</span>
          <span className="text-destructive">{formatCurrency(totalExpenses)}</span>
        </div>
      </Card>
    </div>
  )
}
