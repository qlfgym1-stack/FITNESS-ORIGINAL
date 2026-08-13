import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Grid2X2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { BehaviorQuadrant, BehaviorBucket } from "../lib/behaviorMatrix"

interface BehaviorMatrixProps {
  behavior: Record<BehaviorQuadrant, BehaviorBucket>
  t: (key: string) => string
}

const quadrantOrder: BehaviorQuadrant[] = [
  "activeHighSpend",
  "activeLowSpend",
  "inactiveHighSpend",
  "inactiveLowSpend",
]

export function BehaviorMatrix({ behavior, t }: BehaviorMatrixProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid2X2 className="h-5 w-5" />
          {t("memberInsights.matrix.title")}
        </CardTitle>
        <CardDescription>{t("memberInsights.matrix.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quadrantOrder.map((q: BehaviorQuadrant) => (
            <div key={q} className="rounded-md border p-3">
              <p className="text-sm font-medium">{t(`memberInsights.matrix.${q}`)}</p>
              <p className="text-2xl font-bold mt-1">{behavior[q].count}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("memberInsights.matrix.members")}</p>
              <p className="text-sm mt-1 text-muted-foreground">
                {t("memberInsights.matrix.avgLtv")} : {formatCurrency(behavior[q].avgLtv)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
