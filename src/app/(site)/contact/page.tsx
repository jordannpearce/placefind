import type { Metadata } from "next"
import Link from "next/link"

import { CompanyDetails } from "@/components/company-details"
import { ContactForm } from "@/components/contact-form"
import { SUPPORT_INBOX, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/company"

export const metadata: Metadata = {
  title: "Contact GridPins — hello@info.gridpins.com",
  description:
    "Write GridPins about grid tracking, a listing, or an agency workspace. Support mail goes to hello@info.gridpins.com.",
}

export default function ContactPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Support
        </p>
        <h1 className="font-heading mt-3 text-4xl tracking-tight md:text-5xl">Talk to GridPins</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Questions about a campaign, a Maps listing, AI Visibility prompts, or whether a grid is
          the right brief — send them here. Every message goes to{" "}
          <a className="text-primary hover:underline" href={`mailto:${SUPPORT_INBOX}`}>
            {SUPPORT_INBOX}
          </a>
          . We reply from that inbox during business hours.
        </p>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div className="rounded-2xl border bg-background p-6">
            <CompanyDetails />
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Prefer not to use the form? Call{" "}
              <a className="text-primary hover:underline" href={SUPPORT_PHONE_TEL}>
                {SUPPORT_PHONE_DISPLAY}
              </a>{" "}
              or email{" "}
              <a className="text-primary hover:underline" href={`mailto:${SUPPORT_INBOX}`}>
                {SUPPORT_INBOX}
              </a>
              . That is the inbox for all support and contact submissions.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/get-found" className="text-primary hover:underline">
                Looking for help ranking a Google Business Profile?
              </Link>
            </p>
            <p className="mt-2 text-sm">
              <Link href="/ai-visibility" className="text-primary hover:underline">
                Questions about the $199 AI Visibility add-on?
              </Link>
            </p>
          </div>
          <div>
            <h2 className="font-heading text-2xl">Send a message</h2>
            <p className="mt-2 mb-5 text-sm leading-6 text-muted-foreground">
              Tell us the listing and the city. We will write back at {SUPPORT_INBOX}.
            </p>
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  )
}
