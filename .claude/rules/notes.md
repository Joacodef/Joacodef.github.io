---
paths:
  - "src/notes/**"
  - "src/es/notes/**"
  - "src/assets/js/notes/**"
  - "src/assets/js/plane.js"
  - "src/assets/css/notes.css"
---

# Study notes

These rules hold for the notes of every course. Each course also has a rules file of its own, `notes-<course>.md` in this folder, with its sources, notation and terms (`notes-computer-vision.md`, `notes-reinforcement-learning.md`).

## Who the notes are for

- A reader who never took the course, and Joaquín studying for it. Every page must make sense to someone who has only the page: never assume the reader knows the course's names, data or numbering, such as the frame numbers of a data set ("image 40") or the variable names of a lab.
- The course materials set what a note covers, keep its theory faithful to the class, and give its formula notation, which stays as in class (λm = PM, m for points, ℓ for lines) so the notes also serve for studying.
- Everything else is the note's own, chosen to make the concepts clear: the names of things, the numbers, the examples and the data behind the figures. The course's examples can suggest what to show, but they are not reproduced.

## Adding a note

- Put it in a course folder, e.g. `src/notes/computer-vision/2d-transformations.html`.
- Front matter: `title`, `module`, `order`, `description` (one sentence, shown on cards) and `scripts` if it has interactive figures.
- The notes of a course form a sequence, and `order` sets a note's place in it. The notes index numbers the notes of each course by it, and each note shows "Note N of M" in its breadcrumbs and links to the previous and next notes of its course at the end (the `noteSequence` filter). Give the Spanish version the same `order`.
- The homepage shows three cards: the first note of each course, then the second of each, and so on (the `firstNotes` filter).
- Page-specific scripts go in `src/assets/js/notes/<course>/<note-slug>.js` and import helpers from `../../plane.js`. Add reusable helpers to `plane.js` instead of copying code between notes.

## Adding a course

- A folder in `src/notes/` with `<folder-name>.json` setting `layout: "note.njk"`, `course` (its name), `courseOrder` (its place on the notes index and on the homepage, 1 first) and a `source` credit, and its Spanish twin in `src/es/notes/` with the Spanish name and credit and the same `courseOrder`.
- A folder for its figure scripts, `src/assets/js/notes/<course>/`.
- A rules file, `.claude/rules/notes-<course>.md`, scoped with `paths` to the course's note and script folders, for what holds only for that course: its sources and which one wins on the theory when they disagree, its formula notation, its Spanish terms, and any data its figures may use.
- Its materials in `course-materials/<course>/`, set up as `course-materials/README.md` describes.

## Spanish version

- Every note ships in English and Spanish. The Spanish page is `src/es/notes/<course>/<same-slug>.html` (URL `/es/notes/<course>/<slug>/`), with the same markup, figure ids and `scripts`, and translated `title`, `module` and `description`. `src/es/es.json` sets `lang: es` for everything below `src/es/`.
- The layouts find the other version by URL (the `otherLanguage` filter in `eleventy.config.js`), show the "Leer en español" or "Read in English" link at the top of the note, and add `hreflang` links. The note layout's own text in both languages is in `src/_data/i18n.json`. The site header and footer stay in English, marked `lang="en"` on Spanish pages.
- Figure scripts are shared by both pages. Every sentence and label a reader sees or hears, including `aria-label`s and SVG text, is written with `tr(en, es)` from `plane.js`, so the two versions sit side by side. A Spanish readout never shows English.
- Numbers keep the decimal point in Spanish too (3.1823, not 3,1823), as in the English notes and in NumPy.
- Use the course's own Spanish terms, from its materials and the glossary in its course README. Address the reader with tú ("Arrastra", "Usa las flechas del teclado"). The Reset button is "Reiniciar".
- An edit to one version is mirrored in the other in the same change, and the width, theme and keyboard checks run on both.

## Structure of a note

- Open without formulas. Before section 1, lead a reader who has never seen the subject into it: say in plain words what question the note answers or what it makes possible, and why it matters, with a small picture when one explains it. The homogeneous coordinates note does this with `.asks`, small pictures of its questions, each with a caption. The first formula appears inside a section. Everything in the opening fits a 320px-wide screen. The `.duo` opening formulas remain only in notes not yet reworked.
- Then numbered `<section>`s whose `<h2>` starts with `<span class="n">N</span>`.
- Every numbered section except the summary has an interactive example of its own: a `.fig` right after the text that introduces the section's idea, in which the reader changes something (drags a point, edits a vector, turns a view) and sees that idea respond, with the computation in the readout. Plan each section around what the reader does in its figure; an idea that gives the reader nothing to do belongs in the section it follows from.
- End with a `.sum` summary that pairs each formula with its NumPy equivalent. Notes have no "A worked example" section: concrete numbers go in the sections and figures where they explain an idea.
- Design the examples, and the data of the figures, to make the concepts clear, with the note's own numbers (see "Who the notes are for"). Name what the example uses by what it is, such as a view by where its camera stands, never by its number in a course's data set. The page never mentions "the lab", slides or any other course material a visitor cannot see; the course is credited only through the `source` field. Buttons that restore a figure to its first state are labeled "Reset" ("Reiniciar" in Spanish).

## Math markup

- Components in `notes.css`: `.disp` for display math, `.col` for column vectors, `.mat` for matrices (3 columns unless `style="--cols: N"`; `mat()` in `plane.js` writes one), `.frac` for fractions, `sup.t` for the transpose and other superscripts, `.pt` for points (carmine) and `.ln` for lines (blue). A note's key formulas are `.disp.hero-f`, set larger; at desktop width they stay on one line, and one too long for that at the hero size, such as Sarsa's update, adds `long`, which sets it smaller.
- Write an estimate's hat with `.hat` around the letter (`<span class="hat"><i>M</i></span>`, and `class="hat lo"` for a lowercase letter), not with a combining circumflex, which the serif font sets beside the letter. In SVG labels, draw the hat as a text of its own over the letter, as the multiple views figure does. Combining tildes (`&#771;`) render correctly.
- A heading that contains math wraps its text in a `<span>` after the number (`<h2><span class="n">4</span><span>Estimating <i>H</i> …</span></h2>`): the `h2` is a flex row, and loose text and `<i>` would become separate items with gaps between them.
- Variables in `<i>`, subscripts in `<sub>`, and the real minus sign `−` (U+2212) in numbers.
- Use the course's formula notation, as its rules file describes. In code snippets, name variables after the formulas' symbols (`m1` for m₁, `mat_a` for A), so code and math read alike.
- Wrap each side of a long equation in a `.nowrap` span, putting the `=` at the start of the right-hand side (`<span class="nowrap">= …</span>`). On narrow screens the line then breaks before an equals sign, never after it. Do the same in figure readouts.

## Interactive figures

- Snap draggable points to integers so readouts stay clean.
- `createPlane(svg, { max, tick, labelStep, grid })` in `plane.js` draws a 2D plane from 0 to `max` (40 by default), with ticks every `tick`, numbers every `labelStep` and, with `grid`, faint lines at every tick. For small, readable cross products, use a small plane, as the homogeneous coordinates note does with 0 to 10. Its `placeAlong(t, p, dir, dist, memo)` flips a label to the other side of its point when it would leave the plane; with a memo object, the label keeps that side until it must flip again, instead of flipping back.
- To let readers pick a mode (a kind of transformation, an interpolation method), use a `.modes` group of buttons with `data-mode` and `aria-pressed`, wired with `modeButtons` from `plane.js`.
- `plane.js` also has matrix helpers (`apply` for any matrix times a vector, `matMul`, `transpose`, and `inverse` for 3×3), `solve` for square linear systems, `lstsq` for least squares, `fmtSig` for matrix entries far below 1, and `fmt(n, d)` with `col(arr, cls, f)` and `mat(rows, cls, f)` for more decimals. Its geometry helpers for the computer vision notes (homographies, 3D rotations, cameras, two and several views) are described in `notes-computer-vision.md`.
- Gray values of images are drawn with `color-mix()` between `--img-lo` (0) and `--img-hi` (255), so bright pixels stay bright in both themes. Mark pixels with no value explicitly (the warping figure crosses them out), since an empty cell looks like black or white.
- To let readers edit a vector, put number inputs inside a `.col.coef` bracket, as the line-as-vector figure does. Accept whole numbers only, and leave the figure unchanged while a field holds something else (a lone minus sign, say). `wholeNumberInput` in `plane.js` does this; single numbers such as angles use a `.coef` span without `.col`.
- Keep readouts light: one key calculation with the current numbers, the one the section is about, shown as a calculation rather than only its result, and one short sentence saying what it means. Leave out checks, simplified forms and second formulas, or give their result in the sentence; explanations belong in the section's text. A degenerate case gets one short sentence.
- Handle degenerate cases with a clear message: coincident points, parallel lines (`r = 0`), coincident lines, points outside the view.
- Use `≈` instead of `=` when a displayed value is rounded.
- Every draggable element also moves with the arrow keys and has an `aria-label` with its current position.
- Interactive SVGs use `role="group"` with an `aria-label`, not `role="img"`: an image's contents are hidden from screen readers, which would hide the handles.
- Create handles with `plane.js`, which enlarges their touch area on touch screens to about 44px. Check each figure at 390px and 320px wide.
- For 3D figures, use `createSpace` in `plane.js`: an orthographic view that readers turn by dragging the background or with the arrow keys (`turnable`); on touch screens it turns only sideways, so vertical swipes still scroll. It zooms with `setScale(scale, pivot)`, keeping its turn. Keep `stretch` at 1 whenever an angle matters, such as a perpendicular vector; a larger `stretch` exaggerates the vertical axis and is fine when only lines, planes and where they meet matter. Draw fixed geometry with `line`, `poly`, `dot` and `pin` so it follows the view, draw what lies below a translucent plane before it and what lies above after it, and put fixed labels in a top layer.
- 3D helpers in `plane.js`: `mathLabel` for SVG labels with italic, subscript and superscript parts, `placeClear` to put a label where it clears other labels and marks, `stepRange` and `clampTo` for a point slid along a line through the origin in fixed steps, and the space's `closest(dirs, key)`, which makes an arrow key move a point in the direction that looks closest on screen, however the view is turned.
- Labels that move with a view the reader turns must not jump from one side of their mark to the other: place them by rules that change smoothly with the view, such as fixed screen offsets. `placeBeside(S, t, p, clear, line, obstacles, memo)` in `plane.js` does this for a label beside a point on a line: it sits across the line on the side it had last time, and changes sides only when that side would leave the figure or cover a quarter of itself with an obstacle. `placeClear` picks among eight directions each time, so its labels can jump as the view turns; prefer `placeBeside` for anything the reader turns or drags.

## Course materials

- Local, gitignored course materials live in `course-materials/<course>/`, with a README for the course and one subfolder per chapter holding its slides and labs (see `course-materials/README.md`).
- Before writing or editing a note, read `course-materials/<course>/README.md` and the materials it lists for the note's subject: they set what the note covers, its theory and its formula notation. The labs show what the class computes, not what the page must reproduce.
- Never copy slides, lab code or assignment text into `src/`. Summarize concepts in your own words and credit the source.
