// Bitmap a 1 bit: ogni pixel è acceso (bianco) o spento (nero). I disegni in drawings.js usano
// queste primitive e la pagina li mostra ingranditi, a pixel netti.
//
// Il valore `v` di ogni primitiva: 1 accende, 0 spegne, un numero tra 0 e 1 accende solo una parte
// dei pixel con una retinatura ordinata (dithering), per le sfumature. Può essere anche una funzione
// (x, y) => valore, per sfumature che cambiano nello spazio.

export const WIDTH = 128;
export const HEIGHT = 128;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class Bitmap {
  constructor(w = WIDTH, h = HEIGHT) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h);
  }

  set(x, y, v = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (typeof v === 'function') v = v(x, y);
    if (v > 0 && v < 1) {
      if (BAYER[(y & 3) * 4 + (x & 3)] >= v * 16) return;
      v = 1;
    }
    this.px[y * this.w + x] = v ? 1 : 0;
  }

  // Spegne una parte dei pixel accesi, con la stessa retinatura: per ombre e vignettature.
  darken(test, amount) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!test(x, y)) continue;
        const a = typeof amount === 'function' ? amount(x, y) : amount;
        if (BAYER[(y & 3) * 4 + (x & 3)] < a * 16) this.px[y * this.w + x] = 0;
      }
    }
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : 0;
  }

  // Riempie i pixel per cui test(x, y) è vero, dentro il riquadro [x0, y0, x1, y1].
  shape(test, v = 1, [x0, y0, x1, y1] = [0, 0, this.w - 1, this.h - 1]) {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.w - 1, Math.ceil(x1)); x++) {
        if (test(x, y)) this.set(x, y, v);
      }
    }
  }

  fill(x, y, w, h, v = 1) {
    this.shape(() => true, v, [x, y, x + w - 1, y + h - 1]);
  }

  rect(x, y, w, h, v = 1) {
    this.line(x, y, x + w - 1, y, v);
    this.line(x, y + h - 1, x + w - 1, y + h - 1, v);
    this.line(x, y, x, y + h - 1, v);
    this.line(x + w - 1, y, x + w - 1, y + h - 1, v);
  }

  line(x0, y0, x1, y1, v = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, v);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  polyline(points, v = 1) {
    for (let i = 1; i < points.length; i++) this.line(...points[i - 1], ...points[i], v);
  }

  // Poligono pieno (regola pari-dispari, sul centro dei pixel).
  poly(points, v = 1) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const inside = (x, y) => {
      let c = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    this.shape(inside, v, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  }

  ellipse(cx, cy, rx, ry, v = 1) {
    this.shape(
      (x, y) => ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1,
      v,
      [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1],
    );
  }

  disc(cx, cy, r, v = 1) {
    this.ellipse(cx, cy, r, r, v);
  }

  // Contorno di un'ellisse, spesso t pixel.
  ring(cx, cy, rx, ry, v = 1, t = 1) {
    const out = (x, y) => ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1;
    const inn = (x, y) => ((x - cx) / (rx - t + 0.5)) ** 2 + ((y - cy) / (ry - t + 0.5)) ** 2 <= 1;
    this.shape((x, y) => out(x, y) && !inn(x, y), v, [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1]);
  }

  // Alone che sfuma dal centro verso il bordo.
  glow(cx, cy, r, max = 0.4) {
    this.shape(
      (x, y) => Math.hypot(x - cx, y - cy) < r,
      (x, y) => max * (1 - Math.hypot(x - cx, y - cy) / r),
      [cx - r, cy - r, cx + r, cy + r],
    );
  }
}

// Disegna la bitmap sul canvas: bianco e nero, come uno schermo a 1 bit.
export function paint(canvas, bitmap) {
  canvas.width = bitmap.w;
  canvas.height = bitmap.h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(bitmap.w, bitmap.h);
  bitmap.px.forEach((lit, i) => {
    const c = lit ? 255 : 0;
    image.data.set([c, c, c, 255], i * 4);
  });
  ctx.putImageData(image, 0, 0);
}

// Numero pseudo-casuale stabile per un pixel: serve a spargere graffi, polvere e stelle
// sempre negli stessi punti.
export function hash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
