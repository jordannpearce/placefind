"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EmailKind } from "@/lib/types"

export function AdminMailer() {
  const [kind, setKind] = useState<EmailKind>("info")
  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function send() {
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, headline, body }),
      })
      const data = (await response.json()) as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error || "Send failed")
      setMessage(data.message || "Sent.")
      setHeadline("")
      setBody("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Send a broadcast</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Info goes to every active account. Marketing only goes to people who opted in.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr]">
        <select
          className="h-8 rounded-lg border bg-transparent px-2 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value as EmailKind)}
        >
          <option value="info">Info</option>
          <option value="marketing">Marketing</option>
        </select>
        <Input
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Subject / headline"
        />
      </div>
      <div className="mt-3">
        <Label className="sr-only">Body</Label>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What should they know?"
        />
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      <Button className="mt-4" onClick={send} disabled={pending || !headline.trim() || !body.trim()}>
        {pending ? "Sending…" : "Send email"}
      </Button>
    </div>
  )
}
