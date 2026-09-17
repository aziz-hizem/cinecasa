import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Play, Info, Star } from 'lucide-react'
import type { Movie, Show } from '@shared/types'
import { formatRating, imgSrc } from '@/lib/format'
import LazyImage from './LazyImage'

export type HeroItem =
  | { kind: 'movie'; movie: Movie }
  | { kind: 'show'; show: Show }

interface Props {
  items: HeroItem[]
  /** Auto-rotate index every N ms. Default off (0). */
  rotateMs?: number
  activeIndex?: number
  onIndexChange?: (i: number) => void
}

function getProps(item: HeroItem) {
  if (item.kind === 'movie') {
    const m = item.movie
    return {
      id: m.id,
      kindLabel: 'movie' as const,
      title: m.title,
      year: m.year,
      rating: m.rating,
      overview: m.overview,
      backdrop: m.backdropPath,
      logo: m.logoPath,
      meta: null, // the year is already shown on its own
    }
  }
  const s = item.show
  return {
    id: s.id,
    kindLabel: 'show' as const,
    title: s.title,
    year: s.year,
    rating: s.rating,
    overview: s.overview,
    backdrop: s.backdropPath,
    logo: s.logoPath,
    meta: s.status,
  }
}

export default function HeroBanner({
  items,
  rotateMs = 0,
  activeIndex,
  onIndexChange,
}: Props) {
  const navigate = useNavigate()
  const [uncontrolledIndex, setUncontrolledIndex] = useState(0)
  const internalIndex = activeIndex ?? uncontrolledIndex

  function setIndex(i: number) {
    if (activeIndex === undefined) setUncontrolledIndex(i)
    onIndexChange?.(i)
  }

  useEffect(() => {
    if (rotateMs <= 0 || items.length < 2) return
    const t = window.setInterval(() => {
      setIndex((internalIndex + 1) % items.length)
    }, rotateMs)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateMs, items.length, internalIndex])

  const item = items[internalIndex]
  if (!item) return null

  const p = getProps(item)
  const backdrop = imgSrc(p.backdrop)

  return (
    <div className="relative h-[70vh] min-h-[480px] -mt-px overflow-hidden">
      {/* Backdrop crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={p.id + '-' + p.kindLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {backdrop ? (
            <div className="absolute inset-0 ken-burns">
              <LazyImage
                src={backdrop}
                alt={p.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-bg-card via-bg to-bg" />
          )}
          <div className="absolute inset-0 hero-gradient-side" />
          <div className="absolute inset-0 hero-gradient" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative h-full flex items-end pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={p.id + '-' + p.kindLabel + '-content'}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="px-12 max-w-3xl"
          >
            {/* Logo or title */}
            {p.logo ? (
              <img
                src={imgSrc(p.logo)}
                alt={p.title}
                className="max-h-32 max-w-[420px] mb-4 drop-shadow-2xl"
              />
            ) : (
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-3 drop-shadow-2xl">
                {p.title}
              </h1>
            )}

            {/* Meta line */}
            <div className="flex items-center gap-3 mb-4 text-sm text-text-secondary">
              {p.rating !== null && p.rating !== undefined && p.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="tabular-nums text-white font-medium">
                    {formatRating(p.rating)}
                  </span>
                </span>
              )}
              {p.year && <span className="tabular-nums">{p.year}</span>}
              {p.meta && <span className="capitalize">{p.meta}</span>}
              <span className="uppercase text-[10px] tracking-widest text-text-muted ml-2">
                {p.kindLabel === 'movie' ? 'Movie' : 'TV Series'}
              </span>
            </div>

            {/* Overview */}
            {p.overview && (
              <p className="text-base text-text-secondary line-clamp-3 max-w-2xl leading-relaxed mb-6">
                {p.overview}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/${p.kindLabel}/${p.id}`)}
                className="btn-primary px-6 py-3 text-base"
              >
                <Play className="w-5 h-5 fill-white" />
                Play
              </button>
              <button
                onClick={() => navigate(`/${p.kindLabel}/${p.id}`)}
                className="btn-secondary px-6 py-3 text-base bg-white/10 hover:bg-white/20 border-white/20 text-white"
              >
                <Info className="w-5 h-5" />
                More Info
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination dots */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-12 flex items-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1 rounded-full transition-all ${
                i === internalIndex
                  ? 'w-8 bg-white'
                  : 'w-4 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Show item ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
