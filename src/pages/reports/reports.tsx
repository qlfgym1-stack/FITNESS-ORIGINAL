import { PageHeader } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useT } from "@/i18n"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, Users, CalendarCheck, DollarSign, ArrowUp, ArrowDown } from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const revenueData = [
  { month: "Jan", revenue: 45000, expenses: 28000 },
  { month: "Feb", revenue: 52000, expenses: 31000 },
  { month: "Mar", revenue: 48000, expenses: 29000 },
  { month: "Apr", revenue: 61000, expenses: 35000 },
  { month: "May", revenue: 58000, expenses: 33000 },
  { month: "Jun", revenue: 72000, expenses: 38000 },
]

const membersData = [
  { month: "Jan", new: 45, active: 320 },
  { month: "Feb", new: 52, active: 350 },
  { month: "Mar", new: 38, active: 340 },
  { month: "Apr", new: 61, active: 380 },
  { month: "May", new: 55, active: 400 },
  { month: "Jun", new: 70, active: 420 },
]

const attendanceData = [
  { month: "Jan", checkins: 1200, classes: 800 },
  { month: "Feb", checkins: 1350, classes: 900 },
  { month: "Mar", checkins: 1100, classes: 750 },
  { month: "Apr", checkins: 1500, classes: 1000 },
  { month: "May", checkins: 1400, classes: 950 },
  { month: "Jun", checkins: 1650, classes: 1100 },
]

const subscriptionPie = [
  { name: "Monthly", value: 45 },
  { name: "Quarterly", value: 25 },
  { name: "Annual", value: 20 },
  { name: "Student", value: 10 },
]

const COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--destructive)"]

const statsCards = [
  { title: "Total Revenue", value: 336000, change: 12.5, icon: DollarSign, format: true },
  { title: "Active Members", value: 420, change: 8.3, icon: Users },
  { title: "Monthly Check-ins", value: 1650, change: 15.2, icon: CalendarCheck },
  { title: "Class Attendance", value: 1100, change: -3.1, icon: TrendingUp },
]

function StatCard({ title, value, change, icon: Icon, format }: { title: string; value: number; change: number; icon: React.ElementType; format?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{format ? formatCurrency(value) : value.toLocaleString()}</div>
        <div className={`flex items-center gap-1 text-sm mt-1 ${change >= 0 ? "text-success" : "text-destructive"}`}>
          {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(change)}% from last month
        </div>
      </CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const t = useT()

  return (
    <div>
      <PageHeader title={t("reports.title")} description={t("reports.description")} />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {statsCards.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <Tabs defaultValue="revenue">
        <TabsList className="mb-6">
          <TabsTrigger value="revenue">{t("reports.revenue")}</TabsTrigger>
          <TabsTrigger value="members">{t("reports.members")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("reports.attendance")}</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{t("reports.revenueTrend")}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} name="Revenue" />
                      <Line type="monotone" dataKey="expenses" stroke="var(--destructive)" strokeWidth={2} name="Expenses" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("reports.subscriptionBreakdown")}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={subscriptionPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label>
                        {subscriptionPie.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader><CardTitle>{t("reports.memberGrowth")}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={membersData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="new" fill="var(--primary)" name="New Members" />
                    <Bar dataKey="active" fill="var(--success)" name="Active Members" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader><CardTitle>{t("reports.attendanceTrend")}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="checkins" stroke="var(--primary)" strokeWidth={2} name="Check-ins" />
                    <Line type="monotone" dataKey="classes" stroke="var(--warning)" strokeWidth={2} name="Classes" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
