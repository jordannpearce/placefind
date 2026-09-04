/**
 * Creates the live GridPins webhook destination if PADDLE_API_KEY is set
 * and no destination already points at /api/paddle/webhook.
 * Never deletes existing destinations, products, prices, customers, or subscriptions.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { Paddle, Environment } from "@paddle/paddle-node-sdk"

function loadEnvFile(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue
    const i = line.indexOf("=")
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if (key && !(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "customer.created",
  "customer.updated",
  "transaction.completed",
]

const DESTINATION = "https://gridpins.com/api/paddle/webhook"

function appendEnv(file, key, value) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : ""
  const line = `${key}=${value}`
  if (current.includes(`${key}=`) && !current.match(new RegExp(`^${key}=\\s*$`, "m"))) {
    return
  }
  if (current.match(new RegExp(`^${key}=\\s*$`, "m"))) {
    writeFileSync(file, current.replace(new RegExp(`^${key}=\\s*$`, "m"), line))
    return
  }
  writeFileSync(file, `${current.replace(/\s*$/, "")}\n${line}\n`)
}

async function main() {
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  if (!apiKey) {
    console.log("SKIP: PADDLE_API_KEY is not set. Create the destination in Paddle → Developer tools → Notifications.")
    console.log(`URL: ${DESTINATION}`)
    console.log(`Events: ${EVENTS.join(", ")}`)
    process.exit(0)
  }

  const env = (process.env.PADDLE_ENVIRONMENT || "production").toLowerCase() === "sandbox"
    ? Environment.sandbox
    : Environment.production
  const paddle = new Paddle(apiKey, { environment: env })
  const existing = await paddle.notificationSettings.list()
  const match = existing.find((item) => item.destination === DESTINATION && item.type === "url")
  if (match) {
    console.log(`EXISTS: destination ${match.id} already points at ${DESTINATION}`)
    if (match.endpointSecretKey) {
      appendEnv(".env.local", "PADDLE_WEBHOOK_SECRET", match.endpointSecretKey)
      console.log("Stored PADDLE_WEBHOOK_SECRET in .env.local (gitignored).")
    }
    process.exit(0)
  }

  const created = await paddle.notificationSettings.create({
    description: "GridPins production webhooks",
    destination: DESTINATION,
    type: "url",
    subscribedEvents: EVENTS,
    includeSensitiveFields: false,
  })
  console.log(`CREATED: destination ${created.id} → ${DESTINATION}`)
  if (created.endpointSecretKey) {
    appendEnv(".env.local", "PADDLE_WEBHOOK_SECRET", created.endpointSecretKey)
    console.log("Stored PADDLE_WEBHOOK_SECRET in .env.local (gitignored). Set the same value on Railway.")
  }
}

main().catch((error) => {
  console.error("Could not create or read the Paddle notification destination.")
  console.error(error?.message || error)
  process.exit(1)
})
