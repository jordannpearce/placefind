import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { readSession } from "@/lib/session"

export async function SiteHeader() {
  const session = await readSession()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-2xl tracking-tight">
          GridPins
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/why-grids" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            Why grids
          </Link>
          <Link href="/pricing" className="hidden rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            Pricing
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
        <p>GridPins · Google Maps grid rank tracker</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/why-grids" className="hover:text-foreground">
            Why grids
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
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
