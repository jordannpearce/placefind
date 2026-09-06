import { Download } from "lucide-react"
import { useEffect, useState } from "react"
import { AccountPage } from "./components/AccountPage.tsx"
import { AdminLogin } from "./components/AdminLogin.tsx"
import { AdminPage } from "./components/AdminPage.tsx"
import { AppNav } from "./components/AppNav.tsx"
import { AuthPage } from "./components/AuthPage.tsx"
import { BuyPage } from "./components/BuyPage.tsx"
import { ResetPage } from "./components/ResetPage.tsx"
import { DownloadPage } from "./components/DownloadPage.tsx"
import { HomePage } from "./components/HomePage.tsx"
import { LegalPage } from "./components/LegalPage.tsx"
import { LicenseGate } from "./components/LicenseGate.tsx"
import { ResultPanel } from "./components/ResultPanel.tsx"
import { SearchForm } from "./components/SearchForm.tsx"
import { SiteFooter } from "./components/SiteFooter.tsx"
import { TrackPage } from "./components/TrackPage.tsx"
import { SellPage } from "./components/SellPage.tsx"
import { isLegalPath } from "./lib/legal.ts"
import { loadRuntime, searchBusiness, stopImpersonation } from "./lib/api.ts"
import { allowedPath, clientIsDesktop, currentPath, isAppPath, pageTitle, type AppPath } from "./lib/nav.ts"
import { emptyKeys, loadHistory, pushHistory } from "./lib/storage.ts"
import type {
  AuthUser,
  HistoryItem,
  HostedKeyStatus,
  ImpersonatingInfo,
  LicenseStatus,
  SearchQuery,
  SearchResponse,
} from "./lib/types.ts"

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "", keyword: "" })

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, "")
  if (!id) return
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, 40)
}

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
  const [publicUrl, setPublicUrl] = useState("")
  const [impersonating, setImpersonating] = useState<ImpersonatingInfo | null>(null)
  const [runtimeReady, setRuntimeReady] = useState(false)

  const access = { desktop, store, admin, user, impersonating }

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    document.title = pageTitle(path)
  }, [path])

  useEffect(() => {
    if (path === "/") scrollToHash(window.location.hash)
  }, [path])

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
        setImpersonating(runtime.impersonating ?? null)
        setLicense(runtime.license)
        setPublicUrl(runtime.publicUrl ?? "")
        const dest = allowedPath(currentPath(), {
          desktop: nextDesktop,
          store: Boolean(runtime.store) && !nextDesktop,
          admin: runtime.admin,
          user: runtime.user,
          impersonating: runtime.impersonating ?? null,
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

  function go(next: string) {
    const [rawPath, hash] = next.split("#")
    const requested = (rawPath || "/") as AppPath
    const dest = isAppPath(requested) ? allowedPath(requested, access) : "/"
    const url = hash ? `${dest}#${hash}` : dest
    window.history.pushState({}, "", url)
    setPath(dest)
    if (hash) scrollToHash(hash)
    else window.scrollTo({ top: 0, behavior: "smooth" })
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
      setImpersonating(runtime.impersonating ?? null)
      const next = dest ?? allowedPath(desktop || nextDesktop ? "/" : "/account", {
        desktop: nextDesktop,
        store: Boolean(runtime.store) && !nextDesktop,
        admin: runtime.admin,
        user: runtime.user ?? nextUser,
        impersonating: runtime.impersonating ?? null,
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
    const stay = path === "/track" || path === "/try" || path === "/demo"
    void refreshSession(next, stay ? path : desktop ? "/" : "/account")
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
    const next = { name: item.name, city: item.city, state: item.state, keyword: item.keyword ?? "" }
    setQuery(next)
    void runSearch(next)
  }

  const lookupBlocked = Boolean(license?.required && !license.valid && desktop)
  const needsDesktopLogin = desktop && !user && path !== "/admin" && path !== "/reset" && !isLegalPath(path)
  const needsTrackLogin = !desktop && path === "/track" && !user
  const needsTryLogin = !desktop && (path === "/try" || path === "/demo") && !user
  const showHome = !desktop && path === "/"
  const showLegal = isLegalPath(path)
  const showLookup =
    ((desktop && path === "/") || (!desktop && (path === "/try" || path === "/demo") && Boolean(user))) &&
    !lookupBlocked &&
    !needsDesktopLogin
  const showTrack = path === "/track" && !lookupBlocked && Boolean(user)
  const showWebsiteChrome = !desktop
  const tryScanDest = user ? "/try" : "/#sample"

  return (
    <div className="min-h-screen bg-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,177,91,0.08),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(111,154,120,0.08),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6">
        {impersonating && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/40 bg-brass/10 px-4 py-3">
            <p className="text-sm text-paper">
              Viewing as {impersonating.name} ({impersonating.email})
            </p>
            <button
              type="button"
              onClick={() => {
                void stopImpersonation()
                  .then((next) => refreshSession(next, "/admin"))
                  .catch(() => setImpersonating(null))
              }}
              className="rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#ecc77a]"
            >
              Stop viewing
            </button>
          </div>
        )}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button type="button" onClick={() => go("/")} className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
              {desktop ? "Windows desktop" : "Maps research for local businesses"}
            </p>
            <h1 className="font-display text-3xl text-paper sm:text-4xl">PlaceFind</h1>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {runtimeReady && !needsDesktopLogin && (
              <AppNav path={path} desktop={desktop} store={store} admin={admin} user={user} onGo={go} />
            )}
            {showLookup && result?.best && (
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

        {admin && !impersonating && path === "/sell" && <SellPage />}
        {path === "/admin" && admin && !impersonating && (
          <AdminPage currentUserId={user?.id} onViewAs={(next) => void refreshSession(next, "/account")} />
        )}
        {path === "/admin" && !admin && !impersonating && <AdminLogin bootstrap={bootstrap} onAuthed={onAdminAuthed} />}
        {!desktop && (admin || store) && path === "/download" && (
          <DownloadPage onTryScan={() => go(tryScanDest)} />
        )}
        {!desktop && store && path === "/buy" && (
          <BuyPage user={user} onAuthed={onAuthed} onTryScan={() => go(tryScanDest)} />
        )}
        {path === "/account" && user && (
          <AccountPage
            user={user}
            desktop={desktop}
            onLogout={() => {
              setUser(null)
              setAdmin(false)
              setImpersonating(null)
              window.history.pushState({}, "", "/login")
              setPath("/login")
            }}
            onBuy={desktop ? undefined : () => go("/buy")}
          />
        )}
        {path === "/reset" && (
          <ResetPage
            desktop={desktop}
            publicUrl={publicUrl}
            onAuthed={onAuthed}
            onGoLogin={() => go("/login")}
          />
        )}
        {showLegal && <LegalPage path={path} />}
        {showHome && <HomePage user={user} store={store} onGo={go} />}
        {(needsDesktopLogin || needsTrackLogin || needsTryLogin || (path === "/login" && !user)) && (
          <AuthPage
            desktop={desktop}
            publicUrl={publicUrl}
            title={
              needsTrackLogin
                ? "Sign in to track ranks"
                : needsTryLogin
                  ? "Sign in to run a test scan"
                  : undefined
            }
            intro={
              needsTrackLogin
                ? "Grid tracking is for signed-in customers."
                : needsTryLogin
                  ? "The live test scan is for signed-in customers. Visitors can try the sample search on the home page."
                  : undefined
            }
            onAuthed={onAuthed}
            onGoBuy={desktop ? undefined : () => go("/buy")}
          />
        )}
        {(path === "/" || path === "/track" || path === "/try" || path === "/demo") &&
          lookupBlocked &&
          license &&
          user && <LicenseGate license={license} onActivated={setLicense} />}
        {showTrack && <TrackPage keys={emptyKeys()} hosted={hosted} seller={seller} desktop={desktop} />}
        {showLookup && (
          <div className="grid flex-1 gap-6 lg:grid-cols-[20rem_1fr]">
            <aside className="min-w-0 rounded-2xl border border-line bg-panel p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
                {desktop ? "Lookup" : "Internal test scan"}
              </p>
              <h2 className="mt-1 font-display text-2xl text-paper">{desktop ? "Find a listing" : "Test scan"}</h2>
              <p className="mb-4 mt-2 text-sm leading-6 text-muted">
                {desktop
                  ? "Enter a business name, city, state, and optional keyword to pull the Google Maps listing."
                  : "Signed-in lookup. Enter a business name, city, state, and optional keyword."}
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
        {showWebsiteChrome && <SiteFooter onGo={go} />}
      </div>
    </div>
  )
}
