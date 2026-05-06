// Drawing routines for tiles, characters, buildings, enemies.
// Pulled out so game.js stays focused on logic.
window.FP = window.FP || {};

const TILE = 40;            // px per tile (was 32 — we're 480 wide)
const COLS = 12;            // 480 / 40 = 12
const VIEW_W = COLS * TILE; // 480
const VIEW_H = 720;

FP.TILE = TILE;
FP.COLS = COLS;
FP.VIEW_W = VIEW_W;
FP.VIEW_H = VIEW_H;

// Cleaner palette — paper/ink with selective punk pops
FP.COLORS = {
  paper: 0xf0e9d6,
  paperDark: 0xe0d8c0,
  ink: 0x0a0a0a,
  inkSoft: 0x2a2a2a,
  // Streets
  road: 0xc8bfa6,
  roadLine: 0xf0e9d6,
  sidewalk: 0xb5ad96,
  grass: 0x9ab485,
  grassDark: 0x7a9468,
  bush: 0x6a8458,
  // Frat
  fratWall: 0x1a3a8c,
  fratWallDark: 0x122968,
  fratRoof: 0x0a1a4a,
  fratWindow: 0xffd23f,
  fratGreek: 0xffd23f,
  // Punk venues
  coffeeWall: 0x6b4423,
  coffeeRoof: 0x3a8559,
  recordWall: 0x2a1845,
  recordRoof: 0xd9325b,
  skateWall: 0x1a6e6e,
  skateRoof: 0xff7a00,
  // Player
  skin: [0xf0c8a0, 0xc89870, 0x8b5a3c, 0x5a3820],
  // Enemies
  fratbroPolo: 0xff7a9e,
  fratbroPoloAlt: 0x8fc9ff,
  sororityHair: 0xffd23f,
  sororityTop: 0xff5a8a,
  sororitySkirt: 0xffffff,
  pledgeShirt: 0x8a8a8a,
  raCoat: 0x2a4a8a,
  // Burn / FX
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
  g.fillRect(x, 19, TILE, 1);  // horizontal joint
}
function drawRoad(g, x) {
  g.fillStyle(FP.COLORS.road);
  g.fillRect(x, 0, TILE, TILE);
  // subtle texture
  g.fillStyle(0xb8af96, 0.4);
  g.fillRect(x + 8, 12, 2, 2);
  g.fillRect(x + 28, 26, 2, 2);
}
function drawRoadLine(g, x) {
  g.fillStyle(FP.COLORS.road);
  g.fillRect(x, 0, TILE, TILE);
  // dashed center line
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
  // Shadow
  g.fillStyle(FP.COLORS.ink, 0.2);
  g.fillRect(4, h - 6, w, 6);
  // Roof
  g.fillStyle(FP.COLORS.fratRoof);
  g.fillRect(0, 0, w, h * 0.28);
  g.fillStyle(FP.COLORS.ink, 0.3);
  g.fillRect(0, h * 0.28 - 2, w, 2);
  // Wall
  g.fillStyle(FP.COLORS.fratWall);
  g.fillRect(0, h * 0.28, w, h * 0.72);
  g.fillStyle(FP.COLORS.fratWallDark, 0.4);
  for (let i = 0; i < 6; i++) g.fillRect(0, h * 0.32 + i * 14, w, 1);
  // Greek banner
  g.fillStyle(FP.COLORS.paper);
  g.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.13);
  g.lineStyle(2, FP.COLORS.ink);
  g.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.13);
  // Windows (2x2)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const wx = w * 0.18 + c * w * 0.42;
      const wy = h * 0.36 + r * h * 0.18;
      g.fillStyle(FP.COLORS.fratWindow);
      g.fillRect(wx, wy, w * 0.22, h * 0.13);
      g.fillStyle(FP.COLORS.ink);
      g.fillRect(wx + w * 0.105, wy, 2, h * 0.13);
      g.fillRect(wx, wy + h * 0.06, w * 0.22, 2);
      g.lineStyle(2, FP.COLORS.ink);
      g.strokeRect(wx, wy, w * 0.22, h * 0.13);
    }
  }
  // Door (always centered for simplicity)
  const doorW = w * 0.22, doorX = (w - doorW) / 2;
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(doorX, h * 0.74, doorW, h * 0.26);
  g.fillStyle(0x4a0000);
  g.fillRect(doorX + 2, h * 0.76, doorW - 4, h * 0.22);
  g.fillStyle(FP.COLORS.fratGreek);
  g.fillRect(doorX + doorW - 6, h * 0.86, 2, 2);  // doorknob
  // Outline whole thing
  g.lineStyle(3, FP.COLORS.ink);
  g.strokeRect(0, 0, w, h);
};

FP.drawFratHouseGreek = function(scene, x, y, abbr) {
  const t = scene.add.text(x, y, abbr, {
    fontFamily: '"Archivo Black", sans-serif',
    fontSize: '14px',
    color: '#0a0a0a',
  });
  t.setOrigin(0.5, 0.5);
  return t;
};

FP.drawBurnedFrat = function(g, w = TILE * 3, h = TILE * 4) {
  // Charred footprint
  g.fillStyle(FP.COLORS.ash);
  g.fillRect(0, h * 0.55, w, h * 0.45);
  g.fillStyle(0x4a3a30);
  g.fillRect(0, h * 0.6, w, h * 0.05);
  // Broken wall stubs
  g.fillStyle(FP.COLORS.inkSoft);
  g.fillRect(w * 0.1, h * 0.4, w * 0.15, h * 0.2);
  g.fillRect(w * 0.7, h * 0.45, w * 0.18, h * 0.18);
  // Tag — graffiti X
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
  // Lid
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.12, s * 0.18, s * 0.76, s * 0.14);
  g.fillStyle(0x1ea05e);
  g.fillRect(s * 0.16, s * 0.2, s * 0.68, s * 0.1);
  // Flame icon
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
  // Awning stripes
  g.fillStyle(FP.COLORS.paper, 0.22);
  for (let i = 0; i < 6; i++) g.fillRect(i * (w / 6), 0, w / 12, h * 0.22);
  g.fillStyle(palette.wall);
  g.fillRect(0, h * 0.22, w, h * 0.78);
  // Big window
  g.fillStyle(palette.sign);
  g.fillRect(w * 0.12, h * 0.32, w * 0.76, h * 0.32);
  g.lineStyle(2, FP.COLORS.ink);
  g.strokeRect(w * 0.12, h * 0.32, w * 0.76, h * 0.32);
  // Sign content per kind
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
  // Door
  const doorW = w * 0.2, doorX = (w - doorW) / 2;
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(doorX, h * 0.7, doorW, h * 0.3);
  g.fillStyle(palette.roof);
  g.fillRect(doorX + 2, h * 0.72, doorW - 4, h * 0.26);
  // Outline
  g.lineStyle(3, FP.COLORS.ink);
  g.strokeRect(0, 0, w, h);
};

// ============ PLAYER ============
FP.drawPunk = function(g, charType, walkFrame, skinIdx, hasCig) {
  const s = TILE;
  const skin = FP.COLORS.skin[skinIdx];
  // Shadow
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.55, s * 0.1);
  // Hair / head silhouette
  const hair = charType.hair;
  g.fillStyle(hair);
  if (charType.style === 'punk') {
    // mohawk
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
    g.fillStyle(0xff7a00);  // beanie band
    g.fillRect(s * 0.2, s * 0.18, s * 0.6, 4);
  } else if (charType.style === 'raver') {
    g.fillRect(s * 0.22, s * 0.06, s * 0.56, s * 0.22);
    g.fillStyle(0x6effff);
    g.fillRect(s * 0.22, s * 0.06, 4, s * 0.22);
    g.fillRect(s * 0.74, s * 0.06, 4, s * 0.22);
  } else { // grunge
    g.fillRect(s * 0.16, s * 0.08, s * 0.68, s * 0.24);
  }
  // Face
  g.fillStyle(skin);
  g.fillRect(s * 0.28, s * 0.22, s * 0.44, s * 0.26);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.28, s * 0.22, s * 0.44, s * 0.26);
  // Eyes (sunglasses for cool factor)
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.3, s * 0.3, s * 0.16, s * 0.06);
  g.fillRect(s * 0.54, s * 0.3, s * 0.16, s * 0.06);
  g.fillRect(s * 0.46, s * 0.32, s * 0.08, 2);
  // Body — faded denim
  g.fillStyle(charType.shirt || 0x1a1a1a);
  g.fillRect(s * 0.2, s * 0.48, s * 0.6, s * 0.28);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.2, s * 0.48, s * 0.6, s * 0.28);
  // Logo on shirt
  g.fillStyle(charType.logo || 0xff2d6f);
  g.fillRect(s * 0.42, s * 0.56, s * 0.16, s * 0.12);
  // Arms
  g.fillStyle(skin);
  g.fillRect(s * 0.1, s * 0.5, s * 0.12, s * 0.22);
  g.fillRect(s * 0.78, s * 0.5, s * 0.12, s * 0.22);
  // Legs (walk cycle)
  const lOff = walkFrame === 1 ? -2 : walkFrame === 3 ? 2 : 0;
  const rOff = walkFrame === 1 ? 2 : walkFrame === 3 ? -2 : 0;
  g.fillStyle(0x2a2a4a);  // dark jeans
  g.fillRect(s * 0.26, s * 0.76 + lOff, s * 0.2, s * 0.16);
  g.fillRect(s * 0.54, s * 0.76 + rOff, s * 0.2, s * 0.16);
  // Shoes
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.22, s * 0.9 + lOff, s * 0.26, s * 0.08);
  g.fillRect(s * 0.52, s * 0.9 + rOff, s * 0.26, s * 0.08);
  // Cigarette
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
  g.fillRect(s * 0.4, s * 0.42, s * 0.2, 4);  // smile
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
  // Backwards cap
  g.fillStyle(0xc41e3a);
  g.fillRect(s * 0.2, s * 0.06, s * 0.6, s * 0.14);
  g.fillRect(s * 0.12, s * 0.13, s * 0.16, 4);
  // Face
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.28, s * 0.2, s * 0.44, s * 0.28);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.28, s * 0.2, s * 0.44, s * 0.28);
  // Sunglasses
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.3, s * 0.28, s * 0.16, s * 0.06);
  g.fillRect(s * 0.54, s * 0.28, s * 0.16, s * 0.06);
  // Polo
  g.fillStyle(FP.COLORS.fratbroPolo);
  g.fillRect(s * 0.2, s * 0.48, s * 0.6, s * 0.26);
  g.fillStyle(FP.COLORS.paper);
  g.fillRect(s * 0.44, s * 0.48, s * 0.12, s * 0.08);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.2, s * 0.48, s * 0.6, s * 0.26);
  // Khaki shorts
  g.fillStyle(0xc8a87a);
  g.fillRect(s * 0.24, s * 0.74, s * 0.22, s * 0.14);
  g.fillRect(s * 0.54, s * 0.74, s * 0.22, s * 0.14);
  // Boat shoes
  g.fillStyle(0x6b4423);
  g.fillRect(s * 0.22, s * 0.88, s * 0.26, s * 0.08);
  g.fillRect(s * 0.52, s * 0.88, s * 0.26, s * 0.08);
  // Solo cup
  g.fillStyle(0xff3a3a);
  g.fillRect(s * 0.84, s * 0.56, s * 0.12, s * 0.16);
};

FP.drawSororityEnemy = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.55, s * 0.1);
  // Hair
  g.fillStyle(FP.COLORS.sororityHair);
  g.fillRect(s * 0.18, s * 0.04, s * 0.64, s * 0.26);
  g.fillRect(s * 0.6, s * 0.02, s * 0.2, s * 0.5);
  // Face
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.28, s * 0.2, s * 0.44, s * 0.28);
  // Big sunglasses
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.3, s * 0.28, s * 0.18, s * 0.08);
  g.fillRect(s * 0.52, s * 0.28, s * 0.18, s * 0.08);
  // Pink top
  g.fillStyle(FP.COLORS.sororityTop);
  g.fillRect(s * 0.22, s * 0.48, s * 0.56, s * 0.22);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.22, s * 0.48, s * 0.56, s * 0.22);
  // Skirt
  g.fillStyle(FP.COLORS.sororitySkirt);
  g.fillRect(s * 0.2, s * 0.7, s * 0.6, s * 0.18);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.2, s * 0.7, s * 0.6, s * 0.18);
  // Legs
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.3, s * 0.88, s * 0.14, s * 0.08);
  g.fillRect(s * 0.56, s * 0.88, s * 0.14, s * 0.08);
};

FP.drawPledge = function(g) {
  const s = TILE;
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.97, s * 0.5, s * 0.08);
  // Smaller / hunched
  g.fillStyle(0x8a8a8a);
  g.fillRect(s * 0.32, s * 0.16, s * 0.36, s * 0.18);  // hair
  g.fillStyle(FP.COLORS.skin[0]);
  g.fillRect(s * 0.32, s * 0.28, s * 0.36, s * 0.22);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.36, s * 0.36, s * 0.06, s * 0.04);
  g.fillRect(s * 0.58, s * 0.36, s * 0.06, s * 0.04);
  // Plain grey shirt with letters
  g.fillStyle(FP.COLORS.pledgeShirt);
  g.fillRect(s * 0.26, s * 0.5, s * 0.48, s * 0.24);
  g.fillStyle(FP.COLORS.fratGreek);
  g.fillRect(s * 0.42, s * 0.58, s * 0.16, 4);
  // Pants
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
  // Coat
  g.fillStyle(FP.COLORS.raCoat);
  g.fillRect(s * 0.18, s * 0.4, s * 0.64, s * 0.5);
  // Lanyard
  g.fillStyle(FP.COLORS.fratGreek);
  g.fillRect(s * 0.45, s * 0.42, s * 0.1, s * 0.1);
  g.fillStyle(FP.COLORS.paper);
  g.fillRect(s * 0.43, s * 0.5, s * 0.14, s * 0.1);
  g.lineStyle(1, FP.COLORS.ink);
  g.strokeRect(s * 0.43, s * 0.5, s * 0.14, s * 0.1);
  // Face
  g.fillStyle(0x4a3a30);
  g.fillRect(s * 0.28, s * 0.1, s * 0.44, s * 0.16);  // hair
  g.fillStyle(FP.COLORS.skin[1]);
  g.fillRect(s * 0.3, s * 0.22, s * 0.4, s * 0.22);
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.36, s * 0.3, s * 0.06, s * 0.04);
  g.fillRect(s * 0.58, s * 0.3, s * 0.06, s * 0.04);
  // Frown
  g.fillRect(s * 0.42, s * 0.4, s * 0.16, 2);
  g.lineStyle(1.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.4, s * 0.64, s * 0.5);
  // Shoes
  g.fillStyle(FP.COLORS.ink);
  g.fillRect(s * 0.22, s * 0.9, s * 0.24, s * 0.06);
  g.fillRect(s * 0.54, s * 0.9, s * 0.24, s * 0.06);
};

// ============ COLLECTIBLES ============
FP.drawCollectible = function(g, type) {
  const s = TILE;
  if (type === 'coffee') {
    g.fillStyle(FP.COLORS.ink);
    g.fillRect(s * 0.28, s * 0.3, s * 0.44, s * 0.5);
    g.fillStyle(0xfff5e0);
    g.fillRect(s * 0.32, s * 0.34, s * 0.36, s * 0.3);
    g.fillStyle(0x6b4423);
    g.fillRect(s * 0.36, s * 0.4, s * 0.28, s * 0.16);
    // Steam
    g.fillStyle(0xaaaaaa, 0.6);
    g.fillRect(s * 0.4, s * 0.22, 3, 6);
    g.fillRect(s * 0.5, s * 0.18, 3, 8);
    g.fillRect(s * 0.6, s * 0.22, 3, 6);
  } else if (type === 'vinyl') {
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.32);
    g.fillStyle(FP.COLORS.recordRoof);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.12);
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(s * 0.5, s * 0.5, s * 0.04);
  } else if (type === 'skateboard') {
    g.fillStyle(0xc89870);
    g.fillRect(s * 0.1, s * 0.45, s * 0.8, s * 0.14);
    g.fillStyle(FP.COLORS.recordRoof);
    g.fillRect(s * 0.4, s * 0.46, s * 0.2, s * 0.06);
    g.fillStyle(FP.COLORS.ink);
    g.fillCircle(s * 0.22, s * 0.66, 4);
    g.fillCircle(s * 0.78, s * 0.66, 4);
  } else { // zine
    g.fillStyle(FP.COLORS.paper);
    g.fillRect(s * 0.22, s * 0.18, s * 0.56, s * 0.64);
    g.lineStyle(2, FP.COLORS.ink);
    g.strokeRect(s * 0.22, s * 0.18, s * 0.56, s * 0.64);
    g.fillStyle(FP.COLORS.punk || 0xff2d6f);
    g.fillRect(s * 0.28, s * 0.24, s * 0.44, s * 0.16);
    g.fillStyle(FP.COLORS.ink);
    for (let i = 0; i < 3; i++) g.fillRect(s * 0.28, s * 0.46 + i * s * 0.08, s * 0.44, 2);
  }
};

// ============ POWER-UPS ============
FP.POWERUPS = {
  skateboard: { name: 'Speed Skate', icon: '🛹', desc: '4s speed boost', color: 0x6effff },
  spraypaint: { name: 'Spray Paint', icon: '🎨', desc: 'Tag next frat ×2', color: 0xff2d6f },
  boombox:    { name: 'Boombox',     icon: '📻', desc: 'Knockback wave',    color: 0xff7a00 },
  moshpit:    { name: 'Mosh Pit',    icon: '🤘', desc: '4s invincible',     color: 0xffd23f },
  zinebomb:   { name: 'Zine Bomb',   icon: '💥', desc: 'Clear all enemies', color: 0xff2d6f },
};

FP.drawPowerupCrate = function(g, type) {
  const s = TILE;
  const pu = FP.POWERUPS[type];
  // Crate
  g.fillStyle(FP.COLORS.ink, 0.25);
  g.fillEllipse(s * 0.5, s * 0.94, s * 0.5, s * 0.08);
  g.fillStyle(0xc89870);
  g.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.7);
  g.fillStyle(0xa07a52);
  g.fillRect(s * 0.18, s * 0.5, s * 0.64, 3);
  g.fillRect(s * 0.5 - 1, s * 0.18, 3, s * 0.7);
  g.lineStyle(2.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.18, s * 0.64, s * 0.7);
  // Color band on top
  g.fillStyle(pu.color);
  g.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.1);
  g.lineStyle(2.5, FP.COLORS.ink);
  g.strokeRect(s * 0.18, s * 0.18, s * 0.64, s * 0.1);
};

// ============ CHARACTERS ============
FP.CHARACTER_TYPES = [
  { name: 'Punk',   style: 'punk',    hair: 0xff2d6f, shirt: 0x0a0a0a, logo: 0xffd23f },
  { name: 'Goth',   style: 'goth',    hair: 0x2a2a2a, shirt: 0x0a0a0a, logo: 0x8a3aff },
  { name: 'Skater', style: 'skater',  hair: 0x4a8ade, shirt: 0xff7a00, logo: 0x0a0a0a },
  { name: 'Raver',  style: 'raver',   hair: 0x2adf6f, shirt: 0xff2d6f, logo: 0x6effff },
  { name: 'Grunge', style: 'grunge',  hair: 0x6b4423, shirt: 0x4a3a2a, logo: 0xffd23f },
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
