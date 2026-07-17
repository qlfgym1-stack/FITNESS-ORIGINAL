import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useRealtime } from '@/hooks/useRealtime'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users, UserCheck, DollarSign, CalendarDays, TrendingUp, Percent,
  Database, FileText, Activity, UserCog, Heart, BarChart3,
  RefreshCw, UserPlus, CreditCard, Wallet, Target, Loader2,
} from 'lucide-react'
import { formatCurrency, toUpper } from '@/lib/utils'

interface DashboardData {
  total_members: number
  active_members: number
  today_checkins: number
  monthly_revenue: number
  present_now: number
  revenue_today: number
  best_day_revenue: number
  best_day_name: string
  system_users: number
  products_count: number
  coaches_count: number
  employees_total: number
  employees_active: number
  monthly_profit: number
  monthly_revenue_total: number
  monthly_cogs: number
}

export default function Dashboard() {
  const t = useT()
  const nav = useNavigate()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  useRealtime({ table: "attendance", queryKey: ["dash", orgId ?? ""], filter: orgId ? `organization_id=eq.${orgId}` : undefined })
  useRealtime({ table: "members", queryKey: ["dash", orgId ?? ""], filter: orgId ? `organization_id=eq.${orgId}` : undefined })
  useRealtime({ table: "payments", queryKey: ["dash", orgId ?? ""], filter: orgId ? `organization_id=eq.${orgId}` : undefined })

  const { data: agg, isLoading: aggLoading } = useQuery({
    queryKey: ['dash_agg', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data, error } = await (supabase.rpc as any)('get_dashboard_stats', { p_organization_id: orgId })
      if (error) throw error
      return data as {
        total_members: number; active_members: number;
        today_checkins: number; monthly_revenue: number;
      } | null
    },
    enabled: !!orgId,
  })

  const { data: extra, isLoading: extraLoading } = useQuery({
    queryKey: ['dash_extra', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      const [
        { count: presentNow },
        { count: revenueToday },
        { data: bestDayData },
        { count: systemUsers },
        { count: productsCount },
        { count: coachesCount },
        { count: employeesTotal },
        { count: employeesActive },
        { data: monthTransactions },
        { data: monthPayments },
        { data: productsWithCost },
      ] = await Promise.all([
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('check_in', today).is('check_out', null),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'completed').gte('payment_date', today),
        supabase.from('payments').select('payment_date, amount').eq('organization_id', orgId).eq('status', 'completed').gte('payment_date', monthStartStr).order('amount', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'coach'),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
        supabase.from('pos_transactions').select('total, items').eq('organization_id', orgId).eq('payment_status', 'completed').gte('created_at', monthStartStr),
        supabase.from('payments').select('amount').eq('organization_id', orgId).eq('status', 'completed').gte('payment_date', monthStartStr),
        supabase.from('products').select('id, cost').eq('organization_id', orgId),
      ])

      let bestDayRevenue = 0
      let bestDayName = '-'
      if (bestDayData) {
        bestDayRevenue = bestDayData.amount
        const d = new Date(bestDayData.payment_date)
        bestDayName = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      }

      // Calculate profit: (POS revenue + subscription payments) - (COGS)
      const costMap = new Map((productsWithCost ?? []).map((p: any) => [p.id, p.cost ?? 0]))
      let totalCogs = 0
      for (const tx of (monthTransactions ?? []) as any[]) {
        for (const item of (tx.items ?? []) as any[]) {
          if (typeof item.id === 'string' && item.id.startsWith('__subscription__')) continue
          const qty = item.quantity ?? 1
          const unitCost = costMap.get(item.id) ?? 0
          totalCogs += qty * unitCost
        }
      }
      const posRevenue = (monthTransactions ?? []).reduce((sum: number, tx: any) => sum + (Number(tx.total) || 0), 0)
      const subRevenue = (monthPayments ?? []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
      const totalRevenue = posRevenue + subRevenue
      const profit = totalRevenue - totalCogs

      return {
        present_now: presentNow ?? 0,
        revenue_today: revenueToday ?? 0,
        best_day_revenue: bestDayRevenue,
        best_day_name: bestDayName,
        system_users: systemUsers ?? 0,
        products_count: productsCount ?? 0,
        coaches_count: coachesCount ?? 0,
        employees_total: employeesTotal ?? 0,
        employees_active: employeesActive ?? 0,
        monthly_profit: Math.max(profit, 0),
        monthly_revenue_total: totalRevenue,
        monthly_cogs: totalCogs,
      }
    },
    enabled: !!orgId,
  })

  const loading = aggLoading || extraLoading

  const dash: DashboardData = useMemo(() => ({
    total_members: agg?.total_members ?? 0,
    active_members: agg?.active_members ?? 0,
    today_checkins: agg?.today_checkins ?? 0,
    monthly_revenue: agg?.monthly_revenue ?? 0,
    present_now: extra?.present_now ?? 0,
    revenue_today: extra?.revenue_today ?? 0,
    best_day_revenue: extra?.best_day_revenue ?? 0,
    best_day_name: extra?.best_day_name ?? '-',
    system_users: extra?.system_users ?? 0,
    products_count: extra?.products_count ?? 0,
    coaches_count: extra?.coaches_count ?? 0,
    employees_total: extra?.employees_total ?? 0,
    employees_active: extra?.employees_active ?? 0,
    monthly_profit: extra?.monthly_profit ?? 0,
    monthly_revenue_total: extra?.monthly_revenue_total ?? 0,
    monthly_cogs: extra?.monthly_cogs ?? 0,
  }), [agg, extra])

  const occupancyRate = dash.active_members > 0
    ? Math.round((dash.today_checkins / dash.active_members) * 100)
    : 0

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['dash_agg'] })
    queryClient.invalidateQueries({ queryKey: ['dash_extra'] })
    toast({ title: t('dashboard.refreshed') || 'Données actualisées' })
  }

  function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color?: string }) {
    return (
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-start gap-3">
          <div className={`rounded-lg p-2.5 shrink-0 ${color ? '' : 'bg-primary/10'}`} style={color ? { backgroundColor: `${color}15` } : undefined}>
            <Icon className="h-5 w-5" style={color ? { color } : undefined} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TABLEAU DE BORD</h1>
          <p className="text-sm text-muted-foreground mt-1">APERÇU DES PERFORMANCES DE VOTRE SALLE</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('dashboard.refresh') || 'Actualiser'}
        </Button>
      </div>

      {/* Row 1 – Core KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Indicateurs clés</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            icon={UserCheck}
            label="Adhérents Actifs"
            value={dash.active_members}
            sub={`${dash.total_members} total`}
            color="#10b981"
          />
          <KpiCard
            icon={CalendarDays}
            label="Check-ins Aujourd'hui"
            value={dash.today_checkins}
            color="#3b82f6"
          />
          <KpiCard
            icon={Users}
            label="Présents en Salle"
            value={dash.present_now}
            color="#8b5cf6"
          />
          <KpiCard
            icon={DollarSign}
            label="Revenus Aujourd'hui"
            value={`${dash.revenue_today.toLocaleString()} DA`}
            color="#f59e0b"
          />
          <KpiCard
            icon={Percent}
            label="Taux d'Occupation"
            value={`${occupancyRate}%`}
            color="#ef4444"
          />
          <KpiCard
            icon={Wallet}
            label="Revenus du Mois"
            value={formatCurrency(dash.monthly_revenue)}
            color="#06b6d4"
          />
        </div>
      </div>

      {/* Row 2 – Secondary KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Analytiques</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            icon={TrendingUp}
            label="Bénéfices"
            value={formatCurrency(dash.monthly_profit)}
            sub={`${formatCurrency(dash.monthly_revenue_total)} - ${formatCurrency(dash.monthly_cogs)}`}
            color="#10b981"
          />
          <KpiCard
            icon={Target}
            label="Meilleur Jour"
            value={dash.best_day_name}
            sub={dash.best_day_revenue > 0 ? `${dash.best_day_revenue.toLocaleString()} DA` : '-'}
            color="#8b5cf6"
          />
          <KpiCard
            icon={UserCog}
            label="Utilisateurs Système"
            value={dash.system_users}
            color="#3b82f6"
          />
          <KpiCard
            icon={Database}
            label="Produits"
            value={dash.products_count}
            color="#f59e0b"
          />
          <KpiCard
            icon={Users}
            label="Coachs"
            value={dash.coaches_count}
            color="#06b6d4"
          />
        </div>
      </div>

      {/* Row 3 – Employees */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={UserCog}
          label="Employés"
          value={dash.employees_total}
          sub={`${dash.employees_active} actifs`}
          color="#ec4899"
        />
      </div>

      {/* Accès Rapide */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accès Rapide</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Database, label: 'Base de données', path: '/admin/database', color: '#3b82f6' },
            { icon: FileText, label: 'Journal Audit', path: '/admin/audit', color: '#8b5cf6' },
            { icon: Activity, label: 'Monitoring', path: '/admin/monitoring', color: '#10b981' },
            { icon: UserCog, label: 'Personnel', path: '/staff', color: '#f59e0b' },
            { icon: Heart, label: 'Fidélité', path: '/badges', color: '#ec4899' },
            { icon: BarChart3, label: 'Analyses', path: '/reports', color: '#06b6d4' },
          ].map((item) => (
            <Card
              key={item.label}
              className="cursor-pointer hover:bg-accent/50 transition-colors border border-border/50 shadow-sm"
              onClick={() => nav(item.path)}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 gap-2">
                <div className="rounded-full p-3" style={{ backgroundColor: `${item.color}15` }}>
                  <item.icon className="h-5 w-5" style={{ color: item.color }} />
                </div>
                <span className="font-medium text-sm text-center">{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('dashboard.quickActions') || 'Actions rapides'}</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[
            { icon: UserPlus, label: t('dashboard.addMember') || 'Ajouter membre', desc: t('dashboard.addMemberDesc') || 'Nouveau membre', path: '/members' },
            { icon: CreditCard, label: t('dashboard.newSubscription') || 'Nouvel abonnement', desc: t('dashboard.newSubscriptionDesc') || 'Créer un abonnement', path: '/subscriptions' },
            { icon: DollarSign, label: t('dashboard.recordPayment') || 'Enregistrer paiement', desc: t('dashboard.recordPaymentDesc') || 'Nouveau paiement', path: '/payments' },
            { icon: Wallet, label: 'Caisse POS', desc: 'Point de vente', path: '/pos' },
          ].map((item) => (
            <Card key={item.label} className="cursor-pointer hover:bg-accent/50 transition-colors border border-border/50 shadow-sm" onClick={() => nav(item.path)}>
              <CardContent className="flex flex-col items-center justify-center p-5 gap-2">
                <div className="rounded-full bg-primary/10 p-3">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium text-sm text-center">{item.label}</span>
                <span className="text-xs text-muted-foreground text-center">{item.desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
