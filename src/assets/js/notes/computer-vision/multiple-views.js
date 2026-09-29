import { createSpace, el, apply, dot, cross, solve, fmt, col, mat, modeButtons, mathLabel, pixelFrame, opticalCenter, reconstruct, circleCamera, makeHandle, makeDraggable, svgPoint, tr } from "../../plane.js";

const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const times = (v, k) => v.map((x) => x * k);
const lerp = (p, q, t) => p.map((x, i) => x + t * (q[i] - x));
const unit = (v) => times(v, 1 / Math.hypot(...v));
const cart = (v) => [v[0] / v[2], v[1] / v[2]];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const show = (els, on) => els.forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));
const list = (v, f = fmt) => v.map((x) => f(x)).join(", ");
// Whether fmt(n, d) has to round n; readouts then write ≈ instead of =.
const rounded = (n, d = 2) => Math.abs(n * 10 ** d - Math.round(n * 10 ** d)) > 1e-6;
const approx = (...vs) => (vs.flat().some((v) => rounded(v)) ? "≈" : "=");

export const project = (A, X) => cart(apply(A, [...X, 1]));
export const depth = (A, X) => apply([A[2]], [...X, 1])[0];
// The direction of the ray through pixel w of camera A, scaled so that C + s·dir is the point of the ray at depth s.
const rayDir = (A, w) => solve(A.map((r) => r.slice(0, 3)), [w[0], w[1], 1]);
// The point of the ray C + s·d closest to X.
const closestOnRay = (C, d, X) => add(C, times(d, dot(sub(X, C), d) / dot(d, d)));

/* The example: an X-ray source on a horizontal circle of radius 1000 mm around the axis Z takes images 1, 2 and 3 from
   0°, 90° and 175°, so the sources of images 1 and 3 almost face each other. Each image is 2000 × 1600 pixels. */
export const VIEWS = [1, 2, 3], ANGLES = [0, 90, 175];
export const CAMS = ANGLES.map((a) => circleCamera(a)), CENTERS = CAMS.map(opticalCenter);
// The object is a flat bar, 45 mm long and pointed at both ends: TIPS[tip], upper tip first. It stands 12° from
// vertical, leaning toward the source of image 2, with its lower tip on the plane of the sources, Z = 0.
export const BAR_LENGTH = 45;
const LOWER = [15, -20, 0], TILT = (12 * Math.PI) / 180;
export const TIPS = [add(LOWER, [0, BAR_LENGTH * Math.sin(TILT), BAR_LENGTH * Math.cos(TILT)]), LOWER];
// The tips as clicked, a few pixels off, as clicks by hand are: CLICKS[view][tip], whole pixels [u, v]. Each is its
// tip's true pixel, rounded, moved by (5, −6) and (−6, 4) in image 1, (−4, 5) and (5, −3) in image 2, and (6, 2) and
// (−5, 5) in image 3.
export const CLICKS = [[[919, 437], [832, 804]], [[877, 457], [887, 797]], [[1079, 455], [1141, 805]]];
export const SETS = { all: [0, 1, 2], "1-2": [0, 1], "2-3": [1, 2], "1-3": [0, 2] };
// The two tips found from the clicks of the images in `used`: reconstruct()'s { M, Q, r } for each, or null.
export const fitEnds = (clicks, used) => [0, 1].map((e) => reconstruct(used.map((i) => clicks[i][e]), used.map((i) => CAMS[i])));

/* ---------- The bar ---------- */

// The bar is 11 mm wide and 5.5 thick, with a notch on one side that shows which way it faces.
const LEN = BAR_LENGTH;
// Axes along the bar: a from the lower tip to the upper one, d across it toward the source of image 1, and w = a × d.
// Images 1 and 3 see its wide face, and image 2 its narrow edge.
const AX = unit(sub(TIPS[0], TIPS[1])), toC1 = sub(CENTERS[0], TIPS[1]);
const AD = unit(sub(toC1, times(AX, dot(toC1, AX)))), AW = cross(AX, AD);
const at = (s, x, y) => add(TIPS[1], add(times(AX, s), add(times(AW, x), times(AD, y))));

// A convex part from its corners and its faces, as loops of corner indices. Each face keeps its corners and its plane
// n·X = c, with n pointing out of the part.
function part(V, F) {
  const mid = times(V.reduce(add), 1 / V.length);
  const faces = F.map((loop) => {
    const P = loop.map((i) => V[i]), c = times(P.reduce(add), 1 / P.length);
    let n = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    if (dot(n, sub(c, mid)) < 0) n = times(n, -1);
    return { P, n, c: dot(n, P[0]), center: c };
  });
  return { V, faces };
}
const box = (s0, s1, x0, x1, y0, y1) => {
  const V = [];
  for (const s of [s0, s1]) for (const x of [x0, x1]) for (const y of [y0, y1]) V.push(at(s, x, y));
  return part(V, [[0, 2, 3, 1], [4, 6, 7, 5], [0, 4, 5, 1], [2, 6, 7, 3], [0, 4, 6, 2], [1, 5, 7, 3]]);
};
const pyramid = (sApex, sBase, w, d) => part([at(sApex, 0, 0), at(sBase, -w, -d), at(sBase, w, -d), at(sBase, w, d), at(sBase, -w, d)],
  [[1, 2, 3, 4], [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1]]);
// Half its width and thickness, the length of each tip, the depth of the notch, and where the notch starts and ends.
const [HW, HD, TIP, NOTCH, S1, S2] = [5.5, 2.75, 7, 4.5, 0.52 * LEN, 0.72 * LEN], S3 = LEN - TIP;
// The bar as five convex parts, for its X-ray images, and its edges, for the 3D view.
export const PARTS = [pyramid(0, TIP, HW, HD), box(TIP, S1, -HW, HW, -HD, HD), box(S1, S2, -HW, HW - NOTCH, -HD, HD), box(S2, S3, -HW, HW, -HD, HD), pyramid(LEN, S3, HW, HD)];
export const EDGES = (() => {
  const E = [], L = (p, q) => E.push([at(...p), at(...q)]);
  for (const [x, y] of [[-HW, -HD], [HW, -HD], [HW, HD], [-HW, HD]]) { L([0, 0, 0], [TIP, x, y]); L([LEN, 0, 0], [S3, x, y]); }
  for (const s of [TIP, S3]) { L([s, -HW, -HD], [s, HW, -HD]); L([s, HW, -HD], [s, HW, HD]); L([s, HW, HD], [s, -HW, HD]); L([s, -HW, HD], [s, -HW, -HD]); }
  for (const y of [-HD, HD]) {
    L([TIP, -HW, y], [S3, -HW, y]); L([TIP, HW, y], [S1, HW, y]); L([S2, HW, y], [S3, HW, y]); L([S1, HW - NOTCH, y], [S2, HW - NOTCH, y]);
    for (const s of [S1, S2]) L([s, HW - NOTCH, y], [s, HW, y]);
  }
  for (const s of [S1, S2]) { L([s, HW - NOTCH, -HD], [s, HW - NOTCH, HD]); L([s, HW, -HD], [s, HW, HD]); }
  return E;
})();

/* ---------- X-ray images of the bar ---------- */

const area = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
// The part of the convex polygon S inside the convex polygon K.
function clipPolygon(S, K) {
  if (area(K) < 0) K = [...K].reverse();
  let out = S;
  for (let i = 0; i < K.length && out.length; i++) {
    const a = K[i], b = K[(i + 1) % K.length], side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const inp = out;
    out = [];
    inp.forEach((p, j) => {
      const q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) out.push(lerp(p, q, sp / (sp - sq)));
    });
  }
  return out;
}
// The stretch [t0, t1] of the ray C + t·dir that lies inside a convex part, or null.
function inside(p, C, dir) {
  let t0 = -Infinity, t1 = Infinity;
  for (const f of p.faces) {
    const nd = dot(f.n, dir), room = f.c - dot(f.n, C);
    if (Math.abs(nd) < 1e-12) { if (room < 0) return null; continue; }
    if (nd > 0) t1 = Math.min(t1, room / nd); else t0 = Math.max(t0, room / nd);
  }
  return t0 < t1 ? [t0, t1] : null;
}
// The bar as camera A with source C sees it. In an X-ray image, a pixel is darker the more material its ray crosses.
// Laid over each other, the faces of a part that face the source and those that face away cut its image into convex
// cells, and each cell is drawn in one flat gray, from the length L in millimeters of the ray through its middle.
export function xrayCells(A, C) {
  const cells = [];
  for (const p of PARTS) {
    const front = [], back = [];
    for (const f of p.faces) (dot(f.n, sub(C, f.center)) > 0 ? front : back).push(f.P.map((X) => project(A, X)));
    for (const F of front) for (const B of back) {
      const poly = clipPolygon(F, B);
      if (poly.length < 3 || Math.abs(area(poly)) < 0.01) continue;
      const d = rayDir(A, times(poly.reduce(add), 1 / poly.length)), t = inside(p, C, d);
      if (t) cells.push({ poly, L: (t[1] - t[0]) * Math.hypot(...d) });
    }
  }
  return cells;
}
// How much of the light a path of L millimeters stops: the opacity of --img-lo over --img-hi. Where parts overlap, the
// opacities combine as the paths add up.
export const opacity = (L) => 1 - Math.exp(-0.08 * L);

/* ---------- The close-ups ---------- */

// Each close-up shows `size` pixels of its image from the pixel `from`, 0.62 SVG units per pixel, the rows lined up.
export const WINDOWS = [{ from: [760, 390], size: [230, 460] }, { from: [790, 390], size: [160, 460] }, { from: [1000, 390], size: [230, 460] }];
export const SC = 0.62, TOP = 50, PX = [52, 203, 310];
export const toSvg = (i, [u, v]) => [PX[i] + SC * (u - WINDOWS[i].from[0]), TOP + SC * (v - WINDOWS[i].from[1])];
// A click is a whole pixel, kept 4 pixels inside its close-up.
export const clampClick = (i, [u, v]) => {
  const { from: [u0, v0], size: [W, H] } = WINDOWS[i];
  return [clamp(Math.round(u), u0 + 4, u0 + W - 4), clamp(Math.round(v), v0 + 4, v0 + H - 4)];
};
export const inWindow = (i, [u, v]) => { const { from: [u0, v0], size: [W, H] } = WINDOWS[i]; return u >= u0 && u <= u0 + W && v >= v0 && v <= v0 + H; };
// Where the segment from a (inside close-up i) toward b leaves the close-up, in pixels.
export function exitPoint(i, a, b) {
  const { from: [u0, v0], size: [W, H] } = WINDOWS[i], d = sub(b, a);
  let t = 1;
  [[0, u0], [0, u0 + W], [1, v0], [1, v0 + H]].forEach(([k, edge]) => {
    if (Math.abs(d[k]) > 1e-9) { const s = (edge - a[k]) / d[k]; if (s > 0 && s < t) t = s; }
  });
  return add(a, times(d, t));
}
// Where the distance to a projection outside close-up i is written, in SVG units: 16 units in from the point q where
// the error's line leaves the close-up, toward its middle, and kept inside it, with `half` the half width of the text.
// Each step is continuous, so the label follows the line without jumping from one side to another.
export function farLabelAt(i, q, half = 30) {
  const [W, H] = WINDOWS[i].size, [x, y] = toSvg(i, q), mx = PX[i] + (SC * W) / 2, my = TOP + (SC * H) / 2;
  const n = Math.hypot(mx - x, my - y) || 1;
  return [clamp(x + (16 * (mx - x)) / n, PX[i] + half + 3, PX[i] + SC * W - half - 3), clamp(y + (16 * (my - y)) / n + 6, TOP + 20, TOP + SC * H - 6)];
}
// Close to the object, the 3D view fits the bar and the tips found in about 200 units, at most 4.5 per millimeter.
export function closeFrame(Ms) {
  const pts = [...TIPS, ...Ms];
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const size = Math.max(...pts.flatMap((p) => pts.map((q) => Math.hypot(...sub(p, q)))));
  return { scale: Math.min(4.5, 200 / size), pivot: lerp(lo, hi, 0.5) };
}

const T_ = '<sup class="t">T</sup>', INV = '<sup class="t">−1</sup>';
// A letter with a hat, for an estimate (see .hat in notes.css).
const hat = (c) => `<span class="hat${c === c.toLowerCase() ? " lo" : ""}"><i>${c}</i></span>`;
const Mh = `<span class="pt">${hat("M")}</span>`;
const XYZ = `[${hat("X")}&ensp;${hat("Y")}&ensp;${hat("Z")}]${T_}`;

function rays() {
  const svgI = document.getElementById("fig-rays-images"), svgS = document.getElementById("fig-rays-space");
  const out = document.getElementById("fig-rays-out");
  const viewsG = document.getElementById("fig-rays-views"), zoomG = document.getElementById("fig-rays-zoom");
  if (!svgI || !svgS || !out || !viewsG || !zoomG) return;
  const initial = { views: "all", zoom: "whole", clicks: CLICKS };
  let st = structuredClone(initial);

  /* The close-ups: the bar's X-ray image, and for each tip its click, where M̂ projects and the line between them */
  svgI.setAttribute("viewBox", `0 0 460 ${Math.ceil(TOP + WINDOWS[0].size[1] * SC + 12)}`);
  const panels = VIEWS.map((k, i) => {
    const { from, size: [W, H] } = WINDOWS[i], uTicks = [];
    // Ticks every 100 pixels, away from the edges: a label near a close-up's left edge would run into the u of image 1.
    for (let u = Math.ceil((from[0] + (i === 0 ? 8 : 25)) / 100) * 100; u <= from[0] + W - 8; u += 100) uTicks.push(u);
    const f = pixelFrame(svgI, { W, H, scale: SC, ox: PX[i], oy: TOP, id: `fig-rays-clip${i}`, from, uTicks, vTicks: i === 0 ? [400, 500, 600, 700, 800] : [], axisNames: i === 0 });
    el("rect", { x: PX[i], y: TOP, width: W * SC, height: H * SC, class: "air" }, f.inside);
    for (const { poly, L } of xrayCells(CAMS[i], CENTERS[i])) {
      el("polygon", { points: poly.map(([u, v]) => `${f.X(u)},${f.Y(v)}`).join(" "), class: "xray", "fill-opacity": opacity(L).toFixed(3) }, f.inside);
    }
    // The frame again, over the image.
    el("rect", { x: PX[i], y: TOP, width: W * SC, height: H * SC, class: "px-frame" }, svgI);
    el("text", { x: PX[i], y: 20, class: "panel-lab" }, svgI).textContent = `${tr("Image", "Imagen")} ${k}`;
    // Marks on the image get an outline in the card color, so they stand out on dark and on bright pixels alike.
    const marks = [0, 1].map(() => ({
      gapHalo: el("line", { class: "halo", "stroke-width": 3.6 }, f.inside),
      gap: el("line", { class: "err" }, f.inside),
      ringHalo: el("circle", { r: 6, class: "halo", "stroke-width": 3.8 }, f.inside),
      ring: el("circle", { r: 6, class: "reproj" }, f.inside),
      far: el("text", { class: "pt-lab lab-sm on-img", "text-anchor": "middle" }, svgI),
    }));
    return { ...f, marks };
  });

  // The clicks, which the reader drags or moves with the arrow keys, one pixel at a time.
  const gHandles = el("g", null, svgI);
  const setClick = (i, e, p) => { st.clicks[i][e] = clampClick(i, p); render(); };
  const handles = panels.map((p, i) => [0, 1].map((e) => {
    const h = makeHandle(gHandles, "none", 9);
    h.classList.add("on-img");
    el("circle", { r: 4.2, class: "halo", "stroke-width": 5.2 }, h);
    el("circle", { r: 4.2, class: "pt-dot on-img" }, h);
    // A drag keeps the offset between the pointer and the click, so the click does not jump to the pointer.
    let grab = [0, 0];
    h.addEventListener("pointerdown", (ev) => { grab = sub(st.clicks[i][e], p.toPixel(svgPoint(svgI, ev))); });
    makeDraggable(h, {
      move: (s) => setClick(i, e, add(p.toPixel(s), grab)),
      step: ([dx, dy]) => setClick(i, e, [st.clicks[i][e][0] + dx, st.clicks[i][e][1] - dy]),
    });
    return h;
  }));

  function drawImages(used, Ms) {
    panels.forEach((p, i) => {
      const on = used.includes(i), k = VIEWS[i];
      p.marks.forEach((mk, e) => {
        const c = st.clicks[i][e], h = handles[i][e];
        h.classList.toggle("out", !on);
        h.setAttribute("transform", `translate(${p.X(c[0])},${p.Y(c[1])})`);
        // Where M̂ projects: a ring inside the close-up, or the line to where it leaves the close-up and its distance.
        const m = Ms && depth(CAMS[i], Ms[e]) > 0 ? project(CAMS[i], Ms[e]) : null;
        const inWin = !!m && inWindow(i, m), q = m && (inWin ? m : exitPoint(i, c, m));
        show([mk.ring, mk.ringHalo], inWin);
        if (inWin) [mk.ring, mk.ringHalo].forEach((r) => { r.setAttribute("cx", p.X(m[0])); r.setAttribute("cy", p.Y(m[1])); });
        show([mk.gap, mk.gapHalo], !!m);
        if (m) [mk.gap, mk.gapHalo].forEach((l) => { l.setAttribute("x1", p.X(c[0])); l.setAttribute("y1", p.Y(c[1])); l.setAttribute("x2", p.X(q[0])); l.setAttribute("y2", p.Y(q[1])); });
        show([mk.far], !!m && !inWin);
        const d = m && Math.hypot(...sub(m, c));
        if (m && !inWin) {
          mk.far.textContent = `${fmt(d, 0)} px`;
          const [x, y] = farLabelAt(i, q);
          mk.far.setAttribute("x", x); mk.far.setAttribute("y", y);
        }
        const where = `(${list(c)})`, tip = e === 0 ? tr("Upper tip", "Punta superior") : tr("Lower tip", "Punta inferior");
        const err = !m ? "" : on
          ? tr(`, ${fmt(d)} pixels from where the point found projects`, `, a ${fmt(d)} píxeles de donde se proyecta el punto encontrado`)
          : tr(`. This image is left out of the fit, and the point found projects ${fmt(d)} pixels from the click`, `. Esta imagen queda fuera del ajuste, y el punto encontrado se proyecta a ${fmt(d)} píxeles del clic`);
        h.setAttribute("aria-label", tr(`${tip} in image ${k}, clicked at pixel ${where}${err}. Use the arrow keys to move it one pixel.`, `${tip} en la imagen ${k}, marcada en el píxel ${where}${err}. Usa las flechas del teclado para moverla un píxel.`));
      });
    });
  }

  /* Space, in the object's coordinates, with Z up */
  const VIEW = [32, 26], WHOLE = { scale: 0.2, pivot: [0, 0, 20] }, KEEP = 1300;
  const S = createSpace(svgS, { height: 320, scale: WHOLE.scale, pivot: WHOLE.pivot, at: [230, 160], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-180, 180], pitchRange: [4, 80] });
  const gBack = S.el("g"), gBar = S.el("g"), gRays = S.el("g"), gGaps = S.el("g"), gObj = S.el("g"), labels = S.el("g");
  const ORBIT_N = 120;
  const orbitEls = Array.from({ length: ORBIT_N }, () => S.el("line", { class: "guide" }, gBack));
  const AXIS = [[0, 0, -160], [0, 0, 260]];
  const axisEl = S.el("line", { class: "axis3" }, gBack), labZ = mathLabel(labels, "axl", [["Z", true]]);
  const srcEls = CENTERS.map(() => S.el("circle", { r: 4 }, gBack));
  const srcLabs = VIEWS.map((_, i) => mathLabel(labels, "axl", [["C", true], [String(i + 1), false, "sub"]]));
  // The bar, drawn where it is.
  EDGES.forEach(([p, q]) => S.line(gBar, p, q, "edge thin"));
  const rayEls = VIEWS.map(() => [0, 1].map(() => S.el("line", { class: "ray thin" }, gRays)));
  const gapEls = VIEWS.map(() => [0, 1].map(() => S.el("line", { class: "gap" }, gGaps)));
  const objEl = S.el("line", { class: "ray" }, gObj);
  const mEls = [0, 1].map(() => S.el("circle", { class: "pt-dot" }, gObj));
  const setLab = (t, [x, y]) => { t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", "middle"); };
  // M̂ with a subscript. The hat is a text of its own, set over the M wherever the label goes (see .hat in notes.css).
  const mLabs = [1, 2].map((e) => {
    const t = mathLabel(labels, "pt-lab lab-sm", [["M", true], [String(e), false, "sub"]]);
    const h = el("text", { class: "pt-lab lab-sm", "text-anchor": "middle" }, labels);
    h.textContent = String.fromCharCode(0x2c6);
    return { t, h };
  });
  // [x, y] is where the label starts, on its baseline.
  function placeM({ t, h }, [x, y]) {
    t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", "start");
    const size = parseFloat(getComputedStyle(t).fontSize);
    h.setAttribute("x", x + t.getSubStringLength(0, 1) * 0.62);
    h.setAttribute("y", y - size * 0.2);
  }
  // Close to the object, the view is framed when a button is pressed, and stays put while the clicks move.
  let frame = closeFrame(TIPS);
  const reframe = () => { const fits = fitEnds(st.clicks, SETS[st.views]); frame = closeFrame(fits.every(Boolean) ? fits.map((f) => f.M) : []); };

  function drawSpace(used, Ms) {
    const close = st.zoom === "close";
    S.setScale(close ? frame.scale : WHOLE.scale, close ? frame.pivot : WHOLE.pivot);
    // The circle of source positions and the axis the object turns about: in the whole setup only.
    const R0 = Math.hypot(CENTERS[0][0], CENTERS[0][1]), Z0 = CENTERS[0][2];
    orbitEls.forEach((e, n) => {
      const t0 = (2 * Math.PI * n) / ORBIT_N, t1 = (2 * Math.PI * (n + 1)) / ORBIT_N;
      S.setLine(e, [R0 * Math.cos(t0), R0 * Math.sin(t0), Z0], [R0 * Math.cos(t1), R0 * Math.sin(t1), Z0]);
    });
    S.setLine(axisEl, ...AXIS);
    S.placeLabel(labZ, AXIS[1], [0, -1], 12);
    show([...orbitEls, axisEl, labZ], !close);

    VIEWS.forEach((_, i) => {
      const on = used.includes(i), C = CENTERS[i];
      srcEls[i].setAttribute("class", on ? "origin" : "guide");
      const [x, y] = S.project(C);
      srcEls[i].setAttribute("cx", x); srcEls[i].setAttribute("cy", y);
      show([srcEls[i]], !close);
      const ends = [];
      [0, 1].forEach((e) => {
        const d = rayDir(CAMS[i], st.clicks[i][e]);
        // Whole setup: from the source to KEEP mm deep, past the object. Close to the object: the part in the figure.
        let span = close ? S.span(C, d, 4) : [0, KEEP];
        if (span) span = [Math.max(span[0], 0), Math.min(span[1], KEEP)];
        const vis = on && span && span[0] < span[1];
        show([rayEls[i][e]], vis);
        if (vis) { S.setLine(rayEls[i][e], add(C, times(d, span[0])), add(C, times(d, span[1]))); ends.push(S.project(add(C, times(d, span[0])))); }
        // Close to the object: the gap from each M̂ to each ray, which the fit could not close.
        const g = gapEls[i][e];
        show([g], close && on && !!Ms);
        if (close && on && Ms) S.setLine(g, Ms[e], closestOnRay(C, d, Ms[e]));
      });
      // A source's name: next to it in the whole setup; close to the object, between its two rays where they come in.
      const lab = srcLabs[i];
      if (!close) { show([lab], true); S.placeLabel(lab, C, S.offset([C[0], C[1], 0]), 20); }
      else if (ends.length === 2) {
        const mid = lerp(ends[0], ends[1], 0.5), dir = unit(S.offset(rayDir(CAMS[i], st.clicks[i][0])));
        show([lab], true); setLab(lab, [mid[0] + dir[0] * 18, mid[1] + dir[1] * 18 + 7]);
      } else show([lab], false);
    });

    // The two tips found, and the bar between them.
    show([objEl, ...mEls], !!Ms);
    show(mLabs.flatMap(({ t, h }) => [t, h]), close && !!Ms);
    if (!Ms) return;
    S.setLine(objEl, Ms[0], Ms[1]);
    mEls.forEach((c, e) => { const [x, y] = S.project(Ms[e]); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", close ? 3.6 : 3.2); });
    // Their names, close to the object: right of each tip, the upper tip's above it and the lower tip's below it.
    // The offsets are fixed on screen, so the names never jump from one side to the other as the view turns.
    if (close) mLabs.forEach((lab, e) => { const [x, y] = S.project(Ms[e]); placeM(lab, [x + 11, e === 0 ? y - 8 : y + 24]); });
  }

  function render() {
    const used = SETS[st.views], n = used.length;
    const fits = fitEnds(st.clicks, used), Ms = fits.every(Boolean) ? fits.map((f) => f.M) : null;
    drawImages(used, Ms);
    drawSpace(used, Ms);

    const where = (m) => `(${list(m)})`;
    let html = `<span class="lbl">${tr("Clicks of the upper and the lower tip, in pixels", "Clics de la punta superior y de la inferior, en píxeles")}</span>`;
    const clicks = VIEWS.map((k, i) => {
      const [a, b] = st.clicks[i].map((c) => `<span class="nowrap">(${list(c, String)})</span>`);
      const out = used.includes(i) ? "" : tr(", left out", ", sin usar");
      return i === 0 ? tr(`Image ${k}${out}: ${a} and ${b}`, `Imagen ${k}${out}: ${a} y ${b}`) : tr(`image ${k}${out}: ${a} and ${b}`, `imagen ${k}${out}: ${a} y ${b}`);
    });
    html += `<p>${clicks.join("; ")}.</p>`;
    html += `<span class="lbl">${tr("Two equations per view", "Dos ecuaciones por vista")}</span>`;
    if (!Ms) {
      html += `<p class="muted">${tr("These clicks fix no point: the rays of the images used are one line, and <i>Q</i> has rank below 3.", "Estos clics no determinan un punto: los rayos de las imágenes usadas son una misma recta, y <i>Q</i> tiene rango menor que 3.")}</p>`;
      out.innerHTML = html;
      return;
    }
    html += `<p>${tr(`With ${n} images, <i>Q</i> is ${2 * n} × 3 and <i>r</i> has ${2 * n} entries. For the upper tip:`, `Con ${n} imágenes, <i>Q</i> es de ${2 * n} × 3 y <i>r</i> tiene ${2 * n} componentes. Para la punta superior:`)}</p>`;
    const { Q, r } = fits[0];
    html += `<p class="eq fit"><span class="nowrap"><i>Q</i> ≈ ${mat(Q, "", (x) => fmt(x, 1))}</span>&ensp; <span class="nowrap"><i>r</i> ≈ ${col(r, "", (x) => fmt(x, 0))}</span></p>`;
    html += `<p class="eq"><span class="nowrap">${XYZ} = (<i>Q</i>${T_}<i>Q</i>)${INV}<i>Q</i>${T_}<i>r</i></span> <span class="nowrap">${approx(Ms[0])} ${where(Ms[0])}</span></p>`;
    html += `<p>${tr(`The lower tip: <span class="nowrap">${Mh} ${approx(Ms[1])} ${where(Ms[1])}.</span>`, `La punta inferior: <span class="nowrap">${Mh} ${approx(Ms[1])} ${where(Ms[1])}.</span>`)}</p>`;
    const len = Math.hypot(...sub(Ms[0], Ms[1]));
    html += `<p class="eq"><span class="nowrap">${tr("Length", "Largo")} ${approx(len)} ${fmt(len)} mm</span></p>`;
    // The bar is known, so the tips found can be compared with where its tips are.
    const off = [0, 1].map((e) => Math.hypot(...sub(Ms[e], TIPS[e])));
    html += `<p>${tr(`The bar is ${BAR_LENGTH} mm long, and the tips found are ${fmt(off[0])} and ${fmt(off[1])} mm from where its tips are.`, `La barra mide ${BAR_LENGTH} mm, y las puntas encontradas están a ${fmt(off[0])} y ${fmt(off[1])} mm de donde están sus puntas.`)}</p>`;

    html += `<span class="lbl">${tr("Reprojection errors, in pixels", "Errores de reproyección, en píxeles")}</span>`;
    const errs = VIEWS.map((_, i) => [0, 1].map((e) => Math.hypot(...sub(project(CAMS[i], Ms[e]), st.clicks[i][e]))));
    const items = VIEWS.map((k, i) => used.includes(i)
      ? tr(`image ${k}: ${fmt(errs[i][0])} and ${fmt(errs[i][1])}`, `imagen ${k}: ${fmt(errs[i][0])} y ${fmt(errs[i][1])}`)
      : tr(`image ${k}, left out: ${Mh} lands ${fmt(errs[i][0])} and ${fmt(errs[i][1])} pixels from its clicks`, `imagen ${k}, sin usar: ${Mh} cae a ${fmt(errs[i][0])} y ${fmt(errs[i][1])} píxeles de sus clics`));
    html += `<p>${tr("For the upper and the lower tip", "Para la punta superior y la inferior")}, ${items.join("; ")}.</p>`;
    // The first row of QM̂ − r, as a depth times a pixel error.
    const i0 = used[0], lam = depth(CAMS[i0], Ms[0]), dx = st.clicks[i0][0][0] - project(CAMS[i0], Ms[0])[0];
    const dxs = fmt(dx, Math.abs(dx) < 1 ? 3 : 2);
    html += `<p>${tr(`Each row of <i>Q</i>${Mh} − <i>r</i> is a depth times a pixel error. The first one, for image ${VIEWS[i0]}:`, `Cada fila de <i>Q</i>${Mh} − <i>r</i> es una profundidad por un error en píxeles. La primera, para la imagen ${VIEWS[i0]}:`)}</p>`;
    html += `<p class="eq"><span class="nowrap">λ(<i>x</i> − ${hat("x")}) ≈ ${fmt(lam)} · ${dx < 0 ? `(${dxs})` : dxs}</span> <span class="nowrap">≈ ${fmt(lam * dx, 1)}</span></p>`;

    // Two images whose rays are nearly one line: the fit cannot tell how far along them the point is.
    if (n === 2) {
      const [a, b] = used;
      const ang = (Math.acos(Math.min(1, dot(unit(sub(Ms[0], CENTERS[a])), unit(sub(Ms[0], CENTERS[b]))))) * 180) / Math.PI;
      if (180 - ang < 15) html += `<p class="muted">${tr(`The rays of images ${VIEWS[a]} and ${VIEWS[b]} meet at ${fmt(ang)}°, only ${fmt(180 - ang)}° from being one line: their sources face each other across the bar. A few pixels of error then move ${Mh} far along the rays, and the bar comes out ${fmt(len)} mm long.`, `Los rayos de las imágenes ${VIEWS[a]} y ${VIEWS[b]} se cortan en ${fmt(ang)}°, a solo ${fmt(180 - ang)}° de ser una misma recta: sus fuentes están enfrentadas, a ambos lados de la barra. Unos pocos píxeles de error mueven entonces ${Mh} lejos a lo largo de los rayos, y la barra resulta de ${fmt(len)} mm de largo.`)}</p>`;
    }
    out.innerHTML = html;
  }

  const pressViews = modeButtons(viewsG, (mode) => { st.views = mode; reframe(); render(); });
  const pressZoom = modeButtons(zoomG, (mode) => { st.zoom = mode; reframe(); render(); });
  S.turnable(render);
  document.getElementById("fig-rays-reset")?.addEventListener("click", () => {
    st = structuredClone(initial); pressViews(st.views); pressZoom(st.zoom); S.setView(...VIEW); reframe(); render();
  });
  render();
}

rays();
