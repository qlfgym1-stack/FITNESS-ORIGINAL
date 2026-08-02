import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, TrendingUp, Moon } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { PeakHoursResult } from "../hooks/types"

interface PeakHoursSectionProps {
  data: PeakHoursResult
  t: (key: string) => string
}

const PEAK_COLOR = "#22c55e"
const NORMAL_COLOR = "#94a3b8"

export function PeakHoursSection({ data, t }: PeakHoursSectionProps) {
  const peakSet = new Set(data.peakHours)
  const hourData = data.hourly.map((h) => ({ label: `${h.hour}h`, count: h.count }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t("aiAssistant.peakHoursTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("aiAssistant.peakHoursSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.peakHours.length > 0 && (
            <Badge className="bg-success">
              <TrendingUp className="h-3 w-3 mr-1" />
              {t("aiAssistant.peak")} {data.peakHours.map((h) => `${h}h`).join(" · ")}
            </Badge>
          )}
          {data.offPeakHours.length > 0 && (
            <Badge variant="outline">
              <Moon className="h-3 w-3 mr-1" />
              {t("aiAssistant.offPeak")} {data.offPeakHours.map((h) => `${h}h`).join(" · ")}
            </Badge>
          )}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {hourData.map((entry, index) => (
                <Cell key={index} fill={peakSet.has(Number(entry.label.replace("h", ""))) ? PEAK_COLOR : NORMAL_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {data.daily.map((d) => (
            <div key={d.day} className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{tplDay(t, d.label)}</p>
              <p className="text-xs font-semibold">{d.count}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
