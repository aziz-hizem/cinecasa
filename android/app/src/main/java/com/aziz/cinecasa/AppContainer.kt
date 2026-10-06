package com.aziz.cinecasa

import android.content.Context
import com.aziz.cinecasa.data.AuthInterceptor
import com.aziz.cinecasa.data.CinecasaApi
import com.aziz.cinecasa.data.Discovery
import com.aziz.cinecasa.data.LibraryCache
import com.aziz.cinecasa.data.ServerConfig
import com.aziz.cinecasa.data.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import java.io.File
import java.util.concurrent.TimeUnit

/** App-wide services, created once in [CinecasaApp]. */
class AppContainer(context: Context) {
    val settings = SettingsStore(context)
    val cache = LibraryCache(File(context.filesDir, "library"))
    val discovery = Discovery(context)

    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    val api = CinecasaApi(http, cache)

    /** For work that must finish after a screen closes (the player's last progress report). */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Image requests get the pairing token added by an interceptor. */
    val imageHttp: OkHttpClient = http.newBuilder()
        .addInterceptor(AuthInterceptor(api))
        .build()

    /** Bumped to make every open screen reload (after reconnecting to the PC). */
    val refresh = MutableStateFlow(0)

    private val _unpaired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    /** Fires when the PC rejects our token (unpaired from its Settings). */
    val unpaired: SharedFlow<Unit> = _unpaired.asSharedFlow()

    fun notifyUnpaired() {
        _unpaired.tryEmit(Unit)
    }

    suspend fun pairWith(config: ServerConfig) {
        settings.saveServer(config)
        api.server = config
    }

    suspend fun forgetServer() {
        settings.clearServer()
        api.server = null
        cache.clear()
    }

    private val reconnectLock = Mutex()

    /**
     * The PC didn't answer. If it's on the network under a new IP address
     * (routers hand those out again now and then), find it by name and switch
     * to it. Returns true when the PC is reachable again.
     */
    suspend fun reconnect(): Boolean = reconnectLock.withLock {
        val current = api.server ?: return false
        val reachable = runCatching { api.hello(current.host, current.port, current.token).authorized }
            .getOrDefault(false)
        if (reachable) return true

        val moved = withTimeoutOrNull(6_000) {
            discovery.pcs().first { list -> list.any { it.name == current.name } }
                .first { it.name == current.name }
        } ?: return false
        val updated = current.copy(host = moved.host, port = moved.port)
        val ok = runCatching { api.hello(updated.host, updated.port, updated.token).authorized }
            .getOrDefault(false)
        if (ok) pairWith(updated)
        ok
    }
}
