export const TRAFFIC_PROFILE_ACTIONS = ["reviews", "directions", "phone", "website"] as const
export type TrafficProfileAction = (typeof TRAFFIC_PROFILE_ACTIONS)[number]
export type TrafficActionOrder = "sequential" | "random"
export type TrafficDeviceMode = "desktop" | "mobile" | "auto"
export type TrafficResolvedDevice = "desktop" | "mobile"

export type TrafficVisitOptions = {
  dwellSeconds: number
  actionOrder: TrafficActionOrder
  actions: TrafficProfileAction[]
  device: TrafficDeviceMode
}

export const DEFAULT_DWELL_SECONDS = 20
export const MIN_DWELL_SECONDS = 5
export const MAX_DWELL_SECONDS = 120
export const DEFAULT_TRAFFIC_ACTIONS: TrafficProfileAction[] = [...TRAFFIC_PROFILE_ACTIONS]
export const DEFAULT_ACTION_ORDER: TrafficActionOrder = "sequential"
export const DEFAULT_DEVICE_MODE: TrafficDeviceMode = "auto"

const ACTION_SET = new Set<string>(TRAFFIC_PROFILE_ACTIONS)

export function normalizeDwellSeconds(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isInteger(value)) return DEFAULT_DWELL_SECONDS
  return Math.min(MAX_DWELL_SECONDS, Math.max(MIN_DWELL_SECONDS, value))
}

export function normalizeActionOrder(raw: unknown): TrafficActionOrder {
  return raw === "random" ? "random" : "sequential"
}

export function normalizeDeviceMode(raw: unknown): TrafficDeviceMode {
  if (raw === "desktop" || raw === "mobile" || raw === "auto") return raw
  return DEFAULT_DEVICE_MODE
}

export function normalizeTrafficActions(raw: unknown): TrafficProfileAction[] {
  if (!Array.isArray(raw)) return [...DEFAULT_TRAFFIC_ACTIONS]
  const seen = new Set<TrafficProfileAction>()
  const actions: TrafficProfileAction[] = []
  for (const item of raw) {
    const action = String(item ?? "").trim() as TrafficProfileAction
    if (!ACTION_SET.has(action) || seen.has(action)) continue
    seen.add(action)
    actions.push(action)
  }
  return actions
}

export function defaultTrafficVisitOptions(): TrafficVisitOptions {
  return {
    dwellSeconds: DEFAULT_DWELL_SECONDS,
    actionOrder: DEFAULT_ACTION_ORDER,
    actions: [...DEFAULT_TRAFFIC_ACTIONS],
    device: DEFAULT_DEVICE_MODE,
  }
}

export function parseTrafficVisitOptions(raw: unknown): TrafficVisitOptions {
  const input = raw && typeof raw === "object" ? (raw as Partial<TrafficVisitOptions>) : {}
  return {
    dwellSeconds: normalizeDwellSeconds(input.dwellSeconds),
    actionOrder: normalizeActionOrder(input.actionOrder),
    actions: normalizeTrafficActions(input.actions),
    device: normalizeDeviceMode(input.device),
  }
}

export function resolveTrafficDevice(visit: Pick<TrafficVisitOptions, "actions" | "device">): TrafficResolvedDevice {
  if (visit.device === "desktop" || visit.device === "mobile") return visit.device
  return visit.actions.includes("phone") ? "mobile" : "desktop"
}

export function visitActionsForDevice(
  visit: Pick<TrafficVisitOptions, "actions">,
  device: TrafficResolvedDevice,
): TrafficProfileAction[] {
  return visit.actions.filter((action) => action !== "phone" || device === "mobile")
}

export function shuffleTrafficActions<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]!
    next[index] = next[swap]!
    next[swap] = current
  }
  return next
}

export function orderTrafficActions(
  actions: TrafficProfileAction[],
  order: TrafficActionOrder,
  random: () => number = Math.random,
): TrafficProfileAction[] {
  if (order === "random") return shuffleTrafficActions(actions, random)
  return [...actions]
}

export function campaignTrafficProfileId(campaignId: string, device: TrafficResolvedDevice): string {
  const slug = campaignId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "campaign"
  return device === "mobile" ? `pf-${slug}-m` : `pf-${slug}`
}

export function trafficActionLabel(action: TrafficProfileAction): string {
  if (action === "reviews") return "read reviews"
  if (action === "directions") return "directions"
  if (action === "phone") return "call"
  return "website"
}

export function trafficVisitLogCopy(visit: TrafficVisitOptions, device: TrafficResolvedDevice): string {
  const actions = visitActionsForDevice(visit, device)
  const ordered = visit.actionOrder === "random" ? actions : orderTrafficActions(actions, "sequential")
  const stay = `stayed ${visit.dwellSeconds}s on the listing`
  if (ordered.length === 0) return `${stay}.`
  const orderNote = visit.actionOrder === "random" ? "randomly " : ""
  return `${stay}, then ${orderNote}${ordered.map(trafficActionLabel).join(" → ")}.`
}

export function trafficVisitHelpCopy() {
  return "After Maps opens the confirmed listing, the visitor stays on the profile for the dwell time, then runs the actions you pick. Missing buttons are skipped. Call only runs on a mobile visitor profile."
}

export function trafficVisitConfirmCopy(visit: TrafficVisitOptions): string {
  const device = resolveTrafficDevice(visit)
  const actions = visitActionsForDevice(visit, device)
  const labels = actions.map(trafficActionLabel)
  const actionBit = labels.length
    ? `Then ${visit.actionOrder === "random" ? "randomly " : ""}run ${labels.join(", ")}.`
    : "No extra clicks after the dwell."
  return `Stay on the listing for ${visit.dwellSeconds} seconds. ${actionBit} Uses a ${device} visitor profile.`
}

export function trafficScheduleVisitFields(visit: TrafficVisitOptions) {
  return {
    lastDwellSeconds: visit.dwellSeconds,
    lastActionOrder: visit.actionOrder,
    lastActions: visit.actions,
    lastDevice: visit.device,
  }
}
