import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import type { RoiEntry, ProfitabilityItem } from "../hooks/types"

interface ChartsSectionProps {
  monthlyRevenue: { label: string; value: number }[]
  monthlyExpenses: { label: string; value: number }[]
  monthlyProfit: { label: string; value: number }[]
  roiData: RoiEntry[]
  profitabilityByProduct: ProfitabilityItem[]
  profitabilityByCoach: ProfitabilityItem[]
  t: (key: string) => string
}

type ChartKey = "ca" | "profits" | "roi" | "margins" | "coaches" | "products"

const CHARTS: { key: ChartKey; labelKey: string }[] = [
  { key: "ca", labelKey: "rentabilite.chart_ca" },
  { key: "profits", labelKey: "rentabilite.chart_profits" },
  { key: "roi", labelKey: "rentabilite.chart_roi" },
  { key: "margins", labelKey: "rentabilite.chart_margins" },
  { key: "coaches", labelKey: "rentabilite.chart_coaches" },
  { key: "products", labelKey: "rentabilite.chart_products" },
]

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

function PercentTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

export function ChartsSection({
  monthlyRevenue,
  monthlyExpenses,
  monthlyProfit,
  roiData,
  profitabilityByProduct,
  profitabilityByCoach,
  t,
}: ChartsSectionProps) {
  const [activeChart, setActiveChart] = useState<ChartKey>("ca")

  return (
    <div className="space-y-4">
      <Tabs value={activeChart} onValueChange={(v) => setActiveChart(v as ChartKey)}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {CHARTS.map((chart) => (
            <TabsTrigger key={chart.key} value={chart.key} className="text-xs">
              {t(chart.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeChart === "ca" && (
        <Card className="print-break-inside">
          <CardHeader>
            <CardTitle className="text-base">{t("rentabilite.chart_ca")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={t("rentabilite.revenue")}
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  data={monthlyRevenue}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={t("rentabilite.totalExpenses")}
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  data={monthlyExpenses}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeChart === "profits" && (
        <Card className="print-break-inside">
          <CardHeader>
            <CardTitle className="text-base">{t("rentabilite.chart_profits")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyProfit}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Bar dataKey="value" name={t("rentabilite.profit")} radius={[4, 4, 0, 0]}>
                  {monthlyProfit.map((entry, index) => (
                    <Cell key={index} fill={entry.value >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeChart === "roi" && (
        <Card className="print-break-inside">
          <CardHeader>
            <CardTitle className="text-base">{t("rentabilite.chart_roi")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roiData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={120} />
                <Tooltip content={<PercentTooltip />} />
                <Legend />
                <Bar dataKey="roi" name={t("rentabilite.roi")} radius={[0, 4, 4, 0]}>
                  {roiData.map((entry, index) => (
                    <Cell key={index} fill={entry.roi >= 50 ? "#22c55e" : entry.roi >= 0 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeChart === "margins" && (
        <Card className="print-break-inside">
          <CardHeader>
            <CardTitle className="text-base">{t("rentabilite.chart_margins")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitabilityByProduct}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<PercentTooltip />} />
                <Legend />
                <Bar dataKey="margin" name={t("rentabilite.grossMargin")} radius={[4, 4, 0, 0]}>
                  {profitabilityByProduct.map((entry, index) => (
                    <Cell key={index} fill={entry.margin >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeChart === "coaches" && (
        <Card className="print-break-inside">
          <CardHeader>
            <CardTitle className="text-base">{t("rentabilite.chart_coaches")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitabilityByCoach}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Bar dataKey="profit" name={t("rentabilite.profit")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeChart === "products" && (
        <Card className="print-break-inside">
          <CardHeader>
            <CardTitle className="text-base">{t("rentabilite.chart_products")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={profitabilityByProduct}
                  dataKey="margin"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ label, margin }) => `${label}: ${margin.toFixed(1)}%`}
                >
                  {profitabilityByProduct.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PercentTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
