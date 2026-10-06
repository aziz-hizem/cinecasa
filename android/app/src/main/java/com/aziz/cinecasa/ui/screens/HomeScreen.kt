package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.data.HomeData
import com.aziz.cinecasa.data.InProgressItem
import com.aziz.cinecasa.data.ItemType
import com.aziz.cinecasa.data.Movie
import com.aziz.cinecasa.data.PlayItem
import com.aziz.cinecasa.data.Show
import com.aziz.cinecasa.data.episodeCode
import com.aziz.cinecasa.data.formatPosition
import com.aziz.cinecasa.player.PlayerActivity
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.Routes
import com.aziz.cinecasa.ui.components.ErrorMessage
import com.aziz.cinecasa.ui.components.HeroBanner
import com.aziz.cinecasa.ui.components.HeroItem
import com.aziz.cinecasa.ui.components.LoadContent
import com.aziz.cinecasa.ui.components.MediaRow
import com.aziz.cinecasa.ui.components.PosterCard
import com.aziz.cinecasa.ui.components.RowPoster
import com.aziz.cinecasa.ui.rememberLoad
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

private data class HomeBundle(val home: HomeData, val movies: List<Movie>, val shows: List<Show>)

@Composable
fun HomeScreen(nav: NavController) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    /** Continue Watching cards hidden while their removal can still be undone. */
    var hidden by remember { mutableStateOf(setOf<String>()) }

    val load = rememberLoad {
        coroutineScope {
            val home = async { app.api.home() }
            val movies = async { app.api.movies() }
            val shows = async { app.api.shows() }
            HomeBundle(home.await(), movies.await(), shows.await())
        }
    }

    fun remove(item: InProgressItem) {
        val key = item.key
        hidden = hidden + key
        scope.launch {
            val label = item.seasonNumber?.let { "${item.title} · ${episodeCode(it, item.episodeNumber ?: 0)}" } ?: item.title
            val result = snackbar.showSnackbar(
                message = "Removed · $label",
                actionLabel = "Undo",
                duration = SnackbarDuration.Short,
            )
            if (result == SnackbarResult.ActionPerformed) {
                hidden = hidden - key
            } else {
                runCatching { app.api.removeProgress(item.itemType, item.itemId) }
                // Reload so the "next episode" card logic runs again on the PC.
                load.reload()
                hidden = hidden - key
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        LoadContent(load) { bundle ->
            val (home, movies, shows) = bundle
            if (movies.isEmpty() && shows.isEmpty()) {
                ErrorMessage(
                    "Your library is empty. On the PC, add your Movies and TV folders in Cinecasa → Settings and run a scan.",
                    onRetry = load.reload,
                )
                return@LoadContent
            }

            val hero = remember(home) {
                (home.recentMovies.filter { it.backdropPath != null }.map {
                    HeroItem(true, it.id, it.title, it.overview, it.backdropPath, it.logoPath, it.year, it.rating, it.genres)
                } + home.recentShows.filter { it.backdropPath != null }.map {
                    HeroItem(false, it.id, it.title, it.overview, it.backdropPath, it.logoPath, it.year, it.rating, it.genres)
                }).take(5)
            }
            val continueShows = home.continueWatching.filter { it.itemType == ItemType.EPISODE && it.key !in hidden }
            val continueMovies = home.continueWatching.filter { it.itemType == ItemType.MOVIE && it.key !in hidden }
            val recent = remember(home) {
                (home.recentMovies.map { Recent(it.id, true, it.title, it.year, it.rating, it.posterPath, it.addedAt) } +
                    home.recentShows.map { Recent(it.id, false, it.title, it.year, it.rating, it.posterPath, it.addedAt) })
                    .sortedByDescending { it.addedAt }
                    .take(20)
            }

            LazyColumn(
                contentPadding = PaddingValues(bottom = 48.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                if (hero.isNotEmpty()) {
                    item {
                        HeroBanner(hero, onOpen = {
                            nav.navigate(if (it.isMovie) Routes.movie(it.id) else Routes.show(it.id))
                        })
                    }
                }
                if (continueShows.isNotEmpty()) {
                    item {
                        MediaRow("Continue Watching — Shows") {
                            items(continueShows, key = { it.key }) { item ->
                                ContinueCard(
                                    item,
                                    onPlay = { PlayerActivity.start(context, item.toPlayItem()) },
                                    onInfo = { nav.navigate(item.detailRoute) },
                                    onRemove = { remove(item) },
                                )
                            }
                        }
                    }
                }
                if (continueMovies.isNotEmpty()) {
                    item {
                        MediaRow("Continue Watching — Movies") {
                            items(continueMovies, key = { it.key }) { item ->
                                ContinueCard(
                                    item,
                                    onPlay = { PlayerActivity.start(context, item.toPlayItem()) },
                                    onInfo = { nav.navigate(item.detailRoute) },
                                    onRemove = { remove(item) },
                                )
                            }
                        }
                    }
                }
                if (recent.isNotEmpty()) {
                    item {
                        MediaRow("Recently Added") {
                            items(recent, key = { "${it.isMovie}-${it.id}" }) { r ->
                                RowPoster {
                                    PosterCard(
                                        title = r.title,
                                        subtitle = r.year?.toString(),
                                        posterKey = r.posterPath,
                                        rating = r.rating,
                                        onClick = { nav.navigate(if (r.isMovie) Routes.movie(r.id) else Routes.show(r.id)) },
                                    )
                                }
                            }
                        }
                    }
                }
                if (movies.isNotEmpty()) {
                    item {
                        MediaRow("Movies", "${movies.size} titles in your library") {
                            items(movies.take(30), key = { it.id }) { m ->
                                RowPoster {
                                    PosterCard(m.title, m.year?.toString(), m.posterPath, { nav.navigate(Routes.movie(m.id)) }, rating = m.rating)
                                }
                            }
                        }
                    }
                }
                if (shows.isNotEmpty()) {
                    item {
                        MediaRow("TV Shows", "${shows.size} titles in your library") {
                            items(shows.take(30), key = { it.id }) { s ->
                                RowPoster {
                                    PosterCard(s.title, s.year?.toString(), s.posterPath, { nav.navigate(Routes.show(s.id)) }, rating = s.rating)
                                }
                            }
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(16.dp))
    }
}

private data class Recent(
    val id: Int,
    val isMovie: Boolean,
    val title: String,
    val year: Int?,
    val rating: Double?,
    val posterPath: String?,
    val addedAt: Long,
)

private val InProgressItem.key: String get() = "${itemType.wire}-$itemId"

private val InProgressItem.detailRoute: String
    get() = if (itemType == ItemType.MOVIE) Routes.movie(itemId) else Routes.show(showId ?: 0)

private fun InProgressItem.toPlayItem(): PlayItem = PlayItem(
    type = itemType,
    id = itemId,
    title = title,
    subtitle = seasonNumber?.let { s ->
        listOfNotNull(episodeCode(s, episodeNumber ?: 0), episodeTitle).joinToString(" · ")
    },
    startMs = positionMs,
)

/** Tap plays from where you left off; long-press for details or removal. */
@Composable
private fun ContinueCard(
    item: InProgressItem,
    onPlay: () -> Unit,
    onInfo: () -> Unit,
    onRemove: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    val subtitle = when {
        item.itemType == ItemType.EPISODE && item.seasonNumber != null ->
            if (item.positionMs > 0) "${episodeCode(item.seasonNumber, item.episodeNumber ?: 0)} · ${formatPosition(item.positionMs)}"
            else "Next: ${episodeCode(item.seasonNumber, item.episodeNumber ?: 0)}"
        item.positionMs > 0 -> formatPosition(item.positionMs)
        else -> "Play"
    }
    RowPoster {
        Box {
            PosterCard(
                title = item.title,
                subtitle = subtitle,
                posterKey = item.posterPath,
                onClick = onPlay,
                onLongClick = { menu = true },
                progress = item.fraction,
                showPlayBadge = true,
            )
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                DropdownMenuItem(text = { Text("View details") }, onClick = { menu = false; onInfo() })
                DropdownMenuItem(text = { Text("Remove from Continue Watching") }, onClick = { menu = false; onRemove() })
            }
        }
    }
}
