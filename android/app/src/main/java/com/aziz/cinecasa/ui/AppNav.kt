package com.aziz.cinecasa.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.aziz.cinecasa.ui.components.OfflineBanner
import com.aziz.cinecasa.ui.components.PagePadding
import com.aziz.cinecasa.ui.screens.BrowseKind
import com.aziz.cinecasa.ui.screens.BrowseScreen
import com.aziz.cinecasa.ui.screens.ConnectScreen
import com.aziz.cinecasa.ui.screens.HomeScreen
import com.aziz.cinecasa.ui.screens.MovieDetailScreen
import com.aziz.cinecasa.ui.screens.SearchScreen
import com.aziz.cinecasa.ui.screens.SettingsScreen
import com.aziz.cinecasa.ui.screens.ShowDetailScreen
import com.aziz.cinecasa.ui.screens.SpecialHubScreen
import com.aziz.cinecasa.ui.screens.SpecialsScreen
import com.aziz.cinecasa.ui.theme.CinecasaColors
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun CinecasaRoot() {
    val app = LocalApp.current
    var start by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val saved = app.settings.server.first()
        app.api.server = saved
        start = if (saved == null) Routes.CONNECT else Routes.HOME
    }

    val startRoute = start
    if (startRoute == null) {
        Box(Modifier.fillMaxSize().background(CinecasaColors.Bg))
        return
    }

    val nav = rememberNavController()

    // The PC unpaired this tablet: go back to pairing.
    LaunchedEffect(nav) {
        app.unpaired.collect {
            app.forgetServer()
            nav.resetTo(Routes.connect("unpaired"))
        }
    }

    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val onConnect = route == null || route.startsWith("connect")

    Column(Modifier.fillMaxSize().background(CinecasaColors.Bg).systemBarsPadding()) {
        if (!onConnect) {
            TopBar(nav, route)
            OfflineBanner(onRetry = { app.refresh.value++ })
        }
        Box(Modifier.weight(1f)) {
            NavHost(nav, startDestination = startRoute) {
                composable(
                    Routes.CONNECT,
                    arguments = listOf(navArgument("reason") { type = NavType.StringType; nullable = true; defaultValue = null }),
                ) { entry ->
                    ConnectScreen(
                        reason = entry.arguments?.getString("reason"),
                        onPaired = { nav.resetTo(Routes.HOME) },
                    )
                }
                composable(Routes.HOME) { HomeScreen(nav) }
                composable(Routes.MOVIES) { BrowseScreen(BrowseKind.MOVIES, nav) }
                composable(Routes.TV) { BrowseScreen(BrowseKind.SHOWS, nav) }
                composable(Routes.SPECIALS) { SpecialsScreen(nav) }
                composable(Routes.SEARCH) { SearchScreen(nav) }
                composable(Routes.SETTINGS) {
                    SettingsScreen(onForget = { nav.resetTo(Routes.connect()) })
                }
                composable(Routes.MOVIE, arguments = listOf(navArgument("id") { type = NavType.IntType })) { entry ->
                    MovieDetailScreen(entry.arguments?.getInt("id") ?: 0, nav)
                }
                composable(Routes.SHOW, arguments = listOf(navArgument("id") { type = NavType.IntType })) { entry ->
                    ShowDetailScreen(entry.arguments?.getInt("id") ?: 0, nav)
                }
                composable(Routes.SPECIAL) { entry ->
                    SpecialHubScreen(entry.arguments?.getString("kind").orEmpty(), nav)
                }
            }
        }
    }
}

/** The desktop TopNav: tabs, search, auto-play toggle and settings. */
@Composable
private fun TopBar(nav: NavHostController, route: String?) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val autoPlay by app.settings.autoPlay.collectAsState(initial = true)

    fun go(target: String) {
        if (route == target) return
        nav.navigate(target) {
            popUpTo(Routes.HOME) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Row(
        Modifier.fillMaxWidth().padding(horizontal = PagePadding - 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "CINECASA",
            color = CinecasaColors.Accent,
            fontWeight = FontWeight.Black,
            fontSize = 20.sp,
            letterSpacing = 2.sp,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Spacer(Modifier.width(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            NavTab("Home", route == Routes.HOME) { go(Routes.HOME) }
            NavTab("Movies", route == Routes.MOVIES) { go(Routes.MOVIES) }
            NavTab("TV Shows", route == Routes.TV) { go(Routes.TV) }
            NavTab("Specials", route == Routes.SPECIALS || route == Routes.SPECIAL) { go(Routes.SPECIALS) }
        }
        Spacer(Modifier.weight(1f))
        IconButton(onClick = { go(Routes.SEARCH) }) {
            Icon(Icons.Filled.Search, "Search", tint = if (route == Routes.SEARCH) CinecasaColors.TextPrimary else CinecasaColors.TextSecondary)
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp)) {
            Icon(
                Icons.Filled.SkipNext,
                null,
                Modifier.size(18.dp),
                tint = if (autoPlay) CinecasaColors.Accent else CinecasaColors.TextMuted,
            )
            Text(
                "Auto-play",
                style = MaterialTheme.typography.labelMedium,
                color = if (autoPlay) CinecasaColors.Accent else CinecasaColors.TextMuted,
                modifier = Modifier.padding(start = 4.dp, end = 8.dp),
            )
            Switch(
                checked = autoPlay,
                onCheckedChange = { scope.launch { app.settings.setAutoPlay(it) } },
                colors = SwitchDefaults.colors(checkedTrackColor = CinecasaColors.Accent),
            )
        }
        IconButton(onClick = { go(Routes.SETTINGS) }) {
            Icon(Icons.Filled.Settings, "Settings", tint = if (route == Routes.SETTINGS) CinecasaColors.TextPrimary else CinecasaColors.TextSecondary)
        }
    }
}

@Composable
private fun NavTab(label: String, selected: Boolean, onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        shape = RoundedCornerShape(6.dp),
    ) {
        Text(
            label,
            color = if (selected) CinecasaColors.TextPrimary else CinecasaColors.TextSecondary,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}
