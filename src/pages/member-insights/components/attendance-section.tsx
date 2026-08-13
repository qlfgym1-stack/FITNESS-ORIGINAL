import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { CalendarDays } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { formatDate } from "@/lib/utils"
import type { AttendancePeriod } from "../lib/kpi"

interface AttendanceSectionProps {
  stats: AttendancePeriod
  t: (key: string) => string
}

interface MonthPoint {
  label: string
  count: number
}

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`)
  return d.toLocaleDateString("fr-DZ", { month: "short", year: "2-digit" })
}

export function AttendanceSection({ stats, t }: AttendanceSectionProps) {
  const data: MonthPoint[] = stats.entriesByMonth.map((e: { month: string; count: number }) => ({
    label: monthLabel(e.month),
    count: e.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {t("memberInsights.attendance.title")}
        </CardTitle>
        <CardDescription>{t("memberInsights.attendance.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("memberInsights.attendance.totalEntries")}</p>
            <p className="text-lg font-bold">{stats.totalEntries}</p>
          </div>
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("memberInsights.attendance.avgPerMember")}</p>
            <p className="text-lg font-bold">{stats.avgEntriesPerMember.toFixed(1)}</p>
          </div>
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("memberInsights.attendance.days")}</p>
            <p className="text-lg font-bold">{stats.attendanceDays}</p>
          </div>
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("memberInsights.attendance.lastEntry")}</p>
            <p className="text-lg font-bold truncate">{stats.lastEntry ? formatDate(stats.lastEntry) : "—"}</p>
          </div>
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.empty")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
