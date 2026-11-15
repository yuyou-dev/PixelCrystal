#!/usr/bin/env node
// SUVA · 苏哇科技 · PixelCrystal V2.1 Automated Physics, Crystallography, Twin Audit, Pure-Pixel & Governance Test Suite
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

  console.log('=== PixelCrystal V2.1 · Full Scientific Crystallography, Twin & Optics Verification ===');

  const palette = await import('../src/palette.js');
  const sprites = await import('../src/pixel-sprites.js');
  const optics = await import('../src/optics-core.js');
  const meshes = await import('../src/crystal-meshes.js');
  const data = await import('../src/game-data.js');
  const engineMod = await import('../src/pixel-engine.js');

  check('RISO_PALETTE, 5x7 crystallographic glyphs (lowercase a/b/c, ^, barred digits) & pixel-sprites', () => {
    assert.equal(palette.RISO_PALETTE.lime, '#C6FF00');
    assert.equal(palette.RISO_PALETTE.pink, '#FF4D94');
    assert.equal(palette.RISO_PALETTE.blue, '#1F38FF');
    assert.equal(palette.BAYER_4X4.length, 4);
    for (const ch of ['A', 'a', 'b', 'c', '^', '\uE001', '\uE002', '\uE003', '\uE004', '\uE006']) {
      assert.ok(palette.PIXEL_FONT_5X7[ch], `Glyph ${JSON.stringify(ch)} present in PIXEL_FONT_5X7`);
    }
    assert.ok(sprites.DOCK_SPRITES.HOME(24).includes('shape-rendering="crispEdges"'));
    assert.ok(sprites.PIXEL_ICONS.gemPink100(16).includes('shape-rendering="crispEdges"'));
  });

  check('PixelEngine._normalizeText preserves lowercase crystallographic c-axis & barred Miller indices', () => {
    const pe = Object.create(engineMod.PixelEngine.prototype);
    assert.equal(pe._normalizeText('L3 · +c'), 'L3 · +c');
    assert.equal(pe._normalizeText('-c (antilogous)'), '-c (ANTILOGOUS)');
    assert.equal(pe._normalizeText("c^c 125°16'"), "c^c 125°16'");
    assert.equal(pe._normalizeText('3\u0304m'), '\uE003M');
    assert.equal(pe._normalizeText('{112\u03042}'), '{11\uE0022}');
  });

  check('Optical materials cover isotropic, opaque metallic (Pyrite), uniaxial (+/-), and exact Fresnel biaxial 2V', () => {
    const diamond = optics.opticAxisInfo('diamond');
    assert.equal(diamond.className, 'isotropic');

    const pyrite = optics.opticAxisInfo('pyrite');
    assert.equal(pyrite.isOpaqueMetallic, true);
    const pyRef = optics.refractometerShadow('pyrite');
    assert.equal(pyRef.isOpaqueMetallic, true);
    assert.equal(pyRef.reflectancePct, 54.5);

    const quartz = optics.opticAxisInfo('quartz');
    assert.equal(quartz.className, 'uniaxial');
    assert.equal(quartz.sign, 'positive');

    const calcite = optics.opticAxisInfo('calcite');
    assert.equal(calcite.className, 'uniaxial');
    assert.equal(calcite.sign, 'negative');
    assert.ok(Math.abs(calcite.deltaN - 0.172) < 0.001);

    const topaz = optics.opticAxisInfo('topaz');
    assert.equal(topaz.className, 'biaxial');
    assert.equal(topaz.sign, 'positive');
    assert.ok(Math.abs(topaz.twoVDeg - 66.7) < 0.5);

    const chryso = optics.opticAxisInfo('chrysoberyl');
    assert.equal(chryso.sign, 'positive');
    assert.ok(Math.abs(chryso.twoVDeg - 56.4) < 0.5);

    const tanz = optics.opticAxisInfo('tanzanite');
    assert.equal(tanz.sign, 'positive');
    assert.ok(Math.abs(tanz.twoVDeg - 53.3) < 0.5);
  });

  check('Prism dispersion, Snell critical angle, Calcite walkoff & Refractometer OTL', () => {
    const fan = optics.prismDispersionFan('flint_prism', 60, 48);
    assert.ok(fan.rays.length >= 4);
    assert.ok(fan.rays[fan.rays.length - 1].n > fan.rays[0].n, 'Normal dispersion n(blue) > n(red)');

    const tirCheck = optics.snellBenchRay('diamond', 30, true);
    assert.ok(Math.abs(tirCheck.criticalDeg - 24.44) < 0.5, 'Diamond critical angle ~24.44 deg');
    assert.equal(tirCheck.tir, true);

    const split = optics.calciteDoubleRay('calcite', { thicknessMm: 6, tiltDeg: 45 });
    assert.equal(split.isIsotropic, false);
    assert.ok(split.separationMm > 0.3);

    assert.equal(optics.refractometerShadow('diamond').overLimit, true);
    assert.equal(optics.refractometerShadow('ruby').overLimit, false);
    assert.equal(optics.refractometerShadow('ruby').isDoublyRefractive, true);
  });

  check('Michel-Levy CIE strip & Jones Conoscope buffer (Quartz Bullseye + Isotropic + Opaque)', () => {
    const strip = optics.michelLevyStrip(120, 1650);
    assert.equal(strip.length, 120 * 3);

    const qCono = optics.renderConoscopeBuffer('quartz', { size: 48, thicknessMm: 2.0 });
    const midIdx = (24 * 48 + 24) * 4;
    const centerLum = qCono.rgba[midIdx] + qCono.rgba[midIdx + 1] + qCono.rgba[midIdx + 2];
    assert.ok(centerLum > 30, 'Quartz optical activity produces bright rotary bullseye center');

    const isoCono = optics.renderConoscopeBuffer('spinel', { size: 48 });
    assert.equal(isoCono.rgba[midIdx] + isoCono.rgba[midIdx + 1] + isoCono.rgba[midIdx + 2], 0);

    const pyCono = optics.renderConoscopeBuffer('pyrite', { size: 48 });
    assert.equal(pyCono.rgba[midIdx] + pyCono.rgba[midIdx + 1] + pyCono.rgba[midIdx + 2], 0);
  });

  check('Euler V - E + F = 2 & 3D twin callout anchors across all 24 single + 24 twin meshes', () => {
    assert.equal(data.MINERAL_CODEX.length, 24);
    for (const entry of data.MINERAL_CODEX) {
      for (const variant of ['single', 'twin']) {
        const m = meshes.buildMineralMesh(entry.id, { variant });
        assert.ok(m.solids.length >= (variant === 'twin' ? 2 : 1), `${entry.id} ${variant} solid count`);
        for (let si = 0; si < m.solids.length; si++) {
          const s = m.solids[si];
          const V = s.vertices.length;
          const F = s.faces.length;
          const E = s.edges.length;
          assert.equal(V - E + F, 2, `${entry.id} ${variant} solid#${si} satisfies Euler V-E+F=2 (got ${V}-${E}+${F})`);
        }
        if (variant === 'twin') {
          assert.ok(m.twinInfo, `${entry.id} twin has twinInfo`);
          assert.equal(m.twinInfo.planeOrigin3D.length, 3, `${entry.id} twin has 3D planeOrigin3D`);
          assert.equal(m.twinInfo.traceDir3D.length, 3, `${entry.id} twin has 3D traceDir3D`);
          assert.equal(m.twinInfo.notchAnchor3D.length, 3, `${entry.id} twin has 3D notchAnchor3D`);
          assert.ok(!m.twinInfo.lawZh.includes('放射状晶簇'), `${entry.id} does not use generic druse cluster`);
        }
      }
    }
  });

  check('Audited crystallographic twin angles & Hermann-Mauguin point-group symmetry rules', () => {
    const expectedAngles = {
      diamond: "141°04'",
      spinel: "141°04'",
      zircon: "95°41'",
      rutile: "114°26'",
      cassiterite: "112°09'",
      beryl: "90°07'",
      apatite: "68°41'",
      quartz: "84°33'",
      calcite: "90°45'",
      ruby: "64°47'",
      tourmaline: "125°16'",
      topaz: "57°58'",
      peridot: "119°16'",
      chrysoberyl: "59°35'",
      tanzanite: "116°29'",
      gypsum: "131°48'",
    };
    for (const [id, angleStr] of Object.entries(expectedAngles)) {
      const mTwin = meshes.buildMineralMesh(id, { variant: 'twin' });
      const codex = data.MINERAL_CODEX.find((m) => m.id === id);
      assert.ok(
        mTwin.twinInfo.reentrantTagEn.replace(/′/g, "'").includes(angleStr) || mTwin.twinInfo.lawZh.replace(/′/g, "'").includes(angleStr),
        `${id} twin mesh carries exact angle ${angleStr}`,
      );
      assert.ok(codex.twinLawZh.replace(/′/g, "'").includes(angleStr), `${id} codex twinLawZh carries exact angle ${angleStr}`);
    }

    // Tourmaline 3m: polar +c/-c, NO inversion center C, NO L2!
    const tourm = meshes.buildMineralMesh('tourmaline', { variant: 'single' });
    assert.ok(tourm.symmetrySummaryZh.startsWith('L3 · 3P') && tourm.symmetrySummaryZh.includes('无C'), 'Tourmaline 3m has L3 · 3P and no C');
    assert.ok(tourm.symmetryAxes.some((a) => a.label.includes('+c') && !a.label.includes('+C')), 'Tourmaline uses lowercase +c');

    // Pyrite 2/m3̄: NO L4!
    const pyrite = meshes.buildMineralMesh('pyrite', { variant: 'single' });
    assert.ok(pyrite.symmetrySummaryZh.startsWith('3L2') && pyrite.symmetrySummaryZh.includes('无L4'), 'Pyrite 2/m3̄ has no L4');
    assert.ok(!pyrite.symmetryAxes.some((a) => a.label.includes('L4')), 'Pyrite axes have no L4');

    // Apatite 6/m: NO horizontal L2!
    const apatite = meshes.buildMineralMesh('apatite', { variant: 'single' });
    assert.ok(apatite.symmetrySummaryZh.startsWith('L6') && apatite.symmetrySummaryZh.includes('无横L2'), 'Apatite 6/m has no horizontal L2');
    assert.ok(!apatite.symmetryAxes.some((a) => a.label.includes('L2')), 'Apatite axes have no L2');

    // Emerald Trapiche explicitly classified as growth_sector
    const emerald = meshes.buildMineralMesh('emerald', { variant: 'twin' });
    assert.equal(emerald.twinInfo.category, 'growth_sector');
  });

  check('MINERAL_CODEX and OPTICAL_MATERIALS 100% parameter consistency across all 24 minerals', () => {
    for (const entry of data.MINERAL_CODEX) {
      const mat = optics.getMaterial(entry.materialId || entry.id);
      assert.equal(Boolean(entry.opaqueMetallic), Boolean(mat.opaqueMetallic), `${entry.id} opaqueMetallic sync`);
      assert.ok(Math.abs(entry.sg - mat.sg) < 0.02, `${entry.id} SG sync (${entry.sg} vs ${mat.sg})`);
      if (!entry.opaqueMetallic) {
        const ax = optics.opticAxisInfo(entry.materialId || entry.id);
        assert.ok(Math.abs(entry.birefringence - ax.deltaN) < 0.0015, `${entry.id} birefringence sync`);
      }
    }
  });

  check('All 12 Simple Forms, 6 Forge Blueprints & 8 Detective Cases', () => {
    assert.equal(data.SIMPLE_FORMS_12.length, 12);
    for (const f of data.SIMPLE_FORMS_12) {
      assert.ok(meshes.buildSimpleFormMesh(f.id).totalFaces >= 4);
    }
    assert.equal(data.FORGE_CHALLENGES.length, 6);
    for (const ch of data.FORGE_CHALLENGES) {
      const built = meshes.buildForgeCombination({ ...ch.targetSlider, mode: ch.mode });
      assert.equal(built.totalFaces, ch.totalFaces);
    }
    assert.equal(data.DETECTIVE_CASES.length, 8);
    const codexIds = new Set(data.MINERAL_CODEX.map((m) => m.id));
    for (const c of data.DETECTIVE_CASES) {
      assert.ok(codexIds.has(c.truthMineralId));
      assert.ok(c.suspectIds.includes(c.truthMineralId));
    }
  });

  check('SUVA Brand Assets, Preserved V1, Pure Pixel Contract & Restricted Source-Available License', () => {
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
    assert.ok(v2Html.includes('ArkPixel12'));
    assert.ok(v2Html.includes('SUVA / 地质大学博士说AI / 苏哇科技'));
    assert.ok(!v2Html.includes('PingFang SC') && !v2Html.includes('Microsoft YaHei'));
    assert.ok(!v2Html.includes('<select') && !v2Main.includes('<select'));
    assert.equal((v2Html + v2Main).match(/[\u{1F300}-\u{1FAFF}]/gu), null);

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
