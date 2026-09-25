---
paths:
  - "scripts/lung-volume.js"
  - "src/index.njk"
  - "src/assets/js/home.js"
---

# Homepage 3D figure

- A translucent cube with voxelized lungs (lobes separated by fissures, trachea and main bronchi) and a carmine predicted mask in the right upper lobe. The anatomy is schematic; never use real patient images or data.
- Coordinates: the cube spans [-1, 1]³, +y is superior, +z is anterior. Seen from the front, the patient's right lung is on the viewer's left.
- `src/assets/js/home.js` lazy-loads the bundle after the page has loaded, so text always renders first. Keep it that way.
- Colors are read from the CSS tokens at runtime and update when the color scheme changes. Do not hardcode colors in the scene.
- The figure never moves on its own. It rotates only while the user drags it or presses the arrow keys (it is focusable with Tab), and it redraws only when something changes. Never add idle or automatic rotation.
- The social preview image `src/assets/og-image.png` (1200×630) shows the figure at its initial rotation next to the name and role. Regenerate it if the figure, the name or the role changes.
- The SVG placeholder in `src/index.njk` is a projection of the cube edges with the current camera (distance 6.8, root rotation (0.28, -0.42, 0), root offset y 0.22). If the camera or initial rotation changes, recompute the placeholder lines so they still match.
- Keep the bundle small: import only the three.js classes you use.
