// One projection and visibility contract for the renderer, bots and fairness checks.
import { Z, near, objX, ROW, ring } from './sim/row.js';
import { railSpan } from './sim/rails.js';
import { STATIONS } from './sim/training.js';
import { aim, stock } from './sim/throw.js';
export const DEPTH = Object.freeze({ top: Z.facade, bottom: Z.edge });
const SPAN = DEPTH.bottom - DEPTH.top;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const cameraLead = (vx) => clamp(vx * 0.35, 0, 3);
export function layout(width, height, model, lead = cameraLead(model.player.vx)) {
  const portrait = height > width * 1.05,
    touch = portrait || width <= 900 || height <= 500;
  // A 26 m wide window (it was 34): a bigger skater and fewer things competing for the eye.
  const S = portrait ? width / 14 : Math.min(width / 26, height / 11.5);
  const viewM = width / S;
  const hud = portrait ? 76 : height < 520 ? 44 : 66;
  const controls = touch ? Math.min(170, height * (portrait ? 0.22 : 0.34)) : 0;
  const playerFrac = portrait ? 0.24 : 0.32;
  const bottom = height - (portrait ? controls * 0.9 : touch ? controls * 0.25 : 6);
  const houseH = 6.9 * S;
  const Dz = clamp((bottom - (hud + houseH * 0.9)) / SPAN, 0.36 * S, 1.15 * S);
  const groundTop = bottom - SPAN * Dz;
  const cameraX = model.player.x + lead;
  return {
    width,
    height,
    portrait,
    touch,
    S,
    Dz,
    viewM,
    hud,
    controls,
    playerFrac,
    bottom,
    groundTop,
    cameraX,
    left: cameraX - playerFrac * viewM,
  };
}
export function project(view, x, z, y = 0) {
  return { x: (x - view.left) * view.S, y: view.groundTop + (z - DEPTH.top) * view.Dz - y * view.S };
}
// Things further back are drawn a little smaller. Cosmetic only; hitboxes are in meters.
export const depthScale = (z) => 0.84 + (0.16 * (z - DEPTH.top)) / SPAN;
export function visible(view, x, z, y = 0, margin = 0) {
  const p = project(view, x, z, y);
  return (
    p.x >= -margin &&
    p.x <= view.width + margin &&
    p.y >= view.hud - margin &&
    p.y <= view.height - view.controls * 0.5 + margin
  );
}
// What a fair bot may know: only what is on screen, through the same projection.
export function perceive(model, width = 1440, height = 900) {
  const view = layout(width, height, model),
    p = model.player;
  const onScreen = (x, z, y = 0) => visible(view, x, z, y, 20);
  const houses = model.houses
    .map((h) => ({ h, x: near(h.s, p.x) }))
    .filter(({ x }) => x > view.left - 10 && x < view.left + view.viewM + 10)
    .map(({ h, x }) => ({
      id: h.id,
      x,
      state: h.state,
      gone: h.gone,
      empty: h.empty,
      fire: h.fire,
      can: { x: x + h.can.dx, z: h.can.z, state: h.can.state },
      windows: h.facade.windows.map((w) => ({ x: x + w.dx, y: w.y })),
      door: x + h.facade.door.dx,
      fryer: Boolean(h.fryer),
      sub: Boolean(h.sub),
      raccoons: Boolean(h.raccoons),
      balloons: h.balloons,
      truck: h.fd ? h.fd.stage : null,
    }));
  const hazards = model.hazards
    .filter((o) => !o.taken)
    .map((o) => ({ ...o, x: objX(o, p.x) }))
    .filter((o) => onScreen(o.x, o.z))
    .map(({ id, kind, x, z, hx, hz, h, rail }) => ({ id, kind, x, z, hx, hz, h, rail: Boolean(rail) }));
  // Grindable edges on screen; solid ones (benches) also block the sidewalk.
  const rails = model.rails
    .map((r) => {
      const [x0, x1] = railSpan(model, r);
      return { id: r.id, kind: r.kind, x0, x1, z: r.z, h: r.h, solid: Boolean(r.solid) };
    })
    .filter((r) => r.x1 > view.left && r.x0 < view.left + view.viewM);
  const carts = model.carts
    .filter((c) => onScreen(c.x, c.z))
    .map(({ x, z, vx, hx, hz }) => ({ x, z, vx, hx, hz }));
  const shops = ROW.shops
    .map((s, i) => ({ id: i, x: near(s.s, p.x), visited: model.shopVisits[i] === model.lap }))
    .filter((s) => s.x > p.x - 2 && s.x < view.left + view.viewM + 4);
  return {
    time: model.time,
    phase: model.phase,
    level: model.level,
    difficulty: model.difficulty,
    lap: model.lap,
    ring: ring(p.x),
    lives: model.lives,
    score: model.score,
    destroyed: model.destroyed,
    bottles: Math.floor(model.bottles),
    item: model.item,
    stock: stock(model),
    items: { ...model.items },
    unlocked: { ...model.unlocked },
    aiming: model.aiming,
    aim: ['playing', 'rescue', 'training'].includes(model.phase) && model.level !== 'alley' ? aim(model) : null,
    player: {
      x: p.x,
      z: p.z,
      y: p.y,
      vx: p.vx,
      grounded: p.grounded,
      grind: Boolean(p.grind),
      rot: p.rot,
      flip: Boolean(p.flip),
      wipeout: p.wipeout,
      invulnerable: p.invulnerable,
      pushCooldown: p.pushCooldown,
    },
    horde: { gap: model.horde.gap, speed: model.horde.speed },
    houses,
    hazards,
    rails,
    carts,
    shops,
    course: model.course
      ? {
          station: STATIONS[model.course.station].id,
          x0: STATIONS[model.course.station].x0,
          x1: STATIONS[model.course.station].x1,
          done: model.course.done,
          cans: model.course.cans.filter((can) => can.state === 'ready').map(({ x, z }) => ({ x, z })),
        }
      : null,
    alley: model.alley
      ? { hives: model.alley.hives.filter((h) => !h.taken && onScreen(h.x, h.z, h.h)).map(({ x, z, h }) => ({ x, z, h })), still: model.alley.still }
      : null,
    combo: { active: model.combo.active, points: model.combo.points, parts: model.combo.parts.length },
    flow: model.flow,
    flowTime: model.flowTime,
    zombie: model.zombie ? { x: model.zombie.x, z: model.zombie.z, state: model.zombie.state } : null,
    ambulance: model.ambulance ? { x: model.ambulance.x, z: model.ambulance.z } : null,
    bonus: model.bonus && model.phase === 'bonus'
      ? { stage: model.bonus.stage, x: model.bonus.x, thrown: Boolean(model.bonus.thrown), pass: model.bonus.pass }
      : null,
  };
}
