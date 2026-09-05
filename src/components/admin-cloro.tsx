"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CloroSettings = {
  hasCloroKey: boolean
  cloroKeyLast4: string
  cloroSource: "admin" | "env" | "none"
  aiVisibilityPriceId: string
  aiVisibilityProductId: string
}

export function AdminCloro({ initial }: { initial: CloroSettings }) {
  const [apiKey, setApiKey] = useState("")
  const [priceId, setPriceId] = useState(initial.aiVisibilityPriceId)
  const [productId, setProductId] = useState(initial.aiVisibilityProductId)
  const [status, setStatus] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(clear = false) {
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloroApiKey: clear ? undefined : apiKey,
          clearCloroKey: clear,
          aiVisibilityPriceId: priceId,
          aiVisibilityProductId: productId,
        }),
      })
      const data = (await response.json()) as CloroSettings & { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not save Cloro settings")
      setStatus(data)
      setApiKey("")
      setPriceId(data.aiVisibilityPriceId)
      setProductId(data.aiVisibilityProductId)
      setMessage(clear ? "Cloro key removed. Prompt scans fall back to sample answers." : "Cloro settings saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Cloro settings")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Cloro · AI Visibility</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste the cloro.dev API key here. Workspace users never see it. Each paid brand gets 10
        prompt scans per month across ChatGPT, Perplexity, Gemini, Copilot, Google AI Mode, and Grok.
        Without a key, the add-on still shows sample answers so you can demo the layout.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Cloro API key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={status.hasCloroKey ? `Saved ${status.cloroKeyLast4}` : "cloro_…"}
          />
          <p className="text-[11px] text-muted-foreground">
            {status.cloroSource === "admin"
              ? `Using the key saved in Admin (${status.cloroKeyLast4}).`
              : status.cloroSource === "env"
                ? `Using the CLORO_API_KEY environment variable (${status.cloroKeyLast4}).`
                : "No key configured. AI scans use sample answers."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Paddle price ID (optional)</Label>
          <Input
            value={priceId}
            onChange={(event) => setPriceId(event.target.value)}
            placeholder="pri_…"
          />
          <p className="text-[11px] text-muted-foreground">
            $199/month per brand. Leave blank and GridPins can create the catalog in Paddle.
          </p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Paddle product ID (optional)</Label>
          <Input
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            placeholder="pro_…"
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void save(false)}>
          {pending ? "Saving…" : "Save Cloro settings"}
        </Button>
        {status.hasCloroKey && status.cloroSource === "admin" ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => void save(true)}>
            Remove key
          </Button>
        ) : null}
      </div>
    </section>
  )
}
