package com.aziz.cinecasa.data

import okhttp3.HttpUrl

const val DEFAULT_PORT = 8642

/** The paired PC: where it is and the token it handed out at pairing. */
data class ServerConfig(
    val host: String,
    val port: Int,
    val token: String,
    /** The PC's name, used to find it again over mDNS if its IP address changes. */
    val name: String,
) {
    fun baseUrl(): HttpUrl = baseUrl(host, port)

    companion object {
        fun baseUrl(host: String, port: Int): HttpUrl =
            HttpUrl.Builder().scheme("http").host(host).port(port).build()
    }
}
