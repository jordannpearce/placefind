import cors from "cors"
import express from "express"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  approveUser,
  becomeBusiness,
  canManage,
  clearSession,
  createManagedUser,
  createSession,
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
  signupIgnoringClientKind,
  startImpersonation,
  stopImpersonation,
  storeOpen,
  updateManagedUser,
  userFromCookie,
} from "./auth.ts"
import { deleteManagedAccount, purgeLeftoverSampleUsers } from "./account-purge.ts"
import { testDataForSeo } from "./dataforseo.ts"
import { hostedKeyStatus, hydrateHostedKeys, readHostedKeys, writeHostedKeys } from "./hosted-keys.ts"
import { getInstallerStatus, installerPath, startInstallerBuild, startSetupRepack } from "./installer.ts"
import {
  hydrateMailConfig,
  mailPresets,
  mailStatus,
  normalizeMailInput,
  passwordResetEmail,
  readOutbox,
  resolveCampaignCopy,
  selectMailRecipients,
  sendAccountApproved,
  sendBroadcast,
  sendMail,
  sendSignupWelcome,
  testResendConnection,
  writeMailConfig,
} from "./mail.ts"
import { readProduct, writeProduct } from "./product.ts"
import { isDesktopRequest, isSellerMode, passwordResetUrl, publicSiteUrl } from "./runtime.ts"
import {
  ALLOWED_GRID_SIZES,
  CampaignError,
  type CampaignInput,
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
import { listingCreateDenied, ownerToolDenied } from "../src/lib/account.ts"
import { isCappedBusinessAccount } from "../src/lib/business-track.ts"
import {
  assertBusinessCampaignAccess,
  assertBusinessCampaignCreate,
  assertBusinessCampaignUpdate,
  assertBusinessTraffic,
  businessCampaignsForUser,
  withOwnedListingCampaignInput,
} from "./business-track.ts"
import { applyDocumentHtmlCanonical } from "../src/lib/canonical.ts"
import { listingPath } from "../src/lib/listings.ts"
import { applyListingHtmlHead } from "../src/lib/profile.ts"
import {
  confirmListingMatch,
  createListing,
  deleteListing,
  getListing,
  listingIsApprovedForDirectory,
  listingLimitDenied,
  ListingError,
  listPublicListings,
  listingsForUser,
  publicListing,
  updateListing,
  verifyListingOnMaps,
  withOwnedListing,
} from "./listings.ts"
import { registerListingLeadRoutes } from "./listing-leads.ts"
import { listingReviewSummary, reviewsForListing } from "./reviews.ts"
import { robotsTxt, siteOrigin, sitemapXml } from "./robots.ts"
import { crawlsForUser, getCrawl, publicCrawl, requestListingCrawl } from "./site-crawl.ts"
import { initStore } from "./store.ts"
import { accountUsageFor, QuotaError } from "./usage.ts"
import { AiPromptError, submitAiPrompt } from "./ai-prompts.ts"
import { testScrappey } from "./scrappey.ts"
import { checkout, listOrders, ordersForUser, publicOrder, shopSummary } from "./shop.ts"
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
  const removedSampleUsers = purgeLeftoverSampleUsers()
  if (removedSampleUsers.length) {
    console.log(
      `Removed ${removedSampleUsers.length} leftover sample user(s): ${removedSampleUsers.map((user) => user.email).join(", ")}`,
    )
  }
  await initGeoPoints()
  await hydrateHostedKeys()
  await hydrateMailConfig()
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
    const user = userFromCookie(req.headers.cookie)
    return user ? withOwnedListing(user) : null
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

  function requireApprovedOwner(
    req: express.Request,
    res: express.Response,
    denied: (user: NonNullable<ReturnType<typeof actor>>) => string | null = listingCreateDenied,
  ) {
    const user = requireUser(req, res)
    if (!user) return null
    const message = denied(user)
    if (message) {
      res.status(403).json({ error: message })
      return null
    }
    return user
  }

  function requireApprovedTracker(req: express.Request, res: express.Response) {
    return requireApprovedOwner(req, res, ownerToolDenied)
  }

  function campaignMeta() {
    return { maxKeywords: MAX_KEYWORDS, maxGridSize: MAX_GRID_SIZE, allowedGridSizes: ALLOWED_GRID_SIZES }
  }

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(robotsTxt(siteOrigin(req)))
  })

  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(sitemapXml(siteOrigin(req), listPublicListings().map((row) => listingPath(row))))
  })

  app.get("/api/health", (_req, res) => {
    const hosted = hostedKeyStatus()
    res.json({ ok: true, name: "PlaceFind", seller: isSellerMode(), keysIncluded: hosted.included })
  })

  app.get("/api/runtime", async (req, res) => {
    const admin = canManage(req.headers.cookie)
    const hosted = hostedKeyStatus({ revealHints: admin })
    const user = actor(req)
    const desktop = isDesktopRequest(req)
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
      listings: listPublicListings(query, { includePendingOwners: admin }).map((row) => ({
        ...publicListing(row, admin || row.ownerUserId === user?.id),
        reviewSummary: listingReviewSummary(row.id),
      })),
    })
  })

  app.get("/api/listings/:id", (req, res) => {
    try {
      const listing = getListing(String(req.params.id ?? ""))
      const admin = canManage(req.headers.cookie)
      const user = actor(req)
      const owner = listing.ownerUserId === user?.id
      if (!listingIsApprovedForDirectory(listing) && !admin && !owner) {
        res.status(404).json({ error: "That listing is not in the directory." })
        return
      }
      const reviews = reviewsForListing(listing.id)
      res.json({
        listing: publicListing(listing, admin || owner),
        reviews,
        reviewSummary: listingReviewSummary(listing.id),
      })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not load that listing." })
    }
  })

  registerListingLeadRoutes(app, requireUser)

  app.get("/api/crawls", (req, res) => {
    const user = requireApprovedOwner(req, res)
    if (!user) return
    res.json({ crawls: crawlsForUser(user.id, user.role === "admin").map(publicCrawl) })
  })

  app.post("/api/crawls", (req, res) => {
    const user = requireApprovedOwner(req, res)
    if (!user) return
    try {
      const job = requestListingCrawl(
        String(req.body?.listingId ?? ""),
        user.id,
        user.role === "admin",
        String(req.body?.website ?? ""),
      )
      res.status(202).json({ crawl: publicCrawl(job) })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not start that website crawl." })
    }
  })

  app.get("/api/crawls/:id", (req, res) => {
    const user = requireApprovedOwner(req, res)
    if (!user) return
    try {
      res.json({ crawl: publicCrawl(getCrawl(String(req.params.id ?? ""), user.id, user.role === "admin")) })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not load that crawl." })
    }
  })

  app.post("/api/listings", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const denied = listingCreateDenied(user)
      if (denied) {
        res.status(403).json({ error: denied })
        return
      }
      const limited = listingLimitDenied(user)
      if (limited) {
        res.status(400).json({ error: limited })
        return
      }
      const listing = createListing(req.body ?? {}, user.id, { allowMultiple: user.role === "admin" })
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
    const user = requireApprovedOwner(req, res)
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
    const user = requireApprovedOwner(req, res)
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
    const user = requireApprovedOwner(req, res)
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
    const user = requireApprovedOwner(req, res)
    if (!user) return
    const body = (req.body ?? {}) as {
      placeId?: string
      cid?: string
      title?: string
      address?: string
      phone?: string
      website?: string
      hours?: string
      category?: string
      categories?: string[]
      mapsStatus?: "pending" | "found" | "not_found"
      lat?: number | null
      lng?: number | null
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    const campaigns = isCappedBusinessAccount(user) ? businessCampaignsForUser(user.id) : readCampaigns(user.id)
    res.json({ campaigns, ...campaignMeta() })
  })

  app.post("/api/campaigns", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const body = (req.body ?? {}) as CampaignInput
      assertBusinessCampaignCreate(user, body)
      res.status(201).json({
        campaign: createCampaign(withOwnedListingCampaignInput(user, body), user.id),
        ...campaignMeta(),
      })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not create the campaign." })
    }
  })

  app.get("/api/campaigns/:id", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    const campaign = getCampaign(String(req.params.id ?? ""), user.id)
    if (!campaign) {
      res.status(404).json({ error: "That campaign was not found." })
      return
    }
    try {
      assertBusinessCampaignAccess(user, campaign)
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      throw error
    }
    res.json({ campaign, ...campaignMeta() })
  })

  app.patch("/api/campaigns/:id", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      const body = (req.body ?? {}) as CampaignInput
      assertBusinessCampaignUpdate(user, campaign, body)
      res.json({
        campaign: updateCampaign(String(req.params.id ?? ""), withOwnedListingCampaignInput(user, body), user.id),
        ...campaignMeta(),
      })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not update the campaign." })
    }
  })

  app.get("/api/geocode", async (req, res) => {
    const user = requireApprovedTracker(req, res)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    const gridSize = req.query.gridSize == null || req.query.gridSize === "" ? undefined : Number(req.query.gridSize)
    const spacingMiles =
      req.query.spacingMiles == null || req.query.spacingMiles === "" ? undefined : Number(req.query.spacingMiles)
    const pinSource = req.query.pinSource == null || req.query.pinSource === "" ? undefined : String(req.query.pinSource)
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessCampaignAccess(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessCampaignAccess(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessCampaignAccess(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    const body = (req.body ?? {}) as ApiKeys & { keywords?: string[] | string; keyword?: string }
    const keys = isSellerMode() ? body : {}
    const campaign = getCampaign(String(req.params.id ?? ""), user.id)
    if (!campaign) {
      res.status(404).json({ error: "That campaign was not found." })
      return
    }
    try {
      assertBusinessCampaignAccess(user, campaign)
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      throw error
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessCampaignAccess(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessCampaignAccess(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    const body = (req.body ?? {}) as ApiKeys & { keywords?: string[] | string; keyword?: string }
    const keys = isSellerMode() ? body : {}
    const requested = normalizeKeywords([
      ...(body.keywords == null ? [] : Array.isArray(body.keywords) ? body.keywords : [body.keywords]),
      ...(body.keyword == null ? [] : [body.keyword]),
    ])
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessCampaignAccess(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    const body = (req.body ?? {}) as ApiKeys & {
      pinIds?: string[]
      keywordIds?: string[]
      keywords?: string[]
      searches?: number
      sessions?: number
      dwellSeconds?: number
      actionOrder?: string
      actions?: string[]
      device?: string
    }
    const keys = isSellerMode() ? body : {}
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessTraffic(user, campaign)
      const result = startCampaignTraffic(
        String(req.params.id ?? ""),
        keys,
        {
          pinIds: body.pinIds,
          keywordIds: body.keywordIds,
          keywords: body.keywords,
          searches: body.searches ?? body.sessions,
          dwellSeconds: body.dwellSeconds,
          actionOrder: body.actionOrder,
          actions: body.actions,
          device: body.device,
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessTraffic(user, campaign)
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
    const user = requireApprovedTracker(req, res)
    if (!user) return
    try {
      const campaign = getCampaign(String(req.params.id ?? ""), user.id)
      if (!campaign) {
        res.status(404).json({ error: "That campaign was not found." })
        return
      }
      assertBusinessTraffic(user, campaign)
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

  app.get("/api/product", (req, res) => {
    res.json({
      product: readProduct(),
      hosted: hostedKeyStatus({ revealHints: canManage(req.headers.cookie) }),
    })
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

  async function completePublicSignup(req: express.Request, res: express.Response, lockedKind: "member" | "business") {
    if (isDesktopRequest(req)) {
      res.status(403).json({ error: "Create your account on the PlaceFind website." })
      return
    }
    const body = (req.body ?? {}) as { name?: string; email?: string; password?: string; kind?: string }
    const result = signupIgnoringClientKind(
      {
        name: body.name ?? "",
        email: body.email ?? "",
        password: body.password ?? "",
        kind: body.kind,
      },
      lockedKind,
    )
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "Could not create the account." })
      return
    }
    const token = createSession(result.user.id)
    await sendSignupWelcome(result.user)
    res.setHeader("Set-Cookie", [sessionCookie(token), impersonationCookie("", true)])
    res.json({ user: withOwnedListing(result.user) })
  }

  app.post("/api/auth/signup", async (req, res) => {
    await completePublicSignup(req, res, "member")
  })

  app.post("/api/auth/signup-business", async (req, res) => {
    await completePublicSignup(req, res, "business")
  })

  app.post("/api/auth/login", async (req, res) => {
    const body = (req.body ?? {}) as { email?: string; password?: string }
    const result = login({ email: body.email ?? "", password: body.password ?? "" })
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "Could not sign in." })
      return
    }
    res.setHeader("Set-Cookie", [sessionCookie(createSession(result.user.id)), impersonationCookie("", true)])
    res.json({ user: withOwnedListing(result.user) })
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
    res.setHeader("Set-Cookie", [sessionCookie(createSession(result.user.id)), impersonationCookie("", true)])
    res.json({ user: withOwnedListing(result.user) })
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
    res.json({ user: withOwnedListing(result.user), impersonating: null })
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
      usage: accountUsageFor(user.id, user.role),
    })
  })

  app.post("/api/account/kind", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const body = (req.body ?? {}) as { kind?: string }
    if (body.kind !== "business") {
      res.status(400).json({ error: "Sign in with a business account to list a shop, or upgrade this one." })
      return
    }
    const result = becomeBusiness(user.id)
    if (result.error || !result.user) {
      res.status(400).json({ error: result.error || "Could not update the account." })
      return
    }
    res.json({ user: withOwnedListing(result.user) })
  })

  app.post("/api/ai/prompts", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    try {
      const result = submitAiPrompt(user.id, user.role)
      res.json({ ...result, usage: accountUsageFor(user.id, user.role) })
    } catch (error) {
      if (error instanceof QuotaError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      if (error instanceof AiPromptError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not run that AI prompt." })
    }
  })

  app.get("/api/admin", (req, res) => {
    if (!manage(req, res)) return
    res.json({
      product: readProduct(),
      mail: mailStatus(),
      hosted: hostedKeyStatus({ revealHints: true }),
      shop: shopSummary(),
      users: readUsers().map(publicUser),
      orders: listOrders().map(publicOrder),
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
      listings: listPublicListings({}, { includePendingOwners: true }).map((row) => publicListing(row, true)),
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
    const body = (req.body ?? {}) as { name?: string; email?: string; password?: string; role?: string; kind?: string }
    const result = createManagedUser({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      role: body.role,
      kind: body.kind,
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
      kind?: string
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
    const result = deleteManagedAccount(String(req.params.id ?? ""), admin?.id)
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

  app.post("/api/admin/users/:id/approve", async (req, res) => {
    if (!manage(req, res)) return
    const admin = actor(req)
    const result = approveUser(String(req.params.id ?? ""), admin?.id)
    if (result.error || !result.user) {
      const missing = result.error === "That user was not found."
      res.status(missing ? 404 : 400).json({ error: result.error || "Could not approve the user." })
      return
    }
    void sendAccountApproved(result.user).catch(() => {
      // Approval still stands if mail is not configured.
    })
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
    res.json({ user: withOwnedListing(result.user), impersonating: result.impersonating })
  })

  app.post("/api/admin/licenses", (_req, res) => {
    res.status(410).json({ error: "PlaceFind does not issue product licenses." })
  })

  app.get("/api/admin/mail", (req, res) => {
    if (!manage(req, res)) return
    res.json({ mail: mailStatus() })
  })

  app.post("/api/admin/mail", async (req, res) => {
    if (!manage(req, res)) return
    try {
      await writeMailConfig(normalizeMailInput((req.body ?? {}) as Record<string, unknown>))
      res.json({ mail: mailStatus() })
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Could not save mail settings.",
      })
    }
  })

  app.post("/api/admin/mail/test", async (req, res) => {
    if (!manage(req, res)) return
    const body = normalizeMailInput((req.body ?? {}) as Record<string, unknown>)
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

  function listingPublicSlug(urlPath: string): string | null {
    const match = urlPath.match(/^\/listings\/([^/]+)\/?$/)
    if (!match || match[1] === "new") return null
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }

  function listingForPublicPath(urlPath: string) {
    const slug = listingPublicSlug(urlPath)
    if (!slug) return null
    try {
      return getListing(slug)
    } catch {
      return null
    }
  }

  app.use((req, res, next) => {
    if (req.method !== "GET") return next()
    const match = req.path.match(/^\/listings\/([^/]+)(\/edit)?\/?$/)
    if (!match || match[1] === "new") return next()
    try {
      const listing = getListing(decodeURIComponent(match[1]))
      if (listing.slug && match[1] === listing.id && listing.slug !== listing.id) {
        res.redirect(301, `/listings/${listing.slug}${match[2] || ""}`)
        return
      }
    } catch {
      // Let the public profile page render its own not-found state.
    }
    next()
  })

  function applyPublicDocumentHead(html: string, urlPath: string) {
    const listing = listingForPublicPath(urlPath)
    const origin = publicSiteUrl()
    if (listing) return applyListingHtmlHead(html, listing, listingPath(listing), origin)
    return applyDocumentHtmlCanonical(html, urlPath, origin)
  }

  function isHtmlDocumentPath(urlPath: string) {
    if (urlPath.startsWith("/api/") || urlPath === "/api") return false
    if (urlPath.startsWith("/@") || urlPath.startsWith("/node_modules") || urlPath.startsWith("/src/")) return false
    if (urlPath === "/robots.txt" || urlPath === "/sitemap.xml") return false
    if (/\.[a-zA-Z0-9]+$/.test(urlPath) && !urlPath.endsWith(".html")) return false
    return true
  }

  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.PLACEFIND_STATIC)
  if (isProd) {
    const dist = process.env.PLACEFIND_UI_DIR || path.resolve(dirname, "../dist")
    app.use(express.static(dist))
    app.get(/.*/, (req, res) => {
      const indexPath = path.join(dist, "index.html")
      if (!isHtmlDocumentPath(req.path)) {
        res.sendFile(indexPath)
        return
      }
      res.status(200).type("html").send(applyPublicDocumentHead(readFileSync(indexPath, "utf8"), req.path))
    })
  } else {
    const { createServer } = await import("vite")
    const vite = await createServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    })
    app.use(async (req, res, next) => {
      if (req.method !== "GET" || !isHtmlDocumentPath(req.path)) return next()
      try {
        const raw = readFileSync(path.resolve(dirname, "../index.html"), "utf8")
        const transformed = await vite.transformIndexHtml(req.originalUrl, raw)
        res.status(200).type("html").send(applyPublicDocumentHead(transformed, req.path))
      } catch (error) {
        next(error)
      }
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
