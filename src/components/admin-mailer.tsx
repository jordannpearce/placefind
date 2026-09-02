"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EmailKind, PublicUser } from "@/lib/types"

type MailUser = Pick<PublicUser, "id" | "name" | "email" | "status" | "marketingOptIn" | "company"> & {
  agencyName?: string
}

export function AdminMailer({ users }: { users: MailUser[] }) {
  const [kind, setKind] = useState<EmailKind>("info")
  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [selected, setSelected] = useState<string[]>(() =>
    users.filter((user) => user.status === "active").map((user) => user.id)
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const selectable = useMemo(
    () => users.filter((user) => user.status !== "suspended"),
    [users]
  )

  function toggle(userId: string, checked: boolean) {
    setSelected((current) =>
      checked ? Array.from(new Set([...current, userId])) : current.filter((id) => id !== userId)
    )
  }

  function selectAll() {
    setSelected(selectable.map((user) => user.id))
  }

  function selectOptedIn() {
    setSelected(selectable.filter((user) => user.marketingOptIn).map((user) => user.id))
  }

  function selectNone() {
    setSelected([])
  }

  async function send() {
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, headline, body, userIds: selected }),
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
      <h2 className="font-heading text-2xl">Send email</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Check the accounts that should get this message. Marketing, product updates, and notifications
        all use the same list.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
        <select
          className="h-8 rounded-lg border bg-transparent px-2 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value as EmailKind)}
        >
          <option value="info">Product update</option>
          <option value="notification">Notification</option>
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

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Recipients · {selected.length} selected</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="xs" variant="outline" onClick={selectAll}>
              All
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={selectOptedIn}>
              Marketing opt-in
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={selectNone}>
              None
            </Button>
          </div>
        </div>
        {selectable.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No accounts to email yet.</p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto rounded-xl border p-3">
            {selectable.map((user) => (
              <li key={user.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--primary)]"
                    checked={selected.includes(user.id)}
                    onChange={(event) => toggle(user.id, event.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{user.name}</span>{" "}
                    <span className="text-muted-foreground">{user.email}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {user.agencyName || user.company || "Independent"}
                      {user.marketingOptIn ? " · marketing on" : " · marketing off"}
                      {user.status === "pending" ? " · pending" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      <Button
        className="mt-4"
        onClick={send}
        disabled={pending || !headline.trim() || !body.trim() || selected.length === 0}
      >
        {pending ? "Sending…" : `Send to ${selected.length} account${selected.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  )
}
