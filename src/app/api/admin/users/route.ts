import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { findOrCreateAgency, findOrCreateWorkspace, readDb, updateDb } from "@/lib/db"
import { ACTIVATION_TOKEN_TTL_MS, createHashedToken } from "@/lib/auth-tokens"
import { accountCreatedEmail, activationEmail, appUrl, billingEmail } from "@/lib/email-templates"
import { previewUrl, sendAuthMail, sendMail } from "@/lib/mail"
import { hashPassword } from "@/lib/password"
import { provisionUserFromPaddle } from "@/lib/paddle-fulfillment"
import { clampExtraCampaigns, isPlanId, PLANS } from "@/lib/plans"
import { publicUser } from "@/lib/session"
import type { PlanId, UserRole, UserStatus } from "@/lib/types"

function serializeUsers(
  db: Awaited<ReturnType<typeof readDb>>
) {
  const agencies = Object.fromEntries(db.agencies.map((agency) => [agency.id, agency.name]))
  return db.users.map((user) => ({
    ...publicUser(user),
    agencyName: agencies[user.agencyId] || user.company || "Independent",
    campaignCount: db.workspaces[user.id]?.campaigns.length ?? 0,
  }))
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await readDb()
  return NextResponse.json({
    users: serializeUsers(db),
    agencies: db.agencies,
  })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: {
    name?: string
    email?: string
    password?: string
    company?: string
    agencyName?: string
    plan?: PlanId
    extraCampaigns?: number
    role?: UserRole
    status?: UserStatus
    marketingOptIn?: boolean
    sendEmail?: boolean
  }
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
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const status: UserStatus = body.status === "pending" || body.status === "suspended" ? body.status : "active"
  let token = ""

  const user = await updateDb((db) => {
    if (db.users.some((item) => item.email === email)) return null
    const agency = findOrCreateAgency(db, body.agencyName?.trim() || body.company?.trim() || name)
    const created = {
      id: `user_${Date.now()}`,
      name,
      email,
      passwordHash: hashPassword(password),
      role: body.role === "admin" ? ("admin" as const) : ("user" as const),
      status,
      plan: isPlanId(body.plan) && PLANS[body.plan] ? body.plan : ("starter" as const),
      extraCampaigns: 0,
      marketingOptIn: Boolean(body.marketingOptIn),
      company: body.company?.trim() || agency.name,
      agencyId: agency.id,
      paddleCustomerId: "",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      dfsLogin: "",
      dfsPassword: "",
    }
    created.extraCampaigns = clampExtraCampaigns(created.plan, body.extraCampaigns)
    db.users.push(created)
    provisionUserFromPaddle(db, created)
    findOrCreateWorkspace(db, created.id)
    if (status === "pending") {
      token = createHashedToken(db, created.id, "activation", ACTIVATION_TOKEN_TTL_MS)
    }
    return created
  })

  if (!user) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
  }

  let preview: string | null = null
  if (body.sendEmail !== false) {
    if (status === "pending") {
      const verifyUrl = `${appUrl()}/verify?token=${token}`
      const template = activationEmail(user.name, verifyUrl)
      const mail = await sendAuthMail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        kind: "activation",
        userId: user.id,
      })
      preview = mail.provider === "preview" ? previewUrl(mail.id) : null
    } else {
      const template = accountCreatedEmail(user.name, user.email)
      const mail = await sendAuthMail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        kind: "account_created",
        userId: user.id,
      })
      preview = mail.provider === "preview" ? previewUrl(mail.id) : null
    }
  }

  const db = await readDb()
  return NextResponse.json({
    user: serializeUsers(db).find((item) => item.id === user.id),
    previewUrl: preview,
  })
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: {
    userId?: string
    status?: UserStatus
    plan?: PlanId
    extraCampaigns?: number
    role?: UserRole
    agencyId?: string
    agencyName?: string
    marketingOptIn?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const previous = { plan: "", extraCampaigns: 0 }
  const user = await updateDb((db) => {
    const found = db.users.find((item) => item.id === body.userId)
    if (!found) return null
    previous.plan = found.plan
    previous.extraCampaigns = found.extraCampaigns
    if (body.status) found.status = body.status
    if (body.plan && isPlanId(body.plan) && PLANS[body.plan]) found.plan = body.plan
    if (body.extraCampaigns !== undefined) {
      found.extraCampaigns = clampExtraCampaigns(found.plan, body.extraCampaigns)
    } else {
      found.extraCampaigns = clampExtraCampaigns(found.plan, found.extraCampaigns)
    }
    if (body.role) found.role = body.role
    if (typeof body.marketingOptIn === "boolean") found.marketingOptIn = body.marketingOptIn
    if (body.agencyId) {
      const agency = db.agencies.find((item) => item.id === body.agencyId)
      if (agency) {
        found.agencyId = agency.id
        if (!found.company) found.company = agency.name
      }
    } else if (body.agencyName?.trim()) {
      const agency = findOrCreateAgency(db, body.agencyName)
      found.agencyId = agency.id
      found.company = found.company || agency.name
    }
    return found
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (user.plan !== previous.plan || user.extraCampaigns !== previous.extraCampaigns) {
    const template = billingEmail(user.name, user.plan, user.extraCampaigns)
    await sendMail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      kind: "billing",
      userId: user.id,
    })
  }
  const db = await readDb()
  return NextResponse.json({ user: serializeUsers(db).find((item) => item.id === user.id) })
}
