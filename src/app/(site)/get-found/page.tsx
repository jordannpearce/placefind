import type { Metadata } from "next"
import Link from "next/link"

import { LeadOptInForm } from "@/components/lead-optin-form"
import { buttonVariants } from "@/components/ui/button"
import { SUPPORT_INBOX } from "@/lib/company"

export const metadata: Metadata = {
  title: "Get found on Google Maps — GridPins",
  description:
    "Opt in for GridPins help ranking your Google Business Profile. Ranking tips and follow-up mail come from hello@info.gridpins.com.",
}

export default function GetFoundPage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-20">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Google Business Profile
          </p>
          <h1 className="font-heading mt-3 text-4xl tracking-tight md:text-5xl">
            Get found in the local pack — not just from your parking lot.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Maps ranks change from street to street. If your listing is strong at the door and
            invisible a mile south, you are losing the neighborhoods that actually convert. Leave
            your details and we will send ranking tips, GBP cleanup notes, and when it makes sense,
            a path into grid tracking.
          </p>
          <ul className="mt-6 max-w-xl space-y-3 text-sm leading-6 text-muted-foreground">
            <li>How proximity — not a single city rank — decides who shows in the pack.</li>
            <li>What to fix on the profile before you spend on photos or ads.</li>
            <li>When a grid scan is the proof you need, and when it is not.</li>
          </ul>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Mail comes from{" "}
            <a className="text-primary hover:underline" href={`mailto:${SUPPORT_INBOX}`}>
              {SUPPORT_INBOX}
            </a>
            . Unsubscribe any time from those emails or by writing that inbox.
          </p>
        </div>
        <LeadOptInForm />
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            {
              title: "The listing is the storefront",
              body: "Categories, hours, photos, and the primary name decide whether Google even treats you as relevant. We start there before talking grids.",
            },
            {
              title: "Rank is a neighborhood",
              body: "A plumber can own one ZIP and lose the next. If you only check Maps from the shop, you brief yourself on a coincidence.",
            },
            {
              title: "Proof, then spend",
              body: "When you are ready to measure the halo, GridPins samples an N×N lattice around the listing. That is how agencies defend a retainer.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="font-heading text-2xl">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-heading text-3xl tracking-tight">Already tracking ranks?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Open a workspace and run a grid on the listing. Or write us if you want a person to look
          at the profile first — that still goes to {SUPPORT_INBOX}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Create a workspace
          </Link>
          <Link href="/contact" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Contact support
          </Link>
        </div>
      </section>
    </div>
  )
}
