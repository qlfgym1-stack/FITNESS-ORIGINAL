import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useT } from "@/i18n"
import { formatDate, formatCurrency, getInitials, getStatusColor, getDaysRemaining } from "@/lib/utils"
import { User, CreditCard, CalendarCheck, DollarSign, ChevronRight, Calendar, Clock } from "lucide-react"

const mockMember = {
  first_name: "Ahmed",
  last_name: "Benali",
  email: "ahmed@example.dz",
  phone: "+213 555 123 456",
  photo_url: null,
  status: "active",
}

const mockSubscriptions = [
  { id: "1", name: "Premium Monthly", start_date: "2026-06-01", end_date: "2026-07-01", status: "active", total_amount: 5000, amount_paid: 5000 },
  { id: "2", name: "Annual Gold", start_date: "2026-01-01", end_date: "2026-12-31", status: "active", total_amount: 48000, amount_paid: 48000 },
]

const mockAttendance = [
  { id: "1", date: "2026-07-03", type: "check-in", time: "08:30" },
  { id: "2", date: "2026-07-02", type: "class", time: "10:00", class_name: "Yoga" },
  { id: "3", date: "2026-07-01", type: "check-in", time: "09:15" },
  { id: "4", date: "2026-06-30", type: "class", time: "17:00", class_name: "CrossFit" },
  { id: "5", date: "2026-06-29", type: "check-in", time: "07:45" },
]

const mockPayments = [
  { id: "1", date: "2026-06-01", amount: 5000, method: "cash", status: "completed", description: "Premium Monthly - June" },
  { id: "2", date: "2026-01-01", amount: 48000, method: "card", status: "completed", description: "Annual Gold 2026" },
  { id: "3", date: "2025-12-01", amount: 5000, method: "cash", status: "completed", description: "Premium Monthly - December" },
]

export default function PortalPage() {
  const t = useT()
  const member = mockMember

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-6 mb-8 p-6 rounded-lg border bg-card">
        <Avatar className="h-20 w-20">
          {member.photo_url ? <AvatarImage src={member.photo_url} /> : null}
          <AvatarFallback className="text-2xl">{getInitials(member.first_name, member.last_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{member.first_name} {member.last_name}</h1>
          <p className="text-muted-foreground">{member.email} &middot; {member.phone}</p>
        </div>
        <Badge variant="default" className="text-sm">{t("portal.activeMember")}</Badge>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList className="mb-6">
          <TabsTrigger value="subscriptions">
            <CreditCard className="mr-2 h-4 w-4" /> {t("portal.subscriptions")}
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <CalendarCheck className="mr-2 h-4 w-4" /> {t("portal.attendance")}
          </TabsTrigger>
          <TabsTrigger value="payments">
            <DollarSign className="mr-2 h-4 w-4" /> {t("portal.payments")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          {mockSubscriptions.map((s) => {
            const remaining = getDaysRemaining(s.end_date)
            return (
              <Card key={s.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{s.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(s.start_date)} - {formatDate(s.end_date)}
                    </p>
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
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>{t("portal.recentAttendance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockAttendance.map((a) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>{t("portal.paymentHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{p.description}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(p.date)} &middot; {p.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">{formatCurrency(p.amount)}</p>
                      <Badge className={getStatusColor(p.status)} variant="secondary">{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
