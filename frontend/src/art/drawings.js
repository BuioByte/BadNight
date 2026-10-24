// Illustrazioni 1-bit del livello, una per chiave `asset` (vedi packages/level/README.md).
// Ogni disegno riceve una Bitmap 128×128 e lo stato dell'elemento, per le varianti
// (comodino aperto, zucca accesa, porta aperta...). Stile: soggetto grande e bianco,
// dentro una scena buia fatta di pannelli, finestre gotiche, candelabri e assi di legno.

import { Bitmap, hash } from './bitmap.js';

// ---------- scenografia ----------

// Parete a pannelli e pavimento di assi, sfondo di quasi tutte le scene.
// Pareti appena accennate: la scena è buia, il soggetto è la cosa più chiara.
function room(b, floorY = 100) {
  for (let x = 2; x < 128; x += 25) {
    b.line(x, 6, x, floorY - 14, 0.12);
    b.line(x + 21, 6, x + 21, floorY - 14, 0.07);
    b.line(x, 6, x + 21, 6, 0.12);
  }
  b.line(0, floorY - 9, 127, floorY - 9, 0.3);
  b.line(0, floorY, 127, floorY, 0.7);
  for (let y = floorY + 4, gap = 4; y < 128; y += gap, gap++) b.line(0, y, 127, y, 0.25);
  b.shape((x, y) => y > floorY + 1 && hash(x >> 3, y, 7) < 0.035, 0.7);
  // carta da parati scrostata: chiazze chiare dai bordi sfilacciati
  for (const [px, py, s] of [[18, 30, 9], [104, 70, 7], [70, 14, 6]]) {
    b.shape((x, y) => Math.hypot((x - px) / s, (y - py) / (s * 1.6)) < 0.8 + 0.4 * hash(x >> 1, y >> 1, px), 0.18, [px - 2 * s, py - 3 * s, px + 2 * s, py + 3 * s]);
  }
  cobweb(b, 0, 0, 1);
  cobweb(b, 127, 0, -1);
}

// Ragnatela in un angolo in alto; dir = 1 a sinistra, -1 a destra.
function cobweb(b, x, y, dir) {
  for (const a of [0.15, 0.55, 0.95, 1.35]) b.line(x, y, x + dir * 22 * Math.cos(a), y + 22 * Math.sin(a), 0.7);
  for (const r of [6, 11, 16, 21]) {
    const pts = [0.15, 0.55, 0.95, 1.35].map((a) => [x + dir * r * Math.cos(a), y + r * Math.sin(a) - 1]);
    b.polyline(pts, 0.6);
  }
}

// Fascio di luna che scende da una finestra fino al pavimento, a retinatura.
function moonbeam(b, x0, x1, top, floorY, shift = 30) {
  b.poly([[x0, top], [x1, top], [x1 + shift, floorY + 20], [x0 + shift, floorY + 20]], (x, y) => (y > floorY ? 0.35 : 0.12));
}

// Assi di legno viste dall'alto, in diagonale: il piano su cui sono appoggiati gli oggetti.
function planks(b) {
  b.shape(() => true, (x, y) => {
    const u = x * 0.8 + y * 0.6;
    const board = Math.floor(u / 14);
    const local = u - board * 14;
    if (local < 1.2) return 0;
    const grain = Math.sin((y - x * 0.75) / 3 + board * 5) > 0.95 ? 0.3 : 0.06;
    return hash(x >> 2, y, board) < 0.012 ? 0.6 : grain;
  });
}

// Pulviscolo nella luce: pochi pixel sparsi.
function dust(b, seed, [x0, y0, x1, y1] = [0, 0, 127, 127]) {
  b.shape((x, y) => hash(x, y, seed) < 0.006, 1, [x0, y0, x1, y1]);
}

// Bordi che sfumano nel buio, come in una stanza illuminata da una candela sola.
function vignette(b) {
  b.darken(() => true, (x, y) => {
    const d = Math.hypot((x - 63.5) / 64, (y - 63.5) / 64);
    return Math.max(0, Math.min(1, (d - 0.8) * 2.2));
  });
}

// Finestra ad arco con stelle e, se serve, la luna.
function archWindow(b, x, y, w, h, { moon = true } = {}) {
  const cx = x + w / 2;
  const r = w / 2;
  const spring = y + r;
  const inside = (px, py, m = 0) =>
    py <= y + h - m &&
    py >= y + m &&
    Math.abs(px - cx) <= r - m &&
    (py >= spring || (px - cx) ** 2 + (py - spring) ** 2 <= (r - m) ** 2);
  const box = [x - 1, y - 1, x + w + 1, y + h + 1];
  b.shape((px, py) => inside(px, py, 2), 0, box);
  b.shape((px, py) => inside(px, py, 2) && hash(px, py, 3) < 0.025, 1, box);
  if (moon) crescent(b, cx + r * 0.35, spring + 2, Math.max(3, r * 0.3));
  b.shape((px, py) => inside(px, py) && !inside(px, py, 2), 1, box);
  b.line(cx, y + 2, cx, y + h - 2);
  b.line(x + 2, spring + (h - r) * 0.45, x + w - 2, spring + (h - r) * 0.45);
  b.line(x - 2, y + h + 1, x + w + 2, y + h + 1);
}

function crescent(b, x, y, r) {
  b.disc(x, y, r, 1);
  b.disc(x + r * 0.45, y - r * 0.3, r * 0.85, 0);
}

function curtain(b, x, y, w, h) {
  b.shape((px, py) => px >= x && px < x + w && py >= y && py < y + h + Math.sin(px) * 2,
    (px) => ((px - x) % 4 < 2 ? 0.75 : 0.25), [x, y, x + w, y + h + 3]);
  b.line(x, y, x, y + h, 1);
  b.line(x - 2, y, x + w + 2, y, 1);
}

function candle(b, x, base, h, { lit = true } = {}) {
  b.fill(x, base - h, 2, h);
  if (!lit) return;
  b.ellipse(x + 0.5, base - h - 3, 1, 2);
  b.set(x, base - h - 6);
}

// Candelabro da parete a tre bracci.
function candelabra(b, x, y) {
  b.line(x, y, x, y + 14);
  b.ellipse(x, y + 15, 3, 1);
  b.polyline([[x - 7, y - 2], [x - 7, y + 3], [x - 3, y + 6], [x + 3, y + 6], [x + 7, y + 3], [x + 7, y - 2]]);
  b.ellipse(x - 7, y - 2, 2, 1);
  b.ellipse(x + 7, y - 2, 2, 1);
  b.ellipse(x, y - 4, 2, 1);
  candle(b, x - 8, y - 3, 7);
  candle(b, x - 1, y - 5, 8);
  candle(b, x + 6, y - 3, 7);
  b.glow(x, y - 10, 16, 0.25);
}

// Candelabro a stelo, appoggiato a terra.
function candleStand(b, x, top, floor) {
  b.line(x, top + 6, x, floor - 3);
  b.line(x + 1, top + 6, x + 1, floor - 3, 0.5);
  b.poly([[x - 5, floor], [x + 6, floor], [x + 1, floor - 5]]);
  b.ellipse(x, top + 18, 3, 1);
  candelabra(b, x, top);
}

// Alone puntinato attorno a una fonte di luce.
function halo(b, cx, cy, r) {
  for (const rr of [r, r + 4, r + 8]) {
    const steps = Math.round(rr * 2.2);
    for (let i = 0; i < steps; i++) {
      if (hash(i, rr, 11) > 0.7 - (rr - r) * 0.04) continue;
      const a = (i / steps) * Math.PI * 2;
      b.set(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
  }
}

// Un granello di polvere che brilla nel buio (i punti luce delle scene).
function sparkle(b, x, y, s = 2) {
  b.set(x, y);
  if (s > 2) {
    b.set(x - 1, y, 0.5);
    b.set(x + 1, y, 0.5);
  }
}

function sparkles(b, points) {
  points.forEach(([x, y, s]) => sparkle(b, x, y, s));
}

function stars(b, seed, density = 0.012, [x0, y0, x1, y1] = [0, 0, 127, 127]) {
  b.shape((x, y) => hash(x, y, seed) < density, 1, [x0, y0, x1, y1]);
}

function wallFrame(b, x, y, w, h) {
  b.rect(x, y, w, h);
  b.rect(x + 2, y + 2, w - 4, h - 4, 0.5);
  b.fill(x + 3, y + 3, w - 6, h - 6, 0);
}

function noteGlyph(b, x, y) {
  b.ellipse(x, y, 2, 1);
  b.line(x + 2, y, x + 2, y - 7);
  b.line(x + 2, y - 7, x + 5, y - 4);
}

// Ruota un test (x, y) di `deg` gradi attorno a (cx, cy): per disegnare oggetti inclinati.
const rotated = (test, cx, cy, deg) => {
  const a = (-deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x, y) => test(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c);
};

const rotatePoints = (points, cx, cy, deg) => {
  const a = (deg * Math.PI) / 180;
  return points.map(([x, y]) => [
    cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
    cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
  ]);
};

// ---------- personaggi ----------

// Fantasma a lenzuolo: testa tonda, corpo che si assottiglia in una coda piegata di lato.
// Il corpo è pieno in alto, si fa trasparente verso il basso e finisce in brandelli che colano.
function sheetGhost(b, cx, cy, r, { tail = 1, eyes = 'hollow', mouth = 'moan', arms = true, glow = true } = {}) {
  const len = r * 2.6;
  const inside = (x, y) => {
    const dy = y - cy;
    if (dy < 0) return (x - cx) ** 2 + dy ** 2 <= r * r;
    if (dy > len + 10) return false;
    const t = dy / len;
    const center = cx + tail * t * t * r * 1.1;
    const half = r * (1 + 0.25 * Math.sin(t * Math.PI)) * (1 - t * 0.5);
    const strand = Math.floor((x - center + 64) / 3);
    const hem = len - 8 + 14 * hash(strand, Math.round(r), 21);
    return Math.abs(x - center) <= half && dy <= hem;
  };
  const box = [cx - 3 * r, cy - r - 2, cx + 3 * r, cy + len + 12];
  if (glow) b.glow(cx, cy + r * 0.3, r * 2.2, 0.08);
  b.shape(inside, (x, y) => (y < cy + r * 0.5 ? 1 : Math.max(0.2, 1 - (y - cy - r * 0.5) / (len * 0.85))), box);
  b.shape((x, y) => inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)), (x, y) => (y < cy + len * 0.7 ? 1 : 0.6), box);
  if (arms) {
    // braccia lunghe e sottili che si sfilacciano in dita di nebbia
    for (const d of [-1, 1]) {
      b.polyline([[cx + d * r * 0.85, cy + r * 0.5], [cx + d * (r + 7), cy + r * 1.1], [cx + d * (r + 11), cy + r * 1.9]]);
      b.polyline([[cx + d * r * 0.85, cy + r * 0.7], [cx + d * (r + 6), cy + r * 1.3], [cx + d * (r + 10), cy + r * 1.9]], 0.6);
      for (let i = 0; i < 3; i++) b.line(cx + d * (r + 11), cy + r * 1.9, cx + d * (r + 8 + i * 3), cy + r * 1.9 + 5 + i * 2, 0.6);
    }
  }
  // pieghe scure del lenzuolo
  b.line(cx - r * 0.4, cy + r * 0.8, cx - r * 0.3 + tail * 3, cy + len - 6, 0);
  b.line(cx + r * 0.35, cy + r * 0.9, cx + r * 0.3 + tail * 4, cy + len - 10, 0);
  const ey = cy - r * 0.1;
  if (eyes === 'hollow') {
    // orbite vuote, con una colatura
    b.ellipse(cx - r * 0.36, ey, r * 0.2, r * 0.3, 0);
    b.ellipse(cx + r * 0.36, ey, r * 0.2, r * 0.3, 0);
    b.line(cx - r * 0.36, ey + r * 0.3, cx - r * 0.38, ey + r * 0.55, 0);
  } else if (eyes === 'closed') {
    b.polyline([[cx - r * 0.5, ey], [cx - r * 0.35, ey + 2], [cx - r * 0.2, ey]], 0);
    b.polyline([[cx + r * 0.2, ey], [cx + r * 0.35, ey + 2], [cx + r * 0.5, ey]], 0);
  } else if (eyes === 'squint') {
    // un'orbita vuota e l'altra socchiusa: dispettoso, non simpatico
    b.ellipse(cx - r * 0.36, ey, r * 0.2, r * 0.3, 0);
    b.line(cx + r * 0.18, ey - 1, cx + r * 0.55, ey + 2, 0);
    b.line(cx + r * 0.18, ey, cx + r * 0.55, ey + 3, 0);
  } else if (eyes === 'haughty') {
    b.line(cx - r * 0.5, ey, cx - r * 0.2, ey, 0);
    b.line(cx + r * 0.2, ey, cx + r * 0.5, ey, 0);
    b.line(cx - r * 0.5, ey - 3, cx - r * 0.2, ey - 4, 0);
    b.line(cx + r * 0.2, ey - 4, cx + r * 0.5, ey - 3, 0);
  }
  const my = cy + r * 0.4;
  if (mouth === 'moan') {
    b.ellipse(cx, my + 1, r * 0.1, r * 0.2, 0);
  } else if (mouth === 'o') {
    b.ellipse(cx, my + 1, r * 0.15, r * 0.22, 0);
  } else if (mouth === 'yawn') {
    b.ellipse(cx, my + 2, r * 0.22, r * 0.34, 0);
  } else if (mouth === 'grin') {
    // ghigno storto, con i dentini
    b.polyline([[cx - r * 0.4, my - 1], [cx - r * 0.1, my + 2], [cx + r * 0.2, my + 1], [cx + r * 0.45, my - 3]], 0);
    b.polyline([[cx - r * 0.4, my], [cx - r * 0.1, my + 3], [cx + r * 0.2, my + 2], [cx + r * 0.45, my - 2]], 0);
    for (const t of [-0.25, 0.05]) b.set(cx + r * t, my + 3, 0);
  }
  return inside;
}

// Fiocco a farfalla (papillon), inclinato di `deg` gradi.
function bowTie(b, cx, cy, s, deg, v = 0) {
  const p = rotatePoints([[cx - s, cy - s * 0.6], [cx, cy], [cx - s, cy + s * 0.6]], cx, cy, deg);
  const q = rotatePoints([[cx + s, cy - s * 0.6], [cx, cy], [cx + s, cy + s * 0.6]], cx, cy, deg);
  b.poly(p, v);
  b.poly(q, v);
  b.disc(cx, cy, Math.max(1, s * 0.25), v);
}

// Ritratto incorniciato di Ernesto, con il papillon inclinato.
function portrait(b, x, y, w, h, tilt) {
  b.rect(x, y, w, h);
  b.rect(x + 1, y + 1, w - 2, h - 2);
  b.rect(x + 3, y + 3, w - 6, h - 6, 0.5);
  b.fill(x + 4, y + 4, w - 8, h - 8, 0);
  const cx = x + w / 2;
  const s = w / 28;
  b.ellipse(cx, y + h - 4 - 7 * s, 11 * s, 8 * s, 0.5);
  b.fill(cx - 11 * s, y + h - 4 - 7 * s, 22 * s, 7 * s, 0.5);
  b.poly([[cx - 4 * s, y + h * 0.58], [cx + 4 * s, y + h * 0.58], [cx, y + h * 0.75]], 1);
  b.disc(cx, y + h * 0.36, 7 * s);
  b.ellipse(cx - 2.5 * s, y + h * 0.34, s, 1.5 * s, 0);
  b.ellipse(cx + 2.5 * s, y + h * 0.34, s, 1.5 * s, 0);
  b.line(cx, y + h * 0.4, cx + 1.5 * s, y + h * 0.38, 0);
  bowTie(b, cx, y + h * 0.6, 4 * s, tilt === 'sinistra' ? -28 : tilt === 'destra' ? 28 : 0, 1);
  b.ring(cx, y + h * 0.6, 4 * s + 1, 2.4 * s + 1, 0, 1);
}

// Icone dei tre simboli della ninna nanna, piccole (pianoforte, spartito).
function iconPumpkin(b, x, y, v = 1) {
  b.ellipse(x, y, 3, 2, v);
  b.set(x, y - 3, v);
  b.line(x, y - 2, x, y + 2, 1 - v);
}

function iconGhost(b, x, y, v = 1) {
  b.disc(x, y - 1, 2, v);
  b.fill(x - 2, y - 1, 5, 4, v);
  b.set(x - 1, y - 1, 1 - v);
  b.set(x + 1, y - 1, 1 - v);
}

function iconBat(b, x, y, v = 1) {
  b.disc(x, y, 1, v);
  b.poly([[x - 1, y - 1], [x - 5, y - 2], [x - 4, y + 1], [x - 1, y + 1]], v);
  b.poly([[x + 1, y - 1], [x + 5, y - 2], [x + 4, y + 1], [x + 1, y + 1]], v);
}

function batShape(b, cx, cy, s, v = 1) {
  b.ellipse(cx, cy, 2 * s, 3 * s, v);
  b.poly([[cx - 1.5 * s, cy - 2 * s], [cx - 2 * s, cy - 4.5 * s], [cx - 0.5 * s, cy - 3 * s]], v);
  b.poly([[cx + 1.5 * s, cy - 2 * s], [cx + 2 * s, cy - 4.5 * s], [cx + 0.5 * s, cy - 3 * s]], v);
  const wing = (d) => [
    [cx, cy - s], [cx + d * 9 * s, cy - 3 * s], [cx + d * 8 * s, cy], [cx + d * 6 * s, cy - s * 0.5],
    [cx + d * 5 * s, cy + 1.5 * s], [cx + d * 3 * s, cy + 0.5 * s], [cx + d * 1.5 * s, cy + 2 * s],
  ];
  b.poly(wing(-1), v);
  b.poly(wing(1), v);
}

function zzz(b, x, y, s = 3) {
  for (const [dx, dy, k] of [[0, 0, s], [s + 3, -s - 3, s - 1], [2 * s + 5, -2 * s - 5, s - 1]]) {
    b.polyline([[x + dx, y + dy], [x + dx + k, y + dy], [x + dx, y + dy + k], [x + dx + k, y + dy + k]]);
  }
}

// ---------- disegni per chiave asset ----------

const drawings = {
  // ---- stanze ----

  room_cameretta(b) {
    room(b, 98);
    archWindow(b, 10, 8, 30, 54);
    curtain(b, 4, 8, 7, 56);
    curtain(b, 40, 8, 7, 56);
    // ombre lunghe dei giocattoli sulla parete
    b.ellipse(92, 44, 11, 13, 0.2);
    b.ellipse(87, 26, 3, 9, 0.2);
    b.ellipse(97, 26, 3, 9, 0.2);
    // mensola con libri e mappamondo
    b.line(84, 20, 124, 20);
    for (let i = 0; i < 6; i++) b.fill(86 + i * 4, 20 - 7 - (i % 3), 3, 7 + (i % 3), i % 2 ? 1 : 0.5);
    b.ring(116, 13, 5, 5);
    b.line(116, 18, 116, 20);
    wallFrame(b, 60, 12, 14, 18);
    b.disc(67, 20, 3, 0.6);
    // comodino con lampada
    b.rect(28, 76, 18, 22);
    b.line(28, 86, 45, 86);
    b.poly([[30, 62], [44, 62], [47, 70], [27, 70]]);
    b.line(37, 70, 37, 76);
    halo(b, 37, 66, 11);
    // letto
    b.fill(52, 50, 3, 48);
    b.disc(53, 49, 2);
    for (let x = 57; x < 70; x += 4) b.line(x, 54, x, 68, 0.6);
    b.line(55, 54, 70, 54);
    b.fill(55, 68, 62, 10);
    b.ellipse(64, 64, 9, 4);
    b.ring(64, 64, 9, 4, 0);
    b.poly([[70, 62], [116, 64], [119, 84], [108, 88], [96, 83], [84, 90], [72, 84]]);
    b.line(80, 66, 76, 84, 0);
    b.line(94, 66, 92, 82, 0);
    b.line(106, 66, 108, 84, 0);
    b.fill(55, 78, 62, 2, 0);
    b.fill(115, 58, 3, 40);
    b.disc(116, 57, 2);
    b.line(56, 86, 56, 98);
    // tappeto, libro e coniglietto
    b.ring(76, 110, 26, 6);
    b.ring(76, 110, 21, 4, 0.5);
    b.fill(12, 104, 12, 4);
    b.line(12, 106, 23, 106, 0);
    b.ellipse(108, 103, 5, 6);
    b.disc(108, 94, 4);
    b.ellipse(106, 87, 1, 4);
    b.ellipse(110, 87, 1, 4);
    b.set(107, 94, 0);
    b.set(110, 94, 0);
  },

  room_salone(b) {
    room(b, 100);
    archWindow(b, 104, 8, 20, 46, { moon: false });
    // libreria
    b.rect(3, 12, 26, 88);
    for (const y of [32, 52, 72, 92]) {
      b.line(4, y, 28, y);
      for (let x = 5; x < 27; x += 3) {
        const h = 10 + Math.floor(hash(x, y) * 7);
        b.fill(x, y - h, 2, h, hash(x, y, 2) < 0.3 ? 0.5 : 1);
      }
    }
    // arazzo
    b.line(36, 8, 92, 8);
    wallFrame(b, 38, 9, 52, 36);
    crescent(b, 78, 18, 4);
    b.fill(48, 30, 32, 12, 0.6);
    b.fill(52, 24, 6, 18);
    b.fill(70, 22, 6, 20);
    b.fill(60, 28, 8, 14);
    b.poly([[51, 24], [55, 17], [59, 24]]);
    b.poly([[69, 22], [73, 15], [77, 22]]);
    for (let x = 40; x < 89; x += 2) b.line(x, 46, x, 49);
    // candelabri a stelo
    candleStand(b, 36, 56, 100);
    candleStand(b, 96, 58, 100);
    // pianoforte a coda
    b.poly([[52, 74], [96, 74], [116, 64], [120, 72], [102, 88], [52, 88]], 0);
    b.polyline([[52, 74], [96, 74], [116, 64], [120, 72], [102, 88], [52, 88], [52, 74]]);
    b.poly([[64, 74], [110, 52], [114, 58], [96, 74]], 0.3);
    b.polyline([[64, 74], [110, 52], [114, 58], [96, 74]]);
    b.fill(52, 74, 28, 3);
    for (let x = 54; x < 80; x += 3) b.set(x, 74, 0);
    b.line(56, 88, 56, 100);
    b.line(98, 88, 98, 100);
    b.line(116, 74, 116, 96);
    b.fill(58, 94, 22, 3);
    b.line(60, 97, 60, 102);
    b.line(78, 97, 78, 102);
    // tappeto a rombi
    b.shape((x, y) => y > 106 && y < 124 && x > 20 && x < 108 && ((x + y) % 8 === 0 || (x - y + 128) % 8 === 0), 1);
    b.rect(20, 106, 88, 18);
  },

  room_camera_genitori(b) {
    room(b, 98);
    archWindow(b, 52, 4, 24, 34);
    // testiera ad arco
    b.ellipse(64, 56, 42, 18, 0);
    b.ring(64, 56, 42, 18, 1, 2);
    b.ring(64, 56, 36, 13, 0.5);
    // cuscini e teste: mamma, papà e in mezzo il bambino
    b.fill(22, 56, 84, 30, 0);
    b.ellipse(46, 62, 12, 5);
    b.ellipse(82, 62, 12, 5);
    b.ring(46, 62, 12, 5, 0);
    b.ring(82, 62, 12, 5, 0);
    b.disc(46, 60, 5);
    b.disc(82, 60, 5);
    b.disc(64, 63, 4);
    b.ring(64, 63, 4, 4, 0);
    b.ellipse(46, 56, 6, 2, 0.5);
    b.ellipse(82, 56, 7, 3, 0.5);
    // piumone
    b.fill(22, 68, 84, 20);
    for (const x of [36, 54, 74, 94]) b.line(x, 70, x + 3, 86, 0);
    b.line(22, 70, 105, 70, 0);
    b.fill(22, 88, 84, 2, 0.5);
    b.line(24, 90, 24, 98);
    b.line(104, 90, 104, 98);
    zzz(b, 92, 46);
    // lampade sui comodini
    for (const x of [10, 118]) {
      b.rect(x - 7, 78, 14, 20);
      b.poly([[x - 6, 64], [x + 6, 64], [x + 8, 71], [x - 8, 71]]);
      b.line(x, 71, x, 78);
      halo(b, x, 68, 10);
    }
    // i bisnonni fantasma vegliano, appena accennati
    b.disc(14, 34, 6, 0.3);
    b.fill(8, 34, 13, 14, 0.3);
    b.disc(114, 34, 6, 0.3);
    b.fill(108, 34, 13, 14, 0.3);
    b.shape((x, y) => y > 104 && hash(x, y, 5) < 0.05, 1);
  },

  // ---- cameretta ----

  object_comodino(b, state = 'chiuso') {
    room(b, 106);
    wallFrame(b, 18, 12, 22, 28);
    crescent(b, 31, 24, 5);
    // mozzicone di zucca sopra il comodino, solo di sagoma
    b.ellipse(86, 36, 9, 6, 0.4);
    b.fill(85, 28, 2, 3);
    b.fill(32, 42, 64, 62, 0);
    b.rect(34, 44, 60, 62);
    b.fill(28, 38, 72, 6);
    b.line(28, 41, 99, 41, 0);
    b.fill(36, 106, 4, 8);
    b.fill(88, 106, 4, 8);
    b.rect(40, 80, 48, 22, 0.6);
    b.disc(64, 91, 1);
    if (state === 'aperto') {
      b.poly([[38, 54], [90, 54], [96, 60], [32, 60]], 0);
      b.fill(58, 46, 5, 12);
      b.line(60, 42, 61, 46);
      b.polyline([[32, 60], [38, 54], [90, 54], [96, 60]]);
      b.fill(32, 60, 64, 18, 0);
      b.rect(32, 60, 64, 18);
      b.rect(34, 62, 60, 14, 0.4);
      b.disc(64, 69, 2);
      halo(b, 60, 50, 9);
    } else {
      b.rect(38, 52, 52, 22);
      b.rect(40, 54, 48, 18, 0.4);
      b.disc(64, 63, 2);
    }
  },

  item_candela(b) {
    room(b, 104);
    // colonna decorata a sinistra
    b.rect(6, 20, 16, 84);
    for (const y of [34, 56, 78]) b.ring(14, y, 4, 6, 0.7);
    b.fill(4, 16, 20, 4);
    wallFrame(b, 98, 14, 22, 30);
    b.disc(109, 28, 5, 0.4);
    // piattino con manico ricciolo
    b.ellipse(64, 100, 34, 7);
    b.ellipse(64, 99, 29, 4, 0);
    b.ring(64, 99, 29, 4, 0.5);
    b.ring(100, 92, 7, 7, 1, 2);
    b.fill(93, 92, 8, 8, 0);
    // mozzicone con colature, spento, con un filo di fumo
    b.fill(50, 62, 28, 36);
    b.ellipse(64, 62, 14, 3, 0);
    b.ring(64, 62, 14, 3);
    for (const [x, len] of [[50, 16], [57, 9], [70, 13], [77, 22]]) b.ellipse(x, 64 + len / 2, 2, len / 2);
    b.fill(72, 66, 4, 30, (x, y) => ((x + y) % 2 ? 0 : 1));
    b.line(64, 52, 64, 61);
    for (let y = 50; y > 20; y -= 2) b.set(64 + Math.sin(y / 4) * 4, y);
    for (let y = 46; y > 24; y -= 3) b.set(66 + Math.sin(y / 5) * 5, y);
  },

  object_zucca(b, state = 'vuota') {
    room(b, 104);
    b.fill(10, 98, 108, 4);
    b.line(10, 100, 117, 100, 0);
    const lit = state === 'accesa';
    if (lit) {
      halo(b, 64, 72, 40);
      batShape(b, 98, 26, 2.5, 0.35);
    }
    b.ellipse(64, 74, 38, 24, lit ? 0.4 : 1);
    b.ring(64, 74, 38, 24, 1, 2);
    b.ring(64, 74, 26, 24, 0, 1);
    b.ring(64, 74, 12, 24, 0, 1);
    if (lit) {
      b.ring(64, 74, 26, 24, 1, 1);
      b.ring(64, 74, 12, 24, 1, 1);
    }
    b.poly([[61, 52], [67, 52], [71, 42], [66, 41]]);
    b.polyline([[69, 44], [76, 40], [80, 44], [76, 46]]);
    const face = lit ? 1 : 0;
    const darkFace = lit ? 0 : 1;
    b.poly([[44, 74], [56, 74], [50, 62]], 0);
    b.poly([[72, 74], [84, 74], [78, 62]], 0);
    b.poly([[60, 80], [68, 80], [64, 74]], 0);
    b.poly([[40, 82], [88, 82], [84, 92], [76, 88], [70, 94], [64, 89], [58, 94], [52, 88], [44, 92]], 0);
    if (lit) {
      b.poly([[46, 73], [54, 73], [50, 65]], face);
      b.poly([[74, 73], [82, 73], [78, 65]], face);
      b.poly([[43, 83], [85, 83], [82, 90], [76, 87], [70, 92], [64, 88], [58, 92], [52, 87], [46, 90]], face);
    }
    if (state === 'candela_inserita') {
      b.fill(62, 84, 4, 5, darkFace);
      b.line(64, 82, 64, 84);
    }
  },

  object_cestino(b, state = 'pieno') {
    room(b, 106);
    candelabra(b, 108, 26);
    // manico, dietro i giocattoli
    b.shape((x, y) => {
      const d = ((x - 64) / 30) ** 2 + ((y - 60) / 34) ** 2;
      return y < 58 && d <= 1 && d >= 0.82;
    }, 1);
    // orsetto, palla e (se c'è ancora) la caramella di stoffa
    b.disc(44, 50, 9);
    b.disc(36, 42, 3);
    b.disc(52, 42, 3);
    b.set(41, 49, 0);
    b.set(47, 49, 0);
    b.ellipse(44, 54, 3, 2, 0);
    b.ellipse(44, 53, 1, 1);
    b.disc(68, 52, 8);
    b.ring(68, 52, 8, 3, 0);
    b.line(60, 52, 76, 52, 0);
    b.fill(80, 40, 3, 18);
    b.disc(81, 38, 3);
    if (state === 'pieno') {
      b.ellipse(92, 56, 5, 4);
      b.poly([[87, 56], [82, 52], [83, 60]]);
      b.poly([[97, 56], [102, 52], [101, 60]]);
      b.line(90, 53, 94, 59, 0);
      sparkles(b, [[100, 46, 2], [86, 46, 1]]);
    }
    // cesto intrecciato
    const basket = [[28, 60], [100, 60], [92, 106], [36, 106]];
    b.poly(basket, (x, y) => (((y >> 2) + ((x >> 3) & 1)) % 2 ? 1 : 0.35));
    for (let x = 34; x < 96; x += 8) b.line(x, 62, x + (64 - x) * 0.12, 105, 0);
    b.polyline([...basket, basket[0]]);
    b.fill(26, 56, 76, 5);
    b.line(26, 58, 101, 58, 0);
  },

  item_caramella_finta(b) {
    planks(b);
    sparkles(b, [[20, 24, 3], [104, 20, 2], [112, 96, 3], [16, 100, 2], [64, 18, 2]]);
    b.glow(64, 64, 44, 0.18);
    b.poly([[46, 64], [18, 42], [24, 64], [16, 86]]);
    b.poly([[82, 64], [110, 42], [104, 64], [112, 86]]);
    for (const [x0, x1] of [[44, 22], [44, 20], [84, 106], [84, 108]]) b.line(x0, 64, x1, x1 === 22 || x1 === 106 ? 50 : 78, 0);
    b.ellipse(64, 64, 22, 16);
    b.shape((x, y) => ((x - 64) / 22) ** 2 + ((y - 64) / 16) ** 2 < 0.9 && (x + y) % 10 < 3, 0);
    b.shape((x, y) => {
      const d = ((x - 64) / 22) ** 2 + ((y - 64) / 16) ** 2;
      return d < 0.8 && d > 0.62 && (x + y) % 3 === 0;
    }, 0);
    b.ellipse(56, 56, 4, 2, 1);
  },

  object_letto(b) {
    room(b, 104);
    archWindow(b, 88, 6, 26, 40);
    // testiera con sbarre
    b.fill(12, 30, 5, 74);
    b.disc(14, 28, 3);
    b.fill(40, 40, 4, 64);
    b.disc(42, 38, 3);
    b.line(16, 36, 41, 44);
    for (let x = 20; x < 40; x += 5) b.line(x, 38 + (x - 16) / 3, x, 66);
    // materasso, cuscino, coperte arruffate
    b.fill(16, 66, 98, 12);
    b.ellipse(30, 62, 13, 6);
    b.ring(30, 62, 13, 6, 0);
    b.line(22, 61, 36, 60, 0.5);
    b.poly([[42, 58], [70, 54], [112, 60], [118, 84], [104, 92], [92, 86], [80, 96], [66, 88], [54, 94], [44, 84]]);
    for (const [x0, y0, x1, y1] of [[56, 60, 52, 88], [72, 58, 74, 92], [90, 62, 92, 84], [104, 62, 108, 88], [60, 70, 84, 66]]) b.line(x0, y0, x1, y1, 0);
    b.fill(108, 52, 5, 52);
    b.disc(110, 50, 3);
    b.fill(16, 78, 92, 2, 0);
    // sotto il letto, il buio. E due occhietti.
    b.fill(18, 94, 88, 10, 0);
    b.set(64, 99);
    b.set(68, 99);
    b.shape((x, y) => y > 106 && hash(x, y, 9) < 0.05, 1);
  },

  object_pipistrello_peluche(b) {
    room(b, 110);
    b.fill(0, 0, 128, 30, 0);
    b.fill(0, 26, 128, 3);
    b.line(0, 28, 127, 28, 0);
    // ali di stoffa con cuciture
    const wing = (d) => [[64, 64], [64 + d * 46, 46], [64 + d * 42, 60], [64 + d * 52, 70], [64 + d * 38, 74], [64 + d * 44, 86], [64 + d * 14, 84]];
    b.poly(wing(-1), 0.6);
    b.poly(wing(1), 0.6);
    b.polyline([...wing(-1), [64, 64]]);
    b.polyline([...wing(1), [64, 64]]);
    for (const d of [-1, 1]) {
      b.line(64 + d * 8, 66, 64 + d * 42, 60, 1);
      b.line(64 + d * 8, 70, 64 + d * 38, 74, 1);
    }
    // corpo, testa, orecchie
    b.ellipse(64, 84, 16, 18);
    b.ring(64, 86, 9, 10, 0);
    b.shape((x, y) => Math.abs(((x - 64) / 9) ** 2 + ((y - 86) / 10) ** 2 - 1) < 0.25 && (x + y) % 3 === 0, 1);
    b.poly([[52, 50], [50, 32], [60, 44]]);
    b.poly([[76, 50], [78, 32], [68, 44]]);
    b.disc(64, 56, 14);
    for (const x of [58, 70]) {
      b.line(x - 2, 52, x + 2, 56, 0);
      b.line(x - 2, 56, x + 2, 52, 0);
    }
    b.polyline([[59, 62], [64, 65], [69, 62]], 0);
    b.set(61, 64, 1);
    b.set(67, 64, 1);
    // cartellino appeso all'orecchio
    b.line(77, 36, 92, 28);
    b.rect(90, 26, 18, 11);
    b.fill(91, 27, 16, 9);
    b.line(93, 30, 104, 30, 0);
    b.line(93, 33, 100, 33, 0);
    // la chiave che custodisce
    b.ring(78, 104, 4, 4, 1, 2);
    b.fill(82, 103, 18, 2);
    b.fill(94, 105, 2, 4);
    b.fill(98, 105, 2, 3);
    sparkles(b, [[104, 98, 2]]);
  },

  item_chiave(b) {
    planks(b);
    // La chiave è disegnata orizzontale e poi ruotata: anello con tre lobi, fusto, mappa.
    const key = (x, y) => {
      const d = Math.hypot(x - 30, y - 64);
      const lobes = [[30, 52], [18, 64], [30, 76]].some(([lx, ly]) => Math.hypot(x - lx, y - ly) <= 5);
      const ring = (d <= 11 || lobes) && d > 5.5;
      const shaft = x >= 40 && x <= 106 && y >= 61 && y <= 66;
      const collar = x >= 44 && x <= 49 && y >= 57 && y <= 70;
      const bit = x >= 90 && x <= 106 && y > 66 && y <= 80 && !(x >= 95 && x <= 98 && y >= 72) && !(x >= 102 && y >= 76);
      return ring || shaft || collar || bit;
    };
    const test = rotated(key, 64, 64, 35);
    // ombra nera attorno alla chiave, poi la chiave con il lato in ombra
    b.shape((x, y) => test(x - 2, y - 2) || test(x + 2, y + 2) || test(x - 2, y + 2) || test(x + 2, y - 2), 0);
    b.shape(test, 1);
    b.darken((x, y) => test(x, y) && !test(x + 1, y + 1), 0.7);
    // il nastro legato al collo, con due code sfilacciate
    const [bx, by] = rotatePoints([[47, 64]], 64, 64, 35)[0];
    const tails = [
      [[bx, by], [bx + 10, by + 8], [bx + 14, by + 22], [bx + 24, by + 34], [bx + 22, by + 48]],
      [[bx, by], [bx - 6, by + 12], [bx - 2, by + 26], [bx - 10, by + 40]],
    ];
    for (const tail of tails) {
      for (const dx of [-2, -1, 0, 1, 2]) b.polyline(tail.map(([x, y]) => [x + dx, y]), 0);
      for (const dx of [-1, 0, 1]) b.polyline(tail.map(([x, y]) => [x + dx, y]), 1);
      const [ex, ey] = tail.at(-1);
      for (let i = -1; i <= 1; i++) b.line(ex + i, ey, ex + i * 2, ey + 4, 0.6);
    }
    b.ellipse(bx - 7, by - 4, 6, 3, 1);
    b.ellipse(bx - 7, by - 4, 3, 1, 0);
    b.ellipse(bx + 7, by - 5, 6, 3, 1);
    b.ellipse(bx + 7, by - 5, 3, 1, 0);
    b.disc(bx, by - 2, 2);
    dust(b, 6);
  },

  object_porta_cameretta(b, state = 'chiusa') {
    room(b, 108);
    candelabra(b, 112, 30);
    b.rect(28, 6, 72, 102);
    b.rect(30, 8, 68, 100);
    if (state === 'aperta') {
      // il varco sul salone buio: in fondo una finestra e il pavimento in prospettiva
      b.fill(32, 10, 64, 98, 0);
      archWindow(b, 56, 26, 16, 26, { moon: false });
      for (let i = -4; i <= 4; i++) b.line(64 + i * 4, 80, 64 + i * 12, 107, 0.4);
      b.line(32, 80, 95, 80, 0.5);
      b.poly([[32, 10], [48, 2], [48, 118], [32, 108]], 0);
      b.polyline([[32, 10], [48, 2], [48, 118], [32, 108]]);
      for (const [y0, y1] of [[10, 40], [46, 76], [82, 108]]) b.polyline([[36, y0 + 2], [44, y0 - 2], [44, y1 - 2], [36, y1 + 2], [36, y0 + 2]], 0.6);
      b.disc(45, 62, 2);
    } else {
      b.fill(32, 10, 64, 98, 0.15);
      for (const x of [36, 66]) for (const y of [14, 46, 78]) {
        b.fill(x, y, 26, 26, 0);
        b.rect(x, y, 26, 26);
        b.rect(x + 3, y + 3, 20, 20, 0.6);
      }
      b.disc(88, 64, 3);
      b.fill(86, 68, 5, 10);
      b.disc(88, 71, 1, 0);
      b.line(88, 72, 88, 75, 0);
    }
  },

  // ---- salone ----

  object_libreria(b) {
    room(b, 112);
    b.rect(18, 4, 92, 108);
    b.rect(20, 6, 88, 106);
    b.fill(22, 8, 84, 104, 0);
    for (const shelf of [30, 56, 82, 108]) {
      b.fill(21, shelf, 87, 3);
      let x = 23;
      while (x < 104) {
        const w = 3 + Math.floor(hash(x, shelf) * 4);
        const h = 12 + Math.floor(hash(x, shelf, 1) * 10);
        if (x + w > 106) break;
        const r = hash(x, shelf, 2);
        if (r < 0.12) {
          b.poly([[x, shelf], [x + w, shelf], [x + w + 8, shelf - h + 2], [x + 8, shelf - h + 2]], 1);
          x += w + 9;
          continue;
        }
        b.fill(x, shelf - h, w, h, r < 0.3 ? 0.5 : 1);
        b.line(x, shelf - h + 3, x + w - 1, shelf - h + 3, 0);
        b.line(x, shelf - 4, x + w - 1, shelf - 4, 0);
        x += w + 1;
      }
    }
    // fogli sparsi che spuntano e a terra
    b.poly([[60, 50], [72, 46], [74, 56], [62, 58]]);
    b.line(63, 52, 71, 50, 0);
    for (const [x, y, d] of [[10, 118, 10], [92, 120, -12], [40, 122, 8]]) {
      b.poly(rotatePoints([[x, y], [x + 12, y], [x + 12, y + 5], [x, y + 5]], x + 6, y + 2, d));
    }
    b.shape((x, y) => y < 8 && hash(x, y, 13) < 0.2, 1, [20, 0, 108, 7]);
  },

  object_specchio(b) {
    room(b, 108);
    // un guanto bianco che fluttua: Ernesto è qui, ma nello specchio non c'è
    b.ellipse(20, 62, 5, 6);
    for (let i = 0; i < 4; i++) b.fill(16 + i * 2.5, 50 + (i === 0 ? 4 : 0), 2, 8);
    b.fill(17, 66, 7, 4);
    b.line(17, 68, 23, 68, 0);
    sparkles(b, [[12, 48, 2], [28, 74, 1]]);
    // cornice ornata
    b.ring(64, 52, 32, 42, 1, 3);
    b.shape((x, y) => {
      const d = ((x - 64) / 36) ** 2 + ((y - 52) / 46) ** 2;
      return d <= 1 && d > 0.9 && (x + y) % 4 === 0;
    }, 1);
    b.poly([[56, 8], [72, 8], [64, 2]]);
    b.disc(64, 96, 3);
    // vetro con riflessi, e il bambino in pigiama
    b.shape((x, y) => ((x - 64) / 28) ** 2 + ((y - 52) / 38) ** 2 <= 1 && (x - y + 128) % 23 === 0, 0.6);
    b.disc(64, 46, 6);
    b.poly([[56, 56], [72, 56], [76, 84], [52, 84]]);
    b.fill(56, 84, 5, 6);
    b.fill(67, 84, 5, 6);
    for (const y of [62, 70, 78]) b.line(55, y, 73, y, 0);
    b.set(62, 46, 0);
    b.set(66, 46, 0);
    // console sotto lo specchio
    b.fill(30, 100, 68, 3);
    b.line(34, 103, 34, 112);
    b.line(94, 103, 94, 112);
  },

  object_tavolino(b, state = 'nessuno') {
    room(b, 106);
    candelabra(b, 16, 24);
    candelabra(b, 112, 24);
    const tilts = ['sinistra', 'destra', 'dritto'];
    tilts.forEach((tilt, i) => {
      const x = 14 + i * 36;
      portrait(b, x, 36, 28, 40, tilt);
      b.line(x + 8, 76, x + 4, 84);
      b.line(x + 20, 76, x + 24, 84);
      if (state === tilt) {
        b.ring(x + 14, 56, 18, 24, 1);
        halo(b, x + 14, 56, 22);
      }
    });
    // tavolino con tovaglia di pizzo
    b.fill(8, 84, 112, 4);
    b.shape((x, y) => y >= 88 && y < 94 + 2 * Math.sin(x / 3) && x > 8 && x < 120, (x, y) => ((x + y) % 4 ? 0.3 : 1));
    b.line(18, 94, 22, 112);
    b.line(110, 94, 106, 112);
  },

  item_ritratto_sinistra(b) {
    room(b, 120);
    portrait(b, 22, 6, 84, 108, 'sinistra');
  },

  item_ritratto_destra(b) {
    room(b, 120);
    portrait(b, 22, 6, 84, 108, 'destra');
  },

  item_ritratto_dritto(b) {
    room(b, 120);
    portrait(b, 22, 6, 84, 108, 'dritto');
  },

  item_spartito(b) {
    planks(b);
    sparkles(b, [[10, 14, 2], [118, 22, 2], [114, 116, 3], [8, 104, 2]]);
    const paper = [[20, 14], [106, 10], [112, 112], [24, 118]];
    b.poly(paper);
    b.poly([[96, 10], [106, 10], [107, 22]], 0);
    b.polyline([[96, 10], [96, 21], [107, 22]], 0);
    // titolo
    b.fill(36, 20, 40, 2, 0);
    b.fill(46, 25, 22, 1, 0);
    // pentagrammi con le note
    for (let s = 0; s < 3; s++) {
      const y0 = 34 + s * 20;
      for (let l = 0; l < 5; l++) b.line(28, y0 + l * 3 - s, 104, y0 + l * 3 - s - 2, 0);
      for (let n = 0; n < 7; n++) {
        const x = 36 + n * 10;
        const y = y0 + 2 + Math.floor(hash(n, s) * 9) - s;
        b.ellipse(x, y, 2, 1, 0);
        b.line(x + 2, y, x + 2, y - 7, 0);
      }
    }
    // da sinistra a destra: zucca, fantasma, pipistrello
    b.line(32, 98, 100, 96, 0.5);
    iconPumpkin(b, 44, 104, 0);
    iconGhost(b, 64, 104, 0);
    iconBat(b, 86, 104, 0);
    b.line(52, 104, 56, 104, 0);
    b.line(72, 104, 76, 104, 0);
  },

  object_pianoforte(b, state = 'inizio') {
    room(b, 104);
    wallFrame(b, 38, 6, 52, 30);
    crescent(b, 76, 14, 3);
    b.fill(48, 24, 30, 9, 0.6);
    b.fill(52, 18, 5, 15);
    b.fill(68, 16, 5, 17);
    for (let x = 40; x < 88; x += 2) b.line(x, 37, x, 40);
    candleStand(b, 14, 40, 104);
    candleStand(b, 114, 40, 104);
    // corpo nero, coperchio alzato, leggio
    const body = [[24, 66], [84, 66], [114, 50], [120, 60], [98, 86], [24, 86]];
    b.poly(body, 0);
    b.polyline([...body, body[0]]);
    b.line(24, 84, 98, 84, 0.5);
    const lid = [[50, 66], [110, 38], [116, 46], [84, 66]];
    b.poly(lid, 0.2);
    b.polyline([...lid, lid[0]]);
    b.rect(36, 54, 26, 11);
    b.fill(37, 55, 24, 9, 0);
    for (let x = 40; x < 60; x += 4) noteGlyph(b, x, 62);
    // tastiera con i tre tasti segnati
    b.fill(24, 66, 58, 6);
    for (let x = 26; x < 82; x += 4) b.line(x, 66, x, 71, 0);
    for (let x = 27; x < 80; x += 4) if (x % 28 !== 11) b.fill(x, 66, 2, 3, 0);
    const marked = [36, 52, 68];
    const pressed = { inizio: 0, zucca_premuta: 1, fantasma_premuto: 2, completato: 3 }[state] ?? 0;
    iconPumpkin(b, marked[0], 76);
    iconGhost(b, marked[1], 77);
    iconBat(b, marked[2], 76);
    marked.slice(0, pressed).forEach((x) => b.fill(x - 2, 66, 4, 6, 0.4));
    // gambe e panchetta imbottita
    b.fill(28, 86, 3, 18);
    b.fill(92, 84, 3, 20);
    b.fill(110, 64, 3, 30);
    b.fill(34, 94, 34, 5, (x, y) => ((x + y) % 4 === 0 ? 0 : 1));
    b.rect(34, 94, 34, 5);
    b.line(37, 99, 37, 108);
    b.line(65, 99, 65, 108);
    // la musica che sale: una nota per ogni tasto suonato
    [[70, 34], [84, 28], [98, 22]].slice(0, pressed).forEach(([x, y]) => noteGlyph(b, x, y));
    if (pressed === 3) {
      halo(b, 64, 60, 46);
      sparkles(b, [[30, 46, 2], [104, 30, 3], [60, 30, 2]]);
    }
  },

  object_arazzo(b) {
    room(b, 112);
    candelabra(b, 12, 40);
    candelabra(b, 116, 40);
    b.fill(18, 6, 92, 2);
    b.disc(18, 7, 2);
    b.disc(110, 7, 2);
    b.fill(24, 9, 80, 86, 0);
    b.rect(24, 9, 80, 86);
    b.rect(27, 12, 74, 80, 0.6);
    b.shape((x, y) => (x === 25 || x === 102 || y === 10 || y === 93) && (x + y) % 3 === 0, 1, [24, 9, 103, 94]);
    // il castello sotto la luna
    stars(b, 12, 0.03, [30, 15, 98, 50]);
    b.disc(84, 26, 7);
    b.disc(87, 24, 6, 0);
    b.disc(84, 26, 7, (x, y) => (x < 81 ? 1 : 0));
    b.ellipse(64, 92, 40, 14, 0.5);
    b.fill(40, 60, 48, 26);
    b.fill(38, 44, 12, 42);
    b.fill(78, 42, 12, 44);
    b.fill(56, 36, 16, 50);
    b.poly([[36, 44], [44, 30], [52, 44]]);
    b.poly([[76, 42], [84, 28], [92, 42]]);
    b.poly([[54, 36], [64, 20], [74, 36]]);
    for (let x = 41; x < 88; x += 4) b.fill(x, 58, 2, 2, 0);
    for (const [x, y] of [[43, 52], [83, 50], [62, 44], [66, 44], [50, 66], [76, 66]]) b.fill(x, y, 2, 4, 0);
    b.ellipse(64, 82, 5, 7, 0);
    b.fill(59, 82, 11, 4, 0);
    // frange
    for (let x = 26; x < 103; x += 2) b.line(x, 96, x, 100 + (x % 4 ? 0 : 2));
  },

  // ---- fantasmi ----

  ghost_pip(b) {
    room(b, 108);
    candelabra(b, 16, 22);
    archWindow(b, 94, 10, 24, 40, { moon: false });
    moonbeam(b, 96, 116, 14, 108, -40);
    // la capriola: un cerchio di puntini attorno
    for (let a = 0; a < 300; a += 9) b.set(64 + 34 * Math.cos((a * Math.PI) / 180), 58 + 30 * Math.sin((a * Math.PI) / 180));
    b.polyline([[96, 46], [99, 51], [93, 51]]);
    sheetGhost(b, 62, 50, 15, { tail: -1.4, eyes: 'squint', mouth: 'grin' });
    sparkles(b, [[30, 30, 3], [100, 80, 2], [40, 94, 2], [88, 22, 2]]);
  },

  ghost_conte_sbadiglio(b) {
    room(b, 110);
    archWindow(b, 8, 8, 28, 50);
    candelabra(b, 112, 26);
    sheetGhost(b, 66, 46, 18, { tail: 1, eyes: 'closed', mouth: 'yawn', arms: false });
    // berretto da notte che ricade di lato, con il pon pon
    const cap = [[48, 38], [84, 38], [80, 26], [70, 20], [92, 26], [100, 40]];
    b.poly([[48, 38], [84, 38], [78, 24], [66, 22]], 0.5);
    b.polyline([[48, 38], [56, 26], [70, 22], [84, 30], [98, 42]]);
    b.line(48, 38, 84, 38);
    b.disc(99, 44, 4);
    void cap;
    // cuscino abbracciato
    b.fill(46, 64, 40, 18, 0);
    b.rect(46, 64, 40, 18);
    b.rect(48, 66, 36, 14, 0.5);
    b.poly([[44, 62], [48, 64], [46, 67]]);
    b.poly([[88, 62], [84, 64], [86, 67]]);
    b.ellipse(42, 70, 5, 4);
    b.ellipse(90, 72, 5, 4);
    zzz(b, 98, 18, 4);
  },

  ghost_ernesto(b) {
    room(b, 110);
    wallFrame(b, 8, 10, 22, 30);
    b.disc(19, 22, 4, 0.5);
    candelabra(b, 112, 24);
    sheetGhost(b, 64, 44, 18, { tail: 0.6, eyes: 'haughty', mouth: 'none', arms: false });
    // naso all'insù e baffetto altezzoso
    b.line(62, 46, 66, 42, 0);
    b.polyline([[58, 52], [62, 50], [66, 50], [70, 52]], 0);
    // papillon nero
    bowTie(b, 64, 64, 9, 0, 0);
    // guanti bianchi con il contorno nero
    for (const [x, y, d] of [[36, 64, -1], [92, 58, 1]]) {
      b.ellipse(x, y, 6, 7);
      b.ring(x, y, 6, 7, 0);
      for (let i = 0; i < 3; i++) b.line(x - 3 + i * 3, y - 6, x - 4 + i * 3 + d, y - 11, 1);
      b.fill(x - 5, y + 6, 11, 3);
      b.line(x - 5, y + 7, x + 5, y + 7, 0);
    }
    // vassoio sulla mano destra
    b.ellipse(92, 50, 14, 2);
    b.fill(86, 44, 4, 5);
    b.fill(96, 42, 3, 7);
  },

  ghost_ofelia(b) {
    room(b, 110);
    archWindow(b, 6, 6, 24, 46);
    candelabra(b, 112, 22);
    const inside = sheetGhost(b, 62, 42, 17, { tail: 0.8, eyes: 'closed', mouth: 'o', arms: false });
    // vestito di piume: piume a V sulla gonna
    b.shape((x, y) => inside(x, y) && y > 62 && (y - Math.abs(((x - 2) % 8) - 4)) % 6 === 0, 0);
    // pennacchio sulla testa
    for (const [x0, x1, y1] of [[58, 50, 10], [62, 62, 6], [66, 76, 10]]) {
      b.line(x0, 26, x1, y1);
      for (let t = 0.3; t < 1; t += 0.2) {
        const px = x0 + (x1 - x0) * t;
        const py = 26 + (y1 - 26) * t;
        b.set(px - 2, py + 1);
        b.set(px + 2, py + 1);
      }
    }
    // mano al petto e note che volano
    b.ellipse(52, 62, 5, 3);
    b.ellipse(80, 50, 5, 3);
    for (const [x, y] of [[90, 30], [100, 20], [86, 14], [104, 40]]) noteGlyph(b, x, y);
    sparkles(b, [[96, 10, 2], [110, 30, 1]]);
  },

  ghost_nonno_fosco(b) {
    room(b, 110);
    archWindow(b, 96, 8, 26, 44);
    // poltrona a dondolo
    b.rect(30, 22, 34, 52);
    for (let x = 36; x < 62; x += 6) b.line(x, 24, x, 72, 0.6);
    b.fill(28, 74, 56, 4);
    b.line(32, 78, 34, 102);
    b.line(80, 78, 78, 102);
    b.shape((x, y) => {
      const d = ((x - 58) / 44) ** 2 + ((y - 90) / 14) ** 2;
      return y > 98 && d <= 1 && d >= 0.82;
    }, 1);
    b.line(84, 60, 84, 74);
    b.line(72, 60, 88, 60);
    // il nonno seduto, con la barba fino ai piedi
    sheetGhost(b, 56, 40, 14, { tail: 1.4, eyes: 'closed', mouth: 'none', arms: false });
    b.line(48, 34, 53, 33, 0);
    b.line(59, 33, 64, 34, 0);
    const beard = (x, y) => y >= 46 && y <= 108 && Math.abs(x - 58 - (y - 46) * 0.08) <= 9 - (y - 46) * 0.08;
    b.shape(beard, 1);
    b.shape((x, y) => beard(x, y) && (x + Math.round(Math.sin(y / 3) * 2)) % 4 === 0, 0);
    b.ellipse(56, 46, 8, 3);
    b.line(50, 46, 62, 46, 0);
  },

  ghost_bisnonna_adelina(b) {
    room(b, 108);
    // lampada da terra
    b.poly([[96, 22], [112, 22], [116, 32], [92, 32]]);
    b.line(104, 32, 104, 106);
    b.poly([[98, 108], [110, 108], [104, 104]]);
    halo(b, 104, 28, 12);
    // la bisnonna, piccina, con chignon e occhiali
    sheetGhost(b, 44, 44, 14, { tail: -0.8, eyes: 'closed', mouth: 'none', arms: false });
    b.disc(44, 28, 5);
    b.ring(44, 28, 5, 5, 0);
    b.ring(39, 43, 4, 3, 0);
    b.ring(49, 43, 4, 3, 0);
    b.line(43, 43, 45, 43, 0);
    // ferri da maglia e la sciarpa infinita che serpeggia fino a terra
    b.line(34, 70, 64, 52);
    b.line(36, 52, 66, 72);
    b.ellipse(36, 66, 4, 3);
    b.ellipse(56, 62, 4, 3);
    const scarf = (x, y) => {
      if (x < 50 || x > 126) return false;
      const c = 64 + (x - 50) * 0.45 + 7 * Math.sin((x - 50) / 8);
      return Math.abs(y - c) <= 4;
    };
    b.shape(scarf, (x) => (Math.floor(x / 4) % 2 ? 1 : 0.4));
    b.shape((x, y) => scarf(x, y) && !scarf(x, y - 1), 1);
    // gomitolo
    b.disc(88, 112, 7);
    b.ring(88, 112, 4, 6, 0);
    b.line(82, 108, 94, 116, 0);
  },
};

// Bitmap per una chiave asset (e lo stato dell'elemento, se il disegno ha varianti),
// oppure null se per quella chiave non c'è un disegno.
export function drawIllustration(asset, state) {
  const draw = drawings[asset];
  if (!draw) return null;
  const b = new Bitmap();
  draw(b, state ?? undefined);
  vignette(b);
  return b;
}

// Le varianti di stato di ogni disegno, per la pagina di anteprima (art.html).
export const VARIANTS = {
  object_comodino: ['chiuso', 'aperto'],
  object_zucca: ['vuota', 'candela_inserita', 'accesa'],
  object_cestino: ['pieno', 'vuoto'],
  object_porta_cameretta: ['chiusa', 'aperta'],
  object_tavolino: ['nessuno', 'sinistra', 'destra', 'dritto'],
  object_pianoforte: ['inizio', 'zucca_premuta', 'fantasma_premuto', 'completato'],
};

export const ASSETS = Object.keys(drawings);
