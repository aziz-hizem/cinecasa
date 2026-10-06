package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SecondaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.data.Episode
import com.aziz.cinecasa.data.ShowDetail
import com.aziz.cinecasa.data.TOM_AND_JERRY
import com.aziz.cinecasa.data.WatchProgress
import com.aziz.cinecasa.data.WatchState
import com.aziz.cinecasa.data.episodeCode
import com.aziz.cinecasa.data.formatPosition
import com.aziz.cinecasa.data.formatRuntime
import com.aziz.cinecasa.data.specialFor
import com.aziz.cinecasa.data.toPlayItem
import com.aziz.cinecasa.player.PlayerActivity
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.components.AssetImage
import com.aziz.cinecasa.ui.components.CardShape
import com.aziz.cinecasa.ui.components.LoadContent
import com.aziz.cinecasa.ui.components.MetaLine
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.components.ProgressLine
import com.aziz.cinecasa.ui.components.RemoteImage
import com.aziz.cinecasa.ui.components.TitleArt
import com.aziz.cinecasa.ui.rememberLoad
import com.aziz.cinecasa.ui.theme.CinecasaColors

@Composable
fun ShowDetailScreen(id: Int, nav: NavController) {
    val app = LocalApp.current
    val load = rememberLoad(id) { app.api.show(id) }
    LoadContent(load) { detail -> ShowDetailContent(detail, onBack = { nav.popBackStack() }) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShowDetailContent(detail: ShowDetail, onBack: () -> Unit) {
    val context = LocalContext.current
    val show = detail.show
    val special = specialFor(detail.specialKind)
    val progress = remember(detail) { detail.progress.associateBy { it.itemId } }

    // Seasons that actually have files, and the episode to resume.
    val seasons = remember(detail) {
        val withFiles = detail.episodes.map { it.seasonNumber }.toSet()
        detail.seasons.filter { it.seasonNumber in withFiles }
    }
    val resume = remember(detail) {
        detail.progress
            .filter { it.state == WatchState.IN_PROGRESS }
            .maxByOrNull { it.lastPlayedAt ?: 0 }
            ?.let { p -> detail.episodes.firstOrNull { it.id == p.itemId }?.let { it to p } }
    }
    val partCounts = remember(detail) {
        detail.episodes.groupingBy { it.seasonNumber to it.episodeNumber }.eachCount()
    }
    var activeSeason by rememberSaveable(detail.show.id) {
        mutableStateOf(
            resume?.first?.seasonNumber
                ?: (seasons.firstOrNull { it.seasonNumber > 0 } ?: seasons.firstOrNull())?.seasonNumber
        )
    }
    val episodes = detail.episodes.filter { it.seasonNumber == activeSeason }

    fun play(ep: Episode, random: Boolean = false) {
        val p = progress[ep.id]
        val start = if (!random && p?.state == WatchState.IN_PROGRESS) p.positionMs else 0
        PlayerActivity.start(context, ep.toPlayItem(show.title, start), randomMode = random)
    }

    Box(Modifier.fillMaxSize()) {
        if (special != null) SpecialBackdrop(special)

        LazyColumn(contentPadding = PaddingValues(bottom = 48.dp)) {
            item {
                DetailHero(
                    backdropKey = show.backdropPath,
                    backdropAsset = special?.backgroundUri,
                    title = show.title,
                    onBack = onBack,
                )
            }
            item {
                Column(
                    Modifier
                        .offset(y = (-120).dp)
                        .padding(horizontal = PagePadding)
                        .widthIn(max = 900.dp),
                ) {
                    if (special != null) {
                        AssetImage(
                            special.logoUri,
                            special.name,
                            Modifier.heightIn(max = 110.dp).widthIn(max = 400.dp).fillMaxWidth(),
                            contentScale = ContentScale.Fit,
                            alignment = Alignment.CenterStart,
                        )
                    } else {
                        TitleArt(show.title, show.logoPath, maxHeight = 120.dp)
                    }
                    Spacer(Modifier.height(14.dp))
                    MetaLine(
                        show.rating,
                        show.year,
                        listOfNotNull(
                            show.status,
                            "${seasons.size} season${if (seasons.size == 1) "" else "s"} · " +
                                "${detail.episodes.size} episode${if (detail.episodes.size == 1) "" else "s"}",
                        ),
                    )
                    Spacer(Modifier.height(12.dp))
                    GenreChips(show.genres)

                    val canShuffle = detail.specialKind == TOM_AND_JERRY && detail.episodes.isNotEmpty()
                    if (resume != null || canShuffle) {
                        Spacer(Modifier.height(20.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            if (resume != null) {
                                val (ep, p) = resume
                                Button(onClick = { play(ep) }) {
                                    Icon(Icons.Filled.PlayArrow, null, Modifier.size(20.dp))
                                    Text("  Resume ${episodeCode(ep.seasonNumber, ep.episodeNumber)} · ${formatPosition(p.positionMs)}")
                                }
                            }
                            if (canShuffle) {
                                OutlinedButton(onClick = { play(detail.episodes.random(), random = true) }) {
                                    Icon(Icons.Filled.Shuffle, null, Modifier.size(18.dp))
                                    Text("  Play Random Episode")
                                }
                            }
                        }
                    }
                    if (!show.overview.isNullOrBlank()) {
                        Spacer(Modifier.height(20.dp))
                        Text(show.overview, style = MaterialTheme.typography.bodyLarge, color = CinecasaColors.TextPrimary.copy(alpha = 0.9f))
                    }
                }
            }

            if (seasons.size > 1) {
                item {
                    val selected = seasons.indexOfFirst { it.seasonNumber == activeSeason }.coerceAtLeast(0)
                    SecondaryScrollableTabRow(
                        selectedTabIndex = selected,
                        containerColor = Color.Transparent,
                        edgePadding = PagePadding,
                        modifier = Modifier.offset(y = (-100).dp),
                    ) {
                        seasons.forEach { s ->
                            Tab(
                                selected = s.seasonNumber == activeSeason,
                                onClick = { activeSeason = s.seasonNumber },
                                text = { Text(s.name ?: if (s.seasonNumber == 0) "Specials" else "Season ${s.seasonNumber}") },
                            )
                        }
                    }
                }
            }

            items(episodes, key = { it.id }) { ep ->
                Box(Modifier.offset(y = (-90).dp)) {
                    EpisodeRow(
                        ep,
                        progress[ep.id],
                        partCount = partCounts[ep.seasonNumber to ep.episodeNumber] ?: 1,
                        onClick = { play(ep) },
                    )
                }
            }

            item {
                Column(Modifier.offset(y = (-70).dp)) { CastRow(detail.cast) }
            }
        }
    }
}

@Composable
private fun EpisodeRow(ep: Episode, progress: WatchProgress?, partCount: Int, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = PagePadding, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .width(220.dp)
                .aspectRatio(16f / 9f)
                .clip(CardShape)
                .background(CinecasaColors.BgCard)
        ) {
            RemoteImage(ep.stillPath, ep.title, Modifier.fillMaxSize())
            Box(
                Modifier
                    .align(Alignment.Center)
                    .size(40.dp)
                    .background(Color.Black.copy(alpha = 0.5f), androidx.compose.foundation.shape.CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.PlayArrow, "Play", tint = Color.White)
            }
            if (progress?.state == WatchState.WATCHED) {
                Icon(
                    Icons.Filled.CheckCircle,
                    "Watched",
                    tint = CinecasaColors.Success,
                    modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(20.dp),
                )
            } else if (progress != null && progress.positionMs > 0) {
                ProgressLine(progress.fraction, Modifier.align(Alignment.BottomCenter))
            }
        }
        Spacer(Modifier.width(18.dp))
        Column(Modifier.weight(1f)) {
            val code = episodeCode(ep.seasonNumber, ep.episodeNumber, ep.episodePart, partCount)
            Text(
                listOfNotNull("${ep.episodeNumber}.", ep.title ?: "Episode ${ep.episodeNumber}").joinToString(" "),
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                listOf(code, formatRuntime(ep.runtime), progress?.takeIf { it.state == WatchState.IN_PROGRESS && it.positionMs > 0 }
                    ?.let { "${formatPosition(it.positionMs)} watched" } ?: "")
                    .filter { it.isNotEmpty() }
                    .joinToString("  ·  "),
                style = MaterialTheme.typography.bodySmall,
                color = CinecasaColors.TextMuted,
            )
            if (!ep.overview.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    ep.overview,
                    style = MaterialTheme.typography.bodyMedium,
                    color = CinecasaColors.TextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
