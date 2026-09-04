import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk"

import { requirePaddleEnvironment } from "./paddle-env"

const globalForPaddle = globalThis as unknown as { gridpinPaddle?: Paddle }

export function paddleEnvironment(): Environment {
  return requirePaddleEnvironment() === "sandbox" ? Environment.sandbox : Environment.production
}

export function paddleApiKey() {
  return process.env.PADDLE_API_KEY?.trim() || ""
}

export function paddleWebhookSecret() {
  return process.env.PADDLE_WEBHOOK_SECRET?.trim() || ""
}

export function getPaddle(): Paddle {
  const apiKey = paddleApiKey()
  if (!apiKey) throw new Error("PADDLE_API_KEY is not set")
  if (!globalForPaddle.gridpinPaddle) {
    globalForPaddle.gridpinPaddle = new Paddle(apiKey, {
      environment: paddleEnvironment(),
      logLevel: LogLevel.error,
    })
  }
  return globalForPaddle.gridpinPaddle
}

export function publicAppUrl() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "") || ""
  if (configured && !configured.includes("127.0.0.1") && !configured.includes("localhost")) {
    return configured
  }
  return "https://gridpins.com"
}

export function paddleWebhookUrl() {
  return `${publicAppUrl()}/api/paddle/webhook`
}
