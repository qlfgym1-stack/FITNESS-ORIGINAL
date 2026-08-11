export type AssistantPeriod = "monthly" | "quarterly" | "custom"

export interface AssistantFilters {
  period: AssistantPeriod
  dateFrom: string
  dateTo: string
}

export interface HourTraffic {
  hour: number
  count: number
  percentage: number
}

export interface DayTraffic {
  day: number
  label: string
  count: number
  percentage: number
}

export interface PeakHoursResult {
  hourly: HourTraffic[]
  daily: DayTraffic[]
  peakHours: number[]
  offPeakHours: number[]
  busiestDay: number
  quietestDay: number
}

export interface ProductPerformance {
  productId: string
  name: string
  category: string | null
  quantity: number
  orders: number
  revenue: number
  cost: number
  profit: number
  marginPct: number
  stock: number | null
  score: number
}

export interface FlagshipResult {
  topByRevenue: ProductPerformance[]
  topByMargin: ProductPerformance[]
  flagship: ProductPerformance | null
  fastMovers: ProductPerformance[]
  deadStock: ProductPerformance[]
  slowMovers: ProductPerformance[]
}

export interface ExpiringSubscription {
  memberId: string
  memberName: string
  subscriptionName: string
  endDate: string
  daysLeft: number
  amount: number
}

export interface SubscriptionInsight {
  bestType: { name: string; revenue: number; count: number } | null
  expiring30: ExpiringSubscription[]
  expiring60: ExpiringSubscription[]
  activeCount: number
  avgRevenuePerMember: number
  inactiveMembers: number
  churnRisk: number
}

export interface ForecastPoint {
  label: string
  value: number
}

export interface RevenueForecast {
  next3Months: ForecastPoint[]
  confidence: number
  trend: "up" | "down" | "stable"
  percentChange: number
}

export interface AttendanceForecastPoint {
  date: string
  dayLabel: string
  predicted: number
}

export interface AttendanceForecast {
  next7Days: AttendanceForecastPoint[]
  weeklyTotal: number
  confidence: number
}

export type Priority = "p0" | "p1" | "p2"

export interface ActionItem {
  id: string
  priority: Priority
  categoryKey: string
  titleKey: string
  titleParams?: Record<string, string | number>
  detailKey: string
  detailParams?: Record<string, string | number>
  gainKey?: string
  gainParams?: Record<string, string | number>
}

export interface AiInsight {
  type: "positive" | "negative" | "neutral" | "warning"
  message: string
  action?: string
}

export interface KeyedInsight {
  type: "positive" | "negative" | "neutral" | "warning"
  messageKey: string
  messageParams?: Record<string, string | number>
  actionKey?: string
  actionParams?: Record<string, string | number>
}

export interface AssistantData {
  isLoading: boolean
  error: Error | null
  peakHours: PeakHoursResult
  flagship: FlagshipResult
  subscription: SubscriptionInsight
  revenueForecast: RevenueForecast
  attendanceForecast: AttendanceForecast
  actions: ActionItem[]
  insights: KeyedInsight[]
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  posRevenue: number
}
