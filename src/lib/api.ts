import type {
  ApiKeys,
  AuthUser,
  Campaign,
  CampaignInput,
  HostedKeyStatus,
  InstallerStatus,
  IssuedLicense,
  KeygenStatus,
  KeyTestResult,
  LicenseStatus,
  MailSendResult,
  MailStatus,
  OrderInfo,
  ProductInfo,
  RuntimeInfo,
  ScanRun,
  GridScanRun,
  GridPoint,
  GeoPoint,
  SearchQuery,
  SearchResponse,
  TrafficJob,
  ScanCompare,
  ScanSchedule,
  TrafficSchedule,
} from "./types.ts"

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || "Request failed.")
  return payload
}

export async function loadRuntime(): Promise<RuntimeInfo> {
  return request<RuntimeInfo>("/api/runtime")
}

export async function searchBusiness(query: SearchQuery, keys: ApiKeys, hideClientKeys = false): Promise<SearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hideClientKeys ? query : { ...query, ...keys }),
  })
  const payload = (await response.json()) as SearchResponse & { error?: string }
  if (!response.ok && !payload.best && !payload.others) {
    throw new Error(payload.error || "Search failed.")
  }
  return payload
}

export async function testKeys(keys: ApiKeys): Promise<KeyTestResult[]> {
  const response = await fetch("/api/test-keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(keys),
  })
  const payload = (await response.json()) as { results?: KeyTestResult[]; error?: string }
  if (!response.ok) throw new Error(payload.error || "Could not test keys.")
  return payload.results ?? []
}

export async function loadStore(): Promise<{
  product: ProductInfo
  installer: InstallerStatus
  hosted: HostedKeyStatus
  keygen: KeygenStatus
  issued: IssuedLicense[]
  license: LicenseStatus
}> {
  const response = await fetch("/api/product", { credentials: "include" })
  if (!response.ok) throw new Error("Could not load product info.")
  return (await response.json()) as {
    product: ProductInfo
    installer: InstallerStatus
    hosted: HostedKeyStatus
    keygen: KeygenStatus
    issued: IssuedLicense[]
    license: LicenseStatus
  }
}

export async function saveKeygen(input: {
  accountId: string
  productId: string
  policyId: string
  token: string
}): Promise<{ keygen: KeygenStatus; installer: InstallerStatus; issued: IssuedLicense[] }> {
  const response = await fetch("/api/keygen", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as {
    keygen?: KeygenStatus
    installer?: InstallerStatus
    issued?: IssuedLicense[]
    error?: string
  }
  if (!response.ok || !payload.keygen || !payload.installer) {
    throw new Error(payload.error || "Could not save Keygen settings.")
  }
  return { keygen: payload.keygen, installer: payload.installer, issued: payload.issued ?? [] }
}

export async function testKeygen(input: {
  accountId: string
  productId: string
  policyId: string
  token: string
}): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/keygen/test", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string }
  if (!response.ok) throw new Error(payload.error || payload.message || "Could not reach Keygen.")
  return { ok: Boolean(payload.ok), message: payload.message || "" }
}

export async function assignLicense(input: { name: string; email: string }): Promise<{
  license: IssuedLicense
  issued: IssuedLicense[]
}> {
  const response = await fetch("/api/keygen/licenses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as { license?: IssuedLicense; issued?: IssuedLicense[]; error?: string }
  if (!response.ok || !payload.license) {
    throw new Error(payload.error || "Could not assign a license.")
  }
  return { license: payload.license, issued: payload.issued ?? [] }
}

export async function activateLicenseKey(key: string): Promise<LicenseStatus> {
  const response = await fetch("/api/license/activate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  })
  const payload = (await response.json()) as { license?: LicenseStatus; error?: string }
  if (!response.ok || !payload.license) {
    throw new Error(payload.error || "Could not activate that key.")
  }
  return payload.license
}

export async function saveHostedKeys(input: {
  scrappeyKey?: string
  dataforseoLogin?: string
  dataforseoPassword?: string
}): Promise<{ hosted: HostedKeyStatus; installer: InstallerStatus }> {
  const response = await fetch("/api/hosted-keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as { hosted?: HostedKeyStatus; installer?: InstallerStatus; error?: string }
  if (!response.ok || !payload.hosted || !payload.installer) {
    throw new Error(payload.error || "Could not save API keys into the installer.")
  }
  return { hosted: payload.hosted, installer: payload.installer }
}

export async function saveProduct(input: Pick<ProductInfo, "price" | "pitch">): Promise<ProductInfo> {
  const response = await fetch("/api/product", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as { product?: ProductInfo; error?: string }
  if (!response.ok || !payload.product) throw new Error(payload.error || "Could not save product info.")
  return payload.product
}

export async function loadInstaller(): Promise<InstallerStatus> {
  const response = await fetch("/api/installer", { credentials: "include" })
  if (!response.ok) throw new Error("Could not load installer status.")
  return (await response.json()) as InstallerStatus
}

export async function startInstallerBuild(): Promise<InstallerStatus> {
  const response = await fetch("/api/installer/build", { method: "POST", credentials: "include" })
  if (!response.ok) throw new Error("Could not start the Windows setup build.")
  return (await response.json()) as InstallerStatus
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export async function signup(input: { name: string; email: string; password: string }): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.user
}

export async function login(input: { email: string; password: string }): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.user
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" })
}

export async function forgotPassword(email: string): Promise<{ message: string; hint?: string }> {
  return request("/api/auth/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(input: { token: string; password: string }): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>("/api/auth/reset", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.user
}

export async function checkoutOrder(): Promise<{ order: OrderInfo; license: IssuedLicense | null; warning?: string }> {
  return request("/api/shop/checkout", { method: "POST" })
}

export async function loadAccount(): Promise<{ user: AuthUser; orders: OrderInfo[]; product: ProductInfo }> {
  return request("/api/account")
}

export async function loadAdmin(): Promise<{
  product: ProductInfo
  keygen: KeygenStatus
  mail: MailStatus
  hosted?: HostedKeyStatus
  shop: { orderCount: number; paidCount: number; pendingCount: number }
  users: AuthUser[]
  orders: OrderInfo[]
  issued: IssuedLicense[]
  outbox: Array<{ id: string; to: string; subject: string; createdAt: string; delivered: boolean; detail: string }>
  mailPresets?: Array<{ type: string; label: string; subject: string; text: string }>
}> {
  return request("/api/admin")
}

export async function listAdminUsers(): Promise<AuthUser[]> {
  const payload = await request<{ users: AuthUser[] }>("/api/admin/users")
  return payload.users
}

export async function createAdminUser(input: {
  name: string
  email: string
  password: string
  role: "customer" | "admin"
}): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.user
}

export async function updateAdminUser(
  id: string,
  input: { name?: string; email?: string; password?: string; role?: "customer" | "admin"; status?: "active" | "suspended" },
): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return payload.user
}

export async function deleteAdminUser(id: string): Promise<void> {
  await request(`/api/admin/users/${id}`, { method: "DELETE" })
}

export async function setAdminUserStatus(id: string, status: "active" | "suspended"): Promise<AuthUser> {
  const path = status === "suspended" ? `/api/admin/users/${id}/suspend` : `/api/admin/users/${id}/unsuspend`
  const payload = await request<{ user: AuthUser }>(path, { method: "POST" })
  return payload.user
}

export async function impersonateAdminUser(id: string): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>(`/api/admin/users/${id}/impersonate`, { method: "POST" })
  return payload.user
}

export async function stopImpersonation(): Promise<AuthUser> {
  const payload = await request<{ user: AuthUser }>("/api/auth/stop-impersonation", { method: "POST" })
  return payload.user
}

export async function adminIssueLicense(input: { name: string; email: string; sendEmail?: boolean }): Promise<{
  license: IssuedLicense
  order: OrderInfo | null
}> {
  return request("/api/admin/licenses", { method: "POST", body: JSON.stringify(input) })
}

export async function saveMail(input: { resendApiKey?: string; fromEmail?: string; fromName?: string }): Promise<MailStatus> {
  const payload = await request<{ mail: MailStatus }>("/api/admin/mail", { method: "POST", body: JSON.stringify(input) })
  return payload.mail
}

export async function testMail(input: { resendApiKey?: string; fromEmail?: string; fromName?: string }): Promise<{
  ok: boolean
  message: string
}> {
  return request("/api/admin/mail/test", { method: "POST", body: JSON.stringify(input) })
}

export async function sendAdminMail(input: {
  type?: string
  subject: string
  text?: string
  html?: string
  userIds?: string[]
  all?: boolean
  includeSuspended?: boolean
}): Promise<MailSendResult> {
  return request("/api/admin/mail/send", { method: "POST", body: JSON.stringify(input) })
}

export async function loadCampaigns(): Promise<{
  campaigns: Campaign[]
  maxKeywords: number
  maxGridSize: number
  allowedGridSizes: number[]
}> {
  const payload = await request<{
    campaigns?: Campaign[]
    maxKeywords?: number
    maxGridSize?: number
    allowedGridSizes?: number[]
  }>("/api/campaigns")
  return {
    campaigns: Array.isArray(payload.campaigns) ? payload.campaigns : [],
    maxKeywords: payload.maxKeywords ?? 20,
    maxGridSize: payload.maxGridSize ?? 7,
    allowedGridSizes: payload.allowedGridSizes ?? [3, 5, 7],
  }
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const payload = await request<{ campaign: Campaign }>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return payload.campaign
}

export async function updateCampaign(id: string, input: CampaignInput): Promise<Campaign> {
  const payload = await request<{ campaign: Campaign }>(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return payload.campaign
}

export async function deleteCampaign(id: string): Promise<void> {
  await request(`/api/campaigns/${id}`, { method: "DELETE" })
}

export async function loadCampaignGrid(
  id: string,
  input?: { gridSize?: number; spacingMiles?: number },
): Promise<{ campaign: Campaign; center: GeoPoint; points: GridPoint[]; gridSize: number; spacingMiles: number }> {
  const query = new URLSearchParams()
  if (input?.gridSize != null) query.set("gridSize", String(input.gridSize))
  if (input?.spacingMiles != null) query.set("spacingMiles", String(input.spacingMiles))
  const suffix = query.size ? `?${query}` : ""
  return request(`/api/campaigns/${id}/grid${suffix}`)
}

export async function geocodePlace(city: string, state: string): Promise<GeoPoint> {
  const query = new URLSearchParams({ city, state })
  const payload = await request<{ center: GeoPoint }>(`/api/geocode?${query}`)
  return payload.center
}

export async function scanCampaign(
  id: string,
  keys: ApiKeys,
  hideClientKeys = false,
  keywords?: string[],
): Promise<{ campaign: Campaign; scan: ScanRun; grid?: GridScanRun }> {
  return request(`/api/campaigns/${id}/scan`, {
    method: "POST",
    body: JSON.stringify(hideClientKeys ? { keywords } : { keywords, ...keys }),
  })
}

export async function loadCampaignScans(id: string): Promise<{ scans: GridScanRun[] }> {
  const payload = await request<{ scans?: GridScanRun[] }>(`/api/campaigns/${id}/scans`)
  return { scans: Array.isArray(payload.scans) ? payload.scans : [] }
}

export async function rerunCampaignScan(
  id: string,
  keys: ApiKeys,
  hideClientKeys = false,
  keywords?: string[],
): Promise<{ campaign: Campaign; scan: ScanRun; grid?: GridScanRun }> {
  return request(`/api/campaigns/${id}/scans`, {
    method: "POST",
    body: JSON.stringify(hideClientKeys ? { keywords } : { keywords, ...keys }),
  })
}

export async function compareCampaignScans(id: string, previousId: string, currentId: string): Promise<ScanCompare> {
  const payload = await request<{ compare: ScanCompare }>(`/api/campaigns/${id}/scans/${previousId}/compare/${currentId}`)
  return payload.compare
}

export async function updateCampaignSchedule(
  id: string,
  input: { scanSchedule?: ScanSchedule | null; trafficSchedule?: TrafficSchedule | null },
): Promise<Campaign> {
  return updateCampaign(id, input)
}

export async function startCampaignTraffic(
  id: string,
  keys: ApiKeys,
  hideClientKeys = false,
  pinIds?: string[],
): Promise<{ campaign: Campaign; traffic: TrafficJob }> {
  return request(`/api/campaigns/${id}/traffic`, {
    method: "POST",
    body: JSON.stringify(hideClientKeys ? { pinIds } : { pinIds, ...keys }),
  })
}

export async function stopCampaignTraffic(id: string): Promise<{ campaign: Campaign; traffic: TrafficJob }> {
  return request(`/api/campaigns/${id}/traffic/stop`, { method: "POST", body: JSON.stringify({}) })
}

export async function loadCampaignTraffic(id: string): Promise<{ campaign: Campaign; traffic: TrafficJob | null }> {
  return request(`/api/campaigns/${id}/traffic`)
}
