import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BrainCircuit, CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { AttendanceForecast, RevenueForecast } from "../hooks/types"

interface ForecastSectionProps {
  revenue: RevenueForecast
  attendance: AttendanceForecast
  t: (key: string) => string
}

function TrendIcon({ trend }: { trend: RevenueForecast["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

export function ForecastSection({ revenue, attendance, t }: ForecastSectionProps) {
  const revenueData = revenue.next3Months.map((p) => ({ label: p.label, value: p.value }))
  const attendanceData = attendance.next7Days.map((d) => ({ label: d.dayLabel, value: d.predicted }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5" />
            {t("aiAssistant.revenueForecastTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {t("aiAssistant.forecastSubtitle")}
            <Badge variant="outline">{t("aiAssistant.confidence")}: {revenue.confidence}%</Badge>
            <TrendIcon trend={revenue.trend} />
            <span className="text-xs">
              {revenue.percentChange >= 0 ? "+" : ""}{revenue.percentChange}%
            </span>
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {revenueData.map((_, idx) => (
                  <Cell key={idx} fill={idx === 0 ? "#3b82f6" : "#8b5cf6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {revenue.next3Months.map((p) => (
              <div key={p.label} className="text-center rounded-md bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground">{p.label}</p>
                <p className="text-xs font-semibold">{formatCurrency(p.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t("aiAssistant.attendanceForecastTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {t("aiAssistant.forecastSubtitle")}
            <Badge variant="outline">{t("aiAssistant.confidence")}: {attendance.confidence}%</Badge>
            <span className="text-xs">{t("aiAssistant.weeklyTotal")}: {attendance.weeklyTotal}</span>
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="value" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {attendance.next7Days.map((d) => (
              <div key={d.date} className="text-center rounded-md bg-muted/30 p-1.5">
                <p className="text-[10px] text-muted-foreground">{tplDay(t, d.dayLabel)}</p>
                <p className="text-xs font-semibold">{d.predicted}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function tplDay(t: (key: string) => string, label: string): string {
  const map: Record<string, string> = {
    Sun: "aiAssistant.days.sun",
    Mon: "aiAssistant.days.mon",
    Tue: "aiAssistant.days.tue",
    Wed: "aiAssistant.days.wed",
    Thu: "aiAssistant.days.thu",
    Fri: "aiAssistant.days.fri",
    Sat: "aiAssistant.days.sat",
  }
  return t(map[label] ?? label)
}
