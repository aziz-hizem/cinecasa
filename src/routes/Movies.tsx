import { useEffect, useMemo, useState } from 'react'
import { Film as FilmIcon } from 'lucide-react'
import type { Movie } from '@shared/types'
import MediaCard from '@/components/library/MediaCard'

type Sort = 'title' | 'recent' | 'year' | 'rating'

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<Sort>('title')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    const res = await window.api.library.listMovies()
    if (res.ok && res.data) setMovies(res.data)
    setLoading(false)
  }

  const sorted = useMemo(() => {
    const arr = [...movies]
    arr.sort((a, b) => {
      if (sort === 'recent') return b.addedAt - a.addedAt
      if (sort === 'year') return (b.year ?? 0) - (a.year ?? 0)
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return a.title.localeCompare(b.title)
    })
    return arr
  }, [movies, sort])

  if (loading) {
    return (
      <div className="px-8 py-10 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Movies</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-card bg-bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (movies.length === 0) {
    return (
      <div className="px-8 py-10 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Movies</h1>
        <div className="card p-10 text-center mt-8">
          <FilmIcon className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary">
            No movies yet. Add a Movies folder in Settings and run Scan Library.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movies</h1>
          <p className="text-sm text-text-muted">{movies.length} titles</p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="input w-auto"
        >
          <option value="title">A → Z</option>
          <option value="recent">Recently Added</option>
          <option value="year">Release Year</option>
          <option value="rating">Rating</option>
        </select>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {sorted.map((m, idx) => (
          <MediaCard
            key={m.id}
            to={`/movie/${m.id}`}
            title={m.title}
            subtitle={m.year ?? null}
            rating={m.rating}
            posterPath={m.posterPath}
            type="movie"
            delay={idx * 0.015}
          />
        ))}
      </div>
    </div>
  )
}
