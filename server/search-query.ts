import { toStateName } from "./states.ts"
import type { SearchQuery } from "./types.ts"

export function readSearchQuery(body: Partial<SearchQuery>): { query: SearchQuery; error?: string } {
  const name = body.name?.trim() ?? ""
  const city = body.city?.trim() ?? ""
  const state = body.state?.trim() ?? ""
  const keyword = body.keyword?.trim() ?? ""
  const query: SearchQuery = { name, city, state, ...(keyword ? { keyword } : {}) }
  if (name.length < 2 && keyword.length < 2) return { query, error: "Enter a business name or a keyword." }
  if (city.length < 2) return { query, error: "Enter the city." }
  if (!state) return { query, error: "Choose a state." }
  return { query }
}

export function mapsKeywordFromQuery(query: SearchQuery): string {
  const name = query.name?.trim() ?? ""
  const keyword = query.keyword?.trim() ?? ""
  const head = [name, keyword].filter(Boolean).join(" ")
  return [head, query.city?.trim(), toStateName(query.state)].filter(Boolean).join(" ")
}
