import { C } from '../data/strings.js';
import { createPlayer } from './player.js';
// Paperboy's training course, reimagined as a skate school on the campus quad. Each
// station teaches one verb with a hero thought bubble; miss it and you loop back
// (twice at most), then the course moves on. Unlimited bottles, no Pipeline.
const LANE = 0.2;
export const STATIONS = [
  { id: 'kick', x0: 0, x1: 36 },
  { id: 'glide', x0: 36, x1: 52 },
  { id: 'slow', x0: 52, x1: 70 },
  { id: 'ollie', x0: 70, x1: 104, cones: [80, 88, 96] },
  // The throw lesson is a slow zone: three cans 22 m apart, light all three.
  { id: 'throw', x0: 104, x1: 184, cans: [[120, -5.4], [142, -6.4], [164, -7.4]], slow: 3.6 },
  { id: 'backflip', x0: 184, x1: 218, ramp: 192 },
  { id: 'grind', x0: 218, x1: 250, rail: [225, 239] },
  { id: 'flip', x0: 250, x1: 282, ramp: 258 },
  { id: 'pipeline', x0: 282, x1: 314 },
];
export const COURSE_LENGTH = 314;
export const THROW_GOAL = 3;
function station(m) {
  return STATIONS[m.course.station];
}
function buildStation(m) {
  const st = station(m),
    c = m.course;
  c.hazards = [];
  c.cans = [];
  c.rails = [];
  let id = 70000 + c.station * 20;
  for (const x of st.cones ?? [])
    c.hazards.push({ id: ++id, kind: 'cone', s: x, z: LANE, z0: LANE, hx: 0.3, hz: 0.3, h: 0.7, abs: true, taken: false });
  if (st.ramp !== undefined)
    c.hazards.push({ id: ++id, kind: 'ramp', s: st.ramp, z: LANE, z0: LANE, hx: 0.9, hz: 0.7, h: 0, abs: true, taken: false });
  for (const [x, z] of st.cans ?? []) c.cans.push({ id: ++id, x, z, state: 'ready', fuel: 0 });
  if (st.rail) {
    const [s0, s1] = st.rail;
    c.rails.push({ id: ++id, kind: 'rail', s0, s1, z: LANE, h: 0.45, abs: true });
    c.hazards.push({ id: ++id, kind: 'flatbar', s: (s0 + s1) / 2, z: LANE, z0: LANE, hx: (s1 - s0) / 2, hz: 0.22, h: 0.45, abs: true, taken: false, rail: true });
  }
  m.hazards = c.hazards;
  m.rails = c.rails;
  c.progress = 0;
  c.hits = 0;
  c.slowed = false;
  c.done = false;
  m.emit('station', null, { station: st.id, index: c.station, tries: c.tries });
}
// Jump straight to a station (dev scenes and tests).
export function gotoStation(m, index) {
  m.course.station = index;
  m.course.tries = 0;
  m.player.x = STATIONS[index].x0 + 1;
  buildStation(m);
}
export function startTraining(m) {
  // Park the Row's lap-1 street; beginRow puts it back when the course ends.
  if (m.level !== 'training') {
    m.rowHazards = m.hazards;
    m.rowRails = m.rails;
  }
  m.level = 'training';
  m.phase = 'training';
  m.phaseTime = 0;
  m.player = createPlayer(0, 0);
  m.player.z = LANE;
  m.course = { station: 0, tries: 0, progress: 0, done: false, hazards: [], cans: [], rails: [], cleared: 0, completed: [] };
  m.emit('trainingStart', C.training);
  buildStation(m);
}
export function trainingCan(m, x, z) {
  return m.course?.cans.find((c) => c.state === 'ready' && Math.abs(c.x - x) < 0.01 && Math.abs(c.z - z) < 0.01);
}
// Called for every sim event while training, so stations can watch for their verb.
export function trainingEvent(m, e) {
  const c = m.course;
  if (!c || c.done) return;
  const id = station(m).id;
  const complete = () => {
    c.done = true;
    c.completed.push(id);
    m.emit('stationDone', C.nice, { station: id });
  };
  if (id === 'ollie' && e.type === 'land' && e.clean && c.cleared >= 1) complete();
  else if (id === 'backflip' && e.type === 'trick' && /BACKFLIP/.test(e.text)) complete();
  else if (id === 'grind' && e.type === 'grindEnd' && e.seconds >= 0.3) complete();
  else if (id === 'flip' && e.type === 'trick' && ['KICKFLIP', 'HEELFLIP', '360 FLIP', 'SHOVE-IT'].includes(e.text)) complete();
  else if (id === 'throw' && e.type === 'practiceHit') {
    c.hits++;
    c.progress = Math.min(1, c.hits / THROW_GOAL);
    e.text = `${c.hits} / ${THROW_GOAL} LIT!`;
    if (c.hits >= THROW_GOAL) complete();
  }
}
export function updateTraining(m, dt) {
  const c = m.course,
    p = m.player,
    st = station(m);
  m.bottles = 99;
  for (const can of c.cans)
    if (can.state === 'burning') {
      can.fuel -= dt;
      if (can.fuel <= 0) can.state = 'ready';
    }
  // Slow zone: no rushing the throw lesson until every can is lit.
  // Rolling in fast eases down to the zone speed; once there, kicks can't exceed it.
  if (st.slow && !c.done && p.grounded && p.vx > st.slow) {
    p.vx = c.slowed ? st.slow : Math.max(st.slow, p.vx - 6 * dt);
    if (p.vx <= st.slow) c.slowed = true;
  }
  if (!c.done) {
    if (st.id === 'kick') {
      c.progress = Math.min(1, p.vx / 7);
      if (p.vx >= 7) {
        c.done = true;
        c.completed.push('kick');
        m.emit('stationDone', C.nice, { station: 'kick' });
      }
    } else if (st.id === 'glide') {
      c.progress = Math.abs(m.move.x) < 0.15 && p.grounded ? c.progress + dt / 1.2 : Math.max(0, c.progress - dt);
      if (c.progress >= 1) {
        c.done = true;
        c.completed.push('glide');
        m.emit('stationDone', C.nice, { station: 'glide' });
      }
    } else if (st.id === 'slow') {
      c.progress = p.sliding || p.dragging ? c.progress + dt / 0.4 : c.progress;
      if (c.progress >= 1) {
        c.done = true;
        c.completed.push('slow');
        m.emit('stationDone', C.nice, { station: 'slow' });
      }
    } else if (st.id === 'pipeline' && p.x >= st.x0 + 6) {
      c.done = true;
      c.completed.push('pipeline');
    }
    if (st.id === 'ollie')
      for (const o of c.hazards) if (o.kind === 'cone' && !o.cleared && p.x > o.s + 0.4 && p.y > 0.2) {
        o.cleared = true;
        c.cleared++;
      }
  }
  // Never let anyone stall out in training: a gentle floor on speed.
  if (p.wipeout <= 0 && p.grounded && p.vx < 2.4 && (st.id !== 'slow' || c.done)) p.vx = Math.min(2.4, p.vx + 2 * dt);
  if (p.x >= st.x1) {
    // Lighting at least one practice can is enough to move on at the end of the zone.
    if (!c.done && st.id === 'throw' && c.hits >= 1) {
      c.done = true;
      c.completed.push('throw');
      m.emit('stationDone', C.nice, { station: 'throw' });
    }
    if (!c.done && c.tries < 2 && st.id !== 'pipeline') {
      c.tries++;
      p.x = st.x0 + 2;
      m.emit('stationRetry', C.again, { station: st.id, tries: c.tries });
      buildStation(m);
      return;
    }
    c.station++;
    c.tries = 0;
    if (c.station >= STATIONS.length) {
      finishTraining(m);
      return;
    }
    buildStation(m);
  }
}
export function finishTraining(m) {
  m.course = null;
  m.emit('trainingDone', C.dropIn);
  m.beginRow();
}
