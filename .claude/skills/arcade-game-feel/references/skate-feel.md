# Skate feel: lessons from the best keyboard side-scrollers

What PIPELINE borrowed, why, and where it lives. Read this before touching
`src/sim/player.js`, `rails.js`, `combo.js` or the skate-school course.

## The lessons

| Source | Lesson | PIPELINE |
| --- | --- | --- |
| Paperboy (Atari, 1985) | A route choice up front (Easy Street / Middle Road / Hard Way); each day is a lap; a front page between days; a training course before the route; speed is the player's main control. | `DIFFICULTY` in `tuning.js` (×1/×2/×3 points), `news.js`, `training.js`, kick/slow on → / ←. |
| Alto's Adventure | One button: tap to jump, hold in the air to backflip, land upright or crash. Chaining tricks fills a meter that grants a speed burst and a shield that smashes obstacles. Calm, layered, hazy parallax art. | `backflipAfter` / `backflipTime`, the self-righting `rightRate`, FLOW in `combo.js`, `backdrop.js` ridges. |
| Tony Hawk's Pro Skater | Combos multiply by the number of distinct tricks; repeats are worth less; reverts/manuals link combos on the ground; bank or lose it all on a bail. | `addTrick` halves repeats, `comboMultiplier` counts distinct tricks, `comboLink` for PERFECT pops and reverts, `comboFail`. |
| OlliOlli | Landing timing is the skill: a well-timed press on landing is rewarded, a late one is sketchy. Grinds snap when you come down onto a rail. | `perfectWindow` PERFECT pop, sketchy landings (×0.7 speed), `catchRail` snaps from above. |
| Canabalt | Small obstacles should cost speed, not the run; reserve crashes for big, readable hazards. One input carries the whole game. | `SMALL` hazards in `street.js` stumble (×0.65 speed); kegs, carts and trucks wipe out. |
| GMTK Platformer Toolkit | Coyote time and jump buffering make a jump feel like it listened; gravity is stronger on the way down for snappier arcs. | 100 ms input buffer (`input.js`, with later edges of the same action waiting behind), `coyote`, `fallGravity`. |
| Browser skate games (itch.io, dinogame roundup) | Keyboard players expect arrows to move and a single key per verb; tutorials that show the actual key win. | T to throw, arrows for flip tricks, hero thought bubbles with device keycaps (`bubbles.js`, `KEYCAPS`). |

## Rules that came out of playtests

- **A tap never spins.** `backflipAfter` (0.12 s) is longer than a normal key tap,
  and "held" follows the physical key as each edge is queued (`queueInput`), never a
  buffered retry, so a tap waiting in the buffer is already let go when it acts.
  A press made in the air pops on the first grounded tick (no landing lag): a
  PERFECT pop.
- **Holding Space through a flat ollie is exactly one clean backflip.** Air time
  (~0.61 s) minus the hold delay over `backflipTime` (0.5 s) is ~0.99 turns.
  Off a ramp (~0.82 s of air), holding the whole time over-rotates: let go near
  upright. Releasing early rights the rider to the nearest upright at `rightRate`
  (fast on Easy Street), so half-hearted holds are forgiven.
- **Brushing a long thing is a wall, not a trip.** Rails, ledges and benches only
  stumble you head-on; from the side they nudge you off (`sideSwipe`). Without
  this a bot (and a player) carving next to a ledge chained 4+ stumbles per pass.
- **Gliding never stops on its own.** Below roll speed the skater gives a lazy
  kick every 0.9 s; only ← (or standing in place) lets the Pipeline catch you.
- **Make the grindable thing glow while you're above it.** Curbs, benches and
  rails light up cyan when you're airborne nearby; that one cue taught grinding
  better than any text.
- **Teach in the order of need.** Kick → glide → slow → ollie → throw → backflip →
  grind → flip tricks. Each station passes on the verb, retries twice, then moves
  on. The trainer bot must clear it with no retries (`tests/skate.test.js`).

## Sources

- Paperboy: https://en.wikipedia.org/wiki/Paperboy_(video_game) and
  https://www.thumbsticks.com/john-salwitz-making-of-atari-paperboy/
- Alto's Adventure: https://www.hardcoregaming101.net/altos-adventure/ and
  https://www.imore.com/altos-adventure-tips-tricks-and-pointers-get-you-past-triple-backflip-and-more
- Canabalt: https://gamedeveloper.com/design/tuning-canabalt
- GMTK Platformer Toolkit: https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code
- OlliOlli: https://www.destructoid.com/reviews/review-olliolli/ and
  https://www.popmatters.com/184165-olliolli-2495633856.html
- Tony Hawk's Pro Skater (manuals and combos):
  https://www.osftw.com/features/1547/how-the-manual-ruined-tony-hawks-pro-skater and
  https://twinfinite.net/guides/tony-hawk-pro-skater-12-how-to-manual-2020/
- Browser skate games: https://dinogame.gg/blog/best-browser-skateboard-games/ and
  https://scrumpyboi.itch.io/skateboard-wizard
