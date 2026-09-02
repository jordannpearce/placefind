import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { findOrCreateAgency, findOrCreateWorkspace, readDb, updateDb } from "@/lib/db"
import { accountCreatedEmail, activationEmail, appUrl } from "@/lib/email-templates"
import { previewUrl, sendMail } from "@/lib/mail"
import { hashPassword, hashToken, randomToken } from "@/lib/password"
import { publicUser } from "@/lib/session"
import { defaultCampaigns } from "@/lib/storage"
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
  const token = status === "pending" ? randomToken() : ""

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
      plan: body.plan === "agency" || body.plan === "enterprise" ? body.plan : ("starter" as const),
      marketingOptIn: Boolean(body.marketingOptIn),
      company: body.company?.trim() || agency.name,
      agencyId: agency.id,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      dfsLogin: "",
      dfsPassword: "",
    }
    db.users.push(created)
    findOrCreateWorkspace(db, created.id)
    const workspace = db.workspaces[created.id]
    if (workspace && workspace.campaigns.length === 0) {
      workspace.campaigns = defaultCampaigns()
      workspace.activeCampaignId = workspace.campaigns[0]?.id ?? ""
    }
    if (status === "pending") {
      db.tokens = db.tokens.filter((item) => item.userId !== created.id || item.type !== "activation")
      db.tokens.push({
        id: `tok_${Date.now()}`,
        userId: created.id,
        type: "activation",
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      })
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
      const mail = await sendMail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        kind: "activation",
        userId: user.id,
      })
      preview = mail.provider === "preview" ? previewUrl(mail.id) : null
    } else {
      const template = accountCreatedEmail(user.name, user.email)
      const mail = await sendMail({
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

  const user = await updateDb((db) => {
    const found = db.users.find((item) => item.id === body.userId)
    if (!found) return null
    if (body.status) found.status = body.status
    if (body.plan) found.plan = body.plan
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
  const db = await readDb()
  return NextResponse.json({ user: serializeUsers(db).find((item) => item.id === user.id) })
}
