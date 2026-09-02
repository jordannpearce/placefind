import type { Metadata } from "next"

import { H, LegalDoc, P } from "@/components/legal-doc"

export const metadata: Metadata = {
  title: "Refund Policy — GridPins",
  description:
    "GridPins refunds a monthly subscription only when you show the software failed more than 10% of a full billing cycle.",
}

export default function RefundsPage() {
  return (
    <LegalDoc
      title="Refund Policy"
      updated="September 2, 2026"
      lede="GridPins is billed monthly. We do not issue goodwill credits because a listing lost rank, a campaign was set up incorrectly, or someone “feels” the software does not work. A refund is available only in the specified case below."
    >
      <section className="space-y-3">
        <H>When a refund is available</H>
        <P>
          We only accept a refund request if you show that the GridPins software itself failed to
          operate for more than ten percent (10%) of a full monthly billing cycle. That means the
          product could not be used for its core purpose — signing in, opening a workspace, and
          running or completing scans the plan allows — for more than 10% of the days or hours in
          that paid month, measured against our logs and yours.
        </P>
        <P>
          A full monthly billing cycle is the period from the charge date through the day before
          the next charge. Partial months, free trials, and unused campaign slots do not create a
          refund on their own.
        </P>
      </section>
      <section className="space-y-3">
        <H>What does not qualify</H>
        <P>
          Saying “it doesn’t work” is not cause to issue a refund. Dissatisfaction with Google Maps
          rankings, a competitor outranking you, dislike of the pin colors, a keyword you chose
          poorly, or results that differ from one phone’s Maps app are not software failures.
        </P>
        <P>
          The following are also not refundable: DataForSEO or other API usage you incurred, extra
          Growth campaign slots you added, scans you ran successfully, accounts suspended for
          abuse, or fees after you simply stopped using the workspace.
        </P>
      </section>
      <section className="space-y-3">
        <H>What you must show</H>
        <P>
          A qualifying request includes evidence, not a one-line complaint. Send hello@gridpins.com
          all of the following for that billing cycle:
        </P>
        <ul className="list-disc space-y-2 pl-5">
          <li>Workspace email, plan, and the invoice or billing-email dates for the month.</li>
          <li>
            Timestamps of failed sign-in, failed scans, or HTTP/server errors you observed, with
            screenshots or exported logs.
          </li>
          <li>
            A reasonable estimate of downtime (for example, “scans returned errors from March 3
            14:00 UTC through March 8 09:00 UTC”) that adds up to more than 10% of the cycle.
          </li>
          <li>
            Confirmation that the failure was GridPins software, not your DataForSEO credentials,
            network, or a third-party Maps outage you could still use the app around.
          </li>
        </ul>
        <P>
          We will compare that evidence to our own application and hosting logs. If we cannot
          reproduce or confirm outage above the 10% threshold, we will deny the request and explain
          why.
        </P>
      </section>
      <section className="space-y-3">
        <H>How we pay a valid refund</H>
        <P>
          If we agree the software was down more than 10% of that full cycle, we refund the
          GridPins subscription fee for that month only, to the original payment method when
          possible. API charges billed by DataForSEO stay with you. Approved refunds are processed
          within ten business days of our written confirmation.
        </P>
      </section>
      <section className="space-y-3">
        <H>Chargebacks</H>
        <P>
          Opening a chargeback instead of following this policy may result in immediate account
          suspension. Contact us first so we can review logs with you.
        </P>
      </section>
    </LegalDoc>
  )
}
