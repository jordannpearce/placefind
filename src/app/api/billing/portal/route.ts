import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { getPaddle, paddleApiKey } from "@/lib/paddle"
import { findPaddleCustomerId } from "@/lib/paddle-fulfillment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function mintPortalRedirect() {
  const auth = await requireUser()
  if (!auth) redirect("/login?next=/account")

  const db = await readDb()
  const customerId = findPaddleCustomerId(db, auth.user)
  if (!customerId) redirect("/account?billing=missing")
  if (!paddleApiKey()) {
    return NextResponse.json({ error: "Paddle billing is not configured." }, { status: 503 })
  }

  const subscriptionIds = db.subscriptions
    .filter((row) => row.customerId === customerId)
    .map((row) => row.subscriptionId)

  let url = ""
  try {
    const session = await getPaddle().customerPortalSessions.create(customerId, subscriptionIds)
    url = session.urls.general.overview || ""
  } catch (error) {
    console.error("Paddle portal session failed:", error)
    return NextResponse.json({ error: "Could not open the billing portal." }, { status: 502 })
  }
  if (!url) {
    return NextResponse.json({ error: "Paddle did not return a portal URL." }, { status: 502 })
  }
  redirect(url)
}

export async function GET() {
  return mintPortalRedirect()
}

export async function POST() {
  return mintPortalRedirect()
}
