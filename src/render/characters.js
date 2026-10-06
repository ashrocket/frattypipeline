import { P, BROS } from './palette.js';
import { TAU, ellipse, paint, rr, limb, mix, darken, lighten, noise, blob, star, rand } from './draw.js';
import { LOOKS, HAIR_COLORS, SKIN_TONES, UNIFORM } from '../data/looks.js';
// A small 2D rig: hips, chest, head, two arms and two legs solved with two-bone IK.
// Coordinates are in rig units (u); the figure is about 10u tall, feet at y = 0.
function ik(ax, ay, bx, by, l1, l2, bend) {
  const dx = bx - ax,
    dy = by - ay,
    d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-3),
    a = Math.atan2(dy, dx),
    cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d),
    k = a + bend * Math.acos(Math.max(-1, Math.min(1, cos)));
  return [ax + Math.cos(k) * l1, ay + Math.sin(k) * l1];
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
// Pose = joint targets. Bend: +1 knees/elbows forward (facing right), -1 backward.
function solve(pose) {
  const hip = pose.hip,
    chest = pose.chest,
    shoulderB = add(chest, [-0.35, 0.15]),
    shoulderF = add(chest, [0.35, 0.05]),
    hipB = add(hip, [-0.35, 0]),
    hipF = add(hip, [0.35, 0]);
  return {
    ...pose,
    legs: [
      { hip: hipB, knee: ik(...hipB, ...pose.footB, 2.15, 2.15, pose.kneeBend ?? -1), foot: pose.footB },
      { hip: hipF, knee: ik(...hipF, ...pose.footF, 2.15, 2.15, pose.kneeBend ?? -1), foot: pose.footF },
    ],
    arms: [
      { shoulder: shoulderB, elbow: ik(...shoulderB, ...pose.handB, 1.55, 1.5, pose.elbowB ?? 1), hand: pose.handB },
      { shoulder: shoulderF, elbow: ik(...shoulderF, ...pose.handF, 1.55, 1.5, pose.elbowF ?? 1), hand: pose.handF },
    ],
  };
}
const wave = (t, f = 1) => Math.sin(t * TAU * f);
// ----- Poses -------------------------------------------------------------
export function skaterPose(s) {
  const t = s.time ?? 0,
    bob = Math.sin(t * 9) * 0.08 * (s.speed ?? 1);
  if (s.mode === 'wipeout') {
    return solve({
      hip: [0, -1.2],
      chest: [2.2, -1.6],
      head: [3.4, -1.9],
      footB: [-2.4, -0.4],
      footF: [-1.8, -1.6],
      handB: [3.6, -0.2],
      handF: [1.6, -3.4],
      kneeBend: 1,
      rotate: s.spin ?? 0,
    });
  }
  const deck = s.deckY ?? -0.62;
  let hipY = -4 + bob,
    lean = 0.35;
  let footF = [1.25, deck],
    footB = [-1.35, deck];
  let handF = [1.9, -5.2 + bob],
    handB = [-1.9, -5.6 + bob];
  if (s.mode === 'push') {
    // Kick-push: the back foot reaches forward, plants, and sweeps back along the ground.
    const ph = Math.min(1, s.phase),
      k = Math.sin(ph * Math.PI),
      sweep = ph < 0.25 ? ph / 0.25 : 1 - (ph - 0.25) / 0.75;
    footB = [-0.4 - 2.2 * (1 - sweep) + 0.3 * k, deck + 0.62 * k];
    hipY = -4.2 + 0.45 * k;
    lean = 0.7 + 0.15 * k;
    handB = [-1.6 - 0.6 * k, -5.1];
    handF = [2.1 + 0.4 * k, -5.9];
  } else if (s.mode === 'drag') {
    // Foot brake: the back foot drags behind on the ground.
    footB = [-2.7, deck + 0.62];
    hipY = -3.7;
    lean = 0.05;
    handB = [-2.4, -5.6];
    handF = [2.4, -6.2];
  } else if (s.mode === 'slide') {
    // Powerslide: board sideways, weight back, arms out.
    footF = [0.75, deck];
    footB = [-0.75, deck];
    hipY = -3.3;
    lean = -0.45;
    handB = [-3.1, -6.6];
    handF = [2.9, -7.4];
  } else if (s.mode === 'grind') {
    footF = [1.15, deck];
    footB = [-1.25, deck];
    hipY = -3.35;
    lean = 0.3;
    handB = [-3.2, -6.4 + Math.sin(t * 7) * 0.2];
    handF = [3.1, -6.8 + Math.cos(t * 7) * 0.2];
  } else if (s.mode === 'stumble') {
    const a = t * 22;
    hipY = -3.8;
    lean = 0.95;
    handF = [1.2 + Math.cos(a) * 1.9, -7 + Math.sin(a) * 1.9];
    handB = [-1 + Math.cos(a + 2.4) * 1.9, -7 + Math.sin(a + 2.4) * 1.9];
  } else if (s.mode === 'crouch') {
    hipY = -3.2;
    lean = 0.55;
    handF = [2.1, -4.4];
    handB = [-1.6, -4.6];
  } else if (s.mode === 'air') {
    hipY = -3.5;
    footF = [1.05, deck - 0.1];
    footB = [-1.05, deck - 0.1];
    handF = [2.4, -7.8];
    handB = [-2.5, -7.4];
    lean = 0.25;
    // Feet pop off the board while it flips; tuck tight for a backflip or a grab.
    const lift = s.flip ? Math.sin(Math.min(1, s.flip.f) * Math.PI) * 1.3 : 0;
    footF = [footF[0], footF[1] - lift];
    footB = [footB[0], footB[1] - lift];
    if (s.tuck || s.grab) {
      hipY = -3;
      footF = [1, deck - 0.1];
      footB = [-1, deck - 0.1];
      lean = 0.55;
      handF = s.grab ? [1.2, deck - 0.35] : [1.4, -4.4];
      handB = s.grab ? [-2.8, -7.9] : [-0.6, -4.2];
    }
  }
  if (s.throw === 'wind') {
    handF = [-1.4, -9.4];
    lean -= 0.15;
  } else if (s.throw === 'release') {
    handF = [3.4, -7.7];
    lean += 0.35;
  }
  if (s.tow) handB = [-2.9, -5.5];
  return solve({
    hip: [0, hipY],
    chest: [lean, hipY - 3.05],
    head: [lean + 0.25, hipY - 4.35],
    footB,
    footF,
    handB,
    handF,
    elbowF: s.throw === 'wind' ? -1 : 1,
  });
}
export function walkerPose(s) {
  const t = s.time ?? 0,
    mode = s.mode ?? 'idle',
    w = wave(t, s.rate ?? 1.6);
  let hipY = -4.35,
    sway = 0,
    footF = [0.65, 0],
    footB = [-0.6, 0],
    handF = [1.3, -4.6],
    handB = [-1.2, -4.6],
    lean = 0,
    elbowB = 1;
  if (mode === 'idle') {
    sway = Math.sin(t * 2.2) * 0.15 * (1 + (s.drunk ?? 0) * 2);
    handF = [1.25, -5.9 + Math.sin(t * 2.2) * 0.1];
  } else if (mode === 'walk' || mode === 'run' || mode === 'flee' || mode === 'shamble') {
    const stride = mode === 'run' || mode === 'flee' ? 1.25 : mode === 'shamble' ? 0.55 : 0.8;
    footF = [0.2 + w * stride, -Math.max(0, w) * 0.5];
    footB = [-0.2 - w * stride, -Math.max(0, -w) * 0.5];
    hipY = -4.35 + Math.abs(w) * 0.12;
    lean = mode === 'run' || mode === 'flee' ? 0.6 : 0.15;
    handF = [0.6 - w * 1.2, -4.8];
    handB = [-0.6 + w * 1.2, -4.8];
    if (mode === 'flee') {
      handF = [1.2 + w * 0.6, -10.2];
      handB = [-0.8 - w * 0.6, -10];
      elbowB = -1;
    }
    if (mode === 'shamble') {
      handF = [3.2, -7 + w * 0.2];
      handB = [3, -6.7 - w * 0.2];
      lean = 0.35;
    }
  } else if (mode === 'dance') {
    sway = Math.sin(t * 7) * 0.45;
    hipY = -4.35 + Math.abs(Math.sin(t * 7)) * 0.25;
    handF = [1.4, -9.9 + Math.sin(t * 7) * 0.8];
    handB = [-1.3, -9.9 - Math.sin(t * 7) * 0.8];
    footF = [0.85, -Math.max(0, Math.sin(t * 7)) * 0.4];
    elbowB = -1;
  } else if (mode === 'point') {
    sway = Math.sin(t * 8) * 0.2;
    hipY = -4.35 - Math.max(0, Math.sin(t * 8)) * 0.5;
    handF = [3.5, -7.8];
    handB = [-1.1, -9.6];
    elbowB = -1;
  } else if (mode === 'spray') {
    lean = 0.35;
    handF = [2.6, -6.2];
    handB = [1.6, -5.5];
    footF = [1, 0];
    footB = [-0.9, 0];
  } else if (mode === 'burn') {
    const r = wave(t, 3.2);
    footF = [0.3 + r * 1.3, -Math.max(0, r) * 0.7];
    footB = [-0.3 - r * 1.3, -Math.max(0, -r) * 0.7];
    hipY = -4.4 + Math.abs(r) * 0.2;
    lean = 0.5;
    handF = [1.3 + Math.sin(t * 23) * 0.5, -10.4];
    handB = [-1.3 + Math.cos(t * 19) * 0.5, -10.2];
    elbowB = -1;
  } else if (mode === 'cough') {
    lean = 0.4 + Math.max(0, Math.sin(t * 6)) * 0.3;
    handF = [1.3, -7.2];
    hipY = -4.3;
  } else if (mode === 'wave') {
    handF = [1.6, -9.6 + Math.sin(t * 9) * 0.4];
    elbowB = -1;
  } else if (mode === 'stand') {
    handF = [1, -4.4];
    handB = [-1, -4.4];
  }
  return solve({
    hip: [sway, hipY],
    chest: [sway + lean, hipY - 3.05],
    head: [sway * 1.2 + lean + 0.1, hipY - 4.4],
    footB,
    footF,
    handB,
    handF,
    elbowB,
    elbowF: mode === 'dance' || mode === 'burn' || mode === 'flee' ? -1 : 1,
  });
}
// ----- Drawing ----------------------------------------------------------
function drawLeg(c, leg, color, shoe, u, back) {
  const w = 1.05 * u,
    tone = back ? darken(color, 0.12) : color;
  limb(c, leg.hip[0] * u, leg.hip[1] * u, leg.knee[0] * u, leg.knee[1] * u, w, tone, P.ink, u * 0.2);
  limb(c, leg.knee[0] * u, leg.knee[1] * u, leg.foot[0] * u, leg.foot[1] * u - 0.25 * u, w * 0.92, tone, P.ink, u * 0.2);
  rr(c, leg.foot[0] * u - 0.55 * u, leg.foot[1] * u - 0.6 * u, 1.45 * u, 0.62 * u, 0.3 * u);
  paint(c, back ? darken(shoe, 0.12) : shoe, P.ink, u * 0.2);
}
function drawArm(c, arm, color, skin, u, back, sleeve = 0.55) {
  const tone = back ? darken(color, 0.12) : color,
    skinTone = back ? darken(skin, 0.1) : skin;
  const mx = arm.shoulder[0] + (arm.elbow[0] - arm.shoulder[0]) * (1 + sleeve) * 0.5,
    my = arm.shoulder[1] + (arm.elbow[1] - arm.shoulder[1]) * (1 + sleeve) * 0.5;
  limb(c, arm.shoulder[0] * u, arm.shoulder[1] * u, arm.elbow[0] * u, arm.elbow[1] * u, 0.82 * u, skinTone, P.ink, u * 0.2);
  limb(c, arm.elbow[0] * u, arm.elbow[1] * u, arm.hand[0] * u, arm.hand[1] * u, 0.74 * u, skinTone, P.ink, u * 0.2);
  limb(c, arm.shoulder[0] * u, arm.shoulder[1] * u, mx * u, my * u, 0.95 * u, tone, null);
  ellipse(c, arm.hand[0] * u, arm.hand[1] * u, 0.5 * u, 0.5 * u);
  paint(c, skinTone, P.ink, u * 0.2);
}
function drawTorso(c, pose, top, trim, u, opts) {
  const [hx, hy] = pose.hip,
    [cx, cy] = pose.chest;
  c.beginPath();
  c.moveTo((hx - 1.05) * u, (hy + 0.3) * u);
  c.lineTo((cx - 1.2) * u, (cy + 0.1) * u);
  c.quadraticCurveTo(cx * u, (cy - 0.55) * u, (cx + 1.2) * u, (cy + 0.1) * u);
  c.lineTo((hx + 1.05) * u, (hy + 0.3) * u);
  c.closePath();
  paint(c, top, P.ink, u * 0.2);
  if (opts.stripe) {
    c.save();
    c.clip();
    c.fillStyle = trim;
    c.fillRect((hx - 2) * u, (hy - 1.15) * u, 4 * u, 0.55 * u);
    c.restore();
  }
  if (opts.zip) {
    c.strokeStyle = darken(top, 0.25);
    c.lineWidth = u * 0.16;
    c.beginPath();
    c.moveTo(cx * u, (cy - 0.3) * u);
    c.lineTo(hx * u, (hy + 0.2) * u);
    c.stroke();
    // Quarter-zip collar
    rr(c, (cx - 0.8) * u, (cy - 0.75) * u, 1.6 * u, 0.6 * u, 0.25 * u);
    paint(c, lighten(top, 0.2), P.ink, u * 0.15);
  }
  if (opts.lanyard) {
    c.strokeStyle = UNIFORM.lanyard;
    c.lineWidth = u * 0.22;
    c.beginPath();
    c.moveTo((cx - 0.5) * u, (cy - 0.3) * u);
    c.lineTo((cx + 0.05) * u, (cy + 1.6) * u);
    c.lineTo((cx + 0.55) * u, (cy - 0.3) * u);
    c.stroke();
    rr(c, (cx - 0.3) * u, (cy + 1.5) * u, 0.7 * u, 0.9 * u, 0.1 * u);
    paint(c, '#FFFFFF', UNIFORM.lanyard, u * 0.12);
  }
  if (opts.collar) {
    poly2(c, [
      [(cx - 0.7) * u, (cy - 0.35) * u],
      [cx * u, (cy + 0.35) * u],
      [(cx + 0.7) * u, (cy - 0.35) * u],
    ]);
    paint(c, lighten(top, 0.35), P.ink, u * 0.15);
  }
  if (opts.patches) {
    rr(c, (hx - 0.7) * u, (hy - 1.9) * u, 0.7 * u, 0.6 * u, 0.1 * u);
    paint(c, P.sun, P.ink, u * 0.1);
    rr(c, (cx + 0.1) * u, (cy + 0.6) * u, 0.6 * u, 0.6 * u, 0.3 * u);
    paint(c, P.pink, P.ink, u * 0.1);
  }
  if (opts.studs) {
    c.fillStyle = '#F3ECFF';
    for (let i = -2; i <= 2; i++) {
      ellipse(c, (cx + i * 0.38) * u, (cy + 0.05 - Math.abs(i) * 0.05) * u, 0.13 * u, 0.13 * u);
      c.fill();
    }
  }
  if (opts.letters) {
    c.save();
    c.font = `900 ${u * 1.1}px Georgia, serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = opts.lettersColor ?? P.ink;
    c.fillText(opts.letters, ((hx + cx) / 2) * u, ((hy + cy) / 2 + 0.1) * u);
    c.restore();
  }
}
function poly2(c, pts) {
  c.beginPath();
  c.moveTo(...pts[0]);
  for (const p of pts.slice(1)) c.lineTo(...p);
  c.closePath();
}
function drawHair(c, style, color, hx, hy, r, u, front) {
  c.save();
  const ink = P.ink,
    w = u * 0.2;
  const shape = (pts) => {
    blob(c, pts.map(([x, y]) => [hx + x * r, hy + y * r]));
    paint(c, color, ink, w);
  };
  if (!front) {
    if (style === 'waves') shape([[-1.1, -0.4], [-1.25, 0.6], [-1.15, 1.6], [-0.6, 1.9], [-0.2, 1.1], [0.2, 0.2], [0, -1.05]]);
    else if (style === 'curls') shape([[-1.4, -0.6], [-1.6, 0.5], [-1.2, 1.3], [-0.2, 1.1], [0.6, 0.1], [0.9, -1.1], [-0.2, -1.6]]);
    else if (style === 'ponytail' || style === 'braid')
      shape([[-0.9, -0.5], [-1.9, 0], [-2.2, 1.2], [-1.7, 1.9], [-1.4, 0.8], [-0.7, 0.3]]);
    else if (style === 'pigtails') {
      shape([[-1, -0.1], [-1.8, 0.3], [-1.6, 1.2], [-1, 0.6]]);
      shape([[0.8, -0.1], [1.5, 0.3], [1.4, 1.2], [0.9, 0.6]]);
    } else if (style === 'braids')
      for (const x of [-0.9, -0.5]) {
        rr(c, hx + x * r, hy + 0.1 * r, 0.32 * r, 1.9 * r, 0.16 * r);
        paint(c, color, ink, w);
      }
    else if (style === 'hijab') shape([[-1.25, -0.6], [-1.35, 0.8], [-0.9, 1.6], [0.4, 1.75], [1.15, 1.1], [1.2, -0.4], [0, -1.2]]);
    c.restore();
    return;
  }
  switch (style) {
    case 'waves':
      shape([[-1.05, -0.2], [-0.95, -1], [0.1, -1.25], [1.05, -0.75], [1.1, -0.15], [0.5, -0.55], [-0.3, -0.45]]);
      break;
    case 'curls':
      for (const [x, y, s] of [[-0.8, -0.8, 0.55], [-0.1, -1.1, 0.6], [0.65, -0.85, 0.55], [1, -0.25, 0.42], [-1.05, -0.15, 0.45]]) {
        ellipse(c, hx + x * r, hy + y * r, s * r, s * r);
        paint(c, color, ink, w);
      }
      break;
    case 'bob':
      shape([[-1.15, 0.7], [-1.15, -0.6], [-0.2, -1.2], [0.9, -0.9], [1.1, -0.2], [0.55, -0.45], [-0.6, -0.15], [-0.75, 0.75]]);
      break;
    case 'undercut':
      shape([[-0.95, -0.35], [-0.6, -1.2], [0.6, -1.5], [1.4, -1.05], [0.9, -0.55], [-0.2, -0.65]]);
      break;
    case 'spikes':
    case 'mohawk': {
      const n = style === 'mohawk' ? 4 : 5;
      c.beginPath();
      c.moveTo(hx - 0.95 * r, hy - 0.35 * r);
      for (let i = 0; i < n; i++) {
        const a = -2.6 + (i / (n - 1)) * 2.2;
        const tip = style === 'mohawk' ? 2.05 : 1.95;
        c.lineTo(hx + Math.cos(a) * r * tip, hy + Math.sin(a) * r * tip);
        c.lineTo(hx + Math.cos(a + 0.28) * r * 0.95, hy + Math.sin(a + 0.28) * r * 0.95);
      }
      c.lineTo(hx + 0.95 * r, hy - 0.3 * r);
      c.closePath();
      paint(c, color, ink, w);
      break;
    }
    case 'ponytail':
    case 'braid':
    case 'pigtails':
    case 'braids':
      shape([[-1.05, -0.1], [-0.85, -0.95], [0.15, -1.2], [1, -0.75], [1.05, -0.2], [0.3, -0.6], [-0.5, -0.5]]);
      break;
    case 'spiky':
      c.beginPath();
      c.moveTo(hx - r, hy - 0.2 * r);
      for (let i = 0; i < 7; i++) {
        const a = -2.9 + i * 0.45;
        c.lineTo(hx + Math.cos(a) * r * 1.5, hy + Math.sin(a) * r * 1.45);
        c.lineTo(hx + Math.cos(a + 0.22) * r * 1.02, hy + Math.sin(a + 0.22) * r * 1.02);
      }
      c.closePath();
      paint(c, color, ink, w);
      break;
    case 'hat': {
      ellipse(c, hx, hy - 0.75 * r, 1.75 * r, 0.42 * r);
      paint(c, '#F7E3B5', ink, w);
      rr(c, hx - 0.85 * r, hy - 1.75 * r, 1.7 * r, 1.05 * r, 0.4 * r);
      paint(c, '#F7E3B5', ink, w);
      c.fillStyle = P.pink;
      c.fillRect(hx - 0.85 * r, hy - 0.95 * r, 1.7 * r, 0.22 * r);
      shape([[-1.05, -0.3], [-1.1, 0.7], [-0.75, 1.1], [-0.6, -0.2]]);
      break;
    }
    case 'hijab':
      shape([[-1.2, -0.2], [-0.95, -1.05], [0.2, -1.3], [1.15, -0.65], [1.15, 0.3], [0.85, 0.15], [0.7, -0.5], [-0.5, -0.55], [-0.9, 0.5]]);
      break;
    case 'cap': {
      shape([[-1.05, -0.25], [-0.85, -1.05], [0.2, -1.25], [1.05, -0.6], [1, -0.2]]);
      // Backwards brim
      rr(c, hx - 1.75 * r, hy - 0.62 * r, 1.05 * r, 0.32 * r, 0.15 * r);
      paint(c, color, ink, w);
      break;
    }
    case 'flow':
      shape([[-1.05, -0.1], [-0.9, -1.05], [0.2, -1.35], [1.25, -0.9], [0.95, -0.55], [0.1, -0.7], [-0.6, -0.4], [-0.7, 0.3]]);
      break;
    case 'frosted':
      c.beginPath();
      c.moveTo(hx - r, hy - 0.2 * r);
      for (let i = 0; i < 6; i++) {
        const a = -2.8 + i * 0.5;
        c.lineTo(hx + Math.cos(a) * r * 1.38, hy + Math.sin(a) * r * 1.35);
        c.lineTo(hx + Math.cos(a + 0.25) * r * 1.0, hy + Math.sin(a + 0.25) * r * 1.0);
      }
      c.closePath();
      paint(c, color, ink, w);
      c.save();
      c.clip();
      c.fillStyle = '#FFF4C2';
      c.fillRect(hx - 2 * r, hy - 2 * r, 4 * r, 0.75 * r);
      c.restore();
      break;
    case 'buzz':
      shape([[-1.02, -0.25], [-0.8, -0.95], [0.2, -1.12], [1, -0.65], [1.02, -0.25], [0, -0.75]]);
      break;
    case 'blowout':
      shape([[-1.15, 0.2], [-1.1, -0.9], [0.1, -1.4], [1.25, -0.9], [1.2, -0.1], [0.7, -0.75], [-0.4, -0.7], [-0.8, 0.4]]);
      break;
  }
  c.restore();
}
function drawFace(c, hx, hy, r, u, face) {
  const look = face.look ?? 0.25;
  const eye = (x) => {
    if (face.shades) return;
    ellipse(c, hx + x * r, hy - 0.05 * r, 0.24 * r, face.dead ? 0.24 * r : 0.3 * r);
    paint(c, '#FFFFFF', P.ink, u * 0.12);
    if (face.dead) {
      c.fillStyle = P.ink;
      ellipse(c, hx + x * r, hy - 0.05 * r, 0.05 * r, 0.05 * r);
      c.fill();
    } else {
      ellipse(c, hx + (x + look * 0.18) * r, hy - (face.panic ? 0.12 : 0.02) * r, 0.12 * r, face.panic ? 0.11 * r : 0.16 * r);
      c.fillStyle = P.ink;
      c.fill();
      c.fillStyle = '#FFFFFF';
      ellipse(c, hx + (x + look * 0.18 + 0.05) * r, hy - 0.1 * r, 0.045 * r, 0.045 * r);
      c.fill();
    }
  };
  eye(0.05);
  eye(0.62);
  if (face.shades) {
    rr(c, hx - 0.2 * r, hy - 0.32 * r, 1.12 * r, 0.42 * r, 0.16 * r);
    paint(c, face.shades, P.ink, u * 0.12);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect(hx - 0.05 * r, hy - 0.25 * r, 0.25 * r, 0.08 * r);
  }
  if (face.brows) {
    c.strokeStyle = P.ink;
    c.lineWidth = u * 0.16;
    c.beginPath();
    const tilt = face.panic ? -0.18 : face.grin ? 0.05 : 0.1;
    c.moveTo(hx - 0.12 * r, hy - (0.48 + tilt) * r);
    c.lineTo(hx + 0.25 * r, hy - 0.48 * r);
    c.moveTo(hx + 0.45 * r, hy - 0.48 * r);
    c.lineTo(hx + 0.8 * r, hy - (0.48 + tilt) * r);
    c.stroke();
  }
  if (face.blush) {
    c.fillStyle = 'rgba(255,90,140,0.4)';
    ellipse(c, hx + 0.85 * r, hy + 0.35 * r, 0.2 * r, 0.12 * r);
    c.fill();
    ellipse(c, hx - 0.05 * r, hy + 0.35 * r, 0.18 * r, 0.11 * r);
    c.fill();
  }
  c.strokeStyle = P.ink;
  c.lineWidth = u * 0.15;
  c.beginPath();
  if (face.panic) {
    ellipse(c, hx + 0.38 * r, hy + 0.5 * r, 0.2 * r, 0.26 * r);
    paint(c, '#7A2B4A', P.ink, u * 0.12);
  } else if (face.dead) {
    c.moveTo(hx + 0.1 * r, hy + 0.5 * r);
    c.lineTo(hx + 0.7 * r, hy + 0.48 * r);
    c.stroke();
  } else if (face.grin) {
    c.arc(hx + 0.4 * r, hy + 0.25 * r, 0.32 * r, 0.15 * Math.PI, 0.85 * Math.PI);
    c.closePath();
    paint(c, '#FFFFFF', P.ink, u * 0.12);
  } else {
    c.arc(hx + 0.4 * r, hy + 0.3 * r, 0.25 * r, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  }
}
// Cartoon flames: overlapping teardrop tongues, hot core over pink edges.
export function flames(c, x, y, w, h, t, seed = 0, alpha = 1) {
  if (h <= 0 || w <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  const tongues = Math.max(2, Math.min(7, Math.round(w / Math.max(4, h * 0.32))));
  const layers = [
    [P.fire[3], 1],
    [P.fire[2], 0.8],
    [P.fire[1], 0.58],
    [P.fire[0], 0.34],
  ];
  for (const [color, k] of layers) {
    c.fillStyle = color;
    for (let i = 0; i < tongues; i++) {
      const f = (i + 0.5) / tongues,
        cx = x - (w / 2) * k + f * w * k,
        bw = ((w * k) / tongues) * 1.05,
        edge = 1 - Math.abs(f - 0.5) * 0.9,
        height = h * k * edge * (0.6 + 0.4 * Math.abs(noise(seed + i * 1.7 + t * 5))),
        sway = Math.sin(t * 8 + i * 1.3 + seed) * bw * 0.35;
      c.beginPath();
      c.moveTo(cx - bw * 0.62, y);
      c.bezierCurveTo(cx - bw * 0.75, y - height * 0.45, cx + sway - bw * 0.18, y - height * 0.72, cx + sway, y - height);
      c.bezierCurveTo(cx + sway + bw * 0.18, y - height * 0.72, cx + bw * 0.75, y - height * 0.45, cx + bw * 0.62, y);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}
// Draw a full figure. spec: { u, facing, pose, skin, hair, hairStyle, top, trim, bottom, shoes, face, ... }
export function figure(c, spec) {
  const u = spec.u,
    pose = spec.pose;
  c.save();
  c.scale(spec.facing ?? 1, 1);
  if (pose.rotate) c.rotate(pose.rotate);
  const [hx, hy] = [pose.head[0] * u, pose.head[1] * u],
    r = 1.3 * u;
  drawHair(c, spec.hairStyle, spec.hair, hx, hy, r, u, false);
  drawArm(c, pose.arms[0], spec.top, spec.skin, u, true, spec.sleeve);
  drawLeg(c, pose.legs[0], spec.bottom, spec.shoes, u, true);
  if (spec.backItem) spec.backItem(c, u, pose);
  drawLeg(c, pose.legs[1], spec.bottom, spec.shoes, u, false);
  drawTorso(c, pose, spec.top, spec.trim, u, spec);
  // Neck and head
  limb(c, pose.chest[0] * u, (pose.chest[1] - 0.2) * u, hx * 0.95, hy + r * 0.7, 0.7 * u, spec.skin, P.ink, u * 0.18);
  ellipse(c, hx, hy, r, r * 1.02);
  paint(c, spec.skin, P.ink, u * 0.22);
  if (spec.soot) {
    c.save();
    ellipse(c, hx, hy, r, r * 1.02);
    c.clip();
    c.fillStyle = 'rgba(60,45,90,0.55)';
    c.fillRect(hx - r, hy - r, 2 * r, 2 * r);
    c.restore();
  }
  drawFace(c, hx, hy, r, u, spec.face ?? {});
  drawHair(c, spec.hairStyle, spec.hair, hx, hy, r, u, true);
  if (spec.headphones) {
    c.strokeStyle = P.ink;
    c.lineWidth = u * 0.3;
    c.beginPath();
    c.arc(hx, hy, r * 1.08, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
    rr(c, hx - r * 1.25, hy - r * 0.2, r * 0.5, r * 0.75, r * 0.2);
    paint(c, spec.trim, P.ink, u * 0.15);
  }
  if (spec.clip) {
    star(c, hx - r * 0.55, hy - r * 0.85, r * 0.38);
    paint(c, P.sun, P.ink, u * 0.12);
  }
  if (spec.helmet) {
    c.beginPath();
    c.arc(hx, hy - r * 0.1, r * 1.12, Math.PI, 0);
    c.closePath();
    paint(c, spec.helmet, P.ink, u * 0.2);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    rr(c, hx - r * 0.55, hy - r * 0.9, r * 0.5, r * 0.18, r * 0.09);
    c.fill();
  }
  drawArm(c, pose.arms[1], spec.top, spec.skin, u, false, spec.sleeve);
  if (spec.handItem) spec.handItem(c, u, pose);
  c.restore();
}
// ----- Specific characters ---------------------------------------------------
export function deck(c, u, x, y, tilt = 0, colors = {}) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  for (const wx of [-1.45, 1.45]) {
    ellipse(c, wx * u, 0.1 * u, 0.42 * u, 0.42 * u);
    paint(c, colors.wheel ?? P.sun, P.ink, u * 0.16);
  }
  c.beginPath();
  c.moveTo(-2.4 * u, -0.75 * u);
  c.quadraticCurveTo(-2.65 * u, -1 * u, -2.3 * u, -0.45 * u);
  c.lineTo(2.3 * u, -0.45 * u);
  c.quadraticCurveTo(2.65 * u, -1 * u, 2.4 * u, -0.75 * u);
  c.lineTo(-2.4 * u, -0.75 * u);
  c.closePath();
  rr(c, -2.45 * u, -0.85 * u, 4.9 * u, 0.42 * u, 0.2 * u);
  paint(c, colors.deck ?? P.pink, P.ink, u * 0.18);
  c.fillStyle = colors.stripe ?? P.cyan;
  c.fillRect(-1.2 * u, -0.75 * u, 2.4 * u, 0.14 * u);
  c.restore();
}
export function lookSpec(crewMember, u) {
  const look = LOOKS[crewMember.look] ?? LOOKS[0];
  return {
    u,
    skin: SKIN_TONES[crewMember.skin] ?? SKIN_TONES[1],
    hair: HAIR_COLORS[crewMember.hair] ?? HAIR_COLORS[0],
    hairStyle: look.hair,
    top: look.outfit,
    trim: look.trim,
    bottom: look.pants,
    shoes: '#FFFFFF',
    stripe: true,
    patches: look.accessory === 'patches',
    studs: look.accessory === 'studs',
    headphones: look.accessory === 'headphones',
    clip: look.accessory === 'star',
    glitter: look.accessory === 'glitter',
    face: { brows: true, grin: true },
    board: { deck: look.trim, stripe: look.outfit, wheel: '#FFFFFF' },
  };
}
// The Pipeline's version of you: quarter-zip, lanyard, khakis, blowout, dead eyes.
export function zombieSpec(base, u) {
  return {
    ...base,
    u,
    skin: UNIFORM.skin,
    hair: UNIFORM.hair,
    hairStyle: 'blowout',
    top: UNIFORM.quarterZip,
    trim: UNIFORM.lanyard,
    bottom: UNIFORM.khaki,
    shoes: '#8C7A5B',
    stripe: false,
    patches: false,
    studs: false,
    headphones: false,
    clip: false,
    zip: true,
    lanyard: true,
    face: { dead: true },
  };
}
export function skater(c, spec, state) {
  const u = spec.u;
  const pose = skaterPose(state);
  const air = state.mode === 'air';
  const tilt = state.mode === 'wipeout' ? 0 : state.boardTilt ?? 0;
  if (state.mode === 'wipeout') {
    deck(c, u, (state.boardX ?? 3) * u, -(state.boardY ?? 0.5) * u, state.boardSpin ?? 2.6, spec.board);
  } else if (state.flip) {
    // The board flips under the feet: kick/heelflips roll on the long axis, a shove-it
    // spins flat, a 360 flip does both.
    const f = Math.min(1, state.flip.f),
      roll = ['KICKFLIP', 'HEELFLIP', '360 FLIP'].includes(state.flip.name) ? Math.cos(f * TAU) : 1,
      spin = state.flip.name === '360 FLIP' ? Math.cos(f * TAU) : state.flip.name === 'SHOVE-IT' ? Math.cos(f * Math.PI) : 1;
    c.save();
    c.translate(0, -Math.sin(f * Math.PI) * 0.9 * u);
    c.scale(Math.abs(spin) < 0.08 ? 0.08 * Math.sign(spin || 1) : spin, Math.abs(roll) < 0.1 ? 0.1 * Math.sign(roll || 1) : roll);
    deck(c, u, 0, 0, tilt, roll < 0 ? { ...spec.board, deck: spec.board?.stripe ?? P.cyan, stripe: spec.board?.deck ?? P.pink } : spec.board);
    c.restore();
  } else if (state.mode === 'slide') {
    // Sideways for a powerslide: foreshortened, with the wheels toward the camera.
    c.save();
    c.scale(0.5, 1.15);
    deck(c, u, 0, 0, 0, spec.board);
    c.restore();
  } else deck(c, u, 0, air ? -0.05 * u : 0, tilt, spec.board);
  c.save();
  if (state.mode === 'wipeout') c.translate(0, -0.2 * u);
  if (state.squash) c.scale(1 + state.squash, 1 - state.squash);
  figure(c, { ...spec, pose, face: state.face ?? spec.face, handItem: state.handItem });
  c.restore();
  if (spec.glitter) {
    c.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i++) {
      const t = (state.time ?? 0) * 2 + i * 0.37;
      star(c, (pose.head[0] + Math.sin(t * 5 + i) * 1.6) * u, (pose.head[1] - 1.5 + (t % 1) * -1.5) * u, u * 0.28, 4, 0.35);
      c.fill();
    }
  }
}
// A bottle with a burning rag, held in the throwing hand while aiming.
export function litBottle(t, spark = 0) {
  return (c, u, pose) => {
    const [hx, hy] = pose.arms[1].hand;
    c.save();
    c.translate(hx * u, hy * u);
    c.rotate(-0.5);
    rr(c, -0.3 * u, -0.2 * u, 0.6 * u, 1.5 * u, 0.22 * u);
    paint(c, '#7FE0A0', P.ink, u * 0.15);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(-0.18 * u, 0, 0.1 * u, 0.9 * u);
    rr(c, -0.12 * u, -0.75 * u, 0.24 * u, 0.6 * u, 0.06 * u);
    paint(c, '#FFF3D6', P.ink, u * 0.1);
    flames(c, 0, -0.8 * u, 0.9 * u, 1.6 * u, t, 7);
    if (spark > 0) {
      c.fillStyle = '#FFF8C2';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + t * 30;
        star(c, Math.cos(a) * (0.6 + spark) * u, -0.8 * u + Math.sin(a) * (0.6 + spark) * u, 0.18 * u, 4, 0.3);
        c.fill();
      }
    }
    c.restore();
  };
}
export function broSpec(b, u) {
  const r = (k) => rand(b.seed * 0.137 + k);
  const pick = (list, k) => list[Math.floor(r(k) * list.length) % list.length];
  const style = pick(['cap', 'flow', 'buzz', 'frosted', 'cap'], 1);
  return {
    u,
    skin: pick(BROS.skin, 2),
    hair: style === 'cap' ? pick(BROS.cap, 3) : style === 'frosted' ? '#C7924F' : pick(BROS.hair, 4),
    hairStyle: style,
    top: pick(BROS.polo, 5),
    trim: '#FFFFFF',
    bottom: pick(BROS.shorts, 6),
    shoes: pick(['#C79A6B', '#FFFFFF', '#4C58D9'], 7),
    collar: true,
    stripe: false,
    sleeve: 0.35,
    face: { shades: r(8) < 0.4 ? pick(['#2A1E4F', '#FF3EA5', '#1FE5FF'], 9) : null, brows: true, blush: b.drunk > 0.55 },
  };
}
const cup = (c, u, pose) => {
  const [x, y] = pose.arms[1].hand;
  c.save();
  c.translate(x * u, y * u);
  c.beginPath();
  c.moveTo(-0.45 * u, -0.9 * u);
  c.lineTo(0.45 * u, -0.9 * u);
  c.lineTo(0.32 * u, 0.4 * u);
  c.lineTo(-0.32 * u, 0.4 * u);
  c.closePath();
  paint(c, P.truck, P.ink, u * 0.15);
  c.fillStyle = '#FFFFFF';
  c.fillRect(-0.44 * u, -0.85 * u, 0.88 * u, 0.18 * u);
  c.restore();
};
const extinguisher = (spraying) => (c, u, pose) => {
  const [x, y] = pose.arms[0].hand;
  c.save();
  c.translate(x * u, y * u);
  c.rotate(-0.35);
  rr(c, -0.5 * u, -0.3 * u, 1 * u, 2.4 * u, 0.45 * u);
  paint(c, P.extinguisher, P.ink, u * 0.16);
  c.fillStyle = '#FFFFFF';
  c.fillRect(-0.42 * u, 0.6 * u, 0.84 * u, 0.5 * u);
  c.strokeStyle = P.ink;
  c.lineWidth = u * 0.25;
  c.beginPath();
  c.moveTo(0.1 * u, -0.3 * u);
  c.quadraticCurveTo(0.9 * u, -1 * u, 1.9 * u, -0.6 * u);
  c.stroke();
  if (spraying === 'fumble') {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    ellipse(c, -0.6 * u, 1.8 * u, 0.9 * u, 0.5 * u);
    c.fill();
  }
  c.restore();
};
export function bro(c, b, u, time) {
  const spec = broSpec(b, u);
  const t = time + (b.seed % 100) * 0.13;
  let mode = 'idle',
    hand = cup;
  switch (b.state) {
    case 'party':
      mode = Math.hypot(b.tx - b.dx, b.tz - b.z) > 0.15 ? 'walk' : 'idle';
      break;
    case 'gawk':
      mode = Math.floor(t * 0.7 + b.seed) % 3 === 0 ? 'point' : 'dance';
      break;
    case 'dance':
      mode = 'dance';
      break;
    case 'spray':
      mode = b.spraying ? 'spray' : 'run';
      hand = null;
      break;
    case 'burning':
      mode = b.mode === 'roll' ? 'roll' : 'burn';
      hand = null;
      spec.face = { ...spec.face, panic: true, shades: null };
      break;
    case 'charred':
      mode = 'cough';
      hand = null;
      spec.soot = true;
      spec.hairStyle = 'frosted';
      spec.hair = '#5B4D78';
      spec.top = mix(spec.top, '#5B4D78', 0.55);
      spec.bottom = mix(spec.bottom, '#5B4D78', 0.55);
      spec.face = { dead: false, brows: true, panic: false };
      break;
    case 'flee':
      mode = 'flee';
      hand = null;
      spec.face = { ...spec.face, panic: true };
      break;
  }
  if (b.ext > 0 && b.state !== 'burning') spec.backItem = extinguisher(b.spraying);
  if (b.ext > 0 && b.state === 'spray') spec.backItem = extinguisher(b.spraying);
  spec.handItem = mode === 'idle' || mode === 'walk' ? hand : null;
  const facing = b.facing ?? 1;
  if (mode === 'roll') {
    c.save();
    c.translate(0, -1.3 * u);
    c.rotate(t * 7);
    c.translate(0, 4.6 * u);
    figure(c, { ...spec, facing, pose: walkerPose({ mode: 'stand', time: t }) });
    c.restore();
    return;
  }
  figure(c, { ...spec, facing, pose: walkerPose({ mode, time: t, drunk: b.drunk, rate: mode === 'run' ? 2.4 : 1.6 }) });
}
export function recruiter(c, u, time, seed = 0) {
  const r = (k) => rand(seed * 0.37 + k);
  figure(c, {
    u,
    facing: 1,
    skin: r(1) < 0.5 ? UNIFORM.skin : '#C9DDB8',
    hair: UNIFORM.hair,
    hairStyle: r(2) < 0.5 ? 'blowout' : 'buzz',
    top: r(3) < 0.5 ? UNIFORM.quarterZip : '#D8CCB0',
    trim: UNIFORM.lanyard,
    bottom: UNIFORM.khaki,
    shoes: '#8C7A5B',
    zip: true,
    lanyard: true,
    face: { dead: true },
    pose: walkerPose({ mode: 'shamble', time: time + seed * 0.4, rate: 1.1 }),
    handItem: (c2, uu, pose) => {
      const [x, y] = pose.arms[1].hand;
      rr(c2, x * uu - 0.2 * uu, y * uu - 1.4 * uu, 1.2 * uu, 1.6 * uu, 0.15 * uu);
      paint(c2, '#F7F1E1', P.ink, uu * 0.14);
      c2.fillStyle = UNIFORM.lanyard;
      c2.fillRect(x * uu + 0.05 * uu, y * uu - 1.1 * uu, 0.7 * uu, 0.12 * uu);
      c2.fillRect(x * uu + 0.05 * uu, y * uu - 0.8 * uu, 0.5 * uu, 0.12 * uu);
    },
  });
}
export function firefighter(c, u, time, spraying, facing = 1) {
  figure(c, {
    u,
    facing,
    skin: '#D79A6E',
    hair: '#2B1B3F',
    hairStyle: 'buzz',
    top: '#FFD23F',
    trim: '#F3ECFF',
    bottom: '#FFD23F',
    shoes: P.ink,
    stripe: true,
    helmet: P.truck,
    face: { brows: true },
    pose: walkerPose({ mode: spraying ? 'spray' : 'idle', time }),
  });
}
export function medic(c, u, time) {
  figure(c, {
    u,
    facing: -1,
    skin: '#F2C29B',
    hair: '#5A3A2E',
    hairStyle: 'bob',
    top: '#FFFFFF',
    trim: P.mint,
    bottom: '#7FD8FF',
    shoes: '#FFFFFF',
    stripe: true,
    face: { brows: true, grin: true },
    pose: walkerPose({ mode: 'wave', time }),
  });
}
export function raccoon(c, u, time, seed = 0) {
  const hop = Math.abs(Math.sin(time * 9 + seed)) * 0.5 * u;
  c.save();
  c.translate(0, -hop);
  ellipse(c, 0, -1.1 * u, 1.5 * u, 1.05 * u);
  paint(c, '#B9AFD6', P.ink, u * 0.2);
  // Ringed tail
  c.save();
  c.translate(-1.4 * u, -1.2 * u);
  c.rotate(-0.6 + Math.sin(time * 6 + seed) * 0.3);
  rr(c, -2 * u, -0.38 * u, 2 * u, 0.76 * u, 0.38 * u);
  paint(c, '#B9AFD6', P.ink, u * 0.18);
  c.fillStyle = '#5B4D78';
  for (const x of [-1.6, -0.9]) c.fillRect(x * u, -0.36 * u, 0.32 * u, 0.72 * u);
  c.restore();
  ellipse(c, 1.3 * u, -1.8 * u, 0.9 * u, 0.8 * u);
  paint(c, '#D9D2F0', P.ink, u * 0.2);
  ellipse(c, 1.45 * u, -1.85 * u, 0.62 * u, 0.26 * u);
  c.fillStyle = '#4A3D7A';
  c.fill();
  for (const x of [1.2, 1.7]) {
    ellipse(c, x * u, -1.88 * u, 0.13 * u, 0.13 * u);
    c.fillStyle = '#FFFFFF';
    c.fill();
  }
  for (const x of [0.85, 1.65]) {
    poly2(c, [
      [x * u - 0.25 * u, -2.4 * u],
      [x * u, -2.9 * u],
      [x * u + 0.25 * u, -2.4 * u],
    ]);
    paint(c, '#B9AFD6', P.ink, u * 0.15);
  }
  c.restore();
}
export function bee(c, x, y, s, t) {
  ellipse(c, x, y, s * 1.2, s * 0.85);
  paint(c, P.sun, P.ink, Math.max(1, s * 0.3));
  c.fillStyle = P.ink;
  c.fillRect(x - s * 0.2, y - s * 0.8, s * 0.35, s * 1.6);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  const flap = Math.sin(t * 60) * 0.5 + 0.5;
  ellipse(c, x - s * 0.2, y - s * (0.9 + flap * 0.3), s * 0.6, s * 0.35, -0.4);
  c.fill();
}
// Bonus skaters reuse the same rig with their own styling.
export function bonusSpec(sk, u) {
  return {
    u,
    skin: sk.skin,
    hair: sk.hair,
    hairStyle: sk.style,
    top: sk.outfit,
    trim: sk.trim,
    bottom: darken(sk.outfit, 0.25),
    shoes: '#FFFFFF',
    stripe: true,
    helmet: sk.helmet,
    face: { brows: true, grin: true },
    board: { deck: sk.trim, stripe: sk.outfit, wheel: '#FFFFFF' },
  };
}
