# v4 balance (2026-10-05)

`npm run gauntlet` — 100 hold-out seeds (1001–1100) per policy, 15-minute cap,
real simulation, bots limited to `perceive()` and player inputs.

| Policy | Win | Houses gone | Score | Minutes | Frats lit | Misses | Captures | First capture | Bonus hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| idle | 0% | 0.0 | 0 | 13.5 | 0 | 0 | 1.57 | 94.6 s | 0 |
| brake | 0% | 0.0 | 0 | 0.5 | 0 | 0 | 3.00 | 5.0 s | 0 |
| masher | 0% | 1.7 | 3,721 | 15.0 | 7.7 | 90.1 | 8.92 | 211.6 s | 0 |
| novice | 6% | 10.4 | 168,046 | 14.8 | 41.8 | 20.7 | 1.99 | 440.8 s | 16.0 |
| skilled | 100% | 12.0 | 267,839 | 3.6 | 24.3 | 0.4 | 0.05 | 210.5 s | 0.5 |

Gates (all pass): braking is caught within 8 s; idling never wins or destroys a
house; mashing scores under 35% of skilled and does not win; skilled wins ≥ 60%
of runs in 3–11 minutes; novices destroy ≥ 2 houses and score below skilled.

Tuning history for this table:
1. Horde 2.8 m/s: nobody but idle/brake was ever caught; rescues and bonus rounds never happened.
2. Horde 3.6 m/s (+0.3/lap, max 5.4): still no captures for players who pump.
3. Wipeouts let the recruiters lunge 3 m and the buffer is 10 m; novices now ease
   off to line up throws (as people do). Novices meet the Pipeline about twice a
   run and play about two bonus rounds; skilled play rarely does.
4. A free bottle trickles in every 8 s while you hold fewer than 3, so nobody is
   ever stuck with nothing to throw (table above is after this change).

Bots are diagnostics, not human playtests. Physical-phone play has not been measured.
