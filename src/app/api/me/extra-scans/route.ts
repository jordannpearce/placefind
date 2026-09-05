import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { readDb, updateDb } from "@/lib/db"
import { ensureExtraScanCatalog } from "@/lib/extra-scan-catalog"
import { paddleClientToken, paddleJsEnvironment, publicAppUrl } from "@/lib/paddle"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { assertClientTokenMatchesEnvironment } from "@/lib/paddle-env"
import { EXTRA_SCAN_PRICE } from "@/lib/plans"
import { scanQuotaSnapshot, usesHostedMaps } from "@/lib/scan-quota"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!usesHostedMaps(auth.user)) {
    return NextResponse.json({ error: "Extra scans are only sold on the Starter plan." }, { status: 403 })
  }

  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  try {
    const catalog = await updateDb((next) => ensureExtraScanCatalog(next))
    const environment = paddleJsEnvironment()
    const clientToken = paddleClientToken()
    if (!clientToken) throw new Error("Paddle checkout is not configured.")
    assertClientTokenMatchesEnvironment(clientToken, environment)
    return NextResponse.json({
      priceId: catalog.priceId,
      productId: catalog.productId,
      unitPrice: EXTRA_SCAN_PRICE,
      clientToken,
      environment,
      successUrl: `${publicAppUrl()}/account?scans=purchased`,
      quota: scanQuotaSnapshot(auth.user),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load extra scan checkout." },
      { status: 503 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!usesHostedMaps(auth.user)) {
    return NextResponse.json({ error: "Extra scans are only sold on the Starter plan." }, { status: 403 })
  }

  let quantity = 1
  try {
    const body = (await request.json()) as { quantity?: number }
    quantity = Math.max(1, Math.min(20, Math.round(Number(body.quantity) || 1)))
  } catch {
    quantity = 1
  }

  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  try {
    const catalog = await updateDb((next) => ensureExtraScanCatalog(next))
    const environment = paddleJsEnvironment()
    const clientToken = paddleClientToken()
    if (!clientToken) throw new Error("Paddle checkout is not configured.")
    assertClientTokenMatchesEnvironment(clientToken, environment)
    return NextResponse.json({
      priceId: catalog.priceId,
      productId: catalog.productId,
      quantity,
      unitPrice: EXTRA_SCAN_PRICE,
      clientToken,
      environment,
      successUrl: `${publicAppUrl()}/account?scans=purchased`,
      customData: { kind: "extra_scan", userId: auth.user.id, plan: auth.user.plan },
      quota: scanQuotaSnapshot(auth.user),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start extra scan checkout." },
      { status: 503 }
    )
  }
}
