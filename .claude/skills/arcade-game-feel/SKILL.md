---
name: arcade-game-feel
description: Game-feel ("juice") craft for 2D action and arcade games on Canvas 2D — hit-stop, trauma screen shake, squash and stretch, anticipation and follow-through, easing, particles, camera look-ahead, input buffering, coyote time, layered SFX and readable feedback. Use this whenever you build, tune, or review how a game action FEELS — throws, jumps, impacts, pickups, deaths, menus, score popups — or when a playtester says a game feels floaty, stiff, mushy, unresponsive, unfair, boring, or "unplayable", even if they never say "juice" or "game feel".
---

# Arcade game feel

Feel is the conversation between a press and the screen. A player forgives
almost anything except an action that seems ignored, late, or unfair. Every
verb needs an immediate acknowledgement (same frame), a readable result
(within ~100 ms) and a payoff proportional to its importance.

## Keep the simulation honest

Feel lives in presentation. The simulation is seeded and fixed-step (60 Hz),
so it must not read the wall clock, the renderer, `Math.random()` or audio
state. The sim emits events (`{type, x, z, ...}`); the renderer and audio map
events to feedback recipes. That separation is what lets bots, tests and 30/60/120 Hz
displays agree about what happened.

Two exceptions are allowed because they change timing deterministically:
**hit-stop** (freeze the sim a few ticks on big impacts) and **slow-motion**
(scale `dt` for a bounded window). Both are driven by sim events, never by
frame rate.

## Feedback recipe table

Design each verb as a row before writing code. A good row has 3–5 layers.

| Moment | Same frame | Next 100 ms | Payoff |
| --- | --- | --- | --- |
| Press throw | arm cocks (anticipation pose), reticle appears | reticle eases to landing spot | — |
| Release | arm whip + smear, bottle spawns with trail, whoosh | camera nudges 2 px toward throw | — |
| Hit target | 3–5 tick hit-stop, white flash on target, burst | +score popup rises, crowd "ooh" | target state changes visibly |
| Miss | dull thud, dust puff, small grey stamp | target shows "come back" marker | none — keep misses quiet, not punishing |
| Big destruction | 6–8 tick hit-stop, trauma 0.6, slow-mo 0.5 s | debris, smoke column, banner | escalating points, music sting |
| Danger rising | heartbeat SFX, edge vignette pulse | antagonist visibly closer | — |
| Failure | freeze 10 ticks, desaturate world (not darken), sting | clear text of WHY | immediate path forward |

Rules of thumb that hold up in playtests:

- **Acknowledge on press, act on release.** Hold-to-aim actions must show the
  hold (pose, reticle, charge ring) on the first frame.
- **Proportion.** Small events get small feedback. If everything shakes, nothing
  matters. Reserve shake for impacts that change game state.
- **Never punish what wasn't shown.** Every threat needs a tell of at least
  ~0.5 s with a consistent color and sound.
- **Misses should be legible, not loud.** The player must know where the throw
  went and why it missed; they should not feel scolded.

## Motion vocabulary (Canvas 2D)

- **Anticipation → action → follow-through**: wind-up 80–120 ms, action 1–3
  frames with a smear, settle 150–250 ms with overshoot.
- **Squash & stretch**: preserve area. On landing `sx = 1 + k, sy = 1 - k` with
  `k` decaying over ~120 ms; on takeoff stretch vertically.
- **Secondary motion**: hair, scarves, bags and flames lag their parent with a
  damped spring; this is what makes a character feel alive at rest.
- **Easing**: UI pops use `easeOutBack`; camera uses a critically damped spring;
  fades use `easeOutCubic`. Linear motion reads as mechanical.

```js
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeOutBack = (t, s = 1.7) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
// Critically damped spring toward target; stable for any dt.
export function spring(state, target, omega, dt) {
  const x = state.x - target, e = Math.exp(-omega * dt);
  const v = state.v;
  state.x = target + (x + (v + omega * x) * dt) * e;
  state.v = (v - omega * (v + omega * x) * dt) * e;
}
```

## Camera

- Follow with a spring; lead in the direction of travel by
  `lead = clamp(speed * 0.35, 0, maxLead)` so the player sees what is coming.
- Trauma shake: add trauma (0..1) on events, decay ~1.6/s, offset =
  `maxOffset * trauma²` sampled from smooth noise (sum of sines), plus a tiny
  rotation. Squaring makes small trauma nearly invisible and big trauma punchy.
- HUD never inherits shake. Reduced-motion setting scales shake to 0–20% and
  replaces full-screen flashes with a border pulse.
- Dynamic zoom: zoom out slightly at high speed, punch in briefly on big
  moments. Keep gameplay-visible distance above the fairness minimum.

## Particles

- Preallocate a pool with a hard cap (desktop ~400, touch ~180). Reuse dead
  particles; never allocate in the hot loop.
- Fire and glow use `globalCompositeOperation = 'lighter'`; smoke uses normal
  blending with light lavender-grey, never black, so bright scenes stay bright.
- Give debris gravity and one bounce; give embers upward drift and flicker.
- Sort only what needs sorting; draw particles in two batches (normal, additive).

## Input forgiveness

- Buffer presses ~100 ms (a press slightly early still counts).
- Coyote time ~80 ms (jumping just after leaving a ledge still works).
- Hitboxes favor the player: hazards slightly smaller than their art, pickups
  and targets slightly larger. Show aim assist visibly (snap the reticle),
  never secretly.
- Make the fail state about a decision the player understood, not a frame
  they missed.

## Audio layering

- Each important SFX = transient (click/noise burst) + body (tone) + tail.
- Randomize pitch ±5–8% per play to avoid machine-gun repetition.
- Duck the music −4 to −8 dB for 300–600 ms under big events; quantize
  celebratory stingers to the next beat when a music clock exists.
- Cap simultaneous voices; drop the quietest, not the newest.

## Review checklist

1. Press every button with eyes closed: can you hear each one is different?
2. Watch a 10-second clip muted: can you tell hits from misses, danger from safety?
3. Does any event produce zero feedback? Does anything constantly shake/flash?
4. Is there a visible tell for every way to fail? How long is it?
5. Does feel survive 30, 60 and 120 Hz, touch, gamepad and reduced motion?

## Skate feel

For skating, tricks, grinds, combos or tutorials, read
`references/skate-feel.md`: what PIPELINE took from Paperboy, Alto's Adventure,
Tony Hawk, OlliOlli, Canabalt and the GMTK platformer toolkit, the rules that came
out of playtests (a tap never spins, flat-ground holds are one clean backflip,
long things are walls from the side), and the sources.
