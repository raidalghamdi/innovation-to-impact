// Minimal server-side raster canvas that encodes to PNG using only Node's
// built-in zlib — no native addons, no system libraries. This is a deliberate
// choice: the build/runtime environment cannot compile node-canvas (cairo/pango
// are unavailable) so `chartjs-node-canvas` is not viable here. Everything the
// charts need (filled rects, lines, polygons, arcs, bitmap text) is implemented
// directly against an RGBA byte buffer.
import zlib from 'node:zlib';
import { GLYPH_H, GLYPH_W, glyphFor } from './font';
import { hexToRgb, type RGB } from './theme';

export type Align = 'left' | 'center' | 'right';

export class PngCanvas {
  readonly width: number;
  readonly height: number;
  private buf: Uint8Array; // RGBA, row-major

  constructor(width: number, height: number, bg = '#FFFFFF') {
    this.width = width;
    this.height = height;
    this.buf = new Uint8Array(width * height * 4);
    this.clear(bg);
  }

  clear(hex: string) {
    const [r, g, b] = hexToRgb(hex);
    for (let i = 0; i < this.width * this.height; i++) {
      const o = i * 4;
      this.buf[o] = r;
      this.buf[o + 1] = g;
      this.buf[o + 2] = b;
      this.buf[o + 3] = 255;
    }
  }

  // Alpha-blend a single pixel (source-over).
  blend(x: number, y: number, c: RGB, a = 1) {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    if (a <= 0) return;
    const o = (yi * this.width + xi) * 4;
    if (a >= 1) {
      this.buf[o] = c[0];
      this.buf[o + 1] = c[1];
      this.buf[o + 2] = c[2];
      this.buf[o + 3] = 255;
      return;
    }
    const ia = 1 - a;
    this.buf[o] = Math.round(c[0] * a + this.buf[o] * ia);
    this.buf[o + 1] = Math.round(c[1] * a + this.buf[o + 1] * ia);
    this.buf[o + 2] = Math.round(c[2] * a + this.buf[o + 2] * ia);
    this.buf[o + 3] = 255;
  }

  fillRect(x: number, y: number, w: number, h: number, hex: string, a = 1) {
    const c = hexToRgb(hex);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, c, a);
  }

  strokeRect(x: number, y: number, w: number, h: number, hex: string, t = 1, a = 1) {
    this.fillRect(x, y, w, t, hex, a);
    this.fillRect(x, y + h - t, w, t, hex, a);
    this.fillRect(x, y, t, h, hex, a);
    this.fillRect(x + w - t, y, t, h, hex, a);
  }

  hLine(x0: number, x1: number, y: number, hex: string, t = 1, a = 1) {
    this.fillRect(Math.min(x0, x1), y - t / 2, Math.abs(x1 - x0), t, hex, a);
  }

  vLine(x: number, y0: number, y1: number, hex: string, t = 1, a = 1) {
    this.fillRect(x - t / 2, Math.min(y0, y1), t, Math.abs(y1 - y0), hex, a);
  }

  // Thick line via a squared pen swept along a Bresenham-style path.
  line(x0: number, y0: number, x1: number, y1: number, hex: string, t = 2, a = 1) {
    const c = hexToRgb(hex);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    const r = Math.max(0.5, t / 2);
    for (let i = 0; i <= steps; i++) {
      const px = x0 + (dx * i) / steps;
      const py = y0 + (dy * i) / steps;
      for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++)
        for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++)
          if (ox * ox + oy * oy <= r * r) this.blend(px + ox, py + oy, c, a);
    }
  }

  // Scanline polygon fill (even-odd). Points: [[x,y],...].
  fillPolygon(pts: Array<[number, number]>, hex: string, a = 1) {
    if (pts.length < 3) return;
    const c = hexToRgb(hex);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, py] of pts) {
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.height - 1, Math.ceil(maxY));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay === by) continue;
        const yc = y + 0.5;
        if ((yc >= ay && yc < by) || (yc >= by && yc < ay)) {
          xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const sx = Math.round(xs[i]);
        const ex = Math.round(xs[i + 1]);
        for (let x = sx; x < ex; x++) this.blend(x, y, c, a);
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, hex: string, a = 1) {
    const c = hexToRgb(hex);
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) this.blend(x, y, c, a);
      }
  }

  // Filled annular sector (donut slice) from angle a0→a1 (radians, clockwise
  // from 12 o'clock is handled by the caller's angle convention).
  fillArcRing(
    cx: number,
    cy: number,
    rOuter: number,
    rInner: number,
    a0: number,
    a1: number,
    hex: string,
    alpha = 1
  ) {
    const c = hexToRgb(hex);
    const start = Math.min(a0, a1);
    const end = Math.max(a0, a1);
    const y0 = Math.max(0, Math.floor(cy - rOuter));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + rOuter));
    const x0 = Math.max(0, Math.floor(cx - rOuter));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + rOuter));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d > rOuter || d < rInner) continue;
        let ang = Math.atan2(dy, dx);
        if (ang < 0) ang += Math.PI * 2;
        if (ang >= start && ang < end) this.blend(x, y, c, alpha);
      }
  }

  // Draw text using the 5x7 bitmap font. `scale` is the integer pixel size of a
  // single font cell. Returns the drawn width in pixels.
  text(
    x: number,
    y: number,
    str: string,
    hex: string,
    scale = 2,
    align: Align = 'left',
    a = 1
  ): number {
    const c = hexToRgb(hex);
    const cellW = (GLYPH_W + 1) * scale;
    const total = str.length * cellW - scale;
    let sx = x;
    if (align === 'center') sx = x - total / 2;
    else if (align === 'right') sx = x - total;
    let cursor = Math.round(sx);
    for (const ch of str) {
      const rows = glyphFor(ch);
      for (let gy = 0; gy < GLYPH_H; gy++) {
        const row = rows[gy];
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (row[gx] === '#') this.fillRect(cursor + gx * scale, y + gy * scale, scale, scale, hex, a);
        }
      }
      cursor += cellW;
      void c;
    }
    return total;
  }

  static textWidth(str: string, scale = 2): number {
    const cellW = (GLYPH_W + 1) * scale;
    return str.length * cellW - scale;
  }

  static textHeight(scale = 2): number {
    return GLYPH_H * scale;
  }

  // Encode the current buffer as a PNG (RGBA, 8-bit) using zlib deflate.
  toPNG(): Buffer {
    const { width, height } = this;
    const stride = width * 4;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
      raw[y * (stride + 1)] = 0; // filter type: none
      Buffer.from(this.buf.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }
    const idat = zlib.deflateSync(raw, { level: 6 });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type RGBA
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([
      sig,
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', idat),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
