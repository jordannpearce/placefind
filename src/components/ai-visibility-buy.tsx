"use client"

import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { UsStateSelect } from "@/components/us-state-select"
import { AI_PROMPTS_PER_BRAND, AI_SCANS_PER_PROMPT, AI_VISIBILITY_PRICE } from "@/lib/plans"

export type AiBrandFormValues = {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
  website: string
  competitors: string
}

const emptyValues: AiBrandFormValues = {
  name: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  website: "",
  competitors: "",
}

function readNamedValue(form: HTMLFormElement | null, name: string, id: string, fallback: string) {
  if (form) {
    const data = new FormData(form)
    const fromForm = data.get(name)
    if (typeof fromForm === "string" && fromForm.trim()) return fromForm
    const named = form.elements.namedItem(name)
    if (named instanceof HTMLInputElement && named.value.trim()) return named.value
    if (named instanceof HTMLTextAreaElement && named.value.trim()) return named.value
  }
  if (typeof document !== "undefined") {
    const el = document.getElementById(id)
    if (el && "value" in el && typeof (el as HTMLInputElement).value === "string") {
      const value = (el as HTMLInputElement).value
      if (value.trim()) return value
    }
  }
  return fallback
}

export function AiVisibilityBuy({
  onComplimentary,
}: {
  onComplimentary?: (input: AiBrandFormValues) => Promise<void>
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [values, setValues] = useState(emptyValues)
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

  function setField<K extends keyof AiBrandFormValues>(key: K, value: AiBrandFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function formValues(form: HTMLFormElement | null): AiBrandFormValues {
    return {
      name: readNamedValue(form, "companyName", "ai-company-name", values.name),
      street: readNamedValue(form, "street", "ai-street", values.street),
      city: readNamedValue(form, "city", "ai-city", values.city),
      state: readNamedValue(form, "state", "ai-state", values.state),
      zip: readNamedValue(form, "zip", "ai-zip", values.zip),
      phone: readNamedValue(form, "phone", "ai-phone", values.phone),
      website: readNamedValue(form, "website", "ai-website", values.website),
      competitors: readNamedValue(form, "competitors", "ai-competitors", values.competitors),
    }
  }

  async function buy(form: HTMLFormElement | null) {
    setPending(true)
    setError("")
    setMessage("")
    try {
      const next = formValues(form)
      setValues(next)
      if (next.name.trim().length < 2) {
        throw new Error("Enter the company name.")
      }
      if (next.city.trim().length < 2) {
        throw new Error("Enter the city.")
      }
      if (!next.state.trim()) {
        throw new Error("Choose a state.")
      }
      if (onComplimentary) {
        await onComplimentary(next)
        setMessage(
          "Brand added. Prompt scans use this city and state for local results and look for the company name, street, phone, and website."
        )
        setValues(emptyValues)
        form?.reset()
        return
      }
      const response = await fetch("/api/me/ai-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
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
        Available on every plan. Each brand includes {AI_PROMPTS_PER_BRAND} prompts you type
        yourself. Each prompt can be scanned {AI_SCANS_PER_PROMPT} times, and those runs stay in
        history so you can compare visibility. City and state set the local Maps location for the
        scans. Each scan checks the company name, street, phone, and website.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void buy(event.currentTarget)
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-company-name">Company name</Label>
            <Input
              id="ai-company-name"
              name="companyName"
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
              onInput={(event) => setField("name", (event.target as HTMLInputElement).value)}
              placeholder="Acme Plumbing"
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-website">Website</Label>
            <Input
              id="ai-website"
              name="website"
              value={values.website}
              onChange={(event) => setField("website", event.target.value)}
              onInput={(event) => setField("website", (event.target as HTMLInputElement).value)}
              placeholder="https://acmeplumbing.com"
              autoComplete="url"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="ai-street">Street address</Label>
            <Input
              id="ai-street"
              name="street"
              value={values.street}
              onChange={(event) => setField("street", event.target.value)}
              onInput={(event) => setField("street", (event.target as HTMLInputElement).value)}
              placeholder="1200 Congress Ave"
              autoComplete="address-line1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-city">City</Label>
            <Input
              id="ai-city"
              name="city"
              value={values.city}
              onChange={(event) => setField("city", event.target.value)}
              onInput={(event) => setField("city", (event.target as HTMLInputElement).value)}
              placeholder="Austin"
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-state">State</Label>
            <input type="hidden" name="state" value={values.state} />
            <UsStateSelect id="ai-state" value={values.state} onChange={(next) => setField("state", next)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-zip">ZIP</Label>
            <Input
              id="ai-zip"
              name="zip"
              value={values.zip}
              onChange={(event) => setField("zip", event.target.value)}
              onInput={(event) => setField("zip", (event.target as HTMLInputElement).value)}
              placeholder="78701"
              autoComplete="postal-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-phone">Phone number</Label>
            <Input
              id="ai-phone"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={(event) => setField("phone", event.target.value)}
              onInput={(event) => setField("phone", (event.target as HTMLInputElement).value)}
              placeholder="(512) 555-0142"
              autoComplete="tel"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-competitors">Competitors to watch</Label>
          <Textarea
            id="ai-competitors"
            name="competitors"
            value={values.competitors}
            onChange={(event) => setField("competitors", event.target.value)}
            placeholder="Rival Plumbing, City Drain Co"
            rows={2}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        <Button type="submit" size="lg" disabled={pending || (!onComplimentary && !paddle)}>
          {pending
            ? "Working…"
            : onComplimentary
              ? "Add complimentary brand"
              : `Subscribe · $${AI_VISIBILITY_PRICE}/month`}
        </Button>
      </form>
    </section>
  )
}
