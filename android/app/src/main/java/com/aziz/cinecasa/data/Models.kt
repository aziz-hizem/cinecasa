package com.aziz.cinecasa.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mirrors shared/types.ts in the desktop app, as served by electron/server/httpServer.ts.

@Serializable
enum class ItemType {
    @SerialName("movie") MOVIE,
    @SerialName("episode") EPISODE;

    /** Path segment used in server URLs (/stream/movie/1). */
    val wire: String get() = if (this == MOVIE) "movie" else "episode"
}

@Serializable
enum class WatchState {
    @SerialName("unwatched") UNWATCHED,
    @SerialName("in_progress") IN_PROGRESS,
    @SerialName("watched") WATCHED,
}

@Serializable
data class Movie(
    val id: Int,
    val tmdbId: Int? = null,
    val title: String,
    val originalTitle: String? = null,
    val year: Int? = null,
    val overview: String? = null,
    val tagline: String? = null,
    val runtime: Int? = null,
    val rating: Double? = null,
    val releaseDate: String? = null,
    val genres: List<String> = emptyList(),
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val logoPath: String? = null,
    val addedAt: Long = 0,
)

@Serializable
data class Show(
    val id: Int,
    val tmdbId: Int? = null,
    val title: String,
    val originalTitle: String? = null,
    val year: Int? = null,
    val overview: String? = null,
    val status: String? = null,
    val rating: Double? = null,
    val firstAirDate: String? = null,
    val genres: List<String> = emptyList(),
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val logoPath: String? = null,
    val addedAt: Long = 0,
)

@Serializable
data class Season(
    val id: Int,
    val showId: Int,
    val seasonNumber: Int,
    val name: String? = null,
    val overview: String? = null,
    val posterPath: String? = null,
    val airDate: String? = null,
    val episodeCount: Int? = null,
)

@Serializable
data class Episode(
    val id: Int,
    val showId: Int,
    val seasonId: Int,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val episodePart: Int = 1,
    val title: String? = null,
    val overview: String? = null,
    val stillPath: String? = null,
    val airDate: String? = null,
    val runtime: Int? = null,
    val rating: Double? = null,
)

@Serializable
data class CastMember(
    val id: Int,
    val name: String,
    val character: String? = null,
    val profilePath: String? = null,
    val orderIndex: Int? = null,
)

@Serializable
data class WatchProgress(
    val itemType: ItemType,
    val itemId: Int,
    val positionMs: Long,
    val durationMs: Long,
    val state: WatchState,
    val lastPlayedAt: Long? = null,
    val watchedAt: Long? = null,
) {
    val fraction: Float
        get() = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
}

/** A Continue Watching card: an in-progress item, or the next episode of a show. */
@Serializable
data class InProgressItem(
    val itemType: ItemType,
    val itemId: Int,
    val positionMs: Long,
    val durationMs: Long,
    val lastPlayedAt: Long = 0,
    val title: String,
    val year: Int? = null,
    val posterPath: String? = null,
    val showId: Int? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val episodeTitle: String? = null,
) {
    val fraction: Float
        get() = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
}

@Serializable
data class HomeData(
    val recentMovies: List<Movie> = emptyList(),
    val recentShows: List<Show> = emptyList(),
    val continueWatching: List<InProgressItem> = emptyList(),
)

@Serializable
data class MovieDetail(
    val movie: Movie,
    val cast: List<CastMember> = emptyList(),
    val progress: WatchProgress? = null,
)

@Serializable
data class ShowDetail(
    val show: Show,
    val seasons: List<Season> = emptyList(),
    val episodes: List<Episode> = emptyList(),
    val cast: List<CastMember> = emptyList(),
    val progress: List<WatchProgress> = emptyList(),
    /** Set when the show lives in a Specials folder (e.g. "oscars", "tom_and_jerry"). */
    val specialKind: String? = null,
)

@Serializable
data class SearchResults(
    val movies: List<Movie> = emptyList(),
    val shows: List<Show> = emptyList(),
)

@Serializable
data class SpecialContents(
    val movies: List<Movie> = emptyList(),
    val shows: List<Show> = emptyList(),
)

@Serializable
data class SubtitleTrack(
    val index: Int,
    val label: String,
    val ext: String,
)

@Serializable
data class Hello(
    val app: String,
    val apiVersion: Int,
    val name: String,
    val authorized: Boolean,
)

@Serializable
data class PairResult(
    val token: String,
    val name: String,
)

/** What the player reports to the PC. "start" puts the item in Continue Watching right away. */
enum class ProgressEvent(val wire: String) { START("start"), TICK("tick"), END("end") }
