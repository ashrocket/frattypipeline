# PIPELINE

A player-paced skateboard arena fighter in a fictional twelve-house Greek Row.
Choose your own look; fight the institution trying to replace it with a uniform.
No account, Spotify connection, external art, or runtime library is required.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The command starts Vite and the local admission server
on port 8797. Override `QUEUE_PORT` when another session owns that port. A static
preview cannot enforce the queue. Never stop another reviewer's development server.

## Play

Move with arrows/WASD, hold **J/F** to charge and release to throw, **K/Space** to
ollie, **L/Shift** to push, and **P/Escape** to pause. On gamepad: left stick/D-pad,
A ollie, X/RT throw, B/RB push, Y super, Start pause. Touch supports a move stick
with a forward flick for PUSH and independent THROW, OLLIE and SUPER touches.

There is no auto-scroll or auto-fire. Read orange telegraphs: carve out of HIGH,
ollie over LOW, push through MID. School the crews to disable lawn sprinklers,
then aim at the house with the landing reticle. Bottles never hit people. A short
charge tosses from the lawn half; 400 ms charges a lob; release high in an ollie
for AIR MAIL. Holding beyond 1.8 seconds wastes a bottle. Beat-timed releases,
bullseyes and counters reward deliberate play. Full Riot unlocks TOUCH GRASS.

Coffee is a ground-level roll-through pickup; vinyl and clean strip tricks also
restore ammunition. All five starting looks have identical mechanics. The
Pipeline overlays tote, quarter-zip, lanyard, blowout and letters. At full meter,
SORORITY RUSH MODE gives way to a louder comeback, full Riot and a shockwave;
comebacks never increase damage. A third transformation offers a timed continue.
A clear with no continues earns 1CC.

## Private local song

The game fetches `public/audio/fratty-pipeline.mp3` at runtime. MP3 files are
ignored by Git. **Do not publish the recording without separate authorization.**
Vite copies public files into a local build, so a build containing the recording
must not be deployed without that authorization either.

```sh
bash scripts/import-song.sh
npm run check:song
```

The importer checks yt-dlp >= 2026.08.19 and uses Node when Deno is absent. Upgrade
with `brew upgrade yt-dlp`, or `pip install -U "yt-dlp[default]"` inside a venv.
The optional argument is an HTTPS source URL. Existing recordings are backed up.

The authored clock is **183.96 BPM, 0.32616 s/beat, first beat 0.305 s**. It loops
beats 8–744 during play; the intro starts each run and the ring-out plays on a win.
`?metronome=1` enables verification clicks. SOUND CHECK measures an eight-tap
median offset, rejects scattered taps, and is available on first start and pause.
Music/SFX volume, offset, mute, reduced motion and Beat Assist are persisted.
Pause and hidden tabs suspend audio; resume includes a four-beat lead-in.

If the file is absent, the title clearly says **SONG FILE MISSING**. Gameplay,
visual beat and SFX still work, with no synthesized substitute song. Builds warn
but succeed without the file; `check:song` fails as a separate presence check.

## Anonymous admission

Twenty active leases share one FIFO queue. This is admission to single-player
runs, not multiplayer synchronization or unique-person identification.

- POST `/api/queue/join`, `/heartbeat`, `/leave` manage anonymous, memory-only tokens.
- GET `/api/queue/status` returns only activeCount, waitingCount and capacity,
  with `Cache-Control: max-age=5`. It does not renew leases or mutate the queue.
- Title/end screens poll status every ten seconds; admitted screens use heartbeats.
- Heartbeats retry after 2/4/8 seconds. Only HTTP 410 or actual lease expiry pauses.
- Inactivity releases a slot after two minutes; a 20-minute cap warns a minute early.
- The production Worker routes every request through the same singleton Durable Object.

## Verification

```sh
npm test                         # unit/regression tests and 30-seed, five-look smoke gate
npm run build                    # song warning, Vite, built-copy lint
node scripts/bot-gauntlet.mjs     # reviewer table: 100 seeds × five looks
npm run gauntlet                  # 200 training + 200 hold-out seeds × five looks
node scripts/baseline-gate.mjs    # demonstrates that baseline hold-throw fails the gate
```

The frozen degenerate policies have a SHA-256 integrity check. Bots use the same
layout/visibility functions as the renderer and only issue player inputs. The
full gate checks win/score/pacing targets, fairness, caps, musical impact timing,
termination and cosmetic parity. `tests/qa.html` provides real-browser 128-pixel
uniform-layer tests, saturated draw-call audits and a 60-second DOM-input run.
Use `?hitboxes=1` for projected base ellipses. Browser evidence belongs in
`docs/iteration-1/`; desktop emulation does not replace physical-device testing.

## Code map

- `src/sim/`: seeded 60 Hz state machine, player, throwing, enemies, houses, beat and input queue.
- `src/data/`: tuning, looks, fictional houses, copy and compact authored beatmap.
- `src/layout.js`: shared pure projection and visible-entity perception.
- `src/render/`: cached scenery, layer-stack sprites, canvas HUD, effects and measured renderer.
- `src/main.js`, `controls.js`, `session.js`: fixed-step loop, DOM/gamepad/touch edges and leases.
- `src/audio.js`: Web Audio clock, song routing, calibration and bounded synthesized SFX.
- `src/model.js`, `renderer-flat.js`: public entry points; the unused Three.js renderer is removed.
- `server/`, `worker/`: shared admission rules and HTTP handling.

`js/` and `design_handoff_fratty_pipeline/` remain legacy reference material and
are not loaded by the game. Commit, push, merge and deployment require separate
user authorization; iteration 1 is intentionally left uncommitted for review.
