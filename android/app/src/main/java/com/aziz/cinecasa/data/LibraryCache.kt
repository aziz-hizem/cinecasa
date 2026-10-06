package com.aziz.cinecasa.data

import java.io.File
import java.security.MessageDigest

/**
 * Last good copy of each library response, so the app still opens and can be
 * browsed while the PC is off.
 */
class LibraryCache(private val dir: File) {

    fun read(key: String): String? {
        val file = fileFor(key)
        return if (file.exists()) runCatching { file.readText() }.getOrNull() else null
    }

    fun write(key: String, body: String) {
        runCatching {
            dir.mkdirs()
            val target = fileFor(key)
            val tmp = File(dir, target.name + ".tmp")
            tmp.writeText(body)
            if (!tmp.renameTo(target)) {
                target.delete()
                tmp.renameTo(target)
            }
        }
    }

    fun clear() {
        dir.listFiles()?.forEach { it.delete() }
    }

    private fun fileFor(key: String): File {
        val digest = MessageDigest.getInstance("SHA-1").digest(key.toByteArray())
        return File(dir, digest.joinToString("") { "%02x".format(it) } + ".json")
    }
}
