package com.aziz.cinecasa.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.aziz.cinecasa.AppContainer
import com.aziz.cinecasa.data.NotPairedException
import kotlinx.coroutines.CancellationException

val LocalApp = staticCompositionLocalOf<AppContainer> { error("AppContainer not provided") }

sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Ready<T>(val value: T) : Load<T>
    data class Failed(val message: String) : Load<Nothing>
}

class LoadState<T>(val state: Load<T>, val reload: () -> Unit) {
    val value: T? get() = (state as? Load.Ready<T>)?.value
}

/**
 * Loads data for a screen and reloads it whenever the screen comes back into
 * view (e.g. after the player closes, so progress bars are up to date). A
 * failed reload keeps showing the last good data.
 */
@Composable
fun <T> rememberLoad(vararg keys: Any?, fetch: suspend () -> T): LoadState<T> {
    val app = LocalApp.current
    var tick by remember { mutableIntStateOf(0) }
    var state by remember(*keys) { mutableStateOf<Load<T>>(Load.Loading) }

    // "Retry" in the offline banner bumps this for every screen.
    val refresh by app.refresh.collectAsState()

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { tick++ }

    LaunchedEffect(tick, refresh, *keys) {
        if (tick == 0) return@LaunchedEffect
        state = try {
            Load.Ready(fetch())
        } catch (e: CancellationException) {
            throw e
        } catch (e: NotPairedException) {
            app.notifyUnpaired()
            Load.Failed(e.message ?: "Not paired")
        } catch (e: Exception) {
            if (state is Load.Ready) state else Load.Failed(e.message ?: "Something went wrong")
        }
    }
    return LoadState(state) { tick++ }
}
