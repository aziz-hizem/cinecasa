package com.aziz.cinecasa.data

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.nio.file.Files

class CinecasaApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: CinecasaApi
    private val cacheDir = Files.createTempDirectory("cinecasa-cache").toFile()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        api = CinecasaApi(OkHttpClient(), LibraryCache(cacheDir))
        api.server = ServerConfig(server.hostName, server.port, "secret", "PC")
    }

    @After
    fun tearDown() {
        server.close()
        cacheDir.deleteRecursively()
    }

    private fun respond(code: Int, body: String) {
        server.enqueue(MockResponse.Builder().code(code).body(body).build())
    }

    @Test
    fun decodesShowDetailAndSendsToken() = runTest {
        respond(200, SHOW_JSON)
        val detail = api.show(1)
        assertEquals("Show", detail.show.title)
        assertEquals(2, detail.episodes.size)
        assertEquals(WatchState.IN_PROGRESS, detail.progress.single().state)
        assertEquals(ItemType.EPISODE, detail.progress.single().itemType)
        assertNull(detail.specialKind)

        val request = server.takeRequest()
        assertEquals("/api/shows/1", request.url.encodedPath)
        assertEquals("Bearer secret", request.headers["Authorization"])
    }

    @Test
    fun nullNextEpisodeIsNotAnError() = runTest {
        respond(200, """{"ok":true,"data":null}""")
        assertNull(api.nextEpisode(5, random = false))
    }

    @Test
    fun unauthorizedMeansNotPaired() = runTest {
        respond(401, """{"ok":false,"error":"Not paired with this PC."}""")
        try {
            api.movies()
            fail("expected NotPairedException")
        } catch (e: NotPairedException) {
            assertEquals("Not paired with this PC.", e.message)
        }
    }

    @Test
    fun fallsBackToCacheWhenPcIsOff() = runTest {
        respond(200, """{"ok":true,"data":[{"id":1,"title":"Cached Movie","addedAt":1}]}""")
        assertEquals("Cached Movie", api.movies().single().title)

        server.close()
        val offlineMovies = api.movies()
        assertEquals("Cached Movie", offlineMovies.single().title)
        assertTrue(api.offline.first())

        try {
            api.shows() // never cached
            fail("expected OfflineException")
        } catch (_: OfflineException) {
        }
    }

    @Test
    fun progressReportBody() = runTest {
        respond(200, """{"ok":true,"data":{"itemType":"movie","itemId":3,"positionMs":5000,"durationMs":10000,"state":"in_progress"}}""")
        val saved = api.reportProgress(ItemType.MOVIE, 3, 5000, 10000, ProgressEvent.TICK)
        assertEquals(0.5f, saved!!.fraction)
        val body = server.takeRequest().body!!.utf8()
        assertTrue(body.contains("\"event\":\"tick\""))
        assertTrue(body.contains("\"itemType\":\"movie\""))
    }

    @Test
    fun mediaUrlsCarryTokenButImagesDoNot() {
        assertTrue(api.streamUrl(ItemType.MOVIE, 7).endsWith("/stream/movie/7?t=secret"))
        assertTrue(api.subtitleUrl(ItemType.EPISODE, 2, 0).endsWith("/subs/episode/2/0?t=secret"))
        assertTrue(api.imageUrl("w500/abc.jpg")!!.endsWith("/img/w500/abc.jpg"))
    }

    @Test
    fun randomModeNeverReportsProgress() = runTest {
        respond(200, """{"ok":true,"data":{"id":9,"showId":1,"seasonId":1,"seasonNumber":1,"episodeNumber":4}}""")
        val session = PlaybackSession(api, randomMode = true)
        val item = PlayItem(ItemType.EPISODE, 2, "Tom & Jerry")
        session.started(item)
        session.save(item, 1000, 2000)
        val next = session.ended(item, 2000)
        assertEquals(9, next!!.id)
        // Only the next-episode lookup reached the server.
        assertEquals(1, server.requestCount)
        assertEquals("/api/next/2", server.takeRequest().url.encodedPath)
    }

    @Test
    fun ticksAreThrottled() = runTest {
        repeat(2) { respond(200, """{"ok":true,"data":null}""") }
        val session = PlaybackSession(api, randomMode = false, tickIntervalMs = 10_000)
        val item = PlayItem(ItemType.MOVIE, 1, "Movie")
        session.playing(item, 1_000, 60_000, nowMs = 10_000)
        session.playing(item, 2_000, 60_000, nowMs = 15_000) // too soon
        session.playing(item, 11_000, 60_000, nowMs = 20_000)
        assertEquals(2, server.requestCount)
    }

    private companion object {
        // Captured from the desktop server.
        const val SHOW_JSON = """{"ok":true,"data":{"show":{"id":1,"tmdbId":null,"title":"Show","originalTitle":null,"year":null,"overview":null,"status":null,"rating":null,"firstAirDate":null,"genres":[],"posterPath":null,"backdropPath":null,"logoPath":null,"metadataLocked":false,"folderPath":"C:\\TV\\Show","addedAt":1791316399000},"seasons":[{"id":1,"showId":1,"seasonNumber":1,"name":null,"overview":null,"posterPath":null,"airDate":null,"episodeCount":null}],"episodes":[{"id":1,"showId":1,"seasonId":1,"seasonNumber":1,"episodeNumber":1,"episodePart":1,"title":null,"overview":null,"stillPath":null,"airDate":null,"runtime":null,"rating":null,"filePath":"C:\\TV\\Show\\S01E01.mkv","fileSize":100000},{"id":2,"showId":1,"seasonId":1,"seasonNumber":1,"episodeNumber":2,"episodePart":1,"title":null,"overview":null,"stillPath":null,"airDate":null,"runtime":null,"rating":null,"filePath":"C:\\TV\\Show\\S01E02.mkv","fileSize":100000}],"cast":[],"progress":[{"itemType":"episode","itemId":1,"positionMs":60000,"durationMs":1200000,"state":"in_progress","lastPlayedAt":1791316399661,"watchedAt":null}],"specialKind":null}}"""
    }
}
