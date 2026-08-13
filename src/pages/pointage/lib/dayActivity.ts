export type DayAttendanceRow = {
  id: string
  member_id: string
  check_in: string | null
  check_out: string | null
  source?: string | null
  member?: { first_name: string; last_name: string; photo_url?: string | null } | null
}

export type MemberStatus = "completed" | "in_progress" | "open"

export function computeDurationMin(check_in: string | null, check_out: string | null, now = Date.now()): number | null {
  if (!check_in) return null
  const start = new Date(check_in).getTime()
  const end = check_out ? new Date(check_out).getTime() : now
  const diff = Math.floor((end - start) / 60000)
  return diff >= 0 ? diff : null
}

export function formatDurationMin(mins: number | null): string {
  if (mins == null) return ""
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function getMemberStatus(check_in: string | null, check_out: string | null): MemberStatus {
  if (check_in && check_out) return "completed"
  if (check_in) return "in_progress"
  return "open"
}

export type DayStats = {
  date: string
  entries: number
  exits: number
  inProgress: number
  uniqueMembers: number
  totalDurationMin: number
  avgDurationMin: number
}

export function buildDayStats(rows: DayAttendanceRow[], date: string): DayStats {
  const entries = rows.length
  const exits = rows.filter(r => r.check_in && r.check_out).length
  const inProgress = rows.filter(r => r.check_in && !r.check_out).length
  const uniqueMembers = new Set(rows.map(r => r.member_id)).size
  const durations = rows
    .filter(r => r.check_in && r.check_out)
    .map(r => computeDurationMin(r.check_in, r.check_out))
    .filter((d): d is number => d != null)
  const totalDurationMin = durations.reduce((a, b) => a + b, 0)
  const avgDurationMin = durations.length > 0 ? Math.round(totalDurationMin / durations.length) : 0
  return { date, entries, exits, inProgress, uniqueMembers, totalDurationMin, avgDurationMin }
}
