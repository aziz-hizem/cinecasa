import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  children: React.ReactNode
}

/**
 * Netflix-style horizontal row with smooth scroll-by-page arrows.
 * Children must be flex items (e.g. MediaCards). Card width control belongs to the caller.
 */
export default function MediaRow({ title, subtitle, children }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function update() {
    const el = scrollerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    update()
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => update()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="relative group/row">
      <div className="flex items-baseline justify-between mb-3 px-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Left chevron */}
        {canLeft && (
          <button
            onClick={() => scrollBy(-1)}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-gradient-to-r from-bg via-bg/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <div className="w-9 h-9 rounded-full bg-bg-card/90 border border-border-subtle flex items-center justify-center hover:bg-bg-hover transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </button>
        )}

        {/* Right chevron */}
        {canRight && (
          <button
            onClick={() => scrollBy(1)}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-gradient-to-l from-bg via-bg/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <div className="w-9 h-9 rounded-full bg-bg-card/90 border border-border-subtle flex items-center justify-center hover:bg-bg-hover transition-colors">
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        )}

        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-8 pb-4 scroll-smooth"
        >
          {children}
        </div>
      </div>
    </section>
  )
}
