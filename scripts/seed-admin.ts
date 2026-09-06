import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { seedAdminAccount } from "../server/auth.ts"
import { initStore } from "../server/store.ts"

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

const email = (process.env.ADMIN_EMAIL ?? "").split(",")[0]?.trim() ?? ""
const password = process.env.ADMIN_PASSWORD ?? ""
const name = process.env.ADMIN_NAME?.trim() || "Admin"

if (!email) {
  console.error("ADMIN_EMAIL is required to seed an admin account.")
  process.exit(1)
}
if (!password) {
  console.error("ADMIN_PASSWORD is required to seed an admin account. Pass it in the environment only.")
  process.exit(1)
}

const driver = await initStore()
const result = seedAdminAccount({ email, password, name })
if (result.error || !result.user) {
  console.error(result.error || "Could not seed the admin account.")
  process.exit(1)
}

console.log(
  `Admin ${result.created ? "created" : "updated"} for ${result.user.email} (${result.user.role}, ${result.user.status}) using ${driver}.`,
)
