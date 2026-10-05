const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const palettes = [
  { wall: '#adadb9', shade: '#78798d', trim: '#f4e7d5', roof: '#33344e', door: '#d16779' },
  { wall: '#bc859b', shade: '#916c8a', trim: '#ffe3da', roof: '#43334d', door: '#718c8d' },
  { wall: '#8eacaa', shade: '#638487', trim: '#f5e4d4', roof: '#323c51', door: '#d39478' },
  { wall: '#b3a0c2', shade: '#847891', trim: '#f2e6d8', roof: '#3d344d', door: '#6b7b94' },
  { wall: '#c5a081', shade: '#9a7a74', trim: '#f6e3c7', roof: '#393b53', door: '#6e979a' },
  { wall: '#889bbd', shade: '#657b9e', trim: '#f0e4dc', roof: '#30384f', door: '#b47692' },
];
function colorMix(a, b, amount) {
  const aa = parseInt(a.slice(1), 16), bb = parseInt(b.slice(1), 16);
  const rgb = [16, 8, 0].map(shift => Math.round(lerp((aa >> shift) & 255, (bb >> shift) & 255, amount)));
  return `rgb(${rgb.join(',')})`;
}

/** Flat, illustrated belt scroller. x follows the street; z is walking depth. */
export class WorldRenderer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Greek Row: an illustrated side scrolling punk street with four direction movement');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.renderer = { domElement: this.canvas };
    container.appendChild(this.canvas);
    this.particles = [];
    this.focus = null;
    this.portrait = false;
    this.idleTime = 0;
    this.resize();
  }

  resize() {
    this.width = Math.max(1, this.container.clientWidth || window.innerWidth);
    this.height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.layout();
  }

  layout() {
    const w = this.width, h = this.height;
    if (this.portrait) {
      this.top = Math.min(175, h * 0.23);
      this.bottom = Math.max(this.top + 170, h - Math.min(218, h * 0.28));
      this.originX = w * 0.62;
      this.originY = this.bottom - (this.bottom - this.top) * 0.2;
      this.scale = clamp((this.bottom - this.top) / 25, 10, 26);
      this.depthScale = w * 0.027;
      this.figureScale = clamp(w / 510, 0.68, 0.97);
    } else {
      this.top = Math.max(145, Math.min(h * 0.535, h - 245));
      this.bottom = h - Math.min(122, h * 0.16);
      this.originX = w * (this.title ? 0.56 : 0.33);
      this.originY = (this.top + this.bottom) / 2;
      this.scale = clamp(w / 42, 17, 42);
      this.depthScale = (this.bottom - this.top) / 11.5;
      this.figureScale = clamp(h / 760, 0.66, 1.18);
    }
  }

  project(x, z, y = 0) {
    if (this.portrait) return {
      x: this.originX + z * this.depthScale,
      y: this.originY - (x - (this.focus || 0)) * this.scale - y * this.figureScale * 20,
    };
    return {
      x: this.originX + (x - (this.focus || 0)) * this.scale,
      y: this.originY + z * this.depthScale - y * this.figureScale * 20,
    };
  }

  rect(x, y, w, h, fill, radius = 0, stroke, lineWidth = 1) {
    const c = this.ctx;
    c.beginPath();
    if (radius) c.roundRect(x, y, w, h, radius); else c.rect(x, y, w, h);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth; c.stroke(); }
  }

  oval(x, y, rx, ry, fill, stroke, width = 1) {
    const c = this.ctx;
    c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }

  line(points, stroke, width = 2, closed = false, fill) {
    const c = this.ctx;
    c.beginPath(); points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y));
    if (closed) c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  }

  text(text, x, y, size, color, weight = 800, align = 'center') {
    const c = this.ctx;
    c.fillStyle = color; c.font = `${weight} ${size}px "Arial", sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillText(text, x, y);
  }

  background(time) {
    const c = this.ctx, w = this.width, h = this.height;
    const sky = c.createLinearGradient(0, 0, 0, h * 0.69);
    sky.addColorStop(0, '#17182f'); sky.addColorStop(0.45, '#554268'); sky.addColorStop(0.8, '#b46c8c'); sky.addColorStop(1, '#df959b');
    this.rect(0, 0, w, h, sky);
    const moonX = w * 0.78, moonY = Math.max(80, h * 0.16);
    const moonGlow = c.createRadialGradient(moonX, moonY, 5, moonX, moonY, 130);
    moonGlow.addColorStop(0, '#ffd2c52f'); moonGlow.addColorStop(1, '#ffd2c500');
    this.oval(moonX, moonY, 130, 130, moonGlow);
    this.oval(moonX, moonY, this.portrait ? 25 : 37, this.portrait ? 25 : 37, '#ffe3cf');
    this.oval(moonX + 10, moonY - 12, 6, 6, '#e5c4bc55');
    this.oval(moonX - 12, moonY + 11, 10, 7, '#e5c4bc55');
    for (let i = 0; i < 42; i++) {
      const x = ((i * 127.7 + 17) % w), y = 20 + ((i * 73.1) % (h * 0.31));
      const opacity = 0.3 + Math.sin(i + time * 0.35) * 0.16;
      c.globalAlpha = opacity; this.oval(x, y, i % 7 ? 1 : 1.8, i % 7 ? 1 : 1.8, '#fff2dd');
    }
    c.globalAlpha = 1;
    if (this.portrait) return;
    for (let layer = 0; layer < 2; layer++) {
      const base = this.top - (layer ? 4 : 35), step = layer ? 112 : 87;
      const shift = (this.focus || 0) * this.scale * (layer ? 0.16 : 0.075);
      const start = Math.floor(shift / step) - 2;
      for (let i = start; i < start + w / step + 5; i++) {
        const seed = Math.abs(i * 13 + layer * 7);
        const x = i * step - shift, bh = 80 + ((seed * 17) % 91);
        this.rect(x, base - bh, step - 3, bh, layer ? '#403851' : '#61506d');
        if (i % 3 === 0) this.rect(x + 20, base - bh - 13, step - 43, 14, layer ? '#403851' : '#61506d');
        if (i % 4 === 0) this.line([[x + step / 2, base - bh], [x + step / 2, base - bh - 33]], '#544563', 2);
        for (let j = 0; j < 12; j++) if ((seed + j * 3) % 5 < 2) {
          this.rect(x + 15 + (j % 4) * 20, base - bh + 20 + Math.floor(j / 4) * 26, 6, 10, layer ? '#efbc974b' : '#f3c1a133', 1);
        }
      }
    }
    // Soft horizontal cloud ribbons keep the silhouette graphic and side-on.
    c.globalAlpha = 0.15;
    this.oval(w * 0.2, h * 0.235, w * 0.2, 10, '#edb3c4');
    this.oval(w * 0.57, h * 0.31, w * 0.18, 7, '#edb3c4');
    c.globalAlpha = 1;
  }

  street(time) {
    const c = this.ctx, w = this.width, h = this.height;
    if (this.portrait) {
      const left = this.originX - this.depthScale * 5.75, right = this.originX + this.depthScale * 5.75;
      this.rect(0, 0, left - 12, h, '#384b51');
      this.rect(left - 16, 0, 16, h, '#b2a0a2');
      this.rect(left - 3, 0, 3, h, '#e6cbbb');
      const asphalt = c.createLinearGradient(left, 0, right, 0);
      asphalt.addColorStop(0, '#363747'); asphalt.addColorStop(0.5, '#444253'); asphalt.addColorStop(1, '#313646');
      this.rect(left, 0, right - left, h, asphalt);
      this.rect(right, 0, w - right, h, '#756c7f');
      this.rect(right, 0, 3, h, '#d4bcc0');
      this.rect(left + 8, 0, 2, h, '#dfbf8a6b');
      this.rect(right - 11, 0, 2, h, '#dfbf8a6b');
      const step = this.scale * 4.5, offset = ((this.originY + (this.focus || 0) * this.scale) % step);
      for (let y = offset - step; y < h + step; y += step) {
        this.rect(this.originX - 3, y, 2, step * 0.43, '#d8c5b57a', 1);
        this.rect(this.originX + 3, y, 2, step * 0.43, '#d8c5b57a', 1);
        this.line([[left - 16, y], [left, y]], '#75657c', 1);
        this.line([[right, y], [w, y]], '#5c526d', 1);
      }
      for (let i = 0; i < 70; i++) {
        const x = left + (i * 47.3) % (right - left), y = ((i * 71.7 + this.focus * this.scale) % h + h) % h;
        this.rect(x, y, 2, 1, '#e0c8c214');
      }
      return;
    }
    const lawnTop = this.top - 44;
    const lawn = c.createLinearGradient(0, lawnTop, 0, this.top);
    lawn.addColorStop(0, '#3e7264'); lawn.addColorStop(1, '#5d9370');
    this.rect(0, lawnTop, w, 48, lawn);
    const shift = this.focus * this.scale;
    for (let x = -((shift % 19) + 19); x < w; x += 19) {
      this.line([[x, this.top - 15], [x + 3, this.top - 23], [x + 4, this.top - 15], [x + 8, this.top - 19]], '#9cac7338', 1);
    }
    this.rect(0, this.top - 7, w, 17, '#c3aead');
    this.rect(0, this.top + 7, w, 5, '#55485e');
    this.rect(0, this.top - 7, w, 2, '#f2d4bc');
    const asphalt = c.createLinearGradient(0, this.top + 11, 0, this.bottom);
    asphalt.addColorStop(0, '#383a4b'); asphalt.addColorStop(0.52, '#454352'); asphalt.addColorStop(1, '#303746');
    this.rect(0, this.top + 12, w, this.bottom - this.top, asphalt);
    this.rect(0, this.top + 20, w, 2, '#d6b68470');
    this.rect(0, this.bottom - 10, w, 2, '#d6b68470');
    const step = 5 * this.scale, lineY = this.originY + 8;
    for (let x = -((shift % step) + step); x < w + step; x += step) {
      this.rect(x, lineY, this.scale * 2.3, 2, '#d5c7b16b', 1);
      this.rect(x, lineY + 6, this.scale * 2.3, 2, '#d5c7b16b', 1);
      this.line([[x, this.top - 7], [x, this.top + 7]], '#8d7884', 1);
    }
    for (let i = 0; i < 95; i++) {
      const x = ((i * 91.37 - shift * 0.9) % w + w) % w, y = this.top + 28 + (i * 27.7) % Math.max(1, this.bottom - this.top - 45);
      this.rect(x, y, 2 + i % 3, 1, '#debfbb14');
    }
    this.rect(0, this.bottom + 2, w, h - this.bottom, '#433b51');
    this.rect(0, this.bottom + 2, w, 7, '#a78f9d');
    this.rect(0, this.bottom + 2, w, 2, '#e0bac0');
    for (let x = -((shift % 83) + 83); x < w; x += 83) this.line([[x, this.bottom + 9], [x, h]], '#645269', 1);
    // A few flat sidewalk flyers and storm drains give the roadway a lived-in feel.
    for (let worldX = Math.floor(this.focus / 12) * 12 - 12; worldX < this.focus + 50; worldX += 12) {
      const x = this.project(worldX, 0).x;
      this.rect(x + 40, this.bottom - 4, 40, 5, '#202b39', 1);
      for (let j = 0; j < 7; j++) this.rect(x + 44 + j * 5, this.bottom - 4, 1, 5, '#76808a');
      if (worldX % 24 === 0) {
        c.save(); c.translate(x, this.bottom + 21); c.rotate(-0.14);
        this.rect(-11, -7, 23, 16, '#d5b993'); this.text('LOUD', 0, -1, 5, '#393149'); c.restore();
      }
    }
  }

  house(house, index, time, active) {
    if (this.portrait) { this.portraitHouse(house, index, time, active); return; }
    const center = this.project(house.x, -6.6);
    // Short landscape phones need the entire facade above the road; shrink the
    // building uniformly while keeping skating figures and road lanes full size.
    const houseHeight = this.height < 580 ? Math.max(100, this.top - 34) : Infinity;
    const width = Math.min(this.scale * 12.7, 440, houseHeight * 330 / 267), scale = width / 330;
    if (center.x + width < -100 || center.x - width > this.width + 100) return;
    const c = this.ctx;
    c.save(); c.translate(center.x, this.top - 16); c.scale(scale, scale);
    this.facade(house, index, time);
    c.restore();
    if (active && !house.burned) this.lawnTarget(center.x, this.top - 21, Math.min(97, width * 0.26), 10, time, house);
  }

  facade(house, index, time) {
    const c = this.ctx, p = palettes[index % palettes.length], burned = house.burned;
    const wall = burned ? '#665060' : p.wall, trim = burned ? '#a78d87' : p.trim;
    this.oval(0, 2, 174, 10, '#192c3c5c');
    this.rect(-158, -5, 316, 12, '#b49f9b', 2);
    this.rect(-150, -190, 300, 182, wall, 2, '#343549', 3);
    this.rect(-150, -190, 300, 14, burned ? '#594353' : p.shade);
    for (let y = -163; y < -18; y += 13) this.line([[-149, y], [149, y]], burned ? '#46384339' : '#fbe0d232', 1);
    // All facades and cornices face the viewer; the roof has no receding planes.
    this.line([[-172, -190], [0, -267], [172, -190]], '#272e43', 5, true, burned ? '#382f43' : p.roof);
    this.line([[-155, -194], [0, -254], [155, -194]], trim, 4);
    this.rect(-169, -193, 338, 11, trim, 1);
    this.rect(-146, -186, 292, 4, '#40394b44');
    this.rect(99, -248, 22, 49, burned ? '#63505a' : '#9f7c84', 1);
    this.rect(95, -252, 30, 7, '#cfada5', 1);
    this.oval(0, -221, 15, 15, '#554857', trim, 4);
    this.line([[-12, -221], [12, -221]], trim, 2);
    this.line([[0, -233], [0, -209]], trim, 2);
    for (const x of [-109, -56, 56, 109]) this.window(x, -151, 26, 37, trim, burned, index + x);
    for (const x of [-113, 113]) this.window(x, -77, 33, 43, trim, burned, index + x + 4);
    this.rect(-23, -82, 46, 74, burned ? '#463242' : p.door, 4, trim, 5);
    this.rect(-15, -72, 30, 19, burned ? '#e7663470' : '#e7ac8f', 2);
    this.rect(-15, -45, 13, 25, '#4b3b5536', 1);
    this.rect(3, -45, 13, 25, '#4b3b5536', 1);
    this.oval(13, -43, 2.2, 2.2, '#f3d394');
    // Wide porch, paired columns, straight balustrade, and flat steps.
    this.rect(-91, -95, 182, 11, trim, 2);
    this.rect(-91, -84, 182, 5, '#4640525c');
    for (const x of [-76, -43, 43, 76]) {
      this.rect(x - 5, -82, 10, 65, trim, 1);
      this.rect(x - 8, -85, 16, 6, '#f5e1cb', 1);
      this.rect(x - 8, -20, 16, 7, '#d3bcac', 1);
      this.rect(x + 2, -79, 2, 55, '#63526326');
    }
    for (const side of [-1, 1]) {
      this.rect(side < 0 ? -88 : 32, -45, 56, 4, trim);
      this.rect(side < 0 ? -88 : 32, -21, 56, 4, trim);
      for (let j = 0; j < 6; j++) this.rect((side < 0 ? -86 : 34) + j * 10, -42, 3, 23, trim);
    }
    this.rect(-95, -14, 190, 8, '#c5b3aa', 1);
    this.rect(-45, -6, 90, 5, '#e3c9b2', 1);
    this.rect(-51, -1, 102, 5, '#a29398', 1);
    this.rect(-60, 4, 120, 5, '#dbc3b3', 1);
    this.rect(-53, -116, 106, 27, burned ? '#322c3e' : '#292e43', 3, '#e2b87d', 2);
    this.text(house.letters, 0, -102, 21, burned ? '#e7aa85' : '#ffe2a8', 900);
    this.text(house.name.toUpperCase(), 0, -164, 9.5, burned ? '#e0bba5' : '#333348', 900);
    for (const x of [-132, 132]) {
      this.rect(x - 12, -19, 24, 18, '#97746e', 2);
      this.oval(x, -23, 21, 14, burned ? '#4a4850' : '#355b52');
      this.oval(x - 7, -27, 12, 11, burned ? '#53434e' : '#577f64');
      if (!burned) this.oval(x + 8, -26, 3, 3, '#e6a2ad');
    }
    // Bunting reads as a collegiate setting without tiny texture noise.
    this.line([[-145, -119], [-106, -111], [-83, -107]], '#edd4ae', 1);
    this.line([[83, -107], [106, -111], [145, -119]], '#edd4ae', 1);
    for (const x of [-136, -120, -103, 103, 120, 136]) this.line([[x - 5, -115], [x + 5, -115], [x, -102]], null, 0, true, index % 2 ? '#f0b781' : '#d49aa9');
    if (burned) {
      this.rect(-150, -190, 300, 182, '#24203426');
      for (let i = 0; i < 9; i++) this.fire(-125 + i * 32, -10 - (i % 3) * 32, 35 + (i % 4) * 13, time, i + index);
      for (let i = 0; i < 5; i++) {
        const phase = (time * 0.24 + i * 0.2) % 1;
        c.globalAlpha = (1 - phase) * 0.22;
        this.oval(-60 + i * 30 + phase * 25, -145 - phase * 155, 22 + phase * 23, 27 + phase * 27, '#30263d');
      }
      c.globalAlpha = 1;
      this.rect(-45, -61, 90, 23, '#232c3ce8', 4, '#b7f191', 1);
      this.text('ROW RECLAIMED', 0, -49, 8.5, '#cafba5');
    }
  }

  window(x, y, width, height, trim, burned, seed) {
    this.rect(x - width / 2 - 3, y - height / 2 - 3, width + 6, height + 6, trim, 1);
    const c = this.ctx, glow = c.createLinearGradient(0, y - height / 2, 0, y + height / 2);
    glow.addColorStop(0, burned ? '#f56d3a' : '#edba92'); glow.addColorStop(1, burned ? '#d43d49' : '#a97788');
    this.rect(x - width / 2, y - height / 2, width, height, glow);
    this.line([[x - width / 2 + 2, y - height / 2], [x - width / 2 + 2, y + height / 2 - 6], [x - 1, y - 4]], null, 0, true, '#7b57634a');
    this.line([[x + width / 2 - 2, y - height / 2], [x + width / 2 - 2, y + height / 2 - 6], [x + 1, y - 4]], null, 0, true, '#7b57634a');
    this.rect(x - 1, y - height / 2, 2, height, trim);
    this.rect(x - width / 2, y - 1, width, 2, trim);
    this.rect(x - width / 2 - 5, y + height / 2 + 2, width + 10, 4, trim, 1);
  }

  portraitHouse(house, index, time, active) {
    const p = this.project(house.x, -6.6);
    if (p.y < -100 || p.y > this.height + 160) return;
    const c = this.ctx, size = clamp(this.width * 0.32 / 330, 0.3, 0.5);
    const x = this.width * 0.19;
    // Front-on postcard facades along the left sidewalk, with no isometric skew.
    this.rect(0, p.y - 83, this.originX - this.depthScale * 5.75 - 18, 112, '#557766', 3);
    c.save(); c.translate(x, p.y + 10); c.scale(size, size); this.facade(house, index, time); c.restore();
    if (active && !house.burned) this.lawnTarget(p.x + 3, p.y + 5, 18, 18, time, house);
  }

  lawnTarget(x, y, rx, ry, time, house) {
    const c = this.ctx, pulse = 1 + Math.sin(time * 4) * 0.055;
    c.save();
    this.oval(x, y, rx * 1.14, ry * 1.6, '#c4fb9320');
    this.oval(x, y, rx * pulse, ry * pulse, '#b5f9812b', '#c2fa93', 2);
    this.oval(x, y, rx * 0.77, ry * 0.66, null, '#e5ffc481', 1);
    const arrowY = y - (this.portrait ? 28 : 22) + Math.sin(time * 4) * 3;
    this.line([[x - 6, arrowY - 7], [x, arrowY], [x + 6, arrowY - 7]], '#d9ff9f', 3);
    if (!this.portrait) {
      const width = 80;
      this.rect(x - width / 2, y + 16, width, 5, '#202837', 3);
      this.rect(x - width / 2, y + 16, width * clamp(house.hp / house.maxHp, 0, 1), 5, '#bdfa89', 3);
      this.text('HIT THE LAWN', x, y + 35, 9, '#ecf5cd', 800);
    } else {
      for (let i = 0; i < house.maxHp; i++) this.oval(x - house.maxHp * 3.5 + i * 7 + 3.5, y + 25, 2.2, 2.2, i < Math.ceil(house.hp) ? '#c3ff91' : '#354354');
    }
    c.restore();
  }

  tree(x, base, size, seed) {
    const c = this.ctx;
    c.save(); c.translate(x, base); c.scale(size, size);
    this.rect(-5, -91, 10, 93, '#554956', 2);
    this.line([[0, -32], [-23, -73]], '#554956', 7);
    this.line([[0, -48], [24, -98]], '#554956', 6);
    const pink = seed % 3 === 0;
    this.oval(-18, -102, 38, 40, pink ? '#846080' : '#356467');
    this.oval(18, -116, 39, 43, pink ? '#9d6b88' : '#487c73');
    this.oval(-9, -135, 32, 33, pink ? '#b97f9b' : '#5b8d7d');
    this.oval(32, -101, 20, 25, pink ? '#9d6b88' : '#477367');
    this.oval(-14, -148, 16, 9, pink ? '#d297a73b' : '#9bb18b39');
    c.restore();
  }

  lamp(x, y, size) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(size, size);
    const glow = c.createRadialGradient(12, -136, 3, 12, -136, 51);
    glow.addColorStop(0, '#ffe1a543'); glow.addColorStop(1, '#ffe1a500');
    this.oval(12, -136, 51, 51, glow);
    this.rect(-3, -143, 6, 143, '#31364a', 2);
    this.rect(-7, -7, 14, 8, '#222e41', 2);
    this.line([[0, -140], [0, -153], [10, -158], [22, -154], [26, -145]], '#303349', 4);
    this.rect(17, -145, 18, 5, '#252e41', 2);
    this.rect(19, -141, 14, 4, '#ffe2a4', 2);
    this.oval(18, 1, 29, 6, '#ffe1aa10');
    c.restore();
  }

  decorations(time) {
    if (this.portrait) return;
    const start = Math.floor(this.focus / 20) * 20 - 40;
    for (let x = start; x < this.focus + 50; x += 20) {
      const p = this.project(x + 4, -5.5);
      this.tree(p.x, this.top - 16, this.figureScale * 1.05, x / 20);
      this.lamp(p.x + this.scale * 4, this.top + 2, this.figureScale);
      const sx = this.project(x + 2, 0).x;
      this.rect(sx - 2, this.top - 75, 4, 64, '#51566b', 1);
      this.rect(sx - 36, this.top - 80, 73, 18, '#304844', 3, '#b7c29c', 1);
      this.text('GREEK ROW', sx, this.top - 71, 8, '#f1e4c8');
    }
  }

  shadow(x, y, width, height = 6, alpha = 0.34) {
    this.oval(x, y + 2, width, height, `rgba(14,22,37,${alpha})`);
  }

  player(player, state, time) {
    const ground = this.project(player.x || 0, player.z || 0);
    const p = this.project(player.x || 0, player.z || 0, player.jumpHeight || 0);
    const c = this.ctx, pipeline = clamp((player.pipeline || 0) / 100, 0, 1), level = player.level || 0;
    const depth = this.portrait ? 1 : 0.95 + (player.z || 0) * 0.016;
    const s = this.figureScale * depth;
    const running = state.phase === 'playing', dash = player.dashing > 0;
    const airborne = (player.jumpHeight || 0) > 0.05;
    const stride = running ? Math.sin(time * (dash ? 10 : 4)) * 0.3 : Math.sin(time * 2) * 0.08;
    const bob = running ? Math.abs(stride) * 1.5 : Math.sin(time * 2) * 0.7;
    const trim = ['#fc83bc', '#b3f589', '#bba0ff'][Math.min(2, level)];
    const jacket = colorMix('#242c41', '#f0a4c2', pipeline);
    const hair = colorMix(level > 1 ? '#9a65d2' : '#ed71ad', '#ecc785', pipeline);
    this.shadow(ground.x, ground.y + 10 * s, (29 - Math.min(10, (player.jumpHeight || 0) * 2)) * s, 6 * s, airborne ? 0.18 : 0.34);
    if (dash) {
      for (let i = 1; i <= 3; i++) {
        this.line([[p.x - i * 20 * s - 12, p.y - 28 * s], [p.x - i * 20 * s - 37, p.y - 28 * s]], `${trim}88`, 3);
        this.line([[p.x - i * 18 * s - 2, p.y - 64 * s], [p.x - i * 18 * s - 17, p.y - 64 * s]], '#d0ffb477', 2);
      }
    }
    if (player.invulnerable > 1.15) {
      this.oval(p.x, p.y - 48 * s, 35 * s, 57 * s, '#c7ff9c08', '#c7ff9c8a', 1.5);
      this.oval(p.x, p.y + 1, 32 * s, 9 * s, null, '#c7ff9c73', 2);
    }
    c.save(); c.translate(p.x, p.y - bob * s); c.scale(s, s);
    if (player.invulnerable > 0 && player.invulnerable < 1.15) c.globalAlpha = Math.sin(time * 28) < 0 ? 0.55 : 1;
    if (dash) c.transform(1, 0, -0.1, 1, 0, 0);
    // The skateboard stays under both feet, with a kicktail and spinning wheel marks.
    c.save();
    if (airborne) c.rotate(Math.sin((player.jumpHeight || 0) * 1.3) * -0.09);
    this.line([[-35, 0], [-28, 5], [27, 5], [35, 0]], '#a0efa0', 6);
    this.line([[-34, -2], [-27, 2], [27, 2], [34, -2]], '#232b3c', 3);
    this.line([[-20, 6], [-20, 10]], '#adbfc9', 3);
    this.line([[20, 6], [20, 10]], '#adbfc9', 3);
    for (const wx of [-21, 21]) {
      this.oval(wx, 11, 5.5, 5.5, '#f3d49d', '#35314b', 1.5);
      const wheel = time * (Math.abs(player.skateSpeed || 4) * 1.9);
      this.line([[wx - Math.cos(wheel) * 3, 11 - Math.sin(wheel) * 3], [wx + Math.cos(wheel) * 3, 11 + Math.sin(wheel) * 3]], '#927c7c', 1.3);
    }
    this.rect(-9, 5, 18, 2, trim, 1);
    c.restore();
    // Limbs pivot from their joints; separate boots make every stride readable.
    const leg = (sign, front) => {
      const swing = stride * sign;
      const hip = [sign * 5, -39], knee = [sign * 7 + 8 + (airborne ? 7 : 0), -22], ankle = [sign * 17 + (airborne ? 3 : 0), -5];
      this.line([hip, knee, ankle], front ? '#1c2639' : '#303a50', 11);
      if (pipeline > 0.5) this.line([hip, knee], '#f0bd9e', 8);
      this.rect(ankle[0] - 6, ankle[1] - 6, 13, 9, '#252a3c', 3);
      this.rect(ankle[0] - 6, ankle[1] + 1, 21, 6, '#171f31', 2);
      this.rect(ankle[0] - 6, ankle[1] + 5, 21, 2, '#b2a5a8', 1);
      if (front) for (let i = 0; i < 2; i++) this.rect(ankle[0] - 3, ankle[1] - 4 + i * 4, 6, 1, '#d6b6b6');
    };
    leg(-1, false);
    this.line([[-8, -67], [-17 - stride * 7, -50], [-13 - stride * 15, -37]], '#1e293c', 9);
    this.oval(-13 - stride * 15, -37, 4.5, 5, '#e7ae91');
    leg(1, true);
    // Tank, jacket panels, lapels, zips, and stage-colored patch.
    this.line([[-12, -75], [8, -77], [17, -49], [10, -37], [-13, -40], [-18, -57]], '#182235', 2, true, jacket);
    this.line([[-4, -73], [5, -72], [9, -40], [-3, -40]], null, 0, true, pipeline > 0.58 ? '#ffd9e5' : '#dfb6b1');
    this.line([[-11, -73], [-3, -60], [-1, -72]], '#535267', 1, true, '#151e30');
    this.line([[8, -72], [4, -59], [13, -66]], '#535267', 1, true, '#151e30');
    this.line([[2, -58], [5, -43]], '#d0b6c0', 1);
    this.rect(-13, -59, 8, 10, trim, 1);
    this.text('×', -9, -54, 9, '#27243a');
    if (pipeline < 0.7) for (let i = 0; i < 3 + level; i++) this.oval(-14 + i * 4, -73 - (i % 2), 1.8, 1.8 + level * 0.5, '#e8d7d3');
    if (pipeline > 0.24) {
      c.globalAlpha *= clamp((pipeline - 0.24) * 2.5, 0, 1);
      this.line([[-12, -47], [12, -47], [22, -28], [-20, -28]], '#c379a2', 1, true, '#ed9fbe');
      for (const x of [-12, -4, 4, 12]) this.line([[x * 0.7, -45], [x, -29]], '#ffc9d958', 1);
      c.globalAlpha = 1;
    }
    this.line([[9, -69], [18 + stride * 6, -53], [26 + stride * 10, -61]], jacket, 10);
    this.oval(27 + stride * 10, -61, 5, 5.5, '#f0bc9d');
    this.rect(20 + stride * 10, -64, 5, 8, '#272940', 1);
    // Neck, face, prominent nose and eye retain a readable side profile at phone size.
    this.rect(-1, -87, 9, 13, '#df9f88', 3);
    if (pipeline > 0.5) for (let i = 0; i < 5; i++) this.oval(-4 + i * 3, -77 + Math.sin(i / 4 * Math.PI) * 2, 1.8, 1.8, '#fff0df');
    this.oval(3, -97, 15, 17, '#f0bc9d');
    this.line([[13, -100], [24, -94], [15, -90]], '#d69782', 1, true, '#f0bc9d');
    this.oval(-8, -94, 4, 5, '#e5a38e');
    this.line([[11, -89], [16, -89]], '#a05266', 1.5);
    this.line([[8, -103], [15, -102]], '#3a2d42', 2);
    this.oval(13, -99, 1.6, 1.7, '#25243b');
    this.oval(-9, -92, 3.3, 4, null, '#e8ded8', 1.5);
    this.line([[-11, -99], [-10, -109], [-1, -114], [11, -110], [16, -105], [4, -107], [-4, -103]], null, 0, true, hair);
    const punk = 1 - pipeline;
    if (punk > 0.08) {
      const spike = (18 + level * 6) * punk;
      this.line([[-10, -107], [-13, -117 - spike * 0.3], [-6, -115], [-5, -117 - spike], [2, -114], [5, -117 - spike * 0.9], [10, -111], [15, -117 - spike * 0.35], [16, -105]], '#282439', 1, true, hair);
      this.line([[-6, -111], [-4, -119 - spike * 0.5], [3, -113]], '#ffb1d081', 2);
    }
    if (pipeline > 0.32) {
      const tail = clamp((pipeline - 0.32) * 2, 0, 1);
      this.oval(-14, -103, 7 * tail, 9, '#ecc785');
      this.line([[-16, -106], [-29 - stride * 2, -99], [-28 - stride * 4, -81], [-19, -91]], '#dab174', 2, true, '#ebc685');
      this.rect(-19, -105, 5, 6, '#e986b4', 2);
    }
    if (level && pipeline < 0.5) {
      for (let i = 0; i < level + 1; i++) this.line([[-15 + i * 5, -77], [-16 + i * 5, -83 - level * 2], [-12 + i * 5, -77]], '#eeebe1', 1, true, '#c5c6cf');
    }
    if (state.phase === 'transform') {
      for (let i = 0; i < 8; i++) {
        const angle = time * 2 + i * TAU / 8;
        const x = Math.cos(angle) * 38, y = -58 + Math.sin(angle) * 49;
        this.line([[x - 3, y], [x + 3, y]], '#ffd2e7', 2);
        this.line([[x, y - 3], [x, y + 3]], '#ffd2e7', 2);
      }
    }
    c.restore();
  }

  hazard(item, time) {
    const p = this.project(item.x, item.z), c = this.ctx;
    if (p.x < -120 || p.x > this.width + 120 || p.y < -120 || p.y > this.height + 120) return;
    const s = this.figureScale * (this.portrait ? 1 : 0.95 + item.z * 0.016);
    this.shadow(p.x, p.y, (item.type === 'pink' ? 19 : 24) * s, 5 * s);
    c.save(); c.translate(p.x, p.y); c.scale(s, s);
    if (item.type === 'keg') {
      this.rect(-19, -45, 38, 43, '#99a7b8', 9, '#29384f', 3);
      this.oval(0, -43, 18, 5, '#c6d1cf', '#596678', 2);
      this.rect(-21, -36, 42, 5, '#c3c9d0', 2);
      this.rect(-21, -13, 42, 5, '#bbc7ce', 2);
      this.rect(-9, -33, 5, 17, '#dfe8e33d', 2);
      this.rect(-6, -30, 12, 12, '#40515f', 2);
      this.text('K', 0, -24, 9, '#fff0c5');
      this.rect(-4, -50, 8, 7, '#656e80', 2);
      const spin = time * 6;
      this.line([[-29, -29], [-38 - Math.sin(spin) * 4, -29]], '#c7ccdb7a', 2);
    } else if (item.type === 'pink') {
      const bob = Math.sin(time * 3 + item.id) * 4;
      const glow = c.createRadialGradient(0, -34 + bob, 4, 0, -34 + bob, 43);
      glow.addColorStop(0, '#ffb4d852'); glow.addColorStop(1, '#ffb4d800');
      this.oval(0, -34 + bob, 43, 43, glow);
      c.translate(0, bob);
      for (let i = 0; i < 5; i++) this.oval(-21 + i * 11, -46 - Math.sin(i + time * 2) * 7, 14, 15, '#efa7d057');
      this.rect(-13, -39, 26, 26, '#f4a6c4', 6, '#e476a9', 2);
      this.rect(-6, -47, 12, 8, '#e9c17d', 2);
      this.rect(-7, -51, 14, 5, '#f5dbad', 2);
      this.rect(-8, -31, 16, 12, '#ffdeea', 2);
      this.text('♥', 0, -25, 11, '#d65d98');
      for (let i = 0; i < 4; i++) { const xx = -27 + i * 19, yy = -61 + Math.sin(time * 3 + i) * 5; this.line([[xx - 2, yy], [xx + 2, yy]], '#ffd2f0', 1.5); this.line([[xx, yy - 2], [xx, yy + 2]], '#ffd2f0', 1.5); }
    } else {
      // Rush swag is a campus gift bag, not an attacker: its pink emblem matches the makeover meter.
      this.rect(-24, -61, 48, 58, '#a8b4d0', 4, '#596c91', 2);
      this.rect(-24, -16, 48, 13, '#8b9fbf', 2);
      this.line([[-12, -60], [-12, -74], [12, -74], [12, -60]], '#eadbbf', 4);
      this.rect(-17, -52, 34, 24, '#edf0e3', 2);
      this.text('RUSH', 0, -44, 10, '#536082');
      this.text('SWAG', 0, -34, 8, '#536082');
      this.text('♥', 0, -16, 12, '#ee8eba');
      this.line([[-23, -64], [-28, -71], [-19, -69], [-13, -77], [-7, -65]], null, 0, true, '#f0b4cc');
      this.line([[7, -65], [12, -74], [20, -68], [26, -72], [24, -60]], null, 0, true, '#f4c4d6');
    }
    c.restore();
  }

  coffeeStand(item, time) {
    const p = this.project(item.x, item.z), c = this.ctx;
    if (p.x < -150 || p.x > this.width + 150 || p.y < -150 || p.y > this.height + 150) return;
    const s = this.figureScale * (this.portrait ? 0.9 : 0.9);
    this.oval(p.x, p.y + 7, 47 * s, 11 * s, item.served ? '#b9e49510' : '#b7fa9540', item.served ? '#b9e49547' : '#c7fba5', 1.5);
    for (const side of [-1, 1]) this.line([[p.x + side * 42 * s, p.y + 3], [p.x + side * 33 * s, p.y + 7], [p.x + side * 42 * s, p.y + 11]], item.served ? '#83a57e' : '#d4ffaa', 2);
    c.save(); c.translate(p.x, p.y - 16 * s); c.scale(s, s);
    this.shadow(0, 0, 54, 5, 0.16);
    this.rect(-48, -65, 5, 60, '#685563', 1); this.rect(43, -65, 5, 60, '#685563', 1);
    this.rect(-51, -75, 102, 17, '#a4d0b1', 3, '#254a50', 2);
    this.text('LOUDER COFFEE', 0, -66, 9, '#263f4d');
    for (let i = 0; i < 8; i++) this.rect(-52 + i * 13, -57, 13, 11, i % 2 ? '#e9d8b6' : '#75a991', [0, 0, 4, 4]);
    this.rect(-45, -28, 90, 26, '#987678', 2, '#544553', 2);
    this.rect(-49, -32, 98, 6, '#e1bfa4', 2);
    this.rect(-30, -23, 60, 16, '#314b51', 2);
    this.text(item.served ? 'THANKS, PUNK!' : 'ROLL THROUGH', 0, -15, 8, item.served ? '#c9d1bd' : '#d4ffa8');
    this.rect(15, -47, 17, 15, '#e2e2c7', 2); this.rect(13, -49, 21, 4, '#faf0d5', 2);
    this.rect(17, -41, 13, 6, '#ab7b77', 1);
    this.rect(-26, -51, 20, 19, '#526878', 2); this.rect(-23, -48, 13, 7, '#afcad0', 1);
    this.oval(-15, -38, 2, 2, '#ffdf94');
    if (!item.served) {
      this.line([[23, -55], [20, -61], [23, -65]], '#f5debe90', 1.5);
      this.text('COFFEE −18 MAKEOVER', 0, -87, 7.5, '#def9b9');
    }
    c.restore();
  }

  pickup(item, time) {
    const p = this.project(item.x, item.z), c = this.ctx;
    if (p.x < -90 || p.x > this.width + 90 || p.y < -90 || p.y > this.height + 90) return;
    const s = this.figureScale, bob = Math.sin(time * 3.4 + item.id) * 4;
    this.shadow(p.x, p.y, 15 * s, 4 * s, 0.2);
    c.save(); c.translate(p.x, p.y - (23 + bob) * s); c.scale(s, s);
    const glow = c.createRadialGradient(0, 0, 6, 0, 0, 33);
    glow.addColorStop(0, '#c0fc8940'); glow.addColorStop(1, '#c0fc8900');
    this.oval(0, 0, 33, 33, glow);
    this.oval(0, 0, 23, 23, '#263a4a99', '#c7f392a6', 1.5);
    if (item.type === 'vinyl') {
      this.oval(0, 0, 17, 17, '#1c273b', '#95a8b7', 1.5);
      this.oval(0, 0, 12, 12, null, '#8394ab57', 1);
      this.oval(0, 0, 9, 9, null, '#8394ab57', 1);
      this.oval(0, 0, 6, 6, '#f28caf'); this.oval(0, 0, 1.8, 1.8, '#202f42');
      this.line([[-11, -9], [-7, -12]], '#d4dfd987', 2);
    } else if (item.type === 'coffee') {
      this.line([[-11, -12], [11, -12], [8, 15], [-8, 15]], '#e2bd9b', 1, true, '#efe2c2');
      this.rect(-13, -15, 26, 5, '#faf0d7', 2);
      this.rect(-10, -2, 20, 10, '#b17877', 1);
      this.text('×', 0, 3, 12, '#fff0d3');
      this.line([[0, -20], [-3, -24], [1, -29]], '#f9e5be96', 1.5);
    } else {
      this.line([[2, -17], [-11, 3], [-2, 3], [-5, 17], [13, -5], [3, -5]], '#fff0a2', 1, true, '#c8fd8d');
    }
    c.restore();
  }

  projectile(item) {
    const c = this.ctx, progress = clamp(item.progress || 0, 0, 1);
    const x = lerp(item.fromX, item.toX, progress), z = lerp(item.fromZ, item.toZ, progress);
    const height = 2.7 * (1 - progress) + Math.sin(progress * Math.PI) * 5.2;
    const p = this.project(x, z, height);
    const ground = this.project(x, z);
    this.shadow(ground.x, ground.y, 6, 2, 0.2);
    c.save(); c.translate(p.x, p.y); c.rotate(-progress * TAU * 1.4 + 0.5);
    this.rect(-5, -8, 10, 20, '#87b78b', 3, '#e0e7ad', 1);
    this.rect(-2, -16, 4, 10, '#81a983', 1);
    this.rect(-4, -1, 8, 8, '#eacb9d', 1);
    this.line([[0, -16], [3, -20], [1, -24]], '#efc18c', 2);
    this.fire(1, -22, 14, (this.idleTime || 0) * 2, item.id);
    c.restore();
  }

  fire(x, y, size, time, seed) {
    const c = this.ctx, wave = Math.sin(time * 8 + seed * 1.7), h = size * (0.9 + wave * 0.13);
    c.save(); c.translate(x, y);
    const glow = c.createRadialGradient(0, -h * 0.35, 0, 0, -h * 0.35, h);
    glow.addColorStop(0, '#ffbd4330'); glow.addColorStop(1, '#ff683300');
    this.oval(0, -h * 0.35, h, h, glow);
    c.beginPath(); c.moveTo(0, 2);
    c.bezierCurveTo(-h * 0.45, 0, -h * 0.36, -h * 0.35, -h * 0.17, -h * 0.58);
    c.bezierCurveTo(-h * 0.24, -h * 0.29, h * 0.04, -h * 0.65, wave * h * 0.13, -h);
    c.bezierCurveTo(h * 0.31, -h * 0.62, h * 0.12, -h * 0.44, h * 0.31, -h * 0.5);
    c.bezierCurveTo(h * 0.37, -h * 0.11, h * 0.31, 2, 0, 2);
    c.fillStyle = '#ff7548'; c.fill();
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(-h * 0.23, -h * 0.06, -h * 0.09, -h * 0.42, h * 0.04, -h * 0.62);
    c.bezierCurveTo(h * 0.06, -h * 0.34, h * 0.29, -h * 0.12, 0, 0);
    c.fillStyle = '#ffc15d'; c.fill();
    this.oval(0, -h * 0.11, h * 0.095, h * 0.15, '#ffe5a0');
    c.restore();
  }

  burst(x, z, color = 0xff603c, count = 18) {
    const fill = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
    for (let i = 0; i < Math.min(count, 48); i++) {
      if (this.particles.length >= 160) this.particles.shift();
      const angle = Math.random() * TAU, speed = 2 + Math.random() * 3;
      this.particles.push({ x, z, y: 0.5, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: 3 + Math.random() * 5, life: 0.55 + Math.random() * 0.65, fill, radius: 2 + Math.random() * 3 });
    }
  }

  drawParticles(dt) {
    const c = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]; particle.life -= dt;
      if (particle.life <= 0) { this.particles.splice(i, 1); continue; }
      particle.x += particle.vx * dt; particle.z += particle.vz * dt; particle.y += particle.vy * dt; particle.vy -= dt * 10;
      const p = this.project(particle.x, particle.z, particle.y);
      c.globalAlpha = Math.min(1, particle.life * 2);
      this.oval(p.x, p.y, particle.radius, particle.radius * 0.8, particle.fill);
    }
    c.globalAlpha = 1;
  }

  render(state, dt = 1 / 60) {
    this.idleTime += dt;
    this.title = state.phase === 'title';
    this.portrait = Boolean(state.portrait);
    this.layout();
    const desired = this.title ? 0 : (state.distance ?? state.player?.x ?? 0) + (this.portrait ? -0.5 : 0.7);
    this.focus = this.focus == null || Math.abs(desired - this.focus) > 45 ? desired : lerp(this.focus, desired, 1 - Math.exp(-Math.max(dt, 0.016) * 7));
    const time = this.title ? this.idleTime : state.time || 0;
    const c = this.ctx;
    c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    c.globalAlpha = 1;
    this.background(time);
    this.street(time);
    for (let i = 0; i < (state.houses || []).length; i++) this.house(state.houses[i], i, time, state.phase === 'playing' && state.targetId === state.houses[i].id);
    this.decorations(time);
    const entries = [];
    for (const item of state.hazards || []) entries.push({ type: 'hazard', item, y: this.project(item.x, item.z).y });
    for (const item of state.pickups || []) entries.push({ type: 'pickup', item, y: this.project(item.x, item.z).y });
    for (const item of state.coffeeStands || []) entries.push({ type: 'coffee', item, y: this.project(item.x, item.z).y - 17 });
    const player = state.player || { x: 0, z: 1, pipeline: 0, level: 0 };
    entries.push({ type: 'player', item: player, y: this.project(player.x || 0, player.z || 0).y });
    entries.sort((a, b) => a.y - b.y);
    for (const entry of entries) {
      if (entry.type === 'player') this.player(entry.item, state, time);
      else if (entry.type === 'hazard') this.hazard(entry.item, time);
      else if (entry.type === 'coffee') this.coffeeStand(entry.item, time);
      else this.pickup(entry.item, time);
    }
    for (const item of state.projectiles || []) this.projectile(item);
    this.drawParticles(dt);
    const vignette = c.createLinearGradient(0, 0, 0, this.height);
    vignette.addColorStop(0, '#10132925'); vignette.addColorStop(0.4, '#10132900'); vignette.addColorStop(0.87, '#10132900'); vignette.addColorStop(1, '#10132955');
    this.rect(0, 0, this.width, this.height, vignette);
  }

  dispose() {
    this.particles.length = 0;
    this.canvas.remove();
  }
}
