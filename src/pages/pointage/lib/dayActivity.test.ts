import { describe, it, expect } from "vitest"
import { buildDayStats, computeDurationMin, formatDurationMin, getMemberStatus } from "./dayActivity"

const LAALA = {
  id: "att-1",
  member_id: "m-laala",
  check_in: "2026-08-13T09:15:00.000Z",
  check_out: "2026-08-13T10:45:00.000Z",
  member: { first_name: "LAALA", last_name: "TOUFIK" },
}

const SESSIONS = {
  date: "2026-08-13",
  rows: [
    LAALA,
    { ...LAALA, id: "att-2", check_in: "2026-08-13T08:00:00.000Z", check_out: "2026-08-13T09:30:00.000Z" },
    { ...LAALA, id: "att-3", check_in: "2026-08-13T11:00:00.000Z", check_out: null },
  ],
}

describe("computeDurationMin", () => {
  it("calcule la durée d'une session complète (LAALA TOUFIK 09:15 → 10:45 = 90 min)", () => {
    expect(computeDurationMin(LAALA.check_in, LAALA.check_out)).toBe(90)
  })

  it("calcule la durée d'une session en cours depuis le check-in", () => {
    const now = new Date("2026-08-13T12:00:00.000Z").getTime()
    expect(computeDurationMin("2026-08-13T11:00:00.000Z", null, now)).toBe(60)
  })

  it("retourne null sans check_in", () => {
    expect(computeDurationMin(null, null)).toBeNull()
  })
})

describe("formatDurationMin", () => {
  it("formate en heures + minutes", () => {
    expect(formatDurationMin(90)).toBe("1h 30min")
  })

  it("formate en minutes seules", () => {
    expect(formatDurationMin(45)).toBe("45 min")
  })

  it("retourne une chaîne vide si null", () => {
    expect(formatDurationMin(null)).toBe("")
  })
})

describe("getMemberStatus", () => {
  it("marque Terminé quand check-in et check-out présents", () => {
    expect(getMemberStatus(LAALA.check_in, LAALA.check_out)).toBe("completed")
  })

  it("marque En cours quand seul le check-in est présent", () => {
    expect(getMemberStatus(LAALA.check_in, null)).toBe("in_progress")
  })

  it("marque Session ouverte quand rien n'est horodaté", () => {
    expect(getMemberStatus(null, null)).toBe("open")
  })
})

describe("buildDayStats", () => {
  it("calcule les statistiques de la journée (LAALA TOUFIK + 2 sessions)", () => {
    const stats = buildDayStats(SESSIONS.rows, SESSIONS.date)
    expect(stats.date).toBe("2026-08-13")
    expect(stats.entries).toBe(3)
    expect(stats.exits).toBe(2)
    expect(stats.inProgress).toBe(1)
    expect(stats.uniqueMembers).toBe(1)
    expect(stats.totalDurationMin).toBe(180)
    expect(stats.avgDurationMin).toBe(90)
  })

  it("retourne des zéros pour une journée vide", () => {
    const stats = buildDayStats([], "2026-08-14")
    expect(stats).toEqual({ date: "2026-08-14", entries: 0, exits: 0, inProgress: 0, uniqueMembers: 0, totalDurationMin: 0, avgDurationMin: 0 })
  })
})
