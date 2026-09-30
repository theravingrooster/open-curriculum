#!/usr/bin/env node
// Fails if any internal link or asset reference in dist/ is broken.
// Resolves links the way Vercel serves the site (cleanUrls, vercel.json rewrites)
// and checks #fragments against element ids. Run after the build: node scripts/check-links.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) { console.error('dist/ not found. Run `node build.js` first.'); process.exit(1); }

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const routed = new Set([...(vercel.rewrites || []), ...(vercel.redirects || [])].map((r) => r.source));

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(DIST);

const ids = new Map();
function idsOf(file) {
  if (!ids.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return ids.get(file);
}

function resolve(target) {
  const candidates = target.endsWith('/') ? [target + 'index.html'] : [target, target + '.html', path.join(target, 'index.html')];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

const broken = [];
let checked = 0;
for (const file of files) {
  const ext = path.extname(file);
  if (ext !== '.html' && ext !== '.css') continue;
  const src = fs.readFileSync(file, 'utf8');
  const refs = ext === '.html'
    ? [...src.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1])
    : [...src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
  for (const raw of refs) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue; // external, mailto:, data:
    checked++;
    const ref = raw.replace(/&amp;/g, '&');
    const [pathPart, frag] = ref.split('#');
    const clean = decodeURIComponent(pathPart.split('?')[0]);
    const rel = path.relative(ROOT, file);
    if (clean === '' && frag === undefined) { broken.push(`${rel}: empty link`); continue; }
    let target;
    if (clean === '') target = file;
    else {
      const abs = clean.startsWith('/') ? path.join(DIST, clean) : path.join(path.dirname(file), clean);
      if (!abs.startsWith(DIST)) { broken.push(`${rel}: ${raw} (outside the site)`); continue; }
      const urlPath = '/' + path.relative(DIST, abs).split(path.sep).join('/');
      target = resolve(abs);
      if (!target && routed.has(urlPath)) continue;
    }
    if (!target) { broken.push(`${rel}: ${raw}`); continue; }
    if (frag && target.endsWith('.html') && !idsOf(target).has(frag)) broken.push(`${rel}: ${raw} (no id="${frag}")`);
  }
}

if (broken.length) {
  console.error(`Link check failed: ${broken.length} broken internal link(s)\n` + broken.map((b) => '  ✗ ' + b).join('\n'));
  process.exit(1);
}
console.log(`Link check passed: ${checked} internal links in ${files.length} files`);
