import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertOctagon, AlertTriangle, Lightbulb, UserRound } from "lucide-react"
import type { MemberRecommendation, RecommendationType } from "../lib/recommend"

interface RecommendationsSectionProps {
  recommendations: MemberRecommendation[]
  t: (key: string) => string
}

interface PriorityGroup {
  key: string
  priority: number
  color: string
  icon: typeof AlertOctagon
}

const GROUPS: PriorityGroup[] = [
  { key: "p0", priority: 0, color: "text-destructive", icon: AlertOctagon },
  { key: "p1", priority: 1, color: "text-warning", icon: AlertTriangle },
  { key: "p2", priority: 2, color: "text-primary", icon: Lightbulb },
]

function typeLabel(type: RecommendationType, days: number | null, t: (key: string) => string): string {
  const key = `memberInsights.recommendations.type.${type}`
  const raw = t(key)
  if (days !== null && raw.includes("{days}")) return raw.replace("{days}", String(days))
  return raw
}

export function RecommendationsSection({ recommendations, t }: RecommendationsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("memberInsights.recommendations.title")}</CardTitle>
        <CardDescription>{t("memberInsights.recommendations.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memberInsights.recommendations.empty")}</p>
        ) : (
          <div className="space-y-6">
            {GROUPS.map((g) => {
              const items = recommendations.filter((r) => r.priority === g.priority)
              if (items.length === 0) return null
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <g.icon className={`h-4 w-4 ${g.color}`} />
                    <h3 className="text-sm font-semibold">
                      {t(`memberInsights.recommendations.${g.key}`)}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.map((r) => (
                      <div
                        key={`${r.memberId}-${r.type}`}
                        className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2"
                      >
                        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.fullName}</p>
                          <p className="text-xs text-muted-foreground">{typeLabel(r.type, r.days, t)}</p>
                        </div>
                      </div>
                    ))}
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
