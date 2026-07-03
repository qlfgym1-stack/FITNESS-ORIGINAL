import { useQuery } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, UserCheck, DollarSign, Calendar, Clock, TrendingUp, TrendingDown, ArrowUpRight, Send } from 'lucide-react'
import { formatCurrency, formatDate, getDaysRemaining, getStatusColor } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { MemberSubscription, Payment } from '@/types/supabase'

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

interface ExpiringSubscription extends MemberSubscription {
  member_name?: string
  type_name?: string
}

export default function Dashboard() {
  const t = useT()
  const supabase = useSupabase()
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

  const statCards = [
    { title: 'Total Members', value: stats?.totalMembers ?? 0, icon: Users, change: 12, trend: 'up' as const },
    { title: 'Active Members', value: stats?.activeMembers ?? 0, icon: UserCheck, change: 8, trend: 'up' as const },
    { title: 'Revenue This Month', value: formatCurrency(stats?.revenue ?? 0), icon: DollarSign, change: 5, trend: 'up' as const },
    { title: "Today's Classes", value: stats?.todayClasses ?? 0, icon: Calendar, change: 0, trend: 'up' as const },
    { title: 'Present Now', value: stats?.presentNow ?? 0, icon: Clock, change: -3, trend: 'down' as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your gym's performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.change !== 0 && (
                <p className={`mt-1 flex items-center text-xs ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.trend === 'up' ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                  {Math.abs(stat.change)}% from last month
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs text-muted-foreground" />
                  <YAxis className="text-xs text-muted-foreground" />
                  <Tooltip />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
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
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

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
                {expiringSubs?.length === 0 && (
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
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: 'Reminders sent', description: 'Subscription reminders have been sent.' })}>
              <Send className="mr-2 h-4 w-4" />
              Send Subscription Reminders
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: 'Reminders sent', description: 'Payment reminders have been sent.' })}>
              <Send className="mr-2 h-4 w-4" />
              Send Payment Reminders
            </Button>
            <div className="pt-4">
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">Inactive Members</h4>
              <p className="text-2xl font-bold">{inactiveMembers ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
              {recentPayments?.length === 0 && (
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
