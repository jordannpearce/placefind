import { formatCoordinate, haversineMiles } from "./grid"
import { matchTarget } from "./dataforseo"
import type { Listing, PointResult } from "./types"

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

export function mockScanPoint(input: {
  pointId: string
  keyword: string
  targetBusiness: string
  targetPlaceId?: string
  lat: number
  lng: number
  zoom: number
}): PointResult {
  const scored = AUSTIN_COFFEE.map((place) => {
    const miles = haversineMiles(input.lat, input.lng, place.lat, place.lng)
    const noise = seededNoise(input.lat, input.lng, place.placeId) * 0.8
    return { place, score: miles + noise }
  }).sort((a, b) => a.score - b.score)

  const organic = scored.slice(0, 12).map((entry, index) => {
    const listing = placeToListing(entry.place, index + 1)
    return { ...listing, rankGroup: index + 1, rankAbsolute: index + 1 }
  })

  const sponsor = scored[3]?.place
  const listings: Listing[] = sponsor
    ? [{ ...placeToListing(sponsor, 1, true), rankGroup: 1, rankAbsolute: 1 }, ...organic]
    : organic

  return matchTarget({
    id: input.pointId,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate: formatCoordinate(input.lat, input.lng, input.zoom),
    listings,
    targetBusiness: input.targetBusiness,
    targetPlaceId: input.targetPlaceId,
  })
}

export function mockDelayMs(lat: number, lng: number): number {
  return 90 + Math.round(seededNoise(lat, lng, "delay") * 160)
}
