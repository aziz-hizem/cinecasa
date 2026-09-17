import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { IpcResult, ScanMode, ScanProgressEvent, ScanResult } from '@shared/types'
import {
  castRepo,
  clearLibraryData,
  episodesRepo,
  libraryRootsRepo,
  moviesRepo,
  seasonsRepo,
  searchRepo,
  showsRepo,
} from '../db/queries'
import { runFullScan } from '../services/scanOrchestrator'

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

let scanInFlight = false

export function registerLibraryIpc(): void {
  ipcMain.handle(IPC.LIBRARY_SCAN, async (evt) => {
    if (scanInFlight) return fail(new Error('A scan is already running.'))
    scanInFlight = true
    try {
      const win = BrowserWindow.fromWebContents(evt.sender)
      const send = (e: ScanProgressEvent) => {
        win?.webContents.send(IPC.EVT_SCAN_PROGRESS, e)
      }
      const result: ScanResult = await runFullScan({ onProgress: send })
      return ok(result)
    } catch (e) {
      return fail(e)
    } finally {
      scanInFlight = false
    }
  })

  ipcMain.handle(IPC.LIBRARY_SCAN_ROOT, async (evt, rootId: number, mode?: ScanMode) => {
    if (scanInFlight) return fail(new Error('A scan is already running.'))
    scanInFlight = true
    try {
      const root = libraryRootsRepo.getById(rootId)
      if (!root) return fail(new Error(`Library root ${rootId} not found.`))

      const win = BrowserWindow.fromWebContents(evt.sender)
      const send = (e: ScanProgressEvent) => {
        win?.webContents.send(IPC.EVT_SCAN_PROGRESS, e)
      }
      const scanMode: ScanMode = mode === 'new' ? 'new' : 'full'
      const result: ScanResult = await runFullScan({ onProgress: send, roots: [root], mode: scanMode })
      return ok(result)
    } catch (e) {
      return fail(e)
    } finally {
      scanInFlight = false
    }
  })

  ipcMain.handle(IPC.LIBRARY_CLEAR, () => {
    try {
      clearLibraryData()
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_LIST_MOVIES, () => {
    try {
      return ok(moviesRepo.list())
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_LIST_SHOWS, () => {
    try {
      return ok(showsRepo.list())
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_LIST_RECENT_MOVIES, (_evt, limit?: number) => {
    try {
      return ok(moviesRepo.listRecent(limit ?? 20))
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_LIST_RECENT_SHOWS, (_evt, limit?: number) => {
    try {
      return ok(showsRepo.listRecent(limit ?? 20))
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_GET_MOVIE, (_evt, id: number) => {
    try {
      const movie = moviesRepo.getById(id)
      if (!movie) return fail(new Error(`Movie ${id} not found`))
      return ok(movie)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_GET_SHOW, (_evt, id: number) => {
    try {
      const show = showsRepo.getById(id)
      if (!show) return fail(new Error(`Show ${id} not found`))
      return ok(show)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_SEARCH, (_evt, query: string) => {
    try {
      return ok(searchRepo.search(query))
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_LIST_SEASONS, (_evt, showId: number) => {
    try {
      return ok(seasonsRepo.listByShow(showId))
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    IPC.LIBRARY_LIST_EPISODES,
    (_evt, showId: number, seasonNumber?: number) => {
      try {
        const episodes =
          typeof seasonNumber === 'number'
            ? episodesRepo.listBySeason(showId, seasonNumber)
            : episodesRepo.listByShow(showId)
        return ok(episodes)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    IPC.LIBRARY_LIST_CAST,
    (_evt, parentType: 'movie' | 'show', parentId: number) => {
      try {
        return ok(castRepo.listFor(parentType, parentId))
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(IPC.LIBRARY_DELETE_SHOW, (_evt, id: number) => {
    try {
      showsRepo.delete(id)
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(IPC.LIBRARY_DELETE_MOVIE, (_evt, id: number) => {
    try {
      moviesRepo.delete(id)
      return ok(undefined)
    } catch (e) {
      return fail(e)
    }
  })
}
