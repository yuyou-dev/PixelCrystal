// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// Pure Linear & Gyrotropic Crystal Optics Engine (Zero DOM / Browser Dependencies)
//
// Scientific & Open-Data Provenance Notices:
// 1. CIE 1931 2-deg Standard Colorimetric Observer (5 nm subset, 380-780 nm):
//    Official CIE 2019 dataset, CC BY-SA 4.0, DOI: 10.25039/CIE.DS.xvudnb9b
//    (https://creativecommons.org/licenses/by-sa/4.0/). Original 1 nm CSV MD5:
//    17cca777db64b17170f06f67ce9d3ab7; subsampled at 5 nm step for white-light
//    interference color integration. That numerical table remains CC BY-SA 4.0.
// 2. Refractive dispersion equations:
//    - Quartz & Calcite: Ghosh (1999), Optics Communications 163, 95-102.
//    - Corundum (Ruby/Sapphire): Malitson & Dodge (1972), JOSA 62(11), 1405.
//    - Flint Prism & teaching dispersion bench: labeled Cauchy teaching coefficients.
// 3. Quartz optical activity (gyration tensor):
//    Arteaga, Canillas & Jellison (2009), Applied Optics 48(29), 5500, Table 1;
//    propagated simultaneously with linear birefringence via Jones matrix exp(iH).
// 4. Pure water density (0-40 deg C): Tanaka et al. (2001), Metrologia 38(4), 301.

import { hexToRgb, lerpColor, rgbToHex } from './palette.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const TAU = Math.PI * 2;

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const finite = (x, fallback) => (Number.isFinite(Number(x)) ? Number(x) : fallback);
const sinc = (x) => (Math.abs(x) < 1e-6 ? 1 - (x * x) / 6 : Math.sin(x) / x);

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit3 = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]);
  if (!Number.isFinite(n) || n < 1e-14) return [0, 0, 1];
  return [v[0] / n, v[1] / n, v[2] / n];
};

const matIdentity = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const matTranspose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const matRy = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const matRz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const matMul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const transformVec3 = (v, m) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

// CIE 1931 2-deg Standard Colorimetric Observer, 5 nm subset (380-780 nm).
// License: CC BY-SA 4.0, DOI: 10.25039/CIE.DS.xvudnb9b
export const CIE_1931_5NM = Object.freeze([
  [380.0, 0.001368, 3.9e-5, 0.006450001], [385.0, 0.002236, 6.4e-5, 0.01054999],
  [390.0, 0.004243, 0.00012, 0.02005001], [395.0, 0.00765, 0.000217, 0.03621],
  [400.0, 0.01431, 0.000396, 0.06785001], [405.0, 0.02319, 0.00064, 0.1102],
  [410.0, 0.04351, 0.00121, 0.2074], [415.0, 0.07763, 0.00218, 0.3713],
  [420.0, 0.13438, 0.004, 0.6456], [425.0, 0.21477, 0.0073, 1.0390501],
  [430.0, 0.2839, 0.0116, 1.3856], [435.0, 0.3285, 0.01684, 1.62296],
  [440.0, 0.34828, 0.023, 1.74706], [445.0, 0.34806, 0.0298, 1.7826],
  [450.0, 0.3362, 0.038, 1.77211], [455.0, 0.3187, 0.048, 1.7441],
  [460.0, 0.2908, 0.06, 1.6692], [465.0, 0.2511, 0.0739, 1.5281],
  [470.0, 0.19536, 0.09098, 1.28764], [475.0, 0.1421, 0.1126, 1.0419],
  [480.0, 0.09564, 0.13902, 0.8129501], [485.0, 0.05795001, 0.1693, 0.6162],
  [490.0, 0.03201, 0.20802, 0.46518], [495.0, 0.0147, 0.2586, 0.3533],
  [500.0, 0.0049, 0.323, 0.272], [505.0, 0.0024, 0.4073, 0.2123],
  [510.0, 0.0093, 0.503, 0.1582], [515.0, 0.0291, 0.6082, 0.1117],
  [520.0, 0.06327, 0.71, 0.07824999], [525.0, 0.1096, 0.7932, 0.05725001],
  [530.0, 0.1655, 0.862, 0.04216], [535.0, 0.2257499, 0.9148501, 0.02984],
  [540.0, 0.2904, 0.954, 0.0203], [545.0, 0.3597, 0.9803, 0.0134],
  [550.0, 0.4334499, 0.9949501, 0.008749999], [555.0, 0.5120501, 1.0, 0.005749999],
  [560.0, 0.5945, 0.995, 0.0039], [565.0, 0.6784, 0.9786, 0.002749999],
  [570.0, 0.7621, 0.952, 0.0021], [575.0, 0.8425, 0.9154, 0.0018],
  [580.0, 0.9163, 0.87, 0.001650001], [585.0, 0.9786, 0.8163, 0.0014],
  [590.0, 1.0263, 0.757, 0.0011], [595.0, 1.0567, 0.6949, 0.001],
  [600.0, 1.0622, 0.631, 0.0008], [605.0, 1.0456, 0.5668, 0.0006],
  [610.0, 1.0026, 0.503, 0.00034], [615.0, 0.9384, 0.4412, 0.00024],
  [620.0, 0.8544499, 0.381, 0.00019], [625.0, 0.7514, 0.321, 0.0001],
  [630.0, 0.6424, 0.265, 4.999999e-5], [635.0, 0.5419, 0.217, 3e-5],
  [640.0, 0.4479, 0.175, 2e-5], [645.0, 0.3608, 0.1382, 1e-5],
  [650.0, 0.2835, 0.107, 0.0], [655.0, 0.2187, 0.0816, 0.0],
  [660.0, 0.1649, 0.061, 0.0], [665.0, 0.1212, 0.04458, 0.0],
  [670.0, 0.0874, 0.032, 0.0], [675.0, 0.0636, 0.0232, 0.0],
  [680.0, 0.04677, 0.017, 0.0], [685.0, 0.0329, 0.01192, 0.0],
  [690.0, 0.0227, 0.00821, 0.0], [695.0, 0.01584, 0.005723, 0.0],
  [700.0, 0.01135916, 0.004102, 0.0], [705.0, 0.008110916, 0.002929, 0.0],
  [710.0, 0.005790346, 0.002091, 0.0], [715.0, 0.004109457, 0.001484, 0.0],
  [720.0, 0.002899327, 0.001047, 0.0], [725.0, 0.00204919, 0.00074, 0.0],
  [730.0, 0.001439971, 0.00052, 0.0], [735.0, 0.0009999493, 0.0003611, 0.0],
  [740.0, 0.0006900786, 0.0002492, 0.0], [745.0, 0.0004760213, 0.0001719, 0.0],
  [750.0, 0.0003323011, 0.00012, 0.0], [755.0, 0.0002348261, 8.48e-5, 0.0],
  [760.0, 0.0001661505, 6e-5, 0.0], [765.0, 0.000117413, 4.24e-5, 0.0],
  [770.0, 8.307527e-5, 3e-5, 0.0], [775.0, 5.870652e-5, 2.12e-5, 0.0],
  [780.0, 4.150994e-5, 1.499e-5, 0.0],
]);

// Literature dispersion equations (Ghosh 1999; Malitson & Dodge 1972)
const LITERATURE_DISPERSION = Object.freeze({
  quartz: {
    kind: 'ghosh',
    ordinary: [1.28604141, 1.07044083, 0.0100585997, 1.10202242, 100],
    extraordinary: [1.28851804, 1.09509924, 0.0102101864, 1.15662475, 100],
  },
  calcite: {
    kind: 'ghosh',
    ordinary: [1.73358749, 0.96464345, 0.0194325203, 1.82831454, 120],
    extraordinary: [1.35859695, 0.8242783, 0.0106689543, 0.14429128, 120],
  },
  corundum: {
    kind: 'sellmeier',
    ordinary: [1.4313493, 0.0726631, 0.65054713, 0.1193242, 5.3414021, 18.02825],
    extraordinary: [1.5039759, 0.0740288, 0.55069141, 0.1216529, 6.5927379, 20.072248],
  },
});

// Labeled Cauchy teaching dispersion coefficients B (um^2), anchored at Na-D 589.3 nm
const CAUCHY_TEACHING_B = Object.freeze({
  flint_prism: 0.0112,
  diamond: 0.0126,
  zircon: 0.0108,
  fluorite: 0.0028,
  rutile: 0.0460,
});

// Arteaga et al. (2009), Table 1: RH quartz gyration tensor g_ii(lambda_nm)
const QUARTZ_GYRATION = Object.freeze({
  g11: { A: -0.0298, B: 91.1 },
  g33: { A: 0.0604, B: 97.33 },
});

function defineMaterial(entry) {
  return Object.freeze({
    id: entry.id,
    nameZh: entry.nameZh,
    en: entry.en,
    className: entry.className,
    indices: Object.freeze(entry.indices.slice()),
    sg: entry.sg,
    opaqueMetallic: Boolean(entry.opaqueMetallic),
    reflectancePct: entry.reflectancePct || null,
    dispersionType: entry.dispersionType || 'reference-589.3nm',
    dispersionKey: entry.dispersionKey || null,
    opticalActivity: Boolean(entry.opticalActivity),
    pleochroism: entry.pleochroism || 'none',
    pleoColors: Object.freeze((entry.pleoColors || ['#EAEFF8', '#EAEFF8']).slice(0, 2)),
    noteZh: entry.noteZh || '',
  });
}

export const OPTICAL_MATERIALS = Object.freeze({
  quartz: defineMaterial({
    id: 'quartz',
    nameZh: '水晶 · α-石英',
    en: 'Quartz (α-Quartz)',
    className: 'uniaxial',
    indices: [1.544, 1.544, 1.553],
    sg: 2.65,
    dispersionType: 'ghosh-1999',
    dispersionKey: 'quartz',
    opticalActivity: true,
    pleochroism: 'none',
    pleoColors: ['#ECEFFA', '#ECEFFA'],
    noteZh: '一轴正晶 (+)；32 点群具显著手性旋光色散 (21.7°/mm @589nm)，锥光中心呈彩色牛眼干涉图。',
  }),
  calcite: defineMaterial({
    id: 'calcite',
    nameZh: '冰洲石 · 方解石',
    en: 'Calcite (Iceland Spar)',
    className: 'uniaxial',
    indices: [1.658, 1.658, 1.486],
    sg: 2.71,
    dispersionType: 'ghosh-1999',
    dispersionKey: 'calcite',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#F5F2E8', '#F5F2E8'],
    noteZh: '一轴负晶 (-)，双折射率高达 0.172，坡印廷能流走离产生肉眼显著平行双影。',
  }),
  ruby: defineMaterial({
    id: 'ruby',
    nameZh: '红宝石 · 刚玉',
    en: 'Ruby (Corundum)',
    className: 'uniaxial',
    indices: [1.7681, 1.7681, 1.7600],
    sg: 4.00,
    dispersionType: 'sellmeier-malitson-1972',
    dispersionKey: 'corundum',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#FF1E6E', '#FF7A45'],
    noteZh: '一轴负晶 (-)，Cr³⁺ 致色带来紫红(o)/橙红(e)强二色性，可与均质红尖晶石一锤定音。',
  }),
  sapphire: defineMaterial({
    id: 'sapphire',
    nameZh: '蓝宝石 · 刚玉',
    en: 'Sapphire (Corundum)',
    className: 'uniaxial',
    indices: [1.7681, 1.7681, 1.7600],
    sg: 4.00,
    dispersionType: 'sellmeier-malitson-1972',
    dispersionKey: 'corundum',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#1F48FF', '#1FD1C8'],
    noteZh: '一轴负晶 (-)，Fe²⁺-Ti⁴⁺ 电荷转移致色，二色镜下呈矢车菊蓝(o)/蓝绿(e)强二色性。',
  }),
  beryl: defineMaterial({
    id: 'beryl',
    nameZh: '海蓝宝石 · 绿柱石',
    en: 'Aquamarine (Beryl)',
    className: 'uniaxial',
    indices: [1.580, 1.580, 1.574],
    sg: 2.70,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'moderate',
    pleoColors: ['#3AD4F7', '#CFF7FF'],
    noteZh: '六方晶系一轴负晶 (-)，RI 1.574–1.580，低双折射率 (0.006)，比重 2.70。',
  }),
  emerald: defineMaterial({
    id: 'emerald',
    nameZh: '祖母绿 · 绿柱石',
    en: 'Emerald (Beryl)',
    className: 'uniaxial',
    indices: [1.583, 1.583, 1.576],
    sg: 2.72,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#08C978', '#34D8BD'],
    noteZh: '绿柱石 Cr/V 宝石品种，一轴负晶 (-)，Δn=0.007，折射率与比重显著低于绿碧玺与橄榄石。',
  }),
  apatite: defineMaterial({
    id: 'apatite',
    nameZh: '氟磷灰石',
    en: 'Fluorapatite',
    className: 'uniaxial',
    indices: [1.634, 1.634, 1.631],
    sg: 3.18,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'moderate',
    pleoColors: ['#18C8E8', '#9CE8C8'],
    noteZh: '六方晶系 6/m 一轴负晶 (-)，极低双折射率 (0.003)，锥光干涉色圈宽疏。',
  }),
  zircon: defineMaterial({
    id: 'zircon',
    nameZh: '高型锆石',
    en: 'High Zircon',
    className: 'uniaxial',
    indices: [1.925, 1.925, 1.984],
    sg: 4.68,
    dispersionType: 'cauchy-teaching',
    opticalActivity: false,
    pleochroism: 'weak',
    pleoColors: ['#58C4FF', '#A6E1FF'],
    noteZh: '四方晶系一轴正晶 (+)，RI 1.925–1.984 超折射仪 1.79 量程 (OTL)，强双折射 (0.059) 致刻面棱重影。',
  }),
  rutile: defineMaterial({
    id: 'rutile',
    nameZh: '金红石',
    en: 'Rutile',
    className: 'uniaxial',
    indices: [2.616, 2.616, 2.903],
    sg: 4.23,
    dispersionType: 'cauchy-teaching',
    opticalActivity: false,
    pleochroism: 'moderate',
    pleoColors: ['#D93B2B', '#F59B38'],
    noteZh: '四方晶系一轴正晶 (+)，极端高折射率 (2.616–2.903) 与矿物界顶尖双折射 (0.287)。',
  }),
  cassiterite: defineMaterial({
    id: 'cassiterite',
    nameZh: '锡石',
    en: 'Cassiterite',
    className: 'uniaxial',
    indices: [2.006, 2.006, 2.097],
    sg: 6.99,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'weak',
    pleoColors: ['#C48B4B', '#E8C48E'],
    noteZh: '四方晶系一轴正晶 (+)，OTL 高折射率 (2.006–2.097)，比重高达 6.99。',
  }),
  diamond: defineMaterial({
    id: 'diamond',
    nameZh: '金刚石 · 钻石',
    en: 'Diamond',
    className: 'isotropic',
    indices: [2.4175, 2.4175, 2.4175],
    sg: 3.52,
    dispersionType: 'cauchy-teaching',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#E6F5FF', '#E6F5FF'],
    noteZh: '等轴晶系均质体，n=2.418 临界角仅 24.42°，折射仪超量程 (OTL)，理想单晶正交偏光全消光。',
  }),
  spinel: defineMaterial({
    id: 'spinel',
    nameZh: '尖晶石',
    en: 'Spinel',
    className: 'isotropic',
    indices: [1.718, 1.718, 1.718],
    sg: 3.60,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#FF4D88', '#FF4D88'],
    noteZh: '等轴晶系均质体，n=1.718 单阴影、无多色性、正交偏光全暗，可精准区分红宝石。',
  }),
  fluorite: defineMaterial({
    id: 'fluorite',
    nameZh: '萤石',
    en: 'Fluorite',
    className: 'isotropic',
    indices: [1.434, 1.434, 1.434],
    sg: 3.18,
    dispersionType: 'cauchy-teaching',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#7AE8B8', '#7AE8B8'],
    noteZh: '等轴晶系均质体，低折射率 (1.434) 与极低色散 (0.007)。',
  }),
  garnet: defineMaterial({
    id: 'garnet',
    nameZh: '镁铁铝榴石 · 石榴石',
    en: 'Pyrope-Almandine Garnet',
    className: 'isotropic',
    indices: [1.746, 1.746, 1.746],
    sg: 3.80,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#C92A52', '#C92A52'],
    noteZh: '等轴晶系均质体，宝石级镁铁铝榴石代表值 n=1.746、SG=3.80（纯镁铝 1.714 至纯铁铝 1.830 OTL）。',
  }),
  pyrite: defineMaterial({
    id: 'pyrite',
    nameZh: '黄铁矿',
    en: 'Pyrite',
    className: 'isotropic',
    indices: [1.850, 1.850, 1.850],
    sg: 5.01,
    opaqueMetallic: true,
    reflectancePct: 54.5,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#E6C24D', '#E6C24D'],
    noteZh: '不透明等轴金属硫化物 (2/m3̄, SG=5.01, 空气反射率 R≈54.5% 均质浅黄白)，透射光全阻挡。',
  }),
  tourmaline: defineMaterial({
    id: 'tourmaline',
    nameZh: '电气石 · 锂碧玺',
    en: 'Tourmaline (Elbaite)',
    className: 'uniaxial',
    indices: [1.644, 1.644, 1.624],
    sg: 3.06,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#0B6B4F', '#6EE8B5'],
    noteZh: '三方极性点群 3m 一轴负晶 (-)，Δn=0.020，常光 ω 吸收显著强于非常光 ε (ω ≫ ε)。',
  }),
  topaz: defineMaterial({
    id: 'topaz',
    nameZh: '托帕石 · 黄玉',
    en: 'Topaz',
    className: 'biaxial',
    indices: [1.610, 1.613, 1.620],
    sg: 3.53,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'moderate',
    pleoColors: ['#FFA834', '#FFE79E'],
    noteZh: '斜方晶系 Pbnm 二轴正晶 (+, 实算 2V=66.7°)，RI 1.610–1.620 (Δn=0.010)，比重 3.53 显著高于黄水晶 (2.65)。',
  }),
  peridot: defineMaterial({
    id: 'peridot',
    nameZh: '橄榄石',
    en: 'Peridot (Forsterite Fo90)',
    className: 'biaxial',
    indices: [1.654, 1.671, 1.690],
    sg: 3.34,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'weak',
    pleoColors: ['#96E02E', '#C6F569'],
    noteZh: '斜方晶系宝石级镁质橄榄石 (Fo90, 二轴正晶 +, 实算 2V=87.7°；Fo88 附近跨越 90°)，RI 1.654–1.690，Δn=0.036。',
  }),
  chrysoberyl: defineMaterial({
    id: 'chrysoberyl',
    nameZh: '金绿宝石 · 变石',
    en: 'Chrysoberyl / Alexandrite',
    className: 'biaxial',
    indices: [1.746, 1.748, 1.755],
    sg: 3.73,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#18C98E', '#E04882'],
    noteZh: '斜方晶系 Pbnm 二轴正晶 (+, 实算 2V=56.4°，天然 45°–71°)，RI 1.746–1.755，变石具强三色性与变色效应。',
  }),
  tanzanite: defineMaterial({
    id: 'tanzanite',
    nameZh: '坦桑石 · 黝帘石',
    en: 'Tanzanite (Zoisite)',
    className: 'biaxial',
    indices: [1.6925, 1.6943, 1.7015],
    sg: 3.35,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#2845FF', '#B34DFF'],
    noteZh: '斜方晶系 Pnma 二轴正晶 (+, 实算 2V=53.3°, Hurlbut 1969)，蓝/紫红/绿黄强三色性可与一轴蓝宝石区分。',
  }),
  orthoclase: defineMaterial({
    id: 'orthoclase',
    nameZh: '正长石',
    en: 'Orthoclase',
    className: 'biaxial',
    indices: [1.518, 1.522, 1.524],
    sg: 2.56,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#F5E8D3', '#F5E8D3'],
    noteZh: '单斜晶系 C2/m 二轴负晶 (-, 实算 2V=70.4°)，低折射率 1.518–1.524 (Δn=0.006)，SG=2.56。',
  }),
  gypsum: defineMaterial({
    id: 'gypsum',
    nameZh: '透石膏',
    en: 'Gypsum (Selenite)',
    className: 'biaxial',
    indices: [1.521, 1.523, 1.530],
    sg: 2.32,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#FAF6F0', '#FAF6F0'],
    noteZh: '单斜晶系 2/m 二轴正晶 (+, 实算 2V=56.5°，文献约 58°；形态 A2/a · 结构 I2/a)，+530 nm 一级红试板矿物。',
  }),
  kyanite: defineMaterial({
    id: 'kyanite',
    nameZh: '蓝晶石',
    en: 'Kyanite',
    className: 'biaxial',
    indices: [1.712, 1.721, 1.728],
    sg: 3.65,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'strong',
    pleoColors: ['#1A56E8', '#CFE2FF'],
    noteZh: '三斜晶系 P1̄ 二轴负晶 (-, 实算 2V=82.4°)，RI 1.712–1.728，钴蓝/无色强三色性，硬度具异向性 (4.5 vs 7)。',
  }),
  albite: defineMaterial({
    id: 'albite',
    nameZh: '钠长石',
    en: 'Albite',
    className: 'biaxial',
    indices: [1.527, 1.531, 1.538],
    sg: 2.62,
    dispersionType: 'reference-589.3nm',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#E6ECFA', '#E6ECFA'],
    noteZh: '三斜晶系 C1̄ 二轴正晶 (+, 实算 2V=74.5°，低温典型 75°–77°)，RI 1.527–1.538，常见 {010} 聚片双晶细纹。',
  }),
  flint_prism: defineMaterial({
    id: 'flint_prism',
    nameZh: '重火石光学棱镜',
    en: 'Dense Flint Glass Prism',
    className: 'isotropic',
    indices: [1.650, 1.650, 1.650],
    sg: 3.88,
    dispersionType: 'cauchy-teaching',
    opticalActivity: false,
    pleochroism: 'none',
    pleoColors: ['#EEF5FF', '#EEF5FF'],
    noteZh: '光学实验台标准均质色散棱镜，采用标注的柯西教学色散系数演示白光分光。',
  }),
});

export function getMaterial(id) {
  if (id && typeof id === 'object' && Array.isArray(id.indices)) {
    return id;
  }
  const key = String(id || 'quartz').trim();
  return Object.hasOwn(OPTICAL_MATERIALS, key) ? OPTICAL_MATERIALS[key] : OPTICAL_MATERIALS.quartz;
}

function evalLiteratureDispersion(coeff, kind, wavelengthNm) {
  const w2 = (wavelengthNm / 1000) ** 2;
  if (kind === 'ghosh') {
    return Math.sqrt(coeff[0] + (coeff[1] * w2) / (w2 - coeff[2]) + (coeff[3] * w2) / (w2 - coeff[4]));
  }
  let n2 = 1;
  for (let i = 0; i < coeff.length; i += 2) {
    n2 += (coeff[i] * w2) / (w2 - coeff[i + 1] ** 2);
  }
  return Math.sqrt(n2);
}

export function refractiveIndicesAt(id, wavelengthNm = 589.3) {
  const mat = getMaterial(id);
  const w = clamp(finite(wavelengthNm, 589.3), 380, 780);

  if (mat.dispersionKey && Object.hasOwn(LITERATURE_DISPERSION, mat.dispersionKey)) {
    const disp = LITERATURE_DISPERSION[mat.dispersionKey];
    const no = evalLiteratureDispersion(disp.ordinary, disp.kind, w);
    const ne = evalLiteratureDispersion(disp.extraordinary, disp.kind, w);
    return [no, no, ne];
  }

  if (mat.dispersionType === 'cauchy-teaching' && Object.hasOwn(CAUCHY_TEACHING_B, mat.id)) {
    const B = CAUCHY_TEACHING_B[mat.id];
    const invW2 = (1000 / w) ** 2;
    const invD2 = (1000 / 589.3) ** 2;
    const shift = B * (invW2 - invD2);
    return [mat.indices[0] + shift, mat.indices[1] + shift, mat.indices[2] + shift];
  }

  return [mat.indices[0], mat.indices[1], mat.indices[2]];
}

// Restrict impermeability B = diag(nX^-2, nY^-2, nZ^-2) to transverse plane D . s = 0
function eigenModesFromIndices(indices, direction) {
  const s = unit3(direction);
  const ref = Math.abs(s[2]) < 0.85 ? [0, 0, 1] : [0, 1, 0];
  const u = unit3(cross3(ref, s));
  const v = cross3(s, u);
  const b = [1 / (indices[0] ** 2), 1 / (indices[1] ** 2), 1 / (indices[2] ** 2)];

  let a = 0;
  let c = 0;
  let d = 0;
  for (let i = 0; i < 3; i++) {
    a += u[i] * u[i] * b[i];
    c += v[i] * v[i] * b[i];
    d += u[i] * v[i] * b[i];
  }
  const root = Math.hypot((a - c) / 2, d);
  const mid = (a + c) / 2;
  const angle = 0.5 * Math.atan2(2 * d, a - c);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);

  const fast = [ca * u[0] + sa * v[0], ca * u[1] + sa * v[1], ca * u[2] + sa * v[2]];
  const slow = cross3(s, fast);
  const nFast = 1 / Math.sqrt(Math.max(1e-12, mid + root));
  const nSlow = 1 / Math.sqrt(Math.max(1e-12, mid - root));

  return {
    nFast,
    nSlow,
    deltaN: Math.max(0, nSlow - nFast),
    fast,
    slow,
    direction: s,
    degenerate: root < 1e-12,
  };
}

export function opticAxisInfo(id, wavelengthNm = 589.3) {
  const mat = getMaterial(id);
  if (mat.opaqueMetallic) {
    return {
      className: 'isotropic',
      sign: 'isotropic',
      signLabelZh: '金属不透明 (反光均质)',
      twoVDeg: 0,
      deltaN: 0,
      axes: [],
      isOpaqueMetallic: true,
      reflectancePct: mat.reflectancePct,
    };
  }
  const n = refractiveIndicesAt(mat, wavelengthNm);
  const span = Math.max(n[0], n[1], n[2]) - Math.min(n[0], n[1], n[2]);

  if (mat.className === 'isotropic' || span < 1e-9) {
    return {
      className: 'isotropic',
      sign: 'isotropic',
      signLabelZh: '均质体',
      twoVDeg: 0,
      deltaN: 0,
      axes: [],
    };
  }

  if (mat.className === 'uniaxial') {
    const sign = n[2] > n[0] ? 'positive' : 'negative';
    return {
      className: 'uniaxial',
      sign,
      signLabelZh: sign === 'positive' ? '一轴正晶 (+)' : '一轴负晶 (-)',
      twoVDeg: 0,
      deltaN: Math.abs(n[2] - n[0]),
      axes: [[0, 0, 1]],
    };
  }

  // Biaxial: nX < nY < nZ
  const a = 1 / (n[0] * n[0]);
  const b = 1 / (n[1] * n[1]);
  const c = 1 / (n[2] * n[2]);
  const denom = Math.max(1e-12, a - c);
  const s = Math.sqrt(clamp((a - b) / denom, 0, 1));
  const z = Math.sqrt(clamp((b - c) / denom, 0, 1));
  const positive = z >= s;
  const sign = positive ? 'positive' : 'negative';
  const twoVDeg = 2 * Math.acos(clamp(Math.max(s, z), 0, 1)) * DEG;

  return {
    className: 'biaxial',
    sign,
    signLabelZh: positive ? '二轴正晶 (+)' : '二轴负晶 (-)',
    twoVDeg,
    deltaN: n[2] - n[0],
    axes: positive ? [[s, 0, z], [-s, 0, z]] : [[s, 0, z], [s, 0, -z]],
  };
}

function buildOrientationMatrix(mat, { stageDeg = 0, tiltDeg = 0, azimuthDeg = 0, axisMode = 'acute', wavelengthNm = 589.3 } = {}) {
  const info = opticAxisInfo(mat, wavelengthNm);
  let base = matIdentity();
  if (axisMode === 'acute' && mat.className === 'biaxial' && info.sign === 'negative') {
    // Rotate acute bisectrix X onto beam Z so biaxial (-) centers its acute bisectrix cleanly
    base = matRy(-Math.PI / 2);
  }
  const rz = matRz(finite(stageDeg, 0) * RAD);
  const ry = matRy(finite(tiltDeg, 0) * RAD);
  const ra = matRz(finite(azimuthDeg, 0) * RAD);
  return matMul(matMul(matMul(rz, ry), ra), base);
}

function quartzGyrationAt(wavelengthNm = 589.3, handedness = 1) {
  const w = clamp(finite(wavelengthNm, 589.3), 380, 780);
  const hand = handedness < 0 ? -1 : 1;
  const calc = (p) => (hand * p.A * w * w * w) / ((w * w - p.B * p.B) ** 2);
  return { g11: calc(QUARTZ_GYRATION.g11), g33: calc(QUARTZ_GYRATION.g33) };
}

// Precompute CIE equal-energy white E integration weights + Bradford D65 adaptation
const BRADFORD = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const BRADFORD_INV = [0.9869929, -0.1470543, 0.1599627, 0.4323053, 0.5183603, 0.0492912, -0.0085287, 0.0400428, 0.9684867];
const D65_CONE = transformVec3([0.95047, 1.0, 1.08883], BRADFORD);

function buildSpectralTable(step = 1) {
  const subset = [];
  for (let i = 0; i < CIE_1931_5NM.length; i += step) {
    subset.push(CIE_1931_5NM[i]);
  }
  const n = subset.length;
  const rawRows = subset.map((row, i) => {
    const w = row[0];
    const width = (i === 0
      ? subset[1][0] - w
      : i === n - 1
        ? w - subset[n - 2][0]
        : (subset[i + 1][0] - subset[i - 1][0]) / 2) * (i === 0 || i === n - 1 ? 0.5 : 1);
    return [row[1] * width, row[2] * width, row[3] * width];
  });
  const white = rawRows.reduce((acc, r) => [acc[0] + r[0], acc[1] + r[1], acc[2] + r[2]], [0, 0, 0]);
  const norm = white[1] || 1;
  const normWhite = [white[0] / norm, white[1] / norm, white[2] / norm];
  const whiteCone = transformVec3(normWhite, BRADFORD);
  const adaptDiag = [D65_CONE[0] / whiteCone[0], D65_CONE[1] / whiteCone[1], D65_CONE[2] / whiteCone[2]];
  const adaptMat = matMul(
    BRADFORD_INV,
    [
      BRADFORD[0] * adaptDiag[0], BRADFORD[1] * adaptDiag[0], BRADFORD[2] * adaptDiag[0],
      BRADFORD[3] * adaptDiag[1], BRADFORD[4] * adaptDiag[1], BRADFORD[5] * adaptDiag[1],
      BRADFORD[6] * adaptDiag[2], BRADFORD[7] * adaptDiag[2], BRADFORD[8] * adaptDiag[2],
    ]
  );
  const xyzToLinSrgb = [
    3.2404542, -1.5371385, -0.4985314,
    -0.9692660, 1.8760108, 0.0415560,
    0.0556434, -0.2040259, 1.0572252,
  ];
  const combined = matMul(xyzToLinSrgb, adaptMat);
  // Pre-multiply each wavelength's weight directly into linear sRGB so spectral integration is 3 FMAs!
  const linRgbWeights = rawRows.map((r) => {
    const x = r[0] / norm;
    const y = r[1] / norm;
    const z = r[2] / norm;
    return [
      combined[0] * x + combined[1] * y + combined[2] * z,
      combined[3] * x + combined[4] * y + combined[5] * z,
      combined[6] * x + combined[7] * y + combined[8] * z,
      y,
    ];
  });
  return {
    wavelengths: subset.map((r) => r[0]),
    linRgbWeights,
  };
}

const SPECTRAL_5NM = buildSpectralTable(1);  // 81 bands (5 nm) for Michel-Levy & orthoscopic
const SPECTRAL_10NM = buildSpectralTable(2); // 41 bands (10 nm) for crisp 60fps 2D conoscope

function linToSrgbByte(x) {
  const c = clamp(x, 0, 1);
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

const PRISM_FAN_BANDS = Object.freeze([
  { nm: 650, label: '650nm 红', colorHex: '#FF3B5C' },
  { nm: 589, label: '589nm 黄', colorHex: '#FFB830' },
  { nm: 532, label: '532nm 绿', colorHex: '#18D68C' },
  { nm: 486, label: '486nm 青', colorHex: '#00E5FF' },
  { nm: 455, label: '455nm 蓝', colorHex: '#4D6BFF' },
]);

export function prismDispersionFan(materialId = 'flint_prism', apexDeg = 60, incidentDeg = 48) {
  const mat = getMaterial(materialId);
  const apex = clamp(finite(apexDeg, 60), 15, 85);
  const inc = clamp(finite(incidentDeg, 48), 0, 89);

  if (mat.opaqueMetallic) {
    const pct = mat.reflectancePct ?? 54.5;
    return {
      apexDeg: apex,
      incidentDeg: inc,
      criticalDeg: 0,
      isOpaqueMetallic: true,
      reflectancePct: pct,
      rays: PRISM_FAN_BANDS.map((band) => ({
        nm: band.nm,
        label: band.label,
        colorHex: band.colorHex,
        n: 0,
        internalDeg: 0,
        exitDeg: 90,
        tir: true,
        isOpaqueMetallic: true,
      })),
    };
  }

  const refIndices = refractiveIndicesAt(mat, 589.3);
  const nRef = refIndices[0];
  const criticalDeg = Math.asin(clamp(1 / nRef, 0, 1)) * DEG;

  const rays = PRISM_FAN_BANDS.map((band) => {
    let n = refractiveIndicesAt(mat, band.nm)[0];
    if (mat.dispersionType === 'reference-589.3nm') {
      // Labeled Cauchy teaching dispersion fallback when a reference-only gem is placed on prism bench
      const shift = 0.0056 * ((1000 / band.nm) ** 2 - (1000 / 589.3) ** 2);
      n += shift;
    }
    const sinInternal = Math.sin(inc * RAD) / n;
    const internalDeg = Math.asin(clamp(sinInternal, -1, 1)) * DEG;
    const face2IncDeg = apex - internalDeg;
    const sinExit = n * Math.sin(face2IncDeg * RAD);
    const tir = Math.abs(sinExit) >= 1;
    const exitDeg = tir ? 90 : Math.asin(clamp(sinExit, -1, 1)) * DEG;

    return {
      nm: band.nm,
      label: band.label,
      colorHex: band.colorHex,
      n: Number(n.toFixed(5)),
      internalDeg: Number(internalDeg.toFixed(3)),
      exitDeg: Number(exitDeg.toFixed(3)),
      tir,
    };
  });

  return {
    apexDeg: apex,
    incidentDeg: inc,
    criticalDeg: Number(criticalDeg.toFixed(3)),
    rays,
  };
}

export function snellBenchRay(materialId = 'diamond', incidentDeg = 30, fromInsideCrystal = true) {
  const mat = getMaterial(materialId);
  const inc = clamp(Math.abs(finite(incidentDeg, 30)), 0, 89.9);
  const reflectedDeg = inc;
  if (mat.opaqueMetallic) {
    return {
      n: 0,
      criticalDeg: 0,
      incidentDeg: inc,
      tir: true,
      refractedDeg: 90,
      reflectedDeg: Number(reflectedDeg.toFixed(3)),
      isOpaqueMetallic: true,
      reflectancePct: mat.reflectancePct ?? 54.5,
    };
  }
  const n = refractiveIndicesAt(mat, 589.3)[0];
  const criticalDeg = Math.asin(clamp(1 / n, 0, 1)) * DEG;

  if (fromInsideCrystal) {
    const sinRef = n * Math.sin(inc * RAD);
    const tir = sinRef >= 1;
    const refractedDeg = tir ? 90 : Math.asin(clamp(sinRef, 0, 1)) * DEG;
    return {
      n: Number(n.toFixed(4)),
      criticalDeg: Number(criticalDeg.toFixed(3)),
      incidentDeg: inc,
      tir,
      refractedDeg: Number(refractedDeg.toFixed(3)),
      reflectedDeg: Number(reflectedDeg.toFixed(3)),
    };
  }

  const sinRef = Math.sin(inc * RAD) / n;
  const refractedDeg = Math.asin(clamp(sinRef, 0, 1)) * DEG;
  return {
    n: Number(n.toFixed(4)),
    criticalDeg: Number(criticalDeg.toFixed(3)),
    incidentDeg: inc,
    tir: false,
    refractedDeg: Number(refractedDeg.toFixed(3)),
    reflectedDeg: Number(reflectedDeg.toFixed(3)),
  };
}

export function calciteDoubleRay(
  materialId = 'calcite',
  { thicknessMm = 6, tiltDeg = 45, azimuthDeg = 30, analyzerOn = false, analyzerDeg = 0 } = {}
) {
  const mat = getMaterial(materialId);
  if (mat.opaqueMetallic) {
    return {
      nO: mat.indices[0],
      nE: mat.indices[0],
      deltaN: 0,
      separationMm: 0,
      walkoffDeg: 0,
      oOffset: [0, 0],
      eOffset: [0, 0],
      oIntensity: 0,
      eIntensity: 0,
      isIsotropic: true,
      isOpaqueMetallic: true,
    };
  }
  const indices = refractiveIndicesAt(mat, 589.3);
  const t = clamp(finite(thicknessMm, 6), 0.2, 50);
  const span = Math.max(indices[0], indices[1], indices[2]) - Math.min(indices[0], indices[1], indices[2]);

  if (mat.className === 'isotropic' || span < 1e-9) {
    return {
      nO: indices[0],
      nE: indices[0],
      deltaN: 0,
      separationMm: 0,
      walkoffDeg: 0,
      oOffset: [0, 0],
      eOffset: [0, 0],
      oIntensity: analyzerOn ? 0.5 : 1.0,
      eIntensity: 0,
      isIsotropic: true,
    };
  }

  const R = buildOrientationMatrix(mat, {
    tiltDeg: finite(tiltDeg, 45),
    stageDeg: finite(azimuthDeg, 30),
    axisMode: 'Z',
  });
  const invR = matTranspose(R);
  const wave = transformVec3([0, 0, 1], invR);
  const modes = eigenModesFromIndices(indices, wave);

  const solved = [
    { n: modes.nFast, D: modes.fast },
    { n: modes.nSlow, D: modes.slow },
  ].map(({ n, D }) => {
    const E = [D[0] / (indices[0] ** 2), D[1] / (indices[1] ** 2), D[2] / (indices[2] ** 2)];
    const H = cross3(wave, E);
    const poynting = unit3(cross3(E, H));
    const rayBeam = transformVec3(poynting, R);
    const polBeam = transformVec3(D, R);
    const rz = Math.max(0.05, rayBeam[2]);
    const dx = (t * rayBeam[0]) / rz;
    const dy = (t * rayBeam[1]) / rz;
    const walkoff = Math.acos(clamp(rayBeam[2], -1, 1)) * DEG;
    const polAngleRad = Math.atan2(polBeam[1], polBeam[0]);
    return { n, offset: [dx, dy], walkoff, polAngleRad };
  });

  // Assign straight/smaller-walkoff ray as o-ray and walking-off ray as e-ray
  solved.sort((a, b) => a.walkoff - b.walkoff);
  const oRay = solved[0];
  const eRay = solved[1];

  const separationMm = Math.hypot(eRay.offset[0] - oRay.offset[0], eRay.offset[1] - oRay.offset[1]);
  const anaRad = finite(analyzerDeg, 0) * RAD;
  const oIntensity = analyzerOn ? Math.cos(anaRad - oRay.polAngleRad) ** 2 : 1.0;
  const eIntensity = analyzerOn ? Math.cos(anaRad - eRay.polAngleRad) ** 2 : 1.0;

  return {
    nO: Number(oRay.n.toFixed(5)),
    nE: Number(eRay.n.toFixed(5)),
    deltaN: Number(Math.abs(eRay.n - oRay.n).toFixed(5)),
    separationMm: Number(separationMm.toFixed(4)),
    walkoffDeg: Number(eRay.walkoff.toFixed(3)),
    oOffset: [Number(oRay.offset[0].toFixed(4)), Number(oRay.offset[1].toFixed(4))],
    eOffset: [Number(eRay.offset[0].toFixed(4)), Number(eRay.offset[1].toFixed(4))],
    oIntensity: Number(oIntensity.toFixed(4)),
    eIntensity: Number(eIntensity.toFixed(4)),
    isIsotropic: false,
  };
}

function describeRetardationOrder(nm) {
  const g = Math.max(0, nm);
  if (g < 40) return '零级黑灰';
  if (g < 260) return '一级灰白';
  if (g < 500) return '一级黄橙';
  if (g < 575) return '一级紫红 (530nm敏感色)';
  if (g < 1100) return '二级蓝绿黄红';
  if (g < 1650) return '三级干涉色';
  return '高级白';
}

export function orthoscopicRetardation(
  materialId = 'quartz',
  { stageDeg = 45, thicknessUm = 35, gypsumPlate = false } = {}
) {
  const mat = getMaterial(materialId);
  if (mat.opaqueMetallic) {
    return {
      deltaN: 0,
      retardationNm: 0,
      effectiveRetardationNm: 0,
      transmission: 0,
      rgb: [0, 0, 0],
      hex: '#000000',
      orderLabel: `不透明金属全阻光 (R≈${mat.reflectancePct ?? 54.5}%)`,
      isOpaqueMetallic: true,
    };
  }
  const info = opticAxisInfo(mat, 589.3);
  const deltaN = info.deltaN;
  const um = clamp(finite(thicknessUm, 35), 1, 200);
  const retardationNm = deltaN * um * 1000;

  // Slow axis oriented at stageDeg -> fast axis at stageDeg - 90 deg
  const slowRad = finite(stageDeg, 45) * RAD;
  const fastRad = slowRad - Math.PI / 2;
  const sin2Psi = Math.sin(2 * fastRad); // = -sin(2 * slowRad)
  const cos2Psi = Math.cos(2 * fastRad); // = -cos(2 * slowRad)

  const effectiveRetardationNm = gypsumPlate
    ? Math.max(0, 530 + retardationNm * Math.sin(2 * slowRad))
    : retardationNm * Math.abs(Math.sin(2 * slowRad));

  if (!gypsumPlate && (deltaN < 1e-9 || Math.abs(sin2Psi) < 1e-7)) {
    return {
      deltaN: Number(deltaN.toFixed(5)),
      retardationNm: Number(retardationNm.toFixed(1)),
      effectiveRetardationNm: 0,
      transmission: 0,
      rgb: [0, 0, 0],
      hex: '#000000',
      orderLabel: deltaN < 1e-9 ? '均质全消光' : '正交消光位',
    };
  }

  let linR = 0;
  let linG = 0;
  let linB = 0;
  let lumY = 0;

  const { wavelengths, linRgbWeights } = SPECTRAL_5NM;
  for (let i = 0; i < wavelengths.length; i++) {
    const w = wavelengths[i];
    const halfDelta = (Math.PI * retardationNm) / w;
    let T;
    if (!gypsumPlate) {
      T = (sin2Psi * sin2Psi) * (Math.sin(halfDelta) ** 2);
    } else {
      // Exact 2-plate Jones product: Gypsum (+530nm slow at +45deg) * Specimen (fast at fastRad)
      const ch = Math.cos(halfDelta);
      const sh = Math.sin(halfDelta);
      const shx = -sh * sin2Psi;
      const shz = -sh * cos2Psi;
      const halfGyp = (Math.PI * 530) / w;
      const cg = Math.cos(halfGyp);
      const sg = Math.sin(halfGyp);
      const reWy = -shz * sg;
      const imWy = ch * sg + shx * cg;
      T = clamp(reWy * reWy + imWy * imWy, 0, 1);
    }
    const wt = linRgbWeights[i];
    linR += T * wt[0];
    linG += T * wt[1];
    linB += T * wt[2];
    lumY += T * wt[3];
  }

  const rgb = [linToSrgbByte(linR), linToSrgbByte(linG), linToSrgbByte(linB)];
  return {
    deltaN: Number(deltaN.toFixed(5)),
    retardationNm: Number(retardationNm.toFixed(1)),
    effectiveRetardationNm: Number(effectiveRetardationNm.toFixed(1)),
    transmission: Number(clamp(lumY, 0, 1).toFixed(4)),
    rgb,
    hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
    orderLabel: describeRetardationOrder(gypsumPlate ? effectiveRetardationNm : retardationNm),
  };
}

export function michelLevyStrip(widthPx = 240, maxNm = 1650) {
  const width = Math.max(2, Math.round(finite(widthPx, 240)));
  const spanNm = Math.max(100, finite(maxNm, 1650));
  const out = new Uint8ClampedArray(width * 3);
  const { wavelengths, linRgbWeights } = SPECTRAL_5NM;

  for (let x = 0; x < width; x++) {
    const gammaNm = (x / (width - 1)) * spanNm;
    let linR = 0;
    let linG = 0;
    let linB = 0;
    for (let i = 0; i < wavelengths.length; i++) {
      const T = Math.sin((Math.PI * gammaNm) / wavelengths[i]) ** 2;
      const wt = linRgbWeights[i];
      linR += T * wt[0];
      linG += T * wt[1];
      linB += T * wt[2];
    }
    const off = x * 3;
    out[off] = linToSrgbByte(linR);
    out[off + 1] = linToSrgbByte(linG);
    out[off + 2] = linToSrgbByte(linB);
  }
  return out;
}

export function renderConoscopeBuffer(
  materialId = 'quartz',
  {
    size = 56,
    stageDeg = 0,
    tiltDeg = 0,
    thicknessMm = 1.6,
    gypsumPlate = false,
    handedness = 1,
    apertureDeg = 26,
  } = {}
) {
  const mat = getMaterial(materialId);
  const sz = Math.max(16, Math.min(160, Math.round(finite(size, 56))));
  const count = sz * sz;
  const rgba = new Uint8ClampedArray(count * 4);
  const mask = new Uint8Array(count);
  const info = opticAxisInfo(mat, 589.3);

  // High-NA conoscopic condenser cone so biaxial hyperbola melatopes (2V up to ~85 deg) stay visible
  const rawAperture = clamp(finite(apertureDeg, 26), 5, 60);
  const effApertureDeg = mat.className === 'biaxial' ? Math.max(rawAperture * 1.6, 42) : rawAperture;
  const tanA = Math.tan(effApertureDeg * RAD);
  const half = (sz - 1) / 2;

  const orientation = buildOrientationMatrix(mat, { stageDeg, tiltDeg, axisMode: 'acute' });
  const invOrientation = matTranspose(orientation);

  // Fast path for ideal isotropic or opaque metallic crystal
  if (info.className === 'isotropic') {
    let isoR = 0;
    let isoG = 0;
    let isoB = 0;
    if (gypsumPlate && !mat.opaqueMetallic) {
      const gyp = orthoscopicRetardation('diamond', { gypsumPlate: true });
      isoR = gyp.rgb[0];
      isoG = gyp.rgb[1];
      isoB = gyp.rgb[2];
    }
    for (let y = 0; y < sz; y++) {
      for (let x = 0; x < sz; x++) {
        const xx = (x - half) / half;
        const yy = (half - y) / half;
        if (xx * xx + yy * yy > 1) continue;
        const idx = y * sz + x;
        mask[idx] = 1;
        const p4 = idx * 4;
        rgba[p4] = isoR;
        rgba[p4 + 1] = isoG;
        rgba[p4 + 2] = isoB;
        rgba[p4 + 3] = 255;
      }
    }
    return {
      size: sz,
      rgba,
      mask,
      twoVDeg: 0,
      sign: 'isotropic',
      signLabelZh: info.signLabelZh,
      axesScreen: [],
      isOpaqueMetallic: Boolean(mat.opaqueMetallic),
    };
  }

  const tNm = clamp(finite(thicknessMm, 1.6), 0.05, 15) * 1e6;
  const refIndices = refractiveIndicesAt(mat, 589.3);
  const active = mat.opticalActivity;

  const lengthArr = new Float64Array(count);
  const deltaN589 = new Float64Array(count);
  const z2Arr = new Float64Array(count);
  const sin2PsiArr = new Float64Array(count);
  const cos2PsiArr = new Float64Array(count);
  const meanN589 = new Float64Array(count);

  for (let y = 0; y < sz; y++) {
    for (let x = 0; x < sz; x++) {
      const xx = (x - half) / half;
      const yy = (half - y) / half;
      if (xx * xx + yy * yy > 1) continue;
      const idx = y * sz + x;
      mask[idx] = 1;

      const beamDir = unit3([xx * tanA, yy * tanA, 1]);
      const optDir = transformVec3(beamDir, invOrientation);
      const modes = eigenModesFromIndices(refIndices, optDir);
      const fastBeam = transformVec3(modes.fast, orientation);

      // Aplanatic lens transport frame keeping crossed polars orthogonal on pupil sphere
      const sx = unit3([1 - beamDir[0] ** 2, -beamDir[0] * beamDir[1], -beamDir[0] * beamDir[2]]);
      const sy = cross3(beamDir, sx);
      const fastPsi = Math.atan2(dot3(fastBeam, sy), dot3(fastBeam, sx));

      lengthArr[idx] = tNm / Math.max(0.15, beamDir[2]);
      deltaN589[idx] = modes.deltaN;
      z2Arr[idx] = optDir[2] * optDir[2];
      sin2PsiArr[idx] = Math.sin(2 * fastPsi);
      cos2PsiArr[idx] = Math.cos(2 * fastPsi);
      meanN589[idx] = Math.sqrt(modes.nFast * modes.nSlow);
    }
  }

  const linAccum = new Float64Array(count * 3);
  const phaseGrid = new Float64Array(count);
  const { wavelengths, linRgbWeights } = SPECTRAL_10NM;
  const hasUniaxialDisp = mat.className === 'uniaxial' && mat.dispersionKey != null;

  for (let wi = 0; wi < wavelengths.length; wi++) {
    const w = wavelengths[wi];
    const wt = linRgbWeights[wi];
    const indW = hasUniaxialDisp ? refractiveIndicesAt(mat, w) : refIndices;
    const bo = 1 / (indW[0] * indW[0]);
    const be = 1 / (indW[2] * indW[2]);
    const gyr = active ? quartzGyrationAt(w, handedness) : null;

    const halfGyp = gypsumPlate ? (Math.PI * 530) / w : 0;
    const cg = gypsumPlate ? Math.cos(halfGyp) : 1;
    const sg = gypsumPlate ? Math.sin(halfGyp) : 0;

    // First pass: evaluate exact total retardance phase at each pixel for anti-moire filtering
    for (let i = 0; i < count; i++) {
      if (!mask[i]) continue;
      let dN = deltaN589[i];
      let nMean = meanN589[i];
      if (hasUniaxialDisp) {
        const z2 = z2Arr[i];
        const nEff = 1 / Math.sqrt(z2 * bo + (1 - z2) * be);
        dN = Math.abs(nEff - indW[0]);
        nMean = Math.sqrt(indW[0] * nEff);
      }
      const halfDelta = (Math.PI * lengthArr[i] * dN) / w;
      let rho = 0;
      if (active) {
        const z2 = z2Arr[i];
        const G = gyr.g11 * (1 - z2) + gyr.g33 * z2;
        rho = (Math.PI * lengthArr[i] * G) / (w * nMean);
      }
      phaseGrid[i] = 2 * Math.hypot(halfDelta, rho);
    }

    // Second pass: Jones matrix exp(iH) + optional +530nm gypsum plate + local phase AA
    for (let y = 0; y < sz; y++) {
      for (let x = 0; x < sz; x++) {
        const i = y * sz + x;
        if (!mask[i]) continue;

        let dN = deltaN589[i];
        let nMean = meanN589[i];
        if (hasUniaxialDisp) {
          const z2 = z2Arr[i];
          const nEff = 1 / Math.sqrt(z2 * bo + (1 - z2) * be);
          dN = Math.abs(nEff - indW[0]);
          nMean = Math.sqrt(indW[0] * nEff);
        }

        const halfDelta = (Math.PI * lengthArr[i] * dN) / w;
        let rho = 0;
        if (active) {
          const z2 = z2Arr[i];
          const G = gyr.g11 * (1 - z2) + gyr.g33 * z2;
          rho = (Math.PI * lengthArr[i] * G) / (w * nMean);
        }

        const hx = -halfDelta * sin2PsiArr[i];
        const hy = -rho;
        const hz = -halfDelta * cos2PsiArr[i];
        const h = Math.hypot(hx, hy, hz);
        const s = sinc(h);
        const ch = Math.cos(h);

        let T;
        if (!gypsumPlate) {
          T = s * s * (hx * hx + hy * hy);
        } else {
          const shx = s * hx;
          const shy = s * hy;
          const shz = s * hz;
          const reWy = -shz * sg - shy * cg;
          const imWy = ch * sg + shx * cg;
          T = reWy * reWy + imWy * imWy;
        }

        // Mild pixel-footprint phase damping prevents high-order aliasing rings on 56x56 grid
        const l = x > 0 && mask[i - 1] ? i - 1 : i;
        const r = x + 1 < sz && mask[i + 1] ? i + 1 : i;
        const u = y > 0 && mask[i - sz] ? i - sz : i;
        const d = y + 1 < sz && mask[i + sz] ? i + sz : i;
        const gx = (phaseGrid[r] - phaseGrid[l]) / (r === l ? 1 : r - l);
        const gy = (phaseGrid[d] - phaseGrid[u]) / (d === u ? 1 : (d - u) / sz);
        const aa = clamp(Math.abs(sinc(gx * 0.35) * sinc(gy * 0.35)), 0, 1);
        const Tfiltered = 0.5 * (1 - aa) * Math.min(1, T * 1.1) + aa * T;

        const c3 = i * 3;
        linAccum[c3] += Tfiltered * wt[0];
        linAccum[c3 + 1] += Tfiltered * wt[1];
        linAccum[c3 + 2] += Tfiltered * wt[2];
      }
    }
  }

  for (let i = 0; i < count; i++) {
    if (!mask[i]) continue;
    const c3 = i * 3;
    const p4 = i * 4;
    rgba[p4] = linToSrgbByte(linAccum[c3]);
    rgba[p4 + 1] = linToSrgbByte(linAccum[c3 + 1]);
    rgba[p4 + 2] = linToSrgbByte(linAccum[c3 + 2]);
    rgba[p4 + 3] = 255;
  }

  const axesScreen = info.axes.map((v) => {
    let p = transformVec3(v, orientation);
    if (p[2] < 0) p = [-p[0], -p[1], -p[2]];
    const nx = p[2] > 1e-10 ? p[0] / p[2] / tanA : 99;
    const ny = p[2] > 1e-10 ? p[1] / p[2] / tanA : 99;
    const inside = Number.isFinite(nx) && nx * nx + ny * ny <= 1;
    return {
      x: Number((half + nx * half).toFixed(2)),
      y: Number((half - ny * half).toFixed(2)),
      nx: Number(nx.toFixed(4)),
      ny: Number(ny.toFixed(4)),
      inside,
    };
  });

  return {
    size: sz,
    rgba,
    mask,
    twoVDeg: Number(info.twoVDeg.toFixed(2)),
    sign: info.sign,
    signLabelZh: info.signLabelZh,
    axesScreen,
  };
}

export function refractometerShadow(
  materialId = 'ruby',
  { rotationDeg = 0, liquidLimit = 1.79 } = {}
) {
  const mat = getMaterial(materialId);
  const indices = refractiveIndicesAt(mat, 589.3);
  const limit = finite(liquidLimit, 1.79);
  const scaleMin = 1.30;
  const scaleMax = 1.81;

  if (mat.opaqueMetallic) {
    return {
      overLimit: true,
      isOpaqueMetallic: true,
      reflectancePct: mat.reflectancePct,
      nLow: Number(indices[0].toFixed(4)),
      nHigh: Number(indices[0].toFixed(4)),
      deltaN: 0,
      isDoublyRefractive: false,
      scaleMin,
      scaleMax,
    };
  }

  if (mat.className === 'isotropic') {
    const n = Number(indices[0].toFixed(4));
    return {
      overLimit: n > limit,
      nLow: n,
      nHigh: n,
      deltaN: 0,
      isDoublyRefractive: false,
      scaleMin,
      scaleMax,
    };
  }

  // General table facet cut (tilt 74 deg) rotated on hemicylinder by rotationDeg
  const R = buildOrientationMatrix(mat, {
    stageDeg: finite(rotationDeg, 0) + 55,
    tiltDeg: 74,
    axisMode: 'Z',
  });
  const invR = matTranspose(R);
  const f = (angle, slowMode) => {
    const dir = transformVec3([Math.cos(angle), 0, Math.sin(angle)], invR);
    const modes = eigenModesFromIndices(indices, dir);
    return (slowMode ? modes.nSlow : modes.nFast) * Math.cos(angle);
  };

  const readings = [false, true].map((slowMode) => {
    let best = -Infinity;
    let bestIdx = 90;
    const step = Math.PI / 180;
    for (let i = 0; i <= 180; i++) {
      const val = f(-Math.PI / 2 + i * step, slowMode);
      if (val > best) {
        best = val;
        bestIdx = i;
      }
    }
    // Golden-section refinement around maximum wave-vector projection
    let lo = -Math.PI / 2 + Math.max(0, bestIdx - 1) * step;
    let hi = -Math.PI / 2 + Math.min(180, bestIdx + 1) * step;
    const phi = (Math.sqrt(5) - 1) / 2;
    let a = hi - phi * (hi - lo);
    let b = lo + phi * (hi - lo);
    let fa = f(a, slowMode);
    let fb = f(b, slowMode);
    for (let k = 0; k < 32; k++) {
      if (fa < fb) {
        lo = a;
        a = b;
        fa = fb;
        b = lo + phi * (hi - lo);
        fb = f(b, slowMode);
      } else {
        hi = b;
        b = a;
        fb = fa;
        a = hi - phi * (hi - lo);
        fa = f(a, slowMode);
      }
    }
    return f((lo + hi) / 2, slowMode);
  });

  readings.sort((x, y) => x - y);
  const nLow = Number(readings[0].toFixed(4));
  const nHigh = Number(readings[1].toFixed(4));
  const deltaN = Number(Math.max(0, nHigh - nLow).toFixed(4));

  return {
    overLimit: nLow > limit || nHigh > limit,
    nLow,
    nHigh,
    deltaN,
    isDoublyRefractive: deltaN > 0.0004,
    scaleMin,
    scaleMax,
  };
}

export function dichroscopeColors(materialId = 'ruby', { barrelDeg = 0 } = {}) {
  const mat = getMaterial(materialId);
  const [c1Hex, c2Hex] = mat.pleoColors;

  if (mat.pleochroism === 'none' || mat.className === 'isotropic') {
    return {
      pleochroism: 'none',
      labelZh: '无多色性 (两窗同色)',
      window1Hex: c1Hex,
      window2Hex: c1Hex,
    };
  }

  const rad = finite(barrelDeg, 0) * RAD;
  const k = Math.sin(rad) ** 2; // 0 at 0 deg, 0.5 at 45 deg, 1 at 90 deg (windows swap!)
  const rgb1 = hexToRgb(c1Hex);
  const rgb2 = hexToRgb(c2Hex);
  const w1 = lerpColor(rgb1, rgb2, k);
  const w2 = lerpColor(rgb2, rgb1, k);

  const labelMap = {
    strong: '强多色性 (旋转90°两窗互换)',
    moderate: '明显多色性',
    weak: '弱多色性',
  };

  return {
    pleochroism: mat.pleochroism,
    labelZh: labelMap[mat.pleochroism] || '具多色性',
    window1Hex: rgbToHex(w1[0], w1[1], w1[2]),
    window2Hex: rgbToHex(w2[0], w2[1], w2[2]),
  };
}

// Tanaka et al. (2001) pure water density g/cm^3 for 0..40 deg C
function waterDensityTanaka(tempC = 20) {
  const t = clamp(finite(tempC, 20), 0, 40);
  return (
    (999.97495 *
      (1 - ((t - 3.983035) ** 2 * (t + 301.797)) / (522528.9 * (t + 69.34881)))) /
    1000
  );
}

export function hydrostaticSG(materialId = 'ruby', { carat = 5.0, waterTempC = 20 } = {}) {
  const mat = getMaterial(materialId);
  const ct = clamp(finite(carat, 5.0), 0.2, 200);
  const massAirG = ct * 0.2;
  const rhoWater = waterDensityTanaka(waterTempC);
  const buoyancyG = (massAirG * rhoWater) / mat.sg;
  const massWaterG = massAirG - buoyancyG;
  const sg = (massAirG / (massAirG - massWaterG)) * rhoWater;

  return {
    carat: Number(ct.toFixed(2)),
    massAirG: Number(massAirG.toFixed(4)),
    massWaterG: Number(massWaterG.toFixed(4)),
    buoyancyG: Number(buoyancyG.toFixed(4)),
    sg: Number(sg.toFixed(3)),
  };
}
