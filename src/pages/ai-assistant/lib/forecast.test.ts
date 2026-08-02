import { describe, it, expect } from "vitest"
import { linearRegression, forecastRevenue, forecastAttendance } from "./forecast"
import type { AttendanceRow } from "./raw"

describe("linearRegression", () => {
  it("computes slope, intercept and r2", () => {
    const values = [10, 20, 30, 40, 50]
    const { slope, intercept, r2 } = linearRegression(values)
    expect(slope).toBeCloseTo(10, 5)
    expect(intercept).toBeCloseTo(10, 5)
    expect(r2).toBeCloseTo(1, 5)
  })

  it("returns 0 slope for constant series", () => {
    const { slope } = linearRegression([5, 5, 5, 5])
    expect(slope).toBe(0)
  })

  it("handles single point", () => {
    const { slope, intercept } = linearRegression([42])
    expect(slope).toBe(0)
    expect(intercept).toBe(42)
  })
})

describe("forecastRevenue", () => {
  it("projects an upward trend higher than the recent average", () => {
    const months = Array.from({ length: 12 }, (_, i) => `M${i + 1}`)
    const values = Array.from({ length: 12 }, (_, i) => 1000 + i * 100)
    const result = forecastRevenue(values, months)
    expect(result.next3Months.length).toBe(3)
    const recentAvg = values.slice(-3).reduce((s, v) => s + v, 0) / 3
    expect(result.next3Months[2].value).toBeGreaterThan(recentAvg)
    expect(result.trend).toBe("up")
  })

  it("detects a declining trend", () => {
    const months = Array.from({ length: 12 }, (_, i) => `M${i + 1}`)
    const values = Array.from({ length: 12 }, (_, i) => 5000 - i * 300)
    const result = forecastRevenue(values, months)
    expect(result.trend).toBe("down")
  })

  it("never produces negative forecasts", () => {
    const months = Array.from({ length: 12 }, (_, i) => `M${i + 1}`)
    const values = Array.from({ length: 12 }, (_, i) => 100 - i * 40)
    const result = forecastRevenue(values, months)
    expect(result.next3Months.every((p) => p.value >= 0)).toBe(true)
  })

  it("returns empty forecast for insufficient data", () => {
    const result = forecastRevenue([], [])
    expect(result.next3Months.length).toBe(0)
    expect(result.confidence).toBe(0)
  })
})

describe("forecastAttendance", () => {
  function makeRows(days: number, perDay: number, hour = 10): AttendanceRow[] {
    const rows: AttendanceRow[] = []
    for (let i = 0; i < days; i++) {
      for (let j = 0; j < perDay; j++) {
        const d = new Date(Date.now() - i * 86400000)
        d.setUTCHours(hour, 0, 0, 0)
        rows.push({ check_in: d.toISOString(), check_out: null, type: "check-in" })
      }
    }
    return rows
  }

  it("predicts 7 days with total", () => {
    const result = forecastAttendance(makeRows(30, 10))
    expect(result.next7Days.length).toBe(7)
    expect(result.weeklyTotal).toBe(result.next7Days.reduce((s, d) => s + d.predicted, 0))
  })

  it("predicts values near the historical daily average", () => {
    const result = forecastAttendance(makeRows(14, 8))
    const avg = result.next7Days.reduce((s, d) => s + d.predicted, 0) / 7
    expect(avg).toBeGreaterThan(0)
    expect(avg).toBeLessThanOrEqual(13)
  })

  it("returns zero predictions with no data", () => {
    const result = forecastAttendance([])
    expect(result.weeklyTotal).toBe(0)
    expect(result.next7Days.length).toBe(7)
  })
})
