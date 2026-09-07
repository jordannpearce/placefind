import { Check } from "lucide-react"
import { joinHref, listBusinessHref } from "../lib/account.ts"
import { LISTING_PRICE_LABEL, LISTING_PRICE_SHORT } from "../lib/pricing.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  user: AuthUser | null
  onGo: (path: string) => void
}

const NEIGHBOR = [
  "Browse the public directory",
  "Leave a review on a listing",
  "Request a quote from a shop",
  "No $150 charge for this account",
]

const BUSINESS = [
  "A public listing by name, city, and keyword",
  "An enhanced profile you write: article, H1–H6 headings, HTML, page title, and schema",
  "Crawl Website can draft an article from the shop site",
  "Reviews and quote requests on the listing",
  "Edit the listing anytime; cancel from the account",
]

export function PricingPage({ user, onGo }: Props) {
  const listingHref = listBusinessHref(user)
  const neighborHref = user ? "/directory" : joinHref("member")

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-10 pb-4">
      <section className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Pricing</p>
        <h2 className="mt-2 font-display text-4xl text-paper sm:text-5xl">Two accounts. One listing price.</h2>
        <p className="mt-4 text-base leading-7 text-muted">
          Neighbors use PlaceFind for free. A business pays {LISTING_PRICE_LABEL} to keep an active listing in the
          directory. Browsing profiles does not require an account.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Neighbor</p>
          <h3 className="mt-2 font-display text-3xl text-paper">Free</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            For people who want to review a shop or ask for a quote. PlaceFind does not bill this account $150.
          </p>
          <ul className="mt-6 grid flex-1 gap-3">
            {NEIGHBOR.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-paper/90">
                <Check className="mt-1 h-4 w-4 shrink-0 text-brass" />
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onGo(neighborHref)}
            className="mt-8 h-12 rounded-lg border border-line px-5 text-sm text-paper hover:border-brass"
          >
            {user ? "Open the directory" : "Join free"}
          </button>
        </article>

        <article className="flex flex-col rounded-2xl border border-brass/50 bg-raised p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Business listing</p>
          <h3 className="mt-2 font-display text-3xl text-paper">{LISTING_PRICE_SHORT}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {LISTING_PRICE_LABEL} for each active listing. That is the public profile neighbors open from the
            directory.
          </p>
          <ul className="mt-6 grid flex-1 gap-3">
            {BUSINESS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-paper/90">
                <Check className="mt-1 h-4 w-4 shrink-0 text-brass" />
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onGo(listingHref)}
            className="mt-8 h-12 rounded-lg bg-brass px-5 font-semibold text-ink hover:bg-[#ecc77a]"
          >
            {user ? "Create a listing" : `List your business · ${LISTING_PRICE_LABEL}`}
          </button>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Questions</p>
        <h3 className="mt-2 font-display text-3xl text-paper">What the price covers</h3>
        <dl className="mt-6 grid gap-6">
          <div>
            <dt className="text-sm font-semibold text-paper">Do I pay to browse?</dt>
            <dd className="mt-2 text-sm leading-6 text-muted">
              No. The directory and public profiles are free to read. Reviews and quotes use a free neighbor account.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-paper">What does {LISTING_PRICE_LABEL} include?</dt>
            <dd className="mt-2 text-sm leading-6 text-muted">
              An active listing in the directory, the enhanced profile you publish, website crawl drafts, and the desk
              where visitors leave reviews and request quotes. Each listing is billed on its own.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-paper">Can I cancel?</dt>
            <dd className="mt-2 text-sm leading-6 text-muted">
              Yes. Cancel from the account when the shop no longer wants to appear. Write us from the email on your
              account within 14 days of the first charge if you want a refund for that first month. Later months are
              not refunded after the period has started.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-paper">I already have a free account. Can I list a shop?</dt>
            <dd className="mt-2 text-sm leading-6 text-muted">
              Yes. A neighbor account can become a business account when you are ready to publish. The listing is still{" "}
              {LISTING_PRICE_LABEL}.
            </dd>
          </div>
        </dl>
        <button type="button" onClick={() => onGo("/refund")} className="mt-6 text-sm text-brass hover:underline">
          Read the refund policy
        </button>
      </section>
    </div>
  )
}
