import { NextRequest, NextResponse } from "next/server"

import { createManagedUser, sendManagedUserWelcome, serializeAdminUsers } from "@/lib/admin-managed-user"
import { requireAdmin } from "@/lib/auth-guard"
import { findOrCreateAgency, readDb, updateDb } from "@/lib/db"
import {
  computeTrialEndsAt,
  isTrialUnit,
  parseTrialEndsAt,
  type TrialUnit,
} from "@/lib/paddle-access"
import { purgeUserAccount } from "@/lib/purge-user"
import { clearImpersonation, getImpersonatedUserId } from "@/lib/session"
import { isAgencyAccount } from "@/lib/agency-account"
import { isPlanId, PLANS } from "@/lib/plans"
import type { PlanId } from "@/lib/types"

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

function agencyPayload(db: Awaited<ReturnType<typeof readDb>>) {
  const accounts = serializeAdminUsers(db).filter((user) => isAgencyAccount(user))
  return {
    agencies: db.agencies.map((agency) => ({
      ...agency,
      userCount: db.users.filter((user) => user.agencyId === agency.id).length,
    })),
    accounts,
  }
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const db = await readDb()
    return NextResponse.json(agencyPayload(db))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list agencies"
    return NextResponse.json({ error: message }, { status: 500 })
  }
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

  if (!email) {
    if (name.length < 2) return NextResponse.json({ error: "Agency name is required." }, { status: 400 })
    const agency = await updateDb((db) => findOrCreateAgency(db, name))
    const db = await readDb()
    return NextResponse.json({
      agency: {
        ...agency,
        userCount: db.users.filter((user) => user.agencyId === agency.id).length,
      },
    })
  }

  if (name.length < 2) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const created = await updateDb((db) =>
    createManagedUser(db, {
      name,
      email,
      password,
      company: body.company?.trim() || name,
      agencyName: body.agencyName?.trim() || body.company?.trim() || name,
      plan: isPlanId(body.plan) && PLANS[body.plan] ? body.plan : "agency",
      extraCampaigns: body.extraCampaigns,
      role: "user",
      marketingOptIn: body.marketingOptIn,
      trialEndsAt: trialFromBody(body) ?? null,
      defaultPlan: "agency",
    })
  )

  if (!created.ok) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
  }

  const preview = await sendManagedUserWelcome(created, body.sendEmail !== false)
  try {
    const db = await readDb()
    return NextResponse.json({
      user: serializeAdminUsers(db).find((item) => item.id === created.user.id),
      previewUrl: preview,
      ...agencyPayload(db),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agency created, but listing failed"
    return NextResponse.json({ error: message, userId: created.user.id }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = request.nextUrl.searchParams.get("userId")?.trim() || ""
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

  const result = await updateDb((db) => {
    const target = db.users.find((item) => item.id === userId)
    if (!target) return { ok: false as const, error: "User not found", status: 404 as const }
    if (!isAgencyAccount(target)) {
      return {
        ok: false as const,
        error: "That account is not an agency account. Delete it from Users.",
        status: 400 as const,
      }
    }
    return purgeUserAccount(db, userId, admin.user.id)
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const impersonated = await getImpersonatedUserId()
  if (impersonated === userId) {
    await clearImpersonation()
  }

  return NextResponse.json({ ok: true, userId: result.userId, email: result.email })
}
