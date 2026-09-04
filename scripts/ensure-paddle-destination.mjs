/**
 * Read-only check for the existing live GridPins webhook destination.
 * Never creates a second destination. Never deletes products, prices,
 * webhooks, customers, or subscriptions.
 *
 * The live destination is ntfset_01m1pnfb99jrchbdakztt5tb3v.
 */
import { readFileSync, existsSync } from "node:fs"
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
const EXISTING_DESTINATION_ID = "ntfset_01m1pnfb99jrchbdakztt5tb3v"

async function main() {
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  if (!apiKey) {
    console.log("SKIP: PADDLE_API_KEY is not set. Reuse the existing destination in Paddle → Developer tools → Notifications.")
    console.log(`ID: ${EXISTING_DESTINATION_ID}`)
    console.log(`URL: ${DESTINATION}`)
    console.log(`Events: ${EVENTS.join(", ")}`)
    process.exit(0)
  }

  const rawEnv = process.env.PADDLE_ENVIRONMENT?.trim()
  if (!rawEnv) {
    console.error("PADDLE_ENVIRONMENT is not set. Use production or sandbox.")
    process.exit(1)
  }
  const env = rawEnv.toLowerCase() === "sandbox" ? Environment.sandbox : Environment.production
  const paddle = new Paddle(apiKey, { environment: env })
  const existing = await paddle.notificationSettings.list()
  const match =
    existing.find((item) => item.id === EXISTING_DESTINATION_ID) ||
    existing.find((item) => item.destination === DESTINATION && item.type === "url")

  if (match) {
    console.log(`EXISTS: destination ${match.id} already points at ${match.destination}`)
    console.log(`ACTIVE: ${match.active}`)
    console.log(`EVENTS: ${(match.subscribedEvents || []).map((event) => event.name || event).join(", ")}`)
    process.exit(0)
  }

  console.error("The existing GridPins webhook destination was not found.")
  console.error(`Expected id ${EXISTING_DESTINATION_ID} or URL ${DESTINATION}.`)
  console.error("Refusing to create a second destination. Reuse the live notification in the Paddle dashboard.")
  process.exit(1)
}

main().catch((error) => {
  console.error("Could not read the Paddle notification destination.")
  console.error(error?.message || error)
  process.exit(1)
})
