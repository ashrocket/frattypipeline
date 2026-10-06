# PIPELINE

A momentum skateboard scroller on Greek Row: a 1988 arcade cabinet repainted in
2026, with Paperboy's routes and newspaper, Alto's one-button backflips and Tony
Hawk combos. Keep rolling, sink flaming bottles into frat trash cans, and let the
chaos spread house to house. Stop rolling and the Pipeline — a beige horde of
quarter-zip recruiters — turns you into a zombie.

Pick any of the eight Ivy League campuses as the setting. **Every chapter on the
Row is fictional** (satire; not affiliated with or endorsed by any university), and
real fraternities are deliberately not used. School names are real; before any
public deployment, consider switching them to parody names (one file:
`src/data/campuses.js`).

No account, Spotify connection, external art, font or runtime library is required.
The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The command starts Vite and the local admission server
on port 8797. Override `QUEUE_PORT` when another session owns that port. A static
preview cannot enforce the queue. Never stop another reviewer's development server.

## Play

| | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Kick (speed up) | hold → (D) | stick / D-pad right | stick right |
| Slow down · powerslide | hold ← (A) | stick / D-pad left | stick left |
| Carve lanes | ↑ / ↓ (W / S) | stick, D-pad | stick up / down |
| Light & throw | **hold T** (or F, J), release | X or RT | hold THROW |
| Ollie · hold in the air: backflip | Space (or K) | A | OLLIE |
| Flip tricks (in the air) | tap ↑ ↓ ← → | D-pad / stick flick | flick the stick |
| Power kick · grab (in the air) | Shift (or L) | B or RB | PUSH |
| Switch item | Q or E | Y or LB | ITEM |
| Skip training / next day | Enter | Select | SKIP |
| Pause | P or Esc | Start | Ⅱ |

- **Skate school first.** A 45-second course on the campus quad teaches one verb
  per station with a big thought bubble that shows the real keys: kick, glide,
  slow down, ollie, light & throw, backflip, grind, flip tricks. Enter skips it;
  it switches itself off after you finish once (the title has a toggle).
- **Kick to go, glide, slow down.** Holding → kick-pushes every half second up to
  cruise speed; letting go glides and never stops (a lazy kick keeps you rolling).
  Holding ← drags a foot; above 5 m/s it's a powerslide. Shift is a power kick.
- **Air.** Tap Space to ollie. Hold Space in the air to backflip; let go and the
  skater spots the landing, righting to the nearest upright. Tap an arrow in the
  air for a kickflip, heelflip, 360 flip or shove-it — finish it before landing.
  Come down onto curbs, benches, rails and ledges to grind. Tricks chain into a
  combo (more variety = bigger multiplier) that banks a second after you land;
  banked combos fill **FLOW**: eight seconds of speed and a shield that smashes
  through obstacles. Cones and potholes only trip you; kegs, carts and trucks
  knock you down.
- **Light it, throw it.** Hold T: the lighter flicks and the rag catches; a ring
  shows where it lands and says LOCK when it will go in. It flies about half a
  second, so release before you reach the can. Throws off a rail or mid-trick
  score extra. A miss slams the lid on: that house is marked **COME BACK** until
  the next day (lap).
- **Let it spread.** Drunk bros party around burning cans and catch fire; burning
  bros run inside and light the house. Sober bros fight fire with extinguishers.
  A couch-burning house has a 15% chance of bringing the fire department.
- **Wreck the Row.** Houses go UNTOUCHED → HARMED → REALLY HARMED → GONE. The
  n-th house destroyed is worth 2,500 × n.
- **Shops** unlock bonus destruction: subwoofers, turkey fryers, raccoons and
  balloon bundles. The apiary's pad opens **Bee Alley**, a short side run behind
  the back yards: grab beehives (ollie for the ones on fence posts) and don't
  stand around — on Easy Street a bro notices after 3 s and chases you out. A
  beehive through a window empties a house, and empty houses rot.
- **Days.** Each lap is a new day; THE DAILY PIPELINE front page reports what you
  did yesterday. Routes (Paperboy's difficulty): **Easy Street** (forgiving, ×1
  points), **Middle Road** (×2), **Hard Way** (×3).
- **Lives.** Three crew skaters. When one is onboarded, the next frees the zombie
  and tows them to the ambulance, then plays a **10× bonus round**: ten passes,
  ten skaters, ten camera angles.

All five starting looks (pretty to punk) play identically.

## Private local song

The game fetches `public/audio/fratty-pipeline.mp3` at runtime. MP3 files are
ignored by Git. **Do not publish the recording without separate authorization.**
Vite copies public files into a local build, so a build containing the recording
must not be deployed without that authorization either.

```sh
bash scripts/import-song.sh
npm run check:song
```

The authored clock is **183.96 BPM, 0.32616 s/beat, first beat 0.305 s**; the
subwoofer thumps on it. The run plays the full song once; after that the music
is a ColecoVision-style chip EDM re-arrangement of the song, derived in the
browser at runtime from the local file (never stored or committed). Skate school
loops the song's instrumental intro (everything before the first verse; the range
is `loops.tutorial` in the beatmap). If the file is absent the title says **SONG
FILE MISSING**; gameplay and synthesized SFX still work, with no substitute song.
`?metronome=1` adds a click on every beat.

## Anonymous admission

Twenty active leases share one FIFO queue. This is admission to single-player
runs, not multiplayer synchronization or unique-person identification.

- POST `/api/queue/join`, `/heartbeat`, `/leave` manage anonymous, memory-only tokens.
- GET `/api/queue/status` returns only activeCount, waitingCount and capacity,
  with `Cache-Control: max-age=5`. It does not renew leases or mutate the queue.
- The live player count is shown on every screen.
- Inactivity releases a slot after two minutes; a 20-minute cap warns a minute early.
- A place in line is held for ten minutes without heartbeats.
- The production Worker routes every request through the same singleton Durable Object.

## Verification

```sh
npm test                          # rules, admission, client and a 6-seed bot gauntlet
npm run build                     # song warning, Vite build, built-copy lint
npm run gauntlet                  # 100 hold-out seeds per bot policy with balance gates
node .claude/skills/game-playtest-loop/scripts/luminance.mjs shot.png   # brightness
```

Bots (`scripts/bots/policies.mjs`) see only `perceive()` from `src/layout.js` —
the same projection as the renderer — and act only through player inputs:
`idle` and `masher` must lose to deliberate play, `brake` must be captured,
`skilled` must clear the Row. `tests/qa.html` renders a busy scene at three sizes
and reports brightness and errors; `tests/record.html` with
`.claude/skills/game-playtest-loop/scripts/record.mjs` records a frame-perfect
60 fps gameplay video. In development,
`?scene=fire|wreck|bonus|rescue|shop|win|lap|training&n=0-8|alley|newspaper|trick|grind|flow`
jumps to a QA scene (`&campus=yale`, `&route=hard` pick the setting) and `?debug=1`
draws hitboxes; neither exists in production builds. `npm run gauntlet -- --route=hard`
runs the balance gates on another route.

## Code map

- `src/sim/`: seeded 60 Hz simulation — street ring and hazards (`row.js`,
  `street.js`), skating, air and tricks (`player.js`), grinds (`rails.js`), combos
  and FLOW (`combo.js`), throws and items (`throw.js`), houses, bros and fire
  (`house.js`), horde, capture and rescue (`crew.js`), the 10× bonus (`bonus.js`),
  skate school (`training.js`), Bee Alley (`alley.js`), the newspaper (`news.js`)
  and the phase machine (`game.js`).
- `src/data/`: tuning and routes, campuses and fictional chapters, houses and
  shops, looks and bonus skaters, copy (thought bubbles and keycaps), beatmap.
- `src/layout.js`: shared projection and `perceive()` for bots.
- `src/render/`: Canvas 2D at device resolution — palette, backdrop (layered
  ridges, campus landmarks), facades, characters and trick poses, props, effects,
  HUD (combo, FLOW, skate school, Bee Alley), thought bubbles, the newspaper,
  bonus cameras and the orchestrating renderer.
- `src/main.js`, `controls.js`, `session.js`, `audio.js`: loop, input, leases, sound.
- `server/`, `worker/`: shared admission rules and HTTP handling.
- `.claude/skills/`: project skills for game feel, art direction, systems design
  and the playtest loop.

`js/`, `design_handoff_fratty_pipeline/` and `docs/GAME_DESIGN_REVIEW.md` are
legacy references from earlier iterations and are not loaded by the game.
Commit, push, merge and deployment require separate user authorization.
