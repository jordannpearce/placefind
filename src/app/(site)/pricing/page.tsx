import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { PricingCheckout } from "@/components/pricing-checkout"
import { paddleClientToken, paddleJsEnvironment, publicAppUrl } from "@/lib/paddle"
import { detectCheckoutCountry } from "@/lib/paddle-country"
import { assertClientTokenMatchesEnvironment } from "@/lib/paddle-env"
import { getPricingTiers } from "@/lib/pricing-tiers"
import { readSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Pricing — GridPins",
  description:
    "Starter, Pro, and Advanced plans for Google Maps grid rank tracking. Localized prices and overlay checkout through Paddle.",
}

export const dynamic = "force-dynamic"

export default async function PricingPage() {
  const session = await readSession()
  const country = detectCheckoutCountry(await headers())
  const tiers = getPricingTiers()

  let checkout:
    | { clientToken: string; environment: "production" | "sandbox"; successUrl: string }
    | { error: string }

  try {
    const environment = paddleJsEnvironment()
    const clientToken = paddleClientToken()
    if (!clientToken) {
      throw new Error("PADDLE_CLIENT_TOKEN or NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set")
    }
    assertClientTokenMatchesEnvironment(clientToken, environment)
    checkout = {
      clientToken,
      environment,
      successUrl: `${publicAppUrl()}/welcome`,
    }
  } catch (error) {
    checkout = { error: error instanceof Error ? error.message : "Paddle checkout is not configured." }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-4xl tracking-tight md:text-5xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Three plans. Same grid tracker. Starter is one brand and one location. Pro is five campaigns
        with optional extra slots. Advanced is fifty campaigns for shops that run many listings.
        The total you see is what Paddle returns for your country — we do not recalculate it.
        Payments are processed by Paddle. Refunds follow the{" "}
        <Link href="/refunds" className="text-primary hover:underline">
          Refund Policy
        </Link>
        : we only credit a month when you show the software failed more than 10% of that billing
        cycle.
      </p>
      {session?.email ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Checkout will prefill <span className="text-foreground">{session.email}</span>. After
          Paddle confirms, we match the subscription to this workspace.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Already have a workspace?{" "}
          <Link href="/login?next=/pricing" className="text-primary hover:underline">
            Log in
          </Link>{" "}
          so we can attach the subscription to your account.
        </p>
      )}
      {"error" in checkout ? (
        <p className="mt-10 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {checkout.error}
        </p>
      ) : (
        <div className="mt-10">
          <PricingCheckout
            tiers={tiers}
            email={session?.email || ""}
            country={country}
            clientToken={checkout.clientToken}
            environment={checkout.environment}
            successUrl={checkout.successUrl}
          />
        </div>
      )}
    </div>
  )
}
