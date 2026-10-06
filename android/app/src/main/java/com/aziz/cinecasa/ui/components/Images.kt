package com.aziz.cinecasa.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.compose.LocalPlatformContext
import coil3.request.ImageRequest
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.theme.CinecasaColors

/**
 * An image from the PC's artwork cache (e.g. "w500/abc.jpg"). The cache key is
 * the image key rather than the URL, so artwork stays cached if the PC's IP
 * address changes.
 */
@Composable
fun RemoteImage(
    key: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alignment: Alignment = Alignment.Center,
) {
    val api = LocalApp.current.api
    val url = key?.let { api.imageUrl(it) }
    if (url == null) {
        Box(modifier.background(CinecasaColors.BgCard))
        return
    }
    val context = LocalPlatformContext.current
    val request = remember(url, key) {
        ImageRequest.Builder(context)
            .data(url)
            .memoryCacheKey(key)
            .diskCacheKey(key)
            .build()
    }
    AsyncImage(
        model = request,
        contentDescription = contentDescription,
        modifier = if (contentScale == ContentScale.Crop) modifier.background(CinecasaColors.BgCard) else modifier,
        contentScale = contentScale,
        alignment = alignment,
    )
}

/** Artwork bundled with the app (Specials logos and backgrounds). */
@Composable
fun AssetImage(
    uri: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alignment: Alignment = Alignment.Center,
) {
    AsyncImage(
        model = uri,
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = contentScale,
        alignment = alignment,
    )
}
