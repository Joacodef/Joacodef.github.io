import { createPlane, createSpace, makeHandle, makeDraggable, cross, dot, simplify, clipLine, fmt, isRounded, paren, T, sym, col, row, equation, wholeNumberInput, mathLabel, markBox, placeBeside, stepRange, clampTo, tr } from "../../plane.js";

const ELL = "ℓ";
const scaleVec = (v, t) => v.map((c) => c * t);
const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((c) => c / n); };
// Empties label memories, so a Reset puts the labels back where they first were.
const forget = (...memos) => memos.forEach((m) => { for (const k in m) delete m[k]; });
const show = (els, on) => [].concat(els).forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));
// A point inside a sentence of a readout: (5, 3), or ≈ (7, 4.33) when it is rounded.
const pointText = (x, y) => `${isRounded(x) || isRounded(y) ? "≈ " : ""}<span class="pt nowrap">(${fmt(x)}, ${fmt(y)})</span>`;
// The 2D figures use a plane from 0 to 10 with a faint grid, so their cross products stay small.
const plane10 = (svg) => createPlane(svg, { max: 10, tick: 1, labelStep: 1, grid: true });

// Each readout holds one calculation, the one its section is about, and one sentence that says what it means.

/* ---------- The first state of each figure, and the math the figures and the text share ---------- */

export const SCALE_START = { x: 2, y: 3, lambda: 2 };
export const ON_LINE_START = { l: [1, -2, 4], m: { x: 6, y: 3 } };
export const PLANE_START = { l: [1, 1, -3], lambda: 1 };
export const LINE_START = { m1: { x: 2, y: 1 }, m2: { x: 8, y: 5 } };
export const MEET_START = { p1: { x: 2, y: 1 }, p2: { x: 8, y: 5 }, q1: { x: 2, y: 9 }, q2: { x: 6, y: 1 } };
// Section 6: ℓ1 is fixed, and ℓ2 turns about the fixed point F as the reader drags a point of it, starting at g.
export const PARALLEL = { L1: [2, -3, -1], F: [3, 3], g: { x: 0, y: 3 } };

// The line through two points of the plane.
export const lineThrough = (a, b) => cross([a.x, a.y, 1], [b.x, b.y, 1]);
// Where the lines through p1, p2 and through q1, q2 cross, each line first divided down to its simplest form.
export function meetOf(st) {
  const s1 = simplify(lineThrough(st.p1, st.p2)).v, s2 = simplify(lineThrough(st.q1, st.q2)).v;
  return { s1, s2, m: cross(s1, s2) };
}
// Section 6: ℓ2 through F and g, and where it meets ℓ1.
export function parallelOf(g) {
  const l2 = simplify(cross([...PARALLEL.F, 1], [g.x, g.y, 1])).v;
  return { l2, m: cross(PARALLEL.L1, l2) };
}

/* ---------- Figure 1: every multiple λm lies on one line through the origin, which crosses the plane r = 1 at m ---------- */
function scaledPoint() {
  const svg = document.getElementById("fig-scale");
  const out = document.getElementById("fig-scale-out");
  if (!svg || !out) return;
  // The r axis is drawn 1.6 times longer than p and q, so the plane r = 1 stands clear of the floor.
  // Nothing in this figure depends on angles, so the stretch changes no conclusion.
  const VIEW = [-25, 25];
  const S = createSpace(svg, { scale: 41.5, stretch: 1.6, pivot: [1.5, 1.5, 0.7], at: [211, 254], yaw: VIEW[0], pitch: VIEW[1] });
  const LO = -1, HI = 4, EDGE = 0.5, STEP = 0.5;
  const c0 = LO - EDGE, c1 = HI + EDGE;
  let st = { ...SCALE_START };

  // Layers, back to front. What lies below the plane r = 1 is drawn before its translucent panel,
  // so the panel dims it where they overlap; what lies above the plane is drawn after it.
  const below = S.el("g"), panel = S.el("g"), above = S.el("g"), labels = S.el("g"), marks = S.el("g"), handles = S.el("g");

  // Axes of the space, meeting at the origin. The r axis passes through the plane at the plane's origin.
  const floor = S.el("g", { class: "axes" }, below);
  S.line(floor, [0, 0, 0], [4.9, 0, 0]);
  S.line(floor, [0, 0, 0], [0, 2, 0]);
  S.line(floor, [0, 0, 0], [0, 0, 1]);
  S.line(S.el("g", { class: "axes" }, above), [0, 0, 1], [0, 0, 2.6]);
  S.dot(below, [0, 0, 0], 3, "origin");
  // Labels that never move, drawn above everything so a plane never dims them.
  const pinned = (parent, cls, parts, v, dir, dist) => S.pin(mathLabel(parent, cls, parts), v, dir, dist);
  pinned(labels, "axl", [["p", true]], [4.9, 0, 0], [1, 0, 0], 14);
  pinned(labels, "axl", [["q", true]], [0, 2, 0], [0, 1, 0], 14);
  pinned(labels, "axl", [["r", true]], [0, 0, 2.6], [-1, -0.3], 13);

  // The plane r = 1: a translucent panel with an integer grid and its own x and y axes.
  S.poly(panel, [[c0, c0, 1], [c1, c0, 1], [c1, c1, 1], [c0, c1, 1]], "panel");
  const grid = S.el("g", { class: "grid" }, panel);
  for (let v = LO; v <= HI; v++) {
    if (v === 0) continue;
    S.line(grid, [v, c0, 1], [v, c1, 1]);
    S.line(grid, [c0, v, 1], [c1, v, 1]);
  }
  const planeAxes = S.el("g", { class: "axes" }, panel);
  S.line(planeAxes, [c0, 0, 1], [c1, 0, 1]);
  S.line(planeAxes, [0, c0, 1], [0, c1, 1]);
  pinned(labels, "axl", [["x", true]], [c1, 0, 1], [1, 0, 0], 13);
  pinned(labels, "axl", [["y", true]], [0, c1, 1], [0, 1, 0], 13);
  pinned(labels, "plane-lab", [["r", true], [" = 1"]], [c0, c0, 1], [-1, -1, 0], 26);

  // The line through the origin and m, split where it crosses the plane; m; and the vector λm.
  const rayBelow = S.el("line", { class: "ray" }, below);
  const rayAbove = S.el("line", { class: "ray" }, above);
  const ring = S.el("circle", { r: 11, class: "pt-ring" }, marks);
  const dotM = S.el("circle", { r: 8, class: "pt-dot" }, marks);
  const labM = mathLabel(marks, "pt-lab", [["m", true]]);
  const labL = mathLabel(marks, "pt-lab", [["λ"], ["m", true]]);
  const labBoth = mathLabel(marks, "pt-lab", [["λ"], ["m", true], [" = "], ["m", true]]);   // at λ = 1
  const hM = makeHandle(handles, "none"), hL = makeHandle(handles, "none", 16);
  // Each moving label keeps its side of the red line from one frame to the next.
  const sideM = {}, sideL = {};

  // λ moves in steps of 0.5, as far as λm stays inside the figure.
  const lambdaRange = (m3) => stepRange(S, m3, STEP, -2, 3);
  const clampPoint = (p) => ({ x: Math.max(LO, Math.min(HI, Math.round(p.x))), y: Math.max(LO, Math.min(HI, Math.round(p.y))) });

  function render() {
    const { x, y } = st, m3 = [x, y, 1];
    const L = clampTo(st.lambda, lambdaRange(m3), STEP);
    const v = scaleVec(m3, L);

    const [t0, t1] = S.span([0, 0, 0], m3, 8);
    S.setLine(rayBelow, scaleVec(m3, t0), m3);
    S.setLine(rayAbove, m3, scaleVec(m3, t1));
    // Below the plane (λ < 1) the ring goes under the panel; otherwise it sits under m's dot, so at λ = 1 it circles m.
    if (L < 1) below.appendChild(ring); else marks.insertBefore(ring, dotM);
    const [vx, vy] = S.project(v), [mx, my] = S.project(m3);
    ring.setAttribute("cx", vx); ring.setAttribute("cy", vy);
    dotM.setAttribute("cx", mx); dotM.setAttribute("cy", my);

    // Labels beside the line, on the side they had before unless it would leave the figure or cover the other point.
    // They may pass over an axis label as the view turns, which reads better than a jump to the other side.
    // At λ = 1 one label names both.
    const d = S.offset(m3), boxes = [];
    const one = L === 1;
    show([labM, labL], !one);
    show(labBoth, one);
    if (one) {
      placeBeside(S, labBoth, m3, 12, d, boxes, sideM);
    } else {
      placeBeside(S, labM, m3, 12, d, [...boxes, markBox([vx, vy], 13)], sideM);
      placeBeside(S, labL, v, 16, d, [...boxes, markBox([mx, my], 10), labM.getBBox()], sideL);
    }

    S.place(hM, m3); S.place(hL, v);
    hM.setAttribute("aria-label", tr(`Point m at (${fmt(x)}, ${fmt(y)}) on the plane r = 1. Use the arrow keys to move it.`, `Punto m en (${fmt(x)}, ${fmt(y)}), sobre el plano r = 1. Usa las flechas del teclado para moverlo.`));
    hL.setAttribute("aria-label", tr(`Vector λm with λ = ${fmt(L)}. Use the arrow keys to slide it along the line.`, `Vector λm con λ = ${fmt(L)}. Usa las flechas del teclado para deslizarlo por la recta.`));

    const mv = sym("m", "", "pt"), lm = `λ${mv}`;
    let html = `<p class="eq"><span class="nowrap">${lm} = ${fmt(L)}&thinsp;${col(m3, "pt")}</span> <span class="nowrap">= ${col(v, "pt")}</span></p>`;
    if (L === 0) html += `<p class="muted">${tr("λ = 0 gives the origin, which stands for no point.", "λ = 0 da el origen, que no representa ningún punto.")}</p>`;
    else if (L === 1) html += `<p>${tr(`Here <i>r</i> = 1 already: this is ${mv} itself.`, `Aquí ya <i>r</i> = 1: es el mismo ${mv}.`)}</p>`;
    else html += `<p>${tr(`Divide by <span class="nowrap"><i>r</i> = ${fmt(L)}</span> and you are back at ${pointText(x, y)}: the same point.`, `Al dividir por <span class="nowrap"><i>r</i> = ${fmt(L)}</span> vuelves a ${pointText(x, y)}: el mismo punto.`)}</p>`;
    out.innerHTML = html;
  }

  makeDraggable(hM, {
    move: (s) => { Object.assign(st, clampPoint(S.onPlane(s, 1))); render(); },
    step: ([dx, dy]) => { Object.assign(st, clampPoint({ x: st.x + dx, y: st.y + dy })); render(); },
  });
  // st.lambda keeps the λ the reader chose; when m moves somewhere that λ would leave the figure, the drawing clamps it.
  makeDraggable(hL, {
    move: (s) => { const m3 = [st.x, st.y, 1]; st.lambda = clampTo(S.along([0, 0, 0], m3, s), lambdaRange(m3), STEP); render(); },
    step: ([dx, dy]) => {
      const range = lambdaRange([st.x, st.y, 1]);
      st.lambda = clampTo(clampTo(st.lambda, range, STEP) + STEP * (dx + dy), range, STEP);
      render();
    },
  });
  S.turnable(render);
  document.getElementById("fig-scale-reset")?.addEventListener("click", () => { st = { ...SCALE_START }; forget(sideM, sideL); S.setView(...VIEW); render(); });
  render();
}

/* ---------- Figure 2: a line is three numbers, and a point lies on it when ℓᵀm = 0 ---------- */
function pointOnLine() {
  const svg = document.getElementById("fig-on-line");
  const out = document.getElementById("fig-on-line-out");
  const eq = document.getElementById("fig-on-line-eq");
  const inputs = ["a", "b", "c"].map((k) => document.getElementById(`fig-on-line-${k}`));
  if (!svg || !out || !eq || inputs.some((i) => !i)) return;
  const P = plane10(svg);
  const LIMIT = 9;
  let st = structuredClone(ON_LINE_START);

  // From back to front: the guide from m to the line, the line, the ring on it, and m.
  const guide = P.el("line", { class: "guide" });
  const line = P.el("line", { class: "ln-path" });
  const lLab = P.label("ln-lab", ELL);
  const ring = P.el("circle", { r: 9, class: "pt-ring thin" });
  const mLab = P.label("pt-lab", "m");
  const h = P.handle("point");
  let side = 1;   // the side of the line m's label is on
  const lineMemo = {};   // where the line's label was, so it stays at the same end of the line
  // Only whole numbers change the line; while a field holds anything else (a lone minus sign, say), the figure waits.
  const shows = inputs.map((inp, i) => wholeNumberInput(inp, { min: -LIMIT, max: LIMIT, get: () => st.l[i], set: (v) => { st.l[i] = v; render(); } }));

  function render() {
    const l = st.l, [a, b, c] = l, { x, y } = st.m, m = [x, y, 1];
    shows.forEach((s, i) => s(l[i]));
    eq.innerHTML = equation(l);
    const none = a === 0 && b === 0;
    const seg = none ? null : P.clip(l);
    P.drawSegment(line, seg);
    show(lLab, !!seg);
    if (seg) P.placeLineLabel(lLab, l, seg, lineMemo);
    P.place(h, st.m);
    const v = dot(l, m);
    // The line's point with m's x, y = −(ax + c)/b, marked with a ring while m is off the line.
    const yl = b !== 0 ? -(a * x + c) / b : null;
    const ringOn = yl !== null && v !== 0 && yl >= 0 && yl <= P.max;
    show([ring, guide], ringOn);
    if (ringOn) {
      ring.setAttribute("cx", P.X(x)); ring.setAttribute("cy", P.Y(yl));
      guide.setAttribute("x1", P.X(x)); guide.setAttribute("y1", P.Y(y));
      guide.setAttribute("x2", P.X(x)); guide.setAttribute("y2", P.Y(yl));
    }
    // m's label goes along the line's normal, on the side away from the line, so it never covers the guide.
    // On the line it keeps the side it had, so it moves over only when m crosses to the other side.
    if (v !== 0) side = v < 0 ? -1 : 1;
    P.placeAlong(mLab, st.m, none ? [1, 1] : [side * a, side * b], 2.3);
    h.setAttribute("aria-label", tr(`Point m at (${x}, ${y}). Use the arrow keys to move it.`, `Punto m en (${x}, ${y}). Usa las flechas del teclado para moverlo.`));

    const mv = sym("m", "", "pt");
    if (none) {
      out.innerHTML = `<p class="muted">${c === 0
        ? tr("The zero vector describes no line.", "El vector cero no describe ninguna recta.")
        : tr(`With <i>a</i> = <i>b</i> = 0 the equation reads ${fmt(c)} = 0, which no point satisfies. Section 6 gives this vector a meaning.`, `Con <i>a</i> = <i>b</i> = 0 la ecuación queda ${fmt(c)} = 0, que ningún punto cumple. La sección 6 le da un sentido a este vector.`)}</p>`;
      return;
    }
    const s = simplify(l);
    let html = `<p>${sym(ELL, "", "ln")}${T}${mv} = <span class="nowrap">${paren(a)}·${x}</span> + <span class="nowrap">${paren(b)}·${y}</span> + <span class="nowrap">${paren(c)}·1 = ${fmt(v)}${v === 0 ? ' <span class="ok">✓</span>' : ""}</span></p>`;
    const same = s.d !== 1 ? tr(` This vector is ${fmt(s.d)} times ${row(s.v, "ln")}: the same line.`, ` Este vector es ${fmt(s.d)} veces ${row(s.v, "ln")}: la misma recta.`) : "";
    html += `<p class="muted">${v === 0
      ? tr(`Zero: ${mv} lies on the line.`, `Cero: ${mv} está en la recta.`)
      : tr(`Not zero, so ${mv} is off the line.`, `No es cero, así que ${mv} está fuera de la recta.`)}${same}</p>`;
    out.innerHTML = html;
  }

  P.draggable(h, () => st.m, (p) => { st.m = p; render(); });
  document.getElementById("fig-on-line-reset")?.addEventListener("click", () => { st = structuredClone(ON_LINE_START); side = 1; forget(lineMemo); render(); });
  render();
}

/* ---------- Figure 3: a line is a plane through the origin, and ℓ = [a b c] is perpendicular to that plane ---------- */
function lineAsPlane() {
  const svg = document.getElementById("fig-plane");
  const out = document.getElementById("fig-plane-out");
  const eq = document.getElementById("fig-plane-eq");
  const inputs = ["a", "b", "c"].map((k) => document.getElementById(`fig-plane-${k}`));
  if (!svg || !out || !eq || inputs.some((i) => !i)) return;
  // A true view, with no stretch, so the right angle between ℓ and its plane looks like one.
  const VIEW = [-30, 22];
  const S = createSpace(svg, { scale: 50.6, pivot: [1.5, 1.5, 0], at: [212, 259], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-135, 45] });
  const EDGE = 4.5, TOP = 1.4, LIMIT = 9;
  let st = structuredClone(PLANE_START);

  // Layers, back to front, as in figure 1: below the plane r = 1, its panel, above it, marks, handles.
  const below = S.el("g"), panel = S.el("g"), above = S.el("g"), labels = S.el("g"), marks = S.el("g"), handles = S.el("g");

  const floor = S.el("g", { class: "axes" }, below);
  S.line(floor, [0, 0, 0], [4.9, 0, 0]);
  S.line(floor, [0, 0, 0], [0, 2, 0]);
  S.line(floor, [0, 0, 0], [0, 0, 1]);
  S.line(S.el("g", { class: "axes" }, above), [0, 0, 1], [0, 0, 2.4]);
  S.dot(below, [0, 0, 0], 3, "origin");
  const fixed = [];
  const pinned = (parent, cls, parts, v, dir, dist) => { const t = S.pin(mathLabel(parent, cls, parts), v, dir, dist); fixed.push(t); return t; };
  pinned(labels, "axl", [["p", true]], [4.9, 0, 0], [1, 0, 0], 14);
  pinned(labels, "axl", [["q", true]], [0, 2, 0], [0, 1, 0], 14);
  pinned(labels, "axl", [["r", true]], [0, 0, 2.4], [-1, -0.3], 13);

  // The plane r = 1. Only its quarter with x, y ≥ 0 is drawn: for any line that crosses that quarter,
  // the perpendicular λℓ reaches r = 1 outside it, so λℓ is never mistaken for a point of the plane.
  S.poly(panel, [[0, 0, 1], [EDGE, 0, 1], [EDGE, EDGE, 1], [0, EDGE, 1]], "panel");
  const grid = S.el("g", { class: "grid" }, panel);
  for (let v = 1; v <= 4; v++) {
    S.line(grid, [v, 0, 1], [v, EDGE, 1]);
    S.line(grid, [0, v, 1], [EDGE, v, 1]);
  }
  const planeAxes = S.el("g", { class: "axes" }, panel);
  S.line(planeAxes, [0, 0, 1], [EDGE, 0, 1]);
  S.line(planeAxes, [0, 0, 1], [0, EDGE, 1]);
  pinned(labels, "axl", [["x", true]], [EDGE, 0, 1], [1, 0, 0], 13);
  pinned(labels, "axl", [["y", true]], [0, EDGE, 1], [0, 1, 0], 13);
  pinned(labels, "plane-lab", [["r", true], [" = 1"]], [EDGE, EDGE, 1], [1, 1, 0], 26);

  // ℓ's plane through the origin, drawn as the rays from the origin through the points of the line:
  // a triangle below r = 1 and a band above it. With a = b = 0 it is the plane r = 0, drawn around the origin.
  const fanLow = S.el("polygon", { class: "fan" }, below);
  const fanHigh = S.el("polygon", { class: "fan" }, above);
  const edgeLow = [0, 1].map(() => S.el("line", { class: "fan-edge" }, below));
  const edgeHigh = [0, 1].map(() => S.el("line", { class: "fan-edge" }, above));
  const lineL = S.el("line", { class: "ln-path" }, above);
  const labLine = mathLabel(above, "ln-lab", [[ELL, true]]);
  // The vector λℓ, split where it crosses r = 1, with a right-angle mark where it leaves its plane.
  const vecLow = S.el("line", { class: "vec" }, below);
  const vecHigh = S.el("line", { class: "vec" }, above);
  const corner = S.el("polyline", { class: "right-angle" }, below);
  const ring = S.el("circle", { r: 11, class: "ln-ring" }, marks);
  const labVec = mathLabel(marks, "ln-lab", [["λ"], [ELL, true]]);
  const hL = makeHandle(handles, "none", 16);
  const sideLine = {}, sideVec = {};

  // λ moves in steps of 0.5, or finer when ℓ is long, as far as λℓ stays inside the figure.
  function lambdaSteps(l) {
    const s = S.span([0, 0, 0], l, 26) ?? [0, 0];
    const step = [0.5, 0.25, 0.1].find((k) => s[1] >= k || s[0] <= -k) ?? 0.1;
    return { step, range: stepRange(S, l, step, -3, 3) };
  }

  // Only whole numbers change the line; while a field holds anything else (a lone minus sign, say), the figure waits.
  const shows = inputs.map((inp, i) => wholeNumberInput(inp, { min: -LIMIT, max: LIMIT, get: () => st.l[i], set: (v) => { st.l[i] = v; render(); } }));

  function render() {
    const l = st.l;
    shows.forEach((s, i) => s(l[i]));
    const zero = l.every((c) => c === 0), flat = !zero && l[0] === 0 && l[1] === 0;
    const { step, range } = zero ? { step: 0.5, range: [0, 0] } : lambdaSteps(l);
    const L = zero ? 0 : clampTo(st.lambda, range, step);
    const v = scaleVec(l, L);
    eq.innerHTML = equation(l);

    // Where ℓ's plane meets r = 1 (the line), and the rays from the origin through it.
    const seg = flat || zero ? null : clipLine(l, 0, EDGE);
    let inPlane = null;   // a direction inside ℓ's plane, for the right-angle mark
    let lineBox = null;
    if (seg) {
      const A = [seg[0][0], seg[0][1], 1], B = [seg[1][0], seg[1][1], 1];
      S.setPoly(fanLow, [[0, 0, 0], A, B]);
      S.setPoly(fanHigh, [A, B, scaleVec(B, TOP), scaleVec(A, TOP)]);
      S.setLine(edgeLow[0], [0, 0, 0], A); S.setLine(edgeLow[1], [0, 0, 0], B);
      S.setLine(edgeHigh[0], A, scaleVec(A, TOP)); S.setLine(edgeHigh[1], B, scaleVec(B, TOP));
      S.setLine(lineL, A, B);
      show([fanLow, fanHigh, ...edgeLow, ...edgeHigh, lineL, labLine], true);
      inPlane = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, 1];
      const Pt = [A[0] + 0.8 * (B[0] - A[0]), A[1] + 0.8 * (B[1] - A[1]), 1];
      placeBeside(S, labLine, Pt, 10, S.offset([B[0] - A[0], B[1] - A[1], 0]), fixed.map((t) => t.getBBox()), sideLine);
      lineBox = labLine.getBBox();
    } else if (flat) {
      S.setPoly(fanLow, [[-1.2, -1.2, 0], [1.2, -1.2, 0], [1.2, 1.2, 0], [-1.2, 1.2, 0]]);
      show([fanLow], true);
      show([fanHigh, ...edgeLow, ...edgeHigh, lineL, labLine], false);
      inPlane = [1, 0, 0];
    } else {
      show([fanLow, fanHigh, ...edgeLow, ...edgeHigh, lineL, labLine], false);
    }

    // λℓ, split where it crosses r = 1, and drawn in front of its plane or behind it,
    // depending on which side of the plane faces the reader.
    show([ring, labVec], !zero);
    show([vecLow, corner], L !== 0);
    show([vecHigh], L !== 0 && v[2] > 1);
    if (L !== 0) {
      const cut = v[2] > 1 ? scaleVec(v, 1 / v[2]) : v;
      S.setLine(vecLow, [0, 0, 0], cut);
      if (v[2] > 1) S.setLine(vecHigh, cut, v);
      if (dot(v, S.toward()) > 0) {
        below.append(fanLow, ...edgeLow, vecLow, corner);
        above.append(fanHigh, ...edgeHigh, lineL, labLine, vecHigh);
      } else {
        below.append(vecLow, corner, fanLow, ...edgeLow);
        above.append(vecHigh, fanHigh, ...edgeHigh, lineL, labLine);
      }
      if (inPlane) {
        const n = unit(v), u = unit(inPlane), k = 0.4;
        corner.setAttribute("points", [scaleVec(u, k), [k * (u[0] + n[0]), k * (u[1] + n[1]), k * (u[2] + n[2])], scaleVec(n, k)].map((p) => S.project(p).join(",")).join(" "));
      } else {
        show([corner], false);
      }
    }
    const [vx, vy] = S.project(v);
    ring.setAttribute("cx", vx); ring.setAttribute("cy", vy);
    S.place(hL, v);
    if (!zero) placeBeside(S, labVec, v, 16, S.offset(l), [...fixed.map((t) => t.getBBox()), ...(lineBox ? [lineBox] : [])], sideVec);
    hL.setAttribute("aria-label", tr(`Vector λℓ with λ = ${fmt(L)}. Use the arrow keys to slide it along its line.`, `Vector λℓ con λ = ${fmt(L)}. Usa las flechas del teclado para deslizarlo por su recta.`));

    const lv = `λ${sym(ELL, "", "ln")}`, PQR = ["p", "q", "r"], r1 = '<span class="nowrap"><i>r</i> = 1</span>';
    let html;
    if (zero) {
      html = `<p class="muted">${tr("The zero vector is perpendicular to every vector, so it picks out no plane and no line.", "El vector cero es perpendicular a todos los vectores, así que no define ningún plano ni ninguna recta.")}</p>`;
    } else {
      html = `<p class="eq"><span class="nowrap">${lv} = ${fmt(L)}&thinsp;${col(l, "ln")}</span> <span class="nowrap">= ${col(v, "ln")}</span></p>`;
      if (L === 0) html += `<p class="muted">${tr("λ = 0 gives the zero vector, which picks out no plane.", "λ = 0 da el vector cero, que no define ningún plano.")}</p>`;
      else if (flat) html += `<p class="muted">${tr(`With <i>a</i> = <i>b</i> = 0 its plane is the floor, <i>r</i> = 0, which never meets ${r1}.`, `Con <i>a</i> = <i>b</i> = 0 su plano es el suelo, <i>r</i> = 0, que nunca corta a ${r1}.`)}</p>`;
      else html += `<p>${tr(`Its plane, ${equation(v, PQR)}, is the same for every λ ≠ 0 and meets ${r1} in the line ${sym(ELL, "", "ln")}${seg ? "" : ", outside the drawn part"}.`, `Su plano, ${equation(v, PQR)}, es el mismo para todo λ ≠ 0 y corta a ${r1} en la recta ${sym(ELL, "", "ln")}${seg ? "" : ", fuera de la parte dibujada"}.`)}</p>`;
    }
    out.innerHTML = html;
  }

  // st.lambda keeps the λ the reader chose; the drawing clamps it to what fits.
  makeDraggable(hL, {
    move: (s) => { const { step, range } = lambdaSteps(st.l); st.lambda = clampTo(S.along([0, 0, 0], st.l, s), range, step); render(); },
    step: ([dx, dy]) => {
      const { step, range } = lambdaSteps(st.l);
      st.lambda = clampTo(clampTo(st.lambda, range, step) + step * (dx + dy), range, step);
      render();
    },
  });
  S.turnable(render);
  document.getElementById("fig-plane-reset")?.addEventListener("click", () => { st = structuredClone(PLANE_START); forget(sideLine, sideVec); S.setView(...VIEW); render(); });
  render();
}

/* ---------- Figure 4: the line through two points, ℓ = m1 × m2 ---------- */
function lineThroughPoints() {
  const svg = document.getElementById("fig-line");
  const out = document.getElementById("fig-line-out");
  if (!svg || !out) return;
  const P = plane10(svg);
  let st = structuredClone(LINE_START);

  const line = P.el("line", { class: "ln-path" });
  const lLab = P.label("ln-lab", ELL);
  const lab1 = P.label("pt-lab", "m", "1");
  const lab2 = P.label("pt-lab", "m", "2");
  const h1 = P.handle("point"), h2 = P.handle("point");
  const sides = [{}, {}];   // each label keeps the side it took at an edge of the plane
  const lineMemo = {};   // where the line's label was, so it stays at the same end of the line

  function render() {
    const { m1: a, m2: b } = st;
    const m1 = [a.x, a.y, 1], m2 = [b.x, b.y, 1];
    const l = lineThrough(a, b);
    P.place(h1, a); P.place(h2, b);
    h1.setAttribute("aria-label", tr(`Point m1 at (${a.x}, ${a.y}). Use the arrow keys to move it.`, `Punto m1 en (${a.x}, ${a.y}). Usa las flechas del teclado para moverlo.`));
    h2.setAttribute("aria-label", tr(`Point m2 at (${b.x}, ${b.y}). Use the arrow keys to move it.`, `Punto m2 en (${b.x}, ${b.y}). Usa las flechas del teclado para moverlo.`));

    let html = `<p class="eq"><span class="nowrap">${sym(ELL, "", "ln")} = ${col(m1, "pt")} × ${col(m2, "pt")}</span> <span class="nowrap">= ${col(l, "ln")}</span></p>`;
    if (l[0] === 0 && l[1] === 0) {
      P.drawSegment(line, null);
      show(lLab, false);
      P.placeAlong(lab1, a, [1, 1], 2.3); P.placeAlong(lab2, b, [-1, -1], 2.3);
      out.innerHTML = html + `<p class="muted">${tr("The points coincide, so the cross product is zero: no line. Move them apart.", "Los puntos coinciden, así que el producto cruz es cero: ninguna recta. Sepáralos.")}</p>`;
      return;
    }
    const seg = P.clip(l);
    P.drawSegment(line, seg);
    show(lLab, !!seg);
    if (seg) P.placeLineLabel(lLab, l, seg, lineMemo);
    P.placeAlong(lab1, a, [-l[0], -l[1]], 2.3, sides[0]);
    P.placeAlong(lab2, b, [-l[0], -l[1]], 2.3, sides[1]);

    const s = simplify(l);
    const by = s.d === 1 ? tr("That is", "Es decir,") : s.d === -1 ? tr("With the signs flipped, that is", "Con los signos cambiados, es") : tr(`Divided by ${fmt(s.d)}, that is`, `Dividido por ${fmt(s.d)}, es`);
    html += `<p>${by} ${equation(s.v)}${tr(", and both points satisfy it.", ", y ambos puntos la cumplen.")}</p>`;
    out.innerHTML = html;
  }

  P.draggable(h1, () => st.m1, (p) => { st.m1 = p; render(); });
  P.draggable(h2, () => st.m2, (p) => { st.m2 = p; render(); });
  document.getElementById("fig-line-reset")?.addEventListener("click", () => { st = structuredClone(LINE_START); forget(...sides, lineMemo); render(); });
  render();
}

/* ---------- Figure 5: the intersection of two lines, m = ℓ1 × ℓ2 ---------- */
function intersection() {
  const svg = document.getElementById("fig-meet");
  const out = document.getElementById("fig-meet-out");
  if (!svg || !out) return;
  const P = plane10(svg);
  let st = structuredClone(MEET_START);

  const line1 = P.el("line", { class: "ln-path" });
  const line2 = P.el("line", { class: "ln-path dash" });
  const lab1 = P.label("ln-lab", ELL, "1");
  const lab2 = P.label("ln-lab", ELL, "2");
  const dotG = P.el("circle", { r: 8.5, class: "pt-dot" });
  const mLab = P.label("pt-lab", "m");
  const keys = ["p1", "p2", "q1", "q2"];
  const hs = Object.fromEntries(keys.map((k) => [k, P.handle("grip")]));
  let labDir = null;   // the direction m's label took last time
  const lineMemos = [{}, {}];   // where each line's label was, so it stays at the same end of its line

  function render() {
    for (const k of keys) {
      P.place(hs[k], st[k]);
      hs[k].setAttribute("aria-label", tr(`Point of line ${k[0] === "p" ? 1 : 2} at (${st[k].x}, ${st[k].y}). Use the arrow keys to move it.`, `Punto de la recta ${k[0] === "p" ? 1 : 2} en (${st[k].x}, ${st[k].y}). Usa las flechas del teclado para moverlo.`));
    }
    const l1 = lineThrough(st.p1, st.p2), l2 = lineThrough(st.q1, st.q2);
    const bad1 = l1[0] === 0 && l1[1] === 0, bad2 = l2[0] === 0 && l2[1] === 0;
    const seg1 = bad1 ? null : P.clip(l1), seg2 = bad2 ? null : P.clip(l2);
    P.drawSegment(line1, seg1); P.drawSegment(line2, seg2);
    show(lab1, !!seg1); show(lab2, !!seg2);
    if (seg1) P.placeLineLabel(lab1, l1, seg1, lineMemos[0]);
    if (seg2) P.placeLineLabel(lab2, l2, seg2, lineMemos[1]);

    if (bad1 || bad2) {
      show([dotG, mLab], false);
      out.innerHTML = `<p class="muted">${tr(`Both circles of ${sym(ELL, bad1 ? "1" : "2", "ln")} sit on the same point, which defines no line. Move them apart.`, `Los dos círculos de ${sym(ELL, bad1 ? "1" : "2", "ln")} están en el mismo punto, que no define ninguna recta. Sepáralos.`)}</p>`;
      return;
    }
    const { s1, s2, m } = meetOf(st);
    let html = `<p class="eq"><span class="nowrap">${sym("m", "", "pt")} = ${col(s1, "ln")} × ${col(s2, "ln")}</span> <span class="nowrap">= ${col(m, "pt")}</span></p>`;
    if (m[2] === 0) {
      show([dotG, mLab], false);
      html += `<p class="muted">${m[0] === 0 && m[1] === 0
        ? tr("The lines coincide, so every point of one is on the other.", "Las rectas coinciden, así que cada punto de una está en la otra.")
        : tr("<i>r</i> = 0: the lines are parallel, and there is nothing to divide by. Section 6 shows what this vector is.", "<i>r</i> = 0: las rectas son paralelas, y no hay nada por lo cual dividir. La sección 6 muestra qué es este vector.")}</p>`;
      out.innerHTML = html;
      return;
    }
    const xi = m[0] / m[2], yi = m[1] / m[2];
    const inside = xi >= 0 && xi <= P.max && yi >= 0 && yi <= P.max;
    html += `<p>${tr(`Divided by <span class="nowrap"><i>r</i> = ${fmt(m[2])}</span>: the point ${pointText(xi, yi)}${inside ? "" : ", off the plot"}.`, `Dividido por <span class="nowrap"><i>r</i> = ${fmt(m[2])}</span>: el punto ${pointText(xi, yi)}${inside ? "" : ", fuera del gráfico"}.`)}</p>`;
    show([dotG, mLab], inside);
    if (inside) {
      dotG.setAttribute("transform", `translate(${P.X(xi)},${P.Y(yi)})`);
      // The label sits on the bisector of one of the four angles between the lines: at first the widest, and then
      // the one closest to where it was, as long as that angle stays at least 50° wide.
      const n1 = Math.hypot(s1[0], s1[1]), n2 = Math.hypot(s2[0], s2[1]);
      const d1 = [s1[1] / n1, -s1[0] / n1], d2 = [s2[1] / n2, -s2[0] / n2];
      const cosA = d1[0] * d2[0] + d1[1] * d2[1];
      const bis = (u, w) => { const n = Math.hypot(u, w) || 1; return [u / n, w / n]; };
      const angle = Math.acos(Math.max(-1, Math.min(1, cosA)));   // between d1 and d2; the other angle is π − angle
      const cands = [[bis(d1[0] + d2[0], d1[1] + d2[1]), angle], [bis(d1[0] - d2[0], d1[1] - d2[1]), Math.PI - angle]]
        .flatMap(([u, w]) => [[u, w], [[-u[0], -u[1]], w]]);
      const wide = cands.filter(([, w]) => w >= (50 * Math.PI) / 180);
      const pick = labDir
        ? wide.reduce((best, c) => (c[0][0] * labDir[0] + c[0][1] * labDir[1] > best[0][0] * labDir[0] + best[0][1] * labDir[1] ? c : best))
        : cands.reduce((best, c) => (c[1] > best[1] ? c : best));
      const used = P.placeAlong(mLab, { x: xi, y: yi }, pick[0], 2.6);
      labDir = [used * pick[0][0], used * pick[0][1]];
    }
    out.innerHTML = html;
  }

  for (const k of keys) P.draggable(hs[k], () => st[k], (p) => { st[k] = p; render(); });
  document.getElementById("fig-meet-reset")?.addEventListener("click", () => { st = structuredClone(MEET_START); labDir = null; forget(...lineMemos); render(); });
  render();
}

/* ---------- Figure 6: parallel lines meet at an ideal point, where their planes meet on the floor r = 0 ---------- */
function parallelLines() {
  const svg = document.getElementById("fig-parallel");
  const out = document.getElementById("fig-parallel-out");
  if (!svg || !out) return;
  // Only lines, planes and where they meet matter here, so the r axis is stretched to show the planes clearly.
  // The view looks at the plane from the side where both lines run away from the reader.
  const VIEW = [20, 26];
  const S = createSpace(svg, { scale: 38, stretch: 2.4, pivot: [2, 2, 0.5], at: [224, 250], yaw: VIEW[0], pitch: VIEW[1] });
  const LO = -1, HI = 5, EDGE = 0.5, c0 = LO - EDGE, c1 = HI + EDGE;
  const { L1, F } = PARALLEL;
  let st = { g: { ...PARALLEL.g } };

  // Layers, back to front, as in figure 1.
  const below = S.el("g"), panel = S.el("g"), above = S.el("g"), labels = S.el("g"), marks = S.el("g"), handles = S.el("g");

  const floor = S.el("g", { class: "axes" }, below);
  S.line(floor, [0, 0, 0], [c1 + 0.6, 0, 0]);
  S.line(floor, [0, 0, 0], [0, c1 + 0.6, 0]);
  S.line(floor, [0, 0, 0], [0, 0, 1]);
  S.line(S.el("g", { class: "axes" }, above), [0, 0, 1], [0, 0, 1.8]);
  S.dot(below, [0, 0, 0], 3, "origin");
  const fixed = [];
  const pinned = (parent, cls, parts, v, dir, dist) => { const t = S.pin(mathLabel(parent, cls, parts), v, dir, dist); fixed.push(t); return t; };
  pinned(labels, "axl", [["p", true]], [c1 + 0.6, 0, 0], [1, 0, 0], 14);
  pinned(labels, "axl", [["q", true]], [0, c1 + 0.6, 0], [0, 1, 0], 14);
  pinned(labels, "axl", [["r", true]], [0, 0, 1.8], [-1, -0.3], 13);

  // The plane r = 1, lighter than in figure 1 so the red line shows through it when it lies on the floor.
  S.poly(panel, [[c0, c0, 1], [c1, c0, 1], [c1, c1, 1], [c0, c1, 1]], "panel clear");
  const grid = S.el("g", { class: "grid" }, panel);
  for (let v = LO; v <= HI; v++) {
    if (v === 0) continue;
    S.line(grid, [v, c0, 1], [v, c1, 1]);
    S.line(grid, [c0, v, 1], [c1, v, 1]);
  }
  const planeAxes = S.el("g", { class: "axes" }, panel);
  S.line(planeAxes, [c0, 0, 1], [c1, 0, 1]);
  S.line(planeAxes, [0, c0, 1], [0, c1, 1]);
  pinned(labels, "plane-lab", [["r", true], [" = 1"]], [c1, c0, 1], [1, -1, 0], 22);

  // Each line's plane through the origin, drawn as the triangle from the origin to the line's drawn segment;
  // the red line through the origin along m, split where it crosses r = 1; the two lines; the fixed point and m.
  const fans = [0, 1].map(() => S.el("polygon", { class: "fan" }, below));
  const fanEdges = [0, 1].map(() => [0, 1].map(() => S.el("line", { class: "fan-edge" }, below)));
  const redLow = S.el("line", { class: "ray" }, below);
  const redHigh = S.el("line", { class: "ray" }, above);
  const lines = [S.el("line", { class: "ln-path" }, above), S.el("line", { class: "ln-path dash" }, above)];
  const labs = [mathLabel(above, "ln-lab", [[ELL, true], ["1", false, "sub"]]), mathLabel(above, "ln-lab", [[ELL, true], ["2", false, "sub"]])];
  const pivot = S.el("circle", { r: 4, class: "ln-dot" }, marks);
  const dotM = S.el("circle", { r: 7, class: "pt-dot" }, marks);
  const labM = mathLabel(marks, "pt-lab", [["m", true]]);
  const hG = makeHandle(handles, "grip");
  const clampPoint = (p) => ({ x: Math.max(LO, Math.min(HI, Math.round(p.x))), y: Math.max(LO, Math.min(HI, Math.round(p.y))) });
  const sides = [{}, {}], sideM = {};

  function render() {
    const g = st.g, same = g.x === F[0] && g.y === F[1];
    const { l2, m } = same ? { l2: null, m: null } : parallelOf(g);
    const segs = [L1, l2].map((l) => l && clipLine(l, c0, c1));
    segs.forEach((seg, i) => {
      show([fans[i], ...fanEdges[i], lines[i], labs[i]], !!seg);
      if (!seg) return;
      const A = [...seg[0], 1], B = [...seg[1], 1];
      S.setPoly(fans[i], [[0, 0, 0], A, B]);
      S.setLine(fanEdges[i][0], [0, 0, 0], A); S.setLine(fanEdges[i][1], [0, 0, 0], B);
      S.setLine(lines[i], A, B);
    });
    S.place(hG, [g.x, g.y, 1]);
    const [fx, fy] = S.project([...F, 1]);
    pivot.setAttribute("cx", fx); pivot.setAttribute("cy", fy);

    // ℓ1's label sits a third of the way along it, and ℓ2's halfway between the grip and the fixed point,
    // where the crossing is not while both lie on the same side of ℓ1. m's label goes by its dot.
    const boxes = [...fixed.map((t) => t.getBBox()), markBox(S.project([g.x, g.y, 1]), 13), markBox([fx, fy], 6)];
    if (segs[0]) {
      const [A, B] = segs[0], low = A[1] < B[1] ? A : B, high = low === A ? B : A;
      placeBeside(S, labs[0], [low[0] + 0.32 * (high[0] - low[0]), low[1] + 0.32 * (high[1] - low[1]), 1], 10, S.offset([B[0] - A[0], B[1] - A[1], 0]), boxes, sides[0]);
      boxes.push(labs[0].getBBox());
    }
    if (segs[1]) {
      placeBeside(S, labs[1], [(g.x + F[0]) / 2, (g.y + F[1]) / 2, 1], 10, S.offset([g.x - F[0], g.y - F[1], 0]), boxes, sides[1]);
      boxes.push(labs[1].getBBox());
    }
    hG.setAttribute("aria-label", tr(`Point of ℓ2 at (${g.x}, ${g.y}) on the plane r = 1. Use the arrow keys to move it and turn ℓ2.`, `Punto de ℓ2 en (${g.x}, ${g.y}), sobre el plano r = 1. Usa las flechas del teclado para moverlo y girar ℓ2.`));

    const mv = sym("m", "", "pt");
    if (!m) {
      show([redLow, redHigh, dotM, labM], false);
      out.innerHTML = `<p class="muted">${tr("The circle sits on the fixed point, and one point alone defines no line. Move it away.", "El círculo está sobre el punto fijo, y un solo punto no define ninguna recta. Aléjalo.")}</p>`;
      return;
    }
    // The line along m, across the whole figure. With m flipped so that r ≥ 0, its part above r = 1 starts where it
    // crosses the plane; on the floor (r = 0) all of it lies below the plane.
    const d = m[2] < 0 ? m.map((c) => -c) : m;
    const [t0, t1] = S.span([0, 0, 0], d, 6) ?? [0, 0];
    const tp = d[2] > 0 ? 1 / d[2] : Infinity;
    S.setLine(redLow, scaleVec(d, t0), scaleVec(d, Math.min(tp, t1)));
    show(redLow, true);
    show(redHigh, tp < t1);
    if (tp < t1) S.setLine(redHigh, scaleVec(d, tp), scaleVec(d, t1));
    const cx = m[2] !== 0 ? m[0] / m[2] : null, cy = m[2] !== 0 ? m[1] / m[2] : null;
    const onPanel = cx !== null && cx >= c0 && cx <= c1 && cy >= c0 && cy <= c1;
    show([dotM, labM], onPanel);
    if (onPanel) {
      const c3 = [cx, cy, 1], [px, py] = S.project(c3);
      dotM.setAttribute("cx", px); dotM.setAttribute("cy", py);
      placeBeside(S, labM, c3, 12, S.offset(d), boxes, sideM);
    }

    let html = `<p class="eq"><span class="nowrap">${mv} = ${col(L1, "ln")} × ${col(l2, "ln")}</span> <span class="nowrap">= ${col(m, "pt")}</span></p>`;
    if (m[2] !== 0) html += `<p>${tr(`Divided by <span class="nowrap"><i>r</i> = ${fmt(m[2])}</span>: the point ${pointText(cx, cy)}, where the red line crosses the plane${onPanel ? "" : ", beyond its drawn part"}.`, `Dividido por <span class="nowrap"><i>r</i> = ${fmt(m[2])}</span>: el punto ${pointText(cx, cy)}, donde la recta roja cruza el plano${onPanel ? "" : ", más allá de su parte dibujada"}.`)}</p>`;
    else html += `<p>${tr(`<i>r</i> = 0: the lines are parallel. The red line lies flat and never reaches the plane, so ${mv} is an ideal point, in the direction of both lines.`, `<i>r</i> = 0: las rectas son paralelas. La recta roja queda plana y nunca llega al plano, así que ${mv} es un punto ideal, en la dirección de ambas rectas.`)}</p>`;
    out.innerHTML = html;
  }

  // Arrow keys move the grip in the direction of the plane that looks closest on screen, however the view is turned.
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  makeDraggable(hG, {
    move: (s) => { st.g = clampPoint(S.onPlane(s, 1)); render(); },
    step: (key) => { const d = S.closest(DIRS, key); st.g = clampPoint({ x: st.g.x + d[0], y: st.g.y + d[1] }); render(); },
  });
  S.turnable(render);
  document.getElementById("fig-parallel-reset")?.addEventListener("click", () => { st = { g: { ...PARALLEL.g } }; forget(...sides, sideM); S.setView(...VIEW); render(); });
  render();
}

scaledPoint();
pointOnLine();
lineAsPlane();
lineThroughPoints();
intersection();
parallelLines();
