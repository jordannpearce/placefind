import { NextResponse } from "next/server"

import {
  activeAiBrands,
  consumePromptScan,
  refundPromptScan,
  storeAiScan,
} from "@/lib/ai-visibility"
import { resolveBrandScanLocation } from "@/lib/maps-location-server"
import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { resolveCloroApiKey, runCloroPrompt } from "@/lib/cloro"
import { resolveRequestAuth } from "@/lib/dataforseo"
import { readDb, updateDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { AI_SCANS_PER_PROMPT } from "@/lib/plans"
import type { AiBrand, AiEngineId, AiSavedPrompt, AiScanRun } from "@/lib/types"

const ENGINES: AiEngineId[] = ["chatgpt", "perplexity", "gemini", "copilot", "aimode", "grok"]

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { brandId?: string; promptId?: string; country?: string; engines?: AiEngineId[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
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
  let reserved: { brand: AiBrand; prompt: AiSavedPrompt } | null = null

  try {
    reserved = await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      if (!user) return null
      const brand =
        user.aiBrands.find((item) => item.id === body.brandId) || activeAiBrands(user)[0] || null
      if (!brand || brand.status !== "active") return null
      const consumed = consumePromptScan(brand, body.promptId || "")
      if (!consumed.ok) {
        const error = new Error(consumed.error) as Error & { status?: number }
        error.status = 402
        throw error
      }
      return { brand: { ...brand, prompts: brand.prompts.map((item) => ({ ...item })) }, prompt: consumed.prompt }
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
      { error: "Save a prompt on this brand before running a scan." },
      { status: 400 }
    )
  }

  try {
    const geo = await resolveBrandScanLocation(reserved.brand, await resolveRequestAuth())
    const brand = {
      ...reserved.brand,
      location: geo.location,
      lat: geo.lat,
      lng: geo.lng,
    }
    const scan = await runCloroPrompt({
      apiKey,
      prompt: reserved.prompt.text,
      country,
      brand,
      engines: engines.length ? engines : ENGINES,
      location: geo.location,
    })
    const run: AiScanRun = {
      id: `ai_scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      brandId: brand.id,
      brandName: brand.name,
      promptId: reserved.prompt.id,
      prompt: reserved.prompt.text,
      country,
      location: geo.location,
      createdAt: new Date().toISOString(),
      mode: scan.mode,
      models: scan.models,
    }
    const remaining = await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      if (!user) return 0
      const saved = user.aiBrands.find((item) => item.id === brand.id)
      if (saved) {
        saved.location = geo.location
        saved.lat = geo.lat
        saved.lng = geo.lng
      }
      storeAiScan(user, run)
      const prompt = saved?.prompts.find((item) => item.id === reserved?.prompt.id)
      return prompt ? Math.max(0, AI_SCANS_PER_PROMPT - prompt.scansUsed) : 0
    })
    return NextResponse.json({ run, remaining })
  } catch (error) {
    await updateDb((next) => {
      const user = next.users.find((row) => row.id === auth.user.id)
      const brand = user?.aiBrands.find((item) => item.id === reserved?.brand.id)
      if (brand) refundPromptScan(brand, reserved?.prompt.id || "")
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not run the AI scan." },
      { status: 502 }
    )
  }
}
