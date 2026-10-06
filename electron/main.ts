import { app, BrowserWindow, Menu, nativeImage, protocol, shell, Tray } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from './db/connection'
import { registerLibraryIpc } from './ipc/library'
import { registerMetadataIpc } from './ipc/metadata'
import { registerPlaybackIpc } from './ipc/playback'
import { registerSettingsIpc } from './ipc/settings'
import { registerRemoteIpc } from './ipc/remote'
import { settingsRepo } from './db/queries'
import { getRemoteInfo, startRemoteServer, stopRemoteServer } from './server/httpServer'
import {
  getImageCacheDir,
  ensureCachedKey,
  mimeForFile,
} from './services/imageCache'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

// Register the cinecasa-img:// scheme as privileged so the renderer can load
// cached image files via <img src="cinecasa-img:///w500/abc.jpg">.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cinecasa-img',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** Set once a real quit starts, so closing the window no longer hides to tray. */
let isQuitting = false
/** Launched by "Start with Windows": stay in the tray and just serve the tablet. */
const startHidden = process.argv.includes('--hidden')

// One instance only — a second one would fight over the tablet server's port.
const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())
}

/**
 * The app was previously called HizemTV and stored its data in %AppData%/hizem-tv.
 * On the first launch under the new name, copy the library database and image
 * cache over so nothing is lost. The old folder is left in place as a backup.
 */
function migrateLegacyUserData(appDataDir: string, userDataDir: string): boolean {
  const legacyDir = path.join(appDataDir, 'hizem-tv')
  const legacyDb = path.join(legacyDir, 'data', 'library.db')
  const newDb = path.join(userDataDir, 'data', 'library.db')
  if (!fs.existsSync(legacyDb) || fs.existsSync(newDb)) return false

  for (const sub of ['data', path.join('cache', 'images')]) {
    const from = path.join(legacyDir, sub)
    if (fs.existsSync(from)) {
      fs.cpSync(from, path.join(userDataDir, sub), { recursive: true })
    }
  }
  return true
}

if (migrateLegacyUserData(app.getPath('appData'), app.getPath('userData'))) {
  console.log('Migrated library data from the previous HizemTV folder.')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '../assets/icons/cinecasa.ico'),
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#f5f5f7',
      height: 36,
    },
    autoHideMenuBar: true,
    show: !startHidden,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // With tablet streaming on, closing the window keeps Cinecasa running in the
  // tray so the tablet can still reach the library.
  mainWindow.on('close', (e) => {
    if (isQuitting) return
    const { closeToTray, remoteEnabled } = settingsRepo.getAll()
    if (closeToTray && remoteEnabled) {
      e.preventDefault()
      mainWindow?.hide()
      createTray()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}

function trayIconPath(): string {
  const file = process.platform === 'win32' ? 'cinecasa.ico' : 'cinecasa.png'
  return path.join(process.env.APP_ROOT ?? path.join(__dirname, '..'), 'assets', 'icons', file)
}

function createTray(): void {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
    return
  }
  tray = new Tray(nativeImage.createFromPath(trayIconPath()))
  tray.setToolTip('Cinecasa')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => showMainWindow())
}

function buildTrayMenu(): Menu {
  const info = getRemoteInfo()
  const status = info.running
    ? `Tablet streaming on (port ${info.port})`
    : 'Tablet streaming off'
  return Menu.buildFromTemplate([
    { label: 'Open Cinecasa', click: () => showMainWindow() },
    { label: status, enabled: false },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
}

function registerImageProtocol(): void {
  // Ensure cache dir exists before any request
  getImageCacheDir()

  protocol.handle('cinecasa-img', async (request) => {
    try {
      const u = new URL(request.url)
      // Chromium normalises cinecasa-img:///w500/abc.jpg → cinecasa-img://w500/abc.jpg
      // when the scheme is registered as standard (empty host is collapsed and the
      // first path segment becomes the hostname).  Reconstruct the key from both.
      const host = u.hostname
      const filePart = decodeURIComponent(u.pathname).replace(/^\/+/, '')
      const rel = [host, filePart].filter(Boolean).join('/')
      if (!rel || rel.includes('..')) {
        return new Response(null, { status: 400 })
      }
      const fullPath = await ensureCachedKey(rel)
      if (!fullPath) return new Response(null, { status: 404 })
      const data = await fs.promises.readFile(fullPath)
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeForFile(fullPath),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (e) {
      console.error('cinecasa-img protocol error:', e)
      return new Response(null, { status: 500 })
    }
  })
}

app.whenReady().then(() => {
  if (!hasInstanceLock) return

  // Initialize DB before any IPC handler can be invoked.
  getDb()

  registerImageProtocol()
  registerSettingsIpc()
  registerLibraryIpc()
  registerPlaybackIpc()
  registerMetadataIpc()
  registerRemoteIpc()

  void startRemoteServer().then(() => {
    if (startHidden) createTray()
  })

  createWindow()

  app.on('activate', () => showMainWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb()
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  void stopRemoteServer()
  tray?.destroy()
  tray = null
  closeDb()
})
