import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'

const VIDEO_MIME: Record<string, string> = {
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
}

const SUBTITLE_MIME: Record<string, string> = {
  '.srt': 'application/x-subrip',
  '.ass': 'text/x-ssa',
  '.ssa': 'text/x-ssa',
  '.vtt': 'text/vtt',
}

/**
 * Parse a single-range `Range: bytes=…` header against a file size.
 * Returns null when the header is absent, 'invalid' when it can't be satisfied.
 * Only the first range of a multi-range request is honoured — players never
 * send more than one.
 */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)/.exec(header.trim())
  if (!m) return 'invalid'
  const [, rawStart, rawEnd] = m
  let start: number
  let end: number
  if (rawStart === '') {
    // Suffix range: the last N bytes.
    const suffix = Number(rawEnd)
    if (!suffix) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  }
  if (start > end || start >= size) return 'invalid'
  return { start, end }
}

/**
 * Stream a file with HTTP Range support so the tablet player can seek without
 * downloading the whole file.
 */
export async function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) throw new Error('not a file')
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'File is missing on the PC.' }))
    return
  }

  const size = stat.size
  const range = parseRange(req.headers.range, size)
  const baseHeaders = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  }

  if (range === 'invalid') {
    res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${size}` })
    res.end()
    return
  }

  const start = range?.start ?? 0
  const end = range?.end ?? size - 1

  if (range) {
    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    })
  } else {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': size })
  }

  if (req.method === 'HEAD' || size === 0) {
    res.end()
    return
  }

  try {
    await pipeline(fs.createReadStream(filePath, { start, end }), res)
  } catch {
    // The player closed the connection (seek, stop, pause buffering) — normal.
  }
}

export function videoMimeFor(filePath: string): string {
  return VIDEO_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export interface SubtitleFile {
  index: number
  /** Label shown in the track picker, e.g. "English" from "Movie.en.srt" → "en". */
  label: string
  ext: string
  fullPath: string
}

/**
 * Sidecar subtitle files next to a video: "Movie.srt", "Movie.en.srt",
 * "Movie.English.forced.ass", … The order is stable so an index can be used as
 * an id in URLs.
 */
export async function listSidecarSubtitles(videoPath: string): Promise<SubtitleFile[]> {
  const dir = path.dirname(videoPath)
  const base = path.basename(videoPath, path.extname(videoPath)).toLowerCase()
  let names: string[]
  try {
    names = await fs.promises.readdir(dir)
  } catch {
    return []
  }
  return names
    .filter((n) => {
      const ext = path.extname(n).toLowerCase()
      return ext in SUBTITLE_MIME && n.toLowerCase().startsWith(base)
    })
    .sort((a, b) => a.localeCompare(b))
    .map((n, index) => {
      const ext = path.extname(n).toLowerCase()
      const middle = n.slice(base.length, n.length - ext.length).replace(/^[\s._-]+/, '')
      return {
        index,
        label: middle || 'External',
        ext: ext.slice(1),
        fullPath: path.join(dir, n),
      }
    })
}

export function subtitleMimeFor(ext: string): string {
  return SUBTITLE_MIME[`.${ext}`] ?? 'text/plain'
}
