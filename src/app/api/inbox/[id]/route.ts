import { NextResponse } from "next/server"

import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const record = readDb().emails.find((item) => item.id === id)
  if (!record) return NextResponse.json({ error: "Email not found" }, { status: 404 })

  const user = await requireUser()
  const admin = await requireAdmin()
  const allowed =
    record.provider === "preview" ||
    admin ||
    (user && (user.id === record.userId || user.email === record.to))
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(record)
}
