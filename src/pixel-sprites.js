// SUVA · 苏哇科技 · PixelCrystal V2 (像素晶体 · 纯像素版)
// 100% Pure Crisp-Edge Pixel-Art Sprite & Icon Library (Zero Smooth Vectors / Zero System Emojis)

export const SUVA_CAT_SRC = './assets/suva-cat-pixel.svg';
export const SUVA_CAT_PNG_SRC = './assets/suva-cat-pixel.png';
export const SUVA_CAT_DETECTIVE_SRC = './assets/suva-cat-detective.svg';
export const SUVA_WECOM_QR_SRC = './assets/wecom-open-source-group.png';

function svgWrap(viewSize, pxSize, body, cls = 'px-ico') {
  return `<svg class="${cls}" width="${pxSize}" height="${pxSize}" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

// ============================================================================
// 24x24 HANDHELD & WORKBENCH MODE CARTRIDGE SPRITES
// ============================================================================
export const DOCK_SPRITES = {
  HOME: (size = 24) => svgWrap(24, size, `
    <rect x="10" y="2" width="4" height="2" fill="#111118"/>
    <rect x="8" y="4" width="8" height="2" fill="#111118"/>
    <rect x="10" y="4" width="4" height="2" fill="#FF4D94"/>
    <rect x="6" y="6" width="12" height="2" fill="#111118"/>
    <rect x="8" y="6" width="8" height="2" fill="#FF4D94"/>
    <rect x="4" y="8" width="16" height="2" fill="#111118"/>
    <rect x="6" y="8" width="12" height="2" fill="#C6FF00"/>
    <rect x="2" y="10" width="20" height="2" fill="#111118"/>
    <rect x="4" y="10" width="16" height="2" fill="#C6FF00"/>
    <rect x="4" y="12" width="16" height="10" fill="#111118"/>
    <rect x="6" y="12" width="12" height="8" fill="#FAF7F0"/>
    <rect x="10" y="15" width="4" height="5" fill="#1F38FF"/>
    <rect x="7" y="14" width="2" height="2" fill="#00E5FF"/>
    <rect x="15" y="14" width="2" height="2" fill="#00E5FF"/>
    <rect x="16" y="4" width="3" height="4" fill="#111118"/>
    <rect x="17" y="5" width="1" height="2" fill="#FFB830"/>
  `, 'px-dock-ico'),

  DETECTIVE: (size = 24) => svgWrap(24, size, `
    <rect x="7" y="2" width="10" height="2" fill="#111118"/>
    <rect x="6" y="4" width="12" height="3" fill="#8B5A2B"/>
    <rect x="5" y="4" width="1" height="3" fill="#111118"/>
    <rect x="18" y="4" width="1" height="3" fill="#111118"/>
    <rect x="6" y="7" width="12" height="2" fill="#FF4D94"/>
    <rect x="2" y="9" width="20" height="2" fill="#111118"/>
    <rect x="4" y="9" width="16" height="1" fill="#8B5A2B"/>
    <rect x="6" y="11" width="9" height="9" fill="#111118"/>
    <rect x="7" y="12" width="7" height="7" fill="#00E5FF"/>
    <rect x="8" y="13" width="3" height="2" fill="#FAF7F0"/>
    <rect x="11" y="16" width="2" height="2" fill="#1F38FF"/>
    <rect x="15" y="17" width="3" height="3" fill="#111118"/>
    <rect x="17" y="19" width="4" height="3" fill="#FFB830"/>
    <rect x="16" y="18" width="1" height="4" fill="#111118"/>
    <rect x="21" y="19" width="1" height="3" fill="#111118"/>
  `, 'px-dock-ico'),

  CODEX: (size = 24) => svgWrap(24, size, `
    <rect x="4" y="2" width="16" height="19" fill="#111118"/>
    <rect x="5" y="3" width="2" height="16" fill="#1F38FF"/>
    <rect x="8" y="3" width="11" height="15" fill="#5D3A24"/>
    <rect x="6" y="19" width="13" height="1" fill="#FAF7F0"/>
    <rect x="8" y="20" width="3" height="3" fill="#FF4D94"/>
    <rect x="12" y="6" width="3" height="2" fill="#C6FF00"/>
    <rect x="10" y="8" width="7" height="4" fill="#18D68C"/>
    <rect x="11" y="8" width="2" height="2" fill="#FAF7F0"/>
    <rect x="12" y="12" width="3" height="2" fill="#00E5FF"/>
  `, 'px-dock-ico'),

  FORGE: (size = 24) => svgWrap(24, size, `
    <rect x="11" y="2" width="8" height="4" fill="#111118"/>
    <rect x="12" y="3" width="6" height="2" fill="#C5CBE6"/>
    <rect x="14" y="6" width="2" height="6" fill="#FFB830"/>
    <rect x="13" y="6" width="1" height="6" fill="#111118"/>
    <rect x="16" y="6" width="1" height="6" fill="#111118"/>
    <rect x="5" y="7" width="2" height="2" fill="#C6FF00"/>
    <rect x="8" y="9" width="2" height="2" fill="#FF4D94"/>
    <rect x="3" y="13" width="18" height="3" fill="#111118"/>
    <rect x="4" y="14" width="15" height="2" fill="#686B82"/>
    <rect x="7" y="16" width="10" height="3" fill="#3A3D52"/>
    <rect x="5" y="19" width="14" height="3" fill="#111118"/>
    <rect x="6" y="20" width="12" height="1" fill="#686B82"/>
  `, 'px-dock-ico'),

  OPTICS: (size = 24) => svgWrap(24, size, `
    <rect x="10" y="3" width="2" height="3" fill="#111118"/>
    <rect x="9" y="6" width="4" height="3" fill="#00E5FF"/>
    <rect x="8" y="9" width="6" height="3" fill="#FAF7F0"/>
    <rect x="7" y="12" width="8" height="4" fill="#00E5FF"/>
    <rect x="6" y="16" width="10" height="3" fill="#7D92FF"/>
    <rect x="5" y="19" width="12" height="2" fill="#111118"/>
    <rect x="2" y="12" width="5" height="2" fill="#FAF7F0"/>
    <rect x="15" y="9" width="7" height="2" fill="#FF4D94"/>
    <rect x="15" y="12" width="7" height="2" fill="#C6FF00"/>
    <rect x="16" y="15" width="6" height="2" fill="#00E5FF"/>
    <rect x="17" y="18" width="5" height="2" fill="#1F38FF"/>
  `, 'px-dock-ico'),
};

// ============================================================================
// 16x16 RISO INK CRYSTAL GEM SPRITES & UI ACTION PIXEL ICONS
// ============================================================================
export const PIXEL_ICONS = {
  gemPink100: (size = 16) => svgWrap(16, size, `
    <rect x="3" y="2" width="10" height="12" fill="#111118"/>
    <rect x="2" y="3" width="12" height="10" fill="#111118"/>
    <rect x="4" y="3" width="8" height="3" fill="#FF94C2"/>
    <rect x="3" y="6" width="5" height="6" fill="#FF4D94"/>
    <rect x="8" y="6" width="5" height="6" fill="#C81E68"/>
    <rect x="4" y="4" width="2" height="2" fill="#FAF7F0"/>
  `),

  gemBlue111: (size = 16) => svgWrap(16, size, `
    <rect x="7" y="1" width="2" height="14" fill="#111118"/>
    <rect x="5" y="3" width="6" height="10" fill="#111118"/>
    <rect x="3" y="5" width="10" height="6" fill="#111118"/>
    <rect x="6" y="3" width="2" height="5" fill="#7D92FF"/>
    <rect x="8" y="3" width="2" height="5" fill="#1F38FF"/>
    <rect x="4" y="6" width="4" height="3" fill="#4D66FF"/>
    <rect x="8" y="6" width="4" height="3" fill="#1222A8"/>
    <rect x="6" y="9" width="2" height="4" fill="#1F38FF"/>
    <rect x="8" y="9" width="2" height="4" fill="#0B146E"/>
    <rect x="6" y="4" width="1" height="2" fill="#FAF7F0"/>
  `),

  gemLime110: (size = 16) => svgWrap(16, size, `
    <rect x="5" y="2" width="6" height="12" fill="#111118"/>
    <rect x="3" y="4" width="10" height="8" fill="#111118"/>
    <rect x="5" y="3" width="6" height="3" fill="#E8FF8A"/>
    <rect x="4" y="6" width="5" height="4" fill="#C6FF00"/>
    <rect x="9" y="6" width="3" height="4" fill="#7AB800"/>
    <rect x="5" y="10" width="6" height="3" fill="#5B8C00"/>
    <rect x="5" y="4" width="2" height="2" fill="#FAF7F0"/>
  `),

  gemCoral211: (size = 16) => svgWrap(16, size, `
    <rect x="5" y="2" width="6" height="12" fill="#111118"/>
    <rect x="2" y="5" width="12" height="6" fill="#111118"/>
    <rect x="4" y="4" width="8" height="8" fill="#FF785A"/>
    <rect x="5" y="3" width="4" height="3" fill="#FFB29E"/>
    <rect x="8" y="7" width="4" height="4" fill="#C43E22"/>
    <rect x="5" y="4" width="2" height="2" fill="#FAF7F0"/>
  `),

  qr: (size = 14) => svgWrap(16, size, `
    <rect x="1" y="1" width="6" height="6" fill="currentColor"/>
    <rect x="2" y="2" width="4" height="4" fill="#FAF7F0"/>
    <rect x="3" y="3" width="2" height="2" fill="#111118"/>
    <rect x="9" y="1" width="6" height="6" fill="currentColor"/>
    <rect x="10" y="2" width="4" height="4" fill="#FAF7F0"/>
    <rect x="11" y="3" width="2" height="2" fill="#111118"/>
    <rect x="1" y="9" width="6" height="6" fill="currentColor"/>
    <rect x="2" y="10" width="4" height="4" fill="#FAF7F0"/>
    <rect x="3" y="11" width="2" height="2" fill="#111118"/>
    <rect x="9" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="9" width="3" height="2" fill="currentColor"/>
    <rect x="10" y="11" width="3" height="2" fill="currentColor"/>
    <rect x="9" y="13" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="13" width="2" height="2" fill="currentColor"/>
  `),

  medal: (size = 14) => svgWrap(16, size, `
    <rect x="4" y="1" width="8" height="8" fill="#111118"/>
    <rect x="5" y="2" width="6" height="6" fill="#FFB830"/>
    <rect x="7" y="3" width="2" height="4" fill="#FAF7F0"/>
    <rect x="5" y="9" width="2" height="6" fill="#FF4D94"/>
    <rect x="9" y="9" width="2" height="6" fill="#1F38FF"/>
  `),

  sun: (size = 14) => svgWrap(16, size, `
    <rect x="7" y="1" width="2" height="2" fill="#FFB830"/>
    <rect x="7" y="13" width="2" height="2" fill="#FFB830"/>
    <rect x="1" y="7" width="2" height="2" fill="#FFB830"/>
    <rect x="13" y="7" width="2" height="2" fill="#FFB830"/>
    <rect x="3" y="3" width="2" height="2" fill="#FFB830"/>
    <rect x="11" y="3" width="2" height="2" fill="#FFB830"/>
    <rect x="3" y="11" width="2" height="2" fill="#FFB830"/>
    <rect x="11" y="11" width="2" height="2" fill="#FFB830"/>
    <rect x="5" y="5" width="6" height="6" fill="#111118"/>
    <rect x="6" y="6" width="4" height="4" fill="#C6FF00"/>
  `),

  moon: (size = 14) => svgWrap(16, size, `
    <rect x="5" y="2" width="6" height="2" fill="#00E5FF"/>
    <rect x="3" y="4" width="4" height="8" fill="#00E5FF"/>
    <rect x="5" y="12" width="6" height="2" fill="#00E5FF"/>
    <rect x="9" y="10" width="4" height="2" fill="#00E5FF"/>
    <rect x="11" y="4" width="2" height="2" fill="#C6FF00"/>
  `),

  music: (size = 14) => svgWrap(16, size, `
    <rect x="6" y="2" width="8" height="3" fill="currentColor"/>
    <rect x="6" y="5" width="2" height="7" fill="currentColor"/>
    <rect x="12" y="5" width="2" height="6" fill="currentColor"/>
    <rect x="3" y="10" width="4" height="4" fill="currentColor"/>
    <rect x="9" y="9" width="4" height="4" fill="currentColor"/>
  `),

  camera: (size = 14) => svgWrap(16, size, `
    <rect x="5" y="2" width="6" height="2" fill="#111118"/>
    <rect x="1" y="4" width="14" height="10" fill="#111118"/>
    <rect x="2" y="5" width="12" height="8" fill="#FAF7F0"/>
    <rect x="5" y="6" width="6" height="6" fill="#111118"/>
    <rect x="6" y="7" width="4" height="4" fill="#00E5FF"/>
    <rect x="11" y="6" width="2" height="2" fill="#FF4D94"/>
  `),

  handheld: (size = 14) => svgWrap(16, size, `
    <rect x="3" y="1" width="10" height="14" fill="#111118"/>
    <rect x="4" y="2" width="8" height="12" fill="#EAE3D3"/>
    <rect x="5" y="3" width="6" height="5" fill="#1F38FF"/>
    <rect x="6" y="4" width="3" height="3" fill="#C6FF00"/>
    <rect x="5" y="10" width="3" height="1" fill="#111118"/>
    <rect x="6" y="9" width="1" height="3" fill="#111118"/>
    <rect x="10" y="10" width="1" height="1" fill="#FF4D94"/>
    <rect x="9" y="11" width="1" height="1" fill="#FF4D94"/>
  `),

  v1Tag: (size = 14) => svgWrap(16, size, `
    <rect x="2" y="1" width="12" height="14" fill="#111118"/>
    <rect x="3" y="2" width="10" height="12" fill="#00E5FF"/>
    <rect x="5" y="2" width="6" height="4" fill="#FAF7F0"/>
    <rect x="5" y="9" width="6" height="4" fill="#111118"/>
  `),

  spin: (size = 12) => svgWrap(16, size, `
    <rect x="4" y="2" width="8" height="2" fill="currentColor"/>
    <rect x="10" y="4" width="2" height="3" fill="currentColor"/>
    <rect x="8" y="5" width="6" height="2" fill="currentColor"/>
    <rect x="2" y="4" width="2" height="8" fill="currentColor"/>
    <rect x="4" y="12" width="8" height="2" fill="currentColor"/>
    <rect x="12" y="10" width="2" height="2" fill="currentColor"/>
  `),

  reset: (size = 12) => svgWrap(16, size, `
    <rect x="4" y="2" width="8" height="2" fill="currentColor"/>
    <rect x="2" y="4" width="4" height="2" fill="currentColor"/>
    <rect x="2" y="2" width="2" height="5" fill="currentColor"/>
    <rect x="12" y="4" width="2" height="8" fill="currentColor"/>
    <rect x="4" y="12" width="8" height="2" fill="currentColor"/>
  `),

  twin: (size = 12) => svgWrap(16, size, `
    <rect x="2" y="5" width="6" height="6" fill="#FF4D94"/>
    <rect x="8" y="5" width="6" height="6" fill="#00E5FF"/>
    <rect x="6" y="3" width="4" height="10" fill="currentColor"/>
  `),

  axes: (size = 12) => svgWrap(16, size, `
    <rect x="7" y="1" width="2" height="14" fill="currentColor"/>
    <rect x="1" y="7" width="14" height="2" fill="currentColor"/>
    <rect x="5" y="5" width="6" height="6" fill="none" stroke="currentColor" stroke-width="2"/>
  `),

  gavel: (size = 14) => svgWrap(16, size, `
    <rect x="3" y="2" width="8" height="4" fill="currentColor"/>
    <rect x="6" y="6" width="2" height="6" fill="currentColor"/>
    <rect x="2" y="13" width="12" height="2" fill="currentColor"/>
  `),

  notebook: (size = 14) => svgWrap(16, size, `
    <rect x="3" y="1" width="10" height="14" fill="#111118"/>
    <rect x="4" y="2" width="8" height="12" fill="#FAF7F0"/>
    <rect x="5" y="4" width="6" height="2" fill="#1F38FF"/>
    <rect x="5" y="8" width="6" height="1" fill="#111118"/>
    <rect x="5" y="10" width="4" height="1" fill="#111118"/>
  `),

  check: (size = 12) => svgWrap(16, size, `
    <rect x="12" y="3" width="2" height="3" fill="currentColor"/>
    <rect x="10" y="6" width="2" height="3" fill="currentColor"/>
    <rect x="8" y="9" width="2" height="3" fill="currentColor"/>
    <rect x="6" y="11" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="9" width="2" height="3" fill="currentColor"/>
    <rect x="2" y="7" width="2" height="2" fill="currentColor"/>
  `),

  spark: (size = 12) => svgWrap(16, size, `
    <rect x="7" y="1" width="2" height="14" fill="#C6FF00"/>
    <rect x="1" y="7" width="14" height="2" fill="#C6FF00"/>
    <rect x="5" y="5" width="6" height="6" fill="#FF4D94"/>
    <rect x="7" y="7" width="2" height="2" fill="#FAF7F0"/>
  `),

  play: (size = 12) => svgWrap(16, size, `
    <rect x="4" y="2" width="2" height="12" fill="currentColor"/>
    <rect x="6" y="4" width="2" height="8" fill="currentColor"/>
    <rect x="8" y="5" width="2" height="6" fill="currentColor"/>
    <rect x="10" y="7" width="2" height="2" fill="currentColor"/>
  `),
};
