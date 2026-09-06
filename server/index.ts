import cors from "cors"
import express from "express"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  canManage,
  clearSession,
  createSession,
  hasAdminUser,
  login,
  publicUser,
  readUsers,
  sessionCookie,
  signup,
  storeOpen,
  userFromCookie,
} from "./auth.ts"
import { testDataForSeo } from "./dataforseo.ts"
import { hostedKeyStatus, readHostedKeys, writeHostedKeys } from "./hosted-keys.ts"
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
import { mailStatus, readOutbox, sendMail, testResendConnection, welcomeEmail, writeMailConfig } from "./mail.ts"
import { readProduct, writeProduct } from "./product.ts"
import { isDesktopRequest, isSellerMode } from "./runtime.ts"
import {
  ALLOWED_GRID_SIZES,
  CampaignError,
  MAX_GRID_SIZE,
  MAX_KEYWORDS,
  createCampaign,
  deleteCampaign,
  getCampaign,
  readCampaigns,
  scanCampaign,
  updateCampaign,
} from "./campaigns.ts"
import { publicCheckoutWarning } from "./public-copy.ts"
import { searchBusiness } from "./search.ts"
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
  const name = body.name?.trim() ?? ""
  const city = body.city?.trim() ?? ""
  const state = body.state?.trim() ?? ""
  if (name.length < 2) return { query: { name, city, state }, error: "Enter a business name." }
  if (city.length < 2) return { query: { name, city, state }, error: "Enter the city." }
  if (!state) return { query: { name, city, state }, error: "Choose a state." }
  return { query: { name, city, state } }
}

async function start() {
  await initStore()
  const app = express()
  app.use(cors({ origin: true, credentials: true }))
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
    res.status(403).json({ error: "The license store is not available in this copy." })
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
    const hosted = hostedKeyStatus()
    const user = actor(req)
    const desktop = isDesktopRequest(req)
    const license = user ? await attachUserLicense(user) : await licenseStatus()
    res.json({
      seller: isSellerMode(),
      store: storeOpen() && !desktop,
      desktop,
      admin: canManage(req.headers.cookie),
      bootstrap: !hasAdminUser(),
      user,
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
    })
  })

  app.get("/api/states", (_req, res) => {
    res.json({ states: US_STATES })
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
        error: license.detail || "Enter a valid PlaceFind license key to search.",
        license,
      })
      return
    }
    const keys = isSellerMode() ? ((req.body ?? {}) as ApiKeys) : {}
    try {
      const result = await searchBusiness(parsed.query, keys)
      res.json(result)
    } catch {
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

  app.post("/api/campaigns/:id/scan", async (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const desktop = isDesktopRequest(req)
    const license = await licenseStatus()
    if (license.required && !license.valid && (desktop || !storeOpen())) {
      res.status(402).json({
        error: license.detail || "Enter a valid PlaceFind license key to scan ranks.",
        license,
      })
      return
    }
    const body = (req.body ?? {}) as ApiKeys & { keywords?: string[]; keyword?: string }
    const keys = isSellerMode() ? body : {}
    const requested = body.keyword ? [body.keyword] : body.keywords
    try {
      const result = await scanCampaign(String(req.params.id ?? ""), keys, requested, user.id)
      res.json({ ...result, ...campaignMeta() })
    } catch (error) {
      if (error instanceof CampaignError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Rank scan failed unexpectedly." })
    }
  })

  app.post("/api/test-keys", async (req, res) => {
    const hosted = readHostedKeys()
    const body = isSellerMode() ? ((req.body ?? {}) as ApiKeys) : {}
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
      hosted: hostedKeyStatus(),
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

  app.get("/api/hosted-keys", (_req, res) => {
    res.json(hostedKeyStatus())
  })

  app.post("/api/hosted-keys", (req, res) => {
    if (!manage(req, res)) return
    const body = (req.body ?? {}) as {
      scrappeyKey?: string
      dataforseoLogin?: string
      dataforseoPassword?: string
      rebuild?: boolean
    }
    const hosted = writeHostedKeys(body)
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
      res.status(403).json({ error: "Create your account when you buy PlaceFind on the website." })
      return
    }
    if (!store(req, res)) return
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
    res.setHeader("Set-Cookie", sessionCookie(token))
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
    res.setHeader("Set-Cookie", sessionCookie(createSession(result.user.id)))
    res.json({ user: result.user, license })
  })

  app.post("/api/auth/logout", (req, res) => {
    const token = (req.headers.cookie || "").includes("pf_session=")
      ? (req.headers.cookie || "").split("pf_session=")[1]?.split(";")[0]
      : ""
    if (token) clearSession(decodeURIComponent(token))
    res.setHeader("Set-Cookie", sessionCookie("", true))
    res.json({ ok: true })
  })

  app.get("/api/auth/me", (req, res) => {
    const desktop = isDesktopRequest(req)
    res.json({
      user: actor(req),
      admin: canManage(req.headers.cookie),
      store: storeOpen() && !desktop,
      desktop,
      bootstrap: !hasAdminUser(),
    })
  })

  app.post("/api/shop/checkout", async (req, res) => {
    if (!store(req, res)) return
    const user = actor(req)
    if (!user) {
      res.status(401).json({ error: "Sign in to buy a license." })
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
      res.status(401).json({ error: "Sign in to see your licenses." })
      return
    }
    res.json({
      user,
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
    })
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
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
