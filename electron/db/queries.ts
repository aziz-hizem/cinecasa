import { getDb } from './connection'
import {
  AppSettings,
  CastMember,
  DEFAULT_SETTINGS,
  Episode,
  ImageKind,
  InProgressItem,
  LibraryRoot,
  LibraryRootType,
  Movie,
  Season,
  Show,
  SpecialKind,
  WatchProgress,
  WatchState,
} from '@shared/types'

// ─── Row shapes (SQLite ↔ TS) ───────────────────────────────────────────────

interface SettingRow {
  key: string
  value: string
}

interface LibraryRootRow {
  id: number
  path: string
  type: LibraryRootType
  special_kind: SpecialKind | null
  added_at: number
}

interface MovieRow {
  id: number
  tmdb_id: number | null
  title: string
  original_title: string | null
  year: number | null
  overview: string | null
  tagline: string | null
  runtime: number | null
  rating: number | null
  release_date: string | null
  genres: string | null
  poster_path: string | null
  backdrop_path: string | null
  logo_path: string | null
  metadata_locked: number
  file_path: string
  file_size: number | null
  added_at: number
  last_scanned_at: number | null
}

interface ShowRow {
  id: number
  tmdb_id: number | null
  title: string
  original_title: string | null
  year: number | null
  overview: string | null
  status: string | null
  rating: number | null
  first_air_date: string | null
  genres: string | null
  poster_path: string | null
  backdrop_path: string | null
  logo_path: string | null
  metadata_locked: number
  folder_path: string
  added_at: number
  last_scanned_at: number | null
}

interface SeasonRow {
  id: number
  show_id: number
  season_number: number
  name: string | null
  overview: string | null
  poster_path: string | null
  air_date: string | null
  episode_count: number | null
}

interface EpisodeRow {
  id: number
  show_id: number
  season_id: number
  season_number: number
  episode_number: number
  episode_part: number
  title: string | null
  overview: string | null
  still_path: string | null
  air_date: string | null
  runtime: number | null
  rating: number | null
  file_path: string
  file_size: number | null
  added_at: number
}

interface CastRow {
  id: number
  parent_type: 'movie' | 'show'
  parent_id: number
  name: string
  character: string | null
  profile_path: string | null
  order_index: number | null
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function parseGenres(s: string | null): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function rowToMovie(r: MovieRow): Movie {
  return {
    id: r.id,
    tmdbId: r.tmdb_id,
    title: r.title,
    originalTitle: r.original_title,
    year: r.year,
    overview: r.overview,
    tagline: r.tagline,
    runtime: r.runtime,
    rating: r.rating,
    releaseDate: r.release_date,
    genres: parseGenres(r.genres),
    posterPath: r.poster_path,
    backdropPath: r.backdrop_path,
    logoPath: r.logo_path,
    metadataLocked: r.metadata_locked === 1,
    filePath: r.file_path,
    fileSize: r.file_size,
    addedAt: r.added_at,
  }
}

function rowToShow(r: ShowRow): Show {
  return {
    id: r.id,
    tmdbId: r.tmdb_id,
    title: r.title,
    originalTitle: r.original_title,
    year: r.year,
    overview: r.overview,
    status: r.status,
    rating: r.rating,
    firstAirDate: r.first_air_date,
    genres: parseGenres(r.genres),
    posterPath: r.poster_path,
    backdropPath: r.backdrop_path,
    logoPath: r.logo_path,
    metadataLocked: r.metadata_locked === 1,
    folderPath: r.folder_path,
    addedAt: r.added_at,
  }
}

function rowToSeason(r: SeasonRow): Season {
  return {
    id: r.id,
    showId: r.show_id,
    seasonNumber: r.season_number,
    name: r.name,
    overview: r.overview,
    posterPath: r.poster_path,
    airDate: r.air_date,
    episodeCount: r.episode_count,
  }
}

function rowToEpisode(r: EpisodeRow): Episode {
  return {
    id: r.id,
    showId: r.show_id,
    seasonId: r.season_id,
    seasonNumber: r.season_number,
    episodeNumber: r.episode_number,
    episodePart: r.episode_part ?? 1,
    title: r.title,
    overview: r.overview,
    stillPath: r.still_path,
    airDate: r.air_date,
    runtime: r.runtime,
    rating: r.rating,
    filePath: r.file_path,
    fileSize: r.file_size,
  }
}

function rowToCast(r: CastRow): CastMember {
  return {
    id: r.id,
    parentType: r.parent_type,
    parentId: r.parent_id,
    name: r.name,
    character: r.character,
    profilePath: r.profile_path,
    orderIndex: r.order_index,
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export const settingsRepo = {
  getAll(): AppSettings {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as SettingRow[]
    const map = new Map(rows.map((r) => [r.key, r.value]))

    return {
      tmdbApiKey: map.get('tmdbApiKey') ?? DEFAULT_SETTINGS.tmdbApiKey,
      mpcHcPath: map.get('mpcHcPath') ?? DEFAULT_SETTINGS.mpcHcPath,
      mpcHcPort: Number(map.get('mpcHcPort') ?? DEFAULT_SETTINGS.mpcHcPort),
      pollingIntervalMs: Number(
        map.get('pollingIntervalMs') ?? DEFAULT_SETTINGS.pollingIntervalMs
      ),
      themeAccent: map.get('themeAccent') ?? DEFAULT_SETTINGS.themeAccent,
    }
  },

  set(key: keyof AppSettings, value: string | number): void {
    const db = getDb()
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, String(value))
  },
}

// ─── Library roots ───────────────────────────────────────────────────────────

export const libraryRootsRepo = {
  list(): LibraryRoot[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, path, type, special_kind, added_at FROM library_roots ORDER BY added_at ASC')
      .all() as LibraryRootRow[]
    return rows.map((r) => ({
      id: r.id,
      path: r.path,
      type: r.type,
      addedAt: r.added_at,
      specialKind: r.special_kind,
    }))
  },

  add(rootPath: string, type: LibraryRootType): LibraryRoot {
    const db = getDb()
    const addedAt = Date.now()
    const result = db
      .prepare('INSERT INTO library_roots (path, type, added_at) VALUES (?, ?, ?)')
      .run(rootPath, type, addedAt)
    return {
      id: Number(result.lastInsertRowid),
      path: rootPath,
      type,
      addedAt,
      specialKind: null,
    }
  },

  addSpecial(rootPath: string, type: LibraryRootType, specialKind: SpecialKind): LibraryRoot {
    const db = getDb()
    const addedAt = Date.now()
    const result = db
      .prepare(
        'INSERT INTO library_roots (path, type, special_kind, added_at) VALUES (?, ?, ?, ?)'
      )
      .run(rootPath, type, specialKind, addedAt)
    return {
      id: Number(result.lastInsertRowid),
      path: rootPath,
      type,
      addedAt,
      specialKind,
    }
  },

  remove(id: number): void {
    const db = getDb()
    db.prepare('DELETE FROM library_roots WHERE id = ?').run(id)
  },

  getById(id: number): LibraryRoot | null {
    const db = getDb()
    const row = db
      .prepare('SELECT id, path, type, special_kind, added_at FROM library_roots WHERE id = ?')
      .get(id) as LibraryRootRow | undefined
    return row
      ? {
          id: row.id,
          path: row.path,
          type: row.type,
          addedAt: row.added_at,
          specialKind: row.special_kind,
        }
      : null
  },
}

// ─── Movies ──────────────────────────────────────────────────────────────────

export interface MovieUpsert {
  filePath: string
  fileSize: number | null
  tmdbId: number | null
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  tagline: string | null
  runtime: number | null
  rating: number | null
  releaseDate: string | null
  genres: string[]
  posterPath: string | null
  backdropPath: string | null
  logoPath: string | null
}

/** Metadata-only payload used when applying a manual override. */
export interface MovieOverride {
  tmdbId: number
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  tagline: string | null
  runtime: number | null
  rating: number | null
  releaseDate: string | null
  genres: string[]
  posterPath: string | null
  backdropPath: string | null
  logoPath: string | null
}

export const moviesRepo = {
  /** Upsert a movie from a scan.  If the existing record is locked only file
   *  info (size + last_scanned_at) is updated.  Returns { id, isNew }. */
  upsert(d: MovieUpsert): { id: number; isNew: boolean; isLocked: boolean } {
    const db = getDb()
    const now = Date.now()
    const existing = db
      .prepare('SELECT id, metadata_locked FROM movies WHERE file_path = ?')
      .get(d.filePath) as { id: number; metadata_locked: number } | undefined

    if (existing) {
      if (existing.metadata_locked === 1) {
        // Locked — only touch file info
        db.prepare(
          'UPDATE movies SET file_size = ?, last_scanned_at = ? WHERE id = ?'
        ).run(d.fileSize, now, existing.id)
        return { id: existing.id, isNew: false, isLocked: true }
      } else {
        db.prepare(
          `UPDATE movies SET tmdb_id = ?, title = ?, original_title = ?, year = ?,
           overview = ?, tagline = ?, runtime = ?, rating = ?, release_date = ?,
           genres = ?, poster_path = ?, backdrop_path = ?, logo_path = ?,
           file_size = ?, last_scanned_at = ?
           WHERE id = ?`
        ).run(
          d.tmdbId, d.title, d.originalTitle, d.year, d.overview, d.tagline,
          d.runtime, d.rating, d.releaseDate, JSON.stringify(d.genres),
          d.posterPath, d.backdropPath, d.logoPath, d.fileSize, now, existing.id
        )
      }
      return { id: existing.id, isNew: false, isLocked: false }
    }

    const result = db
      .prepare(
        `INSERT INTO movies
         (tmdb_id, title, original_title, year, overview, tagline, runtime, rating,
          release_date, genres, poster_path, backdrop_path, logo_path, file_path,
          file_size, added_at, last_scanned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.tmdbId, d.title, d.originalTitle, d.year, d.overview, d.tagline,
        d.runtime, d.rating, d.releaseDate, JSON.stringify(d.genres),
        d.posterPath, d.backdropPath, d.logoPath, d.filePath, d.fileSize, now, now
      )
    return { id: Number(result.lastInsertRowid), isNew: true, isLocked: false }
  },

  list(): Movie[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM movies ORDER BY title COLLATE NOCASE ASC').all() as MovieRow[]).map(rowToMovie)
  },

  listRecent(limit = 20): Movie[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM movies ORDER BY added_at DESC LIMIT ?').all(limit) as MovieRow[]).map(rowToMovie)
  },

  getById(id: number): Movie | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as MovieRow | undefined
    return row ? rowToMovie(row) : null
  },

  getByFilePath(filePath: string): Movie | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM movies WHERE file_path = ?').get(filePath) as MovieRow | undefined
    return row ? rowToMovie(row) : null
  },

  existsByFilePath(filePath: string): boolean {
    const db = getDb()
    const row = db.prepare('SELECT 1 FROM movies WHERE file_path = ?').get(filePath) as
      | { 1: number }
      | undefined
    return Boolean(row)
  },

  /** Apply a full metadata override (does NOT touch file_path / file_size). */
  applyOverride(id: number, d: MovieOverride, lock: boolean): void {
    const db = getDb()
    db.prepare(
      `UPDATE movies SET tmdb_id = ?, title = ?, original_title = ?, year = ?,
       overview = ?, tagline = ?, runtime = ?, rating = ?, release_date = ?,
       genres = ?, poster_path = ?, backdrop_path = ?, logo_path = ?,
       metadata_locked = ?, last_scanned_at = ?
       WHERE id = ?`
    ).run(
      d.tmdbId, d.title, d.originalTitle, d.year, d.overview, d.tagline,
      d.runtime, d.rating, d.releaseDate, JSON.stringify(d.genres),
      d.posterPath, d.backdropPath, d.logoPath,
      lock ? 1 : 0, Date.now(), id
    )
  },

  setLocked(id: number, locked: boolean): void {
    const db = getDb()
    db.prepare('UPDATE movies SET metadata_locked = ? WHERE id = ?').run(locked ? 1 : 0, id)
  },

  /** Replace a single image field (poster / backdrop / logo) with a new cache key. */
  updateImageField(id: number, kind: ImageKind, cacheKey: string): void {
    const db = getDb()
    const col =
      kind === 'poster' ? 'poster_path' :
      kind === 'backdrop' ? 'backdrop_path' : 'logo_path'
    db.prepare(`UPDATE movies SET ${col} = ? WHERE id = ?`).run(cacheKey, id)
  },

  delete(id: number): void {
    const db = getDb()
    db.prepare("DELETE FROM cast_members WHERE parent_type = 'movie' AND parent_id = ?").run(id)
    db.prepare("DELETE FROM watch_progress WHERE item_type = 'movie' AND item_id = ?").run(id)
    db.prepare('DELETE FROM movies WHERE id = ?').run(id)
  },
}

// ─── Shows ───────────────────────────────────────────────────────────────────

export interface ShowUpsert {
  folderPath: string
  tmdbId: number | null
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  status: string | null
  rating: number | null
  firstAirDate: string | null
  genres: string[]
  posterPath: string | null
  backdropPath: string | null
  logoPath: string | null
}

export interface ShowOverride {
  tmdbId: number
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  status: string | null
  rating: number | null
  firstAirDate: string | null
  genres: string[]
  posterPath: string | null
  backdropPath: string | null
  logoPath: string | null
}

export const showsRepo = {
  /** Upsert a show from a scan.  If the existing record is locked only
   *  last_scanned_at is updated.  Returns { id, isNew }. */
  upsert(d: ShowUpsert): { id: number; isNew: boolean; isLocked: boolean } {
    const db = getDb()
    const now = Date.now()
    const existing = db
      .prepare('SELECT id, metadata_locked FROM shows WHERE folder_path = ?')
      .get(d.folderPath) as { id: number; metadata_locked: number } | undefined

    if (existing) {
      if (existing.metadata_locked === 1) {
        // Locked — only update scan timestamp
        db.prepare('UPDATE shows SET last_scanned_at = ? WHERE id = ?').run(now, existing.id)
        return { id: existing.id, isNew: false, isLocked: true }
      } else {
        db.prepare(
          `UPDATE shows SET tmdb_id = ?, title = ?, original_title = ?, year = ?,
           overview = ?, status = ?, rating = ?, first_air_date = ?, genres = ?,
           poster_path = ?, backdrop_path = ?, logo_path = ?, last_scanned_at = ?
           WHERE id = ?`
        ).run(
          d.tmdbId, d.title, d.originalTitle, d.year, d.overview, d.status,
          d.rating, d.firstAirDate, JSON.stringify(d.genres),
          d.posterPath, d.backdropPath, d.logoPath, now, existing.id
        )
      }
      return { id: existing.id, isNew: false, isLocked: false }
    }

    const result = db
      .prepare(
        `INSERT INTO shows
         (tmdb_id, title, original_title, year, overview, status, rating,
          first_air_date, genres, poster_path, backdrop_path, logo_path, folder_path,
          added_at, last_scanned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.tmdbId, d.title, d.originalTitle, d.year, d.overview, d.status,
        d.rating, d.firstAirDate, JSON.stringify(d.genres),
        d.posterPath, d.backdropPath, d.logoPath, d.folderPath, now, now
      )
    return { id: Number(result.lastInsertRowid), isNew: true, isLocked: false }
  },

  list(): Show[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM shows ORDER BY title COLLATE NOCASE ASC').all() as ShowRow[]).map(rowToShow)
  },

  listRecent(limit = 20): Show[] {
    const db = getDb()
    return (db.prepare('SELECT * FROM shows ORDER BY added_at DESC LIMIT ?').all(limit) as ShowRow[]).map(rowToShow)
  },

  getById(id: number): Show | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM shows WHERE id = ?').get(id) as ShowRow | undefined
    return row ? rowToShow(row) : null
  },

  getByFolderPath(folderPath: string): Show | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM shows WHERE folder_path = ?').get(folderPath) as ShowRow | undefined
    return row ? rowToShow(row) : null
  },

  applyOverride(id: number, d: ShowOverride, lock: boolean): void {
    const db = getDb()
    db.prepare(
      `UPDATE shows SET tmdb_id = ?, title = ?, original_title = ?, year = ?,
       overview = ?, status = ?, rating = ?, first_air_date = ?, genres = ?,
       poster_path = ?, backdrop_path = ?, logo_path = ?,
       metadata_locked = ?, last_scanned_at = ?
       WHERE id = ?`
    ).run(
      d.tmdbId, d.title, d.originalTitle, d.year, d.overview, d.status,
      d.rating, d.firstAirDate, JSON.stringify(d.genres),
      d.posterPath, d.backdropPath, d.logoPath,
      lock ? 1 : 0, Date.now(), id
    )
  },

  setLocked(id: number, locked: boolean): void {
    const db = getDb()
    db.prepare('UPDATE shows SET metadata_locked = ? WHERE id = ?').run(locked ? 1 : 0, id)
  },

  updateImageField(id: number, kind: ImageKind, cacheKey: string): void {
    const db = getDb()
    const col =
      kind === 'poster' ? 'poster_path' :
      kind === 'backdrop' ? 'backdrop_path' : 'logo_path'
    db.prepare(`UPDATE shows SET ${col} = ? WHERE id = ?`).run(cacheKey, id)
  },

  delete(id: number): void {
    const db = getDb()
    db.prepare("DELETE FROM cast_members WHERE parent_type = 'show' AND parent_id = ?").run(id)
    db.prepare(`
      DELETE FROM watch_progress
      WHERE item_type = 'episode' AND item_id IN (SELECT id FROM episodes WHERE show_id = ?)
    `).run(id)
    db.prepare('DELETE FROM shows WHERE id = ?').run(id)
  },
}

// ─── Seasons ─────────────────────────────────────────────────────────────────

export interface SeasonUpsert {
  showId: number
  seasonNumber: number
  name: string | null
  overview: string | null
  posterPath: string | null
  airDate: string | null
  episodeCount: number | null
}

export const seasonsRepo = {
  upsert(d: SeasonUpsert): number {
    const db = getDb()
    const existing = db
      .prepare('SELECT id FROM seasons WHERE show_id = ? AND season_number = ?')
      .get(d.showId, d.seasonNumber) as { id: number } | undefined

    if (existing) {
      // COALESCE: a failed TMDB refetch (null values) must never blank out
      // season data we already have — only a genuine new value overwrites it.
      db.prepare(
        `UPDATE seasons SET name = COALESCE(?, name), overview = COALESCE(?, overview),
         poster_path = COALESCE(?, poster_path), air_date = COALESCE(?, air_date),
         episode_count = COALESCE(?, episode_count) WHERE id = ?`
      ).run(d.name, d.overview, d.posterPath, d.airDate, d.episodeCount, existing.id)
      return existing.id
    }

    const result = db
      .prepare(
        `INSERT INTO seasons (show_id, season_number, name, overview, poster_path,
         air_date, episode_count) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.showId, d.seasonNumber, d.name ?? `Season ${d.seasonNumber}`,
        d.overview, d.posterPath, d.airDate, d.episodeCount
      )
    return Number(result.lastInsertRowid)
  },

  listByShow(showId: number): Season[] {
    const db = getDb()
    return (db
      .prepare('SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number ASC')
      .all(showId) as SeasonRow[]).map(rowToSeason)
  },
}

// ─── Episodes ────────────────────────────────────────────────────────────────

export interface EpisodeUpsert {
  showId: number
  seasonId: number
  seasonNumber: number
  episodeNumber: number
  episodePart?: number
  title: string | null
  overview: string | null
  stillPath: string | null
  airDate: string | null
  runtime: number | null
  rating: number | null
  filePath: string
  fileSize: number | null
}

export const episodesRepo = {
  upsert(d: EpisodeUpsert): { id: number; isNew: boolean } {
    const db = getDb()
    const now = Date.now()
    const part = d.episodePart ?? 1
    const existing = db
      .prepare('SELECT id FROM episodes WHERE file_path = ?')
      .get(d.filePath) as { id: number } | undefined

    if (existing) {
      // Structural fields (season/episode numbers, file size) always reflect the
      // current file and are safe to overwrite. TMDB-derived fields use COALESCE
      // so a failed season refetch (all-null) can't blank out a good title,
      // overview, or still that a previous successful scan already stored.
      db.prepare(
        `UPDATE episodes SET show_id = ?, season_id = ?, season_number = ?,
         episode_number = ?, episode_part = ?,
         title = COALESCE(?, title), overview = COALESCE(?, overview),
         still_path = COALESCE(?, still_path), air_date = COALESCE(?, air_date),
         runtime = COALESCE(?, runtime), rating = COALESCE(?, rating),
         file_size = ?
         WHERE id = ?`
      ).run(
        d.showId, d.seasonId, d.seasonNumber, d.episodeNumber, part,
        d.title, d.overview, d.stillPath, d.airDate, d.runtime, d.rating,
        d.fileSize, existing.id
      )
      return { id: existing.id, isNew: false }
    }

    const result = db
      .prepare(
        `INSERT INTO episodes (show_id, season_id, season_number, episode_number,
         episode_part, title, overview, still_path, air_date, runtime, rating,
         file_path, file_size, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.showId, d.seasonId, d.seasonNumber, d.episodeNumber, part,
        d.title, d.overview, d.stillPath, d.airDate, d.runtime, d.rating,
        d.filePath, d.fileSize, now
      )
    return { id: Number(result.lastInsertRowid), isNew: true }
  },

  listByShow(showId: number): Episode[] {
    const db = getDb()
    return (db
      .prepare('SELECT * FROM episodes WHERE show_id = ? ORDER BY season_number ASC, episode_number ASC, episode_part ASC')
      .all(showId) as EpisodeRow[]).map(rowToEpisode)
  },

  listBySeason(showId: number, seasonNumber: number): Episode[] {
    const db = getDb()
    return (db
      .prepare('SELECT * FROM episodes WHERE show_id = ? AND season_number = ? ORDER BY episode_number ASC, episode_part ASC')
      .all(showId, seasonNumber) as EpisodeRow[]).map(rowToEpisode)
  },

  existsByFilePath(filePath: string): boolean {
    const db = getDb()
    const row = db.prepare('SELECT 1 FROM episodes WHERE file_path = ?').get(filePath) as
      | { 1: number }
      | undefined
    return Boolean(row)
  },

  /** Episodes that have no still image — used for "refresh missing stills". */
  listMissingStills(showId: number): Episode[] {
    const db = getDb()
    return (db
      .prepare(
        `SELECT * FROM episodes
         WHERE show_id = ?
           AND (
             still_path IS NULL OR still_path = ''
             OR title IS NULL OR overview IS NULL
           )
         ORDER BY season_number ASC, episode_number ASC, episode_part ASC`
      )
      .all(showId) as EpisodeRow[]).map(rowToEpisode)
  },

  updateStill(id: number, stillPath: string): void {
    const db = getDb()
    db.prepare('UPDATE episodes SET still_path = ? WHERE id = ?').run(stillPath, id)
  },

  updateMetadata(
    id: number,
    data: {
      title?: string | null
      overview?: string | null
      stillPath?: string | null
      airDate?: string | null
      runtime?: number | null
      rating?: number | null
    }
  ): void {
    const db = getDb()
    db.prepare(
      `UPDATE episodes
       SET title = COALESCE(?, title),
           overview = COALESCE(?, overview),
           still_path = COALESCE(?, still_path),
           air_date = COALESCE(?, air_date),
           runtime = COALESCE(?, runtime),
           rating = COALESCE(?, rating)
       WHERE id = ?`
    ).run(
      data.title ?? null,
      data.overview ?? null,
      data.stillPath ?? null,
      data.airDate ?? null,
      data.runtime ?? null,
      data.rating ?? null,
      id
    )
  },
}

// ─── Search ──────────────────────────────────────────────────────────────────

export const searchRepo = {
  search(rawQuery: string, limit = 50): { movies: Movie[]; shows: Show[] } {
    const q = rawQuery.trim()
    if (!q) return { movies: [], shows: [] }
    const db = getDb()
    const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`

    const movieRows = db
      .prepare(
        `SELECT * FROM movies WHERE title LIKE ? ESCAPE '\\'
           OR original_title LIKE ? ESCAPE '\\'
         ORDER BY title COLLATE NOCASE ASC LIMIT ?`
      )
      .all(like, like, limit) as MovieRow[]

    const showRows = db
      .prepare(
        `SELECT * FROM shows WHERE title LIKE ? ESCAPE '\\'
           OR original_title LIKE ? ESCAPE '\\'
         ORDER BY title COLLATE NOCASE ASC LIMIT ?`
      )
      .all(like, like, limit) as ShowRow[]

    return {
      movies: movieRows.map(rowToMovie),
      shows: showRows.map(rowToShow),
    }
  },
}

// ─── Cast ────────────────────────────────────────────────────────────────────

export interface CastUpsert {
  parentType: 'movie' | 'show'
  parentId: number
  name: string
  character: string | null
  profilePath: string | null
  orderIndex: number | null
}

export const castRepo = {
  replace(parentType: 'movie' | 'show', parentId: number, members: CastUpsert[]): void {
    const db = getDb()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM cast_members WHERE parent_type = ? AND parent_id = ?').run(
        parentType, parentId
      )
      const stmt = db.prepare(
        `INSERT INTO cast_members
         (parent_type, parent_id, name, character, profile_path, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      for (const m of members) {
        stmt.run(m.parentType, m.parentId, m.name, m.character, m.profilePath, m.orderIndex)
      }
    })
    tx()
  },

  listFor(parentType: 'movie' | 'show', parentId: number): CastMember[] {
    const db = getDb()
    return (db
      .prepare('SELECT * FROM cast_members WHERE parent_type = ? AND parent_id = ? ORDER BY order_index ASC')
      .all(parentType, parentId) as CastRow[]).map(rowToCast)
  },
}

// ─── Watch Progress ──────────────────────────────────────────────────────────

interface WatchProgressRow {
  id: number
  item_type: 'movie' | 'episode'
  item_id: number
  position_ms: number
  duration_ms: number
  state: WatchState
  last_played_at: number | null
  watched_at: number | null
}

interface InProgressRow {
  item_type: 'movie' | 'episode'
  item_id: number
  position_ms: number
  duration_ms: number
  last_played_at: number
  title: string
  year: number | null
  poster_path: string | null
  file_path: string
  show_id: number | null
  season_number: number | null
  episode_number: number | null
  episode_title: string | null
}

function rowToWatchProgress(r: WatchProgressRow): WatchProgress {
  return {
    itemType: r.item_type,
    itemId: r.item_id,
    positionMs: r.position_ms,
    durationMs: r.duration_ms,
    state: r.state,
    lastPlayedAt: r.last_played_at,
    watchedAt: r.watched_at,
  }
}

export interface WatchProgressUpsert {
  itemType: 'movie' | 'episode'
  itemId: number
  positionMs: number
  durationMs: number
  state: WatchState
  lastPlayedAt: number
  watchedAt: number | null
}

export const watchProgressRepo = {
  /**
   /** Remove a watch-progress record entirely (used by "Remove from Continue Watching"). */
  remove(itemType: 'movie' | 'episode', itemId: number): void {
    const db = getDb()
    db.prepare('DELETE FROM watch_progress WHERE item_type = ? AND item_id = ?').run(itemType, itemId)
  },

  /**
   * Called the instant the user presses Play.
   * Guarantees a record exists in Continue Watching even if the app is closed
   * before the first poll fires.  Never overwrites an existing duration_ms so
   * previously-known episode lengths are preserved.
   */
  markStarted(itemType: 'movie' | 'episode', itemId: number, positionMs: number): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO watch_progress
        (item_type, item_id, position_ms, duration_ms, state, last_played_at, watched_at)
      VALUES (?, ?, ?, 0, 'in_progress', ?, NULL)
      ON CONFLICT(item_type, item_id) DO UPDATE SET
        position_ms    = excluded.position_ms,
        state          = 'in_progress',
        last_played_at = excluded.last_played_at
    `).run(itemType, itemId, positionMs, Date.now())
  },

  upsert(d: WatchProgressUpsert): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO watch_progress
        (item_type, item_id, position_ms, duration_ms, state, last_played_at, watched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_type, item_id) DO UPDATE SET
        position_ms    = excluded.position_ms,
        duration_ms    = excluded.duration_ms,
        state          = excluded.state,
        last_played_at = excluded.last_played_at,
        watched_at     = CASE
                           WHEN excluded.state = 'watched' THEN excluded.watched_at
                           ELSE watched_at
                         END
    `).run(
      d.itemType, d.itemId, d.positionMs, d.durationMs,
      d.state, d.lastPlayedAt, d.watchedAt,
    )
  },

  getByItem(itemType: 'movie' | 'episode', itemId: number): WatchProgress | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM watch_progress WHERE item_type = ? AND item_id = ?')
      .get(itemType, itemId) as WatchProgressRow | undefined
    return row ? rowToWatchProgress(row) : null
  },

  /** All episode progress rows for a given show (one query, not N). */
  listForShow(showId: number): WatchProgress[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT wp.*
      FROM watch_progress wp
      JOIN episodes e ON wp.item_type = 'episode' AND wp.item_id = e.id
      WHERE e.show_id = ?
    `).all(showId) as WatchProgressRow[]
    return rows.map(rowToWatchProgress)
  },

  /** Items currently in-progress, ordered by most-recently-played.
   *  Also includes the "next episode" for shows where all watched episodes are
   *  fully done — so finishing S1E1 surfaces S1E2 even before it's started. */
  listInProgress(limit = 20): InProgressItem[] {
    const db = getDb()

    function rowToItem(r: InProgressRow): InProgressItem {
      return {
        itemType: r.item_type,
        itemId: r.item_id,
        positionMs: r.position_ms,
        durationMs: r.duration_ms,
        lastPlayedAt: r.last_played_at,
        title: r.title,
        year: r.year,
        posterPath: r.poster_path,
        linkTo: r.item_type === 'movie' ? `/movie/${r.item_id}` : `/show/${r.show_id}`,
        filePath: r.file_path,
        showId: r.show_id,
        seasonNumber: r.season_number,
        episodeNumber: r.episode_number,
        episodeTitle: r.episode_title,
      }
    }

    // ── Part 1: all in-progress items (no limit yet) ──────────────────────────
    const ipRows = db.prepare(`
      SELECT wp.item_type, wp.item_id, wp.position_ms, wp.duration_ms, wp.last_played_at,
             m.title, m.year, m.poster_path, m.file_path,
             NULL AS show_id, NULL AS season_number, NULL AS episode_number, NULL AS episode_title
      FROM watch_progress wp
      JOIN movies m ON wp.item_type = 'movie' AND wp.item_id = m.id
      WHERE wp.state = 'in_progress'

      UNION ALL

      SELECT wp.item_type, wp.item_id, wp.position_ms, wp.duration_ms, wp.last_played_at,
             s.title, s.year, s.poster_path, e.file_path,
             e.show_id, e.season_number, e.episode_number, e.title AS episode_title
      FROM watch_progress wp
      JOIN episodes e ON wp.item_type = 'episode' AND wp.item_id = e.id
      JOIN shows   s ON e.show_id = s.id
      WHERE wp.state = 'in_progress'

      ORDER BY last_played_at DESC
    `).all() as InProgressRow[]

    // Track show IDs already covered so we don't add a duplicate "next-up" row.
    const coveredShowIds = new Set<number>()
    for (const r of ipRows) {
      if (r.item_type === 'episode' && r.show_id !== null) {
        coveredShowIds.add(r.show_id)
      }
    }

    // ── Part 2: "next episode" for shows fully watched so far ─────────────────
    // For each show find the most-recently-played episode regardless of state.
    // If that episode is 'watched' (not in_progress) and there's a next episode
    // that hasn't been watched yet, surface it as a positionMs=0 card.
    interface ShowLastRow {
      show_id: number
      item_id: number
      last_played_at: number
      state: WatchState
    }
    const showLastRows = db.prepare(`
      SELECT e.show_id, wp.item_id, wp.last_played_at, wp.state
      FROM watch_progress wp
      JOIN episodes e ON wp.item_type = 'episode' AND wp.item_id = e.id
      WHERE wp.last_played_at = (
        SELECT MAX(wp2.last_played_at)
        FROM watch_progress wp2
        JOIN episodes e2 ON wp2.item_type = 'episode' AND wp2.item_id = e2.id
        WHERE e2.show_id = e.show_id
      )
    `).all() as ShowLastRow[]

    const nextEpItems: InProgressItem[] = []

    for (const sw of showLastRows) {
      // Skip if this show already has an in-progress episode, or state isn't 'watched'.
      if (coveredShowIds.has(sw.show_id)) continue
      if (sw.state !== 'watched') continue

      const current = db
        .prepare('SELECT * FROM episodes WHERE id = ?')
        .get(sw.item_id) as EpisodeRow | undefined
      if (!current) continue

      interface NextRow extends EpisodeRow {
        show_title: string
        show_year: number | null
        show_poster: string | null
      }

      const nextRow = db.prepare(`
        SELECT e.*,
               s.title  AS show_title,
               s.year   AS show_year,
               s.poster_path AS show_poster
        FROM episodes e
        JOIN shows s ON s.id = e.show_id
        WHERE e.show_id = ?
          AND (
            e.season_number > ?
            OR (e.season_number = ? AND e.episode_number > ?)
            OR (e.season_number = ? AND e.episode_number = ? AND e.episode_part > ?)
          )
          AND NOT EXISTS (
            SELECT 1 FROM watch_progress wp
            WHERE wp.item_type = 'episode' AND wp.item_id = e.id AND wp.state = 'watched'
          )
        ORDER BY e.season_number ASC, e.episode_number ASC, e.episode_part ASC
        LIMIT 1
      `).get(
        sw.show_id,
        current.season_number,
        current.season_number, current.episode_number,
        current.season_number, current.episode_number, current.episode_part,
      ) as NextRow | undefined

      if (nextRow) {
        coveredShowIds.add(sw.show_id)
        nextEpItems.push({
          itemType: 'episode',
          itemId: nextRow.id,
          positionMs: 0,
          durationMs: 0,
          lastPlayedAt: sw.last_played_at,
          title: nextRow.show_title,
          year: nextRow.show_year,
          posterPath: nextRow.show_poster,
          linkTo: `/show/${nextRow.show_id}`,
          filePath: nextRow.file_path,
          showId: nextRow.show_id,
          seasonNumber: nextRow.season_number,
          episodeNumber: nextRow.episode_number,
          episodeTitle: nextRow.title,
        })
      }
    }

    // ── Combine, sort, trim ───────────────────────────────────────────────────
    const combined = [...ipRows.map(rowToItem), ...nextEpItems]
    combined.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    return combined.slice(0, limit)
  },
}

// ─── Episode next-up helper (used by auto-play) ────────────────────────────

/** Return true if the show belongs to a special library root (e.g. Oscars). */
export function isSpecialShow(showId: number): boolean {
  const db = getDb()
  const show = db
    .prepare('SELECT folder_path FROM shows WHERE id = ?')
    .get(showId) as { folder_path: string } | undefined
  if (!show) return false

  const specialRoots = db
    .prepare("SELECT path FROM library_roots WHERE special_kind IS NOT NULL AND special_kind != ''")
    .all() as { path: string }[]

  const normalised = show.folder_path.replace(/\\/g, '/').toLowerCase()
  return specialRoots.some((r) =>
    normalised.startsWith(r.path.replace(/\\/g, '/').toLowerCase()),
  )
}

/** Return the very next episode (by season/episode/part) in the same show, or null. */
export function getNextEpisode(episodeId: number): Episode | null {
  const db = getDb()
  const current = db
    .prepare('SELECT * FROM episodes WHERE id = ?')
    .get(episodeId) as EpisodeRow | undefined
  if (!current) return null

  const next = db.prepare(`
    SELECT * FROM episodes
    WHERE show_id = ?
      AND (
        season_number > ?
        OR (season_number = ? AND episode_number > ?)
        OR (season_number = ? AND episode_number = ? AND episode_part > ?)
      )
    ORDER BY season_number ASC, episode_number ASC, episode_part ASC
    LIMIT 1
  `).get(
    current.show_id,
    current.season_number,
    current.season_number, current.episode_number,
    current.season_number, current.episode_number, current.episode_part,
  ) as EpisodeRow | undefined

  return next ? rowToEpisode(next) : null
}

/** Return the show_id for an episode, or null if not found. */
export function getEpisodeShowId(episodeId: number): number | null {
  const db = getDb()
  const row = db
    .prepare('SELECT show_id FROM episodes WHERE id = ?')
    .get(episodeId) as { show_id: number } | undefined
  return row?.show_id ?? null
}

/**
 * Pick a random episode from the given show, excluding the episode that just
 * finished (so we never immediately repeat the same short).
 */
export function getRandomEpisodeForShow(showId: number, excludeEpisodeId: number): {
  id: number; showId: number; filePath: string
} | null {
  const db = getDb()
  const row = db
    .prepare('SELECT id, show_id, file_path FROM episodes WHERE show_id = ? AND id != ? ORDER BY RANDOM() LIMIT 1')
    .get(showId, excludeEpisodeId) as { id: number; show_id: number; file_path: string } | undefined
  if (!row) return null
  return { id: row.id, showId: row.show_id, filePath: row.file_path }
}

// ─── Bulk operations ─────────────────────────────────────────────────────────

export function clearLibraryData(): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM watch_progress').run()
    db.prepare('DELETE FROM cast_members').run()
    db.prepare('DELETE FROM movies').run()
    db.prepare('DELETE FROM shows').run()
    // seasons and episodes cascade-delete from shows
  })
  tx()
}
