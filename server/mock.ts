import { mapsPlaceUrl, namesMatch, rankListings } from "./match.ts"
import { toStateAbbr } from "./states.ts"
import type { BusinessListing, SearchQuery } from "./types.ts"

const SAMPLES: Omit<BusinessListing, "matchScore" | "isBestMatch" | "mapsUrl" | "source">[] = [
  {
    title: "Franklin Barbecue",
    address: "900 E 11th St, Austin, TX 78702",
    city: "Austin",
    state: "TX",
    phone: "(512) 653-1187",
    website: "https://franklinbarbecue.com",
    category: "Barbecue restaurant",
    categories: ["Restaurant"],
    rating: 4.7,
    reviewCount: 8412,
    hours: "Wed–Sun 11:00 AM–3:00 PM",
    hoursDetail: [
      { day: "Wednesday", hours: "11:00 AM–3:00 PM" },
      { day: "Thursday", hours: "11:00 AM–3:00 PM" },
      { day: "Friday", hours: "11:00 AM–3:00 PM" },
      { day: "Saturday", hours: "11:00 AM–3:00 PM" },
      { day: "Sunday", hours: "11:00 AM–3:00 PM" },
    ],
    currentStatus: "closed",
    claimed: true,
    priceLevel: "moderate",
    placeId: "sample-franklin",
    cid: "sample-franklin-cid",
    image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=80",
    lat: 30.2701,
    lng: -97.7313,
  },
  {
    title: "Joe's Pizza",
    address: "7 Carmine St, New York, NY 10014",
    city: "New York",
    state: "NY",
    phone: "(212) 366-1182",
    website: "https://www.joespizzanyc.com",
    category: "Pizza restaurant",
    rating: 4.5,
    reviewCount: 12604,
    hours: "Daily 10:00 AM–4:00 AM",
    currentStatus: "open",
    claimed: true,
    priceLevel: "inexpensive",
    placeId: "sample-joes",
    lat: 40.7304,
    lng: -74.0026,
  },
  {
    title: "Pike Place Fish Market",
    address: "86 Pike St, Seattle, WA 98101",
    city: "Seattle",
    state: "WA",
    phone: "(206) 682-7181",
    website: "https://www.pikeplacefish.com",
    category: "Fish market",
    rating: 4.6,
    reviewCount: 9321,
    hours: "Mon–Sat 7:00 AM–5:00 PM",
    currentStatus: "open",
    claimed: true,
    placeId: "sample-pike",
    lat: 47.6086,
    lng: -122.3405,
  },
  {
    title: "Commander's Palace",
    address: "1403 Washington Ave, New Orleans, LA 70130",
    city: "New Orleans",
    state: "LA",
    phone: "(504) 899-8221",
    website: "https://www.commanderspalace.com",
    category: "Creole restaurant",
    rating: 4.7,
    reviewCount: 7104,
    hours: "Wed–Mon 11:30 AM–9:00 PM",
    claimed: true,
    priceLevel: "expensive",
    placeId: "sample-commanders",
    lat: 29.9287,
    lng: -90.0843,
  },
]

export const SAMPLE_SEARCHES = [
  { name: "Franklin Barbecue", city: "Austin", state: "TX" },
  { name: "Joe's Pizza", city: "New York", state: "NY" },
  { name: "Pike Place Fish", city: "Seattle", state: "WA" },
]

export function searchMockBusinesses(query: SearchQuery): BusinessListing[] {
  const state = toStateAbbr(query.state)
  const hasName = query.name.trim().length >= 2
  const keyword = query.keyword?.trim().toLowerCase() ?? ""
  const hits = SAMPLES.filter((sample) => {
    const hay = `${sample.title} ${sample.category ?? ""} ${(sample.categories ?? []).join(" ")}`.toLowerCase()
    const nameOk = hasName ? namesMatch(sample.title, query.name) : true
    const keywordOk = keyword ? hay.includes(keyword) : true
    const cityOk = !query.city || sample.city?.toLowerCase() === query.city.toLowerCase()
    const stateOk = !state || sample.state === state
    return (hasName ? nameOk : keywordOk) && cityOk && stateOk
  }).map((sample) => {
    const listing: BusinessListing = {
      ...sample,
      source: "sample",
      mapsUrl: "",
      matchScore: 0,
      isBestMatch: false,
    }
    listing.mapsUrl = mapsPlaceUrl(listing)
    return listing
  })
  return rankListings(hits, query)
}
