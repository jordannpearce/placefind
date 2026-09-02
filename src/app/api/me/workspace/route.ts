import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import { defaultCampaigns } from "@/lib/storage"

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const workspace = readDb().workspaces[user.id] ?? {
    campaigns: defaultCampaigns(),
    settings: { login: "", password: "" },
    activeCampaignId: "",
    scans: {},
  }
  return NextResponse.json({
    campaigns: workspace.campaigns,
    settings: workspace.settings,
    activeCampaignId: workspace.activeCampaignId,
    scans: workspace.scans,
    plan: user.plan,
    dfsLogin: user.dfsLogin,
  })
}

export async function PUT(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

  await updateDb((db) => {
    const current = db.workspaces[user.id] ?? {
      campaigns: defaultCampaigns(),
      settings: { login: "", password: "" },
      activeCampaignId: "",
      scans: {},
    }
    if (Array.isArray(body.campaigns)) current.campaigns = body.campaigns as typeof current.campaigns
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
    db.workspaces[user.id] = current
  })
  return NextResponse.json({ ok: true })
}
