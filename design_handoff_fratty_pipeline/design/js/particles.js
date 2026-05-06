// Particle system — drawn into a Phaser graphics layer
window.FP = window.FP || {};
class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.g = scene.add.graphics();
    this.g.setDepth(80);
  }
  burst(x, y, opts = {}) {
    const n = opts.count || 12;
    const speed = opts.speed || 120;
    const colors = opts.colors || [0xff2d6f, 0xff7a00, 0xffd23f];
    const life = opts.life || 600;
    const size = opts.size || 4;
    const gravity = opts.gravity ?? 220;
    const shape = opts.shape || 'rect';
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random() * 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - (opts.upward || 0),
        life, age: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
        shape,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 8,
        drag: opts.drag ?? 0.98,
      });
    }
  }
  smoke(x, y, opts = {}) {
    const n = opts.count || 6;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
        life: 900, age: 0,
        color: opts.dark ? 0x222222 : 0x888888,
        size: 6 + Math.random() * 6,
        gravity: 0,
        shape: 'circle',
        rot: 0, rotV: 0,
        drag: 0.99,
        fade: true,
      });
    }
  }
  trail(x, y, color = 0xff2d6f) {
    this.particles.push({
      x, y, vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30,
      life: 300, age: 0, color, size: 3, gravity: 0,
      shape: 'circle', rot: 0, rotV: 0, drag: 0.92, fade: true,
    });
  }
  update(dt) {
    const dts = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += p.gravity * dts;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rot += p.rotV * dts;
    }
    this.draw();
  }
  draw() {
    this.g.clear();
    for (const p of this.particles) {
      const t = p.age / p.life;
      const alpha = p.fade ? (1 - t) : (1 - t * t * 0.5);
      this.g.fillStyle(p.color, alpha);
      if (p.shape === 'circle') {
        this.g.fillCircle(p.x, p.y, p.size * (1 - t * 0.3));
      } else {
        const s = p.size * (1 - t * 0.5);
        this.g.fillRect(p.x - s/2, p.y - s/2, s, s);
      }
    }
  }
}
FP.ParticleSystem = ParticleSystem;
