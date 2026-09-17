import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Film, MoreVertical, Pencil, Star, Tv } from 'lucide-react'
import LazyImage from './LazyImage'
import MetadataModal from './MetadataModal'
import { formatRating, imgSrc } from '@/lib/format'

export interface MediaCardProps {
  to: string
  posterPath: string | null
  title: string
  subtitle?: string | number | null
  rating?: number | null
  type: 'movie' | 'show'
  delay?: number
  className?: string
  /** 0–1. When > 0, renders a thin accent-coloured progress bar at the bottom of the poster. */
  progress?: number | null
  /** If provided the 3-dot edit menu appears on hover. */
  itemId?: number
  metadataLocked?: boolean
  tmdbId?: number | null
  /** Called after a successful metadata update so the parent can refetch. */
  onUpdated?: () => void
}

export default function MediaCard({
  to,
  posterPath,
  title,
  subtitle,
  rating,
  type,
  delay = 0,
  className = '',
  progress,
  itemId,
  metadataLocked = false,
  tmdbId = null,
  onUpdated,
}: MediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const FallbackIcon = type === 'movie' ? Film : Tv
  const editable = itemId !== undefined

  function handleMenuClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  function handleEditClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    setModalOpen(true)
  }

  function handleUpdated() {
    setModalOpen(false)
    onUpdated?.()
  }

  const showProgress = progress !== null && progress !== undefined && progress > 0 && progress < 1

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        whileHover={{ scale: 1.04, transition: { duration: 0.18 } }}
        className={`group relative ${className}`}
      >
        <Link to={to} className="block">
          <div className="aspect-[2/3] rounded-card overflow-hidden bg-bg-card border border-border-subtle relative shadow-md group-hover:shadow-2xl group-hover:shadow-black/40 group-hover:border-accent/40 transition-shadow">
            <LazyImage
              src={imgSrc(posterPath)}
              alt={title}
              className="w-full h-full object-cover"
              fallback={<FallbackIcon className="w-10 h-10" />}
            />
            {rating !== null && rating !== undefined && rating > 0 && (
              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1 text-xs">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="tabular-nums">{formatRating(rating)}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Watch progress bar */}
            {showProgress && <PosterProgressBar ratio={progress!} />}
          </div>
          <div className="mt-2 px-0.5">
            <h3 className="text-sm font-medium truncate group-hover:text-accent transition-colors">
              {title}
            </h3>
            {subtitle != null && subtitle !== '' && (
              <p className="text-xs text-text-muted">{subtitle}</p>
            )}
          </div>
        </Link>

        {/* 3-dot menu — only when editable */}
        {editable && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative">
              <button
                type="button"
                onClick={handleMenuClick}
                className="w-7 h-7 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center hover:bg-black/90 transition-colors"
                title="Edit metadata"
              >
                <MoreVertical className="w-3.5 h-3.5 text-white" />
              </button>

              {menuOpen && (
                <>
                  {/* Click-away backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                  />
                  <div className="absolute left-0 top-8 z-50 bg-bg-card border border-border-subtle rounded-card shadow-2xl py-1 min-w-[160px]">
                    <button
                      type="button"
                      onClick={handleEditClick}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-bg-hover/50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-text-muted" />
                      Edit Metadata
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal portal */}
      {editable && (
        <MetadataModal
          isOpen={modalOpen}
          itemType={type}
          itemId={itemId!}
          currentTitle={title}
          currentTmdbId={tmdbId}
          metadataLocked={metadataLocked}
          onClose={() => setModalOpen(false)}
          onUpdated={handleUpdated}
        />
      )}
    </>
  )
}

/** Thin accent bar at the very bottom of the poster image, set imperatively to avoid inline-style lint warnings. */
function PosterProgressBar({ ratio }: { ratio: number }) {
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
