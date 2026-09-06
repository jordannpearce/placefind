import type { BusinessListing, SearchQuery, SearchResponse } from "./types.ts"

export const CITY_PHOTOS = [
  {
    src: "/photos/main-street.png",
    alt: "A sunny main street of independently owned storefronts",
  },
  {
    src: "/photos/bbq-storefront.png",
    alt: "Evening light on a neighborhood restaurant storefront",
  },
  {
    src: "/photos/corner-shop.png",
    alt: "A quiet corner shop on a wet morning sidewalk",
  },
  {
    src: "/photos/maps-desk.png",
    alt: "A desk with a printed city map, notebook, and coffee",
  },
] as const

export const HOME_EXAMPLE_QUERY: SearchQuery = {
  name: "Franklin Barbecue",
  city: "Austin",
  state: "TX",
  keyword: "barbecue",
}

export const HOME_EXAMPLE_LISTING: BusinessListing = {
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
  currentStatus: "closed",
  claimed: true,
  priceLevel: "moderate",
  placeId: "sample-franklin",
  cid: "sample-franklin-cid",
  lat: 30.2701,
  lng: -97.7313,
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Franklin%20Barbecue%20Austin%20Texas",
  image: "/photos/bbq-storefront.png",
  source: "sample",
  matchScore: 100,
  isBestMatch: true,
}

export function homeExampleResponse(query: SearchQuery = HOME_EXAMPLE_QUERY): SearchResponse {
  return {
    query,
    best: HOME_EXAMPLE_LISTING,
    others: [],
    mode: "sample",
    sources: { dataforseo: false, scrappey: false },
    warning: "Here's an example of how PlaceFind presents a Google Maps listing.",
    elapsedMs: 1,
  }
}
