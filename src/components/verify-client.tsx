"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export function VerifyClient() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get("token") || ""
  const [status, setStatus] = useState<"working" | "ok" | "error">(token ? "working" : "error")
  const [message, setMessage] = useState(token ? "Activating your account…" : "Missing activation token.")

  useEffect(() => {
    if (!token) return
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || "Could not activate")
        setStatus("ok")
        setMessage("Account activated. Opening your dashboard…")
        router.push("/dashboard")
        router.refresh()
      })
      .catch((error: unknown) => {
        setStatus("error")
        setMessage(error instanceof Error ? error.message : "Activation failed")
      })
  }, [router, token])

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-4xl">Activate account</h1>
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      {status === "error" ? (
        <Link href="/signup" className={buttonVariants({ className: "mt-6" })}>
          Back to sign up
        </Link>
      ) : null}
    </div>
  )
}
