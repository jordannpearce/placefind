"use client"

import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AI_PROMPTS_PER_BRAND, AI_VISIBILITY_PRICE } from "@/lib/plans"

export type AiBrandFormValues = {
  name: string
  address: string
  phone: string
  website: string
  competitors: string
}

export function AiVisibilityBuy({
  onComplimentary,
}: {
  onComplimentary?: (input: AiBrandFormValues) => Promise<void>
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [competitors, setCompetitors] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/me/ai-visibility")
      .then(async (response) => {
        const data = (await response.json()) as {
          clientToken?: string
          environment?: "production" | "sandbox"
          successUrl?: string
          error?: string
        }
        if (!response.ok || !data.clientToken || !data.environment) {
          throw new Error(data.error || "AI Visibility checkout is not ready.")
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

  function formValues(): AiBrandFormValues {
    return { name, address, phone, website, competitors }
  }

  function resetForm() {
    setName("")
    setAddress("")
    setPhone("")
    setWebsite("")
    setCompetitors("")
  }

  async function buy() {
    setPending(true)
    setError("")
    setMessage("")
    try {
      if (name.trim().length < 2) {
        throw new Error("Enter the company name.")
      }
      const values = formValues()
      if (onComplimentary) {
        await onComplimentary(values)
        setMessage("Brand added. Prompt scans will look for this company name, address, phone, and website.")
        resetForm()
        return
      }
      const response = await fetch("/api/me/ai-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = (await response.json()) as {
        priceId?: string
        successUrl?: string
        customData?: Record<string, string>
        error?: string
      }
      if (!response.ok || !data.priceId) {
        throw new Error(data.error || "Could not start checkout.")
      }
      if (!paddle) throw new Error("Checkout is not ready yet.")
      paddle.Checkout.open({
        items: [{ priceId: data.priceId, quantity: 1 }],
        customData: data.customData,
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          successUrl: data.successUrl,
        },
      })
      setMessage("Complete payment in the checkout window. The brand unlocks after Paddle confirms.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Add a brand · ${AI_VISIBILITY_PRICE}/month</h2>
      <p className="text-sm text-muted-foreground">
        Available on every plan. Each brand includes {AI_PROMPTS_PER_BRAND} prompt scans per month
        across the AI models. One prompt is one scan. Each scan checks whether the answer includes
        this company name, address, phone number, and website.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ai-company-name">Company name</Label>
          <Input
            id="ai-company-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Plumbing"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-website">Website</Label>
          <Input
            id="ai-website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://acmeplumbing.com"
            autoComplete="url"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ai-address">Address</Label>
          <Input
            id="ai-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="1200 Congress Ave, Austin, TX 78701"
            autoComplete="street-address"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ai-phone">Phone number</Label>
          <Input
            id="ai-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(512) 555-0142"
            autoComplete="tel"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-competitors">Competitors to watch</Label>
        <Textarea
          id="ai-competitors"
          value={competitors}
          onChange={(event) => setCompetitors(event.target.value)}
          placeholder="Rival Plumbing, City Drain Co"
          rows={2}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      <Button type="button" size="lg" disabled={pending || (!onComplimentary && !paddle)} onClick={() => void buy()}>
        {pending
          ? "Working…"
          : onComplimentary
            ? "Add complimentary brand"
            : `Subscribe · $${AI_VISIBILITY_PRICE}/month`}
      </Button>
    </section>
  )
}
