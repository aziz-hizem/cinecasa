import { app, BrowserWindow, protocol, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from './db/connection'
import { registerLibraryIpc } from './ipc/library'
import { registerMetadataIpc } from './ipc/metadata'
import { registerPlaybackIpc } from './ipc/playback'
import { registerSettingsIpc } from './ipc/settings'
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
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
  // Initialize DB before any IPC handler can be invoked.
  getDb()

  registerImageProtocol()
  registerSettingsIpc()
  registerLibraryIpc()
  registerPlaybackIpc()
  registerMetadataIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb()
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDb()
})
