import { LOOKS, HAIR_COLORS, UNIFORM as U } from '../data/looks.js';
import { COLORS as P, rect, oval, line, poly } from './draw.js';
import { pushProtected } from '../sim/player.js';
export function playerPose(p, charge) {
  return p.wipeout > 0
    ? 'wipeout'
    : p.hurt > 0
      ? 'hurt'
      : p.release > 0
        ? 'release'
        : p.jumpHeight > 0
          ? 'ollie'
          : p.pushAge < 0.55
            ? 'push'
            : charge
              ? 'charge'
              : 'cruise';
}
// All body geometry is shared; choice and conformity are independent layer stacks.
export function drawPlayer(
  c,
  {
    look = 4,
    hair = 0,
    pipeline = 0,
    level = 0,
    pose = 'cruise',
    chargeAge = 0,
    protected: protectedPose = false,
    time = 0,
  } = {},
) {
  const chosen = LOOKS[look],
    hairColor = HAIR_COLORS[hair];
  c.save();
  if (pose === 'wipeout') {
    c.rotate(-0.8);
    c.translate(-4, 15);
  }
  if (pose === 'hurt') c.rotate(-0.18);
  const tuck = pose === 'ollie' ? 9 : 0;
  if (level === 2) {
    line(
      c,
      [
        [-38, 6],
        [-12, 7],
        [26, 5],
      ],
      P.pink,
      5,
    );
  }
  oval(c, 0, 2, 32, 6, P.ink);
  rect(c, -28, -1, 56, 5, level ? P.green : chosen.trim);
  oval(c, -19, 7, 4, 4, P.ink);
  oval(c, 19, 7, 4, 4, P.ink);
  line(
    c,
    [
      [-11, -32],
      [-17, -16 - tuck],
      [-21, -3 - tuck],
    ],
    P.ink,
    12,
  );
  line(
    c,
    [
      [10, -32],
      [pose === 'push' ? 27 : 16, -18 - tuck],
      [pose === 'push' ? 35 : 22, -3 - tuck],
    ],
    P.ink,
    12,
  );
  line(
    c,
    [
      [-11, -31],
      [-17, -16 - tuck],
      [-21, -3 - tuck],
    ],
    chosen.outfit,
    7,
  );
  line(
    c,
    [
      [10, -31],
      [pose === 'push' ? 27 : 16, -18 - tuck],
      [pose === 'push' ? 35 : 22, -3 - tuck],
    ],
    chosen.outfit,
    7,
  );
  rect(c, -29, -8 - tuck, 15, 6, chosen.trim);
  rect(c, 16, -8 - tuck, 15, 6, chosen.trim);
  rect(c, -19, -66, 38, 36, P.ink);
  rect(c, -16, -63, 32, 30, chosen.outfit);
  poly(
    c,
    [
      [-16, -63],
      [0, -48],
      [16, -63],
      [0, -36],
    ],
    chosen.trim,
  );
  const arm = pose === 'charge' ? -76 : pose === 'release' ? -53 : -38;
  line(
    c,
    [
      [-15, -59],
      [-27, -43],
      [-21, -32],
    ],
    P.ink,
    10,
  );
  line(
    c,
    [
      [15, -59],
      [29, -60],
      [pose === 'release' ? 43 : 29, arm],
    ],
    P.ink,
    10,
  );
  line(
    c,
    [
      [-15, -59],
      [-27, -43],
      [-21, -32],
    ],
    '#CD8D67',
    6,
  );
  line(
    c,
    [
      [15, -59],
      [29, -60],
      [pose === 'release' ? 43 : 29, arm],
    ],
    '#CD8D67',
    6,
  );
  oval(c, 0, -79, 17, 20, P.ink);
  oval(c, 0, -78, 14, 17, '#CD8D67');
  rect(c, -10, -81, 6, 3, P.ink);
  rect(c, 5, -81, 6, 3, P.ink);
  line(
    c,
    [
      [-3, -69],
      [6, -69],
    ],
    P.ink,
    2,
  );
  if (chosen.hair === 'waves' || chosen.hair === 'curls') {
    for (let i = 0; i < 5; i++) oval(c, -20 + i * 10, -92 + (i % 2) * 2, 10, 11, hairColor);
    oval(c, -19, -75, 9, 21, hairColor);
    oval(c, 19, -75, 9, 21, hairColor);
  } else if (chosen.hair === 'bob') {
    poly(
      c,
      [
        [-23, -91],
        [0, -105],
        [22, -91],
        [23, -65],
        [12, -67],
        [10, -86],
        [-14, -85],
        [-14, -66],
        [-24, -66],
      ],
      hairColor,
    );
  } else {
    for (let i = 0; i < 7; i++)
      poly(
        c,
        [
          [-20 + i * 6, -91],
          [-17 + i * 6, -109 - (i % 2) * 8],
          [-11 + i * 6, -89],
        ],
        hairColor,
      );
    if (chosen.hair === 'undercut') rect(c, -19, -89, 12, 12, P.ink);
  }
  if (chosen.accessory === 'glitter' || chosen.accessory === 'star') {
    for (const [x, y] of [
      [-11, -49],
      [11, -39],
      [-25, -73],
      [25, -73],
    ])
      poly(
        c,
        [
          [x, y - 4],
          [x + 2, y],
          [x + 5, y + 1],
          [x, y + 4],
          [x - 2, y],
        ],
        P.yellow,
      );
  } else if (chosen.accessory === 'headphones')
    line(
      c,
      [
        [-20, -81],
        [-21, -103],
        [20, -103],
        [21, -81],
      ],
      chosen.trim,
      5,
    );
  else {
    rect(c, -13, -59, 7, 9, chosen.trim);
    rect(c, 7, -48, 7, 9, chosen.trim);
  }
  // Uniform coverage intentionally uses large shapes so every step reads on a phone.
  if (pipeline >= 15) {
    line(
      c,
      [
        [-22, -55],
        [-32, -34],
      ],
      U.tote,
      5,
    );
    rect(c, -37, -43, 25, 31, U.tote);
    line(
      c,
      [
        [-33, -39],
        [-17, -39],
      ],
      U.letters,
      2,
    );
  }
  if (pipeline >= 30) {
    rect(c, -20, -65, 40, 36, U.quarterZip);
    poly(
      c,
      [
        [-19, -65],
        [0, -57],
        [19, -65],
        [10, -48],
        [-10, -48],
      ],
      U.tote,
    );
    line(
      c,
      [
        [0, -59],
        [0, -40],
      ],
      U.letters,
      3,
    );
  }
  if (pipeline >= 50) {
    poly(
      c,
      [
        [-15, -63],
        [0, -40],
        [15, -63],
        [19, -60],
        [7, -34],
        [-7, -34],
        [-19, -60],
      ],
      U.lanyard,
    );
    rect(c, -11, -42, 22, 18, '#FFFFFF');
    rect(c, -8, -37, 16, 8, U.letters);
  }
  if (pipeline >= 70) {
    oval(c, 0, -94, 26, 18, U.hair);
    oval(c, -22, -78, 8, 17, U.hair);
    oval(c, 22, -78, 8, 17, U.hair);
    line(
      c,
      [
        [-20, -95],
        [0, -101],
        [21, -95],
      ],
      U.tote,
      5,
    );
  }
  if (pipeline >= 85) {
    rect(c, -20, -60, 40, 24, U.letters);
    rect(c, -16, -55, 32, 14, U.quarterZip);
    rect(c, -11, -53, 6, 13, U.letters);
    rect(c, 6, -53, 6, 13, U.letters);
    rect(c, -11, -54, 23, 4, U.letters);
  }
  if (level > 0 && pipeline < 70) {
    for (let i = 0; i < 9; i++) {
      const x = -24 + i * 6;
      poly(
        c,
        [
          [x, -92],
          [x + 2, -118 - (level === 2 ? 12 : 0) - (i % 2) * 8],
          [x + 7, -92],
        ],
        hairColor,
        P.ink,
      );
    }
    for (const x of [-25, -16, 16, 25])
      poly(
        c,
        [
          [x - 4, -61],
          [x, -74],
          [x + 5, -60],
        ],
        P.paper,
      );
    if (level === 2)
      line(
        c,
        [
          [-15, -47],
          [-9, -32],
          [13, -34],
          [19, -48],
        ],
        P.yellow,
        4,
      );
  }
  if (pose === 'charge') {
    rect(c, 25, -89, 8, 14, P.green);
    rect(c, 27, -95, 4, 6, P.paper);
    if (chargeAge >= 0.4 && (chargeAge < 1.5 || Math.floor(time * 6) % 2 === 0)) {
      c.strokeStyle = P.yellow;
      c.lineWidth = 3;
      c.strokeRect(21, -99, 16, 28);
    }
  }
  if (protectedPose) {
    c.strokeStyle = P.paper;
    c.lineWidth = 3;
    c.strokeRect(-37, -120, 79, 125);
  }
  c.restore();
}
export function drawModelPlayer(c, m) {
  const p = m.player;
  drawPlayer(c, {
    look: m.look,
    hair: m.hair,
    pipeline: p.pipeline,
    level: p.level,
    pose: playerPose(p, m.charge),
    chargeAge: m.charge ? m.time - m.charge.started : 0,
    protected: pushProtected(p) || p.invulnerable > 0,
    time: m.time,
  });
}
