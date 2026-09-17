import path from 'node:path'

export interface ParsedMovie {
  kind: 'movie'
  title: string
  year?: number
}

export interface ParsedEpisode {
  kind: 'episode'
  showTitle: string
  season: number
  episode: number
  episodeTitle?: string
  /** Set only by the numbered-fallback branch (e.g. "01. Title") from a bracketed year, if present. */
  airDate?: string | null
  part: number
}

const QUALITY_RE =
  /\b(2160p|1080p|720p|480p|x264|x265|HEVC|H\.?264|BluRay|BDRip|WEB[-.]?DL|WEBRip|HDRip|DVDRip|REMUX|REPACK|EXTENDED|UNCUT|PROPER)\b/i

const VIDEO_EXTS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v'])

export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTS.has(path.extname(filename).toLowerCase())
}

function clean(s: string): string {
  return s.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Strip everything from the first quality marker onward */
function stripQuality(s: string): string {
  const m = s.match(QUALITY_RE)
  if (m && m.index !== undefined) return s.substring(0, m.index)
  return s
}

function parseEpisodePart(raw: string): number | null {
  const s = raw.trim()
  let m = s.match(/(?:^|[._\s-])(?:part|pt)\s*(\d{1,2})\s*$/i)
  if (m) return parseInt(m[1], 10)
  m = s.match(/\((\d{1,2})\)\s*$/)
  if (m) return parseInt(m[1], 10)
  m = s.match(/\[(\d{1,2})\]\s*$/)
  if (m) return parseInt(m[1], 10)
  return null
}

function stripEpisodePart(raw: string): string {
  return raw
    .replace(/(?:^|[._\s-])(?:part|pt)\s*\d{1,2}\s*$/i, '')
    .replace(/\((\d{1,2})\)\s*$/, '')
    .replace(/\[(\d{1,2})\]\s*$/, '')
}

export function parseMovieFilename(filename: string): ParsedMovie {
  const base = filename.replace(/\.[^.]+$/, '')

  // Pattern: "Title (YYYY)"
  let m = base.match(/^(.+?)\s*\((\d{4})\)/)
  if (m) {
    return { kind: 'movie', title: clean(m[1]), year: parseInt(m[2], 10) }
  }

  // Pattern: "Title.YYYY..." or "Title YYYY ..."
  m = base.match(/^(.+?)[.\s_](19|20)(\d{2})(?:[.\s_]|$)/)
  if (m) {
    return {
      kind: 'movie',
      title: clean(m[1]),
      year: parseInt(m[2] + m[3], 10),
    }
  }

  // Fallback: just clean up
  return { kind: 'movie', title: clean(stripQuality(base)) }
}

/**
 * Walk parent dirs (immediate first) and return the first one that doesn't look
 * like a "Season X" / "S01" folder.
 */
function showNameFromParents(parentDirs: string[]): string | null {
  for (const dir of parentDirs) {
    if (/^season[._\s-]*\d+$/i.test(dir)) continue
    if (/^s\d{1,2}$/i.test(dir)) continue
    if (/^specials?$/i.test(dir)) continue
    return clean(dir)
  }
  return null
}

/** Extract a season number from parent dirs (e.g. "Season 2" → 2, "S03" → 3). */
function seasonFromParents(parentDirs: string[]): number | null {
  for (const dir of parentDirs) {
    let m = dir.match(/season[._\s-]*(\d+)/i)
    if (m) return parseInt(m[1], 10)
    m = dir.match(/^s(\d{1,2})$/i)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

export function parseEpisodeFilename(
  filename: string,
  parentDirs: string[] = []
): ParsedEpisode | null {
  const base = filename.replace(/\.[^.]+$/, '')

  // SxxExx pattern (also handles S01E01-E02 — we take the first episode)
  let m = base.match(/[Ss](\d{1,2})[Ee](\d{1,3})/)
  let season: number
  let episode: number
  let titlePart: string
  let afterSE: string

  if (m && m.index !== undefined) {
    season = parseInt(m[1], 10)
    episode = parseInt(m[2], 10)
    titlePart = base.substring(0, m.index).replace(/[-._\s]+$/, '')
    afterSE = base.substring(m.index + m[0].length).replace(/^[-._\s]+/, '')
  } else {
    // 1x05 pattern
    m = base.match(/(?:^|[^\d])(\d{1,2})x(\d{1,3})(?:[^\d]|$)/)
    if (m && m.index !== undefined) {
      season = parseInt(m[1], 10)
      episode = parseInt(m[2], 10)
      const matchStart = m.index + m[0].indexOf(m[1])
      titlePart = base.substring(0, matchStart).replace(/[-._\s]+$/, '')
      afterSE = base
        .substring(matchStart + m[1].length + 1 + m[2].length)
        .replace(/^[-._\s]+/, '')
    } else {
      // Fallback: "NN. Title" or "N. Title" — numbered episodes without S/E marker.
      // Season is inferred from the parent directory name (e.g. "Season 1" → 1).
      m = base.match(/^(\d{1,3})\.\s+(.+)/)
      if (m) {
        return {
          kind: 'episode',
          showTitle: showNameFromParents(parentDirs) ?? '',
          season: seasonFromParents(parentDirs) ?? 1,
          episode: parseInt(m[1], 10),
          episodeTitle: clean(stripQuality(m[2])) || undefined,
          part: 1,
        }
      }
      return null
    }
  }

  // Show name: prefer parsed-from-filename, else from parent dirs
  let showTitle = clean(titlePart)
  if (!showTitle || showTitle.length < 2) {
    showTitle = showNameFromParents(parentDirs) ?? showTitle
  }

  // Episode title: text after S/E up to a quality marker
  let episodeTitle: string | undefined
  const part = afterSE ? parseEpisodePart(afterSE) : null
  const afterClean = afterSE ? stripEpisodePart(afterSE) : afterSE
  if (afterClean) {
    const cleaned = stripQuality(afterClean)
    const candidate = clean(cleaned)
    if (candidate && candidate.length >= 2) {
      episodeTitle = candidate
    }
  }

  return {
    kind: 'episode',
    showTitle,
    season,
    episode,
    episodeTitle,
    part: part ?? 1,
  }
}

/** Pick a stable "show folder" name from a file's parent dirs (Plex/Jellyfin layout). */
export function showFolderName(parentDirs: string[]): string | null {
  return showNameFromParents(parentDirs)
}
