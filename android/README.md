# Cinecasa for Android tablets

The tablet companion to the Cinecasa desktop app. It browses the same library
and streams from your PC over home Wi-Fi. Watch progress is shared: stop a
movie on the tablet and resume it on the PC, or the other way round.

The PC does all the library work: scanning, TMDB metadata, artwork and the
database. The tablet is a remote screen and a player. Nothing is re-encoded.
The PC sends the original file, and [libVLC](https://code.videolan.org/videolan/vlc-android)
plays it on the tablet. That covers MKV, HEVC, DTS, AC3, TrueHD, embedded
subtitle tracks, and `.srt`/`.ass` files next to the video.

## Features

- Home with the rotating hero, **Continue Watching** for shows and movies,
  Recently Added, and the Movies and TV Shows rows. Long-press a Continue
  Watching card to remove it, with undo.
- Movies and TV Shows grids with sorting, plus Search.
- Movie and show pages with Resume, seasons, episode progress and cast.
- **Specials** with their own artwork, including the Tom & Jerry random mode.
- Full-screen player:
  - ±10 s buttons, or double-tap the left or right side to skip.
  - Audio and subtitle pickers.
  - Fit, Zoom and Stretch picture modes.
  - Progress is saved every 10 seconds, on pause, and when you leave.
  - Auto-play next episode, with a 5-second countdown you can cancel. The
    switch is in the top bar, like on the desktop.
- Finds the PC on the network by itself, and finds it again if its IP address
  changes.
- Opens with your last-seen library while the PC is off. Playback needs the PC.

## Build and install

You need **Android Studio** with a recent Android SDK (the app compiles against
API 37), and JDK 17 or newer.

1. In Android Studio, choose **File → Open** and pick this `android/` folder.
   Let Gradle sync. It downloads Gradle 9.6, AGP 9.4 and the libraries.
2. Turn on USB debugging on the tablet, plug it in, and press **Run**.

Or from a terminal:

```bash
cd android
./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

The release build is signed with your local debug key, so it installs
directly. It isn't meant for the Play Store. The APK holds libVLC for
arm64-v8a, armeabi-v7a and x86_64, about 30 MB each. To make the APK smaller,
remove the ABIs you don't need from `abiFilters` in `app/build.gradle.kts`.
Almost every tablet is `arm64-v8a`.

Unit tests for the networking layer run with `./gradlew test`.

## First run

1. On the PC, open Cinecasa → **Settings → Tablet Streaming**. Check that
   streaming is on, and note the pairing code.
2. The first time, Windows Firewall asks whether Cinecasa may use the network.
   Allow it on **Private networks**.
3. On the tablet, open Cinecasa and pick your PC from the list. If it isn't
   listed, type the address shown in the PC's Settings. Then enter the code.

To have the library available whenever the PC is on, also turn on **Start
with Windows** and **Keep running in the tray**.

## Troubleshooting

- **The PC isn't in the list**:
  - The tablet and PC must be on the same network. Guest Wi-Fi networks often
    block devices from seeing each other.
  - Typing the IP address shown in the PC's Settings works even when
    discovery doesn't.
- **"Couldn't reach …"**:
  - Check that Cinecasa is running on the PC (look for it in the tray).
  - Check that the firewall allows it on Private networks, and that your
    network is set to Private in Windows.
- **The tablet went back to pairing**: the PC was unpaired with **Unpair all
  tablets**. Enter the new code.
- **Stuttering on 4K remuxes**: that's Wi-Fi bandwidth. 5 GHz Wi-Fi, or
  keeping the tablet nearer the router, helps.

## How it fits together

```
 Tablet (this app)                         PC (Cinecasa desktop)
 ─────────────────                         ─────────────────────
 Compose UI ──── JSON over HTTP ─────────► electron/server/httpServer.ts
 Coil       ──── /img/<key> ─────────────►   ├─ library + progress (SQLite)
 libVLC     ──── /stream/<type>/<id> ────►   ├─ files, with HTTP Range seeking
 NsdManager ◄─── mDNS _cinecasa._tcp ─────   └─ discovery.ts
```

| Path | What's there |
|---|---|
| `data/` | API client, models matching `shared/types.ts`, offline cache, progress reporting, discovery, settings |
| `ui/` | Navigation, theme (the desktop palette), shared components, one file per screen |
| `player/` | The libVLC activity and its controls |
| `assets/specials/` | Specials artwork, copied from the desktop's `assets/` |
