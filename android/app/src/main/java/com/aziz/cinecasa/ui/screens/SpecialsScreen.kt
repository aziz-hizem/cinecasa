package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aziz.cinecasa.data.SPECIALS
import com.aziz.cinecasa.data.SpecialDef
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.Routes
import com.aziz.cinecasa.ui.components.AssetImage
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.launch

/** The glow colour of a special as a Compose colour. */
fun SpecialDef.glowColor(alpha: Float = 1f): Color = Color(0xFF000000 or glow).copy(alpha = alpha)

/** The Specials chooser: one themed card per collection. */
@Composable
fun SpecialsScreen(nav: NavController) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()

    fun open(def: SpecialDef) {
        if (!def.singleSeries) {
            nav.navigate(Routes.special(def.kind))
            return
        }
        // A special that is one series (Oscars, Tom & Jerry) jumps straight into it.
        scope.launch {
            val contents = runCatching { app.api.special(def.kind) }.getOrNull()
            val only = contents?.shows?.singleOrNull()
            if (only != null && contents.movies.isEmpty()) nav.navigate(Routes.show(only.id))
            else nav.navigate(Routes.special(def.kind))
        }
    }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(320.dp),
        contentPadding = PaddingValues(start = PagePadding, end = PagePadding, bottom = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(Modifier.padding(top = 16.dp)) {
                Text("Specials", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Hand-picked collections with their own look",
                    color = CinecasaColors.TextMuted,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        items(SPECIALS, key = { it.kind }) { def ->
            SpecialCard(def) { open(def) }
        }
    }
}

@Composable
private fun SpecialCard(def: SpecialDef, onClick: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .shadow(16.dp, shape, ambientColor = def.glowColor(), spotColor = def.glowColor())
                .clip(shape)
                .border(1.dp, def.glowColor(0.45f), shape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            AssetImage(def.backgroundUri, null, Modifier.fillMaxSize())
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.25f), Color.Black.copy(alpha = 0.7f)))
                )
            )
            AssetImage(
                def.logoUri,
                def.name,
                Modifier.fillMaxWidth(0.7f).heightIn(max = 96.dp),
                contentScale = ContentScale.Fit,
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(def.name, style = MaterialTheme.typography.titleMedium)
        Text(def.blurb, color = CinecasaColors.TextMuted, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Start)
    }
}
