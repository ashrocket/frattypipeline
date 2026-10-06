# PIPELINE palette tokens

`src/render/palette.js` implements these. Change both together.

## Core

| Token | Hex | Use |
| --- | --- | --- |
| ink | `#2A1E4F` | outlines, text on light, shadows (with alpha) |
| paper | `#FFFFFF` | trims, highlights, text on color |
| pink | `#FF3EA5` | brand accent, player-positive callouts |
| cyan | `#1FE5FF` | secondary accent, aim reticle |
| sun | `#FFD23F` | score, pickups, chrome lower half |
| mint | `#3DF2A8` | success, hits, rescue |
| grape | `#7B4DFF` | shadows of accents, UI borders |
| tangerine | `#FF8A3D` | fire family anchor |
| hazard | `#FF4D6D` | reserved: danger tells only |

## Sky by lap (time of day — never darker than "neon dusk")

| Lap | top | mid | horizon |
| --- | --- | --- | --- |
| 1 noon | `#4FC3FF` | `#8FDDFF` | `#DDF8FF` |
| 2 golden | `#5AA9FF` | `#FFC59B` | `#FFE6B0` |
| 3 sunset | `#7A6CFF` | `#FF8FB3` | `#FFC27A` |
| 4+ neon dusk | `#5B4FD8` | `#B45CFF` | `#FF8ACB` |

## World

| Token | Hex |
| --- | --- |
| lawn / lawnStripe | `#79DB6E` / `#6CCC63` |
| hedge | `#38B26B` |
| sidewalk / joint | `#F3ECFF` / `#DCCFF2` |
| curb / curbShade | `#FFFFFF` / `#C9B9EA` |
| street | `#9A95CC` |
| laneDash | `#FFE46B` |
| skylineFar | `#B9D3F5` |
| treeFar | `#8FE0B5` |

House walls cycle: mint `#A6F0D2`, salmon `#FFB8AD`, butter `#FFE69A`,
powder `#A8D7FF`, lilac `#D7BBFF`, peach `#FFCFA6`, lime `#C4F39A`,
bubblegum `#FFB3DA`. Roofs: cobalt `#4C58D9`, raspberry `#E2507F`,
teal `#26B3A0`, grape `#7B4DFF`, tangerine `#FF8A3D`. Glass `#7FD8FF`
with highlight `#E8FBFF`.

## Effects

- Fire, core → edge: `#FFF8C2`, `#FFD23F`, `#FF8A1F`, `#FF4D6D` (additive).
- Smoke: `#C6BEE6` fading to transparent (never black).
- Water/foam: `#7FE7FF`, `#FFFFFF`.
- Rot: mold `#9CC45A`, decay `#B5A77A`, vine `#4FAF5B`.
- Bees: `#FFD23F` + ink stripes; swarm motes `#FFE98A`.

## Antagonist faction (the Pipeline)

Deliberately muted, so it reads as "conformity" against the bright world:
quarter-zip `#E8DCC4`, khaki `#CDBB8E`, lanyard `#1F2A44`, zombie skin
`#B8D9A8`, dead-eye `#F4F1E6`. Never give the player or allies these colors.
