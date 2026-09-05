import { rejectUnlessSoftwareAccess } from "@/lib/billing-gate"
import { requireUser } from "@/lib/auth-guard"
import { resolveRequestAuth, verifyDataForSeoAuth } from "@/lib/dataforseo"
import { usesHostedMaps } from "@/lib/scan-quota"

export async function GET() {
  const blocked = await rejectUnlessSoftwareAccess()
  if (blocked) return blocked

  const session = await requireUser()
  const hosted = Boolean(session && usesHostedMaps(session.user))
  const auth = await resolveRequestAuth(null)
  const live = Boolean(auth)
  return Response.json({
    envLive: live,
    live,
    hostedLive: hosted && live,
    usesHostedMaps: hosted,
    mode: live ? "live" : "mock",
    message: hosted
      ? live
        ? "Live Maps included — no API key required."
        : "Hosted Maps is not available right now. You can still run sample data."
      : live
        ? "DataForSEO credentials found."
        : "Add your DataForSEO login and password in Settings, or use sample data.",
  })
}

export async function POST(request: Request) {
  const blocked = await rejectUnlessSoftwareAccess()
  if (blocked) return blocked

  let body: { apiLogin?: string; apiPassword?: string }
  try {
    body = (await request.json()) as { apiLogin?: string; apiPassword?: string }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const session = await requireUser()
  const hosted = Boolean(session && usesHostedMaps(session.user))
  const auth = await resolveRequestAuth(
    hosted ? null : { login: body.apiLogin, password: body.apiPassword }
  )
  if (!auth) {
    return Response.json({
      live: false,
      hostedLive: false,
      usesHostedMaps: hosted,
      mode: "mock",
      ok: false,
      message: hosted
        ? "Hosted Maps is not available right now. You can still run sample data."
        : "No DataForSEO credentials. Scans will use sample data.",
    })
  }

  const check = await verifyDataForSeoAuth(auth)
  return Response.json({
    live: check.ok,
    hostedLive: hosted && check.ok,
    usesHostedMaps: hosted,
    mode: check.ok ? "live" : "mock",
    ok: check.ok,
    message: hosted
      ? check.ok
        ? "Live Maps included — no API key required."
        : check.message
      : check.message,
  })
}
