import type { Metadata } from "next"

import { H, LegalDoc, P } from "@/components/legal-doc"

export const metadata: Metadata = {
  title: "Terms of Service — GridPins",
  description: "The agreement that covers GridPins workspaces, scans, billing, and acceptable use.",
}

const UPDATED = "September 5, 2026"

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={UPDATED}
      lede="These Terms govern access to GridPins, the Google Maps grid rank tracker at gridpins.com. By creating a workspace, signing in, or paying for a plan, you agree to this agreement."
    >
      <section className="space-y-3">
        <H>1. Who we are</H>
        <P>
          GridPins is a software service that helps brands and agencies measure how a Google Maps
          listing ranks from a lattice of nearby GPS points. We are not Google. We provide
          software. You supply the listings, keywords, and (when you want live ranks) your own
          Maps API credentials.
        </P>
      </section>
      <section className="space-y-3">
        <H>2. The service</H>
        <P>
          A workspace lets you create campaigns, confirm a listing, choose a grid size and radius,
          and run scans. Each pin is one Maps SERP lookup. Without Maps API credentials, GridPins
          may show a sample ranking set so you can learn the product. Sample ranks are not a
          substitute for live market data and must not be sold to clients as live results.
        </P>
        <P>
          Plan limits apply: Starter is one brand and one location (one campaign). Pro includes
          five campaigns and may add extra slots up to ten. Advanced includes fifty campaigns. We may
          refuse or throttle scans that abuse the service or your API provider.
        </P>
      </section>
      <section className="space-y-3">
        <H>3. Accounts</H>
        <P>
          You must provide accurate information and keep your password confidential. You are
          responsible for everyone who uses your workspace, including agency staff and clients you
          invite. Administrators may create accounts, send product mail, and view a workspace as
          that user for support. Do not share admin access.
        </P>
        <P>
          We may suspend an account that is unpaid, abusive, fraudulent, or that violates these
          Terms or applicable law. Pending accounts must activate from the email we send before
          signing in.
        </P>
      </section>
      <section className="space-y-3">
        <H>4. Fees and third-party costs</H>
        <P>
          GridPins subscription fees are billed monthly or annually according to the plan you choose.
          Subscription payments are processed by Paddle, our payment processor. Changing plan or
          Pro extra-campaign slots may generate a billing notice. Live Maps tasks are billed by
          the Maps API provider you connect, to the credentials you enter. Those API charges are
          not included in the GridPins subscription and are not refundable by us. See the Refund
          Policy for how third-party API usage is treated.
        </P>
      </section>
      <section className="space-y-3">
        <H>5. Refunds</H>
        <P>
          Subscription refunds are governed solely by the{" "}
          <a className="text-primary hover:underline" href="/refunds">
            Refund Policy
          </a>
          . We only consider a refund when you show that GridPins software failed to operate for
          more than ten percent of a full monthly billing cycle. Saying the product “doesn’t work”
          is not enough.
        </P>
      </section>
      <section className="space-y-3">
        <H>6. Acceptable use</H>
        <P>
          You may not use GridPins to scrape Google outside the supported API path, attack our
          systems, impersonate others, send unlawful mail, or store content you do not have rights
          to. You may not resell raw API access through our app. You must comply with Google and
          Maps terms, and with the terms of any Maps API provider you connect, when you run live
          scans.
        </P>
      </section>
      <section className="space-y-3">
        <H>7. Ranking data is directional</H>
        <P>
          Local pack results change with time, device, personalization, and Google’s own tests. A
          grid is a snapshot of public Maps results at sampled coordinates. We do not guarantee
          that a listing will rank, that a scan will match what one person sees on their phone, or
          that optimizing from our reports will produce a specific business outcome.
        </P>
      </section>
      <section className="space-y-3">
        <H>8. Intellectual property</H>
        <P>
          GridPins, the product name, and the software remain ours. You keep rights to your
          campaign names, listings, and the reports generated for your workspace. You grant us a
          limited license to process that data to run the service, send mail you request, and
          provide support.
        </P>
      </section>
      <section className="space-y-3">
        <H>9. Disclaimers and liability</H>
        <P>
          The service is provided “as is.” To the fullest extent allowed by law, we disclaim implied
          warranties of merchantability, fitness for a particular purpose, and non-infringement. Our
          total liability for a claim relating to GridPins is limited to the subscription fees you
          paid us in the three months before the claim. We are not liable for API overages, lost
          rankings, lost profits, or data you export and share.
        </P>
      </section>
      <section className="space-y-3">
        <H>10. Changes and termination</H>
        <P>
          We may update these Terms. Material changes will be posted on this page with a new date.
          Continued use after the update is acceptance. You may stop using GridPins at any time.
          We may end the service with notice if we must.
        </P>
      </section>
      <section className="space-y-3">
        <H>11. Contact</H>
        <P>
          Legal notices: hello@gridpins.com. Support, contact-form, and Get found submissions go to
          hello@info.gridpins.com. These Terms are the entire agreement for the software service,
          together with the Privacy Policy, Email Policy, and Refund Policy.
        </P>
      </section>
    </LegalDoc>
  )
}
