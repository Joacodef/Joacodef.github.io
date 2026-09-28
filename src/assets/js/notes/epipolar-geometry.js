import { createSpace, el, makeHandle, makeDraggable, apply, matMul, transpose, cross, dot, solve, lstsq, fmt, fmtSig, col, mat, modeButtons, wholeNumberInput, mathLabel, clipLine, pinv, fundamental, lineDistance, opticalCenter, pixelFrame, tr } from "../plane.js";

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

/* The views: X-ray images of an object that turns 2° about the vertical axis Z between one image and the next,
   2688 × 2208 pixels each. Image k has the projection matrix P(k) = P(0)·T(2k°), where T turns the object's
   coordinates about Z, so the X-ray source, the optical center, sits on one horizontal circle around the object.
   Lengths are in millimeters, and the third row of each P is a unit vector, so λ is a point's depth in millimeters. */
const P0 = [
  [-7919.179138430423, -1478.0889618975004, 5.355871503035249, 1297864.793781347],
  [23.269823689888916, -1284.882318265887, -7958.236076838229, 1064265.9285700037],
  [0.020550829547262388, -0.9997873837831113, 0.0016883817818043197, 964.0558692322625],
];
const W = 2688, H = 2208, LAST = 177;
export function camera(k) {
  const t = (2 * k * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return matMul(P0, [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
}
const depth = (A, X) => apply([A[2]], [...X, 1])[0];
const project = (A, X) => cart(apply(A, [...X, 1]));
// The direction of the ray through pixel w of camera A, scaled so that C + s·dir is the point of the ray at depth s.
const rayDir = (A, w) => solve(A.map((r) => r.slice(0, 3)), [w[0], w[1], 1]);
const inImage = ([u, v]) => u >= 0 && u <= W && v >= 0 && v <= H;
// A line [a b c] scaled so that a² + b² = 1: then ℓᵀm is the signed distance of m = [x y 1] from it, in pixels.
const unitLine = (l) => times(l, 1 / Math.hypot(l[0], l[1]));
const clipImage = (l) => clipLine(l, [0, 0], [W, H]);

const sb = (name, i, cls = "") => `<span class="${cls}"><i>${name}</i><sub>${i}</sub></span>`;
const m1h = sb("m", 1, "pt"), m2h = sb("m", 2, "pt"), e1h = sb("e", 1, "pt"), e2h = sb("e", 2, "pt"), l1h = sb("ℓ", 1, "ln"), l2h = sb("ℓ", 2, "ln");
const C1h = sb("C", 1), C2h = sb("C", 2), Mh = '<span class="pt"><i>M</i></span>';
const T_ = '<sup class="t">T</sup>', PLUS = '<sup class="t">+</sup>';
const Mph = `<span class="pt"><i>M</i>${PLUS}</span>`, Aph = `<i>A</i>${PLUS}`;

// Two images side by side in one SVG, with their titles above them.
const SC = 0.074, PANEL_Y = 50, PANEL_X = [26, 247];
function twoImages(svg, id) {
  svg.setAttribute("viewBox", `0 0 460 ${Math.ceil(PANEL_Y + H * SC + 12)}`);
  return PANEL_X.map((ox, i) => {
    const f = pixelFrame(svg, { W, H, scale: SC, ox, oy: PANEL_Y, id: `${id}-clip${i}`, uTicks: [0, 1000, 2000] });
    return { ...f, title: el("text", { x: ox, y: 20, class: "panel-lab" }, svg) };
  });
}
// Where a line [a b c] crosses the image, in SVG units of panel p; null when it misses the image.
function setImageLine(line, p, l) {
  const seg = l && Math.hypot(l[0], l[1]) > 0 ? clipImage(l) : null;
  show([line], !!seg);
  if (!seg) return null;
  line.setAttribute("x1", p.X(seg[0][0])); line.setAttribute("y1", p.Y(seg[0][1]));
  line.setAttribute("x2", p.X(seg[1][0])); line.setAttribute("y2", p.Y(seg[1][1]));
  return seg;
}
const setCircle = (c, p, [u, v]) => { c.setAttribute("cx", p.X(u)); c.setAttribute("cy", p.Y(v)); };
const setText = (t, x, y) => { t.setAttribute("x", x); t.setAttribute("y", y); };

/* ---------- Figure 1: two views in space ---------- */

function twoViews() {
  const svgI = document.getElementById("fig-epi-images"), svgS = document.getElementById("fig-epi-space");
  const out = document.getElementById("fig-epi-out"), inView = document.getElementById("fig-epi-view");
  if (!svgI || !svgS || !out || !inView) return;
  const A = camera(1), C1 = opticalCenter(A), z1 = unit(A[2].slice(0, 3));
  // M slides along the ray of m₁ in steps of 5 mm, through the object: about 230 mm either side of the axis.
  const LAM = [740, 1200], STEP = 5, KEY_PX = 10;
  // Each image is drawn where the model puts it, 680 mm in front of its source, between the source and the object.
  const D_IMG = 680;
  const initial = { k: 82, m1: [1080, 1256], lam: 1100, m2: null };   // m2 null: m₂ is the image of M
  let st = structuredClone(initial);

  /* The two images */
  const [I1, I2] = twoImages(svgI, "fig-epi");
  I1.title.textContent = tr("Image 1", "Imagen 1");
  const l1El = el("line", { class: "edge" }, I1.inside), l2El = el("line", { class: "edge" }, I2.inside);
  const e1El = el("circle", { r: 5, class: "epi" }, I1.inside), e2El = el("circle", { r: 5, class: "epi" }, I2.inside);
  const labG = el("g", null, svgI);
  const lab = (cls, parts) => { const t = mathLabel(labG, `${cls} lab-sm`, parts); t.setAttribute("text-anchor", "middle"); return t; };
  const labM1 = lab("pt-lab", [["m", true], ["1", false, "sub"]]), labM2 = lab("pt-lab", [["m", true], ["2", false, "sub"]]);
  const labE1 = lab("pt-lab", [["e", true], ["1", false, "sub"]]), labE2 = lab("pt-lab", [["e", true], ["2", false, "sub"]]);
  const labL1 = lab("ln-lab", [["ℓ", true], ["1", false, "sub"]]), labL2 = lab("ln-lab", [["ℓ", true], ["2", false, "sub"]]);
  const lineEnd = [null, null];   // the end of ℓ₁ and of ℓ₂ that carries its label, in pixels
  const h1 = makeHandle(svgI, "point"), h2 = makeHandle(svgI, "point");
  const toImage = (p, s) => p.toPixel(s).map(Math.round);
  const setM1 = ([u, v]) => { st.m1 = [clamp(Math.round(u), 0, W), clamp(Math.round(v), 0, H)]; render(); };
  const setM2 = ([u, v]) => { st.m2 = [clamp(Math.round(u), 0, W), clamp(Math.round(v), 0, H)]; render(); };
  makeDraggable(h1, { move: (s) => setM1(toImage(I1, s)), step: ([dx, dy]) => setM1([st.m1[0] + KEY_PX * dx, st.m1[1] - KEY_PX * dy]) });
  // m₂ starts from wherever it is drawn: the image of M, until the reader moves it.
  let m2Now = null;
  makeDraggable(h2, { move: (s) => setM2(toImage(I2, s)), step: ([dx, dy]) => setM2([m2Now[0] + KEY_PX * dx, m2Now[1] - KEY_PX * dy]) });

  /* Space, in the object's coordinates, with Z up */
  const VIEW = [32, 26];
  const S = createSpace(svgS, { height: 300, scale: 0.2, pivot: [0, 0, -40], at: [230, 150], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-180, 180], pitchRange: [4, 80] });
  // Layers, back to front. Each image plane is translucent, so what lies behind it is drawn before it: pieces behind
  // both planes as the reader sees them, the farther plane, pieces in front of it only, the nearer plane, the rest.
  const gBack = S.el("g"), gFar = S.el("g"), gMid = S.el("g"), gNear = S.el("g"), gFront = S.el("g"), labels = S.el("g"), handles = S.el("g");
  const planeG = [S.el("g", null, gFar), S.el("g", null, gNear)];
  const pool = (n, tag, cls) => Array.from({ length: n }, () => S.el(tag, { class: cls }, gBack));
  const ORBIT_N = 120;
  const orbitEls = pool(ORBIT_N, "line", "guide"), axisEls = pool(3, "line", "axis3");
  const piEls = pool(4, "polygon", "fan"), baseEls = pool(3, "line", "cam-axis");
  const ray1Els = pool(3, "line", "ray thin"), ray2Els = pool(3, "line", "ray thin"), gapEls = pool(3, "line", "gap");
  const panels = [0, 1].map((i) => S.el("polygon", { class: "panel clear" }, planeG[i]));
  const panelL = [0, 1].map((i) => S.el("line", { class: "edge" }, planeG[i]));
  const panelE = [0, 1].map((i) => S.el("circle", { r: 3, class: "epi" }, planeG[i]));
  const panelM = [0, 1].map((i) => S.el("circle", { r: 3.2, class: "pt-dot" }, planeG[i]));
  const dotC = [0, 1].map(() => S.el("circle", { r: 4, class: "origin" }, gBack));
  const ringMp = S.el("circle", { r: 4.5, class: "pt-ring thin" }, gBack);
  const dotM = S.el("circle", { r: 6, class: "pt-dot" }, gBack), ringM = S.el("circle", { r: 6, class: "pt-ring" }, gBack);
  const labC = [1, 2].map((i) => mathLabel(labels, "axl", [["C", true], [String(i), false, "sub"]]));
  const labM = mathLabel(labels, "pt-lab lab-sm", [["M", true]]), labMp = mathLabel(labels, "pt-lab lab-sm", [["M", true], ["+", false, "sup"]]);
  const labPi = mathLabel(labels, "ln-lab lab-sm", [["π", true]]);
  // The object turns about its Z axis.
  const AXIS = [[0, 0, -160], [0, 0, 260]];
  const labZ = mathLabel(labels, "axl", [["Z", true]]);
  const hM = makeHandle(handles, "none", 12);

  const setM = (lam) => { st.lam = clamp(Math.round(lam / STEP) * STEP, LAM[0], LAM[1]); st.m2 = null; render(); };
  let rayNow = null;   // C₁ and the direction of the ray of m₁, as drawn
  makeDraggable(hM, {
    move: (s) => setM(S.along(rayNow[0], rayNow[1], s)),
    step: (d) => setM(st.lam + STEP * (S.closest([rayNow[1], times(rayNow[1], -1)], d) === rayNow[1] ? 1 : -1)),
  });

  const showView = wholeNumberInput(inView, { min: 0, max: LAST, get: () => st.k, set: (v) => { st.k = v; st.m2 = null; render(); } });

  // Everything the figure shows, for the current state.
  function geometry() {
    const B = camera(st.k), C2 = opticalCenter(B);
    const same = Math.hypot(...sub(C1, C2)) < 1e-6;
    const d1 = rayDir(A, st.m1);
    const M = add(C1, times(d1, st.lam));
    const Mp4 = apply(pinv(A), [...st.m1, 1]), Mp = Mp4.slice(0, 3).map((x) => x / Mp4[3]);
    const e2 = apply(B, [...C1, 1]), bm = apply(B, Mp4);
    const F = fundamental(A, B);
    const l2 = cross(e2, bm);
    const follow = !st.m2;
    const m2 = follow ? project(B, M) : st.m2;
    const l1 = apply(transpose(F), [...m2, 1]);
    return { B, C2, same, d1, M, Mp, e1: project(A, C2), e2: cart(e2), bm: cart(bm), F, l2, l1, follow, m2, lam2: depth(B, M) };
  }

  function drawImages(g) {
    const { same, e1, e2, l1, l2, m2 } = g;
    I2.title.textContent = `${tr("Image", "Imagen")} ${st.k}`;
    const s1 = !same && setImageLine(l1El, I1, l1), s2 = !same && setImageLine(l2El, I2, l2);
    if (same) show([l1El, l2El], false);
    show([e1El], !same && inImage(e1)); show([e2El], !same && inImage(e2));
    if (!same) { setCircle(e1El, I1, e1); setCircle(e2El, I2, e2); }
    h1.setAttribute("transform", `translate(${I1.X(st.m1[0])},${I1.Y(st.m1[1])})`);
    const m2In = inImage(m2);
    h2.style.display = m2In ? "" : "none";
    if (m2In) h2.setAttribute("transform", `translate(${I2.X(m2[0])},${I2.Y(m2[1])})`);
    // Labels: a point's label sits above it, an epipole's below it, and a line's at its end farther from the epipole.
    const above = (t, p, [u, v], dx = 0) => setText(t, clamp(p.X(u) + dx, p.X(0) + 8, p.X(W) - 8), p.Y(v) - 13);
    above(labM1, I1, st.m1); show([labM2], m2In); if (m2In) above(labM2, I2, m2);
    show([labE1], !same && inImage(e1)); show([labE2], !same && inImage(e2));
    const below = (t, p, [u, v]) => setText(t, clamp(p.X(u), p.X(0) + 8, p.X(W) - 8), p.Y(v) + 24);
    if (!same) { below(labE1, I1, e1); below(labE2, I2, e2); }
    // A line's label goes near an end of the line, the one clearer of the point and the epipole on it. It stays with
    // the end it is on as the line turns, and moves to the other end only when that one is clearer by a quarter of
    // the image, so it does not flip back and forth.
    [[labL1, I1, s1, e1, st.m1], [labL2, I2, s2, e2, m2]].forEach(([t, p, seg, e, m], n) => {
      show([t], !!seg);
      if (!seg) { lineEnd[n] = null; return; }
      const room = seg.map((q) => Math.min(Math.hypot(q[0] - m[0], q[1] - m[1]), inImage(e) ? Math.hypot(q[0] - e[0], q[1] - e[1]) : Infinity));
      const last = lineEnd[n];
      let i = last ? (Math.hypot(seg[0][0] - last[0], seg[0][1] - last[1]) <= Math.hypot(seg[1][0] - last[0], seg[1][1] - last[1]) ? 0 : 1) : (room[0] >= room[1] ? 0 : 1);
      if (room[1 - i] > room[i] + W / 4) i = 1 - i;
      const q = seg[i], o = seg[1 - i], len = Math.hypot(o[0] - q[0], o[1] - q[1]) || 1;
      lineEnd[n] = q;
      // Pulled 190 pixels in from the end, along the line, and lifted off it.
      const c = [q[0] + ((o[0] - q[0]) / len) * 190, q[1] + ((o[1] - q[1]) / len) * 190];
      setText(t, p.X(c[0]), p.Y(c[1]) - 9);
    });
    return m2In;
  }

  /* Space. Pieces are split where they cross an image plane, and each piece goes to the layer for its side. */
  function drawSpace(g) {
    const { B, C2, same, d1, M, Mp, l1, l2, follow, m2 } = g;
    const cams = [{ A, C: C1, z: z1 }, { A: B, C: C2, z: unit(B[2].slice(0, 3)) }];
    const tw = S.toward();
    const f = (i, X) => depth(cams[i].A, X) - D_IMG;   // negative on the source's side of image plane i
    const facing = cams.map((c) => dot(tw, c.z) > 0);   // the reader is on the object's side of plane i
    const inFront = (i, X) => f(i, X) > 0 === facing[i];
    const centers = cams.map((c) => add(c.C, times(c.z, D_IMG)));
    const a = dot(tw, centers[0]) <= dot(tw, centers[1]) ? 0 : 1, b = 1 - a;   // a: the plane farther from the reader
    planeG[0].remove(); planeG[1].remove();
    (a === 0 ? gFar : gNear).appendChild(planeG[0]); (a === 0 ? gNear : gFar).appendChild(planeG[1]);
    const layer = (X) => (inFront(b, X) ? gFront : inFront(a, X) ? gMid : gBack);
    const put = (e, X) => layer(X).appendChild(e);
    function segment(els, p, q) {
      const ts = [0, 1];
      if (p && q) for (let i = 0; i < 2; i++) { const fp = f(i, p), fq = f(i, q); if (fp * fq < 0) ts.push(fp / (fp - fq)); }
      ts.sort((x, y) => x - y);
      const parts = p && q ? ts.slice(1).map((t, n) => [lerp(p, q, ts[n]), lerp(p, q, t)]) : [];
      els.forEach((e, n) => {
        show([e], n < parts.length);
        if (n < parts.length) { S.setLine(e, ...parts[n]); put(e, lerp(...parts[n], 0.5)); }
      });
    }
    // The part of a polygon where h(X) has the sign s (Sutherland–Hodgman).
    function clipPoly(poly, h, s) {
      const res = [];
      poly.forEach((p, n) => {
        const q = poly[(n + 1) % poly.length], hp = s * h(p), hq = s * h(q);
        if (hp >= 0) res.push(p);
        if (hp * hq < 0) res.push(lerp(p, q, hp / (hp - hq)));
      });
      return res;
    }
    const dot3 = (c, X, r) => { const [x, y] = S.project(X); c.setAttribute("cx", x); c.setAttribute("cy", y); if (r) c.setAttribute("r", r); };

    // The circle of source positions and the axis the object turns about.
    const R0 = Math.hypot(C1[0], C1[1]), Z0 = C1[2];
    for (let n = 0; n < ORBIT_N; n++) {
      const t0 = (2 * Math.PI * n) / ORBIT_N, t1 = (2 * Math.PI * (n + 1)) / ORBIT_N;
      const p = [R0 * Math.cos(t0), R0 * Math.sin(t0), Z0], q = [R0 * Math.cos(t1), R0 * Math.sin(t1), Z0];
      S.setLine(orbitEls[n], p, q); put(orbitEls[n], lerp(p, q, 0.5));
    }
    segment(axisEls, ...AXIS);
    S.placeLabel(labZ, AXIS[1], [0, -1], 12);

    // The centers, the baseline, the ray of m₁, and the epipolar plane: the triangle C₁, C₂ and the far end of M's range.
    cams.forEach((c, i) => { dot3(dotC[i], c.C); put(dotC[i], c.C); });
    const far = add(C1, times(d1, LAM[1]));
    segment(ray1Els, C1, far);
    segment(baseEls, same ? null : C1, C2);
    let pieces = same ? [] : [[C1, C2, far]];
    for (let i = 0; i < 2; i++) pieces = pieces.flatMap((pp) => [clipPoly(pp, (X) => f(i, X), 1), clipPoly(pp, (X) => f(i, X), -1)]).filter((pp) => pp.length >= 3);
    piEls.forEach((e, n) => {
      show([e], n < pieces.length);
      if (n >= pieces.length) return;
      S.setPoly(e, pieces[n]);
      put(e, times(pieces[n].reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pieces[n].length));
    });
    // π sits beside the plane, a little past the edge from C₂ to the far end of the ray, where the plane is widest.
    show([labPi], !same);
    if (!same) {
      const edge = lerp(C2, far, 0.5), [bx, by] = S.offset(sub(far, C2)), [ox, oy] = S.offset(sub(edge, C1));
      let out = [by, -bx];
      if (out[0] * ox + out[1] * oy < 0) out = times(out, -1);
      S.placeLabel(labPi, edge, out, 13);
    }

    // The images, D_IMG in front of each source, with the epipolar line, the epipole and the point on each.
    const onPlane = (i, w) => add(cams[i].C, times(rayDir(cams[i].A, w), D_IMG));
    const ls = [l1, l2], ms = [st.m1, m2], es = [g.e1, g.e2];
    for (let i = 0; i < 2; i++) {
      S.setPoly(panels[i], [[0, 0], [W, 0], [W, H], [0, H]].map((w) => onPlane(i, w)));
      const seg = !same && clipImage(ls[i]);
      show([panelL[i]], !!seg);
      if (seg) S.setLine(panelL[i], onPlane(i, seg[0]), onPlane(i, seg[1]));
      show([panelE[i]], !same && inImage(es[i]));
      if (!same && inImage(es[i])) dot3(panelE[i], onPlane(i, es[i]));
      show([panelM[i]], inImage(ms[i]));
      if (inImage(ms[i])) dot3(panelM[i], onPlane(i, ms[i]));
    }

    // M, M⁺, and the ray from C₂: through M when m₂ is its image; otherwise through m₂, drawn to where it passes
    // closest to the ray of m₁, with the gap between the two rays.
    dot3(dotM, M); dot3(ringM, M); put(dotM, M); put(ringM, M);
    show([dotM], follow); show([ringM], !follow);
    dot3(ringMp, Mp); put(ringMp, Mp);
    S.place(hM, M);
    let gap = null;
    if (follow) { segment(ray2Els, same ? null : C2, M); segment(gapEls, null, null); }
    else {
      const d2 = rayDir(B, m2), w0 = sub(C1, C2);
      const aa = dot(d1, d1), bb = dot(d1, d2), cc = dot(d2, d2), dd = dot(d1, w0), ee = dot(d2, w0), den = aa * cc - bb * bb;
      const s1 = (bb * ee - cc * dd) / den, s2 = (aa * ee - bb * dd) / den;
      const P1 = add(C1, times(d1, s1)), P2 = add(C2, times(d2, s2));
      gap = Math.hypot(...sub(P1, P2));
      segment(ray2Els, C2, add(C2, times(d2, clamp(s2 * 1.1, D_IMG + 100, 2400))));
      segment(gapEls, P1, P2);
    }

    // Labels: C₁ and C₂ outward from the axis, M above its ray, M⁺ below it.
    cams.forEach((c, i) => S.placeLabel(labC[i], c.C, S.offset([c.C[0], c.C[1], 0]), 20));
    show([labC[1]], !same);
    const r = S.offset(d1), n = Math.hypot(...r) || 1;
    let perp = [r[1] / n, -r[0] / n];
    if (perp[1] > 0) perp = times(perp, -1);
    S.placeLabel(labM, M, perp, 17);
    S.placeLabel(labMp, Mp, times(perp, -1), 15);
    return gap;
  }

  function render() {
    showView(st.k);
    const g = geometry();
    const m2In = drawImages(g);
    const gap = drawSpace(g);
    rayNow = [C1, g.d1];
    m2Now = g.m2.map(Math.round);
    const { same, e1, e2, bm, M, Mp, m2, l2, follow, lam2 } = g;
    const where = (m) => `(${list(m)})`;
    h1.setAttribute("aria-label", tr(`Point m1 in image 1, at pixel ${where(st.m1)}. Use the arrow keys to move it ${KEY_PX} pixels.`, `Punto m1 en la imagen 1, en el píxel ${where(st.m1)}. Usa las flechas del teclado para moverlo ${KEY_PX} píxeles.`));
    hM.setAttribute("aria-label", tr(`Point M on the ray of m1, at depth ${st.lam} millimeters from C1. Use the arrow keys to slide it along the ray.`, `Punto M sobre el rayo de m1, a ${st.lam} milímetros de C1 en profundidad. Usa las flechas del teclado para deslizarlo por el rayo.`));

    let html = `<span class="lbl">${tr(`The ray of ${m1h}`, `El rayo de ${m1h}`)}</span>`;
    html += `<p>${tr(`Two points of the ray of ${m1h} = ${where(st.m1)}:`, `Dos puntos del rayo de ${m1h} = ${where(st.m1)}:`)}</p>`;
    html += `<p class="eq"><span class="nowrap">${C1h} ${approx(C1)} ${where(C1)},</span>&ensp; <span class="nowrap">${Mph} = ${Aph}${m1h}</span> <span class="nowrap">${approx(Mp)} ${where(Mp)}</span></p>`;
    if (same) {
      html += `<p class="muted">${tr(`Image ${st.k} is image 1 itself: both come from the same position of the source, so ${C2h} = ${C1h}, and <i>B</i>${C1h} = <i>A</i>${C1h} is the zero vector. There is no epipole and no epipolar line, and <i>F</i> = 0. Any two images taken from one optical center are related by a homography instead.`, `La imagen ${st.k} es la propia imagen 1: ambas vienen de la misma posición de la fuente, así que ${C2h} = ${C1h}, y <i>B</i>${C1h} = <i>A</i>${C1h} es el vector cero. No hay epipolo ni línea epipolar, y <i>F</i> = 0. Dos imágenes tomadas desde un mismo centro óptico se relacionan, en cambio, por una homografía.`)}</p>`;
      out.innerHTML = html;
      h2.setAttribute("aria-label", tr(`Point m2 in image ${st.k}, at pixel ${where(m2)}.`, `Punto m2 en la imagen ${st.k}, en el píxel ${where(m2)}.`));
      return;
    }
    const angle = (2 * (st.k - 1) + 360) % 360;
    html += `<span class="lbl">${tr(`Both, projected into image ${st.k}`, `Ambos, proyectados en la imagen ${st.k}`)}</span>`;
    html += `<p class="eq"><span class="nowrap">${e2h} = <i>B</i>${C1h}</span> <span class="nowrap">${approx(e2)} ${where(e2)},</span>&ensp; <span class="nowrap"><i>B</i>${Mph} ${approx(bm)} ${where(bm)}</span></p>`;
    html += `<p>${tr(`The source has turned ${Math.min(angle, 360 - angle)}° about the object since image 1.`, `La fuente ha girado ${Math.min(angle, 360 - angle)}° en torno al objeto desde la imagen 1.`)}${inImage(e2) ? "" : ` ${tr(`${e2h} lies outside the image.`, `${e2h} queda fuera de la imagen.`)}`}</p>`;
    const lu = unitLine(l2);
    html += `<span class="lbl">${tr("The epipolar line through them", "La línea epipolar que pasa por ambos")}</span>`;
    html += `<p class="eq"><span class="nowrap">${l2h} = ${e2h} × <i>B</i>${Mph} = <i>F</i>${m1h}</span> <span class="nowrap">∝ ${col(lu, "ln", (x) => (Math.abs(x) < 10 ? fmt(x, 4) : fmt(x)))}</span></p>`;
    html += `<p>${tr("Scaled so that <i>a</i><sup class=\"t\">2</sup> + <i>b</i><sup class=\"t\">2</sup> = 1, it gives distances in pixels.", "Escalada para que <i>a</i><sup class=\"t\">2</sup> + <i>b</i><sup class=\"t\">2</sup> = 1, da distancias en píxeles.")}</p>`;
    const nearE1 = Math.hypot(st.m1[0] - e1[0], st.m1[1] - e1[1]);
    if (nearE1 < 150) html += `<p class="muted">${tr(`${m1h} is ${fmt(nearE1)} pixels from the epipole ${e1h}, so its ray runs close to the baseline, and ${l2h} turns quickly as ${m1h} moves.`, `${m1h} está a ${fmt(nearE1)} píxeles del epipolo ${e1h}, así que su rayo corre cerca de la línea base, y ${l2h} gira rápido cuando ${m1h} se mueve.`)}</p>`;

    const d = Math.abs(dot(lu, [...m2, 1]));
    html += `<span class="lbl">${tr(`The point ${Mh} and ${m2h}`, `El punto ${Mh} y ${m2h}`)}</span>`;
    if (follow) {
      html += `<p>${tr(`At depth λ<sub>1</sub> = ${st.lam} mm,`, `A una profundidad λ<sub>1</sub> = ${st.lam} mm,`)} <span class="nowrap">${Mh} ${approx(M)} ${where(M)}</span> ${tr("and", "y")} <span class="nowrap">${m2h} = <i>B</i>${Mh} ${approx(m2)} ${where(m2)}.</span> ${tr(`It lies on ${l2h} whatever the depth of ${Mh}:`, `Está sobre ${l2h} sea cual sea la profundidad de ${Mh}:`)}</p>`;
      html += `<p class="eq"><span class="nowrap">${l2h}${T_}${m2h} ≈ 0</span></p>`;
      if (lam2 <= 0) html += `<p class="muted">${tr(`But ${Mh} is behind the source of image ${st.k} (λ<sub>2</sub> ≤ 0), so that image does not see it.`, `Pero ${Mh} está detrás de la fuente de la imagen ${st.k} (λ<sub>2</sub> ≤ 0), así que esa imagen no lo ve.`)}</p>`;
      else if (!inImage(m2)) html += `<p class="muted">${tr(`${m2h} falls outside image ${st.k}.`, `${m2h} cae fuera de la imagen ${st.k}.`)}</p>`;
    } else {
      html += `<p class="eq"><span class="nowrap"><i>d</i> = |${l2h}${T_}${m2h}| ${approx(d)} ${fmt(d)}</span></p>`;
      html += d < 0.005
        ? `<p>${tr(`${m2h} = ${where(m2)} lies on ${l2h}, so the ray from ${C2h} through it meets the ray of ${m1h}.`, `${m2h} = ${where(m2)} está sobre ${l2h}, así que el rayo desde ${C2h} que pasa por él corta al rayo de ${m1h}.`)}</p>`
        : `<p>${tr(`${m2h} = ${where(m2)} is ${fmt(d)} pixels off ${l2h}, so no point of space projects to both ${m1h} and ${m2h}: the ray from ${C2h} through ${m2h} passes the ray of ${m1h} ${fmt(gap)} mm away. And ${l1h} = <i>F</i>${T_}${m2h}, in image 1, misses ${m1h}.`, `${m2h} = ${where(m2)} está a ${fmt(d)} píxeles de ${l2h}, así que ningún punto del espacio se proyecta a la vez en ${m1h} y en ${m2h}: el rayo desde ${C2h} que pasa por ${m2h} pasa a ${fmt(gap)} mm del rayo de ${m1h}. Y ${l1h} = <i>F</i>${T_}${m2h}, en la imagen 1, no pasa por ${m1h}.`)}</p>`;
    }
    out.innerHTML = html;
    h2.setAttribute("aria-label", tr(`Point m2 in image ${st.k}, at pixel ${where(m2)}, ${fmt(d)} pixels from the epipolar line of m1. Use the arrow keys to move it ${KEY_PX} pixels.`, `Punto m2 en la imagen ${st.k}, en el píxel ${where(m2)}, a ${fmt(d)} píxeles de la línea epipolar de m1. Usa las flechas del teclado para moverlo ${KEY_PX} píxeles.`));
  }

  S.turnable(render);
  document.getElementById("fig-epi-reset")?.addEventListener("click", () => { st = structuredClone(initial); lineEnd.fill(null); S.setView(...VIEW); render(); });
  render();
}

/* ---------- Figure 3: estimating F from pairs of points ---------- */

// Sixteen points of the object, in millimeters, spread through it and not on one plane; the first eight are the
// 8-pair set. They were chosen so that moving one point of a pair by up to 30 pixels turns the estimated lines
// smoothly: some sets of eight pairs lie close to a configuration that leaves F undetermined, and there the lines
// swing across the image when a point moves by a pixel.
const OBJECT_POINTS = [[-67, 0, 121], [-74, 137, -81], [45, -123, -40], [130, 123, 84], [43, -45, -102], [-79, -71, -19], [98, 42, -82], [75, -85, 102],
  [-7, -10, 54], [-131, 50, -89], [123, -94, 89], [13, -20, 4], [-61, -68, 66], [-2, 60, 100], [-92, 35, -58], [-28, -95, 9]];
// Other points of the object, a 6 × 6 × 6 grid 50 mm apart, to measure how well an estimate predicts new pairs.
const GRID = [];
for (const x of [-125, -75, -25, 25, 75, 125]) for (const y of [-125, -75, -25, 25, 75, 125]) for (const z of [-125, -75, -25, 25, 75, 125]) GRID.push([x, y, z]);

// One row of Q for the pair m₁ = (x₁, y₁), m₂ = (x₂, y₂): the coefficients of F₁₁ … F₃₂ in m₂ᵀFm₁ = 0, with F₃₃ = 1.
export const qRow = ([x1, y1], [x2, y2]) => [x1 * x2, y1 * x2, x2, x1 * y2, y1 * y2, y2, x1, y1];
// F with F₃₃ = 1 from pairs [m₁, m₂]: Qf′ = r with r = −1, solved exactly for 8 pairs and by least squares for more.
// Each column of Q is scaled to length 1 first, since in pixels they differ in size by millions. Null when the pairs
// do not fix F.
export function estimateF(pairs) {
  const Q = pairs.map(([a, b]) => qRow(a, b)), r = pairs.map(() => -1);
  const len = transpose(Q).map((c) => Math.hypot(...c) || 1);
  const Qs = Q.map((row) => row.map((x, j) => x / len[j]));
  const f = pairs.length === 8 ? solve(Qs, r) : lstsq(Qs, r);
  if (!f) return null;
  const g = f.map((x, j) => x / len[j]);
  return [g.slice(0, 3), g.slice(3, 6), [g[6], g[7], 1]];
}

function estimation() {
  const svg = document.getElementById("fig-eight");
  const out = document.getElementById("fig-eight-out");
  const group = document.getElementById("fig-eight-modes");
  if (!svg || !out || !group) return;
  const A = camera(1), B = camera(82), F = fundamental(A, B);
  const Fs = F.map((r) => r.map((x) => x / F[2][2]));
  const pairs = OBJECT_POINTS.map((X) => [project(A, X).map(Math.round), project(B, X).map(Math.round)]);
  const grid = GRID.map((X) => [project(A, X), project(B, X)]).filter(([a, b]) => inImage(a) && inImage(b));
  const REACH = 30, ZX = 280, ZY = 90;   // how far a point can move, in pixels, and the close-up's size in pixels
  const initial = { n: 8, sel: 2, off: pairs.map(() => [0, 0]) };
  let st = structuredClone(initial);

  /* The two images, and a close-up of image 82 around the selected pair's point */
  const [I1, I2] = twoImages(svg, "fig-eight");
  const baseH = Math.ceil(PANEL_Y + H * SC + 12);
  const ZS = 1.5, ZOX = 20, ZOY = baseH + 30;
  svg.setAttribute("viewBox", `0 0 460 ${Math.ceil(ZOY + ZY * ZS + 10)}`);
  I1.title.textContent = tr("Image 1", "Imagen 1");
  I2.title.textContent = `${tr("Image", "Imagen")} 82`;
  const lineEls = pairs.map(() => el("line", { class: "edge thin" }, I2.inside));
  const trueEl = el("line", { class: "edge dash" }, I2.inside);
  const box = el("rect", { class: "px-pick thin" }, I2.inside);
  const zTitle = el("text", { x: ZOX, y: ZOY - 10, class: "panel-lab" }, svg);
  const zClip = el("clipPath", { id: "fig-eight-zclip" }, el("defs", null, svg));
  el("rect", { x: ZOX, y: ZOY, width: ZX * ZS, height: ZY * ZS }, zClip);
  el("rect", { x: ZOX, y: ZOY, width: ZX * ZS, height: ZY * ZS, class: "px-frame" }, svg);
  const zIn = el("g", { "clip-path": "url(#fig-eight-zclip)" }, svg);
  const zGrid = el("g", { class: "grid" }, zIn);
  const zGridEls = Array.from({ length: Math.ceil(ZX / 10) + Math.ceil(ZY / 10) + 2 }, () => el("line", null, zGrid));
  const zReach = el("circle", { r: REACH * ZS, class: "guide" }, zIn);
  const zTrue = el("line", { class: "edge dash" }, zIn), zLine = el("line", { class: "ln-path" }, zIn);
  const dots = pairs.map(() => el("circle", { r: 4.5, class: "pt-dot" }, svg));
  const nums = pairs.map((_, i) => [0, 1].map(() => { const t = el("text", { class: "corner-lab", "text-anchor": "middle" }, svg); t.textContent = i + 1; return t; }));
  const sels = [0, 1].map(() => el("circle", { r: 8.5, class: "sel" }, svg));   // rings around the selected pair
  const pick = pairs.map(() => makeHandle(svg, "none", 9));
  pick.forEach((h, i) => {
    el("circle", { r: 4.5, class: "pt-dot" }, h);
    const choose = () => { st.sel = i; render(); };
    h.addEventListener("click", choose);
    h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
  });
  const hZ = makeHandle(svg, "point");
  // The close-up shows ZX × ZY pixels around the rounded image of the selected pair's point.
  let zc = [0, 0];
  const ZXf = (u) => ZOX + (u - zc[0] + ZX / 2) * ZS, ZYf = (v) => ZOY + (v - zc[1] + ZY / 2) * ZS;
  function setOff(i, [dx, dy]) {
    const r = Math.hypot(dx, dy);
    if (r > REACH) { dx *= REACH / r; dy *= REACH / r; }
    let o = [Math.round(dx), Math.round(dy)];
    if (Math.hypot(...o) > REACH) o = [Math.trunc(dx), Math.trunc(dy)];
    st.off[i] = o;
    render();
  }
  makeDraggable(hZ, {
    move: (s) => setOff(st.sel, [(s.x - ZOX) / ZS - ZX / 2, (s.y - ZOY) / ZS - ZY / 2]),
    step: ([dx, dy]) => { const o = st.off[st.sel]; setOff(st.sel, [o[0] + dx, o[1] - dy]); },
  });

  function render() {
    const n = st.n, used = pairs.slice(0, n).map(([a, b], i) => [a, add(b, st.off[i])]);
    const Fe = estimateF(used);
    const s = st.sel, [m1, m2] = used[s], c = pairs[s][1];
    zc = c;
    // Image 1: the points m₁. Image 82: the points m₂, each with the estimated epipolar line of its m₁.
    pairs.forEach(([a], i) => {
      const on = i < n;
      show([dots[i], nums[i][0], nums[i][1], lineEls[i]], on);
      pick[i].style.display = on ? "" : "none";
      if (!on) return;
      setCircle(dots[i], I1, a);
      const b = used[i][1];
      pick[i].setAttribute("transform", `translate(${I2.X(b[0])},${I2.Y(b[1])})`);
      pick[i].setAttribute("aria-label", tr(`Pair ${i + 1}: m1 = (${list(a)}) in image 1 and m2 = (${list(b)}) in image 82. Press Enter to show it in the close-up.`, `Par ${i + 1}: m1 = (${list(a)}) en la imagen 1 y m2 = (${list(b)}) en la imagen 82. Presiona Enter para verlo en el acercamiento.`));
      // A number sits above and to the right of its point, or below it near the top edge, clear of the ticks.
      const num = (t, p, [u, v]) => setText(t, p.X(u) + 11, p.Y(v) + (v < 300 ? 17 : -7));
      num(nums[i][0], I1, a); num(nums[i][1], I2, b);
      if (Fe) setImageLine(lineEls[i], I2, apply(Fe, [...a, 1]));
      else show([lineEls[i]], false);
    });
    setCircle(sels[0], I1, m1); setCircle(sels[1], I2, m2);
    const lt = apply(F, [...m1, 1]);
    setImageLine(trueEl, I2, lt);
    box.setAttribute("x", I2.X(c[0] - ZX / 2)); box.setAttribute("y", I2.Y(c[1] - ZY / 2));
    box.setAttribute("width", ZX * SC); box.setAttribute("height", ZY * SC);

    // The close-up: a grid every 10 pixels, the reach of the point, the line from A and B, and the estimated line.
    zTitle.textContent = tr(`Close-up of image 82 around pair ${s + 1}`, `Acercamiento de la imagen 82 en torno al par ${s + 1}`);
    const u0 = c[0] - ZX / 2, v0 = c[1] - ZY / 2;
    let k = 0;
    for (let u = Math.ceil(u0 / 10) * 10; u <= u0 + ZX; u += 10, k++) { const e = zGridEls[k]; show([e], true); e.setAttribute("x1", ZXf(u)); e.setAttribute("x2", ZXf(u)); e.setAttribute("y1", ZOY); e.setAttribute("y2", ZOY + ZY * ZS); }
    for (let v = Math.ceil(v0 / 10) * 10; v <= v0 + ZY; v += 10, k++) { const e = zGridEls[k]; show([e], true); e.setAttribute("y1", ZYf(v)); e.setAttribute("y2", ZYf(v)); e.setAttribute("x1", ZOX); e.setAttribute("x2", ZOX + ZX * ZS); }
    for (; k < zGridEls.length; k++) show([zGridEls[k]], false);
    zReach.setAttribute("cx", ZXf(c[0])); zReach.setAttribute("cy", ZYf(c[1]));
    const zSeg = (line, l) => {
      const seg = clipLine(l, [u0, v0], [u0 + ZX, v0 + ZY]);
      show([line], !!seg);
      if (seg) { line.setAttribute("x1", ZXf(seg[0][0])); line.setAttribute("y1", ZYf(seg[0][1])); line.setAttribute("x2", ZXf(seg[1][0])); line.setAttribute("y2", ZYf(seg[1][1])); }
    };
    zSeg(zTrue, lt);
    if (Fe) zSeg(zLine, apply(Fe, [...m1, 1])); else show([zLine], false);
    hZ.setAttribute("transform", `translate(${ZXf(m2[0])},${ZYf(m2[1])})`);
    const o = st.off[s];
    hZ.setAttribute("aria-label", tr(`Point m2 of pair ${s + 1}, at pixel (${list(m2)}), moved (${list(o)}) pixels from the image of its point of the object. Use the arrow keys to move it one pixel.`, `Punto m2 del par ${s + 1}, en el píxel (${list(m2)}), movido (${list(o)}) píxeles desde la imagen de su punto del objeto. Usa las flechas del teclado para moverlo un píxel.`));

    // The readout.
    let html = `<span class="lbl">${tr(`Pair ${s + 1} gives one row of <i>Q</i>`, `El par ${s + 1} da una fila de <i>Q</i>`)}</span>`;
    html += `<p>${tr("With", "Con")} <span class="nowrap">${m1h} = (${list(m1)})</span> ${tr("and", "y")} <span class="nowrap">${m2h} = (${list(m2)}):</span></p>`;
    html += `<p class="eq fit">[${qRow(m1, m2).map((x) => fmt(x)).join("&ensp; ")}]&thinsp;<i>f</i>′ = −1</p>`;
    if (!Fe) {
      html += `<p class="muted">${tr("These pairs do not fix <i>F</i>: the equations have no single solution.", "Estos pares no determinan <i>F</i>: las ecuaciones no tienen una única solución.")}</p>`;
      out.innerHTML = html;
      return;
    }
    html += `<span class="lbl">${tr(`The estimate from ${n} pairs, with <i>F</i><sub>33</sub> = 1`, `La estimación con ${n} pares, con <i>F</i><sub>33</sub> = 1`)}</span>`;
    html += `<p class="eq fit">${mat(Fe, "", (x) => fmtSig(x, 3))}</p>`;
    html += `<p>${tr("From the two cameras, with the same scale:", "A partir de las dos cámaras, con la misma escala:")}</p>`;
    html += `<p class="eq fit">${mat(Fs, "", (x) => fmtSig(x, 3))}</p>`;
    html += `<span class="lbl">${tr("How well it fits, in pixels", "Qué tan bien se ajusta, en píxeles")}</span>`;
    const own = used.map(([a, b]) => lineDistance(apply(Fe, [...a, 1]), [...b, 1]));
    html += `<p>${tr(`Distance from each ${m2h} to the estimated line of its ${m1h}:`, `Distancia de cada ${m2h} a la línea estimada de su ${m1h}:`)} ${own.map((x) => fmt(x)).join(", ")}.</p>`;
    const dg = grid.map(([a, b]) => lineDistance(apply(Fe, [...a, 1]), [...b, 1]));
    const mean = dg.reduce((p, q) => p + q, 0) / dg.length, max = Math.max(...dg);
    html += `<p>${tr(`For ${dg.length} other points of the object, the true ${m2h} is on average ${fmt(mean)} pixels from the estimated line of its ${m1h}, and at most ${fmt(max)}.`, `Para otros ${dg.length} puntos del objeto, el ${m2h} verdadero está en promedio a ${fmt(mean)} píxeles de la línea estimada de su ${m1h}, y a lo más a ${fmt(max)}.`)}</p>`;
    out.innerHTML = html;
  }

  const press = modeButtons(group, (mode) => { st.n = Number(mode); if (st.sel >= st.n) st.sel = 0; render(); });
  document.getElementById("fig-eight-reset")?.addEventListener("click", () => { st = structuredClone(initial); press(String(st.n)); render(); });
  render();
}

twoViews();
estimation();
