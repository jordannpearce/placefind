import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Wordmark } from "@/components/wordmark"
import { readSession } from "@/lib/session"

export async function SiteHeader() {
  const session = await readSession()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="inline-flex items-center">
          <Wordmark className="text-2xl leading-none" />
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
          <Link href="/why-grids" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground md:inline">
            Why grids
          </Link>
          <Link href="/ai-visibility" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground lg:inline">
            AI Visibility
          </Link>
          <Link href="/get-found" className="rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Get found
          </Link>
          <Link href="/pricing" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground md:inline">
            Pricing
          </Link>
          <Link href="/contact" className="rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Contact
          </Link>
          {session ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Log in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Start tracking
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Wordmark className="text-xl leading-none" />
          <span>· Google Maps grid rank tracker</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/why-grids" className="hover:text-foreground">
            Why grids
          </Link>
          <Link href="/ai-visibility" className="hover:text-foreground">
            AI Visibility
          </Link>
          <Link href="/get-found" className="hover:text-foreground">
            Get found
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/email-policy" className="hover:text-foreground">
            Email
          </Link>
          <Link href="/refunds" className="hover:text-foreground">
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  )
}
