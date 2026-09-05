import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import {
  assignableLeadAgencies,
  costPerLeadUsd,
  leadFromInquiry,
  parseCostPerLeadUsd,
  removeLead,
} from "@/lib/leads"
import { parseGetFoundInquiry } from "@/lib/public-forms"

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

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseGetFoundInquiry(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const lead = await updateDb((db) => {
      const created = leadFromInquiry(parsed.data, false)
      db.leads.unshift(created)
      db.leads = db.leads.slice(0, 500)
      return created
    })

    const db = await readDb()
    return NextResponse.json({
      ok: true,
      lead,
      leads: db.leads,
      costPerLeadUsd: costPerLeadUsd(db.settings),
      agencies: assignableLeadAgencies(db.users),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create this lead."
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

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const id = request.nextUrl.searchParams.get("id")?.trim() || ""
  if (!id) return NextResponse.json({ error: "Lead id is required." }, { status: 400 })

  const removed = await updateDb((db) => removeLead(db.leads, id))
  if (!removed) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  return NextResponse.json({ ok: true, id: removed.id })
}
