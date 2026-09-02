import { NextResponse } from "next/server"

import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { publicUser } from "@/lib/session"

export async function GET() {
  const acting = await requireUser()
  if (!acting) return NextResponse.json({ user: null }, { status: 401 })
  const admin = await requireAdmin()
  const impersonating = Boolean(admin && admin.user.id !== acting.user.id)
  return NextResponse.json({
    user: publicUser(acting.user),
    impersonating,
    admin: admin ? publicUser(admin.user) : null,
  })
}
