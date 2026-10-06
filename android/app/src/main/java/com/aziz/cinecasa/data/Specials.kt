package com.aziz.cinecasa.data

/**
 * Display side of the desktop's src/lib/specials.ts. Which titles belong to a
 * special is decided on the PC (shared/specialMembership.ts) and fetched from
 * /api/specials/{kind}; only the artwork and wording live here.
 */
data class SpecialDef(
    val kind: String,
    val name: String,
    val blurb: String,
    /** File under app/src/main/assets/specials/. */
    val logoAsset: String,
    val backgroundAsset: String,
    /** Glow colour as 0xRRGGBB. */
    val glow: Long,
    val detection: Detection,
    /** A special that is really one series jumps straight into that show. */
    val singleSeries: Boolean = false,
) {
    enum class Detection { AUTO, FOLDER }

    val logoUri: String get() = "file:///android_asset/specials/$logoAsset"
    val backgroundUri: String get() = "file:///android_asset/specials/$backgroundAsset"
}

val SPECIALS: List<SpecialDef> = listOf(
    SpecialDef(
        kind = "oscars",
        name = "The Oscars",
        blurb = "Every ceremony, year by year",
        logoAsset = "oscars_logo_transparent.png",
        backgroundAsset = "oscars_background.jpg",
        glow = 0xC7A448,
        detection = SpecialDef.Detection.FOLDER,
        singleSeries = true,
    ),
    SpecialDef(
        kind = "tom_and_jerry",
        name = "Tom & Jerry",
        blurb = "The classic shorts collection",
        logoAsset = "tom_and_jerry_logo_transparent.png",
        backgroundAsset = "tom_and_jerry_background.jpg",
        glow = 0xE61938,
        detection = SpecialDef.Detection.FOLDER,
        singleSeries = true,
    ),
    SpecialDef(
        kind = "marvel",
        name = "Marvel",
        blurb = "The cinematic universe",
        logoAsset = "Marvel_Logo.svg.webp",
        backgroundAsset = "marvel_background_tab.webp",
        glow = 0xED1D24,
        detection = SpecialDef.Detection.FOLDER,
    ),
    SpecialDef(
        kind = "spiderman",
        name = "Spider-Man",
        blurb = "Every web-slinger on film",
        logoAsset = "spiderman_logo.png",
        backgroundAsset = "spiderman_background.jpg",
        glow = 0xE3242B,
        detection = SpecialDef.Detection.AUTO,
    ),
    SpecialDef(
        kind = "pirates",
        name = "Pirates of the Caribbean",
        blurb = "The full voyage",
        logoAsset = "pirates_of_the_caribbean_logo.png",
        backgroundAsset = "pirates_of_the_caribbean_background.jpg",
        glow = 0xC69E56,
        detection = SpecialDef.Detection.FOLDER,
    ),
)

fun specialFor(kind: String?): SpecialDef? = SPECIALS.firstOrNull { it.kind == kind }

const val TOM_AND_JERRY = "tom_and_jerry"
