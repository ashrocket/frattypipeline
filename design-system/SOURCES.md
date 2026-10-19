# Sources

Read for this system (project root `~/ashcode/frattypipeline`). Line numbers are from the files as they stood when read.

| File | What came from it |
|---|---|
| styles.css:1-20 | Root colour tokens (`--ink`, `--paper`, `--pink`, `--sun`, `--grape`, `--sky`, and others), display and UI font stacks, `--bar`, body gradient start |
| styles.css:22-160 | Reset, focus outline (47), kbd (57-63), top bar (67-77), brand (78-82), street, pill, icon button, stage, title screen grid and padding (150-160) |
| styles.css:161-300 | Hero copy, eyebrow, wordmark (170-181), tagline, description, CTA buttons, key chips, title meta, best tag, look picker and stripe, picker title, look options |
| styles.css:443-462 | Title ticker band and text (pink fill, paper text) |
| styles.css:536, 622, 655 | Usage check for `--lav` and `--cyan` |
| styles.css:687-760 | Media queries located at 687, 702, 723, 755. Only the 960px rule was read (688-690, 734-735) |
| index.html:1-103 | Title screen markup and copy hooks (`#title-screen` at 28, wordmark at 31, look picker at 51, ticker at 73), `theme-color` (6), title (11), icon link (12) |
| src/data/strings.js:1-50 | Copy: brand, tagline (23), eyebrow (24), description (25-26), start (27), look (28), lookHelp (29), prettyMeaning (30), titleTicker (49) |
| public/icon.svg | Copied to `assets/Logos/icon.svg` with `cp`. Used for colour values in the logo description (stop colours 4FC3FF, FFE6F3, 8EEBFF, 4A3D7A, FF7A3D, FFE27A, FF8A3D, FF3EA5, 2A1E4F) |

Not read for this system:

- `design_handoff_fratty_pipeline/` (older handoff, different palette and fonts). Not used. Its values conflict with the live code, so the live code wins.
- `docs/DESIGN.md`, `docs/GAME_DESIGN_REVIEW.md`, `README.md`, `AGENTS.md`. Not read. The profile lists them as existing design notes.
- `src/render/*`, `js/game.js`, and other game code. Not read. The values they use are game art, not the title screen.
- `public/audio/fratty-pipeline.mp3`. Private recording. Not read or copied.
- `FrattyPipeline.zip`, `.env`, credentials. Not read or copied.

Evidence:

- Profile: `~/ashcode/design-systems/profiles/frattypipeline.json`
- Digest: `~/ashcode/design-systems/evidence/frattypipeline.json` (read through `digest.py`)
