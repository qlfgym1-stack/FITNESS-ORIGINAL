export interface ProfitabilityFilters {
  period: 'monthly' | 'yearly' | 'custom'
  dateFrom: string
  dateTo: string
}

export interface InvestmentCategory {
  category: string
  label: string
  amount: number
  percentage: number
}

export interface RevenueSource {
  source: string
  label: string
  amount: number
  count: number
  percentage: number
  color: string
}

export interface ProfitData {
  totalRevenue: number
  subscriptionRevenue: number
  posRevenue: number
  coachingRevenue: number
  classRevenue: number
  otherRevenue: number
  costOfSales: number
  grossProfit: number
  grossMargin: number
  totalExpenses: number
  netProfit: number
  netMargin: number
}

export interface RoiEntry {
  category: string
  label: string
  invested: number
  returnAmount: number
  roi: number
  monthsToRecoup: number
}

export interface ProfitabilityItem {
  label: string
  revenue: number
  cost: number
  profit: number
  margin: number
  trend: 'up' | 'down' | 'stable'
}

export interface Forecast {
  revenueForecast: number
  profitForecast: number
  expenseForecast: number
  stockDays: number
  cashFlowForecast: number
  renewalForecast: number
  confidence: number
}

export interface Objective {
  metric: string
  label: string
  target: number
  actual: number
  progress: number
  forecast: number
  status: 'on_track' | 'at_risk' | 'behind'
}

export interface ChartSeries {
  name: string
  data: { label: string; value: number }[]
  color: string
}

export interface AiInsight {
  type: 'positive' | 'negative' | 'neutral' | 'warning'
  message: string
  action?: string
}

export interface ProfitabilityData {
  isLoading: boolean
  totalRevenue: number
  totalExpenses: number
  totalInvestment: number
  investmentsByCategory: InvestmentCategory[]
  revenueBySource: RevenueSource[]
  profitData: ProfitData
  roiData: RoiEntry[]
  profitabilityByProduct: ProfitabilityItem[]
  profitabilityByCategory: ProfitabilityItem[]
  profitabilityBySupplier: ProfitabilityItem[]
  profitabilityBySubscription: ProfitabilityItem[]
  profitabilityByCoach: ProfitabilityItem[]
  profitabilityByMonth: ProfitabilityItem[]
  profitabilityByYear: ProfitabilityItem[]
  forecasts: Forecast
  objectives: Objective[]
  monthlyRevenue: { label: string; value: number }[]
  monthlyExpenses: { label: string; value: number }[]
  monthlyProfit: { label: string; value: number }[]
  insights: AiInsight[]
}
