import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { findOrCreateAgency, readDb, updateDb } from "@/lib/db"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await readDb()
  return NextResponse.json({
    agencies: db.agencies.map((agency) => ({
      ...agency,
      userCount: db.users.filter((user) => user.agencyId === agency.id).length,
    })),
  })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: { name?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const name = body.name?.trim() || ""
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
