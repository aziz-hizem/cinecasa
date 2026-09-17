import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Folder,
  Trash2,
  KeyRound,
  Film,
  Tv,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  RefreshCw,
  FolderOpen,
  Eraser,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type {
  AppSettings,
  LibraryRoot,
  LibraryRootType,
  ScanMode,
  ScanProgressEvent,
  ScanResult,
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { SPECIALS, getSpecial, type SpecialDef } from '@/lib/specials'

type Status = { kind: 'idle' } | { kind: 'ok'; msg: string } | { kind: 'err'; msg: string }

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [clearing, setClearing] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgressEvent | null>(null)
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [mpcConnected, setMpcConnected] = useState<boolean | null>(null)
  const [testingMpc, setTestingMpc] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)
  const [scanMenuId, setScanMenuId] = useState<number | null>(null)
  const scanMenuCloseRef = useRef<number | null>(null)
  const [specialMenuOpen, setSpecialMenuOpen] = useState(false)
  const specialMenuCloseRef = useRef<number | null>(null)

  useEffect(() => {
    void reload()
  }, [])

  async function reload() {
    try {
      setLoading(true)
      console.log('Loading settings...')
      const [s, r] = await Promise.all([
        window.api.settings.getAll(),
        window.api.libraryRoots.list(),
      ])
      console.log('Settings loaded:', s, r)
      if (s.ok && s.data) setSettings(s.data)
      if (r.ok && r.data) setRoots(r.data)
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  function flash(s: Status) {
    setStatus(s)
    if (s.kind !== 'idle') {
      window.setTimeout(() => setStatus({ kind: 'idle' }), 2500)
    }
  }

  async function handleSave() {
    setSaving(true)
    const entries: [keyof AppSettings, string | number][] = [
      ['tmdbApiKey', settings.tmdbApiKey],
      ['mpcHcPath', settings.mpcHcPath],
      ['mpcHcPort', settings.mpcHcPort],
      ['pollingIntervalMs', settings.pollingIntervalMs],
      ['themeAccent', settings.themeAccent],
    ]
    for (const [k, v] of entries) {
      const res = await window.api.settings.set(k, v)
      if (!res.ok) {
        flash({ kind: 'err', msg: res.error ?? 'Failed to save settings' })
        setSaving(false)
        return
      }
    }
    setSaving(false)
    flash({ kind: 'ok', msg: 'Settings saved.' })
  }

  async function handleAddRoot(type: LibraryRootType) {
    const picked = await window.api.settings.browseFolder()
    if (!picked.ok || !picked.data) return
    const created = await window.api.libraryRoots.add(picked.data, type)
    if (!created.ok) {
      flash({ kind: 'err', msg: created.error ?? 'Could not add folder' })
      return
    }
    if (created.data) setRoots((cur) => [...cur, created.data!])
    flash({ kind: 'ok', msg: `${type === 'movies' ? 'Movies' : 'TV Shows'} folder added.` })
  }

  /**
   * Register a folder as a special. Movie-based specials (Marvel, Spider-Man,
   * Pirates) go through the normal movies scan pipeline — the specialKind tag
   * is only what lets the Specials tab pick them out again.
   */
  async function handleAddSpecial(def: SpecialDef) {
    const picked = await window.api.settings.browseFolder()
    if (!picked.ok || !picked.data) return
    const created = await window.api.libraryRoots.addSpecial(
      picked.data,
      def.rootType === 'movies' ? 'movies' : 'tv',
      def.kind
    )
    if (!created.ok) {
      flash({ kind: 'err', msg: created.error ?? `Could not add ${def.name} folder` })
      return
    }
    if (created.data) setRoots((cur) => [...cur, created.data!])
    flash({ kind: 'ok', msg: `${def.name} folder added.` })
  }

  async function handleClearLibrary() {
    if (!window.confirm('Delete all movies, shows, seasons, and episodes from the library? This cannot be undone. Library folders and settings are kept.')) return
    setClearing(true)
    const res = await window.api.library.clearLibrary()
    setClearing(false)
    if (!res.ok) {
      flash({ kind: 'err', msg: res.error ?? 'Clear failed' })
      return
    }
    setLastScanResult(null)
    flash({ kind: 'ok', msg: 'Library cleared. Run a scan to rebuild.' })
  }

  async function handleRemoveRoot(id: number) {
    const res = await window.api.libraryRoots.remove(id)
    if (!res.ok) {
      flash({ kind: 'err', msg: res.error ?? 'Could not remove folder' })
      return
    }
    setRoots((cur) => cur.filter((r) => r.id !== id))
  }

  async function handleBrowseMpc() {
    const res = await window.api.settings.browseFile([
      { name: 'Executable', extensions: ['exe'] },
    ])
    if (res.ok && res.data) {
      setSettings((s) => ({ ...s, mpcHcPath: res.data! }))
    }
  }

  async function handleTestMpcConnection() {
    setTestingMpc(true)
    setMpcConnected(null)
    const res = await window.api.playback.testConnection(settings.mpcHcPort)
    setMpcConnected(res.ok ? (res.data ?? false) : false)
    setTestingMpc(false)
  }

  async function handleOpenDataDir() {
    const res = await window.api.settings.openDataDir()
    if (!res.ok) flash({ kind: 'err', msg: res.error ?? 'Could not open data folder' })
  }

  async function handleOpenCacheDir() {
    const res = await window.api.settings.openCacheDir()
    if (!res.ok) flash({ kind: 'err', msg: res.error ?? 'Could not open cache folder' })
  }

  async function handleClearCache() {
    if (!window.confirm('Delete all cached images? They will be re-downloaded as needed.')) return
    const res = await window.api.settings.clearCache()
    if (!res.ok) {
      flash({ kind: 'err', msg: res.error ?? 'Clear cache failed' })
      return
    }
    flash({ kind: 'ok', msg: 'Image cache cleared.' })
  }

  async function handleScan() {
    if (scanning) return
    setScanning(true)
    setLastScanResult(null)
    setScanProgress({ stage: 'starting' })

    // Subscribe to progress events
    if (unsubRef.current) unsubRef.current()
    unsubRef.current = window.api.library.onScanProgress((e) => {
      setScanProgress(e)
    })

    const res = await window.api.library.scan()

    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
    setScanning(false)

    if (!res.ok) {
      flash({ kind: 'err', msg: res.error ?? 'Scan failed' })
      setScanProgress(null)
      return
    }
    if (res.data) {
      setLastScanResult(res.data)
      const total =
        res.data.moviesAdded +
        res.data.moviesUpdated +
        res.data.episodesAdded +
        res.data.episodesUpdated
      flash({ kind: 'ok', msg: `Scan complete — ${total} items processed.` })
    }
  }

  async function handleScanRoot(rootId: number, mode: ScanMode) {
    if (scanning) return
    setScanning(true)
    setLastScanResult(null)
    setScanProgress({ stage: 'starting' })

    if (unsubRef.current) unsubRef.current()
    unsubRef.current = window.api.library.onScanProgress((e) => {
      setScanProgress(e)
    })

    const res = await window.api.library.scanRoot(rootId, mode)

    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
    setScanning(false)

    if (!res.ok) {
      flash({ kind: 'err', msg: res.error ?? 'Scan failed' })
      setScanProgress(null)
      return
    }
    if (res.data) {
      setLastScanResult(res.data)
      const total =
        res.data.moviesAdded +
        res.data.moviesUpdated +
        res.data.episodesAdded +
        res.data.episodesUpdated
      flash({ kind: 'ok', msg: `Scan complete — ${total} items processed.` })
    }
  }

  function openScanMenu(id: number) {
    if (scanMenuCloseRef.current) {
      window.clearTimeout(scanMenuCloseRef.current)
      scanMenuCloseRef.current = null
    }
    setScanMenuId(id)
  }

  function scheduleCloseScanMenu(id: number) {
    if (scanMenuCloseRef.current) window.clearTimeout(scanMenuCloseRef.current)
    scanMenuCloseRef.current = window.setTimeout(() => {
      setScanMenuId((cur) => (cur === id ? null : cur))
      scanMenuCloseRef.current = null
    }, 120)
  }

  function openSpecialMenu() {
    if (specialMenuCloseRef.current) {
      window.clearTimeout(specialMenuCloseRef.current)
      specialMenuCloseRef.current = null
    }
    setSpecialMenuOpen(true)
  }

  function scheduleCloseSpecialMenu() {
    if (specialMenuCloseRef.current) window.clearTimeout(specialMenuCloseRef.current)
    specialMenuCloseRef.current = window.setTimeout(() => {
      setSpecialMenuOpen(false)
      specialMenuCloseRef.current = null
    }, 140)
  }

  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [])

  if (loading) {
    return (
      <div className="px-8 py-10 max-w-3xl mx-auto">
        <div className="card p-6 animate-pulse text-text-muted">Loading settings…</div>
      </div>
    )
  }

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">
          Configure your library, TMDB, and MPC-HC.
        </p>
      </header>

      {/* Library roots */}
      <Section
        title="Library Roots"
        description="Folders Cinecasa will scan for movies and TV shows."
      >
        <div className="space-y-2 mb-4">
          {roots.length === 0 && (
            <div className="text-sm text-text-muted italic">
              No library folders yet. Add one below.
            </div>
          )}
          {roots.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-3 py-2 rounded-btn bg-bg border border-border-subtle"
              style={
                getSpecial(r.specialKind)
                  ? {
                      borderColor: `rgba(${getSpecial(r.specialKind)!.glow},0.4)`,
                      backgroundColor: `rgba(${getSpecial(r.specialKind)!.glow},0.05)`,
                    }
                  : undefined
              }
            >
              {r.type === 'movies' ? (
                <Film className="w-4 h-4 text-text-secondary flex-shrink-0" />
              ) : (
                <Tv className="w-4 h-4 text-text-secondary flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.path}</div>
                <div className="text-xs text-text-muted capitalize">
                  {r.type}
                  {getSpecial(r.specialKind) && (
                    <span
                      className="ml-2 font-medium"
                      style={{ color: `rgb(${getSpecial(r.specialKind)!.glow})` }}
                    >
                      Special · {getSpecial(r.specialKind)!.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <button
                  onMouseEnter={() => openScanMenu(r.id)}
                  onMouseLeave={() => scheduleCloseScanMenu(r.id)}
                  onClick={() => setScanMenuId((cur) => (cur === r.id ? null : r.id))}
                  className="btn-ghost !p-2 text-text-muted hover:text-text-primary"
                  title="Scan this folder"
                  disabled={scanning}
                >
                  <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                </button>
                {scanMenuId === r.id && !scanning && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-btn bg-bg-card border border-border-subtle shadow-xl overflow-hidden z-10"
                    onMouseEnter={() => openScanMenu(r.id)}
                    onMouseLeave={() => scheduleCloseScanMenu(r.id)}
                  >
                    <button
                      onClick={() => { setScanMenuId(null); void handleScanRoot(r.id, 'full') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-bg-hover/60 transition-colors"
                    >
                      Rescan everything
                    </button>
                    <button
                      onClick={() => { setScanMenuId(null); void handleScanRoot(r.id, 'new') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-bg-hover/60 transition-colors"
                    >
                      Scan only new files
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemoveRoot(r.id)}
                className="btn-ghost !p-2 text-text-muted hover:text-accent"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => handleAddRoot('movies')} className="btn-secondary">
            <Film className="w-4 h-4" />
            Add Movies Folder…
          </button>
          <button onClick={() => handleAddRoot('tv')} className="btn-secondary">
            <Tv className="w-4 h-4" />
            Add TV Shows Folder…
          </button>
          <div className="relative">
            <button
              onMouseEnter={openSpecialMenu}
              onMouseLeave={scheduleCloseSpecialMenu}
              onClick={() => setSpecialMenuOpen((v) => !v)}
              className="btn-secondary border-amber-400/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
            >
              <Sparkles className="w-4 h-4" />
              Add Specials
            </button>
            {specialMenuOpen && (
              <div
                className="absolute left-0 mt-2 w-52 rounded-btn bg-bg-card border border-border-subtle shadow-xl overflow-hidden z-10"
                onMouseEnter={openSpecialMenu}
                onMouseLeave={scheduleCloseSpecialMenu}
              >
                {/* Auto-detected franchises (Spider-Man, …) find their titles
                    anywhere in the library, so there's no folder to register. */}
                {SPECIALS.filter((d) => d.detection === 'folder').map((def) => (
                  <button
                    key={def.kind}
                    onClick={() => { setSpecialMenuOpen(false); void handleAddSpecial(def) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-bg-hover/60 transition-colors"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `rgb(${def.glow})` }}
                    />
                    <span className="truncate">{def.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Storage */}
      <Section
        title="Storage"
        description="Manage app data (database) and cached images."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleOpenDataDir} className="btn-secondary">
            <FolderOpen className="w-4 h-4" />
            Open App Data Folder
          </button>
          <button onClick={handleOpenCacheDir} className="btn-secondary">
            <FolderOpen className="w-4 h-4" />
            Open Image Cache
          </button>
          <button onClick={handleClearCache} className="btn-ghost text-red-400 hover:text-red-300">
            <Eraser className="w-4 h-4" />
            Clear Image Cache
          </button>
        </div>
      </Section>

      {/* Scan */}
      <Section
        title="Scan Library"
        description="Walk all library roots, parse filenames, and fetch TMDB metadata + images."
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleScan}
            disabled={scanning || roots.length === 0}
            className="btn-primary"
          >
            <RefreshCw
              className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`}
            />
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>
          <button
            onClick={handleClearLibrary}
            disabled={scanning || clearing}
            className="btn-ghost text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
            {clearing ? 'Clearing…' : 'Clear Library Data'}
          </button>
          {roots.length === 0 && (
            <span className="text-sm text-text-muted">
              Add a library folder first.
            </span>
          )}
        </div>

        {scanProgress && (
          <ScanProgressView event={scanProgress} />
        )}

        {lastScanResult && (
          <ScanResultView result={lastScanResult} />
        )}
      </Section>

      {/* TMDB */}
      <Section
        title="TMDB API"
        description={
          <>
            Get a free API key from{' '}
            <span className="text-text-primary">themoviedb.org/settings/api</span>.
          </>
        }
      >
        <Field label="API Key" icon={<KeyRound className="w-4 h-4" />}>
          <input
            type="password"
            className="input"
            placeholder="Paste your TMDB v3 API key"
            value={settings.tmdbApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, tmdbApiKey: e.target.value }))}
            autoComplete="off"
          />
        </Field>
      </Section>

      {/* MPC-HC */}
      <Section
        title="MPC-HC"
        description="Path to mpc-hc64.exe and the web interface port (View → Options → Player → Web Interface)."
      >
        <Field label="Executable Path" icon={<Folder className="w-4 h-4" />}>
          <div className="flex gap-2">
            <input
              type="text"
              className="input"
              title="MPC-HC executable path"
              value={settings.mpcHcPath}
              onChange={(e) =>
                setSettings((s) => ({ ...s, mpcHcPath: e.target.value }))
              }
            />
            <button onClick={handleBrowseMpc} className="btn-secondary flex-shrink-0">
              <FileSearch className="w-4 h-4" />
              Browse…
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Web Interface Port">
            <input
              type="number"
              className="input"
              title="MPC-HC web interface port"
              value={settings.mpcHcPort}
              min={1}
              max={65535}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  mpcHcPort: Number(e.target.value) || 13579,
                }))
              }
            />
          </Field>
          <Field label="Polling Interval (ms)">
            <input
              type="number"
              className="input"
              title="Polling interval in milliseconds"
              value={settings.pollingIntervalMs}
              min={1000}
              step={500}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  pollingIntervalMs: Number(e.target.value) || 5000,
                }))
              }
            />
          </Field>
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={handleTestMpcConnection}
            disabled={testingMpc}
            className="btn-secondary text-sm"
          >
            <Wifi className="w-4 h-4" />
            {testingMpc ? 'Testing…' : 'Test Web Interface Connection'}
          </button>
          {mpcConnected === true && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Wifi className="w-4 h-4" />
              Connected
            </span>
          )}
          {mpcConnected === false && (
            <span className="flex items-center gap-1.5 text-sm text-red-400">
              <WifiOff className="w-4 h-4" />
              Not reachable — make sure MPC-HC is open and its web interface is enabled
            </span>
          )}
        </div>
      </Section>

      {/* Theme */}
      <Section title="Theme" description="Accent color used for buttons and highlights.">
        <Field label="Accent Color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              title="Accent color"
              value={settings.themeAccent}
              onChange={(e) =>
                setSettings((s) => ({ ...s, themeAccent: e.target.value }))
              }
              className="w-10 h-10 rounded-btn bg-bg border border-border-subtle cursor-pointer"
            />
            <input
              type="text"
              className="input"
              title="Accent color hex"
              value={settings.themeAccent}
              onChange={(e) =>
                setSettings((s) => ({ ...s, themeAccent: e.target.value }))
              }
            />
          </div>
        </Field>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-8 px-8 py-4 mt-8 bg-gradient-to-t from-bg via-bg to-bg/0 backdrop-blur-sm flex items-center justify-end gap-3">
        <StatusPill status={status} />
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card p-6 mb-5">
      <h2 className="text-base font-semibold mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-text-secondary mb-4">{description}</p>
      )}
      {children}
    </section>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
        {icon}
        {label}
      </span>
      {children}
    </label>
  )
}

function StatusPill({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  const ok = status.kind === 'ok'
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-btn ${
        ok ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertCircle className="w-4 h-4" />
      )}
      {status.msg}
    </motion.div>
  )
}

function ScanProgressView({ event }: { event: ScanProgressEvent }) {
  let label = 'Working…'
  let pct: number | null = null

  if (event.stage === 'starting') label = 'Starting…'
  else if (event.stage === 'scanning') label = `Scanning ${event.rootPath}`
  else if (event.stage === 'fetching') {
    label = event.label
    pct = Math.round((event.current / Math.max(event.total, 1)) * 100)
  } else if (event.stage === 'done') {
    label = 'Complete'
    pct = 100
  }
  else if (event.stage === 'error') label = `Error: ${event.error}`

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-secondary truncate">{label}</span>
        {pct !== null && (
          <span className="text-xs text-text-muted tabular-nums">{pct}%</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
        <progress
          className="scan-progress"
          value={pct ?? 20}
          max={100}
          aria-label="Scan progress"
        />
      </div>
    </div>
  )
}

function ScanResultView({ result }: { result: ScanResult }) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Stat label="Movies added" value={result.moviesAdded} />
        <Stat label="Movies updated" value={result.moviesUpdated} />
        <Stat label="Shows added" value={result.showsAdded} />
        <Stat label="Shows updated" value={result.showsUpdated} />
        <Stat label="Episodes added" value={result.episodesAdded} />
        <Stat label="Episodes updated" value={result.episodesUpdated} />
      </div>

      {result.unmatched.length > 0 && (
        <div className="mt-3 rounded-btn bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <div className="text-xs font-semibold text-amber-300 mb-1">
            Unmatched items ({result.unmatched.length})
          </div>
          <ul className="text-xs text-amber-200/90 space-y-1 break-words">
            {result.unmatched.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="mt-2 rounded-btn bg-red-500/10 border border-red-500/20 px-3 py-2">
          <div className="text-xs font-semibold text-red-300 mb-1">
            Errors ({result.errors.length})
          </div>
          <ul className="text-xs text-red-200/90 space-y-1 break-words">
            {result.errors.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-btn bg-bg border border-border-subtle px-3 py-2">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  )
}
