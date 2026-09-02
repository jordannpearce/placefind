import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { PLANS, PLAN_ORDER } from "@/lib/plans"

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-4xl tracking-tight md:text-5xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every plan includes campaign tracking, keyword grids, scheduled scans, and your own
        DataForSEO key. Activation, billing, and product emails go out through Resend.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id]
          const featured = id === "agency"
          return (
            <div
              key={id}
              className={`flex flex-col rounded-2xl border p-6 ${featured ? "bg-foreground text-background" : "bg-card"}`}
            >
              <p className={`text-sm ${featured ? "text-background/70" : "text-muted-foreground"}`}>
                {plan.name}
              </p>
              <p className="font-heading mt-2 text-5xl">${plan.price}</p>
              <p className={`text-sm ${featured ? "text-background/70" : "text-muted-foreground"}`}>
                per month
              </p>
              <p className="mt-4 text-sm leading-6">{plan.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature}>· {feature}</li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={buttonVariants({
                  variant: featured ? "secondary" : "default",
                  size: "lg",
                  className: "mt-6 w-full",
                })}
              >
                Start on {plan.name}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
