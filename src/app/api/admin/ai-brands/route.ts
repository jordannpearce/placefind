import { NextResponse } from "next/server"

import {
  brandAssignmentTargets,
  grantComplimentaryBrand,
  listAssignedBrands,
  parseBrandForm,
  removeComplimentaryBrand,
  userHasMatchingBrand,
} from "@/lib/ai-visibility"
import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await readDb()
  return NextResponse.json({
    brands: listAssignedBrands(db.users, db.agencies),
    users: db.users
      .filter((user) => user.role !== "admin")
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company,
        plan: user.plan,
        status: user.status,
        agencyId: user.agencyId,
      })),
    agencies: db.agencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      userCount: db.users.filter((user) => user.agencyId === agency.id && user.role !== "admin").length,
    })),
  })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Parameters<typeof parseBrandForm>[0] & { userId?: string; agencyId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseBrandForm(body)
  if (parsed.name.trim().length < 2) {
    return NextResponse.json({ error: "Enter the company name." }, { status: 400 })
  }

  try {
    const result = await updateDb((next) => {
      const target = brandAssignmentTargets(next.users, next.agencies, {
        userId: body.userId,
        agencyId: body.agencyId,
      })
      if (!target.ok) {
        const error = new Error(target.error) as Error & { status?: number }
        error.status = 400
        throw error
      }
      const granted: Array<{ userId: string; brandId: string }> = []
      const skipped: string[] = []
      for (const user of target.users) {
        if (userHasMatchingBrand(user, parsed)) {
          skipped.push(user.email)
          continue
        }
        const created = grantComplimentaryBrand(user, parsed)
        if (created) granted.push({ userId: user.id, brandId: created.id })
      }
      if (!granted.length) {
        const error = new Error(
          skipped.length
            ? "That brand is already on the selected account."
            : "Could not create the brand."
        ) as Error & { status?: number }
        error.status = 400
        throw error
      }
      return {
        granted,
        skipped,
        label: target.label,
        brands: listAssignedBrands(next.users, next.agencies),
      }
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not assign the brand." },
      { status }
    )
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const url = new URL(request.url)
  const userId = url.searchParams.get("userId") || ""
  const brandId = url.searchParams.get("brandId") || ""
  if (!userId || !brandId) {
    return NextResponse.json({ error: "Choose a brand to remove." }, { status: 400 })
  }

  const removed = await updateDb((next) => {
    const user = next.users.find((row) => row.id === userId)
    if (!user) return null
    return removeComplimentaryBrand(user, brandId)
  })
  if (!removed) {
    return NextResponse.json(
      { error: "Only complimentary brands can be removed from here." },
      { status: 400 }
    )
  }
  const db = await readDb()
  return NextResponse.json({ ok: true, brands: listAssignedBrands(db.users, db.agencies) })
}
