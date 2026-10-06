package com.aziz.cinecasa.player

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AspectRatio
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.aziz.cinecasa.data.episodeCode
import com.aziz.cinecasa.data.formatPosition
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.delay
import org.videolan.libvlc.util.VLCVideoLayout

private const val HIDE_CONTROLS_MS = 4_000L
private const val SEEK_STEP_MS = 10_000L
private const val UP_NEXT_SECONDS = 5

private enum class Picker { AUDIO, SUBTITLES }

@Composable
fun PlayerScreen(player: PlayerActivity) {
    var controlsVisible by remember { mutableStateOf(true) }
    /** Bumped on every touch so the auto-hide timer restarts. */
    var interaction by remember { mutableIntStateOf(0) }
    var picker by remember { mutableStateOf<Picker?>(null) }
    /** Slider position while dragging, so the thumb doesn't jump back mid-drag. */
    var dragFraction by remember { mutableStateOf<Float?>(null) }

    fun touched() {
        controlsVisible = true
        interaction++
    }

    LaunchedEffect(controlsVisible, interaction, player.isPlaying, picker) {
        if (controlsVisible && player.isPlaying && picker == null && dragFraction == null) {
            delay(HIDE_CONTROLS_MS)
            controlsVisible = false
        }
    }

    BackHandler { player.finish() }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = {
                        if (controlsVisible) controlsVisible = false else touched()
                    },
                    onDoubleTap = { offset ->
                        // Double-tap the left or right half to jump back or forward.
                        player.seekBy(if (offset.x < size.width / 2) -SEEK_STEP_MS else SEEK_STEP_MS)
                        touched()
                    },
                )
            },
    ) {
        AndroidView(
            factory = { context -> VLCVideoLayout(context).also { player.attachVideo(it) } },
            modifier = Modifier.fillMaxSize(),
        )

        if (player.buffering && player.error == null) {
            CircularProgressIndicator(Modifier.align(Alignment.Center), color = CinecasaColors.Accent)
        }

        AnimatedVisibility(
            visible = controlsVisible && player.upNext == null && player.error == null,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize(),
        ) {
            Controls(
                player = player,
                dragFraction = dragFraction,
                onDrag = { dragFraction = it; touched() },
                onDragEnd = {
                    dragFraction?.let { player.seekTo((it * player.durationMs).toLong()) }
                    dragFraction = null
                    touched()
                },
                onPicker = { picker = it; touched() },
                onTouched = ::touched,
            )
        }

        player.error?.let { message ->
            Column(
                Modifier.align(Alignment.Center).widthIn(max = 480.dp).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(message, color = Color.White, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(16.dp))
                Button(onClick = { player.finish() }) { Text("Back") }
            }
        }

        player.upNext?.let { next ->
            UpNext(
                title = player.item.title,
                episode = listOfNotNull(episodeCode(next.seasonNumber, next.episodeNumber), next.title).joinToString(" · "),
                onPlay = { player.playUpNext() },
                onCancel = { player.cancelUpNext() },
                modifier = Modifier.align(Alignment.BottomEnd).padding(32.dp),
            )
        }
    }

    picker?.let { which ->
        val options = if (which == Picker.AUDIO) player.audioOptions() else player.subtitleOptions()
        TrackPicker(
            title = if (which == Picker.AUDIO) "Audio" else "Subtitles",
            options = options,
            onDismiss = { picker = null },
        )
    }
}

@Composable
private fun Controls(
    player: PlayerActivity,
    dragFraction: Float?,
    onDrag: (Float) -> Unit,
    onDragEnd: () -> Unit,
    onPicker: (Picker) -> Unit,
    onTouched: () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        // Top: back + title
        Row(
            Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.75f), Color.Transparent)))
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { player.finish() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White)
            }
            Spacer(Modifier.width(8.dp))
            Column {
                Text(player.item.title, color = Color.White, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                player.item.subtitle?.let {
                    Text(it, color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }

        // Centre: -10s, play/pause, +10s
        Row(
            Modifier.align(Alignment.Center),
            horizontalArrangement = Arrangement.spacedBy(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RoundButton(onClick = { player.seekBy(-SEEK_STEP_MS); onTouched() }, size = 64) {
                Icon(Icons.Filled.Replay10, "Back 10 seconds", tint = Color.White, modifier = Modifier.size(36.dp))
            }
            RoundButton(onClick = { player.togglePlay(); onTouched() }, size = 84) {
                Icon(
                    if (player.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    if (player.isPlaying) "Pause" else "Play",
                    tint = Color.White,
                    modifier = Modifier.size(52.dp),
                )
            }
            RoundButton(onClick = { player.seekBy(SEEK_STEP_MS); onTouched() }, size = 64) {
                Icon(Icons.Filled.Forward10, "Forward 10 seconds", tint = Color.White, modifier = Modifier.size(36.dp))
            }
        }

        // Bottom: seek bar + tracks
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f))))
                .padding(horizontal = 32.dp, vertical = 20.dp),
        ) {
            val duration = player.durationMs
            val fraction = dragFraction
                ?: if (duration > 0) (player.positionMs.toFloat() / duration).coerceIn(0f, 1f) else 0f
            Slider(
                value = fraction,
                onValueChange = onDrag,
                onValueChangeFinished = onDragEnd,
                enabled = duration > 0,
                colors = SliderDefaults.colors(
                    thumbColor = CinecasaColors.Accent,
                    activeTrackColor = CinecasaColors.Accent,
                    inactiveTrackColor = Color.White.copy(alpha = 0.3f),
                ),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                val shownPosition = if (dragFraction != null) (dragFraction * duration).toLong() else player.positionMs
                Text(
                    "${formatPosition(shownPosition)} / ${formatPosition(duration)}",
                    color = Color.White,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { onPicker(Picker.AUDIO) }) {
                    Icon(Icons.Filled.Audiotrack, null, tint = Color.White)
                    Text("  Audio", color = Color.White)
                }
                TextButton(onClick = { onPicker(Picker.SUBTITLES) }) {
                    Icon(Icons.Filled.Subtitles, null, tint = Color.White)
                    Text("  Subtitles", color = Color.White)
                }
                TextButton(onClick = { player.cycleFit(); onTouched() }) {
                    Icon(Icons.Filled.AspectRatio, null, tint = Color.White)
                    Text("  ${player.fitMode.label}", color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun RoundButton(onClick: () -> Unit, size: Int, content: @Composable () -> Unit) {
    Box(
        Modifier
            .size(size.dp)
            .background(Color.Black.copy(alpha = 0.45f), RoundedCornerShape(50))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}

/** The desktop's auto-play, with a short countdown so you can stop it. */
@Composable
private fun UpNext(
    title: String,
    episode: String,
    onPlay: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var remaining by remember(episode) { mutableIntStateOf(UP_NEXT_SECONDS) }
    LaunchedEffect(episode) {
        while (remaining > 0) {
            delay(1_000)
            remaining--
        }
        onPlay()
    }
    Column(
        modifier
            .widthIn(max = 420.dp)
            .background(CinecasaColors.BgCard.copy(alpha = 0.95f), RoundedCornerShape(12.dp))
            .padding(20.dp),
    ) {
        Text("Up next in $remaining", color = CinecasaColors.TextSecondary, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(6.dp))
        Text(title, color = Color.White, style = MaterialTheme.typography.titleMedium)
        Text(episode, color = Color.White.copy(alpha = 0.8f), maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = onPlay) {
                Icon(Icons.Filled.PlayArrow, null)
                Text(" Play now")
            }
            OutlinedButton(onClick = onCancel) { Text("Cancel") }
        }
    }
}

@Composable
private fun TrackPicker(title: String, options: List<TrackOption>, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            if (options.isEmpty()) {
                Text("No tracks available.")
            } else {
                LazyColumn {
                    items(options) { option ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    option.select()
                                    onDismiss()
                                }
                                .padding(vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.width(32.dp)) {
                                if (option.selected) Icon(Icons.Filled.Check, null, tint = CinecasaColors.Accent)
                            }
                            Text(option.label)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}
