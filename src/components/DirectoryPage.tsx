import { LoaderCircle, MapPinned, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { searchDirectory } from "../lib/api.ts"
import { listingLocation, listingPath, mapsStatusLabel } from "../lib/listings.ts"
import type { AuthUser, DirectoryListing } from "../lib/types.ts"
import { CityStateFields } from "./CityStateFields.tsx"

type Props = {
  user: AuthUser | null
  onGo: (path: string) => void
}

const emptyQuery = () => ({ name: "", city: "", state: "", keyword: "" })

export function DirectoryPage({ user, onGo }: Props) {
  const [query, setQuery] = useState(emptyQuery)
  const [listings, setListings] = useState<DirectoryListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function runSearch(next = query) {
    setLoading(true)
    setError(null)
    try {
      setListings(await searchDirectory(next))
    } catch (err) {
      setListings([])
      setError(err instanceof Error ? err.message : "Could not load the directory.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void runSearch(emptyQuery())
  }, [])

  return (
    <div className="grid gap-8 pb-4">
      <section className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="min-w-0 rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Directory</p>
          <h2 className="mt-1 font-display text-2xl text-paper">Find a business</h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-muted">
            Search PlaceFind listings by name, city, state, or keyword.
          </p>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void runSearch()
            }}
          >
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Name</span>
              <input
                value={query.name}
                onChange={(event) => setQuery({ ...query, name: event.target.value })}
                placeholder="Harbor & Oak"
                className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
              />
            </label>
            <CityStateFields
              city={query.city}
              state={query.state}
              onCity={(city) => setQuery({ ...query, city })}
              onState={(state) => setQuery({ ...query, state })}
              fieldClassName="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Keyword</span>
              <input
                value={query.keyword}
                onChange={(event) => setQuery({ ...query, keyword: event.target.value })}
                placeholder="bakery, dentist, bike repair"
                className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Searching…" : "Search directory"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => onGo(user ? "/listings/new" : "/join")}
            className="mt-4 text-sm text-brass hover:underline"
          >
            {user ? "Create your listing" : "Join to list your business"}
          </button>
        </aside>

        <div>
          {error && <p className="mb-4 rounded-xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
          {loading && listings.length === 0 ? (
            <div className="rounded-2xl border border-line bg-panel px-5 py-10 text-center">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-brass" />
              <p className="mt-3 text-sm text-muted">Loading the directory…</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-2xl border border-line bg-panel px-5 py-10 text-center">
              <MapPinned className="mx-auto h-6 w-6 text-brass" />
              <p className="mt-3 font-display text-2xl text-paper">No listings matched</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Try a city and state, or clear the filters to browse every PlaceFind profile.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    onClick={() => onGo(listingPath(listing.id))}
                    className="h-full w-full rounded-2xl border border-line bg-panel p-5 text-left hover:border-brass/60"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
                      {listing.category || "Business"}
                    </p>
                    <h3 className="mt-1 font-display text-2xl text-paper">{listing.name}</h3>
                    <p className="mt-1 text-sm text-muted">{listingLocation(listing)}</p>
                    {listing.keywords.length > 0 && (
                      <p className="mt-2 text-sm text-paper/80">{listing.keywords.slice(0, 3).join(" · ")}</p>
                    )}
                    <p className="mt-3 text-xs text-brass">{mapsStatusLabel(listing.mapsStatus)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
