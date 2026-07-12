import { useState, useMemo } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { useSupabase } from "@/hooks/useSupabase"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDateTime } from "@/lib/utils"
import {
  Bell, CheckCheck, MailOpen, Trash2, AlertTriangle, CreditCard, UserCheck, CalendarOff, Settings, Info,
} from "lucide-react"
import type { Notification } from "@/types/supabase"

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

export default function NotificationsPage() {
  const t = useT()
  const { toast } = useToast()
  const { user } = useAuth()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterType>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

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
                      <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
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
    </div>
  )
}
