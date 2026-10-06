package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.Routes
import com.aziz.cinecasa.ui.components.ErrorMessage
import com.aziz.cinecasa.ui.components.LoadContent
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.components.PosterCard
import com.aziz.cinecasa.ui.rememberLoad
import com.aziz.cinecasa.ui.theme.CinecasaColors

enum class BrowseKind { MOVIES, SHOWS }

/** One poster in a grid, whether it's a movie or a show. */
data class GridTitle(
    val id: Int,
    val isMovie: Boolean,
    val title: String,
    val year: Int?,
    val rating: Double?,
    val posterPath: String?,
    val addedAt: Long,
)

enum class TitleSort(val label: String) {
    TITLE("A → Z"), RECENT("Recently Added"), YEAR("Year"), RATING("Rating");

    fun apply(list: List<GridTitle>): List<GridTitle> = when (this) {
        TITLE -> list.sortedBy { it.title.lowercase() }
        RECENT -> list.sortedByDescending { it.addedAt }
        YEAR -> list.sortedByDescending { it.year ?: 0 }
        RATING -> list.sortedByDescending { it.rating ?: 0.0 }
    }
}

/** The Movies and TV Shows tabs: the whole library as a sortable grid. */
@Composable
fun BrowseScreen(kind: BrowseKind, nav: NavController) {
    val app = LocalApp.current
    var sort by rememberSaveable(kind) { mutableStateOf(TitleSort.TITLE) }
    val load = rememberLoad(kind) {
        if (kind == BrowseKind.MOVIES) {
            app.api.movies().map { GridTitle(it.id, true, it.title, it.year, it.rating, it.posterPath, it.addedAt) }
        } else {
            app.api.shows().map { GridTitle(it.id, false, it.title, it.year, it.rating, it.posterPath, it.addedAt) }
        }
    }
    val title = if (kind == BrowseKind.MOVIES) "Movies" else "TV Shows"

    LoadContent(load) { all ->
        if (all.isEmpty()) {
            ErrorMessage("No ${title.lowercase()} yet. Add a folder and scan it in Cinecasa on your PC.", onRetry = load.reload)
            return@LoadContent
        }
        val sorted = remember(all, sort) { sort.apply(all) }
        TitleGrid(sorted, nav) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                GridHeader(title, "${all.size} titles", sort, onSort = { sort = it })
            }
        }
    }
}

/** A responsive poster grid with an optional full-width header. */
@Composable
fun TitleGrid(
    titles: List<GridTitle>,
    nav: NavController,
    header: LazyGridScope.() -> Unit = {},
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(150.dp),
        contentPadding = PaddingValues(start = PagePadding, end = PagePadding, bottom = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        header()
        items(titles, key = { "${it.isMovie}-${it.id}" }) { t ->
            PosterCard(
                title = t.title,
                subtitle = t.year?.toString(),
                posterKey = t.posterPath,
                rating = t.rating,
                onClick = { nav.navigate(if (t.isMovie) Routes.movie(t.id) else Routes.show(t.id)) },
            )
        }
    }
}

@Composable
fun GridHeader(title: String, subtitle: String, sort: TitleSort?, onSort: (TitleSort) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.width(14.dp))
        Text(subtitle, color = CinecasaColors.TextMuted, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.weight(1f))
        if (sort != null) SortMenu(sort, onSort)
    }
}

@Composable
fun SortMenu(sort: TitleSort, onSort: (TitleSort) -> Unit, options: List<TitleSort> = TitleSort.entries) {
    var open by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { open = true }) {
            Icon(Icons.AutoMirrored.Filled.Sort, null)
            Spacer(Modifier.width(6.dp))
            Text(sort.label)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.label) },
                    onClick = {
                        open = false
                        onSort(option)
                    },
                )
            }
        }
    }
}
