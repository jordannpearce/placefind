import { NextResponse } from "next/server"

import {
  brandQuotaView,
  canManageAiComplimentary,
  missingBrandLocation,
  normalizeAiBrand,
  parseBrandForm,
} from "@/lib/ai-visibility"
import { withResolvedBrandLocation } from "@/lib/maps-location-server"
import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { resolveRequestAuth } from "@/lib/dataforseo"
import { readDb, updateDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"

export async function POST(request: Request) {
  try {
    const auth = await requireUser()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageAiComplimentary(auth.user)) {
      return NextResponse.json(
        { error: "Add a brand from Account or AI Visibility checkout — $199 per month per brand." },
        { status: 403 }
      )
    }

    const db = await readDb()
    if (!userHasSoftwareAccess(auth.user, db)) {
      return billingRequiredResponse(auth.user, db)
    }

    let body: Parameters<typeof parseBrandForm>[0]
    try {
      body = (await request.json()) as typeof body
    } catch {
      body = {}
    }

    const parsed = parseBrandForm(body)
    if (parsed.name.trim().length < 2) {
      return NextResponse.json({ error: "Enter the company name." }, { status: 400 })
    }
    const locationError = missingBrandLocation(parsed)
    if (locationError) {
      return NextResponse.json({ error: locationError }, { status: 400 })
    }
    const located = await withResolvedBrandLocation(parsed, await resolveRequestAuth())

    const user = await updateDb((next) => {
      const current = next.users.find((row) => row.id === auth.user.id)
      if (!current) return null
      if (!Array.isArray(current.aiBrands)) current.aiBrands = []
      const created = normalizeAiBrand({
        ...located,
        subscriptionId: "complimentary",
        status: "active",
      })
      if (!created) return current
      created.id = `ai_brand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      current.aiBrands.push(created)
      return current
    })

    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 })
    return NextResponse.json({ ok: true, brands: user.aiBrands.map(brandQuotaView) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add the brand." },
      { status: 500 }
    )
  }
}
