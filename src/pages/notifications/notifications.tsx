import { useState, useMemo, useEffect } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { useSupabase } from "@/hooks/useSupabase"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { formatDate, displayPhone } from "@/lib/utils"
import { IS_MOCK } from "@/lib/config"
import type { Notification, Json } from "@/types/supabase"
import {
  Bell, CheckCheck, MailOpen, Trash2, AlertTriangle, CreditCard, UserCheck, CalendarOff, Settings, Info,
  MessageCircle, Settings2, Send, RefreshCw, CalendarClock, CalendarX, Loader2,
} from "lucide-react"

const typeIcons: Record<string, React.ElementType> = {
  subscription_expiring: AlertTriangle,
  payment_overdue: CreditCard,
  member_checkin: UserCheck,
  staff_leave: CalendarOff,
  system: Settings,
  info: Info,
  warning: AlertTriangle,
  success: CheckCheck,
  error: Trash2,
}

type FilterType = "all" | "unread"
type TopTab = "notifications" | "renewals" | "expired"
type WaTemplateKey = "renewal" | "expired"

interface SubWithRelations {
  id: string
  member_id: string
  end_date: string
  status: "active" | "expired" | "cancelled" | "pending_payment"
  members: { first_name: string; last_name: string; phone: string | null } | null
  subscription_types: { name: string } | null
}

interface WaTarget {
  member_id: string
  name: string
  phone: string
  date: string
  kind: "renewal" | "expired"
}

const DEFAULT_DELAYS = [30, 15, 7, 3, 1, 0]

const DEFAULT_TEMPLATES: Record<WaTemplateKey, string> = {
  renewal: "Bonjour {NOM}, votre abonnement expirera le {DATE} à {NOM_SALLE}.",
  expired: "Bonjour {NOM}, votre abonnement est expiré depuis le {DATE}. Rejoignez-nous à {NOM_SALLE}.",
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysUntil(endDate: string): number {
  const today = toDateStr(new Date())
  const [fy, fm, fd] = today.split("-").map(Number)
  const [ty, tm, td] = endDate.split("-").map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

function formatWaDate(dateStr: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(dateStr))
}

export default function NotificationsPage() {
  const t = useT()
  const { toast } = useToast()
  const { user, roles, organization } = useAuth()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterType>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [topTab, setTopTab] = useState<TopTab>("notifications")

  const orgId = organization?.id
  const isAdmin = roles?.some((r) => r.role === "admin")

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", "all", user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  })

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.is_read && n.user_id === user?.id)
      if (unread.length === 0) return
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unread.map((n) => n.id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      toast({ title: t("notifications.allRead") })
    },
  })

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  )

  const filtered = useMemo(() => {
    let result = notifications
    if (filter === "unread") result = result.filter((n) => !n.is_read)
    if (typeFilter !== "all") result = result.filter((n) => n.type === typeFilter)
    return result
  }, [notifications, filter, typeFilter])

  const { data: delaysSetting } = useQuery({
    queryKey: ["settings", "alert_delays", orgId],
    queryFn: async () => {
      if (!orgId || IS_MOCK) return null
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("organization_id", orgId)
        .eq("key", "alert_delays")
        .maybeSingle()
      return (data?.value ?? null) as number[] | null
    },
    enabled: !!orgId && !IS_MOCK,
  })

  const delays = useMemo(() => {
    const v = delaysSetting
    return Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === "number" && !isNaN(n))
      ? v
      : DEFAULT_DELAYS
  }, [delaysSetting])
  const maxDelay = Math.max(...delays)

  const { data: templatesSetting } = useQuery({
    queryKey: ["settings", "whatsapp_templates", orgId],
    queryFn: async () => {
      if (!orgId || IS_MOCK) return null
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("organization_id", orgId)
        .eq("key", "whatsapp_templates")
        .maybeSingle()
      return (data?.value ?? null) as Partial<Record<WaTemplateKey, string>> | null
    },
    enabled: !!orgId && !IS_MOCK,
  })

  const templates = useMemo<Record<WaTemplateKey, string>>(
    () => ({
      renewal: templatesSetting?.renewal || DEFAULT_TEMPLATES.renewal,
      expired: templatesSetting?.expired || DEFAULT_TEMPLATES.expired,
    }),
    [templatesSetting],
  )

  const { data: renewals = [], isLoading: renewalsLoading } = useQuery({
    queryKey: ["subscription-renewals", orgId, maxDelay],
    queryFn: async () => {
      if (!orgId || IS_MOCK) return []
      const todayStr = toDateStr(new Date())
      const maxDate = new Date()
      maxDate.setDate(maxDate.getDate() + maxDelay)
      const maxDateStr = toDateStr(maxDate)
      const { data, error } = await supabase
        .from("member_subscriptions")
        .select("*, members(first_name,last_name,phone), subscription_types(name)")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .gte("end_date", todayStr)
        .lte("end_date", maxDateStr)
        .order("end_date", { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as SubWithRelations[]
    },
    enabled: !!orgId && !IS_MOCK,
    refetchInterval: 30000,
  })

  const { data: expiredRaw = [], isLoading: expiredLoading } = useQuery({
    queryKey: ["subscription-expired", orgId],
    queryFn: async () => {
      if (!orgId || IS_MOCK) return []
      const todayStr = toDateStr(new Date())
      const { data, error } = await supabase
        .from("member_subscriptions")
        .select("*, members(first_name,last_name,phone), subscription_types(name)")
        .eq("organization_id", orgId)
        .or(`status.eq.expired,end_date.lt.${todayStr}`)
        .order("end_date", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as SubWithRelations[]
    },
    enabled: !!orgId && !IS_MOCK,
    refetchInterval: 30000,
  })

  const expired = useMemo(() => {
    const map = new Map<string, SubWithRelations>()
    for (const s of expiredRaw) {
      if (!s.member_id) continue
      const cur = map.get(s.member_id)
      if (!cur || new Date(s.end_date).getTime() > new Date(cur.end_date).getTime()) map.set(s.member_id, s)
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime(),
    )
  }, [expiredRaw])

  const [delaysInput, setDelaysInput] = useState(DEFAULT_DELAYS.join(", "))

  useEffect(() => {
    setDelaysInput(delays.join(", "))
  }, [delays])

  const saveDelays = useMutation({
    mutationFn: async (raw: string) => {
      if (!orgId) throw new Error("No organization")
      const parsed = raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
      if (parsed.length === 0) throw new Error("Invalid delays")
      const { error } = await supabase
        .from("settings")
        .upsert({ organization_id: orgId, key: "alert_delays", value: parsed }, { onConflict: "organization_id,key" })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "alert_delays"] })
      toast({ title: t("notifications.delaysSaved") || "Délais enregistrés" })
    },
    onError: () => {
      toast({ title: t("notifications.delaysError") || "Erreur d'enregistrement", variant: "destructive" })
    },
  })

  const generateAlerts = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No organization")
      const { data, error } = await (supabase.rpc as any)("generate_expiring_notifications", { p_delays: delays })
      if (error) throw error
      return data as { created: number }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      toast({
        title: t("notifications.alertsGenerated") || "Alertes générées",
        description: `${data?.created ?? 0} ${t("notifications.alertsCreated") || "alertes créées"}`,
      })
    },
    onError: () => {
      toast({ title: t("notifications.alertsError") || "Erreur de génération", variant: "destructive" })
    },
  })

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [renewalTpl, setRenewalTpl] = useState(DEFAULT_TEMPLATES.renewal)
  const [expiredTpl, setExpiredTpl] = useState(DEFAULT_TEMPLATES.expired)

  useEffect(() => {
    if (templateDialogOpen) {
      setRenewalTpl(templates.renewal)
      setExpiredTpl(templates.expired)
    }
  }, [templateDialogOpen, templates])

  const saveTemplates = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No organization")
      const value = { renewal: renewalTpl, expired: expiredTpl }
      const { error } = await supabase
        .from("settings")
        .upsert({ organization_id: orgId, key: "whatsapp_templates", value }, { onConflict: "organization_id,key" })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "whatsapp_templates"] })
      setTemplateDialogOpen(false)
      toast({ title: t("notifications.templatesSaved") || "Modèles enregistrés" })
    },
    onError: () => {
      toast({ title: t("notifications.templatesError") || "Erreur d'enregistrement", variant: "destructive" })
    },
  })

  const [waTarget, setWaTarget] = useState<WaTarget | null>(null)
  const [waKey, setWaKey] = useState<WaTemplateKey>("renewal")

  function openWhatsApp(target: WaTarget) {
    setWaKey(target.kind)
    setWaTarget(target)
  }

  function renderWaMessage(name: string, date: string, key: WaTemplateKey): string {
    const tpl = key === "renewal" ? templates.renewal : templates.expired
    const salle = organization?.name || "notre salle"
    return tpl
      .replace(/\{NOM\}/g, name)
      .replace(/\{DATE\}/g, formatWaDate(date))
      .replace(/\{NOM_SALLE\}/g, salle)
  }

  const sendWhatsApp = useMutation({
    mutationFn: async () => {
      if (!waTarget) throw new Error("No target")
      const message = renderWaMessage(waTarget.name, waTarget.date, waKey)
      const digits = waTarget.phone.replace(/\D/g, "")
      if (!digits) throw new Error("Invalid phone")
      window.open("https://wa.me/" + digits + "?text=" + encodeURIComponent(message), "_blank")
      const { error } = await (supabase.rpc as any)("log_whatsapp_message", {
        p_member_id: waTarget.member_id,
        p_member_name: waTarget.name,
        p_phone: waTarget.phone,
        p_template_key: waKey,
        p_message: message,
        p_status: "sent_via_link",
      })
      if (error) throw error
    },
    onSuccess: () => {
      setWaTarget(null)
      toast({ title: t("notifications.waSent") || "Message envoyé" })
    },
    onError: () => {
      toast({ title: t("notifications.waError") || "Erreur d'envoi", variant: "destructive" })
    },
  })

  function renderRow(sub: SubWithRelations, isExpired: boolean) {
    const member = sub.members
    const name = member ? `${member.first_name} ${member.last_name}` : "-"
    const phone = member?.phone ?? null
    const subName = sub.subscription_types?.name ?? "-"
    const daysLeft = Math.max(0, daysUntil(sub.end_date))
    return (
      <Card key={sub.id}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`mt-1 rounded-full p-2 ${isExpired ? "bg-destructive/10" : "bg-warning/10"}`}>
              {isExpired
                ? <CalendarX className={`h-4 w-4 ${isExpired ? "text-destructive" : "text-warning"}`} />
                : <CalendarClock className="h-4 w-4 text-warning" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{name}</p>
                {!isExpired && (
                  <Badge variant={daysLeft === 0 ? "destructive" : "default"}>{daysLeft} j</Badge>
                )}
                {isExpired && <Badge variant="destructive">{t("notifications.expiredBadge") || "Expiré"}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{subName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("notifications.expires") || "Expire le"} : {formatDate(sub.end_date)} · {phone ? displayPhone(phone) : "-"}
              </p>
            </div>
            {isAdmin && phone && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => openWhatsApp({ member_id: sub.member_id, name, phone, date: sub.end_date, kind: isExpired ? "expired" : "renewal" })}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="mr-2 h-4 w-4" /> {t("notifications.markAllRead")}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
        <TabsList>
          <TabsTrigger value="notifications">{t("notifications.title")}</TabsTrigger>
          <TabsTrigger value="renewals">{t("notifications.renewals") || "Renouvellements"}</TabsTrigger>
          <TabsTrigger value="expired">{t("notifications.expired") || "Expirés"}</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <span className="text-lg font-semibold">{t("notifications.title")}</span>
              {unreadCount > 0 && (
                <Badge variant="default">{unreadCount} {t("notifications.unread")}</Badge>
              )}
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <TabsList>
                <TabsTrigger value="all">{t("notifications.all")}</TabsTrigger>
                <TabsTrigger value="unread">{t("notifications.unreadOnly")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">{t("notifications.allTypes")}</option>
              <option value="subscription_expiring">{t("notifications.subscriptionExpiring")}</option>
              <option value="payment_overdue">{t("notifications.paymentOverdue")}</option>
              <option value="member_checkin">{t("notifications.memberCheckin")}</option>
              <option value="staff_leave">{t("notifications.staffLeave")}</option>
              <option value="system">{t("notifications.system")}</option>
            </select>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => {
                const Icon = typeIcons[n.type] || Bell
                return (
                  <Card
                    key={n.id}
                    className={`transition-colors ${!n.is_read ? "border-primary/50 bg-primary/5" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 rounded-full p-2 ${
                          n.type === "payment_overdue" ? "bg-warning/10" :
                          n.type === "subscription_expiring" ? "bg-warning/10" :
                          n.type === "member_checkin" ? "bg-success/10" :
                          n.type === "staff_leave" ? "bg-muted" : "bg-muted"
                        }`}>
                          <Icon className={`h-4 w-4 ${
                            n.type === "payment_overdue" ? "text-warning" :
                            n.type === "subscription_expiring" ? "text-warning" :
                            n.type === "member_checkin" ? "text-success" :
                            n.type === "staff_leave" ? "text-muted-foreground" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {n.title}
                            </p>
                            {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(n.created_at)}</p>
                        </div>
                        <div className="flex gap-1">
                          {!n.is_read && n.user_id === user?.id && (
                            <Button variant="ghost" size="icon" onClick={() => markAsRead.mutate(n.id)}>
                              <MailOpen className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>{t("notifications.empty")}</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="renewals">
          <div className="space-y-4">
            {isAdmin && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    <span className="font-medium">{t("notifications.delaysTitle") || "Délais d'alerte"}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={delaysInput}
                      onChange={(e) => setDelaysInput(e.target.value)}
                      className="max-w-xs"
                      placeholder="30, 15, 7, 3, 1, 0"
                    />
                    <Button onClick={() => saveDelays.mutate(delaysInput)} disabled={saveDelays.isPending}>
                      {saveDelays.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("notifications.save") || "Enregistrer"}
                    </Button>
                    <Button onClick={() => generateAlerts.mutate()} disabled={generateAlerts.isPending}>
                      {generateAlerts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("notifications.generateAlerts") || "Générer les alertes"}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setTemplateDialogOpen(true)}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{t("notifications.expiringSoon") || "Abonnements expirant bientôt"}</h3>
            </div>
            {renewalsLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
            ) : renewals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>{t("notifications.noRenewals") || "Aucun abonnement à renouveler"}</p>
              </div>
            ) : (
              <div className="space-y-2">{renewals.map((s) => renderRow(s, false))}</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expired">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarX className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{t("notifications.expiredSubs") || "Abonnements expirés"}</h3>
            </div>
            {expiredLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
            ) : expired.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarX className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>{t("notifications.noExpired") || "Aucun abonnement expiré"}</p>
              </div>
            ) : (
              <div className="space-y-2">{expired.map((s) => renderRow(s, true))}</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notifications.waTemplates") || "Modèles WhatsApp"}</DialogTitle>
            <DialogDescription>
              {t("notifications.waTemplatesDesc") || "Personnalisez les messages envoyés aux membres. Variables : {NOM}, {DATE}, {NOM_SALLE}."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("notifications.waRenewal") || "Renouvellement"}</Label>
              <Textarea value={renewalTpl} onChange={(e) => setRenewalTpl(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("notifications.waExpired") || "Expiré"}</Label>
              <Textarea value={expiredTpl} onChange={(e) => setExpiredTpl(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              {t("notifications.cancel") || "Annuler"}
            </Button>
            <Button onClick={() => saveTemplates.mutate()} disabled={saveTemplates.isPending}>
              {saveTemplates.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("notifications.save") || "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!waTarget} onOpenChange={(o) => { if (!o) setWaTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notifications.waPreview") || "Envoyer sur WhatsApp"}</DialogTitle>
            <DialogDescription>
              {waTarget ? `${waTarget.name} · ${displayPhone(waTarget.phone)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {waTarget && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("notifications.waTemplate") || "Modèle"}</Label>
                <Select value={waKey} onValueChange={(v) => setWaKey(v as WaTemplateKey)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="renewal">{t("notifications.waRenewal") || "Renouvellement"}</SelectItem>
                    <SelectItem value="expired">{t("notifications.waExpired") || "Expiré"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Card className="bg-muted">
                <CardContent className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{renderWaMessage(waTarget.name, waTarget.date, waKey)}</p>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaTarget(null)}>
              {t("notifications.cancel") || "Annuler"}
            </Button>
            <Button onClick={() => sendWhatsApp.mutate()} disabled={sendWhatsApp.isPending}>
              {sendWhatsApp.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {t("notifications.send") || "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
