---
paths:
  - "src/notes/**"
  - "src/assets/js/notes/**"
  - "src/assets/js/plane.js"
  - "src/assets/css/notes.css"
---

# Study notes

## Adding a note

- Put it in a course folder, e.g. `src/notes/computer-vision/2d-transformations.html`.
- Front matter: `title`, `module`, `order`, `description` (one sentence, shown on cards) and `scripts` if it has interactive figures.
- A new course needs a folder with `<folder-name>.json` setting `layout: "note.njk"`, `course` and a `source` credit.
- Page-specific scripts go in `src/assets/js/notes/<note-slug>.js` and import helpers from `/assets/js/plane.js`. Add reusable helpers to `plane.js` instead of copying code between notes.

## Structure of a note

- Opening formulas in `.duo`, then numbered `<section>`s whose `<h2>` starts with `<span class="n">N</span>`.
- Interactive figures sit in `.fig` right after the section that introduces the idea.
- End with a worked example and a `.sum` summary that pairs each formula with its NumPy equivalent.
- Build the worked example from the course lab's numbers, but present it as the note's own. The page never mentions "the lab", slides or any other course material a visitor cannot see; the course is credited only through the `source` field. Buttons that restore a figure to its first state are labeled "Reset".

## Math markup

- Components in `notes.css`: `.disp` for display math, `.col` for column vectors, `.mat` for matrices (3 columns unless `style="--cols: N"`; `mat()` in `plane.js` writes one), `.frac` for fractions, `sup.t` for the transpose and other superscripts, `.pt` for points (carmine) and `.ln` for lines (blue).
- A heading that contains math wraps its text in a `<span>` after the number (`<h2><span class="n">4</span><span>Estimating <i>H</i> …</span></h2>`): the `h2` is a flex row, and loose text and `<i>` would become separate items with gaps between them.
- Variables in `<i>`, subscripts in `<sub>`, and the real minus sign `−` (U+2212) in numbers.
- Follow the course notation (Prof. Domingo Mery, github.com/domingomery/cv): `m` for points, `ℓ` for lines, homogeneous vectors as `[p q r]ᵀ`, projection as `λm = PM`.
- In code snippets, use the variable names from the course labs (`m1`, `ell`, `ell_1`, `np.cross`).
- Wrap each side of a long equation in a `.nowrap` span, putting the `=` at the start of the right-hand side (`<span class="nowrap">= …</span>`). On narrow screens the line then breaks before an equals sign, never after it. Do the same in figure readouts.

## Interactive figures

- Snap draggable points to integers so readouts stay clean.
- To let readers pick a mode (a kind of transformation, an interpolation method), use a `.modes` group of buttons with `data-mode` and `aria-pressed`, wired with `modeButtons` from `plane.js`.
- `plane.js` also has matrix helpers (`apply` for any matrix times a vector, `matMul`, `transpose`, and `inverse` for 3×3), `solve` for square linear systems, `homography(pairs)` (h33 = 1; exact for 4 pairs, least squares for more), 3D rotations (`rotX`, `rotY`, `rotZ` by the right-hand rule, and `rotation3d(wx, wy, wz)` = R_X R_Y R_Z, in radians), `fmtSig` for matrix entries far below 1, and `fmt(n, d)` with `col(arr, cls, f)` and `mat(rows, cls, f)` for more decimals.
- Gray values of images are drawn with `color-mix()` between `--img-lo` (0) and `--img-hi` (255), so bright pixels stay bright in both themes. Mark pixels with no value explicitly (the warping figure crosses them out), since an empty cell looks like black or white.
- To let readers edit a vector, put number inputs inside a `.col.coef` bracket, as the line-as-vector figure does. Accept whole numbers only, and leave the figure unchanged while a field holds something else (a lone minus sign, say). `wholeNumberInput` in `plane.js` does this; single numbers such as angles use a `.coef` span without `.col`.
- Readouts show the actual computation with the current numbers, not only the result.
- Handle degenerate cases with a clear message: coincident points, parallel lines (`r = 0`), coincident lines, points outside the view.
- Use `≈` instead of `=` when a displayed value is rounded.
- Every draggable element also moves with the arrow keys and has an `aria-label` with its current position.
- Interactive SVGs use `role="group"` with an `aria-label`, not `role="img"`: an image's contents are hidden from screen readers, which would hide the handles.
- Create handles with `plane.js`, which enlarges their touch area on touch screens to about 44px. Check each figure at 390px and 320px wide.
- For 3D figures, use `createSpace` in `plane.js`: an orthographic view that readers turn by dragging the background or with the arrow keys (`turnable`); on touch screens it turns only sideways, so vertical swipes still scroll. Keep `stretch` at 1 whenever an angle matters, such as a perpendicular vector; a larger `stretch` exaggerates the r axis and is fine when only lines, planes and where they meet matter. Draw fixed geometry with `line`, `poly`, `dot` and `pin` so it follows the view, draw what lies below a translucent plane before it and what lies above after it, and put fixed labels in a top layer. Label homogeneous axes `p`, `q`, `r`; the Cartesian plane is `r = 1`. A point is a red line through the origin, and a line is a blue plane through the origin with ℓ perpendicular to it. Cartesian 3D figures label their axes `X`, `Y`, `Z`; a figure in camera coordinates (X right, Y down, Z forward) maps them to space with a turn, never a mirror, as the projection figure does with `[Z, −X, −Y]`.
- 3D helpers in `plane.js`: `mathLabel` for SVG labels with italic parts, `placeClear` to put a label where it clears other labels and marks, `stepRange` and `clampTo` for a point slid along a line through the origin in fixed steps, and the space's `closest(dirs, key)`, which makes an arrow key move a point in the direction that looks closest on screen, however the view is turned.

## Course materials

- Local, gitignored course materials live in `course-materials/<course>/`.
- Before writing or editing a note, read `course-materials/<course>/README.md` and the lab files it references, and follow the course's notation and variable names.
- Never copy slides, lab code or assignment text into `src/`. Summarize concepts in your own words and credit the source.
