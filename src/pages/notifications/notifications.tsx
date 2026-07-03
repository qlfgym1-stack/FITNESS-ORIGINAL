import { useState } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDateTime } from "@/lib/utils"
import {
  Bell, CheckCheck, Mail, MailOpen, Trash2, Info, AlertCircle, AlertTriangle, ShoppingCart, UserPlus, Calendar,
} from "lucide-react"

interface Notification {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  created_at: string
}

const defaultNotifications: Notification[] = [
  { id: "1", title: "New member registered", body: "Ahmed Benali has registered as a new member.", type: "info", is_read: false, created_at: "2026-07-03T10:30:00" },
  { id: "2", title: "Low stock alert", body: "Protein Powder is below minimum stock level.", type: "warning", is_read: false, created_at: "2026-07-03T09:15:00" },
  { id: "3", title: "Payment received", body: "Payment of 5,000 DA from Fatima Zohra confirmed.", type: "success", is_read: false, created_at: "2026-07-02T16:00:00" },
  { id: "4", title: "Subscription expiring", body: "Karim Ouali's subscription expires in 3 days.", type: "warning", is_read: true, created_at: "2026-07-01T14:30:00" },
  { id: "5", title: "Class attendance updated", body: "CrossFit class attendance has been updated.", type: "info", is_read: true, created_at: "2026-06-30T11:00:00" },
  { id: "6", title: "New purchase order", body: "Purchase order #4 has been created for SportSupply.", type: "info", is_read: true, created_at: "2026-06-28T10:00:00" },
  { id: "7", title: "Equipment maintenance due", body: "Treadmill #3 is due for maintenance.", type: "error", is_read: false, created_at: "2026-07-03T08:00:00" },
]

const typeIcons: Record<string, React.ElementType> = {
  info: Info, warning: AlertTriangle, success: CheckCheck, error: AlertCircle,
}

export default function NotificationsPage() {
  const t = useT()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>(defaultNotifications)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications

  function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    )
    toast({ title: t("notifications.allRead") })
  }

  function remove(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
        actions={
          unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="mr-2 h-4 w-4" /> {t("notifications.markAllRead")}
            </Button>
          )
        }
      />

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <span className="text-lg font-semibold">{t("notifications.title")}</span>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} {t("notifications.unread")}</Badge>
          )}
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">{t("notifications.all")}</TabsTrigger>
            <TabsTrigger value="unread">{t("notifications.unreadOnly")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
                    n.type === "warning" ? "bg-warning/10" :
                    n.type === "error" ? "bg-destructive/10" :
                    n.type === "success" ? "bg-success/10" : "bg-muted"
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      n.type === "warning" ? "text-warning" :
                      n.type === "error" ? "text-destructive" :
                      n.type === "success" ? "text-success" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    {!n.is_read && (
                      <Button variant="ghost" size="icon" onClick={() => markAsRead(n.id)}>
                        <MailOpen className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
    </div>
  )
}
