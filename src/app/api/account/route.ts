import { NextResponse } from "next/server"

import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { findOrCreateAgency, updateDb } from "@/lib/db"
import { billingEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import { clampExtraCampaigns, isPlanId, PLANS } from "@/lib/plans"
import { publicUser, writeSession } from "@/lib/session"
import type { PlanId } from "@/lib/types"

export async function PUT(request: Request) {
  const acting = await requireUser()
  if (!acting) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = await requireAdmin()
  const impersonating = Boolean(admin && admin.user.id !== acting.user.id)

  let body: {
    name?: string
    company?: string
    marketingOptIn?: boolean
    plan?: PlanId
    extraCampaigns?: number
    dfsLogin?: string
    dfsPassword?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const previousPlan = acting.user.plan
  const previousExtras = acting.user.extraCampaigns
  const next = await updateDb((db) => {
    const found = db.users.find((item) => item.id === acting.user.id)
    if (!found) return null
    if (typeof body.name === "string" && body.name.trim()) found.name = body.name.trim()
    if (typeof body.company === "string") {
      found.company = body.company.trim()
      if (found.company) found.agencyId = findOrCreateAgency(db, found.company).id
    }
    if (typeof body.marketingOptIn === "boolean") found.marketingOptIn = body.marketingOptIn
    if (typeof body.dfsLogin === "string") found.dfsLogin = body.dfsLogin.trim()
    if (typeof body.dfsPassword === "string" && body.dfsPassword.length > 0) {
      found.dfsPassword = body.dfsPassword
    }
    if (body.plan && isPlanId(body.plan) && PLANS[body.plan]) found.plan = body.plan
    found.extraCampaigns = clampExtraCampaigns(
      found.plan,
      body.extraCampaigns !== undefined ? body.extraCampaigns : found.extraCampaigns
    )
    const workspace = db.workspaces[found.id]
    if (workspace) {
      workspace.settings = {
        login: found.dfsLogin,
        password: found.dfsPassword || workspace.settings.password,
      }
    }
    return found
  })

  if (!next) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (!impersonating) await writeSession(next)

  const billingChanged = next.plan !== previousPlan || next.extraCampaigns !== previousExtras
  if (billingChanged) {
    const template = billingEmail(next.name, next.plan, next.extraCampaigns)
    await sendMail({
      to: next.email,
      subject: template.subject,
      html: template.html,
      kind: "billing",
      userId: next.id,
    })
  }

  return NextResponse.json({ user: publicUser(next) })
}
