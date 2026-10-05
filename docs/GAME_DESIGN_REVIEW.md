# Greek Row: adversarial game-design review

## Review target

Greek Row is a small, single-player skateboard arcade game inside the
`ashrocket/frattypipeline` repository. It is ready for a design review, not a
claim that the balance or physical-phone feel is final. The song importer is
configured for the supplied YouTube recording; the audio file still needs to be
imported by the owner.

The current loop: skate along a fictional Greek Row, carve into and out of street
depth, throw at twelve frat-house lawns, and finish with all houses down. A fixed,
straight-on illustrated view replaces the earlier isometric experiment. Portrait
uses vertical scrolling. Ollies clear obstacles; pushing adds speed; coffee comes
from a grounded pass through a stand's pickup lane. Rush swag and perfume cause
a visible makeover. Coffee and clean ollies undo some of it. Three lives allow
two stronger punk returns before a final loss. The twenty-session FIFO waiting
room admits anonymous tabs; it is not multiplayer or a unique-person counter.

## What the panel should try to disprove

**Thesis:** skating through the row creates enough interesting decisions to make
players voluntarily start another run, even without unlocks, accounts, or a
leaderboard.

Ask each reviewer to name a concrete failure, demonstrate it in a run, explain
which player it hurts, and propose the smallest experiment that could disprove
their criticism. Separate reproducible bugs from taste and from untested ideas.
Do not count a passing test suite as evidence that the game is fun.

## Measured balance baseline

The October 4 build was simulated at 60 ticks/second over seeds 1–100, using
the real model with hazards and pickups enabled and a 180-second ceiling.
Reproduce with `node scripts/balance-probe.mjs`.

| Input policy | Wins | Mean finish | Mean lives left | Mean score |
| --- | --- | --- | --- | --- |
| Hold THROW, no steering | 100/100 | 63.30 seconds | 1.80 | 28,058 |
| Hold THROW + PUSH, no steering | 100/100 | 51.65 seconds | 2.61 | 41,371 |
| Scripted coffee-lane steering and timed ollies | 100/100 | 52.06 seconds | 3.00 | 116,816 |

Skilled routing currently improves score and survival, but completion does not
require it. These controller simulations are balance diagnostics, not human
playtests. The first panel decision should be whether completion must demand
skill, or whether score mastery is the explicit intended challenge.

## Prioritized improvement wishlist

| Priority | Improvement to investigate | Adversarial question | Smallest useful experiment |
| --- | --- | --- | --- |
| P0 | Make steering and timing matter to the objective | Can a player win by holding throw and ignoring skating? Do automatic aiming, scrolling and ammo refill eliminate decisions? | Compare a hold-fire baseline with deliberate play. Try a generous throw window, lawn positioning bonus, and telegraphed blockers individually. Preserve an accessible assist option. |
| P0 | Tune skateboard feel | Can players predict acceleration, carving, ollie clearance, landing and the next push? Does the board feel different from walking? | A short practice strip with cones, one coffee stand and a landing marker; ask players to repeat the same route without instructions. Record misses and causes. |
| P1 | Balance makeover and comeback rewards | Is deliberately losing a life the fastest or highest-scoring strategy because damage rises? Can good players experience the strongest punk form? | Compare intentional transformations, survival, and trick-heavy runs. Trial earned punk upgrades or a survival bonus without removing the comeback fantasy. |
| P1 | Author distinct encounters | Do twelve houses feel like twelve fights, or one fight with larger health bars? | Give each district one signature street pattern; build a final encounter that combines carving, coffee routing, throws and ollies. Avoid adding new controls first. |
| P1 | Teach through the first twenty seconds | Can a new player identify the coffee pickup lane, distinguish swag from collectibles, and explain why the makeover meter changed? | A first-run route that naturally teaches steer → ollie → coffee → throw, with brief event labels and a retry point. Watch users before adding more tutorial text. |
| P1 | Verify physical-phone play | Can thumbs reach three actions while steering? Do HUD panels hide hazards? Does portrait offer fair reaction time? | Test small and large iPhones plus a midrange Android in both orientations. Measure frame pacing, missed taps and control occlusion, then adjust sizes and look-ahead distance. |
| P2 | Give a reason to replay and hear the song again | What improved in the second run? Does the looping track support the rhythm or become tiring? | Add a compact recap of tricks, coffee passes, hits, streaks, time and lives. Trial a fixed-seed challenge; verify the imported song's seam, volume and mute behavior. |
| P2 | Validate the waiting room's value | What benefit justifies making a single-player visitor wait? Do they stay long enough to be admitted? | Retain the requested cap of twenty while measuring waits, abandonments, promotions and reconnects. Improve queue copy and a small practice activity if waits are common. |

## Suggested panel roles

- **Arcade designer:** expose dominant strategies, weak pacing and shallow replay.
- **Skateboard player:** judge momentum, carve control, timing and readability.
- **First-time mobile player:** attempt a run with no coaching and report confusion.
- **Accessibility reviewer:** inspect contrast, motion, touch reach, input remapping
  and whether assistance preserves the fun.
- **Operations reviewer:** test session expiry, interrupted runs and the cost of
  the queue without mistaking anonymous sessions for people.

Discuss whether the makeover reads as punk-versus-conformity satire, and whether
the return celebrates the character's chosen identity clearly. The intended
fantasy is reclaiming punk style and agency.

## Required panel output

Return five ranked changes, each with evidence, expected player benefit, effort,
one falsifiable success criterion, and the feature to remove or simplify to make
room for it. Name one thing to keep exactly as it is. End with a decision:
**ready for a small playtest**, **needs one focused revision**, or **core loop needs
rethinking**. Do not expand the game into accounts, Spotify authentication, or a
multiplayer product without a separate decision.
