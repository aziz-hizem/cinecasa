package com.aziz.cinecasa.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "cinecasa")

/** The paired PC and the tablet's own preferences. */
class SettingsStore(private val context: Context) {

    val server: Flow<ServerConfig?> = context.dataStore.data.map { prefs ->
        val host = prefs[HOST]
        val token = prefs[TOKEN]
        if (host == null || token == null) null
        else ServerConfig(host, prefs[PORT] ?: DEFAULT_PORT, token, prefs[NAME] ?: host)
    }

    /** Start the next episode automatically, like the desktop's header toggle. */
    val autoPlay: Flow<Boolean> = context.dataStore.data.map { it[AUTO_PLAY] ?: true }

    suspend fun saveServer(config: ServerConfig) {
        context.dataStore.edit {
            it[HOST] = config.host
            it[PORT] = config.port
            it[TOKEN] = config.token
            it[NAME] = config.name
        }
    }

    suspend fun clearServer() {
        context.dataStore.edit {
            it.remove(HOST)
            it.remove(PORT)
            it.remove(TOKEN)
            it.remove(NAME)
        }
    }

    suspend fun setAutoPlay(enabled: Boolean) {
        context.dataStore.edit { it[AUTO_PLAY] = enabled }
    }

    private companion object {
        val HOST = stringPreferencesKey("server_host")
        val PORT = intPreferencesKey("server_port")
        val TOKEN = stringPreferencesKey("server_token")
        val NAME = stringPreferencesKey("server_name")
        val AUTO_PLAY = booleanPreferencesKey("auto_play")
    }
}
