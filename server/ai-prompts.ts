import { type UserRole } from "./auth.ts"
import { accountUsageFor, consumeMonthlyUsage, QuotaError } from "./usage.ts"
import { quotaExceededMessage } from "../src/lib/quotas.ts"

export const AI_PROMPTS_NOT_CONNECTED_MESSAGE = "AI prompts are not connected yet."

export class AiPromptError extends Error {
  status: number

  constructor(message: string, status = 503) {
    super(message)
    this.name = "AiPromptError"
    this.status = status
  }
}

export function aiPromptsConfigured() {
  return Boolean(process.env.PLACEFIND_AI_PROMPTS_URL?.trim())
}

export function submitAiPrompt(userId: string, role?: UserRole, now: Date = new Date()) {
  const usage = accountUsageFor(userId, role, now)
  if (usage.aiPrompts.remaining <= 0) {
    throw new QuotaError(quotaExceededMessage("aiPrompts"))
  }
  if (!aiPromptsConfigured()) {
    throw new AiPromptError(AI_PROMPTS_NOT_CONNECTED_MESSAGE, 503)
  }
  consumeMonthlyUsage(userId, "aiPrompts", now)
  return { accepted: true as const }
}
