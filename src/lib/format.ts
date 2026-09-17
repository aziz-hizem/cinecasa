/**
 * Convert a cached image key (e.g. "w500/abc.jpg") into a URL the renderer can
 * load via the cinecasa-img:// custom protocol.
 */
export function imgSrc(key: string | null | undefined): string | undefined {
  if (!key) return undefined
  return `cinecasa-img:///${encodeURI(key)}`
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function formatYear(date: string | null | undefined): string {
  if (!date) return ''
  return date.slice(0, 4)
}

export function formatRating(r: number | null | undefined): string {
  if (r == null) return ''
  return r.toFixed(1)
}

/** Format a millisecond position as h:mm:ss or m:ss. */
export function formatPosition(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
