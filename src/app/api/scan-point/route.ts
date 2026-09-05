import { requireUser } from "@/lib/auth-guard"
import { rejectUnlessSoftwareAccess } from "@/lib/billing-gate"
import { fetchMapsPoint, getScanMode, resolveRequestAuth } from "@/lib/dataforseo"
import { readDb } from "@/lib/db"
import { formatCoordinate } from "@/lib/grid"
import { mockDelayMs, mockScanPoint } from "@/lib/mock-scan"
import { hasActiveScanSession, SCAN_QUOTA_EXHAUSTED, starterSafeMessage, usesHostedMaps } from "@/lib/scan-quota"
import type { DeviceType, ScanPointResponse } from "@/lib/types"

export const maxDuration = 30

type Body = {
  pointId?: string
  keyword?: string
  targetBusiness?: string
  targetPlaceId?: string
  targetCid?: string
  targetLat?: number
  targetLng?: number
  lat?: number
  lng?: number
  zoom?: number
  languageCode?: string
  device?: DeviceType
  depth?: number
  forceMock?: boolean
  apiLogin?: string
  apiPassword?: string
}

export async function POST(request: Request) {
  const blocked = await rejectUnlessSoftwareAccess()
  if (blocked) return blocked

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const keyword = body.keyword?.trim()
  const targetBusiness = body.targetBusiness?.trim()
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const zoomRaw = Number(body.zoom ?? 15)
  const zoom = Number.isFinite(zoomRaw) ? Math.min(21, Math.max(3, Math.round(zoomRaw))) : 15
  const pointId = body.pointId?.trim() || "point"

  if (!keyword) {
    return Response.json({ error: "Keyword is required" }, { status: 400 })
  }
  if (!targetBusiness) {
    return Response.json({ error: "Target business is required" }, { status: 400 })
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Valid latitude and longitude are required" }, { status: 400 })
  }

  const languageCode = body.languageCode?.trim() || "en"
  const device: DeviceType = body.device === "mobile" ? "mobile" : "desktop"
  const depth = Math.min(Math.max(Number(body.depth ?? 20), 10), 100)
  const targetCid = body.targetCid?.trim() || undefined
  const targetLat = Number(body.targetLat)
  const targetLng = Number(body.targetLng)
  const targetCoords = {
    targetCid,
    targetLat: Number.isFinite(targetLat) ? targetLat : undefined,
    targetLng: Number.isFinite(targetLng) ? targetLng : undefined,
  }
  const session = await requireUser()
  const hosted = Boolean(session && usesHostedMaps(session.user))
  const auth = await resolveRequestAuth(
    hosted ? null : { login: body.apiLogin, password: body.apiPassword }
  )
  const mode = getScanMode(body.forceMock && Boolean(body.apiLogin && body.apiPassword), auth)
  if (hosted && mode === "live") {
    const db = await readDb()
    const user = db.users.find((item) => item.id === session!.user.id)
    if (!user || !hasActiveScanSession(user)) {
      return Response.json({ error: SCAN_QUOTA_EXHAUSTED, code: "scan_quota" }, { status: 402 })
    }
  }

  try {
    if (mode === "mock") {
      await wait(mockDelayMs(lat, lng))
      const result = mockScanPoint({
        pointId,
        keyword,
        targetBusiness,
        targetPlaceId: body.targetPlaceId,
        ...targetCoords,
        lat,
        lng,
        zoom,
      })
      return Response.json({ ...result, mode } satisfies ScanPointResponse)
    }

    const result = await fetchMapsPoint({
      keyword,
      targetBusiness,
      targetPlaceId: body.targetPlaceId,
      ...targetCoords,
      lat,
      lng,
      zoom,
      languageCode,
      device,
      depth,
      pointId,
      auth,
    })
    return Response.json({ ...result, mode } satisfies ScanPointResponse)
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Scan failed"
    const message = hosted ? starterSafeMessage(raw) : raw
    return Response.json(
      {
        id: pointId,
        lat,
        lng,
        locationCoordinate: formatCoordinate(lat, lng, zoom),
        rank: null,
        found: false,
        listings: [],
        error: message,
        mode,
      } satisfies ScanPointResponse,
      { status: 200 }
    )
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
