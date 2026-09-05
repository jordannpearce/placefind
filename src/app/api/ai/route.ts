import { NextResponse } from "next/server"

import { brandQuotaView, canManageAiComplimentary } from "@/lib/ai-visibility"
import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { resolveCloroApiKey } from "@/lib/cloro"
import { readDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { AI_PROMPTS_PER_BRAND, AI_VISIBILITY_PRICE } from "@/lib/plans"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  const user = db.users.find((row) => row.id === auth.user.id) ?? auth.user
  const apiKey = await resolveCloroApiKey(db.settings.cloroApiKey)

  return NextResponse.json({
    brands: user.aiBrands.map(brandQuotaView),
    scans: user.aiScans,
    canAddComplimentary: canManageAiComplimentary(user),
    liveConfigured: Boolean(apiKey),
    promptsPerBrand: AI_PROMPTS_PER_BRAND,
    monthlyPrice: AI_VISIBILITY_PRICE,
  })
}
