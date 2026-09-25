import { createPlane, cross, dot, simplify, fmt, isRounded, paren, T, sym, col, row, frac, equation } from "../plane.js";

const ELL = "\u2113";

/* Figure A: the line through two points, l = m1 x m2 */
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
    html += `<p class="eq">${sym(ELL, "", "ln")} = ${col(m1, "pt")} × ${col(m2, "pt")} = ${col(l, "ln")}</p>`;

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

/* Figure B: the intersection of two lines, m = l1 x l2 */
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
    html += `<p class="eq">${sym("m", "", "pt")} = ${col(s1, "ln")} × ${col(s2, "ln")} = ${col(m, "pt")}</p>`;

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
    if (m[2] === 1) html += "<p>Here <i>r</i> = 1, so the point can be read directly: ";
    else html += `<p>Dividing by <i>r</i> = ${fmt(m[2])}: <span class="nowrap">(${frac(fmt(m[0]), fmt(m[2]))}, ${frac(fmt(m[1]), fmt(m[2]))})</span>${isRounded(xi) || isRounded(yi) ? " ≈ " : " = "}`;
    html += `<span class="pt nowrap">(${fmt(xi)}, ${fmt(yi)})</span></p>`;

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

lineThroughPoints();
intersection();
