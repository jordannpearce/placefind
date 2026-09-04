"use client"

import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TIER_TO_PLAN, type Tier } from "@/lib/pricing-tiers"

type Interval = "month" | "year"

type PricingCheckoutProps = {
  tiers: Tier[]
  email: string
  country: string | null
  clientToken: string
  environment: "production" | "sandbox"
  successUrl: string
}

function overlaySettings(successUrl: string) {
  return {
    displayMode: "overlay" as const,
    variant: "one-page" as const,
    successUrl,
  }
}

function checkoutCustomer(email: string, country: string | null) {
  if (!email) return {}
  return {
    customer: {
      email,
      ...(country ? { address: { countryCode: country } } : {}),
    },
  }
}

export function PricingCheckout({
  tiers,
  email,
  country,
  clientToken,
  environment,
  successUrl,
}: PricingCheckoutProps) {
  const [interval, setInterval] = useState<Interval>("month")
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [totals, setTotals] = useState<Record<string, string>>({})
  const [previewError, setPreviewError] = useState(() =>
    clientToken ? "" : "Paddle checkout is not configured."
  )
  const [checkoutError, setCheckoutError] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(() => Boolean(clientToken))

  const items = useMemo(
    () =>
      tiers.flatMap((tier) =>
        [tier.priceId.month, tier.priceId.year]
          .filter(Boolean)
          .map((priceId) => ({ priceId, quantity: 1 }))
      ),
    [tiers]
  )

  useEffect(() => {
    let cancelled = false
    if (!clientToken) return
    initializePaddle({
      token: clientToken,
      environment,
      checkout: { settings: overlaySettings(successUrl) },
    })
      .then((instance) => {
        if (!cancelled && instance) setPaddle(instance)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : "Paddle failed to load.")
          setLoadingPreview(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [clientToken, environment, successUrl])

  useEffect(() => {
    if (!paddle || items.length === 0) return
    let cancelled = false

    function preview(withCountry: boolean) {
      const params: Parameters<Paddle["PricePreview"]>[0] = { items }
      if (withCountry && country) params.address = { countryCode: country }
      return paddle!.PricePreview(params)
    }

    preview(true)
      .catch((error: unknown) => {
        if (country) return preview(false)
        throw error
      })
      .then((response) => {
        if (cancelled) return
        const next: Record<string, string> = {}
        for (const line of response.data.details.lineItems) {
          const formatted = line.formattedTotals.total
          if (line.price.id && formatted) next[line.price.id] = formatted
        }
        setTotals(next)
        setLoadingPreview(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPreviewError(error instanceof Error ? error.message : "Paddle could not return prices.")
        setLoadingPreview(false)
      })
    return () => {
      cancelled = true
    }
  }, [paddle, items, country])

  function subscribe(tier: Tier) {
    setCheckoutError("")
    const priceId = interval === "month" ? tier.priceId.month : tier.priceId.year
    if (!paddle || !priceId) {
      setCheckoutError("Checkout is not ready yet.")
      return
    }
    // Do not pass trialPeriod — there is no free trial. Signup already seeds demo data.
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...checkoutCustomer(email, country),
      customData: { plan: TIER_TO_PLAN[tier.name] },
      settings: overlaySettings(successUrl),
    })
  }

  return (
    <div>
      <div className="flex justify-center">
        <Tabs
          value={interval}
          onValueChange={(value) => setInterval(value === "year" ? "year" : "month")}
        >
          <TabsList>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="year">Annual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {previewError ? (
        <p className="mt-4 text-center text-sm text-destructive">{previewError}</p>
      ) : null}
      {checkoutError ? (
        <p className="mt-4 text-center text-sm text-destructive">{checkoutError}</p>
      ) : null}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => {
          const featured = tier.name === "Pro"
          const priceId = interval === "month" ? tier.priceId.month : tier.priceId.year
          const formatted = priceId ? totals[priceId] : ""
          return (
            <div
              key={tier.name}
              className={`flex flex-col rounded-2xl border p-6 ${featured ? "bg-foreground text-background" : "bg-card"}`}
            >
              <p className={`text-sm ${featured ? "text-background/70" : "text-muted-foreground"}`}>{tier.name}</p>
              <p className="font-heading mt-2 text-5xl">{loadingPreview ? "…" : formatted || "—"}</p>
              <p className={`text-sm ${featured ? "text-background/70" : "text-muted-foreground"}`}>
                {interval === "month" ? "per month" : "per year"}
                {formatted ? ", total from Paddle" : ""}
              </p>
              <p className="mt-4 text-sm leading-6">{tier.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature}>· {feature}</li>
                ))}
              </ul>
              <Button
                size="lg"
                variant={featured ? "secondary" : "default"}
                className="mt-6 w-full"
                disabled={!paddle || !priceId || loadingPreview}
                onClick={() => subscribe(tier)}
              >
                Subscribe
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
