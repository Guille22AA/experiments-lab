# G2A2 Radio (fase 0)

Phase 0 of a small, independent online radio. A static website that behaves like a live station:

- **Radio-style playback from your own Spotify playlists.** The song and the exact second playing are computed from the clock, so everyone who tunes in at the same moment hears the same thing. No server, no stored state.
- **Now playing with context.** Title, artist and cover, plus a short blurb about the artist (your own notes first, then Genius, then Spanish and English Wikipedia as a fallback).
- **Weekly schedule.** Every day has its own time slots, each one a playlist ("program"). The full week is shown on the site as a TV-guide grid with the current slot highlighted.
- **Adaptive look, fixed layout.** Each program has a *mood* (party, melancholy, noise, calm, electronic, rap, sensual, bar, retro or neutral) that swaps typefaces, background, texture and shape. Each song's cover art then tints the accent color.
- **Automatic news bulletin.** A GitHub Action pulls RSS feeds three times a day, only serious topics (politics, economy, justice, conflicts…; tunable in `scripts/temas.json`), split into sections (España, and Mundo · Geopolítica; each feed sets its `section` in `scripts/feeds.json`). Stories covered by several outlets become the day's highlights and stay pinned until midnight, re-ranked as coverage grows.
- **Convocatorias board.** Once a day a script reads the public Telegram channels of UGT, CCOO and CJS (`scripts/carteles-fuentes.json`), picks the posts that announce a demonstration, talk or event with a future date, and pins their posters under the schedule. Past ones disappear on their own. Posters from Instagram or X can be added by hand in `data/carteles.json`.
- **Poster board.** A slot for posters (protests, gigs, assemblies…) with optional start/end dates.

Everything runs on free tiers: GitHub Pages for hosting, GitHub Actions for the bulletin, Spotify's Web Playback SDK for audio.

## How the audio works (and its limits)

Audio is streamed by Spotify directly to each listener's browser through the [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk). The site never records or re-broadcasts audio. This means:

- Every listener needs **Spotify Premium** and must log in.
- Apps in Spotify's *Development Mode* allow the owner plus up to **4 extra users**, added by email in the dashboard (rules changed in February 2026). Fine for testing with friends; not a public station.
- Only playlists **you own** can be read.
- The SDK works on desktop browsers; mobile browsers are not supported by Spotify.

Moving past these limits (a real public stream) means leaving Spotify for your own catalog and an Icecast-style server, and dealing with music licensing. That's Phase 1.

## Setup

1. **Create a Spotify app** at <https://developer.spotify.com/dashboard>.
   - APIs: *Web API* and *Web Playback SDK*.
   - Redirect URIs, exactly as they'll appear in the browser:
     - `http://127.0.0.1:5500/` for local testing (Spotify no longer accepts `localhost`)
     - `https://<your-user>.github.io/<repo>/` for GitHub Pages
2. **Edit `js/config.js`:** paste the Client ID, list your playlists under `programs` (the ID is the part after `/playlist/` in a share link) and lay out the week under `schedule` as `["HH:MM", "programKey"]` pairs. Each slot runs until the next one; slots start on the hour or half hour.
3. **Run locally:** `npm run serve`, then open `http://127.0.0.1:5500/`.
4. **Publish:** push to GitHub. The project lives in the `radio-fase0/` subfolder of the `experiments-lab` repo, so Pages must deploy that folder (a Pages workflow that uploads `radio-fase0/`); if it moves to its own repo, use *Settings → Pages → Deploy from branch (main, root)*.
5. **Enable the bulletin:** *Actions* tab → enable workflows → run *Radio - Boletín de noticias* once by hand. After that it runs at 08:00, 14:00 and 20:00 Madrid time (one hour earlier in winter, since cron runs in UTC).

## Customising

| What | Where |
| --- | --- |
| Station name, programs, weekly schedule, moods | `js/config.js` |
| Your own notes about artists | `data/notas.json` (exact artist name) |
| Posters | images in `carteles/`, entries in `data/carteles.json` (`desde`/`hasta` are optional dates) |
| News sources | `scripts/feeds.json` |
| Mood keywords | `RULES` in `js/theme.js` |
| Mood visuals | `css/themes.css` (variables only; the layout lives in `css/base.css`) |

## How mood detection works

1. If the program has `mood` in the config, that wins (the default setup sets it for every program).
2. Otherwise, keywords in the playlist name and description score each mood (weighted ×3).
3. Genres of the most frequent artists add to the score, when Spotify returns them.
4. No matches → `neutral`.

Naming playlists descriptively ("Rock triste de domingo", "Perreo hasta las 6") is the easiest way to steer it.

## Project structure

```
index.html            fixed layout
css/base.css          structure, driven by CSS variables
css/themes.css        one block of variables per mood
js/config.js          the only file you need to edit
js/spotify.js         PKCE auth, Web API, Web Playback SDK
js/radio.js           weekly schedule and "live position" maths
js/parrilla.js        weekly schedule grid on the page
js/theme.js           mood detection and cover-art accent
js/context.js         artist blurbs
js/panels.js          bulletin and poster rendering
scripts/fetch-news.mjs  RSS → data/news.json
scripts/fetch-carteles.mjs  Telegram → data/carteles-auto.json (daily)
../.github/workflows/radio-news.yml  runs the bulletin 3×/day (lives at the repo root, GitHub only reads workflows there)
```

## License

Code: MIT. News headlines belong to their publishers; the bulletin only shows headlines, short snippets and links.
