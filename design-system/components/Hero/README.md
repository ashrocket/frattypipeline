The PIPELINE title screen: top bar, wordmark, tagline, description, DROP IN and HOW TO PLAY buttons, key chips and look picker, as on the live landing page. The eyebrow and the ticker are left out (see "What the preview omits").

## When to use

Use it as the first screen of the PIPELINE landing page, or as the reference for any screen that starts a PIPELINE run.

## What the consumer supplies

- The look names, the campus and route option lists, and the training toggle state. The preview shows only the look names. It omits the campus and route lists, because the live source fills them from game data (src/data/strings.js:50-51) and campus names must not be copied into this system.
- The live player count. The preview shows 0 / 20 PLAYING, the initial markup value (index.html:21).
- The click handlers. The preview has none.

## Do

- Keep the wordmark as type. Use the `wordmark` class from `tokens.css`. Do not replace it with an image.
- Keep the look picker panel on the right at desktop width, and stack it below the copy at 960px and under (styles.css:688-690).

## What the preview omits

- The eyebrow (src/data/strings.js:24, styles.css:164-168) and the ticker (src/data/strings.js:49, styles.css:443-462). Both are on the live title screen.
- Why: the eyebrow is ALL CAPS with `·` separators (an `A · B · C` meta string, which the generic-tell rule forbids). The eyebrow and ticker text are `pink` on `paper` and `paper` on `pink`, at 3.24 to 1. That fails the 4.5 to 1 rule for preview text (SPEC.md). The preview therefore shows no text on those pairs.
- The live page keeps both, unchanged. Their values stay exact in `tokens.json` (`pink` and `paper` usage).

## Do not

- Do not change the wordmark rotation (-4deg) or its gradient. Those values come from styles.css:174 and 176.
- Do not add a pink ticker band with paper text at 14px and call it AA. It is 3.24:1 and fails 4.5:1 (see `../../README.md`, Colour).
- Do not add a second primary button. The source has one primary action on the title screen.
