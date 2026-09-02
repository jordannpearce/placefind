import { NextResponse } from "next/server"

import { consumeToken } from "@/lib/auth-tokens"
import { updateDb } from "@/lib/db"
import { writeSession } from "@/lib/session"

export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 })

  const user = await updateDb((db) => {
    const consumed = consumeToken(db, token, "activation")
    if (consumed.status !== "ok" || !consumed.user) return null
    consumed.user.status = "active"
    return consumed.user
  })

  if (!user) {
    return NextResponse.json({ error: "This activation link is invalid or expired." }, { status: 400 })
  }

  await writeSession(user)
  return NextResponse.json({ ok: true })
}
