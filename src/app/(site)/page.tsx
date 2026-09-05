import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { PLANS, PLAN_ORDER } from "@/lib/plans"

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Google Maps rank tracking
          </p>
          <h1 className="font-heading mt-3 text-5xl leading-[1.05] tracking-tight md:text-6xl">
            See where a listing ranks from every nearby street.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Maps is personal to the searcher’s pin. GridPins samples an N×N GPS lattice and ranks
            your listing at each coordinate so you can see proximity — not one vanity number from
            the office. Agencies and brands run campaigns per location, track several keywords, and
            schedule the next pass.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create a workspace
            </Link>
            <Link href="/why-grids" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Why grids matter
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            New workspaces stay locked until you subscribe. Testers get a timed window from an
            administrator.
          </p>
        </div>
        <MiniGrid />
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-heading text-3xl tracking-tight">Proximity decides the local pack</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Relevance and reviews matter. Distance still moves the pack. A café can be #1 on its
            block and invisible 1.2 miles south. If you only rank-check from one centroid, you miss
            the streets a competitor already owns — and you brief clients on a coincidence.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "The rank halo",
                body: "A grid draws the shape of where you hold top 3. It is rarely a clean circle. Arterials, rivers, and a stronger GBP next door flatten one side.",
              },
              {
                title: "Neighborhood, not city",
                body: "“Austin, TX” is not a rank. The searcher on South Congress and the searcher in Mueller are in different packs. Sample both.",
              },
              {
                title: "Proof for retainers",
                body: "When a client says they dropped, show the pins that held and the pins that moved. Anecdotes end. Coverage and ATR stay.",
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
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
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
                body: "A new GBP two blocks away first shows up as orange and red pins on one edge. Weekly scans catch that before the monthly recap.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border bg-background p-5">
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-heading text-3xl">How a scan works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            "Confirm the listing with name, city, state, and a Google Maps link.",
            "Choose grid size (3×3 through 13×13) and a radius in miles.",
            "GridPins posts one Maps task per pin, using location_coordinate.",
            "Pins color by rank. Open a pin to see every business and review count.",
          ].map((step, index) => (
            <li key={step} className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Step {index + 1}</p>
              <p className="mt-2 text-sm leading-6">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
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
              <div key={id} className="rounded-2xl border bg-card p-5">
                <p className="text-sm text-muted-foreground">{plan.name}</p>
                <p className="font-heading mt-1 text-4xl">${plan.price}</p>
                <p className="text-xs text-muted-foreground">per month</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.blurb}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function MiniGrid() {
  const ranks = [1, 2, 1, 3, 4, 7, 8, 10, 15]
  const colors = ["#166534", "#22c55e", "#86efac", "#facc15", "#f59e0b", "#ea580c", "#ef4444", "#b91c1c", "#94a3b8"]
  return (
    <div className="rounded-[28px] border bg-[linear-gradient(180deg,#dce8d8,#c5d6c0)] p-5 shadow-sm">
      <p className="text-xs font-medium">coffee · Houndstooth Coffee</p>
      <p className="text-[11px] text-muted-foreground">3×3 · 1.4 mi radius · Austin, TX</p>
      <div className="mt-6 grid grid-cols-3 place-items-center gap-6 py-6">
        {ranks.map((rank, index) => (
          <span
            key={index}
            className="flex size-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow"
            style={{ background: colors[index] }}
          >
            {rank}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Local pack on the north-west pins. Competitors take the south edge — that is proximity.
      </p>
    </div>
  )
}
