---
paths:
  - "src/assets/js/plane.js"
---

# plane.js

The helpers the notes' figures share. Before changing one, take snapshots of every published figure (see `notes.md`).

## Planes, controls and numbers

- `createPlane(svg, { max, tick, labelStep, grid })` draws a 2D plane from 0 to `max` (40 by default), with ticks every `tick`, numbers every `labelStep` and, with `grid`, faint lines at every tick. Its `placeAlong(t, p, dir, dist, memo)` flips a label to the other side of its point when it would leave the plane; with a memo object, the label keeps that side until it must flip again, instead of flipping back. It flips only along one line, so on an axis both sides are the axis and the label can vanish: the vector space model note places its chapter labels with its own `placeLabel`.
- `makeHandle(svg, kind)` makes a handle whose touch area grows to about 44px on touch screens: `"point"` is carmine, `"grip"` (the grip of a line) blue.
- `modeButtons` wires a `.modes` group of buttons with `data-mode` and `aria-pressed`.
- `roving(buttons, select)` lets the arrow keys move between the buttons of a figure made of words; `select(i)` outlines the item picked and gives it tabindex 0 and the others −1, so Tab enters the list at that item.
- `steadyHeight(panel, modes, show, current)` keeps a panel at the height of its tallest mode, measured again when the fonts arrive and when the window changes width.
- `logChart(svg, { x, y, box, size, xLabel, yLabel })` draws log–log axes, x from x[0] to x[1] and y from y[0] to y[1] inside the box [L, R, T, B] of a viewBox `size` wide and tall, numbered at the powers of ten in each range (`xLabel` and `yLabel` write the tick labels; by default `localNum` with as many decimals as the power needs: 1, 0.1, 0.01) with short ticks at their multiples; the caller names the axes. It returns X(x), Y(y), the box, `toX` and `toLogY`. Note 1's two log charts and note 5's chart of the negatives use it.
- `stepLabels({ items, steps, frame, zero, arrows, lines })` places the labels of a plane of vectors stepped through with Back and Next, every step's places chosen at once by a cheapest-path search per label (a turn of more than a quarter around its mark between steps costs much), then each label again with all the others fixed; a place costs much for covering a label, a point or an arrow, for lying across an axis, for being nearer another mark than its own and for stretching over another mark. It returns each label's middle and baseline per step. Moved there from note 5's figure 4 for note 6's figure 2; note 5's snapshots were unchanged. A label must be shown while it is measured: a hidden one measures as empty.
- `wholeNumberInput` makes the number inputs of an editable vector accept whole numbers only, leaving the figure unchanged while a field holds something else.
- `localNum(x, d)` writes a number as the notes' text does in the page's language (`notes.md`, "Spanish version"). `fmt(n, d)` with `col(arr, cls, f)` and `mat(rows, cls, f)` write vectors and matrices with more decimals (`mat()` writes a `.mat`), and `fmtSig` writes matrix entries far below 1.
- Matrices: `apply` for any matrix times a vector, `matMul`, `transpose`, `inverse` for 3×3, `solve` for square linear systems and `lstsq` for least squares.

## 3D

- `createSpace` draws an orthographic view that readers turn by dragging the background or with the arrow keys (`turnable`); on touch screens it turns only sideways, so vertical swipes still scroll. It zooms with `setScale(scale, pivot)`, keeping its turn, and `stretch` exaggerates its vertical axis. Its `line`, `poly`, `dot` and `pin` draw fixed geometry that follows the view, and its `closest(dirs, key)` makes an arrow key move a point in the direction that looks closest on screen, however the view is turned.
- `mathLabel` writes SVG labels with italic, subscript and superscript parts. `placeClear` puts a label where it clears other labels and marks, picking among eight directions each time, so its labels can jump as the view turns. `placeBeside(S, t, p, clear, line, obstacles, memo)` puts a label beside a point on a line: it sits across the line on the side it had last time, and changes sides only when that side would leave the figure or cover a quarter of itself with an obstacle. `stepRange` and `clampTo` slide a point along a line through the origin in fixed steps.

## Geometry of the computer vision notes

These follow the Apuntes' conventions, which `notes-computer-vision.md` gives with the numeric traps of these helpers; read it before changing them.

- `homography(pairs)` (h33 = 1; exact for 4 pairs, least squares for more).
- 3D rotations: `rotX`, `rotY`, `rotZ` give a point's coordinates in axes turned by w, so their rows are the new axes; `rotation3d(wx, wy, wz)` = R_X R_Y R_Z turns the axes first about Z, then Y, then X; its transpose goes back; angles in radians. `anglesOf(R)` goes back to the angles.
- Cameras: `projectionMatrix(pairs)` for linear calibration, `opticalCenter(A)`, and `decomposeCamera(A)` for K, R′ and t′.
- Two views: `skew(u)` for [u]ₓ, `pinv(A)` for the pseudo-inverse of a 3 × 4 camera, `fundamental(A, B)`, `lineDistance(ℓ, m)`, and `pixelFrame` to draw an image in pixels with its ticks, or a close-up of one with `from: [u0, v0]` as its top left pixel; `clipLine` also clips to a rectangle such as [0, 0]–[W, H].
- Several views: `reconstruct(ms, Ps)` finds the point that best fits its pixels in two or more views by least squares and returns it with Q and r.
- `circleCamera(deg)`, the cameras of the multiple views note's own example, and `xrayCamera(k)` with `XRAY`, the course's X-ray series used by the epipolar geometry note, are described in those notes' files in `computer-vision/`.
