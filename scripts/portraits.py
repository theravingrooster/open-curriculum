#!/usr/bin/env python3
"""Add author portraits.

Takes cut-out portraits (transparent background, head and shoulders) named after the author,
e.g. `daniel-kahneman.png`, `niccolo-machiavelli.webp`, and for each one:
  - trims the empty margin and scales the figure to a fixed height, centred and sitting on the
    bottom edge, so every portrait in the strip lines up;
  - fades the bottom edge out, so the shoulders melt into the page instead of ending in a line;
  - writes a 288x288 WebP (2x the 144px display size) to assets/portraits/<name>.webp;
  - records it in data/authors.json.

Usage: python3 scripts/portraits.py <folder-or-files...>      (needs Pillow: pip install pillow)
"""
import json, sys, unicodedata, re
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
SIZE = 288          # output square, px (2x the 144px display size)
FIGURE = 0.96       # figure height as a share of the square
FADE = 0.24         # bottom share of the figure that fades out
MAX_BYTES = 30_000

def slug(name):
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def main(args):
    files = []
    for a in args:
        p = Path(a)
        files += sorted(x for x in p.iterdir() if x.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg')) if p.is_dir() else [p]
    data_path = ROOT / 'data' / 'authors.json'
    data = json.loads(data_path.read_text())
    by_slug = {slug(n): n for n in data['authors']}
    out_dir = ROOT / 'assets' / 'portraits'
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in files:
        name = by_slug.get(slug(f.stem))
        if not name:
            print(f'  ! {f.name}: no author named like this in data/authors.json, skipped')
            continue
        fig = render(f)
        dest = out_dir / f'{slug(name)}.webp'
        for q in (86, 80, 74, 68, 60):
            fig.save(dest, 'WEBP', quality=q, method=6)
            if dest.stat().st_size <= MAX_BYTES:
                break
        entry = data['authors'].get(name) or {}
        entry['portrait'] = f'assets/portraits/{dest.name}'
        entry.setdefault('credit', None)
        data['authors'][name] = entry
        print(f'  ✓ {name}: {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)')
    data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def render(src):
    im = Image.open(src).convert('RGBA')
    box = im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        raise SystemExit(f'{src}: no visible pixels')
    im = im.crop(box)
    w, h = im.size
    scale = min(SIZE * FIGURE / h, SIZE / w)
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    w, h = im.size
    # Fade the bottom of the figure out so it melts into the page.
    fade_h = max(1, round(h * FADE))
    fade = Image.new('L', (w, h), 255)
    ramp = Image.linear_gradient('L').resize((w, fade_h)).point(lambda v: 255 - v)
    fade.paste(ramp, (0, h - fade_h))
    im.putalpha(ImageChops.multiply(im.getchannel('A'), fade))
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - w) // 2, SIZE - h), im)
    return canvas

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
