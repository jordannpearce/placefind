import cors from "cors"
import express from "express"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  canManage,
  clearSession,
  createManagedUser,
  createSession,
  deleteManagedUser,
  hasAdminUser,
  impersonatingFromCookie,
  impersonationCookie,
  issuePasswordReset,
  login,
  parseCookies,
  publicUser,
  readUsers,
  resetPasswordWithToken,
  SESSION_COOKIE,
  sessionCookie,
  setUserStatus,
  signup,
  startImpersonation,
  stopImpersonation,
  storeOpen,
  updateManagedUser,
  userFromCookie,
} from "./auth.ts"
import { testDataForSeo } from "./dataforseo.ts"
import { hostedKeyStatus, hydrateHostedKeys, readHostedKeys, writeHostedKeys } from "./hosted-keys.ts"
import { getInstallerStatus, installerPath, startInstallerBuild, startSetupRepack } from "./installer.ts"
import {
  activateLicense,
  createLicense,
  keygenPublicStatus,
  licenseStatus,
  readIssuedLicenses,
  readKeygenConfig,
  testKeygenConnection,
  writeKeygenConfig,
} from "./keygen.ts"
import {
  mailPresets,
  mailStatus,
  passwordResetEmail,
  readOutbox,
  resolveCampaignCopy,
  selectMailRecipients,
  sendBroadcast,
  sendMail,
  testResendConnection,
  welcomeEmail,
  writeMailConfig,
} from "./mail.ts"
import { readProduct, writeProduct } from "./product.ts"
import { isDesktopRequest, isSellerMode, passwordResetUrl, publicSiteUrl } from "./runtime.ts"
import {
  ALLOWED_GRID_SIZES,
  CampaignError,
  MAX_GRID_SIZE,
  MAX_KEYWORDS,
  compareCampaignScans,
  createCampaign,
  deleteCampaign,
  geocodeCity,
  getCampaign,
  getCampaignScan,
  listCampaignScans,
  loadCampaignGrid,
  previewScanPoints,
  readCampaigns,
  scanCampaign,
  updateCampaign,
  normalizeKeywords,
} from "./campaigns.ts"
import {
  geoPointsMeta,
  importBundledSampleGeoPoints,
  importBundledUscitiesGeoPoints,
  importGeoCsvText,
  initGeoPoints,
  usingCityGpsBackupNote,
} from "./geo-points.ts"
import { startScheduler } from "./scheduler.ts"
import { getCampaignTraffic, recoverStaleTrafficJobs, startCampaignTraffic, stopCampaignTraffic } from "./traffic.ts"
import { publicCheckoutWarning } from "./public-copy.ts"
import { searchBusiness } from "./search.ts"
import { requestIp, runWebsiteSearch, VisitorSearchUsedError } from "./search-limit.ts"
import { readSearchQuery } from "./search-query.ts"
import {
  confirmListingMatch,
  createListing,
  deleteListing,
  getListing,
  ListingError,
  listPublicListings,
  listingsForUser,
  publicListing,
  seedDirectoryListings,
  updateListing,
  verifyListingOnMaps,
} from "./listings.ts"
import { initStore } from "./store.ts"
import { testScrappey } from "./scrappey.ts"
import { attachUserLicense, checkout, issueAndDeliver, listOrders, ordersForUser, publicOrder, shopSummary } from "./shop.ts"
import { US_STATES } from "./states.ts"
import type { ApiKeys, SearchQuery } from "./types.ts"

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && process.env[match[1]] == null) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
    }
  }
}

loadEnv()

const PORT = Number(process.env.PORT || 43141)
const dirname = path.dirname(fileURLToPath(import.meta.url))

function readQuery(body: Partial<SearchQuery>): { query: SearchQuery; error?: string } {
  return readSearchQuery(body)
}

async function start() {
  await initStore()
  seedDirectoryListings()
  await initGeoPoints()
  await hydrateHostedKeys()
  recoverStaleTrafficJobs()
  const app = express()
  app.set("trust proxy", 1)
  app.use(cors({ origin: true, credentials: true }))
  app.use((req, res, next) => {
    if (req.path === "/api/admin/geo-points" && req.method === "POST") {
      return express.json({ limit: "32mb" })(req, res, next)
    }
    next()
  })
  app.use(express.json({ limit: "1mb" }))

  function actor(req: express.Request) {
    return userFromCookie(req.headers.cookie)
  }

  function manage(req: express.Request, res: express.Response) {
    if (canManage(req.headers.cookie)) return true
    res.status(403).json({ error: "Admin access is required." })
    return false
  }

  function store(req: express.Request, res: express.Response) {
    if (storeOpen()) return true
    res.status(403).json({ error: "That purchase flow is no longer available." })
    return false
  }

  function requireUser(req: express.Request, res: express.Response) {
    const user = actor(req)
    if (user) return user
    res.status(401).json({ error: "Sign in to continue." })
    return null
  }

  function campaignMeta() {
    return { maxKeywords: MAX_KEYWORDS, maxGridSize: MAX_GRID_SIZE, allowedGridSizes: ALLOWED_GRID_SIZES }
  }

  app.get("/api/health", (_req, res) => {
    const hosted = hostedKeyStatus()
    res.json({ ok: true, name: "PlaceFind", seller: isSellerMode(), keysIncluded: hosted.included })
  })

  app.get("/api/runtime", async (req, res) => {
    const admin = canManage(req.headers.cookie)
    const hosted = hostedKeyStatus({ revealHints: admin })
    const user = actor(req)
    const desktop = isDesktopRequest(req)
    const license = user ? await attachUserLicense(user) : await licenseStatus()
    res.json({
      seller: isSellerMode(),
      store: storeOpen() && !desktop,
      desktop,
      admin,
      bootstrap: !hasAdminUser(),
      user,
      impersonating: impersonatingFromCookie(req.headers.cookie),
      hosted: {
        included: hosted.included,
        scrappey: hosted.scrappey,
        dataforseo: hosted.dataforseo,
        scrappeyHint: hosted.scrappeyHint,
        dataforseoHint: hosted.dataforseoHint,
        seller: hosted.seller,
      },
      license,
      keygen: keygenPublicStatus(),
      publicUrl: publicSiteUrl(),
    })
  })

  app.get("/api/states", (_req, res) => {
    res.json({ states: US_STATES })
  })

  app.get("/api/listings", (req, res) => {
    const query = {
      name: String(req.query.name ?? ""),
      city: String(req.query.city ?? ""),
      state: String(req.query.state ?? ""),
      keyword: String(req.query.keyword ?? ""),
    }
    const admin = canManage(req.headers.cookie)
    const user = actor(req)
    res.json({
      listings: listPublicListings(query).map((row) => publicListing(row, admin || row.ownerUserId === user?.id)),
    })
  })

  app.get("/api/listings/:id", (req, res) => {
    try {
      const listing = getListing(String(req.params.id ?? ""))
      const admin = canManage(req.headers.cookie)
      const user = actor(req)
      res.json({ listing: publicListing(listing, admin || listing.ownerUserId === user?.id) })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not load that listing." })
    }
  })

  app.post("/api/listings", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const listing = createListing(req.body ?? {}, user.id)
      res.status(201).json({ listing: publicListing(listing, true) })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not create the listing." })
    }
  })

  app.patch("/api/listings/:id", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const listing = updateListing(String(req.params.id ?? ""), req.body ?? {}, user.id, user.role === "admin")
      res.json({ listing: publicListing(listing, true) })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not update the listing." })
    }
  })

  app.delete("/api/listings/:id", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      deleteListing(String(req.params.id ?? ""), user.id, user.role === "admin")
      res.json({ ok: true })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not delete the listing." })
    }
  })

  app.post("/api/listings/:id/verify", async (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const keys = isSellerMode() ? ((req.body ?? {}) as ApiKeys) : {}
    try {
      const verified = await verifyListingOnMaps(String(req.params.id ?? ""), user.id, user.role === "admin", (query) =>
        searchBusiness(query, keys),
      )
      res.json({
        listing: publicListing(verified.listing, true),
        result: verified.result,
        candidates: verified.candidates,
      })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not check Google Maps for this listing." })
    }
  })

  app.post("/api/listings/:id/confirm", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const body = (req.body ?? {}) as {
      placeId?: string
      cid?: string
      title?: string
      address?: string
      mapsStatus?: "pending" | "found" | "not_found"
    }
    try {
      const listing = confirmListingMatch(String(req.params.id ?? ""), user.id, user.role === "admin", body)
      res.json({ listing: publicListing(listing, true) })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not confirm the Maps listing." })
    }
  })

  app.post("/api/search", async (req, res) => {
    const desktop = isDesktopRequest(req)
    if (desktop && !actor(req)) {
      res.status(401).json({ error: "Sign in to look up listings." })
      return
    }
    const parsed = readQuery(req.body ?? {})
    if (parsed.error) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const license = await licenseStatus()
    if (license.required && !license.valid && (desktop || !storeOpen())) {
      res.status(402).json({
        error: license.detail || "Sign in with a PlaceFind account to search.",
        license,
      })
      return
    }
    const keys = isSellerMode() ? ((req.body ?? {}) as ApiKeys) : {}
    const user = actor(req)
    try {
      if (desktop) {
        res.json(await searchBusiness(parsed.query, keys))
        return
      }
      const result = await runWebsiteSearch({
        query: parsed.query,
        search: (query) => searchBusiness(query, keys),
        signedIn: Boolean(user),
        ip: requestIp(req),
      })
      res.json(result)
    } catch (error) {
      if (error instanceof VisitorSearchUsedError) {
        res.status(409).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Search failed unexpectedly." })
    }
  })

  app.get("/api/campaigns", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    res.json({ campaigns: readCampaigns(user.id), ...campaignMeta() })
  })

  app.post("/api/campaigns", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      res.status(201).json({ campaign: createCampaign(req.body ?? {}, user.id), ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not create the campaign." })
    }
  })

  app.get("/api/campaigns/:id", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const campaign = getCampaign(String(req.params.id ?? ""), user.id)
    if (!campaign) {
      res.status(404).json({ error: "That campaign was not found." })
      return
    }
    res.json({ campaign, ...campaignMeta() })
  })

  app.patch("/api/campaigns/:id", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      res.json({ campaign: updateCampaign(String(req.params.id ?? ""), req.body ?? {}, user.id), ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not update the campaign." })
    }
  })

  app.get("/api/geocode", async (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const city = String(req.query.city ?? "")
    const state = String(req.query.state ?? "")
    const center = await geocodeCity(city, state)
    if (!center) {
      res.status(404).json({ error: "Could not find that city on the map." })
      return
    }
    res.json({ center })
  })

  app.get("/api/campaigns/:id/grid", async (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const gridSize = req.query.gridSize == null || req.query.gridSize === "" ? undefined : Number(req.query.gridSize)
    const spacingMiles =
      req.query.spacingMiles == null || req.query.spacingMiles === "" ? undefined : Number(req.query.spacingMiles)
    const pinSource = req.query.pinSource == null || req.query.pinSource === "" ? undefined : String(req.query.pinSource)
    try {
      const result = await loadCampaignGrid(String(req.params.id ?? ""), user.id, {
        gridSize,
        spacingMiles,
        pinSource: pinSource === "city_gps" ? "city_gps" : pinSource === "grid" ? "grid" : undefined,
      })
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not place the grid on the map." })
    }
  })

  app.delete("/api/campaigns/:id", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      deleteCampaign(String(req.params.id ?? ""), user.id)
      res.json({ ok: true })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not delete the campaign." })
    }
  })

  app.get("/api/campaigns/:id/scans", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      res.json({ scans: listCampaignScans(String(req.params.id ?? ""), user.id), ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not load saved scans." })
    }
  })

  app.post("/api/campaigns/:id/scans", async (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const desktop = isDesktopRequest(req)
    const license = await licenseStatus()
    if (license.required && !license.valid && (desktop || !storeOpen())) {
      res.status(402).json({
        error: license.detail || "Sign in with a PlaceFind account to scan ranks.",
        license,
      })
      return
    }
    const body = (req.body ?? {}) as ApiKeys & { keywords?: string[] | string; keyword?: string }
    const keys = isSellerMode() ? body : {}
    const campaign = getCampaign(String(req.params.id ?? ""), user.id)
    if (!campaign) {
      res.status(404).json({ error: "That campaign was not found." })
      return
    }
    const requested = normalizeKeywords([
      ...(body.keywords == null ? [] : Array.isArray(body.keywords) ? body.keywords : [body.keywords]),
      ...(body.keyword == null ? [] : [body.keyword]),
    ])
    const rerunKeywords = requested.length
      ? requested
      : normalizeKeywords(campaign.lastGridScan?.keywords ?? campaign.lastGridScan?.keyword)
    try {
      const result = await scanCampaign(campaign.id, keys, rerunKeywords.length ? rerunKeywords : undefined, user.id)
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Rank scan failed unexpectedly." })
    }
  })

  app.get("/api/campaigns/:id/scans/:a/compare/:b", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      res.json({
        compare: compareCampaignScans(String(req.params.id ?? ""), String(req.params.a ?? ""), String(req.params.b ?? ""), user.id),
        ...campaignMeta(),
      })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not compare those scans." })
    }
  })

  app.get("/api/campaigns/:id/scans/:scanId", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      res.json({ scan: getCampaignScan(String(req.params.id ?? ""), String(req.params.scanId ?? ""), user.id), ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not load that scan." })
    }
  })

  app.post("/api/campaigns/:id/scan", async (req, res) => {
    req.setTimeout(10 * 60 * 1000)
    res.setTimeout(10 * 60 * 1000)
    const user = requireUser(req, res)
    if (!user) return
    const desktop = isDesktopRequest(req)
    const license = await licenseStatus()
    if (license.required && !license.valid && (desktop || !storeOpen())) {
      res.status(402).json({
        error: license.detail || "Sign in with a PlaceFind account to scan ranks.",
        license,
      })
      return
    }
    const body = (req.body ?? {}) as ApiKeys & { keywords?: string[] | string; keyword?: string }
    const keys = isSellerMode() ? body : {}
    const requested = normalizeKeywords([
      ...(body.keywords == null ? [] : Array.isArray(body.keywords) ? body.keywords : [body.keywords]),
      ...(body.keyword == null ? [] : [body.keyword]),
    ])
    try {
      const result = await scanCampaign(String(req.params.id ?? ""), keys, requested.length ? requested : undefined, user.id)
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Rank scan failed unexpectedly." })
    }
  })

  app.post("/api/campaigns/:id/traffic", async (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const desktop = isDesktopRequest(req)
    const license = await licenseStatus()
    if (license.required && !license.valid && (desktop || !storeOpen())) {
      res.status(402).json({
        error: license.detail || "Sign in with a PlaceFind account to start traffic.",
        license,
      })
      return
    }
    const body = (req.body ?? {}) as ApiKeys & {
      pinIds?: string[]
      keywordIds?: string[]
      keywords?: string[]
      searches?: number
      sessions?: number
    }
    const keys = isSellerMode() ? body : {}
    try {
      const result = startCampaignTraffic(
        String(req.params.id ?? ""),
        keys,
        {
          pinIds: body.pinIds,
          keywordIds: body.keywordIds,
          keywords: body.keywords,
          searches: body.searches ?? body.sessions,
        },
        user.id,
      )
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Traffic run failed unexpectedly." })
    }
  })

  app.post("/api/campaigns/:id/traffic/stop", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const result = stopCampaignTraffic(String(req.params.id ?? ""), user.id)
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not stop traffic." })
    }
  })

  app.get("/api/campaigns/:id/traffic", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const result = getCampaignTraffic(String(req.params.id ?? ""), user.id)
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not load traffic." })
    }
  })

  app.post("/api/test-keys", async (req, res) => {
    if (!manage(req, res)) return
    const hosted = readHostedKeys()
    const body = (req.body ?? {}) as ApiKeys
    const login = body.dataforseoLogin || hosted.dataforseoLogin
    const password = body.dataforseoPassword || hosted.dataforseoPassword
    const scrappey = body.scrappeyKey || hosted.scrappeyKey
    const results = []
    if (login && password) results.push(await testDataForSeo(login, password))
    if (scrappey) results.push(await testScrappey(scrappey))
    if (results.length === 0) {
      res.status(400).json({ error: "No keys are available to test." })
      return
    }
    res.json({ results })
  })

  app.get("/api/product", async (req, res) => {
    res.json({
      product: readProduct(),
      installer: storeOpen() ? getInstallerStatus() : { status: "idle", log: "", files: [], folder: "", setupPath: "" },
      hosted: hostedKeyStatus({ revealHints: canManage(req.headers.cookie) }),
      keygen: keygenPublicStatus(),
      issued: canManage(req.headers.cookie) ? readIssuedLicenses() : [],
      license: await licenseStatus(),
    })
  })

  app.get("/api/keygen", (req, res) => {
    if (!manage(req, res)) return
    const config = readKeygenConfig()
    res.json({
      keygen: keygenPublicStatus(),
      issued: readIssuedLicenses(),
      accountId: config.accountId,
      productId: config.productId,
      policyId: config.policyId,
    })
  })

  app.post("/api/keygen", (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as {
      accountId?: string
      productId?: string
      policyId?: string
      token?: string
      rebuild?: boolean
    }
    const current = readKeygenConfig()
    const accountId = body.accountId?.trim() || current.accountId
    const productId = body.productId?.trim() || current.productId
    const policyId = body.policyId?.trim() || current.policyId
    const token = body.token?.trim() || current.token
    if (!accountId || !productId || !policyId || !token) {
      res.status(400).json({ error: "Account ID, product ID, policy ID, and token are required." })
      return
    }
    writeKeygenConfig({ accountId, productId, policyId, token })
    const unpacked = existsSync(path.join(process.cwd(), "release", "win-unpacked", "PlaceFind.exe"))
    const installer = unpacked && body.rebuild !== false ? startSetupRepack() : getInstallerStatus()
    res.json({
      keygen: keygenPublicStatus(),
      issued: readIssuedLicenses(),
      installer,
    })
  })

  app.post("/api/keygen/test", async (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { accountId?: string; productId?: string; policyId?: string; token?: string }
    res.json(await testKeygenConnection(body))
  })

  app.post("/api/keygen/licenses", async (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { name?: string; email?: string; sendEmail?: boolean }
    if (body.sendEmail) {
      const delivered = await issueAndDeliver({ name: body.name ?? "", email: body.email ?? "", sendEmail: true })
      if (delivered.error || !delivered.license) {
        res.status(400).json({ error: delivered.error || "Could not assign a license." })
        return
      }
      res.json({ license: delivered.license, order: delivered.order ? publicOrder(delivered.order) : null, issued: readIssuedLicenses() })
      return
    }
    const result = await createLicense(body)
    if (result.error || !result.license) {
      res.status(400).json({ error: result.error || "Could not assign a license." })
      return
    }
    res.json({ license: result.license, issued: readIssuedLicenses() })
  })

  app.get("/api/license", async (_req, res) => {
    res.json({ license: await licenseStatus(), seller: isSellerMode() })
  })

  app.post("/api/license/activate", async (req, res) => {
    const key = String((req.body ?? {}).key ?? "")
    if (!key.trim()) {
      res.status(400).json({ error: "Enter a license key." })
      return
    }
    const license = await activateLicense(key)
    if (!license.valid) {
      res.status(400).json({ error: license.detail || "That license key is not valid.", license })
      return
    }
    res.json({ license })
  })

  app.get("/api/hosted-keys", (req, res) => {
    if (!manage(req, res)) return
    res.json(hostedKeyStatus({ revealHints: true }))
  })

  app.post("/api/hosted-keys", async (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as {
      scrappeyKey?: string
      dataforseoLogin?: string
      dataforseoPassword?: string
      rebuild?: boolean
    }
    const hosted = await writeHostedKeys(body)
    const unpacked = existsSync(path.join(process.cwd(), "release", "win-unpacked", "PlaceFind.exe"))
    const installer = unpacked && body.rebuild !== false ? startSetupRepack() : getInstallerStatus()
    res.json({ hosted, installer })
  })

  app.post("/api/product", (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { price?: string; pitch?: string }
    res.json({ product: writeProduct(body) })
  })

  app.get("/api/installer", (_req, res) => {
    res.json(getInstallerStatus())
  })

  app.post("/api/installer/build", (req, res) => {
    if (!manage(req, res)) return
    res.json(startInstallerBuild())
  })

  app.post("/api/auth/signup", async (req, res) => {
    if (isDesktopRequest(req)) {
      res.status(403).json({ error: "Create your account on the PlaceFind website." })
      return
    }
    const body = (req.body ?? {}) as { name?: string; email?: string; password?: string }
    const result = signup({ name: body.name ?? "", email: body.email ?? "", password: body.password ?? "" })
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "Could not create the account." })
      return
    }
    const token = createSession(result.user.id)
    const product = readProduct()
    const welcome = welcomeEmail({ name: result.user.name, product: product.name, price: product.price })
    await sendMail({ ...welcome, to: result.user.email })
    res.setHeader("Set-Cookie", [sessionCookie(token), impersonationCookie("", true)])
    res.json({ user: result.user })
  })

  app.post("/api/auth/login", async (req, res) => {
    const body = (req.body ?? {}) as { email?: string; password?: string }
    const result = login({ email: body.email ?? "", password: body.password ?? "" })
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "Could not sign in." })
      return
    }
    const license = await attachUserLicense(result.user)
    res.setHeader("Set-Cookie", [sessionCookie(createSession(result.user.id)), impersonationCookie("", true)])
    res.json({ user: result.user, license })
  })

  app.post("/api/auth/forgot", async (req, res) => {
    const body = (req.body ?? {}) as { email?: string }
    const result = issuePasswordReset(body.email ?? "")
    let hint: string | undefined
    if (result.rawToken && result.user) {
      const mail = await sendMail({
        ...passwordResetEmail({
          name: result.user.name,
          resetUrl: passwordResetUrl(result.rawToken),
        }),
        to: result.user.email,
      })
      if (canManage(req.headers.cookie) && !mail.delivered) {
        hint = mail.detail
      }
    }
    res.json({ message: result.message, ...(hint ? { hint } : {}) })
  })

  app.post("/api/auth/reset", async (req, res) => {
    const body = (req.body ?? {}) as { token?: string; password?: string }
    const result = resetPasswordWithToken({ token: body.token ?? "", password: body.password ?? "" })
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "This reset link is invalid or has expired." })
      return
    }
    const license = await attachUserLicense(result.user)
    res.setHeader("Set-Cookie", [sessionCookie(createSession(result.user.id)), impersonationCookie("", true)])
    res.json({ user: result.user, license })
  })

  app.post("/api/auth/logout", (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (token) clearSession(token)
    res.setHeader("Set-Cookie", [sessionCookie("", true), impersonationCookie("", true)])
    res.json({ ok: true })
  })

  app.post("/api/auth/stop-impersonation", (req, res) => {
    const result = stopImpersonation(req.headers.cookie)
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "You are not viewing as another user." })
      return
    }
    res.setHeader("Set-Cookie", impersonationCookie("", true))
    res.json({ user: result.user, impersonating: null })
  })

  app.get("/api/auth/me", (req, res) => {
    const desktop = isDesktopRequest(req)
    res.json({
      user: actor(req),
      admin: canManage(req.headers.cookie),
      impersonating: impersonatingFromCookie(req.headers.cookie),
      store: storeOpen() && !desktop,
      desktop,
      bootstrap: !hasAdminUser(),
    })
  })

  app.post("/api/shop/checkout", async (req, res) => {
    if (!store(req, res)) return
    const user = actor(req)
    if (!user) {
      res.status(401).json({ error: "Sign in to continue." })
      return
    }
    const result = await checkout(user)
    res.json({
      order: publicOrder(result.order),
      license: result.license ?? null,
      warning: publicCheckoutWarning(result.error),
    })
  })

  app.get("/api/account", (req, res) => {
    const user = actor(req)
    if (!user) {
      res.status(401).json({ error: "Sign in to see your account." })
      return
    }
    res.json({
      user,
      listings: listingsForUser(user.id).map((row) => publicListing(row, true)),
      orders: ordersForUser(user.id).map(publicOrder),
      product: readProduct(),
    })
  })

  app.get("/api/admin", (req, res) => {
    if (!manage(req, res)) return
    res.json({
      product: readProduct(),
      keygen: keygenPublicStatus(),
      mail: mailStatus(),
      hosted: hostedKeyStatus({ revealHints: true }),
      shop: shopSummary(),
      users: readUsers().map(publicUser),
      orders: listOrders().map(publicOrder),
      issued: readIssuedLicenses(),
      outbox: readOutbox().map((row) => ({
        id: row.id,
        to: row.to,
        subject: row.subject,
        createdAt: row.createdAt,
        delivered: row.delivered,
        detail: row.detail,
      })),
      mailPresets: mailPresets(readProduct()),
      geoPoints: geoPointsMeta(),
      listings: listPublicListings().map((row) => publicListing(row, true)),
    })
  })

  app.get("/api/geo-points", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const meta = geoPointsMeta()
    res.json({
      available: meta.pointCount > 0,
      pointCount: meta.pointCount,
      cityCount: meta.cityCount,
      importedAt: meta.importedAt,
    })
  })

  app.get("/api/geo-points/preview", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const result = previewScanPoints({
        city: String(req.query.city ?? ""),
        state: String(req.query.state ?? ""),
        center: { lat: Number(req.query.lat), lng: Number(req.query.lng) },
        gridSize: req.query.gridSize == null || req.query.gridSize === "" ? undefined : Number(req.query.gridSize),
        spacingMiles:
          req.query.spacingMiles == null || req.query.spacingMiles === "" ? undefined : Number(req.query.spacingMiles),
        pinSource: String(req.query.pinSource ?? "") === "city_gps" ? "city_gps" : "grid",
      })
      res.json({
        points: result.points,
        usedCityGps: result.usedCityGps,
        cityPointCount: result.cityPointCount,
        pinSource: result.pinSource,
        note: result.usedCityGps ? usingCityGpsBackupNote() : undefined,
      })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(400).json({ error: "Could not preview those GPS points." })
    }
  })

  app.get("/api/admin/geo-points", (req, res) => {
    if (!manage(req, res)) return
    res.json(geoPointsMeta())
  })

  app.post("/api/admin/geo-points", (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { csv?: string; fileName?: string }
    const csv = String(body.csv ?? "")
    if (!csv.trim()) {
      res.status(400).json({ error: "Choose a CSV file with city, state, latitude, and longitude columns." })
      return
    }
    try {
      const imported = importGeoCsvText(csv, String(body.fileName ?? ""))
      res.json({ ...imported.meta, skipped: imported.skipped })
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not import that CSV." })
    }
  })

  app.post("/api/admin/geo-points/sample", (req, res) => {
    if (!manage(req, res)) return
    try {
      res.json(importBundledSampleGeoPoints())
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not load the sample city GPS file." })
    }
  })

  app.post("/api/admin/geo-points/uscities", async (req, res) => {
    if (!manage(req, res)) return
    try {
      res.json(await importBundledUscitiesGeoPoints())
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not load the US cities GPS file." })
    }
  })

  app.get("/api/admin/users", (req, res) => {
    if (!manage(req, res)) return
    res.json({ users: readUsers().map(publicUser) })
  })

  app.post("/api/admin/users", (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { name?: string; email?: string; password?: string; role?: string }
    const result = createManagedUser({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      role: body.role,
    })
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "Could not create the user." })
      return
    }
    res.status(201).json({ user: result.user, users: readUsers().map(publicUser) })
  })

  app.patch("/api/admin/users/:id", (req, res) => {
    if (!manage(req, res)) return
    const admin = actor(req)
    const body = (req.body ?? {}) as {
      name?: string
      email?: string
      password?: string
      role?: string
      status?: string
    }
    const result = updateManagedUser(String(req.params.id ?? ""), body, admin?.id)
    if (result.error || !result.user) {
      const missing = result.error === "That user was not found."
      res.status(missing ? 404 : 400).json({ error: result.error || "Could not update the user." })
      return
    }
    res.json({ user: result.user, users: readUsers().map(publicUser) })
  })

  app.delete("/api/admin/users/:id", (req, res) => {
    if (!manage(req, res)) return
    const admin = actor(req)
    const result = deleteManagedUser(String(req.params.id ?? ""), admin?.id)
    if (result.error) {
      const missing = result.error === "That user was not found."
      res.status(missing ? 404 : 400).json({ error: result.error })
      return
    }
    res.json({ ok: true, users: readUsers().map(publicUser) })
  })

  app.post("/api/admin/users/:id/suspend", (req, res) => {
    if (!manage(req, res)) return
    const admin = actor(req)
    const result = setUserStatus(String(req.params.id ?? ""), "suspended", admin?.id)
    if (result.error || !result.user) {
      const missing = result.error === "That user was not found."
      res.status(missing ? 404 : 400).json({ error: result.error || "Could not suspend the user." })
      return
    }
    res.json({ user: result.user, users: readUsers().map(publicUser) })
  })

  app.post("/api/admin/users/:id/unsuspend", (req, res) => {
    if (!manage(req, res)) return
    const admin = actor(req)
    const result = setUserStatus(String(req.params.id ?? ""), "active", admin?.id)
    if (result.error || !result.user) {
      const missing = result.error === "That user was not found."
      res.status(missing ? 404 : 400).json({ error: result.error || "Could not unsuspend the user." })
      return
    }
    res.json({ user: result.user, users: readUsers().map(publicUser) })
  })

  app.post("/api/admin/users/:id/impersonate", (req, res) => {
    if (!manage(req, res)) return
    const result = startImpersonation(req.headers.cookie, String(req.params.id ?? ""))
    if (result.error || !result.user || !result.token) {
      const missing = result.error === "That user was not found."
      const forbidden = result.error === "You cannot view the app as another admin."
      res.status(missing ? 404 : forbidden ? 403 : 400).json({
        error: result.error || "Could not view the app as that user.",
      })
      return
    }
    res.setHeader("Set-Cookie", impersonationCookie(result.token))
    res.json({ user: result.user, impersonating: result.impersonating })
  })

  app.post("/api/admin/licenses", async (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { name?: string; email?: string; sendEmail?: boolean }
    const result = await issueAndDeliver({
      name: body.name ?? "",
      email: body.email ?? "",
      sendEmail: body.sendEmail !== false,
    })
    if (result.error || !result.license) {
      res.status(400).json({ error: result.error || "Could not issue a license." })
      return
    }
    res.json({
      license: result.license,
      order: result.order ? publicOrder(result.order) : null,
      issued: readIssuedLicenses(),
    })
  })

  app.post("/api/admin/mail", (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { resendApiKey?: string; fromEmail?: string; fromName?: string }
    writeMailConfig(body)
    res.json({ mail: mailStatus() })
  })

  app.post("/api/admin/mail/test", async (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as { resendApiKey?: string; fromEmail?: string; fromName?: string }
    res.json(await testResendConnection(body))
  })

  app.post("/api/admin/mail/send", async (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as {
      type?: string
      subject?: string
      text?: string
      html?: string
      userIds?: string[]
      all?: boolean
      includeSuspended?: boolean
    }
    const copy = resolveCampaignCopy({
      type: body.type,
      subject: body.subject,
      text: body.text,
      html: body.html,
      product: readProduct(),
    })
    if (copy.error) {
      res.status(400).json({ error: copy.error })
      return
    }
    const selected = selectMailRecipients({
      users: readUsers(),
      userIds: Array.isArray(body.userIds) ? body.userIds.map(String) : [],
      all: Boolean(body.all),
      includeSuspended: Boolean(body.includeSuspended),
    })
    if (selected.error) {
      res.status(400).json({ error: selected.error })
      return
    }
    const result = await sendBroadcast({
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
      recipients: selected.recipients,
    })
    res.json({
      sent: result.sent.length,
      delivered: result.delivered,
      held: result.held,
      skipped: selected.skipped.length,
      outbox: readOutbox().map((row) => ({
        id: row.id,
        to: row.to,
        subject: row.subject,
        createdAt: row.createdAt,
        delivered: row.delivered,
        detail: row.detail,
      })),
    })
  })

  app.get("/api/installer/download/:name", (req, res) => {
    const name = String(req.params.name ?? "")
    const full = installerPath(name)
    if (!full) {
      res.status(404).json({ error: "That installer is not on this computer yet." })
      return
    }
    res.download(full, name)
  })

  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.PLACEFIND_STATIC)
  if (isProd) {
    const dist = process.env.PLACEFIND_UI_DIR || path.resolve(dirname, "../dist")
    app.use(express.static(dist))
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(dist, "index.html"))
    })
  } else {
    const { createServer } = await import("vite")
    const vite = await createServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    })
    app.use(vite.middlewares)
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PlaceFind is running at http://127.0.0.1:${PORT}`)
    startScheduler()
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
