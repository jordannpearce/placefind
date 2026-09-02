import { resolveRequestAuth, verifyDataForSeoAuth } from "@/lib/dataforseo"

export async function GET() {
  const auth = await resolveRequestAuth(null)
  const live = Boolean(auth)
  return Response.json({
    envLive: live,
    live,
    mode: live ? "live" : "mock",
    message: live
      ? "DataForSEO credentials found."
      : "Add your DataForSEO login and password in Settings, or use demo data.",
  })
}

export async function POST(request: Request) {
  let body: { apiLogin?: string; apiPassword?: string }
  try {
    body = (await request.json()) as { apiLogin?: string; apiPassword?: string }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const auth = await resolveRequestAuth({
    login: body.apiLogin,
    password: body.apiPassword,
  })
  if (!auth) {
    return Response.json({
      live: false,
      mode: "mock",
      ok: false,
      message: "No DataForSEO credentials. Scans will use demo data.",
    })
  }

  const check = await verifyDataForSeoAuth(auth)
  return Response.json({
    live: check.ok,
    mode: check.ok ? "live" : "mock",
    ok: check.ok,
    message: check.message,
  })
}
