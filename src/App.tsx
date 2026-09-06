import { Download } from "lucide-react"
import { useEffect, useState } from "react"
import { AccountPage } from "./components/AccountPage.tsx"
import { AdminLogin } from "./components/AdminLogin.tsx"
import { AdminPage } from "./components/AdminPage.tsx"
import { AppNav } from "./components/AppNav.tsx"
import { AuthPage } from "./components/AuthPage.tsx"
import { BuyPage } from "./components/BuyPage.tsx"
import { DownloadPage } from "./components/DownloadPage.tsx"
import { LicenseGate } from "./components/LicenseGate.tsx"
import { ResultPanel } from "./components/ResultPanel.tsx"
import { SearchForm } from "./components/SearchForm.tsx"
import { TrackPage } from "./components/TrackPage.tsx"
import { SellPage } from "./components/SellPage.tsx"
import { loadRuntime, searchBusiness } from "./lib/api.ts"
import { allowedPath, clientIsDesktop, currentPath, type AppPath } from "./lib/nav.ts"
import { emptyKeys, loadHistory, pushHistory } from "./lib/storage.ts"
import type { AuthUser, HistoryItem, HostedKeyStatus, LicenseStatus, SearchQuery, SearchResponse } from "./lib/types.ts"

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "" })

export default function App() {
  const [path, setPath] = useState<AppPath>(currentPath)
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [history, setHistory] = useState(loadHistory)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hosted, setHosted] = useState<HostedKeyStatus | null>(null)
  const [seller, setSeller] = useState(false)
  const [store, setStore] = useState(true)
  const [desktop, setDesktop] = useState(clientIsDesktop)
  const [admin, setAdmin] = useState(false)
  const [bootstrap, setBootstrap] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [runtimeReady, setRuntimeReady] = useState(false)

  const access = { desktop, store, admin, user }

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    void loadRuntime()
      .then((runtime) => {
        const nextDesktop = Boolean(runtime.desktop || clientIsDesktop())
        setHosted(runtime.hosted)
        setSeller(runtime.seller)
        setDesktop(nextDesktop)
        setStore(Boolean(runtime.store) && !nextDesktop)
        setAdmin(runtime.admin)
        setBootstrap(Boolean(runtime.bootstrap))
        setUser(runtime.user)
        setLicense(runtime.license)
        const dest = allowedPath(currentPath(), {
          desktop: nextDesktop,
          store: Boolean(runtime.store) && !nextDesktop,
          admin: runtime.admin,
          user: runtime.user,
        })
        if (dest !== currentPath()) {
          window.history.replaceState({}, "", dest)
          setPath(dest)
        }
      })
      .catch(() => {
        setHosted(null)
        setDesktop(clientIsDesktop())
      })
      .finally(() => setRuntimeReady(true))
  }, [])

  function go(next: AppPath) {
    const dest = allowedPath(next, access)
    window.history.pushState({}, "", dest)
    setPath(dest)
  }

  async function refreshSession(nextUser: AuthUser, dest?: AppPath) {
    setUser(nextUser)
    if (nextUser.role === "admin") setAdmin(true)
    try {
      const runtime = await loadRuntime()
      const nextDesktop = Boolean(runtime.desktop || clientIsDesktop())
      setDesktop(nextDesktop)
      setStore(Boolean(runtime.store) && !nextDesktop)
      setAdmin(runtime.admin)
      setLicense(runtime.license)
      setUser(runtime.user ?? nextUser)
      const next = dest ?? allowedPath(desktop || nextDesktop ? "/" : "/account", {
        desktop: nextDesktop,
        store: Boolean(runtime.store) && !nextDesktop,
        admin: runtime.admin,
        user: runtime.user ?? nextUser,
      })
      window.history.pushState({}, "", next)
      setPath(next)
    } catch {
      const next = dest ?? (desktop ? "/" : "/account")
      window.history.pushState({}, "", next)
      setPath(next)
    }
  }

  function onAuthed(next: AuthUser) {
    void refreshSession(next, path === "/track" ? "/track" : desktop ? "/" : "/account")
  }

  function onAdminAuthed(next: AuthUser) {
    setUser(next)
    setAdmin(next.role === "admin")
    setBootstrap(false)
    window.history.replaceState({}, "", "/admin")
    setPath("/admin")
  }

  async function runSearch(next = query) {
    setLoading(true)
    setError(null)
    try {
      const payload = await searchBusiness(next, emptyKeys(), true)
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

  const lookupBlocked = Boolean(license?.required && !license.valid && desktop)
  const needsDesktopLogin = desktop && !user && path !== "/admin"
  const needsTrackLogin = !desktop && path === "/track" && !user
  const showLookup = path === "/" && !lookupBlocked && !needsDesktopLogin
  const showTrack = path === "/track" && !lookupBlocked && Boolean(user)

  return (
    <div className="min-h-screen bg-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,177,91,0.08),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(111,154,120,0.08),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
              {desktop ? "Windows desktop" : "Maps listing software"}
            </p>
            <h1 className="font-display text-3xl text-paper sm:text-4xl">PlaceFind</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {runtimeReady && !needsDesktopLogin && (
              <AppNav path={path} desktop={desktop} store={store} admin={admin} user={user} onGo={go} />
            )}
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
          </div>
        </header>

        {admin && path === "/sell" && <SellPage />}
        {path === "/admin" && admin && <AdminPage currentUserId={user?.id} />}
        {path === "/admin" && !admin && <AdminLogin bootstrap={bootstrap} onAuthed={onAdminAuthed} />}
        {!desktop && (admin || store) && path === "/download" && <DownloadPage onTryScan={() => go("/")} />}
        {!desktop && store && path === "/buy" && <BuyPage user={user} onAuthed={onAuthed} onTryScan={() => go("/")} />}
        {path === "/account" && user && (
          <AccountPage
            user={user}
            desktop={desktop}
            onLogout={() => {
              setUser(null)
              setAdmin(false)
              window.history.pushState({}, "", "/login")
              setPath("/login")
            }}
            onBuy={desktop ? undefined : () => go("/buy")}
          />
        )}
        {(needsDesktopLogin || needsTrackLogin || (path === "/login" && !user)) && (
          <AuthPage
            desktop={desktop}
            title={needsTrackLogin ? "Sign in to track ranks" : undefined}
            intro={
              needsTrackLogin
                ? "Grid tracking is for signed-in customers. Visitors can still run a public test scan."
                : undefined
            }
            onAuthed={onAuthed}
            onGoBuy={desktop ? undefined : () => go("/buy")}
          />
        )}
        {(path === "/" || path === "/track") && lookupBlocked && license && user && (
          <LicenseGate license={license} onActivated={setLicense} />
        )}
        {showTrack && <TrackPage keys={emptyKeys()} hosted={hosted} seller={seller} desktop={desktop} />}
        {showLookup && (
          <div className="grid flex-1 gap-6 lg:grid-cols-[20rem_1fr]">
            <aside className="rounded-2xl border border-line bg-panel p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
                {desktop ? "Lookup" : "Try PlaceFind"}
              </p>
              <h2 className="mt-1 font-display text-2xl text-paper">{desktop ? "Find a listing" : "Test scan"}</h2>
              <p className="mb-4 mt-2 text-sm leading-6 text-muted">
                {desktop
                  ? "Enter a business name, city, and state to pull the Google Maps listing."
                  : "This preview shows what the Windows app does. Enter a business name, city, and state."}
              </p>
              <SearchForm
                query={query}
                onChange={setQuery}
                onSearch={() => void runSearch()}
                loading={loading}
                history={history}
                onHistory={useHistory}
                submitLabel={desktop ? "Find listing" : "Run test scan"}
              />
            </aside>
            <main>
              <ResultPanel loading={loading} result={result} error={error && !result?.best ? error : null} />
            </main>
          </div>
        )}
      </div>
    </div>
  )
}
