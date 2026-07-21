export interface AccountingFilters {
  period: 'daily' | 'weekly' | 'monthly' | 'custom'
  dateFrom: string
  dateTo: string
}

export interface RevenueSource {
  type: 'subscriptions' | 'pos' | 'coaching' | 'classes' | 'other'
  label: string
  amount: number
  count: number
  percentage: number
}

export interface RevenueTransaction {
  id: string
  memberName: string
  amount: number
  date: string
  method: string
  source: 'subscription' | 'pos' | 'other'
  description?: string
}

export interface ExpenseCategory {
  category: string
  label: string
  amount: number
  count: number
  percentage: number
}

export interface ExpenseTransaction {
  id: string
  description: string
  amount: number
  date: string
  category: string
  reference_type?: string
}

export interface MonthlyEntry {
  label: string
  revenue: number
  expenses: number
  profit: number
  cashFlow: number
}

export interface JournalEntry {
  date: string
  label: string
  debit: number
  credit: number
  account: string
}

export interface LedgerEntry {
  account: string
  totalDebit: number
  totalCredit: number
  balance: number
}

export interface BalanceEntry {
  account: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  amount: number
}

export interface VatEntry {
  period: string
  collected: number
  deductible: number
  net: number
}

export interface Alert {
  type: 'warning' | 'danger' | 'info' | 'success'
  message: string
}

export interface AiAnalysis {
  summary: string
  dailySummary: string
  weeklySummary: string
  monthlySummary: string
  recommendations: string[]
  trend: 'up' | 'down' | 'stable'
}

export interface AccountingData {
  isLoading: boolean
  totalRevenue: number
  subscriptionRevenue: number
  posRevenue: number
  totalExpenses: number
  profit: number
  profitMargin: number
  cashFlow: number
  revenueBySource: RevenueSource[]
  revenueTransactions: RevenueTransaction[]
  expensesByCategory: ExpenseCategory[]
  expenseTransactions: ExpenseTransaction[]
  monthlyHistory: MonthlyEntry[]
  salesJournal: JournalEntry[]
  expenseJournal: JournalEntry[]
  cashReceiptsJournal: JournalEntry[]
  generalLedger: LedgerEntry[]
  balance: BalanceEntry[]
  vatSummary: VatEntry[]
  alerts: Alert[]
  aiAnalysis: AiAnalysis
}
