import type { Metadata } from "next"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Why grid rank tracking matters — GridPins",
  description:
    "Google Maps ranks change from street to street. Learn why proximity, grid trackers, and multi-point scans beat a single rank check.",
}

const SECTIONS = [
  {
    title: "Maps does not have one rank",
    body: [
      "A desktop search from your office and a phone search two miles south are not the same SERP. Google Maps weights the searcher’s location heavily. The local pack for “plumber,” “coffee,” or “urgent care” can flip from one intersection to the next.",
      "If you only check rank once — from headquarters, a VPN, or a rank tool that uses a single centroid — you are reading one parking space and calling it the city. Clients get a false sense of winning or losing.",
    ],
  },
  {
    title: "Proximity is a ranking factor you can map",
    body: [
      "Local results are usually described as relevance, distance (proximity), and prominence. You can improve the listing, reviews, and categories. You cannot move the store. What you can do is measure how far the proximity advantage actually reaches.",
      "A grid tracker drops pins on a lattice around the listing and asks Maps the same keyword at each coordinate. The result is a halo: streets where you hold 1–3, streets where you slip to 7–12, and streets where a competitor owns the pack. That halo is the real trade area for discovery, not the city name on the GBP.",
    ],
  },
  {
    title: "Why agencies get blamed for “you dropped”",
    body: [
      "A client screenshots Maps at home and says they vanished. You screenshot from the office and still see #1. Both can be true. Without a grid, the argument is anecdotal. With a grid, you show that rank held within 0.8 miles and collapsed past the highway — or that a new competitor took the south-east pins overnight.",
      "That is also how you defend a launch. Opening week often looks weak from a single downtown pin and strong from the neighborhood the store actually serves. Proximity explains the difference.",
    ],
  },
  {
    title: "What to look for on a GridPins scan",
    body: [
      "Coverage: how many pins even return the listing. Average rank and top-3 share: whether you own the local pack or merely appear. Competitors on a pin: who takes the pack when you do not.",
      "Run the same lattice on more than one keyword. “Coffee shop” and “espresso” do not share a pack. A listing can dominate branded terms and lose category terms two blocks away. That is a content and category problem, not a “Maps is broken” problem.",
    ],
  },
  {
    title: "When to scan again",
    body: [
      "After you change hours, categories, photos, or the primary name. After a competitor opens. After Google’s periodic local shifts. Daily or weekly schedules exist so you catch drift before the monthly report.",
      "Do not scan a 13×13 on every typo. Each pin is a live Maps task. Use a smaller grid to learn a location, then densify when you are deciding whether to spend on a neighborhood.",
    ],
  },
  {
    title: "Why ranking still matters when reviews look fine",
    body: [
      "A 4.8 rating does not put you in the pack two miles south. Prominence helps. Proximity still draws the edge of the halo. Tracking ranks is how you learn whether a review campaign widened coverage or only padded the average on streets you already owned.",
      "The same is true after a category change. The listing can look healthier in the dashboard and lose “emergency” or “near me” pins overnight. The grid is the only honest before-and-after.",
    ],
  },
  {
    title: "How a grid relates to AI answers",
    body: [
      "People now ask ChatGPT or Perplexity for a shortlist, then open Maps. The lattice still decides the sidewalk. The optional AI Visibility add-on ($199 per brand per month) tells you whether those models name you and which pages they cite. It does not replace a grid. It is a second surface.",
      "Ten typed prompts, four scans each, is a fixed query set — branded, category, and “near me” — not a place to test every slogan. Keep the lattice for streets. Keep prompts for language.",
    ],
  },
]

export default function WhyGridsPage() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Local SEO
        </p>
        <h1 className="font-heading mt-3 text-4xl tracking-tight md:text-5xl">
          Why you need a grid tracker, not one rank number
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          GridPins exists because Google Maps is a map. Rank is a function of where the searcher
          stands. If you cannot see proximity, you cannot brief a client, pick a location, or tell
          whether a listing is actually losing a neighborhood.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Start a workspace
          </Link>
          <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
            See plans
          </Link>
        </div>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            {
              k: "One pin lies",
              v: "A single centroid hides the streets where you already lost the pack.",
            },
            {
              k: "Proximity has a shape",
              v: "The rank halo around a storefront is rarely a perfect circle. Highways, rivers, and competitors dent it.",
            },
            {
              k: "Keywords split the map",
              v: "Category terms and brand terms paint different grids. Track both on the same lattice.",
            },
          ].map((item) => (
            <div key={item.k}>
              <h2 className="font-heading text-2xl">{item.k}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-12 px-4 py-16">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-heading text-3xl tracking-tight">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-[15px] leading-7 text-foreground/90">
                {paragraph}
              </p>
            ))}
          </div>
        ))}
      </section>

      <section className="border-t bg-card/60">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-heading text-3xl">How GridPins samples proximity</h2>
          <p className="mt-4 text-[15px] leading-7 text-foreground/90">
            You confirm the listing with name, city, state, and a Maps URL. You pick an N×N grid
            (3×3 through 13×13) and a radius in miles. GridPins builds GPS points and, for each
            pin, requests the Maps SERP at that <code>location_coordinate</code>. Rank colors the
            pin. Opening a pin shows every business Google returned, with reviews, so you can see
            who actually sits in the pack.
          </p>
          <p className="mt-4 text-[15px] leading-7 text-foreground/90">
            Starter is one brand and one location, with five Maps scans each month. Extra scans
            are $5. Pro covers five to ten campaigns. Advanced is fifty. Sample Austin coffee
            rankings on Pro or Advanced are for learning the workflow — they are not a live
            market report.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create a workspace
            </Link>
            <Link href="/ai-visibility" className={buttonVariants({ variant: "outline", size: "lg" })}>
              AI Visibility add-on
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
