import { useEffect, useState } from "react"
import { AccountPage } from "./components/AccountPage.tsx"
import { AdminLogin } from "./components/AdminLogin.tsx"
import { AdminPage } from "./components/AdminPage.tsx"
import { AppNav } from "./components/AppNav.tsx"
import { AuthPage } from "./components/AuthPage.tsx"
import { ResetPage } from "./components/ResetPage.tsx"
import { CrawlDashboard } from "./components/CrawlDashboard.tsx"
import { DirectoryPage } from "./components/DirectoryPage.tsx"
import { HomePage } from "./components/HomePage.tsx"
import { LegalPage } from "./components/LegalPage.tsx"
import { ListingDetailPage } from "./components/ListingDetailPage.tsx"
import { BusinessUpgradeCard } from "./components/BusinessUpgradeCard.tsx"
import { ListingFormPage } from "./components/ListingFormPage.tsx"
import { ResultPanel } from "./components/ResultPanel.tsx"
import { SearchForm } from "./components/SearchForm.tsx"
import { SiteFooter } from "./components/SiteFooter.tsx"
import { TrackPage } from "./components/TrackPage.tsx"
import { canPublishListing, joinHref, joinIntentFromSearch, loginHref, safeAuthNext } from "./lib/account.ts"
import { isLegalPath } from "./lib/legal.ts"
import { loadRuntime, searchBusiness, stopImpersonation } from "./lib/api.ts"
import {
  allowedPath,
  clientIsDesktop,
  currentPath,
  isAppPath,
  isListingCreatePath,
  isListingEditPath,
  listingIdFromPath,
  pageTitle,
  type AppPath,
} from "./lib/nav.ts"
import { emptyKeys, loadHistory, pushHistory } from "./lib/storage.ts"
import type { AuthUser, HistoryItem, HostedKeyStatus, ImpersonatingInfo, SearchQuery, SearchResponse } from "./lib/types.ts"

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "", keyword: "" })

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, "")
  if (!id) return
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, 40)
}

function requestedAppPath(raw: string): AppPath {
  if (raw.startsWith("/listings")) return "/listings"
  return isAppPath(raw) ? raw : "/"
}

export default function App() {
  const [path, setPath] = useState<AppPath>(currentPath)
  const [listingId, setListingId] = useState(() => listingIdFromPath())
  const [listingCreate, setListingCreate] = useState(() => isListingCreatePath())
  const [listingEdit, setListingEdit] = useState(() => isListingEditPath())
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
  const [publicUrl, setPublicUrl] = useState("")
  const [impersonating, setImpersonating] = useState<ImpersonatingInfo | null>(null)
  const [runtimeReady, setRuntimeReady] = useState(false)

  const access = { desktop, store, admin, user, impersonating }

  function syncListingRoute() {
    setListingId(listingIdFromPath())
    setListingCreate(isListingCreatePath())
    setListingEdit(isListingEditPath())
  }

  useEffect(() => {
    const onPop = () => {
      setPath(currentPath())
      syncListingRoute()
    }
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
          syncListingRoute()
        }
      })
      .catch(() => {
        setHosted(null)
        setDesktop(clientIsDesktop())
      })
      .finally(() => setRuntimeReady(true))
  }, [])

  function go(next: string) {
    const hashIndex = next.indexOf("#")
    const beforeHash = hashIndex === -1 ? next : next.slice(0, hashIndex)
    const hash = hashIndex === -1 ? "" : next.slice(hashIndex + 1)
    const queryIndex = beforeHash.indexOf("?")
    const raw = (queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex)) || "/"
    const search = queryIndex === -1 ? "" : beforeHash.slice(queryIndex)
    const requested = requestedAppPath(raw)
    const dest = allowedPath(requested, access)
    const urlPath = dest === "/listings" && raw.startsWith("/listings") ? raw : dest
    const url = `${urlPath}${dest === requested ? search : ""}${hash ? `#${hash}` : ""}`
    window.history.pushState({}, "", url)
    setPath(dest)
    syncListingRoute()
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
      setUser(runtime.user ?? nextUser)
      setImpersonating(runtime.impersonating ?? null)
      const next =
        dest ??
        allowedPath(desktop || nextDesktop ? "/" : "/account", {
          desktop: nextDesktop,
          store: Boolean(runtime.store) && !nextDesktop,
          admin: runtime.admin,
          user: runtime.user ?? nextUser,
          impersonating: runtime.impersonating ?? null,
        })
      window.history.pushState({}, "", next)
      setPath(next)
      syncListingRoute()
    } catch {
      const next = dest ?? (desktop ? "/" : "/account")
      window.history.pushState({}, "", next)
      setPath(next)
      syncListingRoute()
    }
  }

  function onAuthed(next: AuthUser) {
    const nextPath = safeAuthNext(new URLSearchParams(window.location.search).get("next"))
    const stay =
      path === "/track" ||
      path === "/try" ||
      path === "/demo" ||
      path === "/listings" ||
      path === "/directory" ||
      path === "/dashboard"
    void refreshSession(next, nextPath ?? (stay ? path : desktop ? "/" : "/account"))
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

  function useHistory(item: HistoryItem) {
    const next = { name: item.name, city: item.city, state: item.state, keyword: item.keyword ?? "" }
    setQuery(next)
    void runSearch(next)
  }

  const needsDesktopLogin = desktop && !user && path !== "/admin" && path !== "/reset" && !isLegalPath(path)
  const needsTrackLogin = !desktop && path === "/track" && !user
  const needsTryLogin = !desktop && (path === "/try" || path === "/demo") && !user
  const needsListingLogin = !desktop && path === "/listings" && listingCreate && !user
  const needsDashboardLogin = !desktop && path === "/dashboard" && !user
  const showHome = !desktop && path === "/"
  const showLegal = isLegalPath(path)
  const showLookup = ((desktop && path === "/") || (!desktop && (path === "/try" || path === "/demo") && Boolean(user))) && !needsDesktopLogin
  const showTrack = path === "/track" && Boolean(user)
  const showWebsiteChrome = !desktop

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
              {desktop ? "Maps lookup" : "Business directory"}
            </p>
            <h1 className="font-display text-3xl text-paper sm:text-4xl">PlaceFind</h1>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {runtimeReady && !needsDesktopLogin && (
              <AppNav path={path} desktop={desktop} store={store} admin={admin} user={user} onGo={go} />
            )}
          </div>
        </header>

        {path === "/admin" && admin && !impersonating && (
          <AdminPage currentUserId={user?.id} onViewAs={(next) => void refreshSession(next, "/account")} onGo={go} />
        )}
        {path === "/admin" && !admin && !impersonating && <AdminLogin bootstrap={bootstrap} onAuthed={onAdminAuthed} />}
        {path === "/account" && user && (
          <AccountPage
            user={user}
            onUser={setUser}
            onLogout={() => {
              setUser(null)
              setAdmin(false)
              setImpersonating(null)
              window.history.pushState({}, "", "/login")
              setPath("/login")
            }}
            onGo={go}
          />
        )}
        {path === "/reset" && (
          <ResetPage publicUrl={publicUrl} onAuthed={onAuthed} onGoLogin={() => go("/login")} />
        )}
        {showLegal && <LegalPage path={path} />}
        {showHome && <HomePage user={user} onGo={go} />}
        {path === "/directory" && <DirectoryPage user={user} onGo={go} />}
        {path === "/dashboard" && user && <CrawlDashboard user={user} onGo={go} />}
        {path === "/listings" && listingCreate && user && canPublishListing(user) && (
          <ListingFormPage user={user} onGo={go} />
        )}
        {path === "/listings" && listingCreate && user && !canPublishListing(user) && (
          <BusinessUpgradeCard user={user} onUpgraded={setUser} onGo={go} />
        )}
        {path === "/listings" && listingId && listingEdit && user && (
          <ListingFormPage listingId={listingId} user={user} onGo={go} />
        )}
        {path === "/listings" && listingId && !listingEdit && (
          <ListingDetailPage listingId={listingId} user={user} onGo={go} />
        )}
        {(needsDesktopLogin ||
          needsTrackLogin ||
          needsTryLogin ||
          needsListingLogin ||
          needsDashboardLogin ||
          (path === "/login" && !user) ||
          (path === "/join" && !user)) && (
          <AuthPage
            mode={path === "/join" || needsListingLogin ? "join" : "login"}
            publicUrl={publicUrl}
            joinIntent={
              needsListingLogin
                ? "business"
                : path === "/join"
                  ? joinIntentFromSearch(window.location.search)
                  : "business"
            }
            title={
              needsTrackLogin
                ? "Sign in to track ranks"
                : needsTryLogin
                  ? "Sign in to run a test scan"
                  : needsDashboardLogin
                    ? "Sign in to crawl a website"
                    : needsListingLogin
                      ? "Create a business account"
                      : path === "/join" && joinIntentFromSearch(window.location.search) === "member"
                        ? "Create a free account"
                        : path === "/join"
                          ? "Create a PlaceFind account"
                          : undefined
            }
            intro={
              needsTrackLogin
                ? "Grid tracking is for signed-in business owners."
                : needsTryLogin
                  ? "The live test scan is for signed-in business owners."
                  : needsDashboardLogin
                    ? "Website crawls are a signed-in dashboard tool. Create a business account to request Crawl Website."
                    : needsListingLogin
                      ? "Create a business account to publish a PlaceFind listing for $150 per month and build a public profile."
                      : path === "/join" && joinIntentFromSearch(window.location.search) === "member"
                        ? "Leave reviews and request quotes. This account is free. PlaceFind does not charge $150 for reviews or quotes."
                        : path === "/join"
                          ? "Create an account to publish a PlaceFind listing for $150 per month and build a public profile."
                          : undefined
            }
            onAuthed={onAuthed}
            onGoLogin={() => go(loginHref(new URLSearchParams(window.location.search).get("next")))}
            onGoJoin={() => {
              const params = new URLSearchParams(window.location.search)
              const intent =
                path === "/join" ? joinIntentFromSearch(window.location.search) : needsListingLogin ? "business" : "business"
              go(joinHref(intent, params.get("next")))
            }}
          />
        )}
        {showTrack && <TrackPage keys={emptyKeys()} hosted={hosted} seller={seller} />}
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
