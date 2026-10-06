package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.aziz.cinecasa.data.CastMember
import com.aziz.cinecasa.ui.components.AssetImage
import com.aziz.cinecasa.ui.components.BackdropScrim
import com.aziz.cinecasa.ui.components.MediaRow
import com.aziz.cinecasa.ui.components.RemoteImage
import com.aziz.cinecasa.ui.theme.CinecasaColors

val DetailHeroHeight = 440.dp

/** Backdrop across the top of a detail page, with a Back button. */
@Composable
fun DetailHero(
    backdropKey: String?,
    backdropAsset: String? = null,
    title: String,
    onBack: () -> Unit,
    height: Dp = DetailHeroHeight,
) {
    Box(Modifier.fillMaxWidth().height(height)) {
        when {
            backdropAsset != null -> AssetImage(backdropAsset, title, Modifier.fillMaxSize())
            backdropKey != null -> RemoteImage(backdropKey, title, Modifier.fillMaxSize())
            else -> Box(Modifier.fillMaxSize().background(CinecasaColors.BgCard))
        }
        BackdropScrim(Modifier.fillMaxSize())
        FilledTonalButton(
            onClick = onBack,
            modifier = Modifier.padding(16.dp),
            colors = ButtonDefaults.filledTonalButtonColors(containerColor = Color.Black.copy(alpha = 0.45f), contentColor = Color.White),
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Back")
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GenreChips(genres: List<String>) {
    if (genres.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        genres.forEach { g ->
            Text(
                g,
                style = MaterialTheme.typography.labelMedium,
                color = CinecasaColors.TextSecondary,
                modifier = Modifier
                    .background(CinecasaColors.BgCard, RoundedCornerShape(50))
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            )
        }
    }
}

@Composable
fun CastRow(cast: List<CastMember>) {
    if (cast.isEmpty()) return
    MediaRow("Cast") {
        items(cast.take(20), key = { it.id }) { member ->
            Column(Modifier.width(96.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                RemoteImage(member.profilePath, member.name, Modifier.size(84.dp).clip(CircleShape))
                Spacer(Modifier.height(6.dp))
                Text(
                    member.name,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
                if (member.character != null) {
                    Text(
                        member.character,
                        style = MaterialTheme.typography.labelSmall,
                        color = CinecasaColors.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}
