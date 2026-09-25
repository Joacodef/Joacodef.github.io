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
- End with a worked example from the course lab and a `.sum` summary that pairs each formula with its NumPy equivalent.

## Math markup

- Components in `notes.css`: `.disp` for display math, `.col` for column vectors, `.frac` for fractions, `sup.t` for the transpose, `.pt` for points (carmine) and `.ln` for lines (blue).
- Variables in `<i>`, subscripts in `<sub>`, and the real minus sign `−` (U+2212) in numbers.
- Follow the course notation (Prof. Domingo Mery, github.com/domingomery/cv): `m` for points, `ℓ` for lines, homogeneous vectors as `[p q r]ᵀ`, projection as `λm = PM`.
- In code snippets, use the variable names from the course labs (`m1`, `ell`, `ell_1`, `np.cross`).

## Interactive figures

- Snap draggable points to integers so readouts stay clean.
- Readouts show the actual computation with the current numbers, not only the result.
- Handle degenerate cases with a clear message: coincident points, parallel lines (`r = 0`), coincident lines, points outside the view.
- Use `≈` instead of `=` when a displayed value is rounded.
- Every draggable element also moves with the arrow keys and has an `aria-label` with its current position.

## Course materials

- Local, gitignored course materials live in `course-materials/<course>/`.
- Before writing or editing a note, read `course-materials/<course>/README.md` and the lab files it references, and follow the course's notation and variable names.
- Never copy slides, lab code or assignment text into `src/`. Summarize concepts in your own words and credit the source.
