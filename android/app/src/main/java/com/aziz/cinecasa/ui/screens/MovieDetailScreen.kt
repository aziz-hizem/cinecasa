package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.data.ItemType
import com.aziz.cinecasa.data.PlayItem
import com.aziz.cinecasa.data.WatchState
import com.aziz.cinecasa.data.formatPosition
import com.aziz.cinecasa.data.formatRuntime
import com.aziz.cinecasa.player.PlayerActivity
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.components.LoadContent
import com.aziz.cinecasa.ui.components.MetaLine
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.components.ProgressLine
import com.aziz.cinecasa.ui.components.TitleArt
import com.aziz.cinecasa.ui.rememberLoad
import com.aziz.cinecasa.ui.theme.CinecasaColors

@Composable
fun MovieDetailScreen(id: Int, nav: NavController) {
    val app = LocalApp.current
    val context = LocalContext.current
    val load = rememberLoad(id) { app.api.movie(id) }

    LoadContent(load) { detail ->
        val movie = detail.movie
        val progress = detail.progress
        val resumable = progress != null && progress.state == WatchState.IN_PROGRESS && progress.positionMs > 0

        fun play(fromMs: Long) {
            PlayerActivity.start(context, PlayItem(ItemType.MOVIE, movie.id, movie.title, startMs = fromMs))
        }

        LazyColumn(contentPadding = PaddingValues(bottom = 48.dp)) {
            item {
                DetailHero(movie.backdropPath, title = movie.title, onBack = { nav.popBackStack() })
            }
            item {
                Column(
                    Modifier
                        .offset(y = (-120).dp)
                        .padding(horizontal = PagePadding)
                        .widthIn(max = 900.dp),
                ) {
                    TitleArt(movie.title, movie.logoPath, maxHeight = 120.dp)
                    Spacer(Modifier.height(14.dp))
                    MetaLine(movie.rating, movie.year, listOfNotNull(formatRuntime(movie.runtime).ifEmpty { null }))
                    Spacer(Modifier.height(12.dp))
                    GenreChips(movie.genres)
                    if (!movie.tagline.isNullOrBlank()) {
                        Spacer(Modifier.height(14.dp))
                        Text(movie.tagline, fontStyle = FontStyle.Italic, color = CinecasaColors.TextSecondary)
                    }
                    Spacer(Modifier.height(20.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (resumable) {
                            Button(onClick = { play(progress.positionMs) }) {
                                Icon(Icons.Filled.PlayArrow, null, Modifier.size(20.dp))
                                Text("  Resume · ${formatPosition(progress.positionMs)}")
                            }
                            OutlinedButton(onClick = { play(0) }) {
                                Icon(Icons.Filled.Replay, null, Modifier.size(18.dp))
                                Text("  Play from start")
                            }
                        } else {
                            Button(onClick = { play(0) }) {
                                Icon(Icons.Filled.PlayArrow, null, Modifier.size(20.dp))
                                Text("  Play")
                            }
                        }
                        if (progress?.state == WatchState.WATCHED) {
                            Icon(Icons.Filled.CheckCircle, null, tint = CinecasaColors.Success)
                            Text("Watched", color = CinecasaColors.Success)
                        }
                    }
                    if (resumable) {
                        Spacer(Modifier.height(10.dp))
                        ProgressLine(progress.fraction, Modifier.widthIn(max = 360.dp))
                    }
                    if (!movie.overview.isNullOrBlank()) {
                        Spacer(Modifier.height(20.dp))
                        Text(movie.overview, style = MaterialTheme.typography.bodyLarge, color = CinecasaColors.TextPrimary.copy(alpha = 0.9f))
                    }
                }
            }
            item {
                Column(Modifier.offset(y = (-96).dp)) { CastRow(detail.cast) }
            }
        }
    }
}
