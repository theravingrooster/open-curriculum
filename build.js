#!/usr/bin/env node
// Builds the site into dist/ from data/curriculum.json, pages/, guides/ and public/.
// No dependencies. Run: node build.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const data = JSON.parse(read('data/curriculum.json'));
const errors = [];
const warnings = [];

// ---------- data ----------

const tracks = [...data.tracks].sort((a, b) => a.order - b.order);
const trackById = new Map(tracks.map((t) => [t.id, t]));
const topicById = new Map((data.topics || []).map((t) => [t.id, t]));
const books = data.books;
const bookBySlug = new Map();

for (const t of tracks) {
  for (const k of ['id', 'name', 'description', 'order']) if (t[k] === undefined) errors.push(`track ${t.id}: missing ${k}`);
}
if (new Set(tracks.map((t) => t.id)).size !== tracks.length) errors.push('duplicate track id');
books.forEach((b, i) => {
  b.index = i;
  for (const k of ['slug', 'title', 'author', 'year', 'tracks', 'level', 'status']) {
    if (b[k] === undefined) errors.push(`book ${b.slug || i}: missing ${k}`);
  }
  if (bookBySlug.has(b.slug)) errors.push(`duplicate book slug ${b.slug}`);
  bookBySlug.set(b.slug, b);
  if (!/^[a-z0-9-]+$/.test(b.slug)) errors.push(`book ${b.slug}: slug must be lowercase letters, digits and hyphens`);
  if (!['draft', 'published'].includes(b.status)) errors.push(`book ${b.slug}: status must be "draft" or "published"`);
  if (!Number.isInteger(b.level) || b.level < 1) errors.push(`book ${b.slug}: level must be a whole number from 1`);
  if (!Array.isArray(b.tracks) || b.tracks.length === 0) errors.push(`book ${b.slug}: needs at least one track`);
  for (const t of b.tracks || []) if (!trackById.has(t)) errors.push(`book ${b.slug}: unknown track "${t}"`);
  for (const t of b.topics || []) if (!topicById.has(t)) errors.push(`book ${b.slug}: unknown topic "${t}"`);
  b.guidePath = `guides/${b.slug}.md`;
  b.hasGuide = fs.existsSync(path.join(ROOT, b.guidePath));
  if (b.status === 'published' && !b.hasGuide) errors.push(`book ${b.slug}: published but ${b.guidePath} does not exist`);
});

const isPublished = (b) => b.status === 'published';
const byLevel = (a, b) => a.level - b.level || a.index - b.index;
const booksInTrack = (id) => books.filter((b) => b.tracks.includes(id)).sort(byLevel);

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
tracks.forEach((t, i) => { t.numeral = ROMAN[i] || String(i + 1); t.label = `Track ${t.numeral}`; });

// ---------- html helpers ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const guideHref = (b, prefix) => `${prefix}readings/${b.slug}.html`;
const trackHref = (t, prefix) => `${prefix}tracks/${t.id}.html`;

function bookItem(b, prefix) {
  const inner = `<span class="title">${esc(b.title)}</span><span class="who">${esc(b.author)}</span>`;
  return isPublished(b)
    ? `<li><a href="${guideHref(b, prefix)}">${inner}</a></li>`
    : `<li><span class="row">${inner}</span></li>`;
}

const NAV = [
  ['home', 'Home', 'index.html'],
  ['library', 'Library', 'library.html'],
  ['topics', 'Topics', 'topics.html'],
  ['about', 'Why', 'about.html'],
];

function layout({ title, body, prefix = '', active = '', head = '', footer = '' }) {
  const nav = NAV.map(([id, label, href]) =>
    `        <a${id === active ? ' class="active"' : ''} href="${prefix}${href}">${label}</a>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg" />
  <link rel="apple-touch-icon" href="${prefix}favicon.svg" />
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${prefix}styles.css" />${head}
</head>
<body>
  <header class="site">
    <div class="wrap">
      <a class="brand" href="${prefix}index.html"><img class="brand-mark" src="${prefix}favicon.svg" alt="" />The Open Curriculum</a>
      <nav>
${nav}
      </nav>
    </div>
  </header>

${body.trim()}

  <footer class="site">
    <div class="wrap">
      ${footer || `<span>The Open Curriculum · not a school · not accredited · on purpose</span>
      <a href="${prefix}library.html">Back to the library</a>`}
    </div>
  </footer>
</body>
</html>
`;
}

const SITE = 'The Open Curriculum';
const pages = new Map(); // output path -> html

// ---------- static pages (pages/*.html, with {{placeholders}}) ----------

const trackCards = `<div class="tracks">
${tracks.map((t) => `        <a class="track" href="${trackHref(t, '')}">
          <div class="n">${t.label}</div>
          <h3>${esc(t.name)}</h3>
          <p>${esc(t.description)}</p>
        </a>`).join('\n')}
      </div>`;

const vars = {
  track_cards: trackCards,
  track_count: String(tracks.length),
  book_count: String(books.length),
  guide_count: String(books.filter(isPublished).length),
};
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (!(k in vars)) { errors.push(`unknown placeholder ${m}`); return m; }
  return vars[k];
});

const STATIC_PAGES = [
  { src: 'index.html', title: `${SITE} — Real knowledge, no degree required`, active: 'home',
    head: ['machiavelli', 'kahneman', 'taleb', 'munger'].map((n) => `\n  <link rel="stylesheet" href="portrait-${n}.css" />`).join('') },
  { src: 'about.html', title: `Why this exists — ${SITE}`, active: 'about' },
  { src: 'how-to-read.html', title: `How to read — ${SITE}`, active: '' },
  { src: 'how-to-read-faster.html', title: `How to read faster — ${SITE}`, active: '' },
];
for (const p of STATIC_PAGES) {
  if (!fs.existsSync(path.join(ROOT, 'pages', p.src))) continue;
  pages.set(p.src, layout({ title: p.title, active: p.active, head: p.head || '', body: fill(read(`pages/${p.src}`)) }));
}

// ---------- library ----------

pages.set('library.html', layout({
  title: `Library — ${SITE}`,
  active: 'library',
  body: `
  <div class="hero">
    <div class="wrap">
      <p class="kicker">Table of contents</p>
      <h1>The library</h1>
      <p class="lede">Every track, every book, in one vertical list. Use find-in-page. If the title is here, it belongs on the curriculum. Linked titles have a guide; the rest are listed so you can see the sequence.</p>
      <p class="meta-line">${books.length} books · ${books.filter(isPublished).length} guides · Ctrl+F / ⌘F a title</p>
    </div>
  </div>

  <section>
    <div class="wrap">
      <div class="toc">
${tracks.map((t) => `        <div class="toc-track" id="${t.id}">
          <h2><a href="${trackHref(t, '')}">${t.label} — ${esc(t.name)}</a></h2>
          <p class="desc">${esc(t.description)}</p>
          <ul class="toc-list">
${booksInTrack(t.id).map((b) => '            ' + bookItem(b, '')).join('\n')}
          </ul>
        </div>`).join('\n\n')}
      </div>
    </div>
  </section>`,
}));

// ---------- track pages ----------

tracks.forEach((t, i) => {
  const prev = tracks[i - 1];
  const next = tracks[i + 1];
  const list = booksInTrack(t.id);
  const levels = [...new Set(list.map((b) => b.level))];
  pages.set(`tracks/${t.id}.html`, layout({
    title: `${t.label} — ${t.name} — ${SITE}`,
    prefix: '../',
    active: 'library',
    body: `
  <div class="hero">
    <div class="wrap">
      <p class="kicker">${t.label}</p>
      <h1>${esc(t.name)}</h1>
      <p class="lede">${esc(t.description)}</p>
    </div>
  </div>

  <section>
    <div class="wrap topics">
${levels.map((lv) => `      <div class="topic">
        <h3>Level ${lv}</h3>
        <ul class="readings">
${list.filter((b) => b.level === lv).map((b) => '          ' + bookItem(b, '../')).join('\n')}
        </ul>
      </div>`).join('\n')}
    </div>
  </section>`,
    footer: `${prev ? `<a href="${prev.id}.html">← ${esc(prev.name)}</a>` : `<span>${t.label} of ${ROMAN[tracks.length - 1] || tracks.length}</span>`}
      ${next ? `<a href="${next.id}.html">Next: ${esc(next.name)} →</a>` : '<a href="../library.html">Back to the library</a>'}`,
  }));
});

// ---------- topics ----------

pages.set('topics.html', layout({
  title: `Topics — ${SITE}`,
  active: 'topics',
  body: `
  <div class="hero">
    <div class="wrap">
      <p class="kicker">Browse by topic</p>
      <h1>Tracks are doors. Topics are rooms.</h1>
      <p class="lede">The tracks set the sequence. These shelves cut across them, for clusters that are real but should not get their own track.</p>
    </div>
  </div>

  <section>
    <div class="wrap topics">
${(data.topics || []).map((tp) => `      <div class="topic" id="${tp.id}">
        <h3>${esc(tp.name)}</h3>
        <p class="desc">${esc(tp.description)}</p>
        <ul class="readings">
${books.filter((b) => (b.topics || []).includes(tp.id)).map((b) => '          ' + bookItem(b, '')).join('\n')}
        </ul>
      </div>`).join('\n')}
    </div>
  </section>`,
}));

// ---------- guides ----------

// Minimal Markdown: ## / ### headings, "- " bullets, paragraphs, *em*, [text](url),
// and [[slug]] for a book in the data file (linked if published, plain title if draft).
function inline(s, ctx) {
  return esc(s)
    .replace(/\[\[([a-z0-9-]+)\]\]/g, (m, slug) => {
      const b = bookBySlug.get(slug);
      if (!b) { errors.push(`${ctx}: [[${slug}]] is not a book in data/curriculum.json`); return m; }
      return isPublished(b) ? `<a href="${b.slug}.html"><em>${esc(b.title)}</em></a>` : `<em>${esc(b.title)}</em>`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<em>$2</em>');
}

function markdown(src, ctx) {
  const out = [];
  const blocks = src.replace(/\r/g, '').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let m;
    if ((m = /^(#{2,3}) (.+)$/.exec(lines[0])) && lines.length === 1) {
      const tag = m[1].length === 2 ? 'h2' : 'h3';
      out.push(`<${tag}>${inline(m[2], ctx)}</${tag}>`);
    } else if (/^- /.test(lines[0])) {
      const items = [];
      for (const l of lines) {
        if (/^- /.test(l)) items.push(l.slice(2));
        else items[items.length - 1] += ' ' + l.trim();
      }
      out.push('<ul>\n' + items.map((i) => `  <li>${inline(i, ctx)}</li>`).join('\n') + '\n</ul>');
    } else {
      out.push(`<p>${inline(lines.map((l) => l.trim()).join(' '), ctx)}</p>`);
    }
  }
  return out.join('\n');
}

// Mechanical checks against GUIDE_SPEC.md. Errors fail the build; warnings are printed.
const BANNED = ['explores', 'delves', 'journey', 'powerful', 'timeless', 'game-changer', 'at its core',
  'ultimately', "in today's world", 'in today’s world', "it's important to note", 'it’s important to note'];
const words = (s) => (s.replace(/\[\[[a-z0-9-]+\]\]/g, 'Title').match(/[A-Za-z0-9’'$%.-]+/g) || []).length;

function lintGuide(b, src) {
  const ctx = b.guidePath;
  const err = (m) => errors.push(`${ctx}: ${m}`);
  const warn = (m) => warnings.push(`${ctx}: ${m}`);
  const lower = src.toLowerCase();
  for (const w of BANNED) if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) err(`banned word "${w}"`);
  if (/!/.test(src.replace(/\[[^\]]*\]\([^)]*\)/g, ''))) err('exclamation point');
  if (/\*\*|__/.test(src)) err('bold text');
  if (/\p{Extended_Pictographic}/u.test(src)) err('emoji');
  if (/\btracks?\b(?!\s+records?)|\bcurriculum\b/i.test(src.replace(/\[\[[a-z0-9-]+\]\]/g, ''))) err('mentions tracks or the curriculum');
  if (/\?/.test(src)) warn('contains a question mark; check it is not a rhetorical question');
  if (/you['’]ll find|this book will/i.test(src)) err('"you\'ll find" / "this book will"');

  const sections = src.split(/^## /m).slice(1).map((s) => {
    const nl = s.indexOf('\n');
    return { heading: s.slice(0, nl).trim(), body: s.slice(nl + 1).trim() };
  });
  const names = sections.map((s) => s.heading);
  if (names[0] !== 'Thesis') err('first section must be "## Thesis"');
  if (names[1] !== 'The book in brief') err('second section must be "## The book in brief"');
  if (names[names.length - 2] !== 'Limits') err('second-to-last section must be "## Limits"');
  if (names[names.length - 1] !== 'Related') err('last section must be "## Related"');
  const ideas = sections.slice(2, -2);
  if (ideas.length < 4 || ideas.length > 8) err(`${ideas.length} idea sections; spec asks for 4–8`);
  const brief = sections[1] ? sections[1].body : '';
  const bullets = brief.split('\n').filter((l) => /^- /.test(l)).length;
  if (bullets < 5 || bullets > 7) err(`book in brief has ${bullets} bullets; spec asks for 5–7`);
  if (words(brief) >= 200) err(`book in brief is ${words(brief)} words; spec asks for under 200`);
  for (const s of ideas) {
    const n = words(s.body);
    if (n < 100 || n > 250) warn(`idea "${s.heading}" is ${n} words; spec asks for 100–250`);
  }
  const related = sections[sections.length - 1] ? sections[sections.length - 1].body : '';
  const rel = related.split('\n').filter((l) => /^- \[\[[a-z0-9-]+\]\]/.test(l));
  if (rel.length < 2 || rel.length > 3) err(`related has ${rel.length} [[slug]] items; spec asks for 2–3`);
  for (const l of rel) if (l.includes(`[[${b.slug}]]`)) err('related lists the book itself');
  const total = words(src);
  if (total > 2000) warn(`${total} words; spec asks for 1,200–2,000`);
  if (total < 1200) warn(`${total} words; spec asks for 1,200–2,000 (shorter is allowed if the book has fewer ideas)`);
  b.wordCount = total;
}

function neighbours(b, t) {
  const pub = booksInTrack(t.id).filter(isPublished);
  const i = pub.indexOf(b);
  return { prev: pub[i - 1], next: pub[i + 1] };
}

for (const b of books.filter(isPublished)) {
  if (!b.hasGuide) continue;
  const src = read(b.guidePath);
  lintGuide(b, src);
  const bookTracks = b.tracks.map((id) => trackById.get(id)).sort((x, y) => x.order - y.order);
  const kicker = bookTracks.map((t) => `<a href="${trackHref(t, '../')}">${esc(t.name)}</a>`).join(' · ') + ` · Level ${b.level}`;
  const nav = bookTracks.map((t) => {
    const { prev, next } = neighbours(b, t);
    return `    <div class="guide-nav-row">
      <p class="level"><a href="${trackHref(t, '../')}">${t.label} — ${esc(t.name)}</a></p>
      <div class="guide-nav-links">
        ${prev ? `<a href="${prev.slug}.html">← ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a href="${next.slug}.html">${esc(next.title)} →</a>` : '<span></span>'}
      </div>
    </div>`;
  }).join('\n');
  pages.set(`readings/${b.slug}.html`, layout({
    title: `${b.title} — ${SITE}`,
    prefix: '../',
    body: `
  <article class="reading guide wrap">
    <p class="kicker">${kicker}</p>
    <h1>${esc(b.title)}</h1>
    <p class="byline">${esc(b.author)} · ${esc(b.year)}</p>

${markdown(src, b.guidePath).replace(/^/gm, '    ')}

    <nav class="guide-nav" aria-label="Guide navigation">
${nav}
    </nav>
  </article>`,
  }));
}

for (const b of books) {
  if (b.hasGuide && !isPublished(b)) warnings.push(`${b.guidePath}: guide exists but the book is a draft, so it is not built`);
}

// ---------- write ----------

if (errors.length) {
  console.error('Build failed:\n' + errors.map((e) => '  ✗ ' + e).join('\n'));
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
for (const [file, html] of pages) {
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}
for (const w of warnings) console.warn('  ! ' + w);
const published = books.filter(isPublished);
console.log(`Built ${pages.size} pages into dist/ · ${tracks.length} tracks · ${books.length} books · ${published.length} guides` +
  (published.length ? ` (${published.map((b) => `${b.slug}: ${b.wordCount} words`).join(', ')})` : ''));
