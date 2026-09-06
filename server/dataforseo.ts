import { mapsPlaceUrl } from "./match.ts"
import { toStateAbbr, toStateName } from "./states.ts"
import type { BusinessListing, HoursRow, KeyTestResult, SearchQuery } from "./types.ts"

const LIVE_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/live/advanced"
const USER_ENDPOINT = "https://api.dataforseo.com/v3/appendix/user_data"

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

type MapsItem = {
  type?: string
  title?: string | null
  url?: string | null
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

type DfsResponse = {
  status_code?: number
  status_message?: string
  tasks?: Array<{
    status_code?: number
    status_message?: string
    result?: Array<{ items?: MapsItem[] | null } | null> | null
  }>
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

export async function searchDataForSeo(
  query: SearchQuery,
  login: string,
  password: string,
  mapsKeyword?: string,
): Promise<{ hits: BusinessListing[]; error: string | null }> {
  const location = [query.city, toStateName(query.state), "United States"].filter(Boolean).join(",")
  const keyword = mapsKeyword?.trim() || [query.name, query.city, toStateName(query.state)].filter(Boolean).join(" ")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const response = await fetch(LIVE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: basicAuth(login, password),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          language_code: "en",
          location_name: location || "United States",
          keyword,
          depth: 20,
          search_places: true,
        },
      ]),
      signal: controller.signal,
    })
    const payload = (await response.json()) as DfsResponse
    const error = dataForSeoErrorMessage(payload, response.status)
    if (error) return { hits: [], error }
    const items = payload.tasks?.[0]?.result?.[0]?.items ?? []
    const hits = items
      .filter((item) => item.type === "maps_search" || item.type === "maps_paid_item")
      .map((item) => toListing(item, query))
      .filter((item): item is BusinessListing => Boolean(item))
    return { hits, error: null }
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "DataForSEO timed out." : "Could not reach DataForSEO."
    return { hits: [], error: message }
  } finally {
    clearTimeout(timer)
  }
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
