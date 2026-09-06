import type { ApiKeys, HistoryItem, SearchQuery } from "./types.ts"

const KEYS = "placefind.keys"
const HISTORY = "placefind.history"

export const emptyKeys = (): ApiKeys => ({
  scrappeyKey: "",
  dataforseoLogin: "",
  dataforseoPassword: "",
  enrichWithScrappey: true,
})

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS)
    if (!raw) return emptyKeys()
    return { ...emptyKeys(), ...(JSON.parse(raw) as Partial<ApiKeys>) }
  } catch {
    return emptyKeys()
  }
}

export function saveKeys(keys: ApiKeys) {
  localStorage.setItem(KEYS, JSON.stringify(keys))
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function pushHistory(query: SearchQuery, title?: string): HistoryItem[] {
  const next: HistoryItem = {
    ...query,
    title,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  }
  const history = [next, ...loadHistory().filter((item) => !(item.name === query.name && item.city === query.city && item.state === query.state))].slice(0, 12)
  localStorage.setItem(HISTORY, JSON.stringify(history))
  return history
}

export function clearHistory() {
  localStorage.removeItem(HISTORY)
}
