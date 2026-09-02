import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import { publicUser } from "@/lib/session"
import type { PlanId, UserStatus } from "@/lib/types"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = readDb()
  return NextResponse.json({
    users: db.users.map((user) => ({
      ...publicUser(user),
      campaignCount: db.workspaces[user.id]?.campaigns.length ?? 0,
    })),
  })
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: { userId?: string; status?: UserStatus; plan?: PlanId; role?: "user" | "admin" }
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
    return found
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json({ user: publicUser(user) })
}
