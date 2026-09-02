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
            GridPin samples an N×N lattice of GPS points and asks DataForSEO for the Maps SERP at
            each coordinate. Agencies and brands run campaigns per location, track multiple
            keywords, and schedule ranking checks.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create a workspace
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Log in to demo
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Demo account: demo@gridpin.app / demo1234 · Admin: admin@gridpin.app / GridPin!admin
          </p>
        </div>
        <MiniGrid />
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            {
              title: "Campaigns per location",
              body: "One campaign is a brand plus a Maps listing. Entry is one location. Growth runs five to ten. Agency covers fifty.",
            },
            {
              title: "Multiple keywords",
              body: "Track coffee, espresso, and coffee shop on the same lattice. Compare ATR, local-pack share, and coverage after a scan.",
            },
            {
              title: "Your DataForSEO key",
              body: "Agencies paste their own API login. Without a key, GridPin still runs a realistic Austin coffee demo so you can learn the product.",
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
        <h2 className="font-heading text-3xl">How a scan works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            "Confirm the listing with name, city, state, and a Google Maps link.",
            "Choose grid size (3×3 through 13×13) and a radius in miles.",
            "GridPin posts one Maps task per pin, using location_coordinate.",
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
      <div className="mt-6 grid grid-cols-3 gap-6 place-items-center py-6">
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
        Local pack on the north-west pins. Competitors take the south edge.
      </p>
    </div>
  )
}
