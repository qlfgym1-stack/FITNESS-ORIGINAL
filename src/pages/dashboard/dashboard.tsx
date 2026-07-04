import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Users, UserCheck, DollarSign, Calendar, Clock, TrendingUp, TrendingDown,
  ArrowUpRight, Send, RefreshCw, UserPlus, CreditCard, LogIn, Activity, Award, Timer,
} from 'lucide-react'
import { formatCurrency, formatDate, getDaysRemaining, getStatusColor, getInitials } from '@/lib/utils'
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MemberSubscription, Payment } from '@/types/supabase'

// ── Mock data — swap with Supabase queries when connected ────────────
const mockActivityFeed = [
  { id: '1', action: 'New member registered', member: 'John Smith', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), icon: 'user-plus' },
  { id: '2', action: 'Payment received', member: 'Sarah Johnson', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), icon: 'dollar' },
  { id: '3', action: 'Class completed', member: 'Yoga Flow', timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), icon: 'check' },
  { id: '4', action: 'Subscription renewed', member: 'Mike Chen', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), icon: 'refresh' },
  { id: '5', action: 'Check-in', member: 'Emma Wilson', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), icon: 'log-in' },
  { id: '6', action: 'New membership purchased', member: 'David Kim', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), icon: 'credit-card' },
  { id: '7', action: 'Payment received', member: 'Lisa Anderson', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), icon: 'dollar' },
  { id: '8', action: 'Class booked', member: 'James Taylor', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), icon: 'calendar' },
  { id: '9', action: 'Check-in', member: 'Rachel Green', timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), icon: 'log-in' },
  { id: '10', action: 'Subscription expiring soon', member: 'Tom Brown', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), icon: 'alert' },
]

const mockTopCoaches = [
  { id: '1', name: 'Alex Rivera', classes: 42, rating: 4.9, avatar: null, specialty: 'HIIT' },
  { id: '2', name: 'Sarah Chen', classes: 38, rating: 4.8, avatar: null, specialty: 'Yoga' },
  { id: '3', name: 'Mike Johnson', classes: 35, rating: 4.7, avatar: null, specialty: 'Strength' },
  { id: '4', name: 'Emily Davis', classes: 31, rating: 4.9, avatar: null, specialty: 'Pilates' },
  { id: '5', name: 'Chris Miller', classes: 28, rating: 4.6, avatar: null, specialty: 'Boxing' },
]

const mockGenderData = [
  { name: 'Male', value: 85, color: '#3b82f6' },
  { name: 'Female', value: 63, color: '#ec4899' },
]

const mockExpiringThisWeek = [
  { id: '1', member: 'Mike Chen', daysLeft: 2, plan: 'Premium Monthly' },
  { id: '2', member: 'Lisa Anderson', daysLeft: 3, plan: 'Basic Monthly' },
  { id: '3', member: 'Tom Brown', daysLeft: 5, plan: 'Student Pass' },
]

const revenueComparison = {
  currentMonth: 21500,
  lastMonth: 18900,
  percentChange: 13.8,
}

const revenueData = [
  { month: 'Feb', amount: 12400 },
  { month: 'Mar', amount: 15800 },
  { month: 'Apr', amount: 14200 },
  { month: 'May', amount: 18900 },
  { month: 'Jun', amount: 21500 },
  { month: 'Jul', amount: 19800 },
]

const growthData = [
  { month: 'Feb', count: 85 },
  { month: 'Mar', count: 92 },
  { month: 'Apr', count: 104 },
  { month: 'May', count: 118 },
  { month: 'Jun', count: 135 },
  { month: 'Jul', count: 148 },
]

// ── Count-up animation hook ──────────────────────────────────────────
function useCountUp(end: number, duration = 1200) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (end === 0) { setCount(0); return }
    let startTime: number | null = null
    let rafId: number
    function animate(time: number) {
      if (!startTime) startTime = time
      const progress = Math.min((time - startTime) / duration, 1)
      setCount(Math.floor(progress * end))
      if (progress < 1) rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [end, duration])
  return count
}

// ── Helpers ──────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getActivityIcon(icon: string) {
  switch (icon) {
    case 'user-plus': return <UserPlus className="h-4 w-4" />
    case 'dollar': return <DollarSign className="h-4 w-4" />
    case 'check': return <Calendar className="h-4 w-4" />
    case 'refresh': return <RefreshCw className="h-4 w-4" />
    case 'log-in': return <LogIn className="h-4 w-4" />
    case 'credit-card': return <CreditCard className="h-4 w-4" />
    case 'calendar': return <Calendar className="h-4 w-4" />
    case 'alert': return <Timer className="h-4 w-4" />
    default: return <Activity className="h-4 w-4" />
  }
}

// ── Interfaces ───────────────────────────────────────────────────────
interface ExpiringSubscription extends MemberSubscription {
  member_name?: string
  type_name?: string
}

interface StatCardProps {
  title: string
  rawValue: number
  icon: React.ElementType
  change: number
  trend: 'up' | 'down'
  format: (v: number) => string
}

// ── StatCard sub-component (count-up per card) ───────────────────────
function StatCard({ title, rawValue, icon: Icon, change, trend, format }: StatCardProps) {
  const animatedValue = useCountUp(rawValue)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{format(animatedValue)}</div>
        {change !== 0 && (
          <p className={`mt-1 flex items-center text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
            {Math.abs(change)}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────
export default function Dashboard() {
  const t = useT()
  const nav = useNavigate()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { count: totalMembers } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
      const { count: activeMembers } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
      const { count: todayClasses } = await supabase.from('classes').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
      const { count: presentNow } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('check_in', new Date().toISOString().slice(0, 10))
      const { data: payments } = await supabase.from('payments').select('amount').eq('organization_id', orgId).gte('payment_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
      const revenue = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0
      return { totalMembers: totalMembers ?? 0, activeMembers: activeMembers ?? 0, todayClasses: todayClasses ?? 0, presentNow: presentNow ?? 0, revenue }
    },
    enabled: !!orgId,
  })

  const { data: expiringSubs } = useQuery({
    queryKey: ['expiring-subscriptions', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('member_subscriptions')
        .select('*, members!inner(first_name, last_name), subscription_types!inner(name)')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .lte('end_date', thirtyDays)
        .order('end_date', { ascending: true })
        .limit(5)
      return (data ?? []).map((sub: any) => ({
        ...sub,
        member_name: `${sub.members?.first_name ?? ''} ${sub.members?.last_name ?? ''}`,
        type_name: sub.subscription_types?.name ?? '',
      })) as ExpiringSubscription[]
    },
    enabled: !!orgId,
  })

  const { data: recentPayments } = useQuery({
    queryKey: ['recent-payments', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from('payments')
        .select('*, members!inner(first_name, last_name)')
        .eq('organization_id', orgId)
        .order('payment_date', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!orgId,
  })

  const { data: inactiveMembers } = useQuery({
    queryKey: ['inactive-members', orgId],
    queryFn: async () => {
      if (!orgId) return 0
      const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'inactive')
      return count ?? 0
    },
    enabled: !!orgId,
  })

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['recent-payments'] })
    queryClient.invalidateQueries({ queryKey: ['inactive-members'] })
    toast({ title: 'Dashboard refreshed' })
  }, [queryClient, toast])

  const statCards = [
    { title: 'Total Members', rawValue: stats?.totalMembers ?? 0, icon: Users, change: 12, trend: 'up' as const, format: (v: number) => v.toString() },
    { title: 'Active Members', rawValue: stats?.activeMembers ?? 0, icon: UserCheck, change: 8, trend: 'up' as const, format: (v: number) => v.toString() },
    { title: 'Revenue This Month', rawValue: stats?.revenue ?? 0, icon: DollarSign, change: 13.8, trend: 'up' as const, format: (v: number) => formatCurrency(v) },
    { title: "Today's Classes", rawValue: stats?.todayClasses ?? 0, icon: Calendar, change: 0, trend: 'up' as const, format: (v: number) => v.toString() },
    { title: 'Present Now', rawValue: stats?.presentNow ?? 0, icon: Clock, change: -3, trend: 'down' as const, format: (v: number) => v.toString() },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your gym's performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('dashboard.quickActions')}</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: t('dashboard.addMember'), desc: t('dashboard.addMemberDesc'), icon: UserPlus, path: '/members' },
            { label: t('dashboard.newSubscription'), desc: t('dashboard.newSubscriptionDesc'), icon: CreditCard, path: '/subscriptions' },
            { label: t('dashboard.recordPayment'), desc: t('dashboard.recordPaymentDesc'), icon: DollarSign, path: '/payments' },
            { label: t('dashboard.checkIn'), desc: t('dashboard.checkInDesc'), icon: LogIn, path: '/check-in' },
          ].map((item) => (
            <Card key={item.label} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => nav(item.path)}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                <div className="rounded-full bg-primary/10 p-3">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium text-sm">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Revenue comparison ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-3xl font-bold">{formatCurrency(revenueComparison.currentMonth)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Month</p>
              <p className="text-3xl font-bold text-muted-foreground">{formatCurrency(revenueComparison.lastMonth)}</p>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              {revenueComparison.percentChange}% vs last month
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Charts ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs text-muted-foreground" />
                  <YAxis className="text-xs text-muted-foreground" />
                  <Tooltip />
                  <Line type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Member Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs text-muted-foreground" />
                  <YAxis className="text-xs text-muted-foreground" />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Gender / Expiring / Top Coaches ───────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mockGenderData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {mockGenderData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-6 mt-2">
              {mockGenderData.map((g) => (
                <div key={g.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                  <span>{g.name}: <strong>{g.value}</strong></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Expiring This Week */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="h-5 w-5 text-amber-500" />
              Expiring This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockExpiringThisWeek.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No expiring subscriptions this week</p>
            )}
            {mockExpiringThisWeek.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-sm">{item.member}</p>
                  <p className="text-xs text-muted-foreground">{item.plan}</p>
                </div>
                <Badge variant={item.daysLeft <= 3 ? 'destructive' : 'outline'} className="text-xs">
                  {item.daysLeft} day{item.daysLeft > 1 ? 's' : ''} left
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Coaches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Top Coaches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockTopCoaches.map((coach, idx) => (
              <div key={coach.id} className="flex items-center gap-3">
                <span className="w-5 text-sm font-bold text-muted-foreground text-center">{idx + 1}</span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={coach.avatar ?? undefined} />
                  <AvatarFallback className="text-xs">{getInitials(coach.name.split(' ')[0], coach.name.split(' ')[1] ?? '')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{coach.name}</p>
                  <p className="text-xs text-muted-foreground">{coach.specialty}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{coach.classes}</p>
                  <p className="text-xs text-muted-foreground">classes</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {mockActivityFeed.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4 py-3 border-b last:border-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  {getActivityIcon(item.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{item.action}</span>
                    {item.member && (
                      <>
                        {' \u2014 '}
                        <span className="text-muted-foreground">{item.member}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Expiring Subscriptions ────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Expiring Subscriptions</CardTitle>
            <Badge variant="destructive">{expiringSubs?.length ?? 0} soon</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!expiringSubs || expiringSubs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No expiring subscriptions</TableCell>
                  </TableRow>
                )}
                {expiringSubs?.map((sub) => {
                  const daysLeft = getDaysRemaining(sub.end_date)
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.member_name}</TableCell>
                      <TableCell>{sub.type_name}</TableCell>
                      <TableCell>{formatDate(sub.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant={daysLeft <= 7 ? 'destructive' : daysLeft <= 14 ? 'outline' : 'secondary'}>{daysLeft}d</Badge>
                      </TableCell>
                      <TableCell><Badge className={getStatusColor(sub.status)}>{sub.status}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inactive Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-bold">{inactiveMembers ?? 0}</p>
            <p className="text-sm text-muted-foreground">Members who haven't visited in 30+ days</p>
            <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: 'Reminders sent', description: 'Subscription reminders have been sent.' })}>
              <Send className="mr-2 h-4 w-4" />
              Send Reminders
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: 'Reminders sent', description: 'Payment reminders have been sent.' })}>
              <Send className="mr-2 h-4 w-4" />
              Send Payment Reminders
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Payments ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!recentPayments || recentPayments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No recent payments</TableCell>
                </TableRow>
              )}
              {recentPayments?.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{`${payment.members?.first_name ?? ''} ${payment.members?.last_name ?? ''}`}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{formatDate(payment.payment_date)}</TableCell>
                  <TableCell className="capitalize">{payment.payment_method}</TableCell>
                  <TableCell><Badge className={getStatusColor(payment.status)}>{payment.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
