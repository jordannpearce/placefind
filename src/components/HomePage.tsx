import { ArrowRight, BadgeDollarSign, NotebookPen, Store } from "lucide-react"
import { useEffect, useState } from "react"
import { searchDirectory } from "../lib/api.ts"
import { listBusinessHref } from "../lib/account.ts"
import { listingLocation, listingPath } from "../lib/listings.ts"
import { LISTING_PRICE_LABEL, listingPriceCopy } from "../lib/pricing.ts"
import { CITY_PHOTOS } from "../lib/sample-listing.ts"
import type { AuthUser, DirectoryListing } from "../lib/types.ts"

type Props = {
  user: AuthUser | null
  onGo: (path: string) => void
}

function stars(average: number | null | undefined) {
  if (average == null) return "New listing"
  return `${average.toFixed(1)} · reviews`
}

export function HomePage({ user, onGo }: Props) {
  const [featured, setFeatured] = useState<DirectoryListing[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void searchDirectory({})
      .then((rows) => setFeatured(rows.slice(0, 4)))
      .catch(() => setFeatured([]))
      .finally(() => setLoaded(true))
  }, [])

  return (
    <div className="grid gap-16 pb-4">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Local business directory</p>
          <h2 className="mt-3 font-display text-4xl leading-tight text-paper sm:text-5xl">
            A directory for shops, and a profile that belongs to the business
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            PlaceFind is a web directory for people looking for local businesses — bakeries, clinics, shops, and
            offices. A business can publish its own listing, collect reviews, and show the story behind the brand.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-brass">{listingPriceCopy()}</p>
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
              onClick={() => onGo(listBusinessHref(user))}
              className="inline-flex h-12 items-center rounded-lg border border-line px-5 text-sm text-paper hover:border-brass"
            >
              {user ? "Create a listing" : `List your business · ${LISTING_PRICE_LABEL}`}
            </button>
          </div>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img src={CITY_PHOTOS[0].src} alt={CITY_PHOTOS[0].alt} className="h-72 w-full object-cover sm:h-80" />
          <figcaption className="bg-panel px-4 py-3 text-xs leading-5 text-muted">
            Main streets are full of independent shops. PlaceFind gives each one a public profile people can actually
            read.
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
            <h3 className="mt-2 font-display text-3xl text-paper">List. Tell the story. Be found.</h3>
            <ol className="mt-5 grid gap-4">
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">1. Create an account</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Businesses join to own a listing. Neighbors create a free account to leave reviews and request quotes
                  — that account is not billed $150.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">2. Publish a listing for {LISTING_PRICE_LABEL}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Name, city, state, category, website, and the keywords customers type. The listing is a monthly
                  directory profile — not a one-time flyer.
                </p>
              </li>
              <li className="rounded-xl border border-line bg-panel px-4 py-3">
                <p className="text-sm font-semibold text-paper">3. Build an enhanced profile</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  From the dashboard, request Crawl Website. We look for license info and key company facts, then write
                  an article onto the public profile. The listing form stays as you entered it.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Why people use it</p>
        <h3 className="mt-2 font-display text-3xl text-paper">A directory with a real profile</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-line bg-panel p-5">
            <Store className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">Find a business</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Browse by name, city, state, or keyword. Open a profile for contact details, the written story, and
              reviews.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-panel p-5">
            <BadgeDollarSign className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">{LISTING_PRICE_LABEL}</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              A business pays {LISTING_PRICE_LABEL} to keep an active listing in the directory. Cancel from the account
              when the shop no longer wants to appear.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-panel p-5">
            <NotebookPen className="h-5 w-5 text-brass" />
            <h4 className="mt-3 font-display text-xl text-paper">Reviews and enhanced info</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              Neighbors leave reviews and request quotes from a free account. After Crawl Website, the public profile
              also shows an article written from the listing keywords and facts found on the site.
            </p>
          </article>
        </div>
      </section>

      <section id="directory" className="scroll-mt-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">In the directory</p>
          <h3 className="mt-2 font-display text-3xl text-paper">
            {loaded && featured.length === 0 ? "No listings yet" : "Businesses on PlaceFind"}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {loaded && featured.length === 0
              ? "The directory is empty until a business owner publishes a listing. Create an account to add yours."
              : "Live PlaceFind profiles with a name, city, written copy, and reviews. Open the full directory to search by city or keyword."}
          </p>
        </div>
        {!loaded ? (
          <p className="rounded-2xl border border-line bg-panel px-5 py-8 text-sm text-muted">Loading listings…</p>
        ) : featured.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel px-5 py-8">
            <p className="font-display text-2xl text-paper">No businesses listed yet</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              PlaceFind does not ship with sample shops. When an owner publishes a listing, it will appear here and in
              the directory.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onGo(listBusinessHref(user))}
                className="inline-flex h-11 items-center rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
              >
                {user ? "Create a listing" : "List your business"}
              </button>
              <button
                type="button"
                onClick={() => onGo("/directory")}
                className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Open the directory
              </button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {featured.map((listing) => (
              <li key={listing.id}>
                <button
                  type="button"
                  onClick={() => onGo(listingPath(listing))}
                  className="h-full w-full rounded-2xl border border-line bg-panel p-5 text-left hover:border-brass/60"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
                    {listing.category || "Business"}
                  </p>
                  <h4 className="mt-1 font-display text-2xl text-paper">{listing.brand || listing.name}</h4>
                  <p className="mt-1 text-sm text-muted">{listingLocation(listing)}</p>
                  {listing.specialty && <p className="mt-2 text-sm text-paper/80">{listing.specialty}</p>}
                  <p className="mt-3 text-xs text-brass">{stars(listing.reviewSummary?.average)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img src={CITY_PHOTOS[1].src} alt={CITY_PHOTOS[1].alt} className="h-64 w-full object-cover" />
          <figcaption className="bg-panel px-4 py-3 text-sm leading-6 text-muted">
            A crowded dining room is not a profile. PlaceFind writes the facts a new customer actually needs.
          </figcaption>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img src={CITY_PHOTOS[2].src} alt={CITY_PHOTOS[2].alt} className="h-64 w-full object-cover" />
          <figcaption className="bg-panel px-4 py-3 text-sm leading-6 text-muted">
            Small shops live on neighborhood word of mouth. A directory listing plus reviews is how the next street
            over finds them.
          </figcaption>
        </figure>
      </section>

      <section className="rounded-2xl border border-brass/30 bg-raised px-6 py-8 sm:px-10">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">For businesses</p>
            <h3 className="mt-2 font-display text-3xl text-paper">List your shop for {LISTING_PRICE_LABEL}</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              Create an account, publish the listing, then open the dashboard and press Crawl Website. We read the site
              and sitemap, look for license info and company facts, and write an article onto the public profile. The
              listing details you entered stay put.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onGo(listBusinessHref(user))}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
              >
                {user ? "Create a listing" : "Start a listing"}
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
            <li className="rounded-xl border border-line bg-panel px-4 py-3">{LISTING_PRICE_LABEL} for an active listing</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Crawl Website writes a public profile article</li>
            <li className="rounded-xl border border-line bg-panel px-4 py-3">Reviews and enhanced profile on every listing</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
