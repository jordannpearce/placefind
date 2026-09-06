import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

export type InstallerKind = "setup" | "portable" | "other"

export type InstallerFile = {
  name: string
  size: number
  kind: InstallerKind
  url: string
}

export type InstallerStatus = {
  status: "idle" | "running" | "ok" | "error"
  log: string
  error?: string
  startedAt?: string
  finishedAt?: string
  files: InstallerFile[]
}

const RELEASE = path.resolve(process.cwd(), "release")
const MAX_LOG = 40_000

let child: ChildProcess | null = null
let state: InstallerStatus = {
  status: "idle",
  log: "",
  files: [],
}

export function releaseDir() {
  return RELEASE
}

export function classifyInstaller(name: string): InstallerKind {
  const lower = name.toLowerCase()
  if (lower.endsWith(".exe") && /setup|installer/.test(lower)) return "setup"
  if (lower.endsWith(".exe") && /portable/.test(lower)) return "portable"
  if (lower.endsWith(".exe")) return "setup"
  return "other"
}

export function listInstallers(): InstallerFile[] {
  if (!existsSync(RELEASE)) return []
  return readdirSync(RELEASE)
    .filter((name) => /\.(exe|zip)$/i.test(name) && !name.endsWith(".blockmap"))
    .map((name) => {
      const full = path.join(RELEASE, name)
      const stat = statSync(full)
      return {
        name,
        size: stat.size,
        kind: classifyInstaller(name),
        url: `/api/installer/download/${encodeURIComponent(name)}`,
      }
    })
    .filter((file) => file.size > 0)
    .sort((a, b) => Number(b.kind === "setup") - Number(a.kind === "setup") || b.size - a.size)
}

export function installerPath(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null
  const full = path.join(RELEASE, name)
  if (!existsSync(full) || !statSync(full).isFile()) return null
  return full
}

export function getInstallerStatus(): InstallerStatus {
  return { ...state, files: listInstallers() }
}

function appendLog(chunk: string) {
  state = { ...state, log: (state.log + chunk).slice(-MAX_LOG) }
}

export function startInstallerBuild(): InstallerStatus {
  if (state.status === "running") return getInstallerStatus()

  state = {
    status: "running",
    log: "Creating the Windows setup application…\n",
    startedAt: new Date().toISOString(),
    files: listInstallers(),
  }

  const env = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
    SKIP_NOTARIZATION: "true",
  }

  child = spawn("npm", ["run", "dist:win"], {
    cwd: process.cwd(),
    env,
    shell: true,
  })

  child.stdout?.on("data", (buf: Buffer) => appendLog(buf.toString()))
  child.stderr?.on("data", (buf: Buffer) => appendLog(buf.toString()))
  child.on("error", (error) => {
    state = {
      ...state,
      status: "error",
      finishedAt: new Date().toISOString(),
      error: error.message,
      files: listInstallers(),
    }
    child = null
  })
  child.on("close", (code) => {
    const files = listInstallers()
    const ok = code === 0 && files.some((file) => file.kind === "setup" || file.name.endsWith(".exe"))
    state = {
      ...state,
      status: ok ? "ok" : "error",
      finishedAt: new Date().toISOString(),
      error: ok ? undefined : `Installer build exited with code ${code ?? "unknown"}.`,
      files,
    }
    child = null
  })

  return getInstallerStatus()
}
