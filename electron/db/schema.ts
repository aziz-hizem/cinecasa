export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS library_roots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('movies', 'tv')),
  special_kind TEXT,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  overview TEXT,
  tagline TEXT,
  runtime INTEGER,
  rating REAL,
  release_date TEXT,
  genres TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  logo_path TEXT,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  metadata_locked INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  last_scanned_at INTEGER
);

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  overview TEXT,
  status TEXT,
  rating REAL,
  first_air_date TEXT,
  genres TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  logo_path TEXT,
  folder_path TEXT NOT NULL UNIQUE,
  metadata_locked INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  last_scanned_at INTEGER
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  name TEXT,
  overview TEXT,
  poster_path TEXT,
  air_date TEXT,
  episode_count INTEGER,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  UNIQUE(show_id, season_number)
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  episode_part INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  overview TEXT,
  still_path TEXT,
  air_date TEXT,
  runtime INTEGER,
  rating REAL,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  added_at INTEGER NOT NULL,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(show_id, season_number, episode_number, episode_part)
);

CREATE TABLE IF NOT EXISTS cast_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_type TEXT NOT NULL CHECK(parent_type IN ('movie', 'show')),
  parent_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  character TEXT,
  profile_path TEXT,
  order_index INTEGER
);

CREATE TABLE IF NOT EXISTS watch_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL CHECK(item_type IN ('movie', 'episode')),
  item_id INTEGER NOT NULL,
  position_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK(state IN ('unwatched', 'in_progress', 'watched')),
  last_played_at INTEGER,
  watched_at INTEGER,
  UNIQUE(item_type, item_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_shows_title ON shows(title);
CREATE INDEX IF NOT EXISTS idx_episodes_show ON episodes(show_id, season_number, episode_number, episode_part);
CREATE INDEX IF NOT EXISTS idx_progress_item ON watch_progress(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_progress_state ON watch_progress(state, last_played_at);
CREATE INDEX IF NOT EXISTS idx_cast_parent ON cast_members(parent_type, parent_id);
`
