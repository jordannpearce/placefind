import { chunkTasks, formatLocationCoordinate, mapsGridTask, type GridPoint } from "./grid.ts"
import { mapsPlaceUrl } from "./match.ts"
import { toStateAbbr, toStateName } from "./states.ts"
import type { BusinessListing, HoursRow, KeyTestResult, SearchQuery } from "./types.ts"

export { formatLocationCoordinate } from "./grid.ts"

const LIVE_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/live/advanced"
const TASK_POST_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/task_post"
const TASK_GET_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/task_get/advanced"
const USER_ENDPOINT = "https://api.dataforseo.com/v3/appendix/user_data"

const TASK_PENDING = new Set([20100, 40601, 40602])
const TASK_READY = 20000

type Rating = {
  value?: number | null
  votes_count?: number | null
}

type AddressInfo = {
  address?: string | null
  city?: string | null
  zip?: string | null
  region?: string | null
}

type TimePoint = { hour?: number; minute?: number }
type Shift = { open?: TimePoint; close?: TimePoint }

type WorkHours = {
  current_status?: string | null
  timetable?: Record<string, Shift[] | null> | null
}

export type MapsItem = {
  type?: string
  rank_group?: number | null
  rank_absolute?: number | null
  title?: string | null
  original_title?: string | null
  url?: string | null
  domain?: string | null
  address?: string | null
  address_info?: AddressInfo | null
  place_id?: string | null
  cid?: string | number | null
  phone?: string | null
  category?: string | null
  additional_categories?: string[] | null
  latitude?: number | null
  longitude?: number | null
  rating?: Rating | null
  work_hours?: WorkHours | null
  is_claimed?: boolean | null
  price_level?: string | null
  main_image?: string | null
}

type DfsTask = {
  id?: string
  status_code?: number
  status_message?: string
  data?: { tag?: string; location_coordinate?: string; keyword?: string }
  result?: Array<{ items?: MapsItem[] | null } | null> | null
}

type DfsResponse = {
  status_code?: number
  status_message?: string
  tasks?: DfsTask[]
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

function basicAuth(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`
}

function formatClock(point?: TimePoint): string {
  if (point?.hour == null) return ""
  const minute = String(point.minute ?? 0).padStart(2, "0")
  const hour24 = point.hour
  const suffix = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${minute} ${suffix}`
}

function formatShifts(shifts: Shift[] | null | undefined): string {
  if (!shifts?.length) return "Closed"
  return shifts
    .map((shift) => {
      const open = formatClock(shift.open)
      const close = formatClock(shift.close)
      if (!open || !close) return ""
      return `${open}–${close}`
    })
    .filter(Boolean)
    .join(", ") || "Closed"
}

export function formatWorkHours(workHours?: WorkHours | null): { summary: string | null; rows: HoursRow[]; status: string | null } {
  const status = workHours?.current_status?.replace(/_/g, " ") ?? null
  const timetable = workHours?.timetable
  if (!timetable) return { summary: status, rows: [], status }

  const rows = DAY_ORDER.map((day) => ({
    day: day.slice(0, 1).toUpperCase() + day.slice(1),
    hours: formatShifts(timetable[day]),
  }))
  const unique = [...new Set(rows.map((row) => row.hours))]
  const summary = unique.length === 1 ? `${unique[0]} daily` : rows.map((row) => `${row.day.slice(0, 3)} ${row.hours}`).join(" · ")
  return { summary, rows, status }
}

export function dataForSeoErrorMessage(payload: DfsResponse, httpStatus: number): string | null {
  if (httpStatus === 401 || payload.status_code === 40101 || payload.status_code === 40102) {
    return "DataForSEO rejected the login or API password."
  }
  if (httpStatus >= 400) {
    return payload.status_message || `DataForSEO returned HTTP ${httpStatus}.`
  }
  if (payload.status_code && payload.status_code >= 40000) {
    return payload.status_message || "DataForSEO request failed."
  }
  const task = payload.tasks?.[0]
  if (task?.status_code && task.status_code >= 40000) {
    return task.status_message || "DataForSEO could not finish the Maps search."
  }
  return null
}

function toListing(item: MapsItem, query: SearchQuery): BusinessListing | null {
  if (!item.title) return null
  const hours = formatWorkHours(item.work_hours)
  const listing: BusinessListing = {
    title: item.title,
    address: item.address || [item.address_info?.address, item.address_info?.city, query.state].filter(Boolean).join(", "),
    city: item.address_info?.city || query.city,
    state: toStateAbbr(item.address_info?.region || query.state),
    phone: item.phone ?? null,
    website: item.url && !/google\./i.test(item.url) ? item.url : null,
    category: item.category ?? null,
    categories: item.additional_categories ?? [],
    rating: item.rating?.value ?? null,
    reviewCount: item.rating?.votes_count ?? null,
    hours: hours.summary,
    hoursDetail: hours.rows,
    currentStatus: hours.status,
    claimed: item.is_claimed ?? null,
    priceLevel: item.price_level ?? null,
    placeId: item.place_id ?? null,
    cid: item.cid != null ? String(item.cid) : null,
    lat: item.latitude ?? null,
    lng: item.longitude ?? null,
    mapsUrl: "",
    image: item.main_image ?? null,
    source: "dataforseo",
    matchScore: 0,
    isBestMatch: false,
  }
  listing.mapsUrl = mapsPlaceUrl(listing)
  return listing
}

export type MapsCoordinate = {
  lat: number
  lng: number
  zoom?: number
}

export type MapsSearchOptions = {
  keyword?: string
  coordinate?: MapsCoordinate
  depth?: number
  timeoutMs?: number
  searchPlaces?: boolean
}

export type GridCellResult = {
  point: GridPoint
  items: MapsItem[]
  error: string | null
}

function listingsFromItems(items: MapsItem[] | null | undefined, query: SearchQuery): BusinessListing[] {
  return (items ?? [])
    .filter((item) => item.type === "maps_search" || item.type === "maps_paid_item")
    .map((item) => toListing(item, query))
    .filter((item): item is BusinessListing => Boolean(item))
}

async function dfsJson(
  url: string,
  login: string,
  password: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ payload: DfsResponse; httpStatus: number; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: basicAuth(login, password),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
    const payload = (await response.json()) as DfsResponse
    return { payload, httpStatus: response.status, error: dataForSeoErrorMessage(payload, response.status) }
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "DataForSEO timed out." : "Could not reach DataForSEO."
    return { payload: {}, httpStatus: 0, error: message }
  } finally {
    clearTimeout(timer)
  }
}

export async function searchDataForSeo(
  query: SearchQuery,
  login: string,
  password: string,
  mapsKeyword?: string | MapsSearchOptions,
  coordinate?: MapsCoordinate,
): Promise<{ hits: BusinessListing[]; items: MapsItem[]; error: string | null }> {
  const options: MapsSearchOptions =
    typeof mapsKeyword === "object" && mapsKeyword
      ? mapsKeyword
      : { keyword: mapsKeyword, coordinate }
  const location = [query.city, toStateName(query.state), "United States"].filter(Boolean).join(",")
  const keyword = options.keyword?.trim() || [query.name, query.city, toStateName(query.state)].filter(Boolean).join(" ")
  const point = options.coordinate
  const task = {
    language_code: "en",
    keyword,
    depth: options.depth ?? 20,
    search_places: options.searchPlaces ?? !point,
    ...(point
      ? { location_coordinate: formatLocationCoordinate(point.lat, point.lng, point.zoom) }
      : { location_name: location || "United States" }),
  }
  const { payload, error } = await dfsJson(LIVE_ENDPOINT, login, password, {
    method: "POST",
    body: JSON.stringify([task]),
  }, options.timeoutMs ?? 25_000)
  if (error) return { hits: [], items: [], error }
  const items = payload.tasks?.[0]?.result?.[0]?.items ?? []
  return { hits: listingsFromItems(items, query), items, error: null }
}

async function postMapsTasks(
  tasks: ReturnType<typeof mapsGridTask>[],
  login: string,
  password: string,
): Promise<{ id: string; tag: string }[]> {
  const posted: { id: string; tag: string }[] = []
  for (const chunk of chunkTasks(tasks)) {
    const { payload, error } = await dfsJson(TASK_POST_ENDPOINT, login, password, {
      method: "POST",
      body: JSON.stringify(chunk),
    }, 30_000)
    if (error) throw new Error(error)
    for (const task of payload.tasks ?? []) {
      const tag = task.data?.tag || ""
      if (task.id && (!task.status_code || task.status_code < 40000)) {
        posted.push({ id: task.id, tag })
      }
    }
  }
  return posted
}

async function getMapsTask(id: string, login: string, password: string): Promise<DfsTask | null> {
  const { payload, error } = await dfsJson(`${TASK_GET_ENDPOINT}/${id}`, login, password, { method: "GET" }, 20_000)
  if (error && !payload.tasks?.[0]) return null
  return payload.tasks?.[0] ?? null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function collectPostedTasks(
  posted: { id: string; tag: string }[],
  login: string,
  password: string,
  timeoutMs = 75_000,
): Promise<Map<string, MapsItem[] | null>> {
  const byTag = new Map<string, MapsItem[] | null>()
  const pending = new Map(posted.map((row) => [row.id, row.tag]))
  const started = Date.now()
  let delay = 1500
  while (pending.size > 0 && Date.now() - started < timeoutMs) {
    for (const [id, tag] of [...pending]) {
      const task = await getMapsTask(id, login, password)
      const code = task?.status_code ?? 0
      if (code === TASK_READY) {
        byTag.set(tag, task?.result?.[0]?.items ?? [])
        pending.delete(id)
        continue
      }
      if (code && !TASK_PENDING.has(code) && code >= 40000) {
        byTag.set(tag, null)
        pending.delete(id)
      }
    }
    if (pending.size === 0) break
    await sleep(delay)
    delay = Math.min(8000, Math.round(delay * 1.4))
  }
  return byTag
}

async function liveMapsAtCoordinate(
  keyword: string,
  point: GridPoint,
  login: string,
  password: string,
): Promise<{ items: MapsItem[]; error: string | null }> {
  const { payload, error } = await dfsJson(LIVE_ENDPOINT, login, password, {
    method: "POST",
    body: JSON.stringify([mapsGridTask(keyword, point.locationCoordinate, point.id)]),
  }, 25_000)
  if (error) return { items: [], error }
  return { items: payload.tasks?.[0]?.result?.[0]?.items ?? [], error: null }
}

/** One Maps SERP task per grid cell. Prefers batched task_post (≤100/POST) then task_get; live/advanced fallback. */
export async function scanMapsGrid(
  points: GridPoint[],
  keyword: string,
  login: string,
  password: string,
): Promise<GridCellResult[]> {
  const results = new Map<string, GridCellResult>()
  const mark = (point: GridPoint, items: MapsItem[], error: string | null) => {
    results.set(point.id, { point, items, error })
  }

  try {
    const tasks = points.map((point) => mapsGridTask(keyword, point.locationCoordinate, point.id))
    const posted = await postMapsTasks(tasks, login, password)
    const collected = await collectPostedTasks(posted, login, password)
    for (const point of points) {
      if (collected.has(point.id)) {
        const items = collected.get(point.id)
        if (items) mark(point, items, null)
      }
    }
  } catch {
    // Fall through to live/advanced per remaining cell.
  }

  const remaining = points.filter((point) => !results.has(point.id))
  const concurrency = 5
  for (let index = 0; index < remaining.length; index += concurrency) {
    const batch = remaining.slice(index, index + concurrency)
    const settled = await Promise.all(batch.map((point) => liveMapsAtCoordinate(keyword, point, login, password)))
    batch.forEach((point, offset) => {
      const live = settled[offset]!
      mark(point, live.items, live.error)
    })
  }

  return points.map((point) => results.get(point.id) ?? { point, items: [], error: "Maps search did not return this grid point." })
}

export async function testDataForSeo(login: string, password: string): Promise<KeyTestResult> {
  try {
    const response = await fetch(USER_ENDPOINT, {
      headers: { Authorization: basicAuth(login, password) },
    })
    const payload = (await response.json()) as {
      status_code?: number
      status_message?: string
      tasks?: Array<{ result?: Array<{ money?: { balance?: number } }> }>
    }
    if (response.status === 401 || (payload.status_code && payload.status_code >= 40000)) {
      return {
        ok: false,
        service: "dataforseo",
        message: "Login or API password is wrong.",
        detail: payload.status_message,
      }
    }
    const balance = payload.tasks?.[0]?.result?.[0]?.money?.balance
    return {
      ok: true,
      service: "dataforseo",
      message: balance != null ? `Connected. Balance $${Number(balance).toFixed(2)}.` : "Connected.",
    }
  } catch {
    return { ok: false, service: "dataforseo", message: "Could not reach DataForSEO." }
  }
}
