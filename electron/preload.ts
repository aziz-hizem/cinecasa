import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  ApplyOverrideParams,
  AppSettings,
  CastMember,
  Episode,
  EpisodeMetadataUpdate,
  InProgressItem,
  IpcResult,
  LibraryRoot,
  LibraryRootType,
  MetadataSearchResult,
  Movie,
  PlaybackLaunchParams,
  PlaybackProgressEvent,
  ScanProgressEvent,
  ScanResult,
  ScanMode,
  SearchResults,
  Season,
  SelectImageParams,
  Show,
  SpecialKind,
  TmdbEpisodePreview,
  TmdbImageOption,
  UploadImageParams,
  WatchProgress,
} from '@shared/types'

const api = {
  settings: {
    getAll: (): Promise<IpcResult<AppSettings>> =>
      ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    set: (
      key: keyof AppSettings,
      value: string | number
    ): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
    browseFolder: (): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke(IPC.SETTINGS_BROWSE_FOLDER),
    browseFile: (filters?: Electron.FileFilter[]): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke(IPC.SETTINGS_BROWSE_FILE, filters),
    openDataDir: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.SETTINGS_OPEN_DATA_DIR),
    openCacheDir: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.SETTINGS_OPEN_CACHE_DIR),
    clearCache: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.SETTINGS_CLEAR_CACHE),
  },
  libraryRoots: {
    list: (): Promise<IpcResult<LibraryRoot[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_ROOTS_LIST),
    add: (
      path: string,
      type: LibraryRootType
    ): Promise<IpcResult<LibraryRoot>> =>
      ipcRenderer.invoke(IPC.LIBRARY_ROOTS_ADD, path, type),
    remove: (id: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.LIBRARY_ROOTS_REMOVE, id),
    addSpecial: (
      path: string,
      type: LibraryRootType,
      specialKind: SpecialKind
    ): Promise<IpcResult<LibraryRoot>> =>
      ipcRenderer.invoke(IPC.LIBRARY_ROOTS_ADD_SPECIAL, path, type, specialKind),
  },
  library: {
    scan: (): Promise<IpcResult<ScanResult>> => ipcRenderer.invoke(IPC.LIBRARY_SCAN),
    scanRoot: (rootId: number, mode: ScanMode): Promise<IpcResult<ScanResult>> =>
      ipcRenderer.invoke(IPC.LIBRARY_SCAN_ROOT, rootId, mode),
    clearLibrary: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.LIBRARY_CLEAR),
    listMovies: (): Promise<IpcResult<Movie[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_MOVIES),
    listShows: (): Promise<IpcResult<Show[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_SHOWS),
    listRecentMovies: (limit?: number): Promise<IpcResult<Movie[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_RECENT_MOVIES, limit),
    listRecentShows: (limit?: number): Promise<IpcResult<Show[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_RECENT_SHOWS, limit),
    getMovie: (id: number): Promise<IpcResult<Movie>> =>
      ipcRenderer.invoke(IPC.LIBRARY_GET_MOVIE, id),
    getShow: (id: number): Promise<IpcResult<Show>> =>
      ipcRenderer.invoke(IPC.LIBRARY_GET_SHOW, id),
    search: (query: string): Promise<IpcResult<SearchResults>> =>
      ipcRenderer.invoke(IPC.LIBRARY_SEARCH, query),
    deleteShow: (id: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.LIBRARY_DELETE_SHOW, id),
    deleteMovie: (id: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.LIBRARY_DELETE_MOVIE, id),
    listSeasons: (showId: number): Promise<IpcResult<Season[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_SEASONS, showId),
    listEpisodes: (
      showId: number,
      seasonNumber?: number
    ): Promise<IpcResult<Episode[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_EPISODES, showId, seasonNumber),
    listCast: (
      parentType: 'movie' | 'show',
      parentId: number
    ): Promise<IpcResult<CastMember[]>> =>
      ipcRenderer.invoke(IPC.LIBRARY_LIST_CAST, parentType, parentId),
    onScanProgress: (handler: (e: ScanProgressEvent) => void): (() => void) => {
      const listener = (_evt: unknown, data: ScanProgressEvent) => handler(data)
      ipcRenderer.on(IPC.EVT_SCAN_PROGRESS, listener)
      return () => ipcRenderer.removeListener(IPC.EVT_SCAN_PROGRESS, listener)
    },
  },
  metadata: {
    search: (
      query: string,
      year: number | null,
      mediaType: 'movie' | 'tv',
      imdbId: string | null
    ): Promise<IpcResult<MetadataSearchResult[]>> =>
      ipcRenderer.invoke(IPC.METADATA_SEARCH, query, year, mediaType, imdbId),

    applyOverride: (
      params: ApplyOverrideParams
    ): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.METADATA_APPLY_OVERRIDE, params),

    getImages: (
      tmdbId: number,
      mediaType: 'movie' | 'tv'
    ): Promise<IpcResult<TmdbImageOption[]>> =>
      ipcRenderer.invoke(IPC.METADATA_GET_IMAGES, tmdbId, mediaType),

    selectImage: (
      params: SelectImageParams
    ): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(IPC.METADATA_SELECT_IMAGE, params),

    uploadImage: (
      params: UploadImageParams
    ): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke(IPC.METADATA_UPLOAD_IMAGE, params),

    uploadEpisodeImage: (
      episodeId: number
    ): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke(IPC.METADATA_UPLOAD_EPISODE_IMAGE, episodeId),

    setLocked: (
      itemType: 'movie' | 'show',
      itemId: number,
      locked: boolean
    ): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.METADATA_SET_LOCKED, itemType, itemId, locked),

    refreshStills: (
      showId: number
    ): Promise<IpcResult<{ filled: number; updated: number; total: number }>> =>
      ipcRenderer.invoke(IPC.METADATA_REFRESH_STILLS, showId),

    fetchEpisode: (episodeId: number): Promise<IpcResult<TmdbEpisodePreview>> =>
      ipcRenderer.invoke(IPC.METADATA_FETCH_EPISODE, episodeId),

    updateEpisode: (params: EpisodeMetadataUpdate): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.METADATA_UPDATE_EPISODE, params),
  },
  playback: {
    launch: (params: PlaybackLaunchParams): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_LAUNCH, params),

    stop: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_STOP),

    status: (): Promise<IpcResult<{ isPlaying: boolean }>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_STATUS),

    getProgress: (
      itemType: 'movie' | 'episode',
      itemId: number,
    ): Promise<IpcResult<WatchProgress | null>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_GET_PROGRESS, itemType, itemId),

    listShowProgress: (showId: number): Promise<IpcResult<WatchProgress[]>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_LIST_SHOW_PROGRESS, showId),

    listInProgress: (limit?: number): Promise<IpcResult<InProgressItem[]>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_LIST_IN_PROGRESS, limit),

    testConnection: (port: number): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_TEST_CONNECTION, port),

    removeProgress: (itemType: 'movie' | 'episode', itemId: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_REMOVE_PROGRESS, itemType, itemId),

    getAutoPlay: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_GET_AUTOPLAY),

    setAutoPlay: (enabled: boolean): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.PLAYBACK_SET_AUTOPLAY, enabled),

    onProgress: (handler: (e: PlaybackProgressEvent) => void): (() => void) => {
      const listener = (_evt: unknown, data: PlaybackProgressEvent) => handler(data)
      ipcRenderer.on(IPC.EVT_PLAYBACK_PROGRESS, listener)
      return () => ipcRenderer.removeListener(IPC.EVT_PLAYBACK_PROGRESS, listener)
    },

    onNextEpisode: (handler: (e: { episodeId: number; showId: number; seasonNumber: number; episodeNumber: number }) => void): (() => void) => {
      const listener = (_evt: unknown, data: typeof handler extends (e: infer E) => void ? E : never) => handler(data)
      ipcRenderer.on(IPC.EVT_PLAYBACK_NEXT_EPISODE, listener)
      return () => ipcRenderer.removeListener(IPC.EVT_PLAYBACK_NEXT_EPISODE, listener)
    },
  },
} as const

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
