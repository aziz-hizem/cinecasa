import { spawn, ChildProcess, execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import net from 'node:net'

export interface MpcHcStatus {
  positionMs: number
  durationMs: number
  /** 0 = stopped, 1 = paused, 2 = playing */
  state: 0 | 1 | 2
  filePath: string
}

// ─── Module-level state ───────────────────────────────────────────────────────

let mpcProcess: ChildProcess | null = null
let onExitCb: (() => void) | null = null

/** The 3-second deferred restore from the current/last launch. */
let restoreTimer: ReturnType<typeof setTimeout> | null = null
/** Kept so killMpcHc can fire it synchronously when stopping playback. */
let pendingRestore: (() => void) | null = null

// ─── Port helpers ─────────────────────────────────────────────────────────────

/** Ask the OS for a free ephemeral port then immediately release it. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

// ─── Settings patching (ini or registry) ─────────────────────────────────────

/**
 * MPC-HC can store settings either in an ini file (portable / standard install)
 * or in the registry (common with K-Lite Codec Pack bundles).
 * We try the ini first, then fall back to the registry.
 */

// -- ini -----------------------------------------------------------------------

function findMpcHcIni(mpcHcExePath: string): string | null {
  const exeBase = path.basename(mpcHcExePath, path.extname(mpcHcExePath)) // e.g. 'mpc-hc64'
  const exeDir  = path.dirname(mpcHcExePath)

  // Portable: ini next to the exe — try both '<exe>.ini' and 'mpc-hc.ini'
  for (const name of [`${exeBase}.ini`, 'mpc-hc.ini']) {
    const p = path.join(exeDir, name)
    if (fs.existsSync(p)) return p
  }

  // Standard AppData location — try both 'MPC-HC64' and 'MPC-HC' folders
  const appData = process.env.APPDATA
  if (appData) {
    for (const folder of ['MPC-HC64', 'MPC-HC']) {
      for (const name of [`${exeBase}.ini`, 'mpc-hc.ini']) {
        const p = path.join(appData, folder, name)
        if (fs.existsSync(p)) return p
      }
    }
  }
  return null
}

function applyPortPatch(content: string, port: number): string {
  if (/^WebServerPort=\d+/m.test(content)) {
    return content.replace(/^WebServerPort=\d+/m, `WebServerPort=${port}`)
  }
  if (/^\[Settings\]/m.test(content)) {
    return content.replace(/^(\[Settings\])/m, `$1\nWebServerPort=${port}`)
  }
  return `[Settings]\nWebServerPort=${port}\n\n${content}`
}

// -- registry ------------------------------------------------------------------

/** Registry keys to try, in order of likelihood. */
const REG_KEYS = [
  'HKCU\\Software\\MPC-HC\\MPC-HC\\Settings',
  'HKCU\\Software\\MPC-HC\\MPC-HC64\\Settings',
]

function queryRegistryPort(): { key: string; port: number } | null {
  for (const key of REG_KEYS) {
    try {
      console.error('[mpcHc] checking registry key:', key)
      const out = execSync(`reg query "${key}" /v WebServerPort`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const m = /WebServerPort\s+REG_DWORD\s+(0x[\dA-Fa-f]+|\d+)/i.exec(out)
      if (m) {
        const raw = m[1]
        const port = parseInt(raw, raw.toLowerCase().startsWith('0x') ? 16 : 10)
        console.error(`[mpcHc] found registry port ${port} at ${key}`)
        return { key, port }
      }
    } catch { /* key not found, try next */ }
  }
  return null
}

function writeRegistryPort(key: string, port: number): void {
  execSync(`reg add "${key}" /v WebServerPort /t REG_DWORD /d ${port} /f`, {
    stdio: 'ignore',
  })
}

// -- unified patch/restore -----------------------------------------------------

interface SettingsPatch {
  /** Write the original settings back. Safe to call multiple times. */
  restore(): void
}

/**
 * Patch WebServerPort to `newPort` in whichever storage MPC-HC is using.
 * Returns a SettingsPatch whose restore() reverts the change, or null if
 * neither storage could be found/written.
 */
function patchWebPort(mpcHcPath: string, newPort: number): SettingsPatch | null {
  // ── Try ini ────────────────────────────────────────────────────────────────
  const iniPath = findMpcHcIni(mpcHcPath)
  if (iniPath) {
    try {
      const original = fs.readFileSync(iniPath, 'utf8')
      fs.writeFileSync(iniPath, applyPortPatch(original, newPort), 'utf8')
      console.error(`[mpcHc] ini patched → port ${newPort}`)
      return {
        restore() {
          try {
            fs.writeFileSync(iniPath, original, 'utf8')
            console.error('[mpcHc] ini restored')
          } catch (e) { console.error('[mpcHc] ini restore failed:', e) }
        },
      }
    } catch (e) {
      console.error('[mpcHc] ini patch failed:', e)
    }
  }

  // ── Try registry ───────────────────────────────────────────────────────────
  const reg = queryRegistryPort()
  if (reg) {
    try {
      writeRegistryPort(reg.key, newPort)
      console.error(`[mpcHc] registry patched → port ${newPort}`)
      return {
        restore() {
          try {
            writeRegistryPort(reg.key, reg.port)
            console.error(`[mpcHc] registry restored → port ${reg.port}`)
          } catch (e) { console.error('[mpcHc] registry restore failed:', e) }
        },
      }
    } catch (e) {
      console.error('[mpcHc] registry patch failed:', e)
    }
  }

  console.error('[mpcHc] could not find MPC-HC settings in ini or registry — web tracking will not work')
  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Launch MPC-HC for a specific file and return the web-interface port our
 * instance will use.  Independent MPC-HC windows are never touched.
 *
 * Flow:
 *  1. Find a free OS port.
 *  2. Patch MPC-HC settings (ini or registry) to that port.
 *  3. Spawn with /new (always a separate process).
 *  4. Restore settings after 3 s (MPC-HC reads them in <500 ms).
 *  5. Restore again on process exit (MPC-HC rewrites settings on close).
 */
export async function launchMpcHc(
  filePath: string,
  mpcHcPath: string,
  startMs: number,
  onExit: () => void,
): Promise<number> {
  // killMpcHc runs any pending restore from the previous session so we always
  // patch a clean copy of the settings.
  killMpcHc()

  // ── Find a free port ────────────────────────────────────────────────────────
  let webPort: number
  try {
    webPort = await findFreePort()
  } catch {
    webPort = 13580
  }

  // ── Patch settings ──────────────────────────────────────────────────────────
  const patch = patchWebPort(mpcHcPath, webPort)

  // If patching failed we still spawn — tracking just won't work this session.
  const restore = patch ? () => patch.restore() : () => {}

  pendingRestore = restore
  restoreTimer = setTimeout(() => {
    restoreTimer = null
    pendingRestore = null
    restore()
  }, 3000)

  // ── Spawn ───────────────────────────────────────────────────────────────────
  onExitCb = onExit

  const args = [filePath, '/play', '/fullscreen', '/new']
  if (startMs > 0) args.push('/start', String(startMs))

  mpcProcess = spawn(mpcHcPath, args, { detached: false })

  mpcProcess.on('exit', () => {
    // MPC-HC saves settings on close — restore immediately so our original
    // port survives even if MPC-HC wrote the patched one back.
    if (restoreTimer !== null) { clearTimeout(restoreTimer); restoreTimer = null }
    pendingRestore = null
    restore()

    mpcProcess = null
    const cb = onExitCb
    onExitCb = null
    cb?.()
  })

  mpcProcess.on('error', (err) => {
    if (restoreTimer !== null) { clearTimeout(restoreTimer); restoreTimer = null }
    pendingRestore = null
    restore()
    console.error('[mpcHc] spawn error:', err)
    mpcProcess = null
    const cb = onExitCb
    onExitCb = null
    cb?.()
  })

  return webPort
}

/**
 * Kill the app-spawned MPC-HC process.  Also synchronously fires any pending
 * settings restore so stopping playback never leaves patched settings behind.
 */
export function killMpcHc(): void {
  if (restoreTimer !== null) { clearTimeout(restoreTimer); restoreTimer = null }
  pendingRestore?.()
  pendingRestore = null

  if (mpcProcess) {
    mpcProcess.removeAllListeners()
    try { mpcProcess.kill() } catch { /* already gone */ }
    mpcProcess = null
  }
  onExitCb = null
}

export function isMpcHcRunning(): boolean {
  return mpcProcess !== null
}

export async function pollMpcHc(port: number): Promise<MpcHcStatus | null> {
  try {
    const res = await fetch(`http://localhost:${port}/variables.html`, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const html = await res.text()

    const positionMs = extractNumber(html, 'position')
    const durationMs = extractNumber(html, 'duration')
    const stateRaw   = extractNumber(html, 'state')
    const fileMatch  = /<p id="file">([^<]*)<\/p>/.exec(html)
    const filePath   = fileMatch?.[1]?.trim() ?? ''

    if (positionMs === null || durationMs === null || stateRaw === null) return null

    return { positionMs, durationMs, state: stateRaw as 0 | 1 | 2, filePath }
  } catch {
    return null
  }
}

function extractNumber(html: string, id: string): number | null {
  const m = new RegExp(`<p id="${id}">(\\d+)<\\/p>`).exec(html)
  return m ? Number(m[1]) : null
}
