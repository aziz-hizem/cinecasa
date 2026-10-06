package com.aziz.cinecasa

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import com.aziz.cinecasa.ui.CinecasaRoot
import com.aziz.cinecasa.ui.LocalApp
import com.aziz.cinecasa.ui.theme.CinecasaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as CinecasaApp).container
        setContent {
            CinecasaTheme {
                CompositionLocalProvider(LocalApp provides container) {
                    CinecasaRoot()
                }
            }
        }
    }
}
