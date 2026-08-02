import type { AttendanceForecast, AttendanceForecastPoint, ForecastPoint, RevenueForecast } from "../hooks/types"
import type { AttendanceRow } from "./raw"
import { DAY_LABELS } from "./peakHours"

export function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 }
  if (n === 1) return { slope: 0, intercept: values[0], r2: 1 }
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const x = i, y = values[i]
    sx += x; sy += y; sxy += x * y; sxx += x * x; syy += y * y
  }
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n, r2: 0 }
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  const ssTot = syy - (sy * sy) / n
  const ssRes = values.reduce((s, y, i) => s + Math.pow(y - (intercept + slope * i), 2), 0)
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

function confidenceIndex(n: number, r2: number): number {
  const lenFactor = Math.min(n, 12) / 12
  const base = r2 * 60 + lenFactor * 30 + (n >= 3 ? 10 : 0)
  return Math.round(Math.min(95, Math.max(30, base)))
}

export function forecastRevenue(monthlyValues: number[], months: string[]): RevenueForecast {
  if (monthlyValues.length < 2) {
    return { next3Months: [], confidence: 0, trend: "stable", percentChange: 0 }
  }

  const { slope, intercept, r2 } = linearRegression(monthlyValues)
  const fitted = monthlyValues.map((_, i) => intercept + slope * i)
  const seasonal = monthlyValues.map((v, i) => (fitted[i] > 0 ? v / fitted[i] : 1))
  const last = monthlyValues.length - 1

  const next3Months: ForecastPoint[] = []
  for (let k = 1; k <= 3; k++) {
    const idx = last + k
    const factor = seasonal[(idx - 1) % seasonal.length] ?? 1
    const val = Math.round(Math.max(0, (intercept + slope * idx) * factor))
    next3Months.push({ label: months[idx] ?? `M+${k}`, value: val })
  }

  const recent = monthlyValues.slice(-3)
  const avg = recent.reduce((s, v) => s + v, 0) / recent.length
  const percentChange = avg > 0 ? Math.round(((next3Months[next3Months.length - 1].value - avg) / avg) * 100) : 0
  const trend: RevenueForecast["trend"] = percentChange > 3 ? "up" : percentChange < -3 ? "down" : "stable"

  return { next3Months, confidence: confidenceIndex(monthlyValues.length, r2), trend, percentChange }
}

export function forecastAttendance(attendance: AttendanceRow[], horizonDays = 7): AttendanceForecast {
  const now = new Date()
  const todayKey = now.toISOString().split("T")[0]

  const countByDow = new Array(7).fill(0)
  const daysWithDow = new Array(7).fill(0)
  const seenDates = new Set<string>()
  for (const a of attendance) {
    const ts = a.check_in
    if (!ts) continue
    const d = new Date(ts)
    if (isNaN(d.getTime())) continue
    const key = ts.slice(0, 10)
    if (!seenDates.has(key)) {
      seenDates.add(key)
      daysWithDow[d.getDay()]++
    }
    countByDow[d.getDay()]++
  }
  const dowAvg = countByDow.map((c, i) => (daysWithDow[i] > 0 ? c / daysWithDow[i] : 0))

  const dayOffset = (k: number) => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + k)
    return d
  }
  const keyOf = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  const countBetween = (start: Date, end: Date) => {
    let c = 0
    for (const a of attendance) {
      if (!a.check_in) continue
      const ts = a.check_in.slice(0, 10)
      if (ts >= keyOf(start) && ts <= keyOf(end)) c++
    }
    return c
  }

  const lastWeek = countBetween(dayOffset(-7), dayOffset(-1))
  const prevWeek = countBetween(dayOffset(-14), dayOffset(-8))
  let trendFactor = prevWeek > 0 ? lastWeek / prevWeek : 1
  trendFactor = Math.min(1.6, Math.max(0.6, trendFactor))

  const next7Days: AttendanceForecastPoint[] = []
  let weeklyTotal = 0
  for (let k = 0; k < horizonDays; k++) {
    const d = dayOffset(k)
    const dow = d.getDay()
    const predicted = Math.max(0, Math.round(dowAvg[dow] * trendFactor))
    next7Days.push({ date: keyOf(d), dayLabel: DAY_LABELS[dow], predicted })
    weeklyTotal += predicted
  }

  const dataDays = seenDates.size
  const confidence = Math.round(Math.min(95, Math.max(30, 30 + dataDays * 2)))

  return { next7Days, weeklyTotal, confidence }
}
