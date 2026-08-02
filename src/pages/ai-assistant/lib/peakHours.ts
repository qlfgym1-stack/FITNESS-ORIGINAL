import type { PeakHoursResult, HourTraffic, DayTraffic } from "../hooks/types"
import type { AttendanceRow } from "./raw"

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function toDate(ts: string | null | undefined): Date | null {
  if (!ts) return null
  const d = new Date(ts)
  return isNaN(d.getTime()) ? null : d
}

export function analyzePeakHours(attendance: AttendanceRow[]): PeakHoursResult {
  const hours: HourTraffic[] = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, percentage: 0 }))
  const daily: DayTraffic[] = DAY_LABELS.map((label, day) => ({ day, label, count: 0, percentage: 0 }))

  let total = 0
  for (const a of attendance) {
    const d = toDate(a.check_in)
    if (!d) continue
    hours[d.getHours()].count++
    daily[d.getDay()].count++
    total++
  }

  const withHour = hours.filter((h) => h.count > 0).sort((a, b) => b.count - a.count)
  const withDay = daily.filter((d) => d.count > 0)

  for (const h of hours) h.percentage = total > 0 ? Math.round((h.count / total) * 100) : 0
  for (const d of daily) d.percentage = total > 0 ? Math.round((d.count / total) * 100) : 0

  const peakHours = withHour.slice(0, 3).map((h) => h.hour)

  const maxCount = withHour.length > 0 ? withHour[0].count : 0
  const offPeakHours = withHour
    .filter((h) => !peakHours.includes(h.hour) && h.count < maxCount * 0.35)
    .map((h) => h.hour)
    .sort((a, b) => a - b)

  const busiestDay = withDay.length > 0 ? withDay[0].day : 0
  const quietestDay =
    withDay.length > 0
      ? daily.reduce((acc, d) => (d.count < acc.count ? d : acc), daily[0]).day
      : 0

  return { hourly: hours, daily, peakHours, offPeakHours, busiestDay, quietestDay }
}
