// Shared toolkit for the interactive figures in the notes.
// createPlane maps 2D data coordinates in [0, max] x [0, max] to an SVG viewBox, with the y axis pointing up.
// createSpace draws 3D vectors with a parallel (oblique) projection.
// The matrix helpers apply, invert and estimate 3×3 transformations, such as a homography from point pairs,
// build 3D rotations from three angles, relate two views of a scene through their fundamental matrix, and find a
// point of space from its images in several views.
// Colors come from CSS classes (see notes.css).

const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/* ---------- Language ---------- */

// Every note has an English and a Spanish page that load the same script. tr(en, es) gives the text for the
// page's language, so each readout keeps both versions side by side: tr("Cross product", "Producto cruz").
export const lang = document.documentElement.lang === "es" ? "es" : "en";
export const tr = (en, es) => (lang === "es" ? es : en);

/* ---------- Homogeneous-coordinate helpers ---------- */

export const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
export const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

// Divides an integer vector by the gcd of its entries, making the first nonzero entry positive.
export function simplify(l) {
  const g = gcd(gcd(l[0], l[1]), l[2]);
  if (g === 0) return { v: l.slice(), d: 1 };
  const first = l.find((x) => x !== 0);
  const d = first < 0 ? -g : g;
  return { v: l.map((x) => (x / d === 0 ? 0 : x / d)), d };
}

/* ---------- Matrices ---------- */

// Matrices are arrays of rows. apply(H, v) is the product Hv of a matrix and a vector of matching length,
// such as a 3×3 homography and a 3-vector, or a 3×4 projection and a 4-vector.
export const apply = (H, v) => H.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
export const matMul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));

// The inverse of a 3×3 matrix: its columns are cross products of the rows, divided by the determinant. Null when singular.
export function inverse(A) {
  const cols = [cross(A[1], A[2]), cross(A[2], A[0]), cross(A[0], A[1])];
  const det = dot(A[0], cols[0]);
  if (Math.abs(det) <= 1e-12 * A.reduce((p, r) => p * Math.hypot(...r), 1)) return null;
  return transpose(cols).map((r) => r.map((x) => x / det));
}

// Solves the square system Ax = b by Gaussian elimination with partial pivoting. Null when A is singular.
export function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  const tol = 1e-12 * Math.max(...A.flat().map(Math.abs));
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) <= tol) return null;
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// The homography H, scaled so that h33 = 1, with λm′ = Hm for every pair [m, m′] of Cartesian points [x, y].
// Each pair gives two rows of Ah = b; four pairs are solved exactly, more by least squares, (AᵀA)h = Aᵀb.
// Null when the pairs do not fix one H with h33 = 1 (three of the m on one line, or an H whose h33 is 0).
// If three of the m′ are on one line, the H returned is singular.
export function homography(pairs) {
  const A = [], b = [];
  for (const [[x, y], [xp, yp]] of pairs) {
    A.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp]); b.push(xp);
    A.push([0, 0, 0, x, y, 1, -x * yp, -y * yp]); b.push(yp);
  }
  const At = transpose(A);
  const h = pairs.length === 4 ? solve(A, b) : solve(matMul(At, A), At.map((r) => r.reduce((s, x, k) => s + x * b[k], 0)));
  return h && [h.slice(0, 3), h.slice(3, 6), [h[6], h[7], 1]];
}

// The least-squares solution of Ax ≈ b, for more equations than unknowns, by Householder reflections (QR).
// It stays accurate when the columns of A differ in size by many orders of magnitude, where the normal
// equations (AᵀA)x = Aᵀb would lose digits. Null when the columns of A are dependent.
export function lstsq(A, b) {
  const m = A.length, n = A[0].length, R = A.map((r) => [...r]), y = [...b];
  const size = Math.max(...A.flat().map(Math.abs));
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = k; i < m; i++) s += R[i][k] ** 2;
    const norm = Math.sqrt(s), alpha = R[k][k] > 0 ? -norm : norm;
    const v = R.map((r, i) => (i < k ? 0 : r[k]));
    v[k] -= alpha;
    const vv = v.reduce((q, x) => q + x * x, 0);
    if (vv > 0) {
      const reflect = (get, set) => { let d = 0; for (let i = k; i < m; i++) d += v[i] * get(i); d = (2 * d) / vv; for (let i = k; i < m; i++) set(i, get(i) - d * v[i]); };
      for (let j = k; j < n; j++) reflect((i) => R[i][j], (i, x) => { R[i][j] = x; });
      reflect((i) => y[i], (i, x) => { y[i] = x; });
    }
    if (Math.abs(R[k][k]) <= 1e-10 * size) return null;
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= R[i][j] * x[j];
    x[i] = s / R[i][i];
  }
  return x;
}

// The general projection matrix A of a camera, scaled so that a34 = 1, with λw = AM′ for every pair [M′, w] of a
// point of space [X, Y, Z] and its pixel [u, v]. Each pair gives two rows of Qa = r, and the 11 unknowns are found
// by least squares. That takes at least six pairs whose points are not all on one plane; otherwise null.
export function projectionMatrix(pairs) {
  const Q = [], r = [];
  for (const [[X, Y, Z], [u, v]] of pairs) {
    Q.push([X, Y, Z, 1, 0, 0, 0, 0, -u * X, -u * Y, -u * Z]); r.push(u);
    Q.push([0, 0, 0, 0, X, Y, Z, 1, -v * X, -v * Y, -v * Z]); r.push(v);
  }
  // Scaling each column to length 1 first makes the test for dependent columns independent of the units.
  const len = transpose(Q).map((c) => Math.hypot(...c) || 1);
  const a = Q.length >= 11 && lstsq(Q.map((row) => row.map((x, j) => x / len[j])), r);
  return a ? [a.slice(0, 4), a.slice(4, 8), [...a.slice(8), 1]].map((row, i) => row.map((x, j) => (i === 2 && j === 3 ? 1 : x / len[4 * i + j]))) : null;
}

// The optical center of the camera A: the point C = [X, Y, Z] with AC = 0, the one point of space with no image.
// Null when the left 3×3 block of A is singular (a camera with its center at infinity).
export const opticalCenter = (A) => solve(A.map((r) => r.slice(0, 3)), A.map((r) => -r[3]));

/* ---------- Two views ---------- */

// [u]×, the matrix whose product with any v is the cross product u × v.
export const skew = (u) => [[0, -u[2], u[1]], [u[2], 0, -u[0]], [-u[1], u[0], 0]];
// The pseudo-inverse A⁺ = Aᵀ(AAᵀ)⁻¹ of a 3×4 matrix A of rank 3: a 4×3 matrix with AA⁺ = I. In a camera measured in
// millimeters the last column of A dwarfs the others, so its rows are nearly parallel and AAᵀ is poorly conditioned;
// AAᵀ is inverted here without inverse()'s test for singular matrices, which would reject it. AAᵀ is positive
// semidefinite, so a determinant that is not positive means A has rank below 3, and the result is null.
export function pinv(A) {
  const G = matMul(A, transpose(A));
  const cols = [cross(G[1], G[2]), cross(G[2], G[0]), cross(G[0], G[1])];
  const det = dot(G[0], cols[0]);
  return det > 0 ? matMul(transpose(A), transpose(cols).map((r) => r.map((x) => x / det))) : null;
}
// The fundamental matrix F = [BC₁]× B A⁺ of the cameras A (view 1) and B (view 2). The epipolar line of a pixel m₁
// of view 1 is ℓ₂ = Fm₁ in view 2, and a pixel m₂ that matches m₁ has m₂ᵀFm₁ = 0. F is the zero matrix when both
// cameras share their optical center. Null when A's center is at infinity or A has rank below 3.
export function fundamental(A, B) {
  const C = opticalCenter(A), Ap = pinv(A);
  return C && Ap ? matMul(matMul(skew(apply(B, [...C, 1])), B), Ap) : null;
}
// The distance from the point m = [x, y, 1] (or any multiple of it) to the line ℓ = [a, b, c]: |ℓᵀm| / √(a² + b²).
export const lineDistance = (l, m) => Math.abs(dot(l, m) / m[2]) / Math.hypot(l[0], l[1]);

/* ---------- Several views ---------- */

// The point M = [X, Y, Z] that best fits its pixels ms[i] = [x, y] in the views with cameras Ps[i], by least squares.
// λm = PM is three equations, and the third gives λ = p31 X + p32 Y + p33 Z + p34. Put into the other two, it leaves
// two rows of QM = r per view: (p31 x − p11)X + (p32 x − p12)Y + (p33 x − p13)Z = p14 − p34 x, and the same with y
// and the second row of P. Returns { M, Q, r }, or null when Q has rank below 3 (fewer than two views, say).
export function reconstruct(ms, Ps) {
  const Q = [], r = [];
  ms.forEach(([x, y], i) => {
    const [p1, p2, p3] = Ps[i];
    Q.push([0, 1, 2].map((j) => p3[j] * x - p1[j])); r.push(p1[3] - p3[3] * x);
    Q.push([0, 1, 2].map((j) => p3[j] * y - p2[j])); r.push(p2[3] - p3[3] * y);
  });
  const M = Q.length >= 4 ? lstsq(Q, r) : null;
  return M && { M, Q, r };
}

/* ---------- The X-ray series of the computer vision notes ---------- */

// X-ray images of an object that turns 2° about the vertical axis Z between one image and the next, W × H pixels
// each, numbered 0 to last. Image k has the projection matrix P(k) = P(0)·T(2k°), where T turns the object's
// coordinates about Z, so the X-ray source, the optical center, sits on one horizontal circle around the object.
// Lengths are in millimeters, and the third row of each P is a unit vector, so λ is a point's depth in millimeters.
export const XRAY = { W: 2688, H: 2208, last: 177 };
const XRAY_P0 = [
  [-7919.179138430423, -1478.0889618975004, 5.355871503035249, 1297864.793781347],
  [23.269823689888916, -1284.882318265887, -7958.236076838229, 1064265.9285700037],
  [0.020550829547262388, -0.9997873837831113, 0.0016883817818043197, 964.0558692322625],
];
export function xrayCamera(k) {
  const t = (2 * k * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return matMul(XRAY_P0, [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
}

/* ---------- Cameras on a circle ---------- */

// A camera whose optical center stands on a horizontal circle of radius `radius` around the Z axis, `deg` degrees from
// the X axis toward Y, and looks at the axis: A = K[R′ | t′], with K = [f 0 W/2; 0 f H/2; 0 0 1] for images of W × H
// pixels. The rows of R′ are the camera's axes in the object's system: to the right, down (−Z) and toward the axis. The
// third row of A is then a unit vector, so λ is a point's depth, and every such camera sees the plane of the circle,
// Z = 0, as the row v = H/2.
export function circleCamera(deg, { radius = 1000, f = 8000, W = 2000, H = 1600 } = {}) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), C = [radius * c, radius * s, 0];
  const Rp = [[-s, c, 0], [0, 0, -1], [-c, -s, 0]];
  return matMul([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]], Rp.map((r) => [...r, -dot(r, C)]));
}

// Splits the camera A = k[K | 0]S′ = kK[R′ | t′] into the calibration matrix K = [α γ u0; 0 β v0; 0 0 1], the turn
// R′ (its rows are the camera's axes X, Y and Z written in the object's system) and t′ (the object's origin seen from
// the camera). The rows of R′ are perpendicular unit vectors and K is upper triangular, so they come off the rows of
// A's left block one at a time, from the bottom up (Gram–Schmidt). The sign of k puts the object's origin in front
// of the camera (t′Z > 0). With α and β positive, R′ can come out a mirror (det R′ = −1): then no real camera gives
// these pixels, and `mirror` is true. Null when the left block is singular.
export function decomposeCamera(A) {
  const B = A.map((r) => r.slice(0, 3)), last = A.map((r) => r[3]);
  const norm = (v) => Math.hypot(...v), sub = (a, b) => a.map((x, i) => x - b[i]), times = (v, s) => v.map((x) => x * s);
  let k = norm(B[2]);
  if (!inverse(B) || k === 0) return null;
  if (last[2] < 0) k = -k;
  const [m1, m2, r3] = B.map((r) => times(r, 1 / k));
  const v0 = dot(m2, r3), q2 = sub(m2, times(r3, v0)), beta = norm(q2), r2 = times(q2, 1 / beta);
  const u0 = dot(m1, r3), gamma = dot(m1, r2), q1 = sub(sub(m1, times(r2, gamma)), times(r3, u0)), alpha = norm(q1), r1 = times(q1, 1 / alpha);
  const K = [[alpha, gamma, u0], [0, beta, v0], [0, 0, 1]], Rp = [r1, r2, r3];
  const tp = apply(inverse(K), times(last, 1 / k));
  return { K, Rp, tp, k, alpha, beta, gamma, u0, v0, mirror: dot(r1, cross(r2, r3)) < 0 };
}

// The angles [wx, wy, wz] in radians with rotation3d(wx, wy, wz) = R, taking wy between −90° and 90°. The first row
// of R is [cos wy cos wz, cos wy sin wz, −sin wy]. At wy = ±90° (gimbal lock) only wx ∓ wz is fixed, and wz is set to 0.
export function anglesOf(R) {
  const wy = Math.asin(Math.max(-1, Math.min(1, -R[0][2])));
  if (Math.abs(Math.cos(wy)) < 1e-9) return [Math.atan2(-R[2][1], R[1][1]), wy, 0];
  return [Math.atan2(R[1][2], R[2][2]), wy, Math.atan2(R[0][1], R[0][0])];
}

// The matrices that give a point's coordinates in axes turned by w radians about the X, Y or Z axis. The angle goes
// from the old axis to the new one, counterclockwise when the axis points at the viewer (the right-hand rule), and
// the rows are the new axes written in the old system. Each is the transpose of the matrix that turns points by w.
export const rotX = (w) => [[1, 0, 0], [0, Math.cos(w), Math.sin(w)], [0, -Math.sin(w), Math.cos(w)]];
export const rotY = (w) => [[Math.cos(w), 0, -Math.sin(w)], [0, 1, 0], [Math.sin(w), 0, Math.cos(w)]];
export const rotZ = (w) => [[Math.cos(w), Math.sin(w), 0], [-Math.sin(w), Math.cos(w), 0], [0, 0, 1]];
// R = R_X R_Y R_Z, for axes turned first about Z, then about the new Y, then about the newest X (angles in radians).
// M′ = RM gives the new coordinates; its transpose R′ = Rᵀ gives the old ones back.
export const rotation3d = (wx, wy, wz) => matMul(matMul(rotX(wx), rotY(wy)), rotZ(wz));

/* ---------- Math formatting (HTML strings) ---------- */

const MINUS = "\u2212";
// A number rounded to d decimals, with a real minus sign.
export function fmt(n, d = 2) {
  const k = 10 ** d;
  let r = Math.round(n * k) / k;
  if (Object.is(r, -0)) r = 0;
  return (r < 0 ? MINUS : "") + String(Math.abs(r));
}
// A number as the notes' text writes it, with d decimals: a decimal point in both languages, a real minus sign, and
// thousands set apart, with a comma in English and, from five digits on, a non-breaking space in Spanish.
export function localNum(x, d = 0) {
  const [i, f] = Math.abs(x).toFixed(d).split(".");
  const big = lang === "es" ? (i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") : i) : i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${x < 0 ? MINUS : ""}${big}${f ? `.${f}` : ""}`;
}
export const isRounded = (n) => Math.round(n * 100) !== n * 100;
// Like fmt, but numbers below 1 keep `digits` significant digits, so an entry such as −0.000585 does not
// round to 0. Below 0.001 it writes a power of ten.
export function fmtSig(n, digits = 3) {
  const a = Math.abs(n);
  if (a >= 1 || a === 0) return fmt(n);
  const sign = n < 0 ? MINUS : "";
  if (a >= 1e-3) return sign + String(Number(a.toPrecision(digits)));
  let e = Math.floor(Math.log10(a)), m = Number((a / 10 ** e).toPrecision(digits));
  if (m >= 10) { m = Number((m / 10).toPrecision(digits)); e += 1; }
  return `${sign}${m}·10<sup>${MINUS}${-e}</sup>`;
}
export const paren = (n) => (n < 0 ? `(${fmt(n)})` : fmt(n));
export const T = '<sup class="t">T</sup>';
export const sym = (name, sub, cls) => `<span class="${cls}"><i>${name}</i>${sub ? `<sub>${sub}</sub>` : ""}</span>`;
export const col = (arr, cls = "", f = fmt) => `<span class="col ${cls}">${arr.map((v) => `<span>${f(v)}</span>`).join("")}</span>`;
export const row = (arr, cls = "") => `<span class="nowrap ${cls}">[${arr.map((v) => fmt(v)).join("&ensp;")}]${T}</span>`;
export const frac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;
// A matrix as a bracketed grid, from an array of rows. Numbers are written with f, strings are kept as HTML.
export const mat = (rows, cls = "", f = fmt) =>
  `<span class="mat ${cls}"${rows[0].length !== 3 ? ` style="--cols: ${rows[0].length}"` : ""}>${rows.flat().map((v) => `<span>${typeof v === "number" ? f(v) : v}</span>`).join("")}</span>`;

// "ax + by + c = 0" with clean signs and unit coefficients. With vars = ["p", "q", "r"] it writes the
// plane "ap + bq + cr = 0"; an empty name marks the constant term.
export function equation(l, vars = ["x", "y", ""]) {
  const terms = l.map((c, i) => [c, vars[i] ? `<i>${vars[i]}</i>` : ""]);
  let s = "", first = true;
  for (const [c, v] of terms) {
    if (c === 0) continue;
    const a = Math.abs(c);
    const body = v ? (a === 1 ? v : fmt(a) + v) : fmt(a);
    s += first ? (c < 0 ? MINUS : "") + body : (c < 0 ? ` ${MINUS} ` : " + ") + body;
    first = false;
  }
  return `<span class="nowrap">${s || "0"} = 0</span>`;
}

// Clips the line ax + by + c = 0 to the square [lo, hi] x [lo, hi]; returns its two endpoints, or null.
// lo and hi may also be [x, y] corners, for a rectangle such as an image of W × H pixels: [0, 0] and [W, H].
export function clipLine(l, lo, hi) {
  const [a, b, c] = l, nn = a * a + b * b;
  if (nn === 0) return null;
  const L = typeof lo === "number" ? [lo, lo] : lo, U = typeof hi === "number" ? [hi, hi] : hi;
  const p0 = [(-a * c) / nn, (-b * c) / nn], len = Math.sqrt(nn), d = [b / len, -a / len];
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-12) { if (p0[i] < L[i] || p0[i] > U[i]) return null; continue; }
    const t1 = (L[i] - p0[i]) / d[i], t2 = (U[i] - p0[i]) / d[i];
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  if (tmin > tmax) return null;
  return [[p0[0] + tmin * d[0], p0[1] + tmin * d[1]], [p0[0] + tmax * d[0], p0[1] + tmax * d[1]]];
}

/* ---------- Handles and dragging ---------- */

// On touch screens the invisible hit area grows so a fingertip can grab a handle (about 44px on a phone).
const hitRadius = window.matchMedia?.("(pointer: coarse)").matches ? 33 : 21;

// A focusable handle: an invisible hit area, a focus ring and a visible mark that depends on kind:
// "point" (carmine dot), "grip" (hollow blue circle) or "none" (the figure draws its own mark,
// and passes a focus ring radius that clears it).
export function makeHandle(parent, kind, ring = kind === "grip" ? 12 : 13) {
  const h = el("g", { class: "handle", tabindex: 0, role: "button" }, parent);
  el("circle", { r: hitRadius, class: "hit" }, h);
  el("circle", { r: ring, class: "ring" }, h);
  if (kind === "point") el("circle", { r: 8, class: "pt-dot" }, h);
  if (kind === "grip") el("circle", { r: 7, class: "grip" }, h);
  return h;
}

// Pointer position in the SVG's own units.
export function svgPoint(svg, ev) {
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: q.x, y: q.y };
}

// Pointer and keyboard dragging. move(s) receives the point the handle's center should follow, in SVG units: the
// pointer, shifted by where on the handle it was grabbed, so a handle grabbed off its center does not jump to the pointer.
// step([dx, dy]) receives an arrow key as a direction, with ArrowUp as [0, 1].
export function makeDraggable(h, { move, step }) {
  const svg = h.ownerSVGElement;
  h.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  h.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch {}
    h.classList.add("drag");
    h.focus?.({ preventScroll: true });
    // The handle's center in SVG units is its own origin, wherever its groups put it.
    const at = svgPoint(svg, e), m = svg.getScreenCTM()?.inverse().multiply(h.getScreenCTM());
    const off = m ? { x: m.e - at.x, y: m.f - at.y } : { x: 0, y: 0 };
    const onMove = (ev) => { const p = svgPoint(svg, ev); move({ x: p.x + off.x, y: p.y + off.y }); };
    const up = (ev) => {
      try { h.releasePointerCapture(ev.pointerId); } catch {}
      h.classList.remove("drag");
      h.removeEventListener("pointermove", onMove);
      h.removeEventListener("pointerup", up);
      h.removeEventListener("pointercancel", up);
    };
    h.addEventListener("pointermove", onMove);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  });
  h.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    step(d);
  });
}

/* ---------- Plane ---------- */

// The plane is always drawn 400 units wide: `max` sets how many data units that is, with ticks every `tick` units,
// labels every `labelStep`, and, with `grid`, faint lines at every tick. Label distances passed to placeAlong and
// placeLineLabel are in units of the default 40-unit plane, so they look the same at any max.
export function createPlane(svg, { max = 40, tick = 5, labelStep = 10, grid = false } = {}) {
  const S = 400 / max, OX = 34, OY = 422, k = max / 40;
  svg.setAttribute("viewBox", "0 0 460 456");
  const X = (x) => OX + S * x;
  const Y = (y) => OY - S * y;

  if (grid) {
    const gg = el("g", { class: "grid" }, svg);
    for (let v = tick; v <= max; v += tick) {
      el("line", { x1: X(v), y1: OY, x2: X(v), y2: Y(max) }, gg);
      el("line", { x1: OX, y1: Y(v), x2: X(max), y2: Y(v) }, gg);
    }
  }
  const g = el("g", { class: "axes" }, svg);
  el("line", { x1: OX, y1: OY, x2: X(max), y2: OY }, g);
  el("line", { x1: OX, y1: OY, x2: OX, y2: Y(max) }, g);
  for (let v = 0; v <= max; v += tick) {
    const major = v % labelStep === 0;
    el("line", { x1: X(v), y1: OY, x2: X(v), y2: OY + (major ? 6 : 3.5) }, g);
    el("line", { x1: OX, y1: Y(v), x2: OX - (major ? 6 : 3.5), y2: Y(v) }, g);
    if (!major) continue;
    el("text", { x: X(v), y: OY + 21, "text-anchor": "middle", class: "tick" }, svg).textContent = v;
    if (v > 0) el("text", { x: OX - 10, y: Y(v) + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = v;
  }
  el("text", { x: X(max) + 12, y: OY + 5, class: "axl" }, svg).textContent = "x";
  el("text", { x: OX - 4, y: Y(max) - 9, class: "axl" }, svg).textContent = "y";

  const clampRound = (p) => ({
    x: Math.max(0, Math.min(max, Math.round(p.x))),
    y: Math.max(0, Math.min(max, Math.round(p.y))),
  });

  const toData = (s) => ({ x: (s.x - OX) / S, y: (OY - s.y) / S });

  // Clips the line ax + by + c = 0 to the visible square; returns two endpoints or null.
  const clip = (l) => clipLine(l, 0, max);

  function drawSegment(line, seg) {
    if (!seg) { line.setAttribute("visibility", "hidden"); return; }
    line.setAttribute("visibility", "visible");
    line.setAttribute("x1", X(seg[0][0])); line.setAttribute("y1", Y(seg[0][1]));
    line.setAttribute("x2", X(seg[1][0])); line.setAttribute("y2", Y(seg[1][1]));
  }

  function label(cls, main, sub) {
    const t = el("text", { class: cls }, svg);
    el("tspan", { "font-style": "italic" }, t).textContent = main;
    if (sub) el("tspan", { dy: 6, "font-size": 15 }, t).textContent = sub;
    return t;
  }

  // Places a label next to point p, pushed along dir, or against it if it would leave the plane. With a memo, the
  // label takes whichever of dir and −dir is closer to the direction it took last time, and flips only when that
  // side would leave the plane: so it neither follows a vector whose sign flips nor flips back after an edge.
  // Returns 1 or −1, the sign it used.
  function placeAlong(t, p, dir, dist, memo) {
    dist *= k;
    const n = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / n, uy = dir[1] / n, edge = 1.5 * k;
    const out = (s) => { const cx = p.x + s * ux * dist, cy = p.y + s * uy * dist; return cx < edge || cx > max - edge || cy < edge || cy > max - edge; };
    let s = memo?.dir && memo.dir[0] * ux + memo.dir[1] * uy < 0 ? -1 : 1;
    if (out(s) && (!memo || !out(-s))) s = -s;
    if (memo) memo.dir = [s * ux, s * uy];
    const cx = p.x + s * ux * dist, cy = p.y + s * uy * dist;
    t.setAttribute("x", X(cx)); t.setAttribute("y", Y(cy) + 7); t.setAttribute("text-anchor", "middle");
    return s;
  }

  // Labels a line near its right end, offset to one side. With a memo, it stays near the end it was near last time
  // and on the same side, so it does not leap to the other end when the line turns past vertical.
  function placeLineLabel(t, l, seg, memo) {
    const [e1, e2] = seg;
    const right = e2[0] > e1[0] + 1e-9 || (Math.abs(e2[0] - e1[0]) < 1e-9 && e2[1] > e1[1]) ? e2 : e1;
    const near = (a) => Math.hypot(a[0] - memo.at[0], a[1] - memo.at[1]);
    const end = memo?.at ? (near(e1) <= near(e2) ? e1 : e2) : right;
    const other = end === e2 ? e1 : e2;
    const dl = Math.hypot(other[0] - end[0], other[1] - end[1]) || 1;
    const back = Math.min(3.2 * k, dl / 2);
    if (memo) memo.at = end;
    placeAlong(t, { x: end[0] + ((other[0] - end[0]) / dl) * back, y: end[1] + ((other[1] - end[1]) / dl) * back }, [l[0], l[1]], 1.9, memo && (memo.side ??= {}));
  }

  function place(h, p) { h.setAttribute("transform", `translate(${X(p.x)},${Y(p.y)})`); }

  // Dragging with integer snapping, by pointer or by one unit per arrow key.
  function draggable(h, get, set) {
    makeDraggable(h, {
      move: (s) => set(clampRound(toData(s))),
      step: ([dx, dy]) => { const p = get(); set(clampRound({ x: p.x + dx, y: p.y + dy })); },
    });
  }

  return { max, X, Y, toData, el: (tag, attrs) => el(tag, attrs, svg), clip, drawSegment, label, placeAlong, placeLineLabel, handle: (kind) => makeHandle(svg, kind), place, draggable };
}

/* ---------- Images in pixels ---------- */

// Draws an image of W × H pixels into svg at `scale` SVG units per pixel, with its top left corner at [ox, oy] and,
// as an image is read, u to the right and v down: the frame, ticks with their values along the top and left edges,
// and the axis names u and v. `id` names the clip path of the group `inside`, which keeps drawings within the image.
// For a close-up, `from` is the pixel at the top left corner: the frame then shows pixels from[0] to from[0] + W
// and from[1] to from[1] + H of a larger image, and the ticks and mappings use that image's pixels.
// Returns that group and the mapping X(u), Y(v) to SVG units, with toPixel for the way back.
export function pixelFrame(svg, { W, H, scale, ox, oy, id, uTicks = [], vTicks = [], axisNames = true, from = [0, 0] }) {
  const X = (u) => ox + scale * (u - from[0]), Y = (v) => oy + scale * (v - from[1]);
  const clip = el("clipPath", { id }, el("defs", null, svg));
  el("rect", { x: ox, y: oy, width: W * scale, height: H * scale }, clip);
  el("rect", { x: ox, y: oy, width: W * scale, height: H * scale, class: "px-frame" }, svg);
  const ticks = el("g", { class: "axes" }, svg);
  for (const u of uTicks) {
    el("line", { x1: X(u), y1: oy, x2: X(u), y2: oy - 5 }, ticks);
    el("text", { x: X(u), y: oy - 9, "text-anchor": "middle", class: "tick" }, svg).textContent = u;
  }
  for (const v of vTicks) {
    el("line", { x1: ox, y1: Y(v), x2: ox - 5, y2: Y(v) }, ticks);
    el("text", { x: ox - 9, y: Y(v) + 5, "text-anchor": "end", class: "tick" }, svg).textContent = v;
  }
  if (axisNames) {
    mathLabel(svg, "axl", [["u", true]]).setAttribute("transform", `translate(${ox + W * scale - 8},${oy - 9})`);
    mathLabel(svg, "axl", [["v", true]]).setAttribute("transform", `translate(${ox - 16},${oy + H * scale - 4})`);
  }
  const inside = el("g", { "clip-path": `url(#${id})` }, svg);
  return { X, Y, toPixel: (s) => [from[0] + (s.x - ox) / scale, from[1] + (s.y - oy) / scale], inside };
}

/* ---------- Log–log charts ---------- */

// Log–log axes: x runs from x[0] to x[1] and y from y[0] to y[1], both on logarithmic scales, inside the box
// [L, R, T, B] of a viewBox `size` wide and tall. Each axis is numbered at the powers of ten from the first one in its
// range (xLabel and yLabel write a power as a tick label: by default with as many decimals as it needs, 1, 0.1, 0.01),
// with short ticks at their multiples up to the axis's end.
// The caller names the axes. Returns the mappings X(x) and Y(y) to SVG units and the box, with toX (SVG x to data)
// and toLogY (SVG y to log10 of data) for the way back.
const powerLabel = (p) => localNum(p, Math.max(0, -Math.round(Math.log10(p))));
export function logChart(svg, { x: [x0, x1], y: [y0, y1], box: [L, R, T, B], size: [w, h], xLabel = powerLabel, yLabel = powerLabel }) {
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const ax = Math.log10(x0), dx = Math.log10(x1) - ax, ay = Math.log10(y0), dy = Math.log10(y1) - ay;
  const X = (x) => L + ((R - L) * (Math.log10(x) - ax)) / dx;
  const Y = (y) => B - ((B - T) * (Math.log10(y) - ay)) / dy;
  const g = el("g", { class: "axes" }, svg);
  el("line", { x1: L, y1: B, x2: R, y2: B }, g);
  el("line", { x1: L, y1: B, x2: L, y2: T }, g);
  // The powers of ten of both axes in increasing order, each axis's ticks and label drawn at its own powers.
  const first = (lo) => Math.ceil(Math.log10(lo) - 1e-9), inX = (v) => v >= x0 && v <= x1, inY = (v) => v >= y0 && v <= y1;
  for (let e = Math.min(first(x0), first(y0)); 10 ** e <= Math.max(x1, y1); e++) {
    const p = 10 ** e, onX = e >= first(x0) && p <= x1, onY = e >= first(y0) && p <= y1;
    for (let m = 1; m <= 9; m++) {
      const v = p * m, len = m === 1 ? 6 : 3.5;
      if (onX && inX(v)) el("line", { x1: X(v), y1: B, x2: X(v), y2: B + len }, g);
      if (onY && inY(v)) el("line", { x1: L, y1: Y(v), x2: L - len, y2: Y(v) }, g);
    }
    if (onX) el("text", { x: X(p), y: B + 21, "text-anchor": "middle", class: "tick" }, svg).textContent = xLabel(p);
    if (onY) el("text", { x: L - 10, y: Y(p) + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = yLabel(p);
  }
  return {
    X, Y, L, R, T, B,
    toX: (sx) => 10 ** (ax + (dx * (sx - L)) / (R - L)),
    toLogY: (sy) => ay + (dy * (B - sy)) / (B - T),
  };
}

/* ---------- Controls ---------- */

// Toggle buttons with a data-mode attribute inside `group`, one pressed at a time. A click presses its button and
// calls onChange(mode); the returned function presses a mode without calling onChange, for Reset.
export function modeButtons(group, onChange) {
  const buttons = [...group.querySelectorAll("button[data-mode]")];
  const press = (mode) => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  for (const b of buttons) b.addEventListener("click", () => { press(b.dataset.mode); onChange(b.dataset.mode); });
  return press;
}

// A list of buttons, such as a figure's words, that the arrow keys move through: Right and Down go to the next button,
// Left and Up to the previous one, stopping at the ends. A click on a button, or an arrow key that moves the focus to it,
// calls select(i) with its index; select marks the button picked and gives it tabindex 0 and the others −1, so Tab enters
// the list there.
export function roving(buttons, select) {
  buttons.forEach((b, i) => {
    b.addEventListener("click", () => select(i));
    b.addEventListener("keydown", (e) => {
      const step = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const j = Math.max(0, Math.min(buttons.length - 1, step));
      buttons[j].focus();
      select(j);
    });
  });
}

// A panel whose content changes with its mode keeps the height of its tallest mode, so the page below never jumps:
// show(m) draws mode m, and current() gives the mode on show. The height is measured again when the fonts arrive and
// when the window changes width.
export function steadyHeight(panel, modes, show, current) {
  const fit = () => {
    const now = current();
    panel.style.minHeight = "";
    let tallest = 0;
    for (const m of modes) { show(m); tallest = Math.max(tallest, panel.offsetHeight); }
    panel.style.minHeight = `${tallest}px`;
    show(now);
  };
  fit();
  document.fonts?.ready.then(fit);
  let width = window.innerWidth;
  window.addEventListener("resize", () => { if (window.innerWidth !== width) { width = window.innerWidth; fit(); } });
}

// A number input that accepts whole numbers from min to max. Only such a number calls set(v); while the field
// holds anything else (a lone minus sign, say), the figure waits. Leaving the field writes back get().
// The returned function shows a value in the field, unless the reader is typing in it.
export function wholeNumberInput(input, { min, max, get, set }) {
  input.addEventListener("input", () => {
    const v = Number(input.value);
    if (input.value.trim() === "" || !Number.isInteger(v) || v < min || v > max) return;
    set(v || 0);
  });
  input.addEventListener("change", () => { input.value = get(); });
  return (v) => { if (document.activeElement !== input) input.value = v; };
}

/* ---------- Space (3D view the reader can turn) ---------- */

// Draws 3D vectors [p q r] with an orthographic view: the scene turns by `yaw` degrees about the vertical
// r axis, tilts by `pitch` degrees toward the reader, and depth is dropped. Straight lines stay straight
// and ratios along a line are kept, so the vector t·v is drawn at t times the screen offset of v.
// With stretch = 1 the drawing is a true view of the space, so right angles look right; stretch > 1
// exaggerates the r axis, which still keeps lines, planes and where they meet, but not angles.
// `pivot` is the point of the space drawn at screen point `at`, and the view turns around it.
// Geometry drawn with line(), poly(), dot() and pin() follows the view when it turns.
export function createSpace(svg, { width = 460, height = 456, pivot = [0, 0, 0], at = [width / 2, height / 2], scale, stretch = 1, yaw = -25, pitch = 25, yawRange = [-80, 30], pitchRange = [8, 65] }) {
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const rad = Math.PI / 180;
  const view = { yaw, pitch };
  let E, base;   // E: screen offsets of the three unit vectors; base: where the origin is drawn
  function setAxes() {
    const cy = Math.cos(view.yaw * rad), sy = Math.sin(view.yaw * rad), ct = Math.cos(view.pitch * rad), st = Math.sin(view.pitch * rad);
    E = [[scale * cy, -scale * sy * st], [-scale * sy, -scale * cy * st], [0, -scale * stretch * ct]];
    base = [0, 1].map((i) => at[i] - (pivot[0] * E[0][i] + pivot[1] * E[1][i] + pivot[2] * E[2][i]));
  }
  setAxes();
  const offset = (d) => [0, 1].map((i) => d[0] * E[0][i] + d[1] * E[1][i] + d[2] * E[2][i]);
  const project = (v) => { const o = offset(v); return [base[0] + o[0], base[1] + o[1]]; };
  // Unit vector from the scene toward the reader: its dot product with a plane's normal says which side faces the reader.
  function toward() {
    const cy = Math.cos(view.yaw * rad), sy = Math.sin(view.yaw * rad), ct = Math.cos(view.pitch * rad), st = Math.sin(view.pitch * rad);
    return [-ct * sy, -ct * cy, st];
  }

  // The first two coordinates of the point drawn at screen point s, on the plane where the third coordinate is c.
  function onPlane(s, c) {
    const bx = s.x - base[0] - c * E[2][0], by = s.y - base[1] - c * E[2][1];
    const det = E[0][0] * E[1][1] - E[1][0] * E[0][1];
    return { x: (bx * E[1][1] - E[1][0] * by) / det, y: (E[0][0] * by - bx * E[0][1]) / det };
  }

  // The range [t0, t1] for which p + t·d is drawn inside the figure, at least inset units from its edges.
  function span(p, d, inset = 0) {
    const s = project(p), ds = offset(d);
    const lo = [inset, inset], hi = [width - inset, height - inset];
    let t0 = -Infinity, t1 = Infinity;
    for (let i = 0; i < 2; i++) {
      if (Math.abs(ds[i]) < 1e-9) { if (s[i] < lo[i] || s[i] > hi[i]) return null; continue; }
      const u = (lo[i] - s[i]) / ds[i], w = (hi[i] - s[i]) / ds[i];
      t0 = Math.max(t0, Math.min(u, w));
      t1 = Math.min(t1, Math.max(u, w));
    }
    return t0 <= t1 ? [t0, t1] : null;
  }

  // The t for which p + t·d is drawn closest to screen point s.
  function along(p, d, s) {
    const o = project(p), ds = offset(d), nn = ds[0] ** 2 + ds[1] ** 2;
    return nn ? ((s.x - o[0]) * ds[0] + (s.y - o[1]) * ds[1]) / nn : 0;
  }

  // Of the directions dirs in space, the one drawn closest to an arrow key's direction [dx, dy] (ArrowUp is
  // [0, 1]), so an arrow key moves a point the way it looks on screen however the view is turned.
  function closest(dirs, [dx, dy]) {
    let best = dirs[0], score = -Infinity;
    for (const d of dirs) {
      const o = offset(d), s = (o[0] * dx - o[1] * dy) / (Math.hypot(o[0], o[1]) || 1);
      if (s > score) { score = s; best = d; }
    }
    return best;
  }

  function setLine(line, p, q) {
    const [x1, y1] = project(p), [x2, y2] = project(q);
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
  }
  const setPoly = (poly, pts) => poly.setAttribute("points", pts.map((v) => project(v).join(",")).join(" "));

  // Places a label next to the point v, pushed dist units along the screen direction dir.
  function placeLabel(t, v, dir, dist) {
    const [x, y] = project(v), n = Math.hypot(dir[0], dir[1]) || 1;
    t.setAttribute("x", x + (dir[0] / n) * dist); t.setAttribute("y", y + (dir[1] / n) * dist + 7);
    t.setAttribute("text-anchor", "middle");
  }
  const place = (h, v) => { const [x, y] = project(v); h.setAttribute("transform", `translate(${x},${y})`); };

  // Fixed geometry, redrawn whenever the view turns.
  const fixed = [];
  const keep = (draw) => { draw(); fixed.push(draw); };
  function line(parent, p, q, cls) { const l = el("line", cls ? { class: cls } : null, parent); keep(() => setLine(l, p, q)); return l; }
  function poly(parent, pts, cls) { const g = el("polygon", { class: cls }, parent); keep(() => setPoly(g, pts)); return g; }
  function dot(parent, v, r, cls) {
    const c = el("circle", { r, class: cls }, parent);
    keep(() => { const [x, y] = project(v); c.setAttribute("cx", x); c.setAttribute("cy", y); });
    return c;
  }
  // Pins label t next to the point v: dir is a direction in space [p q r], or a screen direction [dx, dy].
  // A label that would stick out of the figure is pulled back inside.
  function pin(t, v, dir, dist) {
    keep(() => {
      placeLabel(t, v, dir.length === 3 ? offset(dir) : dir, dist);
      const b = t.getBBox(), m = 4;
      const dx = Math.max(0, m - b.x) - Math.max(0, b.x + b.width - (width - m));
      const dy = Math.max(0, m - b.y) - Math.max(0, b.y + b.height - (height - m));
      if (dx || dy) { t.setAttribute("x", +t.getAttribute("x") + dx); t.setAttribute("y", +t.getAttribute("y") + dy); }
    });
    return t;
  }

  const clamp = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x));
  function setView(yawDeg, pitchDeg) {
    view.yaw = clamp(yawDeg, yawRange); view.pitch = clamp(pitchDeg, pitchRange);
    setAxes();
    fixed.forEach((draw) => draw());
  }
  // Zooms: `scale` SVG units per unit of space, with the point `p` of space drawn at `at`. The turn is kept.
  function setScale(s, p = pivot) {
    scale = s; pivot = p;
    setAxes();
    fixed.forEach((draw) => draw());
  }

  // Lets the reader turn the view by dragging the figure's background, or by focusing the figure and using
  // the arrow keys. On touch screens only sideways drags turn it (touch-action: pan-y), so the page still scrolls.
  function turnable(onTurn) {
    svg.classList.add("turnable");
    svg.setAttribute("tabindex", "0");
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      if (e.target.closest?.(".handle")) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try { svg.setPointerCapture(e.pointerId); } catch {}
      svg.classList.add("turning");
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      // A finger turns the view only sideways: its vertical moves belong to scrolling the page.
      const tilt = e.pointerType === "touch" ? 0 : (e.clientY - drag.y) * 0.3;
      setView(view.yaw + (e.clientX - drag.x) * 0.45, view.pitch + tilt);
      drag.x = e.clientX; drag.y = e.clientY;
      onTurn();
    });
    const end = () => { drag = null; svg.classList.remove("turning"); };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("keydown", (e) => {
      if (e.target !== svg) return;
      const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
      if (!d) return;
      e.preventDefault();
      setView(view.yaw + d[0], view.pitch + d[1]);
      onTurn();
    });
  }

  return {
    width, height, view, project, offset, toward, onPlane, span, along, closest,
    line, poly, dot, pin, setLine, setPoly, placeLabel, place, setView, setScale, turnable,
    el: (tag, attrs, parent = svg) => el(tag, attrs, parent),
  };
}

/* ---------- Labels and steps in 3D figures ---------- */

// An SVG label from [text, italic, position] parts, such as λm with an upright λ and an italic m, C₁ as
// [["C", true], ["1", false, "sub"]] or M⁺ as [["M", true], ["+", false, "sup"]]. A subscript or superscript is set
// smaller, lower or higher, and the next part returns to the baseline.
export function mathLabel(parent, cls, parts) {
  const t = el("text", { class: cls }, parent);
  const SIZE = 0.72, SHIFT = { sub: 0.3, sup: -0.45 };   // their size, and how far they move, in ems of the label
  let at = 0;
  for (const [s, italic, pos] of parts) {
    const to = SHIFT[pos] ?? 0, small = to !== 0;
    const a = italic ? { "font-style": "italic" } : {};
    if (small) a["font-size"] = `${SIZE * 100}%`;
    // dy is in ems of the part's own size, so a small part's move is scaled up to match.
    if (to !== at) a.dy = `${(to - at) / (small ? SIZE : 1)}em`;
    at = to;
    el("tspan", Object.keys(a).length ? a : null, t).textContent = s;
  }
  return t;
}

// Gap between two boxes (0 when they overlap), and the box of a point's mark.
const gap = (a, b) => Math.hypot(Math.max(b.x - a.x - a.width, 0, a.x - b.x - b.width), Math.max(b.y - a.y - a.height, 0, a.y - b.y - b.height));
export const markBox = ([x, y], r) => ({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });
const DIRS = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);

// Places label t dist units from point p of space S, trying eight directions but skipping the two along
// `line` (a screen direction the drawn line itself occupies). It keeps the most perpendicular direction
// that leaves the label clear of the obstacles and the edges. With `away`, a longer label is anchored
// on the side away from its point, so it grows outward.
export function placeClear(S, t, p, dist, line, obstacles, away = false) {
  const ln = Math.hypot(line[0], line[1]) || 1;
  const put = (dir) => {
    S.placeLabel(t, p, dir, dist);
    if (away) t.setAttribute("text-anchor", dir[0] < -0.3 ? "end" : dir[0] > 0.3 ? "start" : "middle");
  };
  const candidates = DIRS.map((dir) => ({ dir, along: Math.abs(dir[0] * line[0] + dir[1] * line[1]) / ln }))
    .filter((c) => c.along < 0.9)
    .sort((a, b) => a.along - b.along);
  let best = null;
  for (const { dir } of candidates) {
    put(dir);
    const b = t.getBBox();
    let clear = Math.min(b.x, S.width - b.x - b.width, b.y, S.height - b.y - b.height);
    for (const o of obstacles) clear = Math.min(clear, gap(b, o));
    const score = Math.min(clear, 6);   // 6 units of room is enough; among those, the order prefers perpendicular
    if (!best || score > best.score) best = { dir, score };
  }
  put(best.dir);
}

// Places label t beside point p of space S, `clear` units from it, across the screen direction `line` (the line the
// point lies on), on the side it took last time, kept in memo.side. As the view turns or the point moves, the label
// then glides with them instead of jumping between directions. It changes sides only when its side would leave the
// figure or cover a quarter of itself with one of the obstacles, and the other side would not; grazing an obstacle
// does not move it. Its distance grows with its size across the line, so a long label clears its point at any angle.
export function placeBeside(S, t, p, clear, line, obstacles, memo) {
  const ln = Math.hypot(line[0], line[1]);
  const n = ln > 1e-9 ? [line[1] / ln, -line[0] / ln] : [0, -1];
  // The first time, the side to the right of the line, or above it when the line runs across the screen.
  if (!memo.side) memo.side = n[0] - n[1] >= 0 ? 1 : -1;
  const [px, py] = S.project(p);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("x", 0); t.setAttribute("y", 0);
  const b = t.getBBox();
  const put = (s) => {
    const ux = n[0] * s, uy = n[1] * s, d = clear + (Math.abs(ux) * b.width + Math.abs(uy) * b.height) / 2;
    const cx = px + ux * d, cy = py + uy * d;
    return { x: cx - b.width / 2, y: cy - b.height / 2, width: b.width, height: b.height, cx, cy };
  };
  const covered = (r, o) => Math.max(0, Math.min(r.x + r.width, o.x + o.width) - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + r.height, o.y + o.height) - Math.max(r.y, o.y));
  const blocked = (r) => r.x < 2 || r.y < 2 || r.x + r.width > S.width - 2 || r.y + r.height > S.height - 2 || obstacles.some((o) => covered(r, o) > 0.25 * r.width * r.height);
  if (blocked(put(memo.side)) && !blocked(put(-memo.side))) memo.side = -memo.side;
  const r = put(memo.side);
  t.setAttribute("x", r.cx - (b.x + b.width / 2));
  t.setAttribute("y", r.cy - (b.y + b.height / 2));
}

// The multiples of `step` for which t·v stays inside the figure of space S, within [lo, hi].
export function stepRange(S, v, step, lo, hi) {
  const s = S.span([0, 0, 0], v, 26) ?? [0, 0];
  return [Math.max(lo, Math.ceil(s[0] / step) * step), Math.min(hi, Math.floor(s[1] / step) * step)];
}
// x rounded to a multiple of step and kept within [lo, hi].
export const clampTo = (x, [lo, hi], step) => Math.max(lo, Math.min(hi, Math.round(x / step) * step));
