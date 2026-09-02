import type { Metadata } from "next"

import { H, LegalDoc, P } from "@/components/legal-doc"

export const metadata: Metadata = {
  title: "Privacy Policy — GridPins",
  description: "How GridPins collects, uses, and stores account, scan, and email data.",
}

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="September 2, 2026"
      lede="This policy explains what GridPins collects when you visit gridpins.com, create a workspace, run a grid scan, or receive mail from us."
    >
      <section className="space-y-3">
        <H>Information we collect</H>
        <P>
          Account data includes your name, email, password hash, company or agency, plan, and
          optional DataForSEO login. Campaign data includes brand names, listing details, keywords,
          grid settings, and scan results you generate. If you write to us, we keep that
          correspondence.
        </P>
        <P>
          Technical data includes signed session cookies, impersonation cookies used only by
          administrators, and standard server logs (IP, user agent, timestamps) needed to operate
          and secure the site.
        </P>
      </section>
      <section className="space-y-3">
        <H>How we use it</H>
        <P>
          We use this information to run your workspace, enforce plan limits, send activation and
          billing mail, let admins support your account, and improve reliability. We do not sell
          your contact list. Marketing mail is sent only under the Email Policy and your opt-in
          settings.
        </P>
      </section>
      <section className="space-y-3">
        <H>Processors</H>
        <P>
          Hosting and the production database run on our cloud provider (currently Railway). Email
          may be sent through Resend when an API key is configured; otherwise messages stay in an
          in-app outbox. Live Maps lookups go to DataForSEO with the credentials you provide. Those
          providers process data on our or your instructions under their own terms.
        </P>
      </section>
      <section className="space-y-3">
        <H>Cookies and sessions</H>
        <P>
          We use an HTTP-only session cookie so you stay signed in. Administrators may set a
          short-lived cookie to view a workspace as another user. We do not use advertising pixels
          on the marketing site.
        </P>
      </section>
      <section className="space-y-3">
        <H>Retention and your choices</H>
        <P>
          We keep account and campaign data while the workspace is active and for a reasonable
          period after closure for billing disputes and legal holds. You can update profile,
          marketing opt-in, and API credentials in Account. To request deletion of an account,
          email hello@gridpins.com from the address on file.
        </P>
      </section>
      <section className="space-y-3">
        <H>Children</H>
        <P>
          GridPins is a business tool. We do not knowingly collect personal information from
          children under 16.
        </P>
      </section>
      <section className="space-y-3">
        <H>Changes</H>
        <P>
          We will post updates on this page with a new date. If you have a privacy question, write
          to hello@gridpins.com.
        </P>
      </section>
    </LegalDoc>
  )
}
