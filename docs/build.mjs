#!/usr/bin/env node
// SUVA · 苏哇科技 · PixelCrystal Build & Offline Cartridge Packager (V2 Flagship + Preserved V1)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function copyDirRecursive(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function assetToDataUri(assetName) {
  const assetPath = path.join(ROOT, 'assets', assetName);
  if (!fs.existsSync(assetPath)) return null;
  const ext = path.extname(assetName).toLowerCase();
  const mime = ext === '.svg'
    ? 'image/svg+xml'
    : ext === '.woff2'
      ? 'font/woff2'
      : ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : 'application/octet-stream';
  const b64 = fs.readFileSync(assetPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function buildOfflineHtml() {
  const srcDir = path.join(ROOT, 'src');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // Topological leaf-to-root module encoding as data:text/javascript;base64 URIs
  const moduleOrder = [
    'palette.js',
    'pixel-sprites.js',
    'optics-core.js',
    'crystal-meshes.js',
    'game-data.js',
    'chiptune-sfx.js',
    'pixel-engine.js',
    'postcard-maker.js',
    'main.js',
  ];

  const dataUris = new Map();
  for (const file of moduleOrder) {
    const fullPath = path.join(srcDir, file);
    if (!fs.existsSync(fullPath)) continue;
    let code = fs.readFileSync(fullPath, 'utf8');
    // Inline any './assets/...' or '../assets/...' string references inside JS modules if needed
    code = code.replace(/(['"])(?:\.\/|\.\.\/)assets\/([A-Za-z0-9_.-]+\.(?:svg|png|woff2))(['"])/g, (m, q1, name, q2) => {
      const uri = assetToDataUri(name);
      return uri ? `${q1}${uri}${q2}` : m;
    });
    // Rewrite relative './xxx.js' specifiers to already-encoded data URIs
    code = code.replace(/(from\s+['"])\.\/([A-Za-z0-9_-]+\.js)(['"])/g, (m, p1, dep, p3) => {
      const uri = dataUris.get(dep);
      return uri ? `${p1}${uri}${p3}` : m;
    });
    code = code.replace(/(import\s*\(\s*['"])\.\/([A-Za-z0-9_-]+\.js)(['"]\s*\))/g, (m, p1, dep, p3) => {
      const uri = dataUris.get(dep);
      return uri ? `${p1}${uri}${p3}` : m;
    });
    const b64 = Buffer.from(code, 'utf8').toString('base64');
    dataUris.set(file, `data:text/javascript;base64,${b64}`);
  }

  const mainUri = dataUris.get('main.js');
  if (!mainUri) {
    throw new Error('src/main.js not found during offline build');
  }

  let offline = indexHtml.replace(
    /<script\s+type=["']module["']\s+src=["']\.\/src\/main\.js["']\s*><\/script>/i,
    `<script type="module" src="${mainUri}"></script>`
  );

  // Inline CSS url('./assets/...') and HTML src/href='./assets/...' (woff2, svg, png)
  offline = offline.replace(/url\(\s*['"]?\.\/assets\/([A-Za-z0-9_.-]+\.(?:woff2|svg|png))['"]?\s*\)/g, (m, name) => {
    const uri = assetToDataUri(name);
    return uri ? `url("${uri}")` : m;
  });
  offline = offline.replace(/(href|src)=["']\.\/assets\/([A-Za-z0-9_.-]+\.(?:svg|png|woff2))["']/g, (m, attr, name) => {
    const uri = assetToDataUri(name);
    return uri ? `${attr}="${uri}"` : m;
  });

  return offline;
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(DIST, 'LICENSE'));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  copyDirRecursive(path.join(ROOT, 'src'), path.join(DIST, 'src'));
  copyDirRecursive(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

  // Publish preserved Version 1 at /v1/ (dist/v1/index.html)
  if (fs.existsSync(path.join(ROOT, 'docs', 'v1'))) {
    copyDirRecursive(path.join(ROOT, 'docs', 'v1'), path.join(DIST, 'v1'));
  }

  // Copy markdown & license docs for transparency on Pages
  fs.mkdirSync(path.join(DIST, 'docs'), { recursive: true });
  for (const docName of ['LICENSING.md', 'SCIENCE.md', 'OFL-ArkPixel.txt']) {
    const p = path.join(ROOT, 'docs', docName);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(DIST, 'docs', docName));
  }

  const offlineHtml = buildOfflineHtml();
  const offlinePath = path.join(DIST, 'PixelCrystal-Offline.html');
  fs.writeFileSync(offlinePath, offlineHtml, 'utf8');

  console.log(`[PixelCrystal] Built V2 dist/ + preserved /v1/ + standalone V2 cartridge (${(offlineHtml.length / 1024).toFixed(1)} KB): ${offlinePath}`);
}

function serveStatic(dir, port = 0) {
  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    let filePath = path.resolve(dir, rel);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => {
    const addr = server.address();
    console.log(`[PixelCrystal] Local server listening on http://127.0.0.1:${addr.port}`);
  });
}

build();
if (process.argv.includes('--serve')) {
  const portArg = process.argv.find((a) => a.startsWith('--port='));
  const port = portArg ? Number(portArg.split('=')[1]) : 0;
  serveStatic(DIST, port);
}
