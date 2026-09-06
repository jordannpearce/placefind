import { ArrowRight, MapPinned, Search, Store, Trophy } from "lucide-react"
import { useState } from "react"
import { searchBusiness } from "../lib/api.ts"
import { CITY_PHOTOS, homeExampleResponse } from "../lib/sample-listing.ts"
import { emptyKeys } from "../lib/storage.ts"
import type { AuthUser, SearchQuery, SearchResponse } from "../lib/types.ts"
import { ResultPanel } from "./ResultPanel.tsx"
import { SearchForm } from "./SearchForm.tsx"

type Props = {
  user: AuthUser | null
  store: boolean
  onGo: (path: string) => void
}

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "", keyword: "" })

export function HomePage({ user, store, onGo }: Props) {
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(homeExampleResponse())
  const [error, setError] = useState<string | null>(null)

  async function runSearch() {
    setLoading(true)
    setError(null)
    try {
      const payload = await searchBusiness(query, emptyKeys(), true)
      setResult(payload)
      if (payload.error && !payload.best) setError(payload.error)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed."
      if (/enter a |choose a /i.test(message)) {
        setError(message)
      } else {
        setResult(homeExampleResponse(query))
        setError(null)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-16 pb-4">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
            Google Maps research for local businesses
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight text-paper sm:text-5xl">
            Find the businesses that show up when customers search your city
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            PlaceFind looks up a Google Maps listing from a business name, city, state, and keyword. Use it
            to see a competitor’s card, check who appears in an area, and — after you buy — track ranks from
            the Windows app or your signed-in account.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {store && (
              <button
                type="button"
                onClick={() => onGo("/buy")}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-brass px-5 font-semibold text-ink hover:bg-[#ecc77a]"
              >
                Buy PlaceFind
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onGo(user ? "/account" : "/login")}
              className="inline-flex h-12 items-center rounded-lg border border-line px-5 text-sm text-paper hover:border-brass"
            >
              {user ? "Open account" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => onGo("/#sample")}
              className="inline-flex h-12 items-center rounded-lg px-3 text-sm text-brass hover:underline"
            >
              See a sample listing
            </button>
          </div>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img
            src={CITY_PHOTOS[0].src}
            alt={CITY_PHOTOS[0].alt}
            className="h-72 w-full object-cover sm:h-80"
          />
          <figcaption className="bg-panel px-4 py-3 text-xs leading-5 text-muted">
            Local streets are full of listings. PlaceFind shows the card Google Maps returns for a name in a
            city — address, phone, rating, and a Maps link.
          </figcaption>
        </figure>
      </section>

      <section id="how-it-works" className="scroll-mt-8">
        <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <figure className="overflow-hidden rounded-2xl border border-line">
            <img
              src={CITY_PHOTOS[3].src}
              alt={CITY_PHOTOS[3].alt}
              className="h-72 w-full object-cover"
            />
          </figure>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">How it works</p>
            <h3 className="mt-2 font-display text-3xl text-paper">Four fields. One listing card.</h3>
            <ol className="mt-5 grid gap-4">
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">1. Name the business</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Type the shop as customers would search it — “Franklin Barbecue”, not a legal entity string.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">2. Pin the city and state</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Maps is local. The same name in two cities is two listings. PlaceFind searches that city.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">3. Add a keyword when it helps</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  “Barbecue”, “emergency plumber”, “kids haircut” — the words people type when they are not
                  searching a brand.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Why local owners use it</p>
        <h3 className="mt-2 font-display text-3xl text-paper">Research the map the way customers see it</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-line bg-panel p-5">
            <Store className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">Research competitors</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pull a rival’s listing: address, hours, rating, and whether the profile is claimed. See the same
              card a customer would open on their phone.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-panel p-5">
            <MapPinned className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">See who shows up in an area</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              A keyword plus a city is how most people search. PlaceFind runs that query so you can see which
              names Maps returns near you.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-panel p-5">
            <Trophy className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">Track ranks over time</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Signed-in customers save a business and keywords, then scan a grid around it. Watch whether you
              hold position, slip, or finally appear.
            </p>
          </article>
        </div>
      </section>

      <section id="sample" className="scroll-mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Sample scan</p>
            <h3 className="mt-2 font-display text-3xl text-paper">Try a listing the way PlaceFind shows it</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Enter a business, city, state, and optional keyword. The card on the right is a real PlaceFind
              result layout. After you look around, here is an example from Austin — Franklin Barbecue — so
              you can still see the shape of a match.
            </p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="min-w-0 rounded-2xl border border-line bg-panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Look up a listing</p>
            <h4 className="mt-1 font-display text-2xl text-paper">Name, city, keyword</h4>
            <p className="mb-4 mt-2 text-sm leading-6 text-muted">
              This preview shows what PlaceFind returns. Signed-in customers can run more lookups from the
              internal test scan.
            </p>
            {user && (
              <button
                type="button"
                onClick={() => onGo("/try")}
                className="mb-4 text-sm text-brass hover:underline"
              >
                Open the internal test scan
              </button>
            )}
            <SearchForm
              query={query}
              onChange={setQuery}
              onSearch={() => void runSearch()}
              loading={loading}
              history={[]}
              onHistory={() => undefined}
              submitLabel="Show listing"
              showHistory={false}
            />
          </aside>
          <div>
            <ResultPanel
              loading={loading}
              result={result}
              error={error && !result?.best ? error : null}
              emptyTitle="Here's an example"
              emptyBody="Franklin Barbecue in Austin is a familiar Maps listing. Run the form to try another name, or keep this card as a guide to what PlaceFind returns."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img
            src={CITY_PHOTOS[1].src}
            alt={CITY_PHOTOS[1].alt}
            className="h-64 w-full object-cover"
          />
          <figcaption className="bg-panel px-4 py-3 text-sm leading-6 text-muted">
            A packed dining room does not always mean a strong Maps listing. PlaceFind shows the public
            profile: hours, rating, and whether the business claimed the page.
          </figcaption>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img
            src={CITY_PHOTOS[2].src}
            alt={CITY_PHOTOS[2].alt}
            className="h-64 w-full object-cover"
          />
          <figcaption className="bg-panel px-4 py-3 text-sm leading-6 text-muted">
            Small shops live or die on neighborhood search. A keyword plus a city is often how a new customer
            finds them — or finds the place next door.
          </figcaption>
        </figure>
      </section>

      <section className="rounded-2xl border border-brass/30 bg-raised px-6 py-8 sm:px-10">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Windows desktop</p>
            <h3 className="mt-2 font-display text-3xl text-paper">The same lookup, on your computer</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              PlaceFind for Windows is a one-time license. Install it, sign in with the account from checkout,
              and look up listings without keeping a browser tab open. Rank tracking and saved campaigns live
              on your account so the desktop app and the website stay in sync.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              You do not configure search services yourself. Buy, download Setup, paste the license key, and
              start with a name, a city, and a keyword.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {store && (
                <button
                  type="button"
                  onClick={() => onGo("/buy")}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
                >
                  <Search className="h-4 w-4" />
                  Buy a license
                </button>
              )}
              <button
                type="button"
                onClick={() => onGo(user ? "/download" : "/login")}
                className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                {user ? "Download for Windows" : "Sign in to download"}
              </button>
            </div>
          </div>
          <ul className="grid gap-3 text-sm text-paper/85">
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Look up a listing by name and city</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Add a keyword customers actually type</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Save campaigns and rerun rank scans</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">One license key, emailed after you pay</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
