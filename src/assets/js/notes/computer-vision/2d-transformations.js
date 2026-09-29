import { el, createPlane, createSpace, makeHandle, makeDraggable, apply, inverse, homography, cross, fmt, fmtSig, sym, col, mat, modeButtons, mathLabel, placeBeside, clipLine, tr } from "../../plane.js";

const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const show = (els, on) => [].concat(els).forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));
// Whether fmt has to round n to two decimals; floating-point noise such as 4.800000001 does not count.
const rounded = (n) => Math.abs(n * 100 - Math.round(n * 100)) > 1e-6;
const approx = (n) => (rounded(n) ? "≈ " : "= ") + fmt(n);
// A point inside a sentence: (4.8, 1.4), or ≈ (4.37, 2.84) when rounded.
const pointText = (x, y) => `${rounded(x) || rounded(y) ? "≈ " : ""}<span class="pt nowrap">(${fmt(x)}, ${fmt(y)})</span>`;
const mp = (i = "") => `<span class="pt"><i>m</i>′${i === "" ? "" : `<sub>${i}</sub>`}</span>`;
const mv = sym("m", "", "pt");
const shade = (v) => `color-mix(in srgb, var(--img-hi) ${Math.round((v / 255) * 1000) / 10}%, var(--img-lo))`;
// Empties label memories, so a Reset puts the labels back where they first were.
const forget = (...memos) => memos.forEach((m) => { for (const k in m) delete m[k]; });

// Each readout holds one calculation, the one its section is about, and one sentence that says what it means.

/* ---------- The first state of each figure, and the math the figures and the text share ---------- */

// Section 1: the new axes start at t′ = o and point along d (x′) and d turned by 90° (y′); m is the point.
export const FRAMES_START = { o: { x: 3, y: 1 }, d: { x: 4, y: 3 }, m: { x: 6, y: 5 } };
export function framesOf({ o, d, m }) {
  const n = Math.hypot(d.x, d.y), c = d.x / n, s = d.y / n;
  const H = [[c, -s, o.x], [s, c, o.y], [0, 0, 1]];
  const Hinv = [[c, s, -(c * o.x + s * o.y)], [-s, c, -(-s * o.x + c * o.y)], [0, 0, 1]];
  return { c, s, H, Hinv, mp: apply(Hinv, [m.x, m.y, 1]) };
}
// The cross ratio of four points on a line, (AC·BD)/(BC·AD).
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const crossRatio = (A, B, C, D) => (dist(A, C) * dist(B, D)) / (dist(B, C) * dist(A, D));
// Section 3: camera coordinates X right, Y down, Z forward, with the camera center at the origin and the image plane at
// Z = f1. The surface, centered on the optical axis at Z = f2, is tilted by φ about the X axis with its top leaning
// away: its point (u, v) is (u, v cos φ, f2 − v sin φ), and H sends it to the photo, scaled so that h33 = 1.
export const PHOTO = { f1: 1, f2: 3, half: 1.5, phi: 30 };
export function photoH(phi, { f1, f2 } = PHOTO) {
  const c = Math.cos(rad(phi)), s = Math.sin(rad(phi));
  return [[f1 / f2, 0, 0], [0, (f1 * c) / f2, 0], [0, -s / f2, 1]];
}
// Section 4: the straightened image is 16 × 16 pixels, with the sign's corners m1 (top left), m2 (bottom left),
// m3 (bottom right) and m4 (top right) at its corner pixels. The 28 × 28 photo is made from a hidden homography that
// puts the sign's corners at CORNERS; the clicks start with m′4 four pixels off.
export const RECT = {
  N: 16, M: 28,
  OUT: [[0, 0], [0, 15], [15, 15], [15, 0]],
  CORNERS: [{ x: 5, y: 4 }, { x: 5, y: 23 }, { x: 22, y: 19 }, { x: 22, y: 8 }],
  CLICKS: [{ x: 5, y: 4 }, { x: 5, y: 23 }, { x: 22, y: 19 }, { x: 18, y: 4 }],
};
export const rectifyH = (clicks) => homography(RECT.OUT.map((o, i) => [o, [clicks[i].x, clicks[i].y]]));
// Section 5: the output (12 × 12) is the source (8 × 8, an F) enlarged s times and turned by θ about the centers.
// H takes an output pixel m (x right, y down, pixel centers at whole numbers) to the source point m′ it shows.
export const WARP = { s: 1.5, theta: 20, N1: 8, N2: 12 };
export function warpH({ s, theta, N1, N2 } = WARP) {
  const c1 = (N1 - 1) / 2, c2 = (N2 - 1) / 2, co = Math.cos(rad(theta)) / s, si = Math.sin(rad(theta)) / s;
  return [[co, si, c1 - co * c2 - si * c2], [-si, co, c1 + si * c2 - co * c2], [0, 0, 1]];
}
const GRAY = { ".": 40, "#": 220, "+": 130 };
export const SOURCE = ["........", ".#####+.", ".#......", ".####+..", ".#......", ".#......", ".#......", "........"].map((r) => [...r].map((c) => GRAY[c]));
// Sent forward, each source pixel goes to the output pixel nearest to where H⁻¹ sends it. Returns what landed where,
// the landing points, and how many output pixels the enlarged source covers and how many of those got nothing.
export function forwardWarp() {
  const { N1, N2 } = WARP, H = warpH(), Hi = inverse(H);
  const landed = Array.from({ length: N2 }, () => Array(N2).fill(null)), lands = [];
  SOURCE.forEach((r, a) => r.forEach((v, b) => {
    const w = apply(Hi, [b, a, 1]), x = w[0] / w[2], y = w[1] / w[2];
    lands.push([x, y]);
    const j = Math.round(x), i = Math.round(y);
    if (i >= 0 && i < N2 && j >= 0 && j < N2) landed[i][j] = v;
  }));
  let covered = 0, holes = 0;
  for (let i = 0; i < N2; i++) for (let j = 0; j < N2; j++) {
    const w = apply(H, [j, i, 1]), x = w[0] / w[2], y = w[1] / w[2];
    if (x > -0.5 && x < N1 - 0.5 && y > -0.5 && y < N1 - 0.5) { covered++; if (landed[i][j] === null) holes++; }
  }
  return { landed, lands, covered, holes };
}

/* ---------- Figure 1: a point in two coordinate systems ---------- */
function frames() {
  const svg = document.getElementById("fig-frames");
  const out = document.getElementById("fig-frames-out");
  if (!svg || !out) return;
  const P = createPlane(svg, { max: 10, tick: 1, labelStep: 1, grid: true });
  let st = structuredClone(FRAMES_START);
  // From back to front: dotted guides from m to the new axes, the axes, their labels, and the handles.
  const guides = [0, 1].map(() => P.el("line", { class: "guide" }));
  const axes = [0, 1].map(() => P.el("line", { class: "edge" }));
  const labs = [P.label("ln-lab", "x′"), P.label("ln-lab", "y′")];
  const labO = P.label("axl", "t′");
  const labM = P.label("pt-lab", "m");
  const hO = P.handle("grip"), hD = P.handle("grip"), hM = P.handle("point");
  const memos = [{}, {}, {}, {}];   // the sides the labels of x′, y′, t′ and m took
  const line = (e, a, b) => { e.setAttribute("x1", P.X(a[0])); e.setAttribute("y1", P.Y(a[1])); e.setAttribute("x2", P.X(b[0])); e.setAttribute("y2", P.Y(b[1])); };

  function render() {
    const { o, d, m } = st, { c, s, Hinv, mp: q } = framesOf(st);
    // Each new axis is drawn across the plot through t′, with its label near its positive end.
    [[c, s], [-s, c]].forEach(([ux, uy], k) => {
      const seg = clipLine([uy, -ux, ux * o.y - uy * o.x], 0, 10);
      show([axes[k], labs[k]], !!seg);
      if (!seg) return;
      line(axes[k], seg[0], seg[1]);
      const ahead = (p) => (p[0] - o.x) * ux + (p[1] - o.y) * uy;
      const far = ahead(seg[1]) > ahead(seg[0]) ? seg[1] : seg[0];
      P.placeAlong(labs[k], { x: far[0] - ux * 0.7, y: far[1] - uy * 0.7 }, [-uy, ux], 2.2, memos[k]);
    });
    // Dotted guides from m to each new axis, at x′ and y′ along them.
    line(guides[0], [m.x, m.y], [o.x + q[0] * c, o.y + q[0] * s]);
    line(guides[1], [m.x, m.y], [o.x - q[1] * s, o.y + q[1] * c]);
    P.place(hO, o); P.place(hD, { x: o.x + d.x, y: o.y + d.y }); P.place(hM, m);
    // t′'s label sits between the negative ends of the two axes, away from both; m's label up and to the right.
    P.placeAlong(labO, o, [-c + s, -s - c], 2.4, memos[2]);
    P.placeAlong(labM, m, [1, 1], 2.3, memos[3]);
    const turn = fmt(deg(Math.atan2(s, c)));
    hO.setAttribute("aria-label", tr(`New origin t′ at (${o.x}, ${o.y}). Use the arrow keys to move the new axes.`, `Nuevo origen t′ en (${o.x}, ${o.y}). Usa las flechas del teclado para mover los ejes nuevos.`));
    hD.setAttribute("aria-label", tr(`Point on the x′ axis at (${o.x + d.x}, ${o.y + d.y}); the new axes are turned by ${turn} degrees. Use the arrow keys to move it and turn the axes.`, `Punto del eje x′ en (${o.x + d.x}, ${o.y + d.y}); los ejes nuevos están girados ${turn} grados. Usa las flechas del teclado para moverlo y girar los ejes.`));
    hM.setAttribute("aria-label", tr(`Point m at (${m.x}, ${m.y}). Use the arrow keys to move it.`, `Punto m en (${m.x}, ${m.y}). Usa las flechas del teclado para moverlo.`));

    let html = `<p class="eq"><span class="nowrap">${mp()} = <i>H</i><sup class="t">−1</sup>${mv}</span> <span class="nowrap">${Hinv.flat().some(rounded) ? "≈" : "="} ${mat(Hinv)}${col([m.x, m.y, 1], "pt")}</span> <span class="nowrap">${q.some(rounded) ? "≈" : "="} ${col(q, "pt")}</span></p>`;
    html += `<p>${tr(`In the turned axes, ${mv} is at ${pointText(q[0], q[1])}; in the old ones, at <span class="pt">(${m.x}, ${m.y})</span>.`, `En los ejes girados, ${mv} está en ${pointText(q[0], q[1])}; en los antiguos, en <span class="pt">(${m.x}, ${m.y})</span>.`)}</p>`;
    out.innerHTML = html;
  }
  const clamp = (v) => Math.max(0, Math.min(10, Math.round(v)));
  makeDraggable(hO, {
    move: (sp) => { const q = P.toData(sp); st.o = { x: clamp(q.x), y: clamp(q.y) }; render(); },
    step: ([dx, dy]) => { st.o = { x: clamp(st.o.x + dx), y: clamp(st.o.y + dy) }; render(); },
  });
  // The point on the x′ axis snaps to whole numbers anywhere but on t′ itself; the axes keep their direction when t′ moves.
  const setD = (x, y) => { const d = { x: Math.round(x) - st.o.x, y: Math.round(y) - st.o.y }; if (d.x || d.y) { st.d = d; render(); } };
  makeDraggable(hD, {
    move: (sp) => { const q = P.toData(sp); setD(q.x, q.y); },
    step: ([dx, dy]) => setD(st.o.x + st.d.x + dx, st.o.y + st.d.y + dy),
  });
  makeDraggable(hM, {
    move: (sp) => { const q = P.toData(sp); st.m = { x: clamp(q.x), y: clamp(q.y) }; render(); },
    step: ([dx, dy]) => { st.m = { x: clamp(st.m.x + dx), y: clamp(st.m.y + dy) }; render(); },
  });
  document.getElementById("fig-frames-reset")?.addEventListener("click", () => { st = structuredClone(FRAMES_START); forget(...memos); render(); });
  render();
}

/* ---------- Figure 2: the four kinds. Each kind frees some corners of a square, and H comes from the four pairs ---------- */
function fourKinds() {
  const svg = document.getElementById("fig-kinds");
  const out = document.getElementById("fig-kinds-out");
  const group = document.getElementById("fig-kinds-modes");
  if (!svg || !out || !group) return;
  const P = createPlane(svg);
  // The square before the transformation, its corners numbered m1 top left, m2 bottom left, m3 bottom right, m4 top right.
  const SRC = [[10, 30], [10, 10], [30, 10], [30, 30]];
  const SIDE = 20, TURN = 5;
  const FREE = { euclidean: [0, 3], similarity: [0, 3], affine: [0, 1, 3], projective: [0, 1, 2, 3] };

  // Fills in the corners the kind does not leave free. In the Euclidean kind, m′4 is set by the turn θ;
  // in the Euclidean and similarity kinds, m′2 is m′4 turned by −90° around m′1; outside the projective kind,
  // m′3 completes a parallelogram.
  function settle(s) {
    const p = s.pts.map((q) => ({ ...q })), a = p[0];
    if (s.mode === "euclidean") p[3] = { x: a.x + SIDE * Math.cos(rad(s.theta)), y: a.y + SIDE * Math.sin(rad(s.theta)) };
    if (s.mode === "euclidean" || s.mode === "similarity") p[1] = { x: a.x + (p[3].y - a.y), y: a.y - (p[3].x - a.x) };
    if (s.mode !== "projective") p[2] = { x: p[1].x + p[3].x - a.x, y: p[1].y + p[3].y - a.y };
    return { ...s, pts: p };
  }
  const inView = (s) => s.pts.every((q) => q.x > -1e-9 && q.x < P.max + 1e-9 && q.y > -1e-9 && q.y < P.max + 1e-9);
  const roundPt = (q) => ({ x: Math.round(q.x), y: Math.round(q.y) });
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const initial = settle({ mode: "euclidean", theta: -20, pts: [{ x: 12, y: 34 }, {}, {}, {}] });
  let st = structuredClone(initial);

  // Layers, back to front.
  P.el("polygon", { class: "before", points: SRC.map(([x, y]) => `${P.X(x)},${P.Y(y)}`).join(" ") });
  // The image of the square's 4 × 4 grid: lines at u = 0, 1/4, …, 1 in each direction; the outer ones are its sides.
  const grid = [0, 1, 2, 3, 4].flatMap((k) => [0, 1].map(() => P.el("line", { class: k % 4 ? "grid-ln" : "ln-path" })));
  const exts = [0, 1, 2, 3].map(() => P.el("line", { class: "ext" }));
  const meets = [0, 1].map(() => P.el("circle", { r: 6, class: "pt-dot" }));
  const rings = [0, 1, 2, 3].map(() => P.el("circle", { r: 7, class: "pt-ring" }));
  const labs = [0, 1, 2, 3].map((i) => P.label("pt-lab", "m′", String(i + 1)));
  const hs = [0, 1, 2, 3].map(() => P.handle("point"));
  const memos = [{}, {}, {}, {}];
  const drawSeg = (line, a, b) => { line.setAttribute("x1", P.X(a[0])); line.setAttribute("y1", P.Y(a[1])); line.setAttribute("x2", P.X(b[0])); line.setAttribute("y2", P.Y(b[1])); };

  function render() {
    const { mode, pts } = st, free = FREE[mode];
    const cx = pts.reduce((s, q) => s + q.x, 0) / 4, cy = pts.reduce((s, q) => s + q.y, 0) / 4;
    pts.forEach((q, i) => {
      const isFree = free.includes(i);
      hs[i].style.display = isFree ? "" : "none";
      P.place(hs[i], q);
      rings[i].setAttribute("cx", P.X(q.x)); rings[i].setAttribute("cy", P.Y(q.y));
      show(rings[i], !isFree);
      P.placeAlong(labs[i], q, [q.x - cx, q.y - cy], 3.2, memos[i]);
      hs[i].setAttribute("aria-label", mode === "euclidean" && i === 3
        ? tr(`Corner m′4, with the square turned by ${fmt(st.theta)} degrees around m′1. Use the arrow keys to turn it.`, `Esquina m′4, con el cuadrado girado ${fmt(st.theta)} grados en torno a m′1. Usa las flechas del teclado para girarlo.`)
        : tr(`Corner m′${i + 1} at (${fmt(q.x)}, ${fmt(q.y)}). Use the arrow keys to move it.`, `Esquina m′${i + 1} en (${fmt(q.x)}, ${fmt(q.y)}). Usa las flechas del teclado para moverla.`));
    });
    const hide = () => show([...grid, ...exts, ...meets], false);
    const fail = (msg) => { hide(); out.innerHTML = `<p class="muted">${msg}</p>`; };

    // Degenerate corners: two in one place, or three on one line.
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) > 1e-9) continue;
      return fail(mode === "similarity"
        ? tr(`${mp(1)} and ${mp(4)} are in the same place, so the square has shrunk to a point. Move them apart.`, `${mp(1)} y ${mp(4)} están en el mismo lugar, así que el cuadrado se redujo a un punto. Sepáralas.`)
        : tr(`${mp(i + 1)} and ${mp(j + 1)} are in the same place, so the corners fix no single transformation. Move them apart.`, `${mp(i + 1)} y ${mp(j + 1)} están en el mismo lugar, así que las esquinas no determinan una única transformación. Sepáralas.`));
    }
    for (const [i, j, k] of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) {
      const [a, b, c] = [pts[i], pts[j], pts[k]];
      if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 1e-9) continue;
      return fail(tr(`${mp(i + 1)}, ${mp(j + 1)} and ${mp(k + 1)} lie on one line, and no homography flattens three corners of a square onto a line. Move one of them off it.`, `${mp(i + 1)}, ${mp(j + 1)} y ${mp(k + 1)} están sobre una recta, y ninguna homografía aplana tres esquinas de un cuadrado sobre una recta. Saca una de ellas.`));
    }
    const fit = homography(SRC.map((s, i) => [s, [pts[i].x, pts[i].y]]));
    if (!fit) return fail(tr("The transformation that fits these corners has <i>h</i><sub>33</sub> = 0, so it cannot be scaled to make <i>h</i><sub>33</sub> = 1. Move a corner by one step.", "La transformación que se ajusta a estas esquinas tiene <i>h</i><sub>33</sub> = 0, así que no se puede escalar para que <i>h</i><sub>33</sub> = 1. Mueve una esquina un paso."));
    // Entries that are zero up to rounding error (such as the bottom row of a turn) are set to 0.
    const big = Math.max(...fit.flat().map(Math.abs));
    const H = fit.map((r) => r.map((v) => (Math.abs(v) < 1e-12 * big ? 0 : v)));
    let html = `<p class="eq"><span class="nowrap"><i>H</i> ${H.flat().some(rounded) ? "≈" : "="} ${mat(H, "", (v) => fmtSig(v))}</span></p>`;

    // If the third component of Hm changes sign across the square, part of it goes through r = 0.
    const rs = SRC.map(([x, y]) => apply(H, [x, y, 1])[2]);
    if (rs.some((r) => r > 0) && rs.some((r) => r < 0)) {
      hide();
      out.innerHTML = html + `<p class="muted">${tr("The corners make a crossed or dented shape, which no photo of a square shows: part of the square would be sent to infinity. Move a corner back.", "Las esquinas forman una figura cruzada o cóncava, que ninguna foto de un cuadrado muestra: parte del cuadrado se iría al infinito. Devuelve una esquina.")}</p>`;
      return;
    }
    // The image of the grid: map the ends of each grid line and join them, since H keeps lines.
    const map = (x, y) => { const v = apply(H, [x, y, 1]); return [v[0] / v[2], v[1] / v[2]]; };
    for (let k = 0; k <= 4; k++) {
      const u = 10 + 5 * k;
      drawSeg(grid[2 * k], map(u, 10), map(u, 30));
      drawSeg(grid[2 * k + 1], map(10, u), map(30, u));
    }
    show(grid, true);
    // Where opposite sides meet, the cross product of the two lines, drawn when inside the plot.
    const hv = (q) => [q.x, q.y, 1];
    let meetInside = false, meetBeyond = false;
    [[[0, 3], [1, 2]], [[0, 1], [3, 2]]].forEach(([[a, b], [c, d]], k) => {
      const m = cross(cross(hv(pts[a]), hv(pts[b])), cross(hv(pts[c]), hv(pts[d])));
      const at = Math.abs(m[2]) > 1e-9 * Math.hypot(m[0], m[1]) ? [m[0] / m[2], m[1] / m[2]] : null;
      const inside = at && at[0] >= 0 && at[0] <= P.max && at[1] >= 0 && at[1] <= P.max;
      show([meets[k], exts[2 * k], exts[2 * k + 1]], !!inside);
      if (at && !inside) meetBeyond = true;
      if (!inside) return;
      meetInside = true;
      meets[k].setAttribute("cx", P.X(at[0])); meets[k].setAttribute("cy", P.Y(at[1]));
      // Each side is extended from its end nearer the meeting point.
      [[a, b], [c, d]].forEach(([i, j], n) => {
        const near = Math.hypot(pts[i].x - at[0], pts[i].y - at[1]) < Math.hypot(pts[j].x - at[0], pts[j].y - at[1]) ? pts[i] : pts[j];
        drawSeg(exts[2 * k + n], [near.x, near.y], at);
      });
    });

    // One sentence: what this kind keeps, with the numbers that show it.
    const top = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
    const v4 = [pts[3].x - pts[0].x, pts[3].y - pts[0].y], v2 = [pts[1].x - pts[0].x, pts[1].y - pts[0].y];
    const corner = deg(Math.acos(Math.max(-1, Math.min(1, (v4[0] * v2[0] + v4[1] * v2[1]) / (Math.hypot(...v4) * Math.hypot(...v2))))));
    const ok = '<span class="ok">✓</span>';
    if (mode === "euclidean") html += `<p>${tr(`A turn by ${fmt(st.theta)}° and a shift. It keeps lengths ${ok}: the top side is still 20.`, `Un giro de ${fmt(st.theta)}° y una traslación. Conserva las longitudes ${ok}: el lado de arriba sigue midiendo 20.`)}</p>`;
    else if (mode === "similarity") html += `<p>${tr(`A turn, a scale <i>s</i> ${approx(top / SIDE)} and a shift. Lengths change (the top side is now ${fmt(top)}), but it keeps angles ${ok}: the corner at ${mp(1)} is still 90°.`, `Un giro, una escala <i>s</i> ${approx(top / SIDE)} y una traslación. Las longitudes cambian (el lado de arriba ahora mide ${fmt(top)}), pero conserva los ángulos ${ok}: la esquina en ${mp(1)} sigue midiendo 90°.`)}</p>`;
    else if (mode === "affine") html += `<p>${tr(`Angles change (the corner at ${mp(1)} is now ${fmt(corner)}°), but it keeps parallel lines ${ok}: opposite sides stay parallel.`, `Los ángulos cambian (la esquina en ${mp(1)} ahora mide ${fmt(corner)}°), pero conserva las rectas paralelas ${ok}: los lados opuestos siguen paralelos.`)}</p>`;
    else {
      // The cross ratio of the grid points at 0, 1/4, 1/2 and 1 along the top side, which is 1.5 before the transformation.
      const after = crossRatio(map(10, 30), map(15, 30), map(20, 30), map(30, 30));
      const meet = meetInside
        ? tr("Parallel sides can now meet, at the red dots.", "Los lados paralelos ahora pueden cortarse, en los puntos rojos.")
        : meetBeyond
          ? tr("Parallel sides can now meet, here beyond the plot.", "Los lados paralelos ahora pueden cortarse, aquí fuera del gráfico.")
          : tr("Here the sides happen to stay parallel, but they need not: drag a corner.", "Aquí los lados siguen paralelos por casualidad, pero no tienen por qué: arrastra una esquina.");
      html += `<p>${meet} ${tr(`It still keeps straight lines ${ok}, and the cross ratio of four points on a line ${ok}: along the top side it is ${fmt(after)}, as before.`, `Igual conserva las rectas ${ok} y la razón de cruz de cuatro puntos sobre una recta ${ok}: a lo largo del lado de arriba vale ${fmt(after)}, como antes.`)}</p>`;
    }
    out.innerHTML = html;
  }

  // Accepts a change only if every corner stays on the plane.
  function tryState(next) {
    const s = settle(next);
    if (!inView(s)) return;
    st = s;
    render();
  }
  function moveCorner(i, q) {
    const pts = st.pts.map((p) => ({ ...p }));
    pts[i] = { x: Math.max(0, Math.min(P.max, Math.round(q.x))), y: Math.max(0, Math.min(P.max, Math.round(q.y))) };
    tryState({ ...st, pts });
  }
  hs.forEach((h, i) => makeDraggable(h, {
    move: (s) => {
      const q = P.toData(s);
      if (st.mode === "euclidean" && i === 3) {
        const a = st.pts[0];
        tryState({ ...st, theta: wrap(Math.round(deg(Math.atan2(q.y - a.y, q.x - a.x)) / TURN) * TURN) });
      } else moveCorner(i, q);
    },
    // In the Euclidean kind, m′4 turns: left and up turn counterclockwise, right and down clockwise.
    step: ([dx, dy]) => {
      if (st.mode === "euclidean" && i === 3) tryState({ ...st, theta: wrap(st.theta + TURN * (dx ? -dx : dy)) });
      else moveCorner(i, { x: st.pts[i].x + dx, y: st.pts[i].y + dy });
    },
  }));
  // Switching kind keeps the corners the new kind leaves free and recomputes the rest. If that would push
  // a corner off the plane, the kind starts from the initial square instead.
  function setMode(mode) {
    const s = { ...st, mode, pts: st.pts.map((q) => ({ ...q })) };
    if (mode === "euclidean") {
      const [a, b] = [s.pts[0], s.pts[3]];
      s.theta = wrap(Math.round(deg(Math.atan2(b.y - a.y, b.x - a.x)) / TURN) * TURN);
    } else s.pts = s.pts.map(roundPt);
    let next = settle(s);
    if (!inView(next)) next = settle({ mode, theta: initial.theta, pts: mode === "euclidean" ? initial.pts : initial.pts.map(roundPt) });
    st = next;
    render();
  }
  const press = modeButtons(group, setMode);
  document.getElementById("fig-kinds-reset")?.addEventListener("click", () => { st = structuredClone(initial); forget(...memos); press(st.mode); render(); });
  render();
}

/* ---------- Figure 3: a photo of a flat surface. A 3D view of the camera and the surface, and the photo ---------- */
function photo() {
  const svg3 = document.getElementById("fig-photo");
  const svgP = document.getElementById("fig-photo-image");
  const out = document.getElementById("fig-photo-out");
  if (!svg3 || !svgP || !out) return;
  const { f1, f2, half } = PHOTO;
  let phi = PHOTO.phi;
  // A true view, with no stretch, so the tilt looks as it is. Space draws camera coordinates as [Z, −X, −Y]: a turn.
  const VIEW = [-40, 16];
  const S = createSpace(svg3, { height: 320, scale: 70, pivot: [2, 0, 0], at: [238, 160], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-120, 10], pitchRange: [5, 70] });
  const cam = (X, Y, Z) => [Z, -X, -Y];
  const surf = (u, v, p = phi) => cam(u, v * Math.cos(rad(p)), f2 - v * Math.sin(rad(p)));
  const below = S.el("g"), mid = S.el("g"), top = S.el("g"), labels = S.el("g"), handles = S.el("g");
  S.line(S.el("g", { class: "axes" }, below), [0, 0, 0], [f2 + 1.6, 0, 0], "axis3");
  S.dot(below, [0, 0, 0], 3.5, "origin");
  S.pin(mathLabel(labels, "axl", [["C", true]]), [0, 0, 0], [-1, 0.6], 14);
  // The image plane, a 1.8 × 1.8 frame at Z = f1.
  const IM = 0.9;
  S.poly(mid, [cam(-IM, -IM, f1), cam(IM, -IM, f1), cam(IM, IM, f1), cam(-IM, IM, f1)], "panel clear");
  const labF1 = S.pin(mathLabel(labels, "plane-lab", [["f", true], ["1", false, "sub"]]), cam(0, IM, f1), [0, 1], 16);
  // The surface with its tiles; rays from C to its corners; the outline of its image on the image plane.
  const surfPanel = S.el("polygon", { class: "panel clear" }, top);
  const surfLines = Array.from({ length: 8 }, (_, k) => S.el("line", { class: k % 4 === 0 || k % 4 === 3 ? "ln-path" : "grid-ln" }, top));
  const rays = [0, 1, 2, 3].map(() => S.el("line", { class: "ray thin" }, mid));
  const imgOutline = S.el("polygon", { class: "edge thin", fill: "none" }, mid);
  const labF2 = mathLabel(labels, "plane-lab", [["f", true], ["2", false, "sub"]]);
  const hT = makeHandle(handles, "grip");
  const TICKS = [-half, -half / 3, half / 3, half];
  const sideF2 = {};

  // The photo: the image plane seen flat, at 90 units per unit, with room above for the vanishing point.
  const PS = 90, PX = 230, PY = 196;
  svgP.setAttribute("viewBox", "0 0 460 318");
  const X = (x) => PX + PS * x, Y = (y) => PY + PS * y;
  el("rect", { x: X(-IM), y: Y(-IM), width: 2 * IM * PS, height: 2 * IM * PS, class: "px-frame" }, svgP);
  el("text", { x: X(-IM), y: Y(IM) + 22, class: "panel-lab" }, svgP).textContent = tr("The photo", "La foto");
  const pLines = Array.from({ length: 8 }, (_, k) => el("line", { class: k % 4 === 0 || k % 4 === 3 ? "ln-path" : "grid-ln" }, svgP));
  const pExts = [0, 1, 2, 3].map(() => el("line", { class: "ext" }, svgP));
  const vp = el("circle", { r: 6, class: "pt-dot" }, svgP);

  function render() {
    const H = photoH(phi);
    const corners = [surf(-half, -half), surf(half, -half), surf(half, half), surf(-half, half)];
    S.setPoly(surfPanel, corners);
    // Lines of constant u (running along v, away from the camera when tilted) and of constant v, on the surface.
    TICKS.forEach((t, k) => {
      S.setLine(surfLines[k], surf(t, -half), surf(t, half));
      S.setLine(surfLines[4 + k], surf(-half, t), surf(half, t));
    });
    corners.forEach((c, k) => S.setLine(rays[k], [0, 0, 0], c));
    const toPhoto = (u, v) => { const w = apply(H, [u, v, 1]); return [w[0] / w[2], w[1] / w[2]]; };
    const imgCorners = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([u, v]) => toPhoto(u, v));
    S.setPoly(imgOutline, imgCorners.map(([x, y]) => cam(x, y, f1)));
    TICKS.forEach((t, k) => {
      for (const [line, p, q] of [[pLines[k], toPhoto(t, -half), toPhoto(t, half)], [pLines[4 + k], toPhoto(-half, t), toPhoto(half, t)]]) {
        line.setAttribute("x1", X(p[0])); line.setAttribute("y1", Y(p[1])); line.setAttribute("x2", X(q[0])); line.setAttribute("y2", Y(q[1]));
      }
    });
    // The vanishing point of the lines along v is the image of their point at infinity, H[0 1 0]ᵀ.
    const w = apply(H, [0, 1, 0]);
    const at = Math.abs(w[2]) > 1e-9 ? [w[0] / w[2], w[1] / w[2]] : null;
    const inside = !!at && Y(at[1]) > 8;
    show([vp, ...pExts], inside);
    if (inside) {
      vp.setAttribute("cx", X(at[0])); vp.setAttribute("cy", Y(at[1]));
      TICKS.forEach((t, k) => { const a = toPhoto(t, -half); pExts[k].setAttribute("x1", X(a[0])); pExts[k].setAttribute("y1", Y(a[1])); pExts[k].setAttribute("x2", X(at[0])); pExts[k].setAttribute("y2", Y(at[1])); });
    }
    S.place(hT, surf(0, -half));
    placeBeside(S, labF2, surf(half, half), 10, S.offset([0, 0, 1]), [labF1.getBBox()], sideF2);
    hT.setAttribute("aria-label", tr(`Top edge of the surface, tilted by ${phi} degrees. Use the arrow keys to tilt it.`, `Borde de arriba de la superficie, inclinada ${phi} grados. Usa las flechas del teclado para inclinarla.`));

    let html = `<p class="eq"><span class="nowrap"><i>H</i> ${H.flat().some(rounded) ? "≈" : "="} ${mat(H)}</span></p>`;
    html += phi === 0
      ? `<p>${tr("Facing the camera, the surface comes out as a copy scaled by <i>f</i><sub>1</sub>/<i>f</i><sub>2</sub> = 1/3: <i>H</i> is a similarity, and parallel edges stay parallel.", "De frente a la cámara, la superficie sale como una copia escalada por <i>f</i><sub>1</sub>/<i>f</i><sub>2</sub> = 1/3: <i>H</i> es una similitud, y los bordes paralelos siguen paralelos.")}</p>`
      : `<p>${tr(`Tilted by ${phi}°, <i>H</i> gains a bottom row. The edges that run away from the camera meet at the vanishing point <span class="nowrap"><i>H</i>[0&ensp;1&ensp;0]<sup class="t">T</sup></span> ${pointText(at[0], at[1])}${inside ? "" : ", above the drawing"}, while the edges across stay parallel.`, `Inclinada ${phi}°, <i>H</i> gana una fila de abajo. Los bordes que se alejan de la cámara se cortan en el punto de fuga <span class="nowrap"><i>H</i>[0&ensp;1&ensp;0]<sup class="t">T</sup></span> ${pointText(at[0], at[1])}${inside ? "" : ", arriba del dibujo"}, mientras los bordes transversales siguen paralelos.`)}</p>`;
    out.innerHTML = html;
  }
  // The tilt goes from 0° to 60° in steps of 5°; a drag takes the tilt whose top edge is drawn nearest the pointer.
  const PHIS = Array.from({ length: 13 }, (_, k) => 5 * k);
  makeDraggable(hT, {
    move: (sp) => {
      const d = (p) => { const [x, y] = S.project(surf(0, -half, p)); return Math.hypot(x - sp.x, y - sp.y); };
      phi = PHIS.reduce((best, p) => (d(p) < d(best) ? p : best), phi);
      render();
    },
    step: ([dx, dy]) => { phi = Math.max(0, Math.min(60, phi + 5 * (dy || dx))); render(); },
  });
  S.turnable(render);
  document.getElementById("fig-photo-reset")?.addEventListener("click", () => { phi = PHOTO.phi; forget(sideF2); S.setView(...VIEW); render(); });
  render();
}

/* ---------- Figure 4: estimating H from four pairs, to straighten a photo of a sign ---------- */
// The sign, on [0, 1]²: light, with a dark F; outside it, a mid gray.
function sign(s, t) {
  if (s < 0 || s > 1 || t < 0 || t > 1) return 105;
  const inF = (s >= 0.26 && s <= 0.42 && t >= 0.16 && t <= 0.84) || (t >= 0.16 && t <= 0.31 && s >= 0.26 && s <= 0.76) || (t >= 0.45 && t <= 0.59 && s >= 0.26 && s <= 0.64);
  return inF ? 45 : 225;
}
// The photo, drawn through the hidden homography with 4 × 4 samples per pixel.
export function makePhoto() {
  const { M, OUT, CORNERS } = RECT;
  const Hi = inverse(homography(OUT.map((o, i) => [o, [CORNERS[i].x, CORNERS[i].y]])));
  return Array.from({ length: M }, (_, y) => Array.from({ length: M }, (_, x) => {
    let sum = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const v = apply(Hi, [x - 0.375 + a * 0.25, y - 0.375 + b * 0.25, 1]);
      sum += sign(v[0] / v[2] / 15, v[1] / v[2] / 15);
    }
    return Math.round(sum / 16);
  }));
}
function rectify() {
  const svg = document.getElementById("fig-rectify");
  const out = document.getElementById("fig-rectify-out");
  if (!svg || !out) return;
  const { N, M, CORNERS } = RECT;
  const img = makePhoto();
  let clicks = structuredClone(RECT.CLICKS);
  const PC = 7.4, PX0 = 10, OC = 12.5, OX0 = 246, Y0 = 34;
  svg.setAttribute("viewBox", `0 0 460 ${Y0 + M * PC + 10}`);
  const panelLabel = (x, word) => { el("text", { x, y: Y0 - 12, class: "panel-lab" }, svg).textContent = word; };
  panelLabel(PX0, tr("Photo", "Foto")); panelLabel(OX0, tr("Straightened", "Enderezada"));
  img.forEach((r, y) => r.forEach((v, x) => { el("rect", { x: PX0 + x * PC, y: Y0 + y * PC, width: PC, height: PC, class: "px", style: `fill: ${shade(v)}; stroke: none` }, svg); }));
  el("rect", { x: PX0, y: Y0, width: M * PC, height: M * PC, class: "px-frame" }, svg);
  const cells = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => el("rect", { x: OX0 + x * OC, y: Y0 + y * OC, width: OC, height: OC, class: "px" }, svg)));
  // A straightened pixel that reads outside the photo is crossed out, so it is not taken for a dark or bright one.
  const slashes = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => el("line", { x1: OX0 + x * OC + 3, y1: Y0 + (y + 1) * OC - 3, x2: OX0 + (x + 1) * OC - 3, y2: Y0 + y * OC + 3, class: "px-none" }, svg)));
  el("rect", { x: OX0, y: Y0, width: N * OC, height: N * OC, class: "px-frame" }, svg);
  const quad = el("polygon", { class: "sel" }, svg);
  const labs = [0, 1, 2, 3].map((i) => {
    const t = el("text", { class: "pt-lab lab-sm", "text-anchor": "middle" }, svg);
    el("tspan", { "font-style": "italic" }, t).textContent = "m";
    t.append("′");
    el("tspan", { dy: 5, "font-size": 12 }, t).textContent = String(i + 1);
    return t;
  });
  const hs = [0, 1, 2, 3].map(() => makeHandle(svg, "point"));
  const px = (q) => [PX0 + (q.x + 0.5) * PC, Y0 + (q.y + 0.5) * PC];
  // Top left, bottom left, bottom right, top right, in the order of m′1 to m′4.
  const OUTWARD = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
  // Bilinear sampling of the photo, as in section 5; null outside it.
  const sample = (x, y) => {
    if (x < 0 || y < 0 || x > M - 1 || y > M - 1) return null;
    const j = Math.min(Math.floor(x), M - 2), i = Math.min(Math.floor(y), M - 2), u = x - j, v = y - i;
    return (1 - u) * (1 - v) * img[i][j] + u * (1 - v) * img[i][j + 1] + (1 - u) * v * img[i + 1][j] + u * v * img[i + 1][j + 1];
  };

  function render() {
    // Each click's label sits diagonally outward from its corner of the sign, kept inside the photo. The direction is
    // fixed, so a label never swings around its click when another click comes near.
    clicks.forEach((q, i) => {
      const [x, y] = px(q), [dx, dy] = OUTWARD[i];
      hs[i].setAttribute("transform", `translate(${x},${y})`);
      labs[i].setAttribute("x", Math.max(PX0 + 12, Math.min(PX0 + M * PC - 12, x + dx * 14)));
      labs[i].setAttribute("y", Math.max(Y0 + 14, Math.min(Y0 + M * PC - 4, y + dy * 14 + 5)));
      hs[i].setAttribute("aria-label", tr(`Click m′${i + 1} at pixel (${q.x}, ${q.y}) of the photo. Use the arrow keys to move it.`, `Clic m′${i + 1} en el píxel (${q.x}, ${q.y}) de la foto. Usa las flechas del teclado para moverlo.`));
    });
    quad.setAttribute("points", clicks.map((q) => px(q).join(",")).join(" "));
    const blank = () => cells.forEach((r, y) => r.forEach((cell, x) => { cell.style.fill = "none"; slashes[y][x].setAttribute("visibility", "visible"); }));
    // Three clicks on one line (or two on one pixel) give no H, or a singular one that flattens the square onto a line.
    const H = rectifyH(clicks);
    if (!H || !inverse(H)) {
      blank();
      out.innerHTML = `<p class="muted">${tr("Three clicks lie on one line, or two sit on one pixel, so no <i>H</i> sends the square onto them. Move one away.", "Tres clics están sobre una recta, o dos en un mismo píxel, así que ninguna <i>H</i> lleva el cuadrado a ellos. Mueve uno.")}</p>`;
      return;
    }
    // Crossed or dented clicks: the third component of Hm changes sign across the square, so part of it goes to infinity.
    const rs = RECT.OUT.map(([x, y]) => apply(H, [x, y, 1])[2]);
    if (rs.some((r) => r > 0) && rs.some((r) => r < 0)) {
      blank();
      out.innerHTML = `<p class="muted">${tr("The clicks make a crossed or dented shape, which no photo of a sign shows. Move one back.", "Los clics forman una figura cruzada o cóncava, que ninguna foto de un letrero muestra. Devuelve uno.")}</p>`;
      return;
    }
    // Each straightened pixel reads the photo at Hm, backward as in section 5.
    cells.forEach((r, y) => r.forEach((cell, x) => {
      const w = apply(H, [x, y, 1]);
      const v = w[2] > 0 ? sample(w[0] / w[2], w[1] / w[2]) : null;
      cell.style.fill = v === null ? "none" : shade(v);
      slashes[y][x].setAttribute("visibility", v === null ? "visible" : "hidden");
    }));
    const off = clicks.map((q, i) => q.x !== CORNERS[i].x || q.y !== CORNERS[i].y);
    const offNames = off.map((o, i) => (o ? mp(i + 1) : "")).filter(Boolean);
    const list = offNames.length > 1 ? `${offNames.slice(0, -1).join(", ")} ${tr("and", "y")} ${offNames.at(-1)}` : offNames[0];
    const eqs = `<span class="nowrap"><i>h</i> = <i>A</i><sup class="t">−1</sup><i>b</i></span>`;
    let html = `<p class="eq"><span class="nowrap"><i>H</i> ≈ ${mat(H, "", (v) => fmtSig(v))}</span></p>`;
    html += offNames.length
      ? `<p>${tr(`Four pairs give the eight equations of ${eqs}. ${list} ${offNames.length > 1 ? "are" : "is"} off the sign's corner${offNames.length > 1 ? "s" : ""}, so the straightened sign comes out skewed.`, `Cuatro pares dan las ocho ecuaciones de ${eqs}. ${list} ${offNames.length > 1 ? "están" : "está"} fuera de la esquina del letrero, así que el letrero enderezado sale torcido.`)}</p>`
      : `<p>${tr(`Four pairs give the eight equations of ${eqs}. The clicks sit on the sign's corners, so the straightened sign comes out square <span class="ok">✓</span>.`, `Cuatro pares dan las ocho ecuaciones de ${eqs}. Los clics están en las esquinas del letrero, así que el letrero enderezado sale cuadrado <span class="ok">✓</span>.`)}</p>`;
    out.innerHTML = html;
  }
  const clampPx = (v) => Math.max(0, Math.min(M - 1, v));
  hs.forEach((h, i) => makeDraggable(h, {
    move: (sp) => { clicks[i] = { x: clampPx(Math.round((sp.x - PX0) / PC - 0.5)), y: clampPx(Math.round((sp.y - Y0) / PC - 0.5)) }; render(); },
    // Rows count downward, so the up arrow moves to the row above.
    step: ([dx, dy]) => { clicks[i] = { x: clampPx(clicks[i].x + dx), y: clampPx(clicks[i].y - dy) }; render(); },
  }));
  document.getElementById("fig-rectify-reset")?.addEventListener("click", () => { clicks = structuredClone(RECT.CLICKS); render(); });
  render();
}

/* ---------- Figure 5: warping. Forward leaves holes; backward, each output pixel reads the source at Hm ---------- */
function warping() {
  const svg = document.getElementById("fig-warp");
  const out = document.getElementById("fig-warp-out");
  const group = document.getElementById("fig-warp-modes");
  if (!svg || !out || !group) return;
  const { N1, N2 } = WARP, H = warpH();
  const { landed, lands, covered, holes } = forwardWarp();
  const C1 = 24, C2 = 16.5, X1 = 10, X2 = 250, Y0 = 34;
  svg.setAttribute("viewBox", `0 0 460 ${Y0 + N2 * C2 + 8}`);
  const panelLabel = (x, word, name) => { const t = el("text", { x, y: Y0 - 12, class: "panel-lab" }, svg); t.append(`${word} `); el("tspan", { class: "m" }, t).textContent = name; };
  panelLabel(X1, tr("Source", "Original"), "I′");
  panelLabel(X2, tr("Output", "Resultado"), "I");
  SOURCE.forEach((r, i) => r.forEach((v, j) => { el("rect", { x: X1 + j * C1, y: Y0 + i * C1, width: C1, height: C1, class: "px", style: `fill: ${shade(v)}` }, svg); }));
  const cells = Array.from({ length: N2 }, (_, i) => Array.from({ length: N2 }, (_, j) => el("rect", { x: X2 + j * C2, y: Y0 + i * C2, width: C2, height: C2, class: "px" }, svg)));
  // An output pixel with no value is crossed out, so it is not taken for a very bright or very dark one.
  const slashes = Array.from({ length: N2 }, (_, i) => Array.from({ length: N2 }, (_, j) => el("line", { x1: X2 + j * C2 + 3.5, y1: Y0 + (i + 1) * C2 - 3.5, x2: X2 + (j + 1) * C2 - 3.5, y2: Y0 + i * C2 + 3.5, class: "px-none" }, svg)));
  el("rect", { x: X1, y: Y0, width: N1 * C1, height: N1 * C1, class: "px-frame" }, svg);
  el("rect", { x: X2, y: Y0, width: N2 * C2, height: N2 * C2, class: "px-frame" }, svg);
  // Backward, a dot on the source where each output pixel reads it; forward, a dot on the output where each source pixel lands.
  const back = Array.from({ length: N2 * N2 }, () => el("circle", { r: 1.9, class: "pt-dot" }, svg));
  const fwd = Array.from({ length: N1 * N1 }, () => el("circle", { r: 1.9, class: "pt-dot" }, svg));
  const block = el("rect", { class: "px-pick" }, svg);
  const pick = el("rect", { width: C2, height: C2, class: "px-pick" }, svg);
  const dotM = el("circle", { r: 5, class: "pt-dot" }, svg);
  const h = makeHandle(svg, "point", 11);
  const toSrc = (x, y) => { const w = apply(H, [x, y, 1]); return [w[0] / w[2], w[1] / w[2]]; };
  const inSrc = (x, y) => x > -1e-9 && x < N1 - 1 + 1e-9 && y > -1e-9 && y < N1 - 1 + 1e-9;
  const around = (x, y) => { const j = Math.min(Math.floor(x + 1e-9), N1 - 2), i = Math.min(Math.floor(y + 1e-9), N1 - 2); return { i, j, u: Math.max(0, x - j), v: Math.max(0, y - i) }; };
  function sample(x, y, mode) {
    if (!inSrc(x, y)) return null;
    if (mode === "nearest") return SOURCE[Math.round(y)][Math.round(x)];
    const { i, j, u, v } = around(x, y);
    return u * v * SOURCE[i + 1][j + 1] + (1 - u) * v * SOURCE[i + 1][j] + u * (1 - v) * SOURCE[i][j + 1] + (1 - u) * (1 - v) * SOURCE[i][j];
  }
  const initial = { j: 7, i: 5, mode: "forward" };
  let st = { ...initial };

  // A close-up of the square between the four pixel centers, split at m′ into the rectangles A, B, C and D.
  function inset(u, v, vals) {
    const S = 120, L = 55, TOP = 34, x = L + u * S, y = TOP + v * S;
    const corners = [[L, TOP, -1], [L + S, TOP, -1], [L, TOP + S, 1], [L + S, TOP + S, 1]];
    let s = `<svg class="inset" viewBox="0 0 230 196" role="img" aria-label="${tr("The four source pixels around m′ and the rectangles A, B, C and D between them", "Los cuatro píxeles de la imagen original alrededor de m′ y los rectángulos A, B, C y D entre ellos")}">`;
    s += `<rect class="sq" x="${L}" y="${TOP}" width="${S}" height="${S}"/>`;
    s += `<line class="cut" x1="${x}" y1="${TOP}" x2="${x}" y2="${TOP + S}"/><line class="cut" x1="${L}" y1="${y}" x2="${L + S}" y2="${y}"/>`;
    for (const [name, x1, y1, x2, y2] of [["A", L, TOP, x, y], ["B", x, TOP, L + S, y], ["C", L, y, x, TOP + S], ["D", x, y, L + S, TOP + S]]) {
      if (Math.min(x2 - x1, y2 - y1) < 18) continue;
      s += `<text class="area" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + 6}" text-anchor="middle">${name}</text>`;
    }
    corners.forEach(([cx, cy, side], k) => {
      s += `<rect x="${cx - 7}" y="${cy - 7}" width="14" height="14" class="px" style="fill: ${shade(vals[k])}"/>`;
      s += `<text class="val" x="${cx}" y="${cy + side * 17 + (side > 0 ? 9 : 0)}" text-anchor="middle"><tspan font-style="italic">I</tspan>′<tspan dy="4" font-size="11">${k + 1}</tspan><tspan dy="-4"> = ${vals[k]}</tspan></text>`;
    });
    return s + `<circle class="pt-dot" cx="${x}" cy="${y}" r="5"/></svg>`;
  }
  const at1 = (x, y) => [X1 + (x + 0.5) * C1, Y0 + (y + 0.5) * C1], at2 = (x, y) => [X2 + (x + 0.5) * C2, Y0 + (y + 0.5) * C2];

  function render() {
    const { j, i, mode } = st, forward = mode === "forward";
    cells.forEach((r, a) => r.forEach((c, b) => {
      const v = forward ? landed[a][b] : sample(...toSrc(b, a), mode);
      c.style.fill = v === null ? "none" : shade(v);
      slashes[a][b].setAttribute("visibility", v === null ? "visible" : "hidden");
    }));
    back.forEach((d, k) => {
      const [x, y] = toSrc(k % N2, Math.floor(k / N2)), on = !forward && x > -0.5 && x < N1 - 0.5 && y > -0.5 && y < N1 - 0.5;
      show(d, on);
      if (on) { const [cx, cy] = at1(x, y); d.setAttribute("cx", cx); d.setAttribute("cy", cy); }
    });
    fwd.forEach((d, k) => {
      const [x, y] = lands[k], on = forward && x > -0.5 && x < N2 - 0.5 && y > -0.5 && y < N2 - 0.5;
      show(d, on);
      if (on) { const [cx, cy] = at2(x, y); d.setAttribute("cx", cx); d.setAttribute("cy", cy); }
    });
    pick.setAttribute("x", X2 + j * C2); pick.setAttribute("y", Y0 + i * C2);
    h.setAttribute("transform", `translate(${X2 + (j + 0.5) * C2},${Y0 + (i + 0.5) * C2})`);
    h.setAttribute("aria-label", tr(`Output pixel at column ${j}, row ${i}. Use the arrow keys to move it.`, `Píxel del resultado en la columna ${j}, fila ${i}. Usa las flechas del teclado para moverlo.`));
    const [x, y] = toSrc(j, i), ok = inSrc(x, y);
    show([block, dotM], !forward && ok);

    if (forward) {
      const here = landed[i][j] !== null;
      out.innerHTML = `<p>${tr(`Sent forward, the source pixels land at the dots and fill ${covered - holes} of the ${covered} output pixels the enlarged image covers. The other ${holes} get nothing: holes, crossed out. The pixel in column ${j}, row ${i} ${here ? "got a value" : "is a hole"}.`, `Enviados hacia adelante, los píxeles del original caen en los puntos y llenan ${covered - holes} de los ${covered} píxeles del resultado que cubre la imagen agrandada. Los otros ${holes} no reciben nada: agujeros, tachados. El píxel de la columna ${j}, fila ${i} ${here ? "recibió un valor" : "es un agujero"}.`)}</p>`;
      return;
    }
    const where = pointText(x, y), eq = where.startsWith("≈") ? "" : "= ";
    if (!ok) {
      out.innerHTML = `<p>${tr(`The pixel in column ${j}, row ${i} reads the source at <span class="nowrap">${mp()} = <i>H</i>${mv}</span> ${eq}${where}, outside it, so it stays empty.`, `El píxel de la columna ${j}, fila ${i} lee la imagen original en <span class="nowrap">${mp()} = <i>H</i>${mv}</span> ${eq}${where}, fuera de ella, así que queda vacío.`)}</p>`;
      return;
    }
    const [cx, cy] = at1(x, y);
    dotM.setAttribute("cx", cx); dotM.setAttribute("cy", cy);
    const I = (k) => `<i>I</i>′<sub>${k}</sub>`;
    let html = `<p>${tr(`The pixel in column ${j}, row ${i} reads the source at <span class="nowrap">${mp()} = <i>H</i>${mv}</span> ${eq}${where}, the large dot.`, `El píxel de la columna ${j}, fila ${i} lee la imagen original en <span class="nowrap">${mp()} = <i>H</i>${mv}</span> ${eq}${where}, el punto grande.`)}</p>`;
    const a = around(x, y), vals = [SOURCE[a.i][a.j], SOURCE[a.i][a.j + 1], SOURCE[a.i + 1][a.j], SOURCE[a.i + 1][a.j + 1]];
    if (mode === "nearest") {
      const ni = Math.round(y), nj = Math.round(x), k = (ni - a.i) * 2 + (nj - a.j);
      block.setAttribute("x", X1 + nj * C1); block.setAttribute("y", Y0 + ni * C1); block.setAttribute("width", C1); block.setAttribute("height", C1);
      html += `<p class="eq"><i>I</i> = ${I(k + 1)} = ${vals[k]}</p>`;
    } else {
      block.setAttribute("x", X1 + a.j * C1); block.setAttribute("y", Y0 + a.i * C1); block.setAttribute("width", 2 * C1); block.setAttribute("height", 2 * C1);
      const { u, v } = a, w = [u * v, (1 - u) * v, u * (1 - v), (1 - u) * (1 - v)];
      html += inset(u, v, vals);
      html += `<p class="eq"><span class="nowrap"><i>I</i> = <i>A</i>&thinsp;${I(4)} + <i>B</i>&thinsp;${I(3)} + <i>C</i>&thinsp;${I(2)} + <i>D</i>&thinsp;${I(1)}</span> <span class="nowrap">${w.some(rounded) ? "≈" : "="} ${fmt(w[0])}·${vals[3]} + ${fmt(w[1])}·${vals[2]}</span> <span class="nowrap">+ ${fmt(w[2])}·${vals[1]} + ${fmt(w[3])}·${vals[0]}</span> <span class="nowrap">${approx(sample(x, y, "bilinear"))}</span></p>`;
    }
    out.innerHTML = html;
  }

  makeDraggable(h, {
    move: (s) => { st.j = Math.max(0, Math.min(N2 - 1, Math.floor((s.x - X2) / C2))); st.i = Math.max(0, Math.min(N2 - 1, Math.floor((s.y - Y0) / C2))); render(); },
    // Rows count downward, so the up arrow moves to the row above.
    step: ([dx, dy]) => { st.j = Math.max(0, Math.min(N2 - 1, st.j + dx)); st.i = Math.max(0, Math.min(N2 - 1, st.i - dy)); render(); },
  });
  const press = modeButtons(group, (mode) => { st.mode = mode; render(); });
  document.getElementById("fig-warp-reset")?.addEventListener("click", () => { st = { ...initial }; press(st.mode); render(); });
  render();
}

frames();
fourKinds();
photo();
rectify();
warping();
