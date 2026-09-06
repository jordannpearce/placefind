import { chunkTasks, formatLocationCoordinate, mapsGridTask, type GridPoint } from "./grid.ts"
import { mapsPlaceUrl } from "./match.ts"
import { toStateAbbr, toStateName } from "./states.ts"
import type { BusinessListing, HoursRow, KeyTestResult, SearchQuery } from "./types.ts"

export { formatLocationCoordinate } from "./grid.ts"

const LIVE_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/live/advanced"
const TASK_POST_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/task_post"
const TASK_GET_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/task_get/advanced"
const USER_ENDPOINT = "https://api.dataforseo.com/v3/appendix/user_data"

export const TASK_PENDING = new Set([20100, 40601, 40602])
export const TASK_READY = 20000
export const TASK_GET_CONCURRENCY = 10
export const LIVE_FALLBACK_CONCURRENCY = 5
export const MIN_GRID_POLL_MS = 180_000
export const MAX_GRID_POLL_MS = 240_000

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

export function isPendingMapsStatus(code?: number | null): boolean {
  return Boolean(code && TASK_PENDING.has(code))
}

export function isEmptySerpMessage(message?: string | null): boolean {
  return /no search results/i.test(message || "")
}

export function itemsFromMapsTask(task: MapsTaskSnapshot | null | undefined): MapsItem[] {
  return task?.result?.[0]?.items ?? []
}

export function pinIdForCollectedCell(
  tag: string,
  cell: CollectedCell,
  points: GridPoint[],
): string | null {
  if (tag && points.some((point) => point.id === tag)) return tag
  const coord = cell.locationCoordinate?.trim()
  if (coord) {
    const match = points.find((point) => point.locationCoordinate === coord)
    if (match) return match.id
  }
  return tag || null
}

export function isFailedMapsStatus(code?: number | null, message?: string | null): boolean {
  if (isEmptySerpMessage(message)) return false
  return Boolean(code && code >= 40000 && !TASK_PENDING.has(code))
}

export function dataForSeoErrorMessage(payload: DfsResponse, httpStatus: number): string | null {
  if (isEmptySerpMessage(payload.status_message) || isEmptySerpMessage(payload.tasks?.[0]?.status_message)) {
    return null
  }
  if (httpStatus === 401 || payload.status_code === 40101 || payload.status_code === 40102) {
    return "DataForSEO rejected the login or API password."
  }
  if (httpStatus >= 400) {
    return payload.status_message || `DataForSEO returned HTTP ${httpStatus}.`
  }
  if (payload.status_code && isFailedMapsStatus(payload.status_code, payload.status_message)) {
    return payload.status_message || "DataForSEO request failed."
  }
  if (isPendingMapsStatus(payload.status_code)) return null
  const task = payload.tasks?.[0]
  if (isPendingMapsStatus(task?.status_code)) return null
  if (task?.status_code && isFailedMapsStatus(task.status_code, task.status_message)) {
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

export type PostedMapsTask = {
  id: string
  tag: string
}

export type CollectedCell = {
  items: MapsItem[] | null
  error: string | null
  locationCoordinate?: string
}

export type MapsTaskSnapshot = {
  id?: string
  status_code?: number
  status_message?: string
  data?: { tag?: string; location_coordinate?: string }
  result?: Array<{ items?: MapsItem[] | null } | null> | null
}

export type MapsGridClient = {
  postTasks: (tasks: ReturnType<typeof mapsGridTask>[]) => Promise<PostedMapsTask[]>
  getTask: (id: string) => Promise<MapsTaskSnapshot | null>
  liveAtCoordinate: (keyword: string, point: GridPoint) => Promise<{ items: MapsItem[]; error: string | null }>
}

export type ScanMapsGridOptions = {
  client?: MapsGridClient
  pollTimeoutMs?: number
  sleep?: (ms: number) => Promise<void>
  onCell?: (cell: GridCellResult, done: number, total: number) => void | Promise<void>
}

export function gridPollTimeoutMs(pointCount: number): number {
  const estimated = Math.max(1, pointCount) * 4_000
  return Math.min(MAX_GRID_POLL_MS, Math.max(MIN_GRID_POLL_MS, estimated))
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return
  let index = 0
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      try {
        await worker(items[current]!)
      } catch {
        // One pin must not abort the rest of the grid.
      }
    }
  })
  await Promise.all(runners)
}

async function settle<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}

export function postedTasksFromResponse(
  requested: ReturnType<typeof mapsGridTask>[],
  tasks: MapsTaskSnapshot[] | undefined,
): { posted: PostedMapsTask[]; failed: ReturnType<typeof mapsGridTask>[] } {
  const posted: PostedMapsTask[] = []
  const failed: ReturnType<typeof mapsGridTask>[] = []
  const byTag = new Map<string, MapsTaskSnapshot>()
  for (const task of tasks ?? []) {
    const tag = task.data?.tag?.trim()
    if (tag) byTag.set(tag, task)
  }
  requested.forEach((row, index) => {
    const tag = row.tag || ""
    const byCoord = (tasks ?? []).find((task) => task.data?.location_coordinate === row.location_coordinate)
    const task = (tag && byTag.get(tag)) || byCoord || tasks?.[index]
    if (task?.id && !isFailedMapsStatus(task.status_code, task.status_message)) {
      posted.push({ id: task.id, tag: tag || task.data?.tag || "" })
      return
    }
    failed.push(row)
  })
  return { posted, failed }
}

async function postMapsTaskChunk(
  chunk: ReturnType<typeof mapsGridTask>[],
  login: string,
  password: string,
): Promise<{ posted: PostedMapsTask[]; failed: ReturnType<typeof mapsGridTask>[] }> {
  const { payload, error } = await dfsJson(TASK_POST_ENDPOINT, login, password, {
    method: "POST",
    body: JSON.stringify(chunk),
  }, 30_000)
  if (error && !(payload.tasks && payload.tasks.length > 0)) {
    return { posted: [], failed: chunk }
  }
  return postedTasksFromResponse(chunk, payload.tasks)
}

async function postMapsTasks(
  tasks: ReturnType<typeof mapsGridTask>[],
  login: string,
  password: string,
): Promise<PostedMapsTask[]> {
  const posted: PostedMapsTask[] = []
  let retryable: ReturnType<typeof mapsGridTask>[] = []
  for (const chunk of chunkTasks(tasks)) {
    const first = await postMapsTaskChunk(chunk, login, password)
    posted.push(...first.posted)
    retryable.push(...first.failed)
  }
  if (retryable.length > 0) {
    const leftover: ReturnType<typeof mapsGridTask>[] = []
    for (const chunk of chunkTasks(retryable)) {
      const again = await postMapsTaskChunk(chunk, login, password)
      posted.push(...again.posted)
      leftover.push(...again.failed)
    }
    retryable = leftover
  }
  return posted
}

async function getMapsTask(id: string, login: string, password: string): Promise<DfsTask | null> {
  const { payload, error } = await dfsJson(`${TASK_GET_ENDPOINT}/${id}`, login, password, { method: "GET" }, 20_000)
  if (error && !payload.tasks?.[0]) return null
  return payload.tasks?.[0] ?? null
}

export async function collectPostedTasks(
  posted: PostedMapsTask[],
  getTask: (id: string) => Promise<MapsTaskSnapshot | null>,
  timeoutMs: number,
  wait: (ms: number) => Promise<void> = sleep,
  onReady?: (tag: string, cell: CollectedCell) => void | Promise<void>,
): Promise<Map<string, CollectedCell>> {
  const byTag = new Map<string, CollectedCell>()
  const pending = new Map(posted.map((row) => [row.id, row.tag]))
  const started = Date.now()
  let delay = 1200
  const store = async (tag: string, cell: CollectedCell) => {
    byTag.set(tag, cell)
    try {
      await onReady?.(tag, cell)
    } catch {
      // Progress updates must not abort remaining pins.
    }
  }
  while (pending.size > 0 && Date.now() - started < timeoutMs) {
    const ids = [...pending.keys()]
    await runPool(ids, TASK_GET_CONCURRENCY, async (id) => {
      const tag = pending.get(id)
      if (tag == null) return
      const task = await settle(() => getTask(id), null)
      const code = task?.status_code ?? 0
      if (code === TASK_READY || isEmptySerpMessage(task?.status_message)) {
        pending.delete(id)
        await store(tag, {
          items: itemsFromMapsTask(task),
          error: null,
          locationCoordinate: task?.data?.location_coordinate,
        })
        return
      }
      if (isFailedMapsStatus(code, task?.status_message)) {
        pending.delete(id)
        await store(tag, {
          items: null,
          error: task?.status_message || "Maps search could not finish this point.",
          locationCoordinate: task?.data?.location_coordinate,
        })
      }
    })
    if (pending.size === 0) break
    await wait(delay)
    delay = Math.min(8000, Math.round(delay * 1.4))
  }
  return byTag
}

async function retryFailedGets(
  posted: PostedMapsTask[],
  collected: Map<string, CollectedCell>,
  getTask: (id: string) => Promise<MapsTaskSnapshot | null>,
): Promise<void> {
  const failed = posted.filter((row) => {
    const entry = collected.get(row.tag)
    return Boolean(entry && entry.items == null && entry.error)
  })
  if (failed.length === 0) return
  await runPool(failed, TASK_GET_CONCURRENCY, async (row) => {
    const task = await settle(() => getTask(row.id), null)
    const code = task?.status_code ?? 0
    if (code === TASK_READY || isEmptySerpMessage(task?.status_message)) {
      collected.set(row.tag, {
        items: itemsFromMapsTask(task),
        error: null,
        locationCoordinate: task?.data?.location_coordinate,
      })
    }
  })
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
  }, 30_000)
  const task = payload.tasks?.[0]
  if (isPendingMapsStatus(task?.status_code) || isPendingMapsStatus(payload.status_code)) {
    return { items: [], error: "Maps search is still running." }
  }
  if (isEmptySerpMessage(error) || isEmptySerpMessage(task?.status_message)) {
    return { items: task?.result?.[0]?.items ?? [], error: null }
  }
  if (error) return { items: [], error }
  return { items: task?.result?.[0]?.items ?? [], error: null }
}

async function liveWithRetry(
  keyword: string,
  point: GridPoint,
  liveAtCoordinate: MapsGridClient["liveAtCoordinate"],
): Promise<{ items: MapsItem[]; error: string | null }> {
  const first = await settle(() => liveAtCoordinate(keyword, point), { items: [], error: "Could not reach Maps." })
  if (!first.error) return first
  return settle(() => liveAtCoordinate(keyword, point), { items: [], error: first.error || "Could not reach Maps." })
}

export function defaultMapsGridClient(login: string, password: string): MapsGridClient {
  return {
    postTasks: (tasks) => postMapsTasks(tasks, login, password),
    getTask: (id) => getMapsTask(id, login, password),
    liveAtCoordinate: (keyword, point) => liveMapsAtCoordinate(keyword, point, login, password),
  }
}

export function finalizeGridCells(points: GridPoint[], results: Map<string, GridCellResult>): GridCellResult[] {
  return points.map((point) => {
    const row = results.get(point.id)
    if (row) return { point: row.point, items: row.items ?? [], error: row.error }
    return { point, items: [], error: "Maps search did not return this grid point." }
  })
}

/** One Maps SERP task per grid cell. Prefers batched task_post (≤100/POST) then task_get; live/advanced fallback per remaining pin. */
export async function scanMapsGrid(
  points: GridPoint[],
  keyword: string,
  login: string,
  password: string,
  options?: ScanMapsGridOptions,
): Promise<GridCellResult[]> {
  const client = options?.client ?? defaultMapsGridClient(login, password)
  const wait = options?.sleep ?? sleep
  const results = new Map<string, GridCellResult>()
  const mark = async (point: GridPoint, items: MapsItem[], error: string | null) => {
    const cell = { point, items: items ?? [], error }
    results.set(point.id, cell)
    try {
      await options?.onCell?.(cell, results.size, points.length)
    } catch {
      // Progress updates must not abort remaining pins.
    }
  }

  const tasks = points.map((point) => mapsGridTask(keyword, point.locationCoordinate, point.id))
  const posted = await settle(() => client.postTasks(tasks), [])
  const collected = await settle(
    () =>
      collectPostedTasks(
        posted,
        (id) => client.getTask(id),
        options?.pollTimeoutMs ?? gridPollTimeoutMs(points.length),
        wait,
        async (tag, cell) => {
          const pinId = pinIdForCollectedCell(tag, cell, points)
          const point = points.find((row) => row.id === pinId)
          if (point && cell.items != null) await mark(point, cell.items, null)
        },
      ),
    new Map<string, CollectedCell>(),
  )
  await settle(() => retryFailedGets(posted, collected, (id) => client.getTask(id)), undefined)
  for (const point of points) {
    if (results.has(point.id)) continue
    const entry =
      collected.get(point.id) ||
      [...collected.entries()].find(([, cell]) => cell.locationCoordinate === point.locationCoordinate)?.[1]
    if (entry && entry.items != null) await mark(point, entry.items, null)
  }

  const remaining = points.filter((point) => !results.has(point.id))
  await runPool(remaining, LIVE_FALLBACK_CONCURRENCY, async (point) => {
    const live = await liveWithRetry(keyword, point, client.liveAtCoordinate)
    await mark(point, live.items, live.error)
  })

  return finalizeGridCells(points, results)
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
