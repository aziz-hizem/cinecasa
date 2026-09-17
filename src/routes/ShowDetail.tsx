import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, CheckCircle2, Image as ImageIcon, Lock, MoreVertical, Pencil, Play,
  RefreshCw, Shuffle, Star, Calendar, Trash2, User, Tv as TvIcon,
} from 'lucide-react'
import type { CastMember, Episode, LibraryRoot, PlaybackProgressEvent, Season, Show, WatchProgress } from '@shared/types'
import LazyImage from '@/components/library/LazyImage'
import MetadataModal from '@/components/library/MetadataModal'
import EpisodeMetadataModal from '@/components/library/EpisodeMetadataModal'
import SpecialBackdrop from '@/components/specials/SpecialBackdrop'
import { getSpecial } from '@/lib/specials'
import { formatPosition, formatRating, formatRuntime, imgSrc } from '@/lib/format'

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [show, setShow] = useState<Show | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [cast, setCast] = useState<CastMember[]>([])
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [refreshingStills, setRefreshingStills] = useState(false)
  const [stillsStatus, setStillsStatus] = useState<{ filled: number; total: number } | null>(null)
  const [progressMap, setProgressMap] = useState<Map<number, WatchProgress>>(new Map())
  /** The episode to resume: most-recently-played in-progress episode. */
  const [resumeEpisode, setResumeEpisode] = useState<Episode | null>(null)
  /** The specialKind of the library root this show belongs to, or null. */
  const [detectedSpecialKind, setDetectedSpecialKind] = useState<string | null>(null)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Live progress updates from MPC-HC polling
  useEffect(() => {
    const unsub = window.api.playback.onProgress((e: PlaybackProgressEvent) => {
      if (e.itemType !== 'episode') return
      setProgressMap((prev) => {
        const next = new Map(prev)
        next.set(e.itemId, {
          itemType: 'episode',
          itemId: e.itemId,
          positionMs: e.positionMs,
          durationMs: e.durationMs,
          state: e.state,
          lastPlayedAt: Date.now(),
          watchedAt: e.state === 'watched' ? Date.now() : (prev.get(e.itemId)?.watchedAt ?? null),
        })
        return next
      })
    })
    return unsub
  }, [])

  async function load() {
    if (!id) return
    setLoading(true)
    const numId = Number(id)
    const [s, ss, eps, c, prog, roots] = await Promise.all([
      window.api.library.getShow(numId),
      window.api.library.listSeasons(numId),
      window.api.library.listEpisodes(numId),
      window.api.library.listCast('show', numId),
      window.api.playback.listShowProgress(numId),
      window.api.libraryRoots.list(),
    ])
    const showData = s.ok && s.data ? s.data : null
    if (showData) {
      setShow(showData)
      // Detect special library root (e.g. Oscars)
      if (roots.ok && roots.data) {
        const specialRoots = (roots.data as LibraryRoot[]).filter((r) => r.specialKind)
        const folder = showData.folderPath.replace(/\\/g, '/').toLowerCase()
        const matchingRoot = specialRoots.find((r) =>
          folder.startsWith(r.path.replace(/\\/g, '/').toLowerCase())
        )
        setDetectedSpecialKind(matchingRoot?.specialKind ?? null)
      }
    }
    const allEps = eps.ok && eps.data ? eps.data : []
    if (eps.ok && eps.data) setEpisodes(eps.data)
    if (c.ok && c.data) setCast(c.data)

    const progMap = new Map(
      (prog.ok && prog.data ? prog.data : []).map((p) => [p.itemId, p]),
    )
    if (prog.ok && prog.data) setProgressMap(progMap)

    if (ss.ok && ss.data) {
      setSeasons(ss.data)

      // Find the most-recently-played in-progress episode to resume.
      const lastInProgress = (prog.ok && prog.data ? prog.data : [])
        .filter((p) => p.state === 'in_progress')
        .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))[0]

      const resumeEp = lastInProgress
        ? allEps.find((e) => e.id === lastInProgress.itemId) ?? null
        : null
      setResumeEpisode(resumeEp)

      // Auto-select the season of the resume episode, otherwise fall back to S1.
      const targetSeason =
        resumeEp?.seasonNumber ??
        (ss.data.find((x) => x.seasonNumber > 0) ?? ss.data[0])?.seasonNumber ??
        null
      setActiveSeason(targetSeason)
    }
    setLoading(false)
  }

  async function handleDeleteShow() {
    if (!show) return
    if (!window.confirm(`Remove "${show.title}" from the library?\n\nThis removes all metadata and progress data. Your files will not be touched.`)) return
    const res = await window.api.library.deleteShow(show.id)
    if (res.ok) navigate(-1)
  }

  const seasonsWithFiles = useMemo(() => {
    const set = new Set(episodes.map((e) => e.seasonNumber))
    return seasons.filter((s) => set.has(s.seasonNumber))
  }, [seasons, episodes])

  const filteredEpisodes = useMemo(
    () => episodes.filter((e) => e.seasonNumber === activeSeason),
    [episodes, activeSeason],
  )

  const partCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const ep of episodes) {
      const key = `${ep.seasonNumber}-${ep.episodeNumber}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [episodes])

  if (loading) {
    return (
      <div>
        <div className="h-[60vh] bg-bg-card animate-pulse" />
        <div className="px-12 mt-8 space-y-3">
          <div className="h-8 w-1/3 bg-bg-card animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-bg-card animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="px-8 py-10 max-w-3xl mx-auto">
        <div className="card p-10 text-center">Show not found.</div>
      </div>
    )
  }

  // Specials get their own branded art in place of the generic TMDB backdrop,
  // plus a fixed page-wide backdrop so the whole view stays themed while scrolling.
  const special = getSpecial(detectedSpecialKind)
  const backdrop = special?.background ?? imgSrc(show.backdropPath)

  return (
    <div className="pb-20">
      {special && <SpecialBackdrop src={special.background} />}

      {/* Hero */}
      <div className="relative h-[60vh] min-h-[420px] -mt-px overflow-hidden">
        {backdrop ? (
          <div className="absolute inset-0 ken-burns">
            <LazyImage src={backdrop} alt={show.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-bg-card via-bg to-bg" />
        )}
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 hero-gradient-side" />

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-6 btn-secondary bg-black/40 border-white/10 hover:bg-black/60 backdrop-blur"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* 3-dot settings menu — top-right of backdrop */}
        <div className="absolute top-4 right-6">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/70 transition-colors"
            title="Show options"
          >
            <MoreVertical className="w-4 h-4 text-white" />
          </button>

          {menuOpen && (
            <>
              {/* Click-away */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-50 min-w-[220px] bg-bg-card border border-border-subtle rounded-card shadow-2xl py-1 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setEditOpen(true) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-bg-hover/50 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <span>Edit Metadata</span>
                  {show.metadataLocked && <Lock className="w-3 h-3 text-accent ml-auto" />}
                </button>

                <button
                  type="button"
                  disabled={refreshingStills}
                  onClick={async () => {
                    setMenuOpen(false)
                    setRefreshingStills(true)
                    setStillsStatus(null)
                    const res = await window.api.metadata.refreshStills(show.id)
                    setRefreshingStills(false)
                    if (res.ok && res.data) {
                      setStillsStatus(res.data)
                      void load()
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-bg-hover/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 text-text-muted flex-shrink-0 ${refreshingStills ? 'animate-spin' : ''}`} />
                  <span>{refreshingStills ? 'Fetching stills…' : 'Refresh missing stills'}</span>
                </button>

                {stillsStatus && (
                  <div className="flex items-center gap-2 px-4 py-2 text-xs text-emerald-400 border-t border-border-subtle">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {stillsStatus.filled} / {stillsStatus.total} stills filled
                  </div>
                )}

                <div className="border-t border-border-subtle mt-1" />
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); void handleDeleteShow() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4 flex-shrink-0" />
                  <span>Remove from Library</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-12 -mt-32 relative z-10 max-w-6xl"
      >
        {special ? (
          <img
            src={special.logo}
            alt={special.name}
            className="max-h-28 max-w-[400px] w-auto object-contain mb-4"
            style={{ filter: `drop-shadow(0 0 28px rgba(${special.glow},0.5))` }}
          />
        ) : show.logoPath ? (
          <img
            src={imgSrc(show.logoPath)}
            alt={show.title}
            className="max-h-32 max-w-[400px] mb-4 drop-shadow-2xl"
          />
        ) : (
          <h1 className="text-5xl font-bold tracking-tight mb-3 drop-shadow-2xl">
            {show.title}
          </h1>
        )}

        <div className="flex items-center gap-4 text-sm text-text-secondary mb-5">
          {show.rating !== null && show.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-medium tabular-nums">{formatRating(show.rating)}</span>
            </span>
          )}
          {show.year && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span className="tabular-nums">{show.year}</span>
            </span>
          )}
          {show.status && <span className="capitalize">{show.status}</span>}
          <span className="text-text-muted">
            {seasonsWithFiles.length} season{seasonsWithFiles.length === 1 ? '' : 's'} ·{' '}
            {episodes.length} episode{episodes.length === 1 ? '' : 's'}
          </span>
        </div>

        {show.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {show.genres.map((g) => (
              <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-bg-card border border-border-subtle text-text-secondary">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons row */}
        {(resumeEpisode && progressMap.get(resumeEpisode.id)?.state === 'in_progress' ||
          detectedSpecialKind === 'tom_and_jerry') && (
          <div className="flex items-center gap-3 mb-6">
            {resumeEpisode && progressMap.get(resumeEpisode.id)?.state === 'in_progress' && (
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const prog = progressMap.get(resumeEpisode.id)
                  await window.api.playback.launch({
                    filePath: resumeEpisode.filePath,
                    itemType: 'episode',
                    itemId: resumeEpisode.id,
                    startMs: prog?.positionMs ?? 0,
                  })
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                Resume S{resumeEpisode.seasonNumber}E{resumeEpisode.episodeNumber}
                {progressMap.get(resumeEpisode.id) && (
                  <span className="opacity-70 text-sm font-normal">
                    &nbsp;· {formatPosition(progressMap.get(resumeEpisode.id)!.positionMs)}
                  </span>
                )}
              </button>
            )}

            {detectedSpecialKind === 'tom_and_jerry' && episodes.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const ep = episodes[Math.floor(Math.random() * episodes.length)]
                  void window.api.playback.launch({
                    filePath: ep.filePath,
                    itemType: 'episode',
                    itemId: ep.id,
                    startMs: 0,
                    randomMode: true,
                  })
                }}
              >
                <Shuffle className="w-4 h-4" />
                Play Random Episode
              </button>
            )}
          </div>
        )}

        {show.overview && (
          <p className="text-base text-text-primary/90 leading-relaxed max-w-3xl mb-10">
            {show.overview}
          </p>
        )}

        {/* Current episode banner — shown when there's an in-progress episode */}
        {resumeEpisode && progressMap.get(resumeEpisode.id)?.state === 'in_progress' && (
          <CurrentEpisodeBanner
            episode={resumeEpisode}
            progress={progressMap.get(resumeEpisode.id)!}
            showBackdrop={show.backdropPath}
          />
        )}

        {episodes.length > 0 && (
          <section className="mb-10">
            {detectedSpecialKind ? (
              /* ── Special flat list (Oscars: by title, Tom & Jerry: by episode number) ── */
              <>
                <h2 className="text-xl font-semibold mb-4">All Entries</h2>
                <div className="space-y-3">
                  {[...episodes]
                    .sort(detectedSpecialKind === 'tom_and_jerry'
                      ? (a, b) => a.episodeNumber - b.episodeNumber
                      : (a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
                    .map((ep, idx) => (
                      <EpisodeRow
                        key={ep.id}
                        episode={ep}
                        index={idx}
                        showPart={false}
                        progress={progressMap.get(ep.id) ?? null}
                        showBackdrop={show.backdropPath}
                        onUpdated={() => void load()}
                      />
                    ))}
                </div>
              </>
            ) : (
              /* ── Regular show: season selector ── */
              <>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-xl font-semibold">Episodes</h2>
                  {seasonsWithFiles.length > 1 && (
                    <select
                      aria-label="Select season"
                      value={activeSeason ?? ''}
                      onChange={(e) => setActiveSeason(Number(e.target.value))}
                      className="input w-auto"
                    >
                      {seasonsWithFiles.map((s) => (
                        <option key={s.id} value={s.seasonNumber}>
                          {s.name ?? `Season ${s.seasonNumber}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-3">
                  {filteredEpisodes.map((ep, idx) => (
                    <EpisodeRow
                      key={ep.id}
                      episode={ep}
                      index={idx}
                      showPart={(partCounts.get(`${ep.seasonNumber}-${ep.episodeNumber}`) ?? 0) > 1}
                      progress={progressMap.get(ep.id) ?? null}
                      showBackdrop={show.backdropPath}
                      onUpdated={() => void load()}
                    />
                  ))}
                  {filteredEpisodes.length === 0 && (
                    <div className="text-sm text-text-muted">No episodes in this season.</div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {cast.length > 0 && (
          <section>
            <h2 className="text-sm uppercase tracking-widest text-text-muted mb-3">Cast</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {cast.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-card bg-bg-card border border-border-subtle">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-bg flex-shrink-0">
                    <LazyImage
                      src={imgSrc(c.profilePath)}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      fallback={<User className="w-5 h-5 text-text-muted" />}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    {c.character && <div className="text-xs text-text-muted truncate">{c.character}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </motion.div>

      <MetadataModal
        isOpen={editOpen}
        itemType="show"
        itemId={show.id}
        currentTitle={show.title}
        currentTmdbId={show.tmdbId}
        metadataLocked={show.metadataLocked}
        onClose={() => setEditOpen(false)}
        onUpdated={() => { setEditOpen(false); void load() }}
      />
    </div>
  )
}

// ─── Current episode banner ──────────────────────────────────────────────────

function CurrentEpisodeBanner({
  episode,
  progress,
  showBackdrop,
}: {
  episode: Episode
  progress: WatchProgress
  showBackdrop: string | null
}) {
  const still = imgSrc(episode.stillPath) ?? imgSrc(showBackdrop)
  const ratio = progress.durationMs > 0 ? progress.positionMs / progress.durationMs : null
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fillRef.current && ratio !== null) {
      fillRef.current.style.width = `${(Math.min(ratio, 1) * 100).toFixed(1)}%`
    }
  }, [ratio])

  async function handleResume() {
    await window.api.playback.launch({
      filePath: episode.filePath,
      itemType: 'episode',
      itemId: episode.id,
      startMs: progress.positionMs,
    })
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-10"
    >
      <h2 className="text-sm uppercase tracking-widest text-text-muted mb-3">Continue Watching</h2>

      <div
        className="group flex gap-5 card p-4 cursor-pointer hover:bg-bg-hover/40 transition-colors"
        onClick={handleResume}
      >
        {/* Episode still */}
        <div className="relative w-64 aspect-video rounded-md overflow-hidden bg-bg flex-shrink-0">
          <LazyImage
            src={still}
            alt={episode.title ?? `Episode ${episode.episodeNumber}`}
            className="w-full h-full object-cover"
            fallback={<TvIcon className="w-8 h-8 text-text-muted" />}
          />

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
              <Play className="w-5 h-5 fill-black ml-0.5" />
            </div>
          </div>

          {/* Progress bar */}
          {ratio !== null && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div ref={fillRef} className="h-full bg-accent" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
          {/* Season / episode badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              Season {episode.seasonNumber} · Episode {episode.episodeNumber}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold leading-snug">
            {episode.title ?? `Episode ${episode.episodeNumber}`}
          </h3>

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-accent font-medium tabular-nums">
              {formatPosition(progress.positionMs)}
            </span>
            {progress.durationMs > 0 && (
              <>
                <span className="text-text-muted">/</span>
                <span className="text-text-muted tabular-nums">
                  {formatPosition(progress.durationMs)}
                </span>
              </>
            )}
          </div>

          {/* Overview */}
          {episode.overview && (
            <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
              {episode.overview}
            </p>
          )}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Episode row ─────────────────────────────────────────────────────────────

function EpisodeRow({
  episode,
  index,
  showPart,
  progress,
  showBackdrop = null,
  onUpdated,
}: {
  episode: Episode
  index: number
  showPart: boolean
  progress: WatchProgress | null
  showBackdrop?: string | null
  onUpdated?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'metadata' | 'image'>('metadata')

  // Use show backdrop as fallback when the episode has no still image
  const still = imgSrc(episode.stillPath) ?? imgSrc(showBackdrop)
  const progressRatio =
    progress && progress.durationMs > 0 ? progress.positionMs / progress.durationMs : null

  const actionLabel =
    progress?.state === 'in_progress'
      ? `Resume · ${formatPosition(progress.positionMs)}`
      : progress?.state === 'watched'
        ? 'Watch Again'
        : null

  async function handleClick() {
    const startMs = progress?.state === 'in_progress' ? progress.positionMs : 0
    await window.api.playback.launch({
      filePath: episode.filePath,
      itemType: 'episode',
      itemId: episode.id,
      startMs,
    })
  }

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  function openMetadata(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    setModalTab('metadata')
    setModalOpen(true)
  }

  function openImage(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    setModalTab('image')
    setModalOpen(true)
  }

  return (
    <>
      <EpisodeMetadataModal
        isOpen={modalOpen}
        episode={episode}
        initialTab={modalTab}
        onClose={() => setModalOpen(false)}
        onUpdated={() => { setModalOpen(false); onUpdated?.() }}
      />

      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
        className="card p-3 flex gap-4 items-stretch group hover:bg-bg-hover/40 transition-colors cursor-pointer relative"
        onClick={handleClick}
      >
      {/* Thumbnail */}
      <div className="w-44 aspect-video rounded-md overflow-hidden bg-bg flex-shrink-0 relative">
        <LazyImage
          src={still}
          alt={episode.title ?? `Episode ${episode.episodeNumber}`}
          className="w-full h-full object-cover"
          fallback={<TvIcon className="w-6 h-6 text-text-muted" />}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/95 text-bg flex items-center justify-center">
            <Play className="w-4 h-4 fill-bg ml-0.5" />
          </div>
        </div>
        {progressRatio !== null && progress?.state === 'in_progress' && (
          <EpisodeProgressBar ratio={progressRatio} />
        )}
        {progress?.state === 'watched' && (
          <div className="absolute top-1 right-1 bg-emerald-500/80 rounded-full p-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-text-muted tabular-nums text-sm">
            {String(episode.episodeNumber).padStart(2, '0')}
          </span>
          <h3 className="font-semibold truncate">
            {episode.title ?? `Episode ${episode.episodeNumber}`}
          </h3>
          {showPart && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-bg border border-border-subtle text-text-muted">
              Part {episode.episodePart}
            </span>
          )}
          <span className="text-xs flex items-center gap-2 ml-auto flex-shrink-0">
            {actionLabel ? (
              <span className="text-accent">{actionLabel}</span>
            ) : episode.runtime ? (
              <span className="text-text-muted">{formatRuntime(episode.runtime)}</span>
            ) : null}

            {/* 3-dot menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={openMenu}
                className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-bg-hover transition-all"
                title="Episode options"
              >
                <MoreVertical className="w-3.5 h-3.5 text-text-muted" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-7 z-50 min-w-[170px] bg-bg-card border border-border-subtle rounded-card shadow-2xl py-1">
                    <button
                      type="button"
                      onClick={openMetadata}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-bg-hover/50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-text-muted" />
                      Edit Metadata
                    </button>
                    <button
                      type="button"
                      onClick={openImage}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-bg-hover/50 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-text-muted" />
                      Edit Image
                    </button>
                  </div>
                </>
              )}
            </div>
          </span>
        </div>
        {episode.overview && (
          <p className="text-sm text-text-secondary line-clamp-2">{episode.overview}</p>
        )}
      </div>
      </motion.div>
    </>
  )
}

/** Thin progress bar at the bottom of the episode thumbnail, width set imperatively. */
function EpisodeProgressBar({ ratio }: { ratio: number }) {
  const fillRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (fillRef.current) {
      fillRef.current.style.width = `${(Math.min(ratio, 1) * 100).toFixed(1)}%`
    }
  }, [ratio])
  return (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
      <div ref={fillRef} className="h-full bg-accent" />
    </div>
  )
}
