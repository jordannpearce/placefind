import { formatCoordinate } from "./grid"
import { listingMatchesTarget } from "./rank"
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
  original_title?: string | null
  url?: string | null
  address?: string | null
  place_id?: string | null
  cid?: string | number | null
  phone?: string | null
  category?: string | null
  latitude?: number | null
  longitude?: number | null
  rating?: DataForSeoRating | null
  items?: DataForSeoItem[] | null
}

const LISTING_TYPES = new Set([
  "maps_search",
  "maps_paid_item",
  "maps_organic",
  "local_pack",
  "map",
  "maps",
])

const SKIP_TYPES = new Set([
  "refinement_chips",
  "refinement_chips_element",
  "refinement_chips_option",
])

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

/** Process env keys. Only the admin account (acting as itself) may use these. */
export function envDataForSeoAuth(): DataForSeoAuth | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim()
  const password = process.env.DATAFORSEO_PASSWORD?.trim()
  if (!login || !password) return null
  return { login, password }
}

/** That account's saved login+password only. Never env, admin, or global keys. */
export function resolveDataForSeoAuth(user?: Partial<DataForSeoAuth> | null): DataForSeoAuth | null {
  const login = user?.login?.trim()
  const password = user?.password?.trim()
  if (login && password) return { login, password }
  return null
}

/**
 * Keys for this request:
 * 1. Complete login+password on the request (the caller is saving/testing their own).
 * 2. The viewed account's saved keys (impersonation uses the viewed user only).
 * 3. Env keys only when the viewed user is the admin acting as themselves.
 *
 * Regular users never inherit admin or DATAFORSEO_* env credentials.
 */
export async function resolveRequestAuth(input?: {
  login?: string
  password?: string
} | null): Promise<DataForSeoAuth | null> {
  const fromBody = resolveDataForSeoAuth(input)
  if (fromBody) return fromBody
  try {
    const { requireAdmin, requireUser } = await import("@/lib/auth-guard")
    const session = await requireUser()
    if (!session) return null
    const fromUser = resolveDataForSeoAuth({
      login: session.user.dfsLogin || session.workspace.settings.login,
      password: session.user.dfsPassword || session.workspace.settings.password,
    })
    if (fromUser) return fromUser
    const admin = await requireAdmin()
    const impersonating = Boolean(admin && admin.user.id !== session.user.id)
    if (admin && !impersonating && session.user.role === "admin") {
      return envDataForSeoAuth()
    }
    return null
  } catch {
    return null
  }
}

export function hasDataForSeoCredentials(user?: Partial<DataForSeoAuth> | null): boolean {
  return Boolean(resolveDataForSeoAuth(user))
}

/** Live only when THIS user has keys. Sample-data checkbox must not mock a user who has keys. */
export function getScanMode(
  _forceMock?: boolean,
  user?: Partial<DataForSeoAuth> | null
): ScanMode {
  if (hasDataForSeoCredentials(user)) return "live"
  return "mock"
}

/**
 * One Maps live/advanced task for a single grid cell.
 * `location_coordinate` IS that cell’s GPS (`lat,lng,zoomz`).
 * Do not send `location_code` / `location_name` (e.g. United States / 2840) —
 * those ignore the lattice and search a national centroid.
 */
export function mapsLiveTask(input: {
  keyword: string
  languageCode: string
  locationCoordinate: string
  device: DeviceType
  depth: number
}) {
  return {
    keyword: input.keyword,
    language_code: input.languageCode?.trim() || "en",
    location_coordinate: input.locationCoordinate,
    device: input.device === "mobile" ? "mobile" : "desktop",
    depth: Math.min(Math.max(Math.round(input.depth || 20), 1), 700),
    search_this_area: true,
    search_places: false,
  }
}

export function dataForSeoErrorMessage(
  payload: DataForSeoResponse | null | undefined,
  httpStatus?: number
): string | null {
  const task = payload?.tasks?.[0]
  const taskCode = Number(task?.status_code ?? 0)
  const topCode = Number(payload?.status_code ?? 0)
  const code = taskCode >= 40000 ? taskCode : topCode >= 40000 ? topCode : 0
  const message = (
    (taskCode >= 40000 ? task?.status_message : "") ||
    (topCode >= 40000 ? payload?.status_message : "") ||
    task?.status_message ||
    payload?.status_message ||
    ""
  )
    .toString()
    .replace(/\.$/, "")
    .trim()

  if (code >= 40000) {
    return message ? `DataForSEO ${code}: ${message}` : `DataForSEO error ${code}`
  }
  if (httpStatus && httpStatus >= 400) {
    return message
      ? `DataForSEO HTTP ${httpStatus}: ${message}`
      : `DataForSEO returned HTTP ${httpStatus}`
  }
  return null
}

async function readDataForSeoJson(response: Response): Promise<DataForSeoResponse> {
  const raw = await response.text()
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw) as DataForSeoResponse
  } catch {
    throw new Error(
      response.ok
        ? "DataForSEO returned an unreadable response"
        : `DataForSEO returned HTTP ${response.status}`
    )
  }
}

export async function verifyDataForSeoAuth(auth: DataForSeoAuth): Promise<{ ok: boolean; message: string }> {
  try {
    const cred = Buffer.from(`${auth.login}:${auth.password}`).toString("base64")
    const response = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      headers: { Authorization: `Basic ${cred}` },
    })
    const payload = await readDataForSeoJson(response)
    const error = dataForSeoErrorMessage(payload, response.status)
    if (error) return { ok: false, message: error }
    return { ok: true, message: "DataForSEO account connected." }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach DataForSEO.",
    }
  }
}

export async function fetchMapsPoint(input: {
  keyword: string
  targetBusiness: string
  targetPlaceId?: string
  targetCid?: string
  targetLat?: number
  targetLng?: number
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
      mapsLiveTask({
        keyword: input.keyword,
        languageCode: input.languageCode,
        locationCoordinate,
        device: input.device,
        depth: input.depth,
      }),
    ]),
  })

  const payload = await readDataForSeoJson(response)
  const dfsError = dataForSeoErrorMessage(payload, response.status)
  if (dfsError) {
    throw new Error(dfsError)
  }
  if (!response.ok) {
    throw new Error(`DataForSEO returned HTTP ${response.status}`)
  }

  const task = payload.tasks?.[0]
  if (!task) {
    throw new Error("DataForSEO returned no tasks")
  }

  const listings = listingsFromTask(task)

  return matchTarget({
    id: input.pointId,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate,
    listings,
    targetBusiness: input.targetBusiness,
    targetPlaceId: input.targetPlaceId,
    targetCid: input.targetCid,
    targetLat: input.targetLat,
    targetLng: input.targetLng,
  })
}

export function collectMapsItems(task: DataForSeoTask | undefined | null): DataForSeoItem[] {
  const blocks = task?.result
  if (!Array.isArray(blocks)) return []
  const out: DataForSeoItem[] = []
  const visit = (item: DataForSeoItem | null | undefined) => {
    if (!item) return
    if (Array.isArray(item.items) && item.items.length > 0) {
      for (const child of item.items) visit(child)
      return
    }
    out.push(item)
  }
  for (const block of blocks) {
    const items = block?.items
    if (!Array.isArray(items)) continue
    for (const item of items) visit(item)
  }
  return out
}

export function listingsFromTask(task: DataForSeoTask | undefined | null): Listing[] {
  const listings = collectMapsItems(task).filter(isListingItem).map(toListing)
  let organic = 0
  return listings.map((listing) => {
    if (listing.isPaid) {
      return {
        ...listing,
        rankGroup: listing.rankGroup || 1,
        rankAbsolute: listing.rankAbsolute || 1,
      }
    }
    organic += 1
    return {
      ...listing,
      rankGroup: listing.rankGroup || organic,
      rankAbsolute: listing.rankAbsolute || organic,
    }
  })
}

function isListingItem(item: DataForSeoItem): boolean {
  const type = item.type?.trim()
  if (type && SKIP_TYPES.has(type)) return false
  if (type && LISTING_TYPES.has(type)) return true
  return Boolean(item.title || item.original_title || item.place_id)
}

export function organicRank(listing: Pick<Listing, "rankGroup" | "rankAbsolute">): number | null {
  if (listing.rankGroup > 0) return listing.rankGroup
  if (listing.rankAbsolute > 0) return listing.rankAbsolute
  return null
}

export { listingMatchesTarget }

export function matchTarget(input: {
  id: string
  lat: number
  lng: number
  locationCoordinate: string
  listings: Listing[]
  targetBusiness: string
  targetPlaceId?: string
  targetCid?: string
  targetLat?: number
  targetLng?: number
}): PointResult {
  const match = input.listings.find((listing) =>
    listingMatchesTarget(listing, {
      title: input.targetBusiness,
      placeId: input.targetPlaceId,
      cid: input.targetCid,
      lat: input.targetLat,
      lng: input.targetLng,
    })
  )

  return {
    id: input.id,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate: input.locationCoordinate,
    rank: match ? organicRank(match) : null,
    found: Boolean(match),
    listings: input.listings,
    error: null,
  }
}

function positiveRank(value: unknown): number {
  const rank = Number(value)
  return Number.isFinite(rank) && rank > 0 ? Math.round(rank) : 0
}

function toListing(item: DataForSeoItem): Listing {
  const isPaid = item.type === "maps_paid_item"
  return {
    rankAbsolute: positiveRank(item.rank_absolute),
    rankGroup: positiveRank(item.rank_group),
    type: isPaid ? "maps_paid_item" : "maps_search",
    title: item.title || item.original_title || "Untitled listing",
    domain: item.domain ?? null,
    address: item.address ?? null,
    placeId: item.place_id != null ? String(item.place_id) : null,
    cid: item.cid != null ? String(item.cid) : null,
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
