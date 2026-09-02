import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { updateDb, readDb } from "@/lib/db"
import type { Campaign, UserWorkspace } from "@/lib/types"

function emptyWorkspace(): UserWorkspace {
  return {
    campaigns: [],
    settings: { login: "", password: "" },
    activeCampaignId: "",
    scans: {},
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = request.nextUrl.searchParams.get("userId")?.trim() || ""
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const db = await readDb()
  const user = db.users.find((item) => item.id === userId)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const workspace = db.workspaces[userId] ?? emptyWorkspace()
  return NextResponse.json({
    userId,
    campaigns: workspace.campaigns,
    activeCampaignId: workspace.activeCampaignId,
    campaignCount: workspace.campaigns.length,
  })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId =
    request.nextUrl.searchParams.get("userId")?.trim() ||
    ""
  let body: {
    userId?: string
    campaigns?: unknown
    activeCampaignId?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const targetId = userId || body.userId?.trim() || ""
  if (!targetId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const result = await updateDb((db) => {
    const user = db.users.find((item) => item.id === targetId)
    if (!user) return { error: "User not found" as const, status: 404 as const }
    const current = db.workspaces[targetId] ?? emptyWorkspace()
    if (Array.isArray(body.campaigns)) {
      const incoming = body.campaigns as Campaign[]
      const keep = new Set(incoming.map((campaign) => campaign.id).filter(Boolean))
      current.campaigns = incoming
      for (const id of Object.keys(current.scans)) {
        if (!keep.has(id)) delete current.scans[id]
      }
      if (typeof body.activeCampaignId === "string" && keep.has(body.activeCampaignId)) {
        current.activeCampaignId = body.activeCampaignId
      } else if (!keep.has(current.activeCampaignId)) {
        current.activeCampaignId = incoming[0]?.id ?? ""
      }
    } else if (typeof body.activeCampaignId === "string") {
      current.activeCampaignId = body.activeCampaignId
    }
    db.workspaces[targetId] = current
    return {
      ok: true as const,
      campaigns: current.campaigns,
      activeCampaignId: current.activeCampaignId,
      campaignCount: current.campaigns.length,
    }
  })

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
  }
  return NextResponse.json(result)
}
