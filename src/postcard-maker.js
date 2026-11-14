// SUVA · 苏哇科技 · PixelCrystal V2 (像素晶体 · 纯像素纪念邮票卡)
// 1280x720 100% Pure Pixel-Art Risograph Souvenir Postcard Exporter (ArkPixel12 + SUVA Black Cat + WeCom QR)

import { RISO_PALETTE, PIXEL_FONT_5X7 } from './palette.js';
import { SUVA_CAT_SRC, SUVA_WECOM_QR_SRC } from './pixel-sprites.js';

let preloadedCatImg = null;
let preloadedQrImg = null;

if (typeof Image !== 'undefined') {
  preloadedCatImg = new Image();
  preloadedCatImg.src = SUVA_CAT_SRC;
  preloadedQrImg = new Image();
  preloadedQrImg.src = SUVA_WECOM_QR_SRC;
}

function drawPixelGlyphText(ctx, text, x, y, scale = 2, color = RISO_PALETTE.inkBlack, letterSpacing = 1) {
  const upper = String(text || '')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .toUpperCase()
    .replace(/Λ/g, 'λ')
    .replace(/Θ/g, 'θ');
  const ampGlyph = [12, 18, 20, 8, 21, 18, 13];
  ctx.fillStyle = color;
  let cursorX = Math.round(x);
  const baseY = Math.round(y);

  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    const glyph = PIXEL_FONT_5X7[ch] || (ch === '&' ? ampGlyph : PIXEL_FONT_5X7[' ']);
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if ((bits >> (4 - col)) & 1) {
          ctx.fillRect(cursorX + col * scale, baseY + row * scale, scale, scale);
        }
      }
    }
    cursorX += (5 + letterSpacing) * scale;
  }
  return cursorX;
}

function drawRegistrationMark(ctx, cx, cy, scale = 2, color = RISO_PALETTE.inkBlack) {
  ctx.fillStyle = color;
  const r = 4 * scale;
  ctx.fillRect(cx - r - 2 * scale, cy - Math.floor(scale / 2), (r + 2 * scale) * 2 + scale, scale);
  ctx.fillRect(cx - Math.floor(scale / 2), cy - r - 2 * scale, scale, (r + 2 * scale) * 2 + scale);

  const pts = [
    [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4],
    [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4],
    [-4, -2], [-4, -1], [-4, 0], [-4, 1], [-4, 2],
    [4, -2], [4, -1], [4, 0], [4, 1], [4, 2],
    [-3, -3], [3, -3], [-3, 3], [3, 3],
  ];
  for (const [dx, dy] of pts) {
    ctx.fillRect(cx + dx * scale, cy + dy * scale, scale, scale);
  }
}

function drawHalftoneMatrix(ctx, w, h, isDark) {
  const dotColor = isDark ? RISO_PALETTE.darkDot : RISO_PALETTE.paperDot;
  ctx.fillStyle = dotColor;
  const step = 20;
  for (let y = 24; y < h - 24; y += step) {
    for (let x = Math.floor(w * 0.36); x < w - 20; x += step) {
      const prog = (x - w * 0.36) / (w * 0.64);
      if (prog < 0.35) {
        ctx.fillRect(x, y, 2, 2);
      } else if (prog < 0.72) {
        ctx.fillRect(x, y - 2, 2, 6);
        ctx.fillRect(x - 2, y, 6, 2);
      } else {
        ctx.fillRect(x - 1, y - 3, 4, 8);
        ctx.fillRect(x - 3, y - 1, 8, 4);
      }
    }
  }
}

function drawPerforatedCard(ctx, x, y, w, h, fill, borderColor, bgHoleColor) {
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(x + 12, y + 12, w, h);
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(x + 6, y + 6, w, h);

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

  ctx.fillStyle = bgHoleColor;
  const notchStep = 26;
  for (let py = y + 22; py < y + h - 18; py += notchStep) {
    ctx.fillRect(x - 4, py - 5, 9, 10);
    ctx.fillRect(x + w - 5, py - 5, 9, 10);
    ctx.fillStyle = borderColor;
    ctx.fillRect(x + 5, py - 5, 3, 10);
    ctx.fillRect(x + w - 8, py - 5, 3, 10);
    ctx.fillStyle = bgHoleColor;
  }
}

function drawSuvaCatPlaque(ctx, x, y) {
  ctx.fillStyle = RISO_PALETTE.darkBg;
  ctx.fillRect(x, y, 60, 60);
  ctx.strokeStyle = RISO_PALETTE.lime;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, 58, 58);

  if (preloadedCatImg && preloadedCatImg.complete && preloadedCatImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(preloadedCatImg, x + 6, y + 4, 48, 48);
  } else {
    // Crisp pixel fallback silhouette of upward-gazing SUVA Black Cat
    ctx.fillStyle = RISO_PALETTE.inkWhite;
    ctx.fillRect(x + 14, y + 12, 8, 8);
    ctx.fillRect(x + 34, y + 10, 8, 8);
    ctx.fillRect(x + 14, y + 18, 30, 22);
    ctx.fillStyle = RISO_PALETTE.inkBlack;
    ctx.fillRect(x + 16, y + 19, 26, 19);
    ctx.fillStyle = RISO_PALETTE.inkWhite;
    ctx.fillRect(x + 22, y + 22, 4, 4);
    ctx.fillRect(x + 34, y + 20, 4, 4);
    ctx.fillRect(x + 12, y + 42, 36, 3);
  }
  drawPixelGlyphText(ctx, 'SUVA', x + 19, y + 51, 1, RISO_PALETTE.lime, 1);
}

export function exportPixelPostcard({
  canvas,
  modeTitle = 'CH.01 // GEM DETECTIVE',
  mineral = null,
  rankTitle = '见习晶体学徒',
  stampsUnlocked = 0,
  totalStamps = 12,
  statsText = '',
  theme = 'riso',
  autoDownload = true,
} = {}) {
  const W = 1280;
  const H = 720;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const isDark = theme === 'dark';
  const outerBg = isDark ? RISO_PALETTE.darkBg : RISO_PALETTE.paper;
  const cardBg = isDark ? RISO_PALETTE.darkPanel : RISO_PALETTE.paperCard;
  const fgInk = isDark ? RISO_PALETTE.inkWhite : RISO_PALETTE.inkBlack;
  const subInk = isDark ? '#B2BBE2' : RISO_PALETTE.inkCharcoal;

  // 1. Outer Plate Paper / Darkroom Matrix
  ctx.fillStyle = outerBg;
  ctx.fillRect(0, 0, W, H);
  drawHalftoneMatrix(ctx, W, H, isDark);

  // 2. Four-corner Registration Marks
  const regColor = isDark ? RISO_PALETTE.inkWhite : RISO_PALETTE.inkBlack;
  drawRegistrationMark(ctx, 24, 24, 2, regColor);
  drawRegistrationMark(ctx, W - 24, 24, 2, regColor);
  drawRegistrationMark(ctx, 24, H - 24, 2, regColor);
  drawRegistrationMark(ctx, W - 24, H - 24, 2, regColor);

  // 3. Perforated Stamp Card Container
  drawPerforatedCard(ctx, 52, 44, W - 104, H - 96, cardBg, isDark ? RISO_PALETTE.lime : RISO_PALETTE.inkBlack, outerBg);

  // 4. Left Editorial Column (100% Pure ArkPixel12 Bitmap Typography at integer 12/24/48px!)
  const lx = 84;
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(lx + 4, 74, 368, 30);
  ctx.fillStyle = RISO_PALETTE.lime;
  ctx.fillRect(lx, 70, 368, 30);
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 1, 71, 366, 28);
  drawPixelGlyphText(ctx, 'SUVA · PIXEL CRYSTAL · V2.0', lx + 12, 78, 2, RISO_PALETTE.inkBlack, 1);

  // Pure 48px (4x12px) Bitmap Pixel Title "像素晶体"
  ctx.font = '400 48px "ArkPixel12", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = RISO_PALETTE.cyan;
  ctx.fillText('像素晶体', lx + 4, 114);
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillText('像素晶体', lx - 4, 108);
  ctx.fillStyle = fgInk;
  ctx.fillText('像素晶体', lx, 111);

  drawPixelGlyphText(ctx, 'PIXEL CRYSTAL V2 // 100% PIXEL', lx + 2, 170, 2, RISO_PALETTE.blueLight, 1);

  // Mode Tag
  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(lx, 196, 368, 28);
  ctx.font = '400 12px "ArkPixel12", monospace';
  ctx.fillStyle = RISO_PALETTE.inkWhite;
  ctx.fillText(`> ${modeTitle}`, lx + 10, 204);

  // Specimen / Telemetry Box
  const specBoxY = 236;
  ctx.fillStyle = isDark ? RISO_PALETTE.darkCard : RISO_PALETTE.paper;
  ctx.fillRect(lx, specBoxY, 368, 204);
  ctx.strokeStyle = fgInk;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 1, specBoxY + 1, 366, 202);

  const minName = mineral?.nameZh || mineral?.titleZh || '26面终极聚形晶 {100}+{111}+{110}';
  const minSub = mineral?.nameEn || mineral?.formula || 'CUBIC · 3L4 4L3 6L2 9P C';
  const minSys = mineral?.systemZh || mineral?.crystalSystemZh || mineral?.formsLabel || '等轴晶系 · 一色一单形孔版归档';
  const minOptic = mineral?.opticLabel
    || (mineral?.riText ? `RI ${mineral.riText}  |  SG ${mineral.sg || '--'}` : '3 INKS LOCKED · BAYER 4x4 DITHER');
  const minExtra = statsText || mineral?.diagnosticTip || '面角守恒 · 斯涅尔色散 · 偏光干涉';

  ctx.font = '400 24px "ArkPixel12", monospace';
  ctx.fillStyle = isDark ? RISO_PALETTE.lime : RISO_PALETTE.inkBlack;
  ctx.fillText(String(minName).slice(0, 14), lx + 12, specBoxY + 14);

  ctx.font = '400 12px "ArkPixel12", monospace';
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillText(String(minSub).slice(0, 38), lx + 12, specBoxY + 48);

  ctx.fillStyle = fgInk;
  ctx.fillText(`晶系/单形: ${String(minSys).slice(0, 24)}`, lx + 12, specBoxY + 74);
  ctx.fillText(`光学常数: ${String(minOptic).slice(0, 28)}`, lx + 12, specBoxY + 98);

  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(lx + 12, specBoxY + 124, 344, 2);

  ctx.fillStyle = subInk;
  const extraLines = String(minExtra).includes('\n')
    ? String(minExtra).split('\n')
    : [String(minExtra).slice(0, 26), String(minExtra).slice(26, 52)].filter(Boolean);
  if (extraLines[0]) ctx.fillText(extraLines[0].slice(0, 28), lx + 12, specBoxY + 138);
  if (extraLines[1]) ctx.fillText(extraLines[1].slice(0, 28), lx + 12, specBoxY + 160);

  // Player Rank & Stamp Matrix
  const rankY = 452;
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(lx, rankY, 368, 72);
  ctx.strokeStyle = RISO_PALETTE.lime;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 1, rankY + 1, 366, 70);

  ctx.font = '400 12px "ArkPixel12", monospace';
  ctx.fillStyle = RISO_PALETTE.lime;
  ctx.fillText(`头衔: ${rankTitle}`, lx + 12, rankY + 12);

  drawPixelGlyphText(
    ctx,
    `STAMPS ${String(stampsUnlocked).padStart(2, '0')}/${String(totalStamps).padStart(2, '0')}`,
    lx + 216,
    rankY + 11,
    2,
    RISO_PALETTE.cyan,
    1
  );

  const slots = Math.max(1, Math.min(16, totalStamps || 12));
  for (let i = 0; i < slots; i++) {
    const sx = lx + 12 + i * 28;
    const sy = rankY + 38;
    const unlocked = i < stampsUnlocked;
    ctx.fillStyle = unlocked ? (i % 3 === 0 ? RISO_PALETTE.pink : i % 3 === 1 ? RISO_PALETTE.lime : RISO_PALETTE.cyan) : '#23263A';
    ctx.fillRect(sx, sy, 22, 22);
    if (unlocked) {
      ctx.fillStyle = RISO_PALETTE.inkBlack;
      ctx.fillRect(sx + 7, sy + 7, 8, 8);
    }
  }

  // SUVA Official Pixel Black Cat Seal Block
  const sealY = 538;
  drawSuvaCatPlaque(ctx, lx, sealY);
  ctx.font = '400 12px "ArkPixel12", monospace';
  ctx.fillStyle = fgInk;
  ctx.fillText('SUVA / 地质大学博士说AI / 苏哇科技', lx + 70, sealY + 6);
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillText('光影实验室原创 · 晶体光学纯像素街机', lx + 70, sealY + 26);
  ctx.fillStyle = subInk;
  ctx.fillText('Source-Available 仅限个人非商业体验', lx + 70, sealY + 46);

  // 5. Right Captured Pixel Stage Viewport (720x405)
  const vx = 476;
  const vy = 74;
  const vw = 720;
  const vh = 405;

  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(vx + 10, vy + 10, vw + 12, vh + 52);
  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(vx, vy, vw + 12, vh + 52);
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 4;
  ctx.strokeRect(vx + 2, vy + 2, vw + 8, vh + 48);

  ctx.fillStyle = RISO_PALETTE.darkBg;
  ctx.fillRect(vx + 6, vy + 6, vw, vh);
  if (canvas) {
    const pre = document.createElement('canvas');
    pre.width = canvas.width * 4;
    pre.height = canvas.height * 4;
    const pctx = pre.getContext('2d');
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(canvas, 0, 0, pre.width, pre.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pre, vx + 6, vy + 6, vw, vh);
    ctx.imageSmoothingEnabled = false;
  }
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 3;
  ctx.strokeRect(vx + 6, vy + 6, vw, vh);

  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(vx + 6, vy + vh + 10, vw, 34);
  const dateStr = new Date().toISOString().slice(0, 10);
  drawPixelGlyphText(
    ctx,
    `480X270 PIXEL STAGE // ${dateStr} // SUVA PIXEL CRYSTAL V2`,
    vx + 16,
    vy + vh + 20,
    2,
    RISO_PALETTE.lime,
    1
  );

  // Bottom-Right: SUVA Open-Source WeCom QR Stamp + Cancellation Seal
  if (preloadedQrImg && preloadedQrImg.complete && preloadedQrImg.naturalWidth > 0) {
    const qx = 1104;
    const qy = 534;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qx, qy, 96, 96);
    ctx.strokeStyle = RISO_PALETTE.inkBlack;
    ctx.lineWidth = 3;
    ctx.strokeRect(qx, qy, 96, 96);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(preloadedQrImg, qx + 5, qy + 5, 86, 86);

    ctx.font = '400 12px "ArkPixel12", monospace';
    ctx.fillStyle = fgInk;
    ctx.fillText('余博士开源技术群', qx - 122, qy + 24);
    ctx.fillStyle = subInk;
    ctx.fillText('微信扫码交流晶体光学', qx - 134, qy + 46);
  }

  // Postage Cancellation Stamp
  ctx.save();
  ctx.translate(876, 580);
  ctx.rotate(-0.10);
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(-82, -24, 164, 48);
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 3;
  ctx.strokeRect(-80, -22, 160, 44);
  drawPixelGlyphText(ctx, 'VERIFIED GEM', -64, -14, 2, RISO_PALETTE.inkWhite, 1);
  drawPixelGlyphText(ctx, 'SUVA ARCHIVE', -64, 4, 2, RISO_PALETTE.lime, 1);
  ctx.restore();

  // Bottom Plate Telemetry Footer
  drawPixelGlyphText(
    ctx,
    'PRISMA PIXEL OPTICS V2   SUVA TECH // CRYSTAL OPTICS SOUVENIR PLATE',
    64,
    H - 30,
    2,
    regColor,
    1
  );
  drawPixelGlyphText(ctx, 'PLATE V2', W - 168, H - 30, 2, regColor, 1);

  const dataUrl = out.toDataURL('image/png');

  if (autoDownload && typeof document !== 'undefined') {
    const slug = String(mineral?.id || 'crystal')
      .replace(/[^a-z0-9_-]/gi, '-')
      .toLowerCase();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SUVA-PixelCrystal-V2-${slug}-${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return dataUrl;
}
