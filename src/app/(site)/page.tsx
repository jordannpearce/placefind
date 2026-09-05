import type { Metadata } from "next"
import Link from "next/link"

import { HomeTrackerDemo } from "@/components/home-tracker-demo"
import { buttonVariants } from "@/components/ui/button"
import { AI_PROMPTS_PER_BRAND, AI_VISIBILITY_PRICE, PLANS, PLAN_ORDER } from "@/lib/plans"

export const metadata: Metadata = {
  title: "GridPins — See where a listing ranks from every nearby street",
  description:
    "Google Maps rank tracking on an N×N GPS lattice. Sample the live map, then track proximity, local-pack share, and AI mentions for each brand.",
}

export default function HomePage() {
  return (
    <div>
      <HomeTrackerDemo />

      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Google Maps rank tracking
        </p>
        <h1 className="font-heading mt-3 max-w-4xl text-4xl leading-[1.05] tracking-tight md:text-6xl">
          See where a listing ranks from every nearby street.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Maps is personal to the searcher’s pin. The map above is the same tracker layout a
          workspace uses — sample Austin coffee ranks so you can click pins, switch keywords, and
          read the pack. Live scans do that for your listing.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Create a workspace
          </Link>
          <Link href="/why-grids" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Why grids matter
          </Link>
          <Link href="/ai-visibility" className={buttonVariants({ variant: "outline", size: "lg" })}>
            AI Visibility add-on
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          New workspaces stay locked until you subscribe. Testers get a timed window from an
          administrator.
        </p>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-heading text-3xl tracking-tight">Why tracking rankings matters</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            A single Maps check from the office is a coincidence. Clients, landlords, and media
            buyers decide spend on neighborhoods. If you cannot show which streets still put you in
            the local pack, you are arguing from a screenshot. Rank tracking on a lattice turns
            “we dropped” into pins that held, pins that moved, and the competitor who took the edge.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Budgets follow the halo",
                body: "Photos, posts, and ads work where you already appear. A grid shows the streets that convert discovery and the streets you are buying traffic into a void.",
              },
              {
                title: "Retainers need proof",
                body: "Coverage, ATR, and top-3 share survive a monthly recap. Anecdotes do not. When rank moves, you show the side of town that moved — not a feeling.",
              },
              {
                title: "Openings and SAB work",
                body: "A second store does not inherit the first store’s pack. A plumber with a hidden address does not own every ZIP. Scan the trade area before you spend.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-heading text-2xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-heading text-3xl tracking-tight">How proximity works on Maps</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Local results usually mix relevance, distance, and prominence. You can improve categories,
          reviews, and photos. You cannot move the storefront. Proximity is the ranking factor you
          measure: how far the listing still wins from a searcher’s GPS point.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "The rank halo is not a circle",
              body: "A café can be #1 on its block and invisible 1.2 miles south. Arterials, rivers, and a stronger profile next door flatten one side. The sample map at the top shows that dent: north-west pins stay green while the south edge slips.",
            },
            {
              title: "Neighborhood, not city name",
              body: "“Austin, TX” is not a rank. The searcher on South Congress and the searcher in Mueller sit in different packs. If a tool only uses one centroid, it hides the streets a competitor already owns.",
            },
            {
              title: "Keywords split the same streets",
              body: "Switch coffee, espresso, and coffee shop on the sample map. The grids will not match. Brand terms and category terms are different jobs. Track both on the same lattice.",
            },
            {
              title: "Distance still moves the pack",
              body: "Reviews and relevance matter. Distance still decides who sits in the three-pack when two listings look similar. That is why a grid of coordinates beats one vanity number from headquarters.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5">
              <h3 className="font-heading text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm">
          <Link href="/why-grids" className="text-primary hover:underline">
            Read the full note on proximity and grid tracking
          </Link>
        </p>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-3xl">What GridPins is built for</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Campaigns per location",
                body: "One campaign is a brand plus a Maps listing. Starter is one location. Pro runs five to ten. Advanced covers fifty.",
              },
              {
                title: "Multiple keywords",
                body: "Track coffee, espresso, and coffee shop on the same lattice. Compare ATR, local-pack share, and coverage after a scan.",
              },
              {
                title: "Maps scans on Starter",
                body: "Starter includes five Maps scans each month. Extra scans are $5. Pro and Advanced run more campaigns and connect their own Maps API when they want live ranks.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-heading text-2xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-heading text-3xl">When a single rank check fails you</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "New locations",
              body: "A second store does not inherit the first store’s pack. Scan the new trade area before you spend on photos and ads. You will see how far proximity reaches on day one.",
            },
            {
              title: "Service-area businesses",
              body: "Plumbers and mobile details often rank from a hidden address. A grid shows which ZIP codes actually surface you, and which ones a city-center competitor still owns.",
            },
            {
              title: "Category vs brand",
              body: "You can win the brand query and lose “emergency dentist.” Run both keywords. The grids will not match, and that gap is the brief.",
            },
            {
              title: "Competitor openings",
              body: "A new profile two blocks away first shows up as orange and red pins on one edge. Weekly scans catch that before the monthly recap.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5">
              <h3 className="font-heading text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-3xl">How a scan works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              "Confirm the listing with name, city, state, and a Google Maps link.",
              "Choose grid size (3×3 through 13×13) and a radius in miles.",
              "GridPins posts one Maps task per pin, using that coordinate as the searcher’s location.",
              "Pins color by rank. Open a pin to see every business and review count.",
            ].map((step, index) => (
              <li key={step} className="rounded-2xl border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-6">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Add-on · all plans
            </p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight">
              AI Visibility — ${AI_VISIBILITY_PRICE}/month per brand
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Maps is one surface. People also ask ChatGPT, Perplexity, Gemini, Copilot, and Google
              AI Mode who to hire. The AI Visibility add-on runs your prompts against those models
              and reports whether the brand is named, who else is named, and which pages are cited.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Each brand includes {AI_PROMPTS_PER_BRAND} prompt scans per month. One prompt is one
              scan across the AI models. Add it on Starter, Pro, or Advanced.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/ai-visibility" className={buttonVariants({ size: "lg" })}>
                See AI Visibility
              </Link>
              <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
                All plans
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm font-medium">What a prompt scan returns</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Mentioned or missing on each model</li>
              <li>Cited sources with the brand’s domain called out</li>
              <li>Competitor names that appear in the same answer</li>
              <li>A short excerpt so you can see the wording</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-heading text-3xl">Plans for brands and agencies</h2>
            <Link href="/pricing" className="text-sm text-primary hover:underline">
              Full pricing
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id]
              return (
                <div key={id} className="rounded-2xl border bg-background p-5">
                  <p className="text-sm text-muted-foreground">{plan.name}</p>
                  <p className="font-heading mt-1 text-4xl">${plan.price}</p>
                  <p className="text-xs text-muted-foreground">per month</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.blurb}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Optional AI Visibility ${AI_VISIBILITY_PRICE}/mo per brand
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
