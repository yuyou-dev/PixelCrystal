#!/usr/bin/env node
// SUVA · 苏哇科技 · PixelCrystal Build & Offline Cartridge Packager (Zero External Dependencies)
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

function buildOfflineHtml() {
  const srcDir = path.join(ROOT, 'src');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // Topological leaf-to-root module encoding as data:text/javascript;base64 URIs
  // so native ES module semantics stay 100% intact even over file:// offline!
  const moduleOrder = [
    'palette.js',
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

  // Inline SVG favicon if referenced from ./assets/
  offline = offline.replace(/href=["']\.\/assets\/([A-Za-z0-9_-]+\.svg)["']/g, (m, svgName) => {
    const svgPath = path.join(ROOT, 'assets', svgName);
    if (!fs.existsSync(svgPath)) return m;
    const b64 = Buffer.from(fs.readFileSync(svgPath, 'utf8'), 'utf8').toString('base64');
    return `href="data:image/svg+xml;base64,${b64}"`;
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

  // Copy markdown docs for transparency on Pages
  fs.mkdirSync(path.join(DIST, 'docs'), { recursive: true });
  for (const docName of ['LICENSING.md', 'SCIENCE.md']) {
    const p = path.join(ROOT, 'docs', docName);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(DIST, 'docs', docName));
  }

  const offlineHtml = buildOfflineHtml();
  const offlinePath = path.join(DIST, 'PixelCrystal-Offline.html');
  fs.writeFileSync(offlinePath, offlineHtml, 'utf8');

  console.log(`[PixelCrystal] Built dist/ + standalone cartridge (${(offlineHtml.length / 1024).toFixed(1)} KB): ${offlinePath}`);
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
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.resolve(dir, rel);
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
