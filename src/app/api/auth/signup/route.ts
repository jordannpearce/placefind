import { NextResponse } from "next/server"

import { ACTIVATION_TOKEN_TTL_MS, createHashedToken } from "@/lib/auth-tokens"
import { emptyWorkspace, findOrCreateAgency, updateDb } from "@/lib/db"
import { activationEmail, appUrl } from "@/lib/email-templates"
import { previewUrl, sendAuthMail } from "@/lib/mail"
import { hashPassword } from "@/lib/password"
import { provisionUserFromPaddle } from "@/lib/paddle-fulfillment"
import { defaultAiVisibilityFields } from "@/lib/ai-visibility"
import { defaultScanQuotaFields } from "@/lib/scan-quota"

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string; company?: string; marketingOptIn?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = body.name?.trim() || ""
  const email = body.email?.trim().toLowerCase() || ""
  const password = body.password || ""
  if (name.length < 2) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })

  let token = ""
  const user = await updateDb((db) => {
    if (db.users.some((item) => item.email === email)) return null
    const agency = findOrCreateAgency(db, body.company?.trim() || name)
    const created = {
      id: `user_${Date.now()}`,
      name,
      email,
      passwordHash: hashPassword(password),
      role: "user" as const,
      status: "pending" as const,
      plan: "starter" as const,
      extraCampaigns: 0,
      ...defaultScanQuotaFields(),
      marketingOptIn: Boolean(body.marketingOptIn),
      company: body.company?.trim() || agency.name,
      agencyId: agency.id,
      paddleCustomerId: "",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      dfsLogin: "",
      dfsPassword: "",
      trialEndsAt: null,
      ...defaultAiVisibilityFields(),
    }
    db.users.push(created)
    db.workspaces[created.id] = emptyWorkspace()
    token = createHashedToken(db, created.id, "activation", ACTIVATION_TOKEN_TTL_MS)
    provisionUserFromPaddle(db, created)
    return created
  })

  if (!user) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
  }

  const verifyUrl = `${appUrl()}/verify?token=${token}`
  const template = activationEmail(user.name, verifyUrl)
  const mail = await sendAuthMail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    kind: "activation",
    userId: user.id,
  })

  return NextResponse.json({
    ok: true,
    message: mail.provider === "resend"
      ? "Check your inbox for an activation link."
      : "Resend is not configured, so the activation email is in the local inbox.",
    previewUrl: mail.provider === "preview" ? previewUrl(mail.id) : null,
  })
}
