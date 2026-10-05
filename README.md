# Greek Row — Vol. 03

A browser arcade game: a punk skates through a fictional frat neighborhood, throws
at glowing lawns, and defeats all twelve houses. Three lives, gradual sorority
transformation, and two progressively stronger punk comebacks. No accounts or
Spotify integration.

## Play locally

Requires Node 22.12+ (verified with Node 26.5).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. This starts Vite and a shared local admission server
on 127.0.0.1:8797. Override `QUEUE_PORT` if needed. Start through `npm run dev`;
a standalone static preview cannot reserve a player slot.

Desktop and landscape use a straight-on, illustrated belt-scroller view. Left/right
moves along the street; up/down carves into and out of its depth. Portrait phones
use vertical scrolling, and rotating preserves the run. WASD/arrows or the thumb
stick steer, F/J throws, Space ollies, Shift pushes for speed, and P/Escape pauses.
Touch controls include separate THROW, OLLIE and PUSH buttons. Hold throw for
repeated attacks; ammunition regenerates. The camera waits for an uncleared house
so missed targets never make a run unwinnable.

The skateboard has rolling momentum, push boosts, airborne ollies and landings.
Clear a street obstacle in the air for a trick bonus and some makeover relief.
Ride through a coffee stand's marked pickup lane on the ground for a one-time
coffee reward. Coffee is not a floating pickup. Vinyl replenishes ammunition,
and lightning grants a shield.

Rush swag and perfume clouds fill a visible **makeover meter**, changing clothes,
hair and accessories. The meter does not increase just because time passes.
Coffee and successful skate tricks reduce the makeover. At 100%, a sorority
transformation plays; the first two punk returns increase damage to 1.5× and 2×.
The third ends the run. Clearing a district refills ammo and removes twelve
makeover points. Personal bests stay in local storage.

## Add the actual song

The reference repos contain Spotify track ID `33lVSu93J91BDmhfRT7iTA` but no
recording. Until a file is imported, the game clearly labels its original
synthesized demo instrumental. It is not the band's recording.

```sh
brew install yt-dlp ffmpeg  # only if missing
bash scripts/import-song.sh
```

The default source is the supplied song at
`https://www.youtube.com/watch?v=lm-CRMQ7jmU`; both supplied links share this video
ID. Playlist parameters are omitted so the importer selects only this recording.
Pass an optional URL to choose another source.

The script imports one track as `public/audio/fratty-pipeline.mp3` and keeps a
previous copy if replacing a file. It accepts yt-dlp sources and direct audio,
not a Spotify metadata URL. Reload the game after importing; playback begins
with a user gesture and loops. No downloader runs in the web application.

## The 20-player waiting room

Every normal run requires an anonymous server lease. The twenty-first session
waits in FIFO order. Production requests all route to one named Cloudflare
Durable Object, whose persisted state serializes admissions. A tab is a session;
without accounts there is no claim of identifying unique humans. This is
admission to single-player runs, not multiplayer synchronization or anti-cheat.

- Heartbeat: 15 seconds; active lease: 75 seconds; waiting lease: 90 seconds.
- Abandoned sessions expire; visible waiters retain their place automatically.
- A two-minute inactive client releases its slot; maximum reservation is 20 minutes.
- API failure pauses play. Expired clients can rejoin and resume the open run.
- Leave/page close releases the lease; server expiration covers lost connections.
- Local development uses one in-memory room. Production persists across restarts.

JSON POST endpoints are `/api/queue/join`, `/heartbeat`, and `/leave`. Join accepts
an optional `{token}`; the other routes require it. The token is held in page
memory, never used as an account, and never logged. Capacity applies to clients
using the app; browser-delivered code is not a DRM boundary.

## Verify and deploy

```sh
npm test
npm run build
npx wrangler deploy --dry-run
```

The configured Worker serves `dist/` assets and routes `/api/*` through admission.
Deploy the Worker and assets together with `npm run deploy` when publication is
authorized. Static hosting alone cannot enforce a global limit. No deployment
was performed as part of this rebuild.

Focused tests cover the playable win/loss loop, transformations, frame-rate
stability, queue concurrency, expiration, FIFO, persistence and HTTP validation.
Browser QA covers desktop, 390×844 portrait, and 844×390 landscape layouts,
throwing, rotation, pause, and the waiting-room flow. Emulated viewport QA does
not replace testing touch feel and performance on physical phones.

## Project map and recovery

The [adversarial design panel brief and prioritized wishlist](docs/GAME_DESIGN_REVIEW.md)
includes reproducible balance measurements, review roles, and proposed experiments.
Run `node scripts/balance-probe.mjs` to repeat the input-policy comparison.

- `src/model.js`: deterministic game simulation.
- `src/renderer-flat.js`: active Canvas 2D scenery, depth sorting, skating animation and effects.
- `src/renderer.js`: earlier isometric experiment, retained for reference and not imported.
- `src/main.js`: controls, HUD and admission lifecycle.
- `src/audio.js`: local song playback and labeled demo music.
- `server/`: shared queue rules, HTTP boundary, local adapter.
- `worker/index.mjs`, `wrangler.jsonc`: production admission and assets.
- `tests/`: focused regression checks.

Explored `grouchobarks`, `frattypipeline`, and `bandmusicgames.party`. The original
vertical game survives in GrouchoBarks history at `9b8b9e2:fratty-pipeline/`;
the umbrella repo has uninitialized game submodules. The existing `js/`, design
handoff, and ZIP in this repository remain historical references. The new entry
point loads only `src/main.js`; historical Spotify files are not shipped by Vite.
