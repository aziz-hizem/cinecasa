import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Lock, Pencil, Play, Star, Clock, Calendar, Trash2, User } from 'lucide-react'
import type { CastMember, Movie, PlaybackProgressEvent, WatchProgress } from '@shared/types'
import LazyImage from '@/components/library/LazyImage'
import MetadataModal from '@/components/library/MetadataModal'
import { formatPosition, formatRating, formatRuntime, imgSrc } from '@/lib/format'

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [movie, setMovie] = useState<Movie | null>(null)
  const [cast, setCast] = useState<CastMember[]>([])
  const [progress, setProgress] = useState<WatchProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Subscribe to live progress events while on this page.
  useEffect(() => {
    const unsub = window.api.playback.onProgress((e: PlaybackProgressEvent) => {
      if (!movie) return
      if (e.itemType === 'movie' && e.itemId === movie.id) {
        setProgress((prev) => ({
          ...(prev ?? {
            itemType: 'movie',
            itemId: movie.id,
            watchedAt: null,
            lastPlayedAt: null,
          }),
          positionMs: e.positionMs,
          durationMs: e.durationMs,
          state: e.state,
          lastPlayedAt: Date.now(),
        }))
      }
    })
    return unsub
  }, [movie])

  async function load() {
    if (!id) return
    setLoading(true)
    const numId = Number(id)
    const [m, c, p] = await Promise.all([
      window.api.library.getMovie(numId),
      window.api.library.listCast('movie', numId),
      window.api.playback.getProgress('movie', numId),
    ])
    if (m.ok && m.data) setMovie(m.data)
    if (c.ok && c.data) setCast(c.data)
    setProgress(p.ok ? (p.data ?? null) : null)
    setLoading(false)
  }

  async function handleDelete() {
    if (!movie) return
    if (!window.confirm(`Remove "${movie.title}" from the library?\n\nThis removes all metadata and progress data. Your files will not be touched.`)) return
    const res = await window.api.library.deleteMovie(movie.id)
    if (res.ok) navigate(-1)
  }

  async function handlePlay() {
    if (!movie) return
    setLaunchError(null)
    setLaunching(true)
    const startMs = progress?.state === 'in_progress' ? progress.positionMs : 0
    const res = await window.api.playback.launch({
      filePath: movie.filePath,
      itemType: 'movie',
      itemId: movie.id,
      startMs,
    })
    setLaunching(false)
    if (!res.ok) setLaunchError(res.error ?? 'Could not launch MPC-HC')
  }

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

  if (!movie) {
    return (
      <div className="px-8 py-10 max-w-3xl mx-auto">
        <div className="card p-10 text-center">Movie not found.</div>
      </div>
    )
  }

  const backdrop = imgSrc(movie.backdropPath)
  const progressRatio =
    progress && progress.durationMs > 0
      ? progress.positionMs / progress.durationMs
      : null

  const playLabel =
    progress?.state === 'in_progress'
      ? `Resume · ${formatPosition(progress.positionMs)}`
      : progress?.state === 'watched'
        ? 'Watch Again'
        : 'Play'

  return (
    <div className="pb-20">
      {/* Backdrop hero */}
      <div className="relative h-[60vh] min-h-[420px] -mt-px overflow-hidden">
        {backdrop ? (
          <div className="absolute inset-0 ken-burns">
            <LazyImage
              src={backdrop}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
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
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-12 -mt-32 relative z-10 max-w-5xl"
      >
        {movie.logoPath ? (
          <img
            src={imgSrc(movie.logoPath)}
            alt={movie.title}
            className="max-h-32 max-w-[400px] mb-4 drop-shadow-2xl"
          />
        ) : (
          <h1 className="text-5xl font-bold tracking-tight mb-3 drop-shadow-2xl">
            {movie.title}
          </h1>
        )}

        {movie.tagline && (
          <p className="text-text-secondary italic mb-3">{movie.tagline}</p>
        )}

        {/* Meta line */}
        <div className="flex items-center gap-4 text-sm text-text-secondary mb-5">
          {movie.rating !== null && movie.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-medium tabular-nums">
                {formatRating(movie.rating)}
              </span>
            </span>
          )}
          {movie.year && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span className="tabular-nums">{movie.year}</span>
            </span>
          )}
          {movie.runtime && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatRuntime(movie.runtime)}
            </span>
          )}
          {progress?.state === 'watched' && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Watched
            </span>
          )}
        </div>

        {/* Genres */}
        {movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {movie.genres.map((g) => (
              <span
                key={g}
                className="text-xs px-2.5 py-1 rounded-full bg-bg-card border border-border-subtle text-text-secondary"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className="btn-primary px-6 py-3 text-base disabled:opacity-60"
              onClick={handlePlay}
              disabled={launching}
            >
              <Play className="w-5 h-5 fill-white" />
              {launching ? 'Launching…' : playLabel}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="btn-secondary"
            >
              <Pencil className="w-4 h-4" />
              Edit Metadata
              {movie.metadataLocked && <Lock className="w-3 h-3 text-accent ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
              Remove from Library
            </button>
          </div>

          {/* Inline progress bar under play button */}
          {progressRatio !== null && progress?.state === 'in_progress' && (
            <ProgressBar ratio={progressRatio} className="w-48" />
          )}

          {launchError && (
            <p className="text-sm text-red-400">{launchError}</p>
          )}
        </div>

        {/* Overview */}
        {movie.overview && (
          <section className="mb-10">
            <h2 className="text-sm uppercase tracking-widest text-text-muted mb-2">
              Overview
            </h2>
            <p className="text-base text-text-primary/90 leading-relaxed max-w-3xl">
              {movie.overview}
            </p>
          </section>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section>
            <h2 className="text-sm uppercase tracking-widest text-text-muted mb-3">
              Cast
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {cast.map((c) => (
                <CastCard key={c.id} member={c} />
              ))}
            </div>
          </section>
        )}

        {/* File info */}
        <section className="mt-10 pt-6 border-t border-border-subtle text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <span className="font-mono truncate">{movie.filePath}</span>
          </div>
        </section>
      </motion.div>

      {/* Metadata editor */}
      <MetadataModal
        isOpen={editOpen}
        itemType="movie"
        itemId={movie.id}
        currentTitle={movie.title}
        currentTmdbId={movie.tmdbId}
        metadataLocked={movie.metadataLocked}
        onClose={() => setEditOpen(false)}
        onUpdated={() => { setEditOpen(false); void load() }}
      />
    </div>
  )
}

/** Renders a dynamic-width progress bar without JSX inline styles. */
function ProgressBar({ ratio, className = '' }: { ratio: number; className?: string }) {
  const fillRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (fillRef.current) {
      fillRef.current.style.width = `${(Math.min(ratio, 1) * 100).toFixed(1)}%`
    }
  }, [ratio])
  return (
    <div className={`h-1 rounded-full bg-white/10 overflow-hidden ${className}`}>
      <div ref={fillRef} className="h-full bg-accent rounded-full transition-[width]" />
    </div>
  )
}

function CastCard({ member }: { member: CastMember }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-card bg-bg-card border border-border-subtle">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-bg flex-shrink-0">
        <LazyImage
          src={imgSrc(member.profilePath)}
          alt={member.name}
          className="w-full h-full object-cover"
          fallback={<User className="w-5 h-5 text-text-muted" />}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{member.name}</div>
        {member.character && (
          <div className="text-xs text-text-muted truncate">{member.character}</div>
        )}
      </div>
    </div>
  )
}
