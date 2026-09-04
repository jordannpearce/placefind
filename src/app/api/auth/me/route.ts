import { NextResponse } from "next/server"

import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { billingPathForUser, userHasSoftwareAccess } from "@/lib/paddle-access"
import { publicUser } from "@/lib/session"

export async function GET() {
  const acting = await requireUser()
  if (!acting) return NextResponse.json({ user: null }, { status: 401 })
  const admin = await requireAdmin()
  const impersonating = Boolean(admin && admin.user.id !== acting.user.id)
  const db = await readDb()
  const current = userHasSoftwareAccess(acting.user, db)
  return NextResponse.json({
    user: publicUser(acting.user),
    impersonating,
    admin: admin ? publicUser(admin.user) : null,
    softwareAccess: current,
    billingUrl: current ? "/dashboard" : billingPathForUser(acting.user, db),
  })
}
