import type { Metadata } from "next"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { AI_PROMPTS_PER_BRAND, AI_VISIBILITY_PRICE } from "@/lib/plans"

export const metadata: Metadata = {
  title: "AI Visibility add-on — GridPins",
  description:
    "Add $199/month per brand to check whether ChatGPT, Perplexity, Gemini, Copilot, and Google AI Mode mention you — and who they cite.",
}

export default function AiVisibilityMarketingPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Add-on · every plan
        </p>
        <h1 className="font-heading mt-3 max-w-4xl text-4xl tracking-tight md:text-6xl">
          See if AI models name your brand — and who they cite instead.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Maps still decides the sidewalk. ChatGPT, Perplexity, Gemini, Copilot, and Google AI Mode
          decide the shortlist before someone opens Maps. The AI Visibility add-on is ${AI_VISIBILITY_PRICE}{" "}
          per month per brand on Starter, Pro, or Advanced. You get {AI_PROMPTS_PER_BRAND} prompt
          scans each month. One prompt is one scan across those models.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Create a workspace
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
              title: "Mentioned or missing",
              body: "A prompt scan tells you whether the company name, address, phone, or website appears in the answer. Missing on three models and present on one is a brief, not a vibe.",
            },
            {
              title: "Cited pages",
              body: "When a model names you, we show the URLs it used. That is the difference between a casual mention and a source you can actually improve.",
            },
            {
              title: "Competitors in the same answer",
              body: "Add rival names. The scan flags who else the model recommended and whether their domain was cited next to yours.",
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
        <h2 className="font-heading text-3xl tracking-tight">Why this sits next to a grid</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Two discovery surfaces",
              body: "A customer can ask an AI model for “best plumber near me,” then open Maps. If you only track the lattice, you miss the shortlist that happened first. If you only track prompts, you miss the streets that still convert.",
            },
            {
              title: "Same brand, different proof",
              body: "The grid is proximity: pins, ATR, local-pack share. The add-on is language: mentioned, cited, competitors. Agencies brief both in the same monthly recap.",
            },
            {
              title: "Ten prompts is a set, not a toy",
              body: `${AI_PROMPTS_PER_BRAND} scans per brand per month is enough for a fixed query set — branded, category, and “near me” — run more than once. Do not burn a scan on every typo.`,
            },
            {
              title: "Keys stay in Admin",
              body: "You do not paste a model key in the workspace. An administrator stores the API key. Customers only see prompts, mentions, and citations.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5">
              <h3 className="font-heading text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card/60">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-heading text-3xl">How a prompt scan works</h2>
          <ol className="mt-6 space-y-4">
            {[
              "Subscribe to AI Visibility for one brand — $199/month, on any GridPins plan. Add the company name, address, phone, and website.",
              "Write the prompt a real customer would type, and list competitors you want watched.",
              "GridPins sends that prompt to the AI models and reads the answer plus cited sources.",
              "You see whether the brand was found, which facts appeared, citations, and who else was named. That uses one of this month’s 10 scans.",
            ].map((step, index) => (
              <li key={step} className="rounded-2xl border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-6">{step}</p>
              </li>
            ))}
          </ol>
          <Link href="/signup" className={buttonVariants({ size: "lg", className: "mt-8" })}>
            Start a workspace
          </Link>
        </div>
      </section>
    </div>
  )
}
