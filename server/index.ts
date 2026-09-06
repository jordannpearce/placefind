import cors from "cors"
import express from "express"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { testDataForSeo } from "./dataforseo.ts"
import { hostedKeyStatus, writeHostedKeys } from "./hosted-keys.ts"
import { getInstallerStatus, installerPath, startInstallerBuild, startSetupRepack } from "./installer.ts"
import { readProduct, writeProduct } from "./product.ts"
import { searchBusiness } from "./search.ts"
import { testScrappey } from "./scrappey.ts"
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
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: "1mb" }))

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "PlaceFind" })
  })

  app.get("/api/states", (_req, res) => {
    res.json({ states: US_STATES })
  })

  app.post("/api/search", async (req, res) => {
    const parsed = readQuery(req.body ?? {})
    if (parsed.error) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const keys = (req.body ?? {}) as ApiKeys
    try {
      const result = await searchBusiness(parsed.query, keys)
      res.json(result)
    } catch {
      res.status(500).json({ error: "Search failed unexpectedly." })
    }
  })

  app.post("/api/test-keys", async (req, res) => {
    const body = (req.body ?? {}) as ApiKeys
    const results = []
    if (body.dataforseoLogin && body.dataforseoPassword) {
      results.push(await testDataForSeo(body.dataforseoLogin, body.dataforseoPassword))
    }
    if (body.scrappeyKey) {
      results.push(await testScrappey(body.scrappeyKey))
    }
    if (results.length === 0) {
      res.status(400).json({ error: "Add a key to test." })
      return
    }
    res.json({ results })
  })

  app.get("/api/product", (_req, res) => {
    res.json({ product: readProduct(), installer: getInstallerStatus(), hosted: hostedKeyStatus() })
  })

  app.get("/api/hosted-keys", (_req, res) => {
    res.json(hostedKeyStatus())
  })

  app.post("/api/hosted-keys", (req, res) => {
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
    const body = (req.body ?? {}) as { price?: string; pitch?: string }
    res.json({ product: writeProduct(body) })
  })

  app.get("/api/installer", (_req, res) => {
    res.json(getInstallerStatus())
  })

  app.post("/api/installer/build", (_req, res) => {
    res.json(startInstallerBuild())
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
