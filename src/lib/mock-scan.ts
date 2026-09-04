import { formatCoordinate, googleMapsUrl, haversineMiles } from "./grid"
import { matchTarget } from "./dataforseo"
import { listingMatchesTarget, namesMatch, normalizeName } from "./rank"
import type { BusinessCandidate, Listing, PointResult } from "./types"

type MockPlace = {
  title: string
  domain: string
  address: string
  placeId: string
  cid: string
  phone: string
  category: string
  rating: number
  reviews: number
  lat: number
  lng: number
  url: string
}

const AUSTIN_COFFEE: MockPlace[] = [
  {
    title: "Houndstooth Coffee",
    domain: "houndstoothcoffee.com",
    address: "401 Congress Ave, Austin, TX 78701",
    placeId: "ChIJMockHoundstooth001",
    cid: "1000000000000000001",
    phone: "(512) 394-2170",
    category: "Coffee shop",
    rating: 4.6,
    reviews: 1842,
    lat: 30.2669,
    lng: -97.7434,
    url: "https://www.houndstoothcoffee.com",
  },
  {
    title: "Jo's Coffee",
    domain: "joscoffee.com",
    address: "242 W 2nd St, Austin, TX 78701",
    placeId: "ChIJMockJosCoffee002",
    cid: "1000000000000000002",
    phone: "(512) 469-9003",
    category: "Coffee shop",
    rating: 4.5,
    reviews: 3210,
    lat: 30.2651,
    lng: -97.7468,
    url: "https://www.joscoffee.com",
  },
  {
    title: "Halcyon",
    domain: "halcyonaustin.com",
    address: "218 W 4th St, Austin, TX 78701",
    placeId: "ChIJMockHalcyon003",
    cid: "1000000000000000003",
    phone: "(512) 472-9637",
    category: "Coffee shop",
    rating: 4.4,
    reviews: 2104,
    lat: 30.2674,
    lng: -97.7462,
    url: "https://halcyonaustin.com",
  },
  {
    title: "Starbucks Reserve",
    domain: "starbucks.com",
    address: "301 W 3rd St, Austin, TX 78701",
    placeId: "ChIJMockStarbucks004",
    cid: "1000000000000000004",
    phone: "(512) 476-4477",
    category: "Coffee shop",
    rating: 4.3,
    reviews: 892,
    lat: 30.2662,
    lng: -97.746,
    url: "https://www.starbucks.com",
  },
  {
    title: "Greater Goods Coffee Roasters",
    domain: "greatergoods.com",
    address: "2501 E 5th St, Austin, TX 78702",
    placeId: "ChIJMockGreater005",
    cid: "1000000000000000005",
    phone: "(512) 872-3085",
    category: "Coffee roaster",
    rating: 4.7,
    reviews: 956,
    lat: 30.2578,
    lng: -97.7179,
    url: "https://greatergoods.com",
  },
  {
    title: "Bennu Coffee",
    domain: "bennucoffee.com",
    address: "2001 E Martin Luther King Jr Blvd, Austin, TX 78702",
    placeId: "ChIJMockBennu006",
    cid: "1000000000000000006",
    phone: "(512) 236-9908",
    category: "Coffee shop",
    rating: 4.5,
    reviews: 1677,
    lat: 30.2804,
    lng: -97.7211,
    url: "https://bennucoffee.com",
  },
  {
    title: "Radio Coffee & Beer",
    domain: "radiocoffeeandbeer.com",
    address: "4204 Manchaca Rd, Austin, TX 78704",
    placeId: "ChIJMockRadio007",
    cid: "1000000000000000007",
    phone: "(512) 394-7846",
    category: "Coffee shop",
    rating: 4.6,
    reviews: 2488,
    lat: 30.2298,
    lng: -97.7886,
    url: "https://radiocoffeeandbeer.com",
  },
  {
    title: "Cosmic Coffee + Beer Garden",
    domain: "cosmiccoffeebeer.com",
    address: "121 Pickle Rd, Austin, TX 78704",
    placeId: "ChIJMockCosmic008",
    cid: "1000000000000000008",
    phone: "(512) 481-2216",
    category: "Coffee shop",
    rating: 4.5,
    reviews: 4102,
    lat: 30.2268,
    lng: -97.7624,
    url: "https://cosmiccoffeebeer.com",
  },
  {
    title: "Lazarus Brewing Co.",
    domain: "lazarusbrewing.com",
    address: "1902 E 6th St, Austin, TX 78702",
    placeId: "ChIJMockLazarus009",
    cid: "1000000000000000009",
    phone: "(512) 609-2950",
    category: "Coffee shop",
    rating: 4.6,
    reviews: 1330,
    lat: 30.2624,
    lng: -97.7238,
    url: "https://lazarusbrewing.com",
  },
  {
    title: "Mozart's Coffee Roasters",
    domain: "mozartscoffee.com",
    address: "3825 Lake Austin Blvd, Austin, TX 78703",
    placeId: "ChIJMockMozart010",
    cid: "1000000000000000010",
    phone: "(512) 477-2900",
    category: "Coffee roaster",
    rating: 4.5,
    reviews: 3891,
    lat: 30.2967,
    lng: -97.7839,
    url: "https://mozartscoffee.com",
  },
  {
    title: "Merit Coffee",
    domain: "meritcoffee.com",
    address: "222 West Ave, Austin, TX 78701",
    placeId: "ChIJMockMerit011",
    cid: "1000000000000000011",
    phone: "(512) 330-9800",
    category: "Coffee shop",
    rating: 4.6,
    reviews: 742,
    lat: 30.2688,
    lng: -97.7516,
    url: "https://meritcoffee.com",
  },
  {
    title: "Cafe Medici",
    domain: "cafemedici.com",
    address: "2222 Guadalupe St, Austin, TX 78705",
    placeId: "ChIJMockMedici012",
    cid: "1000000000000000012",
    phone: "(512) 474-8005",
    category: "Espresso bar",
    rating: 4.4,
    reviews: 1108,
    lat: 30.2861,
    lng: -97.7419,
    url: "https://cafemedici.com",
  },
  {
    title: "Austin Coffee House",
    domain: "austincoffeehouse.example",
    address: "607 Trinity St, Austin, TX 78701",
    placeId: "ChIJMockAustinHouse013",
    cid: "1000000000000000013",
    phone: "(512) 555-0140",
    category: "Coffee shop",
    rating: 4.4,
    reviews: 612,
    lat: 30.2678,
    lng: -97.7396,
    url: "https://austincoffeehouse.example",
  },
  {
    title: "Texas Espresso Bar",
    domain: "texasespresso.example",
    address: "98 San Jacinto Blvd, Austin, TX 78701",
    placeId: "ChIJMockTexasEspresso014",
    cid: "1000000000000000014",
    phone: "(512) 555-0188",
    category: "Espresso bar",
    rating: 4.3,
    reviews: 287,
    lat: 30.2639,
    lng: -97.7422,
    url: "https://texasespresso.example",
  },
  {
    title: "San Antonio Coffee Co.",
    domain: "sanantoniocoffee.example",
    address: "110 E 2nd St, Austin, TX 78701",
    placeId: "ChIJMockSanAntonio015",
    cid: "1000000000000000015",
    phone: "(512) 555-0112",
    category: "Coffee shop",
    rating: 4.2,
    reviews: 154,
    lat: 30.2644,
    lng: -97.7439,
    url: "https://sanantoniocoffee.example",
  },
]

function seededNoise(lat: number, lng: number, salt: string): number {
  const text = `${lat.toFixed(5)}:${lng.toFixed(5)}:${salt}`
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 1000
  }
  return (hash % 100) / 100
}

function placeToListing(place: MockPlace, rankAbsolute: number, isPaid = false): Listing {
  return {
    rankAbsolute,
    rankGroup: rankAbsolute,
    type: isPaid ? "maps_paid_item" : "maps_search",
    title: place.title,
    domain: place.domain,
    address: place.address,
    placeId: place.placeId,
    cid: place.cid,
    phone: place.phone,
    category: place.category,
    rating: place.rating,
    reviews: place.reviews,
    latitude: place.lat,
    longitude: place.lng,
    url: place.url,
    isPaid,
  }
}

function keywordAffinity(place: MockPlace, keyword: string): number {
  const k = normalizeName(keyword)
  if (!k) return 0
  const title = normalizeName(place.title)
  const category = normalizeName(place.category)
  let bias = 0
  if (title.includes(k) || k.split(" ").every((part) => title.includes(part))) bias -= 1.1
  if (category.includes(k) || k.includes(category)) bias -= 0.5
  if (k.includes("espresso") && title.includes("espresso")) bias -= 1.6
  if (k.includes("coffee shop") && category.includes("coffee shop")) bias -= 0.7
  return bias
}

export function mockScanPoint(input: {
  pointId: string
  keyword: string
  targetBusiness: string
  targetPlaceId?: string
  targetCid?: string
  targetLat?: number
  targetLng?: number
  lat: number
  lng: number
  zoom: number
}): PointResult {
  const scored = AUSTIN_COFFEE.map((place) => {
    const miles = haversineMiles(input.lat, input.lng, place.lat, place.lng)
    const noise = seededNoise(input.lat, input.lng, `${place.placeId}:${input.keyword}`) * 0.8
    return { place, score: miles + noise + keywordAffinity(place, input.keyword) }
  }).sort((a, b) => a.score - b.score)

  const organic = scored.slice(0, 12).map((entry, index) => {
    const listing = placeToListing(entry.place, index + 1)
    return { ...listing, rankGroup: index + 1, rankAbsolute: index + 1 }
  })

  const sponsor = scored[3]?.place
  const base: Listing[] = sponsor
    ? [{ ...placeToListing(sponsor, 1, true), rankGroup: 1, rankAbsolute: 1 }, ...organic]
    : organic
  const listings = ensureTargetInPack(base, input)

  return matchTarget({
    id: input.pointId,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate: formatCoordinate(input.lat, input.lng, input.zoom),
    listings,
    targetBusiness: input.targetBusiness,
    targetPlaceId: input.targetPlaceId,
    targetCid: input.targetCid,
    targetLat: input.targetLat,
    targetLng: input.targetLng,
  })
}

/** Sample mode still paints a 1–12 rank on every pin when the campaign listing is not in the Austin set. */
function ensureTargetInPack(
  listings: Listing[],
  input: {
    targetBusiness: string
    targetPlaceId?: string
    targetCid?: string
    targetLat?: number
    targetLng?: number
    lat: number
    lng: number
    keyword: string
  }
): Listing[] {
  const target = {
    title: input.targetBusiness,
    placeId: input.targetPlaceId,
    cid: input.targetCid,
    lat: input.targetLat,
    lng: input.targetLng,
  }
  if (listings.some((listing) => listingMatchesTarget(listing, target))) return listings

  const rank = 1 + Math.floor(seededNoise(input.lat, input.lng, `target:${input.targetBusiness}`) * 10)
  const storeLat = input.targetLat ?? input.lat
  const storeLng = input.targetLng ?? input.lng
  const injected: Listing = {
    rankAbsolute: rank,
    rankGroup: rank,
    type: "maps_search",
    title: input.targetBusiness,
    domain: null,
    address: null,
    placeId: input.targetPlaceId?.trim() || `ChIJMockTarget${input.targetBusiness.slice(0, 12)}`,
    cid: input.targetCid?.trim() || null,
    phone: null,
    category: input.keyword,
    rating: 4.4,
    reviews: 120,
    latitude: storeLat,
    longitude: storeLng,
    url: googleMapsUrl({
      title: input.targetBusiness,
      lat: storeLat,
      lng: storeLng,
      placeId: input.targetPlaceId,
    }),
    isPaid: false,
  }

  const paid = listings.filter((listing) => listing.isPaid)
  const organic = listings.filter((listing) => !listing.isPaid)
  const nextOrganic = [...organic]
  nextOrganic.splice(Math.min(rank - 1, nextOrganic.length), 0, injected)
  return [
    ...paid,
    ...nextOrganic.map((listing, index) => ({
      ...listing,
      rankGroup: index + 1,
      rankAbsolute: index + 1,
    })),
  ]
}

export function mockDelayMs(lat: number, lng: number): number {
  return 90 + Math.round(seededNoise(lat, lng, "delay") * 160)
}

export function searchMockBusinesses(
  name: string,
  city: string,
  state: string
): BusinessCandidate[] {
  const cityNorm = normalizeName(city)
  const stateNorm = normalizeName(state)
  const cityOk =
    !cityNorm ||
    cityNorm.includes("austin") ||
    "austin".includes(cityNorm)
  const stateOk =
    !stateNorm ||
    stateNorm === "tx" ||
    stateNorm === "texas" ||
    "texas".includes(stateNorm)

  if (!cityOk || !stateOk) return []

  return AUSTIN_COFFEE.filter((place) => namesMatch(place.title, name) || normalizeName(place.title).includes(normalizeName(name)))
    .slice(0, 8)
    .map((place) => ({
      title: place.title,
      address: place.address,
      city: "Austin",
      state: "TX",
      lat: place.lat,
      lng: place.lng,
      placeId: place.placeId,
      mapsUrl: googleMapsUrl({
        title: place.title,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      }),
      source: "sample" as const,
    }))
}
