# xerox-collage-editor

🇧🇷 [Ler em português](README.pt-br.md)

Browser-based photo collage editor with a xerox/paper-cutout aesthetic: black & white hatching, chromatic fringe, torn-paper photo frames, sticker phrases, chalk doodles, and a multi-sheet mural mode. Runs entirely in the browser, no build step — just open `index.html`.

## Features

- Custom canvas size (presets or width/height inputs), shared across every sheet in the carousel.
- Photo cutouts with two modes: jagged torn-paper frame, or subject-shaped alpha mask (uses a PNG's transparency to trace the silhouette).
- Continuous carousel backgrounds: stretch one photo as a background across multiple sheets, either as a full-bleed background or a torn band floating over the painted background.
- Painted background generator with adjustable palette, splatter intensity, and grain.
- Black & white hatching effect with adjustable density, contrast, brightness, grain, and cyan/orange chromatic fringe.
- Sticker phrases with font, alignment, color (preset or custom), rotation, and support for uploading your own font file (`.ttf`/`.otf`/`.woff`).
- Chalk doodle tool with adjustable thickness, color, and undo/redo (also available via `Ctrl+Z` / `Ctrl+Y`).
- Multi-sheet management (add/delete sheets, navigate via tabs) independent from mural mode.
- Mural mode: lay sheets side by side and drag cutout photos or a continuous background freely across the seams.
- HEIC/HEIF photo uploads are auto-converted to JPEG in the browser (see note below).
- Export the current sheet or all sheets at once as PNG.

## Structure

```
.
├── index.html                        # page structure (sidebar + stage)
├── css/
│   └── style.css                     # all styling
└── js/
    ├── 01-setup-paletas-fontes.js    # canvas setup, favicon, size presets, palettes, fonts
    ├── 02-utils-estado.js            # RNG, texture/color helpers, global state (settings, sheets)
    ├── 03-render-pipeline.js         # hatching, photo cutout, continuous carousel, background, stickers, chalk, main paint
    ├── 04-folhas-upload-ui.js        # sheet tabs UI, photo list, upload, continuous carousel
    ├── 05-modo-mural.js              # side-by-side sheets with continuous scroll
    ├── 06-controles-ui.js            # frame controls, sliders, sticker UI, chalk UI
    ├── 07-interacao-download.js      # canvas drag interaction + PNG export
    └── 08-init.js                    # creates the first sheet and renders
```

The JS modules load as ordered classic `<script>` tags and share the same global scope — this is exactly the same behavior as the original single-file version, just reorganized by responsibility for easier navigation and editing.

## Examples

<p align="center">
  <img src="docs/examples/exemplo-01.webp" width="45%" alt="Example collage 1: hatched black & white photo with chromatic fringe and sticker phrases on a pink background" />
  <img src="docs/examples/exemplo-02.webp" width="45%" alt="Example collage 2: hatched black & white photo with a torn-paper frame and sticker phrases on a pink background" />
  <img src="docs/examples/exemplo-03.webp" width="45%" alt="Example collage 3: hatched black & white portrait and dog cutout with transparent subject-shaped mask on an orange background" />
</p>

## Running locally

Since the scripts just use canvas/DOM APIs, you can open `index.html` directly in the browser. If you'd rather serve it over HTTP (recommended, to avoid `file://` restrictions in some browsers):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

### Note on HEIC/HEIF uploads

There's no build step and no bundled dependencies. The one exception: if you upload a `.heic`/`.heif` photo, the app lazily loads [heic2any](https://github.com/alexcorvi/heic2any) from a CDN (`cdn.jsdelivr.net`) at that moment to convert it to JPEG. This only happens on HEIC/HEIF uploads and requires an internet connection; every other feature works fully offline once the page is loaded.

## Publishing to GitHub Pages

1. Push this repository to GitHub.
2. Under *Settings → Pages*, select the main branch and the root folder (`/`).
3. The app will be available at `https://<username>.github.io/<repo>/`.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
