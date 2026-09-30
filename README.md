# The Open Curriculum

A static site for a free “real knowledge” library — tracks, topics, and guides that distill each book to the ideas that matter. Modeled on the shape of a curriculum, not a catalog. Aimed at judgment, capital, the body, power, and character.

Live target: Vercel, linked to this repo.

## What’s here

- `data/curriculum.json` — tracks, topics and books. The only place track membership, levels and publish status live.
- `guides/<slug>.md` — guide text, one file per published book. Written to `GUIDE_SPEC.md`.
- `pages/` — home and mission page bodies.
- `public/` — `styles.css` and favicon.
- `assets/` — portraits, the home page's 3D background (`assets/js/hero-cube.js`, bundled from `src/hero-cube.js` with `npm run bundle:hero`; commit the bundle) and its static fallback `assets/hero-static.webp`.
- `data/authors.json` — portrait and license credit per author. The author list itself comes from the books in `data/curriculum.json`.
- `build.js` — generates the library, track pages, topics, home track cards and guide pages into `dist/`.
- `scripts/check-links.js` — fails if any internal link in `dist/` is broken.
- `vercel.json` — Vercel runs `npm test` (build, then link check) and serves `dist/` with clean URLs.

## Stack decision (do not quietly change this)

The site is static HTML. The build is one Node script with no dependencies; it only turns the data file and guide text into HTML.

Do **not** migrate to Next.js / merge into `elenchus-site` unless asked. Elenchus is a separate product (`theravingrooster/elenchus-site`, already on Vercel). This repo is the library.

## Common edits

All of these are edits to `data/curriculum.json`, then `npm test`.

- Add a book: add an entry to `books` with `slug`, `title`, `author`, `year`, `tracks`, `level`, `topics` and `"status": "draft"`. It appears in the library, its tracks and its topics as plain text.
- Publish a guide: write `guides/<slug>.md` following `GUIDE_SPEC.md`, then set the book’s `status` to `"published"`. Every list, prev/next link and `[[slug]]` reference turns into a link.
- Rename a track: change its `name` (or `description`). Keep the `id` so links stay stable.
- Add a track: add an entry to `tracks` with a new `id`, `name`, `description` and `order`, then add the `id` to each book’s `tracks`.
- Remove a track: delete it from `tracks` and remove its `id` from every book’s `tracks`. The build fails if a book still names it or is left with no track.
- Reorder tracks: change `order`. Numbering (Track I, II, …) follows.
- Books within a track are ordered by `level`, then by their position in `books`.
- Add author portraits: put transparent cut-outs (head and shoulders), named after the author, e.g. `daniel-kahneman.png`, in a folder and run `python3 scripts/portraits.py <folder>` (needs Pillow). It trims, scales, fades the bottom edge, writes `assets/portraits/<name>.webp` (240×240, ~10 KB) and records it in `data/authors.json`. Authors without one show floating initials. If a portrait is a licensed photo, add its `credit` (title, creator, license, licenseUrl, source) so the Credits page attributes it.

## License note

Guides are original commentary. Copyrighted works stay off the site.

## Handoff for later Grok sessions

GitHub: `theravingrooster/open-curriculum` (public)  
Vercel team id used for this account: `team_558MMLN7a4Dp7vUzJIImhNOi`  
Existing other project: `elenchus-site` — leave it alone.

Next useful work, in order:

1. Add a custom domain.
2. Write the next unpublished guides, in track order, then level order.
3. Add a simple search box on the topics page if the list gets long.
