import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { MonthlyEntry } from "../hooks/types";

interface MonthlyHistoryProps {
  monthlyHistory: MonthlyEntry[];
  t: (key: string) => string;
}

export function MonthlyHistory({ monthlyHistory, t }: MonthlyHistoryProps) {
  return (
    <Card className="print-break-inside">
      <CardHeader>
        <CardTitle>{t("assistantComptable.monthlyHistory")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.month")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.revenue")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.expenses")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.profit")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.cashFlow")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyHistory.map((entry) => (
              <TableRow key={entry.label}>
                <TableCell className="font-medium">{entry.label}</TableCell>
                <TableCell className="text-right text-success">{formatCurrency(entry.revenue)}</TableCell>
                <TableCell className="text-right text-destructive">{formatCurrency(entry.expenses)}</TableCell>
                <TableCell className={`text-right ${entry.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {entry.profit >= 0 ? "+" : ""}{formatCurrency(entry.profit)}
                </TableCell>
                <TableCell className={`text-right ${entry.cashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(entry.cashFlow)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
