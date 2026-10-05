# PIPELINE

Use the Codex inspect → scoped implementation → tests → browser QA → diff review
loop. The active application is Vite + plain ESM + Canvas 2D. `src/main.js`
imports `renderer-flat.js`, which delegates to `src/render/`. Simulation lives in
`src/sim/`; `src/model.js` is its public entry point. `js/` and
`design_handoff_fratty_pipeline/` are legacy references, not loaded game code.

- Keep the 60 Hz input queue, seeded simulation, audio-independent model, shared
  `src/layout.js` projection and 30/60/120 Hz event parity. Never tune cosmetic stats.
- `npm run dev` starts admission and frontend. Preserve the production Durable
  Object singleton. Public GET status exposes counts only; heartbeats own leases.
- Preserve the no-account, no-Spotify contract. MP3 files are private, optional and
  Git-ignored. Missing song means honest missing-file copy, visual beat and SFX.
  Building copies local public assets; deployment needs separate recording authorization.
- Movement is player-paced with arena locks. Throws require press/hold/release.
  OLLIE clears LOW, PUSH counters MID, carving avoids HIGH. Bottles hit lawns only.
  Coffee requires rolling through the stand on the ground. Every threat needs a tell.
- Twelve fictional houses, three lives, cosmetic comebacks and full Riot; no
  comeback damage multiplier. The Pipeline overwrites the player's chosen look.
- Verify `npm test`, `npm run build`, `node scripts/bot-gauntlet.mjs`, full
  `npm run gauntlet`, desktop/portrait/landscape browser behavior and changed server
  lifecycle. Frozen `scripts/bots/degenerate.mjs` must not be edited after tuning.
- Respect unrelated local work and other sessions' servers. Publish/deploy only
  when authorized. Report local, committed, pushed, deployed and live-verified separately.
