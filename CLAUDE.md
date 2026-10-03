# The Open Curriculum

When writing or editing a book guide, follow GUIDE_SPEC.md exactly. Track membership lives only in the curriculum data file.

## Layout

- `data/curriculum.json` — the only place tracks, topics and books are defined (track order, book tracks, level, status). Each book is in exactly one track. `"hidden": true` takes a book off the site (no listing, guide page or portrait; `[[slug]]` renders as plain text) without deleting it or its guide; delete the flag to restore it.
- `guides/<slug>.md` — guide text for a book. The build wraps it in the guide template (`build.js`), which adds the title line, track labels and prev/next links from the data file.
- `pages/` — hand-written page bodies (home, mission). `{{placeholders}}` are filled from the data file.
- `public/` — CSS and favicon, copied as-is.
- `assets/` — portraits, the home page's 3D background and its static fallback, copied to `dist/assets/`. `assets/js/hero-cube.js` is built from `src/hero-cube.js` with `npm run bundle:hero`; commit both.
- `data/authors.json` — portrait path and optional credit per author. Authors come from the books, but the home strip shows only authors with a portrait. Optional `quote` and `quoteSource` show above the portrait on hover; use only quotes verified against the author's own text. `quoteBook` is the slug of the book the quote comes from: the portrait links to that guide once it is published, and to the author's first published guide when there is no `quoteBook`. Add portraits with `python3 scripts/portraits.py <folder>`: transparent cut-outs named after the author (e.g. `daniel-kahneman.png`), processed into `assets/portraits/`. A credit is required only for licensed photos (CC BY / CC BY-SA need attribution on the Credits page).
- `build.js` — writes the site to `dist/`. `scripts/check-links.js` — fails on any broken internal link.

## Guide markdown

- Sections are `## Thesis`, `## The main ideas`, one `## ` per idea, `## Limits`, `## Related`. Fiction tracks (`"guide": "fiction"` on the track) use `## Premise` and `## Where it falls short` in place of Thesis and Limits; see GUIDE_SPEC.md.
- Refer to another book with `[[slug]]`. It renders as a link when that guide is published, plain text when it is a draft.
- `*italics*` and `[text](url)` are supported. Nothing else.

## Checks

Run `npm test` (build, then link check) before every commit. The build also fails on guide-spec violations it can detect mechanically (banned words, bold, exclamation points, section structure, mentions of tracks).
