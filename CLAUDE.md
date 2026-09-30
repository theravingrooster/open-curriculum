# The Open Curriculum

When writing or editing a book guide, follow GUIDE_SPEC.md exactly. Track membership lives only in the curriculum data file.

## Layout

- `data/curriculum.json` — the only place tracks, topics and books are defined (track order, book tracks, level, status).
- `guides/<slug>.md` — guide text for a book. The build wraps it in the guide template (`build.js`), which adds the title line, track labels and prev/next links from the data file.
- `pages/` — hand-written page bodies (home, about). `{{placeholders}}` are filled from the data file.
- `public/` — CSS, favicon, portraits, copied as-is.
- `build.js` — writes the site to `dist/`. `scripts/check-links.js` — fails on any broken internal link.

## Guide markdown

- Sections are `## Thesis`, `## The book in brief`, one `## ` per idea, `## Limits`, `## Related`.
- Refer to another book with `[[slug]]`. It renders as a link when that guide is published, plain text when it is a draft.
- `*italics*` and `[text](url)` are supported. Nothing else.

## Checks

Run `npm test` (build, then link check) before every commit. The build also fails on guide-spec violations it can detect mechanically (banned words, bold, exclamation points, section structure, mentions of tracks).
