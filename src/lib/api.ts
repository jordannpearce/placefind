import type { ApiKeys, KeyTestResult, SearchQuery, SearchResponse } from "./types.ts"

export async function searchBusiness(query: SearchQuery, keys: ApiKeys): Promise<SearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...query, ...keys }),
  })
  const payload = (await response.json()) as SearchResponse & { error?: string }
  if (!response.ok && !payload.best && !payload.others) {
    throw new Error(payload.error || "Search failed.")
  }
  return payload
}

export async function testKeys(keys: ApiKeys): Promise<KeyTestResult[]> {
  const response = await fetch("/api/test-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(keys),
  })
  const payload = (await response.json()) as { results?: KeyTestResult[]; error?: string }
  if (!response.ok) throw new Error(payload.error || "Could not test keys.")
  return payload.results ?? []
}
