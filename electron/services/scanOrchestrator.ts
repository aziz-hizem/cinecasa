import path from 'node:path'
import type { LibraryRoot, ScanMode, ScanProgressEvent, ScanResult } from '@shared/types'
import {
  castRepo,
  episodesRepo,
  libraryRootsRepo,
  moviesRepo,
  seasonsRepo,
  settingsRepo,
  showsRepo,
} from '../db/queries'
import { cacheImage } from './imageCache'
import {
  parseEpisodeFilename,
  parseMovieFilename,
  showFolderName,
} from './parser'
import { scanDirectory, type ScannedFile } from './scanner'
import {
  TmdbClient,
  type TmdbCastMember,
  type TmdbMovie,
  type TmdbSeason,
  type TmdbShow,
} from './tmdb'

export type ProgressEmit = (e: ScanProgressEvent) => void

interface RunOptions {
  onProgress?: ProgressEmit
  roots?: LibraryRoot[]
  mode?: ScanMode
}

const OSCARS_TMDB_ID = 27023

/**
 * Walk all configured roots, parse files, fetch TMDB metadata (if API key set),
 * cache images, and upsert into the DB.
 */
export async function runFullScan(opts: RunOptions = {}): Promise<ScanResult> {
  const emit: ProgressEmit = opts.onProgress ?? (() => {})

  const result: ScanResult = {
    moviesAdded: 0,
    moviesUpdated: 0,
    showsAdded: 0,
    showsUpdated: 0,
    episodesAdded: 0,
    episodesUpdated: 0,
    unmatched: [],
    errors: [],
  }

  emit({ stage: 'starting' })

  const settings = settingsRepo.getAll()
  const tmdb = settings.tmdbApiKey ? new TmdbClient(settings.tmdbApiKey) : null
  const roots = opts.roots ?? libraryRootsRepo.list()
  const scanMode: ScanMode = opts.mode ?? 'full'
  const rootsByPath = new Map(roots.map((r) => [r.path, r]))

  if (roots.length === 0) {
    result.errors.push('No library roots configured. Add folders in Settings.')
    return result
  }

  // ---------- Pass 1: scan all files ----------
  let movieFiles: ScannedFile[] = []
  let tvFiles: ScannedFile[] = []
  for (const root of roots) {
    emit({ stage: 'scanning', rootPath: root.path })
    const files = await scanDirectory(root.path)
    if (root.type === 'movies') movieFiles.push(...files)
    else tvFiles.push(...files)
  }

  if (scanMode === 'new') {
    movieFiles = movieFiles.filter((f) => !moviesRepo.existsByFilePath(f.path))
    tvFiles = tvFiles.filter((f) => !episodesRepo.existsByFilePath(f.path))
  }

  // ---------- Pass 2: movies ----------
  const totalMovies = movieFiles.length
  let movieIdx = 0
  for (const file of movieFiles) {
    movieIdx++
    const filename = path.basename(file.path)
    const parsed = parseMovieFilename(filename)
    emit({
      stage: 'fetching',
      current: movieIdx,
      total: totalMovies + tvFiles.length,
      label: `Movie: ${parsed.title}`,
    })

    try {
      // Skip TMDB fetch for movies with locked metadata (DB upsert will only
      // touch file_size / last_scanned_at anyway, but we avoid the API call).
      const existingMovie = moviesRepo.getByFilePath(file.path)
      if (existingMovie?.metadataLocked) {
        const upsert = moviesRepo.upsert({
          filePath: file.path, fileSize: file.size,
          tmdbId: existingMovie.tmdbId, title: existingMovie.title,
          originalTitle: existingMovie.originalTitle, year: existingMovie.year,
          overview: existingMovie.overview, tagline: existingMovie.tagline,
          runtime: existingMovie.runtime, rating: existingMovie.rating,
          releaseDate: existingMovie.releaseDate, genres: existingMovie.genres,
          posterPath: existingMovie.posterPath, backdropPath: existingMovie.backdropPath,
          logoPath: existingMovie.logoPath,
        })
        if (upsert.isNew) result.moviesAdded++
        else result.moviesUpdated++
        continue
      }

      let tmdbData: TmdbMovie | null = null
      if (tmdb) {
        const sr = await tmdb.searchMovie(parsed.title, parsed.year)
        if (sr.results.length > 0) {
          tmdbData = await tmdb.getMovie(sr.results[0].id)
        } else if (parsed.year) {
          // try without year, the year might be wrong
          const sr2 = await tmdb.searchMovie(parsed.title)
          if (sr2.results.length > 0) {
            tmdbData = await tmdb.getMovie(sr2.results[0].id)
          }
        }
      }

      const posterPath = tmdbData
        ? await cacheImage(tmdb!.imageUrl(tmdbData.poster_path, 'w500'))
        : null
      const backdropPath = tmdbData
        ? await cacheImage(tmdb!.imageUrl(tmdbData.backdrop_path, 'w1280'))
        : null
      const logo = tmdbData?.images?.logos?.[0]?.file_path
      const logoPath = logo ? await cacheImage(tmdb!.imageUrl(logo, 'w500')) : null

      const upsert = moviesRepo.upsert({
        filePath: file.path,
        fileSize: file.size,
        tmdbId: tmdbData?.id ?? null,
        title: tmdbData?.title ?? parsed.title,
        originalTitle: tmdbData?.original_title ?? null,
        year:
          parsed.year ??
          (tmdbData?.release_date ? Number(tmdbData.release_date.slice(0, 4)) : null),
        overview: tmdbData?.overview ?? null,
        tagline: tmdbData?.tagline ?? null,
        runtime: tmdbData?.runtime ?? null,
        rating: tmdbData?.vote_average ?? null,
        releaseDate: tmdbData?.release_date ?? null,
        genres: tmdbData?.genres?.map((g) => g.name) ?? [],
        posterPath,
        backdropPath,
        logoPath,
      })

      if (upsert.isNew) result.moviesAdded++
      else result.moviesUpdated++

      if (tmdbData?.credits?.cast && !upsert.isLocked) {
        await replaceCast(tmdb!, 'movie', upsert.id, tmdbData.credits.cast.slice(0, 10))
      }

      if (!tmdbData && !upsert.isLocked) result.unmatched.push(filename)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${filename}: ${msg}`)
    }
  }

  // ---------- Pass 3: TV — group by show folder ----------
  // Group key: absolute path to the show's folder under the root.
  interface ShowGroup {
    folderPath: string
    rawShowName: string
    specialKind?: string | null
    forcedTmdbId?: number | null
    files: {
      file: ScannedFile
      season: number
      episode: number
      part: number
      epTitle?: string
      airDate?: string | null
    }[]
  }
  const groups = new Map<string, ShowGroup>()

  for (const file of tvFiles) {
    const filename = path.basename(file.path)
    const root = rootsByPath.get(file.rootPath)
    const specialKind = root?.specialKind ?? null
    const parsed =
      specialKind === 'oscars' ? parseOscarsEpisode(file)
      : specialKind === 'tom_and_jerry' ? parseTomAndJerryEpisode(file)
      : parseEpisodeFilename(filename, file.parentDirs)
    if (!parsed) {
      result.unmatched.push(filename)
      continue
    }

    // Determine the show folder: topmost dir under the root that is NOT a season folder
    const showDirName = showFolderName(file.parentDirs) ?? parsed.showTitle
    const topmostParent =
      file.parentDirs.length > 0 ? file.parentDirs[file.parentDirs.length - 1] : null
    const showFolder = findShowFolderName(file.parentDirs)
    const derivedFromTopmost = topmostParent ? stripSeasonSuffix(topmostParent) : null
    const rootName = path.basename(file.rootPath)
    const safeShowName = showDirName && showDirName.trim().length > 1 ? showDirName : null

    let folderPath: string
    let rawShowName: string

    if (specialKind === 'oscars') {
      folderPath = file.rootPath
      rawShowName = 'The Oscars'
    } else if (specialKind === 'tom_and_jerry') {
      folderPath = file.rootPath
      rawShowName = path.basename(file.rootPath)
    } else if (showFolder) {
      folderPath = path.join(file.rootPath, showFolder)
      rawShowName = safeShowName ?? showFolder ?? rootName
    } else if (derivedFromTopmost) {
      folderPath = path.join(file.rootPath, derivedFromTopmost)
      rawShowName = safeShowName ?? derivedFromTopmost ?? rootName
    } else if (
      file.parentDirs.length === 0 ||
      (file.parentDirs.length === 1 && isSeasonFolderName(file.parentDirs[0]))
    ) {
      // If the library root is the show folder itself, group all seasons together.
      folderPath = file.rootPath
      rawShowName = safeShowName ?? rootName
    } else {
      // Fallback: group by topmost parent under the root.
      folderPath = path.join(file.rootPath, topmostParent ?? file.rootPath)
      rawShowName = safeShowName ?? topmostParent ?? rootName
    }

    let group = groups.get(folderPath)
    if (!group) {
      group = {
        folderPath,
        rawShowName,
        specialKind,
        forcedTmdbId: specialKind === 'oscars' ? OSCARS_TMDB_ID : null,
        files: [],
      }
      groups.set(folderPath, group)
    }
    group.files.push({
      file,
      season: parsed.season,
      episode: parsed.episode,
      part: parsed.part ?? 1,
      epTitle: parsed.episodeTitle,
      airDate: 'airDate' in parsed ? (parsed.airDate ?? null) : null,
    })
  }

  let groupIdx = 0
  const groupCount = groups.size
  for (const group of groups.values()) {
    groupIdx++
    emit({
      stage: 'fetching',
      current: totalMovies + groupIdx,
      total: totalMovies + groupCount,
      label: `Show: ${group.rawShowName}`,
    })

    try {
      // If the show is locked, skip TMDB search and reuse stored data.
      // The upsert will only update last_scanned_at for locked records.
      const existingShow = showsRepo.getByFolderPath(group.folderPath)
      const showIsLocked = existingShow?.metadataLocked ?? false

      let showData: TmdbShow | null = null
      // Set when a *known* show's TMDB refetch throws (network hiccup, or TMDB's
      // own server erroring on this title). In that case we must not treat the
      // failure like "no match" — that would blank out perfectly good metadata
      // that was already stored. Instead we fall back to what's already in the DB.
      let showFetchFailed = false
      if (tmdb) {
        const forcedId = group.forcedTmdbId ?? null
        const existingId = existingShow?.tmdbId ?? null
        const tmdbId = forcedId ?? existingId

        if (tmdbId) {
          try {
            showData = await tmdb.getShow(tmdbId)
          } catch (e) {
            showData = null
            showFetchFailed = true
            const msg = e instanceof Error ? e.message : String(e)
            result.errors.push(
              `${group.rawShowName}: kept existing metadata — TMDB refresh failed (${msg})`
            )
          }
        } else if (!showIsLocked) {
          const sr = await tmdb.searchTv(group.rawShowName)
          if (sr.results.length > 0) {
            showData = await tmdb.getShow(sr.results[0].id)
          }
        }
      }

      // Only used when the refetch of an already-matched show failed — preserves
      // its previous fields instead of letting them get overwritten with nulls.
      const fallback = showFetchFailed ? existingShow : null

      const posterPath = showData
        ? await cacheImage(tmdb!.imageUrl(showData.poster_path, 'w500'))
        : (fallback?.posterPath ?? null)
      const backdropPath = showData
        ? await cacheImage(tmdb!.imageUrl(showData.backdrop_path, 'w1280'))
        : (fallback?.backdropPath ?? null)
      const logo = showData?.images?.logos?.[0]?.file_path
      const logoPath = logo
        ? await cacheImage(tmdb!.imageUrl(logo, 'w500'))
        : (fallback?.logoPath ?? null)

      const showUpsert = showsRepo.upsert({
        folderPath: group.folderPath,
        tmdbId: showData?.id ?? fallback?.tmdbId ?? group.forcedTmdbId ?? null,
        title: showData?.name ?? fallback?.title ?? group.rawShowName,
        originalTitle: showData?.original_name ?? fallback?.originalTitle ?? null,
        year: showData?.first_air_date
          ? Number(showData.first_air_date.slice(0, 4))
          : (fallback?.year ?? null),
        overview: showData?.overview ?? fallback?.overview ?? null,
        status: showData?.status ?? fallback?.status ?? null,
        rating: showData?.vote_average ?? fallback?.rating ?? null,
        firstAirDate: showData?.first_air_date ?? fallback?.firstAirDate ?? null,
        genres: showData?.genres?.map((g) => g.name) ?? fallback?.genres ?? [],
        posterPath,
        backdropPath,
        logoPath,
      })
      if (showUpsert.isNew) result.showsAdded++
      else result.showsUpdated++

      if (showData?.credits?.cast && !showUpsert.isLocked) {
        await replaceCast(
          tmdb!,
          'show',
          showUpsert.id,
          showData.credits.cast.slice(0, 10)
        )
      }

      // Group episode files by season number
      const seasonNumbers = new Set(group.files.map((f) => f.season))
      const seasonDataCache = new Map<number, TmdbSeason | null>()

      for (const seasonNumber of seasonNumbers) {
        let seasonData: TmdbSeason | null = null
        if (showData && tmdb) {
          try {
            seasonData = await tmdb.getSeason(showData.id, seasonNumber)
          } catch {
            seasonData = null
          }
        }
        seasonDataCache.set(seasonNumber, seasonData)

        const seasonPoster = seasonData
          ? await cacheImage(tmdb!.imageUrl(seasonData.poster_path, 'w500'))
          : null

        const seasonId = seasonsRepo.upsert({
          showId: showUpsert.id,
          seasonNumber,
          // null (not a "Season N" default) when TMDB data is unavailable this
          // pass, so COALESCE in the repo preserves whatever name is already
          // stored instead of clobbering it — the default only applies on insert.
          name: seasonData?.name ?? null,
          overview: seasonData?.overview ?? null,
          posterPath: seasonPoster,
          airDate: seasonData?.air_date ?? null,
          episodeCount: seasonData?.episodes?.length ?? null,
        })

        // Now upsert episodes for this season (dedupe by episode number)
        const epsForSeason = group.files.filter((f) => f.season === seasonNumber)
        const episodeMap = new Map<
          string,
          { file: ScannedFile; epTitle?: string; airDate?: string | null; episode: number; part: number; duplicates: ScannedFile[] }
        >()

        for (const ef of epsForSeason) {
          const part = ef.part ?? 1
          const key = `${ef.episode}-${part}`
          const existing = episodeMap.get(key)
          if (!existing) {
            episodeMap.set(key, {
              file: ef.file,
              epTitle: ef.epTitle,
              airDate: ef.airDate,
              episode: ef.episode,
              part,
              duplicates: [],
            })
            continue
          }

          const existingSize = existing.file.size ?? 0
          const currentSize = ef.file.size ?? 0
          if (currentSize > existingSize) {
            existing.duplicates.push(existing.file)
            existing.file = ef.file
            if (!existing.epTitle && ef.epTitle) existing.epTitle = ef.epTitle
            if (!existing.airDate && ef.airDate) existing.airDate = ef.airDate
          } else {
            existing.duplicates.push(ef.file)
          }
        }

        for (const entry of episodeMap.values()) {
          const { episode: episodeNumber, part: episodePart } = entry
          const tmdbEp = seasonData?.episodes?.find(
            (e) => e.episode_number === episodeNumber
          )

          // For Tom & Jerry: each short is a TMDB movie — search by title + year.
          let tjMovieStill: string | null = null
          let tjOverview: string | null = null
          let tjAirDate: string | null = null
          let tjRuntime: number | null = null
          let tjRating: number | null = null
          let tjTitle: string | null = null
          if (group.specialKind === 'tom_and_jerry' && tmdb && entry.epTitle) {
            try {
              const year = entry.airDate ? parseInt(entry.airDate.slice(0, 4), 10) : undefined
              const sr = await tmdb.searchMovie(entry.epTitle, year)
              if (sr.results.length > 0) {
                const movie = await tmdb.getMovie(sr.results[0].id)
                const imagePath = movie.backdrop_path ?? movie.poster_path ?? null
                tjMovieStill = imagePath ? await cacheImage(tmdb.imageUrl(imagePath, 'w500')) : null
                tjTitle = movie.title ?? null
                tjOverview = movie.overview ?? null
                tjAirDate = movie.release_date ?? null
                tjRuntime = movie.runtime ?? null
                tjRating = movie.vote_average ?? null
              }
            } catch { /* skip — leave fields null */ }
          }

          const stillPath = group.specialKind === 'tom_and_jerry'
            ? tjMovieStill
            : tmdbEp
              ? await cacheImage(tmdb!.imageUrl(tmdbEp.still_path, 'w300'))
              : null

          const epUpsert = episodesRepo.upsert({
            showId: showUpsert.id,
            seasonId,
            seasonNumber,
            episodeNumber,
            episodePart,
            title: group.specialKind === 'tom_and_jerry'
              ? (tjTitle ?? entry.epTitle ?? null)
              : (tmdbEp?.name ?? entry.epTitle ?? null),
            overview: group.specialKind === 'tom_and_jerry'
              ? tjOverview
              : (tmdbEp?.overview ?? null),
            stillPath,
            airDate: group.specialKind === 'tom_and_jerry'
              ? (tjAirDate ?? entry.airDate ?? null)
              : (tmdbEp?.air_date ?? null),
            runtime: group.specialKind === 'tom_and_jerry'
              ? tjRuntime
              : (tmdbEp?.runtime ?? null),
            rating: group.specialKind === 'tom_and_jerry'
              ? tjRating
              : (tmdbEp?.vote_average ?? null),
            filePath: entry.file.path,
            fileSize: entry.file.size,
          })
          if (epUpsert.isNew) result.episodesAdded++
          else result.episodesUpdated++

          if (entry.duplicates.length > 0) {
            const code = `S${String(seasonNumber).padStart(2, '0')}E${String(
              episodeNumber
            ).padStart(2, '0')}`
            const partLabel = episodePart > 1 ? ` Part ${episodePart}` : ''
            const keepName = path.basename(entry.file.path)
            const extra = entry.duplicates.length - 1
            const sample = path.basename(entry.duplicates[0].path)
            const suffix = extra > 0 ? ` and ${extra} more` : ''
            result.errors.push(
              `${group.rawShowName} ${code}${partLabel}: duplicate files detected. Kept ${keepName}; skipped ${sample}${suffix}.`
            )
          }
        }
      }

      const finalTmdbId = showData?.id ?? fallback?.tmdbId ?? group.forcedTmdbId ?? null
      if (!finalTmdbId && !showUpsert.isLocked) result.unmatched.push(`(show) ${group.rawShowName}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${group.rawShowName}: ${msg}`)
    }
  }

  emit({ stage: 'done', result })
  return result
}

/** Helper: walk parent dirs (immediate first) and return the first non-season name */
function findShowFolderName(parentDirs: string[]): string | null {
  // parentDirs[0] = immediate parent, parentDirs[last] = topmost under root
  // We want the topmost non-season folder (typically the show folder)
  for (let i = parentDirs.length - 1; i >= 0; i--) {
    const dir = parentDirs[i]
    if (isSeasonFolderName(dir)) continue
    return dir
  }
  return null
}

function isSeasonFolderName(name: string): boolean {
  return (
    /^season[._\s-]*\d+$/i.test(name) ||
    /^s\d{1,2}$/i.test(name) ||
    /^specials?$/i.test(name) ||
    /\bseason[._\s-]*\d+\b/i.test(name) ||
    /\bs\d{1,2}\b/i.test(name)
  )
}

function stripSeasonSuffix(name: string): string | null {
  const m = name.match(/^(.*?)(?:[._\s-]*(?:season[._\s-]*\d+|s\d{1,2}))([._\s-]*)$/i)
  if (!m) return null
  const base = m[1].replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base || null
}

function cleanTitle(s: string): string {
  return s.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseOscarsEpisode(file: ScannedFile): {
  showTitle: string
  season: number
  episode: number
  episodeTitle?: string
  airDate?: string | null
  part: number
} | null {
  const folder = file.parentDirs[0] ?? ''
  const base = path.basename(file.path).replace(/\.[^.]+$/, '')
  const source = folder || base
  const m = source.match(/(\d{1,3})(?:st|nd|rd|th)\b/i)
  if (!m) return null
  const season = parseInt(m[1], 10)
  return {
    showTitle: 'The Oscars',
    season,
    episode: 1,
    episodeTitle: cleanTitle(source),
    part: 1,
  }
}

/**
 * Parse a Tom & Jerry filename like "115   Switchin' Kitten [1961].avi".
 * Extracts the leading number as episode, the rest as title, and the bracketed
 * year as airDate. Season is always 1 (the collection is a single flat series).
 */
function parseTomAndJerryEpisode(file: ScannedFile): {
  showTitle: string
  season: number
  episode: number
  episodeTitle?: string
  airDate?: string | null
  part: number
} | null {
  const base = path.basename(file.path).replace(/\.[^.]+$/, '')
  // [^\[]+ stops before the bracket so the optional [YEAR] group is forced to fire.
  // A plain .+? with an optional group would swallow [1944] since the optional can
  // succeed by matching nothing, leaving m[3] undefined.
  const m = base.match(/^(\d{1,3})\s+([^\[]+?)(?:\s*\[(\d{4})\])?\s*$/)
  if (!m) return null
  return {
    showTitle: path.basename(file.rootPath),
    season: 1,
    episode: parseInt(m[1], 10),
    episodeTitle: m[2].trim(),
    airDate: m[3] ? `${m[3]}-01-01` : null,
    part: 1,
  }
}

async function replaceCast(
  tmdb: TmdbClient,
  parentType: 'movie' | 'show',
  parentId: number,
  cast: TmdbCastMember[]
): Promise<void> {
  const upserts = await Promise.all(
    cast.map(async (c, idx) => ({
      parentType,
      parentId,
      name: c.name,
      character: c.character ?? null,
      profilePath: await cacheImage(tmdb.imageUrl(c.profile_path, 'w185')),
      orderIndex: c.order ?? idx,
    }))
  )
  castRepo.replace(parentType, parentId, upserts)
}
