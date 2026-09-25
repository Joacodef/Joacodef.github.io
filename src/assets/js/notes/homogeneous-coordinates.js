import { el, createPlane, createSpace, makeHandle, makeDraggable, cross, dot, simplify, clipLine, fmt, isRounded, paren, T, sym, col, row, frac, equation } from "../plane.js";

const ELL = "ℓ";

// An SVG label from [text, italic] parts, such as λm with an upright λ and an italic m.
function mathLabel(parent, cls, parts) {
  const t = el("text", { class: cls }, parent);
  for (const [s, italic] of parts) el("tspan", italic ? { "font-style": "italic" } : null, t).textContent = s;
  return t;
}

/* ---------- Shared by the 3D figures ---------- */

// Gap between two boxes (0 when they overlap), and the box of a point's mark.
const gap = (a, b) => Math.hypot(Math.max(b.x - a.x - a.width, 0, a.x - b.x - b.width), Math.max(b.y - a.y - a.height, 0, a.y - b.y - b.height));
const markBox = ([x, y], r) => ({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });
const DIRS = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
const scaleVec = (v, t) => v.map((c) => c * t);
const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((c) => c / n); };

// Places label t dist units from point p of space S, trying eight directions but skipping the two along
// `line` (a screen direction the drawn line itself occupies). It keeps the most perpendicular direction
// that leaves the label clear of the obstacles and the edges. With `away`, a longer label is anchored
// on the side away from its point, so it grows outward.
function placeClear(S, t, p, dist, line, obstacles, away = false) {
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

// The multiples of `step` for which t·v stays inside the figure, within [lo, hi].
function stepRange(S, v, step, lo, hi) {
  const s = S.span([0, 0, 0], v, 26) ?? [0, 0];
  return [Math.max(lo, Math.ceil(s[0] / step) * step), Math.min(hi, Math.floor(s[1] / step) * step)];
}
const clampTo = (x, [lo, hi], step) => Math.max(lo, Math.min(hi, Math.round(x / step) * step));

/* Figure 1: every multiple λm lies on one line through the origin, which crosses the plane r = 1 at m */
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
  const initial = { x: 2, y: 3, lambda: 2 };
  let st = { ...initial };

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
  // Labels that never move, drawn above everything so a plane never dims them; the labels of m and λm keep clear of them.
  const fixed = [];
  const pinned = (parent, cls, parts, v, dir, dist) => { const t = S.pin(mathLabel(parent, cls, parts), v, dir, dist); fixed.push(t); return t; };
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

    // Labels beside the line, clear of the fixed labels, the other point and each other. At λ = 1 one label names both.
    const d = S.offset(m3), boxes = fixed.map((t) => t.getBBox());
    const one = L === 1;
    labM.setAttribute("visibility", one ? "hidden" : "visible");
    labL.setAttribute("visibility", one ? "hidden" : "visible");
    labBoth.setAttribute("visibility", one ? "visible" : "hidden");
    if (one) {
      placeClear(S, labBoth, m3, 24, d, boxes, true);
    } else {
      placeClear(S, labM, m3, 25, d, [...boxes, markBox([vx, vy], 13)]);
      placeClear(S, labL, v, 30, d, [...boxes, markBox([mx, my], 10), labM.getBBox()]);
    }

    S.place(hM, m3); S.place(hL, v);
    hM.setAttribute("aria-label", `Point m at (${fmt(x)}, ${fmt(y)}) on the plane r = 1. Use the arrow keys to move it.`);
    hL.setAttribute("aria-label", `Vector λm with λ = ${fmt(L)}. Use the arrow keys to slide it along the line.`);

    const lm = `λ${sym("m", "", "pt")}`;
    let html = `<span class="lbl">Scaling by λ = ${fmt(L)}</span>`;
    html += `<p class="eq"><span class="nowrap">${lm} = ${fmt(L)}&thinsp;${col(m3, "pt")}</span> <span class="nowrap">= ${col(v, "pt")}</span></p>`;
    if (L === 0) {
      html += '<p class="muted">λ = 0 gives the zero vector, at the origin. The origin lies on the line of every point, so it stands for none of them, and with <i>r</i> = 0 there is nothing to divide by. That is why λ must be nonzero.</p>';
    } else {
      html += '<span class="lbl">Back to Cartesian coordinates</span>';
      if (L === 1) html += `<p>Here <i>r</i> = 1 already: ${lm} is ${sym("m", "", "pt")} itself, where the line crosses the plane.</p>`;
      else html += `<p>Dividing by <i>r</i> = ${fmt(L)}: <span class="nowrap">(${frac(fmt(v[0]), fmt(L))}, ${frac(fmt(v[1]), fmt(L))})</span> <span class="nowrap">= <span class="pt">(${fmt(x)}, ${fmt(y)})</span>,</span> the same point.</p>`;
      if (L < 0) html += '<p class="muted">A negative λ puts the vector on the other side of the origin, still on the same line.</p>';
    }
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
  document.getElementById("fig-scale-reset")?.addEventListener("click", () => { st = { ...initial }; S.setView(...VIEW); render(); });
  render();
}

/* Figure 2: a line is a plane through the origin, and l = [a b c] is perpendicular to that plane */
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
  const initial = { l: [1, 1, -3], lambda: 1 };
  let st = structuredClone(initial);

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
  const show = (els, on) => els.forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));

  // λ moves in steps of 0.5, or finer when ℓ is long, as far as λℓ stays inside the figure.
  function lambdaSteps(l) {
    const s = S.span([0, 0, 0], l, 26) ?? [0, 0];
    const step = [0.5, 0.25, 0.1].find((k) => s[1] >= k || s[0] <= -k) ?? 0.1;
    return { step, range: stepRange(S, l, step, -3, 3) };
  }

  function render() {
    const l = st.l;
    inputs.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = l[i]; });
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
      const P = [A[0] + 0.8 * (B[0] - A[0]), A[1] + 0.8 * (B[1] - A[1]), 1];
      placeClear(S, labLine, P, 20, S.offset([B[0] - A[0], B[1] - A[1], 0]), fixed.map((t) => t.getBBox()));
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
    if (!zero) placeClear(S, labVec, v, 32, S.offset(l), [...fixed.map((t) => t.getBBox()), ...(lineBox ? [lineBox] : [])]);
    hL.setAttribute("aria-label", `Vector λℓ with λ = ${fmt(L)}. Use the arrow keys to slide it along its line.`);

    const lv = `λ${sym(ELL, "", "ln")}`, PQR = ["p", "q", "r"];
    let html;
    if (zero) {
      html = '<p class="muted">The zero vector is perpendicular to every vector, so it picks out no plane and no line. Make at least one coefficient nonzero.</p>';
    } else {
      html = `<span class="lbl">Scaling by λ = ${fmt(L)}</span>`;
      html += `<p class="eq"><span class="nowrap">${lv} = ${fmt(L)}&thinsp;${col(l, "ln")}</span> <span class="nowrap">= ${col(v, "ln")}</span></p>`;
      if (L === 0) {
        html += '<p class="muted">λ = 0 gives the zero vector, which is perpendicular to every vector, so it picks out no plane. That is why λ must be nonzero.</p>';
      } else {
        html += '<span class="lbl">The plane perpendicular to it</span>';
        html += `<p>${equation(v, PQR)}${L !== 1 ? `, which divided by ${fmt(L)} is ${equation(l, PQR)}` : ""}: the same plane for every <span class="nowrap">λ ≠ 0</span>.</p>`;
        html += '<span class="lbl">Where that plane meets <i>r</i> = 1</span>';
        if (flat) html += '<p class="muted">With <i>a</i> = <i>b</i> = 0 the plane is <i>r</i> = 0, level with the floor. It never meets <i>r</i> = 1, so it gives no line.</p>';
        else html += `<p>Setting <i>r</i> = 1 gives ${equation(l)}: the line ${sym(ELL, "", "ln")}.${seg ? "" : " It misses the part of the plane <i>r</i> = 1 that is drawn."}</p>`;
        if (L < 0) html += '<p class="muted">A negative λ flips the vector to the other side of the plane; the plane stays the same.</p>';
      }
    }
    out.innerHTML = html;
  }

  inputs.forEach((inp, i) => {
    // Only whole numbers change the line; while the field holds anything else (a lone minus sign, say), the figure waits.
    inp.addEventListener("input", () => {
      const v = Number(inp.value);
      if (inp.value.trim() === "" || !Number.isInteger(v) || Math.abs(v) > LIMIT) return;
      st.l[i] = v || 0;
      render();
    });
    inp.addEventListener("change", () => { inp.value = st.l[i]; });
  });
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
  document.getElementById("fig-plane-reset")?.addEventListener("click", () => { st = structuredClone(initial); S.setView(...VIEW); render(); });
  render();
}

/* Figure 3: the line through two points, l = m1 x m2 */
function lineThroughPoints() {
  const svg = document.getElementById("fig-line");
  const out = document.getElementById("fig-line-out");
  if (!svg || !out) return;
  const P = createPlane(svg);
  const initial = { m1: { x: 10, y: 20 }, m2: { x: 20, y: 30 } };
  let st = structuredClone(initial);

  const line = P.el("line", { class: "ln-path" });
  const lLab = P.label("ln-lab", ELL);
  const lab1 = P.label("pt-lab", "m", "1");
  const lab2 = P.label("pt-lab", "m", "2");
  const h1 = P.handle("point"), h2 = P.handle("point");

  function render() {
    const { m1: a, m2: b } = st;
    const m1 = [a.x, a.y, 1], m2 = [b.x, b.y, 1];
    const l = cross(m1, m2);
    P.place(h1, a); P.place(h2, b);
    h1.setAttribute("aria-label", `Point m1 at (${a.x}, ${a.y}). Use the arrow keys to move it.`);
    h2.setAttribute("aria-label", `Point m2 at (${b.x}, ${b.y}). Use the arrow keys to move it.`);

    let html = '<span class="lbl">Cross product</span>';
    html += `<p class="eq"><span class="nowrap">${sym(ELL, "", "ln")} = ${col(m1, "pt")} × ${col(m2, "pt")}</span> <span class="nowrap">= ${col(l, "ln")}</span></p>`;

    if (l[0] === 0 && l[1] === 0) {
      P.drawSegment(line, null);
      lLab.setAttribute("visibility", "hidden");
      P.placeAlong(lab1, a, [1, 1], 2.3); P.placeAlong(lab2, b, [-1, -1], 2.3);
      html += `<p class="muted">The two points coincide, so ${sym("m", "1", "pt")} × ${sym("m", "2", "pt")} = ${row([0, 0, 0])} and does not define a line. Move them apart to continue.</p>`;
      out.innerHTML = html;
      return;
    }
    const seg = P.clip(l);
    P.drawSegment(line, seg);
    lLab.setAttribute("visibility", seg ? "visible" : "hidden");
    if (seg) P.placeLineLabel(lLab, l, seg);
    P.placeAlong(lab1, a, [-l[0], -l[1]], 2.3);
    P.placeAlong(lab2, b, [-l[0], -l[1]], 2.3);

    const s = simplify(l);
    html += '<span class="lbl">Simplest form</span><p>';
    if (s.d === 1) html += `Already in its simplest form: ${equation(s.v)}.`;
    else if (s.d === -1) html += `Flipping the sign gives the same line, ${row(s.v, "ln")}, that is ${equation(s.v)}.`;
    else html += `Dividing by ${fmt(s.d)} gives the same line, ${row(s.v, "ln")}, that is ${equation(s.v)}.`;
    html += "</p>";

    html += '<span class="lbl">Check with the dot product</span>';
    for (const [m, i] of [[m1, "1"], [m2, "2"]]) {
      html += `<p>${sym(ELL, "", "ln")}${T}${sym("m", i, "pt")} = <span class="nowrap">${paren(l[0])}·${paren(m[0])}</span> + <span class="nowrap">${paren(l[1])}·${paren(m[1])}</span> + <span class="nowrap">${paren(l[2])}·1 = ${fmt(dot(l, m))} <span class="ok">✓</span></span></p>`;
    }
    out.innerHTML = html;
  }

  P.draggable(h1, () => st.m1, (p) => { st.m1 = p; render(); });
  P.draggable(h2, () => st.m2, (p) => { st.m2 = p; render(); });
  document.getElementById("fig-line-reset")?.addEventListener("click", () => { st = structuredClone(initial); render(); });
  render();
}

/* Figure 4: the intersection of two lines, m = l1 x l2 */
function intersection() {
  const svg = document.getElementById("fig-meet");
  const out = document.getElementById("fig-meet-out");
  if (!svg || !out) return;
  const P = createPlane(svg);
  const initial = { p1: { x: 5, y: 15 }, p2: { x: 25, y: 35 }, q1: { x: 10, y: 30 }, q2: { x: 30, y: 10 } };
  let st = structuredClone(initial);

  const line1 = P.el("line", { class: "ln-path" });
  const line2 = P.el("line", { class: "ln-path dash" });
  const lab1 = P.label("ln-lab", ELL, "1");
  const lab2 = P.label("ln-lab", ELL, "2");
  const dotG = P.el("circle", { r: 8.5, class: "pt-dot" });
  const mLab = P.label("pt-lab", "m");
  const keys = ["p1", "p2", "q1", "q2"];
  const hs = Object.fromEntries(keys.map((k) => [k, P.handle("grip")]));

  const show = (on) => { dotG.setAttribute("visibility", on ? "visible" : "hidden"); mLab.setAttribute("visibility", on ? "visible" : "hidden"); };

  function render() {
    for (const k of keys) {
      P.place(hs[k], st[k]);
      hs[k].setAttribute("aria-label", `Endpoint of line ${k[0] === "p" ? 1 : 2} at (${st[k].x}, ${st[k].y}). Use the arrow keys to move it.`);
    }
    const l1 = cross([st.p1.x, st.p1.y, 1], [st.p2.x, st.p2.y, 1]);
    const l2 = cross([st.q1.x, st.q1.y, 1], [st.q2.x, st.q2.y, 1]);
    const bad1 = l1[0] === 0 && l1[1] === 0, bad2 = l2[0] === 0 && l2[1] === 0;
    const seg1 = bad1 ? null : P.clip(l1), seg2 = bad2 ? null : P.clip(l2);
    P.drawSegment(line1, seg1); P.drawSegment(line2, seg2);
    lab1.setAttribute("visibility", seg1 ? "visible" : "hidden");
    lab2.setAttribute("visibility", seg2 ? "visible" : "hidden");
    if (seg1) P.placeLineLabel(lab1, l1, seg1);
    if (seg2) P.placeLineLabel(lab2, l2, seg2);

    if (bad1 || bad2) {
      show(false);
      out.innerHTML = `<p class="muted">Both endpoints of ${sym(ELL, bad1 ? "1" : "2", "ln")} coincide, so they do not define a line. Move them apart to continue.</p>`;
      return;
    }
    const s1 = simplify(l1).v, s2 = simplify(l2).v;
    let html = '<span class="lbl">The lines, in simplest form</span>';
    html += `<p>${sym(ELL, "1", "ln")} = ${row(s1, "ln")}&ensp;<span class="muted">${equation(s1)}</span></p>`;
    html += `<p>${sym(ELL, "2", "ln")} = ${row(s2, "ln")}&ensp;<span class="muted">${equation(s2)}</span></p>`;

    const m = cross(s1, s2);
    html += '<span class="lbl">Cross product</span>';
    html += `<p class="eq"><span class="nowrap">${sym("m", "", "pt")} = ${col(s1, "ln")} × ${col(s2, "ln")}</span> <span class="nowrap">= ${col(m, "pt")}</span></p>`;

    if (m[0] === 0 && m[1] === 0 && m[2] === 0) {
      show(false);
      out.innerHTML = html + '<p class="muted">The two lines coincide: their cross product is the zero vector, so there is no single intersection point.</p>';
      return;
    }
    if (m[2] === 0) {
      show(false);
      out.innerHTML = html + '<p class="muted"><i>r</i> = 0: the lines are parallel, so they do not meet at any point of the plane and we cannot divide by <i>r</i>.</p>';
      return;
    }
    const xi = m[0] / m[2], yi = m[1] / m[2];
    html += '<span class="lbl">Back to Cartesian coordinates</span>';
    const point = `<span class="pt">(${fmt(xi)}, ${fmt(yi)})</span>`;
    if (m[2] === 1) html += `<p>Here <i>r</i> = 1, so the point can be read directly: <span class="nowrap">${point}</span></p>`;
    else html += `<p>Dividing by <i>r</i> = ${fmt(m[2])}: <span class="nowrap">(${frac(fmt(m[0]), fmt(m[2]))}, ${frac(fmt(m[1]), fmt(m[2]))})</span> <span class="nowrap">${isRounded(xi) || isRounded(yi) ? "≈" : "="} ${point}</span></p>`;

    const inside = xi >= 0 && xi <= P.max && yi >= 0 && yi <= P.max;
    show(inside);
    if (inside) {
      dotG.setAttribute("transform", `translate(${P.X(xi)},${P.Y(yi)})`);
      // Put the label inside the widest wedge between the two lines.
      const n1 = Math.hypot(s1[0], s1[1]), n2 = Math.hypot(s2[0], s2[1]);
      const d1 = [s1[1] / n1, -s1[0] / n1], d2 = [s2[1] / n2, -s2[0] / n2];
      const sa = [d1[0] + d2[0], d1[1] + d2[1]], sb = [d1[0] - d2[0], d1[1] - d2[1]];
      P.placeAlong(mLab, { x: xi, y: yi }, Math.hypot(...sa) >= Math.hypot(...sb) ? sa : sb, 2.6);
    } else {
      html += '<p class="muted">The point lies outside the visible area of the plot.</p>';
    }
    out.innerHTML = html;
  }

  for (const k of keys) P.draggable(hs[k], () => st[k], (p) => { st[k] = p; render(); });
  document.getElementById("fig-meet-reset")?.addEventListener("click", () => { st = structuredClone(initial); render(); });
  render();
}

scaledPoint();
lineAsPlane();
lineThroughPoints();
intersection();
