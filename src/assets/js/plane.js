// Shared toolkit for the interactive figures in the notes.
// createPlane maps 2D data coordinates in [0, max] x [0, max] to an SVG viewBox, with the y axis pointing up.
// createSpace draws 3D vectors with a parallel (oblique) projection.
// Colors come from CSS classes (see notes.css).

const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

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

/* ---------- Math formatting (HTML strings) ---------- */

const MINUS = "\u2212";
export function fmt(n) {
  let r = Math.round(n * 100) / 100;
  if (Object.is(r, -0)) r = 0;
  return (r < 0 ? MINUS : "") + String(Math.abs(r));
}
export const isRounded = (n) => Math.round(n * 100) !== n * 100;
export const paren = (n) => (n < 0 ? `(${fmt(n)})` : fmt(n));
export const T = '<sup class="t">T</sup>';
export const sym = (name, sub, cls) => `<span class="${cls}"><i>${name}</i>${sub ? `<sub>${sub}</sub>` : ""}</span>`;
export const col = (arr, cls = "") => `<span class="col ${cls}">${arr.map((v) => `<span>${fmt(v)}</span>`).join("")}</span>`;
export const row = (arr, cls = "") => `<span class="nowrap ${cls}">[${arr.map(fmt).join("&ensp;")}]${T}</span>`;
export const frac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;

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
export function clipLine(l, lo, hi) {
  const [a, b, c] = l, nn = a * a + b * b;
  if (nn === 0) return null;
  const p0 = [(-a * c) / nn, (-b * c) / nn], len = Math.sqrt(nn), d = [b / len, -a / len];
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-12) { if (p0[i] < lo || p0[i] > hi) return null; continue; }
    const t1 = (lo - p0[i]) / d[i], t2 = (hi - p0[i]) / d[i];
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

// Pointer and keyboard dragging. move(s) receives the pointer in SVG units;
// step([dx, dy]) receives an arrow key as a direction, with ArrowUp as [0, 1].
export function makeDraggable(h, { move, step }) {
  const svg = h.ownerSVGElement;
  h.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  h.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch {}
    h.classList.add("drag");
    h.focus?.({ preventScroll: true });
    const onMove = (ev) => move(svgPoint(svg, ev));
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

export function createPlane(svg, { max = 40 } = {}) {
  const S = 10, OX = 34, OY = 422;
  svg.setAttribute("viewBox", "0 0 460 456");
  const X = (x) => OX + S * x;
  const Y = (y) => OY - S * y;

  // Axes with ticks every 5 units and labels every 10.
  const g = el("g", { class: "axes" }, svg);
  el("line", { x1: OX, y1: OY, x2: X(max), y2: OY }, g);
  el("line", { x1: OX, y1: OY, x2: OX, y2: Y(max) }, g);
  for (let v = 0; v <= max; v += 5) {
    const major = v % 10 === 0;
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

  // Places a label next to point p, pushed along dir (flipped if it would leave the plane).
  function placeAlong(t, p, dir, dist) {
    const n = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / n, uy = dir[1] / n;
    let cx = p.x + ux * dist, cy = p.y + uy * dist;
    if (cx < 1.5 || cx > max - 1.5 || cy < 1.5 || cy > max - 1.5) { cx = p.x - ux * dist; cy = p.y - uy * dist; }
    t.setAttribute("x", X(cx)); t.setAttribute("y", Y(cy) + 7); t.setAttribute("text-anchor", "middle");
  }

  // Labels a line near its right end, offset to one side.
  function placeLineLabel(t, l, seg) {
    const [e1, e2] = seg;
    const end = e2[0] > e1[0] + 1e-9 || (Math.abs(e2[0] - e1[0]) < 1e-9 && e2[1] > e1[1]) ? e2 : e1;
    const other = end === e2 ? e1 : e2;
    const dl = Math.hypot(other[0] - end[0], other[1] - end[1]) || 1;
    const back = Math.min(3.2, dl / 2);
    placeAlong(t, { x: end[0] + ((other[0] - end[0]) / dl) * back, y: end[1] + ((other[1] - end[1]) / dl) * back }, [l[0], l[1]], 1.9);
  }

  function place(h, p) { h.setAttribute("transform", `translate(${X(p.x)},${Y(p.y)})`); }

  // Dragging with integer snapping, by pointer or by one unit per arrow key.
  function draggable(h, get, set) {
    makeDraggable(h, {
      move: (s) => set(clampRound(toData(s))),
      step: ([dx, dy]) => { const p = get(); set(clampRound({ x: p.x + dx, y: p.y + dy })); },
    });
  }

  return { max, X, Y, el: (tag, attrs) => el(tag, attrs, svg), clip, drawSegment, label, placeAlong, placeLineLabel, handle: (kind) => makeHandle(svg, kind), place, draggable };
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
    width, height, view, project, offset, toward, onPlane, span, along,
    line, poly, dot, pin, setLine, setPoly, placeLabel, place, setView, turnable,
    el: (tag, attrs, parent = svg) => el(tag, attrs, parent),
  };
}
