---
name: arcade-systems-design
description: Systems and rules design for arcade and indie action games — core loops, risk/reward, emergent simulations (fire spread, crowds, AI states), probabilities, scoring curves, lives and continues, bonus stages, difficulty ramps, shops/unlocks and bot-measured balance. Use this whenever you add or change a game rule, mechanic, enemy, weapon, power-up, scoring formula, probability, life system or bonus round, or when a game is "too easy", "too hard", "pointless", "confusing" or has a dominant strategy — even if the request is phrased as a feature list from the owner.
---

# Arcade systems design

An arcade rule set is good when a new player understands the goal in five
seconds, a skilled player still finds decisions after fifty runs, and every
loss teaches something. Owner-specified rules are requirements: implement
them literally first, then make them fun with presentation, tuning and
supporting systems — not by quietly changing them.

## Write the loop before the code

State three nested loops in one line each:

- **Moment (1–3 s):** the verb and its feedback (skate, aim, throw, dodge).
- **Encounter (10–30 s):** what one target/house/room asks of the player.
- **Run (3–10 min):** progression, escalation, the fail state, the ending.

Then list each verb with its **cost**, **risk** and **reward**. A verb with no
cost is spam; a verb with no reward is noise.

## Emergent simulations (fire, crowds, chain reactions)

- Model as local rules between small state machines: `party → curious →
  burning → (inside | rolling | extinguished) → charred`. Each state has an
  entry event, an exit condition, and a visual pose.
- Express chance as a **hazard rate per second** and convert per tick so
  results are frame-rate independent: `p = 1 - Math.exp(-rate * dt)`.
- Use the seeded RNG only, consumed in a fixed order (iterate arrays in a
  stable order). Never consume randomness from rendering.
- Put every number in one tuning table (`src/data/tuning.js`); name it by
  meaning (`igniteRate.drunk`), not by implementation.
- Owner-specified odds (e.g. "15% chance") are exact: roll once per defined
  trigger and emit an event with the roll so tests and the HUD can show it.
- Chain reactions need a ceiling (caps per house, cooldowns) and a readable
  cause → effect delay (0.3–1.5 s) so players can see what they caused.

## Scoring

- Reward the fantasy the owner asked for most (here: setting the chain in
  motion, escalating destruction). Escalation (`n × base` for the n-th big
  event) makes late runs exciting.
- Combos need a visible timer. Multipliers should be shown where the player
  is looking, not only in the HUD corner.
- Points for style (air throws, chains, rescues) let skilled players express
  themselves without changing the win condition.

## Lives, failure and comebacks

- One clear fail condition the player can see coming (a tell ≥ 0.5 s, a
  visible antagonist or meter) beats many hidden ones.
- Make the life transition a playable beat (rescue mission, bonus round)
  rather than a loading screen, but keep it short and skippable after the
  first viewing where the owner allows.
- Continues reset score (arcade honesty) and are counted; a no-continue clear
  earns a badge.

## Bonus stages

Late-80s bonus rounds were short, safe, spectacular and about one skill.
Give each pass a title card, a single input, an obvious target and instant
results; vary the presentation (camera, character) while keeping the input
the same, so novelty never becomes confusion. Tolerance can differ per pass
to keep difficulty even across harder viewpoints.

## Shops and unlocks

- An unlock should open a **new way to solve** the core problem, not a bigger
  number. Each method should interact with the core system differently
  (e.g. bypasses defenders, delivers fire, empties a target, finishes a weak one).
- Introduce one new thing at a time with a one-line card the first time it
  appears; place unlocks along the route so the first run discovers them.

## Difficulty and fairness

- Ramp by lap/stage with named knobs (antagonist speed, hazard density,
  defender competence). Never ramp by making tells shorter than ~0.4 s.
- Check dominant strategies with bots: **do nothing**, **mash one button**,
  **perfect play**. Do-nothing must lose fast and clearly; mashing must score
  far below deliberate play; perfect play must be possible.
- Measure with seeds (≥100 per policy) and report means, not anecdotes.
  Tune numbers, re-run, keep a history in `docs/`.

## Review questions

1. Can a first-time player say what they are trying to do after 10 seconds?
2. What is the most boring winning strategy? Does it lose to skill?
3. Does every owner-specified rule have a test that would fail if it broke?
4. Is every random outcome reproducible from the seed?
5. What does the player learn from losing?
