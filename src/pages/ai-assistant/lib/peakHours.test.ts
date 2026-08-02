import { describe, it, expect } from "vitest"
import { analyzePeakHours } from "./peakHours"
import type { AttendanceRow } from "./raw"

function row(hour: number, daysAgo = 1): AttendanceRow {
  const d = new Date(Date.now() - daysAgo * 86400000)
  d.setHours(hour, 0, 0, 0)
  return { check_in: d.toISOString(), check_out: null, type: "check-in" }
}

describe("analyzePeakHours", () => {
  it("buckets check-ins by hour", () => {
    const rows = [row(9), row(9), row(9), row(18), row(18)]
    const result = analyzePeakHours(rows)
    expect(result.hourly[9].count).toBe(3)
    expect(result.hourly[18].count).toBe(2)
    expect(result.hourly[10].count).toBe(0)
  })

  it("identifies top 3 peak hours", () => {
    const rows = [
      row(8), row(8), row(8),
      row(9), row(9),
      row(18), row(18),
      row(19),
    ]
    const result = analyzePeakHours(rows)
    expect(result.peakHours).toContain(8)
    expect(result.peakHours.length).toBe(3)
    expect(result.peakHours[0]).toBe(8)
  })

  it("computes percentages", () => {
    const rows = [row(9), row(9), row(18)]
    const result = analyzePeakHours(rows)
    expect(result.hourly[9].percentage).toBe(67)
    expect(result.hourly[18].percentage).toBe(33)
  })

  it("ignores rows without check_in", () => {
    const result = analyzePeakHours([{ check_in: null, check_out: null, type: "check-in" }])
    expect(result.hourly.every((h) => h.count === 0)).toBe(true)
  })
})
