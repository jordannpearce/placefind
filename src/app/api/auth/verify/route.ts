import { NextResponse } from "next/server"

import { updateDb } from "@/lib/db"
import { hashToken } from "@/lib/password"
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
  const tokenHash = hashToken(token)

  const user = await updateDb((db) => {
    const record = db.tokens.find(
      (item) => item.type === "activation" && item.tokenHash === tokenHash
    )
    if (!record) return null
    if (new Date(record.expiresAt).getTime() < Date.now()) return null
    const found = db.users.find((item) => item.id === record.userId)
    if (!found) return null
    found.status = "active"
    db.tokens = db.tokens.filter((item) => item.id !== record.id)
    return found
  })

  if (!user) {
    return NextResponse.json({ error: "This activation link is invalid or expired." }, { status: 400 })
  }

  await writeSession(user)
  return NextResponse.json({ ok: true })
}
