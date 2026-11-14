#!/usr/bin/env node
// SUVA · 苏哇科技 · PixelCrystal V2 Automated Physics, Geometry, Pure-Pixel & V1-Archive Test Suite
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function runTests() {
  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  };

  console.log('=== PixelCrystal V2 · Physics, Polyhedra, Pure-Pixel & Governance Verification ===');

  const palette = await import('../src/palette.js');
  const sprites = await import('../src/pixel-sprites.js');
  const optics = await import('../src/optics-core.js');
  const meshes = await import('../src/crystal-meshes.js');
  const data = await import('../src/game-data.js');

  check('RISO_PALETTE, 5x7 pixel font & V2 pixel-sprites loaded cleanly', () => {
    assert.equal(palette.RISO_PALETTE.lime, '#C6FF00');
    assert.equal(palette.RISO_PALETTE.pink, '#FF4D94');
    assert.equal(palette.RISO_PALETTE.blue, '#1F38FF');
    assert.equal(palette.BAYER_4X4.length, 4);
    assert.ok(palette.PIXEL_FONT_5X7['A']);
    assert.ok(sprites.DOCK_SPRITES.HOME(24).includes('shape-rendering="crispEdges"'));
    assert.ok(sprites.PIXEL_ICONS.gemPink100(16).includes('shape-rendering="crispEdges"'));
  });

  check('Optical materials cover isotropic, uniaxial (+/-), and biaxial (+/-)', () => {
    const diamond = optics.opticAxisInfo('diamond');
    assert.equal(diamond.className, 'isotropic');

    const quartz = optics.opticAxisInfo('quartz');
    assert.equal(quartz.className, 'uniaxial');
    assert.equal(quartz.sign, 'positive');

    const calcite = optics.opticAxisInfo('calcite');
    assert.equal(calcite.className, 'uniaxial');
    assert.equal(calcite.sign, 'negative');
    assert.ok(calcite.deltaN > 0.15, 'Calcite strong birefringence');

    const topaz = optics.opticAxisInfo('topaz');
    assert.equal(topaz.className, 'biaxial');
    assert.ok(topaz.twoVDeg > 40 && topaz.twoVDeg < 80);
  });

  check('Prism dispersion & Snell critical angle physics', () => {
    const fan = optics.prismDispersionFan('flint_prism', 60, 48);
    assert.ok(fan.rays.length >= 4);
    const r650 = fan.rays.find((r) => r.nm === 650) || fan.rays[0];
    const r455 = fan.rays.find((r) => r.nm === 455) || fan.rays[fan.rays.length - 1];
    assert.ok(r455.n > r650.n, 'Normal dispersion n(blue) > n(red)');

    const tirCheck = optics.snellBenchRay('diamond', 30, true);
    assert.ok(Math.abs(tirCheck.criticalDeg - 24.4) < 1.0, 'Diamond critical angle ~24.4 deg');
    assert.equal(tirCheck.tir, true, '30 deg inside diamond triggers TIR');
  });

  check('Calcite Poynting ray walkoff & Refractometer OTL', () => {
    const split = optics.calciteDoubleRay('calcite', { thicknessMm: 6, tiltDeg: 45 });
    assert.equal(split.isIsotropic, false);
    assert.ok(split.separationMm > 0.3, 'Calcite double-refraction walkoff > 0.3mm');

    const isoSplit = optics.calciteDoubleRay('spinel', { thicknessMm: 6, tiltDeg: 45 });
    assert.equal(isoSplit.isIsotropic, true);

    const diamondRef = optics.refractometerShadow('diamond');
    assert.equal(diamondRef.overLimit, true, 'Diamond exceeds 1.79 contact liquid');

    const rubyRef = optics.refractometerShadow('ruby');
    assert.equal(rubyRef.overLimit, false);
    assert.equal(rubyRef.isDoublyRefractive, true);
  });

  check('Michel-Levy CIE strip & Jones Conoscope buffer (Quartz Bullseye + Biaxial)', () => {
    const strip = optics.michelLevyStrip(120, 1650);
    assert.equal(strip.length, 120 * 3);

    const qCono = optics.renderConoscopeBuffer('quartz', { size: 48, thicknessMm: 2.0 });
    assert.equal(qCono.rgba.length, 48 * 48 * 4);
    const midIdx = (24 * 48 + 24) * 4;
    const centerLum = qCono.rgba[midIdx] + qCono.rgba[midIdx + 1] + qCono.rgba[midIdx + 2];
    assert.ok(centerLum > 30, 'Quartz optical activity produces bright rotary bullseye center');

    const isoCono = optics.renderConoscopeBuffer('spinel', { size: 48 });
    const isoCenter = isoCono.rgba[midIdx] + isoCono.rgba[midIdx + 1] + isoCono.rgba[midIdx + 2];
    assert.equal(isoCenter, 0, 'Isotropic spinel stays dark at center under crossed polars');
  });

  check('All 24 Mineral Codex single & twin meshes + Spinel {111} twin', () => {
    assert.equal(data.MINERAL_CODEX.length, 24);
    for (const entry of data.MINERAL_CODEX) {
      const mSingle = meshes.buildMineralMesh(entry.id, { variant: 'single' });
      assert.ok(mSingle.solids.length >= 1, `${entry.id} single mesh has solids`);
      assert.ok(mSingle.totalFaces >= 4, `${entry.id} single mesh has >= 4 faces`);
      const mTwin = meshes.buildMineralMesh(entry.id, { variant: 'twin' });
      assert.ok(mTwin.solids.length >= 2, `${entry.id} twin/cluster has >= 2 solids`);
    }
    const spinelTwin = meshes.buildMineralMesh('spinel', { variant: 'twin' });
    assert.ok(spinelTwin.twinInfo && spinelTwin.twinInfo.reentrantLabel.includes('141'), 'Spinel twin reports 141°04\' re-entrant angle');
  });

  check('All 12 Simple Forms & all 6 Forge Combination Blueprints', () => {
    assert.equal(data.SIMPLE_FORMS_12.length, 12);
    for (const f of data.SIMPLE_FORMS_12) {
      const mesh = meshes.buildSimpleFormMesh(f.id);
      assert.ok(mesh.totalFaces >= 4, `Simple form ${f.id} valid`);
    }

    assert.equal(data.FORGE_CHALLENGES.length, 6);
    for (const ch of data.FORGE_CHALLENGES) {
      const built = meshes.buildForgeCombination({ ...ch.targetSlider, mode: ch.mode });
      assert.equal(built.totalFaces, ch.totalFaces, `Forge blueprint ${ch.id} matches exact target face count ${ch.totalFaces}`);
    }
  });

  check('All 8 Detective Story Commissions & Endless Case Generator', () => {
    assert.equal(data.DETECTIVE_CASES.length, 8);
    const codexIds = new Set(data.MINERAL_CODEX.map((m) => m.id));
    for (const c of data.DETECTIVE_CASES) {
      assert.ok(codexIds.has(c.truthMineralId), `Case ${c.id} truth in codex`);
      assert.ok(c.suspectIds.includes(c.truthMineralId), `Case ${c.id} suspects include truth`);
      assert.ok(c.suspectIds.length >= 3, `Case ${c.id} has >= 3 suspects`);
    }
    const endless = data.generateEndlessCase(42);
    assert.ok(codexIds.has(endless.truthMineralId));
    assert.ok(endless.suspectIds.includes(endless.truthMineralId));
  });

  check('SUVA Brand Assets (Pixel Black Cat + WeCom QR), Preserved V1, and V2 100% Pure Pixel Contract', () => {
    for (const rel of [
      'assets/ark-pixel-12px-zh.woff2',
      'assets/suva-cat-pixel.svg',
      'assets/suva-cat-pixel.png',
      'assets/suva-cat-detective.svg',
      'assets/wecom-open-source-group.png',
      'docs/v1/index.html',
      'docs/v1/main.js',
    ]) {
      const p = path.join(ROOT, rel);
      assert.ok(fs.existsSync(p) && fs.statSync(p).size > 200, `Asset/Archive exists: ${rel}`);
    }

    const v2Html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const v2Main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
    assert.ok(v2Html.includes('ArkPixel12'), 'V2 loads ArkPixel12 bitmap font');
    assert.ok(v2Html.includes('SUVA / 地质大学博士说AI / 苏哇科技'), 'V2 credits official SUVA team');
    assert.ok(v2Html.includes('./v1/'), 'V2 links to preserved V1 archive');
    assert.ok(v2Html.includes('mobileBottomDock'), 'V2 includes handheld 5-slot cartridge dock');
    assert.ok(!v2Html.includes('PingFang SC') && !v2Html.includes('Microsoft YaHei'), 'V2 eliminates smooth system font stacks');
    assert.ok(!v2Html.includes('<select') && !v2Main.includes('<select'), 'V2 eliminates native OS <select> menus');
    assert.equal((v2Html + v2Main).match(/[\u{1F300}-\u{1FAFF}]/gu), null, 'V2 eliminates all Unicode pictographic emojis');
  });

  check('SUVA · 苏哇科技 Attribution & Restricted Source-Available License', () => {
    const lic = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
    assert.ok(lic.includes('SUVA') && lic.includes('苏哇科技'));
    assert.ok(lic.includes('Strict Prohibition on Commercial Use'));
    assert.ok(lic.includes('Strict Prohibition on Redistribution'));
  });

  console.log(`\nAll ${passed} test suites passed!`);
}

runTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
