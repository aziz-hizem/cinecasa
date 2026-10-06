import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  Episode,
  LibraryRoot,
  PlaybackProgressEvent,
  RemoteServerInfo,
  Show,
  SpecialKind,
} from '@shared/types'
import { moviesForSpecial, showsForSpecial } from '@shared/specialMembership'
import {
  castRepo,
  episodesRepo,
  getNextEpisode,
  getRandomEpisodeForShow,
  isSpecialShow,
  libraryRootsRepo,
  moviesRepo,
  searchRepo,
  seasonsRepo,
  settingsRepo,
  showsRepo,
  watchProgressRepo,
} from '../db/queries'
import { ensureCachedKey, mimeForFile } from '../services/imageCache'
import { computeState } from '../services/progress'
import { listSidecarSubtitles, sendFile, subtitleMimeFor, videoMimeFor } from './stream'
import { advertise, lanAddresses, stopAdvertising } from './discovery'

/**
 * Cinecasa Server: a small LAN HTTP API the Android tablet app uses to browse
 * the library, stream files and save watch progress into the same database as
 * the desktop app.
 *
 * Every route except /api/hello and /api/pair needs the token handed out at
 * pairing, sent as `Authorization: Bearer <token>` or `?t=<token>` (the query
 * form is for player and image URLs).
 */

const API_VERSION = 1
const TOKEN_KEY = 'remoteToken'
const MAX_BODY_BYTES = 64 * 1024
const MAX_PAIR_FAILURES = 5
const PAIR_LOCKOUT_MS = 30_000

let server: http.Server | null = null
let runningPort = 0
let lastError: string | null = null
let pairingCode = generatePairingCode()
let pairFailures = 0
let pairLockedUntil = 0

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function startRemoteServer(): Promise<void> {
  await stopRemoteServer()
  const { remoteEnabled, remotePort } = settingsRepo.getAll()
  lastError = null
  if (!remoteEnabled) return

  const srv = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error('[remote] request failed:', e)
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: String(e) })
      else res.destroy()
    })
  })

  await new Promise<void>((resolve) => {
    srv.once('error', (e: NodeJS.ErrnoException) => {
      lastError =
        e.code === 'EADDRINUSE'
          ? `Port ${remotePort} is already in use by another program.`
          : e.message
      console.error('[remote] server failed to start:', e)
      resolve()
    })
    srv.listen(remotePort, '0.0.0.0', () => {
      server = srv
      runningPort = remotePort
      advertise(remotePort)
      console.log(`[remote] listening on port ${remotePort}`)
      resolve()
    })
  })
}

export async function stopRemoteServer(): Promise<void> {
  stopAdvertising()
  if (!server) return
  const srv = server
  server = null
  runningPort = 0
  srv.closeAllConnections()
  await new Promise<void>((resolve) => srv.close(() => resolve()))
}

export function getRemoteInfo(): RemoteServerInfo {
  return {
    running: server !== null,
    port: runningPort || settingsRepo.getAll().remotePort,
    addresses: lanAddresses(),
    pairingCode,
    error: lastError,
  }
}

export function newPairingCode(): string {
  pairingCode = generatePairingCode()
  pairFailures = 0
  pairLockedUntil = 0
  return pairingCode
}

/** Invalidate the token every paired tablet holds. */
export function unpairAll(): void {
  settingsRepo.setRaw(TOKEN_KEY, randomBytes(24).toString('hex'))
  newPairingCode()
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function generatePairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function getToken(): string {
  let token = settingsRepo.getRaw(TOKEN_KEY)
  if (!token) {
    token = randomBytes(24).toString('hex')
    settingsRepo.setRaw(TOKEN_KEY, token)
  }
  return token
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function isAuthorized(req: IncomingMessage, url: URL): boolean {
  const header = req.headers.authorization
  const presented = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : url.searchParams.get('t')
  return !!presented && safeEqual(presented, getToken())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  })
  res.end(json)
}

const ok = (res: ServerResponse, data: unknown) => sendJson(res, 200, { ok: true, data })
const fail = (res: ServerResponse, status: number, error: string) =>
  sendJson(res, status, { ok: false, error })

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  return typeof parsed === 'object' && parsed !== null ? parsed : {}
}

function isItemType(v: unknown): v is 'movie' | 'episode' {
  return v === 'movie' || v === 'episode'
}

function filePathFor(itemType: 'movie' | 'episode', id: number): string | null {
  return itemType === 'movie'
    ? moviesRepo.getById(id)?.filePath ?? null
    : episodesRepo.getById(id)?.filePath ?? null
}

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()

/** The special a show's folder sits under (e.g. the Oscars folder), if any. */
function specialKindForShow(show: Show, roots: LibraryRoot[]): SpecialKind | null {
  const folder = norm(show.folderPath)
  const root = roots.find((r) => r.specialKind && folder.startsWith(norm(r.path)))
  return root?.specialKind ?? null
}

function broadcastProgress(payload: PlaybackProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.EVT_PLAYBACK_PROGRESS, payload)
  }
}

// ─── Routing ─────────────────────────────────────────────────────────────────

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const method = req.method ?? 'GET'

  // ── Public ──────────────────────────────────────────────────────────────────
  if (method === 'GET' && url.pathname === '/api/hello') {
    return ok(res, {
      app: 'cinecasa',
      apiVersion: API_VERSION,
      name: os.hostname(),
      authorized: isAuthorized(req, url),
    })
  }

  if (method === 'POST' && url.pathname === '/api/pair') {
    if (Date.now() < pairLockedUntil) {
      return fail(res, 429, 'Too many wrong codes. Wait a moment and try again.')
    }
    const body = await readJson(req)
    if (typeof body.code !== 'string' || !safeEqual(body.code.trim(), pairingCode)) {
      pairFailures += 1
      if (pairFailures >= MAX_PAIR_FAILURES) {
        // Lock out and rotate the code so it can't be brute-forced.
        pairLockedUntil = Date.now() + PAIR_LOCKOUT_MS
        pairingCode = generatePairingCode()
        pairFailures = 0
      }
      return fail(res, 403, 'Wrong pairing code.')
    }
    pairFailures = 0
    return ok(res, { token: getToken(), name: os.hostname() })
  }

  if (!isAuthorized(req, url)) return fail(res, 401, 'Not paired with this PC.')

  // ── Media ───────────────────────────────────────────────────────────────────
  if ((method === 'GET' || method === 'HEAD') && parts[0] === 'stream' && parts.length === 3) {
    const [, type, rawId] = parts
    if (!isItemType(type)) return fail(res, 404, 'Not found')
    const filePath = filePathFor(type, Number(rawId))
    if (!filePath) return fail(res, 404, 'Item not found')
    return sendFile(req, res, filePath, videoMimeFor(filePath))
  }

  if (method === 'GET' && parts[0] === 'subs' && parts.length === 4) {
    const [, type, rawId, rawIndex] = parts
    if (!isItemType(type)) return fail(res, 404, 'Not found')
    const filePath = filePathFor(type, Number(rawId))
    if (!filePath) return fail(res, 404, 'Item not found')
    const sub = (await listSidecarSubtitles(filePath)).find((s) => s.index === Number(rawIndex))
    if (!sub) return fail(res, 404, 'Subtitle not found')
    return sendFile(req, res, sub.fullPath, subtitleMimeFor(sub.ext))
  }

  if (method === 'GET' && parts[0] === 'img' && parts.length > 1) {
    const key = parts.slice(1).join('/')
    if (key.includes('..')) return fail(res, 400, 'Bad image key')
    const fullPath = await ensureCachedKey(key)
    if (!fullPath) return fail(res, 404, 'Image not found')
    const data = await fs.promises.readFile(fullPath)
    res.writeHead(200, {
      'Content-Type': mimeForFile(fullPath),
      'Content-Length': data.length,
      'Cache-Control': 'private, max-age=31536000, immutable',
    })
    res.end(data)
    return
  }

  if (parts[0] !== 'api') return fail(res, 404, 'Not found')
  const route = parts.slice(1)

  // ── Library ─────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    if (route[0] === 'home' && route.length === 1) {
      return ok(res, {
        recentMovies: moviesRepo.listRecent(20),
        recentShows: showsRepo.listRecent(20),
        continueWatching: watchProgressRepo.listInProgress(20),
      })
    }
    if (route[0] === 'continue' && route.length === 1) {
      return ok(res, watchProgressRepo.listInProgress(Number(url.searchParams.get('limit')) || 20))
    }
    if (route[0] === 'movies' && route.length === 1) return ok(res, moviesRepo.list())
    if (route[0] === 'shows' && route.length === 1) return ok(res, showsRepo.list())

    if (route[0] === 'movies' && route.length === 2) {
      const id = Number(route[1])
      const movie = moviesRepo.getById(id)
      if (!movie) return fail(res, 404, 'Movie not found')
      return ok(res, {
        movie,
        cast: castRepo.listFor('movie', id),
        progress: watchProgressRepo.getByItem('movie', id),
      })
    }

    if (route[0] === 'shows' && route.length === 2) {
      const id = Number(route[1])
      const show = showsRepo.getById(id)
      if (!show) return fail(res, 404, 'Show not found')
      return ok(res, {
        show,
        seasons: seasonsRepo.listByShow(id),
        episodes: episodesRepo.listByShow(id),
        cast: castRepo.listFor('show', id),
        progress: watchProgressRepo.listForShow(id),
        specialKind: specialKindForShow(show, libraryRootsRepo.list()),
      })
    }

    if (route[0] === 'search' && route.length === 1) {
      return ok(res, searchRepo.search(url.searchParams.get('q') ?? ''))
    }

    if (route[0] === 'specials' && route.length === 2) {
      const kind = route[1] as SpecialKind
      const roots = libraryRootsRepo.list()
      return ok(res, {
        movies: moviesForSpecial(moviesRepo.list(), roots, kind),
        shows: showsForSpecial(showsRepo.list(), roots, kind),
      })
    }

    if (route[0] === 'subs' && route.length === 3 && isItemType(route[1])) {
      const filePath = filePathFor(route[1], Number(route[2]))
      if (!filePath) return fail(res, 404, 'Item not found')
      const subs = await listSidecarSubtitles(filePath)
      return ok(res, subs.map(({ index, label, ext }) => ({ index, label, ext })))
    }

    // Next episode for auto-play. Mirrors the desktop rules: sequential mode
    // never auto-plays into a special show; random mode (Tom & Jerry) picks any
    // other episode of the same show.
    if (route[0] === 'next' && route.length === 2) {
      const episodeId = Number(route[1])
      let next: Episode | null = null
      if (url.searchParams.get('random') === '1') {
        const showId = episodesRepo.getById(episodeId)?.showId
        const pick = showId != null ? getRandomEpisodeForShow(showId, episodeId) : null
        next = pick ? episodesRepo.getById(pick.id) : null
      } else {
        next = getNextEpisode(episodeId)
        if (next && isSpecialShow(next.showId)) next = null
      }
      return ok(res, next)
    }
  }

  // ── Progress ────────────────────────────────────────────────────────────────
  if (method === 'POST' && route[0] === 'progress' && route.length === 1) {
    const body = await readJson(req)
    const { itemType, event } = body
    const itemId = Number(body.itemId)
    let positionMs = Math.max(0, Math.round(Number(body.positionMs) || 0))
    const durationMs = Math.max(0, Math.round(Number(body.durationMs) || 0))
    if (!isItemType(itemType) || !filePathFor(itemType, itemId)) {
      return fail(res, 404, 'Item not found')
    }

    if (event === 'start') {
      // Same as pressing Play on the desktop: the item shows up in Continue
      // Watching straight away, before any position has been reported.
      watchProgressRepo.markStarted(itemType, itemId, positionMs)
    } else {
      // Finishing a file always counts as fully watched.
      if (event === 'end' && durationMs > 0) positionMs = durationMs
      const state = computeState(positionMs, durationMs)
      watchProgressRepo.upsert({
        itemType,
        itemId,
        positionMs,
        durationMs,
        state,
        lastPlayedAt: Date.now(),
        watchedAt: state === 'watched' ? Date.now() : null,
      })
    }

    const saved = watchProgressRepo.getByItem(itemType, itemId)
    if (saved) {
      broadcastProgress({
        itemType,
        itemId,
        positionMs: saved.positionMs,
        durationMs: saved.durationMs,
        state: saved.state,
      })
    }
    return ok(res, saved)
  }

  if (method === 'DELETE' && route[0] === 'progress' && route.length === 3 && isItemType(route[1])) {
    watchProgressRepo.remove(route[1], Number(route[2]))
    return ok(res, null)
  }

  return fail(res, 404, 'Not found')
}
