"use client"

import { useState } from "react"
import Link from "next/link"

import { emptyInquiry, HoneypotField, InquiryFields } from "@/components/public-inquiry-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SUPPORT_INBOX } from "@/lib/company"

export function LeadOptInForm() {
  const [inquiry, setInquiry] = useState(emptyInquiry)
  const [website, setWebsite] = useState("")
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!consent) {
      setError("Check the box to receive ranking tips and help emails from GridPins.")
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/get-found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inquiry, website, marketingConsent: consent }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "We couldn’t complete your opt-in.")
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t complete your opt-in.")
    } finally {
      setPending(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          You’re on the list
        </p>
        <h2 className="font-heading mt-2 text-2xl">You’re opted in</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We’ll send ranking tips and Google Business Profile help to {inquiry.email || "your inbox"}.
          Mail comes from {SUPPORT_INBOX}. You can unsubscribe later from any of those emails or by
          writing that same address.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/contact" className="text-primary hover:underline">
            Need a person today? Use the contact form.
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form className="relative space-y-4 rounded-2xl border bg-card p-6" onSubmit={onSubmit}>
      <HoneypotField value={website} onChange={setWebsite} />
      <InquiryFields
        value={inquiry}
        onChange={setInquiry}
        commentsLabel="What do you need help with? (optional)"
        commentsPlaceholder="Categories, photos, a new location, a competitor that just opened…"
        disabled={pending}
      />
      <label className="flex items-start gap-2.5 text-sm leading-5">
        <Checkbox
          checked={consent}
          onCheckedChange={setConsent}
          required
          disabled={pending}
          className="mt-0.5"
        />
        <span>
          I agree to receive marketing and information emails from GridPins about ranking my Google
          Business Profile. I can unsubscribe later. Mail goes to and from {SUPPORT_INBOX}.
        </span>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          Name, email, phone, business, city, and state are required. Consent is required to submit.
        </p>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Submitting…" : "Get ranking help"}
      </Button>
    </form>
  )
}
