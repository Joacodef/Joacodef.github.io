---
paths:
  - "src/notes/computer-vision/multiple-views.html"
  - "src/es/notes/computer-vision/multiple-views.html"
  - "src/assets/js/notes/computer-vision/multiple-views.js"
---

# The multiple views note's example

- Its cameras come from `circleCamera(deg)` in `plane.js`: a source on a horizontal circle of radius 1000 mm around Z, `deg` degrees from X toward Y, looking at the axis, with f = 8000 px and 2000 × 1600 images (principal point (1000, 800)). Every such camera sees the plane of the circle, Z = 0, as the row v = 800, and its third row is a unit vector, so λ is depth in millimeters.
- Images 1, 2 and 3 come from `circleCamera` at 0°, 90° and 175°, so images 1 and 3 almost face each other. The object is a flat bar, 45 mm long, 11 × 5.5 mm, pointed at both ends, with a notch on one side. Its lower tip is at (15, −20, 0), on the plane of the sources, and it stands 12° from vertical, leaning toward source 2, so images 1 and 3 see its wide face from opposite sides and image 2 its narrow edge.
- Its tips are clicked at their true pixels, rounded, and moved by (5, −6) and (−6, 4) in image 1, (−4, 5) and (5, −3) in image 2, and (6, 2) and (−5, 5) in image 3. The page says the clicks are a few pixels off, and compares each estimate with where the tips are. These offsets were chosen so that each idea of the note shows clearly: images 1 and 3 alone misplace the lower tip, and the crossing of epipolar lines fails for it, since it lies on the plane of the sources.
- The figure draws the bar as an X-ray: each convex part's front faces laid over its back faces give flat cells, in `--img-lo` over `--img-hi` with an opacity set by the length of the ray through the cell. Every number the page quotes comes from the figure's own exports (`TIPS`, `CLICKS`, `fitEnds`), so recompute them from there after any change.
