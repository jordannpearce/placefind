import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nextRunAt, normalizeTrafficSchedule, scheduleDue, type ScheduleLike } from "./schedule.ts"

function dailyUtc(partial: Partial<ScheduleLike> = {}): ScheduleLike {
  return {
    enabled: true,
    cadence: "daily",
    hour: 9,
    minute: 0,
    timeZone: "utc",
    ...partial,
  }
}

describe("scheduleDue", () => {
  it("is due at the scheduled UTC minute and not a minute earlier", () => {
    const schedule = dailyUtc()
    assert.equal(scheduleDue(schedule, new Date("2026-09-06T09:00:10.000Z")), true)
    assert.equal(scheduleDue(schedule, new Date("2026-09-06T08:59:59.000Z")), false)
    assert.equal(scheduleDue(schedule, new Date("2026-09-06T09:01:00.000Z")), false)
  })

  it("does not fire twice on the same local day after lastRunAt", () => {
    const schedule = dailyUtc({ lastRunAt: "2026-09-06T09:00:20.000Z" })
    assert.equal(scheduleDue(schedule, new Date("2026-09-06T09:00:40.000Z")), false)
    assert.equal(scheduleDue(dailyUtc({ lastRunAt: "2026-09-05T09:00:00.000Z" }), new Date("2026-09-06T09:00:10.000Z")), true)
  })

  it("requires the weekday for weekly cadence", () => {
    const weekly: ScheduleLike = {
      enabled: true,
      cadence: "weekly",
      hour: 9,
      minute: 0,
      weekday: 0,
      timeZone: "utc",
    }
    // 2026-09-06 is a Sunday
    assert.equal(scheduleDue(weekly, new Date("2026-09-06T09:00:00.000Z")), true)
    assert.equal(scheduleDue(weekly, new Date("2026-09-07T09:00:00.000Z")), false)
    assert.equal(scheduleDue({ ...weekly, weekday: undefined }, new Date("2026-09-06T09:00:00.000Z")), false)
  })

  it("stays off when disabled", () => {
    assert.equal(scheduleDue(dailyUtc({ enabled: false }), new Date("2026-09-06T09:00:00.000Z")), false)
  })

  it("uses a local UTC offset when timeZone is local", () => {
    const schedule: ScheduleLike = {
      enabled: true,
      cadence: "daily",
      hour: 9,
      minute: 0,
      timeZone: "local",
      utcOffsetMinutes: -300,
    }
    assert.equal(scheduleDue(schedule, new Date("2026-09-06T14:00:10.000Z")), true)
    assert.equal(scheduleDue(schedule, new Date("2026-09-06T09:00:10.000Z")), false)
  })
})

describe("normalizeTrafficSchedule", () => {
  it("keeps a last search count between 1 and 50", () => {
    const saved = normalizeTrafficSchedule({
      enabled: false,
      cadence: "daily",
      hour: 9,
      minute: 0,
      timeZone: "utc",
      lastSelectedPinIds: ["0:0"],
      lastSelectedKeywords: ["barbecue"],
      lastSearchCount: 4,
    })
    assert.equal(saved.value?.lastSearchCount, 4)
    assert.equal(
      normalizeTrafficSchedule({
        enabled: false,
        cadence: "daily",
        hour: 9,
        minute: 0,
        timeZone: "utc",
        lastSearchCount: 99,
      }).value?.lastSearchCount,
      50,
    )
    assert.equal(normalizeTrafficSchedule(null).value?.lastSearchCount, 3)
  })
})

describe("nextRunAt", () => {
  it("returns the next daily UTC occurrence after now", () => {
    const next = nextRunAt(dailyUtc(), new Date("2026-09-06T09:00:01.000Z"))
    assert.equal(next.toISOString(), "2026-09-07T09:00:00.000Z")
    const laterToday = nextRunAt(dailyUtc(), new Date("2026-09-06T08:00:00.000Z"))
    assert.equal(laterToday.toISOString(), "2026-09-06T09:00:00.000Z")
  })
})
