import type { LibraryRoot, Movie, Show, SpecialKind } from './types'
import { FRANCHISES, movieInFranchise, showInFranchise } from './franchises'

// Which library titles belong to a special. Shared by the desktop UI and the
// tablet streaming server so both always agree.

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()

/** Root paths registered under a given special kind, normalised for comparison. */
export function specialRootPaths(roots: LibraryRoot[], kind: SpecialKind): string[] {
  return roots.filter((r) => r.specialKind === kind).map((r) => norm(r.path))
}

/**
 * Movies belonging to a special: anything matched by its franchise manifest,
 * plus anything sitting under a folder the user registered for it.
 */
export function moviesForSpecial(
  movies: Movie[],
  roots: LibraryRoot[],
  kind: SpecialKind
): Movie[] {
  const paths = specialRootPaths(roots, kind)
  const manifest = FRANCHISES[kind]
  if (paths.length === 0 && !manifest) return []
  return movies.filter((m) => {
    if (manifest && movieInFranchise(m, manifest)) return true
    if (paths.length === 0) return false
    const fp = norm(m.filePath)
    return paths.some((p) => fp.startsWith(p))
  })
}

/**
 * Shows belonging to a special: anything matched by its franchise manifest,
 * plus anything sitting under a folder the user registered for it.
 */
export function showsForSpecial(
  shows: Show[],
  roots: LibraryRoot[],
  kind: SpecialKind
): Show[] {
  const paths = specialRootPaths(roots, kind)
  const manifest = FRANCHISES[kind]
  if (paths.length === 0 && !manifest) return []
  return shows.filter((s) => {
    if (manifest && showInFranchise(s, manifest)) return true
    if (paths.length === 0) return false
    const fp = norm(s.folderPath)
    return paths.some((p) => fp.startsWith(p))
  })
}
