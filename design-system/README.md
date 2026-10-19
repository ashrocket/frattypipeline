# PIPELINE design system

PIPELINE is a free single-player browser arcade game. The player skates Greek Row, sinks flaming bottles into frat trash cans and keeps rolling. It runs on Vite, plain ESM and Canvas 2D, with a Cloudflare Worker for a live player queue. The landing page is the title screen. It shows the PIPELINE wordmark, a starting-look picker, campus and route choices, a training toggle and the live player count, and it ends with the DROP IN button that starts a run.

The game is satire. It names real campuses only as settings.

## Voice

1. Use short, loud lines. Real line: "Burn the status quo." (src/data/strings.js:23)
2. Use the action word on the button. Real line: "DROP IN" (src/data/strings.js:27)
3. Mock the job market, do not name real people. Real line: "NO ACCOUNT · NO BIDS · NO STOPPING · THE PIPELINE IS HIRING. DON’T APPLY." (src/data/strings.js:49)
4. Use plain sentences with a verb. Real line: "Skate Greek Row. Sink flaming bottles into frat trash cans and let the chaos spread house to house." (src/data/strings.js:25-26)
5. Keep choices to one line. Real line: "Pretty to punk. Every look skates the same." (src/data/strings.js:29)

## Colour

Tokens are in `tokens.json` and compile to `tokens.css`. The values below are exact.

| Token | Value | Role | Contrast |
|---|---|---|---|
| `ink` | #2a1e4f | Text, logo outline, borders, offset shadows | 15.03 to 1 on `paper` |
| `ink-soft` | #4a3d7a | Secondary text | 9.38 to 1 on `paper` |
| `paper` | #ffffff | Card and button surface | ground |
| `pink` | #ff3ea5 | Accent: eyebrow, top bar shadow, ticker | 3.24 to 1 on `paper` (fails 4.5 to 1 for text under 24px) |
| `sky` | #4fc3ff | Page gradient top, theme colour | ground |
| `sky-pale` | #ddf8ff | Page gradient bottom | ground |
| `sun` | #ffd23f | Highlight fill | ink on sun 10.41 to 1 |
| `sun-light` | #ffe27a | Primary button gradient start | ink on sun-light 11.75 to 1 |
| `tangerine` | #ff8a3d | Primary button gradient end | ink on tangerine 6.41 to 1 |
| `grape` | #7b4dff | Secondary accent, look-picker shadow, focus outline | paper on grape 4.83 to 1 (not used as text on the title screen) |
| `cyan` | #1fe5ff | Stripe band | decorative |
| `mint` | #3df2a8 | Live status dot | decorative |

Ticker text is `paper` on `pink`. The ratio is 3.24 to 1. It fails 4.5 to 1 at its 14px size. The source uses it as is. Keep it exact in formalize mode. The Hero preview omits the ticker.

Eyebrow text is `pink` on `paper`. The ratio is 3.24 to 1. It fails 4.5 to 1 at its 13px size. The source uses it as is (styles.css:167). Keep it exact in formalize mode. The Hero preview omits the eyebrow.

Other colour tokens (`lav`, `ink-soft` variants, logo gradient stops `logo-aqua` and `logo-coral`, and the translucent `paper-glass`, `paper-wash` and `panel-glass`) are listed in `tokens.json` with their source lines.

## Type

Families are system stacks. The source loads no font file and no Google font.

- `display`: 'Avenir Next Condensed', 'Futura', 'Bahnschrift', 'Roboto Condensed', 'Arial Narrow', Impact, sans-serif (styles.css:15)
- `ui`: 'Avenir Next', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif (styles.css:16)

Scale, from the source:

| Style | Family | Size | Weight | Style | Used for |
|---|---|---|---|---|---|
| wordmark | display | 148px max (clamp 64px to 9.5vw) | 900 | italic | Logo, line-height 0.86 (styles.css:172) |
| tagline | display | 36px max (clamp 22px to 2.6vw) | 900 | italic | Tagline, line-height 1.1 (styles.css:190) |
| brand | display | 28px | 900 | italic | Top bar brand (styles.css:79) |
| cta | display | 22px | 900 | italic | DROP IN button (styles.css:207) |
| picker-title | display | 22px | 900 | italic | Look-picker heading (styles.css:300) |
| option | display | 14px | 800 | italic | Look options (styles.css:309) |
| eyebrow | display | 13px | 800 | italic | Eyebrow line (styles.css:165) |
| street | display | 12px | 800 | italic | GREEK ROW label (styles.css:90) |
| body | ui | 15px / 1.6 | 500 | normal | Description (styles.css:196) |
| button-secondary | ui | 14px | 800 | normal | HOW TO PLAY (styles.css:228) |
| label | ui | 12px | 800 | normal | Player count pill (styles.css:104) |
| chip | ui | 12px | 700 | normal | Key chips (styles.css:247) |
| kbd | ui | 11px | 800 | normal | Key caps (styles.css:58) |

## Layout and spacing

- The title screen is a two-column grid: `minmax(340px, 1.05fr) minmax(300px, 0.8fr)`, gap 4vw, padding 3vh 5vw 64px (styles.css:154-157). Below 960px it becomes one column (styles.css:688-690).
- Copy column max width: 620px (styles.css:162). Description max width: 520px (styles.css:195).
- Look-picker panel: width min(100%, 420px) (styles.css:282).
- Top bar: height 52px, side gutter at least 16px (styles.css:17, 68).
- Spacing steps used: 8, 10, 14, 16, 18, 20, 22, 30, 64px (see `spacing` in `tokens.json`).
- Radius steps: 6px (key cap), 8px (tag), 10px (option), 14px (primary button), 20px (panel), 50% (round icon button), 999px (pill and secondary button).
- Offset shadows are hard, with no blur. Steps used on the title screen: 3px, 6px, 8px. Colours: ink, grape, pink.

## Logo and wordmark

The only logo file is the app icon: `assets/Logos/icon.svg`. It is a copy of `public/icon.svg`. It is a rounded square with a sky-to-pale-pink gradient, an orange flame, and a white-to-coral block with an ink outline and a pink offset. Its title is PIPELINE. See `assets/Logos/README.md`.

The title-screen wordmark is plain type, not an image (styles.css:170-186, index.html:31):

- Family: display stack, italic, weight 900.
- Case: upper case. Two spans, PIPE and LINE, with no space between them (index.html:31).
- Size: clamp(64px, 9.5vw, 148px), line-height 0.86, letter-spacing -1px.
- Rotation: -4deg, origin left centre.
- Fill: a vertical gradient from `#fff` to `logo-aqua`, `ink-soft`, `logo-coral` and `sun-light` (styles.css:176).
- Outline: 3px `ink` text stroke (styles.css:180).
- Shadow: drop shadow 6px 7px 0 `pink` (styles.css:181).

Not defined in the source: clear space, minimum size and alternate colourways. Do not invent them in a new use. Use the real file or the wordmark as written.

## Landing page anatomy

The title screen (`#title-screen`, index.html:28) has these parts, in order:

1. Top bar: brand text PIPELINE, street label GREEK ROW, player-count pill, sound icon button (index.html:18-22). The pause button carries the hidden attribute (index.html:23).
2. Eyebrow: "THREE SKATERS · ONE ROW · ZERO BIDS ACCEPTED" (src/data/strings.js:24). Uses `eyebrow`, `pink`. The Hero preview omits it.
3. Wordmark: PIPELINE. Uses `wordmark`, `ink`, `pink` shadow.
4. Tagline: "Burn the status quo." Uses `tagline`, `ink`.
5. Description. Uses `body`, `ink-soft`.
6. CTA row: DROP IN (`primary`, `cta`, `radius-control`, `shadow-ink-6`) and HOW TO PLAY (`secondary`, `button-secondary`, `radius-pill`, `shadow-ink-3`).
7. Key chips: keyboard controls. Uses `chip`, `kbd`, `ink-soft`.
8. Title meta: player-count pill, best score tag (carries the hidden attribute, index.html:49), track label.
9. Look picker panel (index.html:51): heading, look options, hair and skin swatches, help line, meaning line, campus and route choices, training toggle, disclaimer. Uses `panel-glass`, `radius-panel`, `shadow-grape-8`, and the repeating stripe at the top edge (pink, sun, cyan, mint).
10. Ticker (index.html:73): a 40px `pink` band at the bottom edge with scrolling text (styles.css:443-462). The Hero preview omits it.

## Status

formalized
