---
paths:
  - "src/notes/computer-vision/**"
  - "src/es/notes/computer-vision/**"
  - "src/assets/js/notes/computer-vision/**"
---

# Computer Vision notes

What holds only for the notes of Prof. Domingo Mery's Computer Vision course at UC Chile (github.com/domingomery/cv), on top of `notes.md`. The geometry helpers of `plane.js` are listed in `plane-js.md`; the X-ray series is described in `computer-vision/epipolar-geometry.md` and the multiple views example in `computer-vision/multiple-views.md`.

## Sources

- The course README, `course-materials/computer-vision/README.md`, has the syllabus and note status, the chapter summary, and the notation and glossary tables; its `reference/labs.md` says what each lab shows.
- The professor's lecture notes (Apuntes), `course-materials/computer-vision/cv02-geometry/2004-ApuntesVision.pdf`, in Spanish, are the reference for theory and conventions. Where the slides or the lab code disagree with them, follow the Apuntes and point out the difference. Check a new note's formulas and sign conventions against the matching pages before planning its figures: the first 3D transformations note copied the lab's rotation, which turns the axes in the opposite order and gave other numbers. Many of their formulas and figures are images, so render those pages to read them. Printed page numbers are 8 less than PDF page numbers.
- Check the slides and the Apuntes for slips, and report them rather than copying them.

## Notation

- `m` for points, `ℓ` for lines, homogeneous vectors as `[p q r]ᵀ`, projection as `λm = PM`.
- Changes of coordinates follow the Apuntes: `M′ = RM + t` from the old system to the new one, with `R = R_X R_Y R_Z` built from the axis-turning matrices (`R_Z = [cos sin 0; −sin cos 0; 0 0 1]`), and `M = S′M′` back, with `R′ = Rᵀ` and `t′ = −R′t`. The camera model is `λw = KPS′M′`.
- Several views: cameras `A`, `B` and `C`, optical centers `C₁`, `C₂` and `C₃`, corresponding points `m₁`, `m₂` and `m₃`; `F = [BC₁]ₓBA⁺` with `A⁺ = Aᵀ(AAᵀ)⁻¹`.
- In code snippets, name variables after the formulas' symbols: `m1`, `ell`, `ell_1`, `mat_a`, `mat_b`, `mat_f`, `mat_q`, `mat_r`.
- Spanish terms from the Apuntes and the glossary: recta, producto punto, producto cruz, punto ideal, línea en el infinito (the Apuntes' term, kept although the notes say "recta" for a line), razón de cruz, punto de fuga, homografía, punto principal, matriz de calibración, factor de torcimiento, bloqueo del cardán, línea epipolar, matriz fundamental, mínimos cuadrados, reconstrucción 3D, error de reproyección, tensor trifocal, trilinealidades. Write "sin", not "sen", in formulas.

## Figures

- 3D figures of homogeneous coordinates label their axes `p`, `q`, `r`, and the Cartesian plane is `r = 1`. A point is a red line through the origin, and a line is a blue plane through the origin with ℓ perpendicular to it. An ideal point [p q 0]ᵀ is a red line lying flat on the floor `r = 0`, which is the plane of the line at infinity [0 0 1]ᵀ.
- Cartesian 3D figures label their axes `X`, `Y`, `Z`. A figure in camera coordinates (X right, Y down, Z forward) maps them to space with a turn, never a mirror, as the projection figure does with `[Z, −X, −Y]`.
- Pixels are drawn with `u` to the right and `v` down.
- Numeric traps of the camera helpers: `dot()` uses only three components, so use `apply()` for 4-vectors. `inverse()` rejects the badly conditioned 3 × 3 matrices these cameras produce, which is why `pinv` inverts AAᵀ itself. For least squares whose columns differ in size by millions, scale the columns first, as `projectionMatrix` does.
