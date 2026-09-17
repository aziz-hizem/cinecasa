import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, Download, Image as ImageIcon, Pencil,
  RefreshCw, Upload, X,
} from 'lucide-react'
import type { Episode, TmdbEpisodePreview } from '@shared/types'
import LazyImage from './LazyImage'
import { imgSrc } from '@/lib/format'

type Tab = 'metadata' | 'image'

interface Props {
  isOpen: boolean
  episode: Episode
  initialTab?: Tab
  onClose: () => void
  onUpdated: () => void
}

export default function EpisodeMetadataModal({ isOpen, episode, initialTab = 'metadata', onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)

  // Jump to the requested tab each time the modal opens
  useEffect(() => { if (isOpen) setTab(initialTab) }, [isOpen, initialTab])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-card border border-border-subtle rounded-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0">
              <div>
                <p className="text-xs text-text-muted mb-0.5">
                  S{String(episode.seasonNumber).padStart(2, '0')}E{String(episode.episodeNumber).padStart(2, '0')}
                </p>
                <h2 className="text-base font-semibold leading-tight">
                  {episode.title ?? `Episode ${episode.episodeNumber}`}
                </h2>
              </div>
              <button type="button" onClick={onClose} className="btn-ghost !p-1.5 ml-3 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-subtle flex-shrink-0">
              {(['metadata', 'image'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                    tab === t
                      ? 'text-accent border-b-2 border-accent -mb-px'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {t === 'metadata' ? 'Edit Metadata' : 'Edit Image'}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {tab === 'metadata' ? (
                <MetadataTab episode={episode} onUpdated={() => { onUpdated(); onClose() }} />
              ) : (
                <ImageTab episode={episode} onUpdated={() => { onUpdated(); onClose() }} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Metadata tab ─────────────────────────────────────────────────────────────

function MetadataTab({ episode, onUpdated }: { episode: Episode; onUpdated: () => void }) {
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [preview, setPreview] = useState<TmdbEpisodePreview | null>(null)

  // Form fields — pre-filled from episode, overrideable by TMDB fetch
  const [title, setTitle] = useState(episode.title ?? '')
  const [overview, setOverview] = useState(episode.overview ?? '')
  const [airDate, setAirDate] = useState(episode.airDate ?? '')
  const [runtime, setRuntime] = useState(episode.runtime != null ? String(episode.runtime) : '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleFetchTmdb() {
    setFetching(true)
    setFetchError(null)
    setPreview(null)
    const res = await window.api.metadata.fetchEpisode(episode.id)
    setFetching(false)
    if (!res.ok || !res.data) {
      setFetchError(res.error ?? 'Failed to fetch from TMDB')
      return
    }
    const d = res.data
    setPreview(d)
    if (d.title) setTitle(d.title)
    if (d.overview) setOverview(d.overview)
    if (d.airDate) setAirDate(d.airDate)
    if (d.runtime != null) setRuntime(String(d.runtime))
  }

  async function handleSave() {
    setSaving(true)
    const res = await window.api.metadata.updateEpisode({
      episodeId: episode.id,
      title: title.trim() || null,
      overview: overview.trim() || null,
      airDate: airDate.trim() || null,
      runtime: runtime.trim() ? Number(runtime) : null,
      stillPath: preview?.stillPath ?? undefined,
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(onUpdated, 800)
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* TMDB auto-fetch */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleFetchTmdb}
          disabled={fetching}
          className="btn-secondary text-sm flex-1"
        >
          <Download className={`w-4 h-4 ${fetching ? 'animate-pulse' : ''}`} />
          {fetching ? 'Fetching from TMDB…' : 'Auto-fill from TMDB'}
        </button>
        {preview && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Loaded
          </span>
        )}
      </div>
      {fetchError && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-btn">{fetchError}</p>
      )}

      <div className="border-t border-border-subtle" />

      {/* Manual fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Title</label>
          <input
            className="input w-full text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Episode title"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Overview</label>
          <textarea
            className="input w-full text-sm resize-none"
            rows={4}
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="Episode description"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">Air date</label>
            <input
              className="input w-full text-sm"
              value={airDate}
              onChange={(e) => setAirDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-text-muted mb-1">Runtime (min)</label>
            <input
              className="input w-full text-sm"
              type="number"
              min={0}
              value={runtime}
              onChange={(e) => setRuntime(e.target.value)}
              placeholder="42"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || saved}
        className="btn-primary w-full"
      >
        {saved ? (
          <><CheckCircle2 className="w-4 h-4" /> Saved</>
        ) : saving ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
        ) : (
          <><Pencil className="w-4 h-4" /> Save Changes</>
        )}
      </button>
    </div>
  )
}

// ─── Image tab ────────────────────────────────────────────────────────────────

function ImageTab({ episode, onUpdated }: { episode: Episode; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')
  const still = imgSrc(episode.stillPath)

  async function handleUpload() {
    setUploading(true)
    setStatus('idle')
    const res = await window.api.metadata.uploadEpisodeImage(episode.id)
    setUploading(false)
    if (res.ok && res.data) {
      setStatus('ok')
      setMsg('Image updated successfully')
      setTimeout(onUpdated, 1000)
    } else if (res.ok && res.data === null) {
      setStatus('idle') // cancelled
    } else {
      setStatus('err')
      setMsg(res.error ?? 'Upload failed')
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* Preview */}
      <div className="rounded-card overflow-hidden bg-bg border border-border-subtle aspect-video flex items-center justify-center">
        {still ? (
          <LazyImage
            src={still}
            alt={episode.title ?? 'Episode still'}
            className="w-full h-full object-cover"
            fallback={<ImageIcon className="w-8 h-8 text-text-muted" />}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <ImageIcon className="w-10 h-10" />
            <span className="text-xs">No image yet</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="btn-secondary w-full"
      >
        <Upload className="w-4 h-4" />
        {uploading ? 'Uploading…' : 'Upload Image'}
      </button>

      {status !== 'idle' && (
        <p className={`text-sm text-center px-3 py-2 rounded-btn ${
          status === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
        }`}>
          {msg}
        </p>
      )}
    </div>
  )
}
