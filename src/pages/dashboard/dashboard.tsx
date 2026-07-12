import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useRealtime } from '@/hooks/useRealtime'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Users, UserCheck, DollarSign, Calendar, Clock, TrendingUp, TrendingDown,
  ArrowUpRight, Send, RefreshCw, UserPlus, CreditCard, Activity, Award, Timer,
  Wifi, WifiOff, AlertTriangle, ScanQrCode,
} from 'lucide-react'
import { formatCurrency, formatDate, getDaysRemaining, getStatusColor, getInitials, toUpper } from '@/lib/utils'
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MemberSubscription, Payment } from '@/types/supabase'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime())
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
    case 'log-in': return <ScanQrCode className="h-4 w-4" />
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
  t: (key: string) => string
}

// ── StatCard sub-component (count-up per card) ───────────────────────
function StatCard({ title, rawValue, icon: Icon, change, trend, format, t: tFn, loading }: StatCardProps & { loading?: boolean }) {
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
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold tabular-nums">{format(animatedValue)}</div>
            {change !== 0 && (
              <p className={`mt-1 flex items-center text-xs ${trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                {trend === 'up' ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                {Math.abs(change)}% {tFn('dashboard.vsLastMonth')}
              </p>
            )}
          </>
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

  useRealtime({ table: "attendance", queryKey: ["dashboard-stats", orgId ?? ""], filter: orgId ? `organization_id=eq.${orgId}` : undefined })
  useRealtime({ table: "members", queryKey: ["dashboard-stats", orgId ?? ""], filter: orgId ? `organization_id=eq.${orgId}` : undefined })
  useRealtime({ table: "payments", queryKey: ["dashboard-stats", orgId ?? ""], filter: orgId ? `organization_id=eq.${orgId}` : undefined })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)
      const [
        totalRes, activeRes, classesRes, presentRes, paymentsRes,
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('check_in', today),
        supabase.from('payments').select('amount').eq('organization_id', orgId).gte('payment_date', monthStart),
      ])
      const revenue = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) ?? 0
      return {
        totalMembers: totalRes.count ?? 0,
        activeMembers: activeRes.count ?? 0,
        todayClasses: classesRes.count ?? 0,
        presentNow: presentRes.count ?? 0,
        revenue,
      }
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

  const { data: revenueMonth } = useQuery({
    queryKey: ['revenue-monthly', orgId],
    queryFn: async () => {
      if (!orgId) return { current: 0, last: 0 }
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
      const { data: current } = await supabase.from('payments').select('amount').eq('organization_id', orgId).eq('status', 'completed').gte('payment_date', firstOfMonth).lt('payment_date', firstOfNextMonth)
      const { data: last } = await supabase.from('payments').select('amount').eq('organization_id', orgId).eq('status', 'completed').gte('payment_date', firstOfLastMonth).lt('payment_date', firstOfMonth)
      return {
        current: current?.reduce((s, p) => s + p.amount, 0) ?? 0,
        last: last?.reduce((s, p) => s + p.amount, 0) ?? 0,
      }
    },
    enabled: !!orgId,
  })

  const { data: revenueTrend } = useQuery({
    queryKey: ['revenue-trend', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const m = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        return { m, start: m.toISOString(), end: new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1).toISOString() }
      })
      const results = await Promise.all(
        months.map(({ m, start, end }) =>
          supabase.from('payments').select('amount').eq('organization_id', orgId).eq('status', 'completed').gte('payment_date', start).lt('payment_date', end).then(({ data }) => ({ month: MONTHS[m.getMonth()], amount: data?.reduce((s, p) => s + p.amount, 0) ?? 0 }))
        )
      )
      return results
    },
    enabled: !!orgId,
  })

  const { data: growthTrend } = useQuery({
    queryKey: ['growth-trend', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const m = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        return { m, start: m.toISOString(), end: new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1).toISOString() }
      })
      const results = await Promise.all(
        months.map(({ m, start, end }) =>
          supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', start).lt('created_at', end).then(({ count }) => ({ month: MONTHS[m.getMonth()], count: count ?? 0 }))
        )
      )
      return results
    },
    enabled: !!orgId,
  })

  const { data: genderData } = useQuery({
    queryKey: ['gender-stats', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from('members').select('gender').eq('organization_id', orgId)
      if (!data) return []
      const male = data.filter(m => m.gender?.toLowerCase() === 'male' || m.gender?.toLowerCase() === 'm').length
      const female = data.filter(m => m.gender?.toLowerCase() === 'female' || m.gender?.toLowerCase() === 'f').length
      if (male === 0 && female === 0) return []
      return [
        { name: 'Male', value: male || (female > 0 ? 0 : 1), color: '#3b82f6' },
        { name: 'Female', value: female || (male > 0 ? 0 : 1), color: '#ec4899' },
      ].filter(e => e.value > 0)
    },
    enabled: !!orgId,
  })

  type AttendanceRow = { id: string; check_in: string | null; members: { first_name: string; last_name: string } }
  type PaymentRow = { id: string; amount: number; payment_date: string; members: { first_name: string; last_name: string } }

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data: checkins } = await supabase.from('attendance').select('id, check_in, members!inner(first_name, last_name)').eq('organization_id', orgId).order('check_in', { ascending: false }).limit(5).returns<AttendanceRow[]>()
      const { data: payments } = await supabase.from('payments').select('id, amount, payment_date, members!inner(first_name, last_name)').eq('organization_id', orgId).order('payment_date', { ascending: false }).limit(5).returns<PaymentRow[]>()
      const feed: { id: string; action: string; member: string; timestamp: string; icon: string }[] = []
      for (const a of checkins ?? []) {
        if (a.check_in) feed.push({ id: `a-${a.id}`, action: 'Check-in', member: `${a.members?.first_name ?? ''} ${a.members?.last_name ?? ''}`.trim(), timestamp: a.check_in, icon: 'log-in' })
      }
      for (const p of payments ?? []) {
        feed.push({ id: `p-${p.id}`, action: 'Payment received', member: `${p.members?.first_name ?? ''} ${p.members?.last_name ?? ''}`.trim(), timestamp: p.payment_date, icon: 'dollar' })
      }
      return feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
    },
    enabled: !!orgId,
  })

  const { data: topCoaches } = useQuery({
    queryKey: ['top-coaches', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data: staffList } = await supabase.from('staff').select('id, first_name, last_name').eq('organization_id', orgId).eq('is_active', true)
      if (!staffList) return []
      const results = await Promise.all(
        staffList.map(s =>
          supabase.from('classes').select('*', { count: 'exact', head: true }).eq('coach_id', s.id).then(({ count }) => ({
            id: s.id, name: `${s.first_name} ${s.last_name}`, classes: count ?? 0, rating: 4.5, specialty: 'Staff',
          }))
        )
      )
      return results.sort((a, b) => b.classes - a.classes).slice(0, 5)
    },
    enabled: !!orgId,
  })

  const { data: turnstileStats } = useQuery({
    queryKey: ['turnstile-dashboard', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data } = await (supabase.rpc as any)('get_turnstile_dashboard', { p_organization_id: orgId })
      return data as { total_terminals: number; online: number; offline: number; fault: number; manual_validations_today: number; manual_validations_total: number } | null
    },
    enabled: !!orgId,
  })

  const pctChange = revenueMonth && revenueMonth.last > 0
    ? Math.round(((revenueMonth.current - revenueMonth.last) / revenueMonth.last) * 100)
    : 0

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['recent-payments'] })
    queryClient.invalidateQueries({ queryKey: ['inactive-members'] })
    queryClient.invalidateQueries({ queryKey: ['revenue-monthly'] })
    queryClient.invalidateQueries({ queryKey: ['revenue-trend'] })
    queryClient.invalidateQueries({ queryKey: ['growth-trend'] })
    queryClient.invalidateQueries({ queryKey: ['gender-stats'] })
    queryClient.invalidateQueries({ queryKey: ['recent-activity'] })
    queryClient.invalidateQueries({ queryKey: ['top-coaches'] })
    queryClient.invalidateQueries({ queryKey: ['turnstile-dashboard'] })
    toast({ title: t('dashboard.refreshed') })
  }, [queryClient, toast])

  const statCards = [
    { title: t('dashboard.totalMembers'), rawValue: stats?.totalMembers ?? 0, icon: Users, change: 0, trend: 'up' as const, format: (v: number) => v.toString() },
    { title: t('dashboard.activeMembers'), rawValue: stats?.activeMembers ?? 0, icon: UserCheck, change: 0, trend: 'up' as const, format: (v: number) => v.toString() },
    { title: t('dashboard.revenue'), rawValue: stats?.revenue ?? 0, icon: DollarSign, change: pctChange, trend: pctChange >= 0 ? 'up' as const : 'down' as const, format: (v: number) => formatCurrency(v) },
    { title: t('dashboard.todayClasses'), rawValue: stats?.todayClasses ?? 0, icon: Calendar, change: 0, trend: 'up' as const, format: (v: number) => v.toString() },
    { title: t('dashboard.presentNow'), rawValue: stats?.presentNow ?? 0, icon: Clock, change: 0, trend: 'up' as const, format: (v: number) => v.toString() },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.overview')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((s) => (
          <StatCard key={s.title} {...s} t={t} loading={statsLoading} />
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
          <CardTitle className="text-lg">{t('dashboard.revenueOverview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.thisMonth')}</p>
              <p className="text-3xl font-bold">{formatCurrency(revenueMonth?.current ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.lastMonth')}</p>
              <p className="text-3xl font-bold text-muted-foreground">{formatCurrency(revenueMonth?.last ?? 0)}</p>
            </div>
            {pctChange !== 0 && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${pctChange > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {pctChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(pctChange)}% {t('dashboard.vsLastMonth')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Turnstile status ──────────────────────────────────── */}
      {turnstileStats && turnstileStats.total_terminals > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('dashboard.turnstileStatus') || 'État du tourniquet'}</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <Wifi className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-2xl font-bold text-success">{turnstileStats.online}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.turnstileOnline') || 'Connecté'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <WifiOff className="h-8 w-8 mx-auto mb-2 text-warning" />
                <p className="text-2xl font-bold text-warning">{turnstileStats.offline}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.turnstileOffline') || 'Hors ligne'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{turnstileStats.fault}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.turnstileFault') || 'En panne'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2" />
                <p className="text-2xl font-bold">{turnstileStats.manual_validations_today}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.manualValidations') || 'Validations manuelles'} ({t('dashboard.today') || 'aujourd\'hui'})</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.revenueTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend ?? []}>
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
            <CardTitle className="text-lg">{t('dashboard.memberGrowth')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTrend ?? []}>
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
            <CardTitle className="text-lg">{t('dashboard.genderDistribution')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData ?? []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {(genderData ?? []).map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-6 mt-2">
              {(genderData ?? []).map((g) => (
                <div key={g.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                  <span>{t(g.name === 'Male' ? 'dashboard.male' : 'dashboard.female')}: <strong>{g.value}</strong></span>
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
              {t('dashboard.expiringThisWeek')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!expiringSubs || expiringSubs.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">{t('dashboard.noExpiringThisWeek')}</p>
            )}
            {expiringSubs?.filter(s => getDaysRemaining(s.end_date) <= 7).slice(0, 5).map((item) => {
              const daysLeft = getDaysRemaining(item.end_date)
              return (
                <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{toUpper(item.member_name)}</p>
                    <p className="text-xs text-muted-foreground">{toUpper(item.type_name)}</p>
                  </div>
                  <Badge variant={daysLeft <= 3 ? 'destructive' : 'outline'} className="text-xs">
                    {daysLeft} {daysLeft > 1 ? t('dashboard.daysLeft') : t('dashboard.dayLeft')}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Top Coaches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              {t('dashboard.topCoaches')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!topCoaches || topCoaches.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">{t('dashboard.noCoaches')}</p>
            )}
            {topCoaches?.map((coach, idx) => (
              <div key={coach.id} className="flex items-center gap-3">
                <span className="w-5 text-sm font-bold text-muted-foreground text-center">{idx + 1}</span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{getInitials(coach.name.split(' ')[0], coach.name.split(' ')[1] ?? '')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{toUpper(coach.name)}</p>
                  <p className="text-xs text-muted-foreground">{toUpper(coach.specialty)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{coach.classes}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.classes')}</p>
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
            {t('dashboard.recentActivity')}
          </CardTitle>
        </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {(!recentActivity || recentActivity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">{t('dashboard.noActivity')}</p>
              )}
              {recentActivity?.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-3 border-b last:border-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    {getActivityIcon(item.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{toUpper(item.action)}</span>
                      {item.member && (
                        <>
                          {' \u2014 '}
                          <span className="text-muted-foreground">{toUpper(item.member)}</span>
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
            <CardTitle className="text-lg">{t('dashboard.expiringSubscriptions')}</CardTitle>
            <Badge variant="destructive">{expiringSubs?.length ?? 0} {t('dashboard.soon')}</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('subscriptions.member')}</TableHead>
                  <TableHead>{t('subscriptions.type')}</TableHead>
                  <TableHead>{t('subscriptions.endDate')}</TableHead>
                  <TableHead>{t('dashboard.daysLeft')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!expiringSubs || expiringSubs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('subscriptions.noExpiring')}</TableCell>
                  </TableRow>
                )}
                {expiringSubs?.map((sub) => {
                  const daysLeft = getDaysRemaining(sub.end_date)
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{toUpper(sub.member_name)}</TableCell>
                      <TableCell>{toUpper(sub.type_name)}</TableCell>
                      <TableCell>{formatDate(sub.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant={daysLeft <= 7 ? 'destructive' : daysLeft <= 14 ? 'outline' : 'secondary'}>{daysLeft}{t('dashboard.daysLeftShort')}</Badge>
                      </TableCell>
                      <TableCell><Badge className={getStatusColor(sub.status)}>{toUpper(sub.status)}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.inactiveMembers')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-bold">{inactiveMembers ?? 0}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.inactiveDescription')}</p>
            <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: t('dashboard.toastRemindersSent'), description: t('dashboard.toastSubscriptionReminders') })}>
              <Send className="mr-2 h-4 w-4" />
              {t('dashboard.sendReminders')}
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: t('dashboard.toastRemindersSent'), description: t('dashboard.toastPaymentReminders') })}>
              <Send className="mr-2 h-4 w-4" />
              {t('dashboard.sendPaymentReminders')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Payments ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.recentPayments')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscriptions.member')}</TableHead>
                <TableHead>{t('payments.amount')}</TableHead>
                <TableHead>{t('payments.date')}</TableHead>
                <TableHead>{t('payments.method')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!recentPayments || recentPayments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('dashboard.noRecentPayments')}</TableCell>
                </TableRow>
              )}
              {recentPayments?.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{toUpper(`${payment.members?.first_name ?? ''} ${payment.members?.last_name ?? ''}`)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{formatDate(payment.payment_date)}</TableCell>
                  <TableCell className="capitalize">{toUpper(payment.payment_method)}</TableCell>
                  <TableCell><Badge className={getStatusColor(payment.status)}>{toUpper(payment.status)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
