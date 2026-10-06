package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.data.SpecialDef
import com.aziz.cinecasa.data.specialFor
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.Routes
import com.aziz.cinecasa.ui.components.AssetImage
import com.aziz.cinecasa.ui.components.ErrorMessage
import com.aziz.cinecasa.ui.components.LoadContent
import com.aziz.cinecasa.ui.rememberLoad
import com.aziz.cinecasa.ui.theme.CinecasaColors

/** A themed page for one special (desktop SpecialHub). */
@Composable
fun SpecialHubScreen(kind: String, nav: NavController) {
    val def = specialFor(kind)
    if (def == null) {
        ErrorMessage("Unknown special.")
        return
    }
    val app = LocalApp.current
    var sort by rememberSaveable { mutableStateOf(TitleSort.YEAR) }
    val load = rememberLoad(kind) { app.api.special(kind) }

    Box(Modifier.fillMaxSize()) {
        SpecialBackdrop(def)
        LoadContent(load) { contents ->
            // A special that is really one series jumps straight into it.
            if (def.singleSeries && contents.shows.size == 1 && contents.movies.isEmpty()) {
                LaunchedEffect(Unit) {
                    nav.navigate(Routes.show(contents.shows.first().id)) {
                        popUpTo(Routes.SPECIAL) { inclusive = true }
                    }
                }
                return@LoadContent
            }

            val shows = contents.shows.map { GridTitle(it.id, false, it.title, it.year, it.rating, it.posterPath, it.addedAt) }
            val movies = remember(contents, sort) {
                val list = contents.movies.map { GridTitle(it.id, true, it.title, it.year, it.rating, it.posterPath, it.addedAt) }
                // "Release order" is oldest first, unlike the Movies tab's year sort.
                if (sort == TitleSort.YEAR) list.sortedBy { it.year ?: 0 } else sort.apply(list)
            }
            val total = shows.size + movies.size

            TitleGrid(shows + movies, nav) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        TextButton(onClick = { nav.popBackStack() }, modifier = Modifier.align(Alignment.Start)) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, null)
                            Text("  All Specials")
                        }
                        AssetImage(
                            def.logoUri,
                            def.name,
                            Modifier.fillMaxWidth(0.5f).heightIn(max = 110.dp),
                            contentScale = ContentScale.Fit,
                        )
                        Spacer(Modifier.height(10.dp))
                        Text(
                            def.blurb.uppercase(),
                            color = Color.White.copy(alpha = 0.6f),
                            style = MaterialTheme.typography.labelLarge,
                        )
                        Spacer(Modifier.height(20.dp))
                    }
                }
                if (total == 0) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Text(
                            if (def.detection == SpecialDef.Detection.AUTO)
                                "No ${def.name} titles in your library yet. They're picked up automatically: drop them in any movies or TV folder on the PC and run a scan."
                            else
                                "No ${def.name} titles found. On the PC, add the folder under Settings → Add Specials → ${def.name}, then run a scan.",
                            color = CinecasaColors.TextSecondary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(32.dp),
                        )
                    }
                } else {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        GridHeader(
                            title = def.name,
                            subtitle = "$total title${if (total == 1) "" else "s"}",
                            sort = if (movies.size > 1) sort else null,
                            onSort = { sort = it },
                        )
                    }
                }
            }
        }
    }
}

/** The special's artwork, dimmed, filling the page behind the content. */
@Composable
fun SpecialBackdrop(def: SpecialDef) {
    Box(Modifier.fillMaxSize()) {
        AssetImage(def.backgroundUri, null, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(CinecasaColors.Bg.copy(alpha = 0.82f)))
    }
}
