// SUVA · 苏哇科技 · PixelCrystal V2 (像素晶体 · 100% 纯像素街机与掌机双模引擎)
// Official Team: SUVA / 地质大学博士说AI / 苏哇科技

import {
  OPTICAL_MATERIALS,
  getMaterial,
  opticAxisInfo,
  prismDispersionFan,
  snellBenchRay,
  calciteDoubleRay,
  orthoscopicRetardation,
  michelLevyStrip,
  renderConoscopeBuffer,
  refractometerShadow,
  dichroscopeColors,
  hydrostaticSG,
} from './optics-core.js';

import {
  buildMineralMesh,
  buildSimpleFormMesh,
  buildForgeCombination,
} from './crystal-meshes.js';

import {
  CRYSTAL_SYSTEMS,
  MINERAL_CODEX,
  SIMPLE_FORMS_12,
  FORGE_CHALLENGES,
  DETECTIVE_CASES,
  generateEndlessCase,
  ACHIEVEMENT_STAMPS,
  PLAYER_RANKS,
} from './game-data.js';

import {
  unlockAudio,
  toggleBgm,
  isBgmPlaying,
  playClick,
  playFaceTap,
  playLaserSweep,
  playStampSlam,
  playForgeSuccess,
  playWrongBuzz,
  playTypewriterTick,
} from './chiptune-sfx.js';

import { PixelEngine, renderMiniStampCanvas } from './pixel-engine.js';
import { exportPixelPostcard } from './postcard-maker.js';
import {
  DOCK_SPRITES,
  PIXEL_ICONS,
  SUVA_CAT_DETECTIVE_SRC,
} from './pixel-sprites.js';

const SAVE_KEY = 'suva_pixel_crystal_save_v1';
const CODEX_MAP = new Map(MINERAL_CODEX.map((m) => [m.id, m]));

function loadSaveState() {
  const base = {
    xp: 0,
    stamps: [],
    solvedCases: [],
    forgedBlueprints: [],
    inspectedForms: ['cube_100'],
    streak: 0,
    endlessSeed: 1,
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      ...base,
      xp: Number(parsed.xp) || 0,
      stamps: Array.isArray(parsed.stamps) ? parsed.stamps : [],
      solvedCases: Array.isArray(parsed.solvedCases) ? parsed.solvedCases : [],
      forgedBlueprints: Array.isArray(parsed.forgedBlueprints) ? parsed.forgedBlueprints : [],
      inspectedForms: Array.isArray(parsed.inspectedForms) ? parsed.inspectedForms : ['cube_100'],
      streak: Number(parsed.streak) || 0,
      endlessSeed: Number(parsed.endlessSeed) || 1,
    };
  } catch {
    return base;
  }
}

function persistSaveState(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota errors
  }
}

function computePlayerRank(xp) {
  let current = PLAYER_RANKS[0];
  for (const r of PLAYER_RANKS) {
    if (xp >= r.minXp) current = r;
  }
  return current;
}

// ============================================================================
// RUNTIME GAME STATE
// ============================================================================
const save = loadSaveState();

const state = {
  view: 'HOME', // 'HOME' | 'DETECTIVE' | 'CODEX' | 'FORGE' | 'OPTICS'
  theme: 'riso', // 'riso' | 'dark'
  forceHandheld: false,
  mobileSubGroup: {
    HOME: 'home-launch',
    DETECTIVE: 'det-lab',
    CODEX: 'codex-list',
    FORGE: 'forge-cut',
    OPTICS: 'opt-dispersion',
  },

  autoSpin: true,
  rotX: 0.36,
  rotY: 0.62,
  rotZ: 0,
  zoom: 1.0,
  showAxes: false,

  hoveredFaceId: -1,
  selectedFaceId: -1,
  secondFaceId: -1,

  // Detective state
  activeCase: DETECTIVE_CASES[0],
  detStation: 1,
  detVariant: 'single',
  detRefRotDeg: 35,
  detTirAngleDeg: 28,
  detStageDeg: 45,
  detConoscopeMode: false,
  detGypsumOn: false,
  detDichroDeg: 20,
  detDunkProgress: 0,
  detVisitedStations: new Set([1]),
  detSolvedCurrent: false,

  // Codex state
  codexMineralId: 'spinel',
  codexSystemFilter: 'all',
  codexSearch: '',
  codexVariant: 'single',
  codexExplode: 0,
  codexConstancyCard: false,

  // Forge state
  forgeSubTab: 'stamps', // 'stamps' | 'build'
  selectedSimpleFormId: 'master_26',
  activeBlueprintId: FORGE_CHALLENGES[0].id,
  forgeMode: FORGE_CHALLENGES[0].mode,
  d100: 1.0,
  d111: 1.0,
  d110: 1.12,
  d211: 1.55,

  // Optics Darkroom state
  opticsBench: 'dispersion', // 'dispersion' | 'calcite' | 'michel' | 'conoscope'
  dispSubMode: 'prism', // 'prism' | 'tir'
  dispMaterialId: 'flint_prism',
  dispApexDeg: 60,
  dispIncidentDeg: 48,
  dispComboScore: 0,
  dispTargets: [
    { id: 't1', x: 348, y: 156 },
    { id: 't2', x: 348, y: 178 },
    { id: 't3', x: 348, y: 202 },
  ],

  calciteMaterialId: 'calcite',
  calciteRotDeg: 36,
  calciteTiltDeg: 45,
  calciteThicknessMm: 7.5,
  calciteAnalyzerOn: false,
  calciteAnalyzerDeg: 0,

  michelMaterialId: 'quartz',
  michelStageDeg: 45,
  michelThicknessUm: 45,
  michelGypsumOn: false,

  conoMaterialId: 'quartz',
  conoStageDeg: 0,
  conoTiltDeg: 0,
  conoThicknessMm: 1.8,
  conoGypsumOn: false,
  conoHandedness: 1,
};

const MICHEL_STRIP_RGB = michelLevyStrip(228, 1650);

let cachedConoKey = '';
let cachedConoBuf = null;
function getCachedConoscope(materialId, opts) {
  const key = `${materialId}|${Math.round(opts.stageDeg)}|${Math.round(opts.tiltDeg)}|${opts.thicknessMm.toFixed(2)}|${opts.gypsumPlate ? 1 : 0}|${opts.handedness || 1}`;
  if (key !== cachedConoKey || !cachedConoBuf) {
    cachedConoKey = key;
    cachedConoBuf = renderConoscopeBuffer(materialId, {
      size: 56,
      stageDeg: opts.stageDeg,
      tiltDeg: opts.tiltDeg,
      thicknessMm: opts.thicknessMm,
      gypsumPlate: opts.gypsumPlate,
      handedness: opts.handedness || 1,
    });
  }
  return cachedConoBuf;
}

// ============================================================================
// DOM REFERENCES
// ============================================================================
const el = {
  pixelCanvas: document.getElementById('pixelCanvas'),
  pixelStageCard: document.getElementById('pixelStageCard'),
  handheldScreenHost: document.getElementById('handheldScreenHost'),
  mobileFolderBar: document.getElementById('mobileFolderBar'),
  mobileBottomDock: document.getElementById('mobileBottomDock'),
  homeStageSlot: document.getElementById('homeStageSlot'),
  workbenchStageSlot: document.getElementById('workbenchStageSlot'),
  viewHome: document.getElementById('viewHome'),
  viewWorkbench: document.getElementById('viewWorkbench'),

  faceHudChip: document.getElementById('faceHudChip'),
  stampOverlay: document.getElementById('stampOverlay'),
  stampOverlayBox: document.getElementById('stampOverlayBox'),
  stageHintText: document.getElementById('stageHintText'),
  telemetryLeft: document.getElementById('telemetryLeft'),
  telemetryRight: document.getElementById('telemetryRight'),

  npcBox: document.getElementById('npcBox'),
  npcAvatar: document.getElementById('npcAvatar'),
  npcSpeaker: document.getElementById('npcSpeaker'),
  npcDialogue: document.getElementById('npcDialogue'),
  mobileCaseBriefBox: document.getElementById('mobileCaseBriefBox'),
  mobileNpcSpeaker: document.getElementById('mobileNpcSpeaker'),
  mobileNpcDialogue: document.getElementById('mobileNpcDialogue'),

  rankTitleText: document.getElementById('rankTitleText'),
  rankXpText: document.getElementById('rankXpText'),
  stampCountText: document.getElementById('stampCountText'),
  btnHandheldToggle: document.getElementById('btnHandheldToggle'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  btnBgmToggle: document.getElementById('btnBgmToggle'),
  btnAutoSpin: document.getElementById('btnAutoSpin'),
  btnQuickTwin: document.getElementById('btnQuickTwin'),
  btnQuickAxes: document.getElementById('btnQuickAxes'),

  panelDetective: document.getElementById('panelDetective'),
  panelCodex: document.getElementById('panelCodex'),
  panelForge: document.getElementById('panelForge'),
  panelOptics: document.getElementById('panelOptics'),

  caseListBar: document.getElementById('caseListBar'),
  detStationTabs: document.getElementById('detStationTabsMobileSwitch'),
  detStationBody: document.getElementById('detStationBody'),
  detClueCounter: document.getElementById('detClueCounter'),
  detEvidenceList: document.getElementById('detEvidenceList'),
  detStreakText: document.getElementById('detStreakText'),
  detSuspectGrid: document.getElementById('detSuspectGrid'),
  detDebriefBox: document.getElementById('detDebriefBox'),

  codexSearchInput: document.getElementById('codexSearchInput'),
  codexSystemBar: document.getElementById('codexSystemBar'),
  codexMineralGrid: document.getElementById('codexMineralGrid'),
  codexExplodeSlider: document.getElementById('codexExplodeSlider'),
  codexExplodeVal: document.getElementById('codexExplodeVal'),
  codexDossier: document.getElementById('codexDossier'),

  forgeStampsView: document.getElementById('forgeStampsView'),
  forgeBuildView: document.getElementById('forgeBuildView'),
  stamps12Grid: document.getElementById('stamps12Grid'),
  stampFormDetail: document.getElementById('stampFormDetail'),
  forgeBlueprintBar: document.getElementById('forgeBlueprintBar'),
  forgeQuestProgress: document.getElementById('forgeQuestProgress'),
  forgeMatchBox: document.getElementById('forgeMatchBox'),

  opticsBenchTabs: document.getElementById('opticsBenchTabs'),
  opticsControlsBody: document.getElementById('opticsControlsBody'),
  opticsReadoutBody: document.getElementById('opticsReadoutBody'),

  modalStamps: document.getElementById('modalStamps'),
  stampRankSummary: document.getElementById('stampRankSummary'),
  stampBookGrid: document.getElementById('stampBookGrid'),

  modalSuvaQr: document.getElementById('modalSuvaQr'),

  modalPostcard: document.getElementById('modalPostcard'),
  postcardPreviewImg: document.getElementById('postcardPreviewImg'),
  postcardDownloadLink: document.getElementById('postcardDownloadLink'),
};

const engine = new PixelEngine(el.pixelCanvas);

// ============================================================================
// INJECT 100% PURE PIXEL-ART SPRITES (ZERO SYSTEM EMOJIS)
// ============================================================================
function setHtmlById(id, html) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = html;
}

function injectStaticPixelIcons() {
  setHtmlById('dockIcoHome', DOCK_SPRITES.HOME(24));
  setHtmlById('dockIcoDet', DOCK_SPRITES.DETECTIVE(24));
  setHtmlById('dockIcoCodex', DOCK_SPRITES.CODEX(24));
  setHtmlById('dockIcoForge', DOCK_SPRITES.FORGE(24));
  setHtmlById('dockIcoOptics', DOCK_SPRITES.OPTICS(24));

  setHtmlById('icoTitleDet', DOCK_SPRITES.DETECTIVE(24));
  setHtmlById('icoTitleCodex', DOCK_SPRITES.CODEX(24));
  setHtmlById('icoTitleForge', DOCK_SPRITES.FORGE(24));
  setHtmlById('icoTitleOptics', DOCK_SPRITES.OPTICS(24));

  setHtmlById('icoMedal', PIXEL_ICONS.medal(14));
  setHtmlById('icoQr', PIXEL_ICONS.qr(14));
  setHtmlById('icoHandheld', PIXEL_ICONS.handheld(14));
  setHtmlById('icoTheme', PIXEL_ICONS.sun(14));
  setHtmlById('icoBgm', PIXEL_ICONS.music(14));
  setHtmlById('icoCamera', PIXEL_ICONS.camera(14));
  setHtmlById('icoV1', PIXEL_ICONS.v1Tag(14));

  setHtmlById('icoSpin', PIXEL_ICONS.spin(12));
  setHtmlById('icoReset', PIXEL_ICONS.reset(12));
  setHtmlById('icoTwin', PIXEL_ICONS.twin(12));
  setHtmlById('icoAxes', PIXEL_ICONS.axes(12));
  setHtmlById('icoHeroPlay', PIXEL_ICONS.play(12));
  setHtmlById('icoHeroSpark', PIXEL_ICONS.spark(12));
  setHtmlById('icoNotebook', PIXEL_ICONS.notebook(14));
  setHtmlById('icoGavel', PIXEL_ICONS.gavel(14));
  setHtmlById('icoModalMedal', PIXEL_ICONS.medal(20));
  setHtmlById('icoModalCam', PIXEL_ICONS.camera(20));

  if (el.npcAvatar) {
    el.npcAvatar.innerHTML = `<img src="${SUVA_CAT_DETECTIVE_SRC}" width="44" height="44" alt="SUVA 黑猫鉴定官" />`;
  }
}

// ============================================================================
// HANDHELD VS DESKTOP DUAL-MODE LAYOUT ENGINE
// ============================================================================
function isHandheldLayout() {
  return state.forceHandheld || window.innerWidth <= 860;
}

const MOBILE_FOLDER_DEFS = {
  HOME: [
    { id: 'home-launch', label: '卡带大厅' },
    { id: 'home-suva', label: '黑猫与开源群' },
  ],
  DETECTIVE: [
    { id: 'det-lab', label: '四站仪器' },
    { id: 'det-verdict', label: '盖章断案' },
    { id: 'det-case', label: '案卷线索' },
  ],
  CODEX: [
    { id: 'codex-list', label: '24矿物库' },
    { id: 'codex-ctrl', label: '双晶拆解' },
    { id: 'codex-doc', label: '光学档案' },
  ],
  FORGE: [
    { id: 'forge-cut', label: '四墨切削' },
    { id: 'forge-bp', label: '聚形蓝图' },
    { id: 'forge-stamps', label: '12单形票' },
  ],
  OPTICS: [
    { id: 'opt-dispersion', label: 'A.色散靶' },
    { id: 'opt-calcite', label: 'B.冰洲石' },
    { id: 'opt-michel', label: 'C.干涉色' },
    { id: 'opt-conoscope', label: 'D.锥光图' },
  ],
};

function syncStageAndHandheldLayout() {
  const handheld = isHandheldLayout();
  document.body.setAttribute('data-layout', handheld ? 'handheld' : 'desktop');
  el.btnHandheldToggle?.classList.toggle('is-on', state.forceHandheld);
  if (el.mobileCaseBriefBox) {
    el.mobileCaseBriefBox.hidden = !handheld;
  }

  // Dock the 480x270 software pixel stage into the active physical host
  if (handheld) {
    if (el.handheldScreenHost && el.pixelStageCard.parentElement !== el.handheldScreenHost) {
      el.handheldScreenHost.appendChild(el.pixelStageCard);
    }
    renderMobileFolderBar();
    applyMobileSubGroupVisibility();
  } else {
    document.querySelectorAll('[data-mgroup]').forEach((node) => {
      node.classList.remove('is-mhidden');
    });
    const targetSlot = state.view === 'HOME' ? el.homeStageSlot : el.workbenchStageSlot;
    if (targetSlot && el.pixelStageCard.parentElement !== targetSlot) {
      targetSlot.appendChild(el.pixelStageCard);
    }
  }

  // Highlight bottom 5-slot cartridge dock
  el.mobileBottomDock?.querySelectorAll('[data-dock-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.dockMode === state.view);
  });
}

function renderMobileFolderBar() {
  if (!el.mobileFolderBar) return;
  const defs = MOBILE_FOLDER_DEFS[state.view] || [];
  el.mobileFolderBar.style.setProperty('--folder-count', String(Math.max(1, defs.length)));
  const currentId = state.mobileSubGroup[state.view] || defs[0]?.id;

  el.mobileFolderBar.innerHTML = '';
  for (const item of defs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mobile-folder-tab${item.id === currentId ? ' is-active' : ''}`;
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      playClick();
      state.mobileSubGroup[state.view] = item.id;

      // Sync Forge / Optics internal sub-states when switching handheld folder tabs
      if (state.view === 'FORGE') {
        state.forgeSubTab = item.id === 'forge-stamps' ? 'stamps' : 'build';
        renderForgeUI();
      } else if (state.view === 'OPTICS') {
        state.opticsBench = item.id.replace('opt-', '');
        renderOpticsUI();
      }

      renderMobileFolderBar();
      applyMobileSubGroupVisibility();
    });
    el.mobileFolderBar.appendChild(btn);
  }
}

function applyMobileSubGroupVisibility() {
  if (!isHandheldLayout()) return;
  const activeGroup = state.mobileSubGroup[state.view];

  if (state.view === 'FORGE') {
    const wantStamps = activeGroup === 'forge-stamps';
    if ((state.forgeSubTab === 'stamps') !== wantStamps) {
      state.forgeSubTab = wantStamps ? 'stamps' : 'build';
      renderForgeUI();
    }
  }

  const rootContainer = state.view === 'HOME'
    ? el.viewHome
    : state.view === 'DETECTIVE'
      ? el.panelDetective
      : state.view === 'CODEX'
        ? el.panelCodex
        : state.view === 'FORGE'
          ? el.panelForge
          : el.panelOptics;

  if (!rootContainer) return;
  rootContainer.querySelectorAll('[data-mgroup]').forEach((node) => {
    const g = node.getAttribute('data-mgroup');
    if (state.view === 'OPTICS' && g === 'opt-active') {
      node.classList.remove('is-mhidden');
    } else {
      node.classList.toggle('is-mhidden', g !== activeGroup);
    }
  });
}

// ============================================================================
// PROGRESSION, ACHIEVEMENT STAMPS & TYPEWRITER DIALOGUE
// ============================================================================
let slamTimer = null;
function showStampSlam(text, isWrong = false) {
  if (!el.stampOverlay || !el.stampOverlayBox) return;
  el.stampOverlayBox.textContent = text;
  el.stampOverlayBox.classList.toggle('is-wrong', isWrong);
  el.stampOverlay.hidden = false;
  if (slamTimer) clearTimeout(slamTimer);
  slamTimer = setTimeout(() => {
    el.stampOverlay.hidden = true;
  }, 1650);
}

function updateProgressionBar() {
  const rank = computePlayerRank(save.xp);
  el.rankTitleText.textContent = rank.titleZh;
  el.rankXpText.textContent = `${save.xp} XP`;
  el.stampCountText.textContent = `${save.stamps.length}/${ACHIEVEMENT_STAMPS.length}`;
}

function awardXp(amount) {
  if (amount <= 0) return;
  save.xp += amount;
  persistSaveState(save);
  updateProgressionBar();
}

function unlockAchievementStamp(stampId) {
  if (save.stamps.includes(stampId)) return false;
  const meta = ACHIEVEMENT_STAMPS.find((s) => s.id === stampId);
  if (!meta) return false;
  save.stamps.push(stampId);
  save.xp += meta.xpBonus || 40;
  persistSaveState(save);
  updateProgressionBar();
  showStampSlam(`★ 解锁印章: ${meta.titleZh || meta.nameZh}`);
  return true;
}

let typewriterTimer = null;
function runTypewriter(speaker, fullText) {
  if (typewriterTimer) clearInterval(typewriterTimer);
  el.npcSpeaker.textContent = speaker;
  el.npcDialogue.textContent = '';
  if (el.mobileNpcSpeaker) el.mobileNpcSpeaker.textContent = speaker;
  if (el.mobileNpcDialogue) el.mobileNpcDialogue.textContent = fullText;

  let idx = 0;
  const chars = Array.from(String(fullText || ''));
  typewriterTimer = setInterval(() => {
    idx += 2;
    el.npcDialogue.textContent = chars.slice(0, idx).join('');
    playTypewriterTick(idx);
    if (idx >= chars.length) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
  }, 24);
}

// ============================================================================
// VIEW NAVIGATION & THEME SWITCHING
// ============================================================================
function setTheme(nextTheme) {
  state.theme = nextTheme === 'dark' ? 'dark' : 'riso';
  document.body.setAttribute('data-theme', state.theme);
  setHtmlById('icoTheme', state.theme === 'dark' ? PIXEL_ICONS.moon(14) : PIXEL_ICONS.sun(14));
  const lbl = document.getElementById('lblTheme');
  if (lbl) lbl.textContent = state.theme === 'dark' ? 'DARK' : 'RISO';
  el.btnThemeToggle?.classList.toggle('is-on', state.theme === 'dark');
}

function clearFaceSelection() {
  state.hoveredFaceId = -1;
  state.selectedFaceId = -1;
  state.secondFaceId = -1;
  el.faceHudChip.hidden = true;
}

function switchView(nextView) {
  state.view = nextView;
  clearFaceSelection();

  document.querySelectorAll('#modeNav .mode-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === nextView);
  });

  if (nextView === 'HOME') {
    el.viewHome.hidden = false;
    el.viewWorkbench.hidden = true;
    el.npcBox.hidden = true;
    el.stageHintText.textContent = '拖拽旋转 26 面终极聚形晶 · 点击晶面拾取 {hkl}';
    syncStageAndHandheldLayout();
    return;
  }

  el.viewHome.hidden = true;
  el.viewWorkbench.hidden = false;

  el.panelDetective.hidden = nextView !== 'DETECTIVE';
  el.panelCodex.hidden = nextView !== 'CODEX';
  el.panelForge.hidden = nextView !== 'FORGE';
  el.panelOptics.hidden = nextView !== 'OPTICS';
  el.npcBox.hidden = nextView !== 'DETECTIVE';

  if (nextView === 'DETECTIVE') {
    el.stageHintText.textContent = '拖拽旋转待检标本 · 点击两个晶面实测司特诺法线夹角 Δθ';
    renderDetectiveUI();
  } else if (nextView === 'CODEX') {
    el.stageHintText.textContent = '拖拽旋转矿物与双晶 · 点击晶面拾取 {hkl} 指数';
    renderCodexUI();
  } else if (nextView === 'FORGE') {
    el.stageHintText.textContent = '拖拽旋转聚形晶 · 点击晶面查看所属单形油墨';
    if (isHandheldLayout() && state.mobileSubGroup.FORGE !== 'forge-stamps') {
      state.forgeSubTab = 'build';
    }
    renderForgeUI();
  } else if (nextView === 'OPTICS') {
    el.stageHintText.textContent = '调节光学滑杆 · 实时观测斯涅尔色散与偏光干涉';
    state.mobileSubGroup.OPTICS = `opt-${state.opticsBench}`;
    renderOpticsUI();
  }

  syncStageAndHandheldLayout();
}

// ============================================================================
// 1. GEM DETECTIVE MODE CONTROLLER
// ============================================================================
function loadDetectiveCase(caseObj) {
  state.activeCase = caseObj;
  state.detStation = 1;
  state.detVariant = 'single';
  state.detRefRotDeg = 35;
  state.detTirAngleDeg = 28;
  state.detStageDeg = 45;
  state.detConoscopeMode = false;
  state.detGypsumOn = false;
  state.detDichroDeg = 20;
  state.detDunkProgress = 0;
  state.detVisitedStations = new Set([1]);
  state.detSolvedCurrent = false;
  clearFaceSelection();
  el.detDebriefBox.hidden = true;

  runTypewriter(
    `黑猫鉴定官 · ${caseObj.caseCode} · ${caseObj.clientZh}`,
    `${caseObj.briefZh} ${caseObj.storyIntro || ''}`
  );
  renderDetectiveUI();
}

function renderDetectiveUI() {
  el.caseListBar.innerHTML = '';
  DETECTIVE_CASES.forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isCurr = !state.activeCase.isEndless && state.activeCase.id === c.id;
    const isSolved = save.solvedCases.includes(c.id);
    btn.className = `pill-btn${isCurr ? ' is-active' : ''}${isSolved ? ' is-solved' : ''}`;
    btn.innerHTML = `${isSolved ? PIXEL_ICONS.check(10) : ''}CASE 0${idx + 1}`;
    btn.title = c.titleZh;
    btn.addEventListener('click', () => {
      playClick();
      loadDetectiveCase(c);
    });
    el.caseListBar.appendChild(btn);
  });

  if (state.activeCase.isEndless) {
    const tag = document.createElement('span');
    tag.className = 'pill-btn is-active';
    tag.textContent = state.activeCase.caseCode;
    el.caseListBar.appendChild(tag);
  }

  el.detStationTabs?.querySelectorAll('.subtab-btn').forEach((btn) => {
    const st = Number(btn.dataset.station);
    btn.classList.toggle('is-active', st === state.detStation);
  });

  renderDetectiveStationControls();
  renderDetectiveEvidence();
  renderDetectiveSuspects();
  applyMobileSubGroupVisibility();
}

function renderDetectiveStationControls() {
  const truthId = state.activeCase.truthMineralId;
  const truthMin = CODEX_MAP.get(truthId) || MINERAL_CODEX[0];
  const matId = truthMin.materialId || truthMin.id;
  const st = state.detStation;

  if (st === 1) {
    const mesh = buildMineralMesh(truthId, { variant: state.detVariant });
    const dih = mesh.dihedralSample;
    el.detStationBody.innerHTML = `
      <div class="slider-label">
        <span>[1] 晶形放大镜与司特诺测角台</span>
        <span class="slider-val">总晶面 ${mesh.totalFaces} 面</span>
      </div>
      <div class="pill-row">
        <button type="button" id="detBtnSingle" class="pill-btn ${state.detVariant === 'single' ? 'is-active' : ''}">单晶形态</button>
        <button type="button" id="detBtnTwin" class="pill-btn ${state.detVariant === 'twin' ? 'is-active' : ''}">双晶凹角检验</button>
        <button type="button" id="detBtnAxes" class="pill-btn ${state.showAxes ? 'is-active' : ''}">对称轴辅助线</button>
      </div>
      <div class="readout-grid">
        <div class="readout-cell">
          <span class="readout-k">典型晶面法线夹角</span>
          <span class="readout-v">${dih.pair} · ${dih.normalDeg}°</span>
        </div>
        <div class="readout-cell">
          <span class="readout-k">双晶凹角特征</span>
          <span class="readout-v">${state.detVariant === 'twin' && mesh.twinInfo ? mesh.twinInfo.reentrantLabel : '切至双晶档查看'}</span>
        </div>
      </div>
      <div style="font-size:12px;color:var(--ink-muted);">提示: 在像素视窗先后点击任意两晶面，实测法线夹角 Δθ。</div>
    `;
    document.getElementById('detBtnSingle')?.addEventListener('click', () => {
      playClick();
      state.detVariant = 'single';
      renderDetectiveStationControls();
    });
    document.getElementById('detBtnTwin')?.addEventListener('click', () => {
      playClick();
      state.detVariant = 'twin';
      if (truthId === 'spinel') unlockAchievementStamp('stamp_spinel_twin');
      renderDetectiveStationControls();
      renderDetectiveEvidence();
    });
    document.getElementById('detBtnAxes')?.addEventListener('click', () => {
      playClick();
      state.showAxes = !state.showAxes;
      el.btnQuickAxes.classList.toggle('is-active', state.showAxes);
      renderDetectiveStationControls();
    });
  } else if (st === 2) {
    const ref = refractometerShadow(matId, { rotationDeg: state.detRefRotDeg });
    const tir = snellBenchRay(matId, state.detTirAngleDeg, true);
    el.detStationBody.innerHTML = `
      <div class="slider-row">
        <div class="slider-label">
          <span>阿贝折光仪旋转角 (589.3nm)</span>
          <span class="slider-val" id="detRefAngleTxt">${state.detRefRotDeg}°</span>
        </div>
        <input type="range" id="detRefSlider" min="0" max="180" value="${state.detRefRotDeg}" />
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>晶内激光全反射角 θ1</span>
          <span class="slider-val" id="detTirAngleTxt">${state.detTirAngleDeg}° (θc=${tir.criticalDeg.toFixed(1)}°)</span>
        </div>
        <input type="range" id="detTirSlider" min="10" max="65" value="${state.detTirAngleDeg}" />
      </div>
      <div class="readout-grid">
        <div class="readout-cell">
          <span class="readout-k">折光仪阴影界读数</span>
          <span class="readout-v" id="detRefReadout">${ref.isOpaqueMetallic ? `金属不透明全反光 (R≈${ref.reflectancePct}%)` : ref.overLimit ? 'OTL 超量程 (>1.79!)' : `${ref.nLow.toFixed(3)} - ${ref.nHigh.toFixed(3)}`}</span>
        </div>
        <div class="readout-cell">
          <span class="readout-k">实测双折射跳动 Δn</span>
          <span class="readout-v" id="detBirefReadout">${ref.isOpaqueMetallic ? '透射光不适用 (反光均质)' : ref.overLimit ? '结合偏光台判定' : `${ref.deltaN.toFixed(3)} (${ref.isDoublyRefractive ? '双折' : '单折'})`}</span>
        </div>
      </div>
    `;
    document.getElementById('detRefSlider')?.addEventListener('input', (e) => {
      state.detRefRotDeg = Number(e.target.value);
      const r2 = refractometerShadow(matId, { rotationDeg: state.detRefRotDeg });
      document.getElementById('detRefAngleTxt').textContent = `${state.detRefRotDeg}°`;
      document.getElementById('detRefReadout').textContent = r2.isOpaqueMetallic ? `金属不透明全反光 (R≈${r2.reflectancePct}%)` : r2.overLimit ? 'OTL 超量程 (>1.79!)' : `${r2.nLow.toFixed(3)} - ${r2.nHigh.toFixed(3)}`;
      document.getElementById('detBirefReadout').textContent = r2.isOpaqueMetallic ? '透射光不适用 (反光均质)' : r2.overLimit ? '结合偏光台判定' : `${r2.deltaN.toFixed(3)} (${r2.isDoublyRefractive ? '双折' : '单折'})`;
    });
    document.getElementById('detTirSlider')?.addEventListener('input', (e) => {
      state.detTirAngleDeg = Number(e.target.value);
      const t2 = snellBenchRay(matId, state.detTirAngleDeg, true);
      document.getElementById('detTirAngleTxt').textContent = `${state.detTirAngleDeg}° (${t2.tir ? '全反射 TIR!' : '透射漏光'})`;
      playLaserSweep(state.detTirAngleDeg / 65);
      if (t2.tir) unlockAchievementStamp('stamp_first_refraction');
    });
  } else if (st === 3) {
    const ax = opticAxisInfo(matId);
    const ortho = orthoscopicRetardation(matId, {
      stageDeg: state.detStageDeg,
      thicknessUm: 40,
      gypsumPlate: state.detGypsumOn,
    });
    el.detStationBody.innerHTML = `
      <div class="pill-row">
        <button type="button" id="detBtnOrtho" class="pill-btn ${!state.detConoscopeMode ? 'is-active' : ''}">正交偏光镜</button>
        <button type="button" id="detBtnCono" class="pill-btn ${state.detConoscopeMode ? 'is-active' : ''}">锥光牛眼镜</button>
        <button type="button" id="detBtnGypsum" class="pill-btn ${state.detGypsumOn ? 'is-active' : ''}">+530nm 石膏板</button>
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>载物台旋转角 θ (0°-360°)</span>
          <span class="slider-val" id="detStageVal">${state.detStageDeg}°</span>
        </div>
        <input type="range" id="detStageSlider" min="0" max="360" value="${state.detStageDeg}" />
      </div>
      <div class="readout-grid">
        <div class="readout-cell">
          <span class="readout-k">正交消光与干涉现象</span>
          <span class="readout-v" id="detOrthoReadout">${ax.isOpaqueMetallic ? '金属不透明阻光' : ax.className === 'isotropic' ? '360°全暗 (均质体)' : `四明四暗 · ${ortho.orderLabel}`}</span>
        </div>
        <div class="readout-cell">
          <span class="readout-k">锥光光性与 2V 角</span>
          <span class="readout-v">${ax.signLabelZh}${ax.twoVDeg > 0 ? ` · 2V≈${Math.round(ax.twoVDeg)}°` : ''}${truthMin.opticalActivity ? ' · 旋光牛眼!' : ''}</span>
        </div>
      </div>
    `;
    document.getElementById('detBtnOrtho')?.addEventListener('click', () => {
      playClick();
      state.detConoscopeMode = false;
      renderDetectiveStationControls();
    });
    document.getElementById('detBtnCono')?.addEventListener('click', () => {
      playClick();
      state.detConoscopeMode = true;
      if (truthMin.opticalActivity) unlockAchievementStamp('stamp_quartz_bullseye');
      renderDetectiveStationControls();
    });
    document.getElementById('detBtnGypsum')?.addEventListener('click', () => {
      playClick();
      state.detGypsumOn = !state.detGypsumOn;
      if (state.detGypsumOn) unlockAchievementStamp('stamp_gypsum_sign');
      renderDetectiveStationControls();
    });
    document.getElementById('detStageSlider')?.addEventListener('input', (e) => {
      state.detStageDeg = Number(e.target.value);
      document.getElementById('detStageVal').textContent = `${state.detStageDeg}°`;
      const o2 = orthoscopicRetardation(matId, {
        stageDeg: state.detStageDeg,
        thicknessUm: 40,
        gypsumPlate: state.detGypsumOn,
      });
      const rNode = document.getElementById('detOrthoReadout');
      if (rNode) {
        rNode.textContent = ax.isOpaqueMetallic ? '金属不透明阻光' : ax.className === 'isotropic' ? '360°全暗 (均质体)' : `I=${Math.round(o2.transmission * 100)}% · ${o2.orderLabel}`;
      }
    });
  } else {
    const dic = dichroscopeColors(matId, { barrelDeg: state.detDichroDeg });
    const sg = hydrostaticSG(matId, { carat: 5.0 });
    el.detStationBody.innerHTML = `
      <div class="slider-row">
        <div class="slider-label">
          <span>方解石二色镜旋转 (0°-90°)</span>
          <span class="slider-val" id="detDicVal">${state.detDichroDeg}° · ${dic.labelZh}</span>
        </div>
        <input type="range" id="detDicSlider" min="0" max="90" value="${state.detDichroDeg}" />
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>静水天平浸水深度</span>
          <span class="slider-val" id="detDunkVal">${Math.round(state.detDunkProgress * 100)}%</span>
        </div>
        <input type="range" id="detDunkSlider" min="0" max="100" value="${Math.round(state.detDunkProgress * 100)}" />
      </div>
      <div class="readout-grid">
        <div class="readout-cell">
          <span class="readout-k">空气重 / 水中视重</span>
          <span class="readout-v">5.00 ct / ${(sg.massWaterG * 5).toFixed(2)} ct</span>
        </div>
        <div class="readout-cell">
          <span class="readout-k">阿基米德静水比重 SG</span>
          <span class="readout-v" id="detSgVal">${state.detDunkProgress > 0.8 ? `SG = ${sg.sg.toFixed(2)}` : '浸水 >85% 锁定读数'}</span>
        </div>
      </div>
    `;
    document.getElementById('detDicSlider')?.addEventListener('input', (e) => {
      state.detDichroDeg = Number(e.target.value);
      const d2 = dichroscopeColors(matId, { barrelDeg: state.detDichroDeg });
      document.getElementById('detDicVal').textContent = `${state.detDichroDeg}° · ${d2.labelZh}`;
    });
    document.getElementById('detDunkSlider')?.addEventListener('input', (e) => {
      state.detDunkProgress = Number(e.target.value) / 100;
      document.getElementById('detDunkVal').textContent = `${Math.round(state.detDunkProgress * 100)}%`;
      document.getElementById('detSgVal').textContent = state.detDunkProgress > 0.8
        ? `SG = ${sg.sg.toFixed(2)} (已锁定)`
        : '浸水 >85% 锁定读数';
      renderDetectiveEvidence();
    });
  }
}

function renderDetectiveEvidence() {
  const truthId = state.activeCase.truthMineralId;
  const truthMin = CODEX_MAP.get(truthId) || MINERAL_CODEX[0];
  const matId = truthMin.materialId || truthMin.id;
  const visited = state.detVisitedStations;
  el.detClueCounter.textContent = `已检 ${visited.size}/4 站`;

  const lines = [];
  if (visited.has(1)) {
    const m = buildMineralMesh(truthId, { variant: 'single' });
    lines.push(`* [晶形台] 单晶共 ${m.totalFaces} 晶面, 夹角 ${m.dihedralSample.pair} = ${m.dihedralSample.normalDeg}°`);
  }
  if (visited.has(2)) {
    const ref = refractometerShadow(matId);
    lines.push(`* [折光仪] ${ref.isOpaqueMetallic ? `金属不透明反光 (R≈${ref.reflectancePct}%)` : ref.overLimit ? 'RI 超出 1.79 上限 (OTL)!' : `RI=${ref.nLow.toFixed(3)}-${ref.nHigh.toFixed(3)}, Δn=${ref.deltaN.toFixed(3)}`}`);
  }
  if (visited.has(3)) {
    const ax = opticAxisInfo(matId);
    lines.push(`* [偏光镜] ${ax.signLabelZh}${truthMin.opticalActivity ? ' (具旋光牛眼干涉心)' : ''}`);
  }
  if (visited.has(4)) {
    const dic = dichroscopeColors(matId, { barrelDeg: 0 });
    const sg = hydrostaticSG(matId);
    lines.push(`* [二色/比重] ${dic.labelZh}${state.detDunkProgress > 0.8 ? ` · SG=${sg.sg.toFixed(2)}` : ' · 浸水可测比重'}`);
  }
  el.detEvidenceList.innerHTML = lines.join('<br/>');
}

function renderDetectiveSuspects() {
  el.detStreakText.textContent = `连胜 ${save.streak}`;
  el.detSuspectGrid.innerHTML = '';

  for (const suspId of state.activeCase.suspectIds) {
    const min = CODEX_MAP.get(suspId);
    if (!min) continue;
    const card = document.createElement('div');
    card.className = 'suspect-card';
    card.innerHTML = `
      <div>
        <h4>${min.nameZh} <span style="opacity:0.75;">${min.nameEn}</span></h4>
        <div class="suspect-specs">
          ${min.systemZh} · ${min.opticSignZh}<br/>
          RI ${min.riText} | Δn ${Number(min.birefringence).toFixed(3)} | SG ${min.sg}
        </div>
      </div>
      <button type="button" class="verdict-btn">${PIXEL_ICONS.gavel(12)}认定【${min.nameZh.split('（')[0]}】</button>
    `;
    card.querySelector('.verdict-btn').addEventListener('click', () => submitDetectiveVerdict(suspId));
    el.detSuspectGrid.appendChild(card);
  }
}

function submitDetectiveVerdict(chosenId) {
  const c = state.activeCase;
  const chosenMin = CODEX_MAP.get(chosenId);
  const truthMin = CODEX_MAP.get(c.truthMineralId);

  if (chosenId === c.truthMineralId) {
    playStampSlam();
    showStampSlam(`★ 鉴定准确: ${truthMin.nameZh.split('（')[0]}!`);

    if (!state.detSolvedCurrent) {
      state.detSolvedCurrent = true;
      save.streak += 1;
      if (!c.isEndless && !save.solvedCases.includes(c.id)) {
        save.solvedCases.push(c.id);
      }
      awardXp(c.xpReward || 120);
      unlockAchievementStamp('stamp_detective_ace');
      persistSaveState(save);
    }

    el.detStreakText.textContent = `连胜 ${save.streak}`;
    el.detDebriefBox.hidden = false;
    el.detDebriefBox.innerHTML = `
      <h4>[结案报告] 真身锁定: ${truthMin.nameZh} (${truthMin.formula})</h4>
      <p><span style="color:var(--riso-cyan);">排他铁证: </span>${c.decisiveClueZh}</p>
      <p>${c.debriefZh}</p>
      <div class="pill-row">
        <button type="button" id="btnNextCase" class="cta-primary" style="padding:6px 12px;">${PIXEL_ICONS.play(12)}下一桩委托</button>
        <button type="button" id="btnCasePostcard" class="pill-btn" style="background:var(--riso-pink);color:#FAF7F0;">${PIXEL_ICONS.camera(12)}结案纪念卡</button>
      </div>
    `;
    document.getElementById('btnNextCase')?.addEventListener('click', () => {
      playClick();
      if (c.isEndless) {
        save.endlessSeed += 1;
        persistSaveState(save);
        loadDetectiveCase(generateEndlessCase(save.endlessSeed));
      } else {
        const idx = DETECTIVE_CASES.findIndex((item) => item.id === c.id);
        const next = idx >= 0 && idx + 1 < DETECTIVE_CASES.length
          ? DETECTIVE_CASES[idx + 1]
          : generateEndlessCase(save.endlessSeed++);
        loadDetectiveCase(next);
      }
    });
    document.getElementById('btnCasePostcard')?.addEventListener('click', () => triggerPostcardExport());
    renderDetectiveUI();
  } else {
    playWrongBuzz();
    save.streak = 0;
    persistSaveState(save);
    el.detStreakText.textContent = '连胜 0';
    showStampSlam(`X 误判: 并非${chosenMin?.nameZh.split('（')[0] || ''}`, true);
    el.detDebriefBox.hidden = false;
    el.detDebriefBox.innerHTML = `
      <h4 style="color:var(--riso-amber);">[复核驳回] 标本与【${chosenMin?.nameZh}】常数不符!</h4>
      <p>提示: 请核对 [2] 折光仪 RI / OTL、[3] 正交消光 vs 锥光光性 以及 [4] 静水比重 SG 后重新盖章。</p>
    `;
  }
}

// ============================================================================
// 2. 24 MINERAL & TWIN CODEX CONTROLLER
// ============================================================================
function renderCodexUI() {
  el.codexSystemBar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `pill-btn ${state.codexSystemFilter === 'all' ? 'is-active' : ''}`;
  allBtn.textContent = '全部(24)';
  allBtn.addEventListener('click', () => {
    playClick();
    state.codexSystemFilter = 'all';
    renderCodexUI();
  });
  el.codexSystemBar.appendChild(allBtn);

  for (const sys of CRYSTAL_SYSTEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pill-btn ${state.codexSystemFilter === sys.id ? 'is-active' : ''}`;
    btn.textContent = sys.nameZh.replace('晶系', '');
    btn.addEventListener('click', () => {
      playClick();
      state.codexSystemFilter = sys.id;
      renderCodexUI();
    });
    el.codexSystemBar.appendChild(btn);
  }

  const q = state.codexSearch.trim().toLowerCase();
  const filtered = MINERAL_CODEX.filter((m) => {
    if (state.codexSystemFilter !== 'all' && m.systemId !== state.codexSystemFilter) return false;
    if (!q) return true;
    const hay = `${m.nameZh} ${m.nameEn} ${m.formula} ${m.twinLawZh} ${m.systemZh}`.toLowerCase();
    return hay.includes(q);
  });

  el.codexMineralGrid.innerHTML = '';
  for (const m of filtered) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `mineral-chip ${m.id === state.codexMineralId ? 'is-active' : ''}`;
    chip.innerHTML = `
      <span>${m.codexNo} · ${m.nameZh.split('（')[0]}</span>
      <small>${m.systemZh} · ${m.formula}</small>
    `;
    chip.addEventListener('click', () => {
      playClick();
      state.codexMineralId = m.id;
      clearFaceSelection();
      renderCodexUI();
    });
    el.codexMineralGrid.appendChild(chip);
  }

  const curMin = CODEX_MAP.get(state.codexMineralId) || MINERAL_CODEX[0];
  const curMesh = buildMineralMesh(curMin.id, { variant: state.codexVariant });
  const btnTwin = document.getElementById('btnCodexTwin');
  const btnAxes = document.getElementById('btnCodexAxes');
  if (btnTwin) {
    const cat = curMesh.twinMeta?.category;
    const isRare = Boolean(curMesh.twinMeta?.isRareOrGrowth);
    btnTwin.textContent = cat === 'growth_sector'
      ? '扇区连生 TRAPICHE'
      : isRare
        ? '罕见双晶对照 RARE'
        : cat === 'cyclic'
          ? '轮式三连晶 TRILLING'
          : cat === 'polysynthetic'
            ? '聚片双晶 LAMELLAE'
            : cat === 'penetration'
              ? '穿插双晶 TWIN'
              : '接触双晶 TWIN';
  }
  if (btnAxes) {
    btnAxes.textContent = `对称要素: ${curMesh.symmetrySummaryZh || curMesh.pointGroup}`;
  }

  document.getElementById('btnCodexSingle')?.classList.toggle('is-active', state.codexVariant === 'single');
  btnTwin?.classList.toggle('is-active', state.codexVariant === 'twin');
  btnAxes?.classList.toggle('is-active', state.showAxes);
  document.getElementById('btnCodexConstancy')?.classList.toggle('is-active', state.codexConstancyCard);

  renderCodexDossier();
  applyMobileSubGroupVisibility();
}

function fmtBarHtml(str) {
  return String(str || '').replace(/([12346])\u0304/g, '<span style="text-decoration:overline;">$1</span>');
}

function renderCodexDossier() {
  const m = CODEX_MAP.get(state.codexMineralId) || MINERAL_CODEX[0];
  const mesh = buildMineralMesh(m.id, { variant: state.codexVariant, explode: state.codexExplode });
  const sys = CRYSTAL_SYSTEMS.find((s) => s.id === m.systemId);
  const birefText = m.opaqueMetallic
    ? '不透明金属反光'
    : `Δn ${Number(m.birefringence).toFixed(3)}`;

  el.codexDossier.innerHTML = `
    <div class="monologue-quote">${fmtBarHtml(m.rpgQuote)}</div>
    <div class="readout-grid" style="margin-top:6px;">
      <div class="readout-cell">
        <span class="readout-k">${m.codexNo} · 矿物与化学式</span>
        <span class="readout-v">${m.nameZh} (${m.formula})</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">晶系与点群对称要素</span>
        <span class="readout-v">${m.systemZh} · ${fmtBarHtml(m.pointGroup)} (${mesh.symmetrySummaryZh || ''})</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">${m.opaqueMetallic ? '金属反射率 R (589nm)' : '折射率 RI & 双折射 Δn'}</span>
        <span class="readout-v">${m.opaqueMetallic ? m.riText : `RI ${m.riText}`} | ${birefText}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">光性 / 硬度 / 比重</span>
        <span class="readout-v">${m.opticSignZh} · H=${m.mohs} · SG=${m.sg}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">${state.codexVariant === 'twin' ? `双晶组合 (${mesh.totalFaces} 面)` : `单形晶习 (${mesh.totalFaces} 面)`}</span>
        <span class="readout-v">${fmtBarHtml(m.habitZh)}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">${mesh.twinMeta?.category === 'growth_sector' ? '扇区生长机制' : mesh.twinMeta?.isRareOrGrowth ? '罕见双晶律与实算夹角' : '双晶律与凹入角'}</span>
        <span class="readout-v">${fmtBarHtml(m.twinLawZh)}</span>
      </div>
    </div>
    <div class="control-box" style="margin-top:6px;font-size:12px;">
      <div>[鉴定要诀] ${fmtBarHtml(m.diagnosticTip)}</div>
      ${sys ? `<div style="color:var(--ink-muted);">轴率: ${sys.axialRule} · 点群对称: ${mesh.symmetrySummaryZh || sys.symmetryTag}</div>` : ''}
    </div>
  `;
}

// ============================================================================
// 3. 12 SIMPLE FORMS ATLAS & WULFF HABIT FORGE CONTROLLER
// ============================================================================
let stamps12Rendered = false;
function renderForgeUI() {
  const isStamps = state.forgeSubTab === 'stamps';
  document.getElementById('btnForgeTabStamps')?.classList.toggle('is-active', isStamps);
  document.getElementById('btnForgeTabBuild')?.classList.toggle('is-active', !isStamps);
  el.forgeStampsView.hidden = !isStamps;
  el.forgeBuildView.hidden = isStamps;

  if (isStamps) {
    if (!stamps12Rendered) {
      stamps12Rendered = true;
      el.stamps12Grid.innerHTML = '';
      SIMPLE_FORMS_12.forEach((f, idx) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'form-stamp-card';
        card.dataset.formId = f.id;
        card.innerHTML = `
          <div class="form-stamp-meta">
            <span>#${f.stampNo}</span>
            <span>${f.miller}</span>
          </div>
          <canvas width="112" height="76"></canvas>
          <div class="form-stamp-name">${f.nameZh}</div>
        `;
        const cnv = card.querySelector('canvas');
        const mesh = buildSimpleFormMesh(f.id);
        const darkStamp = idx % 2 === 1;
        renderMiniStampCanvas(cnv, mesh, {
          dark: darkStamp,
          bgHex: idx === 3 || idx === 6 || idx === 11 ? '#1F38FF' : (darkStamp ? '#111118' : '#FAF7F0'),
          rotX: 0.40,
          rotY: 0.65,
        });

        card.addEventListener('click', () => {
          playClick();
          state.selectedSimpleFormId = f.id;
          if (!save.inspectedForms.includes(f.id)) {
            save.inspectedForms.push(f.id);
            persistSaveState(save);
            if (save.inspectedForms.length >= 6) {
              unlockAchievementStamp('stamp_forms_collector');
            }
          }
          updateStamps12Selection();
        });
        el.stamps12Grid.appendChild(card);
      });
    }
    updateStamps12Selection();
    return;
  }

  // Sub-tab B: Wulff Truncation Forge with 4 Riso Pixel Gem Icons
  el.forgeQuestProgress.textContent = `${save.forgedBlueprints.length}/${FORGE_CHALLENGES.length} 已锻造`;
  el.forgeBlueprintBar.innerHTML = '';
  for (const bp of FORGE_CHALLENGES) {
    const solved = save.forgedBlueprints.includes(bp.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pill-btn ${bp.id === state.activeBlueprintId ? 'is-active' : ''} ${solved ? 'is-solved' : ''}`;
    btn.innerHTML = `${solved ? PIXEL_ICONS.check(10) : ''}${bp.titleZh.replace(/^蓝图\s*\d+\s*·\s*/, '')}`;
    btn.addEventListener('click', () => {
      playClick();
      state.activeBlueprintId = bp.id;
      state.forgeMode = bp.mode;
      renderForgeUI();
    });
    el.forgeBlueprintBar.appendChild(btn);
  }

  document.querySelectorAll('#forgeModeBar [data-forge-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.forgeMode === state.forgeMode);
  });

  const lblMap = state.forgeMode === 'tetragonal'
    ? [
      `${PIXEL_ICONS.gemPink100(16)} 粉红墨 · 四方柱 {100}`,
      `${PIXEL_ICONS.gemBlue111(16)} 钴蓝墨 · 四方双锥 {111}`,
      `${PIXEL_ICONS.gemLime110(16)} 黄绿墨 · 次四方柱 {110}`,
      `${PIXEL_ICONS.gemCoral211(16)} 珊瑚墨 · 平行双面 {001}`,
    ]
    : state.forgeMode === 'hexagonal'
      ? [
        `${PIXEL_ICONS.gemPink100(16)} 粉红墨 · 六方柱 {10-10}`,
        `${PIXEL_ICONS.gemBlue111(16)} 钴蓝墨 · 六方双锥 {10-11}`,
        `${PIXEL_ICONS.gemLime110(16)} 黄绿墨 · 平行双面 {0001}`,
        `${PIXEL_ICONS.gemCoral211(16)} 珊瑚墨 · 第二六方柱 {11-20}`,
      ]
      : [
        `${PIXEL_ICONS.gemPink100(16)} 粉红墨 · 立方体 {100}`,
        `${PIXEL_ICONS.gemBlue111(16)} 钴蓝墨 · 八面体 {111}`,
        `${PIXEL_ICONS.gemLime110(16)} 黄绿墨 · 十二面体 {110}`,
        `${PIXEL_ICONS.gemCoral211(16)} 珊瑚墨 · 三八面体 {211}`,
      ];

  setHtmlById('lblD100', lblMap[0]);
  setHtmlById('lblD111', lblMap[1]);
  setHtmlById('lblD110', lblMap[2]);
  setHtmlById('lblD211', lblMap[3]);

  document.getElementById('sliderD100').value = String(Math.round(state.d100 * 100));
  document.getElementById('sliderD111').value = String(Math.round(state.d111 * 100));
  document.getElementById('sliderD110').value = String(Math.round(state.d110 * 100));
  document.getElementById('sliderD211').value = String(Math.round(state.d211 * 100));

  updateForgeMatchMeter();
  applyMobileSubGroupVisibility();
}

function updateStamps12Selection() {
  el.stamps12Grid.querySelectorAll('.form-stamp-card').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.formId === state.selectedSimpleFormId);
  });
  const form = SIMPLE_FORMS_12.find((f) => f.id === state.selectedSimpleFormId) || SIMPLE_FORMS_12[0];
  el.stampFormDetail.innerHTML = `
    <div class="slider-label">
      <span>邮票 #${form.stampNo} · ${form.nameZh} (${form.miller})</span>
      <span class="slider-val">${form.systemZh} · ${form.meshFaces}面</span>
    </div>
    <div style="font-size:12px;color:var(--ink-sub);">${form.noteZh}</div>
    <div style="font-size:12px;color:var(--ink-muted);">代表矿物: ${form.representativeZh}</div>
  `;
}

function updateForgeMatchMeter() {
  document.getElementById('valD100').textContent = state.d100.toFixed(2);
  document.getElementById('valD111').textContent = state.d111.toFixed(2);
  document.getElementById('valD110').textContent = state.d110.toFixed(2);
  document.getElementById('valD211').textContent = state.d211.toFixed(2);

  const built = buildForgeCombination({
    d100: state.d100,
    d111: state.d111,
    d110: state.d110,
    d211: state.d211,
    mode: state.forgeMode,
  });

  if (
    state.forgeMode === 'cubic'
    && built.byForm['{100}'] === 6
    && built.byForm['{111}'] === 8
    && built.byForm['{110}'] === 12
    && built.totalFaces === 26
  ) {
    unlockAchievementStamp('stamp_forge_26');
  }
  if (built.totalFaces >= 36) {
    unlockAchievementStamp('stamp_forge_50');
  }

  const bp = FORGE_CHALLENGES.find((c) => c.id === state.activeBlueprintId) || FORGE_CHALLENGES[0];
  let matchedForms = 0;
  for (const k of ['{100}', '{111}', '{110}', '{211}']) {
    if ((built.byForm[k] || 0) === (bp.expectedByForm[k] || 0)) matchedForms += 1;
  }
  const exactMatch = state.forgeMode === bp.mode && matchedForms === 4 && built.totalFaces === bp.totalFaces;
  const pct = state.forgeMode !== bp.mode ? 15 : Math.round((matchedForms / 4) * 100);

  if (exactMatch && !save.forgedBlueprints.includes(bp.id)) {
    save.forgedBlueprints.push(bp.id);
    awardXp(bp.xpReward || 100);
    persistSaveState(save);
    playForgeSuccess();
    showStampSlam(`★ 蓝图达成: ${bp.totalFaces}面聚形!`);
    if (save.forgedBlueprints.length >= 3) {
      unlockAchievementStamp('stamp_forge_50');
    }
    el.forgeQuestProgress.textContent = `${save.forgedBlueprints.length}/${FORGE_CHALLENGES.length} 已锻造`;
  }

  el.forgeMatchBox.innerHTML = `
    <div class="slider-label">
      <span style="color:var(--riso-lime);">${bp.titleZh}</span>
      <span style="color:var(--riso-cyan);">${built.totalFaces} / ${bp.totalFaces} 面</span>
    </div>
    <div class="meter-bar-track">
      <div class="meter-bar-fill" style="width:${pct}%;"></div>
    </div>
    <div style="font-size:12px;">当前聚形: <span style="color:var(--riso-lime);">${built.formulaTag}</span> ${exactMatch ? '[已完美契合蓝图!]' : ''}</div>
    <div style="font-size:12px;color:#B5BDDD;">提示: ${bp.hintZh}</div>
  `;
}

// ============================================================================
// 4. PRISMA OPTICS DARKROOM BENCH (100% PIXEL MATERIAL PILLS, NO <SELECT>)
// ============================================================================
function buildMaterialPillsHtml(groupAttr, currentId, listIds) {
  const btns = listIds.map((id) => {
    const mat = getMaterial(id);
    const shortZh = mat.nameZh.split('（')[0].replace('重火石棱镜玻璃', '火石棱镜');
    return `<button type="button" class="pill-btn ${id === currentId ? 'is-active' : ''}" data-${groupAttr}="${id}">${shortZh}</button>`;
  }).join('');
  return `<div class="pill-row">${btns}</div>`;
}

function wireMaterialPills(groupAttr, onPick) {
  el.opticsControlsBody.querySelectorAll(`[data-${groupAttr}]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      playClick();
      onPick(btn.getAttribute(`data-${groupAttr}`));
    });
  });
}

function renderOpticsUI() {
  el.opticsBenchTabs?.querySelectorAll('.subtab-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.bench === state.opticsBench);
  });

  const b = state.opticsBench;

  if (b === 'dispersion') {
    const matList = ['flint_prism', 'diamond', 'rutile', 'zircon', 'ruby', 'quartz', 'calcite', 'fluorite'];
    el.opticsControlsBody.innerHTML = `
      <div class="pill-row">
        <button type="button" id="optBtnPrism" class="pill-btn ${state.dispSubMode === 'prism' ? 'is-active' : ''}">60°色散棱镜光谱靶</button>
        <button type="button" id="optBtnTir" class="pill-btn ${state.dispSubMode === 'tir' ? 'is-active' : ''}">晶内全反射临界角 θc</button>
      </div>
      <div class="slider-row">
        <div class="slider-label"><span>光学介质卡带</span><span class="slider-val">连击 ${state.dispComboScore} PTS</span></div>
        ${buildMaterialPillsHtml('disp-mat', state.dispMaterialId, matList)}
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>激光入射角 θ1</span>
          <span class="slider-val" id="optIncVal">${state.dispIncidentDeg}°</span>
        </div>
        <input type="range" id="optIncSlider" min="12" max="78" value="${state.dispIncidentDeg}" />
      </div>
      ${state.dispSubMode === 'prism' ? `
      <div class="slider-row">
        <div class="slider-label">
          <span>棱镜顶角 α</span>
          <span class="slider-val" id="optApexVal">${state.dispApexDeg}°</span>
        </div>
        <input type="range" id="optApexSlider" min="30" max="72" value="${state.dispApexDeg}" />
      </div>` : ''}
    `;

    document.getElementById('optBtnPrism')?.addEventListener('click', () => {
      playClick();
      state.dispSubMode = 'prism';
      renderOpticsUI();
    });
    document.getElementById('optBtnTir')?.addEventListener('click', () => {
      playClick();
      state.dispSubMode = 'tir';
      renderOpticsUI();
    });
    wireMaterialPills('disp-mat', (picked) => {
      state.dispMaterialId = picked;
      renderOpticsUI();
    });
    document.getElementById('optIncSlider')?.addEventListener('input', (e) => {
      state.dispIncidentDeg = Number(e.target.value);
      document.getElementById('optIncVal').textContent = `${state.dispIncidentDeg}°`;
      playLaserSweep(state.dispIncidentDeg / 78);
      updateOpticsReadouts();
    });
    document.getElementById('optApexSlider')?.addEventListener('input', (e) => {
      state.dispApexDeg = Number(e.target.value);
      document.getElementById('optApexVal').textContent = `${state.dispApexDeg}°`;
      updateOpticsReadouts();
    });
  } else if (b === 'calcite') {
    const matList = ['calcite', 'rutile', 'zircon', 'tourmaline', 'quartz', 'ruby', 'spinel', 'diamond'];
    el.opticsControlsBody.innerHTML = `
      <div class="slider-row">
        <div class="slider-label"><span>双折射晶片选择</span></div>
        ${buildMaterialPillsHtml('cal-mat', state.calciteMaterialId, matList)}
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>解理菱面体方位角 θ</span>
          <span class="slider-val" id="optCalRotVal">${state.calciteRotDeg}°</span>
        </div>
        <input type="range" id="optCalRotSlider" min="0" max="360" value="${state.calciteRotDeg}" />
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>晶体板厚 d (mm)</span>
          <span class="slider-val" id="optCalThickVal">${state.calciteThicknessMm.toFixed(1)} mm</span>
        </div>
        <input type="range" id="optCalThickSlider" min="10" max="200" value="${Math.round(state.calciteThicknessMm * 10)}" />
      </div>
      <div class="pill-row">
        <button type="button" id="optCalAnaBtn" class="pill-btn ${state.calciteAnalyzerOn ? 'is-active' : ''}">插入偏振检偏镜 (o/e 正交消光)</button>
      </div>
      ${state.calciteAnalyzerOn ? `
      <div class="slider-row">
        <div class="slider-label">
          <span>检偏镜偏振轴角</span>
          <span class="slider-val" id="optCalAnaVal">${state.calciteAnalyzerDeg}°</span>
        </div>
        <input type="range" id="optCalAnaSlider" min="0" max="180" value="${state.calciteAnalyzerDeg}" />
      </div>` : ''}
    `;
    wireMaterialPills('cal-mat', (picked) => {
      state.calciteMaterialId = picked;
      renderOpticsUI();
    });
    document.getElementById('optCalRotSlider')?.addEventListener('input', (e) => {
      state.calciteRotDeg = Number(e.target.value);
      document.getElementById('optCalRotVal').textContent = `${state.calciteRotDeg}°`;
      updateOpticsReadouts();
    });
    document.getElementById('optCalThickSlider')?.addEventListener('input', (e) => {
      state.calciteThicknessMm = Number(e.target.value) / 10;
      document.getElementById('optCalThickVal').textContent = `${state.calciteThicknessMm.toFixed(1)} mm`;
      updateOpticsReadouts();
    });
    document.getElementById('optCalAnaBtn')?.addEventListener('click', () => {
      playClick();
      state.calciteAnalyzerOn = !state.calciteAnalyzerOn;
      if (state.calciteAnalyzerOn && state.calciteMaterialId === 'calcite') {
        unlockAchievementStamp('stamp_calcite_double');
      }
      renderOpticsUI();
    });
    document.getElementById('optCalAnaSlider')?.addEventListener('input', (e) => {
      state.calciteAnalyzerDeg = Number(e.target.value);
      document.getElementById('optCalAnaVal').textContent = `${state.calciteAnalyzerDeg}°`;
      updateOpticsReadouts();
    });
  } else if (b === 'michel') {
    const matList = ['quartz', 'peridot', 'tourmaline', 'topaz', 'gypsum', 'beryl', 'calcite', 'spinel'];
    el.opticsControlsBody.innerHTML = `
      <div class="slider-row">
        <div class="slider-label"><span>薄片矿物选择</span></div>
        ${buildMaterialPillsHtml('mic-mat', state.michelMaterialId, matList)}
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>正交偏光载物台角 θ</span>
          <span class="slider-val" id="optMicStageVal">${state.michelStageDeg}°</span>
        </div>
        <input type="range" id="optMicStageSlider" min="0" max="360" value="${state.michelStageDeg}" />
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>岩石薄片厚度 d (μm)</span>
          <span class="slider-val" id="optMicThickVal">${state.michelThicknessUm} μm</span>
        </div>
        <input type="range" id="optMicThickSlider" min="5" max="150" value="${state.michelThicknessUm}" />
      </div>
      <div class="pill-row">
        <button type="button" id="optMicGypBtn" class="pill-btn ${state.michelGypsumOn ? 'is-active' : ''}">+530nm 一级红石膏试板 (加减色)</button>
      </div>
    `;
    wireMaterialPills('mic-mat', (picked) => {
      state.michelMaterialId = picked;
      renderOpticsUI();
    });
    document.getElementById('optMicStageSlider')?.addEventListener('input', (e) => {
      state.michelStageDeg = Number(e.target.value);
      document.getElementById('optMicStageVal').textContent = `${state.michelStageDeg}°`;
      updateOpticsReadouts();
    });
    document.getElementById('optMicThickSlider')?.addEventListener('input', (e) => {
      state.michelThicknessUm = Number(e.target.value);
      document.getElementById('optMicThickVal').textContent = `${state.michelThicknessUm} μm`;
      updateOpticsReadouts();
    });
    document.getElementById('optMicGypBtn')?.addEventListener('click', () => {
      playClick();
      state.michelGypsumOn = !state.michelGypsumOn;
      if (state.michelGypsumOn) unlockAchievementStamp('stamp_gypsum_sign');
      renderOpticsUI();
    });
  } else {
    const matList = ['quartz', 'calcite', 'ruby', 'topaz', 'peridot', 'tanzanite', 'orthoclase', 'spinel', 'diamond'];
    el.opticsControlsBody.innerHTML = `
      <div class="slider-row">
        <div class="slider-label"><span>锥光与光率体标本</span></div>
        ${buildMaterialPillsHtml('cono-mat', state.conoMaterialId, matList)}
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>载物台旋转角 θ (双曲线分合)</span>
          <span class="slider-val" id="optConoStageVal">${state.conoStageDeg}°</span>
        </div>
        <input type="range" id="optConoStageSlider" min="0" max="360" value="${state.conoStageDeg}" />
      </div>
      <div class="slider-row">
        <div class="slider-label">
          <span>晶片厚度 d (mm)</span>
          <span class="slider-val" id="optConoThickVal">${state.conoThicknessMm.toFixed(1)} mm</span>
        </div>
        <input type="range" id="optConoThickSlider" min="3" max="45" value="${Math.round(state.conoThicknessMm * 10)}" />
      </div>
      <div class="pill-row">
        <button type="button" id="optConoGypBtn" class="pill-btn ${state.conoGypsumOn ? 'is-active' : ''}">+530nm 石膏板测光性正负</button>
        ${state.conoMaterialId === 'quartz' ? `
        <button type="button" id="optConoHandBtn" class="pill-btn">${state.conoHandedness > 0 ? '右旋石英 D' : '左旋石英 L'}</button>
        ` : ''}
      </div>
    `;
    wireMaterialPills('cono-mat', (picked) => {
      state.conoMaterialId = picked;
      if (state.conoMaterialId === 'quartz') unlockAchievementStamp('stamp_quartz_bullseye');
      renderOpticsUI();
    });
    document.getElementById('optConoStageSlider')?.addEventListener('input', (e) => {
      state.conoStageDeg = Number(e.target.value);
      document.getElementById('optConoStageVal').textContent = `${state.conoStageDeg}°`;
      updateOpticsReadouts();
    });
    document.getElementById('optConoThickSlider')?.addEventListener('input', (e) => {
      state.conoThicknessMm = Number(e.target.value) / 10;
      document.getElementById('optConoThickVal').textContent = `${state.conoThicknessMm.toFixed(1)} mm`;
      updateOpticsReadouts();
    });
    document.getElementById('optConoGypBtn')?.addEventListener('click', () => {
      playClick();
      state.conoGypsumOn = !state.conoGypsumOn;
      if (state.conoGypsumOn) unlockAchievementStamp('stamp_gypsum_sign');
      renderOpticsUI();
    });
    document.getElementById('optConoHandBtn')?.addEventListener('click', () => {
      playClick();
      state.conoHandedness *= -1;
      renderOpticsUI();
    });
  }

  updateOpticsReadouts();
}

function updateOpticsReadouts() {
  const b = state.opticsBench;
  if (b === 'dispersion') {
    const fan = prismDispersionFan(state.dispMaterialId, state.dispApexDeg, state.dispIncidentDeg);
    const tir = snellBenchRay(state.dispMaterialId, state.dispIncidentDeg, true);
    const rRed = fan.rays[0];
    const rBlue = fan.rays[fan.rays.length - 1];
    if (!rRed.tir && !rBlue.tir) {
      unlockAchievementStamp('stamp_rainbow_prism');
    }
    if (state.dispSubMode === 'tir' && tir.tir) {
      unlockAchievementStamp('stamp_first_refraction');
    }
    el.opticsReadoutBody.innerHTML = `
      <div class="readout-cell">
        <span class="readout-k">红光 650nm / 蓝光 455nm 折射率</span>
        <span class="readout-v">${rRed.n.toFixed(4)} / ${rBlue.n.toFixed(4)}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">临界角 θc = arcsin(1/n)</span>
        <span class="readout-v">${fan.criticalDeg.toFixed(2)}° ${tir.tir && state.dispSubMode === 'tir' ? '(TIR!)' : ''}</span>
      </div>
    `;
  } else if (b === 'calcite') {
    const sp = calciteDoubleRay(state.calciteMaterialId, {
      thicknessMm: state.calciteThicknessMm,
      tiltDeg: state.calciteTiltDeg,
      azimuthDeg: state.calciteRotDeg,
      analyzerOn: state.calciteAnalyzerOn,
      analyzerDeg: state.calciteAnalyzerDeg,
    });
    el.opticsReadoutBody.innerHTML = `
      <div class="readout-cell">
        <span class="readout-k">${sp.isOpaqueMetallic ? '金属反射特征' : "寻常光 no / 非常光 ne'"}</span>
        <span class="readout-v">${sp.isOpaqueMetallic ? '不透明金属 (无透射折射光)' : `${sp.nO.toFixed(4)} / ${sp.nE.toFixed(4)}`}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">走离角 & 双像间距</span>
        <span class="readout-v">${sp.isOpaqueMetallic ? '透射全阻断 (0.00mm)' : `${sp.walkoffDeg.toFixed(2)}° · Δx=${sp.separationMm.toFixed(2)}mm`}</span>
      </div>
    `;
  } else if (b === 'michel') {
    const ret = orthoscopicRetardation(state.michelMaterialId, {
      stageDeg: state.michelStageDeg,
      thicknessUm: state.michelThicknessUm,
      gypsumPlate: state.michelGypsumOn,
    });
    el.opticsReadoutBody.innerHTML = `
      <div class="readout-cell">
        <span class="readout-k">光程差 Γ = d · Δn</span>
        <span class="readout-v">${ret.isOpaqueMetallic ? '不透明金属矿物' : `${ret.retardationNm.toFixed(0)} nm (Δn=${ret.deltaN.toFixed(4)})`}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">当前干涉色级序</span>
        <span class="readout-v">${ret.orderLabel}${ret.isOpaqueMetallic ? '' : ` · I=${(ret.transmission * 100).toFixed(0)}%`}</span>
      </div>
    `;
  } else {
    const ax = opticAxisInfo(state.conoMaterialId);
    const mat = getMaterial(state.conoMaterialId);
    el.opticsReadoutBody.innerHTML = `
      <div class="readout-cell">
        <span class="readout-k">光率体类型与光性</span>
        <span class="readout-v">${ax.signLabelZh} ${ax.twoVDeg > 0 ? `(2V=${ax.twoVDeg.toFixed(1)}°)` : ''}</span>
      </div>
      <div class="readout-cell">
        <span class="readout-k">干涉图诊断特征</span>
        <span class="readout-v">${mat.noteZh.slice(0, 34)}</span>
      </div>
    `;
  }
}

// ============================================================================
// STAMP BOOK, SUVA QR & SOUVENIR POSTCARD MODALS
// ============================================================================
function openStampBookModal() {
  const rank = computePlayerRank(save.xp);
  const nextRank = PLAYER_RANKS.find((r) => r.minXp > save.xp);
  el.stampRankSummary.innerHTML = `
    <div class="slider-label">
      <span>当前头衔: ${rank.titleZh} (${rank.titleEn})</span>
      <span class="slider-val">${save.xp} XP ${nextRank ? `/ 下一级 ${nextRank.minXp} XP` : '(最高宗师头衔!)'}</span>
    </div>
    <div style="font-size:12px;color:var(--ink-sub);">${rank.perkZh}</div>
  `;

  el.stampBookGrid.innerHTML = '';
  for (const st of ACHIEVEMENT_STAMPS) {
    const unlocked = save.stamps.includes(st.id);
    const div = document.createElement('div');
    div.className = `ach-stamp-item ${unlocked ? 'is-unlocked' : ''}`;
    div.innerHTML = `
      <div style="font-size:12px;color:${st.inkColor};">
        ${unlocked ? '[★ STAMPED]' : '[LOCKED]'} · ${st.code}
      </div>
      <h4>${st.titleZh} (+${st.xpBonus} XP)</h4>
      <p>${st.descZh}</p>
    `;
    el.stampBookGrid.appendChild(div);
  }
  el.modalStamps.hidden = false;
}

function getCurrentContextMineral() {
  if (state.view === 'DETECTIVE') {
    if (state.detSolvedCurrent) {
      return CODEX_MAP.get(state.activeCase.truthMineralId);
    }
    return {
      id: state.activeCase.id,
      nameZh: `待检神秘标本 (${state.activeCase.caseCode})`,
      nameEn: state.activeCase.titleZh,
      systemZh: '鉴定取证进行中',
      opticLabel: `已调查 ${state.detVisitedStations.size}/4 光学站`,
      diagnosticTip: state.activeCase.briefZh,
    };
  }
  if (state.view === 'CODEX') {
    return CODEX_MAP.get(state.codexMineralId);
  }
  if (state.view === 'FORGE') {
    if (state.forgeSubTab === 'stamps') {
      const f = SIMPLE_FORMS_12.find((item) => item.id === state.selectedSimpleFormId);
      return f ? { id: f.id, nameZh: f.nameZh, nameEn: f.stampTitleEn, systemZh: f.systemZh, opticLabel: `${f.meshFaces} 晶面 · ${f.miller}`, diagnosticTip: f.noteZh } : null;
    }
    const bp = FORGE_CHALLENGES.find((c) => c.id === state.activeBlueprintId);
    return bp ? { id: bp.id, nameZh: bp.titleZh, nameEn: bp.subtitleEn, systemZh: bp.mineralInspirationZh, opticLabel: `目标 ${bp.totalFaces} 晶面`, diagnosticTip: bp.hintZh } : null;
  }
  if (state.view === 'OPTICS') {
    const matId = state.opticsBench === 'dispersion'
      ? state.dispMaterialId
      : state.opticsBench === 'calcite'
        ? state.calciteMaterialId
        : state.opticsBench === 'michel'
          ? state.michelMaterialId
          : state.conoMaterialId;
    const mat = getMaterial(matId);
    return {
      id: mat.id,
      nameZh: mat.nameZh,
      nameEn: mat.en,
      systemZh: `光学实验台 · ${state.opticsBench.toUpperCase()}`,
      opticLabel: mat.opticClass === 'isotropic'
        ? `SG ${mat.sg} · n=${mat.indices[0].toFixed(3)} (均质单折)`
        : `SG ${mat.sg} · n=${mat.indices[0].toFixed(3)}-${mat.indices[mat.indices.length - 1].toFixed(3)}`,
      diagnosticTip: mat.noteZh,
    };
  }
  return null;
}

function triggerPostcardExport() {
  playStampSlam();
  unlockAchievementStamp('stamp_suva_archivist');
  const rank = computePlayerRank(save.xp);
  const modeMap = {
    HOME: 'VOL.02 // MASTER 26-FACET CRYSTAL',
    DETECTIVE: `CH.01 // GEM DETECTIVE · ${state.activeCase.caseCode}`,
    CODEX: 'CH.02 // 24 MINERAL & TWIN ARCHIVE',
    FORGE: 'CH.03 // ONE-INK-PER-FORM HABIT FORGE',
    OPTICS: 'CH.04 // PRISMA DARKROOM OPTICAL BENCH',
  };
  const dataUrl = exportPixelPostcard({
    canvas: el.pixelCanvas,
    modeTitle: modeMap[state.view] || 'SUVA PIXEL CRYSTAL V2',
    mineral: getCurrentContextMineral(),
    rankTitle: rank.titleZh,
    stampsUnlocked: save.stamps.length,
    totalStamps: ACHIEVEMENT_STAMPS.length,
    statsText: `经验值 ${save.xp} XP · 连胜 ${save.streak}\nSUVA 苏哇科技 · 纯像素典藏纪念卡`,
    theme: state.theme,
    autoDownload: true,
  });
  el.postcardPreviewImg.src = dataUrl;
  el.postcardDownloadLink.href = dataUrl;
  el.modalPostcard.hidden = false;
}

// ============================================================================
// POINTER DRAG ROTATION & 3D FACE PICKING ON 480x270 CANVAS
// ============================================================================
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragMovedPx = 0;

el.pixelCanvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragMovedPx = 0;
  el.pixelCanvas.setPointerCapture(e.pointerId);
});

el.pixelCanvas.addEventListener('pointermove', (e) => {
  const rect = el.pixelCanvas.getBoundingClientRect();
  const normX = (e.clientX - rect.left) / Math.max(1, rect.width);
  const normY = (e.clientY - rect.top) / Math.max(1, rect.height);

  if (isDragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragMovedPx += Math.hypot(dx, dy);

    state.rotY += dx * 0.011;
    state.rotX = Math.max(-1.35, Math.min(1.35, state.rotX + dy * 0.011));
    return;
  }

  const picked = engine.pickFaceAt(normX, normY);
  state.hoveredFaceId = picked ? picked.faceId : -1;
});

el.pixelCanvas.addEventListener('pointerup', (e) => {
  if (!isDragging) return;
  isDragging = false;

  if (dragMovedPx < 6) {
    const rect = el.pixelCanvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / Math.max(1, rect.width);
    const normY = (e.clientY - rect.top) / Math.max(1, rect.height);
    const picked = engine.pickFaceAt(normX, normY);

    if (picked) {
      playFaceTap(picked.faceId);
      if (state.selectedFaceId >= 0 && state.selectedFaceId !== picked.faceId && state.secondFaceId === -1) {
        state.secondFaceId = picked.faceId;
        const f1 = engine.faceMeta[state.selectedFaceId];
        if (f1) {
          const cosA = Math.max(-1, Math.min(1, f1.normal[0] * picked.normal[0] + f1.normal[1] * picked.normal[1] + f1.normal[2] * picked.normal[2]));
          const deg = ((Math.acos(cosA) * 180) / Math.PI).toFixed(1);
          el.faceHudChip.textContent = `司特诺测角: ${f1.miller} ∠ ${picked.miller} Δθ=${deg}° (内角 ${(180 - Number(deg)).toFixed(1)}°)`;
          el.faceHudChip.hidden = false;
          unlockAchievementStamp('stamp_steno_law');
        }
      } else {
        state.selectedFaceId = picked.faceId;
        state.secondFaceId = -1;
        el.faceHudChip.textContent = `拾取晶面: ${picked.miller} · ${picked.formNameZh}`;
        el.faceHudChip.hidden = false;
      }
    } else {
      clearFaceSelection();
    }
  }
});

// ============================================================================
// WIRE TOPBAR, BOTTOM DOCK, MODALS, SLIDERS & KEYBOARD SHORTCUTS
// ============================================================================
window.addEventListener('resize', () => {
  syncStageAndHandheldLayout();
});

document.getElementById('btnBrandHome')?.addEventListener('click', () => {
  playClick();
  switchView('HOME');
});

document.getElementById('btnHeroStart')?.addEventListener('click', () => {
  playClick();
  switchView('DETECTIVE');
});

document.getElementById('btnHeroOptics')?.addEventListener('click', () => {
  playClick();
  switchView('OPTICS');
});

document.querySelectorAll('[data-goto-mode]').forEach((card) => {
  card.addEventListener('click', () => {
    playClick();
    switchView(card.dataset.gotoMode);
  });
});

document.querySelectorAll('#modeNav .mode-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    playClick();
    switchView(btn.dataset.mode);
  });
});

el.mobileBottomDock?.querySelectorAll('[data-dock-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    playClick();
    switchView(btn.dataset.dockMode);
  });
});

el.btnHandheldToggle?.addEventListener('click', () => {
  playClick();
  state.forceHandheld = !state.forceHandheld;
  syncStageAndHandheldLayout();
});

el.btnThemeToggle?.addEventListener('click', () => {
  playClick();
  setTheme(state.theme === 'riso' ? 'dark' : 'riso');
});

el.btnBgmToggle?.addEventListener('click', () => {
  const on = toggleBgm();
  const lbl = document.getElementById('lblBgm');
  if (lbl) lbl.textContent = on ? 'ON' : '8BIT';
  el.btnBgmToggle.classList.toggle('is-on', on);
});

document.getElementById('btnSuvaQr')?.addEventListener('click', () => {
  playClick();
  if (el.modalSuvaQr) el.modalSuvaQr.hidden = false;
});
document.getElementById('btnCloseSuvaQr')?.addEventListener('click', () => {
  playClick();
  if (el.modalSuvaQr) el.modalSuvaQr.hidden = true;
});
el.modalSuvaQr?.addEventListener('click', (e) => {
  if (e.target === el.modalSuvaQr) el.modalSuvaQr.hidden = true;
});

document.getElementById('btnStampBook')?.addEventListener('click', () => {
  playClick();
  openStampBookModal();
});
document.getElementById('btnCloseStamps')?.addEventListener('click', () => {
  playClick();
  el.modalStamps.hidden = true;
});
el.modalStamps?.addEventListener('click', (e) => {
  if (e.target === el.modalStamps) el.modalStamps.hidden = true;
});

document.getElementById('btnExportPostcard')?.addEventListener('click', () => {
  triggerPostcardExport();
});
document.getElementById('btnClosePostcard')?.addEventListener('click', () => {
  playClick();
  el.modalPostcard.hidden = true;
});
el.modalPostcard?.addEventListener('click', (e) => {
  if (e.target === el.modalPostcard) el.modalPostcard.hidden = true;
});

// Stage Quick Toolbar
el.btnAutoSpin?.addEventListener('click', () => {
  playClick();
  state.autoSpin = !state.autoSpin;
  el.btnAutoSpin.classList.toggle('is-active', state.autoSpin);
});

document.getElementById('btnResetView')?.addEventListener('click', () => {
  playClick();
  state.rotX = 0.36;
  state.rotY = 0.62;
  state.zoom = 1.0;
  clearFaceSelection();
});

el.btnQuickTwin?.addEventListener('click', () => {
  playClick();
  if (state.view === 'DETECTIVE') {
    state.detVariant = state.detVariant === 'single' ? 'twin' : 'single';
    renderDetectiveUI();
  } else if (state.view === 'CODEX') {
    state.codexVariant = state.codexVariant === 'single' ? 'twin' : 'single';
    if (state.codexVariant === 'twin' && state.codexMineralId === 'spinel') {
      unlockAchievementStamp('stamp_spinel_twin');
    }
    renderCodexUI();
  } else {
    switchView('CODEX');
    state.codexVariant = 'twin';
    renderCodexUI();
  }
});

el.btnQuickAxes?.addEventListener('click', () => {
  playClick();
  state.showAxes = !state.showAxes;
  el.btnQuickAxes.classList.toggle('is-active', state.showAxes);
  if (state.view === 'CODEX') renderCodexUI();
  if (state.view === 'DETECTIVE') renderDetectiveStationControls();
});

// Detective Events
const triggerRandomEndless = () => {
  playClick();
  save.endlessSeed += 1;
  persistSaveState(save);
  loadDetectiveCase(generateEndlessCase(save.endlessSeed));
};
document.getElementById('btnEndlessCase')?.addEventListener('click', triggerRandomEndless);
document.getElementById('btnMobileEndless')?.addEventListener('click', triggerRandomEndless);

el.detStationTabs?.querySelectorAll('.subtab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    playClick();
    const st = Number(btn.dataset.station);
    state.detStation = st;
    state.detVisitedStations.add(st);
    clearFaceSelection();
    renderDetectiveUI();
  });
});

// Codex Events
el.codexSearchInput?.addEventListener('input', (e) => {
  state.codexSearch = e.target.value;
  renderCodexUI();
});
document.getElementById('btnCodexSingle')?.addEventListener('click', () => {
  playClick();
  state.codexVariant = 'single';
  clearFaceSelection();
  renderCodexUI();
});
document.getElementById('btnCodexTwin')?.addEventListener('click', () => {
  playClick();
  state.codexVariant = 'twin';
  clearFaceSelection();
  if (state.codexMineralId === 'spinel') unlockAchievementStamp('stamp_spinel_twin');
  renderCodexUI();
});
document.getElementById('btnCodexAxes')?.addEventListener('click', () => {
  playClick();
  state.showAxes = !state.showAxes;
  el.btnQuickAxes.classList.toggle('is-active', state.showAxes);
  renderCodexUI();
});
document.getElementById('btnCodexConstancy')?.addEventListener('click', () => {
  playClick();
  state.codexConstancyCard = !state.codexConstancyCard;
  if (state.codexConstancyCard) unlockAchievementStamp('stamp_steno_law');
  renderCodexUI();
});
el.codexExplodeSlider?.addEventListener('input', (e) => {
  state.codexExplode = Number(e.target.value) / 100;
  el.codexExplodeVal.textContent = `${e.target.value}%`;
  renderCodexDossier();
});

const sendCurrentCodexToOptics = () => {
  playClick();
  const m = CODEX_MAP.get(state.codexMineralId);
  if (m && OPTICAL_MATERIALS[m.materialId]) {
    state.conoMaterialId = m.materialId;
    state.michelMaterialId = m.materialId;
    state.calciteMaterialId = m.materialId;
    state.dispMaterialId = m.materialId;
  }
  state.opticsBench = 'conoscope';
  state.mobileSubGroup.OPTICS = 'opt-conoscope';
  switchView('OPTICS');
};
document.getElementById('btnSendToOptics')?.addEventListener('click', sendCurrentCodexToOptics);
document.getElementById('btnSendToOpticsMob')?.addEventListener('click', sendCurrentCodexToOptics);

// Forge Events
document.getElementById('btnForgeTabStamps')?.addEventListener('click', () => {
  playClick();
  state.forgeSubTab = 'stamps';
  state.mobileSubGroup.FORGE = 'forge-stamps';
  clearFaceSelection();
  renderForgeUI();
});
document.getElementById('btnForgeTabBuild')?.addEventListener('click', () => {
  playClick();
  state.forgeSubTab = 'build';
  state.mobileSubGroup.FORGE = 'forge-cut';
  clearFaceSelection();
  renderForgeUI();
});
document.querySelectorAll('#forgeModeBar [data-forge-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    playClick();
    state.forgeMode = btn.dataset.forgeMode;
    renderForgeUI();
  });
});

['D100', 'D111', 'D110', 'D211'].forEach((k) => {
  document.getElementById(`slider${k}`)?.addEventListener('input', (e) => {
    const key = k.toLowerCase();
    state[key] = Number(e.target.value) / 100;
    clearFaceSelection();
    updateForgeMatchMeter();
  });
});

document.getElementById('btnSnapBlueprint')?.addEventListener('click', () => {
  playClick();
  const bp = FORGE_CHALLENGES.find((c) => c.id === state.activeBlueprintId) || FORGE_CHALLENGES[0];
  state.forgeMode = bp.mode;
  state.d100 = bp.targetSlider.d100;
  state.d111 = bp.targetSlider.d111;
  state.d110 = bp.targetSlider.d110;
  state.d211 = bp.targetSlider.d211;
  renderForgeUI();
});

// Optics Bench Tab Events
el.opticsBenchTabs?.querySelectorAll('.subtab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    playClick();
    state.opticsBench = btn.dataset.bench;
    state.mobileSubGroup.OPTICS = `opt-${state.opticsBench}`;
    renderOpticsUI();
  });
});

// Keyboard Arcade Shortcuts (0/1/2/3/4, Space, T, M, P, Escape)
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea') return;

  if (e.key === 'Escape') {
    el.modalStamps.hidden = true;
    el.modalPostcard.hidden = true;
    if (el.modalSuvaQr) el.modalSuvaQr.hidden = true;
    return;
  }
  if (e.key === '0') {
    playClick();
    switchView('HOME');
  } else if (e.key === '1') {
    playClick();
    switchView('DETECTIVE');
  } else if (e.key === '2') {
    playClick();
    switchView('CODEX');
  } else if (e.key === '3') {
    playClick();
    switchView('FORGE');
  } else if (e.key === '4') {
    playClick();
    switchView('OPTICS');
  } else if (e.key === 't' || e.key === 'T') {
    playClick();
    setTheme(state.theme === 'riso' ? 'dark' : 'riso');
  } else if (e.key === 'm' || e.key === 'M') {
    const on = toggleBgm();
    const lbl = document.getElementById('lblBgm');
    if (lbl) lbl.textContent = on ? 'ON' : '8BIT';
    el.btnBgmToggle.classList.toggle('is-on', on);
  } else if (e.key === 'p' || e.key === 'P') {
    triggerPostcardExport();
  } else if (e.code === 'Space') {
    e.preventDefault();
    playClick();
    if (state.view === 'CODEX') {
      state.codexVariant = state.codexVariant === 'single' ? 'twin' : 'single';
      renderCodexUI();
    } else if (state.view === 'DETECTIVE' && state.detStation === 1) {
      state.detVariant = state.detVariant === 'single' ? 'twin' : 'single';
      renderDetectiveUI();
    } else {
      state.autoSpin = !state.autoSpin;
      el.btnAutoSpin.classList.toggle('is-active', state.autoSpin);
    }
  }
});

// ============================================================================
// 60 FPS MASTER PIXEL RASTERIZER LOOP
// ============================================================================
const master26Mesh = buildSimpleFormMesh('master_26');
let lastTimeMs = performance.now();
let lastHitCount = 0;

function renderFrame(nowMs) {
  const dt = Math.min(0.05, (nowMs - lastTimeMs) / 1000);
  lastTimeMs = nowMs;
  const timeSec = nowMs / 1000;

  if (state.autoSpin && !isDragging) {
    state.rotY += dt * 0.55;
  }

  if (state.view === 'HOME') {
    engine.clearBackground({
      theme: state.theme,
      accent: 'coral',
      headerText: 'SUVA · PIXEL CRYSTAL · V2.1',
      headerStyle: 'lime',
      footerLeft: 'SUVA · PIXEL CRYSTAL',
      footerMid: '26 FACETS // {100}+{111}+{110}',
      footerRight: '3 INKS LOCKED',
    });
    engine.drawCrystalScene(master26Mesh, {
      theme: state.theme,
      rotX: state.rotX,
      rotY: state.rotY,
      zoom: 0.92,
      centerX: 332,
      centerY: 132,
      timeSec,
      showAxes: state.showAxes,
      cobaltFrame: true,
      frameCaption: '26 FACETS // {100}+{111}+{110}',
      selectedFaceId: state.selectedFaceId,
      hoveredFaceId: state.hoveredFaceId,
      secondFaceId: state.secondFaceId,
      leftInfoCard: {
        kicker: 'LAW OF CONSTANCY',
        badge: 'STENO 1669 · 120°=120°',
      },
    });
    el.telemetryLeft.textContent = '26面终极聚形晶 · {100}x6 + {111}x8 + {110}x12';
    el.telemetryRight.textContent = isBgmPlaying() ? '120BPM GLASS-CHIPTUNE' : '480x270 PURE PIXEL';
  } else if (state.view === 'DETECTIVE') {
    const truthId = state.activeCase.truthMineralId;
    const truthMin = CODEX_MAP.get(truthId) || MINERAL_CODEX[0];
    const matId = truthMin.materialId || truthMin.id;
    const mesh = buildMineralMesh(truthId, { variant: state.detVariant });

    if (state.detStation === 1) {
      engine.clearBackground({
        theme: state.theme,
        accent: 'cobalt',
        headerText: `${state.activeCase.caseCode} // CRYSTAL HABIT & GONIOMETER`,
        headerStyle: 'lime',
        footerLeft: 'SUVA · GEM DETECTIVE',
        footerMid: `FACES: ${mesh.totalFaces}`,
        footerRight: state.detVariant === 'twin' ? 'TWIN SPECIMEN' : 'SINGLE CRYSTAL',
      });
      engine.drawCrystalScene(mesh, {
        theme: state.theme,
        rotX: state.rotX,
        rotY: state.rotY,
        timeSec,
        showAxes: state.showAxes,
        showTwinCallout: state.detVariant === 'twin',
        selectedFaceId: state.selectedFaceId,
        hoveredFaceId: state.hoveredFaceId,
        secondFaceId: state.secondFaceId,
      });
    } else if (state.detStation === 2) {
      const refData = refractometerShadow(matId, { rotationDeg: state.detRefRotDeg });
      engine.drawRefractometerStation(mesh, {
        refData,
        polarizerDeg: state.detRefRotDeg,
        rotX: state.rotX,
        rotY: state.rotY,
        timeSec,
        theme: state.theme,
      });
    } else if (state.detStation === 3) {
      if (state.detConoscopeMode) {
        const ax = opticAxisInfo(matId);
        const cono = getCachedConoscope(matId, {
          stageDeg: state.detStageDeg,
          tiltDeg: 0,
          thicknessMm: 1.8,
          gypsumPlate: state.detGypsumOn,
        });
        engine.drawConoscopeBench({
          axisInfo: ax,
          conoBuffer: cono,
          rotX: state.rotX,
          rotY: state.rotY,
          stageDeg: state.detStageDeg,
          gypsumOn: state.detGypsumOn,
          materialLabel: state.activeCase.caseCode,
          theme: state.theme,
        });
      } else {
        const ret = orthoscopicRetardation(matId, {
          stageDeg: state.detStageDeg,
          thicknessUm: 40,
          gypsumPlate: state.detGypsumOn,
        });
        engine.drawMichelLevyBench({
          retData: ret,
          stripRgb: MICHEL_STRIP_RGB,
          stageDeg: state.detStageDeg,
          gypsumOn: state.detGypsumOn,
          materialLabel: state.activeCase.caseCode,
          theme: state.theme,
        });
      }
    } else {
      const dic = dichroscopeColors(matId, { barrelDeg: state.detDichroDeg });
      const sg = hydrostaticSG(matId, { carat: 5.0 });
      engine.drawDichroscopeAndSGStation({
        dichro: dic,
        sgData: sg,
        dunkProgress: state.detDunkProgress,
        viewAngleDeg: state.detDichroDeg,
        theme: state.theme,
      });
    }
    el.telemetryLeft.textContent = `${state.activeCase.caseCode} · ${state.activeCase.titleZh}`;
    el.telemetryRight.textContent = `当前取证: 第 ${state.detStation} 站`;
  } else if (state.view === 'CODEX') {
    const m = CODEX_MAP.get(state.codexMineralId) || MINERAL_CODEX[0];
    const mesh = buildMineralMesh(m.id, { variant: state.codexVariant, explode: state.codexExplode });
    const codexFooterRight = state.codexVariant === 'twin'
      ? (mesh.twinInfo?.category === 'growth_sector'
          ? 'GROWTH SECTOR'
          : mesh.twinInfo?.isRareOrGrowth
            ? 'RARE TWIN LAW'
            : 'TWIN LAW')
      : 'SINGLE HABIT';
    engine.clearBackground({
      theme: state.theme,
      accent: state.codexVariant === 'twin' ? 'coral' : 'cobalt',
      headerText: `CODEX #${m.codexNo} // ${m.nameEn.toUpperCase()} (${m.formula})`,
      headerStyle: state.codexVariant === 'twin' ? 'dark' : 'lime',
      footerLeft: 'SUVA · 24 MINERAL CODEX',
      footerMid: `${m.systemId.toUpperCase()} // ${mesh.totalFaces} FACES`,
      footerRight: codexFooterRight,
    });
    engine.drawCrystalScene(mesh, {
      theme: state.theme,
      rotX: state.rotX,
      rotY: state.rotY,
      centerX: state.codexConstancyCard ? 334 : 240,
      centerY: 134,
      zoom: state.codexConstancyCard ? 0.90 : 1.04,
      timeSec,
      showAxes: state.showAxes,
      showTwinCallout: state.codexVariant === 'twin',
      selectedFaceId: state.selectedFaceId,
      hoveredFaceId: state.hoveredFaceId,
      secondFaceId: state.secondFaceId,
      leftInfoCard: state.codexConstancyCard ? {
        kicker: 'LAW OF CONSTANCY',
        badge: 'STENO 1669 · 120°=120°',
      } : null,
    });
    el.telemetryLeft.textContent = `${m.nameZh} · ${m.opticLabel}`;
    el.telemetryRight.textContent = state.codexVariant === 'twin' && mesh.twinInfo ? mesh.twinInfo.reentrantLabel : m.habitZh;
  } else if (state.view === 'FORGE') {
    if (state.forgeSubTab === 'stamps') {
      const f = SIMPLE_FORMS_12.find((item) => item.id === state.selectedSimpleFormId) || SIMPLE_FORMS_12[0];
      const mesh = buildSimpleFormMesh(f.id);
      engine.clearBackground({
        theme: state.theme,
        accent: 'cobalt',
        headerText: `STAMP #${f.stampNo} // ${f.stampTitleEn}`,
        headerStyle: 'lime',
        footerLeft: '12 SIMPLE FORMS ATLAS',
        footerMid: `${f.miller} // ${f.meshFaces} FACES`,
        footerRight: '3 INKS LOCKED',
      });
      engine.drawCrystalScene(mesh, {
        theme: state.theme,
        rotX: state.rotX,
        rotY: state.rotY,
        zoom: 1.05,
        timeSec,
        showAxes: state.showAxes,
        selectedFaceId: state.selectedFaceId,
        hoveredFaceId: state.hoveredFaceId,
        secondFaceId: state.secondFaceId,
      });
      el.telemetryLeft.textContent = `单形邮票 #${f.stampNo}: ${f.nameZh}`;
      el.telemetryRight.textContent = `代表矿物: ${f.representativeZh}`;
    } else {
      const built = buildForgeCombination({
        d100: state.d100,
        d111: state.d111,
        d110: state.d110,
        d211: state.d211,
        mode: state.forgeMode,
      });
      engine.clearBackground({
        theme: state.theme,
        accent: 'coral',
        headerText: `WULFF HABIT FORGE // ${built.totalFaces} FACES ACTIVE`,
        headerStyle: 'dark',
        footerLeft: 'ONE INK PER FORM',
        footerMid: `${state.forgeMode.toUpperCase()} SYSTEM`,
        footerRight: `${built.totalFaces} FACES`,
      });
      engine.drawCrystalScene(built, {
        theme: state.theme,
        rotX: state.rotX,
        rotY: state.rotY,
        zoom: 1.06,
        timeSec,
        showAxes: state.showAxes,
        selectedFaceId: state.selectedFaceId,
        hoveredFaceId: state.hoveredFaceId,
        secondFaceId: state.secondFaceId,
      });
      el.telemetryLeft.textContent = `一色一单形: ${built.formulaTag}`;
      el.telemetryRight.textContent = `晶棱法线角 ${built.dihedralSample.pair} = ${built.dihedralSample.normalDeg}°`;
    }
  } else if (state.view === 'OPTICS') {
    const cleanMatTag = (en) => String(en || '')
      .split('(')[0]
      .replace(/\s+Prism$/i, '')
      .replace(/^Dense\s+/i, '')
      .trim()
      .toUpperCase()
      .slice(0, 14);
    if (state.opticsBench === 'dispersion') {
      const mat = getMaterial(state.dispMaterialId);
      const fan = prismDispersionFan(state.dispMaterialId, state.dispApexDeg, state.dispIncidentDeg);
      const tir = snellBenchRay(state.dispMaterialId, state.dispIncidentDeg, true);
      const res = engine.drawDispersionBench({
        fanData: fan,
        tirData: tir,
        benchSubMode: state.dispSubMode,
        incidentDeg: state.dispIncidentDeg,
        apexDeg: state.dispApexDeg,
        materialLabel: cleanMatTag(mat.en),
        targets: state.dispTargets,
        timeSec,
      });
      if (res.hits.length > lastHitCount) {
        state.dispComboScore += (res.hits.length - lastHitCount) * 25;
      }
      lastHitCount = res.hits.length;
      el.telemetryLeft.textContent = `${mat.nameZh} · 入射角 ${state.dispIncidentDeg}°`;
      el.telemetryRight.textContent = `光谱靶: ${res.hits.length}/3 · ${state.dispComboScore} PTS`;
    } else if (state.opticsBench === 'calcite') {
      const mat = getMaterial(state.calciteMaterialId);
      const sp = calciteDoubleRay(state.calciteMaterialId, {
        thicknessMm: state.calciteThicknessMm,
        tiltDeg: state.calciteTiltDeg,
        azimuthDeg: state.calciteRotDeg,
        analyzerOn: state.calciteAnalyzerOn,
        analyzerDeg: state.calciteAnalyzerDeg,
      });
      engine.drawCalciteBench({
        splitData: sp,
        rotDeg: state.calciteRotDeg,
        thicknessMm: state.calciteThicknessMm,
        analyzerOn: state.calciteAnalyzerOn,
        analyzerDeg: state.calciteAnalyzerDeg,
        materialLabel: cleanMatTag(mat.en),
        theme: state.theme,
      });
      el.telemetryLeft.textContent = `${mat.nameZh} · o光与e光走离`;
      el.telemetryRight.textContent = sp.isIsotropic ? '均质单像' : `Δx = ${sp.separationMm.toFixed(2)} mm`;
    } else if (state.opticsBench === 'michel') {
      const mat = getMaterial(state.michelMaterialId);
      const ret = orthoscopicRetardation(state.michelMaterialId, {
        stageDeg: state.michelStageDeg,
        thicknessUm: state.michelThicknessUm,
        gypsumPlate: state.michelGypsumOn,
      });
      engine.drawMichelLevyBench({
        retData: ret,
        stripRgb: MICHEL_STRIP_RGB,
        stageDeg: state.michelStageDeg,
        gypsumOn: state.michelGypsumOn,
        materialLabel: cleanMatTag(mat.en),
        theme: state.theme,
      });
      el.telemetryLeft.textContent = `${mat.nameZh} · Γ = ${ret.retardationNm.toFixed(0)} nm`;
      el.telemetryRight.textContent = `${ret.orderLabel}`;
    } else {
      const mat = getMaterial(state.conoMaterialId);
      const ax = opticAxisInfo(state.conoMaterialId);
      const cono = getCachedConoscope(state.conoMaterialId, {
        stageDeg: state.conoStageDeg,
        tiltDeg: state.conoTiltDeg,
        thicknessMm: state.conoThicknessMm,
        gypsumPlate: state.conoGypsumOn,
        handedness: state.conoHandedness,
      });
      engine.drawConoscopeBench({
        axisInfo: ax,
        conoBuffer: cono,
        rotX: state.rotX,
        rotY: state.rotY,
        stageDeg: state.conoStageDeg,
        gypsumOn: state.conoGypsumOn,
        materialLabel: cleanMatTag(mat.en),
        theme: state.theme,
      });
      el.telemetryLeft.textContent = `${mat.nameZh} · ${ax.signLabelZh}`;
      el.telemetryRight.textContent = ax.twoVDeg > 0 ? `2V = ${ax.twoVDeg.toFixed(1)}°` : (mat.opticalActivity ? '旋光牛眼干涉图' : '正交黑十字干涉图');
    }
  }

  engine.present();
  requestAnimationFrame(renderFrame);
}

// ============================================================================
// BOOTSTRAP V2 CARTRIDGE
// ============================================================================
injectStaticPixelIcons();
updateProgressionBar();
setTheme('riso');
loadDetectiveCase(DETECTIVE_CASES[0]);
switchView('HOME');
requestAnimationFrame(renderFrame);
