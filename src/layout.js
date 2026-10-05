// One projection and visibility contract for rendering, bots, and fairness audits.
export function layout(width, height, model) {
  const portrait = height > width,
    touch = width <= 900,
    safeTop = 0;
  return {
    width,
    height,
    portrait,
    touch,
    safeTop,
    hud: portrait ? 56 : height < 500 ? 52 : 88,
    controls: touch ? Math.min(140, height * 0.17) : 0,
    cameraX: model.cameraX,
    playerX: model.player.x,
    scale: portrait ? Math.min(18, height * 0.027) : width / 29,
    depthScale: portrait ? width * 0.07 : Math.min(26, height * (height < 500 ? 0.028 : 0.037)),
    originX: portrait ? width * 0.59 : width * 0.5,
    originY: portrait ? height * 0.775 : height * (height < 500 ? 0.63 : 0.67),
    figureScale: portrait ? 0.78 : height < 500 ? 0.64 : 1.1,
  };
}
export function project(view, x, z, y = 0) {
  if (view.portrait) {
    const dx = x - view.playerX;
    const forward = dx >= 0 ? dx * view.scale : dx * 2;
    return {
      x: view.originX + z * view.depthScale,
      y: view.originY - forward - y * 22 * view.figureScale,
    };
  }
  return {
    x: view.originX + (x - view.cameraX) * view.scale,
    y: view.originY + z * view.depthScale - y * 22 * view.figureScale,
  };
}
// Project the real base ellipse rather than guessing a screen-space radius.
// Portrait's compressed space behind the player must use the same mapping.
export function projectEllipse(view, x, z, rx, rz) {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = (i * Math.PI) / 12;
    const p = project(view, x + Math.cos(angle) * rx, z + Math.sin(angle) * rz);
    return [p.x, p.y];
  });
}
export function visible(view, entity, { radius = 12 } = {}) {
  const p = project(view, entity.x, entity.z);
  return (
    p.x - radius >= 0 &&
    p.x + radius <= view.width &&
    p.y - radius >= view.hud &&
    p.y + radius <= view.height - view.controls
  );
}
export function perceive(model, width = 1440, height = 900) {
  const view = layout(width, height, model);
  const p = model.player;
  return {
    time: model.time,
    beat: model.beat,
    phase: model.phase,
    lives: model.lives,
    score: model.score,
    burned: model.burned,
    ammo: model.ammo,
    riot: model.riot,
    charge: model.charge ? { started: model.charge.started } : null,
    player: {
      x: p.x,
      z: p.z,
      vx: p.vx,
      jumpHeight: p.jumpHeight,
      jumpVelocity: p.jumpVelocity,
      landingLag: p.landingLag,
      pushCooldown: p.pushCooldown,
      pushAge: p.pushAge,
      pipeline: p.pipeline,
      pitchLock: p.pitchLock,
    },
    arena: model.arena
      ? {
          id: model.arena.id,
          x: model.arena.x,
          guard: model.arena.guard,
          state: model.arena.state,
          timer: model.arena.timer,
          chunk: model.arena.chunk,
        }
      : null,
    nextHouse: model.houses.find((h) => !h.burned && visible(view, { x: h.x, z: -6.6 }))?.x,
    enemies: model.enemies
      .filter((e) => visible(view, e))
      .map((e) => ({ id: e.id, kind: e.kind, x: e.x, z: e.z, state: e.state })),
    attacks: model.attacks
      .filter((a) => visible(view, { x: a.targetX, z: a.targetZ }))
      .map((a) => ({
        id: a.id,
        owner: a.owner,
        kind: a.kind,
        height: a.height,
        x: a.targetX,
        z: a.targetZ,
        state: a.state,
        strikeBeat: a.strikeBeat,
      })),
    coffee: model.coffeeStands
      .filter((e) => e.active && !e.served && visible(view, e))
      .map((e) => ({ x: e.x, z: e.z })),
  };
}
