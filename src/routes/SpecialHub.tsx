import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import type { LibraryRoot, Movie, Show } from '@shared/types'
import MediaCard from '@/components/library/MediaCard'
import SpecialBackdrop from '@/components/specials/SpecialBackdrop'
import { getSpecial, moviesForSpecial, showsForSpecial } from '@/lib/specials'

type Sort = 'release' | 'title' | 'recent' | 'rating'

export default function SpecialHub() {
  const { kind } = useParams<{ kind: string }>()
  const def = getSpecial(kind)

  const [movies, setMovies] = useState<Movie[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<Sort>('release')

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  async function load() {
    setLoading(true)
    const [m, s, r] = await Promise.all([
      window.api.library.listMovies(),
      window.api.library.listShows(),
      window.api.libraryRoots.list(),
    ])
    if (m.ok && m.data) setMovies(m.data)
    if (s.ok && s.data) setShows(s.data)
    if (r.ok && r.data) setRoots(r.data)
    setLoading(false)
  }

  const mine = useMemo(
    () => (def ? moviesForSpecial(movies, roots, def.kind) : []),
    [movies, roots, def]
  )
  const myShows = useMemo(
    () => (def ? showsForSpecial(shows, roots, def.kind) : []),
    [shows, roots, def]
  )

  const sortedMovies = useMemo(() => {
    const arr = [...mine]
    arr.sort((a, b) => {
      if (sort === 'recent') return b.addedAt - a.addedAt
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sort === 'title') return a.title.localeCompare(b.title)
      return (a.year ?? 0) - (b.year ?? 0)
    })
    return arr
  }, [mine, sort])

  if (!def) return <Navigate to="/specials" replace />

  // A special that is really just one series jumps straight into it.
  if (!loading && def.singleSeries && myShows.length === 1 && mine.length === 0) {
    return <Navigate to={`/show/${myShows[0].id}`} replace />
  }

  const total = sortedMovies.length + myShows.length

  return (
    <div className="pb-20 relative">
      <SpecialBackdrop src={def.background} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative px-8 pt-10 pb-8 max-w-7xl mx-auto">
        <Link
          to="/specials"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All Specials
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex flex-col items-center text-center gap-3 py-6"
        >
          <img
            src={def.logo}
            alt={def.name}
            className="max-h-24 md:max-h-28 max-w-[min(520px,80%)] w-auto object-contain"
            style={{ filter: `drop-shadow(0 0 30px rgba(${def.glow},0.55))` }}
          />
          <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-white/60 font-semibold">
            {def.blurb}
          </p>
        </motion.div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative px-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-card bg-bg-card/70 animate-pulse" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="card p-10 text-center max-w-xl mx-auto bg-bg-card/80 backdrop-blur-sm">
            <img src={def.logo} alt="" className="h-8 w-auto mx-auto mb-4 opacity-80 object-contain" />
            <h2 className="text-lg font-semibold mb-2">Nothing here yet</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              {def.detection === 'auto' ? (
                <>
                  No {def.name} titles in your library yet. They&apos;re picked up
                  automatically — just drop them in any movies or TV folder and run
                  a scan.
                </>
              ) : (
                <>
                  No {def.name} titles found. Add the folder under{' '}
                  <span className="text-text-primary font-medium">
                    Settings → Add Specials → {def.name}
                  </span>
                  , then run a scan.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            <header className="mb-5 flex items-baseline justify-between gap-4">
              <p className="text-sm text-white/70">
                {total} title{total === 1 ? '' : 's'}
              </p>
              {sortedMovies.length > 1 && (
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="input w-auto"
                  title={`Sort ${def.name}`}
                >
                  <option value="release">Release Order</option>
                  <option value="title">A → Z</option>
                  <option value="recent">Recently Added</option>
                  <option value="rating">Rating</option>
                </select>
              )}
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {myShows.map((s, idx) => (
                <MediaCard
                  key={`show-${s.id}`}
                  to={`/show/${s.id}`}
                  title={s.title}
                  subtitle={s.year ?? null}
                  rating={s.rating}
                  posterPath={s.posterPath}
                  type="show"
                  delay={idx * 0.015}
                />
              ))}
              {sortedMovies.map((m, idx) => (
                <MediaCard
                  key={`movie-${m.id}`}
                  to={`/movie/${m.id}`}
                  title={m.title}
                  subtitle={m.year ?? null}
                  rating={m.rating}
                  posterPath={m.posterPath}
                  type="movie"
                  delay={(myShows.length + idx) * 0.015}
                  itemId={m.id}
                  metadataLocked={m.metadataLocked}
                  tmdbId={m.tmdbId}
                  onUpdated={() => void load()}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
