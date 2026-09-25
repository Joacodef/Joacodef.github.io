# joacodef.github.io

Personal academic website of Joaquín De Ferrari, built with [Eleventy](https://www.11ty.dev/) and published on GitHub Pages.

## First-time setup

1. Create a **public** GitHub repository named exactly `Joacodef.github.io` and push this project to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Add your public CV at `src/assets/cv/joaquin-de-ferrari-cv.pdf` (ideally without your phone number) and delete `PLACE-YOUR-CV-HERE.txt`.
4. Push. The workflow in `.github/workflows/deploy.yml` builds the site and publishes it at `https://joacodef.github.io`.

## Working locally

Requires Node.js 18 or newer.

```bash
npm install
npm start        # local server with live reload at http://localhost:8080
npm run build    # production build into _site/
```

## Where things live

| What | File |
|---|---|
| Name, tagline, "Currently" line, links, menu | `src/_data/site.json` |
| Publications (set `"selected": true` to show one on the homepage) | `src/_data/publications.json` |
| Research lines | `src/_data/research.json` |
| Global styles and color tokens (light and dark) | `src/assets/css/site.css` |
| Styles for notes (math, interactive figures) | `src/assets/css/notes.css` |
| Homepage 3D figure (bundled with esbuild at build time) | `scripts/lung-volume.js` |
| Shared toolkit for interactive planes in notes | `src/assets/js/plane.js` |

## Adding a note

1. Create a file inside a course folder, for example `src/notes/computer-vision/2d-transformations.html`.
2. Start it with front matter:

   ```yaml
   ---
   title: 2D transformations
   module: Geometry
   order: 2
   description: One sentence that appears on the notes cards.
   scripts:
     - /assets/js/notes/2d-transformations.js
   ---
   ```

3. For a new course, add a folder with a `<folder-name>.json` file like `src/notes/computer-vision/computer-vision.json`, setting `layout`, `course` and an optional `source` credit.

Notes appear automatically on the notes index and on the homepage. Interactive figures can import helpers from `/assets/js/plane.js`, as `src/assets/js/notes/homogeneous-coordinates.js` does.

## Custom domain (optional)

Buy a domain, add it under **Settings → Pages → Custom domain**, and update `url` in `src/_data/site.json`. Nothing else changes.
