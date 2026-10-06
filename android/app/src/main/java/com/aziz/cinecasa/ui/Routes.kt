package com.aziz.cinecasa.ui

import androidx.navigation.NavHostController

object Routes {
    const val CONNECT = "connect?reason={reason}"
    const val HOME = "home"
    const val MOVIES = "movies"
    const val TV = "tv"
    const val SPECIALS = "specials"
    const val SEARCH = "search"
    const val SETTINGS = "settings"
    const val MOVIE = "movie/{id}"
    const val SHOW = "show/{id}"
    const val SPECIAL = "special/{kind}"

    fun connect(reason: String? = null) = if (reason == null) "connect" else "connect?reason=$reason"
    fun movie(id: Int) = "movie/$id"
    fun show(id: Int) = "show/$id"
    fun special(kind: String) = "special/$kind"
}

/** Clears the back stack and opens [route] — used after pairing / unpairing. */
fun NavHostController.resetTo(route: String) {
    navigate(route) {
        popUpTo(graph.id) { inclusive = true }
        launchSingleTop = true
    }
}
