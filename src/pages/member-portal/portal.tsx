import { useQuery } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/pagination"
import { useT } from "@/i18n"
import { formatDate, formatCurrency, getInitials, getStatusColor, getDaysRemaining } from "@/lib/utils"
import { User, CreditCard, CalendarCheck, DollarSign, Calendar, Clock, Loader2, Download } from "lucide-react"

export default function PortalPage() {
  const t = useT()
  const supabase = useSupabase()
  const { user } = useAuth()

  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ["portal-member", user?.id],
    queryFn: async () => {
      if (!user?.email) return null
      const { data } = await supabase
        .from("members")
        .select("*")
        .eq("email", user.email)
        .maybeSingle()
      return data as { id: string; first_name: string; last_name: string; email: string; phone: string | null; photo_url: string | null; status: string } | null
    },
    enabled: !!user?.email,
  })

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["portal-subs", member?.id],
    queryFn: async () => {
      if (!member?.id) return []
      const { data } = await supabase
        .from("member_subscriptions")
        .select("*, subscription_types!inner(name)")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
      return (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.subscription_types?.name ?? "",
        start_date: s.start_date,
        end_date: s.end_date,
        status: s.status,
        total_amount: s.total_amount,
        amount_paid: s.amount_paid,
      }))
    },
    enabled: !!member?.id,
  })

  const { data: attendance = [] } = useQuery({
    queryKey: ["portal-attendance", member?.id],
    queryFn: async () => {
      if (!member?.id) return []
      const { data } = await supabase
        .from("attendance")
        .select("id, check_in, type, class:classes(name)")
        .eq("member_id", member.id)
        .order("check_in", { ascending: false })
        .limit(10)
      return (data ?? []).map((a: any) => ({
        id: a.id,
        date: a.check_in?.slice(0, 10) ?? "",
        type: a.type,
        time: a.check_in ? new Date(a.check_in).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        class_name: a.class?.name,
      }))
    },
    enabled: !!member?.id,
  })

  const { data: payments = [] } = useQuery({
    queryKey: ["portal-payments", member?.id],
    queryFn: async () => {
      if (!member?.id) return []
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", member.id)
        .order("payment_date", { ascending: false })
        .limit(10)
      return (data ?? []).map((p: any) => ({
        id: p.id,
        date: p.payment_date,
        amount: p.amount,
        method: p.payment_method,
        status: p.status,
        description: p.description ?? "",
      }))
    },
    enabled: !!member?.id,
  })

  const { page: subPage, setPage: setSubPage, totalPages: subTotalPages, paginatedData: paginatedSubscriptions } = usePagination(subscriptions, 10)
  const { page: attPage, setPage: setAttPage, totalPages: attTotalPages, paginatedData: paginatedAttendance } = usePagination(attendance, 10)
  const { page: payPage, setPage: setPayPage, totalPages: payTotalPages, paginatedData: paginatedPayments } = usePagination(payments, 10)

  const { exportCsv: exportSubscriptions } = useExportCsv(
    subscriptions.map(s => ({ name: s.name, start_date: s.start_date, end_date: s.end_date, status: s.status, total_amount: s.total_amount, amount_paid: s.amount_paid })),
    'subscriptions',
    [
      { key: 'name', label: t('portal.subscription') || 'Subscription' },
      { key: 'start_date', label: t('portal.startDate') || 'Start' },
      { key: 'end_date', label: t('portal.endDate') || 'End' },
      { key: 'status', label: t('common.status') || 'Status' },
      { key: 'total_amount', label: t('portal.totalAmount') || 'Total' },
      { key: 'amount_paid', label: t('portal.paid') || 'Paid' },
    ]
  )

  const { exportCsv: exportAttendance } = useExportCsv(
    attendance.map(a => ({ date: a.date, type: a.type, time: a.time, class_name: a.class_name ?? '' })),
    'attendance',
    [
      { key: 'date', label: t('common.date') || 'Date' },
      { key: 'type', label: t('common.type') || 'Type' },
      { key: 'time', label: t('common.time') || 'Time' },
      { key: 'class_name', label: t('portal.className') || 'Class' },
    ]
  )

  const { exportCsv: exportPayments } = useExportCsv(
    payments.map(p => ({ date: p.date, amount: p.amount, method: p.method, status: p.status, description: p.description })),
    'payments',
    [
      { key: 'date', label: t('common.date') || 'Date' },
      { key: 'amount', label: t('portal.amount') || 'Amount' },
      { key: 'method', label: t('portal.method') || 'Method' },
      { key: 'status', label: t('common.status') || 'Status' },
      { key: 'description', label: t('portal.description') || 'Description' },
    ]
  )

  if (memberLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!member) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 text-center">
        <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">{t("portal.noMember") || "Aucun profil membre"}</h2>
        <p className="text-muted-foreground mt-2">{t("portal.noMemberDesc") || "Connectez-vous avec l'email utilisé lors de votre inscription."}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-6 mb-8 p-6 rounded-lg border bg-card">
        <Avatar className="h-20 w-20">
          {member.photo_url ? <AvatarImage src={member.photo_url} /> : null}
          <AvatarFallback className="text-2xl">{getInitials(member.first_name, member.last_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{member.first_name} {member.last_name}</h1>
          <p className="text-muted-foreground">{member.email} &middot; {member.phone ?? "—"}</p>
          {member.member_number && <p className="text-xs text-muted-foreground mt-1">N° Adhérent: {member.member_number}</p>}
        </div>
        <Badge variant="default" className="text-sm">{t("portal.activeMember")}</Badge>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList className="mb-6">
          <TabsTrigger value="subscriptions"><CreditCard className="mr-2 h-4 w-4" /> {t("portal.subscriptions")}</TabsTrigger>
          <TabsTrigger value="attendance"><CalendarCheck className="mr-2 h-4 w-4" /> {t("portal.attendance")}</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="mr-2 h-4 w-4" /> {t("portal.payments")}</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportSubscriptions()}>
              <Download className="mr-2 h-4 w-4" /> {t("common.export") || "Export"}
            </Button>
          </div>
          {subscriptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("common.noData")}</p>
          ) : paginatedSubscriptions.map((s) => {
            const remaining = getDaysRemaining(s.end_date)
            return (
              <Card key={s.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{s.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{formatDate(s.start_date)} - {formatDate(s.end_date)}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(s.status)}>{s.status}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{remaining > 0 ? `${remaining} ${t("portal.daysLeft")}` : t("portal.expired")}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("portal.totalAmount")}</span>
                    <span className="font-mono font-medium">{formatCurrency(s.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{t("portal.paid")}</span>
                    <span className="font-mono font-medium">{formatCurrency(s.amount_paid)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          <Pagination page={subPage} totalPages={subTotalPages} totalItems={subscriptions.length} pageSize={10} onPageChange={setSubPage} />
        </TabsContent>

        <TabsContent value="attendance">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => exportAttendance()}>
              <Download className="mr-2 h-4 w-4" /> {t("common.export") || "Export"}
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle>{t("portal.recentAttendance")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendance.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">{t("common.noData")}</p>
                ) : paginatedAttendance.map((a) => (
                  <div key={a.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {a.type === "class" ? <Calendar className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{a.type === "class" ? a.class_name : t("portal.checkIn")}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(a.date)}</p>
                    </div>
                    <Badge variant="outline">{a.time}</Badge>
                  </div>
                ))}
              </div>
              <Pagination page={attPage} totalPages={attTotalPages} totalItems={attendance.length} pageSize={10} onPageChange={setAttPage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => exportPayments()}>
              <Download className="mr-2 h-4 w-4" /> {t("common.export") || "Export"}
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle>{t("portal.paymentHistory")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">{t("common.noData")}</p>
                ) : paginatedPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{p.description || t("portal.payment")}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(p.date)} &middot; {p.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">{formatCurrency(p.amount)}</p>
                      <Badge className={getStatusColor(p.status)} variant="secondary">{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={payPage} totalPages={payTotalPages} totalItems={payments.length} pageSize={10} onPageChange={setPayPage} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
