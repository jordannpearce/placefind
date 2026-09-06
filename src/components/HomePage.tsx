import { ArrowRight, MapPinned, Search, Store } from "lucide-react"
import { useState } from "react"
import { searchBusiness } from "../lib/api.ts"
import { sampleSearchUsedMessage } from "../lib/public-copy.ts"
import { CITY_PHOTOS, homeExampleResponse } from "../lib/sample-listing.ts"
import { emptyKeys } from "../lib/storage.ts"
import type { AuthUser, SearchQuery, SearchResponse } from "../lib/types.ts"
import { ResultPanel } from "./ResultPanel.tsx"
import { SearchForm } from "./SearchForm.tsx"

type Props = {
  user: AuthUser | null
  onGo: (path: string) => void
}

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "", keyword: "" })

export function HomePage({ user, onGo }: Props) {
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
      setResult(null)
      setError(err instanceof Error ? err.message : sampleSearchUsedMessage())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-16 pb-4">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
            A business directory with a Google Maps check
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight text-paper sm:text-5xl">
            Find local businesses — and see if they show up on Google Maps
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            PlaceFind is a web directory for people looking for shops, and for businesses that want to list
            themselves and confirm the matching Google Maps place. Browse by name, city, state, or keyword.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onGo("/directory")}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-brass px-5 font-semibold text-ink hover:bg-[#ecc77a]"
            >
              Browse the directory
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onGo(user ? "/listings/new" : "/join")}
              className="inline-flex h-12 items-center rounded-lg border border-line px-5 text-sm text-paper hover:border-brass"
            >
              {user ? "Create a listing" : "List your business"}
            </button>
            <button
              type="button"
              onClick={() => onGo("/#sample")}
              className="inline-flex h-12 items-center rounded-lg px-3 text-sm text-brass hover:underline"
            >
              See a sample Maps card
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
            Local streets are full of listings. PlaceFind shows a public profile and whether that business
            matches a Google Maps place.
          </figcaption>
        </figure>
      </section>

      <section id="how-it-works" className="scroll-mt-8">
        <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <figure className="overflow-hidden rounded-2xl border border-line">
            <img src={CITY_PHOTOS[3].src} alt={CITY_PHOTOS[3].alt} className="h-72 w-full object-cover" />
          </figure>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">How it works</p>
            <h3 className="mt-2 font-display text-3xl text-paper">List. Confirm. Be found.</h3>
            <ol className="mt-5 grid gap-4">
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">1. Create an account</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Join PlaceFind with your name and email. That account owns the listings you publish.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">2. Add your business</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Name, city, state, category, and the keywords customers type — plus phone, website, or hours if
                  you have them.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">3. Cross-check Google Maps</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  PlaceFind searches that name in that city. You confirm the matching place, or we mark it as not
                  found.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Why people use it</p>
        <h3 className="mt-2 font-display text-3xl text-paper">A directory that also looks at the map</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-line bg-panel p-5">
            <Search className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">Find a business</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Browse PlaceFind listings by name, city, state, or keyword. Open a profile for contact details and
              Maps status.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-panel p-5">
            <Store className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">List your shop</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Businesses publish their own PlaceFind profile so customers — and other businesses — can find them.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-panel p-5">
            <MapPinned className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">See who shows on Maps</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Confirm the Google Maps place for a listing. Signed-in accounts can also track ranks around a
              confirmed business.
            </p>
          </article>
        </div>
      </section>

      <section id="sample" className="scroll-mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Sample scan</p>
            <h3 className="mt-2 font-display text-3xl text-paper">Try a Maps card the way PlaceFind shows it</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Enter a business, city, state, and optional keyword. After you look around, here is an example from
              Austin — Franklin Barbecue — so you can still see the shape of a match.
            </p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="min-w-0 rounded-2xl border border-line bg-panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Look up a listing</p>
            <h4 className="mt-1 font-display text-2xl text-paper">Name, city, keyword</h4>
            <p className="mb-4 mt-2 text-sm leading-6 text-muted">
              This preview shows a Maps match. Signed-in accounts can run more lookups from the test scan, or
              confirm a listing they own.
            </p>
            {user && (
              <button type="button" onClick={() => onGo("/try")} className="mb-4 text-sm text-brass hover:underline">
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
          <img src={CITY_PHOTOS[1].src} alt={CITY_PHOTOS[1].alt} className="h-64 w-full object-cover" />
          <figcaption className="bg-panel px-4 py-3 text-sm leading-6 text-muted">
            A packed dining room does not always mean a strong Maps listing. PlaceFind shows the public profile
            and whether a matching place was found.
          </figcaption>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img src={CITY_PHOTOS[2].src} alt={CITY_PHOTOS[2].alt} className="h-64 w-full object-cover" />
          <figcaption className="bg-panel px-4 py-3 text-sm leading-6 text-muted">
            Small shops live or die on neighborhood search. A keyword plus a city is often how a new customer
            finds them — or finds the place next door.
          </figcaption>
        </figure>
      </section>

      <section className="rounded-2xl border border-brass/30 bg-raised px-6 py-8 sm:px-10">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">For businesses</p>
            <h3 className="mt-2 font-display text-3xl text-paper">Put your shop in the directory</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              Create a PlaceFind account, add your listing, and confirm the Google Maps place. Visitors can find
              you by name or keyword. You can come back later to edit the profile or track ranks.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onGo(user ? "/listings/new" : "/join")}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
              >
                {user ? "Create a listing" : "Create an account"}
              </button>
              <button
                type="button"
                onClick={() => onGo("/directory")}
                className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Browse listings
              </button>
            </div>
          </div>
          <ul className="grid gap-3 text-sm text-paper/85">
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Public directory by name, city, and keyword</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Businesses publish their own listing</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Confirm the matching Google Maps place</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">See found, not found, or pending status</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
