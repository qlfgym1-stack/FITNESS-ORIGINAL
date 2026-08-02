import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListChecks, TrendingUp } from "lucide-react"
import type { ActionItem, Priority } from "../hooks/types"
import { tpl } from "./tpl"

interface PriorityActionsProps {
  actions: ActionItem[]
  t: (key: string) => string
}

const priorityBadge: Record<Priority, { label: string; className: string }> = {
  p0: { label: "P0", className: "bg-destructive text-destructive-foreground" },
  p1: { label: "P1", className: "bg-warning text-warning-foreground" },
  p2: { label: "P2", className: "bg-muted text-muted-foreground" },
}

const borderClass: Record<Priority, string> = {
  p0: "border-l-4 border-destructive",
  p1: "border-l-4 border-warning",
  p2: "border-l-4 border-muted-foreground",
}

export function PriorityActions({ actions, t }: PriorityActionsProps) {
  const sorted = [...actions].sort((a, b) => {
    const order: Record<Priority, number> = { p0: 0, p1: 1, p2: 2 }
    return order[a.priority] - order[b.priority]
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          {t("aiAssistant.actions")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("aiAssistant.actionsSubtitle")}</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("aiAssistant.noActions")}</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((action) => {
              const badge = priorityBadge[action.priority]
              return (
                <div key={action.id} className={`p-3 rounded-md bg-muted/30 ${borderClass[action.priority]}`}>
                  <div className="flex items-center gap-2">
                    <Badge className={badge.className}>{badge.label}</Badge>
                    <Badge variant="outline">{tpl(t, action.categoryKey)}</Badge>
                    <span className="text-sm font-medium">{tpl(t, action.titleKey, action.titleParams)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {tpl(t, action.detailKey, action.detailParams)}
                  </p>
                  {action.gainKey && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-success">
                      <TrendingUp className="h-3 w-3" />
                      <span>{tpl(t, action.gainKey, action.gainParams)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
