// Drawing routines for tiles, characters, buildings, enemies.
window.FP = window.FP || {};

const TILE = 40;
const COLS = 12;
const VIEW_W = COLS * TILE; // 480
const VIEW_H = 720;

FP.TILE = TILE;
FP.COLS = COLS;
FP.VIEW_W = VIEW_W;
FP.VIEW_H = VIEW_H;

FP.COLORS = {
  paper: 0xf0e9d6,
  paperDark: 0xe0d8c0,
  ink: 0x0a0a0a,
  inkSoft: 0x2a2a2a,
  road: 0xc8bfa6,
  roadLine: 0xf0e9d6,
  sidewalk: 0xb5ad96,
  grass: 0x9ab485,
  grassDark: 0x7a9468,
  bush: 0x6a8458,
  fratWall: 0x1a3a8c,
  fratWallDark: 0x122968,
  fratRoof: 0x0a1a4a,
  fratWindow: 0xffd23f,
  fratGreek: 0xffd23f,
  coffeeWall: 0x6b4423,
  coffeeRoof: 0x3a8559,
  recordWall: 0x2a1845,
  recordRoof: 0xd9325b,
  skateWall: 0x1a6e6e,
  skateRoof: 0xff7a00,
  skin: [0xf0c8a0, 0xc89870, 0x8b5a3c, 0x5a3820],
  fratbroPolo: 0xff7a9e,
  fratbroPoloAlt: 0x8fc9ff,
  sororityHair: 0xffd23f,
  sororityTop: 0xff5a8a,
  sororitySkirt: 0xffffff,
  pledgeShirt: 0x8a8a8a,
  raCoat: 0x2a4a8a,
  flameRed: 0xe63016,
  flameOrange: 0xff7a00,
  flameYellow: 0xffd23f,
  ash: 0x2a2a2a,
};

// ============ TILE DRAWING ============
FP.drawRow = function(g, rowData) {
  g.clear();
  for (let c = 0; c < COLS; c++) {
    const x = c * TILE;
    const tile = rowData[c];
    switch (tile) {
      case 'grass': drawGrass(g, x); break;
      case 'grass-dark': drawGrassDark(g, x); break;
      case 'sidewalk': drawSidewalk(g, x); break;
      case 'road': drawRoad(g, x); break;
      case 'road-line': drawRoadLine(g, x); break;
      case 'tree': drawGrass(g, x); drawTree(g, x); break;
      case 'bush': drawSidewalk(g, x); drawBush(g, x); break;
      case 'planter': drawSidewalk(g, x); drawPlanter(g, x); break;
      case 'manhole': drawRoad(g, x); drawManhole(g, x); break;
      default: drawGrass(g, x);
    }
  }
};

function drawGrass(g, x) {
  g.fillStyle(FP.COLORS.grass);
  g.fillRect(x, 0, TILE, TILE);
  g.fillStyle(FP.COLORS.grassDark, 0.5);
  g.fillRect(x + 6, 8, 2, 4);
  g.fillRect(x + 22, 18, 2, 4);
  g.fillRect(x + 32, 28, 2, 4);
}
function drawGrassDark(g, x) {
  g.fillStyle(FP.COLORS.grassDark);
  g.fillRect(x, 0, TILE, TILE);
}
function drawSidewalk(g, x) {
  g.fillStyle(FP.COLORS.sidewalk);
  g.fillRect(x, 0, TILE, TILE);
  g.fillStyle(0x9a927e, 0.6);
  g.fillRect(x, 19, TILE, 1);
}
function drawRoad(g, x) {
  g.fillStyle(FP.COLORS.road);
  g.fillRect(x, 0, TILE, TILE);
  g.fillStyle(0xb8af96, 0.4);
  g.fillRect(x + 8, 12, 2, 2);
  g.fillRect(x + 28, 26, 2, 2);
}
function drawRoadLine(g, x) {
  g.fillStyle(FP.COLORS.road);
  g.fillRect(x, 0, TILE, TILE);
  g.fillStyle(FP.COLORS.roadLine);
  g.fillRect(x + TILE/2 - 2, 8, 4, 24);
}
function drawTree(g, x) {
  g.fillStyle(0x6b4423);
  g.fillRect(x + TILE/2 - 3, 22, 6, 18);
  g.fillStyle(0x4a6e3a);
  g.fillCircle(x + TILE/2, 16, 14);
  g.fillStyle(0x6a8458);
  g.fillCircle(x + TILE/2 - 4, 12, 8);
  g.fillCircle(x + TILE/2 + 5, 14, 7);
  g.fillStyle(FP.COLORS.ink, 0.18);
  g.fillCircle(x + TILE/2 + 6, 18, 12);
}
function drawBush(g, x) {
  g.fillStyle(FP.COLORS.bush);
  g.fillCircle(x + TILE/2, TILE/2 + 4, 14);
  g.fillStyle(0x8aa472);
  g.fillCircle(x + TILE/2 - 4, TILE/2 + 2, 6);
  g.fillCircle(x + TILE/2 + 5, TILE/2 + 6, 5);
}
function drawPlanter(g, x) {
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(x + 6, 18, TILE - 12, 18);
  g.fillStyle(FP.COLORS.bush);
  g.fillCircle(x + TILE/2, 14, 8);
}
function drawManhole(g, x) {
  g.fillStyle(FP.COLORS.inkSoft);
  g.fillCircle(x + TILE/2, TILE/2, 10);
  g.fillStyle(FP.COLORS.ink);
  g.fillCircle(x + TILE/2, TILE/2, 8);
}

// ============ FRAT HOUSE ============
FP.drawFratHouse = function(g, side, w = TILE * 3, h = TILE * 4) {
  // Drop shadow
  g.fillStyle(FP.COLORS.ink, 0.2);
  g.fillRect(4, h - 4, w, 5);

  // Main wall — creamy Greek-revival white
  g.fillStyle(0xe8ddd0);
  g.fillRect(0, h * 0.22, w, h * 0.78);
  // Subtle brick mortar lines
  g.fillStyle(FP.COLORS.ink, 0.07);
  for (let i = 0; i < 10; i++) g.fillRect(0, h * 0.26 + i * h * 0.068, w, 1.5);

  // Triangular pediment (dark navy)
  g.fillStyle(FP.COLORS.fratRoof);
  g.fillTriangle(w * 0.5, 0, 0, h * 0.23, w, h * 0.23);
  // Inner pediment face (lighter blue)
  g.fillStyle(FP.COLORS.fratWall);
  g.fillTriangle(w * 0.5, h * 0.02, w * 0.07, h * 0.2, w * 0.93, h * 0.2);

  // Cornice ledge below pediment
  g.fillStyle(0xe8ddd0);
  g.fillRect(0, h * 0.21, w, h * 0.04);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(0, h * 0.21, w, 2);
  g.fillRect(0, h * 0.25, w, 2);

  // Large banner / sign board
  g.fillStyle(0xf5f0e4);
  g.fillRect(w * 0.05, h * 0.28, w * 0.9, h * 0.15);
  g.lineStyle(2.5, FP.COLORS.ink);
  g.strokeRect(w * 0.05, h * 0.28, w * 0.9, h * 0.15);

  // Columns (2 — flanking the door zone)
  const cw = w * 0.1, ctop = h * 0.44, ch = h * 0.54;
  [w * 0.06, w * 0.84].forEach(cx => {
    g.fillStyle(0xf0e8d4);
    g.fillRect(cx, ctop, cw, ch);
    // Fluting
    g.fillStyle(0xd4c4a0, 0.8);
    g.fillRect(cx + cw * 0.3, ctop, 1.5, ch);
    g.fillRect(cx + cw * 0.65, ctop, 1.5, ch);
    g.lineStyle(1.5, FP.COLORS.ink);
    g.strokeRect(cx, ctop, cw, ch);
    // Capital
    g.fillStyle(0xe2d8c4);
    g.fillRect(cx - 3, ctop, cw + 6, 5);
    g.lineStyle(1, FP.COLORS.ink);
    g.strokeRect(cx - 3, ctop, cw + 6, 5);
  });

  // Windows 2×2
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const wx = w * 0.2 + c * w * 0.4;
      const wy = h * 0.46 + r * h * 0.18;
      const ww = w * 0.22, wh = h * 0.12;
      g.fillStyle(FP.COLORS.fratWindow);
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle(FP.COLORS.ink);
      g.fillRect(wx + ww * 0.45, wy, 2, wh);
      g.fillRect(wx, wy + wh * 0.5, ww, 2);
      g.lineStyle(2, FP.COLORS.ink);
      g.strokeRect(wx, wy, ww, wh);
    }
  }

  // Door with arch top
  const dw = w * 0.24, dx = (w - dw) / 2;
  g.fillStyle(FP.COLORS.fratRoof);
  g.fillRect(dx, h * 0.76, dw, h * 0.24);
  g.fillTriangle(dx, h * 0.76, dx + dw, h * 0.76, dx + dw * 0.5, h * 0.7);
  g.fillStyle(0x1a1008);
  g.fillRect(dx + 2, h * 0.77, dw - 4, h * 0.22);
  g.fillStyle(FP.COLORS.fratWindow);
  g.fillRect(dx + dw * 0.28, h * 0.78, dw * 0.44, h * 0.06);
  g.fillStyle(FP.COLORS.fratGreek);
  g.fillCircle(dx + dw - 5, h * 0.88, 2.5);

  // Entry steps
  g.fillStyle(0xddd0bc);
  g.fillRect(dx - 6, h * 0.95, dw + 12, 4);
  g.fillRect(dx - 10, h * 0.98, dw + 20, 3);

  // Outline
  g.lineStyle(3, FP.COLORS.ink);
  g.strokeRect(0, 0, w, h);
};

FP.drawBurnedFrat = function(g, w = TILE * 3, h = TILE * 4) {
  g.fillStyle(FP.COLORS.ash);
  g.fillRect(0, h * 0.55, w, h * 0.45);
  g.fillStyle(0x4a3a30);
  g.fillRect(0, h * 0.6, w, h * 0.05);
  g.fillStyle(FP.COLORS.inkSoft);
  g.fillRect(w * 0.1, h * 0.4, w * 0.15, h * 0.2);
  g.fillRect(w * 0.7, h * 0.45, w * 0.18, h * 0.18);
  g.lineStyle(4, 0xff2d6f);
  g.strokeCircle(w / 2, h * 0.7, 14);
  g.lineStyle(3, 0xff2d6f);
  g.lineBetween(w/2 - 8, h * 0.7 - 8, w/2 + 8, h * 0.7 + 8);
  g.lineBetween(w/2 - 8, h * 0.7 + 8, w/2 + 8, h * 0.7 - 8);
  g.lineStyle(2, FP.COLORS.ink);
  g.strokeRect(0, h * 0.55, w, h * 0.45);
};

// ============ TRASHCAN ============
FP.drawTrashcan = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.18, s * 0.25, s * 0.64, s * 0.7);
  g.fillStyle(0x2ad17b);
  g.fillRect(s * 0.22, s * 0.3, s * 0.56, s * 0.6);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.12, s * 0.18, s * 0.76, s * 0.14);
  g.fillStyle(0x1ea05e);
  g.fillRect(s * 0.16, s * 0.2, s * 0.68, s * 0.1);
  g.fillStyle(FP.COLORS.flameOrange);
  g.fillTriangle(s * 0.5, s * 0.42, s * 0.4, s * 0.7, s * 0.6, s * 0.7);
  g.fillStyle(FP.COLORS.flameYellow);
  g.fillTriangle(s * 0.5, s * 0.52, s * 0.44, s * 0.7, s * 0.56, s * 0.7);
};

// ============ FRIENDLY VENUES ============
FP.drawVenue = function(g, kind, w = TILE * 3, h = TILE * 4) {
  const palette = {
    coffee: { wall: FP.COLORS.coffeeWall, roof: FP.COLORS.coffeeRoof, sign: 0xfff5e0 },
    record: { wall: FP.COLORS.recordWall, roof: FP.COLORS.recordRoof, sign: 0xffd23f },
    skate:  { wall: FP.COLORS.skateWall,  roof: FP.COLORS.skateRoof,  sign: 0x6effff },
  }[kind];
  g.fillStyle(FP.COLORS.ink, 0.2);
  g.fillRect(4, h - 6, w, 6);
  g.fillStyle(palette.roof);
  g.fillRect(0, 0, w, h * 0.22);
  g.fillStyle(FP.COLORS.paper, 0.22);
  for (let i = 0; i < 6; i++) g.fillRect(i * (w / 6), 0, w / 12, h * 0.22);
  g.fillStyle(palette.wall);
  g.fillRect(0, h * 0.22, w, h * 0.78);
  g.fillStyle(palette.sign);
  g.fillRect(w * 0.12, h * 0.32, w * 0.76, h * 0.32);
  g.lineStyle(2, FP.COLORS.ink);
  g.strokeRect(w * 0.12, h * 0.32, w * 0.76, h * 0.32);
  if (kind === 'coffee') {
    g.fillStyle(0x6b4423);
    g.fillRect(w * 0.4, h * 0.4, w * 0.2, h * 0.18);
    g.fillStyle(palette.sign);
    g.fillRect(w * 0.43, h * 0.42, w * 0.14, 4);
  } else if (kind === 'record') {
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(w * 0.5, h * 0.48, w * 0.13);
    g.fillStyle(palette.roof);
    g.fillCircle(w * 0.5, h * 0.48, w * 0.05);
  } else {
    g.fillStyle(0xc89870);
    g.fillRect(w * 0.25, h * 0.45, w * 0.5, h * 0.07);
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(w * 0.32, h * 0.55, 4);
    g.fillCircle(w * 0.68, h * 0.55, 4);
  }
  const doorW = w * 0.2, doorX = (w - doorW) / 2;
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(doorX, h * 0.7, doorW, h * 0.3);
  g.fillStyle(palette.roof);
  g.fillRect(doorX + 2, h * 0.72, doorW - 4, h * 0.26);
  g.lineStyle(3, FP.COLORS.ink);
  g.strokeRect(0, 0, w, h);
};

// ============ PLAYER ============
FP.drawPunk = function(g, charType, walkFrame, skinIdx, hasCig) {
  const s = TILE;
  const skin = FP.COLORS.skin[skinIdx];
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.55, s * 0.1);
  const hair = charType.hair;
  g.fillStyle(hair);
  if (charType.style === 'punk') {
    for (let i = 0; i < 6; i++) {
      g.fillTriangle(s * (0.32 + i * 0.06), s * 0.05,
                     s * (0.34 + i * 0.06), s * 0.2,
                     s * (0.36 + i * 0.06), s * 0.05);
    }
  } else if (charType.style === 'goth') {
    g.fillRect(s * 0.18, s * 0.08, s * 0.64, s * 0.22);
    g.fillRect(s * 0.12, s * 0.18, s * 0.18, s * 0.32);
  } else if (charType.style === 'skater') {
    g.fillRect(s * 0.2, s * 0.08, s * 0.6, s * 0.2);
    g.fillStyle(0xff7a00);
    g.fillRect(s * 0.2, s * 0.18, s * 0.6, 4);
  } else if (charType.style === 'raver') {
    g.fillRect(s * 0.22, s * 0.06, s * 0.56, s * 0.22);
    g.fillStyle(0x6effff);
    g.fillRect(s * 0.22, s * 0.06, 4, s * 0.22);
    g.fillRect(s * 0.74, s * 0.06, 4, s * 0.22);
  } else {
    g.fillRect(s * 0.16, s * 0.08, s * 0.68, s * 0.24);
  }
  g.fillStyle(skin);
  g.fillRect(s * 0.28, s * 0.22, s * 0.44, s * 0.26);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.28, s * 0.22, s * 0.44, s * 0.26);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.3, s * 0.3, s * 0.16, s * 0.06);
  g.fillRect(s * 0.54, s * 0.3, s * 0.16, s * 0.06);
  g.fillRect(s * 0.46, s * 0.32, s * 0.08, 2);
  g.fillStyle(charType.shirt || 0x1a1a1a);
  g.fillRect(s * 0.2, s * 0.48, s * 0.6, s * 0.28);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.2, s * 0.48, s * 0.6, s * 0.28);
  g.fillStyle(charType.logo || 0xff2d6f);
  g.fillRect(s * 0.42, s * 0.56, s * 0.16, s * 0.12);
  g.fillStyle(skin);
  g.fillRect(s * 0.1, s * 0.5, s * 0.12, s * 0.22);
  g.fillRect(s * 0.78, s * 0.5, s * 0.12, s * 0.22);
  const lOff = walkFrame === 1 ? -2 : walkFrame === 3 ? 2 : 0;
  const rOff = walkFrame === 1 ? 2 : walkFrame === 3 ? -2 : 0;
  g.fillStyle(0x2a2a4a);
  g.fillRect(s * 0.26, s * 0.76 + lOff, s * 0.2, s * 0.16);
  g.fillRect(s * 0.54, s * 0.76 + rOff, s * 0.2, s * 0.16);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.22, s * 0.9 + lOff, s * 0.26, s * 0.08);
  g.fillRect(s * 0.52, s * 0.9 + rOff, s * 0.26, s * 0.08);
  if (hasCig) {
    g.fillStyle(0xfff5e0);
    g.fillRect(s * 0.84, s * 0.62, s * 0.12, 3);
    g.fillStyle(FP.COLORS.flameOrange);
    g.fillRect(s * 0.95, s * 0.6, 4, 5);
    g.fillStyle(0xaaaaaa, 0.8);
    g.fillRect(s * 0.96, s * 0.5, 2, s * 0.08);
  }
};

FP.drawSorority = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.55, s * 0.1);
  g.fillStyle(FP.COLORS.sororityHair);
  g.fillRect(s * 0.18, s * 0.06, s * 0.64, s * 0.24);
  g.fillRect(s * 0.62, s * 0.04, s * 0.18, s * 0.5);
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.28, s * 0.22, s * 0.44, s * 0.28);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.32, s * 0.32, s * 0.1, s * 0.04);
  g.fillRect(s * 0.58, s * 0.32, s * 0.1, s * 0.04);
  g.fillStyle(FP.COLORS.sororityTop);
  g.fillRect(s * 0.4, s * 0.42, s * 0.2, 4);
  g.fillStyle(FP.COLORS.sororityTop);
  g.fillRect(s * 0.22, s * 0.5, s * 0.56, s * 0.2);
  g.fillStyle(FP.COLORS.sororitySkirt);
  g.fillRect(s * 0.18, s * 0.7, s * 0.64, s * 0.2);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.7, s * 0.64, s * 0.2);
};

// ============ ENEMIES ============
FP.drawFratbro = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.55, s * 0.1);
  g.fillStyle(0xc41e3a);
  g.fillRect(s * 0.2, s * 0.06, s * 0.6, s * 0.14);
  g.fillRect(s * 0.12, s * 0.13, s * 0.16, 4);
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.28, s * 0.2, s * 0.44, s * 0.28);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.28, s * 0.2, s * 0.44, s * 0.28);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.3, s * 0.28, s * 0.16, s * 0.06);
  g.fillRect(s * 0.54, s * 0.28, s * 0.16, s * 0.06);
  g.fillStyle(FP.COLORS.fratbroPolo);
  g.fillRect(s * 0.2, s * 0.48, s * 0.6, s * 0.26);
  g.fillStyle(FP.COLORS.paper);
  g.fillRect(s * 0.44, s * 0.48, s * 0.12, s * 0.08);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.2, s * 0.48, s * 0.6, s * 0.26);
  g.fillStyle(0xc8a87a);
  g.fillRect(s * 0.24, s * 0.74, s * 0.22, s * 0.14);
  g.fillRect(s * 0.54, s * 0.74, s * 0.22, s * 0.14);
  g.fillStyle(0x6b4423);
  g.fillRect(s * 0.22, s * 0.88, s * 0.26, s * 0.08);
  g.fillRect(s * 0.52, s * 0.88, s * 0.26, s * 0.08);
  g.fillStyle(0xff3a3a);
  g.fillRect(s * 0.84, s * 0.56, s * 0.12, s * 0.16);
};

FP.drawSororityEnemy = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.55, s * 0.1);
  g.fillStyle(FP.COLORS.sororityHair);
  g.fillRect(s * 0.18, s * 0.04, s * 0.64, s * 0.26);
  g.fillRect(s * 0.6, s * 0.02, s * 0.2, s * 0.5);
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.28, s * 0.2, s * 0.44, s * 0.28);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.3, s * 0.28, s * 0.18, s * 0.08);
  g.fillRect(s * 0.52, s * 0.28, s * 0.18, s * 0.08);
  g.fillStyle(FP.COLORS.sororityTop);
  g.fillRect(s * 0.22, s * 0.48, s * 0.56, s * 0.22);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.22, s * 0.48, s * 0.56, s * 0.22);
  g.fillStyle(FP.COLORS.sororitySkirt);
  g.fillRect(s * 0.2, s * 0.7, s * 0.6, s * 0.18);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.2, s * 0.7, s * 0.6, s * 0.18);
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.3, s * 0.88, s * 0.14, s * 0.08);
  g.fillRect(s * 0.56, s * 0.88, s * 0.14, s * 0.08);
};

FP.drawPledge = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.5, s * 0.08);
  g.fillStyle(0x8a8a8a);
  g.fillRect(s * 0.32, s * 0.16, s * 0.36, s * 0.18);
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.32, s * 0.28, s * 0.36, s * 0.22);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.36, s * 0.36, s * 0.06, s * 0.04);
  g.fillRect(s * 0.58, s * 0.36, s * 0.06, s * 0.04);
  g.fillStyle(FP.COLORS.pledgeShirt);
  g.fillRect(s * 0.26, s * 0.5, s * 0.48, s * 0.24);
  g.fillStyle(FP.COLORS.fratGreek);
  g.fillRect(s * 0.42, s * 0.58, s * 0.16, 4);
  g.fillStyle(0x4a4a4a);
  g.fillRect(s * 0.3, s * 0.74, s * 0.18, s * 0.16);
  g.fillRect(s * 0.52, s * 0.74, s * 0.18, s * 0.16);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.28, s * 0.9, s * 0.22, s * 0.06);
  g.fillRect(s * 0.5, s * 0.9, s * 0.22, s * 0.06);
};

FP.drawRA = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.6, s * 0.1);
  g.fillStyle(FP.COLORS.raCoat);
  g.fillRect(s * 0.18, s * 0.4, s * 0.64, s * 0.5);
  g.fillStyle(FP.COLORS.fratGreek);
  g.fillRect(s * 0.45, s * 0.42, s * 0.1, s * 0.1);
  g.fillStyle(FP.COLORS.paper);
  g.fillRect(s * 0.43, s * 0.5, s * 0.14, s * 0.1);
  g.lineStyle(1, FP.COLORS.ink);
  g.strokeRect(s * 0.43, s * 0.5, s * 0.14, s * 0.1);
  g.fillStyle(0x4a3a30);
  g.fillRect(s * 0.28, s * 0.1, s * 0.44, s * 0.16);
  g.fillStyle(FP.COLORS.skin[1]);
  g.fillRect(s * 0.3, s * 0.22, s * 0.4, s * 0.22);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.36, s * 0.3, s * 0.06, s * 0.04);
  g.fillRect(s * 0.58, s * 0.3, s * 0.06, s * 0.04);
  g.fillRect(s * 0.42, s * 0.4, s * 0.16, 2);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.4, s * 0.64, s * 0.5);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.22, s * 0.9, s * 0.24, s * 0.06);
  g.fillRect(s * 0.54, s * 0.9, s * 0.24, s * 0.06);
};

// ============ COLLECTIBLES ============
FP.drawCollectible = function(g, type) {
  const s = TILE;
  if (type === 'coffee') {
    // Warm glow halo
    g.fillStyle(0xff7a00, 0.18);
    g.fillCircle(s * 0.5, s * 0.52, s * 0.42);
    // Cup body
    g.fillStyle(FP.COLORS.ink);
    g.fillRect(s * 0.24, s * 0.3, s * 0.52, s * 0.52);
    // Sleeve band
    g.fillStyle(0xff7a00);
    g.fillRect(s * 0.24, s * 0.3, s * 0.52, s * 0.13);
    // Inner cup
    g.fillStyle(0xfff5e0);
    g.fillRect(s * 0.28, s * 0.43, s * 0.44, s * 0.3);
    // Coffee liquid
    g.fillStyle(0x5a2e10);
    g.fillRect(s * 0.28, s * 0.54, s * 0.44, s * 0.16);
    g.lineStyle(2.5, FP.COLORS.ink);
    g.strokeRect(s * 0.24, s * 0.3, s * 0.52, s * 0.52);
    // Steam lines
    g.lineStyle(2, 0xaaaaaa, 0.85);
    g.beginPath(); g.moveTo(s * 0.36, s * 0.26); g.lineTo(s * 0.38, s * 0.1); g.strokePath();
    g.beginPath(); g.moveTo(s * 0.5, s * 0.24);  g.lineTo(s * 0.5, s * 0.06); g.strokePath();
    g.beginPath(); g.moveTo(s * 0.64, s * 0.26); g.lineTo(s * 0.62, s * 0.1); g.strokePath();
  } else if (type === 'vinyl') {
    // Punk pink glow
    g.fillStyle(0xff2d6f, 0.22);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.44);
    // Record
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.37);
    // Groove rings
    g.lineStyle(1, 0x2a2a2a, 0.7);
    g.strokeCircle(s * 0.5, s * 0.5, s * 0.29);
    g.strokeCircle(s * 0.5, s * 0.5, s * 0.22);
    // Label
    g.fillStyle(0xff2d6f);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.14);
    // Center hole
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.04);
    // Shine
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(s * 0.38, s * 0.38, s * 0.08);
  } else if (type === 'skateboard') {
    // Cyan glow
    g.fillStyle(0x6effff, 0.22);
    g.fillCircle(s * 0.5, s * 0.52, s * 0.42);
    // Deck
    g.fillStyle(0xc89870);
    g.fillRect(s * 0.08, s * 0.38, s * 0.84, s * 0.22);
    // Grip tape graphic
    g.fillStyle(0xff2d6f);
    g.fillRect(s * 0.2, s * 0.4, s * 0.6, s * 0.12);
    g.fillStyle(FP.COLORS.paper);
    g.fillRect(s * 0.32, s * 0.44, s * 0.36, s * 0.04);
    g.fillStyle(FP.COLORS.ink);
    g.fillRect(s * 0.08, s * 0.38, s * 0.84, 2);
    g.fillRect(s * 0.08, s * 0.58, s * 0.84, 2);
    // Trucks
    g.fillStyle(0x999999);
    g.fillRect(s * 0.18, s * 0.58, s * 0.22, 4);
    g.fillRect(s * 0.6, s * 0.58, s * 0.22, 4);
    // Wheels (4)
    [0.22, 0.38, 0.62, 0.78].forEach(wx => {
      g.fillStyle(0xf0e9d6);
      g.fillCircle(s * wx, s * 0.67, 5);
      g.lineStyle(2, FP.COLORS.ink);
      g.strokeCircle(s * wx, s * 0.67, 5);
    });
    g.lineStyle(2.5, FP.COLORS.ink);
    g.strokeRect(s * 0.08, s * 0.38, s * 0.84, s * 0.22);
  } else { // zine
    // Gold glow
    g.fillStyle(0xffd23f, 0.22);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.42);
    // Zine body
    g.fillStyle(FP.COLORS.paper);
    g.fillRect(s * 0.16, s * 0.1, s * 0.68, s * 0.8);
    // Cover header
    g.fillStyle(0xff2d6f);
    g.fillRect(s * 0.16, s * 0.1, s * 0.68, s * 0.24);
    // Title lines on cover
    g.fillStyle(FP.COLORS.paper);
    g.fillRect(s * 0.22, s * 0.16, s * 0.56, 4);
    g.fillRect(s * 0.22, s * 0.24, s * 0.38, 3);
    // Body text lines
    g.fillStyle(FP.COLORS.ink);
    for (let i = 0; i < 4; i++) g.fillRect(s * 0.22, s * 0.4 + i * s * 0.1, s * 0.56, 2);
    g.fillRect(s * 0.22, s * 0.78, s * 0.4, 2);
    // Staple marks
    g.fillStyle(0x888888);
    g.fillRect(s * 0.16, s * 0.22, 3, 4);
    g.fillRect(s * 0.16, s * 0.62, 3, 4);
    // Punk sticker circle
    g.fillStyle(0xff7a00);
    g.fillCircle(s * 0.72, s * 0.76, 6);
    g.lineStyle(1.5, FP.COLORS.ink);
    g.strokeCircle(s * 0.72, s * 0.76, 6);
    // Border
    g.lineStyle(2.5, FP.COLORS.ink);
    g.strokeRect(s * 0.16, s * 0.1, s * 0.68, s * 0.8);
  }
};

// ============ POWER-UPS ============
FP.POWERUPS = {
  skateboard: { name: 'Speed Skate', icon: '🛹', desc: '4s speed boost',    color: 0x6effff },
  spraypaint: { name: 'Spray Paint', icon: '🎨', desc: 'Tag next frat ×2',  color: 0xff2d6f },
  boombox:    { name: 'Boombox',     icon: '📻', desc: 'Knockback wave',     color: 0xff7a00 },
  moshpit:    { name: 'Mosh Pit',    icon: '🤘', desc: '4s invincible',      color: 0xffd23f },
  zinebomb:   { name: 'Zine Bomb',   icon: '💥', desc: 'Clear all enemies',  color: 0xff2d6f },
};

FP.drawPowerupCrate = function(g, type) {
  const s = TILE;
  const pu = FP.POWERUPS[type];
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.94, s * 0.5, s * 0.08);
  g.fillStyle(0xc89870);
  g.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.7);
  g.fillStyle(0xa07a52);
  g.fillRect(s * 0.18, s * 0.5, s * 0.64, 3);
  g.fillRect(s * 0.5 - 1, s * 0.18, 3, s * 0.7);
  g.lineStyle(2.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.18, s * 0.64, s * 0.7);
  g.fillStyle(pu.color);
  g.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.1);
  g.lineStyle(2.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.18, s * 0.64, s * 0.1);
};

// ============ CHARACTERS ============
FP.CHARACTER_TYPES = [
  { name: 'Punk',   style: 'punk',   hair: 0xff2d6f, shirt: 0x0a0a0a, logo: 0xffd23f },
  { name: 'Goth',   style: 'goth',   hair: 0x2a2a2a, shirt: 0x0a0a0a, logo: 0x8a3aff },
  { name: 'Skater', style: 'skater', hair: 0x4a8ade, shirt: 0xff7a00, logo: 0x0a0a0a },
  { name: 'Raver',  style: 'raver',  hair: 0x2adf6f, shirt: 0xff2d6f, logo: 0x6effff },
  { name: 'Grunge', style: 'grunge', hair: 0x6b4423, shirt: 0x4a3a2a, logo: 0xffd23f },
];

// ============ FIRE EFFECT ============
FP.drawFire = function(g, frame, w) {
  g.clear();
  const flames = 8, fw = w / flames;
  const heights = [
    [22, 30, 18, 32, 24, 28, 20, 34],
    [28, 22, 32, 20, 32, 22, 28, 24],
    [20, 32, 24, 28, 22, 30, 32, 22],
  ][frame];
  for (let i = 0; i < flames; i++) {
    const x = i * fw, h = heights[i];
    g.fillStyle(FP.COLORS.flameRed);
    g.fillTriangle(x, h, x + fw / 2, 0, x + fw, h);
    g.fillStyle(FP.COLORS.flameOrange);
    g.fillTriangle(x + 3, h, x + fw / 2, 6, x + fw - 3, h);
    if (h > 18) {
      g.fillStyle(FP.COLORS.flameYellow);
      g.fillTriangle(x + 6, h, x + fw / 2, 14, x + fw - 6, h);
    }
  }
};
