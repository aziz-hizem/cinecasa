import { useEffect, useMemo, useState } from 'react'
import { Tv as TvIcon } from 'lucide-react'
import type { LibraryRoot, Show } from '@shared/types'
import MediaCard from '@/components/library/MediaCard'

type Sort = 'title' | 'recent' | 'year' | 'rating'

export default function TVShows() {
  const [shows, setShows] = useState<Show[]>([])
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<Sort>('title')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    const [res, rootsRes] = await Promise.all([
      window.api.library.listShows(),
      window.api.libraryRoots.list(),
    ])
    if (res.ok && res.data) setShows(res.data)
    if (rootsRes.ok && rootsRes.data) setRoots(rootsRes.data)
    setLoading(false)
  }

  const specialPaths = useMemo(() => {
    const paths = roots.filter((r) => r.specialKind).map((r) => r.path)
    return new Set(paths)
  }, [roots])

  const visibleShows = useMemo(
    () => shows.filter((s) => !specialPaths.has(s.folderPath)),
    [shows, specialPaths]
  )

  const sorted = useMemo(() => {
    const arr = [...visibleShows]
    arr.sort((a, b) => {
      if (sort === 'recent') return b.addedAt - a.addedAt
      if (sort === 'year') return (b.year ?? 0) - (a.year ?? 0)
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return a.title.localeCompare(b.title)
    })
    return arr
  }, [visibleShows, sort])

  if (loading) {
    return (
      <div className="px-8 py-10 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">TV Shows</h1>
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

  if (visibleShows.length === 0) {
    return (
      <div className="px-8 py-10 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">TV Shows</h1>
        <div className="card p-10 text-center mt-8">
          <TvIcon className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary">
            No shows yet. Add a TV folder in Settings and run Scan Library.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TV Shows</h1>
          <p className="text-sm text-text-muted">{visibleShows.length} titles</p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="input w-auto"
          title="Sort TV shows"
        >
          <option value="title">A → Z</option>
          <option value="recent">Recently Added</option>
          <option value="year">Release Year</option>
          <option value="rating">Rating</option>
        </select>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {sorted.map((s, idx) => (
          <MediaCard
            key={s.id}
            to={`/show/${s.id}`}
            title={s.title}
            subtitle={s.year ?? null}
            rating={s.rating}
            posterPath={s.posterPath}
            type="show"
            delay={idx * 0.015}
          />
        ))}
      </div>
    </div>
  )
}
