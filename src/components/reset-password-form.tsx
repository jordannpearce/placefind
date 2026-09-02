"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Status = "checking" | "ready" | "missing" | "invalid" | "expired" | "ok"

const COPY: Record<Exclude<Status, "checking" | "ready" | "ok">, string> = {
  missing: "This reset link is missing a token.",
  invalid: "This reset link is invalid or has already been used.",
  expired: "This reset link has expired. Request a new one.",
}

export function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get("token") || ""
  const [status, setStatus] = useState<Status>(token ? "checking" : "missing")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(token ? null : COPY.missing)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = (await response.json()) as { status?: Status; error?: string }
        if (cancelled) return
        if (data.status === "ok") {
          setStatus("ready")
          setError(null)
          return
        }
        const next = data.status === "expired" || data.status === "invalid" || data.status === "missing"
          ? data.status
          : "invalid"
        setStatus(next)
        setError(data.error || COPY[next])
      })
      .catch(() => {
        if (cancelled) return
        setStatus("invalid")
        setError(COPY.invalid)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = (await response.json()) as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error || "Could not update password")
      setStatus("ok")
      setMessage(data.message || "Your password has been updated.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-4xl">Reset password</h1>
      {status === "checking" ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking your link…</p>
      ) : null}
      {status === "ok" ? (
        <>
          <p className="mt-4 text-sm text-emerald-800">{message}</p>
          <Link href="/login" className={buttonVariants({ className: "mt-6" })}>
            Log in
          </Link>
        </>
      ) : null}
      {status === "ready" ? (
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? "Please wait…" : "Update password"}
            </Button>
          </form>
        </div>
      ) : null}
      {status === "missing" || status === "invalid" || status === "expired" ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">{error || COPY[status]}</p>
          <Link href="/forgot-password" className={buttonVariants({ className: "mt-6" })}>
            Request a new link
          </Link>
        </>
      ) : null}
    </div>
  )
}
