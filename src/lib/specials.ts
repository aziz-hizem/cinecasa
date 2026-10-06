import type { LibraryRoot, Movie, Show, SpecialKind } from '@shared/types'
import { moviesForSpecial, showsForSpecial } from '@shared/specialMembership'

import marvelLogo from '../../assets/Marvel_Logo.svg.webp'
import marvelBg from '../../assets/marvel_background_tab.webp'
import oscarsLogo from '../../assets/oscars_logo_transparent.png'
import oscarsBg from '../../assets/oscars_background.jpg'
import tomJerryLogo from '../../assets/tom_and_jerry_logo_transparent.png'
import tomJerryBg from '../../assets/tom_and_jerry_background.jpg'
import spidermanLogo from '../../assets/spiderman_logo.png'
import spidermanBg from '../../assets/spiderman_background.jpg'
import piratesLogo from '../../assets/pirates_of_the_caribbean_logo.png'
import piratesBg from '../../assets/pirates_of_the_caribbean_background.jpg'

export { moviesForSpecial, showsForSpecial, specialRootPaths } from '@shared/specialMembership'

export interface SpecialDef {
  kind: SpecialKind
  /** Display name used in headings and the Settings dropdown. */
  name: string
  /** One-liner shown under the name on the chooser card. */
  blurb: string
  logo: string
  background: string
  /** Which library-root type this special's folder is registered as. */
  rootType: 'movies' | 'tv'
  /** "r,g,b" triplet driving the per-special glow / ring colour. */
  glow: string
  /**
   * How titles find their way in.
   *  'auto'   — matched against a hardcoded franchise manifest wherever they
   *             sit in the library. Nothing to configure.
   *  'folder' — the user registers a dedicated folder in Settings. Needed for
   *             collections TMDB can't identify as a set (Oscars, Tom & Jerry).
   *
   * A manually registered folder is always honoured on top of auto-matching,
   * so an 'auto' franchise can still be force-fed extras via a special root.
   */
  detection: 'auto' | 'folder'
  /**
   * True when the special is inherently one TV series, so landing on it should
   * jump straight into that series instead of showing a hub of one card.
   */
  singleSeries?: boolean
}

/**
 * Every special the app knows about. Adding one here automatically surfaces it
 * in the Specials chooser, the Settings "Add Specials" menu, and gives it a
 * themed hub page — no other wiring required.
 */
export const SPECIALS: SpecialDef[] = [
  {
    kind: 'oscars',
    name: 'The Oscars',
    blurb: 'Every ceremony, year by year',
    logo: oscarsLogo,
    background: oscarsBg,
    rootType: 'tv',
    glow: '199,164,72',
    detection: 'folder',
    singleSeries: true,
  },
  {
    kind: 'tom_and_jerry',
    name: 'Tom & Jerry',
    blurb: 'The classic shorts collection',
    logo: tomJerryLogo,
    background: tomJerryBg,
    rootType: 'tv',
    glow: '230,25,56',
    detection: 'folder',
    singleSeries: true,
  },
  {
    kind: 'marvel',
    name: 'Marvel',
    blurb: 'The cinematic universe',
    logo: marvelLogo,
    background: marvelBg,
    rootType: 'movies',
    glow: '237,29,36',
    detection: 'folder',
  },
  {
    kind: 'spiderman',
    name: 'Spider-Man',
    blurb: 'Every web-slinger on film',
    logo: spidermanLogo,
    background: spidermanBg,
    rootType: 'movies',
    glow: '227,36,43',
    detection: 'auto',
  },
  {
    kind: 'pirates',
    name: 'Pirates of the Caribbean',
    blurb: 'The full voyage',
    logo: piratesLogo,
    background: piratesBg,
    rootType: 'movies',
    glow: '198,158,86',
    detection: 'folder',
  },
]

export function getSpecial(kind: string | null | undefined): SpecialDef | undefined {
  if (!kind) return undefined
  return SPECIALS.find((s) => s.kind === kind)
}

/**
 * Where clicking a special should land you.
 *
 * A special that *is* a single series (Oscars, Tom & Jerry) jumps straight into
 * it — a hub holding one card is pointless. Franchises always get their hub,
 * even when only one title is owned so far, since more will show up over time.
 */
export function resolveSpecialTarget(
  kind: SpecialKind,
  movies: Movie[],
  shows: Show[],
  roots: LibraryRoot[]
): string {
  const def = getSpecial(kind)
  if (def?.singleSeries) {
    const s = showsForSpecial(shows, roots, kind)
    const m = moviesForSpecial(movies, roots, kind)
    if (s.length === 1 && m.length === 0) return `/show/${s[0].id}`
  }
  return `/specials/${kind}`
}
