package com.aziz.cinecasa.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.serializer
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException

/** Every server response is wrapped like the desktop's IpcResult. */
@Serializable
data class Envelope<T>(val ok: Boolean, val data: T? = null, val error: String? = null)

open class ApiException(message: String, val status: Int) : Exception(message)

/** The PC no longer accepts our token (it was unpaired from the desktop Settings). */
class NotPairedException(message: String) : ApiException(message, 401)

/** The PC couldn't be reached and nothing was cached for this screen. */
class OfflineException(cause: IOException) : IOException("Can't reach your PC. Is Cinecasa running?", cause)

/**
 * Client for the desktop app's tablet server (electron/server/httpServer.ts).
 * Plain Kotlin + OkHttp, no Android dependencies, so it's covered by JVM tests.
 */
class CinecasaApi(
    private val http: OkHttpClient,
    private val cache: LibraryCache? = null,
) {
    @Volatile
    var server: ServerConfig? = null

    private val _offline = MutableStateFlow(false)

    /** True while the last request failed to reach the PC (and cached data is shown). */
    val offline: StateFlow<Boolean> = _offline.asStateFlow()

    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    // ─── Pairing (no token yet) ──────────────────────────────────────────────

    suspend fun hello(host: String, port: Int, token: String? = null): Hello {
        val url = ServerConfig.baseUrl(host, port).newBuilder().addPathSegments("api/hello").build()
        val request = Request.Builder().url(url).apply {
            if (token != null) header("Authorization", "Bearer $token")
        }.build()
        return execute(request, serializer())
    }

    suspend fun pair(host: String, port: Int, code: String): PairResult {
        val url = ServerConfig.baseUrl(host, port).newBuilder().addPathSegments("api/pair").build()
        val body = buildJsonObject { put("code", code) }.toString()
        return execute(Request.Builder().url(url).post(body.toRequestBody(JSON)).build(), serializer())
    }

    // ─── Library ─────────────────────────────────────────────────────────────

    suspend fun home(): HomeData = get("api/home", cacheable = true)
    suspend fun movies(): List<Movie> = get("api/movies", cacheable = true)
    suspend fun shows(): List<Show> = get("api/shows", cacheable = true)
    suspend fun movie(id: Int): MovieDetail = get("api/movies/$id", cacheable = true)
    suspend fun show(id: Int): ShowDetail = get("api/shows/$id", cacheable = true)
    suspend fun special(kind: String): SpecialContents = get("api/specials/$kind", cacheable = true)
    suspend fun continueWatching(): List<InProgressItem> = get("api/continue")

    suspend fun search(query: String): SearchResults =
        get("api/search", query = mapOf("q" to query))

    // ─── Playback ────────────────────────────────────────────────────────────

    suspend fun subtitles(type: ItemType, id: Int): List<SubtitleTrack> =
        get("api/subs/${type.wire}/$id")

    /** The episode auto-play should start next, or null when there isn't one. */
    suspend fun nextEpisode(episodeId: Int, random: Boolean): Episode? =
        get("api/next/$episodeId", query = if (random) mapOf("random" to "1") else emptyMap())

    suspend fun reportProgress(
        type: ItemType,
        id: Int,
        positionMs: Long,
        durationMs: Long,
        event: ProgressEvent,
    ): WatchProgress? {
        val body = buildJsonObject {
            put("itemType", type.wire)
            put("itemId", id)
            put("positionMs", positionMs)
            put("durationMs", durationMs)
            put("event", event.wire)
        }.toString()
        val request = authed("api/progress").post(body.toRequestBody(JSON)).build()
        return execute(request, serializer())
    }

    suspend fun removeProgress(type: ItemType, id: Int) {
        val request = authed("api/progress/${type.wire}/$id").delete().build()
        execute(request, serializer<Unit?>())
    }

    // ─── URLs for the player and image loader ────────────────────────────────

    /** libVLC can't send headers, so media URLs carry the token in the query. */
    fun streamUrl(type: ItemType, id: Int): String =
        url("stream/${type.wire}/$id").newBuilder().addQueryParameter("t", requireServer().token).build().toString()

    fun subtitleUrl(type: ItemType, id: Int, index: Int): String =
        url("subs/${type.wire}/$id/$index").newBuilder().addQueryParameter("t", requireServer().token).build().toString()

    /** Image URLs carry no token (AuthInterceptor adds it) so the image cache key stays stable. */
    fun imageUrl(key: String): String? = server?.let { url("img/${key.trimStart('/')}").toString() }

    // ─── Internals ───────────────────────────────────────────────────────────

    private fun requireServer(): ServerConfig =
        server ?: throw NotPairedException("Not paired with a PC yet.")

    private fun url(path: String, query: Map<String, String> = emptyMap()): HttpUrl =
        requireServer().baseUrl().newBuilder().addPathSegments(path).apply {
            query.forEach { (k, v) -> addQueryParameter(k, v) }
        }.build()

    private fun authed(path: String, query: Map<String, String> = emptyMap()): Request.Builder =
        Request.Builder()
            .url(url(path, query))
            .header("Authorization", "Bearer ${requireServer().token}")

    private suspend inline fun <reified T> get(
        path: String,
        query: Map<String, String> = emptyMap(),
        cacheable: Boolean = false,
    ): T {
        return execute(authed(path, query).build(), serializer(), cacheKey = if (cacheable) path else null)
    }

    private suspend fun <T> execute(
        request: Request,
        dataSerializer: KSerializer<T>,
        cacheKey: String? = null,
    ): T = withContext(Dispatchers.IO) {
        val serializer = Envelope.serializer(dataSerializer)
        val body: String = try {
            http.newCall(request).execute().use { response -> readBody(response) }
        } catch (e: IOException) {
            _offline.value = true
            val cached = cacheKey?.let { cache?.read(it) } ?: throw OfflineException(e)
            return@withContext unwrap(json.decodeFromString(serializer, cached), 200)
        }
        _offline.value = false
        val envelope = json.decodeFromString(serializer, body)
        if (envelope.ok && cacheKey != null) cache?.write(cacheKey, body)
        unwrap(envelope, 200)
    }

    private fun readBody(response: Response): String {
        val text = response.body.string()
        if (!response.isSuccessful) {
            val message = runCatching {
                json.decodeFromString(Envelope.serializer(serializer<Unit?>()), text).error
            }.getOrNull() ?: "Request failed (${response.code})"
            if (response.code == 401) throw NotPairedException(message)
            throw ApiException(message, response.code)
        }
        return text
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> unwrap(envelope: Envelope<T>, status: Int): T {
        if (!envelope.ok) throw ApiException(envelope.error ?: "Request failed", status)
        // A null payload is a valid answer for nullable types (e.g. no next episode).
        return envelope.data as T
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

/**
 * Adds the pairing token to requests for the paired PC — used by the image
 * loader so poster URLs stay token-free.
 */
class AuthInterceptor(private val api: CinecasaApi) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val server = api.server
        val request = chain.request()
        if (server == null || request.url.host != server.host || request.url.port != server.port) {
            return chain.proceed(request)
        }
        return chain.proceed(
            request.newBuilder().header("Authorization", "Bearer ${server.token}").build()
        )
    }
}
