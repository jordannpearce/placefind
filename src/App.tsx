import { Download, Settings } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AccountPage } from "./components/AccountPage.tsx"
import { AdminPage } from "./components/AdminPage.tsx"
import { AppNav } from "./components/AppNav.tsx"
import { AuthPage } from "./components/AuthPage.tsx"
import { BuyPage } from "./components/BuyPage.tsx"
import { DownloadPage } from "./components/DownloadPage.tsx"
import { LicenseGate } from "./components/LicenseGate.tsx"
import { ResultPanel } from "./components/ResultPanel.tsx"
import { SearchForm } from "./components/SearchForm.tsx"
import { SellPage } from "./components/SellPage.tsx"
import { SettingsPanel } from "./components/SettingsPanel.tsx"
import { loadRuntime, searchBusiness } from "./lib/api.ts"
import { currentPath, type AppPath } from "./lib/nav.ts"
import { loadHistory, loadKeys, pushHistory, saveKeys } from "./lib/storage.ts"
import type { AuthUser, HistoryItem, HostedKeyStatus, LicenseStatus, SearchQuery, SearchResponse } from "./lib/types.ts"

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "" })

function allowedPath(next: AppPath, access: { store: boolean; admin: boolean; user: AuthUser | null }): AppPath {
  if (next === "/") return "/"
  if (next === "/sell" && access.admin) return "/sell"
  if (next === "/admin" && access.admin) return "/admin"
  if (next === "/download" && (access.admin || access.store)) return "/download"
  if (next === "/buy" && access.store) return "/buy"
  if ((next === "/login" || next === "/join") && access.store) return access.user ? "/account" : next
  if (next === "/account" && access.store) return access.user ? "/account" : "/login"
  return "/"
}

export default function App() {
  const [path, setPath] = useState<AppPath>(currentPath)
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [keys, setKeys] = useState(loadKeys)
  const [history, setHistory] = useState(loadHistory)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hosted, setHosted] = useState<HostedKeyStatus | null>(null)
  const [seller, setSeller] = useState(true)
  const [store, setStore] = useState(true)
  const [admin, setAdmin] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [license, setLicense] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    void loadRuntime()
      .then((runtime) => {
        setHosted(runtime.hosted)
        setSeller(runtime.seller)
        setStore(runtime.store)
        setAdmin(runtime.admin)
        setUser(runtime.user)
        setLicense(runtime.license)
        const dest = allowedPath(currentPath(), {
          store: runtime.store,
          admin: runtime.admin,
          user: runtime.user,
        })
        if (dest !== currentPath()) {
          window.history.replaceState({}, "", dest)
          setPath(dest)
        }
      })
      .catch(() => setHosted(null))
  }, [])

  function go(next: AppPath) {
    const dest = allowedPath(next, { store, admin, user })
    window.history.pushState({}, "", dest)
    setPath(dest)
  }

  function onAuthed(next: AuthUser) {
    setUser(next)
    if (next.role === "admin") setAdmin(true)
    window.history.pushState({}, "", "/account")
    setPath("/account")
  }

  const modeLabel = useMemo(() => {
    const dfs = Boolean((keys.dataforseoLogin && keys.dataforseoPassword) || hosted?.dataforseo)
    const scrappey = Boolean(keys.scrappeyKey || hosted?.scrappey)
    const licensed = license?.configured ? (license.valid ? "Licensed · " : "License needed · ") : ""
    if (dfs && scrappey) return `${licensed}${hosted?.included ? "Maps search is ready" : "Live Maps + listing page"}`
    if (dfs) return `${licensed}Live Maps (DataForSEO)`
    if (scrappey) return `${licensed}Live Maps page (Scrappey)`
    return `${licensed}Sample mode`
  }, [keys, hosted, license])

  async function runSearch(next = query) {
    setLoading(true)
    setError(null)
    try {
      const payload = await searchBusiness(next, keys, Boolean(hosted?.included && !seller))
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

  const lookupBlocked = Boolean(license?.required && !license.valid)

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
            <AppNav path={path} store={store} admin={admin} user={user} onGo={go} />
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
            {path === "/" && !lookupBlocked && (
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

        {admin && path === "/sell" && <SellPage />}
        {admin && path === "/admin" && <AdminPage />}
        {(admin || store) && path === "/download" && <DownloadPage />}
        {store && path === "/buy" && <BuyPage user={user} onAuthed={onAuthed} />}
        {store && path === "/account" && user && (
          <AccountPage
            user={user}
            onLogout={() => {
              setUser(null)
              window.history.pushState({}, "", "/login")
              setPath("/login")
            }}
            onBuy={() => go("/buy")}
          />
        )}
        {store && (path === "/login" || path === "/join") && (
          <AuthPage
            mode={path === "/join" ? "join" : "login"}
            onAuthed={onAuthed}
            onGoJoin={() => go("/join")}
            onGoLogin={() => go("/login")}
          />
        )}
        {path === "/" && lookupBlocked && license && <LicenseGate license={license} onActivated={setLicense} />}
        {path === "/" && !lookupBlocked && (
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
        hosted={hosted}
        seller={seller}
        license={license}
        onChange={(next) => {
          setKeys(next)
          saveKeys(next)
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
