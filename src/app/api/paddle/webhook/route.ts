import { NextResponse } from "next/server"

import { updateDb } from "@/lib/db"
import { getPaddle, paddleApiKey, paddleWebhookSecret } from "@/lib/paddle"
import { processPaddleEvent } from "@/lib/paddle-fulfillment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const signature = request.headers.get("paddle-signature") ?? ""
  const rawBody = await request.text()
  const secret = paddleWebhookSecret()

  if (!signature || !rawBody || !secret || !paddleApiKey()) {
    return NextResponse.json({ error: "Missing signature, body, or Paddle credentials" }, { status: 400 })
  }

  try {
    const paddle = getPaddle()
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature)
    if (event) {
      await updateDb((db) => processPaddleEvent(db, event))
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Paddle webhook verification or handler failed:", error)
    return NextResponse.json({ error: "Webhook rejected" }, { status: 400 })
  }
}
