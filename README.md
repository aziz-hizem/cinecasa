<p align="center">
  <img src="assets/icons/cinecasa.svg" alt="Cinecasa logo" width="96" />
</p>

<h1 align="center">Cinecasa</h1>

<p align="center">
  <em>Cine + casa: a home cinema for the movies and TV shows already on your drives.</em>
</p>

Cinecasa is a Windows desktop app that turns local video folders into a streaming-service-style library, with artwork, descriptions, ratings, cast and episode details. Playback happens in **MPC-HC**: Cinecasa launches the player, follows your progress while you watch, and brings you back to the exact second you stopped.

There is also an **Android tablet app** ([`android/`](android/README.md)) that streams the same library from your PC over home Wi-Fi and shares your watch progress with the desktop.

![Home screen](docs/screenshots/home.jpg)

## Features

- **Automatic library**: scans the folders you choose, recognizes movies and episodes from their file and folder names, and matches them on TMDB
- **Rich metadata**: posters, backdrops, title logos, ratings, genres, cast, seasons and episode stills, cached locally so the library opens instantly
- **Resume anywhere**: tracks the playback position in MPC-HC and resumes from the exact point; items become *watched* at 95%
- **Continue Watching** rows for movies and shows, including the next episode to watch
- **Auto-play next episode**, with a toggle in the header
- **Specials**: themed hubs with their own artwork and ordering (Marvel, Spider-Man, Pirates of the Caribbean, the Oscars ceremonies, and Tom & Jerry with a random-episode mode)
- **Manual control**: fix a wrong match, edit episode metadata and lock it so rescans don't overwrite it
- **Search** across the whole library
- **Tablet app**: browse and stream the library on an Android tablet over home Wi-Fi, with progress shared between the PC and the tablet

| Show page | Movies |
|---|---|
| ![Show page](docs/screenshots/show.jpg) | ![Movies](docs/screenshots/cinema.jpg) |

| Specials | Marvel hub |
|---|---|
| ![Specials](docs/screenshots/specials.jpg) | ![Marvel hub](docs/screenshots/marvel.jpg) |

## How it works

```
 ┌──────────────── Renderer (React) ────────────────┐
 │  Home · Movies · TV Shows · Specials · Search     │
 └───────────────────────┬──────────────────────────┘
                         │  typed IPC bridge (window.api)
 ┌───────────────────────▼──────────── Main process (Electron) ─────────────┐
 │  Scanner + filename parser ──► TMDB client ──► image cache                │
 │                 │                                                          │
 │                 ▼                                                          │
 │            SQLite library (movies, shows, seasons, episodes, progress)     │
 │                 ▲                                                          │
 │  Playback: spawn MPC-HC at the saved position ──► poll its web interface   │
 └───────────────────────────────────────────────────────────────────────────┘
```

- **Scanning**: file and folder names are cleaned of release tags (resolution, codec, source) and parsed into a movie title and year, or a show, season and episode (including multi-part episodes).
- **Metadata**: matched on TMDB, stored in SQLite with `better-sqlite3`, and images are downloaded once and served to the UI through a custom `cinecasa-img://` protocol.
- **Tablet streaming**: a small HTTP server in the main process (`electron/server/`) serves the library as JSON, streams files with HTTP Range requests so the tablet can seek, and saves the tablet's progress into the same database. The tablet finds the PC over mDNS (`_cinecasa._tcp`) and pairs once with a six-digit code shown in Settings.
- **Playback tracking**: before launching MPC-HC, Cinecasa picks a free port and temporarily points MPC-HC's web interface at it (in its `.ini` file or the registry), then starts the file at the saved position. While you watch, it polls MPC-HC's status page for the position and duration and saves progress. When the player closes, the final position decides whether the item is *in progress* or *watched*, and the next episode can start automatically.

## Tech stack

| | |
|---|---|
| App shell | Electron |
| UI | React 18, TypeScript, Tailwind CSS, Framer Motion, React Router |
| Database | SQLite (`better-sqlite3`) |
| Metadata | TMDB API |
| Player | MPC-HC (web interface) |
| Build | Vite, `vite-plugin-electron`, electron-builder |
| Tablet app | Kotlin, Jetpack Compose, libVLC, OkHttp, Coil |

## Getting started

### Requirements

- Windows 10 or 11
- Node.js 20+
- [MPC-HC](https://github.com/clsr2/mpc-hc/releases) installed
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### Install and run

```bash
npm install
npm run dev
```

`npm install` rebuilds `better-sqlite3` for Electron automatically. `npm run dev` starts Vite and opens the app with hot reload.

In **Settings**, add your library folders (as Movies or TV Shows), paste your TMDB API key and check the path to `mpc-hc64.exe`, then run a scan.

### Watch on an Android tablet

In **Settings → Tablet Streaming**, check that streaming is on. Turn on **Start with Windows** if you want the library available whenever the PC is on. Then build and install the tablet app from [`android/`](android/README.md) and pair it with the code shown there.

### Build a Windows installer

```bash
npm run dist
```

The installer is written to `release/`.

## Project structure

```
├── electron/              # Main process
│   ├── main.ts            # Window, image protocol, startup
│   ├── preload.ts         # Typed window.api bridge
│   ├── db/                # SQLite schema, connection and queries
│   ├── ipc/               # Library, metadata, playback, settings and tablet-server handlers
│   ├── server/            # Tablet streaming server: HTTP API, file streaming, mDNS discovery
│   └── services/          # Scanner, filename parser, TMDB client, image cache, MPC-HC control
├── shared/                # Types, IPC channel names and Specials membership shared by both processes
├── src/                   # Renderer (React)
│   ├── routes/            # Home, Movies, TV Shows, Specials, Search, details, Settings
│   ├── components/        # Hero banner, rows, cards, metadata editors, navigation
│   └── lib/               # Formatting, Specials and franchise definitions
├── assets/                # App icon and Specials artwork
└── android/               # Android tablet app (Kotlin, Jetpack Compose, libVLC)
```

## Acknowledgments

This product uses the TMDB API but is not endorsed or certified by TMDB.

Cinecasa is a personal, non-commercial project. Movie titles, posters and the logos and artwork used in Specials (Marvel, Spider-Man, Pirates of the Caribbean, the Oscars, Tom & Jerry) belong to their respective owners.

## License

Code: [MIT](LICENSE).
