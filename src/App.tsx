import { Download, Settings } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AppNav } from "./components/AppNav.tsx"
import { DownloadPage } from "./components/DownloadPage.tsx"
import { ResultPanel } from "./components/ResultPanel.tsx"
import { SearchForm } from "./components/SearchForm.tsx"
import { SellPage } from "./components/SellPage.tsx"
import { SettingsPanel } from "./components/SettingsPanel.tsx"
import { searchBusiness } from "./lib/api.ts"
import { currentPath, type AppPath } from "./lib/nav.ts"
import { loadHistory, loadKeys, pushHistory, saveKeys } from "./lib/storage.ts"
import type { HistoryItem, SearchQuery, SearchResponse } from "./lib/types.ts"

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "" })

export default function App() {
  const [path, setPath] = useState<AppPath>(currentPath)
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [keys, setKeys] = useState(loadKeys)
  const [history, setHistory] = useState(loadHistory)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  function go(next: AppPath) {
    window.history.pushState({}, "", next)
    setPath(next)
  }

  const modeLabel = useMemo(() => {
    const dfs = Boolean(keys.dataforseoLogin && keys.dataforseoPassword)
    const scrappey = Boolean(keys.scrappeyKey)
    if (dfs && scrappey) return "Live Maps + listing page"
    if (dfs) return "Live Maps (DataForSEO)"
    if (scrappey) return "Live Maps page (Scrappey)"
    return "Sample mode"
  }, [keys])

  async function runSearch(next = query) {
    setLoading(true)
    setError(null)
    try {
      const payload = await searchBusiness(next, keys)
      setResult(payload)
      if (payload.error && !payload.best) setError(payload.error)
      setHistory(pushHistory(next, payload.best?.title))
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Search failed.")
    } finally {
      setLoading(false)
    }
  }

  function exportJson() {
    if (!result?.best) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${result.best.title.replace(/[^\w]+/g, "-").toLowerCase()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function useHistory(item: HistoryItem) {
    const next = { name: item.name, city: item.city, state: item.state }
    setQuery(next)
    void runSearch(next)
  }

  return (
    <div className="min-h-screen bg-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,177,91,0.08),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(111,154,120,0.08),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Windows desktop</p>
            <h1 className="font-display text-3xl text-paper sm:text-4xl">PlaceFind</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppNav path={path} onGo={go} />
            {path === "/" && result?.best && (
              <button
                type="button"
                onClick={exportJson}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-paper/80 hover:border-brass"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            )}
            {path === "/" && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-paper/80 hover:border-brass"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            )}
          </div>
        </header>

        {path === "/sell" && <SellPage />}
        {path === "/download" && <DownloadPage />}
        {path === "/" && (
          <div className="grid flex-1 gap-6 lg:grid-cols-[20rem_1fr]">
            <aside className="rounded-2xl border border-line bg-panel p-5">
              <p className="mb-4 text-sm text-muted">Search a business on Google Maps by name and city.</p>
              <SearchForm
                query={query}
                onChange={setQuery}
                onSearch={() => void runSearch()}
                loading={loading}
                history={history}
                onHistory={useHistory}
              />
              <p className="mt-5 border-t border-line pt-4 text-xs text-muted">{modeLabel}</p>
            </aside>
            <main>
              <ResultPanel loading={loading} result={result} error={error && !result?.best ? error : null} />
            </main>
          </div>
        )}
      </div>

      <SettingsPanel
        open={settingsOpen}
        keys={keys}
        onChange={(next) => {
          setKeys(next)
          saveKeys(next)
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
