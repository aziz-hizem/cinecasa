package com.aziz.cinecasa.ui.screens

import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aziz.cinecasa.data.ApiException
import com.aziz.cinecasa.data.DEFAULT_PORT
import com.aziz.cinecasa.data.FoundPc
import com.aziz.cinecasa.data.ServerConfig
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch

private const val LOCAL_NETWORK_PERMISSION = "android.permission.ACCESS_LOCAL_NETWORK"

/**
 * First run: find the PC (mDNS or typed address), then enter the six-digit
 * code shown in Cinecasa → Settings → Tablet Streaming on the PC.
 */
@Composable
fun ConnectScreen(reason: String?, onPaired: () -> Unit) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Android 17 makes local network access a runtime permission.
    var canUseNetwork by remember {
        mutableStateOf(
            Build.VERSION.SDK_INT < 37 ||
                context.checkSelfPermission(LOCAL_NETWORK_PERMISSION) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        canUseNetwork = it
    }
    LaunchedEffect(Unit) {
        if (!canUseNetwork) permissionLauncher.launch(LOCAL_NETWORK_PERMISSION)
    }

    val found by remember(canUseNetwork) {
        if (canUseNetwork) app.discovery.pcs().catch { emit(emptyList()) } else flowOf(emptyList<FoundPc>())
    }.collectAsState(initial = emptyList())

    var target by remember { mutableStateOf<FoundPc?>(null) }
    var manualHost by remember { mutableStateOf("") }
    var manualPort by remember { mutableStateOf(DEFAULT_PORT.toString()) }
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember {
        mutableStateOf(
            if (reason == "unpaired") "This tablet was unpaired from the PC. Pair it again with the new code." else null
        )
    }

    fun choose(host: String, port: Int) {
        scope.launch {
            busy = true
            error = null
            try {
                val hello = app.api.hello(host, port)
                if (hello.app != "cinecasa") throw ApiException("That isn't a Cinecasa PC.", 0)
                target = FoundPc(hello.name, host, port)
                code = ""
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = "Couldn't reach $host:$port. Check that Cinecasa is open on the PC and Tablet Streaming is on."
            } finally {
                busy = false
            }
        }
    }

    fun pair(pc: FoundPc) {
        scope.launch {
            busy = true
            error = null
            try {
                val result = app.api.pair(pc.host, pc.port, code.trim())
                app.pairWith(ServerConfig(pc.host, pc.port, result.token, result.name))
                onPaired()
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.message
            } catch (e: Exception) {
                error = "Couldn't reach the PC. Is it still on?"
            } finally {
                busy = false
            }
        }
    }

    Box(Modifier.fillMaxSize().background(CinecasaColors.Bg), contentAlignment = Alignment.Center) {
        Column(
            Modifier
                .widthIn(max = 520.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "CINECASA",
                color = CinecasaColors.Accent,
                fontWeight = FontWeight.Black,
                fontSize = 34.sp,
                letterSpacing = 4.sp,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Your home cinema, on the tablet",
                color = CinecasaColors.TextSecondary,
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(Modifier.height(32.dp))

            val pc = target
            if (pc == null) {
                Text("Choose your PC", style = MaterialTheme.typography.titleMedium, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
                if (found.isEmpty()) {
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = CinecasaColors.Accent)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            "Looking for Cinecasa on your Wi-Fi…",
                            color = CinecasaColors.TextSecondary,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                found.forEach { item ->
                    PcRow(item, enabled = !busy) { choose(item.host, item.port) }
                    Spacer(Modifier.height(8.dp))
                }

                Spacer(Modifier.height(24.dp))
                Text("Or enter its address", style = MaterialTheme.typography.titleSmall, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = manualHost,
                        onValueChange = { manualHost = it.trim() },
                        label = { Text("IP address") },
                        placeholder = { Text("192.168.1.20") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = manualPort,
                        onValueChange = { manualPort = it.filter(Char::isDigit).take(5) },
                        label = { Text("Port") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(110.dp),
                    )
                }
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { choose(manualHost, manualPort.toIntOrNull() ?: DEFAULT_PORT) },
                    enabled = !busy && manualHost.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Connect") }
                Spacer(Modifier.height(16.dp))
                Text(
                    "The address is shown on the PC in Cinecasa → Settings → Tablet Streaming.",
                    color = CinecasaColors.TextMuted,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                )
            } else {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { target = null; error = null }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Other PC")
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text("Pair with ${pc.name}", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Enter the code shown on the PC in Cinecasa → Settings → Tablet Streaming.",
                    color = CinecasaColors.TextSecondary,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(20.dp))
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.filter(Char::isDigit).take(6) },
                    label = { Text("Pairing code") },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.headlineMedium.copy(letterSpacing = 8.sp, textAlign = TextAlign.Center),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = { pair(pc) },
                    enabled = !busy && code.length == 6,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (busy) "Pairing…" else "Pair") }
            }

            if (error != null) {
                Spacer(Modifier.height(16.dp))
                Text(error!!, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun PcRow(pc: FoundPc, enabled: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .border(1.dp, CinecasaColors.Border, RoundedCornerShape(10.dp))
            .background(CinecasaColors.BgCard, RoundedCornerShape(10.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Computer, null, tint = CinecasaColors.Accent)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(pc.name, style = MaterialTheme.typography.titleSmall)
            Text("${pc.host}:${pc.port}", color = CinecasaColors.TextMuted, style = MaterialTheme.typography.bodySmall)
        }
    }
}
