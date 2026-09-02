import type { Metadata } from "next"

import { H, LegalDoc, P } from "@/components/legal-doc"

export const metadata: Metadata = {
  title: "Email Policy — GridPins",
  description: "When GridPins sends activation, billing, product, and marketing email, and how to opt out.",
}

export default function EmailPolicyPage() {
  return (
    <LegalDoc
      title="Email Policy"
      updated="September 2, 2026"
      lede="GridPins sends mail from our domain, gridpins.com — typically hello@gridpins.com and hello@info.gridpins.com. We send and receive email at hello@info.gridpins.com. This page is the policy for those messages: what we send, why, and how you control marketing."
    >
      <section className="space-y-3">
        <H>Transactional mail we always send</H>
        <P>
          Account creation, activation links, password or access notices, billing and plan-change
          receipts, and operational notices about your workspace are transactional. We send them
          because you asked for an account or changed a paid setting. You cannot unsubscribe from
          these while the account is open; they are part of running the service.
        </P>
      </section>
      <section className="space-y-3">
        <H>Product updates and notifications</H>
        <P>
          Administrators may send product-update and notification messages to selected accounts.
          Those messages explain changes to GridPins, scan behavior, or your workspace. If you do
          not want optional product mail, say so in Account or reply to hello@gridpins.com or
          hello@info.gridpins.com.
        </P>
      </section>
      <section className="space-y-3">
        <H>Marketing mail</H>
        <P>
          Marketing messages (tips, promotions, agency offers) go only to addresses that opted in
          at signup or in Account, on the Get found page, or that an administrator explicitly
          selected after you joined. Checkboxes on Admin → Emails control who receives a given
          send. We do not buy third-party lists to promote GridPins.
        </P>
        <P>
          The Get found form is a marketing opt-in for Google Business Profile ranking tips and
          help. Submitting it requires an explicit checkbox. Those messages come from
          hello@info.gridpins.com. You can unsubscribe from a later email or by writing
          hello@info.gridpins.com.
        </P>
      </section>
      <section className="space-y-3">
        <H>Contact and lead forms</H>
        <P>
          The contact form at /contact and the Get found opt-in at /get-found send your name,
          email, phone, business name, city, state, and comments to hello@info.gridpins.com. We
          send and receive that mail at hello@info.gridpins.com. Reply-to on those notices is the
          address you typed so we can write you back. If we cannot deliver the message, the form
          shows an error instead of dropping it.
        </P>
      </section>
      <section className="space-y-3">
        <H>How we send</H>
        <P>
          When transactional email is configured, mail is delivered through our email provider from
          a gridpins.com from-address, including hello@gridpins.com and hello@info.gridpins.com. We
          send and receive at hello@info.gridpins.com. If that service is not configured, GridPins
          stores the HTML in the in-app inbox so activation still works. Preview copies are not a
          public mailing list.
        </P>
      </section>
      <section className="space-y-3">
        <H>Opt out and complaints</H>
        <P>
          Turn off marketing in Account → email preferences, or email hello@gridpins.com or
          hello@info.gridpins.com with the address you want removed from promotional sends. We honor
          unsubscribe requests for marketing promptly. Transactional mail continues as long as the
          account exists.
        </P>
      </section>
      <section className="space-y-3">
        <H>Accuracy</H>
        <P>
          Do not sign up someone else without permission. Agency users should only add contacts
          they are authorized to email. We may pause sending if a domain bounces or is flagged for
          abuse.
        </P>
      </section>
    </LegalDoc>
  )
}
