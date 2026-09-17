import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import type { LibraryRoot, Movie, Show } from '@shared/types'
import {
  SPECIALS,
  moviesForSpecial,
  resolveSpecialTarget,
  showsForSpecial,
  type SpecialDef,
} from '@/lib/specials'

interface Entry {
  def: SpecialDef
  to: string
  count: number
  /** True once the special actually has something to show. */
  ready: boolean
  /** Folder-based special that still needs a folder registered in Settings. */
  needsSetup: boolean
}

export default function Specials() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [roots, setRoots] = useState<LibraryRoot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
  }, [])

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

  const entries = useMemo<Entry[]>(
    () =>
      SPECIALS.map((def) => {
        const hasRoot = roots.some((r) => r.specialKind === def.kind)
        // Auto specials pull from anywhere in the library, so always count both.
        const count =
          moviesForSpecial(movies, roots, def.kind).length +
          showsForSpecial(shows, roots, def.kind).length
        return {
          def,
          count,
          ready: count > 0,
          needsSetup: def.detection === 'folder' && !hasRoot,
          to: resolveSpecialTarget(def.kind, movies, shows, roots),
        }
      }),
    [movies, shows, roots]
  )

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-300" />
          Specials
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Hand-picked collections. Pick one to dive in.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {SPECIALS.map((s) => (
            <div key={s.kind} className="aspect-[16/9] rounded-card bg-bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {entries.map((entry) => (
            <SpecialCard key={entry.def.kind} entry={entry} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function SpecialCard({ entry }: { entry: Entry }) {
  const { def, to, count, ready, needsSetup } = entry

  const subtitle = ready
    ? `${count} title${count === 1 ? '' : 's'}`
    : needsSetup
      ? 'Not set up yet'
      : 'None in library'

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } },
      }}
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
      whileTap={{ scale: 0.985 }}
    >
      <Link
        to={to}
        title={def.name}
        className="group relative block aspect-[16/9] rounded-card overflow-hidden border border-border-subtle bg-bg-card transition-shadow duration-300"
      >
        {/* Background art */}
        <img
          src={def.background}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07] ${
            ready ? '' : 'grayscale'
          }`}
        />

        {/* Scrims — darker at rest, lifting on hover so the art comes alive */}
        <div className="absolute inset-0 bg-black/55 group-hover:bg-black/35 transition-colors duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Coloured glow ring on hover */}
        <div
          className="absolute inset-0 rounded-card opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            boxShadow: `inset 0 0 0 1px rgba(${def.glow},0.55), 0 0 34px -6px rgba(${def.glow},0.5)`,
          }}
        />

        {/* Logo */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <img
            src={def.logo}
            alt={def.name}
            className="max-h-[52%] max-w-[74%] w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            style={{ filter: `drop-shadow(0 6px 20px rgba(0,0,0,0.75))` }}
          />
        </div>

        {/* Footer meta */}
        <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate drop-shadow">{def.name}</h2>
            <p className="text-xs text-white/60 truncate">{def.blurb}</p>
          </div>
          <span
            className={`text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap backdrop-blur-sm border ${
              ready
                ? 'bg-black/50 border-white/15 text-white/85'
                : 'bg-black/50 border-white/10 text-white/45'
            }`}
          >
            {subtitle}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
