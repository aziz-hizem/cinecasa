package com.aziz.cinecasa.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(onForget: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val autoPlay by app.settings.autoPlay.collectAsState(initial = true)
    var status by remember { mutableStateOf<String?>(null) }
    var checking by remember { mutableStateOf(false) }

    suspend fun check() {
        checking = true
        status = if (app.reconnect()) "Connected" else "Can't reach the PC right now"
        checking = false
    }

    LaunchedEffect(Unit) { check() }

    Column(
        Modifier
            .verticalScroll(rememberScrollState())
            .padding(PagePadding)
            .widthIn(max = 720.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(20.dp))

        Section("Your PC") {
            // Read on every recomposition: a reconnect may have moved to a new IP address.
            val current = app.api.server
            if (current != null) {
                Text(current.name, style = MaterialTheme.typography.titleMedium)
                Text("${current.host}:${current.port}", color = CinecasaColors.TextMuted)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                if (checking) "Checking…" else status.orEmpty(),
                color = if (status == "Connected") CinecasaColors.Success else CinecasaColors.TextSecondary,
            )
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = { scope.launch { check() } }, enabled = !checking) { Text("Check connection") }
                OutlinedButton(onClick = {
                    scope.launch {
                        app.forgetServer()
                        onForget()
                    }
                }) { Text("Forget this PC") }
            }
        }

        Section("Playback") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Auto-play next episode")
                    Text(
                        "Starts the next episode a few seconds after one ends.",
                        color = CinecasaColors.TextMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Switch(
                    checked = autoPlay,
                    onCheckedChange = { scope.launch { app.settings.setAutoPlay(it) } },
                    colors = SwitchDefaults.colors(checkedTrackColor = CinecasaColors.Accent),
                )
            }
        }

        Section("About") {
            Text(
                "Your library, artwork and watch progress live on the PC. Scanning, adding folders and fixing " +
                    "metadata are done in Cinecasa on the PC; the tablet picks up changes automatically.",
                color = CinecasaColors.TextSecondary,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp)
            .background(CinecasaColors.BgCard, RoundedCornerShape(12.dp))
            .border(1.dp, CinecasaColors.Border, RoundedCornerShape(12.dp))
            .padding(20.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(12.dp))
        content()
    }
}
