// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// Pure 3D Wulff Convex Half-Space Polyhedron Engine, Crystallographic Twins & Habit Forge
// Zero DOM / Browser Dependencies — Runs identically in Browser ES Modules & Node.js

const EPS = 1e-7;
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
const unit3 = (v) => {
  const l = len3(v);
  return l > 1e-14 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Rodrigues rotation of vector v around unit axis k by angleRad
function rotateAroundAxis(v, axis, angleRad) {
  const k = unit3(axis);
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const kv = dot3(k, v);
  const kxv = cross3(k, v);
  return [
    v[0] * c + kxv[0] * s + k[0] * kv * (1 - c),
    v[1] * c + kxv[1] * s + k[1] * kv * (1 - c),
    v[2] * c + kxv[2] * s + k[2] * kv * (1 - c),
  ];
}

// Mirror reflection across plane with unit normal n passing through origin
function reflectAcrossPlane(v, planeNormal) {
  const n = unit3(planeNormal);
  const d = 2 * dot3(v, n);
  return [v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]];
}

// Wulff half-space n_unit . x <= perpDistance
function wulffPlane(normal, perpDistance, { hkl = '{100}', familyZh = '晶面', rampKey = 'cube', formKey = null } = {}) {
  const u = unit3(normal);
  return {
    normal: u,
    distance: perpDistance,
    hkl,
    familyZh,
    rampKey,
    formKey: formKey || hkl,
  };
}

function pairedWulff(normal, perpDistance, meta) {
  return [
    wulffPlane(normal, perpDistance, meta),
    wulffPlane(scale3(normal, -1), perpDistance, meta),
  ];
}

function intersectThreePlanes(a, b, c) {
  const bc = cross3(b.normal, c.normal);
  const det = dot3(a.normal, bc);
  if (Math.abs(det) < 1e-9) return null;
  const term1 = scale3(bc, a.distance);
  const term2 = scale3(cross3(c.normal, a.normal), b.distance);
  const term3 = scale3(cross3(a.normal, b.normal), c.distance);
  return scale3(add3(add3(term1, term2), term3), 1 / det);
}

// Exact half-space intersection n_i . x <= d_i -> closed convex polyhedron
function solveConvexHalfSpaces(planes) {
  const rawVerts = [];
  const nPlanes = planes.length;

  for (let i = 0; i < nPlanes - 2; i++) {
    for (let j = i + 1; j < nPlanes - 1; j++) {
      for (let k = j + 1; k < nPlanes; k++) {
        const pt = intersectThreePlanes(planes[i], planes[j], planes[k]);
        if (!pt) continue;
        let inside = true;
        for (let m = 0; m < nPlanes; m++) {
          if (dot3(planes[m].normal, pt) - planes[m].distance > 1e-6) {
            inside = false;
            break;
          }
        }
        if (!inside) continue;
        let dup = false;
        for (let v = 0; v < rawVerts.length; v++) {
          if (len3(sub3(rawVerts[v], pt)) < 1e-5) {
            dup = true;
            break;
          }
        }
        if (!dup) rawVerts.push(pt);
      }
    }
  }

  const rawFaces = [];
  for (const p of planes) {
    let indices = [];
    for (let i = 0; i < rawVerts.length; i++) {
      if (Math.abs(dot3(p.normal, rawVerts[i]) - p.distance) < 2e-5) {
        indices.push(i);
      }
    }
    if (indices.length < 3) continue;

    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const idx of indices) {
      cx += rawVerts[idx][0];
      cy += rawVerts[idx][1];
      cz += rawVerts[idx][2];
    }
    const center = [cx / indices.length, cy / indices.length, cz / indices.length];
    const seed = Math.abs(p.normal[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const u = unit3(cross3(seed, p.normal));
    const v = cross3(p.normal, u); // u x v = +p.normal (outward CCW)

    indices.sort((ia, ib) => {
      const da = sub3(rawVerts[ia], center);
      const db = sub3(rawVerts[ib], center);
      return Math.atan2(dot3(da, v), dot3(da, u)) - Math.atan2(dot3(db, v), dot3(db, u));
    });

    // Prune collinear vertices
    indices = indices.filter((curr, idx, arr) => {
      const prev = rawVerts[arr[(idx + arr.length - 1) % arr.length]];
      const next = rawVerts[arr[(idx + 1) % arr.length]];
      return len3(cross3(sub3(rawVerts[curr], prev), sub3(next, rawVerts[curr]))) > 1e-6;
    });

    if (indices.length >= 3) {
      rawFaces.push({
        indices,
        normal: p.normal.slice(),
        hkl: p.hkl,
        familyZh: p.familyZh,
        rampKey: p.rampKey,
        formKey: p.formKey,
      });
    }
  }

  const usedSet = new Set();
  for (const f of rawFaces) {
    for (const idx of f.indices) usedSet.add(idx);
  }
  const used = [...usedSet].sort((a, b) => a - b);
  const remap = new Map(used.map((oldIdx, newIdx) => [oldIdx, newIdx]));

  const vertices = used.map((i) => rawVerts[i]);
  const faces = rawFaces.map((f) => ({
    indices: f.indices.map((i) => remap.get(i)),
    normal: f.normal,
    hkl: f.hkl,
    familyZh: f.familyZh,
    rampKey: f.rampKey,
    formKey: f.formKey,
  }));

  return buildEdgesForSolid({ vertices, faces });
}

function buildEdgesForSolid(solid) {
  const edgeMap = new Map();
  for (let fi = 0; fi < solid.faces.length; fi++) {
    const f = solid.faces[fi];
    // Guarantee outward CCW winding after any mirror/transform
    if (f.indices.length >= 3) {
      const v0 = solid.vertices[f.indices[0]];
      const v1 = solid.vertices[f.indices[1]];
      const v2 = solid.vertices[f.indices[2]];
      const geomN = cross3(sub3(v1, v0), sub3(v2, v0));
      if (dot3(geomN, f.normal) < 0) {
        f.indices.reverse();
      }
    }
    const m = f.indices.length;
    for (let k = 0; k < m; k++) {
      const a = f.indices[k];
      const b = f.indices[(k + 1) % m];
      const i = Math.min(a, b);
      const j = Math.max(a, b);
      const key = `${i}:${j}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { i, j, normals: [f.normal] });
      } else {
        edgeMap.get(key).normals.push(f.normal);
      }
    }
  }
  const edges = [];
  for (const e of edgeMap.values()) {
    const isCrease = e.normals.length !== 2 || dot3(e.normals[0], e.normals[1]) < 0.9992;
    edges.push([e.i, e.j, isCrease]);
  }
  return {
    vertices: solid.vertices,
    faces: solid.faces,
    edges,
  };
}

function transformSolid(solid, mapPoint, mapNormal = null, overrideRampKey = null) {
  const vertices = solid.vertices.map(mapPoint);
  const faces = solid.faces.map((f) => {
    let n = mapNormal ? unit3(mapNormal(f.normal)) : null;
    const indices = f.indices.slice();
    if (!n) {
      const v0 = vertices[indices[0]];
      const v1 = vertices[indices[1]];
      const v2 = vertices[indices[2]];
      n = unit3(cross3(sub3(v1, v0), sub3(v2, v0)));
    }
    return {
      indices,
      normal: n,
      hkl: f.hkl,
      familyZh: f.familyZh,
      rampKey: overrideRampKey || f.rampKey,
      formKey: f.formKey,
    };
  });
  return buildEdgesForSolid({ vertices, faces });
}

// Normalize an entire multi-solid assembly rigidly around [0, 0, 0] with max radius ~ 1.0
function normalizeAssembly(solids, targetRadius = 1.0) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const s of solids) {
    for (const v of s.vertices) {
      if (v[0] < minX) minX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  let maxR = 1e-6;
  for (const s of solids) {
    for (const v of s.vertices) {
      const r = Math.hypot(v[0] - cx, v[1] - cy, v[2] - cz);
      if (r > maxR) maxR = r;
    }
  }
  const k = targetRadius / maxR;

  return solids.map((s) => ({
    vertices: s.vertices.map((v) => [(v[0] - cx) * k, (v[1] - cy) * k, (v[2] - cz) * k]),
    faces: s.faces.map((f) => ({
      indices: f.indices.slice(),
      normal: f.normal.slice(),
      hkl: f.hkl,
      familyZh: f.familyZh,
      rampKey: f.rampKey,
      formKey: f.formKey || f.hkl,
    })),
    edges: s.edges.map((e) => e.slice()),
  }));
}

function explodeSolids(solids, explodeAmount = 0) {
  const amt = clamp(Number(explodeAmount) || 0, 0, 1);
  if (amt <= 1e-4) return solids;
  const disp = amt * 0.42;
  const shrink = 1 / (1 + amt * 0.28);

  return solids.map((s) => {
    const vertices = [];
    const faces = [];
    const edges = [];

    for (const f of s.faces) {
      const baseIdx = vertices.length;
      const m = f.indices.length;
      const newIndices = [];
      for (let k = 0; k < m; k++) {
        const orig = s.vertices[f.indices[k]];
        vertices.push([
          (orig[0] + f.normal[0] * disp) * shrink,
          (orig[1] + f.normal[1] * disp) * shrink,
          (orig[2] + f.normal[2] * disp) * shrink,
        ]);
        newIndices.push(baseIdx + k);
      }
      for (let k = 0; k < m; k++) {
        edges.push([baseIdx + k, baseIdx + ((k + 1) % m), true]);
      }
      faces.push({
        indices: newIndices,
        normal: f.normal.slice(),
        hkl: f.hkl,
        familyZh: f.familyZh,
        rampKey: f.rampKey,
        formKey: f.formKey || f.hkl,
      });
    }
    return { vertices, faces, edges };
  });
}

function sampleDihedralAngle(solids) {
  const s = solids[0];
  if (!s || s.faces.length < 2) {
    return { pair: '{100} ∠ {100}', internalDeg: 90, normalDeg: 90 };
  }
  // Find two adjacent faces sharing an edge (prefer distinct families if present)
  const vertToFaces = new Map();
  s.faces.forEach((f, fi) => {
    for (const vi of f.indices) {
      if (!vertToFaces.has(vi)) vertToFaces.set(vi, []);
      vertToFaces.get(vi).push(fi);
    }
  });

  let chosen = null;
  for (const [i, j, isCrease] of s.edges) {
    if (!isCrease) continue;
    const fAList = vertToFaces.get(i) || [];
    const fBList = vertToFaces.get(j) || [];
    const shared = fAList.filter((fi) => fBList.includes(fi));
    if (shared.length >= 2) {
      const f1 = s.faces[shared[0]];
      const f2 = s.faces[shared[1]];
      if (!chosen) chosen = [f1, f2];
      if (f1.hkl !== f2.hkl) {
        chosen = [f1, f2];
        break;
      }
    }
  }
  const [fa, fb] = chosen || [s.faces[0], s.faces[1]];
  const normalDeg = Math.acos(clamp(dot3(fa.normal, fb.normal), -1, 1)) * DEG;
  const internalDeg = 180 - normalDeg;
  return {
    pair: `${fa.hkl} ∠ ${fb.hkl}`,
    internalDeg: Number(internalDeg.toFixed(2)),
    normalDeg: Number(normalDeg.toFixed(2)),
  };
}

// Symmetry axes presets by crystal system
function axesForSystem(systemId, extra = {}) {
  switch (systemId) {
    case 'cubic':
      return [
        { label: 'L4 · a', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L4 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'L4 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
        { label: 'L3 [111]', dir: unit3([1, 1, 1]), colorHex: '#FFB830' },
      ];
    case 'tetragonal':
      return [
        { label: 'a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'a2', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'L4 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ];
    case 'hexagonal':
      return [
        { label: 'a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
        { label: 'a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
        { label: 'L6 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ];
    case 'trigonal':
      return [
        { label: 'a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
        { label: 'a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
        { label: 'L3 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ];
    case 'orthorhombic':
      return [
        { label: 'L2 · a', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L2 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'L2 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ];
    case 'monoclinic': {
      const beta = (extra.betaDeg || 114.1) * RAD;
      return [
        { label: 'a', dir: unit3([Math.sin(beta), 0, Math.cos(beta)]), colorHex: '#FF4D94' },
        { label: 'L2 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ];
    }
    case 'triclinic': {
      const A = (extra.alphaDeg || 94.3) * RAD;
      const B = (extra.betaDeg || 116.6) * RAD;
      const G = (extra.gammaDeg || 87.7) * RAD;
      const a = [Math.sin(B), 0, Math.cos(B)];
      const bx = (Math.cos(G) - Math.cos(B) * Math.cos(A)) / Math.sin(B);
      const bz = Math.cos(A);
      const b = [bx, Math.sqrt(Math.max(0.01, 1 - bx * bx - bz * bz)), bz];
      return [
        { label: 'a', dir: unit3(a), colorHex: '#FF4D94' },
        { label: 'b', dir: unit3(b), colorHex: '#00E5FF' },
        { label: 'c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ];
    }
    default:
      return axesForSystem('cubic');
  }
}

// Reusable cubic & hexagonal form plane generators
function planesCube100(d, rampKey = 'cube', familyZh = '立方体 {100}') {
  const meta = { hkl: '{100}', familyZh, rampKey, formKey: '{100}' };
  return [
    ...pairedWulff([1, 0, 0], d, meta),
    ...pairedWulff([0, 1, 0], d, meta),
    ...pairedWulff([0, 0, 1], d, meta),
  ];
}

function planesOcta111(d, rampKey = 'octa', familyZh = '八面体 {111}') {
  const out = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        out.push(wulffPlane([x, y, z], d, { hkl: '{111}', familyZh, rampKey, formKey: '{111}' }));
      }
    }
  }
  return out;
}

function planesTetra111(d, rampKey = 'octa', familyZh = '四面体 {111}') {
  const normals = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
  return normals.map((n) => wulffPlane(n, d, { hkl: '{111}', familyZh, rampKey, formKey: '{111}' }));
}

function planesDodeca110(d, rampKey = 'dodeca', familyZh = '菱形十二面体 {110}') {
  const out = [];
  for (let zero = 0; zero < 3; zero++) {
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const n = [0, 0, 0];
        n[(zero + 1) % 3] = a;
        n[(zero + 2) % 3] = b;
        out.push(wulffPlane(n, d, { hkl: '{110}', familyZh, rampKey, formKey: '{110}' }));
      }
    }
  }
  return out;
}

function planesPyrito210(d, rampKey = 'pyrito', familyZh = '五角十二面体 {210}') {
  const out = [];
  for (let cyc = 0; cyc < 3; cyc++) {
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const n = [0, 0, 0];
        n[cyc] = 2 * a;
        n[(cyc + 1) % 3] = b;
        out.push(wulffPlane(n, d, { hkl: '{210}', familyZh, rampKey, formKey: '{210}' }));
      }
    }
  }
  return out;
}

function planesTrap211(d, rampKey = 'trap', familyZh = '四角三八面体 {211}') {
  const out = [];
  for (let big = 0; big < 3; big++) {
    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) {
          const n = [x, y, z];
          n[big] *= 2;
          out.push(wulffPlane(n, d, { hkl: '{211}', familyZh, rampKey, formKey: '{211}' }));
        }
      }
    }
  }
  return out;
}

function planesHexoct321(d, rampKey = 'hexoct', familyZh = '六八面体 {321}') {
  const perms = [
    [3, 2, 1], [3, 1, 2], [2, 3, 1],
    [2, 1, 3], [1, 3, 2], [1, 2, 3],
  ];
  const out = [];
  for (const p of perms) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          out.push(
            wulffPlane([p[0] * sx, p[1] * sy, p[2] * sz], d, {
              hkl: '{321}',
              familyZh,
              rampKey,
              formKey: '{321}',
            })
          );
        }
      }
    }
  }
  return out;
}

function planesRhombohedron(d, zSlope = 0.88, rampKey = 'rhomb', familyZh = '菱面体 {10-11}') {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const ang = (k * TAU) / 3 + Math.PI / 6;
    const upper = [Math.cos(ang), Math.sin(ang), zSlope];
    out.push(...pairedWulff(upper, d, { hkl: '{10-11}', familyZh, rampKey, formKey: '{10-11}' }));
  }
  return out;
}

// Metric lattice plane builder for orthorhombic / monoclinic / triclinic habits
function buildMetricPlanes({
  angles = [90, 90, 90],
  a = 0.78,
  b = 0.62,
  c = 1.25,
  corner = 0.16,
  endSlopeA = 0.58,
  endSlopeB = 0.52,
  endCut = 0.16,
  rampSide = 'prism',
  rampEnd = 'pyramid',
  rampCap = 'pinacoid',
  sideLabel = '柱面',
  endLabel = '斜端面',
  capLabel = '平行双面',
}) {
  const [alpha, beta, gamma] = angles.map((x) => x * RAD);
  const va = [Math.sin(beta), 0, Math.cos(beta)];
  const bx = (Math.cos(gamma) - Math.cos(beta) * Math.cos(alpha)) / Math.sin(beta);
  const bz = Math.cos(alpha);
  const vb = [bx, Math.sqrt(Math.max(0.01, 1 - bx * bx - bz * bz)), bz];
  const vc = [0, 0, 1];
  const det = dot3(va, cross3(vb, vc));
  const rec = [cross3(vb, vc), cross3(vc, va), cross3(va, vb)].map((v) => scale3(v, 1 / det));
  const hklVec = (h, k, l) => add3(add3(scale3(rec[0], h), scale3(rec[1], k)), scale3(rec[2], l));

  const planes = [
    ...pairedWulff(hklVec(1, 0, 0), a, { hkl: '{100}', familyZh: sideLabel, rampKey: rampSide }),
    ...pairedWulff(hklVec(0, 1, 0), b, { hkl: '{010}', familyZh: sideLabel, rampKey: rampSide }),
    ...pairedWulff(hklVec(0, 0, 1), c, { hkl: '{001}', familyZh: capLabel, rampKey: rampCap }),
  ];

  if (corner > 0) {
    const diagD = (a + b) / Math.SQRT2 - corner * 0.35;
    for (const s of [-1, 1]) {
      planes.push(...pairedWulff(hklVec(1, s, 0), diagD, { hkl: '{110}', familyZh: sideLabel, rampKey: rampSide }));
    }
  }
  if (endCut > 0) {
    for (const s of [-1, 1]) {
      for (const t of [-1, 1]) {
        if (endSlopeA > 0) {
          const n = hklVec(s, 0, t * endSlopeA);
          const d = (a + c * endSlopeA) / Math.hypot(1, endSlopeA) - endCut * 0.4;
          planes.push(wulffPlane(n, d, { hkl: '{101}', familyZh: endLabel, rampKey: rampEnd }));
        }
        if (endSlopeB > 0) {
          const n = hklVec(0, s, t * endSlopeB);
          const d = (b + c * endSlopeB) / Math.hypot(1, endSlopeB) - endCut * 0.4;
          planes.push(wulffPlane(n, d, { hkl: '{011}', familyZh: endLabel, rampKey: rampEnd }));
        }
      }
    }
  }
  return planes;
}

// Build a natural 3-crystal druse cluster from a single-crystal base solid
function makeDruseCluster(baseSolid, mainRamp, subRampA = 'twinA', subRampB = 'twinB') {
  const main = transformSolid(
    baseSolid,
    (p) => add3(rotateAroundAxis(p, [0, 1, 0], -0.14), [-0.08, 0.0, 0.06]),
    (n) => rotateAroundAxis(n, [0, 1, 0], -0.14),
    mainRamp
  );
  const sub1 = transformSolid(
    baseSolid,
    (p) => add3(rotateAroundAxis(scale3(p, 0.66), [1, 0.4, 0.2], 0.62), [0.58, 0.22, -0.22]),
    (n) => rotateAroundAxis(n, [1, 0.4, 0.2], 0.62),
    subRampA
  );
  const sub2 = transformSolid(
    baseSolid,
    (p) => add3(rotateAroundAxis(scale3(p, 0.54), [-0.5, 1, 0.3], -0.58), [-0.52, -0.28, -0.3]),
    (n) => rotateAroundAxis(n, [-0.5, 1, 0.3], -0.58),
    subRampB
  );
  return [main, sub1, sub2];
}

// Exact Spinel Law {111} Contact Twin (Macle): two {111} octahedra clipped on (111),
// top half rotated 180 deg around [111] -> exact arccos(-7/9) = 141 deg 04' re-entrant V-notches!
function buildSpinelLawTwin() {
  const twinAxis = unit3([1, 1, 1]);
  const basePlanes = planesOcta111(1.0, 'twinA', '八面体 {111}');
  // Tabular macle compression on (111)/(-1-1-1) keeps exact {111} side normals & 141 deg 04' V-notch
  const planesA = basePlanes.map((p) => {
    const align = Math.abs(dot3(p.normal, twinAxis));
    return align > 0.99
      ? wulffPlane(p.normal, 0.68, { ...p, rampKey: 'twinA', familyZh: '双晶个体A {111}' })
      : wulffPlane(p.normal, 1.0, { ...p, rampKey: 'twinA', familyZh: '双晶个体A {111}' });
  });
  planesA.push(wulffPlane(twinAxis, 0.0, { hkl: '(111)', familyZh: '双晶接合面 (111)', rampKey: 'twinA' }));
  const solidA = solveConvexHalfSpaces(planesA);

  // Rotate 180 deg around [111] AND place in upper half-space (t . x >= 0):
  // equivalent to reflecting across t . x = 0 since {111} octahedron is centrosymmetric!
  const solidB = transformSolid(
    solidA,
    (p) => reflectAcrossPlane(p, twinAxis),
    (n) => reflectAcrossPlane(n, twinAxis),
    'twinB'
  );
  return [solidA, solidB];
}

// Single-crystal & Twin definitions for all 24 MINERAL_CODEX IDs
const MINERAL_BUILDERS = {
  diamond() {
    const single = solveConvexHalfSpaces(planesOcta111(1.0, 'diamond', '金刚石八面体 {111}'));
    return {
      systemId: 'cubic',
      single: [single],
      twin: buildSpinelLawTwin(),
      twinInfo: {
        enabled: true,
        lawZh: '尖晶石律 {111} 扁平三角接触双晶 (Macle)',
        reentrantLabel: "双晶凹角 141°04'",
      },
    };
  },

  spinel() {
    const single = solveConvexHalfSpaces(planesOcta111(1.0, 'ruby', '尖晶石八面体 {111}'));
    return {
      systemId: 'cubic',
      single: [single],
      twin: buildSpinelLawTwin(),
      twinInfo: {
        enabled: true,
        lawZh: '尖晶石律 {111} 接触双晶 (沿 [111] 旋转 180°)',
        reentrantLabel: "双晶凹角 141°04'",
      },
    };
  },

  fluorite() {
    const cubeA = solveConvexHalfSpaces(planesCube100(1.0, 'emerald', '萤石立方体 {100}'));
    const twinA = transformSolid(cubeA, (p) => p, (n) => n, 'twinA');
    const twinB = transformSolid(
      cubeA,
      (p) => rotateAroundAxis(scale3(p, 0.96), [1, 1, 1], Math.PI / 3),
      (n) => rotateAroundAxis(n, [1, 1, 1], Math.PI / 3),
      'twinB'
    );
    return {
      systemId: 'cubic',
      single: [cubeA],
      twin: [twinA, twinB],
      twinInfo: {
        enabled: true,
        lawZh: '萤石律 [111] 贯穿双晶 (两立方体沿三次轴旋转穿插)',
        reentrantLabel: '立方体角顶穿出晶面 · 贯穿凹角',
      },
    };
  },

  garnet() {
    const single = solveConvexHalfSpaces(planesDodeca110(1.0, 'ruby', '石榴石菱形十二面体 {110}'));
    return {
      systemId: 'cubic',
      single: [single],
      twin: makeDruseCluster(single, 'ruby', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '石榴石围岩晶簇伴生群落 (3 晶体聚生)',
        reentrantLabel: '晶簇交生晶面夹角',
      },
    };
  },

  pyrite() {
    const single = solveConvexHalfSpaces(planesPyrito210(1.0, 'gold', '黄铁矿五角十二面体 {210}'));
    const twinA = transformSolid(single, (p) => p, (n) => n, 'twinA');
    const twinB = transformSolid(
      single,
      (p) => rotateAroundAxis(p, [0, 0, 1], Math.PI / 2),
      (n) => rotateAroundAxis(n, [0, 0, 1], Math.PI / 2),
      'twinB'
    );
    return {
      systemId: 'cubic',
      single: [single],
      twin: [twinA, twinB],
      twinInfo: {
        enabled: true,
        lawZh: '铁十字律 {110} 贯穿双晶 (两五角十二面体正交穿插)',
        reentrantLabel: '铁十字双晶屋脊凹槽',
      },
    };
  },

  zircon() {
    const planes = [
      ...pairedWulff([1, 0, 0], 0.82, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cyan' }),
      ...pairedWulff([0, 1, 0], 0.82, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cyan' }),
    ];
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        planes.push(...pairedWulff([s1, 0, s2 * 0.96], 1.02, { hkl: '{101}', familyZh: '四方双锥 {101}', rampKey: 'pyramid' }));
        planes.push(...pairedWulff([0, s1, s2 * 0.96], 1.02, { hkl: '{101}', familyZh: '四方双锥 {101}', rampKey: 'pyramid' }));
      }
    }
    const single = solveConvexHalfSpaces(planes);
    // Geniculated {011} V-twin
    const halfAngle = 31 * RAD;
    const clipPlanesL = [
      ...planes.map((p) => ({
        ...p,
        normal: rotateAroundAxis(p.normal, [0, 1, 0], -halfAngle),
        rampKey: 'twinA',
      })),
      wulffPlane([1, 0, 0], 0, { hkl: '(101)', familyZh: '膝状双晶面', rampKey: 'twinA' }),
    ];
    const left = solveConvexHalfSpaces(clipPlanesL);
    const right = transformSolid(left, (p) => reflectAcrossPlane(p, [1, 0, 0]), (n) => reflectAcrossPlane(n, [1, 0, 0]), 'twinB');
    return {
      systemId: 'tetragonal',
      single: [single],
      twin: [left, right],
      twinInfo: {
        enabled: true,
        lawZh: '四方氧化物/锆石型膝状接触双晶',
        reentrantLabel: '膝状双晶肘部凹角 ~118°',
      },
    };
  },

  rutile() {
    const planes = [];
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.56, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'ruby' }));
      const dAng = ang + Math.PI / 4;
      planes.push(wulffPlane([Math.cos(dAng), Math.sin(dAng), 0], 0.58, { hkl: '{110}', familyZh: '复四方柱 {110}', rampKey: 'pyrito' }));
      planes.push(...pairedWulff([Math.cos(dAng), Math.sin(dAng), 0.72], 1.06, { hkl: '{111}', familyZh: '四方双锥 {111}', rampKey: 'pyramid' }));
    }
    const single = solveConvexHalfSpaces(planes);
    // Rutile {011} Knee Twin (~114 deg 25' -> half-angle 32.8 deg from horizontal / 57.2 deg)
    const tilt = 32.8 * RAD;
    const shiftPlanes = planes.map((p) => {
      const rn = rotateAroundAxis(p.normal, [0, 1, 0], -tilt);
      const offset = dot3(rn, [-0.28, 0, 0.35]);
      return wulffPlane(rn, p.distance + offset, { ...p, rampKey: 'twinA' });
    });
    shiftPlanes.push(wulffPlane([1, 0, 0], 0, { hkl: '(011)', familyZh: '膝状双晶接合面 (011)', rampKey: 'twinA' }));
    const kneeA = solveConvexHalfSpaces(shiftPlanes);
    const kneeB = transformSolid(kneeA, (p) => reflectAcrossPlane(p, [1, 0, 0]), (n) => reflectAcrossPlane(n, [1, 0, 0]), 'twinB');
    return {
      systemId: 'tetragonal',
      single: [single],
      twin: [kneeA, kneeB],
      twinInfo: {
        enabled: true,
        lawZh: '金红石律 {011} 膝状双晶 (Geniculated Knee Twin)',
        reentrantLabel: "膝状双晶夹角 ~114°25'",
      },
    };
  },

  cassiterite() {
    const planes = [
      ...pairedWulff([0, 0, 1], 1.05, { hkl: '{001}', familyZh: '平行双面 {001}', rampKey: 'pinacoid' }),
    ];
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.78, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'pyrito' }));
      const dAng = ang + Math.PI / 4;
      planes.push(wulffPlane([Math.cos(dAng), Math.sin(dAng), 0], 0.80, { hkl: '{110}', familyZh: '次四方柱 {110}', rampKey: 'trap' }));
      planes.push(...pairedWulff([Math.cos(dAng), Math.sin(dAng), 0.85], 0.98, { hkl: '{111}', familyZh: '四方双锥 {111}', rampKey: 'pyramid' }));
    }
    const single = solveConvexHalfSpaces(planes);
    const tilt = 34 * RAD;
    const visorPlanes = planes.map((p) => {
      const rn = rotateAroundAxis(p.normal, [0, 1, 0], -tilt);
      const offset = dot3(rn, [-0.2, 0, 0.22]);
      return wulffPlane(rn, p.distance + offset, { ...p, rampKey: 'twinA' });
    });
    visorPlanes.push(wulffPlane([1, 0, 0], 0, { hkl: '(011)', familyZh: '锡石肘状双晶面 (011)', rampKey: 'twinA' }));
    const halfA = solveConvexHalfSpaces(visorPlanes);
    const halfB = transformSolid(halfA, (p) => reflectAcrossPlane(p, [1, 0, 0]), (n) => reflectAcrossPlane(n, [1, 0, 0]), 'twinB');
    return {
      systemId: 'tetragonal',
      single: [single],
      twin: [halfA, halfB],
      twinInfo: {
        enabled: true,
        lawZh: '锡石 {011} 肘状帽舌双晶 (Visor Twin)',
        reentrantLabel: '锡石帽舌双晶深凹槽',
      },
    };
  },

  beryl() {
    const planes = [...pairedWulff([0, 0, 1], 1.25, { hkl: '{0001}', familyZh: '平行双面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.76, { hkl: '{10-10}', familyZh: '六方柱 {10-10}', rampKey: 'cyan' }));
    }
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'hexagonal',
      single: [single],
      twin: makeDruseCluster(single, 'cyan', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '绿柱石放射状六方晶簇群落 (3 柱伴生)',
        reentrantLabel: '六方晶柱放射交生角',
      },
    };
  },

  emerald() {
    const planes = [...pairedWulff([0, 0, 1], 1.12, { hkl: '{0001}', familyZh: '平行双面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.78, { hkl: '{10-10}', familyZh: '六方柱 {10-10}', rampKey: 'emerald' }));
      planes.push(...pairedWulff([nx, ny, 0.85], 1.18, { hkl: '{10-11}', familyZh: '六方双锥窄截角 {10-11}', rampKey: 'prism' }));
    }
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'hexagonal',
      single: [single],
      twin: makeDruseCluster(single, 'emerald', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '哥伦比亚式祖母绿方解石脉伴生晶簇',
        reentrantLabel: '六方柱簇交生凹槽',
      },
    };
  },

  apatite() {
    const planes = [...pairedWulff([0, 0, 1], 1.06, { hkl: '{0001}', familyZh: '底面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.78, { hkl: '{10-10}', familyZh: '六方柱 {10-10}', rampKey: 'cyan' }));
      planes.push(...pairedWulff([nx, ny, 0.78], 1.02, { hkl: '{10-11}', familyZh: '六方双锥 {10-11}', rampKey: 'octa' }));
    }
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'hexagonal',
      single: [single],
      twin: makeDruseCluster(single, 'cyan', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '氟磷灰石板柱状晶簇聚生体',
        reentrantLabel: '六方聚形晶簇交生角',
      },
    };
  },

  quartz() {
    const planes = [];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.68, { hkl: '{10-10}', familyZh: '六方柱 m {10-10}', rampKey: 'violet' }));
      const isR = i % 2 === 0;
      planes.push(
        ...pairedWulff([nx, ny, 0.79], isR ? 0.98 : 1.06, {
          hkl: isR ? '{10-11}' : '{01-11}',
          familyZh: isR ? '正菱面体 r {10-11}' : '负菱面体 z {01-11}',
          rampKey: isR ? 'octa' : 'rhomb',
        })
      );
    }
    const single = solveConvexHalfSpaces(planes);

    // Authentic Japan Law {11-22} Contact Twin: two c-axes intersect at 84 deg 33' (half-angle 42.275 deg)
    const halfJapan = 42.275 * RAD;
    const jPlanes = planes.map((p) => {
      const rn = rotateAroundAxis(p.normal, [0, 1, 0], -halfJapan);
      const offset = dot3(rn, [-0.42, 0, 0.44]);
      return wulffPlane(rn, p.distance * 0.85 + offset, { ...p, rampKey: 'twinA' });
    });
    jPlanes.push(wulffPlane([1, 0, 0], 0, { hkl: '(11-22)', familyZh: '日本律接合面 (11-22)', rampKey: 'twinA' }));
    const leftQ = solveConvexHalfSpaces(jPlanes);
    const rightQ = transformSolid(leftQ, (p) => reflectAcrossPlane(p, [1, 0, 0]), (n) => reflectAcrossPlane(n, [1, 0, 0]), 'twinB');

    return {
      systemId: 'trigonal',
      single: [single],
      twin: [leftQ, rightQ],
      twinInfo: {
        enabled: true,
        lawZh: '石英日本律 {11-22} 接触双晶 (V字燕尾水晶)',
        reentrantLabel: "日本律双晶夹角 84°33'",
      },
    };
  },

  calcite() {
    const basePlanes = planesRhombohedron(0.88, 0.86, 'rhomb', '方解石菱面体 {10-11}');
    const single = solveConvexHalfSpaces(basePlanes);
    // Calcite {0001} basal contact twin: clip z <= 0 and rotate upper half 180 deg around c [001]
    const planesLower = [
      ...basePlanes.map((p) => ({ ...p, rampKey: 'twinA' })),
      wulffPlane([0, 0, 1], 0, { hkl: '(0001)', familyZh: '双晶接合面 (0001)', rampKey: 'twinA' }),
    ];
    const lower = solveConvexHalfSpaces(planesLower);
    const upper = transformSolid(
      lower,
      (p) => [p[0], -p[1], -p[2]], // mirror z + 180 z-rot preserves trigonal mirror across (0001)!
      (n) => [n[0], -n[1], -n[2]],
      'twinB'
    );
    return {
      systemId: 'trigonal',
      single: [single],
      twin: [lower, upper],
      twinInfo: {
        enabled: true,
        lawZh: '冰洲石 {0001} 底面接触双晶 (沿 c 轴旋转 180°)',
        reentrantLabel: '菱面体腰部三组双晶凹角',
      },
    };
  },

  ruby() {
    const planes = [...pairedWulff([0, 0, 1], 0.88, { hkl: '{0001}', familyZh: '刚玉底面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.82, { hkl: '{11-20}', familyZh: '六方柱 {11-20}', rampKey: 'ruby' }));
      planes.push(...pairedWulff([nx, ny, 0.65], 0.96 + (i % 2 ? 0.03 : 0), { hkl: '{10-11}', familyZh: '菱面体/桶状端面', rampKey: 'pyramid' }));
    }
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'trigonal',
      single: [single],
      twin: makeDruseCluster(single, 'ruby', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '红宝石大理岩母岩伴生双晶簇',
        reentrantLabel: '刚玉聚生双晶缝',
      },
    };
  },

  sapphire() {
    const planes = [...pairedWulff([0, 0, 1], 1.32, { hkl: '{0001}', familyZh: '刚玉小底面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.72, { hkl: '{11-20}', familyZh: '六方柱 {11-20}', rampKey: 'sapphire' }));
      planes.push(...pairedWulff([nx, ny, 0.48], 0.86, { hkl: '{22-43}', familyZh: '陡六方双锥 {22-43}', rampKey: 'octa' }));
    }
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'trigonal',
      single: [single],
      twin: makeDruseCluster(single, 'sapphire', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '锡兰型蓝宝石双锥晶簇聚生体',
        reentrantLabel: '陡双锥交生夹角',
      },
    };
  },

  tourmaline() {
    const planes = [
      wulffPlane([0, 0, 1], 1.28, { hkl: '(0001)', familyZh: '上极单面 (0001)', rampKey: 'pinacoid' }),
      wulffPlane([0, 0, -1], 1.22, { hkl: '(000-1)', familyZh: '下极单面 (000-1)', rampKey: 'pinacoid' }),
    ];
    for (let i = 0; i < 3; i++) {
      const ang = (i * TAU) / 3 + Math.PI / 6;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.56, { hkl: '{10-10}', familyZh: '三方柱主面 {10-10}', rampKey: 'emerald' }));
      planes.push(wulffPlane([Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), 0], 0.80, { hkl: '{11-20}', familyZh: '六方柱窄面 {11-20}', rampKey: 'prism' }));
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0.62], 1.02, { hkl: '{10-11}', familyZh: '上端三方锥 {10-11}', rampKey: 'pyramid' }));
      planes.push(wulffPlane([Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), -0.85], 1.15, { hkl: '{02-21}', familyZh: '下端异极锥面', rampKey: 'ruby' }));
    }
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'trigonal',
      single: [single],
      twin: makeDruseCluster(single, 'emerald', 'ruby', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '电气石“西瓜碧玺”放射状晶簇群',
        reentrantLabel: '异极三方柱放射交角',
      },
    };
  },

  topaz() {
    const planes = buildMetricPlanes({
      angles: [90, 90, 90],
      a: 0.82,
      b: 0.60,
      c: 1.24,
      corner: 0.22,
      endSlopeA: 0.72,
      endSlopeB: 0.58,
      endCut: 0.22,
      rampSide: 'pyrito',
      rampEnd: 'trap',
      rampCap: 'pinacoid',
      sideLabel: '斜方柱 {110}/{120}',
      endLabel: '斜方双锥/坡面',
      capLabel: '平行双面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'orthorhombic',
      single: [single],
      twin: makeDruseCluster(single, 'pyrito', 'twinA', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '托帕石流纹岩晶洞双晶簇',
        reentrantLabel: '斜方柱晶簇交生角',
      },
    };
  },

  peridot() {
    const planes = buildMetricPlanes({
      angles: [90, 90, 90],
      a: 0.84,
      b: 0.58,
      c: 1.02,
      corner: 0.22,
      endSlopeA: 0.66,
      endSlopeB: 0.60,
      endCut: 0.24,
      rampSide: 'prism',
      rampEnd: 'dodeca',
      rampCap: 'pinacoid',
      sideLabel: '橄榄石斜方柱面',
      endLabel: '斜方坡面 {021}/{101}',
      capLabel: '底面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);
    // Orthorhombic {011} heart-like V-twin
    const vAng = 30 * RAD;
    const left = transformSolid(
      single,
      (p) => add3(rotateAroundAxis(scale3(p, 0.82), [1, 0, 0], -vAng), [0, -0.32, 0.1]),
      (n) => rotateAroundAxis(n, [1, 0, 0], -vAng),
      'twinA'
    );
    const right = transformSolid(
      single,
      (p) => add3(rotateAroundAxis(scale3(p, 0.82), [1, 0, 0], vAng), [0, 0.32, 0.1]),
      (n) => rotateAroundAxis(n, [1, 0, 0], vAng),
      'twinB'
    );
    return {
      systemId: 'orthorhombic',
      single: [single],
      twin: [left, right],
      twinInfo: {
        enabled: true,
        lawZh: '镁橄榄石 {011} 心形接触双晶',
        reentrantLabel: '心形双晶顶部凹槽 ~120°',
      },
    };
  },

  chrysoberyl() {
    const planes = buildMetricPlanes({
      angles: [90, 90, 90],
      a: 0.92,
      b: 0.68,
      c: 0.36,
      corner: 0.24,
      endSlopeA: 0.58,
      endSlopeB: 0.68,
      endCut: 0.14,
      rampSide: 'emerald',
      rampEnd: 'gold',
      rampCap: 'pinacoid',
      sideLabel: '金绿宝石板柱面',
      endLabel: '斜方锥面',
      capLabel: '宽板面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);

    // Iconic Pseudo-Hexagonal Cyclic Trilling {031} (三连晶轮式双晶): 3 sectors at 0, 120, 240 deg!
    const sectorPlanes = [
      ...pairedWulff([0, 0, 1], 0.34, { hkl: '{001}', familyZh: '三连晶板面 {001}', rampKey: 'twinA' }),
      wulffPlane([1, 0, 0], 0.95, { hkl: '{100}', familyZh: '外缘燕尾晶面', rampKey: 'twinA' }),
      wulffPlane([0.82, 0.57, 0], 0.88, { hkl: '{110}', familyZh: '燕尾凹角斜面', rampKey: 'twinA' }),
      wulffPlane([0.82, -0.57, 0], 0.88, { hkl: '{1-10}', familyZh: '燕尾凹角斜面', rampKey: 'twinA' }),
      wulffPlane([-0.5, Math.sqrt(3) / 2, 0], 0.0, { hkl: '(031)', familyZh: '轮式双晶接合面', rampKey: 'twinA' }),
      wulffPlane([-0.5, -Math.sqrt(3) / 2, 0], 0.0, { hkl: '(0-31)', familyZh: '轮式双晶接合面', rampKey: 'twinA' }),
    ];
    const sec0 = solveConvexHalfSpaces(sectorPlanes);
    const sec1 = transformSolid(
      sec0,
      (p) => rotateAroundAxis(p, [0, 0, 1], TAU / 3),
      (n) => rotateAroundAxis(n, [0, 0, 1], TAU / 3),
      'twinB'
    );
    const sec2 = transformSolid(
      sec0,
      (p) => rotateAroundAxis(p, [0, 0, 1], (2 * TAU) / 3),
      (n) => rotateAroundAxis(n, [0, 0, 1], (2 * TAU) / 3),
      'gold'
    );

    return {
      systemId: 'orthorhombic',
      single: [single],
      twin: [sec0, sec1, sec2],
      twinInfo: {
        enabled: true,
        lawZh: '金绿宝石/变石 {031} 假六方轮式三连晶 (Cyclic Trilling)',
        reentrantLabel: '假六方边缘燕尾双晶凹槽 (实为斜方二轴晶!)',
      },
    };
  },

  tanzanite() {
    const planes = buildMetricPlanes({
      angles: [90, 90, 90],
      a: 0.72,
      b: 0.56,
      c: 1.38,
      corner: 0.18,
      endSlopeA: 0.62,
      endSlopeB: 0.50,
      endCut: 0.20,
      rampSide: 'violet',
      rampEnd: 'sapphire',
      rampCap: 'pinacoid',
      sideLabel: '黝帘石纵纹柱面',
      endLabel: '斜方端坡面',
      capLabel: '端面',
    });
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'orthorhombic',
      single: [single],
      twin: makeDruseCluster(single, 'violet', 'sapphire', 'twinA'),
      twinInfo: {
        enabled: true,
        lawZh: '坦桑石平行连生柱状晶簇',
        reentrantLabel: '斜方柱平行连生阶梯凹槽',
      },
    };
  },

  gypsum() {
    const planes = buildMetricPlanes({
      angles: [90, 114.1, 90],
      a: 0.78,
      b: 0.34,
      c: 1.32,
      corner: 0.14,
      endSlopeA: 0.45,
      endSlopeB: 0.0,
      endCut: 0.14,
      rampSide: 'rhomb',
      rampEnd: 'pyramid',
      rampCap: 'pinacoid',
      sideLabel: '透石膏单斜板面 {010}/{110}',
      endLabel: '单斜斜端面 {-111}',
      capLabel: '斜顶面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);

    // Classic Gypsum {100} Swallowtail Contact Twin (石膏燕尾双晶)!
    const swPlanes = planes.map((p) => {
      const offset = dot3(p.normal, [-0.32, 0, 0]);
      return wulffPlane(p.normal, p.distance + offset, { ...p, rampKey: 'twinA' });
    });
    swPlanes.push(wulffPlane([1, 0, 0], 0.0, { hkl: '(100)', familyZh: '燕尾双晶接合面 (100)', rampKey: 'twinA' }));
    const leftWing = solveConvexHalfSpaces(swPlanes);
    const rightWing = transformSolid(
      leftWing,
      (p) => reflectAcrossPlane(p, [1, 0, 0]),
      (n) => reflectAcrossPlane(n, [1, 0, 0]),
      'twinB'
    );

    return {
      systemId: 'monoclinic',
      axisExtra: { betaDeg: 114.1 },
      single: [single],
      twin: [leftWing, rightWing],
      twinInfo: {
        enabled: true,
        lawZh: '透石膏 {100} 燕尾接触双晶 (Swallowtail Twin)',
        reentrantLabel: '顶部 V 字燕尾双晶凹角 ~132°',
      },
    };
  },

  orthoclase() {
    const planes = buildMetricPlanes({
      angles: [90, 116.07, 90],
      a: 0.82,
      b: 0.58,
      c: 1.12,
      corner: 0.12,
      endSlopeA: 0.48,
      endSlopeB: 0.0,
      endCut: 0.15,
      rampSide: 'trap',
      rampEnd: 'pyrito',
      rampCap: 'pinacoid',
      sideLabel: '正长石单斜柱面 {110}/{010}',
      endLabel: '后斜坡面 {-201}',
      capLabel: '底面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);

    // Carlsbad [001] Penetration Twin: two monoclinic individuals rotated 180 deg around c [001], offset along b (y)
    const carlA = transformSolid(single, (p) => add3(p, [0, -0.18, 0.05]), (n) => n, 'twinA');
    const carlB = transformSolid(
      single,
      (p) => add3(rotateAroundAxis(p, [0, 0, 1], Math.PI), [0, 0.18, -0.05]),
      (n) => rotateAroundAxis(n, [0, 0, 1], Math.PI),
      'twinB'
    );

    return {
      systemId: 'monoclinic',
      axisExtra: { betaDeg: 116.07 },
      single: [single],
      twin: [carlA, carlB],
      twinInfo: {
        enabled: true,
        lawZh: '正长石卡斯巴律 [001] 贯穿双晶 (Carlsbad Twin)',
        reentrantLabel: '反向倾斜 {001} 端面贯穿阶梯凹角',
      },
    };
  },

  kyanite() {
    const planes = buildMetricPlanes({
      angles: [89.99, 101.11, 106.03],
      a: 0.28,
      b: 0.76,
      c: 1.55,
      corner: 0.0,
      endSlopeA: 0.0,
      endSlopeB: 0.0,
      endCut: 0.0,
      rampSide: 'sapphire',
      rampEnd: 'cyan',
      rampCap: 'pinacoid',
      sideLabel: '蓝晶石三斜扁板面 {100}',
      endLabel: '三斜斜面',
      capLabel: '三斜端面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);
    return {
      systemId: 'triclinic',
      axisExtra: { alphaDeg: 89.99, betaDeg: 101.11, gammaDeg: 106.03 },
      single: [single],
      twin: makeDruseCluster(single, 'sapphire', 'cyan', 'twinB'),
      twinInfo: {
        enabled: true,
        lawZh: '蓝晶石放射板刃晶簇 (硬度异向三斜板晶)',
        reentrantLabel: '三斜板晶放射交生角',
      },
    };
  },

  albite() {
    const planes = buildMetricPlanes({
      angles: [94.26, 116.6, 87.71],
      a: 0.85,
      b: 0.32,
      c: 1.08,
      corner: 0.08,
      endSlopeA: 0.35,
      endSlopeB: 0.0,
      endCut: 0.10,
      rampSide: 'cyan',
      rampEnd: 'octa',
      rampCap: 'pinacoid',
      sideLabel: '钠长石三斜板面 {010}',
      endLabel: '三斜端斜面',
      capLabel: '斜顶面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);

    // Albite {010} Polysynthetic Lamellar Twin (3 alternating triclinic lamellae!)
    const lam0 = transformSolid(single, (p) => [p[0], p[1] * 0.65 - 0.42, p[2]], null, 'twinA');
    const lam1 = transformSolid(
      single,
      (p) => {
        const m = reflectAcrossPlane(p, [0, 1, 0]);
        return [m[0], m[1] * 0.65, m[2]];
      },
      null,
      'twinB'
    );
    const lam2 = transformSolid(single, (p) => [p[0], p[1] * 0.65 + 0.42, p[2]], null, 'twinA');

    return {
      systemId: 'triclinic',
      axisExtra: { alphaDeg: 94.26, betaDeg: 116.6, gammaDeg: 87.71 },
      single: [single],
      twin: [lam0, lam1, lam2],
      twinInfo: {
        enabled: true,
        lawZh: '钠长石律 {010} 聚片三连双晶 (Polysynthetic Twin)',
        reentrantLabel: '三斜底面聚片双晶阶梯细凹槽',
      },
    };
  },
};

const MINERAL_MESH_CACHE = new Map();

export function buildMineralMesh(mineralId, { variant = 'single', explode = 0 } = {}) {
  const key = Object.hasOwn(MINERAL_BUILDERS, mineralId) ? mineralId : 'quartz';
  const mode = variant === 'twin' ? 'twin' : 'single';
  const cacheKey = `${key}:${mode}`;

  let base = MINERAL_MESH_CACHE.get(cacheKey);
  if (!base) {
    const built = MINERAL_BUILDERS[key]();
    const rawSolids = mode === 'twin' ? built.twin : built.single;
    const solids = normalizeAssembly(rawSolids, 1.0);
    const totalFaces = solids.reduce((acc, s) => acc + s.faces.length, 0);
    base = {
      solids,
      symmetryAxes: axesForSystem(built.systemId, built.axisExtra || {}),
      twinInfo: mode === 'twin' ? built.twinInfo : null,
      totalFaces,
      dihedralSample: sampleDihedralAngle(solids),
    };
    MINERAL_MESH_CACHE.set(cacheKey, base);
  }

  const finalSolids = explode > 1e-4 ? explodeSolids(base.solids, explode) : base.solids;
  return {
    solids: finalSolids,
    symmetryAxes: base.symmetryAxes,
    twinInfo: base.twinInfo,
    totalFaces: base.totalFaces,
    dihedralSample: base.dihedralSample,
  };
}

// 12 Crystallographic Simple Forms & Canonical Combinations (SIMPLE_FORMS_12)
const SIMPLE_FORM_CACHE = new Map();

export function buildSimpleFormMesh(formId) {
  const key = String(formId || 'cube_100');
  if (SIMPLE_FORM_CACHE.has(key)) {
    return SIMPLE_FORM_CACHE.get(key);
  }

  let planes = [];
  let systemId = 'cubic';

  switch (key) {
    case 'cube_100':
      planes = planesCube100(1.0, 'cube', '立方体 {100}');
      break;
    case 'octa_111':
      planes = planesOcta111(1.0, 'octa', '八面体 {111}');
      break;
    case 'tetra_111':
      planes = planesTetra111(1.0, 'octa', '四面体 {111}');
      break;
    case 'dodeca_110':
      planes = planesDodeca110(1.0, 'dodeca', '菱形十二面体 {110}');
      break;
    case 'pyrito_210':
      planes = planesPyrito210(1.0, 'pyrito', '五角十二面体 {210}');
      break;
    case 'trap_211':
      planes = planesTrap211(1.0, 'trap', '四角三八面体 {211}');
      break;
    case 'hexoct_321':
      planes = planesHexoct321(1.0, 'hexoct', '六八面体 {321}');
      break;
    case 'hex_prism': {
      systemId = 'hexagonal';
      planes = [
        ...pairedWulff([0, 0, 1], 1.15, { hkl: '{0001}', familyZh: '开放端截窗 {0001}', rampKey: 'pinacoid' }),
      ];
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 6 + (i * Math.PI) / 3;
        planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.80, { hkl: '{10-10}', familyZh: '六方柱 {10-10}', rampKey: 'prism' }));
      }
      break;
    }
    case 'tetrag_pyr': {
      systemId = 'tetragonal';
      planes = [
        wulffPlane([0, 0, -1], 0.65, { hkl: '(00-1)', familyZh: '底面截窗 (开放单形封底)', rampKey: 'pinacoid' }),
      ];
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          planes.push(wulffPlane([sx, sy, 1.05], 0.82, { hkl: '{111}', familyZh: '四方单锥 {111}', rampKey: 'pyramid' }));
        }
      }
      break;
    }
    case 'rhombo':
      systemId = 'trigonal';
      planes = planesRhombohedron(0.90, 0.86, 'rhomb', '菱面体 {10-11}');
      break;
    case 'trunc_100':
      planes = [
        ...planesCube100(1.0, 'cube', '立方体 {100}'),
        ...planesOcta111(1.0, 'octa', '八面体 {111}'),
      ];
      break;
    case 'master_26':
    default:
      planes = [
        ...planesCube100(1.0, 'cube', '立方体 {100}'),
        ...planesOcta111(1.0, 'octa', '八面体 {111}'),
        ...planesDodeca110(1.12, 'dodeca', '菱形十二面体 {110}'),
      ];
      break;
  }

  const raw = solveConvexHalfSpaces(planes);
  const solids = normalizeAssembly([raw], 1.0);
  const res = {
    solids,
    symmetryAxes: axesForSystem(systemId),
    twinInfo: null,
    totalFaces: solids[0].faces.length,
    dihedralSample: sampleDihedralAngle(solids),
  };
  SIMPLE_FORM_CACHE.set(key, res);
  return res;
}

// Habit Forge Combination Engine ("一色一单形" One Ink Per Form)
export function buildForgeCombination({
  d100 = 1.0,
  d111 = 1.0,
  d110 = 1.15,
  d211 = 1.45,
  mode = 'cubic',
} = {}) {
  const s100 = clamp(Number(d100) || 1.0, 0.35, 2.5);
  const s111 = clamp(Number(d111) || 1.0, 0.35, 2.5);
  const s110 = clamp(Number(d110) || 1.15, 0.35, 2.5);
  const s211 = clamp(Number(d211) || 1.45, 0.35, 2.5);

  let planes = [];
  let systemId = 'cubic';

  if (mode === 'tetragonal') {
    systemId = 'tetragonal';
    // {100} -> Tetragonal 1st-order prism (pink 'cube')
    planes.push(
      ...pairedWulff([1, 0, 0], s100, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cube', formKey: '{100}' }),
      ...pairedWulff([0, 1, 0], s100, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cube', formKey: '{100}' })
    );
    // {111} -> Tetragonal dipyramid (blue 'octa')
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          planes.push(wulffPlane([sx, sy, sz * 1.08], s111, { hkl: '{111}', familyZh: '四方双锥 {111}', rampKey: 'octa', formKey: '{111}' }));
        }
      }
    }
    // {110} -> Tetragonal 2nd-order prism (lime 'dodeca')
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        planes.push(wulffPlane([sx, sy, 0], s110, { hkl: '{110}', familyZh: '次四方柱 {110}', rampKey: 'dodeca', formKey: '{110}' }));
      }
    }
    // {211} -> Basal pinacoid {001} (coral 'trap')
    planes.push(
      ...pairedWulff([0, 0, 1], s211, { hkl: '{001}', familyZh: '平行双面 {001}', rampKey: 'trap', formKey: '{211}' })
    );
  } else if (mode === 'hexagonal') {
    systemId = 'hexagonal';
    // {100} -> Hexagonal 1st-order prism {10-10} (6 faces, pink 'cube')
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], s100, { hkl: '{10-10}', familyZh: '六方柱 {10-10}', rampKey: 'cube', formKey: '{100}' }));
      // {111} -> Hexagonal dipyramid {10-11} (12 faces, blue 'octa')
      planes.push(...pairedWulff([Math.cos(ang), Math.sin(ang), 0.92], s111, { hkl: '{10-11}', familyZh: '六方双锥 {10-11}', rampKey: 'octa', formKey: '{111}' }));
    }
    // {110} -> Basal pinacoid {0001} (2 faces, lime 'dodeca')
    planes.push(
      ...pairedWulff([0, 0, 1], s110, { hkl: '{0001}', familyZh: '平行双面 {0001}', rampKey: 'dodeca', formKey: '{110}' })
    );
    // {211} -> Hexagonal 2nd-order prism {11-20} (6 faces, coral 'trap')
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], s211, { hkl: '{11-20}', familyZh: '第二六方柱 {11-20}', rampKey: 'trap', formKey: '{211}' }));
    }
  } else {
    // Cubic m-3m combination: {100} + {111} + {110} + {211}
    planes = [
      ...planesCube100(s100, 'cube', '立方体 {100}'),
      ...planesOcta111(s111, 'octa', '八面体 {111}'),
      ...planesDodeca110(s110, 'dodeca', '菱形十二面体 {110}'),
      ...planesTrap211(s211, 'trap', '四角三八面体 {211}'),
    ];
  }

  const raw = solveConvexHalfSpaces(planes);
  const byForm = { '{100}': 0, '{111}': 0, '{110}': 0, '{211}': 0 };
  for (const f of raw.faces) {
    if (Object.hasOwn(byForm, f.formKey)) {
      byForm[f.formKey] += 1;
    }
  }

  const solids = normalizeAssembly([raw], 1.0);
  const totalFaces = solids[0].faces.length;

  const activeTags = Object.entries(byForm)
    .filter(([, count]) => count > 0)
    .map(([k, count]) => `${k}×${count}`);
  const formulaTag = activeTags.length ? `${activeTags.join(' + ')} (${totalFaces}面)` : `${totalFaces}面`;

  return {
    solids,
    totalFaces,
    byForm,
    formulaTag,
    dihedralSample: sampleDihedralAngle(solids),
    symmetryAxes: axesForSystem(systemId),
  };
}
