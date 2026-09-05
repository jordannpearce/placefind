import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import { costPerLeadUsd, parseCostPerLeadUsd } from "@/lib/leads"
import { resolveCloroApiKey } from "@/lib/cloro"
import { maskSecret, resolveResendConfig } from "@/lib/mail"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await readDb()
  const resolved = await resolveResendConfig()
  const cloroKey = await resolveCloroApiKey(db.settings.cloroApiKey)
  return NextResponse.json({
    hasResendKey: Boolean(resolved.apiKey),
    resendKeyLast4: maskSecret(resolved.apiKey),
    resendFrom: db.settings.resendFrom || resolved.from,
    source: resolved.source,
    costPerLeadUsd: costPerLeadUsd(db.settings),
    hasCloroKey: Boolean(cloroKey),
    cloroKeyLast4: maskSecret(cloroKey),
    cloroSource: db.settings.cloroApiKey.trim() ? "admin" : cloroKey ? "env" : "none",
    aiVisibilityPriceId: db.settings.aiVisibilityPriceId,
    aiVisibilityProductId: db.settings.aiVisibilityProductId,
  })
}

export async function PUT(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: {
    resendApiKey?: string
    resendFrom?: string
    clearResendKey?: boolean
    costPerLeadUsd?: number | string
    cloroApiKey?: string
    clearCloroKey?: boolean
    aiVisibilityPriceId?: string
    aiVisibilityProductId?: string
  }
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
    if (body.costPerLeadUsd !== undefined) {
      db.settings.costPerLeadUsd = parseCostPerLeadUsd(body.costPerLeadUsd)
    }
    if (body.clearCloroKey) db.settings.cloroApiKey = ""
    else if (typeof body.cloroApiKey === "string" && body.cloroApiKey.trim()) {
      db.settings.cloroApiKey = body.cloroApiKey.trim()
    }
    if (typeof body.aiVisibilityPriceId === "string") {
      db.settings.aiVisibilityPriceId = body.aiVisibilityPriceId.trim()
    }
    if (typeof body.aiVisibilityProductId === "string") {
      db.settings.aiVisibilityProductId = body.aiVisibilityProductId.trim()
    }
  })

  const db = await readDb()
  const resolved = await resolveResendConfig()
  const cloroKey = await resolveCloroApiKey(db.settings.cloroApiKey)
  return NextResponse.json({
    ok: true,
    hasResendKey: Boolean(resolved.apiKey),
    resendKeyLast4: maskSecret(resolved.apiKey),
    resendFrom: db.settings.resendFrom || resolved.from,
    source: resolved.source,
    costPerLeadUsd: costPerLeadUsd(db.settings),
    hasCloroKey: Boolean(cloroKey),
    cloroKeyLast4: maskSecret(cloroKey),
    cloroSource: db.settings.cloroApiKey.trim() ? "admin" : cloroKey ? "env" : "none",
    aiVisibilityPriceId: db.settings.aiVisibilityPriceId,
    aiVisibilityProductId: db.settings.aiVisibilityProductId,
  })
}
