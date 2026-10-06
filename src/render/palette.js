// Shared color tokens. Keep in sync with
// .claude/skills/retro-modern-art-direction/references/palette.md
export const P = Object.freeze({
  ink: '#2A1E4F',
  inkSoft: '#4A3D7A',
  paper: '#FFFFFF',
  pink: '#FF3EA5',
  cyan: '#1FE5FF',
  sun: '#FFD23F',
  mint: '#3DF2A8',
  grape: '#7B4DFF',
  tangerine: '#FF8A3D',
  hazard: '#FF4D6D',
  lawn: '#79DB6E',
  lawnStripe: '#6CCC63',
  lawnShade: '#5DBE5F',
  hedge: '#38B26B',
  hedgeLight: '#55C97C',
  sidewalk: '#F3ECFF',
  joint: '#DCCFF2',
  curb: '#FFFFFF',
  curbShade: '#C9B9EA',
  street: '#9A95CC',
  streetLight: '#A9A4D6',
  laneDash: '#FFE46B',
  glass: '#7FD8FF',
  glassHi: '#E8FBFF',
  trim: '#FFFFFF',
  smoke: '#C6BEE6',
  water: '#7FE7FF',
  mold: '#9CC45A',
  decay: '#B5A77A',
  vine: '#4FAF5B',
  truck: '#F0354B',
  extinguisher: '#E8344E',
  fire: ['#FFF8C2', '#FFD23F', '#FF8A1F', '#FF4D6D'],
  uniform: { zip: '#E8DCC4', khaki: '#CDBB8E', lanyard: '#1F2A44', skin: '#B8D9A8' },
});
// Time of day by lap. Even the last one is bright neon, never night.
export const SKIES = [
  { name: 'NOON', top: '#4FC3FF', mid: '#8FDDFF', horizon: '#DDF8FF', sun: '#FFF6C9', glow: '#FFFFFF', far: '#B9D3F5', hills: '#9EE6BE', tint: null },
  { name: 'GOLDEN HOUR', top: '#5AA9FF', mid: '#FFC59B', horizon: '#FFE6B0', sun: '#FFF2B0', glow: '#FFE2A0', far: '#E4C9E8', hills: '#B9E3A6', tint: 'rgba(255,190,120,0.07)' },
  { name: 'SUNSET', top: '#7A6CFF', mid: '#FF8FB3', horizon: '#FFC27A', sun: '#FFE38A', glow: '#FFB07A', far: '#D7A9E6', hills: '#C2B4F0', tint: 'rgba(255,120,170,0.08)' },
  { name: 'NEON DUSK', top: '#5B4FD8', mid: '#B45CFF', horizon: '#FF8ACB', sun: '#FFD36B', glow: '#FF9AD5', far: '#B79BEE', hills: '#9F8BE8', tint: 'rgba(150,90,255,0.1)' },
];
export const skyFor = (lap) => SKIES[Math.min(SKIES.length - 1, Math.max(0, lap - 1))];
export const FONT = {
  display: '"Avenir Next Condensed", "Futura", "Bahnschrift", "Roboto Condensed", "Arial Narrow", Impact, sans-serif',
  ui: '"Avenir Next", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};
export const BROS = {
  polo: ['#FFB8AD', '#A6F0D2', '#A8D7FF', '#D7BBFF', '#FFE69A', '#FFFFFF', '#FF9AC8', '#9FE3FF'],
  shorts: ['#FF9B8A', '#CDBB8E', '#7FB6FF', '#B5E08A', '#FFFFFF', '#F7D58C'],
  cap: ['#4C58D9', '#E2507F', '#26B3A0', '#FF8A3D', '#FFFFFF', '#7B4DFF'],
  skin: ['#FFE0C7', '#F2C29B', '#D79A6E', '#A8693F', '#6E4428'],
  hair: ['#5A3A2E', '#E9C46A', '#2B1B3F', '#B5653A', '#F4E3B5'],
};
