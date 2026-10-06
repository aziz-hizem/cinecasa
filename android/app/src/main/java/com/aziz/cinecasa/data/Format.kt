package com.aziz.cinecasa.data

import java.util.Locale

// Same formatting as the desktop's src/lib/format.ts.

fun formatRuntime(minutes: Int?): String {
    if (minutes == null || minutes <= 0) return ""
    val h = minutes / 60
    val m = minutes % 60
    return when {
        h > 0 && m > 0 -> "${h}h ${m}m"
        h > 0 -> "${h}h"
        else -> "${m}m"
    }
}

fun formatRating(rating: Double?): String =
    if (rating == null) "" else String.format(Locale.US, "%.1f", rating)

/** A millisecond position as h:mm:ss or m:ss. */
fun formatPosition(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, s)
    else String.format(Locale.US, "%d:%02d", m, s)
}

/** "S1E3", or "S1E3 Part 2" for multi-part episodes. */
fun episodeCode(season: Int, episode: Int, part: Int = 1, partCount: Int = 1): String =
    if (partCount > 1) "S${season}E$episode Part $part" else "S${season}E$episode"
