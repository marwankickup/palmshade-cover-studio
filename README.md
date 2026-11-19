# Palmshade Cover Studio

![Bounty](https://make.fun/badge/gta6-cover-art-01.svg)
![Rank](https://make.fun/badge/gta6-cover-art-01/marwankickup/palmshade-cover-studio/rank.svg)
![Reward](https://make.fun/badge/gta6-cover-art-01/marwankickup/palmshade-cover-studio/reward.svg)

An entry for the make.fun bounty [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01).

**Palmshade Cover Studio** turns a person's photo and a caption into cover art in the
multi-panel poster style: asymmetric angled panels with white keylines, a warm
sunset/neon colour grade, and big condensed caption lettering with an original
roman-numeral badge — exported as a shareable PNG. All artwork, layout and lettering
are original to this project; the only borrowed asset is the Anton typeface, used
under the SIL Open Font License (see `app/fonts/OFL.txt`).

## What it does

- **Photos in, cover out.** Add photos by file picker or drag & drop, or start from
  the two bundled samples (`app/samples/`). Every panel of the collage takes its own
  photo: click a panel to select it, click a photo to place it, drag inside the panel
  to reposition, scroll or use the slider to zoom. Photos always cover their panel.
- **Four poster layouts** — Hero Stack (5 panels), Diagonal Bands (3), Five-Panel
  Collage (5) and Duo Split (2) — defined as polygons, so they re-flow to any size.
- **Five colour grades** applied per pixel on canvas: Sunset, Neon, Duotone
  (purple→gold), Noir, or none.
- **Caption block** — an angled title in the vendored Anton font with a magenta drop
  shadow and black keyline, a letterspaced gold subtitle, and a hand-drawn hexagon
  badge with your own roman-style letters.
- **Export** a finished PNG at 1080 × 1080, 1080 × 1350 or 1920 × 1080; the
  composition is re-rendered offscreen at full size.
- **Two one-click presets** (Sunset Boulevard, Neon Pier) so a first-time visitor
  sees a finished cover immediately — the app opens on one.

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

Node 22 or later; no build step and no dependencies. The app is plain static files
under `app/` and makes no network requests — fonts, samples and code are all local.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

copies `app/` and `screenshots/` to the output directory and writes `dossier.json`
there with the vendored make.fun library (`vendor/makefun-app.ts`).

## Tech notes

- Pure Canvas 2D — no libraries at runtime. `app/src/cover.js` is the composition
  engine (polygon layouts, cover-fit photo tiles with a small render cache, pixel
  grades, keylines, badge and title rendering); `app/src/main.js` is the editor
  wiring (library, drag/zoom, pickers, presets, export, and the `?shot=` scenes the
  screenshots were staged with).
- Panel geometry lives in unit space and is scaled to the export aspect, so one
  arrangement produces the square, portrait and wide covers alike.
