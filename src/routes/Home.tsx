import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, FolderPlus, Play, Info, X, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { InProgressItem, Movie, Show } from '@shared/types'
import HeroBanner, { type HeroItem } from '@/components/library/HeroBanner'
import MediaRow from '@/components/library/MediaRow'
import MediaCard from '@/components/library/MediaCard'
import LazyImage from '@/components/library/LazyImage'
import { formatPosition, imgSrc } from '@/lib/format'

export default function Home() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [recentMovies, setRecentMovies] = useState<Movie[]>([])
  const [recentShows, setRecentShows] = useState<Show[]>([])
  const [inProgress, setInProgress] = useState<InProgressItem[]>([])
  const [loading, setLoading] = useState(true)

  // ── Continue Watching removal + undo ────────────────────────────────────────
  /** Keys of items hidden from the list (pending deletion or already deleted). */
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())
  /** The item whose deletion is pending (5-second undo window). */
  const [pendingRemoval, setPendingRemoval] = useState<InProgressItem | null>(null)
  const removalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function itemKey(item: InProgressItem) {
    return `${item.itemType}-${item.itemId}`
  }

  /** Commit a deletion immediately (no undo). */
  async function commitRemoval(item: InProgressItem) {
    await window.api.playback.removeProgress(item.itemType, item.itemId)
  }

  function handleRemove(item: InProgressItem) {
    // If there's already a pending removal, commit it before starting a new one.
    if (pendingRemoval && removalTimerRef.current !== null) {
      clearTimeout(removalTimerRef.current)
      removalTimerRef.current = null
      void commitRemoval(pendingRemoval)
    }

    setHiddenKeys((prev) => new Set([...prev, itemKey(item)]))
    setPendingRemoval(item)

    removalTimerRef.current = setTimeout(async () => {
      removalTimerRef.current = null
      setPendingRemoval(null)
      await commitRemoval(item)
      // Re-fetch so "next episode" logic re-runs after the record is gone.
      const res = await window.api.playback.listInProgress(20)
      if (res.ok && res.data) setInProgress(res.data)
    }, 5000)
  }

  function handleUndo() {
    if (!pendingRemoval) return
    if (removalTimerRef.current !== null) {
      clearTimeout(removalTimerRef.current)
      removalTimerRef.current = null
    }
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      next.delete(itemKey(pendingRemoval))
      return next
    })
    setPendingRemoval(null)
  }

  function handleDismissToast() {
    if (!pendingRemoval) return
    if (removalTimerRef.current !== null) {
      clearTimeout(removalTimerRef.current)
      removalTimerRef.current = null
    }
    void commitRemoval(pendingRemoval)
    setPendingRemoval(null)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (removalTimerRef.current !== null) clearTimeout(removalTimerRef.current)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [])

  // Refresh Continue Watching whenever playback progress or auto-play fires.
  useEffect(() => {
    function refresh() {
      void window.api.playback.listInProgress(20).then((res) => {
        if (res.ok && res.data) setInProgress(res.data)
      })
    }
    const unsubProgress = window.api.playback.onProgress(refresh)
    const unsubNext = window.api.playback.onNextEpisode(refresh)
    return () => { unsubProgress(); unsubNext() }
  }, [])

  async function load() {
    setLoading(true)
    const [m, s, rm, rs, ip] = await Promise.all([
      window.api.library.listMovies(),
      window.api.library.listShows(),
      window.api.library.listRecentMovies(20),
      window.api.library.listRecentShows(20),
      window.api.playback.listInProgress(10),
    ])
    if (m.ok && m.data) setMovies(m.data)
    if (s.ok && s.data) setShows(s.data)
    if (rm.ok && rm.data) setRecentMovies(rm.data)
    if (rs.ok && rs.data) setRecentShows(rs.data)
    if (ip.ok && ip.data) setInProgress(ip.data)
    setLoading(false)
  }

  const heroItems = useMemo<HeroItem[]>(() => {
    const candidates: HeroItem[] = []
    for (const m of recentMovies) {
      if (m.backdropPath) candidates.push({ kind: 'movie', movie: m })
    }
    for (const s of recentShows) {
      if (s.backdropPath) candidates.push({ kind: 'show', show: s })
    }
    return candidates.slice(0, 5)
  }, [recentMovies, recentShows])

  const isEmpty = movies.length === 0 && shows.length === 0

  if (loading) {
    return (
      <div>
        <div className="h-[70vh] bg-bg-card animate-pulse" />
        <div className="space-y-8 mt-8">
          {[0, 1].map((i) => (
            <div key={i} className="px-8">
              <div className="h-5 w-40 bg-bg-card rounded mb-3 animate-pulse" />
              <div className="flex gap-4">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div
                    key={j}
                    className="w-[180px] aspect-[2/3] rounded-card bg-bg-card animate-pulse flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="px-8 py-10 max-w-3xl mx-auto">
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <FolderPlus className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to Cinecasa</h1>
          <p className="text-text-secondary max-w-xl mx-auto mb-6">
            No library yet. Head to Settings, add your Movies and TV folders, set your
            TMDB API key, and run a scan. Your library will populate here.
          </p>
          <Link to="/settings" className="btn-primary inline-flex">
            <SettingsIcon className="w-4 h-4" />
            Open Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-16">
      {heroItems.length > 0 && <HeroBanner items={heroItems} rotateMs={9000} />}

      <div className={`space-y-8 ${heroItems.length > 0 ? 'pt-6 relative z-10' : 'pt-8'}`}>

        {/* Continue Watching — Shows */}
        {inProgress.filter((i) => i.itemType === 'episode' && !hiddenKeys.has(itemKey(i))).length > 0 && (
          <MediaRow title="Continue Watching — Shows">
            {inProgress
              .filter((i) => i.itemType === 'episode' && !hiddenKeys.has(itemKey(i)))
              .map((item, idx) => (
                <ContinueWatchingCard
                  key={itemKey(item)}
                  item={item}
                  delay={idx * 0.02}
                  onRemove={() => handleRemove(item)}
                />
              ))}
          </MediaRow>
        )}

        {/* Continue Watching — Movies (specials included) */}
        {inProgress.filter((i) => i.itemType === 'movie' && !hiddenKeys.has(itemKey(i))).length > 0 && (
          <MediaRow title="Continue Watching — Movies">
            {inProgress
              .filter((i) => i.itemType === 'movie' && !hiddenKeys.has(itemKey(i)))
              .map((item, idx) => (
                <ContinueWatchingCard
                  key={itemKey(item)}
                  item={item}
                  delay={idx * 0.02}
                  onRemove={() => handleRemove(item)}
                />
              ))}
          </MediaRow>
        )}

        {/* Recently Added */}
        {recentMovies.length + recentShows.length > 0 && (
          <MediaRow title="Recently Added">
            {[...recentMovies, ...recentShows]
              .sort((a, b) => b.addedAt - a.addedAt)
              .slice(0, 20)
              .map((item, idx) => {
                const kind: 'movie' | 'show' = 'filePath' in item ? 'movie' : 'show'
                return (
                  <div key={`${kind}-${item.id}`} className="w-[180px] flex-shrink-0">
                    <MediaCard
                      to={`/${kind}/${item.id}`}
                      title={item.title}
                      subtitle={item.year ?? null}
                      rating={item.rating}
                      posterPath={item.posterPath}
                      type={kind}
                      delay={idx * 0.02}
                    />
                  </div>
                )
              })}
          </MediaRow>
        )}

        {movies.length > 0 && (
          <MediaRow title="Movies" subtitle={`${movies.length} titles in your library`}>
            {movies.slice(0, 30).map((m, idx) => (
              <div key={m.id} className="w-[180px] flex-shrink-0">
                <MediaCard
                  to={`/movie/${m.id}`}
                  title={m.title}
                  subtitle={m.year ?? null}
                  rating={m.rating}
                  posterPath={m.posterPath}
                  type="movie"
                  delay={idx * 0.02}
                />
              </div>
            ))}
          </MediaRow>
        )}

        {shows.length > 0 && (
          <MediaRow title="TV Shows" subtitle={`${shows.length} titles in your library`}>
            {shows.slice(0, 30).map((s, idx) => (
              <div key={s.id} className="w-[180px] flex-shrink-0">
                <MediaCard
                  to={`/show/${s.id}`}
                  title={s.title}
                  subtitle={s.year ?? null}
                  rating={s.rating}
                  posterPath={s.posterPath}
                  type="show"
                  delay={idx * 0.02}
                />
              </div>
            ))}
          </MediaRow>
        )}
      </div>

      {/* Undo toast — rendered in a portal so it floats above everything */}
      {createPortal(
        <AnimatePresence>
          {pendingRemoval && (
            <RemovalToast
              item={pendingRemoval}
              onUndo={handleUndo}
              onDismiss={handleDismissToast}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

// ─── Continue Watching card ───────────────────────────────────────────────────

function ContinueWatchingCard({ item, delay = 0, onRemove }: { item: InProgressItem; delay?: number; onRemove?: () => void }) {
  const navigate = useNavigate()
  const fillRef = useRef<HTMLDivElement>(null)
  const progress = item.durationMs > 0 ? item.positionMs / item.durationMs : null

  useEffect(() => {
    if (fillRef.current && progress !== null) {
      fillRef.current.style.width = `${(Math.min(progress, 1) * 100).toFixed(1)}%`
    }
  }, [progress])

  const subtitle =
    item.itemType === 'episode' && item.seasonNumber != null && item.episodeNumber != null
      ? item.positionMs > 0
        ? `S${item.seasonNumber}E${item.episodeNumber} · ${formatPosition(item.positionMs)}`
        : `Next: S${item.seasonNumber}E${item.episodeNumber}`
      : item.positionMs > 0
        ? formatPosition(item.positionMs)
        : 'Play'

  async function handlePlay(e: React.MouseEvent) {
    e.stopPropagation()
    await window.api.playback.launch({
      filePath: item.filePath,
      itemType: item.itemType,
      itemId: item.itemId,
      startMs: item.positionMs,
    })
  }

  function handleInfo(e: React.MouseEvent) {
    e.stopPropagation()
    navigate(item.linkTo)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      className="group relative w-[180px] flex-shrink-0 cursor-pointer"
      onClick={handlePlay}
    >
      {/* Poster */}
      <div className="aspect-[2/3] rounded-card overflow-hidden bg-bg-card border border-border-subtle relative shadow-md group-hover:shadow-2xl group-hover:shadow-black/40 group-hover:border-accent/40 transition-all">
        <LazyImage
          src={imgSrc(item.posterPath)}
          alt={item.title}
          className="w-full h-full object-cover"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {/* Play button */}
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 fill-black ml-0.5" />
          </div>
        </div>

        {/* Info button — top-right corner */}
        <button
          type="button"
          onClick={handleInfo}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 z-10"
          title="View details"
        >
          <Info className="w-3.5 h-3.5 text-white" />
        </button>

        {/* Remove button — top-left corner */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.() }}
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80 z-10"
          title="Remove from Continue Watching"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>

        {/* Progress bar */}
        {progress !== null && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div ref={fillRef} className="h-full bg-accent" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-medium truncate group-hover:text-accent transition-colors">{item.title}</h3>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
    </motion.div>
  )
}

// ─── Removal undo toast ───────────────────────────────────────────────────────

const TOAST_DURATION = 5000

function RemovalToast({
  item,
  onUndo,
  onDismiss,
}: {
  item: InProgressItem
  onUndo: () => void
  onDismiss: () => void
}) {
  const [barWidth, setBarWidth] = useState(100)
  const fillRef = useRef<HTMLDivElement>(null)

  // Kick off the shrink animation one frame after mount so the browser
  // registers the starting width before transitioning to 0.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (fillRef.current) {
        fillRef.current.style.transition = `width ${TOAST_DURATION}ms linear`
        fillRef.current.style.width = '0%'
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [item.itemId]) // reset when a new item comes in

  const label =
    item.itemType === 'episode' && item.seasonNumber != null && item.episodeNumber != null
      ? `${item.title} · S${item.seasonNumber}E${item.episodeNumber}`
      : item.title

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[420px] max-w-[calc(100vw-2rem)]"
    >
      <div className="bg-bg-card border border-border-subtle rounded-card shadow-2xl overflow-hidden">
        {/* Progress bar at the top */}
        <div className="h-0.5 bg-bg-hover">
          <div ref={fillRef} className="h-full bg-accent" style={{ width: '100%' }} />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex-1 text-sm text-text-secondary truncate">
            <span className="text-text-primary font-medium">Removed</span>
            &nbsp;· {label}
          </span>

          {/* Undo */}
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
