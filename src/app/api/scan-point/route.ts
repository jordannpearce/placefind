import { rejectUnlessSoftwareAccess } from "@/lib/billing-gate"
import { fetchMapsPoint, getScanMode, resolveRequestAuth } from "@/lib/dataforseo"
import { mockDelayMs, mockScanPoint } from "@/lib/mock-scan"
import type { DeviceType, ScanPointResponse } from "@/lib/types"

export const maxDuration = 30

type Body = {
  pointId?: string
  keyword?: string
  targetBusiness?: string
  targetPlaceId?: string
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
  const zoom = Number(body.zoom ?? 15)
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
  if (zoom < 3 || zoom > 21) {
    return Response.json({ error: "Zoom must be between 3 and 21" }, { status: 400 })
  }

  const languageCode = body.languageCode?.trim() || "en"
  const device: DeviceType = body.device === "mobile" ? "mobile" : "desktop"
  const depth = Math.min(Math.max(Number(body.depth ?? 20), 10), 100)
  const auth = await resolveRequestAuth({
    login: body.apiLogin,
    password: body.apiPassword,
  })
  const mode = getScanMode(body.forceMock && Boolean(body.apiLogin && body.apiPassword), auth)

  try {
    if (mode === "mock") {
      await wait(mockDelayMs(lat, lng))
      const result = mockScanPoint({
        pointId,
        keyword,
        targetBusiness,
        targetPlaceId: body.targetPlaceId,
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
    const message = error instanceof Error ? error.message : "Scan failed"
    return Response.json(
      {
        id: pointId,
        lat,
        lng,
        locationCoordinate: `${lat},${lng},${zoom}z`,
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
