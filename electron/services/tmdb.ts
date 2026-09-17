const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

export interface TmdbSearchResult {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  popularity?: number
  poster_path?: string | null
  vote_average?: number
  overview?: string
}

export interface TmdbMovie {
  id: number
  title: string
  original_title?: string
  overview?: string
  tagline?: string
  runtime?: number
  vote_average?: number
  release_date?: string
  genres?: { id: number; name: string }[]
  poster_path?: string | null
  backdrop_path?: string | null
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] }
  images?: { logos?: { file_path: string }[] }
}

export interface TmdbShow {
  id: number
  name: string
  original_name?: string
  overview?: string
  status?: string
  vote_average?: number
  first_air_date?: string
  number_of_seasons?: number
  number_of_episodes?: number
  genres?: { id: number; name: string }[]
  poster_path?: string | null
  backdrop_path?: string | null
  seasons?: TmdbSeasonSummary[]
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] }
  images?: { logos?: { file_path: string }[] }
}

export interface TmdbSeasonSummary {
  id: number
  season_number: number
  name?: string
  overview?: string
  poster_path?: string | null
  air_date?: string
  episode_count?: number
}

export interface TmdbSeason extends TmdbSeasonSummary {
  episodes?: TmdbEpisode[]
}

export interface TmdbEpisode {
  id: number
  name?: string
  overview?: string
  still_path?: string | null
  air_date?: string
  runtime?: number | null
  vote_average?: number
  episode_number: number
  season_number: number
}

export interface TmdbImage {
  file_path: string
  width: number
  height: number
  aspect_ratio: number
  vote_average?: number
  vote_count?: number
}

export interface TmdbImagesResponse {
  backdrops: TmdbImage[]
  posters: TmdbImage[]
  logos?: TmdbImage[]
}

export interface TmdbCastMember {
  id: number
  name: string
  character?: string
  profile_path?: string | null
  order?: number
}

export interface TmdbCrewMember {
  id: number
  name: string
  job?: string
  department?: string
  profile_path?: string | null
}

export type TmdbImageSize =
  | 'w92'
  | 'w154'
  | 'w185'
  | 'w300'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'w1280'
  | 'original'

export class TmdbClient {
  constructor(private apiKey: string) {}

  private async req<T>(
    p: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const url = new URL(BASE + p)
    url.searchParams.set('api_key', this.apiKey)
    url.searchParams.set('language', 'en-US')
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }

    const res = await fetch(url.toString())
    if (!res.ok) {
      if (res.status >= 500) {
        // TMDB itself is erroring (e.g. a data-encoding bug in their API for this
        // specific title) — not something a retry on our side can fix.
        throw new Error(
          `TMDB is having a server-side problem with this title (${res.status} ${res.statusText}). Try again later.`
        )
      }
      const body = await res.text().catch(() => '')
      throw new Error(`TMDB ${p}: ${res.status} ${res.statusText} ${body.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }

  searchMovie(query: string, year?: number) {
    return this.req<{ results: TmdbSearchResult[] }>('/search/movie', {
      query,
      year,
      include_adult: 'false',
    })
  }

  searchTv(query: string, firstAirYear?: number) {
    return this.req<{ results: TmdbSearchResult[] }>('/search/tv', {
      query,
      first_air_date_year: firstAirYear,
      include_adult: 'false',
    })
  }

  findByImdbId(imdbId: string) {
    return this.req<{
      movie_results: TmdbSearchResult[]
      tv_results: TmdbSearchResult[]
    }>(`/find/${encodeURIComponent(imdbId)}`, {
      external_source: 'imdb_id',
    })
  }

  getMovie(id: number) {
    return this.req<TmdbMovie>(`/movie/${id}`, {
      append_to_response: 'credits,images',
      include_image_language: 'en,null',
    })
  }

  getShow(id: number) {
    return this.req<TmdbShow>(`/tv/${id}`, {
      append_to_response: 'credits,images',
      include_image_language: 'en,null',
    })
  }

  getSeason(showId: number, seasonNumber: number) {
    return this.req<TmdbSeason>(`/tv/${showId}/season/${seasonNumber}`)
  }

  getMovieImages(id: number) {
    return this.req<TmdbImagesResponse>(`/movie/${id}/images`, {
      include_image_language: 'en,null',
    })
  }

  getShowImages(id: number) {
    return this.req<TmdbImagesResponse>(`/tv/${id}/images`, {
      include_image_language: 'en,null',
    })
  }

  imageUrl(p: string | null | undefined, size: TmdbImageSize = 'w500'): string | null {
    if (!p) return null
    return `${IMG_BASE}/${size}${p}`
  }
}
