import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Lightbulb, TrendingUp, TrendingDown, Info, AlertTriangle, ArrowRight } from "lucide-react"
import type { KeyedInsight } from "../hooks/types"
import { tpl } from "./tpl"

interface InsightsSectionProps {
  insights: KeyedInsight[]
  t: (key: string) => string
}

const iconMap = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Info,
  warning: AlertTriangle,
}

const containerClassMap = {
  positive: "bg-success/10 border-l-4 border-success text-success-foreground",
  negative: "bg-destructive/10 border-l-4 border-destructive text-destructive-foreground",
  neutral: "bg-muted/50 border-l-4 border-muted-foreground",
  warning: "bg-warning/10 border-l-4 border-warning text-warning-foreground",
}

export function InsightsSection({ insights, t }: InsightsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {t("aiAssistant.insights")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("aiAssistant.insightsSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = iconMap[insight.type]
            return (
              <div key={index} className={`p-3 rounded-md ${containerClassMap[insight.type]}`}>
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">{tpl(t, insight.messageKey, insight.messageParams)}</span>
                </div>
                {insight.actionKey && (
                  <div className="flex items-center gap-1 mt-1.5 ml-6 text-xs opacity-80">
                    <ArrowRight className="h-3 w-3" />
                    <span>{tpl(t, insight.actionKey, insight.actionParams)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
