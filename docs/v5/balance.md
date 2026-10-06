# v5 balance ("Easy Street")

`node scripts/gauntlet.mjs --seeds=40 --offset=1001 --route=<easy|medium|hard>`:
40 hold-out seeds (1001–1040) per bot policy per route, 15-minute cap (brake: 1
minute). Bots see only `perceive()` and act only through player inputs; skate
school is off for the gauntlet (it has its own test: the trainer bot clears all
eight lessons with no retries in about 42 s).

## Results

| Route | Bot | Win | Houses gone | Score | Minutes | Captures | First capture |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy Street | idle | 0% | 0.0 | 850 | 15.0 | 1.00 | 540 s |
| | brake | 0% | 0.0 | 0 | 0.6 | 3.00 | **6.5 s** |
| | masher | 0% | 3.0 | 28,555 | 15.0 | 2.05 | 484 s |
| | novice | **73%** | 11.7 | 258,602 | 11.8 | 0.07 | 689 s |
| | skilled | **100%** | 12.0 | 279,821 | **4.0** | 0.00 | — |
| Middle Road | idle | 0% | 0.0 | 1,708 | 15.0 | 1.00 | 161 s |
| | brake | 0% | 0.0 | 0 | 0.5 | 3.00 | 5.5 s |
| | masher | 0% | 1.6 | 8,131 | 15.0 | 11.18 | 148 s |
| | novice | 8% | 10.3 | 270,058 | 14.8 | 2.75 | 328 s |
| | skilled | 100% | 12.0 | 556,044 | 4.5 | 0.13 | 257 s |
| Hard Way | idle | 0% | 0.0 | 2,610 | 15.0 | 1.00 | 92 s |
| | brake | 0% | 0.0 | 0 | 0.5 | 3.00 | 5.1 s |
| | masher | 0% | 1.1 | 8,262 | 15.0 | 17.52 | 88 s |
| | novice | 0% | 8.4 | 109,401 | 15.0 | 8.55 | 148 s |
| | skilled | 100% | 12.0 | 877,257 | 5.5 | 0.93 | 212 s |

Scores include the route multiplier (×1, ×2, ×3). All gates pass on all three
routes: braking is caught within 8 s, idling never wins or destroys a house,
mashing scores under 35% of skilled play and never wins, skilled clears the Row
in 3–11 minutes, novices never outscore skilled play and destroy at least two
houses.

## What changed and why

- **Easy Street fire knobs.** First pass: Easy and Middle novices won 10% and 8%,
  barely different, and Easy is the default the owner asked to be "easy and fun".
  Easy Street now does ×1.35 house-fire damage and gives everyone ×0.6
  extinguisher skill (Hard Way: ×0.9 and ×1.15). Novice wins on Easy went 10% →
  73% with skilled play still finishing in about 4 minutes. Drunk bros remain far
  worse than sober ones on every route (tested), and the fire department is still
  exactly 15%.
- **Bee Alley in the bots.** Bots now steer for hives and ollie for the high
  ones; before that the skilled bot timed out with 10–11 houses because it never
  got bees for the sober chapters.
- **Side-swipes.** 68 of ~80 skilled-bot stumbles came from carving into the side
  of the alley ledge. Long objects now only trip you head-on; from the side they
  nudge you off. Skilled stumbles: ~26 per run → under 2.
- **Over-cap hives are honey.** Six hives, carry three; the rest score points.
- **Camera.** The view is 26 m wide (was 34); bots perceive through the same
  projection and still pass.

## Notes

- The Easy idle bot survives about nine minutes because gliding never stops on
  its own; it never wins or destroys a house, which is what the gate protects.
- Middle Road is the old "real Row": numbers there match the pre-knob run.
- Re-run after any change to `TUNING`, `DIFFICULTY`, hazards, the horde or bots,
  and update this table.

## After the review fixes (2026-10-06)

A read-only review of all v5 code confirmed 48 findings (each reproduced by a
skeptical verifier); all are fixed with regression tests (97 tests). The input
fix matters for balance: a Space tap no longer leaves "held" set during the
input buffer, so mashed or early taps stop causing accidental backflip spins.

Easy Street, 20 hold-out seeds (1001–1020), all gates PASS:

| Bot | Win | Houses gone | Score | Minutes | Captures |
| --- | --- | --- | --- | --- | --- |
| idle | 0% | 0.0 | 835 | 15.0 | 1.00 |
| brake | 0% | 0.0 | 0 | 0.6 | 3.00 (first at 6.5 s) |
| masher | 0% | 3.0 | 36,578 | 15.0 | 0.05 |
| novice | 80% | 11.8 | 260,615 | 11.5 | 0.05 |
| skilled | 100% | 12.0 | 281,068 | 3.9 | 0.00 |

The masher is almost never caught on Easy Street now (it used to crash itself
into captures with accidental spins); it still never wins and scores 13% of
skilled play. Middle Road and Hard Way still catch it (about 4 and 10 times per
run in the integration check).
