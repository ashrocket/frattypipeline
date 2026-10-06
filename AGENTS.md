# PIPELINE

Use the inspect → scoped implementation → tests → browser QA → diff review loop.
The active application is Vite + plain ESM + Canvas 2D. `docs/DESIGN.md` is the
source of truth for rules (v5, "Easy Street"). Project skills in `.claude/skills/`
cover game feel, art direction, systems design and the playtest loop.

- Keep the 60 Hz fixed-step simulation, seeded randomness (`seededRandom`), an
  audio-independent model, the shared `src/layout.js` projection and 30/60/120 Hz
  event parity. Rendering and audio only consume simulation events.
- Owner rules are requirements and each has a test in `tests/model.test.js`:
  skating core, can hits and miss → COME BACK next lap, no standing still (the
  Pipeline horde), rescue before the next skater plays, the 10× bonus with ten
  skaters and ten points of view, drunk vs sober bros, the exactly-15% fire
  department for couch-burning houses, burning bros carrying fire inside, four
  destruction states, escalating points per destroyed house, and five shop methods
  (bees empty a house; empty houses rot). v5 rules live in `tests/skate.test.js`:
  kick/glide/slow, Alto backflips that right themselves, flip tricks, grinds,
  stumble vs wipeout, combos and FLOW, skate school (solvable by the trainer bot),
  Bee Alley (3 s to be noticed on Easy Street), days and the newspaper, routes.
- Campuses are real school names used as settings only. Every chapter is fictional;
  never add real fraternities, sororities, clubs or societies, or real letter
  combinations (the campus test rejects them). Keep the disclaimer on the title.
- Bottles never hit people: they land in cans (or windows, lawns, porches, roofs
  for shop items). People catch fire only from burning cans, other burning bros or
  a fryer fireball, and are shown as cartoon soot, never hurt.
- Art direction: bright daylight palette, smooth vector art at device resolution,
  no dark slabs. Mean screen lightness must stay ≥ 0.55 (luminance script).
- Owner directives: the game is named PIPELINE ("Greek Row" only as the street);
  never mention the banned artist reference; the live player count is visible on
  every screen; starting looks range from pretty to punk; THROW is the T key and
  the early lessons are big hero thought bubbles with device-specific keycaps.
- Preserve the no-account, no-Spotify contract. MP3 files are private, optional and
  Git-ignored. Missing song means honest missing-file copy and SFX only. The chip
  EDM version is derived at runtime from the local file only; never write derived
  audio into the repo.
- Balance with `scripts/gauntlet.mjs`; do not tune the `idle`, `brake` or `masher`
  policies to make gates pass. Record tuning tables in `docs/` when they change.
- Verify `npm test`, `npm run build`, `npm run gauntlet`, and browser frames at
  desktop, phone landscape and portrait. Dev-only `?scene=` hooks must stay behind
  `import.meta.env.DEV`.
- Respect unrelated local work and other sessions' servers. Publish/deploy only
  when authorized. Report local, committed, pushed, deployed and live-verified separately.
