"use client"

import { useState } from "react"
import Link from "next/link"

import { emptyInquiry, HoneypotField, InquiryFields } from "@/components/public-inquiry-fields"
import { Button } from "@/components/ui/button"
import { SUPPORT_INBOX } from "@/lib/company"

export function ContactForm() {
  const [inquiry, setInquiry] = useState(emptyInquiry)
  const [website, setWebsite] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inquiry, website }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "We couldn’t send your message.")
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t send your message.")
    } finally {
      setPending(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Message received
        </p>
        <h2 className="font-heading mt-2 text-2xl">We got it</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We’ll reply at {SUPPORT_INBOX}. If you need us sooner, call or write that same inbox —
          support mail lands there, not a ticket queue.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/get-found" className="text-primary hover:underline">
            Want help ranking your Google Business Profile?
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
        commentsLabel="Comments"
        commentsRequired
        commentsPlaceholder="How can we help — a listing, a grid, or something else?"
        disabled={pending}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          Every field is required. We send this to {SUPPORT_INBOX} and reply from that address.
        </p>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  )
}
