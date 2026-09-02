import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { updateDb } from "@/lib/db"
import { billingEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import { PLANS } from "@/lib/plans"
import { publicUser, writeSession } from "@/lib/session"
import type { PlanId } from "@/lib/types"

export async function PUT(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: { name?: string; company?: string; marketingOptIn?: boolean; plan?: PlanId; dfsLogin?: string; dfsPassword?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const previousPlan = user.plan
  const next = await updateDb((db) => {
    const found = db.users.find((item) => item.id === user.id)
    if (!found) return null
    if (typeof body.name === "string" && body.name.trim()) found.name = body.name.trim()
    if (typeof body.company === "string") found.company = body.company.trim()
    if (typeof body.marketingOptIn === "boolean") found.marketingOptIn = body.marketingOptIn
    if (typeof body.dfsLogin === "string") found.dfsLogin = body.dfsLogin.trim()
    if (typeof body.dfsPassword === "string" && body.dfsPassword.length > 0) {
      found.dfsPassword = body.dfsPassword
    }
    if (body.plan && PLANS[body.plan]) found.plan = body.plan
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
  await writeSession(next)

  if (body.plan && PLANS[body.plan] && body.plan !== previousPlan) {
    const template = billingEmail(next.name, next.plan)
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
