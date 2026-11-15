// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// PRISMA PIXEL OPTICS — 3-Ink Risograph + Darkroom Optical Palette & 5x7 Pixel Font

export const RISO_PALETTE = Object.freeze({
  // Print / Day Mode ("PLATE ARCHIVE")
  paper: '#F2EDE2',
  paperWarm: '#EAE3D3',
  paperCard: '#FAF7F0',
  paperDot: '#3554F4',
  paperCoral: '#F08A70',

  // Darkroom / Climax Lab Mode ("OPTICAL BENCH")
  darkBg: '#0B0B14',
  darkPanel: '#131526',
  darkCard: '#191C32',
  darkDot: '#1E3AF2',

  // Core Structural Inks
  inkBlack: '#111118',
  inkCharcoal: '#232533',
  inkWhite: '#FAF7F0',
  inkMuted: '#686B82',

  // 3 Locked Primary Riso Inks + Spectral Accents
  lime: '#C6FF00',
  limeMid: '#9BD600',
  limeDark: '#4C6B00',

  pink: '#FF4D94',
  pinkLight: '#FF85B8',
  pinkMid: '#D92672',
  pinkDark: '#7A0C38',

  blue: '#1F38FF',
  blueLight: '#7D92FF',
  blueMid: '#2541FF',
  blueDark: '#0D1B7A',

  cyan: '#00E5FF',
  cyanLight: '#8CF4FF',
  cyanDark: '#006B8F',

  amber: '#FFB830',
  amberLight: '#FFE07D',
  amberDark: '#8C5200',

  coral: '#FF785A',
  coralLight: '#FFA892',
  coralDark: '#8A2B19',

  emerald: '#18D68C',
  emeraldLight: '#7AF2C0',
  emeraldDark: '#0A6943',

  violet: '#9D6BFF',
  violetLight: '#C5A8FF',
  violetDark: '#43208F',
});

export function hexToRgb(hex) {
  const clean = String(hex).replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// Little-endian ABGR Uint32 packing for Canvas ImageData fast blitting
export function rgbToPacked32(r, g, b, a = 255) {
  return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

export function lerpColor(rgbA, rgbB, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * k),
    Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * k),
    Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * k),
  ];
}

function makeRamp(hexHi, hexLight, hexMid, hexDark, labelZh) {
  return Object.freeze({
    labelZh,
    hex: hexLight,
    hi: Object.freeze(hexToRgb(hexHi)),
    light: Object.freeze(hexToRgb(hexLight)),
    mid: Object.freeze(hexToRgb(hexMid)),
    dark: Object.freeze(hexToRgb(hexDark)),
  });
}

// "一色一单形" (One Ink Per Form) & Mineral Riso Ink Ramps
export const FORM_FAMILY_RISO_RAMPS = Object.freeze({
  cube: makeRamp('#FFB3D1', '#FF4D94', '#D92672', '#7A0C38', '粉红墨 · {100}'),
  octa: makeRamp('#A8B6FF', '#7D92FF', '#1F38FF', '#0D1B7A', '钴蓝墨 · {111}'),
  dodeca: makeRamp('#E5FF80', '#C6FF00', '#8EC700', '#3F5E00', '荧光黄绿 · {110}'),
  trap: makeRamp('#FFC4B0', '#FF785A', '#CC4429', '#731C0E', '珊瑚橙墨 · {211}'),
  pyrito: makeRamp('#FFE89E', '#FFB830', '#CC8400', '#734400', '琥珀金墨 · {210}'),
  hexoct: makeRamp('#9CF7FF', '#00E5FF', '#0099CC', '#004B6E', '光谱青墨 · {321}'),
  prism: makeRamp('#E5FF80', '#C6FF00', '#7AB800', '#2E5200', '柱面黄绿 · 柱面'),
  pyramid: makeRamp('#FFB3D1', '#FF66A8', '#C91E68', '#6B0A34', '锥面粉墨 · 锥面'),
  rhomb: makeRamp('#C7F9FF', '#7CE8FF', '#1CA3DE', '#0B4A75', '冰洲青墨 · 菱面体'),
  pinacoid: makeRamp('#FAF7F0', '#DCE3FF', '#7D92FF', '#25388D', '平行双面 · 顶底面'),
  twinA: makeRamp('#FFB3D1', '#FF66A8', '#D92672', '#7A0C38', '双晶个体 A'),
  twinB: makeRamp('#A8B6FF', '#7D92FF', '#1F38FF', '#0D1B7A', '双晶个体 B'),
  ruby: makeRamp('#FF9EBB', '#FF3B7F', '#C81453', '#69062A', '红宝铬红'),
  sapphire: makeRamp('#9EB2FF', '#3D63FF', '#1A33BD', '#0B1766', '蓝宝钛蓝'),
  emerald: makeRamp('#98F7CC', '#18D68C', '#0B9E63', '#064F31', '祖母绿翠'),
  diamond: makeRamp('#FFFFFF', '#D6F3FF', '#7AC5F0', '#26568C', '金刚冰蓝'),
  gold: makeRamp('#FFF0B3', '#FFD04D', '#D99514', '#754900', '黄铁耀金'),
  violet: makeRamp('#DEC7FF', '#A675FF', '#6C35DE', '#33127A', '紫晶堇紫'),
  cyan: makeRamp('#B8FAFF', '#00E5FF', '#009BB8', '#004A63', '海蓝青碧'),
});

// Normalized 4x4 ordered Bayer dithering matrix (values 0..15)
export const BAYER_4X4 = Object.freeze([
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]);

// Crisp 5x7 1-bit pixel font glyphs (each row is 5-bit integer MSB..LSB)
export const PIXEL_FONT_5X7 = Object.freeze({
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 30, 17, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 1, 14],
  'A': [14, 17, 17, 31, 17, 17, 17],
  'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14],
  'D': [30, 17, 17, 17, 17, 17, 30],
  'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16],
  'G': [14, 17, 16, 23, 17, 17, 15],
  'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14],
  'J': [7, 2, 2, 2, 18, 18, 12],
  'K': [17, 18, 20, 24, 20, 18, 17],
  'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 21, 17, 17, 17],
  'N': [17, 25, 21, 19, 17, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14],
  'P': [30, 17, 17, 30, 16, 16, 16],
  'Q': [14, 17, 17, 17, 21, 18, 13],
  'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30],
  'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14],
  'V': [17, 17, 17, 17, 17, 10, 4],
  'W': [17, 17, 17, 21, 21, 27, 17],
  'X': [17, 17, 10, 4, 10, 17, 17],
  'Y': [17, 17, 10, 4, 4, 4, 4],
  'Z': [31, 1, 2, 4, 8, 16, 31],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 4, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '{': [6, 4, 4, 8, 4, 4, 6],
  '}': [12, 4, 4, 2, 4, 4, 12],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '°': [12, 18, 18, 12, 0, 0, 0],
  '\'': [4, 4, 8, 0, 0, 0, 0],
  '%': [25, 26, 2, 4, 8, 19, 19],
  '#': [10, 31, 10, 10, 31, 10, 0],
  '·': [0, 0, 0, 12, 12, 0, 0],
  '>': [16, 8, 4, 2, 4, 8, 16],
  '<': [2, 4, 8, 16, 8, 4, 2],
  'Δ': [4, 4, 10, 10, 17, 17, 31],
  'λ': [16, 8, 4, 12, 10, 17, 17],
  'θ': [14, 17, 17, 31, 17, 17, 14],
  'Γ': [31, 16, 16, 16, 16, 16, 16],
  '≠': [2, 31, 4, 31, 8, 0, 0],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 2, 4, 4, 0, 4],
  // Lowercase crystallographic axes & form symbols (a, b, c, r, α)
  'a': [0, 0, 14, 1, 15, 17, 15],
  'b': [16, 16, 30, 17, 17, 17, 30],
  'c': [0, 0, 14, 16, 16, 17, 14],
  'r': [0, 0, 22, 25, 16, 16, 16],
  'α': [0, 0, 13, 19, 19, 13, 0],
  '^': [0, 4, 10, 17, 0, 0, 0],
  // Barred Hermann-Mauguin & Miller digits (1̄, 2̄, 3̄, 4̄, 6̄)
  '\uE001': [31, 0, 4, 12, 4, 4, 14],
  '\uE002': [31, 0, 14, 1, 6, 8, 31],
  '\uE003': [31, 0, 30, 1, 14, 1, 30],
  '\uE004': [31, 0, 2, 10, 18, 31, 2],
  '\uE006': [31, 0, 14, 16, 30, 17, 14],
});
