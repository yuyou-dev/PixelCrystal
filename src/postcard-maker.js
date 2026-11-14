// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// 1280x720 Risograph Pixel Stamp Souvenir Postcard Exporter

import { RISO_PALETTE, PIXEL_FONT_5X7 } from './palette.js';

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
  // Crisp pixel circle + crosshair (⊕)
  const r = 4 * scale;
  ctx.fillRect(cx - r - 2 * scale, cy - Math.floor(scale / 2), (r + 2 * scale) * 2 + scale, scale);
  ctx.fillRect(cx - Math.floor(scale / 2), cy - r - 2 * scale, scale, (r + 2 * scale) * 2 + scale);

  // Octagonal pixel ring
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
  // Hard Riso offset shadows (Pink + Black)
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(x + 12, y + 12, w, h);
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(x + 6, y + 6, w, h);

  // Main body
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

  // Postage stamp perforations along left & right vertical edges
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

function drawSuvaMiniEmblem(ctx, x, y) {
  // Pixel Cat-Crystal Emblem matching assets/suva-pixel-seal.svg
  ctx.fillStyle = RISO_PALETTE.darkBg;
  ctx.fillRect(x, y, 52, 52);
  ctx.strokeStyle = RISO_PALETTE.blue;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, 50, 50);

  ctx.fillStyle = RISO_PALETTE.lime;
  ctx.fillRect(x + 8, y + 6, 8, 8);
  ctx.fillRect(x + 36, y + 6, 8, 8);

  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(x + 8, y + 14, 36, 22);

  ctx.fillStyle = RISO_PALETTE.inkWhite;
  ctx.fillRect(x + 13, y + 19, 6, 6);
  ctx.fillRect(x + 33, y + 19, 6, 6);

  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(x + 23, y + 27, 6, 5);

  ctx.fillStyle = RISO_PALETTE.lime;
  ctx.fillRect(x + 6, y + 39, 40, 9);
  drawPixelGlyphText(ctx, 'SUVA', x + 15, y + 40, 1, RISO_PALETTE.inkBlack, 1);
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
  const subInk = isDark ? '#A5ACCF' : RISO_PALETTE.inkCharcoal;

  // 1. Outer Plate Paper / Darkroom Matrix
  ctx.fillStyle = outerBg;
  ctx.fillRect(0, 0, W, H);
  drawHalftoneMatrix(ctx, W, H, isDark);

  // 2. Four-corner Registration Marks (⊕)
  const regColor = isDark ? RISO_PALETTE.inkWhite : RISO_PALETTE.inkBlack;
  drawRegistrationMark(ctx, 24, 24, 2, regColor);
  drawRegistrationMark(ctx, W - 24, 24, 2, regColor);
  drawRegistrationMark(ctx, 24, H - 24, 2, regColor);
  drawRegistrationMark(ctx, W - 24, H - 24, 2, regColor);

  // 3. Perforated Stamp Card Container
  drawPerforatedCard(ctx, 52, 44, W - 104, H - 96, cardBg, isDark ? RISO_PALETTE.lime : RISO_PALETTE.inkBlack, outerBg);

  // 4. Left Editorial Column
  const lx = 84;
  // Top Lime Ribbon
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(lx + 4, 76, 368, 30);
  ctx.fillStyle = RISO_PALETTE.lime;
  ctx.fillRect(lx, 72, 368, 30);
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 1, 73, 366, 28);
  drawPixelGlyphText(ctx, 'PRISMA · PIXEL CRYSTAL · SUVA', lx + 12, 80, 2, RISO_PALETTE.inkBlack, 1);

  // Riso Misregistered Main Title "像素晶体"
  const titleFont = '900 52px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", monospace';
  ctx.font = titleFont;
  ctx.textBaseline = 'top';
  ctx.fillStyle = RISO_PALETTE.cyan;
  ctx.fillText('像素晶体', lx + 5, 121);
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillText('像素晶体', lx - 3, 115);
  ctx.fillStyle = fgInk;
  ctx.fillText('像素晶体', lx, 117);

  drawPixelGlyphText(ctx, 'PIXEL CRYSTAL // OPTICS ARCADE', lx + 2, 180, 2, RISO_PALETTE.blueLight, 1);

  // Mode Tag
  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(lx, 206, 368, 28);
  ctx.font = '800 14px "Noto Sans SC", "PingFang SC", monospace';
  ctx.fillStyle = RISO_PALETTE.inkWhite;
  ctx.fillText(`▸ ${modeTitle}`, lx + 10, 212);

  // Specimen / Telemetry Box
  const specBoxY = 248;
  ctx.fillStyle = isDark ? RISO_PALETTE.darkCard : RISO_PALETTE.paper;
  ctx.fillRect(lx, specBoxY, 368, 198);
  ctx.strokeStyle = fgInk;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 1, specBoxY + 1, 366, 196);

  const minName = mineral?.nameZh || mineral?.titleZh || '26面终极聚形晶 {100}+{111}+{110}';
  const minSub = mineral?.nameEn || mineral?.formula || 'CUBIC · 3L4 4L3 6L2 9P C';
  const minSys = mineral?.systemZh || mineral?.crystalSystemZh || mineral?.formsLabel || '等轴晶系 · 一色一单形孔版归档';
  const minOptic = mineral?.opticLabel
    || (mineral?.riText ? `RI ${mineral.riText}  |  SG ${mineral.sg || '--'}` : '3 INKS LOCKED · BAYER 4x4 DITHER');
  const minExtra = statsText || mineral?.diagnosticTip || '面角守恒 · 斯涅尔色散 · 偏光干涉';

  ctx.font = '900 22px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = isDark ? RISO_PALETTE.lime : RISO_PALETTE.inkBlack;
  ctx.fillText(String(minName).slice(0, 18), lx + 14, specBoxY + 14);

  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillText(String(minSub).slice(0, 38), lx + 14, specBoxY + 46);

  ctx.font = '700 14px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = fgInk;
  ctx.fillText(`晶系/单形：${String(minSys).slice(0, 22)}`, lx + 14, specBoxY + 74);
  ctx.fillText(`光学参数：${String(minOptic).slice(0, 24)}`, lx + 14, specBoxY + 102);

  // Divider
  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(lx + 14, specBoxY + 132, 340, 2);

  ctx.font = '600 13px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = subInk;
  const extraStr = String(minExtra);
  ctx.fillText(extraStr.slice(0, 25), lx + 14, specBoxY + 144);
  if (extraStr.length > 25) {
    ctx.fillText(extraStr.slice(25, 50), lx + 14, specBoxY + 166);
  }

  // Player Rank & Stamp Matrix
  const rankY = 460;
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(lx, rankY, 368, 72);
  ctx.strokeStyle = RISO_PALETTE.lime;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 1, rankY + 1, 366, 70);

  ctx.font = '800 15px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = RISO_PALETTE.lime;
  ctx.fillText(`头衔：${rankTitle}`, lx + 12, rankY + 10);

  drawPixelGlyphText(
    ctx,
    `STAMPS ${String(stampsUnlocked).padStart(2, '0')}/${String(totalStamps).padStart(2, '0')}`,
    lx + 216,
    rankY + 12,
    2,
    RISO_PALETTE.cyan,
    1
  );

  // 12 Mini Stamp Slots
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

  // SUVA Official Origin Seal Block
  const sealY = 548;
  drawSuvaMiniEmblem(ctx, lx, sealY);
  ctx.font = '900 15px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = fgInk;
  ctx.fillText('SUVA · 苏哇科技 原创出品', lx + 64, sealY + 4);
  ctx.font = '700 12px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillText('光影实验室 · 晶体光学街机纪念邮票卡', lx + 64, sealY + 25);
  ctx.fillStyle = subInk;
  ctx.fillText('Source-Available 仅限个人非商业体验', lx + 64, sealY + 42);

  // 5. Right Captured Pixel Stage Viewport (exact 1.5x = 720x405 via 4x integer nearest-neighbor prescale)
  const vx = 478;
  const vy = 84;
  const vw = 720;
  const vh = 405;

  // Pink & Cobalt Offset Frame (homage to pixel_08_finale_lockup.png)
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(vx + 12, vy + 12, vw + 12, vh + 58);
  ctx.fillStyle = RISO_PALETTE.blue;
  ctx.fillRect(vx, vy, vw + 12, vh + 58);
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 4;
  ctx.strokeRect(vx + 2, vy + 2, vw + 8, vh + 54);

  // Blit source 480x270 canvas via 4x integer nearest-neighbor prescale so 1px strokes never drop
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

  // Bottom Stage Caption Bar inside Cobalt Frame
  ctx.fillStyle = RISO_PALETTE.inkBlack;
  ctx.fillRect(vx + 6, vy + vh + 12, vw, 38);
  const dateStr = new Date().toISOString().slice(0, 10);
  drawPixelGlyphText(
    ctx,
    `480X270 PIXEL STAGE // ${dateStr} // 3 INKS LOCKED`,
    vx + 18,
    vy + vh + 24,
    2,
    RISO_PALETTE.lime,
    1
  );

  // Bottom-right Postage Cancellation Stamp Circle
  const stampCx = 1110;
  const stampCy = 588;
  ctx.save();
  ctx.translate(stampCx, stampCy);
  ctx.rotate(-0.14);
  ctx.fillStyle = RISO_PALETTE.pink;
  ctx.fillRect(-78, -24, 156, 48);
  ctx.strokeStyle = RISO_PALETTE.inkBlack;
  ctx.lineWidth = 3;
  ctx.strokeRect(-76, -22, 152, 44);
  drawPixelGlyphText(ctx, 'VERIFIED GEM', -62, -14, 2, RISO_PALETTE.inkWhite, 1);
  drawPixelGlyphText(ctx, 'SUVA ARCHIVE', -62, 4, 2, RISO_PALETTE.lime, 1);
  ctx.restore();

  // Bottom Plate Telemetry Footer
  drawPixelGlyphText(
    ctx,
    'PRISMA PIXEL OPTICS   SUVA TECH // CRYSTAL OPTICS SOUVENIR PLATE',
    64,
    H - 30,
    2,
    regColor,
    1
  );
  drawPixelGlyphText(ctx, 'PLATE 01', W - 168, H - 30, 2, regColor, 1);

  const dataUrl = out.toDataURL('image/png');

  if (autoDownload && typeof document !== 'undefined') {
    const slug = String(mineral?.id || 'crystal')
      .replace(/[^a-z0-9_-]/gi, '-')
      .toLowerCase();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SUVA-PixelCrystal-${slug}-${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return dataUrl;
}
