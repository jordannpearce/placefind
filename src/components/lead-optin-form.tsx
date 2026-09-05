"use client"

import { useState } from "react"
import Link from "next/link"

import { emptyInquiry, Field, HoneypotField, InquiryFields } from "@/components/public-inquiry-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { SUPPORT_INBOX } from "@/lib/company"
import { LOCATION_COUNTS, type LocationCount } from "@/lib/public-forms"

const LOCATION_LABELS: Record<LocationCount, string> = {
  "1": "1 location",
  "2-5": "2–5 locations",
  "6+": "6 or more",
}

export function LeadOptInForm() {
  const [inquiry, setInquiry] = useState(emptyInquiry)
  const [website, setWebsite] = useState("")
  const [gbpListing, setGbpListing] = useState("")
  const [primaryCategory, setPrimaryCategory] = useState("")
  const [keyword, setKeyword] = useState("")
  const [locationCount, setLocationCount] = useState<LocationCount | "">("")
  const [hpWebsite, setHpWebsite] = useState("")
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
        body: JSON.stringify({
          ...inquiry,
          website,
          gbpListing,
          primaryCategory,
          keyword,
          locationCount,
          hpWebsite,
          marketingConsent: consent,
        }),
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
      <HoneypotField value={hpWebsite} onChange={setHpWebsite} />
      <InquiryFields
        value={inquiry}
        onChange={setInquiry}
        commentsLabel="What do you need help with? (optional)"
        commentsPlaceholder="Categories, photos, a new location, a competitor that just opened…"
        disabled={pending}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website (optional)" htmlFor="lead-website">
          <Input
            id="lead-website"
            name="listingWebsite"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourshop.com"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field label="Google Business Profile URL or listing name" htmlFor="lead-gbp">
          <Input
            id="lead-gbp"
            name="gbpListing"
            placeholder="maps.google.com/… or Joe’s Plumbing"
            value={gbpListing}
            onChange={(event) => setGbpListing(event.target.value)}
            required
            disabled={pending}
          />
        </Field>
        <Field label="Primary category / type of business" htmlFor="lead-category">
          <Input
            id="lead-category"
            name="primaryCategory"
            placeholder="Plumber, dental clinic, HVAC…"
            value={primaryCategory}
            onChange={(event) => setPrimaryCategory(event.target.value)}
            required
            disabled={pending}
          />
        </Field>
        <Field label="Main keyword you want to rank for" htmlFor="lead-keyword">
          <Input
            id="lead-keyword"
            name="keyword"
            placeholder="emergency plumber Austin"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            required
            disabled={pending}
          />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Number of locations</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {LOCATION_COUNTS.map((value) => (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm ${
                locationCount === value ? "border-primary bg-primary/5" : "bg-background"
              }`}
            >
              <input
                type="radio"
                name="locationCount"
                className="sr-only"
                value={value}
                checked={locationCount === value}
                onChange={() => setLocationCount(value)}
                required
                disabled={pending}
              />
              {LOCATION_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
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
          Name, email, phone, business, city, state, listing, category, keyword, and locations are
          required. Consent is required to submit.
        </p>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Submitting…" : "Get ranking help"}
      </Button>
    </form>
  )
}
