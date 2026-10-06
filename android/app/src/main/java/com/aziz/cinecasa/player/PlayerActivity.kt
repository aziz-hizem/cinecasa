package com.aziz.cinecasa.player

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import com.aziz.cinecasa.CinecasaApp
import com.aziz.cinecasa.data.Episode
import com.aziz.cinecasa.data.ItemType
import com.aziz.cinecasa.data.PlayItem
import com.aziz.cinecasa.data.PlaybackSession
import com.aziz.cinecasa.data.SubtitleTrack
import com.aziz.cinecasa.data.toPlayItem
import com.aziz.cinecasa.ui.theme.CinecasaTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IMedia
import org.videolan.libvlc.util.VLCVideoLayout

/** One choice in the audio or subtitle picker. */
data class TrackOption(val label: String, val selected: Boolean, val select: () -> Unit)

/** How the picture fills the screen. */
enum class FitMode(val label: String, val scale: MediaPlayer.ScaleType) {
    FIT("Fit", MediaPlayer.ScaleType.SURFACE_BEST_FIT),
    ZOOM("Zoom", MediaPlayer.ScaleType.SURFACE_FIT_SCREEN),
    STRETCH("Stretch", MediaPlayer.ScaleType.SURFACE_FILL),
}

/**
 * Full-screen player. libVLC streams the file straight from the PC (no
 * re-encoding) and plays practically anything: MKV, HEVC, DTS/TrueHD audio,
 * ASS subtitles. Progress goes back to the PC through [PlaybackSession].
 */
class PlayerActivity : ComponentActivity() {

    private val container get() = (application as CinecasaApp).container
    private lateinit var libVlc: LibVLC
    private lateinit var player: MediaPlayer
    private lateinit var session: PlaybackSession
    private var randomMode = false
    private var started = false

    // State the Compose UI reads.
    var item by mutableStateOf(PlayItem(ItemType.MOVIE, 0, ""))
        private set
    var isPlaying by mutableStateOf(false)
        private set
    var buffering by mutableStateOf(true)
        private set
    var positionMs by mutableLongStateOf(0L)
        private set
    var durationMs by mutableLongStateOf(0L)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var upNext by mutableStateOf<Episode?>(null)
        private set
    var fitMode by mutableStateOf(FitMode.FIT)
        private set

    private var externalSubs: List<SubtitleTrack> = emptyList()
    private var finished = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goImmersive()

        item = PlayItem(
            type = if (intent.getStringExtra(EXTRA_TYPE) == ItemType.EPISODE.wire) ItemType.EPISODE else ItemType.MOVIE,
            id = intent.getIntExtra(EXTRA_ID, 0),
            title = intent.getStringExtra(EXTRA_TITLE).orEmpty(),
            subtitle = intent.getStringExtra(EXTRA_SUBTITLE),
            startMs = intent.getLongExtra(EXTRA_START_MS, 0L),
        )
        randomMode = intent.getBooleanExtra(EXTRA_RANDOM, false)
        session = PlaybackSession(container.api, randomMode)

        libVlc = LibVLC(this, arrayListOf("--network-caching=1500", "--http-reconnect"))
        player = MediaPlayer(libVlc)
        player.setEventListener { event -> onPlayerEvent(event) }

        setContent {
            CinecasaTheme {
                PlayerScreen(this)
            }
        }
    }

    /** Called by the video surface once it exists; playback starts from here. */
    fun attachVideo(layout: VLCVideoLayout) {
        player.attachViews(layout, null, true, false)
        player.setVideoScale(fitMode.scale)
        if (!started) {
            started = true
            load(item)
        }
    }

    private fun load(next: PlayItem) {
        item = next
        upNext = null
        error = null
        finished = false
        buffering = true
        positionMs = next.startMs
        durationMs = 0
        externalSubs = emptyList()

        val media = Media(libVlc, Uri.parse(container.api.streamUrl(next.type, next.id)))
        media.setHWDecoderEnabled(true, false)
        if (next.startMs > 0) media.addOption(":start-time=${next.startMs / 1000}")
        player.setMedia(media)
        media.release()
        player.play()

        lifecycleScope.launch {
            session.started(next)
            externalSubs = runCatching { container.api.subtitles(next.type, next.id) }.getOrDefault(emptyList())
        }
    }

    private fun onPlayerEvent(event: MediaPlayer.Event) {
        when (event.type) {
            MediaPlayer.Event.Playing -> {
                isPlaying = true
                buffering = false
            }
            MediaPlayer.Event.Paused -> {
                isPlaying = false
                saveProgress()
            }
            MediaPlayer.Event.Buffering -> buffering = event.buffering < 100f
            MediaPlayer.Event.LengthChanged -> durationMs = player.length
            MediaPlayer.Event.TimeChanged -> {
                positionMs = player.time
                if (durationMs <= 0) durationMs = player.length
                val now = SystemClock.elapsedRealtime()
                val current = item
                val pos = positionMs
                val dur = durationMs
                lifecycleScope.launch { session.playing(current, pos, dur, now) }
            }
            MediaPlayer.Event.EndReached -> onEnded()
            MediaPlayer.Event.EncounteredError -> {
                isPlaying = false
                buffering = false
                error = "Couldn't play this file. Check that the PC is on and the file is still there."
            }
        }
    }

    private fun onEnded() {
        if (finished) return
        finished = true
        isPlaying = false
        val current = item
        val length = durationMs.takeIf { it > 0 } ?: player.length
        lifecycleScope.launch {
            val next = session.ended(current, length)
            val autoPlay = container.settings.autoPlay.first()
            if (next != null && autoPlay) upNext = next else finish()
        }
    }

    // ─── Actions from the controls ───────────────────────────────────────────

    fun togglePlay() {
        if (player.isPlaying) player.pause() else player.play()
    }

    fun seekTo(ms: Long) {
        val target = ms.coerceIn(0, (durationMs - 1_000).coerceAtLeast(0))
        player.setTime(target)
        positionMs = target
        saveProgress()
    }

    fun seekBy(deltaMs: Long) = seekTo(positionMs + deltaMs)

    fun cycleFit() {
        fitMode = FitMode.entries[(fitMode.ordinal + 1) % FitMode.entries.size]
        player.setVideoScale(fitMode.scale)
    }

    fun playUpNext() {
        val next = upNext ?: return
        load(next.toPlayItem(item.title))
    }

    fun cancelUpNext() {
        upNext = null
        finish()
    }

    fun audioOptions(): List<TrackOption> {
        val current = player.audioTrack
        return player.audioTracks.orEmpty().map { track ->
            TrackOption(track.name, track.id == current) { player.setAudioTrack(track.id) }
        }
    }

    /** Embedded subtitle tracks plus subtitle files sitting next to the video on the PC. */
    fun subtitleOptions(): List<TrackOption> {
        val current = player.spuTrack
        val embedded = player.spuTracks.orEmpty().map { track ->
            TrackOption(track.name, track.id == current) { player.setSpuTrack(track.id) }
        }
        val external = externalSubs.map { sub ->
            TrackOption("${sub.label} (${sub.ext.uppercase()} file)", false) {
                val url = container.api.subtitleUrl(item.type, item.id, sub.index)
                player.addSlave(IMedia.Slave.Type.Subtitle, Uri.parse(url), true)
            }
        }
        return embedded + external
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    private fun saveProgress() {
        if (finished) return
        val current = item
        val pos = player.time.takeIf { it > 0 } ?: positionMs
        val dur = durationMs.takeIf { it > 0 } ?: player.length
        container.appScope.launch { session.save(current, pos, dur) }
    }

    override fun onStop() {
        super.onStop()
        // Save now rather than waiting for the Paused event: when the player is
        // closing, that event can arrive after the listener is gone.
        if (player.isPlaying) player.pause()
        saveProgress()
    }

    override fun onDestroy() {
        super.onDestroy()
        player.setEventListener(null)
        player.stop()
        player.detachViews()
        player.release()
        libVlc.release()
    }

    private fun goImmersive() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    companion object {
        private const val EXTRA_TYPE = "type"
        private const val EXTRA_ID = "id"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_SUBTITLE = "subtitle"
        private const val EXTRA_START_MS = "startMs"
        private const val EXTRA_RANDOM = "random"

        /** Play [item]. Random mode (Tom & Jerry) shuffles episodes and saves no progress. */
        fun start(context: Context, item: PlayItem, randomMode: Boolean = false) {
            context.startActivity(
                Intent(context, PlayerActivity::class.java)
                    .putExtra(EXTRA_TYPE, item.type.wire)
                    .putExtra(EXTRA_ID, item.id)
                    .putExtra(EXTRA_TITLE, item.title)
                    .putExtra(EXTRA_SUBTITLE, item.subtitle)
                    .putExtra(EXTRA_START_MS, item.startMs)
                    .putExtra(EXTRA_RANDOM, randomMode)
            )
        }
    }
}
