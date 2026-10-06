package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

/** Search across the whole library (desktop Search route). */
@Composable
fun SearchScreen(nav: NavController) {
    val app = LocalApp.current
    var query by rememberSaveable { mutableStateOf("") }
    var results by remember { mutableStateOf<List<GridTitle>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val focus = remember { FocusRequester() }

    LaunchedEffect(Unit) { focus.requestFocus() }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            results = null
            return@LaunchedEffect
        }
        delay(300) // wait for typing to pause
        try {
            val found = app.api.search(query.trim())
            results = found.movies.map { GridTitle(it.id, true, it.title, it.year, it.rating, it.posterPath, it.addedAt) } +
                found.shows.map { GridTitle(it.id, false, it.title, it.year, it.rating, it.posterPath, it.addedAt) }
            error = null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            error = e.message
        }
    }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Movies and shows") },
            leadingIcon = { Icon(Icons.Filled.Search, null) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = PagePadding, vertical = 12.dp)
                .focusRequester(focus),
        )
        val list = results
        when {
            error != null -> Message(error!!)
            list == null -> Message("Type to search your library")
            list.isEmpty() -> Message("Nothing matches \"$query\"")
            else -> TitleGrid(list, nav) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Text("${list.size} results", color = CinecasaColors.TextMuted)
                }
            }
        }
    }
}

@Composable
private fun Message(text: String) {
    Box(Modifier.fillMaxSize().padding(PagePadding), contentAlignment = Alignment.TopCenter) {
        Text(text, color = CinecasaColors.TextSecondary, modifier = Modifier.padding(top = 48.dp))
    }
}
