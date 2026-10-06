---
name: retro-modern-art-direction
description: Art direction for a contemporary indie game with a late-1980s arcade side-scroller throwback (Paperboy, 720°, Skate or Die!, California Games, Final Fight, Out Run) — bright palettes, vector characters drawn in Canvas 2D, parallax, chrome logos, Memphis-style UI, readable gameplay contrast. Use this whenever you draw, restyle, or critique game visuals, sprites, backgrounds, HUDs, title screens or palettes, especially when feedback says the game looks too dark, too 8-bit, too pixelated, dated, muddy, cluttered, or hard to read, or asks for a "retro but modern" look.
---

# Retro-modern art direction

**Target look:** a 1988 arcade cabinet repainted in 2026. The silhouettes,
staging, bonus-stage swagger and chrome typography of late-80s scrollers;
the clean vector shapes, soft gradients, lighting, particles and smooth
animation of contemporary indies (OlliOlli World's sunny readability is the
closest modern reference).

Read `references/palette.md` before choosing any color. It holds the shared
tokens that `src/render/palette.js` implements.

## What "not 8-bit" means in practice

- Draw vector paths at `devicePixelRatio` (cap 2–3). Never upscale small
  bitmaps, never use `imageSmoothingEnabled = false`, never snap shapes to a
  chunky pixel grid.
- Cache static art (facades, backdrops) to offscreen canvases **at device
  resolution**. A 320 px cache stretched to 600 px is exactly the blurry 8-bit
  look players complain about.
- Use smooth gradients for sky, glass, fire and chrome; flat fills for
  characters with one shade and one highlight. Dithering, scanlines and CRT
  curvature are optional seasoning (≤ 6% opacity), never the base layer.
- Animate at 60 fps with eased motion. Limb poses may be keyframed, but
  positions, squash and secondary motion interpolate every frame.

## Light, value and color

- **Daylight by default.** Mean perceived lightness (CIE L*/100) should stay
  ≥ 0.55 with < 10% near-black pixels (check with
  `.claude/skills/game-playtest-loop/scripts/luminance.mjs`). Dusk laps may cool
  toward violet and neon but never toward near-black. Shadows are tinted
  lavender/indigo, not grey or black.
- **Value structure:** background (sky, skyline, far trees) light and
  desaturated; midground (houses, lawns) medium and pastel; gameplay objects
  (player, targets, hazards, pickups) saturated with dark-indigo outlines.
  Squint at a screenshot: the player and the current target must pop first.
- **One color, one meaning.** Hazard tells use one reserved hue family;
  pickups another; the antagonist faction its own muted palette. Do not reuse
  the hazard hue for decoration.
- **Outlines** are deep indigo (`ink`), 2–3 px at 1× scale on characters and
  interactables, thinner (1–1.5 px) on scenery, none on distant layers
  (atmospheric perspective).
- Fire, glow and light effects use additive blending so they brighten.

## Shapes and characters

- Chunky, rounded proportions: heads ~1/4.5 of body height, oversized hands
  and shoes, readable at 60 px tall. Every character must read as a
  silhouette in a single fill.
- Build characters as a small rig (hips, torso, head, two arms, two legs,
  board) with angles per pose; draw back limbs darker than front limbs.
- Faces: big eyes with a highlight, simple mouth shapes for emotion. Comic
  reactions (scorched hair, cartoon soot, flailing) — never gore.
- Variety by layering: hair style × hair color × outfit × accessory. Avoid
  making any single look the "default"; cast diverse skin tones and builds.

## Staging (late-80s scroller grammar)

- Side view with a 3/4 belt-scroller floor: depth maps to screen Y with mild
  size scaling; vertical lines stay vertical.
- Parallax: sky (0.05), skyline (0.15), far trees (0.35), playfield (1.0),
  foreground props (1.25). Each layer lighter and less saturated with distance.
- Lead room: the camera keeps the player in the left third when moving right.
- Big moments get arcade punctuation: banners that slam in on an angle, chrome
  text, starbursts, stage-clear stingers, bonus-stage title cards.

## Typography (system fonts only; this repo ships no font files)

- Display: heavy condensed italic (`"Avenir Next Condensed"`, Futura,
  Bahnschrift, Impact fallback) for logos, banners and numbers.
- Chrome text recipe: vertical gradient sky-white → cyan above a hard horizon
  line, sunset orange → yellow below; 2 px ink stroke; 3–4 px offset shadow in
  pink or grape. Use it for the logo and big callouts only.
- UI body: a clean sans at ≥ 13 px CSS. Numbers use tabular figures.

## UI frames

Memphis-group patterns (squiggles, triangles, dots, checkerboards) belong in
menus, dialogs and title screens, never behind gameplay. In-game HUD panels
are light glassy cards (white at 80–88% with a colored border) or bold
color blocks; never dark slabs over a bright scene.

## Critique checklist

1. Squint test: player and target read first?
2. Lightness: mean ≥ 0.55, < 10% near-black pixels?
3. Any blurry upscaled caches or pixel-stair edges at DPR 2?
4. Does each hue have one meaning? Are hazards obvious?
5. At 360 px wide, is all text legible and nothing overlapping?
6. Does it feel like 1988 (staging, swagger, type) *and* 2026 (light, motion, polish)?

## Alto's layering (v5)

The owner's reference for "a sweet heaven of a dream" is Alto's Adventure. What
that means here, without giving up the ink outlines that keep gameplay readable:

- **Depth by haze, not by darkness.** Distant layers (ridges, the campus skyline
  and its landmark) blend toward the horizon color and move slowly (parallax 0.04
  to 0.3). Only the playfield gets outlines; far layers are flat silhouettes.
- **Soft light.** Sun bloom plus a few additive light shafts at ≤ 16% alpha; birds
  and clouds drift on their own clock so the world breathes while you stop.
- **One readable camera.** A 26 m wide window (not 34): the skater is ~15% of the
  frame height. Fewer, calmer center banners (only big moments); everything else is
  a world-anchored popup near where it happened. Shake amplitude ≤ 9 px.
- **Busy lawns, clear lanes.** Party dressing (pools, flamingos, pong tables,
  string lights) lives behind the hedge line; the street and sidewalk stay clean so
  hazards and grindable edges read instantly (grindables glow cyan when you could
  land on them).
- **Teach with the hero.** Big comic thought bubbles above-left of the skater, with
  bright keycaps for the device in use; never cover the road ahead.
- **Campus identity.** Each campus colors the banners and landmark silhouette and
  mixes facade styles (Georgian brick, collegiate gothic, brownstone, Victorian,
  colonial, craftsman, tudor, modern). Chapters are fictional.
