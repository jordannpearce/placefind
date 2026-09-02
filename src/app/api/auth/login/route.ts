import { NextResponse } from "next/server"

import { updateDb } from "@/lib/db"
import { verifyPassword } from "@/lib/password"
import { clearImpersonation, writeSession } from "@/lib/session"

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() || ""
  const password = body.password || ""
  const user = await updateDb((db) => db.users.find((item) => item.email === email) ?? null)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 })
  }
  if (user.status === "pending") {
    return NextResponse.json(
      { error: "Activate your account from the email we sent before signing in." },
      { status: 403 }
    )
  }
  if (user.status === "suspended") {
    return NextResponse.json({ error: "This account is suspended. Contact support." }, { status: 403 })
  }

  await updateDb((db) => {
    const found = db.users.find((item) => item.id === user.id)
    if (found) found.lastLoginAt = new Date().toISOString()
  })
  await clearImpersonation()
  await writeSession(user)
  return NextResponse.json({ ok: true, role: user.role })
}
