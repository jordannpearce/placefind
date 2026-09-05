import { NextRequest, NextResponse } from "next/server"

import { createManagedUser, sendManagedUserWelcome, serializeAdminUsers } from "@/lib/admin-managed-user"
import { requireAdmin } from "@/lib/auth-guard"
import { findOrCreateAgency, readDb, updateDb } from "@/lib/db"
import { purgeUserAccount } from "@/lib/purge-user"
import { clearImpersonation, getImpersonatedUserId } from "@/lib/session"
import { billingEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import {
  computeTrialEndsAt,
  isTrialUnit,
  parseTrialEndsAt,
  type TrialUnit,
} from "@/lib/paddle-access"
import { clampExtraCampaigns, isPlanId, PLANS } from "@/lib/plans"
import { setExtraScanCredits } from "@/lib/scan-quota"
import type { PlanId, User, UserRole, UserStatus } from "@/lib/types"

function suspendBlockedReason(db: Awaited<ReturnType<typeof readDb>>, target: User, actorId: string) {
  if (target.id === actorId) return "You cannot suspend your own account."
  if (target.role === "admin") {
    const remaining = db.users.filter(
      (item) => item.id !== target.id && item.role === "admin" && item.status === "active"
    )
    if (remaining.length === 0) return "Cannot suspend the last admin."
  }
  return null
}

function trialFromBody(body: { trialEndsAt?: string | null; trialAmount?: number; trialUnit?: TrialUnit | string }) {
  if (body.trialAmount !== undefined || body.trialUnit !== undefined) {
    const amount = Number(body.trialAmount)
    const unit = isTrialUnit(body.trialUnit) ? body.trialUnit : "days"
    return computeTrialEndsAt(amount, unit)
  }
  if (body.trialEndsAt === null) return null
  if (body.trialEndsAt !== undefined) return parseTrialEndsAt(body.trialEndsAt)
  return undefined
}

const serializeUsers = serializeAdminUsers

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
    extraScanCredits?: number
    role?: UserRole
    status?: UserStatus
    marketingOptIn?: boolean
    sendEmail?: boolean
    trialAmount?: number
    trialUnit?: TrialUnit | string
    trialEndsAt?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = body.name?.trim() || ""
  const email = body.email?.trim().toLowerCase() || ""
  const password = body.password || ""
  const invite = !password
  if (name.length < 2) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  if (!invite && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const trialEndsAt = trialFromBody(body) ?? null
  const created = await updateDb((db) =>
    createManagedUser(db, {
      name,
      email,
      password,
      company: body.company,
      agencyName: body.agencyName,
      plan: body.plan,
      extraCampaigns: body.extraCampaigns,
      extraScanCredits: body.extraScanCredits,
      role: body.role,
      status: body.status,
      marketingOptIn: body.marketingOptIn,
      trialEndsAt,
      defaultPlan: "starter",
    })
  )

  if (!created.ok) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
  }
  const user = created.user
  const preview = await sendManagedUserWelcome(created, body.sendEmail !== false)

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
    name?: string
    email?: string
    company?: string
    status?: UserStatus
    plan?: PlanId
    extraCampaigns?: number
    extraScanCredits?: number
    role?: UserRole
    agencyId?: string
    agencyName?: string
    marketingOptIn?: boolean
    trialAmount?: number
    trialUnit?: TrialUnit | string
    trialEndsAt?: string | null
    clearTrial?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const previous = { plan: "", extraCampaigns: 0 }
  const patched = await updateDb((db) => {
    const found = db.users.find((item) => item.id === body.userId)
    if (!found) return { error: "User not found" as const, status: 404 as const }
    const nextName = typeof body.name === "string" ? body.name.trim() : null
    if (nextName !== null && nextName.length < 2) {
      return { error: "Name is required." as const, status: 400 as const }
    }
    const nextEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null
    if (nextEmail !== null) {
      if (!nextEmail.includes("@")) {
        return { error: "A valid email is required." as const, status: 400 as const }
      }
      if (db.users.some((item) => item.id !== found.id && item.email === nextEmail)) {
        return { error: "An account with that email already exists." as const, status: 409 as const }
      }
    }
    if (body.status === "suspended") {
      const blocked = suspendBlockedReason(db, found, admin.user.id)
      if (blocked) return { error: blocked, status: 400 as const }
    }
    previous.plan = found.plan
    previous.extraCampaigns = found.extraCampaigns
    if (nextName !== null) found.name = nextName
    if (nextEmail !== null) found.email = nextEmail
    if (typeof body.company === "string") found.company = body.company.trim()
    if (body.status) found.status = body.status
    if (body.plan && isPlanId(body.plan) && PLANS[body.plan]) found.plan = body.plan
    if (body.extraCampaigns !== undefined) {
      found.extraCampaigns = clampExtraCampaigns(found.plan, body.extraCampaigns)
    } else {
      found.extraCampaigns = clampExtraCampaigns(found.plan, found.extraCampaigns)
    }
    if (body.extraScanCredits !== undefined) {
      setExtraScanCredits(found, body.extraScanCredits)
    }
    if (body.role) found.role = body.role
    if (typeof body.marketingOptIn === "boolean") found.marketingOptIn = body.marketingOptIn
    if (body.clearTrial) {
      found.trialEndsAt = null
    } else {
      const nextTrial = trialFromBody(body)
      if (nextTrial !== undefined) found.trialEndsAt = nextTrial
    }
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
    return { user: found }
  })
  if ("error" in patched) {
    return NextResponse.json({ error: patched.error }, { status: patched.status })
  }
  const user = patched.user
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

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = request.nextUrl.searchParams.get("userId")?.trim() || ""
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const result = await updateDb((db) => purgeUserAccount(db, userId, admin.user.id))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const impersonated = await getImpersonatedUserId()
  if (impersonated === userId) {
    await clearImpersonation()
  }

  return NextResponse.json({ ok: true, userId: result.userId, email: result.email })
}
