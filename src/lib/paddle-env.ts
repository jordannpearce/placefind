/**
 * Shared Paddle environment reads. Never default silently — the wrong
 * account (live vs sandbox) is worse than a loud failure.
 */

export type PaddlePublicEnvironment = "production" | "sandbox"

export function requirePaddleEnvironment(): PaddlePublicEnvironment {
  const raw = process.env.PADDLE_ENVIRONMENT
  if (raw == null || raw.trim() === "") {
    throw new Error(
      "PADDLE_ENVIRONMENT is not set. Refusing to default so the wrong Paddle account cannot be used. Set it to production or sandbox."
    )
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized === "production" || normalized === "live") return "production"
  if (normalized === "sandbox") return "sandbox"
  throw new Error(`PADDLE_ENVIRONMENT must be "production" or "sandbox", got "${raw.trim()}"`)
}

export function requirePaddleClientToken(): string {
  const token = (process.env.PADDLE_CLIENT_TOKEN || process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "").trim()
  if (!token) {
    throw new Error("PADDLE_CLIENT_TOKEN or NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set")
  }
  return token
}

export function assertClientTokenMatchesEnvironment(token: string, environment: PaddlePublicEnvironment) {
  if (environment === "production" && !token.startsWith("live_")) {
    throw new Error("Live Paddle checkout requires a client-side token prefixed live_")
  }
  if (environment === "sandbox" && !token.startsWith("test_")) {
    throw new Error("Sandbox Paddle checkout requires a client-side token prefixed test_")
  }
}
