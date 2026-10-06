package com.aziz.cinecasa.data

import kotlinx.coroutines.CancellationException

/** Something to play: a movie, or one episode of a show. */
data class PlayItem(
    val type: ItemType,
    val id: Int,
    val title: String,
    /** Episode line, e.g. "S1E3 · Pilot". */
    val subtitle: String? = null,
    val startMs: Long = 0,
)

/**
 * Keeps the PC's watch progress in sync while the player runs. It does what
 * the desktop's MPC-HC polling loop does (electron/ipc/playback.ts), but the
 * player pushes positions instead of being polled:
 *
 * - "start" as soon as playback begins, so the item shows in Continue Watching
 * - a position every [tickIntervalMs] while playing, plus on pause and exit
 * - "end" when the file finishes, then the next episode for auto-play
 *
 * Random mode (Tom & Jerry) never touches progress, same as the desktop.
 * Network errors are swallowed: losing Wi-Fi for a moment must not stop playback.
 */
class PlaybackSession(
    private val api: CinecasaApi,
    private val randomMode: Boolean,
    private val tickIntervalMs: Long = 10_000,
) {
    private var lastReportAt = 0L

    suspend fun started(item: PlayItem) {
        lastReportAt = 0
        if (randomMode) return
        send { api.reportProgress(item.type, item.id, item.startMs, 0, ProgressEvent.START) }
    }

    /** Called often (every player time change); only reports every [tickIntervalMs]. */
    suspend fun playing(item: PlayItem, positionMs: Long, durationMs: Long, nowMs: Long) {
        if (nowMs - lastReportAt < tickIntervalMs) return
        lastReportAt = nowMs
        save(item, positionMs, durationMs)
    }

    /** Report right away — on pause, seek, leaving the player. */
    suspend fun save(item: PlayItem, positionMs: Long, durationMs: Long) {
        if (randomMode || durationMs <= 0) return
        send { api.reportProgress(item.type, item.id, positionMs, durationMs, ProgressEvent.TICK) }
    }

    /**
     * The file played to the end: mark it watched and return what should play
     * next, if anything (movies never auto-play).
     */
    suspend fun ended(item: PlayItem, durationMs: Long): Episode? {
        if (!randomMode) {
            send { api.reportProgress(item.type, item.id, durationMs, durationMs, ProgressEvent.END) }
        }
        if (item.type != ItemType.EPISODE) return null
        return try {
            api.nextEpisode(item.id, randomMode)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun send(block: suspend () -> Unit) {
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Next report will catch up.
        }
    }
}

/** The PlayItem for an episode of a show, labelled like the desktop does. */
fun Episode.toPlayItem(showTitle: String, startMs: Long = 0): PlayItem = PlayItem(
    type = ItemType.EPISODE,
    id = id,
    title = showTitle,
    subtitle = listOfNotNull(episodeCode(seasonNumber, episodeNumber), title).joinToString(" · "),
    startMs = startMs,
)
