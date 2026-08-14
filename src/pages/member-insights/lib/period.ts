export type PeriodId = "30d" | "90d" | "6m" | "12m" | "all"

export interface DateRange {
  start: string
  end: string
}

const DAY = 86400000

export function periodDays(id: PeriodId): number {
  switch (id) {
    case "30d":
      return 30
    case "90d":
      return 90
    case "6m":
      return 182
    case "12m":
      return 365
    case "all":
      return Number.POSITIVE_INFINITY
  }
}

export function periodRange(id: PeriodId, now: Date = new Date()): DateRange {
  if (id === "all") {
    return { start: new Date(0).toISOString(), end: now.toISOString() }
  }
  const start = new Date(now.getTime() - periodDays(id) * DAY)
  return { start: start.toISOString(), end: now.toISOString() }
}

export function previousRange(range: DateRange): DateRange {
  const start = new Date(range.start)
  const end = new Date(range.end)
  const length = end.getTime() - start.getTime()
  return { start: new Date(start.getTime() - length).toISOString(), end: range.start }
}

export function inRange(ts: string, range: DateRange): boolean {
  const t = new Date(ts).getTime()
  return t >= new Date(range.start).getTime() && t < new Date(range.end).getTime()
}
