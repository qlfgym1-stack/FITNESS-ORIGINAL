import { useMemo } from "react"
import { useQuery } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import type {
  AccountingData,
  AccountingFilters,
  RevenueSource,
  RevenueTransaction,
  ExpenseCategory,
  ExpenseTransaction,
  MonthlyEntry,
  JournalEntry,
  LedgerEntry,
  BalanceEntry,
  VatEntry,
  Alert,
  AiAnalysis,
} from "./types"
import type { Database } from "@/types/supabase"

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"] & {
  members: { first_name: string; last_name: string } | null
}
type PosRow = Database["public"]["Tables"]["pos_transactions"]["Row"] & {
  members: { first_name: string; last_name: string } | null
}
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"]

const EXPENSE_LABELS: Record<string, string> = {
  rent: "Loyer",
  salaries: "Salaires",
  electricity: "Électricité",
  water: "Eau",
  equipment: "Équipement",
  maintenance: "Maintenance",
  marketing: "Marketing",
  insurance: "Assurance",
  taxes: "Impôts",
  other: "Autres",
}

const EXPENSE_ACCOUNTS: Record<string, string> = {
  rent: "613 - Loyers",
  salaries: "641 - Rémunérations",
  electricity: "605 - Électricité",
  water: "605.1 - Eau",
  equipment: "607 - Achats de matériel",
  maintenance: "618 - Entretiens",
  marketing: "623 - Publicité",
  insurance: "616 - Assurances",
  taxes: "63 - Impôts",
  other: "62 - Charges diverses",
}

function computePeriod(filters: AccountingFilters): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let from: Date
  let to: Date

  switch (filters.period) {
    case "daily":
      from = today
      to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
      break
    case "weekly": {
      const day = today.getDay()
      const diff = day === 0 ? 6 : day - 1
      from = new Date(today)
      from.setDate(today.getDate() - diff)
      to = new Date(today)
      to.setDate(today.getDate() + (6 - diff))
      to.setHours(23, 59, 59, 999)
      break
    }
    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      break
    case "custom":
      from = filters.dateFrom ? new Date(filters.dateFrom) : today
      to = filters.dateTo ? new Date(filters.dateTo + "T23:59:59.999") : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
      break
  }

  return { from: from.toISOString(), to: to.toISOString() }
}

function safeNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function useAccountingData(
  orgId: string | undefined,
  filters: AccountingFilters
): AccountingData {
  const supabase = useSupabase()
  const { from, to } = useMemo(() => computePeriod(filters), [filters])

  const { data: paymentsRaw = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["ac-payments", orgId, from, to],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("payments")
        .select("id, amount, payment_date, payment_method, status, members(first_name, last_name)")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("payment_date", from)
        .lte("payment_date", to)
      return (data ?? []) as unknown as PaymentRow[]
    },
    enabled: !!orgId,
  })

  const { data: posRaw = [], isLoading: posLoading } = useQuery({
    queryKey: ["ac-pos", orgId, from, to],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("pos_transactions")
        .select("id, total, created_at, payment_method, payment_status, items, members(first_name, last_name)")
        .eq("organization_id", orgId)
        .eq("payment_status", "completed")
        .gte("created_at", from)
        .lte("created_at", to)
      return (data ?? []) as unknown as PosRow[]
    },
    enabled: !!orgId,
  })

  const { data: expensesRaw = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["ac-expenses", orgId, from, to],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("organization_id", orgId)
        .gte("expense_date", from.slice(0, 10))
        .lte("expense_date", to.slice(0, 10))
      return (data ?? []) as ExpenseRow[]
    },
    enabled: !!orgId,
  })

  const { data: lastMonthPayments = [] } = useQuery({
    queryKey: ["ac-payments-prev", orgId, from],
    queryFn: async () => {
      if (!orgId) return []
      const prevFrom = new Date(new Date(from).getTime() - 30 * 86400000).toISOString()
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("payment_date", prevFrom)
        .lt("payment_date", from)
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const isLoading = paymentsLoading || posLoading || expensesLoading

  const subscriptionRevenue = useMemo(
    () => paymentsRaw.reduce((s, p) => s + safeNum(p.amount), 0),
    [paymentsRaw]
  )

  const posRevenue = useMemo(
    () => posRaw.reduce((s, t) => s + safeNum(t.total), 0),
    [posRaw]
  )

  const totalRevenue = subscriptionRevenue + posRevenue

  const totalExpenses = useMemo(
    () => expensesRaw.reduce((s, e) => s + safeNum(e.amount), 0),
    [expensesRaw]
  )

  const profit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
  const cashFlow = profit

  const prevMonthRevenue = useMemo(
    () => lastMonthPayments.reduce((s, p) => s + safeNum(p.amount), 0),
    [lastMonthPayments]
  )

  const revenueBySource: RevenueSource[] = useMemo(() => {
    const sources: RevenueSource[] = [
      { type: "subscriptions", label: "Abonnements", amount: subscriptionRevenue, count: paymentsRaw.length, percentage: 0 },
      { type: "pos", label: "Point de Vente", amount: posRevenue, count: posRaw.length, percentage: 0 },
      { type: "coaching", label: "Coaching", amount: 0, count: 0, percentage: 0 },
      { type: "classes", label: "Cours", amount: 0, count: 0, percentage: 0 },
      { type: "other", label: "Autres", amount: 0, count: 0, percentage: 0 },
    ]
    if (totalRevenue > 0) {
      sources.forEach(s => {
        s.percentage = (s.amount / totalRevenue) * 100
      })
    }
    return sources
  }, [subscriptionRevenue, posRevenue, paymentsRaw.length, posRaw.length, totalRevenue])

  const revenueTransactions: RevenueTransaction[] = useMemo(() => {
    const txs: RevenueTransaction[] = []
    for (const p of paymentsRaw) {
      const m = p.members
      txs.push({
        id: p.id,
        memberName: m ? `${m.first_name} ${m.last_name}` : "—",
        amount: safeNum(p.amount),
        date: p.payment_date,
        method: p.payment_method ?? "cash",
        source: "subscription",
        description: "Paiement abonnement",
      })
    }
    for (const t of posRaw) {
      const m = t.members
      const items = Array.isArray(t.items) ? t.items : []
      const hasSubscription = items.some(
        (it: Record<string, unknown>) => typeof it.id === "string" && it.id.startsWith("__subscription__")
      )
      if (hasSubscription) continue
      txs.push({
        id: t.id,
        memberName: m ? `${m.first_name} ${m.last_name}` : "Client",
        amount: safeNum(t.total),
        date: t.created_at,
        method: t.payment_method ?? "cash",
        source: "pos",
        description: "Vente POS",
      })
    }
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [paymentsRaw, posRaw])

  const expensesByCategory: ExpenseCategory[] = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>()
    for (const e of expensesRaw) {
      const prev = map.get(e.category) ?? { amount: 0, count: 0 }
      prev.amount += safeNum(e.amount)
      prev.count += 1
      map.set(e.category, prev)
    }
    const cats: ExpenseCategory[] = []
    for (const [cat, val] of map) {
      cats.push({
        category: cat,
        label: EXPENSE_LABELS[cat] ?? cat,
        amount: val.amount,
        count: val.count,
        percentage: totalExpenses > 0 ? (val.amount / totalExpenses) * 100 : 0,
      })
    }
    return cats.sort((a, b) => b.amount - a.amount)
  }, [expensesRaw, totalExpenses])

  const expenseTransactions: ExpenseTransaction[] = useMemo(() => {
    return expensesRaw.map(e => ({
      id: e.id,
      description: e.description,
      amount: safeNum(e.amount),
      date: e.expense_date,
      category: e.category,
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expensesRaw])

  const { data: monthlyHistory = [] } = useQuery({
    queryKey: ["ac-monthly", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const now = new Date()
      const result: MonthlyEntry[] = []
      for (let i = 5; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
        const sFrom = mStart.toISOString()
        const sTo = mEnd.toISOString()
        const mStartDay = mStart.toISOString().slice(0, 10)
        const mEndDay = mEnd.toISOString().slice(0, 10)
        const [revRes, expRes] = await Promise.all([
          supabase
            .from("payments")
            .select("amount")
            .eq("organization_id", orgId)
            .eq("status", "completed")
            .gte("payment_date", sFrom)
            .lte("payment_date", sTo),
          supabase
            .from("expenses")
            .select("amount")
            .eq("organization_id", orgId)
            .gte("expense_date", mStartDay)
            .lte("expense_date", mEndDay),
        ])
        const posRes = await supabase
          .from("pos_transactions")
          .select("total")
          .eq("organization_id", orgId)
          .eq("payment_status", "completed")
          .gte("created_at", sFrom)
          .lte("created_at", sTo)
        const revTotal =
          (revRes.data ?? []).reduce((s: number, r: { amount: number }) => s + safeNum(r.amount), 0) +
          (posRes.data ?? []).reduce((s: number, r: { total: number }) => s + safeNum(r.total), 0)
        const expTotal = (expRes.data ?? []).reduce((s: number, r: { amount: number }) => s + safeNum(r.amount), 0)
        const monthLabel = mStart.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
        result.push({
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          revenue: revTotal,
          expenses: expTotal,
          profit: revTotal - expTotal,
          cashFlow: revTotal - expTotal,
        })
      }
      return result
    },
    enabled: !!orgId,
  })

  const salesJournal: JournalEntry[] = useMemo(() => {
    return posRaw.map(t => {
      const items = Array.isArray(t.items) ? t.items : []
      const hasSubscription = items.some(
        (it: Record<string, unknown>) => typeof it.id === "string" && it.id.startsWith("__subscription__")
      )
      if (hasSubscription) return null
      return {
        date: t.created_at,
        label: `Vente POS #${t.id.slice(0, 8)}`,
        debit: safeNum(t.total),
        credit: 0,
        account: "701 - Ventes",
      }
    }).filter(Boolean) as JournalEntry[]
  }, [posRaw])

  const expenseJournal: JournalEntry[] = useMemo(() => {
    return expensesRaw.map(e => ({
      date: e.expense_date,
      label: e.description,
      debit: 0,
      credit: safeNum(e.amount),
      account: EXPENSE_ACCOUNTS[e.category] ?? `62 - ${EXPENSE_LABELS[e.category] ?? e.category}`,
    }))
  }, [expensesRaw])

  const cashReceiptsJournal: JournalEntry[] = useMemo(() => {
    return paymentsRaw.map(p => ({
      date: p.payment_date,
      label: "Abonnement",
      debit: safeNum(p.amount),
      credit: 0,
      account: "511 - Caisse",
    }))
  }, [paymentsRaw])

  const generalLedger: LedgerEntry[] = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>()
    const upsert = (acct: string, d: number, c: number) => {
      const prev = map.get(acct) ?? { debit: 0, credit: 0 }
      prev.debit += d
      prev.credit += c
      map.set(acct, prev)
    }
    for (const j of salesJournal) upsert(j.account, j.debit, j.credit)
    for (const j of expenseJournal) upsert(j.account, j.debit, j.credit)
    for (const j of cashReceiptsJournal) upsert(j.account, j.debit, j.credit)
    const entries: LedgerEntry[] = []
    for (const [account, val] of map) {
      entries.push({
        account,
        totalDebit: val.debit,
        totalCredit: val.credit,
        balance: val.debit - val.credit,
      })
    }
    return entries.sort((a, b) => a.account.localeCompare(b.account))
  }, [salesJournal, expenseJournal, cashReceiptsJournal])

  const balance: BalanceEntry[] = useMemo(() => {
    const entries: BalanceEntry[] = [
      { account: "511 - Caisse", type: "asset", amount: subscriptionRevenue + posRevenue - totalExpenses },
      { account: "701 - Ventes", type: "revenue", amount: totalRevenue },
      { account: "Charges", type: "expense", amount: totalExpenses },
      { account: "Résultat", type: "equity", amount: profit },
    ]
    if (totalExpenses > 0) {
      for (const cat of expensesByCategory) {
        entries.push({
          account: EXPENSE_ACCOUNTS[cat.category] ?? cat.label,
          type: "liability",
          amount: cat.amount,
        })
      }
    }
    return entries
  }, [subscriptionRevenue, posRevenue, totalExpenses, totalRevenue, profit, expensesByCategory])

  const vatSummary: VatEntry[] = useMemo(() => {
    const collected = posRevenue * 0.19
    const deductible = totalExpenses * 0.19
    return [
      {
        period: filters.period === "custom" ? `${filters.dateFrom} — ${filters.dateTo}` : filters.period,
        collected,
        deductible,
        net: collected - deductible,
      },
    ]
  }, [posRevenue, totalExpenses, filters])

  const alerts: Alert[] = useMemo(() => {
    const result: Alert[] = []
    if (totalRevenue > 0 && totalExpenses / totalRevenue > 0.8) {
      result.push({ type: "danger", message: "Dépenses anormales — plus de 80% des revenus" })
    }
    if (profit < 0) {
      result.push({ type: "danger", message: "Solde négatif — les dépenses dépassent les revenus" })
    }
    if (cashFlow < 0) {
      result.push({ type: "danger", message: "Trésorerie négative" })
    }
    const topCat = expensesByCategory[0]
    if (topCat && totalExpenses > 0 && topCat.percentage > 40) {
      result.push({ type: "warning", message: `Charge élevée : ${topCat.label} représente ${topCat.percentage.toFixed(0)}% des dépenses` })
    }
    if (prevMonthRevenue > 0 && totalRevenue < prevMonthRevenue) {
      const drop = ((prevMonthRevenue - totalRevenue) / prevMonthRevenue * 100).toFixed(0)
      result.push({ type: "warning", message: `Revenus en baisse de ${drop}% par rapport au mois dernier` })
    }
    if (result.length === 0) {
      result.push({ type: "success", message: "Situation saine — revenus couvrent les charges" })
    }
    return result
  }, [totalRevenue, totalExpenses, profit, cashFlow, expensesByCategory, prevMonthRevenue])

  const { data: dailyPayments = [] } = useQuery({
    queryKey: ["ac-daily-rev", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("payment_date", todayStart.toISOString())
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const { data: dailyPos = [] } = useQuery({
    queryKey: ["ac-daily-pos", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from("pos_transactions")
        .select("total")
        .eq("organization_id", orgId)
        .eq("payment_status", "completed")
        .gte("created_at", todayStart.toISOString())
      return (data ?? []) as { total: number }[]
    },
    enabled: !!orgId,
  })

  const { data: dailyExpenses = [] } = useQuery({
    queryKey: ["ac-daily-exp", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const todayStr = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("expense_date", todayStr)
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const { data: weekPayments = [] } = useQuery({
    queryKey: ["ac-week-rev", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("payment_date", weekAgo.toISOString())
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const { data: weekPos = [] } = useQuery({
    queryKey: ["ac-week-pos", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data } = await supabase
        .from("pos_transactions")
        .select("total")
        .eq("organization_id", orgId)
        .eq("payment_status", "completed")
        .gte("created_at", weekAgo.toISOString())
      return (data ?? []) as { total: number }[]
    },
    enabled: !!orgId,
  })

  const { data: weekExpenses = [] } = useQuery({
    queryKey: ["ac-week-exp", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekStr = weekAgo.toISOString().slice(0, 10)
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("organization_id", orgId)
        .gte("expense_date", weekStr)
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const { data: monthPayments = [] } = useQuery({
    queryKey: ["ac-month-rev", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("payment_date", mStart.toISOString())
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const { data: monthPos = [] } = useQuery({
    queryKey: ["ac-month-pos", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const { data } = await supabase
        .from("pos_transactions")
        .select("total")
        .eq("organization_id", orgId)
        .eq("payment_status", "completed")
        .gte("created_at", mStart.toISOString())
      return (data ?? []) as { total: number }[]
    },
    enabled: !!orgId,
  })

  const { data: monthExpenses = [] } = useQuery({
    queryKey: ["ac-month-exp", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const mStr = mStart.toISOString().slice(0, 10)
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("organization_id", orgId)
        .gte("expense_date", mStr)
      return (data ?? []) as { amount: number }[]
    },
    enabled: !!orgId,
  })

  const revToday = useMemo(() => {
    const p = dailyPayments.reduce((s, r) => s + safeNum(r.amount), 0)
    const pos = dailyPos.reduce((s, r) => s + safeNum(r.total), 0)
    return p + pos
  }, [dailyPayments, dailyPos])

  const expToday = useMemo(() => dailyExpenses.reduce((s, r) => s + safeNum(r.amount), 0), [dailyExpenses])

  const revWeek = useMemo(() => {
    const p = weekPayments.reduce((s, r) => s + safeNum(r.amount), 0)
    const pos = weekPos.reduce((s, r) => s + safeNum(r.total), 0)
    return p + pos
  }, [weekPayments, weekPos])

  const expWeek = useMemo(() => weekExpenses.reduce((s, r) => s + safeNum(r.amount), 0), [weekExpenses])

  const revMonth = useMemo(() => {
    const p = monthPayments.reduce((s, r) => s + safeNum(r.amount), 0)
    const pos = monthPos.reduce((s, r) => s + safeNum(r.total), 0)
    return p + pos
  }, [monthPayments, monthPos])

  const expMonth = useMemo(() => monthExpenses.reduce((s, r) => s + safeNum(r.amount), 0), [monthExpenses])

  const aiAnalysis: AiAnalysis = useMemo(() => {
    const periodLabel = filters.period === "daily" ? "du jour" : filters.period === "weekly" ? "de la semaine" : filters.period === "monthly" ? "du mois" : "de la période sélectionnée"
    const profitWord = profit >= 0 ? "positif" : "négatif"
    const trend: "up" | "down" | "stable" = totalRevenue > totalExpenses * 1.2 ? "up" : totalRevenue < totalExpenses ? "down" : "stable"

    const recommendations: string[] = []
    if (totalExpenses > 0) {
      const topCats = expensesByCategory.filter(c => c.percentage > 25)
      for (const cat of topCats) {
        recommendations.push(`Réduire les charges de ${cat.label} (${cat.percentage.toFixed(0)}% du total)`)
      }
    }
    if (posRevenue < subscriptionRevenue) {
      recommendations.push("Augmenter les ventes au point de vente")
    }
    if (subscriptionRevenue === 0 && posRevenue === 0) {
      recommendations.push("Aucun revenu enregistré — vérifier les enregistrements de paiement")
    }
    if (profit < 0) {
      recommendations.push("Urgence : réduire les charges ou augmenter les revenus")
    }
    if (profitMargin > 30) {
      recommendations.push("Marge confortable — envisager des investissements")
    }
    if (expensesByCategory.length > 0) {
      const largest = expensesByCategory[0]
      if (largest && largest.percentage > 40) {
        recommendations.push(`Concentrer l'effort de réduction sur ${largest.label}`)
      }
    }
    if (recommendations.length === 0) {
      recommendations.push("Maintenir la tendance actuelle")
    }

    return {
      summary: `Analyse comptable ${periodLabel} : ${totalRevenue.toLocaleString("fr-DZ")} DZD de revenus, ${totalExpenses.toLocaleString("fr-DZ")} DZD de dépenses, solde ${profitWord} de ${profit.toLocaleString("fr-DZ")} DZD`,
      dailySummary: `Aujourd'hui : ${revToday.toLocaleString("fr-DZ")} DZD encaissés, ${expToday.toLocaleString("fr-DZ")} DZD décaissés`,
      weeklySummary: `Cette semaine : ${revWeek.toLocaleString("fr-DZ")} DZD encaissés, ${expWeek.toLocaleString("fr-DZ")} DZD décaissés`,
      monthlySummary: `Ce mois : ${revMonth.toLocaleString("fr-DZ")} DZD encaissés, ${expMonth.toLocaleString("fr-DZ")} DZD décaissés`,
      recommendations,
      trend,
    }
  }, [filters.period, totalRevenue, totalExpenses, profit, profitMargin, posRevenue, subscriptionRevenue, expensesByCategory, revToday, expToday, revWeek, expWeek, revMonth, expMonth])

  return useMemo<AccountingData>(
    () => ({
      isLoading,
      totalRevenue,
      subscriptionRevenue,
      posRevenue,
      totalExpenses,
      profit,
      profitMargin,
      cashFlow,
      revenueBySource,
      revenueTransactions,
      expensesByCategory,
      expenseTransactions,
      monthlyHistory,
      salesJournal,
      expenseJournal,
      cashReceiptsJournal,
      generalLedger,
      balance,
      vatSummary,
      alerts,
      aiAnalysis,
    }),
    [
      isLoading,
      totalRevenue,
      subscriptionRevenue,
      posRevenue,
      totalExpenses,
      profit,
      profitMargin,
      cashFlow,
      revenueBySource,
      revenueTransactions,
      expensesByCategory,
      expenseTransactions,
      monthlyHistory,
      salesJournal,
      expenseJournal,
      cashReceiptsJournal,
      generalLedger,
      balance,
      vatSummary,
      alerts,
      aiAnalysis,
    ]
  )
}
