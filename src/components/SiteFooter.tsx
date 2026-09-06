import { legalNavLinks } from "../lib/legal.ts"
import type { AppPath } from "../lib/nav.ts"

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
            Windows software and a web account for finding Google Maps listings by name, city, state, and
            keyword.
          </p>
        </div>
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
      <p className="mt-6 text-xs text-muted">© {new Date().getFullYear()} PlaceFind. All rights reserved.</p>
    </footer>
  )
}
