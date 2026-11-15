// SUVA · 苏哇科技 · PixelCrystal (像素晶体)
// Pure 3D Wulff Convex Half-Space Polyhedron Engine, Crystallographic Twins & Habit Forge
// Zero DOM / Browser Dependencies — Runs identically in Browser ES Modules & Node.js

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

// Direct & Reciprocal Lattice Metric Helper for Exact (hkl) Plane Normals & Interfacial Angles
// Supports cubic, tetragonal, hexagonal/trigonal (3-index or 4-index Bravais-Miller), orthorhombic, monoclinic, triclinic
export function buildLatticeBasis({
  a = 1,
  b = a,
  c = a,
  alphaDeg = 90,
  betaDeg = 90,
  gammaDeg = 90,
} = {}) {
  const A = alphaDeg * RAD;
  const B = betaDeg * RAD;
  const G = gammaDeg * RAD;

  // Standard crystallographic Cartesian embedding:
  // c along +Z, a in X-Z plane (x > 0), b completing right-handed basis (det > 0)
  // Wait: for hexagonal/trigonal (alpha=beta=90, gamma=120), embed a1 along +X, a2 at +120 deg in X-Y, c along +Z!
  if (Math.abs(alphaDeg - 90) < 1e-6 && Math.abs(betaDeg - 90) < 1e-6 && Math.abs(gammaDeg - 120) < 1e-4) {
    const va = [a, 0, 0];
    const vb = [-0.5 * b, (Math.sqrt(3) / 2) * b, 0];
    const vc = [0, 0, c];
    const vol = dot3(va, cross3(vb, vc));
    const rec = [
      scale3(cross3(vb, vc), 1 / vol),
      scale3(cross3(vc, va), 1 / vol),
      scale3(cross3(va, vb), 1 / vol),
    ];
    return { va, vb, vc, rec, isHexMetric: true };
  }

  const sinB = Math.sin(B);
  const cosB = Math.cos(B);
  const cosA = Math.cos(A);
  const cosG = Math.cos(G);
  const va = [a * sinB, 0, a * cosB];
  const bx = (cosG - cosB * cosA) / sinB;
  const bz = cosA;
  const by = Math.sqrt(Math.max(1e-8, 1 - bx * bx - bz * bz));
  const vb = [b * bx, b * by, b * bz];
  const vc = [0, 0, c];
  const vol = dot3(va, cross3(vb, vc));
  const rec = [
    scale3(cross3(vb, vc), 1 / vol),
    scale3(cross3(vc, va), 1 / vol),
    scale3(cross3(va, vb), 1 / vol),
  ];
  return { va, vb, vc, rec, isHexMetric: false };
}

export function millerNormal(cell, hkl) {
  const basis = cell.rec ? cell : buildLatticeBasis(cell);
  let h;
  let k;
  let l;
  if (hkl.length === 4) {
    // 4-index Bravais-Miller (h, k, i, l) -> 3-index (h, k, l) since i = -(h+k)
    [h, k, , l] = hkl;
  } else {
    [h, k, l] = hkl;
  }
  const g = add3(
    add3(scale3(basis.rec[0], h), scale3(basis.rec[1], k)),
    scale3(basis.rec[2], l)
  );
  return unit3(g);
}

export function formatDegArcmin(degVal) {
  const totalMin = Math.round(Math.abs(degVal) * 60);
  const d = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${d}°${String(m).padStart(2, '0')}'`;
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

// Normalize an entire multi-solid assembly rigidly around [0, 0, 0] with max radius ~ targetRadius
// Also returns transform(pt) so 3D twin callout anchors land on the exact normalized seam/notch!
function normalizeAssemblyWithTransform(solids, targetRadius = 1.0) {
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
  const mapPoint = (pt) => [(pt[0] - cx) * k, (pt[1] - cy) * k, (pt[2] - cz) * k];

  const normSolids = solids.map((s) => ({
    vertices: s.vertices.map(mapPoint),
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

  return { solids: normSolids, mapPoint, scale: k, center: [cx, cy, cz] };
}

function normalizeAssembly(solids, targetRadius = 1.0) {
  return normalizeAssemblyWithTransform(solids, targetRadius).solids;
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

// Point-Group Accurate Symmetry Axes & Summary Labels (Hermann-Mauguin verified!)
export function symmetrySpecForPointGroup(pointGroup, systemId, extra = {}) {
  const pg = String(pointGroup || '').trim();

  if (systemId === 'cubic') {
    if (pg === '2/m3̄' || pg === '2/m-3') {
      // Pyrite diploidal class: NO L4! Only 3 x L2 along a,b,c + 4 x L3_bar along <111> + 3P + C
      return {
        summaryZh: '3L2 · 4L3i · 3P · C (无L4!)',
        axes: [
          { label: 'L2 · a', dir: [1, 0, 0], colorHex: '#FF4D94' },
          { label: 'L2 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
          { label: 'L2 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
          { label: 'L3̄ [111]', dir: unit3([1, 1, 1]), colorHex: '#FFB830' },
        ],
      };
    }
    if (pg === '4̄3m' || pg === '-43m') {
      return {
        summaryZh: '3L4i · 4L3 · 6P (无C)',
        axes: [
          { label: 'L4̄ · a', dir: [1, 0, 0], colorHex: '#FF4D94' },
          { label: 'L4̄ · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
          { label: 'L4̄ · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
          { label: 'L3 [111]', dir: unit3([1, 1, 1]), colorHex: '#FFB830' },
        ],
      };
    }
    return {
      summaryZh: '3L4 · 4L3i · 6L2 · 9P · C',
      axes: [
        { label: 'L4 · a', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L4 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'L4 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
        { label: 'L3 [111]', dir: unit3([1, 1, 1]), colorHex: '#FFB830' },
      ],
    };
  }

  if (systemId === 'tetragonal') {
    if (pg === '4mm') {
      return {
        summaryZh: 'L4 · 4P (异极·无C)',
        axes: [
          { label: 'a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
          { label: 'a2', dir: [0, 1, 0], colorHex: '#00E5FF' },
          { label: 'L4 · +c', dir: [0, 0, 1], colorHex: '#C6FF00' },
        ],
      };
    }
    return {
      summaryZh: 'L4 · 4L2 · 5P · C',
      axes: [
        { label: 'L2 · a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L2 · a2', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'L4 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ],
    };
  }

  if (systemId === 'hexagonal') {
    if (pg === '6/m') {
      // Apatite dipyramidal class: NO horizontal L2 and NO vertical P!
      return {
        summaryZh: 'L6 · P(0001) · C (无横L2)',
        axes: [
          { label: 'a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
          { label: 'a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
          { label: 'a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
          { label: 'L6 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
        ],
      };
    }
    return {
      summaryZh: 'L6 · 6L2 · 7P · C',
      axes: [
        { label: 'L2 · a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L2 · a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
        { label: 'L2 · a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
        { label: 'L6 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ],
    };
  }

  if (systemId === 'trigonal') {
    if (pg === '32') {
      // Alpha-Quartz enantiomorphic class: chiral! NO mirror planes P, NO inversion center C!
      return {
        summaryZh: 'L3 · 3L2 (手性·无P·无C)',
        axes: [
          { label: 'L2 · a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
          { label: 'L2 · a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
          { label: 'L2 · a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
          { label: 'L3 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
        ],
      };
    }
    if (pg === '3m') {
      // Tourmaline ditrigonal pyramidal polar class: hemimorphic! NO L2, NO inversion center C!
      return {
        summaryZh: 'L3 · 3P (异极性·无L2·无C)',
        axes: [
          { label: 'a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
          { label: 'a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
          { label: 'a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
          { label: 'L3 · +c', dir: [0, 0, 1], colorHex: '#C6FF00' },
        ],
      };
    }
    // 3̄m (Calcite, Ruby, Sapphire)
    return {
      summaryZh: 'L3i · 3L2 · 3P · C',
      axes: [
        { label: 'L2 · a1', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L2 · a2', dir: [Math.cos((TAU * 1) / 3), Math.sin((TAU * 1) / 3), 0], colorHex: '#00E5FF' },
        { label: 'L2 · a3', dir: [Math.cos((TAU * 2) / 3), Math.sin((TAU * 2) / 3), 0], colorHex: '#FFB830' },
        { label: 'L3̄ · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ],
    };
  }

  if (systemId === 'orthorhombic') {
    return {
      summaryZh: '3L2 · 3P · C',
      axes: [
        { label: 'L2 · a', dir: [1, 0, 0], colorHex: '#FF4D94' },
        { label: 'L2 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'L2 · c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ],
    };
  }

  if (systemId === 'monoclinic') {
    const beta = (extra.betaDeg || 114.1) * RAD;
    return {
      summaryZh: 'L2(∥b) · P(⊥b) · C',
      axes: [
        { label: 'a', dir: unit3([Math.sin(beta), 0, Math.cos(beta)]), colorHex: '#FF4D94' },
        { label: 'L2 · b', dir: [0, 1, 0], colorHex: '#00E5FF' },
        { label: 'c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ],
    };
  }

  if (systemId === 'triclinic') {
    const A = (extra.alphaDeg || 94.26) * RAD;
    const B = (extra.betaDeg || 116.6) * RAD;
    const G = (extra.gammaDeg || 87.71) * RAD;
    const a = [Math.sin(B), 0, Math.cos(B)];
    const bx = (Math.cos(G) - Math.cos(B) * Math.cos(A)) / Math.sin(B);
    const bz = Math.cos(A);
    const b = [bx, Math.sqrt(Math.max(0.01, 1 - bx * bx - bz * bz)), bz];
    return {
      summaryZh: 'C (1̄ · 无对称轴·无P)',
      axes: [
        { label: 'a', dir: unit3(a), colorHex: '#FF4D94' },
        { label: 'b', dir: unit3(b), colorHex: '#00E5FF' },
        { label: 'c', dir: [0, 0, 1], colorHex: '#C6FF00' },
      ],
    };
  }

  return symmetrySpecForPointGroup('m3̄m', 'cubic');
}

// Exact Crystallographic Inclined Contact Twin Builder:
// Takes single-crystal Wulff planes + exact lattice metric + twin composition plane (hkl),
// orients (-g_hkl) -> [+1, 0, 0] via pure SO(3) rotation (preserving chirality & polar +c!),
// translates along +c_A by armOffset (keeping prism faces 100% coplanar across A and B!),
// clips along x = 0, reflects to form Individual B, and computes exact 3D seam & V-notch anchors!
function buildInclinedContactTwin(
  basePlanes,
  cell,
  hkl,
  {
    armOffset = 0.52,
    perpShift = 0.0,
    scaleSingle = 0.88,
    planeHklLabel = '(011)',
    planeLabelEn = '{011} CONTACT TWIN',
    lawZh = '接触双晶',
    category = 'contact',
    isRareOrGrowth = false,
    reentrantPrefixZh = '双晶 c∧c 夹角',
  } = {}
) {
  let g = millerNormal(cell, hkl);
  if (g[2] < 0) g = scale3(g, -1);

  const cosTheta = clamp(g[2], 0.001, 0.9999);
  const thetaRad = Math.acos(cosTheta); // Angle between twin normal g and +c
  const alphaRad = Math.PI / 2 - thetaRad; // Half-angle between +c_A and +c_B!
  const cAxisAngleDeg = 2 * alphaRad * DEG;
  const phiRad = Math.atan2(g[1], g[0]);

  // Pure SO(3) rotation R = R_y(-alpha) * R_z(pi - phi):
  // Maps -g -> [+1, 0, 0] and +c -> [-sin(alpha), 0, +cos(alpha)] (diverging UP-LEFT in x <= 0)
  const rotVec = (v) => {
    const v1 = rotateAroundAxis(v, [0, 0, 1], Math.PI - phiRad);
    return rotateAroundAxis(v1, [0, 1, 0], -alphaRad);
  };

  const cDirA = rotVec([0, 0, 1]); // [-sin(alpha), 0, +cos(alpha)]
  const shiftVec = add3(scale3(cDirA, armOffset), [perpShift, 0, 0]);

  const twinPlanesA = basePlanes.map((p) => {
    const rn = rotVec(p.normal);
    const dShift = dot3(rn, shiftVec);
    return wulffPlane(rn, p.distance * scaleSingle + dShift, {
      ...p,
      rampKey: 'twinA',
    });
  });
  twinPlanesA.push(
    wulffPlane([1, 0, 0], 0.0, {
      hkl: planeHklLabel,
      familyZh: `双晶接合面 ${planeHklLabel}`,
      rampKey: 'twinA',
    })
  );

  const solidA = solveConvexHalfSpaces(twinPlanesA);
  const solidB = transformSolid(
    solidA,
    (p) => reflectAcrossPlane(p, [1, 0, 0]),
    (n) => reflectAcrossPlane(n, [1, 0, 0]),
    'twinB'
  );

  // Locate exact seam z-range on x = 0 so 3D twin callout points right to the top V-notch!
  let seamMinZ = Infinity;
  let seamMaxZ = -Infinity;
  for (const v of solidA.vertices) {
    if (Math.abs(v[0]) < 1e-3) {
      if (v[2] < seamMinZ) seamMinZ = v[2];
      if (v[2] > seamMaxZ) seamMaxZ = v[2];
    }
  }
  if (!Number.isFinite(seamMaxZ)) {
    seamMinZ = -0.4;
    seamMaxZ = 0.4;
  }

  const degMin = formatDegArcmin(cAxisAngleDeg);
  return {
    solids: [solidA, solidB],
    twinInfo: {
      enabled: true,
      category,
      isRareOrGrowth,
      cAxisAngleDeg: Number(cAxisAngleDeg.toFixed(2)),
      planeLabelEn,
      reentrantTagEn: `C^C ${degMin}`,
      lawZh,
      reentrantLabel: `${reentrantPrefixZh} ${degMin}`,
      planeOrigin3D: [0, 0, 0.5 * (seamMinZ + seamMaxZ)],
      traceDir3D: [0, 0, 1],
      notchAnchor3D: [0, 0, seamMaxZ],
    },
  };
}

// Reusable cubic & trigonal form plane generators
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

function planesRhombohedron(d, zSlope = 0.88, rampKey = 'rhomb', familyZh = '菱面体 {101̄1}') {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const ang = (k * TAU) / 3 + Math.PI / 6;
    const upper = [Math.cos(ang), Math.sin(ang), zSlope];
    out.push(...pairedWulff(upper, d, { hkl: '{101̄1}', familyZh, rampKey, formKey: '{101̄1}' }));
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

// Exact Spinel Law {111} Contact Twin (Macle): two {111} octahedra clipped on (111),
// top half rotated 180 deg around [111] -> exact arccos(-7/9) = 141 deg 04' re-entrant V-notches!
// Oriented with [111] twin axis along +Z so all 3 equatorial 141 deg 04' V-notches are cleanly visible!
function buildSpinelLawTwin({ compression = 0.64 } = {}) {
  const twinAxis = unit3([1, 1, 1]);
  // Orthonormal frame mapping [1, 1, 1]/sqrt(3) -> [0, 0, 1] and [1, -1, 0]/sqrt(2) -> [1, 0, 0]
  const ex = unit3([1, -1, 0]);
  const ey = unit3([1, 1, -2]);
  const ez = twinAxis;
  const toMacleFrame = (v) => [dot3(v, ex), dot3(v, ey), dot3(v, ez)];

  const basePlanes = planesOcta111(1.0, 'twinA', '八面体 {111}');
  const planesA = basePlanes.map((p) => {
    const rn = toMacleFrame(p.normal);
    const align = Math.abs(rn[2]);
    return wulffPlane(rn, align > 0.99 ? compression : 1.0, {
      ...p,
      rampKey: 'twinA',
      familyZh: '双晶个体A {111}',
    });
  });
  planesA.push(wulffPlane([0, 0, 1], 0.0, { hkl: '(111)', familyZh: '双晶接合面 (111)', rampKey: 'twinA' }));
  const solidA = solveConvexHalfSpaces(planesA);

  // Rotate 180 deg around [111] (+Z) AND mirror into upper half-space z >= 0:
  // since {111} octahedron has inversion center C, 180 deg around [111] = reflection across (111)!
  const solidB = transformSolid(
    solidA,
    (p) => [p[0], p[1], -p[2]],
    (n) => [n[0], n[1], -n[2]],
    'twinB'
  );

  // Locate one of the 3 equatorial re-entrant V-notch midpoints on z = 0 (at -ey direction -> facing camera!)
  let minY = 0;
  for (const v of solidA.vertices) {
    if (Math.abs(v[2]) < 1e-3 && v[1] < minY) minY = v[1];
  }

  return {
    solids: [solidA, solidB],
    notchAnchor3D: [0, minY, 0],
  };
}

// Single-crystal & Scientifically Verified Twin definitions for all 24 MINERAL_CODEX IDs
// Zero generic druse clusters — every mineral implements its true crystallographic twin law or growth sector law!
const MINERAL_BUILDERS = {
  // === 1. CUBIC (5) ===
  diamond() {
    const single = solveConvexHalfSpaces(planesOcta111(1.0, 'diamond', '金刚石八面体 {111}'));
    const macle = buildSpinelLawTwin({ compression: 0.56 });
    return {
      systemId: 'cubic',
      pointGroup: 'm3̄m',
      single: [single],
      twin: macle.solids,
      twinInfo: {
        enabled: true,
        category: 'contact',
        isRareOrGrowth: false,
        cAxisAngleDeg: 141.06,
        planeLabelEn: '{111} MACLE TWIN',
        reentrantTagEn: "V-NOTCH 141°04'",
        lawZh: "尖晶石律 {111} 扁平三角接触双晶 (Macle · 凹角 141°04')",
        reentrantLabel: "腰部三组双晶凹入角 arccos(-7/9) = 141°04'",
        planeOrigin3D: [0, 0, 0],
        traceDir3D: [1, 0, 0],
        notchAnchor3D: macle.notchAnchor3D,
      },
    };
  },

  spinel() {
    const single = solveConvexHalfSpaces(planesOcta111(1.0, 'ruby', '尖晶石八面体 {111}'));
    const macle = buildSpinelLawTwin({ compression: 0.76 });
    return {
      systemId: 'cubic',
      pointGroup: 'm3̄m',
      single: [single],
      twin: macle.solids,
      twinInfo: {
        enabled: true,
        category: 'contact',
        isRareOrGrowth: false,
        cAxisAngleDeg: 141.06,
        planeLabelEn: '{111} SPINEL LAW',
        reentrantTagEn: "RE-ENTRANT 141°04'",
        lawZh: "尖晶石律 {111} 八面体接触双晶 (沿 [111] 旋转 180°)",
        reentrantLabel: "特征双晶凹入角 141°04' (补角 38°56')",
        planeOrigin3D: [0, 0, 0],
        traceDir3D: [1, 0, 0],
        notchAnchor3D: macle.notchAnchor3D,
      },
    };
  },

  fluorite() {
    const cubeA = solveConvexHalfSpaces(planesCube100(1.0, 'emerald', '萤石立方体 {100}'));
    // Exact equal-volume {100} cubes rotated 60 deg (= 180 deg mod m-3m) around [111]!
    // Zero coplanar faces, iconic corner-emerging interpenetration!
    const twinA = transformSolid(cubeA, (p) => p, (n) => n, 'twinA');
    const twinB = transformSolid(
      cubeA,
      (p) => rotateAroundAxis(p, [1, 1, 1], Math.PI / 3),
      (n) => rotateAroundAxis(n, [1, 1, 1], Math.PI / 3),
      'twinB'
    );
    return {
      systemId: 'cubic',
      pointGroup: 'm3̄m',
      single: [cubeA],
      twin: [twinA, twinB],
      twinInfo: {
        enabled: true,
        category: 'penetration',
        isRareOrGrowth: false,
        cAxisAngleDeg: 60.0,
        planeLabelEn: '[111] FLUORITE TWIN',
        reentrantTagEn: 'PENETRATION 180°',
        lawZh: '萤石律 [111] 贯穿双晶 (两等大立方体沿三次轴旋转 180° 穿插)',
        reentrantLabel: '立方体角顶沿 {100} 晶面穿出形成贯穿凹角',
        planeOrigin3D: [0, 0, 0],
        traceDir3D: unit3([1, 1, 1]),
        notchAnchor3D: [0.62, -1.0, 0.62],
      },
    };
  },

  garnet() {
    // Authentic {110} + {211} 36-facet garnet habit; rare {211} contact twin reference (Mallard's Law: (211) is NOT a mirror in m-3m!)
    const basePlanes = [
      ...planesDodeca110(1.0, 'ruby', '菱形十二面体 {110}'),
      ...planesTrap211(1.08, 'trap', '四角三八面体 {211}'),
    ];
    const single = solveConvexHalfSpaces(basePlanes);
    const cell = buildLatticeBasis({ a: 11.459 }); // Pyrope a = 11.459 Å
    const rareTwin = buildInclinedContactTwin(basePlanes, cell, [1, 1, 2], {
      armOffset: 0.34,
      scaleSingle: 0.90,
      planeHklLabel: '(211)',
      planeLabelEn: '{211} RARE TWIN',
      lawZh: '石榴石罕见 {211} 接触双晶对照 (自然界极罕见双晶 · 非对称面接合)',
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '{211} 双晶凹槽夹角',
    });
    return {
      systemId: 'cubic',
      pointGroup: 'm3̄m',
      single: [single],
      twin: rareTwin.solids,
      twinInfo: rareTwin.twinInfo,
    };
  },

  pyrite() {
    // Diploidal 2/m-3: {210} pyritohedron lacks {110} diagonal mirrors, so 90 deg rotation around [001] (= reflection across {110}) produces the famous Iron Cross penetration twin!
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
      pointGroup: '2/m3̄',
      single: [single],
      twin: [twinA, twinB],
      twinInfo: {
        enabled: true,
        category: 'penetration',
        isRareOrGrowth: false,
        cAxisAngleDeg: 90.0,
        planeLabelEn: '{110} IRON CROSS',
        reentrantTagEn: 'ROOF NOTCH 90°',
        lawZh: '铁十字律 [001]90° / {110} 贯穿双晶 (2/m3̄ 无对角镜面所致)',
        reentrantLabel: '两五角十二面体正交穿插形成十字屋脊凹槽',
        planeOrigin3D: [0, 0, 0],
        traceDir3D: [0, 0, 1],
        notchAnchor3D: [0, -0.78, 0.78],
      },
    };
  },

  // === 2. TETRAGONAL (3) ===
  zircon() {
    // Zircon I4_1/amd: a = 6.607 Å, c = 5.982 Å -> {101} normal angle theta = 42°09' -> c^c = 95°41'!
    const cell = buildLatticeBasis({ a: 6.607, c: 5.982 });
    const planes = [
      ...pairedWulff(millerNormal(cell, [1, 0, 0]), 0.72, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cyan' }),
      ...pairedWulff(millerNormal(cell, [0, 1, 0]), 0.72, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cyan' }),
    ];
    for (const [h, k] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const l of [-1, 1]) {
        planes.push(wulffPlane(millerNormal(cell, [h, k, l]), 1.02, { hkl: '{101}', familyZh: '四方双锥 {101}', rampKey: 'pyramid' }));
      }
    }
    const single = solveConvexHalfSpaces(planes);
    const knee = buildInclinedContactTwin(planes, cell, [1, 0, 1], {
      armOffset: 0.44,
      scaleSingle: 0.88,
      planeHklLabel: '(101)',
      planeLabelEn: '{101} GENICULATED',
      lawZh: "锆石罕见 {101} 膝状接触双晶 (晶胞实算 c∧c = 95°41')",
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '锆石 {101} 膝状 c∧c 夹角',
    });
    return {
      systemId: 'tetragonal',
      pointGroup: '4/mmm',
      single: [single],
      twin: knee.solids,
      twinInfo: knee.twinInfo,
    };
  },

  rutile() {
    // Rutile P4_2/mnm: a = 4.5937 Å, c = 2.9587 Å -> {011} normal theta = 32°47' -> c^c = 114°26' (supplement 65°34')!
    const cell = buildLatticeBasis({ a: 4.5937, c: 2.9587 });
    const planes = [];
    for (const [h, k] of [[1, 0], [0, 1]]) {
      planes.push(...pairedWulff(millerNormal(cell, [h, k, 0]), 0.54, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'ruby' }));
    }
    for (const [h, k] of [[1, 1], [1, -1]]) {
      planes.push(...pairedWulff(millerNormal(cell, [h, k, 0]), 0.56, { hkl: '{110}', familyZh: '次四方柱 {110}', rampKey: 'pyrito' }));
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          planes.push(wulffPlane(millerNormal(cell, [sx, sy, sz]), 1.06, { hkl: '{101}/{111}', familyZh: '四方双锥 {111}', rampKey: 'pyramid' }));
        }
      }
    }
    const single = solveConvexHalfSpaces(planes);
    const knee = buildInclinedContactTwin(planes, cell, [0, 1, 1], {
      armOffset: 0.56,
      scaleSingle: 0.85,
      planeHklLabel: '(011)',
      planeLabelEn: '{011} KNEE TWIN',
      lawZh: "金红石律 {011} 膝状接触双晶 (肘部 c∧c = 114°26' · 补角 65°34')",
      category: 'contact',
      isRareOrGrowth: false,
      reentrantPrefixZh: '膝状双晶肘角',
    });
    return {
      systemId: 'tetragonal',
      pointGroup: '4/mmm',
      single: [single],
      twin: knee.solids,
      twinInfo: knee.twinInfo,
    };
  },

  cassiterite() {
    // Cassiterite P4_2/mnm: a = 4.7382 Å, c = 3.1871 Å -> {011} normal theta = 33°56' -> c^c = 112°09' (Visor Twin)!
    const cell = buildLatticeBasis({ a: 4.7382, c: 3.1871 });
    const planes = [];
    for (const [h, k] of [[1, 0], [0, 1]]) {
      planes.push(...pairedWulff(millerNormal(cell, [h, k, 0]), 0.74, { hkl: '{100}', familyZh: '短四方柱 {100}', rampKey: 'pyrito' }));
    }
    for (const [h, k] of [[1, 1], [1, -1]]) {
      planes.push(...pairedWulff(millerNormal(cell, [h, k, 0]), 0.76, { hkl: '{110}', familyZh: '次四方柱 {110}', rampKey: 'trap' }));
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          planes.push(wulffPlane(millerNormal(cell, [sx, sy, sz]), 0.96, { hkl: '{111}', familyZh: '四方双锥 {111}', rampKey: 'pyramid' }));
        }
      }
    }
    const single = solveConvexHalfSpaces(planes);
    // Stubby prism + modest armOffset creates the deep visor-like re-entrant cleft ("帽舌双晶")!
    const visor = buildInclinedContactTwin(planes, cell, [0, 1, 1], {
      armOffset: 0.34,
      scaleSingle: 0.90,
      planeHklLabel: '(011)',
      planeLabelEn: '{011} VISOR TWIN',
      lawZh: "锡石律 {011} 肘状“帽舌双晶” (Visor Twin · c∧c = 112°09')",
      category: 'contact',
      isRareOrGrowth: false,
      reentrantPrefixZh: '锡石帽舌双晶夹角',
    });
    return {
      systemId: 'tetragonal',
      pointGroup: '4/mmm',
      single: [single],
      twin: visor.solids,
      twinInfo: visor.twinInfo,
    };
  },

  // === 3. HEXAGONAL (3) ===
  beryl() {
    // Beryl P6/mcc: a = 9.21 Å, c = 9.19 Å -> rare {11-22} contact twin (theta = 44°56' -> c^c = 90°07')
    const cell = buildLatticeBasis({ a: 9.21, b: 9.21, c: 9.19, gammaDeg: 120 });
    const planes = [...pairedWulff([0, 0, 1], 1.24, { hkl: '{0001}', familyZh: '平行双面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.72, { hkl: '{101̄0}', familyZh: '六方柱 {101̄0}', rampKey: 'cyan' }));
    }
    const single = solveConvexHalfSpaces(planes);
    const rareTwin = buildInclinedContactTwin(planes, cell, [1, 1, -2, 2], {
      armOffset: 0.48,
      scaleSingle: 0.86,
      planeHklLabel: '(112̄2)',
      planeLabelEn: '{112̄2} RARE TWIN',
      lawZh: "绿柱石罕见 {112̄2} 接触双晶对照 (自然界极少双晶 · c∧c = 90°07')",
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '{112̄2} 接触双晶夹角',
    });
    return {
      systemId: 'hexagonal',
      pointGroup: '6/mmm',
      single: [single],
      twin: rareTwin.solids,
      twinInfo: rareTwin.twinInfo,
    };
  },

  emerald() {
    // Single: hexagonal prism {10-10} + basal pinacoid {0001} + narrow dipyramid {10-11}
    const planes = [...pairedWulff([0, 0, 1], 1.12, { hkl: '{0001}', familyZh: '平行双面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.78, { hkl: '{101̄0}', familyZh: '六方柱 {101̄0}', rampKey: 'emerald' }));
      planes.push(...pairedWulff([nx, ny, 0.85], 1.18, { hkl: '{101̄1}', familyZh: '六方双锥截角 {101̄1}', rampKey: 'prism' }));
    }
    const single = solveConvexHalfSpaces(planes);

    // Colombian Trapiche Emerald 6-Sector Growth Wheel (Giuliani et al. 2015):
    // Central hexagonal core + 6 radial {10-10} emerald sectors + 6 dark carbonaceous/albite radial arms!
    const zHalf = 0.46;
    const corePlanes = [...pairedWulff([0, 0, 1], zHalf * 1.04, { hkl: '{0001}', familyZh: '达碧兹六方核 {0001}', rampKey: 'emerald' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      corePlanes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.28, { hkl: '{101̄0}', familyZh: '达碧兹中心核柱面', rampKey: 'emerald' }));
    }
    const coreSolid = solveConvexHalfSpaces(corePlanes);

    // Template trapezoidal emerald growth sector centered on +X..+60 deg (normal at +30 deg = pi/6)
    const secBasePlanes = [
      ...pairedWulff([0, 0, 1], zHalf, { hkl: '{0001}', familyZh: '达碧兹生长扇区 {0001}', rampKey: 'emerald' }),
      wulffPlane([Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0], 0.94, { hkl: '{101̄0}', familyZh: '外缘六方柱面 {101̄0}', rampKey: 'emerald' }),
      wulffPlane([-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6), 0], -0.33, { hkl: '(101̄0)', familyZh: '扇区内缘', rampKey: 'emerald' }),
      // Radial carbonaceous arm channel walls at phi = 0 and phi = 60 deg (gap half-thickness = 0.042)
      wulffPlane([0, -1, 0], -0.042, { hkl: '{112̄0}', familyZh: '碳质放射臂边界', rampKey: 'prism' }),
      wulffPlane([-Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0], -0.042, { hkl: '{112̄0}', familyZh: '碳质放射臂边界', rampKey: 'prism' }),
    ];
    const sec0 = solveConvexHalfSpaces(secBasePlanes);

    // Thin dark skeletal arm spoke along phi = 0 from r = 0.30 to r = 1.06
    const armPlanes = [
      ...pairedWulff([0, 0, 1], zHalf * 1.02, { hkl: '{0001}', familyZh: '碳质/钠长石六射臂', rampKey: 'trap' }),
      wulffPlane([1, 0, 0], 1.04, { hkl: '{112̄0}', familyZh: '六射臂端头', rampKey: 'trap' }),
      wulffPlane([-1, 0, 0], -0.29, { hkl: '{112̄0}', familyZh: '六射臂根部', rampKey: 'trap' }),
      ...pairedWulff([0, 1, 0], 0.036, { hkl: '{112̄0}', familyZh: '碳质放射隔片', rampKey: 'trap' }),
    ];
    const arm0 = solveConvexHalfSpaces(armPlanes);

    const trapicheSolids = [coreSolid];
    for (let k = 0; k < 6; k++) {
      const rot = (k * TAU) / 6;
      trapicheSolids.push(
        transformSolid(
          sec0,
          (p) => rotateAroundAxis(p, [0, 0, 1], rot),
          (n) => rotateAroundAxis(n, [0, 0, 1], rot),
          k % 2 === 0 ? 'emerald' : 'prism'
        )
      );
      trapicheSolids.push(
        transformSolid(
          arm0,
          (p) => rotateAroundAxis(p, [0, 0, 1], rot),
          (n) => rotateAroundAxis(n, [0, 0, 1], rot),
          'trap'
        )
      );
    }

    return {
      systemId: 'hexagonal',
      pointGroup: '6/mmm',
      single: [single],
      twin: trapicheSolids,
      twinInfo: {
        enabled: true,
        category: 'growth_sector',
        isRareOrGrowth: true,
        cAxisAngleDeg: 0.0,
        planeLabelEn: '{101̄0} TRAPICHE 6X',
        reentrantTagEn: '6-SECTOR WHEEL',
        lawZh: '哥伦比亚达碧兹祖母绿 {101̄0} 六射生长扇区 (非晶格双晶 · 共享同一 c 轴)',
        reentrantLabel: '六方晶核 + 6 道碳质/钠长石放射臂分隔同向一轴负晶扇区',
        planeOrigin3D: [0, 0, zHalf],
        traceDir3D: [1, 0, 0],
        notchAnchor3D: [1.02, 0, zHalf],
      },
    };
  },

  apatite() {
    // Fluorapatite P6_3/m (point group 6/m): a = 9.397 Å, c = 6.878 Å -> rare {11-21} contact twin (c^c = 68°28')
    const cell = buildLatticeBasis({ a: 9.397, b: 9.397, c: 6.878, gammaDeg: 120 });
    const gPyr = millerNormal(cell, [1, 0, -1, 1]);
    const pyrH = Math.hypot(gPyr[0], gPyr[1]);
    const pyrZ = gPyr[2];
    const planes = [...pairedWulff([0, 0, 1], 1.06, { hkl: '{0001}', familyZh: '底面 {0001}', rampKey: 'pinacoid' })];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.78, { hkl: '{101̄0}', familyZh: '六方柱 {101̄0}', rampKey: 'cyan' }));
      planes.push(
        wulffPlane([nx * pyrH, ny * pyrH, pyrZ], 1.02, { hkl: '{101̄1}', familyZh: '六方双锥 {101̄1}', rampKey: 'octa' }),
        wulffPlane([nx * pyrH, ny * pyrH, -pyrZ], 1.02, { hkl: '{101̄1}', familyZh: '六方双锥 {101̄1}', rampKey: 'octa' })
      );
    }
    const single = solveConvexHalfSpaces(planes);
    const rareTwin = buildInclinedContactTwin(planes, cell, [1, 1, -2, 1], {
      armOffset: 0.48,
      scaleSingle: 0.86,
      planeHklLabel: '(112̄1)',
      planeLabelEn: '{112̄1} RARE TWIN',
      lawZh: "氟磷灰石罕见 {112̄1} 接触双晶对照 (6/m 点群 · c∧c = 68°28')",
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '{112̄1} 双晶 c∧c 夹角',
    });
    return {
      systemId: 'hexagonal',
      pointGroup: '6/m',
      single: [single],
      twin: rareTwin.solids,
      twinInfo: rareTwin.twinInfo,
    };
  },

  // === 4. TRIGONAL (5) ===
  quartz() {
    // Alpha-Quartz P3_121 / P3_221 (point group 32): a = 4.9134 Å, c = 5.4052 Å
    // Japan Law {11-22}: exact theta = 47°44' -> c^c = 84°33' AND front/back {10-10} prism faces are 100% coplanar!
    const cell = buildLatticeBasis({ a: 4.9134, b: 4.9134, c: 5.4052, gammaDeg: 120 });
    const gR = millerNormal(cell, [1, 0, -1, 1]);
    const rhombHoriz = Math.hypot(gR[0], gR[1]);
    const rhombZ = gR[2];

    const makeQuartzPlanes = (flattenFrontBack = false) => {
      const planes = [];
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 6 + (i * Math.PI) / 3;
        const nx = Math.cos(ang);
        const ny = Math.sin(ang);
        // Note: for (h,k,i,l) = (1,1,-2,2), phi = 60 deg; rotating by pi - 60 deg = 120 deg puts i=1 (ang=90) & i=4 (ang=270) at +/-Y?
        // Wait: ang=90 + 120 = 210; ang=330 (i=5) + 120 = 90 (+Y) and ang=150 (i=2) + 120 = 270 (-Y)!
        const isCoplanarFace = flattenFrontBack && (i === 2 || i === 5);
        planes.push(
          wulffPlane([nx, ny, 0], isCoplanarFace ? 0.50 : 0.64, {
            hkl: '{101̄0}',
            familyZh: '六方柱 m {101̄0}',
            rampKey: 'violet',
          })
        );
        const isMajorR = i % 2 === 0;
        planes.push(
          ...pairedWulff([nx * rhombHoriz, ny * rhombHoriz, rhombZ], isMajorR ? 0.96 : 1.03, {
            hkl: isMajorR ? '{101̄1}' : '{011̄1}',
            familyZh: isMajorR ? '正菱面体 r {101̄1}' : '负菱面体 z {011̄1}',
            rampKey: isMajorR ? 'octa' : 'rhomb',
          })
        );
      }
      return planes;
    };

    const single = solveConvexHalfSpaces(makeQuartzPlanes(false));
    const japan = buildInclinedContactTwin(makeQuartzPlanes(true), cell, [1, 1, -2, 2], {
      armOffset: 0.62,
      scaleSingle: 0.84,
      planeHklLabel: '(112̄2)',
      planeLabelEn: '{112̄2} JAPAN LAW',
      lawZh: "石英日本律 {112̄2} 扁平燕尾接触双晶 (两 c 轴交角 84°33' · 共面柱面)",
      category: 'contact',
      isRareOrGrowth: false,
      reentrantPrefixZh: '日本律双晶夹角',
    });

    return {
      systemId: 'trigonal',
      pointGroup: '32',
      single: [single],
      twin: japan.solids,
      twinInfo: japan.twinInfo,
    };
  },

  calcite() {
    // Calcite R-3c (3̄m): morphological cleavage-rhombohedron cell a = 4.9896 Å, c_morph = 17.061 / 4 = 4.265 Å!
    // Single: classic cleavage/growth rhombohedron r {10-11} (c^r = 44°37')
    // Twin: iconic {10-11} Butterfly Contact Twin (scalenohedral v{21-31} + r{10-11} wings opening at c^c = 90°45'!)
    const cell = buildLatticeBasis({ a: 4.9896, b: 4.9896, c: 4.26525, gammaDeg: 120 });
    const gRhomb = millerNormal(cell, [1, 0, -1, 1]);
    const zSlope = gRhomb[2] / Math.hypot(gRhomb[0], gRhomb[1]); // ~0.9869 -> 44°37'
    const singlePlanes = planesRhombohedron(0.88, zSlope, 'rhomb', '方解石菱面体 r {101̄1}');
    const single = solveConvexHalfSpaces(singlePlanes);

    // Scalenohedron {21-31} + rhombohedron {10-11} base crystal for Butterfly Twin
    const wingBasePlanes = [...planesRhombohedron(1.06, zSlope, 'rhomb', '菱面体端面 {101̄1}')];
    // 6+6 ditrigonal scalenohedron faces generated by 3̄m symmetry acting on (2, 1, -3, 1)
    const seedScal = millerNormal(cell, [2, 1, -3, 1]);
    for (let k = 0; k < 3; k++) {
      const rot = (k * TAU) / 3;
      const u1 = rotateAroundAxis(seedScal, [0, 0, 1], rot);
      // Mirror across Y-Z plane (x -> -x) is a 3̄m vertical mirror if a1=[1,0,0] is L2!
      const u2 = [-u1[0], u1[1], u1[2]];
      wingBasePlanes.push(...pairedWulff(u1, 0.72, { hkl: '{213̄1}', familyZh: '复三方偏三角面体 v {213̄1}', rampKey: 'cyan' }));
      wingBasePlanes.push(...pairedWulff(u2, 0.72, { hkl: '{213̄1}', familyZh: '复三方偏三角面体 v {213̄1}', rampKey: 'cyan' }));
    }

    const butterfly = buildInclinedContactTwin(wingBasePlanes, cell, [1, 0, -1, 1], {
      armOffset: 0.44,
      scaleSingle: 0.88,
      planeHklLabel: '(101̄1)',
      planeLabelEn: '{101̄1} BUTTERFLY',
      lawZh: "方解石 {101̄1} 蝴蝶接触双晶 (形态晶胞实算 c∧c = 90°45')",
      category: 'contact',
      isRareOrGrowth: false,
      reentrantPrefixZh: '蝴蝶双晶两翼 c∧c 夹角',
    });

    return {
      systemId: 'trigonal',
      pointGroup: '3̄m',
      single: [single],
      twin: butterfly.solids,
      twinInfo: butterfly.twinInfo,
    };
  },

  ruby() {
    // Corundum Al2O3 (R-3c, 3̄m): structural a = 4.759 Å, c = 12.991 Å;
    // Morphological fundamental rhombohedron r {10-11} = structural {01-12} (d = 3.479 Å, c_morph = c/2 = 6.4955 Å)!
    // Normal angle c ^ r = 57°37' -> rhombohedral contact twin c ^ c = 64°47' (obtuse 115°13')!
    const cellMorph = buildLatticeBasis({ a: 4.759, b: 4.759, c: 6.4955, gammaDeg: 120 });
    const gR = millerNormal(cellMorph, [1, 0, -1, 1]);
    const rSlope = gR[2] / Math.hypot(gR[0], gR[1]);

    const planes = [
      ...pairedWulff([0, 0, 1], 0.76, { hkl: '{0001}', familyZh: '刚玉底面 c {0001}', rampKey: 'pinacoid' }),
      ...planesRhombohedron(0.92, rSlope, 'pyramid', '正菱面体 r {101̄1}'),
    ];
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.84, { hkl: '{112̄0}', familyZh: '第二六方柱 a {112̄0}', rampKey: 'ruby' }));
    }
    const single = solveConvexHalfSpaces(planes);

    const rhombTwin = buildInclinedContactTwin(planes, cellMorph, [1, 0, -1, 1], {
      armOffset: 0.42,
      scaleSingle: 0.88,
      planeHklLabel: '(101̄1)',
      planeLabelEn: 'r{101̄1} CORUNDUM TWIN',
      lawZh: "红宝石菱面体 r {101̄1} (结构 {011̄2}) 接触双晶 (c∧c = 64°47' / 115°13')",
      category: 'contact',
      isRareOrGrowth: false,
      reentrantPrefixZh: '刚玉菱面体双晶角',
    });

    return {
      systemId: 'trigonal',
      pointGroup: '3̄m',
      single: [single],
      twin: rhombTwin.solids,
      twinInfo: rhombTwin.twinInfo,
    };
  },

  sapphire() {
    // Ceylon Sapphire (3̄m): true trigonal barrel combining {11-20} prism + steep {22-43} dipyramid + trigonal r {10-11} rhombohedron + {0001}!
    // Basal {0001} contact twin (180 deg around c [0001] = mirror across (0001) in 3̄m!) creates 3 equatorial re-entrant notches!
    const cellMorph = buildLatticeBasis({ a: 4.759, b: 4.759, c: 6.4955, gammaDeg: 120 });
    const gR = millerNormal(cellMorph, [1, 0, -1, 1]);
    const rSlope = gR[2] / Math.hypot(gR[0], gR[1]);

    const planes = [
      ...pairedWulff([0, 0, 1], 1.26, { hkl: '{0001}', familyZh: '刚玉小底面 c {0001}', rampKey: 'pinacoid' }),
      ...planesRhombohedron(0.95, rSlope * 0.65, 'pyramid', '菱面体 r {101̄1}'),
    ];
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      planes.push(wulffPlane([nx, ny, 0], 0.78, { hkl: '{112̄0}', familyZh: '六方柱 a {112̄0}', rampKey: 'sapphire' }));
      // True 3̄m alternating trigonal barrel slant so upper & lower halves are related by 3̄, NOT horizontal mirror!
      const alt = i % 2 === 0 ? 0.84 : 0.94;
      const altNeg = i % 2 === 0 ? 0.94 : 0.84;
      planes.push(wulffPlane([nx, ny, 0.44], alt, { hkl: '{224̄3}', familyZh: '陡六方双锥 n {224̄3}', rampKey: 'octa' }));
      planes.push(wulffPlane([nx, ny, -0.44], altNeg, { hkl: '{224̄3}', familyZh: '陡六方双锥 n {224̄3}', rampKey: 'octa' }));
    }
    const single = solveConvexHalfSpaces(planes);

    // Basal {0001} Contact Twin: clip lower half (z <= 0) after shifting +c up slightly so waist cuts through sloped barrel faces!
    const lowerPlanes = planes.map((p) => {
      const dShift = dot3(p.normal, [0, 0, -0.26]);
      return wulffPlane(p.normal, p.distance + dShift, { ...p, rampKey: 'twinA' });
    });
    lowerPlanes.push(wulffPlane([0, 0, 1], 0.0, { hkl: '(0001)', familyZh: '刚玉底面双晶接合面 (0001)', rampKey: 'twinA' }));
    const lowerHalf = solveConvexHalfSpaces(lowerPlanes);
    const upperHalf = transformSolid(
      lowerHalf,
      (p) => [p[0], p[1], -p[2]],
      (n) => [n[0], n[1], -n[2]],
      'twinB'
    );

    return {
      systemId: 'trigonal',
      pointGroup: '3̄m',
      single: [single],
      twin: [lowerHalf, upperHalf],
      twinInfo: {
        enabled: true,
        category: 'contact',
        isRareOrGrowth: false,
        cAxisAngleDeg: 180.0,
        planeLabelEn: '{0001} BASAL TWIN',
        reentrantTagEn: '3X WAIST NOTCH',
        lawZh: '蓝宝石 {0001} 底面接触双晶 (沿 c 轴旋转 180° · 3̄m 桶状腰部三组凹槽)',
        reentrantLabel: '三方桶状锥面跨 (0001) 镜像对称形成三处腰棱凹入角',
        planeOrigin3D: [0, 0, 0],
        traceDir3D: [1, 0, 0],
        notchAnchor3D: [0.68, -0.38, 0],
      },
    };
  },

  tourmaline() {
    // Tourmaline R3m (polar hemimorphic point group 3m — NO L2, NO inversion center C!):
    // Elbaite cell: a = 15.84 Å, c = 7.10 Å -> {10-11} normal theta = 27°22' -> rare {10-11} contact twin c^c = 125°16'!
    // Single habit: rounded Reuleaux-triangle prism (dominant trigonal prism {01-10} + subordinate hexagonal prism {11-20})
    // with steep +c trigonal pyramids r{10-11} + o{02-21} at +c AND flat pedion c'(000-1) + shallow pyramid at -c!
    const cell = buildLatticeBasis({ a: 15.84, b: 15.84, c: 7.10, gammaDeg: 120 });
    const gR = millerNormal(cell, [1, 0, -1, 1]); // theta = 27.37 deg
    const gO = millerNormal(cell, [0, 2, -2, 1]); // steeper ditrigonal/trigonal pyramid

    const planes = [
      // +c analogous pole: steep multi-pyramid termination (small or absent pedion)
      wulffPlane([0, 0, 1], 1.38, { hkl: '(0001)', familyZh: '正极小单面 c (0001)', rampKey: 'pinacoid' }),
      // -c antilogous pole: broad flat basal pedion (000-1) showing stark 3m hemimorphism!
      wulffPlane([0, 0, -1], 0.98, { hkl: '(0001̄)', familyZh: '负极平坦单面 c̄ (0001̄)', rampKey: 'ruby' }),
    ];

    // Dominant trigonal prism {01-10} (3 wide faces) + subordinate hexagonal prism {11-20} (6 bevel faces -> rounded triangle!)
    for (let i = 0; i < 3; i++) {
      const angTrig = Math.PI / 2 + (i * TAU) / 3; // 90, 210, 330 deg
      planes.push(
        wulffPlane([Math.cos(angTrig), Math.sin(angTrig), 0], 0.54, {
          hkl: '{011̄0}',
          familyZh: '三方柱主面 m {011̄0}',
          rampKey: 'emerald',
        })
      );
      // Steep +c pyramids {10-11} and {02-21}
      const rot = (i * TAU) / 3;
      const nR = rotateAroundAxis(gR, [0, 0, 1], rot);
      const nO = rotateAroundAxis(gO, [0, 0, 1], rot);
      planes.push(wulffPlane(nR, 1.06, { hkl: '{101̄1}', familyZh: '正极三方单锥 r {101̄1}', rampKey: 'pyramid' }));
      planes.push(wulffPlane(nO, 0.94, { hkl: '{022̄1}', familyZh: '正极陡三方单锥 o {022̄1}', rampKey: 'cyan' }));
    }
    for (let i = 0; i < 6; i++) {
      const angHex = (i * Math.PI) / 3;
      planes.push(
        wulffPlane([Math.cos(angHex), Math.sin(angHex), 0], 0.68, {
          hkl: '{112̄0}',
          familyZh: '第二六方柱 a {112̄0}',
          rampKey: 'prism',
        })
      );
    }

    const single = solveConvexHalfSpaces(planes);

    // Authentic Crystallographic Rare {10-11} Contact Twin (Dana / Goldschmidt: twin plane r{10-11}, c^c = 125°16' / supplement 54°44')!
    const contactTwin = buildInclinedContactTwin(planes, cell, [1, 0, -1, 1], {
      armOffset: 0.46,
      scaleSingle: 0.86,
      planeHklLabel: '(101̄1)',
      planeLabelEn: '{101̄1} RARE TWIN',
      lawZh: "电气石罕见 {101̄1} 接触双晶 (3m 异极晶 · 实算 c∧c = 125°16')",
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '异极两柱 +c∧+c 夹角',
    });

    return {
      systemId: 'trigonal',
      pointGroup: '3m',
      single: [single],
      twin: contactTwin.solids,
      twinInfo: contactTwin.twinInfo,
    };
  },

  // === 5. ORTHORHOMBIC (4) ===
  topaz() {
    // Topaz Pbnm (mmm): a = 4.650 Å, b = 8.800 Å, c = 8.394 Å -> rare {101} contact twin reference (theta = 61°00' -> c^c = 58°00')
    const cell = buildLatticeBasis({ a: 4.650, b: 8.800, c: 8.394 });
    const planes = [
      ...pairedWulff([0, 0, 1], 1.18, { hkl: '{001}', familyZh: '极完全解理底面 {001}', rampKey: 'pinacoid' }),
      ...pairedWulff(millerNormal(cell, [1, 1, 0]), 0.72, { hkl: '{110}', familyZh: '斜方柱 m {110}', rampKey: 'pyrito' }),
      ...pairedWulff(millerNormal(cell, [1, -1, 0]), 0.72, { hkl: '{110}', familyZh: '斜方柱 m {110}', rampKey: 'pyrito' }),
      ...pairedWulff(millerNormal(cell, [1, 2, 0]), 0.74, { hkl: '{120}', familyZh: '斜方柱 l {120}', rampKey: 'gold' }),
      ...pairedWulff(millerNormal(cell, [1, -2, 0]), 0.74, { hkl: '{120}', familyZh: '斜方柱 l {120}', rampKey: 'gold' }),
    ];
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        planes.push(wulffPlane(millerNormal(cell, [s1, 0, s2]), 1.08, { hkl: '{101}', familyZh: '斜方坡面 d {101}', rampKey: 'trap' }));
        planes.push(wulffPlane(millerNormal(cell, [0, 2 * s1, s2]), 1.10, { hkl: '{021}', familyZh: '斜方坡面 f {021}', rampKey: 'pyramid' }));
      }
    }
    const single = solveConvexHalfSpaces(planes);
    const rareTwin = buildInclinedContactTwin(planes, cell, [1, 0, 1], {
      armOffset: 0.48,
      scaleSingle: 0.86,
      planeHklLabel: '(101)',
      planeLabelEn: '{101} RARE TWIN',
      lawZh: "托帕石罕见 {101} 接触双晶对照 (自然界极罕见双晶 · c∧c = 57°58')",
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '{101} 接触双晶 c∧c 夹角',
    });
    return {
      systemId: 'orthorhombic',
      pointGroup: 'mmm',
      single: [single],
      twin: rareTwin.solids,
      twinInfo: rareTwin.twinInfo,
    };
  },

  peridot() {
    // Forsterite Peridot Pbnm (mmm): a = 4.756 Å, b = 10.207 Å, c = 5.980 Å
    // {011} Contact Twin: normal theta = 30°22' -> c^c = 119°16' (supplement 60°44')!
    const cell = buildLatticeBasis({ a: 4.756, b: 10.207, c: 5.980 });
    const planes = buildMetricPlanes({
      angles: [90, 90, 90],
      a: 0.82,
      b: 0.58,
      c: 1.04,
      corner: 0.22,
      endSlopeA: 0.66,
      endSlopeB: 0.60,
      endCut: 0.24,
      rampSide: 'prism',
      rampEnd: 'dodeca',
      rampCap: 'pinacoid',
      sideLabel: '橄榄石斜方柱 {110}/{010}',
      endLabel: '斜方坡面 {021}/{101}',
      capLabel: '底面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);
    const vTwin = buildInclinedContactTwin(planes, cell, [0, 1, 1], {
      armOffset: 0.44,
      scaleSingle: 0.86,
      planeHklLabel: '(011)',
      planeLabelEn: '{011} V-CONTACT TWIN',
      lawZh: "镁橄榄石 {011} 心形/膝状接触双晶 (实算 c∧c = 119°16' · 锐补角 60°44')",
      category: 'contact',
      isRareOrGrowth: false,
      reentrantPrefixZh: '心形双晶顶部 c∧c 夹角',
    });
    return {
      systemId: 'orthorhombic',
      pointGroup: 'mmm',
      single: [single],
      twin: vTwin.solids,
      twinInfo: vTwin.twinInfo,
    };
  },

  chrysoberyl() {
    // Chrysoberyl BeAl2O4 (Pmcn / Pnma, mmm): Pmcn setting a = 5.481 Å, b = 9.415 Å, c = 4.428 Å
    // {130} (Pnma {031}) prism angle = 2 * atan(3*5.481 / 9.415) ... wait: g_130 = [1/5.481, 3/9.415] -> 2 * atan((1/5.481)/(3/9.415)) = 59°35'!
    // Iconic Pseudo-Hexagonal Cyclic Trilling (三连晶轮式双晶) with razor-sharp concave peripheral V-notches at every 120 deg seam!
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
      endLabel: '斜方双锥 {111}',
      capLabel: '宽板面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);

    // 120 deg sector (-60 deg <= phi <= +60 deg):
    // Outer {010} pinacoid at phi=0 (d=0.90) + steep prism faces at phi = +/-74 deg (> 60 deg!)
    // so radius peaks at corners (+/-26 deg, r=1.01) and plunges inward to r=0.72 at every +/-60 deg seam -> true V-notches!
    const vAng = 74 * RAD;
    const sectorPlanes = [
      ...pairedWulff([0, 0, 1], 0.34, { hkl: '{001}', familyZh: '三连晶板面 {001}', rampKey: 'twinA' }),
      wulffPlane([1, 0, 0], 0.90, { hkl: '{010}', familyZh: '外缘板柱面 {010}', rampKey: 'twinA' }),
      wulffPlane([Math.cos(vAng), Math.sin(vAng), 0], 0.70, { hkl: '{110}', familyZh: '燕尾凹槽斜面 {110}', rampKey: 'twinA' }),
      wulffPlane([Math.cos(vAng), -Math.sin(vAng), 0], 0.70, { hkl: '{11̄0}', familyZh: '燕尾凹槽斜面 {11̄0}', rampKey: 'twinA' }),
      // Beveled pyramidal crown edges {111}
      ...pairedWulff([1, 0, 1.35], 0.84, { hkl: '{011}', familyZh: '斜方坡面 {011}', rampKey: 'twinA' }),
      ...pairedWulff([Math.cos(vAng), Math.sin(vAng), 1.15], 0.74, { hkl: '{111}', familyZh: '斜方双锥 {111}', rampKey: 'twinA' }),
      ...pairedWulff([Math.cos(vAng), -Math.sin(vAng), 1.15], 0.74, { hkl: '{11̄1}', familyZh: '斜方双锥 {11̄1}', rampKey: 'twinA' }),
      // Exact 120 deg cyclic twin composition planes {130} / {031} at phi = +60 deg and -60 deg
      wulffPlane([-0.5, Math.sqrt(3) / 2, 0], 0.0, { hkl: '(130)', familyZh: '轮式双晶接合面 (130)', rampKey: 'twinA' }),
      wulffPlane([-0.5, -Math.sqrt(3) / 2, 0], 0.0, { hkl: '(13̄0)', familyZh: '轮式双晶接合面 (13̄0)', rampKey: 'twinA' }),
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

    const seamNotchR = 0.70 / Math.cos((74 - 60) * RAD);
    return {
      systemId: 'orthorhombic',
      pointGroup: 'mmm',
      single: [single],
      twin: [sec0, sec1, sec2],
      twinInfo: {
        enabled: true,
        category: 'cyclic',
        isRareOrGrowth: false,
        cAxisAngleDeg: 59.58,
        planeLabelEn: '{130} TRILLING 3X',
        reentrantTagEn: "3X V-NOTCH 59°35'",
        lawZh: "金绿宝石律 {130}/{031} 假六方轮式三连晶 (单晶折角 59°35' · 三处外缘燕尾凹槽)",
        reentrantLabel: '三扇区外缘交界呈典型向内凹入的 V 字燕尾缺口 (实为斜方二轴晶!)',
        planeOrigin3D: [0, 0, 0.34],
        traceDir3D: [0.5, -Math.sqrt(3) / 2, 0],
        notchAnchor3D: [0.5 * seamNotchR, (-Math.sqrt(3) / 2) * seamNotchR, 0.0],
      },
    };
  },

  tanzanite() {
    // Zoisite (Tanzanite) Pnma (mmm): a = 16.212 Å, b = 5.559 Å, c = 10.036 Å -> rare {101} contact twin reference (c^c = 116°29')
    const cell = buildLatticeBasis({ a: 16.212, b: 5.559, c: 10.036 });
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
      sideLabel: '黝帘石纵纹柱面 {110}/{100}',
      endLabel: '斜方端坡面 {101}/{011}',
      capLabel: '端面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);
    const rareTwin = buildInclinedContactTwin(planes, cell, [1, 0, 1], {
      armOffset: 0.52,
      scaleSingle: 0.84,
      planeHklLabel: '(101)',
      planeLabelEn: '{101} RARE TWIN',
      lawZh: "黝帘石/坦桑石罕见 {101} 接触双晶对照 (自然界极少双晶 · c∧c = 116°29')",
      category: 'contact',
      isRareOrGrowth: true,
      reentrantPrefixZh: '{101} 理论双晶夹角',
    });
    return {
      systemId: 'orthorhombic',
      pointGroup: 'mmm',
      single: [single],
      twin: rareTwin.solids,
      twinInfo: rareTwin.twinInfo,
    };
  },

  // === 6. MONOCLINIC (2) ===
  gypsum() {
    // Gypsum 2/m (morphological setting beta = 114.1 deg):
    // Single: tabular on {010} with prism m{110} and inclined monoclinic roof l{111} + base
    // Twin: Classic (100) Swallowtail Contact Twin — deep V-shaped re-entrant notch at TOP (+Z) and chevron point at BOTTOM (-Z)!
    const cell = buildLatticeBasis({ a: 5.679, b: 15.202, c: 6.286, betaDeg: 114.1 });
    const g100 = millerNormal(cell, [1, 0, 0]); // [+1, 0, 0] since va=[sinB,0,cosB], vc=[0,0,1]!
    const g010 = millerNormal(cell, [0, 1, 0]); // [0, 1, 0]
    const g001 = millerNormal(cell, [0, 0, 1]); // [+0.4083, 0, +0.9128] — slopes DOWN from -X to +X!
    const g110 = millerNormal(cell, [1, 1, 0]);
    const g1m10 = millerNormal(cell, [1, -1, 0]);
    const gRoof = millerNormal(cell, [0, 1, 1]);
    const gRoofM = millerNormal(cell, [0, -1, 1]);

    const planes = [
      ...pairedWulff(g100, 0.72, { hkl: '{100}', familyZh: '前轴双面 {100}', rampKey: 'rhomb' }),
      ...pairedWulff(g010, 0.32, { hkl: '{010}', familyZh: '极完全解理板面 {010}', rampKey: 'pinacoid' }),
      ...pairedWulff(g110, 0.62, { hkl: '{110}', familyZh: '单斜柱 m {110}', rampKey: 'rhomb' }),
      ...pairedWulff(g1m10, 0.62, { hkl: '{110}', familyZh: '单斜柱 m {110}', rampKey: 'rhomb' }),
      ...pairedWulff(g001, 1.18, { hkl: '{001}/{1̄11}', familyZh: '单斜斜顶面 {1̄11}', rampKey: 'pyramid' }),
      ...pairedWulff(gRoof, 1.06, { hkl: '{011}', familyZh: '单斜坡面 l {011}', rampKey: 'cyan' }),
      ...pairedWulff(gRoofM, 1.06, { hkl: '{011}', familyZh: '单斜坡面 l {011}', rampKey: 'cyan' }),
    ];
    const single = solveConvexHalfSpaces(planes);

    // Swallowtail Twin on (100): shift Individual A into x <= 0 by [-0.42, 0, 0] and clip at x <= 0!
    // Because g001 = [+0.408, 0, +0.913], z_top(x) = (d - 0.408 x)/0.913 rises as x -> -0.9 and dips to minimum at x = 0!
    const swPlanes = planes.map((p) => {
      const offset = dot3(p.normal, [-0.42, 0, 0]);
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

    let topSeamZ = -Infinity;
    let botSeamZ = Infinity;
    for (const v of leftWing.vertices) {
      if (Math.abs(v[0]) < 1e-3) {
        if (v[2] > topSeamZ) topSeamZ = v[2];
        if (v[2] < botSeamZ) botSeamZ = v[2];
      }
    }

    return {
      systemId: 'monoclinic',
      pointGroup: '2/m',
      axisExtra: { betaDeg: 114.1 },
      single: [single],
      twin: [leftWing, rightWing],
      twinInfo: {
        enabled: true,
        category: 'contact',
        isRareOrGrowth: false,
        cAxisAngleDeg: 131.8,
        planeLabelEn: '(100) SWALLOWTAIL',
        reentrantTagEn: "SWALLOWTAIL 131°48'",
        lawZh: "透石膏 (100) 燕尾接触双晶 (Swallowtail Twin · 顶凹角 2(180°-β) = 131°48')",
        reentrantLabel: "顶部呈现经典 V 字燕尾双晶凹入角 (~131°48')，底部汇聚成箭簇尖端",
        planeOrigin3D: [0, 0, 0.5 * (topSeamZ + botSeamZ)],
        traceDir3D: [0, 0, 1],
        notchAnchor3D: [0, 0, topSeamZ],
      },
    };
  },

  orthoclase() {
    // Orthoclase C2/m (2/m): a = 8.563 Å, b = 12.963 Å, c = 7.190 Å, beta = 116.07 deg
    // Carlsbad [001] Penetration Twin: two monoclinic crystals rotated 180 deg around [001], intergrown along (010)!
    const planes = buildMetricPlanes({
      angles: [90, 116.07, 90],
      a: 0.82,
      b: 0.54,
      c: 1.12,
      corner: 0.14,
      endSlopeA: 0.48,
      endSlopeB: 0.0,
      endCut: 0.15,
      rampSide: 'trap',
      rampEnd: 'pyrito',
      rampCap: 'pinacoid',
      sideLabel: '正长石单斜柱面 {110}/{010}',
      endLabel: '后斜坡面 {2̄01}',
      capLabel: '底面 {001}',
    });
    const single = solveConvexHalfSpaces(planes);

    const carlA = transformSolid(single, (p) => add3(p, [0, -0.20, 0.06]), (n) => n, 'twinA');
    const carlB = transformSolid(
      single,
      (p) => add3(rotateAroundAxis(p, [0, 0, 1], Math.PI), [0, 0.20, -0.06]),
      (n) => rotateAroundAxis(n, [0, 0, 1], Math.PI),
      'twinB'
    );

    return {
      systemId: 'monoclinic',
      pointGroup: '2/m',
      axisExtra: { betaDeg: 116.07 },
      single: [single],
      twin: [carlA, carlB],
      twinInfo: {
        enabled: true,
        category: 'penetration',
        isRareOrGrowth: false,
        cAxisAngleDeg: 180.0,
        planeLabelEn: '[001] CARLSBAD TWIN',
        reentrantTagEn: "STEP NOTCH 127°52'",
        lawZh: '正长石卡斯巴律 [001] 贯穿双晶 (沿 c 轴旋转 180° 并以 (010) 穿插连生)',
        reentrantLabel: '两组反向倾斜的 {001} 与 {2̄01} 端面交错穿出形成特征阶梯贯穿凹角',
        planeOrigin3D: [0, 0, 0],
        traceDir3D: [0, 0, 1],
        notchAnchor3D: [0, 0, 0.96],
      },
    };
  },

  // === 7. TRICLINIC (2) ===
  kyanite() {
    // Kyanite P-1 (1̄): a = 7.126 Å, b = 7.852 Å, c = 5.572 Å, alpha = 89.99°, beta = 101.11°, gamma = 106.03°
    // Single: elongated bladed triclinic crystal flattened on {100}
    // Twin: Authentic {100} Pinacoidal Contact Twin — two triclinic blades reflected/rotated across {100}, forming chevron re-entrant notch at termination!
    const cell = buildLatticeBasis({
      a: 7.126,
      b: 7.852,
      c: 5.572,
      alphaDeg: 89.99,
      betaDeg: 101.11,
      gammaDeg: 106.03,
    });
    const g100 = millerNormal(cell, [1, 0, 0]);
    const g010 = millerNormal(cell, [0, 1, 0]);
    const g001 = millerNormal(cell, [0, 0, 1]);
    const g110 = millerNormal(cell, [1, 1, 0]);

    const planes = [
      ...pairedWulff(g100, 0.28, { hkl: '{100}', familyZh: '蓝晶石扁平板面 {100}', rampKey: 'sapphire' }),
      ...pairedWulff(g010, 0.72, { hkl: '{010}', familyZh: '三斜侧柱面 {010}', rampKey: 'cyan' }),
      ...pairedWulff(g110, 0.66, { hkl: '{110}', familyZh: '三斜窄斜柱面 {110}', rampKey: 'octa' }),
      ...pairedWulff(g001, 1.48, { hkl: '{001}', familyZh: '三斜斜端面 {001}', rampKey: 'pinacoid' }),
    ];
    const single = solveConvexHalfSpaces(planes);

    // Orient g100 -> [1, 0, 0] so the {100} blade contact plane is vertical x = 0, with two contiguous blades side-by-side!
    const rotAxis = len3(cross3(g100, [1, 0, 0])) > 1e-6 ? unit3(cross3(g100, [1, 0, 0])) : [0, 0, 1];
    const rotAng = Math.acos(clamp(dot3(g100, [1, 0, 0]), -1, 1));
    const mapBlade = (v) => rotateAroundAxis(v, rotAxis, rotAng);

    const bladePlanesA = planes.map((p) => {
      const rn = mapBlade(p.normal);
      const offset = dot3(rn, [-0.26, 0, 0]);
      return wulffPlane(rn, p.distance + offset, { ...p, rampKey: 'twinA' });
    });
    bladePlanesA.push(wulffPlane([1, 0, 0], 0.0, { hkl: '(100)', familyZh: '蓝晶石双晶面 (100)', rampKey: 'twinA' }));
    const bladeA = solveConvexHalfSpaces(bladePlanesA);
    // Reflection across (100) = 180 deg rotation around normal to (100) since Kyanite is centrosymmetric 1̄!
    const bladeB = transformSolid(
      bladeA,
      (p) => reflectAcrossPlane(p, [1, 0, 0]),
      (n) => reflectAcrossPlane(n, [1, 0, 0]),
      'twinB'
    );

    let seamTopZ = -Infinity;
    for (const v of bladeA.vertices) {
      if (Math.abs(v[0]) < 1e-3 && v[2] > seamTopZ) seamTopZ = v[2];
    }

    return {
      systemId: 'triclinic',
      pointGroup: '1̄',
      axisExtra: { alphaDeg: 89.99, betaDeg: 101.11, gammaDeg: 106.03 },
      single: [single],
      twin: [bladeA, bladeB],
      twinInfo: {
        enabled: true,
        category: 'contact',
        isRareOrGrowth: false,
        cAxisAngleDeg: 157.8,
        planeLabelEn: '{100} BLADE TWIN',
        reentrantTagEn: 'TRICLINIC CHEVRON',
        lawZh: '蓝晶石 {100} 板面接触双晶 (三斜斜端面 {001} 跨 (100) 呈人字凹槽)',
        reentrantLabel: '两枚三斜扁板晶沿 {100} 解理面连生，端面呈反向倾斜燕尾缺口',
        planeOrigin3D: [0, 0, 0],
        traceDir3D: [0, 0, 1],
        notchAnchor3D: [0, 0, seamTopZ],
      },
    };
  },

  albite() {
    // Albite C-1 (1̄): a = 8.138 Å, b = 12.785 Å, c = 7.158 Å, alpha = 94.26°, beta = 116.60°, gamma = 87.71°
    // Cleavage angle (001) ^ (010) = 86°24' (supplement 93°36')!
    // Albite Law {010} Polysynthetic Twin: 5 contiguous, zero-gap triclinic lamellae creating alternating sawtooth striations on {001}!
    const cell = buildLatticeBasis({
      a: 8.138,
      b: 12.785,
      c: 7.158,
      alphaDeg: 94.26,
      betaDeg: 116.60,
      gammaDeg: 87.71,
    });
    const g100 = millerNormal(cell, [1, 0, 0]);
    const g010 = millerNormal(cell, [0, 1, 0]);
    const g001 = millerNormal(cell, [0, 0, 1]);
    const g110 = millerNormal(cell, [1, 1, 0]);
    const g1m10 = millerNormal(cell, [1, -1, 0]);

    // Orient g010 -> [1, 0, 0] in twin assembly so the 5 {010} lamellae stack cleanly across left-to-right X
    // and show their sawtooth {001} re-entrant grooves right across the top!
    const planes = [
      ...pairedWulff(g100, 0.78, { hkl: '{100}', familyZh: '斜长石前柱面 {100}', rampKey: 'cyan' }),
      ...pairedWulff(g010, 0.38, { hkl: '{010}', familyZh: '三斜板面 {010}', rampKey: 'cyan' }),
      ...pairedWulff(g110, 0.74, { hkl: '{110}', familyZh: '三斜柱面 {110}', rampKey: 'octa' }),
      ...pairedWulff(g1m10, 0.74, { hkl: '{11̄0}', familyZh: '三斜柱面 {11̄0}', rampKey: 'octa' }),
      ...pairedWulff(g001, 1.02, { hkl: '{001}', familyZh: '斜顶解理面 {001}', rampKey: 'pinacoid' }),
    ];
    const single = solveConvexHalfSpaces(planes);

    // Rotate so g010 -> [1, 0, 0] and c stays near +Z:
    const rotAxis = len3(cross3(g010, [1, 0, 0])) > 1e-6 ? unit3(cross3(g010, [1, 0, 0])) : [0, 0, 1];
    const rotAng = Math.acos(clamp(dot3(g010, [1, 0, 0]), -1, 1));
    const mapLam = (v) => rotateAroundAxis(v, rotAxis, rotAng);

    // Exaggerate the triclinic (001)^(010) = 86°24' tilt slightly on outer envelope? NO — let's check exact angle first!
    // Wait: 86.4 deg vs 93.6 deg is a 7.2 deg roof-pitch flip at every lamella seam! Across 5 slabs of width 0.22, let's also keep exact crystallographic normals for {100}/{110}/{001}!
    const outerEnvelope = [
      ...pairedWulff(mapLam(g100), 0.78, { hkl: '{100}', familyZh: '聚片前柱面 {100}', rampKey: 'twinA' }),
      ...pairedWulff(mapLam(g001), 0.96, { hkl: '{001}', familyZh: '聚片阶梯解理面 {001}', rampKey: 'twinA' }),
    ];

    const lamCount = 5;
    const slabW = 0.21;
    const totalHalf = (lamCount * slabW) / 2;
    const lamellae = [];
    for (let k = 0; k < lamCount; k++) {
      const xLo = -totalHalf + k * slabW;
      const xHi = xLo + slabW;
      const isOdd = k % 2 === 1;
      const ramp = isOdd ? 'twinB' : 'twinA';
      const slabPlanes = outerEnvelope.map((p) => {
        const n = isOdd ? reflectAcrossPlane(p.normal, [1, 0, 0]) : p.normal;
        return wulffPlane(n, p.distance, { ...p, rampKey: ramp });
      });
      slabPlanes.push(wulffPlane([-1, 0, 0], -xLo, { hkl: '(01̄0)', familyZh: '聚片双晶接合面 {010}', rampKey: ramp }));
      slabPlanes.push(wulffPlane([1, 0, 0], xHi, { hkl: '(010)', familyZh: '聚片双晶接合面 {010}', rampKey: ramp }));
      lamellae.push(solveConvexHalfSpaces(slabPlanes));
    }

    return {
      systemId: 'triclinic',
      pointGroup: '1̄',
      axisExtra: { alphaDeg: 94.26, betaDeg: 116.60, gammaDeg: 87.71 },
      single: [single],
      twin: lamellae,
      twinInfo: {
        enabled: true,
        category: 'polysynthetic',
        isRareOrGrowth: false,
        cAxisAngleDeg: 7.2,
        planeLabelEn: '{010} POLYSYNTHETIC',
        reentrantTagEn: "STRIAE 86°24'/93°36'",
        lawZh: "钠长石律 {010} 聚片五连双晶 (解理夹角 86°24' 交替反折形成平行双晶细纹)",
        reentrantLabel: "奇数/偶数片晶沿 (010) 镜像交替，{001} 顶面呈现 ~7°12' 锯齿状聚片凹槽",
        planeOrigin3D: [0.5 * slabW, 0, 0],
        traceDir3D: [0, 0, 1],
        notchAnchor3D: [0.5 * slabW, -0.45, 0.92],
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
    const { solids, mapPoint } = normalizeAssemblyWithTransform(rawSolids, 1.0);
    const totalFaces = solids.reduce((acc, s) => acc + s.faces.length, 0);
    const sym = symmetrySpecForPointGroup(built.pointGroup, built.systemId, built.axisExtra || {});

    let normTwinInfo = null;
    if (built.twinInfo) {
      normTwinInfo = {
        ...built.twinInfo,
        activeMode: mode === 'twin',
        planeOrigin3D: built.twinInfo.planeOrigin3D ? mapPoint(built.twinInfo.planeOrigin3D) : [0, 0, 0],
        traceDir3D: built.twinInfo.traceDir3D ? unit3(built.twinInfo.traceDir3D) : [0, 0, 1],
        notchAnchor3D: built.twinInfo.notchAnchor3D ? mapPoint(built.twinInfo.notchAnchor3D) : [0, 0, 0.5],
      };
    }

    base = {
      solids,
      symmetryAxes: sym.axes,
      symmetrySummaryZh: sym.summaryZh,
      pointGroup: built.pointGroup,
      twinMeta: normTwinInfo,
      twinInfo: mode === 'twin' ? normTwinInfo : null,
      totalFaces,
      dihedralSample: sampleDihedralAngle(solids),
    };
    MINERAL_MESH_CACHE.set(cacheKey, base);
  }

  const finalSolids = explode > 1e-4 ? explodeSolids(base.solids, explode) : base.solids;
  return {
    solids: finalSolids,
    symmetryAxes: base.symmetryAxes,
    symmetrySummaryZh: base.symmetrySummaryZh,
    pointGroup: base.pointGroup,
    twinMeta: base.twinMeta,
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
  let pointGroup = 'm3̄m';

  switch (key) {
    case 'cube_100':
      planes = planesCube100(1.0, 'cube', '立方体 {100}');
      break;
    case 'octa_111':
      planes = planesOcta111(1.0, 'octa', '八面体 {111}');
      break;
    case 'tetra_111':
      pointGroup = '4̄3m';
      planes = planesTetra111(1.0, 'octa', '四面体 {111}');
      break;
    case 'dodeca_110':
      planes = planesDodeca110(1.0, 'dodeca', '菱形十二面体 {110}');
      break;
    case 'pyrito_210':
      pointGroup = '2/m3̄';
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
      pointGroup = '6/mmm';
      planes = [
        ...pairedWulff([0, 0, 1], 1.15, { hkl: '{0001}', familyZh: '开放端截窗 {0001}', rampKey: 'pinacoid' }),
      ];
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 6 + (i * Math.PI) / 3;
        planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], 0.80, { hkl: '{101̄0}', familyZh: '六方柱 {101̄0}', rampKey: 'prism' }));
      }
      break;
    }
    case 'tetrag_pyr': {
      systemId = 'tetragonal';
      pointGroup = '4mm';
      planes = [
        wulffPlane([0, 0, -1], 0.65, { hkl: '(001̄)', familyZh: '底面截窗 (开放单形封底)', rampKey: 'pinacoid' }),
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
      pointGroup = '3̄m';
      planes = planesRhombohedron(0.90, 0.86, 'rhomb', '菱面体 {101̄1}');
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
  const sym = symmetrySpecForPointGroup(pointGroup, systemId);
  const res = {
    solids,
    symmetryAxes: sym.axes,
    symmetrySummaryZh: sym.summaryZh,
    pointGroup,
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
  let pointGroup = 'm3̄m';

  if (mode === 'tetragonal') {
    systemId = 'tetragonal';
    pointGroup = '4/mmm';
    planes.push(
      ...pairedWulff([1, 0, 0], s100, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cube', formKey: '{100}' }),
      ...pairedWulff([0, 1, 0], s100, { hkl: '{100}', familyZh: '四方柱 {100}', rampKey: 'cube', formKey: '{100}' })
    );
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          planes.push(wulffPlane([sx, sy, sz * 1.08], s111, { hkl: '{111}', familyZh: '四方双锥 {111}', rampKey: 'octa', formKey: '{111}' }));
        }
      }
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        planes.push(wulffPlane([sx, sy, 0], s110, { hkl: '{110}', familyZh: '次四方柱 {110}', rampKey: 'dodeca', formKey: '{110}' }));
      }
    }
    planes.push(
      ...pairedWulff([0, 0, 1], s211, { hkl: '{001}', familyZh: '平行双面 {001}', rampKey: 'trap', formKey: '{211}' })
    );
  } else if (mode === 'hexagonal') {
    systemId = 'hexagonal';
    pointGroup = '6/mmm';
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 6 + (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], s100, { hkl: '{101̄0}', familyZh: '六方柱 {101̄0}', rampKey: 'cube', formKey: '{100}' }));
      planes.push(...pairedWulff([Math.cos(ang), Math.sin(ang), 0.92], s111, { hkl: '{101̄1}', familyZh: '六方双锥 {101̄1}', rampKey: 'octa', formKey: '{111}' }));
    }
    planes.push(
      ...pairedWulff([0, 0, 1], s110, { hkl: '{0001}', familyZh: '平行双面 {0001}', rampKey: 'dodeca', formKey: '{110}' })
    );
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      planes.push(wulffPlane([Math.cos(ang), Math.sin(ang), 0], s211, { hkl: '{112̄0}', familyZh: '第二六方柱 {112̄0}', rampKey: 'trap', formKey: '{211}' }));
    }
  } else {
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
  const sym = symmetrySpecForPointGroup(pointGroup, systemId);

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
    symmetryAxes: sym.axes,
    symmetrySummaryZh: sym.summaryZh,
  };
}
