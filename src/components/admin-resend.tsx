"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ResendSettings = {
  hasResendKey: boolean
  resendKeyLast4: string
  resendFrom: string
  source: "admin" | "env" | "none"
}

export function AdminResend({ initial }: { initial: ResendSettings }) {
  const [from, setFrom] = useState(initial.resendFrom)
  const [apiKey, setApiKey] = useState("")
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
          resendFrom: from,
          resendApiKey: clear ? undefined : apiKey,
          clearResendKey: clear,
        }),
      })
      const data = (await response.json()) as ResendSettings & { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not save Resend settings")
      setStatus(data)
      setApiKey("")
      setMessage(clear ? "Resend key removed." : "Resend settings saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Resend settings")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Resend</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste your Resend API key here to send activations, account creation, marketing, notifications,
        and product updates. Without a key, mail stays in the local inbox.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>API key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              status.hasResendKey ? `Saved ${status.resendKeyLast4}` : "re_xxxxxxxx"
            }
          />
          <p className="text-[11px] text-muted-foreground">
            {status.source === "admin"
              ? `Using the key saved in Admin (${status.resendKeyLast4}).`
              : status.source === "env"
                ? `Using the RESEND_API_KEY environment variable (${status.resendKeyLast4}).`
                : "No key configured. Emails will be preview-only."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>From address</Label>
          <Input
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            placeholder="GridPins <hello@yourdomain.com>"
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => save(false)} disabled={pending}>
          {pending ? "Saving…" : "Save Resend"}
        </Button>
        {status.hasResendKey && status.source === "admin" ? (
          <Button type="button" variant="outline" onClick={() => save(true)} disabled={pending}>
            Remove saved key
          </Button>
        ) : null}
      </div>
    </section>
  )
}
