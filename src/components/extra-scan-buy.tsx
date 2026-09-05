"use client"

import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { EXTRA_SCAN_PRICE, STARTER_INCLUDED_SCANS } from "@/lib/plans"
import type { ScanQuotaSnapshot } from "@/lib/types"

type ExtraScanBuyProps = {
  quota: ScanQuotaSnapshot
}

export function ExtraScanBuy({ quota }: ExtraScanBuyProps) {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/me/extra-scans")
      .then(async (response) => {
        const data = (await response.json()) as {
          clientToken?: string
          environment?: "production" | "sandbox"
          successUrl?: string
          error?: string
        }
        if (!response.ok || !data.clientToken || !data.environment) {
          throw new Error(data.error || "Extra scan checkout is not ready.")
        }
        return initializePaddle({
          token: data.clientToken,
          environment: data.environment,
          checkout: {
            settings: {
              displayMode: "overlay",
              variant: "one-page",
              successUrl: data.successUrl,
            },
          },
        })
      })
      .then((instance) => {
        if (!cancelled && instance) setPaddle(instance)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load checkout.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function buy() {
    setPending(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/me/extra-scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 1 }),
      })
      const data = (await response.json()) as {
        priceId?: string
        quantity?: number
        successUrl?: string
        customData?: Record<string, string>
        error?: string
      }
      if (!response.ok || !data.priceId) {
        throw new Error(data.error || "Could not start checkout.")
      }
      if (!paddle) throw new Error("Checkout is not ready yet.")
      paddle.Checkout.open({
        items: [{ priceId: data.priceId, quantity: data.quantity || 1 }],
        customData: data.customData,
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          successUrl: data.successUrl,
        },
      })
      setMessage("Complete payment in the checkout window. Extra scans appear after Paddle confirms.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.")
    } finally {
      setPending(false)
    }
  }

  const remaining = quota.remaining ?? 0

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Live Maps scans</h2>
      <p className="text-sm text-muted-foreground">
        Starter includes {STARTER_INCLUDED_SCANS} live grid scans each calendar month. Extra scans
        are ${EXTRA_SCAN_PRICE} each and stay until you use them. Maps runs on GridPins — you do
        not enter an API key.
      </p>
      <p className="text-sm">
        {remaining} scan{remaining === 1 ? "" : "s"} left this month
        {quota.used > 0 ? ` · ${quota.used} of ${quota.included} included used` : ""}
        {quota.extraCredits > 0
          ? ` · ${quota.extraCredits} extra credit${quota.extraCredits === 1 ? "" : "s"}`
          : ""}
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      <Button type="button" size="lg" disabled={pending || !paddle} onClick={() => void buy()}>
        {pending ? "Opening checkout…" : `Buy 1 extra scan · $${EXTRA_SCAN_PRICE}`}
      </Button>
    </section>
  )
}
