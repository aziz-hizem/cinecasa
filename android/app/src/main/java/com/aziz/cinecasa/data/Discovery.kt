package com.aziz.cinecasa.data

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.net.Inet4Address
import java.net.InetAddress
import kotlin.coroutines.resume

/** A PC running Cinecasa, found on the local network. */
data class FoundPc(
    /** The PC's name, as the desktop app reports it in /api/hello. */
    val name: String,
    val host: String,
    val port: Int,
)

/**
 * Finds PCs advertising `_cinecasa._tcp` (electron/server/discovery.ts) with
 * Android's built-in mDNS client.
 */
class Discovery(context: Context) {
    private val nsd = context.getSystemService(NsdManager::class.java)

    private sealed interface Event {
        data class Found(val info: NsdServiceInfo) : Event
        data class Lost(val serviceName: String) : Event
    }

    /** Emits the current list of PCs, updated as they appear and disappear. */
    fun pcs(): Flow<List<FoundPc>> = callbackFlow {
        val events = Channel<Event>(Channel.UNLIMITED)
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) = Unit
            override fun onDiscoveryStopped(serviceType: String) = Unit
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                close(IllegalStateException("Network discovery failed ($errorCode)"))
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                events.trySend(Event.Found(serviceInfo))
            }
            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                events.trySend(Event.Lost(serviceInfo.serviceName))
            }
        }

        // All bookkeeping happens on this one coroutine; resolves run one at a
        // time because older Android versions reject concurrent resolves.
        launch {
            val found = linkedMapOf<String, FoundPc>()
            for (event in events) {
                when (event) {
                    is Event.Found -> {
                        val pc = resolve(event.info) ?: continue
                        found[event.info.serviceName] = pc
                    }
                    is Event.Lost -> found.remove(event.serviceName)
                }
                send(found.values.toList())
            }
        }

        trySend(emptyList())
        nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        awaitClose {
            events.close()
            runCatching { nsd.stopServiceDiscovery(listener) }
        }
    }

    @Suppress("DEPRECATION") // resolveService works on every supported version.
    private suspend fun resolve(info: NsdServiceInfo): FoundPc? = withTimeoutOrNull(5_000) {
        suspendCancellableCoroutine { cont ->
            nsd.resolveService(info, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    if (cont.isActive) cont.resume(null)
                }

                override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                    val host = hostOf(serviceInfo)?.hostAddress
                    val pc = host?.let {
                        FoundPc(
                            name = serviceInfo.serviceName.removePrefix(NAME_PREFIX).substringBefore(" ("),
                            host = it,
                            port = serviceInfo.port,
                        )
                    }
                    if (cont.isActive) cont.resume(pc)
                }
            })
        }
    }

    @Suppress("DEPRECATION")
    private fun hostOf(info: NsdServiceInfo): InetAddress? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            info.hostAddresses.firstOrNull { it is Inet4Address } ?: info.hostAddresses.firstOrNull()
        } else {
            info.host
        }

    private companion object {
        const val SERVICE_TYPE = "_cinecasa._tcp"
        const val NAME_PREFIX = "Cinecasa on "
    }
}
