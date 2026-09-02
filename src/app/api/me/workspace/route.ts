import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { updateDb } from "@/lib/db"
import { campaignLimit, campaignLimitMessage } from "@/lib/plans"
import { defaultCampaign } from "@/lib/storage"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const workspace = auth.workspace
  const extras = auth.user.extraCampaigns
  return NextResponse.json({
    campaigns: workspace.campaigns,
    settings: workspace.settings,
    activeCampaignId: workspace.activeCampaignId,
    scans: workspace.scans,
    plan: auth.user.plan,
    extraCampaigns: extras,
    campaignLimit: campaignLimit(auth.user.plan, extras),
    dfsLogin: auth.user.dfsLogin,
  })
}

export async function PUT(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: {
    campaigns?: unknown
    settings?: { login?: string; password?: string }
    activeCampaignId?: string
    scans?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const extras = auth.user.extraCampaigns
  const limit = campaignLimit(auth.user.plan, extras)
  const result = await updateDb((db) => {
    const current = db.workspaces[auth.user.id] ?? {
      campaigns: [defaultCampaign()],
      settings: { login: "", password: "" },
      activeCampaignId: "",
      scans: {},
    }
    if (Array.isArray(body.campaigns)) {
      const incoming = body.campaigns as typeof current.campaigns
      if (incoming.length > limit && incoming.length > current.campaigns.length) {
        return {
          error: campaignLimitMessage(auth.user.plan, extras),
        }
      }
      current.campaigns = incoming
    }
    if (body.settings) {
      current.settings = {
        login: body.settings.login ?? current.settings.login,
        password: body.settings.password ?? current.settings.password,
      }
    }
    if (typeof body.activeCampaignId === "string") current.activeCampaignId = body.activeCampaignId
    if (body.scans && typeof body.scans === "object") {
      current.scans = body.scans as typeof current.scans
    }
    db.workspaces[auth.user.id] = current
    return { ok: true as const }
  })

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }
  return NextResponse.json({ ok: true, campaignLimit: limit })
}
