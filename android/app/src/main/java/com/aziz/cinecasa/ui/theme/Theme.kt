package com.aziz.cinecasa.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Same palette as the desktop app's tailwind.config.js.
object CinecasaColors {
    val Bg = Color(0xFF0A0A0F)
    val BgElevated = Color(0xFF12121A)
    val BgCard = Color(0xFF1A1A24)
    val BgHover = Color(0xFF22222E)
    val Border = Color(0xFF2A2A36)
    val TextPrimary = Color(0xFFF5F5F7)
    val TextSecondary = Color(0xFFA8A8B3)
    val TextMuted = Color(0xFF6B6B78)
    val Accent = Color(0xFFE50914)
    val Star = Color(0xFFFACC15)
    val Success = Color(0xFF34D399)
}

private val colors = darkColorScheme(
    primary = CinecasaColors.Accent,
    onPrimary = Color.White,
    secondary = CinecasaColors.BgHover,
    onSecondary = CinecasaColors.TextPrimary,
    background = CinecasaColors.Bg,
    onBackground = CinecasaColors.TextPrimary,
    surface = CinecasaColors.BgElevated,
    onSurface = CinecasaColors.TextPrimary,
    surfaceVariant = CinecasaColors.BgCard,
    onSurfaceVariant = CinecasaColors.TextSecondary,
    surfaceContainer = CinecasaColors.BgCard,
    surfaceContainerHigh = CinecasaColors.BgHover,
    outline = CinecasaColors.Border,
    outlineVariant = CinecasaColors.Border,
    error = Color(0xFFF87171),
)

private val typography = Typography().let { base ->
    base.copy(
        displaySmall = base.displaySmall.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.Bold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun CinecasaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
