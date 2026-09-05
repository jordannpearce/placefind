import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { billingRequiredResponse } from "@/lib/billing-gate"
import { updateDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { consumeScanCredit, scanQuotaSnapshot } from "@/lib/scan-quota"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ quota: scanQuotaSnapshot(auth.user) })
}

export async function POST() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await updateDb((db) => {
    if (!userHasSoftwareAccess(auth.user, db)) {
      return { billing: true as const }
    }
    const user = db.users.find((item) => item.id === auth.user.id)
    if (!user) return { error: "User not found" as const, status: 404 as const }
    const consumed = consumeScanCredit(user)
    if (!consumed.ok) {
      return { error: consumed.error, status: 402 as const, quota: consumed.quota }
    }
    return { quota: consumed.quota }
  })

  if ("billing" in result && result.billing) {
    const { readDb } = await import("@/lib/db")
    return billingRequiredResponse(auth.user, await readDb())
  }
  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: result.error, quota: "quota" in result ? result.quota : undefined },
      { status: result.status }
    )
  }
  return NextResponse.json({ ok: true, quota: result.quota })
}
