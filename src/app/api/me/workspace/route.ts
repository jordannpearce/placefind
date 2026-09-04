import { NextResponse } from "next/server"

import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { emptyWorkspace, readDb, updateDb } from "@/lib/db"
import { billingPathForUser, userHasSoftwareAccess } from "@/lib/paddle-access"
import { campaignLimitMessage, usableCampaignLimit } from "@/lib/plans"
import { normalizeWorkspaceScans } from "@/lib/scan-results"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const db = await readDb()
  const current = userHasSoftwareAccess(auth.user, db)
  const workspace = auth.workspace
  const extras = auth.user.extraCampaigns
  const login = workspace.settings.login || auth.user.dfsLogin || ""
  const password = workspace.settings.password || auth.user.dfsPassword || ""
  const campaigns = current ? workspace.campaigns : []
  return NextResponse.json({
    campaigns,
    settings: { login, password },
    activeCampaignId: current ? workspace.activeCampaignId : "",
    scans: current ? workspace.scans : {},
    plan: auth.user.plan,
    extraCampaigns: extras,
    campaignLimit: usableCampaignLimit(auth.user.plan, extras, current),
    dfsLogin: login,
    hasDfsPassword: Boolean(password),
    canBypassCampaignLimit: Boolean(await requireAdmin()),
    softwareAccess: current,
    billingUrl: current ? "/dashboard" : billingPathForUser(auth.user, db),
  })
}

export async function PUT(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    return billingRequiredResponse(auth.user, db)
  }
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
  const limit = usableCampaignLimit(auth.user.plan, extras, true)
  const admin = await requireAdmin()
  const result = await updateDb((db) => {
    const current = db.workspaces[auth.user.id] ?? emptyWorkspace()
    if (Array.isArray(body.campaigns)) {
      const incoming = body.campaigns as typeof current.campaigns
      if (!admin && incoming.length > limit && incoming.length > current.campaigns.length) {
        return {
          error: campaignLimitMessage(auth.user.plan, extras),
        }
      }
      current.campaigns = incoming
      const keep = new Set(incoming.map((campaign) => campaign.id).filter(Boolean))
      for (const id of Object.keys(current.scans)) {
        if (!keep.has(id)) delete current.scans[id]
      }
      if (!keep.has(current.activeCampaignId)) {
        current.activeCampaignId = incoming[0]?.id ?? ""
      }
    }
    if (body.settings) {
      const login = body.settings.login?.trim() || current.settings.login
      const password = body.settings.password?.trim() || current.settings.password
      current.settings = { login, password }
      const user = db.users.find((item) => item.id === auth.user.id)
      if (user) {
        if (login) user.dfsLogin = login
        if (password) user.dfsPassword = password
      }
    }
    if (typeof body.activeCampaignId === "string") {
      const ids = new Set(current.campaigns.map((campaign) => campaign.id))
      current.activeCampaignId = ids.has(body.activeCampaignId)
        ? body.activeCampaignId
        : (current.campaigns[0]?.id ?? "")
    }
    if (body.scans && typeof body.scans === "object") {
      const incoming = normalizeWorkspaceScans(
        body.scans,
        current.campaigns.map((campaign) => campaign.id)
      )
      const next: typeof current.scans = {}
      for (const campaign of current.campaigns) {
        next[campaign.id] = incoming[campaign.id] ?? current.scans[campaign.id] ?? {}
      }
      current.scans = next
    }
    db.workspaces[auth.user.id] = current
    return { ok: true as const }
  })

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }
  return NextResponse.json({ ok: true, campaignLimit: limit })
}
