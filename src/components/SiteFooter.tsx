import { legalNavLinks } from "../lib/legal.ts"
import type { AppPath } from "../lib/nav.ts"
import { PreferredSourceButton } from "./PreferredSourceButton.tsx"

type Props = {
  onGo: (path: AppPath | string) => void
}

export function SiteFooter({ onGo }: Props) {
  const legal = legalNavLinks()

  return (
    <footer className="mt-16 border-t border-line pt-8 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-display text-xl text-paper">PlaceFind</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">
            A web directory for local businesses. List a shop for $150 per month, then publish a profile with reviews.
          </p>
        </div>
        <div className="grid gap-4">
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Site">
            <a
              href="/pricing"
              onClick={(event) => {
                event.preventDefault()
                onGo("/pricing")
              }}
              className="text-paper/75 hover:text-brass"
            >
              Pricing
            </a>
            <a
              href="/directory"
              onClick={(event) => {
                event.preventDefault()
                onGo("/directory")
              }}
              className="text-paper/75 hover:text-brass"
            >
              Directory
            </a>
            <a
              href="/join"
              onClick={(event) => {
                event.preventDefault()
                onGo("/join")
              }}
              className="text-paper/75 hover:text-brass"
            >
              Join
            </a>
            <a
              href="/create-profile"
              onClick={(event) => {
                event.preventDefault()
                onGo("/create-profile")
              }}
              className="text-paper/75 hover:text-brass"
            >
              Create a Profile
            </a>
          </nav>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Legal">
            {legal.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault()
                  onGo(link.href)
                }}
                className="text-paper/75 hover:text-brass"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
      <div className="mt-6">
        <PreferredSourceButton />
      </div>
      <p className="mt-4 text-xs text-muted">© {new Date().getFullYear()} PlaceFind. All rights reserved.</p>
    </footer>
  )
}
