import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import type { Movie, Show } from '@shared/types'
import MediaCard from '@/components/library/MediaCard'

type Filter = 'all' | 'movies' | 'shows'

export default function Search() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [movies, setMovies] = useState<Movie[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce input
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 180)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!debounced) {
      setMovies([])
      setShows([])
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await window.api.library.search(debounced)
      if (cancelled) return
      if (res.ok && res.data) {
        setMovies(res.data.movies)
        setShows(res.data.shows)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [debounced])

  const showMovies = filter !== 'shows' && movies.length > 0
  const showShows = filter !== 'movies' && shows.length > 0
  const totalCount = movies.length + shows.length

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      {/* Search input */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library…"
          className="w-full bg-bg-card border border-border-subtle rounded-btn pl-12 pr-12 py-3.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      {debounced && (
        <div className="flex items-center gap-2 mb-6">
          {(['all', 'movies', 'shows'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-white text-bg'
                  : 'bg-bg-card text-text-secondary hover:text-text-primary border border-border-subtle'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto text-sm text-text-muted">
            {loading ? 'Searching…' : totalCount > 0 ? `${totalCount} result${totalCount === 1 ? '' : 's'}` : ''}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!debounced && (
        <div className="card p-10 text-center mt-8">
          <SearchIcon className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary">
            Type to search across your local movies and TV shows.
          </p>
        </div>
      )}

      {debounced && !loading && totalCount === 0 && (
        <div className="card p-10 text-center mt-2">
          <p className="text-text-secondary">
            No matches for <span className="text-white font-medium">"{debounced}"</span>.
          </p>
        </div>
      )}

      {showMovies && (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-widest text-text-muted mb-3">
            Movies <span className="text-text-muted/60">· {movies.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.map((m, idx) => (
              <MediaCard
                key={m.id}
                to={`/movie/${m.id}`}
                title={m.title}
                subtitle={m.year ?? null}
                rating={m.rating}
                posterPath={m.posterPath}
                type="movie"
                delay={idx * 0.02}
              />
            ))}
          </div>
        </section>
      )}

      {showShows && (
        <section>
          <h2 className="text-sm uppercase tracking-widest text-text-muted mb-3">
            TV Shows <span className="text-text-muted/60">· {shows.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {shows.map((s, idx) => (
              <MediaCard
                key={s.id}
                to={`/show/${s.id}`}
                title={s.title}
                subtitle={s.year ?? null}
                rating={s.rating}
                posterPath={s.posterPath}
                type="show"
                delay={idx * 0.02}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
