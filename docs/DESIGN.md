# PIPELINE — v5 design ("Easy Street")

**Paperboy's route, Alto's flow, OlliOlli's tricks.** Pick an Ivy League campus,
skate its Greek Row, sink flaming bottles into frat trash cans and let the chaos
spread house to house. Easy to start, deep to master. Stop rolling and the
Pipeline — a beige horde of quarter-zip recruiters — turns you into a zombie.

Look: a 1988 arcade cabinet repainted in 2026, with Alto's Adventure skies:
layered hazy silhouettes, soft light, gradient time of day
(`.claude/skills/retro-modern-art-direction`). Big readable hero, calm camera.

## Owner rules (each has a test)

1. **Skating is the core.** You kick to go, glide, drag a foot or powerslide to
   slow down, carve, ollie, backflip, flip and grind. The camera only scrolls forward.
2. **Throw flaming bottles into trash cans.** Hold **T** to light the rag and aim,
   release to throw. A bottle outside the can is a **miss**: the lid slams on and
   the house is marked **COME BACK** until the next day.
3. **No standing still.** The Pipeline follows. Stand still too long (about 3–4 s
   on Easy Street) or crash too often and it captures you; you become a zombie.
4. **Rescue before the next skater plays**, then the **10× bonus**: ten passes,
   ten skaters, ten points of view. Then the run resumes.
5. **Fire spreads** from burning cans to bros (drunk bros more readily, and they
   fumble extinguishers) and from burning bros into their houses.
6. **Fire department:** exactly 15% per new house fire at couch-burning houses.
7. **Four destruction states** and **escalating points** (`2,500 × n` for the
   n-th house destroyed).
8. **Five shop methods**, including bees. Beehives come from a **side run**:
   Bee Alley. Bees through a window empty a house; empty houses rot.
9. **Training course first**, with big hero thought bubbles, while the song's
   instrumental intro (before the first verse) loops underneath.
10. **Easy and fun by default** (Easy Street).
11. **Ivy League campus picker.** Real school names as settings; every chapter is
    fictional. Real fraternities are never used (see "Campuses").

## Difficulty (Paperboy)

| | Easy Street (default) | Middle Road | Hard Way |
| --- | --- | --- | --- |
| Points | ×1 | ×2 | ×3 |
| Pipeline speed | 2.6 m/s (+0.2/day, max 4.4) | 3.4 (+0.3, max 5.0) | 3.9 (+0.35, max 5.6) |
| Crash lunge | 2 m | 3 m | 3.5 m |
| Bee Alley bros notice you after standing still | 3 s | 2 s | 1.2 s |
| Can opening (with aim assist) | 0.75 m (1.0 m) | 0.6 (0.85) | 0.5 (0.7) |
| Street hazards | 60% | 100% | 130% |
| House-fire damage · extinguisher skill | ×1.35 · ×0.6 | ×1 · ×1 | ×0.9 · ×1.15 |
| Backflip self-righting | 8 rad/s | 6 rad/s | 4.5 rad/s |

The fire knobs scale everyone equally, so drunk bros stay far worse with
extinguishers than sober ones on every route, and the fire department stays at
exactly 15%.

## Skating (keyboard; gamepad and touch mirror it)

| Key | On the ground | In the air |
| --- | --- | --- |
| → hold | **kick-push**: a visible kick every 0.5 s, +1.15 m/s each, up to cruise 7.5 | — |
| (none) | **glide**: the board keeps rolling (never below 4.8 m/s on its own) | — |
| ← hold | drag a foot (−4 m/s²); **powerslide** above 5 m/s (−7 m/s², sparks) | — |
| ↑ ↓ | carve lanes | tap: kickflip (↑), heelflip (↓); → 360 flip, ← shove-it |
| Space | tap: **ollie** | **hold: backflip** (Alto). Let go and the skater spots the landing, righting to the nearest upright (fast on Easy Street). A held flat-ground ollie is exactly one backflip; off a ramp, let go near upright |
| Shift | power kick (+2.6 m/s, max 10.5, 0.6 s cooldown) | hold: grab |
| T (or F/J) | hold: light the rag and aim; release: throw | air ×1.5, grind ×1.5, mid-trick ×2 |
| Q | switch item | |

- **Landing:** within 30° of upright is clean; within 60° is **sketchy** (−30%
  speed, combo keeps going); worse, or mid-flip, is a **bail** (wipeout). While
  shielded (just up, rescue, continue) a bail is a sketchy landing that loses the
  trick and the combo instead.
- **Perfect pop:** ollie again within 0.12 s of a clean landing → PERFECT (+0.6 m/s).
- **Revert:** powerslide within 0.3 s of a clean landing keeps a combo alive.
- **Grinds** happen automatically when you come down onto a curb, bench or rail.
  They hold your speed and score over time; Space pops off, ↑/↓ hops off.
- **Grace:** jump buffer 0.1 s (Space just before touchdown pops PERFECT on
  landing), coyote time 0.1 s at rail ends, falling gravity ×1.3 for snappy
  landings.
- **Stumbles vs wipeouts:** cones, potholes, gnomes and rails, ledges or benches
  hit head-on make you **stumble** (−35% speed, combo lost); brushing the side of
  a long thing just nudges you off it. Kegs, golf carts and fire trucks are
  **wipeouts** (0.9 s down, mash Shift to get up; the Pipeline lunges).
- **Grindables glow** cyan while you're in the air above them.

### Combo and FLOW (Tony Hawk + Alto)

Every trick, grind, backflip, perfect pop and revert extends the combo. A combo
banks 1 s after a clean landing: `points × distinct tricks` (max ×8); repeats in
one combo are worth half. Banked points fill **FLOW**. Full FLOW gives 8 s of
**shield** (smash through hazards), +1.5 m/s top speed and ×2 can points.
Combos of 3+ tricks also return a bottle.

Trick values: backflip 400 each · 360 flip 300 · kickflip / heelflip 150 ·
shove-it 100 · grab 150/s · grind 100 + 120/s · big air 100 · gap 200 ·
perfect 50 · revert 50.

## Throwing (the Molotov tutorial answer)

Holding T flicks a lighter: the rag catches at once, and the reticle shows where
the bottle will land. The bottle flies about half a second, so release **before**
you reach the can — earlier the faster you go. Green ring + **LOCK** means it
goes in. Bottles never hit people.

## Training Course (first)

A Paperboy-style course on the campus quad before the run (about 45 s, skippable
with Enter / SKIP; it switches itself off once finished, and the title has a
toggle). Unlimited bottles, no Pipeline, a gentle speed floor. Nine stations,
each with a big hero thought bubble that shows the keys of the device in use:

1. **Kick to go** (hold →, reach 7 m/s).
2. **Glide** (let go for 1.2 s).
3. **Slow down** (hold ← to drag a foot; powerslide at speed).
4. **Ollie** the cones (tap Space).
5. **Light & throw** in a slow zone (3.6 m/s): light all three practice cans
   (hold T, release on LOCK), 22 m apart. The bubble stays up until the third.
6. **Backflip** off the ramp (hold Space in the air, let go near upright).
7. **Grind** the rail (come down onto it).
8. **Flip tricks** off a ramp (tap an arrow in the air).
9. **Never stop**: the Pipeline lesson, then the gate to Greek Row.

A station repeats twice at most, then moves on. Then "DROP IN!" and the song
starts. The trainer bot must clear it with no retries (a test).

## Bee Alley (side run)

Rolling through the BUZZ OFF APIARY pad opens a gate into Bee Alley: an 84 m
back path behind the frat yards with six hives (two up on fence posts: ollie to
grab; the second leads onto a ledge for a grind). You carry up to three; extra
hives are honey (points). Bros in their back yards notice you if you stand still
for the route's notice time (a ? then ! over the fence); then you're chased out
with what you have. The Pipeline waits on the Row. Coming out, a thought bubble
explains beehives: through a **window** → everybody out → the empty house **rots**.

## Days (Paperboy)

Each lap is a day, MONDAY to SUNDAY, then a new week. A new day opens with
**THE DAILY PIPELINE** front page (headline from yesterday's chaos and the Row
stats) for 2.6 s (Space, T or Enter skips it after 0.4 s). Each day advances time of day (never
dark), speeds up the Pipeline, regenerates hazards, reopens cans and restocks
shops.

## Campuses

Brown, Columbia, Cornell, Dartmouth, Harvard, Penn, Princeton and Yale, each
with its colors, a landmark on the skyline, its architecture and twelve
**fictional** chapters. Chapter letters are English words spelled in Greek
letters and are checked against a list of real organizations. The title screen
says: *Satire. Fictional chapters. Not affiliated with or endorsed by any
university.* Real
fraternities are never named: the game depicts setting their members and houses
on fire, so naming real ones would target real people.

## Music

The local song (never committed) plays once in full when the run starts. After
that, a **Coleco EDM version** — built on your device from that file: square
lead, bass and arpeggios plus noise drums on the song's own beat grid — loops in
the background. Skate school loops the song's own instrumental intro, the part
before the first verse (owner's change; bar-aligned range in `loops.tutorial`).
Without the song: SFX only, and the title says so.

## Unchanged from v4

The Row ring (12 lots, 5 shops), fire system rules (numbers now scale by route),
shop items other than how beehives are found, FD rule, rescue and 10× bonus,
scoring table, continues and 1CC, admission queue. Balance tables live in `docs/v4/balance.md` and
`docs/v5/balance.md`.

## Engineering contract

Seeded, audio-independent 60 Hz simulation in `src/sim/`; events drive render
and audio. `src/layout.js` is the shared projection and `perceive()` for bots.
Rendering is Canvas 2D at device pixel ratio with no runtime libraries or
external art.
