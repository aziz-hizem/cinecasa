export const IPC = {
  // Settings
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET: 'settings:set',
  SETTINGS_BROWSE_FOLDER: 'settings:browse-folder',
  SETTINGS_BROWSE_FILE: 'settings:browse-file',
  SETTINGS_OPEN_DATA_DIR: 'settings:open-data-dir',
  SETTINGS_OPEN_CACHE_DIR: 'settings:open-cache-dir',
  SETTINGS_CLEAR_CACHE: 'settings:clear-cache',

  // Library roots
  LIBRARY_ROOTS_LIST: 'library-roots:list',
  LIBRARY_ROOTS_ADD: 'library-roots:add',
  LIBRARY_ROOTS_REMOVE: 'library-roots:remove',
  LIBRARY_ROOTS_ADD_SPECIAL: 'library-roots:add-special',

  // Library
  LIBRARY_SCAN: 'library:scan',
  LIBRARY_SCAN_ROOT: 'library:scan-root',
  LIBRARY_LIST_MOVIES: 'library:list-movies',
  LIBRARY_LIST_SHOWS: 'library:list-shows',
  LIBRARY_LIST_RECENT_MOVIES: 'library:list-recent-movies',
  LIBRARY_LIST_RECENT_SHOWS: 'library:list-recent-shows',
  LIBRARY_GET_MOVIE: 'library:get-movie',
  LIBRARY_GET_SHOW: 'library:get-show',
  LIBRARY_LIST_SEASONS: 'library:list-seasons',
  LIBRARY_LIST_EPISODES: 'library:list-episodes',
  LIBRARY_LIST_CAST: 'library:list-cast',
  LIBRARY_SEARCH: 'library:search',
  LIBRARY_CLEAR: 'library:clear',
  LIBRARY_DELETE_SHOW: 'library:delete-show',
  LIBRARY_DELETE_MOVIE: 'library:delete-movie',

  // Scan progress event (main → renderer)
  EVT_SCAN_PROGRESS: 'event:scan-progress',

  // Playback
  PLAYBACK_LAUNCH: 'playback:launch',
  PLAYBACK_STOP: 'playback:stop',
  PLAYBACK_STATUS: 'playback:status',
  PLAYBACK_GET_PROGRESS: 'playback:get-progress',
  PLAYBACK_LIST_SHOW_PROGRESS: 'playback:list-show-progress',
  PLAYBACK_LIST_IN_PROGRESS: 'playback:list-in-progress',
  PLAYBACK_TEST_CONNECTION: 'playback:test-connection',
  PLAYBACK_REMOVE_PROGRESS: 'playback:remove-progress',
  PLAYBACK_GET_AUTOPLAY: 'playback:get-autoplay',
  PLAYBACK_SET_AUTOPLAY: 'playback:set-autoplay',
  /** main → renderer: pushed every polling cycle while MPC-HC is playing. */
  EVT_PLAYBACK_PROGRESS: 'event:playback-progress',
  /** main → renderer: auto-play launched the next episode. */
  EVT_PLAYBACK_NEXT_EPISODE: 'event:playback-next-episode',

  // Metadata override
  METADATA_SEARCH: 'metadata:search',
  METADATA_APPLY_OVERRIDE: 'metadata:apply-override',
  METADATA_GET_IMAGES: 'metadata:get-images',
  METADATA_SELECT_IMAGE: 'metadata:select-image',
  METADATA_UPLOAD_IMAGE: 'metadata:upload-image',
  METADATA_UPLOAD_EPISODE_IMAGE: 'metadata:upload-episode-image',
  METADATA_SET_LOCKED: 'metadata:set-locked',
  METADATA_REFRESH_STILLS: 'metadata:refresh-stills',
  METADATA_FETCH_EPISODE: 'metadata:fetch-episode',
  METADATA_UPDATE_EPISODE: 'metadata:update-episode',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
