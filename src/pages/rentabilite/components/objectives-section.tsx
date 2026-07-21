import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Target } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { Objective } from "../hooks/types"

interface ObjectivesSectionProps {
  objectives: Objective[]
  t: (key: string) => string
}

const statusStyles: Record<Objective["status"], { bg: string; text: string; label: string }> = {
  on_track: { bg: "bg-success/10", text: "text-success", label: "On Track" },
  at_risk: { bg: "bg-warning/10", text: "text-warning", label: "At Risk" },
  behind: { bg: "bg-destructive/10", text: "text-destructive", label: "Behind" },
}

const progressColors: Record<Objective["status"], string> = {
  on_track: "bg-success",
  at_risk: "bg-warning",
  behind: "bg-destructive",
}

export function ObjectivesSection({ objectives, t }: ObjectivesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t("rentabilite.objectives")}
        </CardTitle>
      </CardHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 pb-6">
        {objectives.map((obj) => {
          const styles = statusStyles[obj.status]
          const color = progressColors[obj.status]
          return (
            <div key={obj.metric} className="p-4 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t("rentabilite.obj_" + obj.metric)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>
                  {styles.label}
                </span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>{t("rentabilite.target")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(obj.target)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("rentabilite.actual")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(obj.actual)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${Math.min(obj.progress, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums">{obj.progress.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("rentabilite.forecast")} : {formatCurrency(obj.forecast)}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
