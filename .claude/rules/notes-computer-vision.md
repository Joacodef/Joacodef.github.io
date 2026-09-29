---
paths:
  - "src/notes/computer-vision/**"
  - "src/es/notes/computer-vision/**"
  - "src/assets/js/notes/computer-vision/**"
  - "src/assets/js/plane.js"
---

# Computer Vision notes

What holds only for the notes of Prof. Domingo Mery's Computer Vision course at UC Chile (github.com/domingomery/cv), on top of `notes.md`.

## Sources

- The course README, `course-materials/computer-vision/README.md`, has the syllabus and note status, the chapter summary, the notation and glossary tables, and what each lab shows.
- The professor's lecture notes (Apuntes), `course-materials/computer-vision/cv02-geometry/2004-ApuntesVision.pdf`, in Spanish, are the reference for theory and conventions. Where the slides or the lab code disagree with them, follow the Apuntes and point out the difference. Many of their formulas and figures are images, so render those pages to read them. Printed page numbers are 8 less than PDF page numbers.
- Check the slides and the Apuntes for slips, and report them rather than copying them.

## Notation

- `m` for points, `ℓ` for lines, homogeneous vectors as `[p q r]ᵀ`, projection as `λm = PM`.
- Changes of coordinates follow the Apuntes: `M′ = RM + t` from the old system to the new one, with `R = R_X R_Y R_Z` built from the axis-turning matrices (`R_Z = [cos sin 0; −sin cos 0; 0 0 1]`), and `M = S′M′` back, with `R′ = Rᵀ` and `t′ = −R′t`. The camera model is `λw = KPS′M′`.
- Several views: cameras `A`, `B` and `C`, optical centers `C₁`, `C₂` and `C₃`, corresponding points `m₁`, `m₂` and `m₃`; `F = [BC₁]ₓBA⁺` with `A⁺ = Aᵀ(AAᵀ)⁻¹`.
- In code snippets, name variables after the formulas' symbols: `m1`, `ell`, `ell_1`, `mat_a`, `mat_b`, `mat_f`, `mat_q`, `mat_r`.
- Spanish terms from the Apuntes and the glossary: recta, producto punto, producto cruz, punto ideal, línea en el infinito (the Apuntes' term, kept although the notes say "recta" for a line), punto principal, matriz de calibración, factor de torcimiento, bloqueo del cardán, línea epipolar, matriz fundamental, mínimos cuadrados, reconstrucción 3D, error de reproyección, tensor trifocal, trilinealidades. Write "sin", not "sen", in formulas.

## Figures

- 3D figures of homogeneous coordinates label their axes `p`, `q`, `r`, and the Cartesian plane is `r = 1`. A point is a red line through the origin, and a line is a blue plane through the origin with ℓ perpendicular to it. An ideal point [p q 0]ᵀ is a red line lying flat on the floor `r = 0`, which is the plane of the line at infinity [0 0 1]ᵀ.
- Cartesian 3D figures label their axes `X`, `Y`, `Z`. A figure in camera coordinates (X right, Y down, Z forward) maps them to space with a turn, never a mirror, as the projection figure does with `[Z, −X, −Y]`.
- Pixels are drawn with `u` to the right and `v` down.

## Geometry helpers in plane.js

- `homography(pairs)` (h33 = 1; exact for 4 pairs, least squares for more).
- 3D rotations in the Apuntes' convention: `rotX`, `rotY`, `rotZ` give a point's coordinates in axes turned by w, so their rows are the new axes; `rotation3d(wx, wy, wz)` = R_X R_Y R_Z turns the axes first about Z, then Y, then X; its transpose goes back; angles in radians. `anglesOf(R)` goes back to the angles.
- Cameras: `projectionMatrix(pairs)` for linear calibration, `opticalCenter(A)`, and `decomposeCamera(A)` for K, R′ and t′.
- Two views: `skew(u)` for [u]ₓ, `pinv(A)` for the pseudo-inverse of a 3 × 4 camera, `fundamental(A, B)`, `lineDistance(ℓ, m)`, and `pixelFrame` to draw an image in pixels with its ticks, or a close-up of one with `from: [u0, v0]` as its top left pixel; `clipLine` also clips to a rectangle such as [0, 0]–[W, H].
- Several views: `reconstruct(ms, Ps)` finds the point that best fits its pixels in two or more views by least squares and returns it with Q and r.
- Cameras of the notes' own examples: `circleCamera(deg)` is a source on a horizontal circle of radius 1000 mm around Z, `deg` degrees from X toward Y, looking at the axis, with f = 8000 px and 2000 × 1600 images (principal point (1000, 800)). Every such camera sees the plane of the circle, Z = 0, as the row v = 800, and its third row is a unit vector, so λ is depth in millimeters.
- Numeric traps: `dot()` uses only three components, so use `apply()` for 4-vectors. `inverse()` rejects the badly conditioned 3 × 3 matrices these cameras produce, which is why `pinv` inverts AAᵀ itself. For least squares whose columns differ in size by millions, scale the columns first, as `projectionMatrix` does.

## The X-ray series

- Real cameras a figure may use, from the course's X-ray data: `xrayCamera(k)` is the projection matrix of image k, and `XRAY` holds the image size (2688 × 2208 pixels) and the last image (177). A page never calls an image by its number in this series ("image 40"): it names a view by where its source stands, or by a letter that matches its camera. Image k is `P(0)·T(2k°)`: the object turns about Z, so the sources sit on a circle of radius 964.03 mm at Z = −21.94. The third row of each matrix is a unit vector, so λ is depth in millimeters. The labs index images from 0, as `data['P'][:, :, k]`.
- The plane of the sources is seen edge-on as the same line in every image, the row v ≈ 1285: epipoles lie on it, and the crossing of two epipolar lines fails for points near it.
- Images whose sources face each other (1 and 82, 1 and 90) give nearly parallel rays: a thin sliver in a 3D figure and a badly conditioned reconstruction. Pick views whose geometry reads well, such as 1, 40 and 90.
- In a full image drawn about 200 SVG units wide, one screen pixel is about 13 image pixels, so show anything measured in pixels in a close-up.

## The multiple views example

- Images 1, 2 and 3 come from `circleCamera` at 0°, 90° and 175°, so images 1 and 3 almost face each other. The object is a flat bar, 45 mm long, 11 × 5.5 mm, pointed at both ends, with a notch on one side. Its lower tip is at (15, −20, 0), on the plane of the sources, and it stands 12° from vertical, leaning toward source 2, so images 1 and 3 see its wide face from opposite sides and image 2 its narrow edge.
- Its tips are clicked at their true pixels, rounded, and moved by (5, −6) and (−6, 4) in image 1, (−4, 5) and (5, −3) in image 2, and (6, 2) and (−5, 5) in image 3. The page says the clicks are a few pixels off, and compares each estimate with where the tips are. These offsets were chosen so that each idea of the note shows clearly: images 1 and 3 alone misplace the lower tip, and the crossing of epipolar lines fails for it, since it lies on the plane of the sources.
- The figure draws the bar as an X-ray: each convex part's front faces laid over its back faces give flat cells, in `--img-lo` over `--img-hi` with an opacity set by the length of the ray through the cell. Every number the page quotes comes from the figure's own exports (`TIPS`, `CLICKS`, `fitEnds`), so recompute them from there after any change.