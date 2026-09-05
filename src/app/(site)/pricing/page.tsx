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

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>
}) {
  const params = await searchParams
  const locked = params.billing === "required"
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
      {locked ? (
        <div className="mt-6 max-w-2xl rounded-2xl border bg-card px-4 py-3 text-sm">
          <p className="font-medium">The tracker is locked until billing is current.</p>
          <p className="mt-1 text-muted-foreground">
            An active plan is required to run grids. Subscribe below to unlock ranking scans and
            workspace campaigns. If you already have a payment method on file, open{" "}
            <Link href="/account" className="text-primary hover:underline">
              Account
            </Link>{" "}
            and manage billing to update your card. You stay signed in either way.
          </p>
        </div>
      ) : null}
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Three plans. Same grid tracker. Starter is one brand, one location, and five Maps
        scans each month. Extra scans are $5. Pro is five campaigns with optional extra slots.
        Advanced is fifty campaigns for shops that run many listings. On every plan you can add
        AI Visibility for $199 per month per brand — 10 typed prompts, 4 scans each, across ChatGPT, Perplexity,
        Gemini, Copilot, and Google AI Mode.
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
      <section className="mt-16 rounded-2xl border bg-card p-6">
        <h2 className="font-heading text-3xl tracking-tight">AI Visibility add-on</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Maps tells you which streets still put the listing in the local pack. AI models decide
          the shortlist before someone opens Maps. Add AI Visibility on any plan for $199 per
          month per brand. Each brand includes 10 prompts you type yourself. Each prompt can be
          scanned 4 times, and those runs stay in history so you can compare visibility. Scans
          check the company name, street, phone, and website you save with the brand. City and
          state set the local Maps location. Add it
          after you subscribe — from Account or the AI Visibility page in the workspace.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/ai-visibility" className="text-primary hover:underline">
            How prompt scans and citations work
          </Link>
        </p>
      </section>
    </div>
  )
}
