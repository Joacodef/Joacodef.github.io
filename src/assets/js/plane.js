// Shared toolkit for interactive 2D planes in the notes.
// A plane maps data coordinates in [0, max] x [0, max] to an SVG viewBox,
// with the y axis pointing up. Colors come from CSS classes (see notes.css).

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

// "ax + by + c = 0" with clean signs and unit coefficients.
export function equation(l) {
  const terms = [[l[0], "<i>x</i>"], [l[1], "<i>y</i>"], [l[2], ""]];
  let s = "", first = true;
  for (const [c, v] of terms) {
    if (c === 0) continue;
    const a = Math.abs(c);
    const body = v ? (a === 1 ? v : fmt(a) + v) : fmt(a);
    s += first ? (c < 0 ? MINUS : "") + body : (c < 0 ? ` ${MINUS} ` : " + ") + body;
    first = false;
  }
  return `<span class="nowrap">${s} = 0</span>`;
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

  function toData(ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: (q.x - OX) / S, y: (OY - q.y) / S };
  }

  // Clips the line ax + by + c = 0 to the visible square; returns two endpoints or null.
  function clip(l) {
    const [a, b, c] = l, nn = a * a + b * b;
    if (nn === 0) return null;
    const p0 = [(-a * c) / nn, (-b * c) / nn], len = Math.sqrt(nn), d = [b / len, -a / len];
    let tmin = -Infinity, tmax = Infinity;
    for (let i = 0; i < 2; i++) {
      if (Math.abs(d[i]) < 1e-12) { if (p0[i] < 0 || p0[i] > max) return null; continue; }
      const t1 = -p0[i] / d[i], t2 = (max - p0[i]) / d[i];
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    if (tmin > tmax) return null;
    return [[p0[0] + tmin * d[0], p0[1] + tmin * d[1]], [p0[0] + tmax * d[0], p0[1] + tmax * d[1]]];
  }

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

  function handle(kind) {
    const h = el("g", { class: "handle", tabindex: 0, role: "button" }, svg);
    el("circle", { r: 21, class: "hit" }, h);
    el("circle", { r: kind === "point" ? 13 : 12, class: "ring" }, h);
    el("circle", kind === "point" ? { r: 8, class: "pt-dot" } : { r: 7, class: "grip" }, h);
    return h;
  }

  function place(h, p) { h.setAttribute("transform", `translate(${X(p.x)},${Y(p.y)})`); }

  // Pointer and keyboard dragging with integer snapping.
  function draggable(h, get, set) {
    h.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    h.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { h.setPointerCapture(e.pointerId); } catch {}
      h.classList.add("drag");
      h.focus?.({ preventScroll: true });
      const move = (ev) => set(clampRound(toData(ev)));
      const up = (ev) => {
        try { h.releasePointerCapture(ev.pointerId); } catch {}
        h.classList.remove("drag");
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", up);
        h.removeEventListener("pointercancel", up);
      };
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
    });
    h.addEventListener("keydown", (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const p = get();
      set(clampRound({ x: p.x + d[0], y: p.y + d[1] }));
    });
  }

  return { max, X, Y, el: (tag, attrs) => el(tag, attrs, svg), clip, drawSegment, label, placeAlong, placeLineLabel, handle, place, draggable };
}
