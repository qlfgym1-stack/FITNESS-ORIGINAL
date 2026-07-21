import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { JournalEntry, LedgerEntry, BalanceEntry, VatEntry } from "../hooks/types";

interface JournalsProps {
  salesJournal: JournalEntry[];
  expenseJournal: JournalEntry[];
  cashReceiptsJournal: JournalEntry[];
  generalLedger: LedgerEntry[];
  balance: BalanceEntry[];
  vatSummary: VatEntry[];
  t: (key: string) => string;
}

const tabs = [
  "Ventes",
  "Dépenses",
  "Encaissements",
  "Grand Livre",
  "Balance",
  "TVA",
] as const;

type Tab = (typeof tabs)[number];

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground text-sm py-8">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function Journals({
  salesJournal,
  expenseJournal,
  cashReceiptsJournal,
  generalLedger,
  balance,
  vatSummary,
  t,
}: JournalsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Ventes");

  return (
    <div className="print-break-inside">
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {t(`assistantComptable.${tab === "Ventes" ? "salesJournal" : tab === "Dépenses" ? "expenseJournal" : tab === "Encaissements" ? "cashReceiptsJournal" : tab === "Grand Livre" ? "generalLedger" : tab === "Balance" ? "balance" : "vatSummary"}`)}
          </Button>
        ))}
      </div>

      {activeTab === "Ventes" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.date")}</TableHead>
              <TableHead>{t("assistantComptable.description")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.debit")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.credit")}</TableHead>
              <TableHead>{t("assistantComptable.account")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesJournal.length === 0 ? (
              <EmptyRow colSpan={5} message={t("assistantComptable.noRevenue")} />
            ) : (
              salesJournal.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>{entry.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.credit)}</TableCell>
                  <TableCell>{entry.account}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {activeTab === "Dépenses" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.date")}</TableHead>
              <TableHead>{t("assistantComptable.description")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.debit")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.credit")}</TableHead>
              <TableHead>{t("assistantComptable.account")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseJournal.length === 0 ? (
              <EmptyRow colSpan={5} message={t("assistantComptable.noExpenses")} />
            ) : (
              expenseJournal.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>{entry.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.credit)}</TableCell>
                  <TableCell>{entry.account}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {activeTab === "Encaissements" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.date")}</TableHead>
              <TableHead>{t("assistantComptable.description")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.debit")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.credit")}</TableHead>
              <TableHead>{t("assistantComptable.account")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashReceiptsJournal.length === 0 ? (
              <EmptyRow colSpan={5} message={t("assistantComptable.noRevenue")} />
            ) : (
              cashReceiptsJournal.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>{entry.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.credit)}</TableCell>
                  <TableCell>{entry.account}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {activeTab === "Grand Livre" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.account")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.debit")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.credit")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.balanceLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generalLedger.length === 0 ? (
              <EmptyRow colSpan={4} message={t("assistantComptable.noRevenue")} />
            ) : (
              generalLedger.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{entry.account}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.totalDebit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.totalCredit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.balance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {activeTab === "Balance" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.account")}</TableHead>
              <TableHead>{t("assistantComptable.type")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balance.length === 0 ? (
              <EmptyRow colSpan={3} message={t("assistantComptable.noExpenses")} />
            ) : (
              balance.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{entry.account}</TableCell>
                  <TableCell>{entry.type}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {activeTab === "TVA" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assistantComptable.period")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.vatCollected")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.vatDeductible")}</TableHead>
              <TableHead className="text-right">{t("assistantComptable.vatNet")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vatSummary.length === 0 ? (
              <EmptyRow colSpan={4} message={t("assistantComptable.noRevenue")} />
            ) : (
              vatSummary.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{entry.period}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.collected)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.deductible)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.net)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
