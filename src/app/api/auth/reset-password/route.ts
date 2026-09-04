import { NextResponse } from "next/server"

import { consumeToken, inspectToken } from "@/lib/auth-tokens"
import { readDb, updateDb } from "@/lib/db"
import { hashPassword } from "@/lib/password"

function tokenFrom(request: Request, body?: { token?: string }) {
  const query = new URL(request.url).searchParams.get("token")?.trim() || ""
  return body?.token?.trim() || query
}

export async function GET(request: Request) {
  const token = tokenFrom(request)
  if (!token) {
    return NextResponse.json({ status: "missing", error: "This reset link is missing a token." })
  }
  const db = await readDb()
  const status = inspectToken(db, token, "reset")
  const error =
    status === "expired"
      ? "This reset link has expired. Request a new one."
      : status === "invalid"
        ? "This reset link is invalid or has already been used."
        : status === "missing"
          ? "This reset link is missing a token."
          : undefined
  return NextResponse.json({ status, error })
}

export async function POST(request: Request) {
  let body: { token?: string; password?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const token = tokenFrom(request, body)
  const password = body.password || ""
  if (!token) {
    return NextResponse.json({ error: "This reset link is missing a token." }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const result = await updateDb((db) => {
    const consumed = consumeToken(db, token, "reset")
    if (consumed.status !== "ok" || !consumed.user) return consumed
    consumed.user.passwordHash = hashPassword(password)
    if (consumed.user.status === "pending") consumed.user.status = "active"
    return consumed
  })

  if (result.status === "missing") {
    return NextResponse.json({ error: "This reset link is missing a token." }, { status: 400 })
  }
  if (result.status === "expired") {
    return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 400 })
  }
  if (result.status !== "ok" || !result.user) {
    return NextResponse.json(
      { error: "This reset link is invalid or has already been used." },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: "Your password has been updated. You can log in with the new password.",
  })
}
