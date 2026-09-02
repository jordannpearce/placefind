"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "login" | "signup"

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [marketing, setMarketing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    setPreviewUrl(null)
    try {
      if (mode === "login") {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || "Could not sign in")
        router.push("/dashboard")
        router.refresh()
        return
      }
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          email,
          password,
          marketingOptIn: marketing,
        }),
      })
      const data = (await response.json()) as {
        error?: string
        message?: string
        previewUrl?: string | null
      }
      if (!response.ok) throw new Error(data.error || "Could not create account")
      setMessage(data.message || "Check your email to activate.")
      if (data.previewUrl) setPreviewUrl(data.previewUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {mode === "signup" ? (
        <>
          <Field label="Your name">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Company">
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Agency or brand"
            />
          </Field>
        </>
      ) : null}
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
      </Field>
      {mode === "signup" ? (
        <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--primary)]"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
          />
          Send me ranking tips and product mail. You can turn this off later.
        </label>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {previewUrl ? (
        <p className="text-sm">
          <Link href={previewUrl} className="text-primary underline">
            Open the activation email
          </Link>
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
