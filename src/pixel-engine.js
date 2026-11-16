// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// True 480x270 Software Pixel Buffer Rasterizer (Z-Buffer + Bayer 4x4 Riso Dither + Optical Benches)

import {
  RISO_PALETTE,
  FORM_FAMILY_RISO_RAMPS,
  BAYER_4X4,
  PIXEL_FONT_5X7,
  hexToRgb,
  rgbToPacked32,
} from './palette.js';

export const NATIVE_WIDTH = 480;
export const NATIVE_HEIGHT = 270;

function packHex(hex, a = 255) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToPacked32(r, g, b, a);
}

const COL32 = Object.freeze({
  paper: packHex(RISO_PALETTE.paper),
  paperWarm: packHex(RISO_PALETTE.paperWarm),
  paperCard: packHex(RISO_PALETTE.paperCard),
  paperDot: packHex(RISO_PALETTE.paperDot),
  paperCoral: packHex(RISO_PALETTE.paperCoral),

  darkBg: packHex(RISO_PALETTE.darkBg),
  darkPanel: packHex(RISO_PALETTE.darkPanel),
  darkCard: packHex(RISO_PALETTE.darkCard),
  darkDot: packHex(RISO_PALETTE.darkDot),

  inkBlack: packHex(RISO_PALETTE.inkBlack),
  inkCharcoal: packHex(RISO_PALETTE.inkCharcoal),
  inkWhite: packHex(RISO_PALETTE.inkWhite),
  inkMuted: packHex(RISO_PALETTE.inkMuted),

  lime: packHex(RISO_PALETTE.lime),
  limeMid: packHex(RISO_PALETTE.limeMid),
  limeDark: packHex(RISO_PALETTE.limeDark),

  pink: packHex(RISO_PALETTE.pink),
  pinkLight: packHex(RISO_PALETTE.pinkLight),
  pinkMid: packHex(RISO_PALETTE.pinkMid),
  pinkDark: packHex(RISO_PALETTE.pinkDark),

  blue: packHex(RISO_PALETTE.blue),
  blueLight: packHex(RISO_PALETTE.blueLight),
  blueMid: packHex(RISO_PALETTE.blueMid),
  blueDark: packHex(RISO_PALETTE.blueDark),

  cyan: packHex(RISO_PALETTE.cyan),
  cyanLight: packHex(RISO_PALETTE.cyanLight),
  cyanDark: packHex(RISO_PALETTE.cyanDark),

  amber: packHex(RISO_PALETTE.amber),
  amberLight: packHex(RISO_PALETTE.amberLight),
  amberDark: packHex(RISO_PALETTE.amberDark),

  coral: packHex(RISO_PALETTE.coral),
  emerald: packHex(RISO_PALETTE.emerald),
  violet: packHex(RISO_PALETTE.violet),
});

// Pre-pack all Riso ramps into 4-stop Uint32 arrays [dark, mid, light, hi]
const PACKED_RAMPS = {};
for (const [key, ramp] of Object.entries(FORM_FAMILY_RISO_RAMPS)) {
  PACKED_RAMPS[key] = [
    rgbToPacked32(ramp.dark[0], ramp.dark[1], ramp.dark[2], 255),
    rgbToPacked32(ramp.mid[0], ramp.mid[1], ramp.mid[2], 255),
    rgbToPacked32(ramp.light[0], ramp.light[1], ramp.light[2], 255),
    rgbToPacked32(ramp.hi[0], ramp.hi[1], ramp.hi[2], 255),
  ];
}

const RAMP_ALIASES = {
  pink: 'cube',
  blue: 'octa',
  cobalt: 'octa',
  lime: 'dodeca',
  green: 'emerald',
  coral: 'trap',
  orange: 'trap',
  amber: 'pyrito',
  yellow: 'gold',
  purple: 'violet',
  amethyst: 'violet',
  calcite: 'rhomb',
  quartz: 'prism',
  tetra: 'dodeca',
  cube_100: 'cube',
  octa_111: 'octa',
  dodeca_110: 'dodeca',
  trap_211: 'trap',
  pyrito_210: 'pyrito',
  hexoct_321: 'hexoct',
};

function resolveRampKey(rawKey) {
  if (!rawKey) return 'octa';
  const k = String(rawKey).trim();
  if (PACKED_RAMPS[k]) return k;
  const lower = k.toLowerCase();
  if (PACKED_RAMPS[lower]) return lower;
  if (RAMP_ALIASES[lower]) return RAMP_ALIASES[lower];
  if (lower.includes('100') || lower.includes('cube')) return 'cube';
  if (lower.includes('111') || lower.includes('octa')) return 'octa';
  if (lower.includes('110') || lower.includes('dodec') || lower.includes('prism')) return 'dodeca';
  if (lower.includes('211') || lower.includes('trap')) return 'trap';
  if (lower.includes('210') || lower.includes('pyrit')) return 'pyrito';
  if (lower.includes('321') || lower.includes('hex')) return 'hexoct';
  if (lower.includes('rhomb')) return 'rhomb';
  if (lower.includes('pinac')) return 'pinacoid';
  if (lower.includes('pyram')) return 'pyramid';
  return 'octa';
}

function norm3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function rotateXYZ(p, rx, ry, rz = 0) {
  let x = p[0];
  let y = p[1];
  let z = p[2];

  if (rz !== 0) {
    const cz = Math.cos(rz);
    const sz = Math.sin(rz);
    const nx = x * cz - y * sz;
    const ny = x * sz + y * cz;
    x = nx;
    y = ny;
  }

  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;

  return [x1, y2, z2];
}

const KEY_LIGHT = norm3([0.46, -0.62, 0.63]);
const FILL_LIGHT = norm3([-0.55, 0.32, 0.36]);

function extractVertexArray(v) {
  if (Array.isArray(v)) return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  if (v && typeof v === 'object') return [Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0];
  return [0, 0, 0];
}

// Convert crystallographic Z-up (c-axis = +Z) to stage Y-up (+Y vertical, right-handed det = +1)
function crystToStage(v) {
  return [v[0], v[2], -v[1]];
}

function normalizeMeshSolids(mesh) {
  if (!mesh) return [];
  const rawSolids = Array.isArray(mesh.solids) && mesh.solids.length > 0
    ? mesh.solids
    : (Array.isArray(mesh.faces) ? [mesh] : []);

  return rawSolids.map((solid, solidIndex) => {
    const verts = Array.isArray(solid.vertices)
      ? solid.vertices.map((v) => crystToStage(extractVertexArray(v)))
      : [];
    // Compute solid centroid for outward normal verification
    let cx = 0;
    let cy = 0;
    let cz = 0;
    if (verts.length > 0) {
      for (const v of verts) {
        cx += v[0];
        cy += v[1];
        cz += v[2];
      }
      cx /= verts.length;
      cy /= verts.length;
      cz /= verts.length;
    }

    const faces = (solid.faces || []).map((f, fIdx) => {
      let polyVerts = [];
      const idxList = f.indices || f.vertexIndices || f.verts;
      if (Array.isArray(idxList) && idxList.length >= 3) {
        if (typeof idxList[0] === 'number') {
          polyVerts = idxList.map((idx) => verts[idx] || [0, 0, 0]);
        } else {
          polyVerts = idxList.map((v) => crystToStage(extractVertexArray(v)));
        }
      } else if (Array.isArray(f.vertices) && f.vertices.length >= 3) {
        if (typeof f.vertices[0] === 'number') {
          polyVerts = f.vertices.map((idx) => verts[idx] || [0, 0, 0]);
        } else {
          polyVerts = f.vertices.map((v) => crystToStage(extractVertexArray(v)));
        }
      }

      let normal = Array.isArray(f.normal) && f.normal.length === 3
        ? norm3(crystToStage(f.normal))
        : [0, 0, 1];

      if ((!f.normal || f.normal.length !== 3) && polyVerts.length >= 3) {
        const e1 = [
          polyVerts[1][0] - polyVerts[0][0],
          polyVerts[1][1] - polyVerts[0][1],
          polyVerts[1][2] - polyVerts[0][2],
        ];
        const e2 = [
          polyVerts[2][0] - polyVerts[0][0],
          polyVerts[2][1] - polyVerts[0][1],
          polyVerts[2][2] - polyVerts[0][2],
        ];
        normal = norm3(cross3(e1, e2));
        const toFace = [
          polyVerts[0][0] - cx,
          polyVerts[0][1] - cy,
          polyVerts[0][2] - cz,
        ];
        if (dot3(normal, toFace) < 0) {
          normal = [-normal[0], -normal[1], -normal[2]];
        }
      }

      const rawRamp = f.rampKey || f.colorKey || f.inkKey || f.formKey || solid.rampKey || mesh.rampKey || 'octa';
      const rampKey = resolveRampKey(rawRamp);
      const miller = (typeof f.hkl === 'string' && f.hkl)
        || f.miller
        || f.hklLabel
        || (Array.isArray(f.hkl) ? `(${f.hkl.join('')})` : '')
        || f.millerLabel
        || `{${rampKey.toUpperCase()}}`;
      const formKey = f.formKey || f.familyKey || f.formId || (typeof f.hkl === 'string' ? f.hkl : rampKey);
      const formNameZh = f.familyZh
        || f.formNameZh
        || f.labelZh
        || f.nameZh
        || FORM_FAMILY_RISO_RAMPS[rampKey]?.labelZh
        || '晶面单形';

      return {
        localIndex: fIdx,
        solidIndex,
        polyVerts,
        normal,
        rampKey,
        miller,
        formKey,
        formNameZh,
      };
    }).filter((f) => f.polyVerts.length >= 3);

    return {
      solidIndex,
      label: solid.label || `个体 ${solidIndex + 1}`,
      faces,
    };
  });
}

function wavelengthToCol32(nm) {
  if (nm >= 620) return COL32.pink;
  if (nm >= 575) return COL32.amber;
  if (nm >= 515) return COL32.lime;
  if (nm >= 475) return COL32.cyan;
  return COL32.blueLight;
}

export class PixelEngine {
  constructor(canvas, width = NATIVE_WIDTH, height = NATIVE_HEIGHT) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.imageData = this.ctx.createImageData(width, height);
    } else {
      this.ctx = null;
      this.imageData = { data: new Uint8ClampedArray(width * height * 4) };
    }

    this.buf32 = new Uint32Array(this.imageData.data.buffer);
    this.zBuf = new Float32Array(width * height);
    this.faceIdBuf = new Int16Array(width * height);
    this.solidIdBuf = new Int16Array(width * height);
    this.faceMeta = [];

    // Precompute PRISMA PIXEL OPTICS background plates
    this.bgTemplates = {
      risoCobalt: this._buildBgTemplate(false, COL32.paperDot),
      risoCoral: this._buildBgTemplate(false, COL32.paperCoral),
      darkBlue: this._buildBgTemplate(true, COL32.darkDot),
    };
  }

  _buildBgTemplate(isDark, dotCol32) {
    const W = this.width;
    const H = this.height;
    const tpl = new Uint32Array(W * H);
    const base = isDark ? COL32.darkBg : COL32.paper;
    const grain = isDark ? COL32.darkPanel : COL32.paperWarm;

    for (let y = 0; y < H; y++) {
      const rowOff = y * W;
      for (let x = 0; x < W; x++) {
        // Subtle deterministic Riso paper grain
        const hash = ((x * 73 + y * 151) ^ (x * 13)) & 63;
        tpl[rowOff + x] = hash === 0 ? grain : base;
      }
    }

    // Progressive Halftone Matrix (dots -> 3x3 '+' crosses -> dense crosses)
    const startX = isDark ? 96 : Math.floor(W * 0.42);
    const step = 8;
    const setSafe = (px, py, c) => {
      if (px >= 4 && px < W - 4 && py >= 4 && py < H - 16) {
        tpl[py * W + px] = c;
      }
    };

    for (let y = 12; y < H - 18; y += step) {
      for (let x = startX; x < W - 8; x += step) {
        const prog = (x - startX) / Math.max(1, W - 8 - startX);
        if (prog < 0.34) {
          setSafe(x, y, dotCol32);
        } else if (prog < 0.72) {
          setSafe(x, y, dotCol32);
          setSafe(x - 1, y, dotCol32);
          setSafe(x + 1, y, dotCol32);
          setSafe(x, y - 1, dotCol32);
          setSafe(x, y + 1, dotCol32);
        } else {
          setSafe(x, y, dotCol32);
          setSafe(x - 1, y, dotCol32);
          setSafe(x + 1, y, dotCol32);
          setSafe(x, y - 1, dotCol32);
          setSafe(x, y + 1, dotCol32);
          setSafe(x + 4, y + 4, dotCol32);
        }
      }
    }

    // Four-corner Registration Marks (⊕)
    const regCol = isDark ? COL32.inkWhite : COL32.inkBlack;
    const drawReg = (cx, cy) => {
      for (let d = -5; d <= 5; d++) {
        if (cx + d >= 0 && cx + d < W) tpl[cy * W + (cx + d)] = regCol;
        if (cy + d >= 0 && cy + d < H) tpl[(cy + d) * W + cx] = regCol;
      }
      const ring = [
        [-1, -3], [0, -3], [1, -3],
        [-1, 3], [0, 3], [1, 3],
        [-3, -1], [-3, 0], [-3, 1],
        [3, -1], [3, 0], [3, 1],
        [-2, -2], [2, -2], [-2, 2], [2, 2],
      ];
      for (const [dx, dy] of ring) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < W && py >= 0 && py < H) {
          tpl[py * W + px] = regCol;
        }
      }
    };

    if (W >= 240 && H >= 140) {
      drawReg(9, 9);
      drawReg(W - 10, 9);
      drawReg(9, H - 10);
      drawReg(W - 10, H - 10);
    }

    return tpl;
  }

  putPixel(x, y, col32) {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    this.buf32[iy * this.width + ix] = col32;
  }

  fillRect(x, y, w, h, col32) {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.width, (x + w) | 0);
    const y1 = Math.min(this.height, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      const off = py * this.width;
      for (let px = x0; px < x1; px++) {
        this.buf32[off + px] = col32;
      }
    }
  }

  fillDitherRect(x, y, w, h, colA, colB) {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.width, (x + w) | 0);
    const y1 = Math.min(this.height, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      const off = py * this.width;
      for (let px = x0; px < x1; px++) {
        this.buf32[off + px] = ((px + py) & 1) === 0 ? colA : colB;
      }
    }
  }

  strokeRect(x, y, w, h, col32) {
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = (x + w - 1) | 0;
    const y1 = (y + h - 1) | 0;
    this.drawLine(x0, y0, x1, y0, col32);
    this.drawLine(x0, y1, x1, y1, col32);
    this.drawLine(x0, y0, x0, y1, col32);
    this.drawLine(x1, y0, x1, y1, col32);
  }

  drawLine(x0, y0, x1, y1, col32, dashPeriod = 0, thickness = 1) {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);

    const dx = Math.abs(ix1 - ix0);
    const sx = ix0 < ix1 ? 1 : -1;
    const dy = -Math.abs(iy1 - iy0);
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    let step = 0;

    while (true) {
      const drawThis = dashPeriod <= 0 || (step % dashPeriod) < (dashPeriod >> 1);
      if (drawThis) {
        if (thickness <= 1) {
          this.putPixel(ix0, iy0, col32);
        } else if (thickness === 2) {
          this.putPixel(ix0, iy0, col32);
          this.putPixel(ix0, iy0 + 1, col32);
          this.putPixel(ix0 + 1, iy0, col32);
        } else {
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              this.putPixel(ix0 + ox, iy0 + oy, col32);
            }
          }
        }
      }
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
      step++;
      if (step > 2048) break;
    }
  }

  drawDepthLine(x0, y0, z0, x1, y1, z1, col32, zBias = 0.03, dashPeriod = 0) {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);

    const totalSteps = Math.max(1, Math.max(Math.abs(ix1 - ix0), Math.abs(iy1 - iy0)));
    const dx = Math.abs(ix1 - ix0);
    const sx = ix0 < ix1 ? 1 : -1;
    const dy = -Math.abs(iy1 - iy0);
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    let step = 0;

    while (true) {
      const t = step / totalSteps;
      const z = z0 + (z1 - z0) * t;
      const onDash = dashPeriod <= 0 || (step % dashPeriod) < Math.ceil(dashPeriod * 0.5);
      if (onDash && ix0 >= 0 && ix0 < this.width && iy0 >= 0 && iy0 < this.height) {
        const idx = iy0 * this.width + ix0;
        if (z + zBias >= this.zBuf[idx]) {
          this.buf32[idx] = col32;
        }
      }
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
      step++;
      if (step > 2048) break;
    }
  }

  drawCircle(cx, cy, r, col32, dashed = false) {
    let x = Math.round(r);
    let y = 0;
    let err = 1 - x;
    let step = 0;
    const icx = Math.round(cx);
    const icy = Math.round(cy);

    while (x >= y) {
      if (!dashed || (step & 1) === 0) {
        this.putPixel(icx + x, icy + y, col32);
        this.putPixel(icx + y, icy + x, col32);
        this.putPixel(icx - y, icy + x, col32);
        this.putPixel(icx - x, icy + y, col32);
        this.putPixel(icx - x, icy - y, col32);
        this.putPixel(icx - y, icy - x, col32);
        this.putPixel(icx + y, icy - x, col32);
        this.putPixel(icx + x, icy - y, col32);
      }
      y++;
      step++;
      if (err < 0) {
        err += 2 * y + 1;
      } else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  drawSparkle(cx, cy, arm = 4, col32 = COL32.lime) {
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    for (let d = -arm; d <= arm; d++) {
      this.putPixel(ix + d, iy, col32);
      this.putPixel(ix, iy + d, col32);
    }
    this.putPixel(ix - 1, iy - 1, COL32.inkWhite);
    this.putPixel(ix + 1, iy - 1, COL32.inkWhite);
    this.putPixel(ix - 1, iy + 1, COL32.inkWhite);
    this.putPixel(ix + 1, iy + 1, COL32.inkWhite);
    this.putPixel(ix, iy, COL32.inkWhite);
  }

  _normalizeText(text) {
    const barredMap = { '1': '\uE001', '2': '\uE002', '3': '\uE003', '4': '\uE004', '6': '\uE006' };
    const pre = String(text || '')
      .replace(/([12346])\u0304/g, (_, d) => barredMap[d] || d)
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => {
        const map = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
        return map[c] || c;
      })
      .replace(/[′’]/g, "'")
      .replace(/[″”]/g, '"')
      .replace(/∧/g, '^')
      .replace(/[–—−]/g, '-')
      .replace(/×/g, 'X')
      .replace(/~/g, '=');

    // Protect standalone lowercase crystallographic axis tokens (c^c, +c, -c, a1..a3, a, b, c, r{)
    const tokens = [];
    const masked = pre
      .replace(/(^|[^A-Za-z0-9])r(?=\{)/g, (_, prefix) => {
        const idx = tokens.length;
        tokens.push('r');
        return `${prefix}\uE010${idx}\uE011`;
      })
      .replace(/(^|[^A-Za-z0-9])(c\^c|[+-]?[abc][1-3]?)(?=[^A-Za-z0-9]|$)/g, (_, prefix, tok) => {
        const idx = tokens.length;
        tokens.push(tok);
        return `${prefix}\uE010${idx}\uE011`;
      });

    return masked
      .toUpperCase()
      .replace(/\uE010(\d+)\uE011/g, (_, idx) => tokens[Number(idx)] || '')
      .replace(/Α/g, 'α')
      .replace(/Λ/g, 'λ')
      .replace(/Θ/g, 'θ');
  }

  measureText(text, scale = 1, spacing = 1) {
    const s = this._normalizeText(text);
    if (!s.length) return 0;
    return s.length * (5 + spacing) * scale - spacing * scale;
  }

  drawText(text, x, y, col32 = COL32.inkBlack, scale = 1, spacing = 1) {
    const str = this._normalizeText(text);
    let cx = Math.round(x);
    const cy = Math.round(y);
    const ampGlyph = [12, 18, 20, 8, 21, 18, 13];

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const glyph = PIXEL_FONT_5X7[ch] || (ch === '&' ? ampGlyph : PIXEL_FONT_5X7[' ']);
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        if (!bits) continue;
        for (let col = 0; col < 5; col++) {
          if ((bits >> (4 - col)) & 1) {
            if (scale === 1) {
              this.putPixel(cx + col, cy + row, col32);
            } else {
              this.fillRect(cx + col * scale, cy + row * scale, scale, scale, col32);
            }
          }
        }
      }
      cx += (5 + spacing) * scale;
    }
    return cx;
  }

  drawTag(text, x, y, bgCol = COL32.inkBlack, fgCol = COL32.lime, borderCol = null, shadow = true) {
    const padX = 4;
    const padY = 3;
    const tw = this.measureText(text, 1, 1);
    const bw = tw + padX * 2;
    const bh = 7 + padY * 2;
    const bx = Math.max(4, Math.min(this.width - bw - 4, Math.round(x)));
    const by = Math.max(4, Math.min(this.height - bh - 16, Math.round(y)));

    if (shadow) {
      this.fillRect(bx + 2, by + 2, bw, bh, COL32.inkBlack);
    }
    this.fillRect(bx, by, bw, bh, bgCol);
    if (borderCol !== null) {
      this.strokeRect(bx, by, bw, bh, borderCol);
    }
    this.drawText(text, bx + padX, by + padY, fgCol, 1, 1);
    return { x: bx, y: by, w: bw, h: bh };
  }

  clearBackground({
    theme = 'riso',
    accent = 'cobalt',
    headerText = '',
    headerStyle = 'lime',
    footerLeft = 'SUVA · PIXEL CRYSTAL',
    footerMid = 'CH.01 // OPTICS LAB',
    footerRight = '3 INKS LOCKED',
  } = {}) {
    const isDark = theme === 'dark';
    const tpl = isDark
      ? this.bgTemplates.darkBlue
      : (accent === 'coral' ? this.bgTemplates.risoCoral : this.bgTemplates.risoCobalt);
    this.buf32.set(tpl);

    // Reset Z-buffer (-Infinity = far, higher z = closer to camera) & face picking buffers
    this.zBuf.fill(-1e9);
    this.faceIdBuf.fill(-1);
    this.solidIdBuf.fill(-1);
    this.faceMeta = [];

    if (headerText) {
      const bg = headerStyle === 'dark'
        ? COL32.inkBlack
        : headerStyle === 'blue'
          ? COL32.blue
          : COL32.lime;
      const fg = headerStyle === 'lime' ? COL32.inkBlack : (headerStyle === 'blue' ? COL32.inkWhite : COL32.lime);
      const border = headerStyle === 'blue' ? COL32.lime : COL32.inkBlack;
      this.drawTag(headerText, 22, 16, bg, fg, border, true);
    }

    if (this.height >= 200) {
      const textCol = isDark ? COL32.inkWhite : COL32.inkBlack;
      if (footerLeft) this.drawText(footerLeft, 22, this.height - 13, textCol, 1, 1);
      if (footerMid) this.drawText(footerMid, 166, this.height - 13, isDark ? COL32.cyan : COL32.inkCharcoal, 1, 1);
      if (footerRight) {
        const rw = this.measureText(footerRight, 1, 1);
        this.drawText(footerRight, this.width - 22 - rw, this.height - 13, textCol, 1, 1);
      }
    }
  }

  _rasterizeTriangleBary(v0, v1, v2, rampStops, shadeFloat, faceId, solidId) {
    const W = this.width;
    const H = this.height;

    const minX = Math.max(0, Math.floor(Math.min(v0[0], v1[0], v2[0])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(v0[0], v1[0], v2[0])));
    const minY = Math.max(0, Math.floor(Math.min(v0[1], v1[1], v2[1])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(v0[1], v1[1], v2[1])));
    if (minX > maxX || minY > maxY) return;

    const denom = (v1[1] - v2[1]) * (v0[0] - v2[0]) + (v2[0] - v1[0]) * (v0[1] - v2[1]);
    if (Math.abs(denom) < 1e-5) return;
    const invDenom = 1 / denom;

    // Map continuous lighting [0..1] onto 4 Riso stops [dark, mid, light, hi] with Bayer 4x4 ordered dither
    const scaled = Math.max(0, Math.min(2.999, shadeFloat * 3.0));
    const band = Math.floor(scaled);
    const frac16 = (scaled - band) * 16;
    const colLow = rampStops[band];
    const colHigh = rampStops[Math.min(3, band + 1)];

    for (let py = minY; py <= maxY; py++) {
      const bayerRow = BAYER_4X4[py & 3];
      const cy = py + 0.5;
      const rowOff = py * W;

      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        const w0 = ((v1[1] - v2[1]) * (cx - v2[0]) + (v2[0] - v1[0]) * (cy - v2[1])) * invDenom;
        if (w0 < -0.0005) continue;
        const w1 = ((v2[1] - v0[1]) * (cx - v2[0]) + (v0[0] - v2[0]) * (cy - v2[1])) * invDenom;
        if (w1 < -0.0005) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < -0.0005) continue;

        const z = w0 * v0[2] + w1 * v1[2] + w2 * v2[2];
        const idx = rowOff + px;
        if (z >= this.zBuf[idx]) {
          this.zBuf[idx] = z;
          this.faceIdBuf[idx] = faceId;
          this.solidIdBuf[idx] = solidId;
          const threshold = bayerRow[px & 3] + 0.5;
          this.buf32[idx] = frac16 > threshold ? colHigh : colLow;
        }
      }
    }
  }

  _drawFloorCheckerShadow(cx, floorY, rx, ry, isDark, insideFrame = false) {
    const W = this.width;
    const H = this.height;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(W - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(floorY - ry));
    const y1 = Math.min(H - 16, Math.ceil(floorY + ry));
    const shadowCol = insideFrame
      ? COL32.inkBlack
      : (isDark ? COL32.inkBlack : COL32.inkCharcoal);

    for (let py = y0; py <= y1; py++) {
      const ny = (py - floorY) / Math.max(1, ry);
      const rowOff = py * W;
      for (let px = x0; px <= x1; px++) {
        if (((px + py) & 1) !== 0) continue;
        const nx = (px - cx) / Math.max(1, rx);
        if (nx * nx + ny * ny <= 1.0) {
          this.buf32[rowOff + px] = shadowCol;
        }
      }
    }
  }

  drawCrystalScene(mesh, opts = {}) {
    const {
      theme = 'riso',
      rotX = 0.38,
      rotY = 0.62,
      rotZ = 0,
      zoom = 1.0,
      explode = 0,
      centerX = Math.round(this.width * 0.5),
      centerY = Math.round(this.height * 0.49),
      bob = true,
      timeSec = 0,
      showAxes = false,
      showTwinCallout = false,
      selectedFaceId = -1,
      hoveredFaceId = -1,
      secondFaceId = -1,
      highlightFormKey = null,
      cobaltFrame = false,
      frameCaption = '',
      overrideRampKey = null,
      leftInfoCard = null,
    } = opts;

    const isDark = theme === 'dark';
    const solids = normalizeMeshSolids(mesh);
    if (!solids.length) return;

    // Optional Home/Hero Cobalt + Pink Riso Offset Frame (pixel_08 homage!)
    if (cobaltFrame) {
      const fw = 194;
      const fh = 204;
      const fx = Math.round(centerX - fw * 0.5);
      const fy = Math.round(centerY - fh * 0.5 + 2);
      this.fillRect(fx + 6, fy + 6, fw, fh, COL32.pink);
      this.fillRect(fx, fy, fw, fh, COL32.blue);
      this.strokeRect(fx, fy, fw, fh, COL32.inkBlack);

      // Subtle inner halftone crosses inside bottom of cobalt frame
      for (let py = fy + 116; py < fy + fh - 24; py += 8) {
        for (let px = fx + 8; px < fx + fw - 8; px += 8) {
          this.putPixel(px, py, COL32.blueDark);
          this.putPixel(px - 1, py, COL32.blueDark);
          this.putPixel(px + 1, py, COL32.blueDark);
          this.putPixel(px, py - 1, COL32.blueDark);
          this.putPixel(px, py + 1, COL32.blueDark);
        }
      }

      this.drawSparkle(fx + 22, fy + 28, 4, COL32.lime);
      this.drawSparkle(fx + fw - 24, fy + 34, 2, COL32.lime);
      this.drawSparkle(fx + 26, fy + fh - 44, 3, COL32.inkWhite);

      if (frameCaption) {
        this.fillRect(fx + 5, fy + fh - 22, fw - 10, 16, COL32.inkBlack);
        this.drawText(frameCaption, fx + 10, fy + fh - 17, COL32.lime, 1, 1);
      }
    }

    // Optional Left Constancy / Info Dashed Plate Card (pixel_01 homage!)
    if (leftInfoCard) {
      const cx0 = 22;
      const cy0 = 42;
      const cw = 178;
      const ch = 182;
      this.fillRect(cx0, cy0, cw, ch, isDark ? COL32.darkPanel : COL32.paperCard);
      // Dashed border
      this.drawLine(cx0, cy0, cx0 + cw, cy0, isDark ? COL32.lime : COL32.inkBlack, 6);
      this.drawLine(cx0, cy0 + ch, cx0 + cw, cy0 + ch, isDark ? COL32.lime : COL32.inkBlack, 6);
      this.drawLine(cx0, cy0, cx0, cy0 + ch, isDark ? COL32.lime : COL32.inkBlack, 6);
      this.drawLine(cx0 + cw, cy0, cx0 + cw, cy0 + ch, isDark ? COL32.lime : COL32.inkBlack, 6);

      if (leftInfoCard.kicker) {
        this.drawText(leftInfoCard.kicker, cx0 + 10, cy0 + 12, COL32.blue, 1, 1);
      }
      if (leftInfoCard.badge) {
        this.drawTag(leftInfoCard.badge, cx0 + 10, cy0 + 26, COL32.inkBlack, COL32.lime, null, false);
      }
      // Draw mini hexagon & distorted hexagon constancy diagram (120° = 120°)
      const h1x = cx0 + 50;
      const h1y = cy0 + 96;
      const hexA = [
        [0, -22], [19, -11], [19, 11], [0, 22], [-19, 11], [-19, -11],
      ];
      for (let i = 0; i < 6; i++) {
        const a = hexA[i];
        const b = hexA[(i + 1) % 6];
        this.drawLine(h1x + a[0], h1y + a[1], h1x + b[0], h1y + b[1], COL32.blue, 0, 1);
      }
      this.drawLine(h1x, h1y, h1x, h1y - 24, COL32.blue);
      this.drawLine(h1x, h1y, h1x + 20, h1y - 11, COL32.pink);
      this.drawText('120°', h1x - 11, h1y + 30, COL32.pink, 1, 1);

      const h2x = cx0 + 128;
      const h2y = cy0 + 96;
      const hexB = [
        [0, -28], [16, -18], [16, 18], [0, 28], [-16, 18], [-16, -18],
      ];
      for (let i = 0; i < 6; i++) {
        const a = hexB[i];
        const b = hexB[(i + 1) % 6];
        this.drawLine(h2x + a[0], h2y + a[1], h2x + b[0], h2y + b[1], COL32.coral, 0, 1);
      }
      this.drawLine(h2x, h2y, h2x, h2y - 28, COL32.blue);
      this.drawLine(h2x, h2y, h2x + 17, h2y - 10, COL32.pink);
      this.drawText('120°', h2x - 11, h2y + 30, COL32.blue, 1, 1);

      this.drawText('EQUIVALENT ANGLES!', cx0 + 26, cy0 + 150, isDark ? COL32.inkWhite : COL32.inkBlack, 1, 1);
    }

    // Measure bounding radius across all solids for consistent framing
    let maxR = 0.001;
    for (const solid of solids) {
      for (const face of solid.faces) {
        for (const v of face.polyVerts) {
          const r = Math.hypot(v[0], v[1], v[2]);
          if (r > maxR) maxR = r;
        }
      }
    }

    const baseRadiusPx = Math.min(this.width, this.height) * 0.285 * zoom;
    const scale = baseRadiusPx / maxR;
    const bobOffset = bob ? Math.round(Math.sin(timeSec * 2.2) * 2.5) : 0;
    const cy = centerY + bobOffset;
    const fov = 5.5 * maxR;

    // 1. Floor 50% Checkerboard Shadow
    const shadowY = Math.min(this.height - 26, Math.round(centerY + baseRadiusPx * 1.02));
    this._drawFloorCheckerShadow(
      centerX,
      shadowY,
      baseRadiusPx * (solids.length > 1 ? 0.92 : 0.78),
      baseRadiusPx * 0.17,
      isDark,
      cobaltFrame
    );

    const project3D = (pt3) => {
      const persp = fov / Math.max(0.2 * maxR, fov - pt3[2]);
      return [
        centerX + pt3[0] * scale * persp,
        cy - pt3[1] * scale * persp,
        pt3[2] / maxR,
      ];
    };

    // 2. Rasterize all faces with Per-Pixel Z-Buffer + Ordered Bayer 4x4 Dither
    let minScreenX = this.width;
    let maxScreenX = 0;
    let minScreenY = this.height;
    let maxScreenY = 0;

    const frontEdges = [];
    let globalFaceId = 0;

    for (const solid of solids) {
      for (const face of solid.faces) {
        const faceId = globalFaceId++;
        const nView = rotateXYZ(face.normal, rotX, rotY, rotZ);
        const explodeDist = explode > 0 ? explode * maxR * 0.34 : 0;

        // Transform polygon vertices
        const vProj = face.polyVerts.map((v) => {
          const shifted = explodeDist > 0
            ? [
                v[0] + face.normal[0] * explodeDist,
                v[1] + face.normal[1] * explodeDist,
                v[2] + face.normal[2] * explodeDist,
              ]
            : v;
          const rv = rotateXYZ(shifted, rotX, rotY, rotZ);
          return project3D(rv);
        });

        // Screen-space signed area for exact perspective backface culling
        let area2 = 0;
        for (let i = 0; i < vProj.length; i++) {
          const a = vProj[i];
          const b = vProj[(i + 1) % vProj.length];
          area2 += (a[0] * b[1] - b[0] * a[1]);
        }

        // Note: screen Y is down while world Y is up, so front-facing CCW 3D polygon has area2 < 0 or nView[2] > 0
        // Check nView[2] against camera ray so winding variations never hide front faces!
        let fcx3 = 0;
        let fcy3 = 0;
        let fcz3 = 0;
        for (const v of face.polyVerts) {
          fcx3 += v[0];
          fcy3 += v[1];
          fcz3 += v[2];
        }
        fcx3 /= face.polyVerts.length;
        fcy3 /= face.polyVerts.length;
        fcz3 /= face.polyVerts.length;
        const cRot = rotateXYZ([fcx3, fcy3, fcz3], rotX, rotY, rotZ);
        const toCam = [0 - cRot[0], 0 - cRot[1], fov - cRot[2]];
        const facing = dot3(nView, toCam);

        const isFront = explode > 0.02 ? true : facing >= -0.02 * maxR;
        const effectiveN = facing < 0 ? [-nView[0], -nView[1], -nView[2]] : nView;

        let scx = 0;
        let scy = 0;
        for (const vp of vProj) {
          scx += vp[0];
          scy += vp[1];
        }
        scx /= vProj.length;
        scy /= vProj.length;

        this.faceMeta[faceId] = {
          faceId,
          solidIndex: solid.solidIndex,
          solidLabel: solid.label,
          miller: face.miller,
          formKey: face.formKey,
          rampKey: face.rampKey,
          formNameZh: face.formNameZh,
          normal: face.normal,
          viewNormal: effectiveN,
          screenCx: scx,
          screenCy: scy,
        };

        if (!isFront) continue;

        const rKey = overrideRampKey
          ? resolveRampKey(overrideRampKey)
          : (solids.length > 1 && !face.rampKey ? (solid.solidIndex === 0 ? 'twinA' : 'twinB') : face.rampKey);
        const rampStops = PACKED_RAMPS[rKey] || PACKED_RAMPS.octa;

        const kDiff = Math.max(0, dot3(effectiveN, KEY_LIGHT));
        const kFill = Math.max(0, dot3(effectiveN, FILL_LIGHT));
        const spec = Math.pow(Math.max(0, effectiveN[2]), 6) * 0.22;
        let shade = 0.10 + kDiff * 0.72 + kFill * 0.16 + spec;

        const isSelected = faceId === selectedFaceId || faceId === secondFaceId;
        const isHovered = faceId === hoveredFaceId;
        const isFormHi = highlightFormKey && face.formKey === highlightFormKey;
        if (isSelected || isHovered || isFormHi) {
          shade = Math.min(1.0, shade + 0.26);
        }

        for (const vp of vProj) {
          if (vp[0] < minScreenX) minScreenX = vp[0];
          if (vp[0] > maxScreenX) maxScreenX = vp[0];
          if (vp[1] < minScreenY) minScreenY = vp[1];
          if (vp[1] > maxScreenY) maxScreenY = vp[1];
        }

        for (let i = 1; i < vProj.length - 1; i++) {
          this._rasterizeTriangleBary(
            vProj[0],
            vProj[i],
            vProj[i + 1],
            rampStops,
            shade,
            faceId,
            solid.solidIndex
          );
        }

        for (let i = 0; i < vProj.length; i++) {
          frontEdges.push({
            a: vProj[i],
            b: vProj[(i + 1) % vProj.length],
            faceId,
            isHighlight: isSelected || isHovered || isFormHi,
          });
        }
      }
    }

    // 3. Crisp 1px Bresenham Ink Outlines + Interpenetrating Twin Z-Seam Detection
    const outlineCol = isDark && !cobaltFrame ? COL32.inkBlack : COL32.inkBlack;
    const silCol = isDark && !cobaltFrame ? COL32.inkWhite : COL32.inkBlack;

    // 3a. Pixel-exact silhouette & interpenetrating solid seam pass
    const bx0 = Math.max(1, Math.floor(minScreenX) - 1);
    const bx1 = Math.min(this.width - 2, Math.ceil(maxScreenX) + 1);
    const by0 = Math.max(1, Math.floor(minScreenY) - 1);
    const by1 = Math.min(this.height - 2, Math.ceil(maxScreenY) + 1);

    const seamPixels = [];
    for (let py = by0; py <= by1; py++) {
      const rowOff = py * this.width;
      for (let px = bx0; px <= bx1; px++) {
        const idx = rowOff + px;
        const f0 = this.faceIdBuf[idx];
        const fR = this.faceIdBuf[idx + 1];
        const fD = this.faceIdBuf[idx + this.width];

        // Silhouette boundary
        if ((f0 === -1) !== (fR === -1) || (f0 === -1) !== (fD === -1)) {
          seamPixels.push([px, py, silCol]);
          continue;
        }
        if (f0 >= 0) {
          const s0 = this.solidIdBuf[idx];
          // Interpenetrating / Contact Twin solid-to-solid intersection seam!
          if ((fR >= 0 && this.solidIdBuf[idx + 1] !== s0) || (fD >= 0 && this.solidIdBuf[idx + this.width] !== s0)) {
            seamPixels.push([px, py, isDark ? COL32.lime : COL32.inkBlack]);
          }
        }
      }
    }

    // 3b. Depth-tested polygon edges
    for (const edge of frontEdges) {
      if (!edge.isHighlight) {
        this.drawDepthLine(
          edge.a[0], edge.a[1], edge.a[2],
          edge.b[0], edge.b[1], edge.b[2],
          outlineCol,
          0.038,
          0
        );
      }
    }

    for (const [px, py, c] of seamPixels) {
      this.buf32[py * this.width + px] = c;
    }

    // Highlighted face edges on top in crisp Lime / Cyan
    for (const edge of frontEdges) {
      if (edge.isHighlight) {
        const hiCol = edge.faceId === secondFaceId ? COL32.cyan : COL32.lime;
        this.drawDepthLine(
          edge.a[0], edge.a[1], edge.a[2],
          edge.b[0], edge.b[1], edge.b[2],
          hiCol,
          0.06,
          0
        );
      }
    }

    // 4. Optional Symmetry / Crystallographic Axes (L4, L3, L2, OA)
    if (showAxes) {
      const rawAxes = (Array.isArray(mesh.symmetryAxes) && mesh.symmetryAxes.length > 0)
        ? mesh.symmetryAxes
        : (Array.isArray(mesh.axes) && mesh.axes.length > 0
            ? mesh.axes
            : [
                { dir: [0, 0, 1], label: 'L4', colorHex: '#C6FF00' },
                { dir: norm3([1, 1, 1]), label: 'L3', colorHex: '#00E5FF' },
                { dir: norm3([1, 1, 0]), label: 'L2', colorHex: '#FFB830' },
              ]);

      for (const ax of rawAxes) {
        const d = norm3(crystToStage(ax.dir || ax.vector || [0, 0, 1]));
        const col = ax.colorHex
          ? packHex(ax.colorHex)
          : ax.color === 'cyan'
            ? COL32.cyan
            : ax.color === 'amber'
              ? COL32.amber
              : ax.color === 'pink'
                ? COL32.pink
                : COL32.lime;
        const span = maxR * 1.38;
        const pA = project3D(rotateXYZ([-d[0] * span, -d[1] * span, -d[2] * span], rotX, rotY, rotZ));
        const pB = project3D(rotateXYZ([d[0] * span, d[1] * span, d[2] * span], rotX, rotY, rotZ));
        this.drawLine(pA[0], pA[1], pB[0], pB[1], col, 4, 1);
        this.drawSparkle(pB[0], pB[1], 2, col);
        if (ax.label) {
          const wAx = this.measureText(ax.label, 1, 1) + 10;
          const axTagX = Math.max(8, Math.min(this.width - wAx - 8, pB[0] + 6));
          const axTagY = Math.max(30, Math.min(this.height - 24, pB[1] - 6));
          this.drawTag(ax.label, axTagX, axTagY, COL32.inkBlack, col, null, false);
        }
      }
    }

    // 5. Optional Twin Plane & Re-entrant Angle Callout (True 3D Projected!)
    if (showTwinCallout && (mesh.twinInfo || solids.length > 1)) {
      const ti = mesh.twinInfo || {};
      const planeLabel = ti.planeLabelEn || 'TWIN LAW';
      const twinLabel = String(ti.reentrantTagEn || 'RE-ENTRANT TWIN').replace(/^C\^C\b/, 'c^c');

      const origStage = crystToStage(ti.planeOrigin3D || [0, 0, 0]);
      const dirStage = norm3(crystToStage(ti.traceDir3D || [1, 0, 0]));
      const traceSpan = maxR * 1.18;
      const trA = project3D(
        rotateXYZ(
          [
            origStage[0] - dirStage[0] * traceSpan,
            origStage[1] - dirStage[1] * traceSpan,
            origStage[2] - dirStage[2] * traceSpan,
          ],
          rotX,
          rotY,
          rotZ
        )
      );
      const trB = project3D(
        rotateXYZ(
          [
            origStage[0] + dirStage[0] * traceSpan,
            origStage[1] + dirStage[1] * traceSpan,
            origStage[2] + dirStage[2] * traceSpan,
          ],
          rotX,
          rotY,
          rotZ
        )
      );
      this.drawLine(trA[0], trA[1], trB[0], trB[1], COL32.limeDark, 4, 1);

      const notchStage = crystToStage(ti.notchAnchor3D || [0, 0, 0.55 * maxR]);
      const n2d = project3D(rotateXYZ(notchStage, rotX, rotY, rotZ));
      const nx = Math.max(20, Math.min(this.width - 20, n2d[0]));
      const ny = Math.max(24, Math.min(this.height - 24, n2d[1]));
      this.drawCircle(nx, ny, 11, COL32.pink, true);

      const wTwin = this.measureText(twinLabel, 1, 1) + 10;
      const wPlane = this.measureText(planeLabel, 1, 1) + 10;
      const goRight = nx >= centerX - 6;
      const goUp = ny <= cy + 12;
      const leadX = nx + (goRight ? 20 : -20);
      const leadY = ny + (goUp ? -20 : 18);
      let twinTagX = goRight ? leadX - 4 : leadX - wTwin + 4;
      let twinTagY = goUp ? leadY - 12 : leadY + 2;
      twinTagX = Math.max(8, Math.min(this.width - wTwin - 8, twinTagX));
      twinTagY = Math.max(24, Math.min(this.height - 22, twinTagY));
      this.drawLine(nx, ny, leadX, leadY, COL32.lime, 0, 1);

      // Anchor plane law tag near whichever trace endpoint is farther from the notch tag
      const dA = Math.hypot(trA[0] - twinTagX, trA[1] - twinTagY);
      const dB = Math.hypot(trB[0] - twinTagX, trB[1] - twinTagY);
      const farEnd = dA >= dB ? trA : trB;
      let planeTagX = farEnd[0] < centerX ? farEnd[0] - wPlane * 0.65 : farEnd[0] - wPlane * 0.35;
      let planeTagY = farEnd[1] < cy ? farEnd[1] - 14 : farEnd[1] + 6;
      planeTagX = Math.max(8, Math.min(this.width - wPlane - 8, planeTagX));
      planeTagY = Math.max(24, Math.min(this.height - 22, planeTagY));
      if (Math.abs(planeTagY - twinTagY) < 16 && planeTagX < twinTagX + wTwin + 6 && planeTagX + wPlane + 6 > twinTagX) {
        planeTagY = planeTagY > this.height * 0.5 ? Math.max(24, twinTagY - 18) : Math.min(this.height - 22, twinTagY + 18);
      }

      this.drawTag(planeLabel, planeTagX, planeTagY, COL32.inkBlack, COL32.lime, null, true);
      this.drawTag(twinLabel, twinTagX, twinTagY, COL32.inkBlack, COL32.lime, COL32.lime, true);
    }

    // 6. Selected Face & Two-Face Interfacial Angle Goniometer Overlay
    const f1 = selectedFaceId >= 0 ? this.faceMeta[selectedFaceId] : null;
    const f2 = secondFaceId >= 0 ? this.faceMeta[secondFaceId] : null;

    if (f1 && f2 && f1.faceId !== f2.faceId) {
      this.drawLine(f1.screenCx, f1.screenCy, f2.screenCx, f2.screenCy, COL32.cyan, 4, 1);
      this.drawSparkle(f1.screenCx, f1.screenCy, 2, COL32.lime);
      this.drawSparkle(f2.screenCx, f2.screenCy, 2, COL32.cyan);
      const cosA = Math.max(-1, Math.min(1, dot3(f1.normal, f2.normal)));
      const normalAngle = (Math.acos(cosA) * 180) / Math.PI;
      const midX = (f1.screenCx + f2.screenCx) * 0.5;
      const midY = (f1.screenCy + f2.screenCy) * 0.5;
      this.drawTag(
        `Δθ=${normalAngle.toFixed(1)}°`,
        midX - 24,
        midY - 16,
        COL32.inkBlack,
        COL32.cyan,
        COL32.cyan,
        true
      );
    } else if (f1) {
      this.drawTag(
        `${f1.miller}`,
        f1.screenCx + 8,
        f1.screenCy - 12,
        COL32.inkBlack,
        COL32.lime,
        COL32.lime,
        true
      );
    }
  }

  pickFaceAt(normX, normY) {
    const px = Math.max(0, Math.min(this.width - 1, Math.floor(normX * this.width)));
    const py = Math.max(0, Math.min(this.height - 1, Math.floor(normY * this.height)));
    const fId = this.faceIdBuf[py * this.width + px];
    if (fId < 0 || !this.faceMeta[fId]) return null;
    return this.faceMeta[fId];
  }

  // =========================================================================
  // BENCH A: PRISM DISPERSION & SNELL CRITICAL ANGLE + SPECTRAL LASER TARGETS
  // =========================================================================
  drawDispersionBench(opts = {}) {
    const {
      fanData = null,
      tirData = null,
      benchSubMode = 'prism',
      incidentDeg = 48,
      apexDeg = 60,
      materialLabel = 'FLINT PRISM',
      targets = [],
      timeSec = 0,
    } = opts;

    this.clearBackground({
      theme: 'dark',
      headerText: benchSubMode === 'tir'
        ? 'CLIMAX // TOTAL INTERNAL REFLECTION & CRITICAL ANGLE'
        : 'CLIMAX // DISPERSION & REFRACTION N(λ)',
      headerStyle: 'blue',
      footerLeft: 'PRISMA PIXEL OPTICS',
      footerMid: 'CH.06 // SNELL DISPERSION',
      footerRight: materialLabel,
    });

    const hits = [];

    if (benchSubMode === 'tir' && tirData) {
      // Draw horizontal crystal table slab in upper-center
      const slabX = 110;
      const slabY = 74;
      const slabW = 220;
      const slabH = 76;
      this.fillDitherRect(slabX, slabY, slabW, slabH, COL32.darkCard, COL32.blueDark);
      this.strokeRect(slabX, slabY, slabW, slabH, COL32.inkWhite);
      // Normal dashed line
      const hitX = 220;
      const hitY = slabY + slabH;
      this.drawLine(hitX, slabY - 18, hitX, hitY + 86, COL32.inkMuted, 4, 1);

      const radIn = (incidentDeg * Math.PI) / 180;
      const srcX = hitX - Math.sin(radIn) * 95;
      const srcY = hitY - Math.cos(radIn) * 72;
      this.drawLine(srcX, srcY, hitX, hitY, COL32.inkWhite, 0, 2);
      this.drawSparkle(hitX, hitY, 3, tirData.tir ? COL32.lime : COL32.cyan);

      let endX;
      let endY;
      if (tirData.tir) {
        // Total Internal Reflection back into crystal!
        endX = hitX + Math.sin(radIn) * 195;
        endY = hitY - Math.cos(radIn) * 135;
        this.drawLine(hitX, hitY, endX, endY, COL32.lime, 0, 2);
        this.drawTag(`TIR LOCKED! θ > θC (${tirData.criticalDeg.toFixed(1)}°)`, 24, 46, COL32.inkBlack, COL32.lime, COL32.lime);
      } else {
        const refrRad = ((tirData.refractedDeg || 0) * Math.PI) / 180;
        endX = hitX + Math.sin(refrRad) * 210;
        endY = hitY + Math.cos(refrRad) * 95;
        this.drawLine(hitX, hitY, endX, endY, COL32.cyan, 0, 2);
        this.drawTag(`REFRACTED θ2=${(tirData.refractedDeg || 0).toFixed(1)}° | θC=${(tirData.criticalDeg || 0).toFixed(1)}°`, 24, 46, COL32.inkBlack, COL32.cyan, COL32.cyan);
      }

      // Sensor targets on right rail
      for (const tgt of targets) {
        const ty = tgt.y;
        const tx = 432;
        // Intersect ray (hitX, hitY) -> (endX, endY) with x = tx
        let hit = false;
        if (endX > hitX + 4) {
          const t = (tx - hitX) / (endX - hitX);
          const rayAtX = hitY + (endY - hitY) * t;
          if (Math.abs(rayAtX - ty) <= 13) hit = true;
        }
        if (hit) hits.push(tgt.id);
        const col = hit ? COL32.lime : COL32.pink;
        this.fillRect(tx - 6, ty - 9, 12, 18, hit ? COL32.lime : COL32.darkCard);
        this.strokeRect(tx - 6, ty - 9, 12, 18, col);
        if (hit) this.drawSparkle(tx, ty, 4, COL32.lime);
      }

      return { hits };
    }

    // 60° Dispersive Prism Mode (pixel_06 homage!)
    const cx = 236;
    const cy = 136;
    const halfApex = ((apexDeg || 60) * 0.5 * Math.PI) / 180;
    const pH = 114;
    const halfBase = Math.tan(halfApex) * pH;
    const tilt = -0.11; // subtle dynamic tilt matching pixel_06!

    const rot2 = (x, y) => [
      cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    ];

    const vTop = rot2(0, -pH * 0.62);
    const vLeft = rot2(-halfBase, pH * 0.44);
    const vRight = rot2(halfBase, pH * 0.44);

    // Subtle Bayer-dithered glass prism interior
    this._rasterizeTriangleBary(
      [vTop[0], vTop[1], 0],
      [vLeft[0], vLeft[1], 0],
      [vRight[0], vRight[1], 0],
      [COL32.darkPanel, COL32.darkCard, COL32.blueDark, COL32.blueMid],
      0.32,
      0,
      0
    );

    // Entry & exit points on prism faces
    const entryPt = [
      vLeft[0] * 0.72 + vTop[0] * 0.28,
      vLeft[1] * 0.72 + vTop[1] * 0.28,
    ];
    const exitBasePt = [
      vRight[0] * 0.74 + vTop[0] * 0.26,
      vRight[1] * 0.74 + vTop[1] * 0.26,
    ];

    // Crisp White Incident Laser Beam from left wall
    const inSlope = ((incidentDeg - 48) * 0.014) - 0.23;
    const laserStartX = 4;
    const laserStartY = entryPt[1] - inSlope * (entryPt[0] - laserStartX);
    this.drawLine(laserStartX, laserStartY, entryPt[0], entryPt[1], COL32.inkWhite, 0, 3);

    // Internal prism rainbow fan + Outgoing dispersed spectral beams
    const rays = (fanData && Array.isArray(fanData.rays) && fanData.rays.length > 0)
      ? fanData.rays
      : [
          { nm: 650, n: 1.51, deviationDeg: 38 },
          { nm: 589, n: 1.53, deviationDeg: 41 },
          { nm: 532, n: 1.55, deviationDeg: 44 },
          { nm: 486, n: 1.58, deviationDeg: 47 },
          { nm: 455, n: 1.61, deviationDeg: 50 },
        ];

    const getDev = (r) => r?.exitDeg ?? r?.deviationDeg ?? 42;
    const minDev = getDev(rays[0]);
    const maxDev = getDev(rays[rays.length - 1]);
    const devSpan = Math.max(0.4, maxDev - minDev);

    rays.forEach((ray, idx) => {
      const col = wavelengthToCol32(ray.nm);
      const frac = rays.length > 1 ? idx / (rays.length - 1) : 0.5;
      const exX = exitBasePt[0] + frac * 5;
      const exY = exitBasePt[1] + frac * 14 - 4;

      // Internal glass ray
      this.drawLine(entryPt[0], entryPt[1], exX, exY, col, 0, 2);

      if (ray.tir) {
        // Internal reflection
        this.drawLine(exX, exY, vLeft[0] + 18, vRight[1] - 4, col, 3, 1);
      } else {
        const dev = getDev(ray);
        // Exaggerate visual fan angle slightly while preserving real physical order & sensitivity
        const baseAngle = 0.16 + ((dev - 34) * 0.012) + ((dev - minDev) / devSpan) * (0.18 + Math.min(0.30, devSpan * 0.04));
        const outX = 476;
        const outY = exY + Math.tan(baseAngle) * (outX - exX);
        this.drawLine(exX, exY, outX, outY, col, 0, 2);

        // Check spectral sensor targets at x = 350..366
        for (const tgt of targets) {
          const tx = tgt.x || 350;
          const yAtTarget = exY + Math.tan(baseAngle) * (tx - exX);
          if (Math.abs(yAtTarget - tgt.y) <= 10) {
            if (!hits.includes(tgt.id)) hits.push(tgt.id);
          }
        }
      }
    });

    // Crisp 2px Prism White/Pink Riso Edges on top
    this.drawLine(vTop[0], vTop[1], vLeft[0], vLeft[1], COL32.inkWhite, 0, 2);
    this.drawLine(vLeft[0], vLeft[1], vRight[0], vRight[1], COL32.inkWhite, 0, 2);
    this.drawLine(vRight[0], vRight[1], vTop[0], vTop[1], COL32.inkWhite, 0, 2);
    this.drawSparkle(entryPt[0], entryPt[1], 3, COL32.inkWhite);

    // Right-side wavelength N(λ) callout tags (exact homage to pixel_06_prism_dispersion.png!)
    const tagRays = [
      rays[0],
      rays.find((r) => r.nm === 589) || rays[1],
      rays.find((r) => r.nm === 532) || rays[Math.min(2, rays.length - 1)],
      rays[rays.length - 1],
    ].filter(Boolean);

    tagRays.forEach((r, idx) => {
      const col = wavelengthToCol32(r.nm);
      const ty = 52 + idx * 24;
      this.drawTag(
        `${r.nm}NM N=${Number(r.n).toFixed(3)}`,
        366,
        ty,
        COL32.darkBg,
        col,
        col,
        false
      );
    });

    // Interactive Spectral Sensor Targets
    for (const tgt of targets) {
      const tx = tgt.x || 350;
      const ty = tgt.y;
      const isHit = hits.includes(tgt.id);
      const pulse = ((Math.floor(timeSec * 6) & 1) === 0);
      this.fillRect(tx - 5, ty - 6, 10, 12, isHit ? COL32.lime : COL32.darkCard);
      this.strokeRect(tx - 5, ty - 6, 10, 12, isHit ? COL32.inkWhite : COL32.pink);
      if (isHit && pulse) {
        this.drawSparkle(tx, ty, 4, COL32.lime);
      }
    }

    return { hits };
  }

  // =========================================================================
  // BENCH B: CALCITE DOUBLE REFRACTION & POYNTING WALKOFF
  // =========================================================================
  drawCalciteBench(opts = {}) {
    const {
      splitData = null,
      rotDeg = 35,
      thicknessMm = 8,
      analyzerOn = false,
      analyzerDeg = 0,
      materialLabel = 'CALCITE RHOMB',
      theme = 'riso',
    } = opts;

    const isDark = theme === 'dark';
    this.clearBackground({
      theme,
      accent: 'cobalt',
      headerText: 'BIREFRINGENCE // O-RAY & E-RAY POYNTING WALKOFF',
      headerStyle: isDark ? 'blue' : 'lime',
      footerLeft: 'PRISMA PIXEL OPTICS',
      footerMid: 'CH.05 // CALCITE WALKOFF',
      footerRight: materialLabel,
    });

    const cx = 196;
    const cy = 140;

    // 1. Background Calibration Paper Grid & Target behind slab
    const cardW = 220;
    const cardH = 154;
    const cardX = cx - cardW / 2;
    const cardY = cy - cardH / 2;
    this.fillRect(cardX, cardY, cardW, cardH, isDark ? COL32.darkPanel : COL32.paperCard);
    this.strokeRect(cardX, cardY, cardW, cardH, isDark ? COL32.inkMuted : COL32.inkBlack);

    for (let gx = cardX + 20; gx < cardX + cardW; gx += 20) {
      this.drawLine(gx, cardY + 1, gx, cardY + cardH - 2, isDark ? COL32.darkCard : COL32.paperWarm);
    }
    for (let gy = cardY + 20; gy < cardY + cardH; gy += 20) {
      this.drawLine(cardX + 1, gy, cardX + cardW - 2, gy, isDark ? COL32.darkCard : COL32.paperWarm);
    }

    // Calculate pixel walkoff separation
    const sepMm = splitData ? (splitData.separationMm || 0) : 0.65;
    const isIso = splitData ? Boolean(splitData.isIsotropic) : false;
    const shiftPx = isIso ? 0 : Math.min(28, Math.max(2, Math.round(sepMm * 18)));
    const rad = (rotDeg * Math.PI) / 180;
    const dx = Math.round(Math.cos(rad) * shiftPx);
    const dy = Math.round(Math.sin(rad) * shiftPx);

    // Polarizer analyzer attenuation (Malus's Law cos^2 / sin^2)
    let showO = true;
    let showE = !isIso;
    if (analyzerOn && !isIso) {
      const rel = ((analyzerDeg - rotDeg) * Math.PI) / 180;
      const eWeight = splitData?.eIntensity != null ? splitData.eIntensity : Math.cos(rel) ** 2;
      const oWeight = splitData?.oIntensity != null ? splitData.oIntensity : Math.sin(rel) ** 2;
      if (oWeight < 0.12) showO = false;
      if (eWeight < 0.12) showE = false;
    }

    // 2. Rotated Transparent Dithered Rhomb Crystal Slab
    const rw = 68;
    const rh = 52;
    const skew = 16;
    const corners = [
      [-rw + skew, -rh],
      [rw + skew, -rh],
      [rw - skew, rh],
      [-rw - skew, rh],
    ].map(([x, y]) => [
      cx + x * Math.cos(rad) - y * Math.sin(rad),
      cy + x * Math.sin(rad) + y * Math.cos(rad),
      0,
    ]);

    // Subtle dithered rhomb interior
    this._rasterizeTriangleBary(
      corners[0], corners[1], corners[2],
      [COL32.cyanDark, COL32.blueLight, COL32.cyanLight, COL32.inkWhite],
      isDark ? 0.25 : 0.78,
      0, 0
    );
    this._rasterizeTriangleBary(
      corners[0], corners[2], corners[3],
      [COL32.cyanDark, COL32.blueLight, COL32.cyanLight, COL32.inkWhite],
      isDark ? 0.25 : 0.78,
      0, 0
    );

    // 3. O-RAY (Stationary Pink) & E-RAY (Orbiting Cyan) Double Target Images!
    const drawTargetMark = (tx, ty, col) => {
      this.drawLine(tx - 26, ty, tx + 26, ty, col, 0, 2);
      this.drawLine(tx, ty - 26, tx, ty + 26, col, 0, 2);
      this.drawCircle(tx, ty, 12, col, false);
      this.drawText('SUVA', tx - 11, ty - 22, col, 1, 1);
    };

    if (showO) {
      drawTargetMark(cx, cy, isIso ? (isDark ? COL32.lime : COL32.inkBlack) : COL32.pink);
    }
    if (showE) {
      drawTargetMark(cx + dx, cy + dy, COL32.cyan);
      // Walkoff displacement vector arrow
      this.drawLine(cx, cy, cx + dx, cy + dy, COL32.lime, 2, 1);
    }

    // Crisp Rhomb Slab Ink Borders + 3D side thickness lines
    const depthOff = Math.max(3, Math.round(thicknessMm * 0.7));
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      this.drawLine(a[0] + depthOff, a[1] + depthOff, b[0] + depthOff, b[1] + depthOff, COL32.blue, 2, 1);
      this.drawLine(a[0], a[1], a[0] + depthOff, a[1] + depthOff, COL32.blue, 0, 1);
      this.drawLine(a[0], a[1], b[0], b[1], isDark ? COL32.inkWhite : COL32.inkBlack, 0, 1);
    }

    // Right-side Telemetry & Polarization Vector Diagram
    const rx = 330;
    this.fillRect(rx, 54, 132, 162, isDark ? COL32.darkPanel : COL32.inkBlack);
    this.strokeRect(rx, 54, 132, 162, COL32.lime);
    this.drawText('RAY TELEMETRY', rx + 10, 64, COL32.lime, 1, 1);
    this.drawText(`SLAB D=${thicknessMm.toFixed(1)}MM`, rx + 10, 80, COL32.inkWhite, 1, 1);
    this.drawText(`WALKOFF=${sepMm.toFixed(2)}MM`, rx + 10, 94, COL32.cyan, 1, 1);
    this.drawText(`ROT θ=${Math.round(rotDeg)}°`, rx + 10, 108, COL32.amber, 1, 1);

    this.drawText('O-RAY: STATIONARY', rx + 10, 128, showO ? COL32.pink : COL32.inkMuted, 1, 1);
    this.drawText(isIso ? 'E-RAY: NONE (ISO)' : 'E-RAY: ORBITS O!', rx + 10, 142, showE ? COL32.cyan : COL32.inkMuted, 1, 1);

    // Orthogonal E-field vibration cross
    const pvx = rx + 66;
    const pvy = 184;
    this.drawCircle(pvx, pvy, 18, COL32.inkMuted, true);
    if (showE) {
      this.drawLine(pvx - Math.cos(rad) * 16, pvy - Math.sin(rad) * 16, pvx + Math.cos(rad) * 16, pvy + Math.sin(rad) * 16, COL32.cyan, 0, 2);
    }
    if (showO) {
      this.drawLine(pvx + Math.sin(rad) * 16, pvy - Math.cos(rad) * 16, pvx - Math.sin(rad) * 16, pvy + Math.cos(rad) * 16, COL32.pink, 0, 2);
    }
    if (analyzerOn) {
      const ar = (analyzerDeg * Math.PI) / 180;
      this.drawLine(pvx - Math.cos(ar) * 22, pvy - Math.sin(ar) * 22, pvx + Math.cos(ar) * 22, pvy + Math.sin(ar) * 22, COL32.lime, 3, 1);
    }
  }

  // =========================================================================
  // BENCH C: CROSSED-POLARIZER EXTINCTION & MICHEL-LEVY CHART (pixel_07 homage!)
  // =========================================================================
  drawMichelLevyBench(opts = {}) {
    const {
      retData = null,
      stripRgb = null,
      stageDeg = 45,
      thicknessMm = 0.03,
      gypsumOn = false,
      materialLabel = 'QUARTZ WEDGE',
      theme = 'riso',
    } = opts;

    const isDark = theme === 'dark';
    this.clearBackground({
      theme,
      accent: 'coral',
      headerText: 'ORTHOSCOPIC +P // EXTINCTION & MICHEL-LEVY CHART',
      headerStyle: 'dark',
      footerLeft: 'PRISMA PIXEL OPTICS',
      footerMid: 'CH.06 // EXTINCTION & MICHEL-LEVY',
      footerRight: materialLabel,
    });

    // 1. Left Circular Polarizing Microscope Stage (cx=116, cy=136, r=70)
    const mcx = 116;
    const mcy = 136;
    const mr = 68;

    // Outer double ink ring + dark crossed-polarizer field
    for (let py = mcy - mr - 4; py <= mcy + mr + 4; py++) {
      for (let px = mcx - mr - 4; px <= mcx + mr + 4; px++) {
        const d = Math.hypot(px - mcx, py - mcy);
        if (d <= mr + 4 && d >= mr + 2) {
          this.putPixel(px, py, isDark ? COL32.inkWhite : COL32.inkBlack);
        } else if (d < mr + 2 && d >= mr) {
          this.putPixel(px, py, COL32.paperCard);
        } else if (d < mr) {
          // Field background: black normally, or 1st-order magenta (530nm) when Gypsum plate is inserted!
          const bgCol = gypsumOn ? rgbToPacked32(182, 34, 136, 255) : COL32.darkBg;
          this.putPixel(px, py, bgCol);
        }
      }
    }

    // P ⊥ A Crosshairs
    this.drawLine(mcx - mr + 3, mcy, mcx + mr - 3, mcy, COL32.inkMuted, 4, 1);
    this.drawLine(mcx, mcy - mr + 3, mcx, mcy + mr - 3, COL32.inkMuted, 4, 1);
    this.drawText('A', mcx - 2, mcy - mr + 6, COL32.lime, 1, 1);
    this.drawText('P', mcx + mr - 10, mcy - 8, COL32.cyan, 1, 1);

    // Rotatable Prismatic Crystal Grain inside Viewport
    const rad = ((stageDeg - 30) * Math.PI) / 180;
    const baseRgb = retData?.rgb || [240, 120, 40];
    const intensity = retData?.transmission ?? (Math.sin((2 * stageDeg * Math.PI) / 180) ** 2);
    const gammaNm = gypsumOn
      ? (retData?.effectiveRetardationNm ?? retData?.retardationNm ?? 530)
      : (retData?.retardationNm ?? 550);
    const isIso = Boolean(retData?.isIsotropic) || (retData != null && retData.deltaN === 0);

    // Render crystal hexagon elongated grain with subtle wedge zoning across width (just like pixel_07!)
    const cLen = 46;
    const cWid = 19;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    for (let py = mcy - 54; py <= mcy + 54; py++) {
      for (let px = mcx - 54; px <= mcx + 54; px++) {
        const dx = px - mcx;
        const dy = py - mcy;
        const u = dx * cosR + dy * sinR;     // along crystal c-axis
        const v = -dx * sinR + dy * cosR;    // across crystal width
        if (Math.abs(v) <= cWid && Math.abs(u) + Math.abs(v) * 0.85 <= cLen) {
          // Outline check
          const edgeDist = Math.min(cWid - Math.abs(v), cLen - (Math.abs(u) + Math.abs(v) * 0.85));
          if (edgeDist < 1.3) {
            this.putPixel(px, py, COL32.inkWhite);
          } else if (isIso && !gypsumOn) {
            // Isotropic stays extinct!
            this.putPixel(px, py, ((px + py) & 3) === 0 ? COL32.darkCard : COL32.darkBg);
          } else {
            // Interference color modulated by wedge thickness profile + Bayer dither
            const bevel = Math.max(0.35, 1 - Math.abs(v) / (cWid * 1.35));
            const bayer = (BAYER_4X4[py & 3][px & 3] - 7.5) * 3.2;
            const r = Math.max(0, Math.min(255, Math.round(baseRgb[0] * bevel + bayer)));
            const g = Math.max(0, Math.min(255, Math.round(baseRgb[1] * bevel + bayer)));
            const b = Math.max(0, Math.min(255, Math.round(baseRgb[2] * bevel + bayer)));
            this.putPixel(px, py, rgbToPacked32(r, g, b, 255));
          }
        }
      }
    }

    if (gypsumOn) {
      // +530nm slow-axis arrow (NE-SW)
      this.drawLine(mcx - 42, mcy + 42, mcx + 42, mcy - 42, COL32.lime, 3, 1);
    }

    const pct = Math.round((isIso ? 0 : intensity) * 100);
    this.drawTag(
      `STAGE θ=${Math.round(stageDeg)}° | I=${pct}%`,
      mcx - 56,
      mcy + mr + 10,
      COL32.blue,
      COL32.inkWhite,
      COL32.inkBlack,
      true
    );

    // 2. Right Pixelated Michel-Lévy Interference Color Chart (0..1650 NM)
    const chartX = 222;
    const chartY = 88;
    const chartW = 228;
    const chartH = 92;
    const maxNm = 1650;

    this.drawTag(
      'MICHEL-LEVY INTERFERENCE CHART',
      chartX + 18,
      chartY - 24,
      isDark ? COL32.darkPanel : COL32.paperCard,
      isDark ? COL32.lime : COL32.inkBlack,
      isDark ? COL32.lime : COL32.inkBlack,
      false
    );

    this.fillRect(chartX - 2, chartY - 2, chartW + 4, chartH + 4, COL32.inkBlack);

    if (stripRgb && stripRgb.length >= 3) {
      const samples = Math.floor(stripRgb.length / 3);
      for (let cx = 0; cx < chartW; cx++) {
        const sIdx = Math.min(samples - 1, Math.floor((cx / chartW) * samples)) * 3;
        const r0 = stripRgb[sIdx];
        const g0 = stripRgb[sIdx + 1];
        const b0 = stripRgb[sIdx + 2];
        for (let cy = 0; cy < chartH; cy++) {
          const dither = (BAYER_4X4[cy & 3][cx & 3] - 7.5) * 2.2;
          const r = Math.max(0, Math.min(255, Math.round(r0 + dither)));
          const g = Math.max(0, Math.min(255, Math.round(g0 + dither)));
          const b = Math.max(0, Math.min(255, Math.round(b0 + dither)));
          this.putPixel(chartX + cx, chartY + cy, rgbToPacked32(r, g, b, 255));
        }
      }
    }

    // Order dividers at 550nm (Order I), 1100nm (Order II), 1650nm (Order III)
    const xI = chartX + Math.round((550 / maxNm) * chartW);
    const xII = chartX + Math.round((1100 / maxNm) * chartW);
    this.drawLine(xI, chartY, xI, chartY + chartH + 4, COL32.inkBlack, 0, 2);
    this.drawLine(xII, chartY, xII, chartY + chartH + 4, COL32.inkBlack, 0, 2);

    const lblCol = isDark ? COL32.inkWhite : COL32.inkBlack;
    this.drawText('0 NM', chartX, chartY + chartH + 8, lblCol, 1, 1);
    this.drawText('I:550', xI - 14, chartY + chartH + 8, COL32.pinkMid, 1, 1);
    this.drawText('II:1100', xII - 18, chartY + chartH + 8, COL32.blue, 1, 1);
    this.drawText('III:1650', chartX + chartW - 44, chartY + chartH + 8, COL32.cyanDark, 1, 1);

    // Live Sliding Retardation Cursor
    const clampedNm = Math.max(0, Math.min(maxNm, gammaNm));
    const curX = chartX + Math.round((clampedNm / maxNm) * (chartW - 1));
    this.fillRect(curX - 2, chartY - 6, 5, 4, COL32.inkBlack);
    this.fillRect(curX - 1, chartY, 3, chartH, COL32.inkWhite);
    this.drawLine(curX - 2, chartY, curX - 2, chartY + chartH, COL32.inkBlack);
    this.drawLine(curX + 2, chartY, curX + 2, chartY + chartH, COL32.inkBlack);
    this.fillRect(curX - 2, chartY + chartH + 3, 5, 4, COL32.inkBlack);

    const orderNum = Math.min(4, Math.floor(gammaNm / 550) + 1);
    this.drawTag(
      isIso ? 'ISOTROPIC Γ = 0 NM (ALL DARK)' : `Γ = ${Math.round(gammaNm)} NM  (ORDER ${orderNum})`,
      chartX + 28,
      chartY + chartH + 22,
      COL32.inkBlack,
      COL32.lime,
      COL32.lime,
      true
    );
  }

  // =========================================================================
  // BENCH D: 3D OPTICAL INDICATRIX & 56x56 JONES CONOSCOPE (pixel_05 homage!)
  // =========================================================================
  drawConoscopeBench(opts = {}) {
    const {
      axisInfo = null,
      conoBuffer = null,
      rotX = 0.35,
      rotY = 0.55,
      stageDeg = 0,
      gypsumOn = false,
      materialLabel = 'QUARTZ (+)',
      theme = 'riso',
    } = opts;

    const isDark = theme === 'dark';
    this.clearBackground({
      theme,
      accent: 'cobalt',
      headerText: 'INDICATRIX & CONOSCOPE // BERTRAND INTERFERENCE FIGURE',
      headerStyle: 'dark',
      footerLeft: 'PRISMA PIXEL OPTICS',
      footerMid: 'CH.05 // INDICATRIX & CONOSCOPE',
      footerRight: materialLabel,
    });

    // 1. Left Card: 3D Bayer-Dithered Optical Indicatrix Ellipsoid (pixel_05 homage!)
    const cardX = 22;
    const cardY = 40;
    const cardW = 196;
    const cardH = 198;
    this.fillRect(cardX, cardY, cardW, cardH, COL32.darkPanel);
    this.strokeRect(cardX, cardY, cardW, cardH, COL32.inkBlack);

    const cls = axisInfo?.className || 'uniaxial';
    const sign = axisInfo?.sign || 'positive';
    const twoV = axisInfo?.twoVDeg || 0;

    // Exaggerate semi-axes cleanly for pedagogical clarity while matching true optical class & sign!
    let rx = 1.0;
    let ry = 1.0;
    let rz = 1.0;
    let rampKey = 'gold';
    let classBadge = 'ISOTROPIC SPHERE';
    let bottomTag = 'N = CONST · ALL EXTINCT';

    if (cls === 'uniaxial') {
      rampKey = 'octa';
      if (sign === 'positive') {
        rx = 0.78;
        rz = 0.78;
        ry = 1.26; // prolate Ne > No
        classBadge = 'UNIAXIAL (+)';
        bottomTag = '1 OA · NE > NO (PROLATE)';
      } else {
        rx = 1.22;
        rz = 1.22;
        ry = 0.76; // oblate Ne < No
        classBadge = 'UNIAXIAL (-)';
        bottomTag = '1 OA · NE < NO (OBLATE)';
      }
    } else if (cls === 'biaxial') {
      rampKey = 'cube';
      const halfVInit = (Math.max(18, Math.min(89, twoV || 52)) * 0.5 * Math.PI) / 180;
      if (sign === 'negative') {
        // Biaxial (-): Bxa = X (n_alpha, vertical), Bxo = Z (n_gamma, horizontal)
        rx = 1.26;
        ry = 0.76;
        bottomTag = '2 OA · BXA = NP (X)';
      } else {
        // Biaxial (+): Bxa = Z (n_gamma, vertical), Bxo = X (n_alpha, horizontal)
        rx = 0.76;
        ry = 1.26;
        bottomTag = '2 OA · BXA = NG (Z)';
      }
      rz = 1 / Math.sqrt((Math.cos(halfVInit) ** 2) / (rx ** 2) + (Math.sin(halfVInit) ** 2) / (ry ** 2));
      classBadge = `BIAXIAL (${sign === 'positive' ? '+' : '-'}) 2V=${Math.round(twoV)}°`;
    }

    this.drawTag(classBadge, cardX + 12, cardY + 8, COL32.paperCard, COL32.inkBlack, null, false);

    // Build procedural UV ellipsoid mesh (12 lat x 18 lon) for Bayer-dithered rasterizer
    const eCx = cardX + Math.round(cardW * 0.5);
    const eCy = cardY + 106;
    const eScale = 44;
    this._drawFloorCheckerShadow(eCx, cardY + 166, 40, 7, true, true);

    const latSteps = 12;
    const lonSteps = 18;
    const grid = [];
    for (let i = 0; i <= latSteps; i++) {
      const phi = (i / latSteps) * Math.PI;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      const row = [];
      for (let j = 0; j <= lonSteps; j++) {
        const th = (j / lonSteps) * Math.PI * 2;
        const p3 = [
          rx * sinP * Math.cos(th),
          ry * cosP,
          rz * sinP * Math.sin(th),
        ];
        const n3 = norm3([
          (sinP * Math.cos(th)) / rx,
          cosP / ry,
          (sinP * Math.sin(th)) / rz,
        ]);
        const rPos = rotateXYZ(p3, rotX, rotY, 0);
        const rNorm = rotateXYZ(n3, rotX, rotY, 0);
        row.push({
          pos: [eCx + rPos[0] * eScale, eCy - rPos[1] * eScale, rPos[2]],
          norm: rNorm,
        });
      }
      grid.push(row);
    }

    const rampStops = PACKED_RAMPS[rampKey] || PACKED_RAMPS.octa;
    for (let i = 0; i < latSteps; i++) {
      for (let j = 0; j < lonSteps; j++) {
        const a = grid[i][j];
        const b = grid[i + 1][j];
        const c = grid[i + 1][j + 1];
        const d = grid[i][j + 1];
        const nAvg = norm3([
          a.norm[0] + b.norm[0] + c.norm[0] + d.norm[0],
          a.norm[1] + b.norm[1] + c.norm[1] + d.norm[1],
          a.norm[2] + b.norm[2] + c.norm[2] + d.norm[2],
        ]);
        if (nAvg[2] < -0.05) continue;
        const shade = 0.08 + Math.max(0, dot3(nAvg, KEY_LIGHT)) * 0.78 + Math.pow(Math.max(0, nAvg[2]), 5) * 0.16;
        this._rasterizeTriangleBary(a.pos, b.pos, c.pos, rampStops, shade, 1, 0);
        this._rasterizeTriangleBary(a.pos, c.pos, d.pos, rampStops, shade, 1, 0);
      }
    }

    // Draw circular section(s) + Optic Axes (OA / OA1 & OA2)
    if (cls !== 'biaxial') {
      let prevRing = null;
      for (let j = 0; j <= 32; j++) {
        const th = (j / 32) * Math.PI * 2;
        const rp = rotateXYZ([rx * 1.03 * Math.cos(th), 0, rz * 1.03 * Math.sin(th)], rotX, rotY, 0);
        const sx = eCx + rp[0] * eScale;
        const sy = eCy - rp[1] * eScale;
        if (prevRing && rp[2] >= -0.1) {
          this.drawLine(prevRing[0], prevRing[1], sx, sy, cls === 'isotropic' ? COL32.lime : COL32.pink, 0, 1);
        }
        prevRing = [sx, sy];
      }
    }

    if (cls === 'uniaxial') {
      const pTop = rotateXYZ([0, ry * 1.25, 0], rotX, rotY, 0);
      const pBot = rotateXYZ([0, -ry * 1.25, 0], rotX, rotY, 0);
      this.drawLine(eCx + pBot[0] * eScale, eCy - pBot[1] * eScale, eCx + pTop[0] * eScale, eCy - pTop[1] * eScale, COL32.lime, 4, 1);
      this.drawSparkle(eCx + pTop[0] * eScale, eCy - pTop[1] * eScale, 2, COL32.lime);
      this.drawTag('OA', eCx + pTop[0] * eScale + 5, eCy - pTop[1] * eScale - 6, COL32.inkBlack, COL32.lime, null, false);
    } else if (cls === 'biaxial') {
      const halfV = (Math.max(18, Math.min(89, twoV || 52)) * 0.5 * Math.PI) / 180;
      // Two true circular sections of radius rz perpendicular to OA1 and OA2
      for (const sgn of [1, -1]) {
        const e1 = [Math.cos(halfV), -sgn * Math.sin(halfV), 0];
        const ringCol = sgn > 0 ? COL32.pink : COL32.cyan;
        let prevCirc = null;
        for (let j = 0; j <= 32; j++) {
          const th = (j / 32) * Math.PI * 2;
          const rad = rz * 1.03;
          const p3 = [
            rad * Math.cos(th) * e1[0],
            rad * Math.cos(th) * e1[1],
            rad * Math.sin(th),
          ];
          const rp = rotateXYZ(p3, rotX, rotY, 0);
          const sx = eCx + rp[0] * eScale;
          const sy = eCy - rp[1] * eScale;
          if (prevCirc && rp[2] >= -0.12) {
            this.drawLine(prevCirc[0], prevCirc[1], sx, sy, ringCol, 0, 1);
          }
          prevCirc = [sx, sy];
        }
      }
      const axesBiax = [
        { v: [Math.sin(halfV) * 1.25, Math.cos(halfV) * 1.25, 0], lbl: 'OA1', col: COL32.lime },
        { v: [-Math.sin(halfV) * 1.25, Math.cos(halfV) * 1.25, 0], lbl: 'OA2', col: COL32.cyan },
      ];
      for (const oa of axesBiax) {
        const pTop = rotateXYZ(oa.v, rotX, rotY, 0);
        const pBot = rotateXYZ([-oa.v[0], -oa.v[1], 0], rotX, rotY, 0);
        this.drawLine(eCx + pBot[0] * eScale, eCy - pBot[1] * eScale, eCx + pTop[0] * eScale, eCy - pTop[1] * eScale, oa.col, 4, 1);
        this.drawSparkle(eCx + pTop[0] * eScale, eCy - pTop[1] * eScale, 2, oa.col);
        this.drawTag(oa.lbl, eCx + pTop[0] * eScale + 4, eCy - pTop[1] * eScale - 8, COL32.inkBlack, oa.col, null, false);
      }
    }

    this.drawTag(bottomTag, cardX + 10, cardY + cardH - 20, COL32.inkBlack, COL32.inkWhite, null, false);

    // 2. Right Card: 56x56 Upscaled Jones-Matrix Conoscope Interference Figure
    const ccx = 348;
    const ccy = 128;
    const bufSize = conoBuffer?.size || 56;
    const scalePx = 3; // 56 * 3 = 168x168 crisp pixel circle!
    const halfSpan = Math.floor((bufSize * scalePx) / 2);
    const radiusPx = halfSpan - 2;

    // Outer eyepiece ring
    for (let py = ccy - radiusPx - 5; py <= ccy + radiusPx + 5; py++) {
      for (let px = ccx - radiusPx - 5; px <= ccx + radiusPx + 5; px++) {
        const d = Math.hypot(px - ccx, py - ccy);
        if (d <= radiusPx + 5 && d >= radiusPx + 2) {
          this.putPixel(px, py, COL32.inkBlack);
        } else if (d < radiusPx + 2 && d >= radiusPx) {
          this.putPixel(px, py, COL32.lime);
        }
      }
    }

    if (conoBuffer && conoBuffer.rgba) {
      const rgba = conoBuffer.rgba;
      for (let by = 0; by < bufSize; by++) {
        for (let bx = 0; bx < bufSize; bx++) {
          const idx4 = (by * bufSize + bx) * 4;
          const r = rgba[idx4];
          const g = rgba[idx4 + 1];
          const b = rgba[idx4 + 2];
          const col = rgbToPacked32(r, g, b, 255);

          const startX = ccx - halfSpan + bx * scalePx;
          const startY = ccy - halfSpan + by * scalePx;
          for (let oy = 0; oy < scalePx; oy++) {
            for (let ox = 0; ox < scalePx; ox++) {
              const px = startX + ox;
              const py = startY + oy;
              if (Math.hypot(px - ccx, py - ccy) < radiusPx) {
                this.putPixel(px, py, col);
              }
            }
          }
        }
      }
    } else {
      this.fillRect(ccx - 40, ccy - 40, 80, 80, COL32.darkBg);
    }

    // Polarizer Crosshairs + Gypsum 530nm Fast/Slow Quadrant Markers
    this.drawLine(ccx - radiusPx + 2, ccy, ccx + radiusPx - 2, ccy, COL32.inkMuted, 6, 1);
    this.drawLine(ccx, ccy - radiusPx + 2, ccx, ccy + radiusPx - 2, COL32.inkMuted, 6, 1);

    if (gypsumOn) {
      this.drawLine(ccx - 54, ccy + 54, ccx + 54, ccy - 54, COL32.lime, 4, 1);
      this.drawTag('+530NM GYPSUM ON', ccx - 54, ccy - radiusPx - 16, COL32.pink, COL32.inkWhite, COL32.inkBlack, false);
    } else {
      this.drawTag(`BERTRAND θ=${Math.round(stageDeg)}°`, ccx - 50, ccy - radiusPx - 16, COL32.inkBlack, COL32.cyan, null, false);
    }

    const signLabel = cls === 'isotropic'
      ? 'DARK FIELD (ISOTROPIC)'
      : `OPTIC SIGN: ${cls.toUpperCase()} (${sign === 'positive' ? '+' : '-'})`;
    this.drawTag(signLabel, ccx - 68, ccy + radiusPx + 8, COL32.inkBlack, COL32.lime, COL32.lime, true);
  }

  // =========================================================================
  // DETECTIVE STATION ②: GEMOLOGICAL REFRACTOMETER EYEPIECE (1.30 - 1.81)
  // =========================================================================
  drawRefractometerStation(mesh, opts = {}) {
    const {
      refData = null,
      polarizerDeg = 0,
      rotX = 0.35,
      rotY = 0.5,
      timeSec = 0,
      theme = 'riso',
    } = opts;

    this.clearBackground({
      theme,
      accent: 'cobalt',
      headerText: 'STATION 02 // HEMICYLINDER GEM REFRACTOMETER (589.3 NM)',
      headerStyle: 'dark',
      footerLeft: 'SUVA · GEM DETECTIVE',
      footerMid: 'CONTACT LIQUID N = 1.790',
      footerRight: 'SODIUM D-LINE',
    });

    // Left: Mystery Crystal on Refractometer Stage
    this.drawCrystalScene(mesh, {
      theme,
      rotX,
      rotY,
      zoom: 0.78,
      centerX: 112,
      centerY: 136,
      timeSec,
    });

    // Right: Monochromatic Sodium-Green/Amber Refractometer Scale Eyepiece (1.30 .. 1.81)
    const sx = 236;
    const sy = 38;
    const sw = 216;
    const sh = 192;

    this.fillRect(sx + 4, sy + 4, sw, sh, COL32.inkBlack);
    this.fillRect(sx, sy, sw, sh, COL32.darkBg);
    this.strokeRect(sx, sy, sw, sh, COL32.lime);

    const scaleX = sx + 48;
    const scaleY = sy + 16;
    const scaleW = 120;
    const scaleH = 158;

    const minN = 1.30;
    const maxN = 1.82;
    const nToY = (n) => scaleY + Math.round(((n - minN) / (maxN - minN)) * scaleH);

    // Bright illuminated sodium field at bottom, dark TIR shadow above shadow edge!
    const isOpaque = Boolean(refData?.isOpaqueMetallic);
    const overLimit = Boolean(refData?.overLimit);
    const nLow = refData?.nLow ?? refData?.nMin ?? 1.544;
    const nHigh = refData?.nHigh ?? refData?.nMax ?? 1.553;
    const isDR = Boolean(refData?.isDoublyRefractive) && !overLimit && !isOpaque;

    // Polarizer rotation blends focus between nLow and nHigh shadow edge
    const polW = Math.sin((polarizerDeg * Math.PI) / 180) ** 2;
    const yLow = nToY(nLow);
    const yHigh = nToY(nHigh);

    for (let py = scaleY; py < scaleY + scaleH; py++) {
      for (let px = scaleX; px < scaleX + scaleW; px++) {
        let col;
        if (isOpaque) {
          col = ((px + py) & 1) === 0 ? COL32.amber : COL32.darkPanel;
        } else if (overLimit) {
          // Entire scale shadowed above 1.79 contact liquid!
          const liqY = nToY(1.79);
          col = py < liqY
            ? (((px + py) & 1) === 0 ? COL32.darkPanel : COL32.limeDark)
            : COL32.lime;
        } else if (py < yLow) {
          // Dark TIR region
          col = ((px + py) & 1) === 0 ? COL32.darkPanel : COL32.limeDark;
        } else if (isDR && py >= yLow && py <= yHigh) {
          // Birefringence shadow band!
          col = polW > 0.5 ? COL32.limeMid : COL32.amber;
        } else {
          // Bright TIR illuminated zone
          col = COL32.lime;
        }
        this.putPixel(px, py, col);
      }
    }

    this.strokeRect(scaleX, scaleY, scaleW, scaleH, COL32.inkWhite);

    // Scale graduation ticks 1.30 .. 1.80
    for (let step = 130; step <= 180; step += 2) {
      const val = step / 100;
      const ty = nToY(val);
      const major = step % 10 === 0;
      const mid = step % 5 === 0;
      const tickLen = major ? 20 : mid ? 12 : 6;
      this.drawLine(scaleX, ty, scaleX + tickLen, ty, COL32.inkBlack);
      this.drawLine(scaleX + scaleW - tickLen, ty, scaleX + scaleW - 1, ty, COL32.inkBlack);
      if (major) {
        this.drawText(val.toFixed(2), sx + 8, ty - 3, COL32.lime, 1, 1);
      }
    }

    // Crisp shadow-edge cursor markers
    if (isOpaque) {
      this.drawTag(`OPAQUE R=${refData?.reflectancePct || 54.5}%`, scaleX + 6, scaleY + 62, COL32.amber, COL32.inkBlack, COL32.inkBlack, true);
    } else if (overLimit) {
      const liqY = nToY(1.79);
      this.drawLine(scaleX - 4, liqY, scaleX + scaleW + 4, liqY, COL32.pink, 2, 2);
      this.drawTag('OTL > 1.79!', scaleX + 18, scaleY + 56, COL32.pink, COL32.inkWhite, COL32.inkBlack, true);
    } else {
      this.drawLine(scaleX - 4, yLow, scaleX + scaleW + 4, yLow, COL32.pink, 0, 1);
      if (isDR) {
        this.drawLine(scaleX - 4, yHigh, scaleX + scaleW + 4, yHigh, COL32.cyan, 0, 1);
      }
    }
  }

  // =========================================================================
  // DETECTIVE STATION ④: CALCITE DICHROSCOPE & ARCHIMEDES HYDROSTATIC SG
  // =========================================================================
  drawDichroscopeAndSGStation(opts = {}) {
    const {
      dichro = null,
      sgData = null,
      dunkProgress = 0,
      viewAngleDeg = 45,
      theme = 'riso',
    } = opts;

    const isDark = theme === 'dark';
    this.clearBackground({
      theme,
      accent: 'coral',
      headerText: 'STATION 04 // DICHROSCOPE PLEOCHROISM & HYDROSTATIC SG',
      headerStyle: 'dark',
      footerLeft: 'SUVA · GEM DETECTIVE',
      footerMid: 'ARCHIMEDES BUOYANCY & PLEOCHROISM',
      footerRight: '20.0°C H2O',
    });

    // 1. Left Card: Calcite Dichroscope Dual Windows
    const dx = 24;
    const dy = 44;
    const dw = 198;
    const dh = 188;
    this.fillRect(dx + 3, dy + 3, dw, dh, COL32.inkBlack);
    this.fillRect(dx, dy, dw, dh, COL32.darkPanel);
    this.strokeRect(dx, dy, dw, dh, COL32.lime);

    this.drawText('CALCITE DICHROSCOPE', dx + 14, dy + 12, COL32.lime, 1, 1);
    this.drawText(`ANGLE=${Math.round(viewAngleDeg)}°`, dx + 14, dy + 25, COL32.cyan, 1, 1);

    const hexA = dichro?.window1Hex || dichro?.colorA || dichro?.windowA || '#FF4D94';
    const hexB = dichro?.window2Hex || dichro?.colorB || dichro?.windowB || '#FF4D94';
    const rgbA = hexToRgb(hexA);
    const rgbB = hexToRgb(hexB);

    const drawWindow = (wx, wy, rgb, label) => {
      const ww = 68;
      const wh = 76;
      for (let py = 0; py < wh; py++) {
        for (let px = 0; px < ww; px++) {
          const bayer = (BAYER_4X4[py & 3][px & 3] - 7.5) * 2.5;
          const r = Math.max(0, Math.min(255, Math.round(rgb[0] + bayer)));
          const g = Math.max(0, Math.min(255, Math.round(rgb[1] + bayer)));
          const b = Math.max(0, Math.min(255, Math.round(rgb[2] + bayer)));
          this.putPixel(wx + px, wy + py, rgbToPacked32(r, g, b, 255));
        }
      }
      this.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2, COL32.inkWhite);
      this.drawText(label, wx + 12, wy + wh + 6, COL32.inkWhite, 1, 1);
    };

    drawWindow(dx + 20, dy + 46, rgbA, 'O / WIN-1');
    drawWindow(dx + 108, dy + 46, rgbB, 'E / WIN-2');

    const isMono = dichro?.pleochroism === 'none' || hexA.toUpperCase() === hexB.toUpperCase();
    const pleoStrength = isMono ? 'NONE (MONOCHROIC)' : `PLEOCHROIC (${String(dichro?.pleochroism || 'SPLIT').toUpperCase()})`;
    this.drawTag(pleoStrength, dx + 14, dy + 152, COL32.inkBlack, isMono ? COL32.amber : COL32.lime, COL32.lime, false);

    // 2. Right Card: Dunkable Archimedes Hydrostatic Balance Beaker
    const bx = 248;
    const by = 44;
    const bw = 208;
    const bh = 188;
    this.fillRect(bx + 3, by + 3, bw, bh, COL32.inkBlack);
    this.fillRect(bx, by, bw, bh, isDark ? COL32.darkPanel : COL32.paperCard);
    this.strokeRect(bx, by, bw, bh, isDark ? COL32.cyan : COL32.inkBlack);

    const dunk = Math.max(0, Math.min(1, Number(dunkProgress) || 0));
    const wAir = sgData?.massAirG != null ? sgData.massAirG * 5 : (sgData?.weightAirCt ?? 5.0);
    const wWater = sgData?.massWaterG != null ? sgData.massWaterG * 5 : (sgData?.weightWaterCt ?? 3.6);
    const curWeight = wAir - (wAir - wWater) * dunk;
    const sgVal = sgData?.sg ?? (wAir / Math.max(0.01, wAir - wWater));

    // Digital Scale Header Readout
    this.fillRect(bx + 14, by + 10, bw - 28, 26, COL32.inkBlack);
    this.drawText(
      `BALANCE: ${curWeight.toFixed(3)} CT`,
      bx + 22,
      by + 19,
      dunk > 0.85 ? COL32.cyan : COL32.lime,
      1,
      1
    );

    // Beaker & Water Meniscus
    const glassX = bx + 58;
    const glassY = by + 76;
    const glassW = 92;
    const glassH = 84;
    const waterRise = Math.round(dunk * 8);
    const waterTop = glassY + 28 - waterRise;

    // Water fill with pixel dither
    this.fillDitherRect(glassX + 2, waterTop, glassW - 4, glassY + glassH - waterTop - 2, COL32.cyan, COL32.blueLight);
    this.drawLine(glassX + 2, waterTop, glassX + glassW - 3, waterTop, COL32.inkWhite, 0, 2);

    // Suspended Gem on thin wire
    const gemY = Math.round(by + 62 + dunk * 64);
    const gemX = glassX + Math.round(glassW / 2);
    this.drawLine(gemX, by + 36, gemX, gemY - 12, isDark ? COL32.inkWhite : COL32.inkBlack);
    // Pixel diamond/octahedron icon
    for (let dyGem = -12; dyGem <= 12; dyGem++) {
      const span = 12 - Math.abs(dyGem);
      for (let dxGem = -span; dxGem <= span; dxGem++) {
        this.putPixel(gemX + dxGem, gemY + dyGem, Math.abs(dxGem) === span ? COL32.inkBlack : (dyGem < 0 ? COL32.pinkLight : COL32.pink));
      }
    }

    // Beaker U-walls & graduations
    this.drawLine(glassX, glassY, glassX, glassY + glassH, isDark ? COL32.inkWhite : COL32.inkBlack, 0, 2);
    this.drawLine(glassX + glassW, glassY, glassX + glassW, glassY + glassH, isDark ? COL32.inkWhite : COL32.inkBlack, 0, 2);
    this.drawLine(glassX, glassY + glassH, glassX + glassW, glassY + glassH, isDark ? COL32.inkWhite : COL32.inkBlack, 0, 2);
    for (let gy = glassY + 16; gy < glassY + glassH - 8; gy += 12) {
      this.drawLine(glassX + glassW - 10, gy, glassX + glassW - 2, gy, COL32.inkBlack);
    }

    this.drawTag(
      dunk > 0.85 ? `SG = ${sgVal.toFixed(2)} LOCKED!` : 'SLIDE TO IMMERSE IN H2O!',
      bx + 18,
      by + bh - 22,
      COL32.inkBlack,
      dunk > 0.85 ? COL32.lime : COL32.amber,
      COL32.lime,
      false
    );
  }

  present() {
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.putImageData(this.imageData, 0, 0);
    }
  }
}

// Crisp miniature Bayer-dithered stamp polyhedron renderer (for 12 Simple Forms Postage Wall!)
export function renderMiniStampCanvas(canvas, mesh, opts = {}) {
  if (!canvas || !mesh) return;
  const w = opts.width || 112;
  const h = opts.height || 76;
  const mini = new PixelEngine(canvas, w, h);
  const bg = opts.bgHex ? packHex(opts.bgHex) : (opts.dark ? COL32.darkBg : COL32.paperCard);
  mini.buf32.fill(bg);
  mini.zBuf.fill(-1e9);
  mini.faceIdBuf.fill(-1);
  mini.solidIdBuf.fill(-1);

  mini.drawCrystalScene(mesh, {
    theme: opts.dark ? 'dark' : 'riso',
    rotX: opts.rotX ?? 0.42,
    rotY: opts.rotY ?? 0.64,
    zoom: opts.zoom ?? 1.18,
    centerX: Math.round(w * 0.52),
    centerY: Math.round(h * 0.47),
    bob: false,
    overrideRampKey: opts.rampKey || null,
  });

  mini.present();
}
