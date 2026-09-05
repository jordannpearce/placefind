import { NextResponse } from "next/server"

import { activeAiBrands, consumeAiPrompt, storeAiScan } from "@/lib/ai-visibility"
import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { resolveCloroApiKey, runCloroPrompt } from "@/lib/cloro"
import { readDb, updateDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { AI_PROMPTS_PER_BRAND } from "@/lib/plans"
import type { AiBrand, AiEngineId, AiScanRun } from "@/lib/types"

const ENGINES: AiEngineId[] = ["chatgpt", "perplexity", "gemini", "copilot", "aimode", "grok"]

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { brandId?: string; prompt?: string; country?: string; engines?: AiEngineId[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const prompt = body.prompt?.trim() || ""
  if (prompt.length < 8) {
    return NextResponse.json({ error: "Enter a prompt of at least 8 characters." }, { status: 400 })
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "Keep the prompt under 2,000 characters." }, { status: 400 })
  }
  const country = (body.country?.trim() || "US").toUpperCase()
  const engines = (body.engines || ENGINES).filter((engine): engine is AiEngineId =>
    ENGINES.includes(engine)
  )

  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }

  const apiKey = await resolveCloroApiKey(db.settings.cloroApiKey)
  let reserved: AiBrand | null = null

  try {
    reserved = await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      if (!user) return null
      const brand =
        user.aiBrands.find((item) => item.id === body.brandId) || activeAiBrands(user)[0] || null
      if (!brand || brand.status !== "active") return null
      const quota = consumeAiPrompt(brand)
      if (!quota.ok) {
        const error = new Error(quota.error) as Error & { status?: number }
        error.status = 402
        throw error
      }
      return { ...brand }
    })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start the AI scan." },
      { status }
    )
  }

  if (!reserved) {
    return NextResponse.json(
      { error: "Add an AI Visibility brand before running a prompt scan." },
      { status: 400 }
    )
  }

  try {
    const scan = await runCloroPrompt({
      apiKey,
      prompt,
      country,
      brandName: reserved.name,
      brandDomain: reserved.domain,
      competitors: reserved.competitors,
      engines: engines.length ? engines : ENGINES,
    })
    const run: AiScanRun = {
      id: `ai_scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      brandId: reserved.id,
      brandName: reserved.name,
      prompt,
      country,
      createdAt: new Date().toISOString(),
      mode: scan.mode,
      models: scan.models,
    }
    const remaining = await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      if (!user) return 0
      storeAiScan(user, run)
      const brand = user.aiBrands.find((item) => item.id === reserved?.id)
      return brand ? Math.max(0, AI_PROMPTS_PER_BRAND - brand.promptsUsed) : 0
    })
    return NextResponse.json({ run, remaining })
  } catch (error) {
    await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      const brand = user?.aiBrands.find((item) => item.id === reserved?.id)
      if (brand && brand.promptsUsed > 0) brand.promptsUsed -= 1
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not run the AI scan." },
      { status: 502 }
    )
  }
}
