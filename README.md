# The Open Curriculum

A static site for a free “real knowledge” library — tracks, topics, and original reading guides. Modeled on the shape of a curriculum, not a catalog. Aimed at judgment, capital, the body, power, and character.

Live target: Vercel, linked to this repo.

## What’s here

- `index.html` — homepage
- `about.html` — why this exists
- `how-to-read.html` — method
- `tracks/` — five tracks
- `readings/` — original guides (maps, not book text)
- `styles.css` — shared design
- `vercel.json` — clean URLs (`/about` instead of `/about.html`)

No build step. Vercel serves the folder as a static site.

## Stack decision (do not quietly change this)

Keep this **static HTML** until the public site is live and the first seven guides feel finished.

Do **not** migrate to Next.js / merge into `elenchus-site` unless asked. Elenchus is a separate product (`theravingrooster/elenchus-site`, already on Vercel). This repo is the library.

## How to add a book

1. Copy `readings/meditations.html`.
2. Keep the skeleton: Level, title, byline, key ideas, Why / What to watch for / How to read / Takeaways / After this.
3. Write original commentary. Do not paste book text.
4. Link it from the right track page and from `index.html` if it belongs in the working canon.

## License note

Guides are original commentary. They are not substitutes for the books. Copyrighted works stay off the site.

## Handoff for later Grok sessions

GitHub: `theravingrooster/open-curriculum` (public)  
Vercel team id used for this account: `team_558MMLN7a4Dp7vUzJIImhNOi`  
Existing other project: `elenchus-site` — leave it alone.

Next useful work, in order:

1. Confirm the Vercel production URL and add a custom domain later.
2. Write the next Level 1 guides for titles that currently link to `#`.
3. Add a simple search box on `topics.html` if the list gets long.
4. Only then consider a content pipeline (markdown → HTML) if writing pages by hand becomes the bottleneck.
