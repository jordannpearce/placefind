const { app, BrowserWindow, shell } = require("electron")
const { spawn } = require("node:child_process")
const path = require("node:path")

const PORT = process.env.PORT || "43141"
const APP_URL = `http://127.0.0.1:${PORT}`

let serverProcess = null

function startPackagedServer() {
  if (!app.isPackaged) return
  const serverEntry = path.join(process.resourcesPath, "app.asar.unpacked", "dist-server", "index.js")
  const fallback = path.join(__dirname, "..", "dist-server", "index.js")
  const entry = require("node:fs").existsSync(serverEntry) ? serverEntry : fallback
  serverProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PLACEFIND_STATIC: "1",
      PORT,
    },
    stdio: "inherit",
  })
}

async function waitForServer(retries = 40) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(`${APP_URL}/api/health`)
      if (response.ok) return
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#17140f",
    title: "PlaceFind",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(APP_URL)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })
}

app.whenReady().then(async () => {
  startPackagedServer()
  await waitForServer()
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill()
  if (process.platform !== "darwin") app.quit()
})
