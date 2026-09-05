import { NextResponse } from "next/server"

import { parseCompetitorsInput } from "@/lib/ai-visibility"
import { ensureAiVisibilityCatalog } from "@/lib/ai-visibility-catalog"
import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { readDb, updateDb } from "@/lib/db"
import { paddleClientToken, paddleJsEnvironment, publicAppUrl } from "@/lib/paddle"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { assertClientTokenMatchesEnvironment } from "@/lib/paddle-env"
import { AI_PROMPTS_PER_BRAND, AI_VISIBILITY_PRICE } from "@/lib/plans"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  try {
    const catalog = await updateDb((next) => ensureAiVisibilityCatalog(next))
    const environment = paddleJsEnvironment()
    const clientToken = paddleClientToken()
    if (!clientToken) throw new Error("Paddle checkout is not configured.")
    assertClientTokenMatchesEnvironment(clientToken, environment)
    return NextResponse.json({
      priceId: catalog.priceId,
      productId: catalog.productId,
      unitPrice: AI_VISIBILITY_PRICE,
      promptsPerBrand: AI_PROMPTS_PER_BRAND,
      clientToken,
      environment,
      successUrl: `${publicAppUrl()}/ai?addon=started`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load AI Visibility checkout." },
      { status: 503 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { brandName?: string; brandDomain?: string; competitors?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const brandName = body.brandName?.trim() || ""
  if (brandName.length < 2) {
    return NextResponse.json({ error: "Enter the brand name this add-on will track." }, { status: 400 })
  }

  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  try {
    const catalog = await updateDb((next) => ensureAiVisibilityCatalog(next))
    const environment = paddleJsEnvironment()
    const clientToken = paddleClientToken()
    if (!clientToken) throw new Error("Paddle checkout is not configured.")
    assertClientTokenMatchesEnvironment(clientToken, environment)
    return NextResponse.json({
      priceId: catalog.priceId,
      productId: catalog.productId,
      quantity: 1,
      unitPrice: AI_VISIBILITY_PRICE,
      clientToken,
      environment,
      successUrl: `${publicAppUrl()}/ai?addon=started`,
      customData: {
        kind: "ai_visibility",
        userId: auth.user.id,
        brandName,
        brandDomain: body.brandDomain?.trim() || "",
        competitors: parseCompetitorsInput(body.competitors)
          .map((item) => item.name)
          .join(", "),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start AI Visibility checkout." },
      { status: 503 }
    )
  }
}
