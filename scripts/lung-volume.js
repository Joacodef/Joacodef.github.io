// Homepage figure: a translucent volume with voxelized lungs (lobes, airways)
// and a predicted segmentation mask in the right upper lobe.
// Coordinates: the cube spans [-1, 1]^3, +y is superior, +z is anterior.
// Seen from the front, the patient's right lung appears on the viewer's left.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, BoxGeometry, Mesh,
  MeshBasicMaterial, LineSegments, EdgesGeometry, LineBasicMaterial,
  BufferGeometry, Float32BufferAttribute, BufferAttribute, Points,
  PointsMaterial, Color, DoubleSide,
} from "three";

/* ---------- Anatomy (schematic, not patient data) ---------- */

// Frontal silhouettes of each lung, as on a chest radiograph.
const RIGHT = [[-0.26,0.86],[-0.38,0.84],[-0.52,0.74],[-0.64,0.56],[-0.73,0.32],[-0.79,0.06],[-0.83,-0.22],[-0.86,-0.5],[-0.87,-0.7],[-0.78,-0.64],[-0.64,-0.54],[-0.48,-0.5],[-0.34,-0.53],[-0.22,-0.6],[-0.13,-0.66],[-0.15,-0.38],[-0.18,-0.12],[-0.17,0.08],[-0.14,0.3],[-0.12,0.52],[-0.15,0.72],[-0.2,0.83]];
const LEFT = [[0.26,0.84],[0.2,0.8],[0.14,0.68],[0.12,0.5],[0.18,0.34],[0.2,0.16],[0.22,0],[0.28,-0.18],[0.36,-0.36],[0.44,-0.54],[0.5,-0.66],[0.6,-0.64],[0.72,-0.66],[0.82,-0.72],[0.84,-0.52],[0.82,-0.24],[0.78,0.04],[0.72,0.3],[0.62,0.54],[0.5,0.72],[0.38,0.82]];

// Airway tree: trachea, main bronchi and a few lobar branches [start, end, radius].
const AIRWAYS = [
  [[0, 0.98, 0.02], [0, 0.3, 0], 0.065],
  [[0, 0.3, 0], [-0.24, 0.1, -0.02], 0.048],
  [[0, 0.3, 0], [0.3, 0.17, -0.02], 0.044],
  [[-0.13, 0.2, -0.01], [-0.32, 0.36, -0.02], 0.03],
  [[-0.24, 0.1, -0.02], [-0.34, -0.22, -0.06], 0.034],
  [[0.22, 0.2, -0.02], [0.36, 0.38, -0.02], 0.03],
  [[0.3, 0.17, -0.02], [0.38, -0.16, -0.06], 0.032],
];

// Predicted mask: an irregular nodule in the right upper lobe.
const MASK_CENTER = [-0.5, 0.46, 0.1];
const MASK_RADIUS = 0.11;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function inPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolygon(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return best;
}

function inLung(x, y, z) {
  const poly = x < 0 ? RIGHT : LEFT;
  if (!inPolygon(poly, x, y)) return false;
  // Depth grows toward the base and tapers near the borders; lungs sit slightly posterior.
  const depth = 0.6 * (0.55 + 0.45 * clamp01((0.86 - y) / 1.3));
  const d = depth * Math.sqrt(Math.min(1, distToPolygon(poly, x, y) / 0.3));
  const cz = -0.1;
  if (z < cz - d || z > cz + 0.8 * d) return false;
  // Cardiac impression (anterior, left of midline) and the spine (posterior).
  const hx = (x - 0.1) / 0.42, hy = (y + 0.38) / 0.33, hz = (z - 0.22) / 0.38;
  if (hx * hx + hy * hy + hz * hz < 1.08) return false;
  const sx = x / 0.2, sz = (z + 0.66) / 0.2;
  return sx * sx + sz * sz >= 1;
}

function distToSegment3(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = clamp01((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2));
  return Math.hypot(a[0] + t * ab[0] - p[0], a[1] + t * ab[1] - p[1], a[2] + t * ab[2] - p[2]);
}

function airwayDistance(x, y, z) {
  let best = Infinity;
  for (const [a, b, r] of AIRWAYS) best = Math.min(best, distToSegment3([x, y, z], a, b) - r);
  return best;
}

function inMask(x, y, z) {
  const dx = x - MASK_CENTER[0], dy = y - MASK_CENTER[1], dz = z - MASK_CENTER[2];
  const r = Math.hypot(dx, dy, dz);
  if (r < 1e-9) return true;
  const th = Math.atan2(dz, dx), ph = Math.acos(dy / r);
  return r <= MASK_RADIUS * (1 + 0.14 * Math.sin(3 * th) * Math.sin(2 * ph) + 0.08 * Math.cos(4 * ph));
}

// Lobe of a lung voxel: 0 upper, 1 middle (right only), 2 lower; null on a fissure.
function lobeOf(x, y, z) {
  const oblique = 0.32 - 0.85 * (z + 0.55);
  if (Math.abs(y - oblique) < 0.03) return null;
  if (y < oblique) return 2;
  if (x < 0) {
    if (Math.abs(y - 0.02) < 0.027) return null; // horizontal fissure
    return y > 0.02 ? 0 : 1;
  }
  return 0;
}

function buildVoxels() {
  const lung = [], lobes = [], airway = [], mask = [];
  const step = 0.052;
  for (let x = -0.96; x <= 0.96; x += step)
    for (let y = -0.96; y <= 0.96; y += step)
      for (let z = -0.96; z <= 0.96; z += step) {
        if (!inLung(x, y, z) || inMask(x, y, z) || airwayDistance(x, y, z) < 0.025) continue;
        const lobe = lobeOf(x, y, z);
        if (lobe === null) continue;
        lung.push(x, y, z);
        lobes.push(lobe);
      }
  const sa = 0.034;
  for (let x = -0.46; x <= 0.46; x += sa)
    for (let y = -0.3; y <= 1; y += sa)
      for (let z = -0.14; z <= 0.12; z += sa)
        if (airwayDistance(x, y, z) <= 0) airway.push(x, y, z);
  const sm = 0.026, [mx, my, mz] = MASK_CENTER;
  for (let x = mx - 0.16; x <= mx + 0.16; x += sm)
    for (let y = my - 0.16; y <= my + 0.16; y += sm)
      for (let z = mz - 0.16; z <= mz + 0.16; z += sm)
        if (inMask(x, y, z)) mask.push(x, y, z);
  return { lung, lobes, airway, mask };
}

/* ---------- Colors follow the site's CSS tokens (light and dark) ---------- */

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const get = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const paper = new Color(get("--paper", "#F6F4EF"));
  const blue = new Color(get("--blue", "#27466F"));
  return {
    blue,
    glass: blue.clone().lerp(paper, 0.6),
    red: new Color(get("--red", "#B0303F")),
    airway: new Color(get("--ink-3", "#6F6A61")),
    lobes: [blue.clone(), blue.clone().lerp(paper, 0.38), blue.clone().lerp(paper, 0.18)],
  };
}

/* ---------- Scene ---------- */

export function mount(container) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return; // No WebGL: the static placeholder stays visible.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6.8);
  const root = new Group();
  root.rotation.set(0.28, -0.42, 0);
  root.position.y = 0.22; // visually centers the cube in the square frame
  scene.add(root);

  const box = new BoxGeometry(2, 2, 2);
  const faceMat = new MeshBasicMaterial({ transparent: true, opacity: 0.06, depthWrite: false, side: DoubleSide });
  const edgeMat = new LineBasicMaterial({ transparent: true, opacity: 0.65 });
  root.add(new Mesh(box, faceMat));
  root.add(new LineSegments(new EdgesGeometry(box), edgeMat));

  const { lung, lobes, airway, mask } = buildVoxels();
  // The anatomy fills the cube a little more and sits slightly lower, like a real scan field of view.
  const anatomy = new Group();
  anatomy.scale.setScalar(1.05);
  anatomy.position.y = -0.08;
  root.add(anatomy);

  const lungGeo = new BufferGeometry();
  lungGeo.setAttribute("position", new Float32BufferAttribute(lung, 3));
  const lungColors = new Float32Array(lobes.length * 3);
  lungGeo.setAttribute("color", new BufferAttribute(lungColors, 3));
  const lungMat = new PointsMaterial({ size: 0.034, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.85 });
  anatomy.add(new Points(lungGeo, lungMat));

  const airGeo = new BufferGeometry();
  airGeo.setAttribute("position", new Float32BufferAttribute(airway, 3));
  const airMat = new PointsMaterial({ size: 0.028, sizeAttenuation: true, transparent: true, opacity: 0.9 });
  anatomy.add(new Points(airGeo, airMat));

  const maskGeo = new BufferGeometry();
  maskGeo.setAttribute("position", new Float32BufferAttribute(mask, 3));
  const maskMat = new PointsMaterial({ size: 0.032, sizeAttenuation: true });
  anatomy.add(new Points(maskGeo, maskMat));

  function applyPalette() {
    const pal = readPalette();
    faceMat.color.copy(pal.glass);
    edgeMat.color.copy(pal.blue);
    airMat.color.copy(pal.airway);
    maskMat.color.copy(pal.red);
    for (let i = 0; i < lobes.length; i++) {
      const c = pal.lobes[lobes[i]];
      lungColors[i * 3] = c.r; lungColors[i * 3 + 1] = c.g; lungColors[i * 3 + 2] = c.b;
    }
    lungGeo.attributes.color.needsUpdate = true;
  }
  applyPalette();
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener?.("change", () => { applyPalette(); render(); });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }
  function render() { renderer.render(scene, camera); }

  // The volume never moves on its own: it rotates only while the user drags it or presses the arrow keys,
  // and it is redrawn only when something changes. Horizontal moves spin it; vertical moves tilt it.
  function rotate(dx, dy) {
    root.rotation.y += dx;
    root.rotation.x = Math.max(-0.9, Math.min(0.9, root.rotation.x + dy));
    render();
  }

  let dragging = false, px = 0, py = 0;
  container.addEventListener("pointerdown", (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
    container.setPointerCapture?.(e.pointerId);
    container.style.cursor = "grabbing";
  });
  container.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotate((e.clientX - px) * 0.01, (e.clientY - py) * 0.01);
    px = e.clientX; py = e.clientY;
  });
  const stop = () => { dragging = false; container.style.cursor = ""; };
  container.addEventListener("pointerup", stop);
  container.addEventListener("pointercancel", stop);

  // Keyboard: Tab to the figure, then the arrow keys turn it in the same directions as dragging.
  container.tabIndex = 0;
  container.setAttribute("aria-label", `${container.getAttribute("aria-label")} Use the arrow keys to rotate it.`);
  container.addEventListener("keydown", (e) => {
    const step = 0.12;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    rotate(d[0], d[1]);
  });

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(container);
  resize();
  container.classList.add("is-ready");
}
