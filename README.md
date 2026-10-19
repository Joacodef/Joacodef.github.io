# joaquindeferrari.com

Personal academic website of Joaquín De Ferrari, built with [Eleventy](https://www.11ty.dev/) and published on GitHub Pages at [joaquindeferrari.com](https://joaquindeferrari.com).

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages (**Settings → Pages → Source** is set to **GitHub Actions**).

The custom domain `joaquindeferrari.com` is set under **Settings → Pages → Custom domain**, so the repository needs no `CNAME` file. Its DNS lives on Cloudflare as DNS-only records; never switch them to proxied. The same address is the `url` in `src/_data/site.json`.

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
| Public CV (without the phone number) | `src/assets/cv/joaquin-de-ferrari-cv.pdf` |
| Link preview image (1200×630) and its alt text | `src/assets/og-image.png`, `image` in `src/_data/site.json` |
| Home-screen icon for phones (180×180) | `src/apple-touch-icon.png` |
| Page shown for broken links | `src/404.njk` |
| Global styles and color tokens (light and dark) | `src/assets/css/site.css` |
| Styles for notes (math, interactive figures) | `src/assets/css/notes.css` |
| Homepage 3D figure (bundled with esbuild at build time) | `scripts/lung-volume.js` |
| Shared toolkit for interactive figures in notes (2D planes, 3D views, draggable handles) | `src/assets/js/plane.js` |

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
     - /assets/js/notes/computer-vision/2d-transformations.js
   ---
   ```

   A note on a paper rather than a chapter of the course adds `kind: paper`: papers are numbered on their own ("Paper 1 of 2" rather than "Note 7 of 9"), and an `order` after the chapter notes keeps them at the end of the course.
3. Write its Spanish version at the same path under `src/es/notes/`, for example `src/es/notes/computer-vision/2d-transformations.html`, with the same `order` and `scripts` and a translated `title`, `module` and `description`. The two pages link to each other.
4. For a new course, add a folder with a `<folder-name>.json` file like `src/notes/computer-vision/computer-vision.json`, setting `layout`, `course`, `courseOrder` (its place on the notes page and the homepage) and a `source` credit for the course materials, and its Spanish twin in `src/es/notes/` with the Spanish course name and credit.

Notes appear automatically on the notes index. The homepage shows three of them: the first note of each course, then the second of each, and so on. Interactive figures go in `src/assets/js/notes/<course>/` and import helpers from `src/assets/js/plane.js`, as `src/assets/js/notes/computer-vision/homogeneous-coordinates.js` does.
