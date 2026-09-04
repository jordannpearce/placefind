import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { readDb } from "@/lib/db"
import { billingPathForUser, userHasSoftwareAccess } from "@/lib/paddle-access"
import { readSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Welcome — GridPins",
  description: "Thanks for subscribing to GridPins. Open your workspace or log in to start tracking Maps rankings.",
}

export default async function WelcomePage() {
  const session = await readSession()
  if (session) {
    const db = await readDb()
    const user = db.users.find((item) => item.id === session.uid)
    if (user && !userHasSoftwareAccess(user, db)) {
      redirect(billingPathForUser(user, db))
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Checkout complete
      </p>
      <h1 className="font-heading mt-3 text-4xl tracking-tight md:text-5xl">Welcome to GridPins.</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">
        Paddle has the payment. Campaign limits update as soon as the subscription webhook lands —
        usually a few seconds. You stay signed in even if billing is still catching up.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {session ? (
          <>
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Open workspace
            </Link>
            <Link href="/account" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Account and billing
            </Link>
          </>
        ) : (
          <>
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create a workspace
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
