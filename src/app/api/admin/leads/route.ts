import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import { assignableLeadAgencies, costPerLeadUsd, parseCostPerLeadUsd } from "@/lib/leads"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const db = await readDb()
    return NextResponse.json({
      leads: db.leads,
      costPerLeadUsd: costPerLeadUsd(db.settings),
      agencies: assignableLeadAgencies(db.users),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load leads"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: { costPerLeadUsd?: number | string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (body.costPerLeadUsd === undefined) {
    return NextResponse.json({ error: "costPerLeadUsd is required." }, { status: 400 })
  }

  const amount = parseCostPerLeadUsd(body.costPerLeadUsd)
  await updateDb((db) => {
    db.settings.costPerLeadUsd = amount
  })
  return NextResponse.json({ ok: true, costPerLeadUsd: amount })
}
