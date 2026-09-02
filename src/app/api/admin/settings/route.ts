import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import { maskSecret, resolveResendConfig } from "@/lib/mail"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await readDb()
  const resolved = await resolveResendConfig()
  return NextResponse.json({
    hasResendKey: Boolean(resolved.apiKey),
    resendKeyLast4: maskSecret(resolved.apiKey),
    resendFrom: db.settings.resendFrom || resolved.from,
    source: resolved.source,
  })
}

export async function PUT(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: { resendApiKey?: string; resendFrom?: string; clearResendKey?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  await updateDb((db) => {
    if (body.clearResendKey) db.settings.resendApiKey = ""
    else if (typeof body.resendApiKey === "string" && body.resendApiKey.trim()) {
      db.settings.resendApiKey = body.resendApiKey.trim()
    }
    if (typeof body.resendFrom === "string" && body.resendFrom.trim()) {
      db.settings.resendFrom = body.resendFrom.trim()
    }
  })

  const db = await readDb()
  const resolved = await resolveResendConfig()
  return NextResponse.json({
    ok: true,
    hasResendKey: Boolean(resolved.apiKey),
    resendKeyLast4: maskSecret(resolved.apiKey),
    resendFrom: db.settings.resendFrom || resolved.from,
    source: resolved.source,
  })
}
