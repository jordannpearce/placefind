import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { clearImpersonation, writeImpersonation } from "@/lib/session"

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: { userId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })
  if (body.userId === admin.user.id) {
    await clearImpersonation()
    return NextResponse.json({ ok: true })
  }

  const db = await readDb()
  const target = db.users.find((user) => user.id === body.userId)
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (target.status === "suspended") {
    return NextResponse.json({ error: "That account is suspended." }, { status: 400 })
  }

  await writeImpersonation(target.id)
  return NextResponse.json({ ok: true, userId: target.id })
}

export async function DELETE() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await clearImpersonation()
  return NextResponse.json({ ok: true })
}
