import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  ApplyOverrideParams,
  EpisodeMetadataUpdate,
  IpcResult,
  MetadataSearchResult,
  SelectImageParams,
  TmdbEpisodePreview,
  TmdbImageOption,
  UploadImageParams,
} from '@shared/types'
import { castRepo, episodesRepo, moviesRepo, settingsRepo, showsRepo } from '../db/queries'
import { cacheImage, cacheLocalImage } from '../services/imageCache'
import {
  TmdbClient,
  type TmdbCastMember,
  type TmdbImageSize,
  type TmdbSearchResult,
} from '../services/tmdb'

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}
function fail(error: unknown): IpcResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

/** Download and cache the top 10 cast members for a movie or show. */
async function syncCast(
  tmdb: TmdbClient,
  parentType: 'movie' | 'show',
  parentId: number,
  castList: TmdbCastMember[]
): Promise<void> {
  const upserts = await Promise.all(
    castList.slice(0, 10).map(async (c, idx) => ({
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

export function registerMetadataIpc(): void {
  // ── metadata:search ────────────────────────────────────────────────────────
  // Searches TMDB for movies or TV shows by title + optional year.
  ipcMain.handle(
    IPC.METADATA_SEARCH,
    async (
      _evt,
      query: string,
      year: number | null,
      mediaType: 'movie' | 'tv',
      imdbId: string | null
    ) => {
      try {
        const settings = settingsRepo.getAll()
        if (!settings.tmdbApiKey) return fail(new Error('No TMDB API key configured.'))
        const tmdb = new TmdbClient(settings.tmdbApiKey)

        const mapResults = (list: TmdbSearchResult[]) =>
          list.slice(0, 20).map((r) => ({
            tmdbId: r.id,
            title: r.title ?? r.name ?? 'Unknown',
            year: r.release_date
              ? Number(r.release_date.slice(0, 4))
              : r.first_air_date
                ? Number(r.first_air_date.slice(0, 4))
                : null,
            overview: r.overview ?? null,
            posterPath: r.poster_path ?? null,
            rating: r.vote_average ?? null,
            mediaType,
          }))

        const imdb = imdbId?.trim()
        if (imdb) {
          const normalized = imdb.startsWith('tt') ? imdb : `tt${imdb}`
          const found = await tmdb.findByImdbId(normalized)
          const list = mediaType === 'movie' ? found.movie_results : found.tv_results
          if (list.length > 0) return ok(mapResults(list))
        }

        const raw =
          mediaType === 'movie'
            ? await tmdb.searchMovie(query.trim(), year ?? undefined)
            : await tmdb.searchTv(query.trim(), year ?? undefined)
        return ok(mapResults(raw.results))
      } catch (e) {
        return fail(e)
      }
    }
  )

  // ── metadata:apply-override ────────────────────────────────────────────────
  // Fetches full TMDB data, caches images, updates the DB record, optionally locks.
  ipcMain.handle(IPC.METADATA_APPLY_OVERRIDE, async (_evt, params: ApplyOverrideParams) => {
    try {
      const { itemType, itemId, tmdbId, lock } = params
      const settings = settingsRepo.getAll()
      if (!settings.tmdbApiKey) return fail(new Error('No TMDB API key configured.'))
      const tmdb = new TmdbClient(settings.tmdbApiKey)

      if (itemType === 'movie') {
        const data = await tmdb.getMovie(tmdbId)
        const posterPath = await cacheImage(tmdb.imageUrl(data.poster_path, 'w500'))
        const backdropPath = await cacheImage(tmdb.imageUrl(data.backdrop_path, 'w1280'))
        const logo = data.images?.logos?.[0]?.file_path
        const logoPath = logo ? await cacheImage(tmdb.imageUrl(logo, 'w500')) : null

        moviesRepo.applyOverride(
          itemId,
          {
            tmdbId: data.id,
            title: data.title,
            originalTitle: data.original_title ?? null,
            year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
            overview: data.overview ?? null,
            tagline: data.tagline ?? null,
            runtime: data.runtime ?? null,
            rating: data.vote_average ?? null,
            releaseDate: data.release_date ?? null,
            genres: data.genres?.map((g) => g.name) ?? [],
            posterPath,
            backdropPath,
            logoPath,
          },
          lock
        )

        if (data.credits?.cast) {
          await syncCast(tmdb, 'movie', itemId, data.credits.cast)
        }
      } else {
        const data = await tmdb.getShow(tmdbId)
        const posterPath = await cacheImage(tmdb.imageUrl(data.poster_path, 'w500'))
        const backdropPath = await cacheImage(tmdb.imageUrl(data.backdrop_path, 'w1280'))
        const logo = data.images?.logos?.[0]?.file_path
        const logoPath = logo ? await cacheImage(tmdb.imageUrl(logo, 'w500')) : null

        showsRepo.applyOverride(
          itemId,
          {
            tmdbId: data.id,
            title: data.name,
            originalTitle: data.original_name ?? null,
            year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) : null,
            overview: data.overview ?? null,
            status: data.status ?? null,
            rating: data.vote_average ?? null,
            firstAirDate: data.first_air_date ?? null,
            genres: data.genres?.map((g) => g.name) ?? [],
            posterPath,
            backdropPath,
            logoPath,
          },
          lock
        )

        if (data.credits?.cast) {
          await syncCast(tmdb, 'show', itemId, data.credits.cast)
        }
      }

      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })

  // ── metadata:get-images ────────────────────────────────────────────────────
  // Returns the full TMDB image list (posters + backdrops + logos) for a title.
  ipcMain.handle(
    IPC.METADATA_GET_IMAGES,
    async (_evt, tmdbId: number, mediaType: 'movie' | 'tv') => {
      try {
        const settings = settingsRepo.getAll()
        if (!settings.tmdbApiKey) return fail(new Error('No TMDB API key configured.'))
        const tmdb = new TmdbClient(settings.tmdbApiKey)

        const raw =
          mediaType === 'movie'
            ? await tmdb.getMovieImages(tmdbId)
            : await tmdb.getShowImages(tmdbId)

        const options: TmdbImageOption[] = [
          ...raw.posters.slice(0, 15).map((img) => ({
            filePath: img.file_path,
            width: img.width,
            height: img.height,
            aspectRatio: img.aspect_ratio,
            voteAverage: img.vote_average ?? 0,
            kind: 'poster' as const,
          })),
          ...raw.backdrops.slice(0, 10).map((img) => ({
            filePath: img.file_path,
            width: img.width,
            height: img.height,
            aspectRatio: img.aspect_ratio,
            voteAverage: img.vote_average ?? 0,
            kind: 'backdrop' as const,
          })),
          ...(raw.logos ?? []).slice(0, 8).map((img) => ({
            filePath: img.file_path,
            width: img.width,
            height: img.height,
            aspectRatio: img.aspect_ratio,
            voteAverage: img.vote_average ?? 0,
            kind: 'logo' as const,
          })),
        ]

        return ok(options)
      } catch (e) {
        return fail(e)
      }
    }
  )

  // ── metadata:select-image ──────────────────────────────────────────────────
  // Downloads a chosen TMDB image, caches it, updates the correct DB field.
  ipcMain.handle(IPC.METADATA_SELECT_IMAGE, async (_evt, params: SelectImageParams) => {
    try {
      const settings = settingsRepo.getAll()
      if (!settings.tmdbApiKey) return fail(new Error('No TMDB API key configured.'))
      const tmdb = new TmdbClient(settings.tmdbApiKey)

      const url = tmdb.imageUrl(params.filePath, params.size as TmdbImageSize)
      if (!url) return fail(new Error('Invalid image path.'))

      const cacheKey = await cacheImage(url)
      if (!cacheKey) return fail(new Error('Failed to download image from TMDB.'))

      if (params.itemType === 'movie') {
        moviesRepo.updateImageField(params.itemId, params.imageKind, cacheKey)
      } else {
        showsRepo.updateImageField(params.itemId, params.imageKind, cacheKey)
      }

      return ok(cacheKey)
    } catch (e) {
      return fail(e)
    }
  })

  // ── metadata:upload-image ──────────────────────────────────────────────────
  // Opens a file-picker dialog, copies the chosen image into the cache,
  // and updates the correct DB field.  Returns null if the dialog was cancelled.
  ipcMain.handle(IPC.METADATA_UPLOAD_IMAGE, async (evt, params: UploadImageParams) => {
    try {
      const win = BrowserWindow.fromWebContents(evt.sender)
      const result = await dialog.showOpenDialog(win!, {
        title: 'Choose image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      })
      if (result.canceled || result.filePaths.length === 0) return ok<string | null>(null)

      const cacheKey = cacheLocalImage(result.filePaths[0])

      if (params.itemType === 'movie') {
        moviesRepo.updateImageField(params.itemId, params.imageKind, cacheKey)
      } else {
        showsRepo.updateImageField(params.itemId, params.imageKind, cacheKey)
      }

      return ok<string | null>(cacheKey)
    } catch (e) {
      return fail(e)
    }
  })

  // ── metadata:set-locked ────────────────────────────────────────────────────
  ipcMain.handle(
    IPC.METADATA_SET_LOCKED,
    (_evt, itemType: 'movie' | 'show', itemId: number, locked: boolean) => {
      try {
        if (itemType === 'movie') {
          moviesRepo.setLocked(itemId, locked)
        } else {
          showsRepo.setLocked(itemId, locked)
        }
        return ok(undefined)
      } catch (e) {
        return fail(e)
      }
    }
  )

  // ── metadata:upload-episode-image ────────────────────────────────────────────
  // Opens file picker and uploads the chosen image as the episode still.
  ipcMain.handle(IPC.METADATA_UPLOAD_EPISODE_IMAGE, async (evt, episodeId: number) => {
    try {
      const win = BrowserWindow.fromWebContents(evt.sender)
      const result = await dialog.showOpenDialog(win!, {
        title: 'Choose episode still',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      })
      if (result.canceled || result.filePaths.length === 0) return ok<string | null>(null)

      const cacheKey = cacheLocalImage(result.filePaths[0])
      episodesRepo.updateStill(episodeId, cacheKey)

      return ok<string | null>(cacheKey)
    } catch (e) {
      return fail(e)
    }
  })

  // ── metadata:fetch-episode ────────────────────────────────────────────────
  // Fetches one episode from TMDB for preview. Returns the data so the renderer
  // can show it before the user commits the save.
  ipcMain.handle(
    IPC.METADATA_FETCH_EPISODE,
    async (_evt, episodeId: number): Promise<IpcResult<TmdbEpisodePreview>> => {
      try {
        const settings = settingsRepo.getAll()
        if (!settings.tmdbApiKey) return fail(new Error('No TMDB API key configured.'))
        const tmdb = new TmdbClient(settings.tmdbApiKey)

        const db = (await import('../db/connection')).getDb()
        const epRow = db
          .prepare('SELECT * FROM episodes WHERE id = ?')
          .get(episodeId) as {
            show_id: number; season_number: number; episode_number: number
          } | undefined
        if (!epRow) return fail(new Error('Episode not found.'))

        const show = showsRepo.getById(epRow.show_id)
        if (!show?.tmdbId) return fail(new Error('Show has no TMDB ID — apply a metadata override first.'))

        const seasonData = await tmdb.getSeason(show.tmdbId, epRow.season_number)
        const tmdbEp = seasonData?.episodes?.find((e) => e.episode_number === epRow.episode_number)
        if (!tmdbEp) return fail(new Error(`Episode S${epRow.season_number}E${epRow.episode_number} not found on TMDB.`))

        const stillPath = tmdbEp.still_path
          ? await cacheImage(tmdb.imageUrl(tmdbEp.still_path, 'w300'))
          : null

        return ok<TmdbEpisodePreview>({
          title: tmdbEp.name ?? null,
          overview: tmdbEp.overview ?? null,
          airDate: tmdbEp.air_date ?? null,
          runtime: tmdbEp.runtime ?? null,
          rating: tmdbEp.vote_average ?? null,
          stillPath,
        })
      } catch (e) {
        return fail(e)
      }
    }
  )

  // ── metadata:update-episode ───────────────────────────────────────────────
  // Saves episode metadata fields (title, overview, etc.) — used by both the
  // TMDB-fetch path and the manual-edit path.
  ipcMain.handle(
    IPC.METADATA_UPDATE_EPISODE,
    (_evt, params: EpisodeMetadataUpdate): IpcResult<void> => {
      try {
        episodesRepo.updateMetadata(params.episodeId, {
          title: params.title ?? undefined,
          overview: params.overview ?? undefined,
          airDate: params.airDate ?? undefined,
          runtime: params.runtime ?? undefined,
          stillPath: params.stillPath ?? undefined,
        })
        return ok(undefined)
      } catch (e) {
        return fail(e)
      }
    }
  )

  // ── metadata:refresh-stills ───────────────────────────────────────────────
  // Fills episodes that are missing stills or episode metadata.
  // Groups by season to minimise TMDB API calls.
  ipcMain.handle(IPC.METADATA_REFRESH_STILLS, async (_evt, showId: number) => {
    try {
      const settings = settingsRepo.getAll()
      if (!settings.tmdbApiKey) return fail(new Error('No TMDB API key configured.'))
      const tmdb = new TmdbClient(settings.tmdbApiKey)

      const show = showsRepo.getById(showId)
      if (!show) return fail(new Error('Show not found.'))
      if (!show.tmdbId) return fail(new Error('Show has no TMDB ID — run a scan first.'))

      const missing = episodesRepo.listMissingStills(showId)
      if (missing.length === 0) return ok({ filled: 0, updated: 0, total: 0 })

      // Group by season to fetch each season only once
      const bySeason = new Map<number, typeof missing>()
      for (const ep of missing) {
        if (!bySeason.has(ep.seasonNumber)) bySeason.set(ep.seasonNumber, [])
        bySeason.get(ep.seasonNumber)!.push(ep)
      }

      let filled = 0
      let updated = 0
      for (const [seasonNum, eps] of bySeason) {
        let seasonData
        try {
          seasonData = await tmdb.getSeason(show.tmdbId, seasonNum)
        } catch {
          continue
        }
        for (const ep of eps) {
          const tmdbEp = seasonData?.episodes?.find(
            (e) => e.episode_number === ep.episodeNumber
          )
          if (!tmdbEp) continue

          const stillPath = tmdbEp.still_path
            ? await cacheImage(tmdb.imageUrl(tmdbEp.still_path, 'w300'))
            : null

          episodesRepo.updateMetadata(ep.id, {
            title: tmdbEp.name ?? null,
            overview: tmdbEp.overview ?? null,
            stillPath,
            airDate: tmdbEp.air_date ?? null,
            runtime: tmdbEp.runtime ?? null,
            rating: tmdbEp.vote_average ?? null,
          })

          updated++
          if (stillPath) filled++
        }
      }

      return ok({ filled, updated, total: missing.length })
    } catch (e) {
      return fail(e)
    }
  })
}
