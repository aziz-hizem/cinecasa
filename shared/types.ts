export type LibraryRootType = 'movies' | 'tv'

export type SpecialKind =
  | 'oscars'
  | 'tom_and_jerry'
  | 'marvel'
  | 'spiderman'
  | 'pirates'

export interface LibraryRoot {
  id: number
  path: string
  type: LibraryRootType
  addedAt: number
  specialKind?: SpecialKind | null
}

export interface AppSettings {
  tmdbApiKey: string
  mpcHcPath: string
  mpcHcPort: number
  pollingIntervalMs: number
  themeAccent: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  tmdbApiKey: '',
  mpcHcPath: 'C:\\Program Files\\MPC-HC\\mpc-hc64.exe',
  mpcHcPort: 13579,
  pollingIntervalMs: 5000,
  themeAccent: '#e50914',
}

export type WatchState = 'unwatched' | 'in_progress' | 'watched'

export interface WatchProgress {
  itemType: 'movie' | 'episode'
  itemId: number
  positionMs: number
  durationMs: number
  state: WatchState
  lastPlayedAt: number | null
  watchedAt: number | null
}

export interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/** A movie row as exposed to the renderer. */
export interface Movie {
  id: number
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
  filePath: string
  fileSize: number | null
  metadataLocked: boolean
  addedAt: number
}

/** A TV show row, list view (no episodes). */
export interface Show {
  id: number
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
  folderPath: string
  metadataLocked: boolean
  addedAt: number
}

export interface Season {
  id: number
  showId: number
  seasonNumber: number
  name: string | null
  overview: string | null
  posterPath: string | null
  airDate: string | null
  episodeCount: number | null
}

export interface Episode {
  id: number
  showId: number
  seasonId: number
  seasonNumber: number
  episodeNumber: number
  episodePart: number
  title: string | null
  overview: string | null
  stillPath: string | null
  airDate: string | null
  runtime: number | null
  rating: number | null
  filePath: string
  fileSize: number | null
}

export interface CastMember {
  id: number
  parentType: 'movie' | 'show'
  parentId: number
  name: string
  character: string | null
  profilePath: string | null
  orderIndex: number | null
}

export interface ScanResult {
  moviesAdded: number
  moviesUpdated: number
  showsAdded: number
  showsUpdated: number
  episodesAdded: number
  episodesUpdated: number
  unmatched: string[]
  errors: string[]
}

export type ScanMode = 'full' | 'new'

export type ScanProgressEvent =
  | { stage: 'starting' }
  | { stage: 'scanning'; rootPath: string }
  | { stage: 'fetching'; current: number; total: number; label: string }
  | { stage: 'done'; result: ScanResult }
  | { stage: 'error'; error: string }

export interface SearchResults {
  movies: Movie[]
  shows: Show[]
}

// ─── Metadata override types ────────────────────────────────────────────────

/** Which image field to replace. */
export type ImageKind = 'poster' | 'backdrop' | 'logo'

/** One result row returned from a TMDB search. */
export interface MetadataSearchResult {
  tmdbId: number
  title: string
  year: number | null
  overview: string | null
  /** TMDB file path e.g. "/abc.jpg" — NOT a full URL. */
  posterPath: string | null
  rating: number | null
  mediaType: 'movie' | 'tv'
}

/** One image option returned from TMDB's /images endpoint. */
export interface TmdbImageOption {
  filePath: string      // e.g. "/abc.jpg"
  width: number
  height: number
  aspectRatio: number
  voteAverage: number
  kind: ImageKind
}

export interface ApplyOverrideParams {
  itemType: 'movie' | 'show'
  itemId: number
  tmdbId: number
  /** Lock the record so future scans don't overwrite it. */
  lock: boolean
}

export interface SelectImageParams {
  itemType: 'movie' | 'show'
  itemId: number
  imageKind: ImageKind
  /** TMDB file path, e.g. "/abc.jpg" */
  filePath: string
  /** TMDB size string, e.g. "w500" or "w1280" */
  size: string
}

export interface UploadImageParams {
  itemType: 'movie' | 'show'
  itemId: number
  imageKind: ImageKind
}

// ─── Playback types ──────────────────────────────────────────────────────────

/** TMDB episode data returned for preview before the user confirms saving. */
export interface TmdbEpisodePreview {
  title: string | null
  overview: string | null
  airDate: string | null
  runtime: number | null
  rating: number | null
  stillPath: string | null   // already cached cache-key, ready to use
}

/** Fields the user can manually update on an episode. */
export interface EpisodeMetadataUpdate {
  episodeId: number
  title: string | null
  overview: string | null
  airDate: string | null
  runtime: number | null
  /** Cache key for the episode still — set when confirming a TMDB fetch. */
  stillPath?: string | null
}

export interface PlaybackLaunchParams {
  filePath: string
  itemType: 'movie' | 'episode'
  itemId: number
  /** Resume position in milliseconds. 0 = start from beginning. */
  startMs: number
  /** When true, auto-play picks a random episode from the same show instead of the sequential next one. */
  randomMode?: boolean
}

export interface PlaybackProgressEvent {
  itemType: 'movie' | 'episode'
  itemId: number
  positionMs: number
  durationMs: number
  state: WatchState
}

/** One row returned by the "Continue Watching" query — a joined view across
 *  watch_progress + movies/episodes+shows. */
export interface InProgressItem {
  itemType: 'movie' | 'episode'
  itemId: number
  positionMs: number
  durationMs: number
  lastPlayedAt: number
  title: string
  year: number | null
  posterPath: string | null
  /** React-Router path to navigate to on click, e.g. "/movie/3" or "/show/7". */
  linkTo: string
  filePath: string
  showId: number | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeTitle: string | null
}
