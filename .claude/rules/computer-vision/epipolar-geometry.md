---
paths:
  - "src/notes/computer-vision/epipolar-geometry.html"
  - "src/es/notes/computer-vision/epipolar-geometry.html"
  - "src/assets/js/notes/computer-vision/epipolar-geometry.js"
---

# The X-ray series (epipolar geometry note)

The note's figures use real cameras from the course's X-ray data. The note predates the rule against naming images by number and still says "images 1 and 82" (see "Pending review" in the course README).

- `xrayCamera(k)` in `plane.js` is the projection matrix of image k, and `XRAY` holds the image size (2688 × 2208 pixels) and the last image (177). A page never calls an image by its number in this series ("image 40"): it names a view by where its source stands, or by a letter that matches its camera. Image k is `P(0)·T(2k°)`: the object turns about Z, so the sources sit on a circle of radius 964.03 mm at Z = −21.94. The third row of each matrix is a unit vector, so λ is depth in millimeters. The labs index images from 0, as `data['P'][:, :, k]`.
- The plane of the sources is seen edge-on as the same line in every image, the row v ≈ 1285: epipoles lie on it, and the crossing of two epipolar lines fails for points near it.
- Images whose sources face each other (1 and 82, 1 and 90) give nearly parallel rays: a thin sliver in a 3D figure and a badly conditioned reconstruction. Pick views whose geometry reads well, such as 1, 40 and 90.
- In a full image drawn about 200 SVG units wide, one screen pixel is about 13 image pixels, so show anything measured in pixels in a close-up.
