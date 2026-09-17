import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Check,
  Image,
  Lock,
  RefreshCw,
  Search,
  Star,
  Unlock,
  Upload,
  X,
} from 'lucide-react'
import type {
  ApplyOverrideParams,
  ImageKind,
  MetadataSearchResult,
  SelectImageParams,
  TmdbImageOption,
  UploadImageParams,
} from '@shared/types'

/** Base URL for TMDB image CDN — used for preview thumbnails only. */
const TMDB = 'https://image.tmdb.org/t/p'

type Tab = 'match' | 'images'

export interface MetadataModalProps {
  isOpen: boolean
  itemType: 'movie' | 'show'
  itemId: number
  currentTitle: string
  currentTmdbId: number | null
  metadataLocked: boolean
  onClose: () => void
  /** Called whenever the DB record is changed so the caller can refetch. */
  onUpdated: () => void
}

export default function MetadataModal(props: MetadataModalProps) {
  if (!props.isOpen) return null
  return createPortal(<ModalInner {...props} />, document.body)
}

function ModalInner({
  itemType,
  itemId,
  currentTitle,
  currentTmdbId,
  metadataLocked,
  onClose,
  onUpdated,
}: MetadataModalProps) {
  const [tab, setTab] = useState<Tab>('match')

  // ── Match tab ──────────────────────────────────────────────────────────────
  const [query, setQuery] = useState(currentTitle)
  const [year, setYear] = useState('')
  const [imdbId, setImdbId] = useState('')
  const [results, setResults] = useState<MetadataSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(currentTmdbId)
  const [lockAfterMatch, setLockAfterMatch] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applyStatus, setApplyStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [applyError, setApplyError] = useState('')

  // ── Images tab ─────────────────────────────────────────────────────────────
  const [images, setImages] = useState<TmdbImageOption[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [applyingImg, setApplyingImg] = useState<string | null>(null)
  const [uploadingKind, setUploadingKind] = useState<ImageKind | null>(null)

  // ── Lock state (tracks the live DB value) ─────────────────────────────────
  const [locked, setLocked] = useState(metadataLocked)

  const queryRef = useRef<HTMLInputElement>(null)

  // Focus the search box on open
  useEffect(() => {
    setTimeout(() => queryRef.current?.focus(), 50)
  }, [])

  // Load images when switching to the Images tab
  useEffect(() => {
    if (tab === 'images' && selectedId && images.length === 0 && !imagesLoading) {
      void loadImages(selectedId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!query.trim() && !imdbId.trim()) return
    setSearching(true)
    setResults([])
    const mediaType = itemType === 'show' ? 'tv' : 'movie'
    const res = await window.api.metadata.search(
      query.trim(),
      year ? Number(year) : null,
      mediaType,
      imdbId.trim() || null
    )
    setSearching(false)
    if (res.ok && res.data) setResults(res.data)
  }

  async function loadImages(tmdbId: number) {
    setImagesLoading(true)
    const mediaType = itemType === 'show' ? 'tv' : 'movie'
    const res = await window.api.metadata.getImages(tmdbId, mediaType)
    setImagesLoading(false)
    if (res.ok && res.data) setImages(res.data)
  }

  async function handleApplyMatch() {
    if (!selectedId) return
    setApplying(true)
    setApplyStatus('idle')
    const params: ApplyOverrideParams = {
      itemType,
      itemId,
      tmdbId: selectedId,
      lock: lockAfterMatch,
    }
    const res = await window.api.metadata.applyOverride(params)
    setApplying(false)
    if (res.ok) {
      setLocked(lockAfterMatch)
      setApplyStatus('ok')
      setImages([]) // reset so Images tab refetches with new TMDB ID
      onUpdated()
    } else {
      setApplyStatus('err')
      setApplyError(res.error ?? 'Unknown error')
    }
  }

  async function handleResetLock() {
    await window.api.metadata.setLocked(itemType, itemId, false)
    setLocked(false)
    onUpdated()
  }

  async function handleSelectImage(img: TmdbImageOption) {
    setApplyingImg(img.filePath)
    const params: SelectImageParams = {
      itemType,
      itemId,
      imageKind: img.kind,
      filePath: img.filePath,
      size: img.kind === 'backdrop' ? 'w1280' : 'w500',
    }
    const res = await window.api.metadata.selectImage(params)
    setApplyingImg(null)
    if (res.ok) onUpdated()
  }

  async function handleUploadImage(imageKind: ImageKind) {
    setUploadingKind(imageKind)
    const params: UploadImageParams = { itemType, itemId, imageKind }
    const res = await window.api.metadata.uploadImage(params)
    setUploadingKind(null)
    if (res.ok && res.data) onUpdated()
  }

  const posters = images.filter((i) => i.kind === 'poster')
  const backdrops = images.filter((i) => i.kind === 'backdrop')
  const logos = images.filter((i) => i.kind === 'logo')

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle flex-shrink-0">
          {locked
            ? <Lock className="w-4 h-4 text-accent flex-shrink-0" />
            : <Unlock className="w-4 h-4 text-text-muted flex-shrink-0" />
          }
          <span className="font-semibold flex-1 truncate">
            Edit Metadata
            <span className="font-normal text-text-muted text-sm ml-2 truncate">
              {currentTitle}
            </span>
          </span>
          {locked && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 flex-shrink-0">
              Locked
            </span>
          )}
          <button
            onClick={onClose}
            className="btn-ghost !p-1.5 flex-shrink-0 ml-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-border-subtle flex-shrink-0">
          {(['match', 'images'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {t === 'match' ? 'Match' : 'Images'}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MATCH TAB ── */}
          {tab === 'match' && (
            <div className="p-5 space-y-4">
              {/* Search bar */}
              <div className="flex gap-2 flex-wrap">
                <input
                  ref={queryRef}
                  type="text"
                  className="input flex-1 min-w-[220px]"
                  placeholder="Search TMDB…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                />
                <input
                  type="number"
                  className="input w-24 tabular-nums"
                  placeholder="Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                />
                <input
                  type="text"
                  className="input w-44"
                  placeholder="IMDb ID (tt...)"
                  value={imdbId}
                  onChange={(e) => setImdbId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || (!query.trim() && !imdbId.trim())}
                  className="btn-secondary flex-shrink-0"
                >
                  <Search className={`w-4 h-4 ${searching ? 'animate-pulse' : ''}`} />
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto rounded-card border border-border-subtle">
                  {results.map((r) => (
                    <button
                      key={r.tmdbId}
                      onClick={() => {
                        setSelectedId(r.tmdbId)
                        setApplyStatus('idle')
                        setImages([]) // let Images tab refresh if user switches
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-hover/50 ${
                        selectedId === r.tmdbId ? 'bg-accent/10 border-l-2 border-accent' : ''
                      }`}
                    >
                      <div className="w-9 h-12 flex-shrink-0 rounded overflow-hidden bg-bg">
                        {r.posterPath ? (
                          <img
                            src={`${TMDB}/w92${r.posterPath}`}
                            alt={r.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted">
                            <Image className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.title}</div>
                        <div className="text-xs text-text-muted flex items-center gap-2">
                          {r.year && <span>{r.year}</span>}
                          {r.rating != null && r.rating > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              {r.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {r.overview && (
                          <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                            {r.overview}
                          </p>
                        )}
                      </div>
                      {selectedId === r.tmdbId && (
                        <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Apply section */}
              <div className="pt-2 border-t border-border-subtle space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <input
                    type="checkbox"
                    className="accent-accent w-4 h-4"
                    checked={lockAfterMatch}
                    onChange={(e) => setLockAfterMatch(e.target.checked)}
                  />
                  Lock metadata after applying (scans won't overwrite)
                </label>

                {applyStatus === 'ok' && (
                  <p className="text-sm text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Applied successfully.
                  </p>
                )}
                {applyStatus === 'err' && (
                  <p className="text-sm text-red-400">{applyError}</p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleApplyMatch}
                    disabled={!selectedId || applying}
                    className="btn-primary"
                  >
                    <RefreshCw className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} />
                    {applying ? 'Applying…' : 'Apply Match'}
                  </button>

                  {locked && (
                    <button
                      onClick={handleResetLock}
                      className="btn-ghost text-text-muted hover:text-red-400 text-sm"
                    >
                      <Unlock className="w-4 h-4" />
                      Reset to auto (unlock)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── IMAGES TAB ── */}
          {tab === 'images' && (
            <div className="p-5 space-y-6">
              {!selectedId && (
                <p className="text-sm text-text-muted">
                  Apply a TMDB match first (Match tab) to browse images.
                </p>
              )}

              {selectedId && imagesLoading && (
                <div className="flex items-center gap-2 text-sm text-text-muted py-6 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading images…
                </div>
              )}

              {selectedId && !imagesLoading && images.length === 0 && (
                <p className="text-sm text-text-muted">No images found.</p>
              )}

              {posters.length > 0 && (
                <ImageSection
                  title="Posters"
                  images={posters}
                  thumbSize="w185"
                  thumbClass="w-24 aspect-[2/3]"
                  applyingImg={applyingImg}
                  uploadingKind={uploadingKind}
                  imageKind="poster"
                  onSelect={handleSelectImage}
                  onUpload={handleUploadImage}
                />
              )}
              {backdrops.length > 0 && (
                <ImageSection
                  title="Backdrops"
                  images={backdrops}
                  thumbSize="w300"
                  thumbClass="w-44 aspect-video"
                  applyingImg={applyingImg}
                  uploadingKind={uploadingKind}
                  imageKind="backdrop"
                  onSelect={handleSelectImage}
                  onUpload={handleUploadImage}
                />
              )}
              {logos.length > 0 && (
                <ImageSection
                  title="Logos"
                  images={logos}
                  thumbSize="w300"
                  thumbClass="w-44 aspect-video"
                  applyingImg={applyingImg}
                  uploadingKind={uploadingKind}
                  imageKind="logo"
                  onSelect={handleSelectImage}
                  onUpload={handleUploadImage}
                />
              )}

              {/* Upload buttons when no TMDB images */}
              {selectedId && !imagesLoading && (
                <div className="pt-2 border-t border-border-subtle">
                  <p className="text-xs text-text-muted mb-3">Upload custom images from disk</p>
                  <div className="flex flex-wrap gap-2">
                    {(['poster', 'backdrop', 'logo'] as ImageKind[]).map((kind) => (
                      <button
                        key={kind}
                        onClick={() => handleUploadImage(kind)}
                        disabled={uploadingKind !== null}
                        className="btn-secondary text-sm capitalize"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingKind === kind ? 'Picking…' : `Upload ${kind}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Image section component ──────────────────────────────────────────────────

interface ImageSectionProps {
  title: string
  images: TmdbImageOption[]
  thumbSize: string
  thumbClass: string
  applyingImg: string | null
  uploadingKind: ImageKind | null
  imageKind: ImageKind
  onSelect: (img: TmdbImageOption) => void
  onUpload: (kind: ImageKind) => void
}

function ImageSection({
  title,
  images,
  thumbSize,
  thumbClass,
  applyingImg,
  uploadingKind,
  imageKind,
  onSelect,
  onUpload,
}: ImageSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-text-muted font-medium">
          {title}
        </h3>
        <button
          onClick={() => onUpload(imageKind)}
          disabled={uploadingKind !== null}
          className="btn-ghost text-xs flex items-center gap-1 !py-1"
        >
          <Upload className="w-3 h-3" />
          {uploadingKind === imageKind ? 'Picking…' : 'Upload local…'}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((img) => {
          const busy = applyingImg === img.filePath
          return (
            <button
              key={img.filePath}
              onClick={() => onSelect(img)}
              disabled={applyingImg !== null}
              title={`${img.width}×${img.height}`}
              className={`flex-shrink-0 ${thumbClass} rounded-md overflow-hidden border-2 transition-all hover:border-accent focus:border-accent ${
                busy ? 'border-accent opacity-60 animate-pulse' : 'border-transparent'
              }`}
            >
              <img
                src={`${TMDB}/${thumbSize}${img.filePath}`}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
