import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  InProgressItem,
  IpcResult,
  PlaybackLaunchParams,
  PlaybackProgressEvent,
  WatchProgress,
  WatchState,
} from '@shared/types'
import { settingsRepo, watchProgressRepo, getNextEpisode, isSpecialShow, getEpisodeShowId, getRandomEpisodeForShow } from '../db/queries'
import { launchMpcHc, killMpcHc, pollMpcHc } from '../services/mpcHc'
import type { MpcHcStatus } from '../services/mpcHc'

// ─── Module-level playback state ─────────────────────────────────────────────

interface ActiveItem {
  itemType: 'movie' | 'episode'
  itemId: number
  filePath: string
  showId: number | null
}

let currentItem: ActiveItem | null = null
let pollingTimer: ReturnType<typeof setInterval> | null = null
/** Last successful poll result — used as the save-on-close fallback. */
let lastKnownStatus: MpcHcStatus | null = null
/** Timestamp before which polls are discarded (stale MPC-HC load window). */
let staleUntil = 0
/** The web-interface port assigned to the currently active MPC-HC instance. */
let activePollPort = 0
/** Whether to automatically launch the next episode when the current one ends. */
let autoPlayNext = true
/** When true, auto-play picks a random episode from the same show (Tom & Jerry mode). */
let randomPlayMode = false

function clearPolling(): void {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeState(positionMs: number, durationMs: number): WatchState {
  if (durationMs <= 0) return 'in_progress'
  if (positionMs / durationMs >= 0.95) return 'watched'
  return 'in_progress'
  // NOTE: we never downgrade to 'unwatched' here — once play is pressed the
  // item is in_progress regardless of position (including position=0).
}

function saveProgress(item: ActiveItem, status: MpcHcStatus): void {
  const state = computeState(status.positionMs, status.durationMs)
  watchProgressRepo.upsert({
    itemType: item.itemType,
    itemId: item.itemId,
    positionMs: status.positionMs,
    durationMs: status.durationMs,
    state,
    lastPlayedAt: Date.now(),
    watchedAt: state === 'watched' ? Date.now() : null,
  })
}

function pushProgress(item: ActiveItem, status: MpcHcStatus): void {
  const payload: PlaybackProgressEvent = {
    itemType: item.itemType,
    itemId: item.itemId,
    positionMs: status.positionMs,
    durationMs: status.durationMs,
    state: computeState(status.positionMs, status.durationMs),
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.EVT_PLAYBACK_PROGRESS, payload)
    }
  }
}

/**
 * Central "this item has finished playing" handler — called either when MPC-HC
 * exits naturally OR when the polling loop detects state=stopped at end-of-file.
 * Saves progress, optionally launches the next episode, and clears all state.
 *
 * @param item      The item that just finished.
 * @param finalStatus  The last known status (used to write the final DB record).
 */
function handlePlaybackFinished(item: ActiveItem, finalStatus: MpcHcStatus): void {
  // Always save as fully watched so the UI reflects completion.
  const completedStatus: MpcHcStatus = {
    ...finalStatus,
    positionMs: finalStatus.durationMs > 0 ? finalStatus.durationMs : finalStatus.positionMs,
    state: 0,
  }
  if (!randomPlayMode) {
    saveProgress(item, completedStatus)
    pushProgress(item, completedStatus)
  }

  if (!autoPlayNext || item.itemType !== 'episode') return

  // ── Random mode (Tom & Jerry): pick a random episode from the same show ──
  if (randomPlayMode && item.showId !== null) {
    const randomEp = getRandomEpisodeForShow(item.showId, item.itemId)
    if (!randomEp) return

    setTimeout(() => {
      void (async () => {
        try {
          const { mpcHcPath, pollingIntervalMs } = settingsRepo.getAll()
          currentItem = { itemType: 'episode', itemId: randomEp.id, filePath: randomEp.filePath, showId: randomEp.showId }
          lastKnownStatus = null
          staleUntil = Date.now() + 7000
          activePollPort = await launchMpcHc(randomEp.filePath, mpcHcPath, 0, onMpcHcExit)
          setTimeout(() => startPolling(activePollPort, pollingIntervalMs), 3000)
        } catch (err) {
          console.error('[autoplay-random] failed to launch next episode:', err)
          currentItem = null
        }
      })()
    }, 1500)
    return
  }

  // ── Sequential mode: next episode in order ────────────────────────────────
  const nextEp = getNextEpisode(item.itemId)
  if (!nextEp) return
  if (isSpecialShow(nextEp.showId)) return

  // Notify the renderer so the Continue Watching row updates immediately.
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.EVT_PLAYBACK_NEXT_EPISODE, {
        episodeId: nextEp.id,
        showId: nextEp.showId,
        seasonNumber: nextEp.seasonNumber,
        episodeNumber: nextEp.episodeNumber,
      })
    }
  }

  // Small delay so the current MPC-HC window has time to clean up.
  setTimeout(() => {
    void (async () => {
      try {
        const { mpcHcPath, pollingIntervalMs } = settingsRepo.getAll()
        currentItem = { itemType: 'episode', itemId: nextEp.id, filePath: nextEp.filePath, showId: nextEp.showId }
        lastKnownStatus = null
        staleUntil = Date.now() + 7000
        activePollPort = await launchMpcHc(nextEp.filePath, mpcHcPath, 0, onMpcHcExit)
        setTimeout(() => startPolling(activePollPort, pollingIntervalMs), 3000)
      } catch (err) {
        console.error('[autoplay] failed to launch next episode:', err)
        currentItem = null
      }
    })()
  }, 1500)
}

/**
 * Start the polling interval for the currently active MPC-HC instance.
 *
 * In addition to saving live progress, the loop detects end-of-file by watching
 * for state=0 (stopped) after the file has confirmed started playing (hasPlayed).
 * This is necessary because MPC-HC doesn't close when a file finishes — it just
 * stops and sits idle.
 */
function startPolling(port: number, intervalMs: number): void {
  clearPolling()

  // Becomes true once we see state=2 (playing), confirming the file loaded.
  // Prevents the initial stopped state (before load) from being treated as EOF.
  let hasPlayed = false

  pollingTimer = setInterval(async () => {
    if (!currentItem) return
    const status = await pollMpcHc(port)
    if (!status) return
    if (Date.now() < staleUntil) return

    // Filename sanity-check: make sure we're reading our own instance.
    if (status.filePath) {
      const expected = currentItem.filePath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
      if (status.filePath.toLowerCase() !== expected) return
    }

    // Track that the file has actually started playing.
    if (status.state === 2) hasPlayed = true

    // ── End-of-file detection ─────────────────────────────────────────────────
    // MPC-HC behaviour at end of file varies by version/settings:
    //   • Some builds go to state=0 (stopped) at the last frame.
    //   • Most builds pause at the last frame — state=1 with position ≈ duration.
    // We treat both as "finished": not actively playing (state ≠ 2) AND
    // position is within the last 3 seconds of a known duration.
    const atEnd =
      hasPlayed &&
      status.state !== 2 &&
      status.durationMs > 0 &&
      status.positionMs >= status.durationMs - 3000

    if (atEnd) {
      clearPolling()
      const item = currentItem
      currentItem = null
      lastKnownStatus = null

      if (item) {
        // Kill the idle MPC-HC window before launching the next one.
        // killMpcHc removes listeners so onMpcHcExit won't fire again.
        killMpcHc()
        handlePlaybackFinished(item, status)
      }
      return
    }

    // Normal in-progress save — skipped in random mode.
    lastKnownStatus = status
    if (!randomPlayMode) {
      saveProgress(currentItem, status)
      pushProgress(currentItem, status)
    }
  }, intervalMs)
}

/**
 * Called when the MPC-HC process exits (user closes the window, or we killed it).
 * Uses the last cached poll as the final position.
 */
function onMpcHcExit(): void {
  const item = currentItem
  const cached = lastKnownStatus
  clearPolling()
  currentItem = null
  lastKnownStatus = null

  if (!item || !cached) return

  // If the poll loop already called handlePlaybackFinished (detected EOF),
  // currentItem was set to null there — so item/cached being present here means
  // the user manually closed MPC-HC mid-playback. Save their position but don't
  // auto-play. Skip if we're paused right at the end (already handled by poll).
  const atEnd =
    cached.durationMs > 0 && cached.positionMs >= cached.durationMs - 3000
  if (!atEnd && !randomPlayMode) {
    saveProgress(item, cached)
    pushProgress(item, cached)
  }
}

// ─── IPC registration ────────────────────────────────────────────────────────

export function registerPlaybackIpc(): void {

  // ── Launch ──────────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_LAUNCH,
    async (_e, params: PlaybackLaunchParams): Promise<IpcResult<void>> => {
      try {
        const { mpcHcPath, pollingIntervalMs } = settingsRepo.getAll()

        clearPolling()
        randomPlayMode = params.randomMode ?? false
        const showId = params.itemType === 'episode' ? getEpisodeShowId(params.itemId) : null
        currentItem = { itemType: params.itemType, itemId: params.itemId, filePath: params.filePath, showId }
        lastKnownStatus = null
        staleUntil = Date.now() + 7000

        // Write a record immediately so the item appears in Continue Watching
        // even if the user quits before the first poll fires.
        // Skipped in random mode — random playback never touches Continue Watching.
        if (!randomPlayMode) {
          watchProgressRepo.markStarted(params.itemType, params.itemId, params.startMs)
          pushProgress(currentItem, {
            positionMs: params.startMs,
            durationMs: 0,
            state: 0,
            filePath: '',
          })
        }

        activePollPort = await launchMpcHc(params.filePath, mpcHcPath, params.startMs, onMpcHcExit)

        // Give MPC-HC 3 s to start, then begin polling.
        setTimeout(() => startPolling(activePollPort, pollingIntervalMs), 3000)

        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  // ── Stop ────────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLAYBACK_STOP, async (): Promise<IpcResult<void>> => {
    try {
      const item = currentItem
      const port = activePollPort
      clearPolling()
      currentItem = null

      if (item) {
        const status = (port ? await pollMpcHc(port) : null) ?? lastKnownStatus
        if (status) saveProgress(item, status)
      }

      lastKnownStatus = null
      killMpcHc()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  // ── Status ──────────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_STATUS,
    (): IpcResult<{ isPlaying: boolean; currentItem: ActiveItem | null }> => ({
      ok: true,
      data: { isPlaying: currentItem !== null, currentItem },
    }),
  )

  // ── Get progress for one item ────────────────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_GET_PROGRESS,
    (_e, itemType: 'movie' | 'episode', itemId: number): IpcResult<WatchProgress | null> => ({
      ok: true,
      data: watchProgressRepo.getByItem(itemType, itemId),
    }),
  )

  // ── Get progress for all episodes of a show ──────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_LIST_SHOW_PROGRESS,
    (_e, showId: number): IpcResult<WatchProgress[]> => ({
      ok: true,
      data: watchProgressRepo.listForShow(showId),
    }),
  )

  // ── Continue Watching list ───────────────────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_LIST_IN_PROGRESS,
    (_e, limit = 20): IpcResult<InProgressItem[]> => ({
      ok: true,
      data: watchProgressRepo.listInProgress(limit),
    }),
  )

  // ── Test MPC-HC web interface connection ─────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_TEST_CONNECTION,
    async (_e, port: number): Promise<IpcResult<boolean>> => {
      const status = await pollMpcHc(port)
      return { ok: true, data: status !== null }
    },
  )

  // ── Remove from Continue Watching ────────────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_REMOVE_PROGRESS,
    (_e, itemType: 'movie' | 'episode', itemId: number): IpcResult<void> => {
      try {
        watchProgressRepo.remove(itemType, itemId)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  // ── Auto-play next episode toggle ─────────────────────────────────────────────
  ipcMain.handle(
    IPC.PLAYBACK_GET_AUTOPLAY,
    (): IpcResult<boolean> => ({ ok: true, data: autoPlayNext }),
  )

  ipcMain.handle(
    IPC.PLAYBACK_SET_AUTOPLAY,
    (_e, enabled: boolean): IpcResult<void> => {
      autoPlayNext = enabled
      return { ok: true }
    },
  )
}
