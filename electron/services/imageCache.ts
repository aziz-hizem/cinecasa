import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'

let cacheDir: string | null = null

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

/**
 * %AppData%/cinecasa/cache/images
 */
export function getImageCacheDir(): string {
  if (!cacheDir) {
    cacheDir = path.join(app.getPath('userData'), 'cache', 'images')
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  return cacheDir
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export function mimeForFile(p: string): string {
  return MIME_BY_EXT[path.extname(p).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Download a TMDB image and store it in the cache.
 * Returns a relative cache key like "w500/abc.jpg" suitable for cinecasa-img:// URLs.
 * Returns null if url is null or download failed.
 */
export async function cacheImage(url: string | null): Promise<string | null> {
  if (!url) return null

  // URL like https://image.tmdb.org/t/p/w500/abc.jpg
  const sizeMatch = url.match(/\/t\/p\/([^/]+)\//)
  const size = sizeMatch?.[1] ?? 'unknown'
  const tail = url.split(`/t/p/${size}/`)[1] ?? path.basename(url)
  const safeName = tail.replace(/[/\\]/g, '_')

  const targetDir = path.join(getImageCacheDir(), size)
  await fs.promises.mkdir(targetDir, { recursive: true })

  const localPath = path.join(targetDir, safeName)
  const relativeKey = `${size}/${safeName}`

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    return relativeKey
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.promises.writeFile(localPath, buf)
    return relativeKey
  } catch {
    return null
  }
}

/** Resolve a cache key (e.g. "w500/abc.jpg") to an absolute path on disk. */
export function resolveCacheKey(key: string): string {
  return path.join(getImageCacheDir(), key)
}

export function clearImageCache(): void {
  const dir = getImageCacheDir()
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.mkdirSync(dir, { recursive: true })
}

export function cacheLocalImage(filePath: string): string {
  const ext = path.extname(filePath) || '.jpg'
  const fileName = `${Date.now()}-${randomUUID()}${ext}`
  const rel = path.posix.join('custom', fileName)
  const dest = resolveCacheKey(rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(filePath, dest)
  return rel
}

function normalizeCacheKey(key: string): string {
  return key.replace(/^\/+/, '')
}

/**
 * Ensure a cached image exists for a given key (e.g. "w500/abc.jpg").
 * If missing, re-downloads it from TMDB's public image CDN.
 */
export async function ensureCachedKey(key: string): Promise<string | null> {
  const safeKey = normalizeCacheKey(key)
  if (!safeKey || safeKey.includes('..') || safeKey.includes(':')) return null

  const fullPath = resolveCacheKey(safeKey)
  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
      return fullPath
    }
  } catch {
    // Ignore and attempt re-download.
  }

  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })

  try {
    const res = await fetch(`${TMDB_IMAGE_BASE}/${safeKey}`)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    await fs.promises.writeFile(fullPath, buf)
    return fullPath
  } catch {
    return null
  }
}
