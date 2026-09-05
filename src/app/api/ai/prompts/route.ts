import { NextResponse } from "next/server"

import { brandQuotaView, upsertBrandPrompt } from "@/lib/ai-visibility"
import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { readDb, updateDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { brandId?: string; promptId?: string; text?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  try {
    const saved = await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      if (!user) return null
      const brand = user.aiBrands.find((item) => item.id === body.brandId)
      if (!brand || brand.status !== "active") {
        const error = new Error("Choose an active AI Visibility brand.") as Error & { status?: number }
        error.status = 400
        throw error
      }
      const result = upsertBrandPrompt(brand, body.text || "", body.promptId)
      if (!result.ok) {
        const error = new Error(result.error) as Error & { status?: number }
        error.status = 400
        throw error
      }
      return { brand: brandQuotaView(brand), prompt: result.prompt }
    })
    if (!saved) return NextResponse.json({ error: "Account not found." }, { status: 404 })
    return NextResponse.json({ ok: true, ...saved })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the prompt." },
      { status }
    )
  }
}
