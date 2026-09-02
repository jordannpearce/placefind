import { formatCoordinate } from "./grid"
import { namesMatch } from "./rank"
import type { DeviceType, Listing, PointResult, ScanMode } from "./types"

const LIVE_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/live/advanced"

type DataForSeoRating = {
  value?: number | null
  votes_count?: number | null
}

type DataForSeoItem = {
  type?: string
  rank_group?: number
  rank_absolute?: number
  domain?: string | null
  title?: string | null
  url?: string | null
  address?: string | null
  place_id?: string | null
  cid?: string | null
  phone?: string | null
  category?: string | null
  latitude?: number | null
  longitude?: number | null
  rating?: DataForSeoRating | null
}

type DataForSeoTask = {
  status_code?: number
  status_message?: string
  result?: Array<{
    items?: DataForSeoItem[] | null
  } | null> | null
}

type DataForSeoResponse = {
  status_code?: number
  status_message?: string
  tasks?: DataForSeoTask[]
}

export type DataForSeoAuth = {
  login: string
  password: string
}

export function envDataForSeoAuth(): DataForSeoAuth | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim()
  const password = process.env.DATAFORSEO_PASSWORD?.trim()
  if (!login || !password) return null
  return { login, password }
}

export function resolveDataForSeoAuth(user?: Partial<DataForSeoAuth> | null): DataForSeoAuth | null {
  const login = user?.login?.trim()
  const password = user?.password?.trim()
  if (login && password) return { login, password }
  return envDataForSeoAuth()
}

/** Prefer keys from the request, then the signed-in account, then server env. */
export async function resolveRequestAuth(input?: {
  login?: string
  password?: string
} | null): Promise<DataForSeoAuth | null> {
  const fromBody = resolveDataForSeoAuth(input)
  if (fromBody) return fromBody
  try {
    const { requireUser } = await import("@/lib/auth-guard")
    const session = await requireUser()
    if (!session) return envDataForSeoAuth()
    return resolveDataForSeoAuth({
      login: session.user.dfsLogin || session.workspace.settings.login,
      password: session.user.dfsPassword || session.workspace.settings.password,
    })
  } catch {
    return envDataForSeoAuth()
  }
}

export function hasDataForSeoCredentials(user?: Partial<DataForSeoAuth> | null): boolean {
  return Boolean(resolveDataForSeoAuth(user))
}

export function getScanMode(
  forceMock?: boolean,
  user?: Partial<DataForSeoAuth> | null
): ScanMode {
  if (forceMock || !hasDataForSeoCredentials(user)) return "mock"
  return "live"
}

export async function verifyDataForSeoAuth(auth: DataForSeoAuth): Promise<{ ok: boolean; message: string }> {
  try {
    const cred = Buffer.from(`${auth.login}:${auth.password}`).toString("base64")
    const response = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      headers: { Authorization: `Basic ${cred}` },
    })
    const payload = (await response.json()) as { status_code?: number; status_message?: string }
    if (!response.ok || (payload.status_code && payload.status_code >= 40000)) {
      return { ok: false, message: payload.status_message || `HTTP ${response.status}` }
    }
    return { ok: true, message: "DataForSEO account connected." }
  } catch {
    return { ok: false, message: "Could not reach DataForSEO." }
  }
}

export async function fetchMapsPoint(input: {
  keyword: string
  targetBusiness: string
  targetPlaceId?: string
  lat: number
  lng: number
  zoom: number
  languageCode: string
  device: DeviceType
  depth: number
  pointId: string
  auth?: DataForSeoAuth | null
}): Promise<PointResult> {
  const locationCoordinate = formatCoordinate(input.lat, input.lng, input.zoom)
  const resolved = resolveDataForSeoAuth(input.auth)

  if (!resolved) {
    throw new Error("DataForSEO credentials are not configured")
  }

  const auth = Buffer.from(`${resolved.login}:${resolved.password}`).toString("base64")
  const response = await fetch(LIVE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        language_code: input.languageCode,
        location_coordinate: locationCoordinate,
        keyword: input.keyword,
        device: input.device,
        depth: input.depth,
        search_this_area: true,
        search_places: false,
      },
    ]),
  })

  if (!response.ok) {
    throw new Error(`DataForSEO returned HTTP ${response.status}`)
  }

  const payload = (await response.json()) as DataForSeoResponse
  if (payload.status_code && payload.status_code >= 40000) {
    throw new Error(payload.status_message || "DataForSEO request failed")
  }

  const task = payload.tasks?.[0]
  if (!task) {
    throw new Error("DataForSEO returned no tasks")
  }
  if (task.status_code && task.status_code >= 40000) {
    throw new Error(task.status_message || "DataForSEO task failed")
  }

  const items = task.result?.[0]?.items ?? []
  const listings = items
    .filter((item) => item.type === "maps_search" || item.type === "maps_paid_item")
    .map((item) => toListing(item))

  return matchTarget({
    id: input.pointId,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate,
    listings,
    targetBusiness: input.targetBusiness,
    targetPlaceId: input.targetPlaceId,
  })
}

export function matchTarget(input: {
  id: string
  lat: number
  lng: number
  locationCoordinate: string
  listings: Listing[]
  targetBusiness: string
  targetPlaceId?: string
}): PointResult {
  const match = input.listings.find((listing) => {
    if (listing.isPaid) return false
    if (input.targetPlaceId && listing.placeId === input.targetPlaceId) return true
    return namesMatch(listing.title, input.targetBusiness)
  })

  return {
    id: input.id,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate: input.locationCoordinate,
    rank: match?.rankGroup ?? match?.rankAbsolute ?? null,
    found: Boolean(match),
    listings: input.listings,
    error: null,
  }
}

function toListing(item: DataForSeoItem): Listing {
  const isPaid = item.type === "maps_paid_item"
  return {
    rankAbsolute: item.rank_absolute ?? 0,
    rankGroup: item.rank_group ?? 0,
    type: isPaid ? "maps_paid_item" : "maps_search",
    title: item.title ?? "Untitled listing",
    domain: item.domain ?? null,
    address: item.address ?? null,
    placeId: item.place_id ?? null,
    cid: item.cid ?? null,
    phone: item.phone ?? null,
    category: item.category ?? null,
    rating: item.rating?.value ?? null,
    reviews: item.rating?.votes_count ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    url: item.url ?? null,
    isPaid,
  }
}
