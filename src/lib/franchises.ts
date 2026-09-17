import type { Movie, Show, SpecialKind } from '@shared/types'

/**
 * A hardcoded roster of the titles that make up a franchise.
 *
 * Membership is decided by TMDB id, which is exact and survives any file naming
 * scheme — "spider.man.2002.1080p.mkv" and "Spider-Man (2002).mkv" both resolve
 * to movie 557 during a scan, so both land in the franchise automatically.
 *
 * `titlePatterns` is a safety net for items the scanner never matched against
 * TMDB (tmdbId is null) or that resolve to an edition/cut with a different id.
 *
 * To add a franchise: write a manifest here, then point a SpecialDef at it with
 * `detection: 'auto'`. No scanning, schema, or migration work is involved.
 */
export interface FranchiseManifest {
  /** TMDB movie ids belonging to the franchise. */
  movieTmdbIds: number[]
  /** TMDB TV-show ids belonging to the franchise. */
  tvTmdbIds: number[]
  /**
   * Fallback title matchers, used only when the TMDB id didn't match.
   * Keep these tight — a loose pattern drags unrelated titles in.
   * Must not use the /g flag (stateful `lastIndex` breaks repeat `.test()`).
   */
  titlePatterns?: RegExp[]
}

/**
 * Spider-Man — every theatrical film plus every TV series.
 *
 * Deliberately excludes Sony's Spider-Man Universe spin-offs (Venom, Morbius,
 * Madame Web, Kraven): they share a rights package, not a protagonist. If you
 * want them, add their ids to `movieTmdbIds` below.
 */
const SPIDERMAN: FranchiseManifest = {
  movieTmdbIds: [
    // ── Sam Raimi trilogy ──
    557,     // Spider-Man (2002)
    558,     // Spider-Man 2 (2004)
    559,     // Spider-Man 3 (2007)
    // ── Marc Webb duology ──
    1930,    // The Amazing Spider-Man (2012)
    102382,  // The Amazing Spider-Man 2 (2014)
    // ── Marvel Cinematic Universe ──
    315635,  // Spider-Man: Homecoming (2017)
    429617,  // Spider-Man: Far From Home (2019)
    634649,  // Spider-Man: No Way Home (2021)
    969681,  // Spider-Man: Brand New Day (2026)
    // ── Spider-Verse (animated) ──
    324857,  // Spider-Man: Into the Spider-Verse (2018)
    569094,  // Spider-Man: Across the Spider-Verse (2023)
    911916,  // Spider-Man: Beyond the Spider-Verse (2027)
  ],
  tvTmdbIds: [
    1482,    // Spider-Man (1967)
    2640,    // Japanese Spiderman (1978)
    4552,    // The Amazing Spider-Man (1978, live action)
    3973,    // Spider-Man (1981)
    1269,    // Spider-Man and His Amazing Friends (1981)
    888,     // Spider-Man: The Animated Series (1994)
    10079,   // Spider-Man Unlimited (1999)
    1664,    // Spider-Man: The New Animated Series (2003)
    3854,    // The Spectacular Spider-Man (2008)
    34391,   // Marvel's Ultimate Spider-Man (2012)
    72705,   // Marvel's Spider-Man (2017)
    127635,  // Spidey and His Amazing Friends (2021)
    138503,  // Your Friendly Neighborhood Spider-Man (2025)
    220102,  // Spider-Noir (2026)
  ],
  // Catches "Spider-Man", "Spiderman", "Spider Man", "Spidey", "Spider-Verse".
  titlePatterns: [/\bspider[\s._-]?(man|verse)\b/i, /\bspidey\b/i],
}

export const FRANCHISES: Partial<Record<SpecialKind, FranchiseManifest>> = {
  spiderman: SPIDERMAN,
}

// ─── Matching ────────────────────────────────────────────────────────────────

const matchesTitle = (title: string, m: FranchiseManifest) =>
  m.titlePatterns?.some((re) => re.test(title)) ?? false

export function movieInFranchise(movie: Movie, m: FranchiseManifest): boolean {
  if (movie.tmdbId !== null && m.movieTmdbIds.includes(movie.tmdbId)) return true
  return matchesTitle(movie.title, m)
}

export function showInFranchise(show: Show, m: FranchiseManifest): boolean {
  if (show.tmdbId !== null && m.tvTmdbIds.includes(show.tmdbId)) return true
  return matchesTitle(show.title, m)
}
