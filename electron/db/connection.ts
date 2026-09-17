import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { SCHEMA_SQL } from './schema'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, 'library.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  ensureEpisodePartSchema(db)
  ensureMetadataLockColumns(db)
  ensureSpecialRootColumn(db)
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function ensureEpisodePartSchema(conn: Database.Database): void {
  const cols = conn.prepare('PRAGMA table_info(episodes)').all() as { name: string }[]
  const hasPart = cols.some((c) => c.name === 'episode_part')
  if (hasPart) return

  conn.exec(`
    PRAGMA foreign_keys=OFF;
    BEGIN;

    CREATE TABLE IF NOT EXISTS episodes_new (
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

    INSERT INTO episodes_new
      (id, show_id, season_id, season_number, episode_number, episode_part, title,
       overview, still_path, air_date, runtime, rating, file_path, file_size, added_at)
    SELECT
      id, show_id, season_id, season_number, episode_number, 1 AS episode_part, title,
      overview, still_path, air_date, runtime, rating, file_path, file_size, added_at
    FROM episodes;

    DROP TABLE episodes;
    ALTER TABLE episodes_new RENAME TO episodes;

    CREATE INDEX IF NOT EXISTS idx_episodes_show
      ON episodes(show_id, season_number, episode_number, episode_part);

    COMMIT;
    PRAGMA foreign_keys=ON;
  `)
}

function ensureMetadataLockColumns(conn: Database.Database): void {
  const movieCols = conn
    .prepare('PRAGMA table_info(movies)')
    .all() as { name: string }[]
  if (!movieCols.some((c) => c.name === 'metadata_locked')) {
    conn.exec('ALTER TABLE movies ADD COLUMN metadata_locked INTEGER NOT NULL DEFAULT 0')
  }

  const showCols = conn
    .prepare('PRAGMA table_info(shows)')
    .all() as { name: string }[]
  if (!showCols.some((c) => c.name === 'metadata_locked')) {
    conn.exec('ALTER TABLE shows ADD COLUMN metadata_locked INTEGER NOT NULL DEFAULT 0')
  }
}

function ensureSpecialRootColumn(conn: Database.Database): void {
  const cols = conn
    .prepare('PRAGMA table_info(library_roots)')
    .all() as { name: string }[]
  if (!cols.some((c) => c.name === 'special_kind')) {
    conn.exec('ALTER TABLE library_roots ADD COLUMN special_kind TEXT')
  }
}
