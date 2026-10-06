package com.aziz.cinecasa.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.aziz.cinecasa.data.formatRating
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.delay

data class HeroItem(
    val isMovie: Boolean,
    val id: Int,
    val title: String,
    val overview: String?,
    val backdropKey: String?,
    val logoKey: String?,
    val year: Int?,
    val rating: Double?,
    val genres: List<String>,
)

/** Fades the bottom and left of a backdrop into the page background. */
@Composable
fun BackdropScrim(modifier: Modifier = Modifier) {
    Box(
        modifier.background(
            Brush.verticalGradient(
                0f to Color.Transparent,
                0.55f to CinecasaColors.Bg.copy(alpha = 0.35f),
                1f to CinecasaColors.Bg,
            )
        )
    )
    Box(
        modifier.background(
            Brush.horizontalGradient(
                0f to CinecasaColors.Bg.copy(alpha = 0.85f),
                0.55f to Color.Transparent,
            )
        )
    )
}

/** The rotating banner at the top of Home (desktop HeroBanner). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HeroBanner(
    items: List<HeroItem>,
    onOpen: (HeroItem) -> Unit,
    height: Dp = 480.dp,
    rotateMs: Long = 9_000,
) {
    val pager = rememberPagerState { items.size }
    LaunchedEffect(pager.currentPage, items.size) {
        if (items.size < 2) return@LaunchedEffect
        delay(rotateMs)
        pager.animateScrollToPage((pager.currentPage + 1) % items.size)
    }

    Box(Modifier.fillMaxWidth().height(height)) {
        HorizontalPager(state = pager, modifier = Modifier.fillMaxSize()) { page ->
            val item = items[page]
            Box(Modifier.fillMaxSize()) {
                RemoteImage(item.backdropKey, item.title, Modifier.fillMaxSize())
                BackdropScrim(Modifier.fillMaxSize())
                Column(
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = PagePadding, end = PagePadding, bottom = 40.dp)
                        .widthIn(max = 560.dp)
                ) {
                    TitleArt(item.title, item.logoKey)
                    Spacer(Modifier.height(12.dp))
                    MetaLine(item.rating, item.year, item.genres.take(3))
                    if (!item.overview.isNullOrEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            item.overview,
                            style = MaterialTheme.typography.bodyMedium,
                            color = CinecasaColors.TextPrimary.copy(alpha = 0.9f),
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(Modifier.height(18.dp))
                    Button(
                        onClick = { onOpen(item) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color.Black),
                    ) {
                        Icon(Icons.Filled.Info, null, Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("More Info")
                    }
                }
            }
        }

        if (items.size > 1) {
            Row(
                Modifier.align(Alignment.BottomEnd).padding(end = PagePadding, bottom = 48.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                repeat(items.size) { i ->
                    Box(
                        Modifier
                            .size(if (i == pager.currentPage) 10.dp else 7.dp)
                            .background(
                                if (i == pager.currentPage) Color.White else Color.White.copy(alpha = 0.4f),
                                CircleShape,
                            )
                    )
                }
            }
        }
    }
}

/** The title logo from TMDB when there is one, otherwise the title as text. */
@Composable
fun TitleArt(title: String, logoKey: String?, maxHeight: Dp = 110.dp) {
    if (logoKey != null) {
        RemoteImage(
            logoKey,
            title,
            Modifier.heightIn(max = maxHeight).widthIn(max = 420.dp).fillMaxWidth(),
            contentScale = ContentScale.Fit,
            alignment = Alignment.CenterStart,
        )
    } else {
        Text(title, style = MaterialTheme.typography.displaySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** "★ 7.8 · 2019 · Drama, Thriller" */
@Composable
fun MetaLine(rating: Double?, year: Int?, extras: List<String>) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (rating != null && rating > 0) {
            Icon(Icons.Filled.Star, null, Modifier.size(16.dp), tint = CinecasaColors.Star)
            Spacer(Modifier.size(4.dp))
            Text(formatRating(rating), style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.size(12.dp))
        }
        val rest = listOfNotNull(year?.toString()) + extras
        if (rest.isNotEmpty()) {
            Text(
                rest.joinToString("  ·  "),
                style = MaterialTheme.typography.bodyMedium,
                color = CinecasaColors.TextSecondary,
            )
        }
    }
}
