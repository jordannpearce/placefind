import { LoaderCircle, Star } from "lucide-react"
import { useEffect, useState } from "react"
import {
  confirmListingMatch,
  createListing,
  deleteListing,
  loadListing,
  searchBusiness,
  updateListing,
} from "../lib/api.ts"
import { formatKeywordText } from "../lib/keywords.ts"
import { listingPriceCopy, LISTING_PRICE_LABEL } from "../lib/pricing.ts"
import {
  listingFormFromPlace,
  listingMapsMatchFromPlace,
  listingPath,
  listingRedirectPath,
  mapsCategory,
  mapsSearchCandidates,
  mapsStatusLabel,
  type ListingMapsMatch,
} from "../lib/listings.ts"
import { emptyKeys } from "../lib/storage.ts"
import type { AuthUser, BusinessListing, DirectoryListing, ListingInput } from "../lib/types.ts"
import { CityStateFields } from "./CityStateFields.tsx"

type Props = {
  listingId?: string | null
  user: AuthUser
  onGo: (path: string) => void
}

const emptyForm = (): ListingInput => ({
  name: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  category: "",
  keywords: "",
  phone: "",
  email: "",
  website: "",
  hours: "",
})

function formFromListing(row: DirectoryListing): ListingInput {
  return {
    name: row.name,
    street: row.street ?? "",
    city: row.city,
    state: row.state,
    zip: row.zip ?? "",
    category: row.category,
    keywords: formatKeywordText(row.keywords),
    phone: row.phone,
    email: row.email ?? "",
    website: row.website,
    hours: row.hours,
  }
}

function addressChanged(form: ListingInput, listing: DirectoryListing): boolean {
  return (
    (form.street ?? "") !== (listing.street ?? "") ||
    (form.city ?? "") !== (listing.city ?? "") ||
    (form.state ?? "") !== (listing.state ?? "") ||
    (form.zip ?? "") !== (listing.zip ?? "")
  )
}

export function ListingFormPage({ listingId, user, onGo }: Props) {
  const editing = Boolean(listingId)
  const [form, setForm] = useState<ListingInput>(emptyForm)
  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [candidates, setCandidates] = useState<BusinessListing[]>([])
  const [pendingMatch, setPendingMatch] = useState<ListingMapsMatch | null>(null)
  const [pendingNotFound, setPendingNotFound] = useState(false)
  const [detailsVisible, setDetailsVisible] = useState(editing)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!listingId) return
    setLoading(true)
    void loadListing(listingId)
      .then(({ listing: row }) => {
        setListing(row)
        setForm(formFromListing(row))
        setDetailsVisible(true)
        const dest = listingRedirectPath(listingId, row)
        if (dest && typeof window !== "undefined") {
          window.history.replaceState({}, "", `${dest}/edit`)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load that listing."))
      .finally(() => setLoading(false))
  }, [listingId])

  async function attachMapsMatch(saved: DirectoryListing): Promise<DirectoryListing> {
    if (pendingMatch?.placeId) {
      const confirmed = await confirmListingMatch(saved.id, {
        ...pendingMatch,
        phone: form.phone || pendingMatch.phone,
        website: form.website || pendingMatch.website,
        hours: form.hours || pendingMatch.hours,
        category: form.category || pendingMatch.category,
      })
      if (addressChanged(form, confirmed)) return updateListing(confirmed.id, form)
      return confirmed
    }
    if (pendingNotFound) {
      return confirmListingMatch(saved.id, { mapsStatus: "not_found" })
    }
    return saved
  }

  async function save(): Promise<DirectoryListing | null> {
    setSaving(true)
    setError(null)
    try {
      const next = await attachMapsMatch(listingId ? await updateListing(listingId, form) : await createListing(form))
      setListing(next)
      setForm(formFromListing(next))
      setPendingMatch(null)
      setPendingNotFound(false)
      setNotice(listingId ? "Listing saved." : "Listing created. Open Crawl Website to write a public profile article.")
      if (!listingId) onGo(`${listingPath(next)}/edit`)
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the listing.")
      return null
    } finally {
      setSaving(false)
    }
  }

  async function searchMaps() {
    if (form.name.trim().length < 2) {
      setError("Enter the business name.")
      return
    }
    if (form.city.trim().length < 2) {
      setError("Enter the city.")
      return
    }
    if (!form.state.trim()) {
      setError("Choose a state.")
      return
    }
    setChecking(true)
    setError(null)
    try {
      const result = await searchBusiness({ name: form.name, city: form.city, state: form.state }, emptyKeys(), true)
      const rows = mapsSearchCandidates(result)
      setCandidates(rows)
      setSearched(true)
      if (rows.length === 0) {
        setDetailsVisible(true)
        setNotice("No Google Maps place matched this name in that city. Enter the street, ZIP, and the rest of the listing.")
      } else {
        setNotice("Choose the Google Maps place that matches your business.")
      }
    } catch (err) {
      setDetailsVisible(true)
      setError(err instanceof Error ? err.message : "Could not search Google Maps.")
    } finally {
      setChecking(false)
    }
  }

  function pickCandidate(candidate: BusinessListing) {
    const filled = listingFormFromPlace(candidate, form)
    setForm({
      ...filled,
      name: form.name.trim() || filled.name,
      email: form.email,
      keywords: form.keywords,
    })
    setPendingMatch(listingMapsMatchFromPlace(candidate))
    setPendingNotFound(false)
    setDetailsVisible(true)
    setNotice(
      filled.street
        ? "Review the details from Google Maps, then save the listing."
        : "Google Maps did not include a street address. Enter the street, city, state, and ZIP, then save.",
    )
  }

  async function markNotFound() {
    setPendingMatch(null)
    setPendingNotFound(true)
    setCandidates([])
    setDetailsVisible(true)
    if (!listing) {
      setNotice("Marked as not found on Google Maps. Enter the rest of the listing, then save.")
      return
    }
    setSaving(true)
    try {
      setListing(await confirmListingMatch(listing.id, { mapsStatus: "not_found" }))
      setPendingNotFound(false)
      setNotice("Marked as not found on Google Maps.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Maps status.")
    } finally {
      setSaving(false)
    }
  }

  async function removeListing() {
    if (!listing) return
    if (!window.confirm(`Remove ${listing.name} from the PlaceFind directory? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteListing(listing.id)
      onGo("/account")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that listing.")
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = "h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
  const selectedPlaceId = pendingMatch?.placeId || listing?.placeId || ""

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-panel px-6 py-12 text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-brass" />
        <p className="mt-3 text-sm text-muted">Loading your listing…</p>
      </section>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Your listing</p>
        <h2 className="mt-2 font-display text-3xl text-paper">{editing ? "Edit listing" : "Create a listing"}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          {editing
            ? "Search Google Maps again to refill phone, website, hours, category, and address from a matching place. You can still edit every field before you save."
            : "Start with the business name, city, and state. Search Google Maps, pick the matching place, then review the filled listing before you save."}{" "}
          A PlaceFind listing is {LISTING_PRICE_LABEL}. {listingPriceCopy()} Signed in as {user.email}.
        </p>
        {error && <p className="mt-4 rounded-xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
        {notice && <p className="mt-4 rounded-xl border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss">{notice}</p>}
        {listing && <p className="mt-4 text-sm text-brass">{mapsStatusLabel(listing.mapsStatus)}</p>}
        <form
          className="mt-6 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!detailsVisible) void searchMaps()
            else void save()
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Business name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={fieldClass}
            />
          </label>
          {detailsVisible && (
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Street address</span>
              <input
                value={form.street ?? ""}
                onChange={(event) => setForm({ ...form, street: event.target.value })}
                placeholder="900 E 11th St"
                className={fieldClass}
              />
            </label>
          )}
          <CityStateFields
            city={form.city}
            state={form.state}
            onCity={(city) => setForm({ ...form, city })}
            onState={(state) => setForm({ ...form, state })}
            fieldClassName={fieldClass}
          />
          {detailsVisible && (
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">ZIP</span>
              <input
                value={form.zip ?? ""}
                onChange={(event) => setForm({ ...form, zip: event.target.value })}
                placeholder="78702"
                className={fieldClass}
              />
            </label>
          )}
          {detailsVisible && !form.street?.trim() && (
            <p className="text-sm leading-6 text-muted">
              Google Maps did not include a street address. Enter the street, city, state, and ZIP.
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={checking}
              onClick={() => void searchMaps()}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              {checking && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {checking ? "Searching Google Maps…" : "Search Google Maps"}
            </button>
            {(editing || searched) && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void markNotFound()}
                className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass disabled:opacity-60"
              >
                Mark as not found
              </button>
            )}
          </div>
          {checking && <p className="text-sm text-muted">Looking up Google Maps listings…</p>}
          {candidates.length > 0 && (
            <ul className="grid gap-2">
              {candidates.map((candidate) => {
                const selected = Boolean(selectedPlaceId && selectedPlaceId === candidate.placeId)
                return (
                  <li key={`${candidate.placeId || candidate.title}-${candidate.address}`}>
                    <button
                      type="button"
                      onClick={() => pickCandidate(candidate)}
                      className={`w-full rounded-xl border px-4 py-3 text-left ${selected ? "border-brass bg-brass/10" : "border-line bg-ink hover:border-brass/60"}`}
                    >
                      <span className="block font-display text-xl text-paper">{candidate.title}</span>
                      <span className="mt-1 block text-sm text-muted">{candidate.address}</span>
                      {mapsCategory(candidate) && (
                        <span className="mt-1 block text-sm text-brass">{mapsCategory(candidate)}</span>
                      )}
                      {candidate.rating != null && (
                        <span className="mt-2 inline-flex items-center gap-1 text-sm text-brass">
                          <Star className="h-4 w-4 fill-current" />
                          {candidate.rating.toFixed(1)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {searched && !detailsVisible && (
            <button
              type="button"
              onClick={() => {
                setDetailsVisible(true)
                setNotice("Enter the rest of the listing, then save.")
              }}
              className="justify-self-start text-sm text-brass hover:underline"
            >
              Enter the rest without a Maps match
            </button>
          )}
          {detailsVisible && (
            <>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Category</span>
                <input
                  value={form.category ?? ""}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Bakery, dentist, hardware store"
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Keywords</span>
                <input
                  value={typeof form.keywords === "string" ? form.keywords : formatKeywordText(form.keywords ?? [])}
                  onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                  placeholder="sourdough, coffee, pastry"
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Phone</span>
                <input
                  value={form.phone ?? ""}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Business email</span>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="hello@yourshop.com"
                  className={fieldClass}
                />
                <span className="text-xs leading-5 text-muted">
                  Quote requests from the public profile go to this address. Leave it blank if you are not ready to publish one.
                </span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Website</span>
                <input
                  value={form.website ?? ""}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Hours</span>
                <input
                  value={form.hours ?? ""}
                  onChange={(event) => setForm({ ...form, hours: event.target.value })}
                  placeholder="Tue–Sun 7:00 AM–3:00 PM"
                  className={fieldClass}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
                >
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {editing ? "Save listing" : "Create listing"}
                </button>
                {listing && (
                  <button
                    type="button"
                    onClick={() => onGo(listingPath(listing))}
                    className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
                  >
                    View listing
                  </button>
                )}
                {editing && listing && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeListing()}
                    className="h-11 rounded-lg border border-clay/40 px-4 text-sm text-clay hover:border-clay disabled:opacity-60"
                  >
                    Delete listing
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      </section>
    </div>
  )
}
