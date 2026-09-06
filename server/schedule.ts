import { normalizeTrafficSearches } from "../src/lib/traffic-plan.ts"

export type ScheduleCadence = "daily" | "weekly"
export type ScheduleTimeZone = "local" | "utc"
export type TrafficPinMode = "selected" | "all_found"

export type ScheduleLike = {
  enabled: boolean
  cadence: ScheduleCadence
  hour: number
  minute: number
  weekday?: number
  timeZone: ScheduleTimeZone
  utcOffsetMinutes?: number
  lastRunAt?: string | null
  nextRunAt?: string | null
}

export type ScanSchedule = ScheduleLike

export type TrafficSchedule = ScheduleLike & {
  pinMode: TrafficPinMode
  lastSelectedPinIds: string[]
  lastSelectedKeywords: string[]
  lastSearchCount?: number
}

export function defaultScanSchedule(): ScanSchedule {
  return {
    enabled: false,
    cadence: "daily",
    hour: 9,
    minute: 0,
    timeZone: "local",
    lastRunAt: null,
    nextRunAt: null,
  }
}

export function defaultTrafficSchedule(): TrafficSchedule {
  return {
    ...defaultScanSchedule(),
    pinMode: "selected",
    lastSelectedPinIds: [],
    lastSelectedKeywords: [],
    lastSearchCount: normalizeTrafficSearches(undefined),
  }
}

export function listingNotConfirmedForScheduleMessage() {
  return "Confirm a Maps listing before scheduling scans or traffic."
}

function clockParts(now: Date, schedule: ScheduleLike): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
} {
  if (schedule.timeZone === "utc") {
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth(),
      day: now.getUTCDate(),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      weekday: now.getUTCDay(),
    }
  }
  if (schedule.utcOffsetMinutes != null) {
    const shifted = new Date(now.getTime() + schedule.utcOffsetMinutes * 60_000)
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth(),
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      weekday: shifted.getUTCDay(),
    }
  }
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    weekday: now.getDay(),
  }
}

function dateInZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  schedule: ScheduleLike,
): Date {
  if (schedule.timeZone === "utc") {
    return new Date(Date.UTC(year, month, day, hour, minute, 0, 0))
  }
  if (schedule.utcOffsetMinutes != null) {
    return new Date(Date.UTC(year, month, day, hour, minute, 0, 0) - schedule.utcOffsetMinutes * 60_000)
  }
  return new Date(year, month, day, hour, minute, 0, 0)
}

export function scheduleDue(schedule: ScheduleLike, now: Date): boolean {
  if (!schedule.enabled) return false
  if (!Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23) return false
  if (!Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59) return false
  const parts = clockParts(now, schedule)
  if (parts.hour !== schedule.hour || parts.minute !== schedule.minute) return false
  if (schedule.cadence === "weekly") {
    const weekday = schedule.weekday
    if (weekday == null || weekday < 0 || weekday > 6) return false
    if (parts.weekday !== weekday) return false
  }
  if (schedule.lastRunAt) {
    const last = clockParts(new Date(schedule.lastRunAt), schedule)
    if (last.year === parts.year && last.month === parts.month && last.day === parts.day) return false
  }
  return true
}

export function nextRunAt(schedule: ScheduleLike, now: Date): Date {
  const parts = clockParts(now, schedule)
  const year = parts.year
  const month = parts.month
  const day = parts.day
  if (schedule.cadence === "weekly") {
    const weekday = schedule.weekday ?? 1
    let delta = (weekday - parts.weekday + 7) % 7
    const todayTime = dateInZone(year, month, day, schedule.hour, schedule.minute, schedule)
    if (delta === 0 && todayTime.getTime() <= now.getTime()) delta = 7
    const next = new Date(Date.UTC(year, month, day) + delta * 86_400_000)
    return dateInZone(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), schedule.hour, schedule.minute, schedule)
  }
  let candidate = dateInZone(year, month, day, schedule.hour, schedule.minute, schedule)
  if (candidate.getTime() <= now.getTime()) {
    const next = new Date(Date.UTC(year, month, day) + 86_400_000)
    candidate = dateInZone(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), schedule.hour, schedule.minute, schedule)
  }
  return candidate
}

export function normalizeScheduleTimeZone(raw: unknown): ScheduleTimeZone {
  return raw === "utc" ? "utc" : "local"
}

export function normalizeCadence(raw: unknown): ScheduleCadence {
  return raw === "weekly" ? "weekly" : "daily"
}

export function normalizePinMode(raw: unknown): TrafficPinMode {
  return raw === "all_found" ? "all_found" : "selected"
}

export function normalizeHour(raw: unknown): { value?: number; error?: string } {
  const hour = Number(raw)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: "Choose an hour between 0 and 23." }
  return { value: hour }
}

export function normalizeMinute(raw: unknown): { value?: number; error?: string } {
  const minute = Number(raw)
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return { error: "Choose a minute between 0 and 59." }
  return { value: minute }
}

export function normalizeWeekday(raw: unknown, cadence: ScheduleCadence): { value?: number; error?: string } {
  if (cadence !== "weekly") return { value: undefined }
  if (raw == null || raw === "") return { error: "Choose a weekday for a weekly schedule." }
  const weekday = Number(raw)
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: "Choose a weekday from Sunday to Saturday." }
  return { value: weekday }
}

export function normalizeUtcOffsetMinutes(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || Math.abs(value) > 16 * 60) return undefined
  return Math.round(value)
}

export function normalizeScanSchedule(raw: unknown): { value?: ScanSchedule; error?: string } {
  if (raw == null) return { value: defaultScanSchedule() }
  if (typeof raw !== "object") return { error: "That scan schedule is not valid." }
  const input = raw as Partial<ScanSchedule>
  const cadence = normalizeCadence(input.cadence)
  const hour = normalizeHour(input.hour)
  if (hour.error || hour.value == null) return { error: hour.error }
  const minute = normalizeMinute(input.minute)
  if (minute.error || minute.value == null) return { error: minute.error }
  const weekday = normalizeWeekday(input.weekday, cadence)
  if (weekday.error) return { error: weekday.error }
  const enabled = Boolean(input.enabled)
  return {
    value: {
      enabled,
      cadence,
      hour: hour.value,
      minute: minute.value,
      ...(weekday.value != null ? { weekday: weekday.value } : {}),
      timeZone: normalizeScheduleTimeZone(input.timeZone),
      utcOffsetMinutes: normalizeUtcOffsetMinutes(input.utcOffsetMinutes),
      lastRunAt: input.lastRunAt ?? null,
      nextRunAt: input.nextRunAt ?? null,
    },
  }
}

export function normalizeTrafficSchedule(raw: unknown): { value?: TrafficSchedule; error?: string } {
  if (raw == null) return { value: defaultTrafficSchedule() }
  if (typeof raw !== "object") return { error: "That traffic schedule is not valid." }
  const input = raw as Partial<TrafficSchedule>
  const base = normalizeScanSchedule(input)
  if (base.error || !base.value) return { error: base.error || "That traffic schedule is not valid." }
  const pinIds = Array.isArray(input.lastSelectedPinIds)
    ? [...new Set(input.lastSelectedPinIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
    : []
  const keywords = Array.isArray(input.lastSelectedKeywords)
    ? [...new Set(input.lastSelectedKeywords.map((keyword) => String(keyword ?? "").trim()).filter(Boolean))]
    : []
  const searches = Number(input.lastSearchCount)
  return {
    value: {
      ...base.value,
      pinMode: normalizePinMode(input.pinMode),
      lastSelectedPinIds: pinIds,
      lastSelectedKeywords: keywords,
      lastSearchCount: normalizeTrafficSearches(Number.isInteger(searches) ? searches : undefined),
    },
  }
}
