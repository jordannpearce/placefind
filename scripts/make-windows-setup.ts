import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const unpacked = path.join(root, "release", "win-unpacked")
const exe = path.join(unpacked, "PlaceFind.exe")
const script = path.join(root, "build", "placefind-setup.nsi")
const outFile = path.join(root, "release", "PlaceFind-Setup-1.0.0.exe")

if (!existsSync(exe)) {
  console.error("Windows app is not packaged yet. Expected", exe)
  process.exit(1)
}

const hostedKeys = path.join(root, ".data", "hosted-keys.json")
const resourcesDir = path.join(unpacked, "resources")
if (existsSync(hostedKeys) && existsSync(resourcesDir)) {
  copyFileSync(hostedKeys, path.join(resourcesDir, "hosted-keys.json"))
  console.log("Included hosted API keys in the Windows app.")
} else if (existsSync(hostedKeys)) {
  mkdirSync(resourcesDir, { recursive: true })
  copyFileSync(hostedKeys, path.join(resourcesDir, "hosted-keys.json"))
  console.log("Included hosted API keys in the Windows app.")
}

const icon = path.join(root, "release", ".icon-ico", "icon.ico")
const defines = [`-DAPPDIR=${unpacked}`, `-DOUTFILE=${outFile}`, "-DVERSION=1.0.0"]
if (existsSync(icon)) defines.push(`-DICON=${icon}`)

function hasMakensis() {
  return spawnSync("makensis", ["/VERSION"], { encoding: "utf8" }).status === 0
}

if (!hasMakensis()) {
  if (process.platform === "win32") {
    const fallback = spawnSync("npx", ["electron-builder", "--win", "nsis", "--x64"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
      shell: true,
    })
    if (fallback.stdout) process.stdout.write(fallback.stdout)
    if (fallback.stderr) process.stderr.write(fallback.stderr)
    process.exit(fallback.status ?? 1)
  }
  console.error("Install NSIS (makensis) to create PlaceFind-Setup.exe on this computer.")
  process.exit(1)
}

const result = spawnSync("makensis", [...defines, script], {
  cwd: root,
  encoding: "utf8",
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.status !== 0 || !existsSync(outFile) || statSync(outFile).size < 1_000_000) {
  console.error("makensis failed to create a usable Windows setup file.")
  process.exit(result.status ?? 1)
}

console.log(`Created ${outFile} (${Math.round(statSync(outFile).size / 1024 / 1024)} MB)`)
