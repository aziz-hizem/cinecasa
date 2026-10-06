package com.aziz.cinecasa.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.aziz.cinecasa.ui.Load
import com.aziz.cinecasa.ui.LoadState
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.launch

val PagePadding = 32.dp

/** A titled horizontal row of cards, like the desktop MediaRow. */
@Composable
fun MediaRow(
    title: String,
    subtitle: String? = null,
    content: LazyListScope.() -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(horizontal = PagePadding),
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            if (subtitle != null) {
                Spacer(Modifier.width(12.dp))
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = CinecasaColors.TextMuted)
            }
        }
        LazyRow(
            contentPadding = PaddingValues(horizontal = PagePadding, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            content = content,
        )
    }
}

/** Shows a spinner, an error with Retry, or the content once loaded. */
@Composable
fun <T> LoadContent(load: LoadState<T>, content: @Composable (T) -> Unit) {
    when (val state = load.state) {
        is Load.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = CinecasaColors.Accent)
        }
        is Load.Failed -> ErrorMessage(state.message, onRetry = load.reload)
        is Load.Ready -> content(state.value)
    }
}

@Composable
fun ErrorMessage(message: String, onRetry: (() -> Unit)? = null) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize().padding(PagePadding), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Filled.CloudOff, null, Modifier.size(40.dp), tint = CinecasaColors.TextMuted)
            Spacer(Modifier.padding(6.dp))
            Text(message, textAlign = TextAlign.Center, color = CinecasaColors.TextSecondary)
            if (onRetry != null) {
                Spacer(Modifier.padding(6.dp))
                Button(onClick = {
                    scope.launch {
                        app.reconnect()
                        onRetry()
                    }
                }) { Text("Try again") }
            }
        }
    }
}

/** A strip shown while the PC is unreachable and saved data is on screen. */
@Composable
fun OfflineBanner(onRetry: () -> Unit) {
    val app = LocalApp.current
    val offline by app.api.offline.collectAsState()
    val scope = rememberCoroutineScope()
    var retrying by remember { mutableStateOf(false) }
    AnimatedVisibility(offline) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(CinecasaColors.BgCard)
                .padding(horizontal = PagePadding, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.CloudOff, null, Modifier.size(18.dp), tint = CinecasaColors.TextSecondary)
            Spacer(Modifier.width(10.dp))
            Text(
                "Your PC is offline. Showing your saved library; playback needs the PC to be on.",
                style = MaterialTheme.typography.bodySmall,
                color = CinecasaColors.TextSecondary,
                modifier = Modifier.weight(1f),
            )
            TextButton(
                enabled = !retrying,
                onClick = {
                    scope.launch {
                        retrying = true
                        app.reconnect()
                        retrying = false
                        onRetry()
                    }
                },
            ) { Text(if (retrying) "Looking…" else "Retry") }
        }
    }
}
