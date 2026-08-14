import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SegmentSummary, SegmentId } from "../lib/segmentation"

interface SegmentationSectionProps {
  segmentSummary: SegmentSummary[]
  total: number
  t: (key: string) => string
}

const BAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-pink-600",
  "from-sky-500 to-blue-600",
  "from-orange-500 to-red-600",
  "from-teal-500 to-emerald-600",
  "from-indigo-500 to-violet-600",
  "from-slate-500 to-slate-700",
]

const SEGMENT_ORDER: SegmentId[] = [
  "vip",
  "veryActive",
  "active",
  "occasional",
  "lowActivity",
  "atRisk",
  "expired",
  "new",
  "loyal",
  "bigSpender",
  "bigPayer",
  "subNoConsumption",
  "subHighAttendance",
]

export function SegmentationSection({ segmentSummary, total, t }: SegmentationSectionProps) {
  const ordered = SEGMENT_ORDER.map((id) => {
    const found = segmentSummary.find((s) => s.segment === id)
    return found ?? { segment: id, count: 0 }
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("memberInsights.segments.title")}</CardTitle>
        <CardDescription>{t("memberInsights.segments.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.segments.empty")}</p>
        ) : (
          <div className="space-y-4">
            {ordered.map((s, idx) => {
              const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
              const color = BAR_COLORS[idx % BAR_COLORS.length]
              return (
                <div key={s.segment} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">
                      {t(`memberInsights.segments.label.${s.segment}`)}
                    </span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {s.count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
