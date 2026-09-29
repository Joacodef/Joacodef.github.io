import { el, createPlane, makeHandle, makeDraggable, cross, simplify, fmt, fmtSig, sym, col, row, frac, mat, apply, homography, modeButtons, tr } from "../../plane.js";

const ELL = "ℓ";
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
// m′ with subscript i (none if omitted), as HTML and as plain text.
const mp = (i = "") => `<span class="pt"><i>m</i>′${i === "" ? "" : `<sub>${i}</sub>`}</span>`;
const mpText = (i) => `m′${i}`;
// Whether fmt had to round n; then a number is written "≈ n", and otherwise "= n" (approx) or just "n" (about).
const rounded = (n) => Math.abs(n * 100 - Math.round(n * 100)) > 1e-6;
const approx = (n) => (rounded(n) ? "≈ " : "= ") + fmt(n);
const about = (n) => (rounded(n) ? "≈ " : "") + fmt(n);

/* Figure 1: the four kinds of transformation. Each kind frees some corners of a square, and H comes from the four pairs */
function fourKinds() {
  const svg = document.getElementById("fig-kinds");
  const out = document.getElementById("fig-kinds-out");
  const group = document.getElementById("fig-kinds-modes");
  if (!svg || !out || !group) return;
  const P = createPlane(svg);
  // The square before the transformation, numbered as in the worked example: m1 top left, m2 bottom left,
  // m3 bottom right, m4 top right.
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
  const show = (els, on) => els.forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));

  function drawSeg(line, a, b) {
    line.setAttribute("x1", P.X(a[0])); line.setAttribute("y1", P.Y(a[1]));
    line.setAttribute("x2", P.X(b[0])); line.setAttribute("y2", P.Y(b[1]));
  }

  function render() {
    const { mode, pts } = st;
    const free = FREE[mode];
    const cx = pts.reduce((s, q) => s + q.x, 0) / 4, cy = pts.reduce((s, q) => s + q.y, 0) / 4;
    pts.forEach((q, i) => {
      const isFree = free.includes(i);
      hs[i].style.display = isFree ? "" : "none";
      P.place(hs[i], q);
      rings[i].setAttribute("cx", P.X(q.x)); rings[i].setAttribute("cy", P.Y(q.y));
      show([rings[i]], !isFree);
      P.placeAlong(labs[i], q, [q.x - cx, q.y - cy], 3.2);
      hs[i].setAttribute("aria-label", mode === "euclidean" && i === 3
        ? tr(`Corner ${mpText(4)}, with the square turned by ${fmt(st.theta)} degrees around ${mpText(1)}. Use the arrow keys to turn it.`, `Esquina ${mpText(4)}, con el cuadrado girado ${fmt(st.theta)} grados en torno a ${mpText(1)}. Usa las flechas del teclado para girarlo.`)
        : tr(`Corner ${mpText(i + 1)} at (${fmt(q.x)}, ${fmt(q.y)}). Use the arrow keys to move it.`, `Esquina ${mpText(i + 1)} en (${fmt(q.x)}, ${fmt(q.y)}). Usa las flechas del teclado para moverla.`));
    });

    const hide = () => show([...grid, ...exts, ...meets], false);
    const fail = (msg) => { hide(); out.innerHTML = `<p class="muted">${msg}</p>`; };

    // Degenerate corners: two in one place, or three on one line.
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) > 1e-9) continue;
      return fail(mode === "similarity"
        ? tr(`${mp(1)} and ${mp(4)} are in the same place, so the square has shrunk to a point: its scale is <i>s</i> = 0. Move them apart.`, `${mp(1)} y ${mp(4)} están en el mismo lugar, así que el cuadrado se redujo a un punto: su escala es <i>s</i> = 0. Sepáralas.`)
        : tr(`${mp(i + 1)} and ${mp(j + 1)} are in the same place, so the corners do not fix one transformation. Move them apart.`, `${mp(i + 1)} y ${mp(j + 1)} están en el mismo lugar, así que las esquinas no determinan una única transformación. Sepáralas.`));
    }
    for (const [i, j, k] of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) {
      const [a, b, c] = [pts[i], pts[j], pts[k]];
      if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 1e-9) continue;
      return fail(tr(`${mp(i + 1)}, ${mp(j + 1)} and ${mp(k + 1)} lie on one line. No homography sends three corners of the square onto a line: it keeps lines, so it would have to flatten the whole square. Move one of them off the line.`, `${mp(i + 1)}, ${mp(j + 1)} y ${mp(k + 1)} están sobre una misma recta. Ninguna homografía lleva tres esquinas del cuadrado a una recta: conserva las rectas, así que tendría que aplanar el cuadrado entero. Saca una de ellas de la recta.`));
    }

    const fit = homography(SRC.map((s, i) => [s, [pts[i].x, pts[i].y]]));
    if (!fit) return fail(tr("The transformation that fits these corners has <i>h</i><sub>33</sub> = 0: it sends the origin (0, 0) to infinity, so it cannot be scaled to make <i>h</i><sub>33</sub> = 1. Move a corner by one step.", "La transformación que se ajusta a estas esquinas tiene <i>h</i><sub>33</sub> = 0: envía el origen (0, 0) al infinito, así que no se puede escalar para que <i>h</i><sub>33</sub> = 1. Mueve una esquina un paso."));
    // Entries that are zero up to rounding error (such as the bottom row of a turn) are set to 0.
    const big = Math.max(...fit.flat().map(Math.abs));
    const H = fit.map((r) => r.map((v) => (Math.abs(v) < 1e-12 * big ? 0 : v)));
    let html = `<span class="lbl">${tr("The matrix, scaled so that <i>h</i><sub>33</sub> = 1", "La matriz, escalada para que <i>h</i><sub>33</sub> = 1")}</span>`;
    html += `<p class="eq"><span class="nowrap"><i>H</i> ${H.flat().some(rounded) ? "≈" : "="} ${mat(H, "", (v) => fmtSig(v))}</span></p>`;

    // The third component of Hm at the four corners. If its sign changes, part of the square goes through r = 0.
    const rs = SRC.map(([x, y]) => apply(H, [x, y, 1])[2]);
    if (rs.some((r) => r > 0) && rs.some((r) => r < 0)) {
      hide();
      out.innerHTML = html + `<p class="muted">${tr(`The corners make a crossed or dented shape. <i>H</i> still sends the four corners there, but the third component <i>r</i> of <i>H</i><span class="pt"><i>m</i></span> changes sign across the square: at the corners it is ${rs.map((r) => fmt(r)).join(", ")}. Somewhere inside the square <span class="nowrap"><i>r</i> = 0</span>, so part of the square is sent to infinity, and its image is not the shape the corners outline. A photo of a square never looks like this.`, `Las esquinas forman una figura cruzada o cóncava. <i>H</i> igual lleva las cuatro esquinas ahí, pero la tercera componente <i>r</i> de <i>H</i><span class="pt"><i>m</i></span> cambia de signo dentro del cuadrado: en las esquinas vale ${rs.map((r) => fmt(r)).join(", ")}. En algún lugar dentro del cuadrado <span class="nowrap"><i>r</i> = 0</span>, así que parte del cuadrado se va al infinito, y su imagen no es la figura que marcan las esquinas. Una foto de un cuadrado nunca se ve así.`)}</p>`;
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

    if (mode === "euclidean") html += tr(`<p>A Euclidean transformation: 3 free numbers, the turn θ = ${fmt(st.theta)}° and the shift.</p>`, `<p>Una transformación euclídea: 3 números libres, el giro θ = ${fmt(st.theta)}° y la traslación.</p>`);
    else if (mode === "similarity") {
      const d = [pts[3].x - pts[0].x, pts[3].y - pts[0].y];
      const turn = approx(deg(Math.atan2(d[1], d[0]))), scale = approx(Math.hypot(...d) / SIDE);
      html += tr(`<p>A similarity: 4 free numbers, the turn θ ${turn}°, the scale <i>s</i> ${scale} and the shift.</p>`, `<p>Una transformación de similitud: 4 números libres, el giro θ ${turn}°, la escala <i>s</i> ${scale} y la traslación.</p>`);
    } else if (mode === "affine") html += tr("<p>An affine transformation: 6 free numbers, the top two rows.</p>", "<p>Una transformación afín: 6 números libres, las dos filas de arriba.</p>");
    else html += tr("<p>A projective transformation: 8 free numbers, all nine entries less one for scale.</p>", "<p>Una transformación proyectiva: 8 números libres, las nueve entradas menos una por la escala.</p>");

    // What it keeps, judged from H itself: a parallelogram made in the projective kind keeps parallels.
    const affine = Math.abs(H[2][0]) < 1e-9 && Math.abs(H[2][1]) < 1e-9;
    const c1 = [H[0][0], H[1][0]], c2 = [H[0][1], H[1][1]], n1 = Math.hypot(...c1), n2 = Math.hypot(...c2);
    const angles = affine && Math.abs(c1[0] * c2[0] + c1[1] * c2[1]) < 1e-9 && Math.abs(n1 - n2) < 1e-9;
    const lengths = angles && Math.abs(n1 - 1) < 1e-9;
    const top = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
    const v4 = [pts[3].x - pts[0].x, pts[3].y - pts[0].y], v2 = [pts[1].x - pts[0].x, pts[1].y - pts[0].y];
    const corner = deg(Math.acos(Math.max(-1, Math.min(1, (v4[0] * v2[0] + v4[1] * v2[1]) / (Math.hypot(...v4) * Math.hypot(...v2))))));
    const mark = (on) => (on ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');
    html += `<span class="lbl">${tr("What it keeps", "Lo que conserva")}</span>`;
    html += `<p>${mark(lengths)} ${lengths ? tr("Lengths: the top side is still 20.", "Longitudes: el lado de arriba sigue midiendo 20.") : tr(`Lengths: the top side is now ${about(top)}; it was 20.`, `Longitudes: el lado de arriba ahora mide ${about(top)}; medía 20.`)}</p>`;
    html += `<p>${mark(angles)} ${angles ? tr(`Angles: the corner at ${mp(1)} is still 90°.`, `Ángulos: la esquina en ${mp(1)} sigue midiendo 90°.`) : tr(`Angles: the corner at ${mp(1)} is now ${about(corner)}°.`, `Ángulos: la esquina en ${mp(1)} ahora mide ${about(corner)}°.`)}</p>`;
    html += `<p>${mark(affine)} ${affine ? tr("Parallel lines.", "Rectas paralelas.") : tr("Parallel lines: see below.", "Rectas paralelas: ver más abajo.")}</p>`;
    html += `<p>${mark(true)} ${tr("Straight lines: every homography keeps them.", "Rectas: toda homografía las conserva.")}</p>`;

    // Where opposite sides meet: the cross product of the two lines, as for any two lines.
    const hv = (q) => [q.x, q.y, 1];
    const whole = pts.every((q) => Number.isInteger(q.x) && Number.isInteger(q.y));
    const tidy = (l) => (whole ? simplify(l).v : l);
    const pairs = [[[0, 3], [1, 2], "top and bottom"], [[0, 1], [3, 2], "left and right"]];
    const results = pairs.map(([[a, b], [c, d]]) => {
      const l1 = tidy(cross(hv(pts[a]), hv(pts[b]))), l2 = tidy(cross(hv(pts[c]), hv(pts[d])));
      const m = tidy(cross(l1, l2));
      const parallel = Math.abs(m[2]) <= 1e-9 * Math.hypot(m[0], m[1]);
      return { a, b, c, d, l1, l2, m, parallel, at: parallel ? null : [m[0] / m[2], m[1] / m[2]] };
    });
    results.forEach(({ a, b, c, d, at }, k) => {
      const inside = at && at[0] >= 0 && at[0] <= P.max && at[1] >= 0 && at[1] <= P.max;
      show([meets[k], exts[2 * k], exts[2 * k + 1]], inside);
      if (!inside) return;
      meets[k].setAttribute("cx", P.X(at[0])); meets[k].setAttribute("cy", P.Y(at[1]));
      // Each side is extended from its end nearer the meeting point.
      [[a, b], [c, d]].forEach(([i, j], n) => {
        const near = Math.hypot(pts[i].x - at[0], pts[i].y - at[1]) < Math.hypot(pts[j].x - at[0], pts[j].y - at[1]) ? pts[i] : pts[j];
        drawSeg(exts[2 * k + n], [near.x, near.y], at);
      });
    });

    const [tb, lr] = results;
    const where = (res) => {
      if (res.parallel) return tr("they are still parallel", "siguen siendo paralelos");
      const [x, y] = res.at;
      const inside = x >= 0 && x <= P.max && y >= 0 && y <= P.max;
      const at = `<span class="pt nowrap">(${fmt(x)}, ${fmt(y)})</span>`;
      return inside ? tr(`they meet at ${at}, the red dot`, `se cortan en ${at}, el punto rojo`) : tr(`they meet at ${at}, outside the view`, `se cortan en ${at}, fuera de la vista`);
    };
    html += `<span class="lbl">${tr("Where the top and bottom sides meet", "Dónde se cortan los lados de arriba y de abajo")}</span>`;
    // With whole-number corners each vector is simplified (∼); otherwise its entries are rounded (≈).
    const rel = whole ? "∼" : "≈";
    html += `<p><span class="nowrap">${sym(ELL, "1", "ln")} = ${mp(1)} × ${mp(4)}</span> <span class="nowrap">${rel} ${row(tb.l1, "ln")},</span> <span class="nowrap">${sym(ELL, "2", "ln")} = ${mp(2)} × ${mp(3)}</span> <span class="nowrap">${rel} ${row(tb.l2, "ln")}</span></p>`;
    html += `<p class="eq"><span class="nowrap">${sym(ELL, "1", "ln")} × ${sym(ELL, "2", "ln")} ${rel} ${col(tb.m, "pt")}</span></p>`;
    if (tb.parallel) html += `<p><i>r</i> = 0: ${where(tb)}.</p>`;
    else html += `<p>${tr("Dividing by", "Al dividir por")} <i>r</i> = ${fmt(tb.m[2])}: <span class="nowrap">(${frac(fmt(tb.m[0]), fmt(tb.m[2]))}, ${frac(fmt(tb.m[1]), fmt(tb.m[2]))})</span>, ${tr("so", "así que")} ${where(tb)}.</p>`;
    html += `<p>${tr("The left and right sides, by the same steps:", "Los lados izquierdo y derecho, con los mismos pasos:")} ${where(lr)}.</p>`;
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
  document.getElementById("fig-kinds-reset")?.addEventListener("click", () => { st = structuredClone(initial); press(st.mode); render(); });
  render();
}

/* Figure 2: warping an image backward. Each output pixel m reads the source at m′ = Hm, by the nearest pixel or bilinearly */
function warping() {
  const svg = document.getElementById("fig-warp");
  const out = document.getElementById("fig-warp-out");
  const group = document.getElementById("fig-warp-modes");
  if (!svg || !out || !group) return;
  // A 7 × 7 source image: a bright F (220) on a dark background (40), with two mid-gray pixels (130) at the ends of its bars.
  const N = 7, GRAY = { ".": 40, "#": 220, "+": 130 };
  const SRC = [".......", ".####+.", ".#.....", ".###+..", ".#.....", ".#.....", "......."].map((r) => [...r].map((c) => GRAY[c]));
  // H turns the output's pixel coordinates by 30° around the center pixel (3, 3) to find where to read the source,
  // so the output shows the source turned the other way.
  const C = (N - 1) / 2, co = Math.cos(rad(30)), si = Math.sin(rad(30));
  const H = [[co, -si, C - co * C + si * C], [si, co, C - si * C - co * C], [0, 0, 1]];

  // Two panels of N × N cells; pixel (row i, column j) of a panel starts at x0 + j·CELL, Y0 + i·CELL.
  const CELL = 28, X0 = [12, 252], Y0 = 36;
  svg.setAttribute("viewBox", "0 0 460 238");
  const panelLabel = (x, word, name) => {
    const t = el("text", { x, y: Y0 - 12, class: "panel-lab" }, svg);
    t.append(`${word} `);
    el("tspan", { class: "m" }, t).textContent = name;
  };
  panelLabel(X0[0], tr("Source", "Original"), "I′");
  panelLabel(X0[1], tr("Output", "Resultado"), "I");
  const shade = (v) => `color-mix(in srgb, var(--img-hi) ${Math.round((v / 255) * 1000) / 10}%, var(--img-lo))`;
  const cells = X0.map((x0, p) => SRC.map((r, i) => r.map((v, j) => {
    const c = el("rect", { x: x0 + j * CELL, y: Y0 + i * CELL, width: CELL, height: CELL, class: "px" }, svg);
    if (p === 0) c.style.fill = shade(v);
    return c;
  })));
  // An output pixel with no value is crossed by a slash, so it is not mistaken for a very bright or very dark one.
  const slashes = SRC.map((r, i) => r.map((_, j) => {
    const x = X0[1] + j * CELL, y = Y0 + i * CELL;
    return el("line", { x1: x + 5, y1: y + CELL - 5, x2: x + CELL - 5, y2: y + 5, class: "px-none" }, svg);
  }));
  X0.forEach((x0) => el("rect", { x: x0, y: Y0, width: N * CELL, height: N * CELL, class: "px-frame" }, svg));
  const block = el("rect", { width: 2 * CELL, height: 2 * CELL, class: "px-pick" }, svg);
  const pick = el("rect", { width: CELL, height: CELL, class: "px-pick" }, svg);
  const dotM = el("circle", { r: 5.5, class: "pt-dot" }, svg);
  const h = makeHandle(svg, "point");

  // The source at (x′, y′), in pixel units with pixel centers at whole numbers; null outside the image.
  const inside = (x, y) => x > -1e-9 && x < N - 1 + 1e-9 && y > -1e-9 && y < N - 1 + 1e-9;
  function around(x, y) {
    const j = Math.min(Math.floor(x + 1e-9), N - 2), i = Math.min(Math.floor(y + 1e-9), N - 2);
    return { i, j, u: Math.max(0, x - j), v: Math.max(0, y - i) };
  }
  function sample(x, y, mode) {
    if (!inside(x, y)) return null;
    if (mode === "nearest") return SRC[Math.round(y)][Math.round(x)];
    const { i, j, u, v } = around(x, y);
    return u * v * SRC[i + 1][j + 1] + (1 - u) * v * SRC[i + 1][j] + u * (1 - v) * SRC[i][j + 1] + (1 - u) * (1 - v) * SRC[i][j];
  }
  const source = (j, i) => { const m = apply(H, [j, i, 1]); return [m[0] / m[2], m[1] / m[2]]; };

  const initial = { j: 4, i: 2, mode: "bilinear" };
  let st = { ...initial };

  // A close-up of the square between the four pixel centers, split at m′ into the rectangles A, B, C and D.
  function inset(u, v, vals) {
    const S = 120, L = 55, TOP = 34, x = L + u * S, y = TOP + v * S;
    const corners = [[L, TOP, -1], [L + S, TOP, -1], [L, TOP + S, 1], [L + S, TOP + S, 1]];
    let s = `<svg class="inset" viewBox="0 0 230 196" role="img" aria-label="${tr("The four source pixels around m′ and the rectangles A, B, C and D between them", "Los cuatro píxeles de la imagen original alrededor de m′ y los rectángulos A, B, C y D entre ellos")}">`;
    s += `<rect class="sq" x="${L}" y="${TOP}" width="${S}" height="${S}"/>`;
    s += `<line class="cut" x1="${x}" y1="${TOP}" x2="${x}" y2="${TOP + S}"/><line class="cut" x1="${L}" y1="${y}" x2="${L + S}" y2="${y}"/>`;
    const rects = [["A", L, TOP, x, y], ["B", x, TOP, L + S, y], ["C", L, y, x, TOP + S], ["D", x, y, L + S, TOP + S]];
    for (const [name, x1, y1, x2, y2] of rects) {
      if (Math.min(x2 - x1, y2 - y1) < 18) continue;
      s += `<text class="area" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + 6}" text-anchor="middle">${name}</text>`;
    }
    corners.forEach(([cx, cy, side], k) => {
      s += `<rect x="${cx - 7}" y="${cy - 7}" width="14" height="14" class="px" style="fill: ${shade(vals[k])}"/>`;
      s += `<text class="val" x="${cx}" y="${cy + side * 17 + (side > 0 ? 9 : 0)}" text-anchor="middle"><tspan font-style="italic">I</tspan>′<tspan dy="4" font-size="11">${k + 1}</tspan><tspan dy="-4"> = ${vals[k]}</tspan></text>`;
    });
    s += `<circle class="pt-dot" cx="${x}" cy="${y}" r="5"/></svg>`;
    return s;
  }

  function render() {
    const { j, i, mode } = st;
    // The whole output, read backward through H.
    cells[1].forEach((r, a) => r.forEach((c, b) => {
      const v = sample(...source(b, a), mode);
      c.style.fill = v === null ? "none" : shade(v);
      slashes[a][b].setAttribute("visibility", v === null ? "visible" : "hidden");
    }));
    const px = X0[1] + j * CELL, py = Y0 + i * CELL;
    pick.setAttribute("x", px); pick.setAttribute("y", py);
    h.setAttribute("transform", `translate(${px + CELL / 2},${py + CELL / 2})`);
    h.setAttribute("aria-label", tr(`Output pixel at column ${j}, row ${i}. Use the arrow keys to move it.`, `Píxel del resultado en la columna ${j}, fila ${i}. Usa las flechas del teclado para moverlo.`));

    const [x, y] = source(j, i);
    const m = apply(H, [j, i, 1]);
    const ok = inside(x, y);
    [block, dotM].forEach((e) => e.setAttribute("visibility", ok ? "visible" : "hidden"));

    let html = `<span class="lbl">${tr("Where the pixel reads the source", "Dónde lee el píxel en la imagen original")}</span>`;
    html += `<p class="eq"><span class="nowrap">${mp()} = <i>H</i>${sym("m", "", "pt")}</span> <span class="nowrap">≈ ${mat(H)}${col([j, i, 1], "pt")}</span> <span class="nowrap">${m.some(rounded) ? "≈" : "="} ${col(m, "pt")}</span></p>`;
    const at = `<span class="nowrap">(<i>x</i>′, <i>y</i>′) ${rounded(x) || rounded(y) ? "≈" : "="} <span class="pt">(${fmt(x)}, ${fmt(y)})</span></span>`;
    html += tr(`<p>This <i>H</i> turns by 30° around the center pixel. The output pixel in column ${j}, row ${i} reads the source at ${at}.</p>`, `<p>Esta <i>H</i> gira en 30° en torno al píxel central. El píxel del resultado en la columna ${j}, fila ${i} lee la imagen original en ${at}.</p>`);
    if (!ok) {
      html += `<p class="muted">${tr(`That is outside the source, whose pixel centers run from 0 to ${N - 1} in both directions. There is nothing to read, so the output pixel stays empty.`, `Eso queda fuera de la imagen original, cuyos centros de píxel van de 0 a ${N - 1} en ambas direcciones. No hay nada que leer, así que el píxel del resultado queda vacío.`)}</p>`;
      out.innerHTML = html;
      return;
    }
    const a = around(x, y), vals = [SRC[a.i][a.j], SRC[a.i][a.j + 1], SRC[a.i + 1][a.j], SRC[a.i + 1][a.j + 1]];
    block.setAttribute("x", X0[0] + a.j * CELL); block.setAttribute("y", Y0 + a.i * CELL);
    dotM.setAttribute("cx", X0[0] + (x + 0.5) * CELL); dotM.setAttribute("cy", Y0 + (y + 0.5) * CELL);
    const I = (k) => `<i>I</i>′<sub>${k}</sub>`;
    html += tr(`<p>It lies between columns ${a.j} and ${a.j + 1} and rows ${a.i} and ${a.i + 1}, among the four outlined pixels ${I(1)} = ${vals[0]}, ${I(2)} = ${vals[1]}, ${I(3)} = ${vals[2]} and ${I(4)} = ${vals[3]}.</p>`, `<p>Está entre las columnas ${a.j} y ${a.j + 1} y las filas ${a.i} y ${a.i + 1}, entre los cuatro píxeles marcados ${I(1)} = ${vals[0]}, ${I(2)} = ${vals[1]}, ${I(3)} = ${vals[2]} e ${I(4)} = ${vals[3]}.</p>`);
    if (mode === "nearest") {
      const k = (Math.round(y) - a.i) * 2 + (Math.round(x) - a.j);
      html += `<span class="lbl">${tr("Nearest pixel", "Píxel más cercano")}</span>`;
      html += tr(`<p>The closest of the four is ${I(k + 1)}, in column ${Math.round(x)}, row ${Math.round(y)}, so <span class="nowrap"><i>I</i> = ${vals[k]}</span>.</p>`, `<p>El más cercano de los cuatro es ${I(k + 1)}, en la columna ${Math.round(x)}, fila ${Math.round(y)}, así que <span class="nowrap"><i>I</i> = ${vals[k]}</span>.</p>`);
    } else {
      const { u, v } = a, w = [u * v, (1 - u) * v, u * (1 - v), (1 - u) * (1 - v)];
      const value = sample(x, y, "bilinear");
      html += `<span class="lbl">${tr("Bilinear interpolation", "Interpolación bilineal")}</span>`;
      html += inset(u, v, vals);
      html += tr(`<p>${mp()} is <span class="nowrap"><i>u</i> ${approx(u)}</span> of a pixel right of ${I(1)} and <span class="nowrap"><i>v</i> ${approx(v)}</span> below it, so</p>`, `<p>${mp()} está a <span class="nowrap"><i>u</i> ${approx(u)}</span> de píxel a la derecha de ${I(1)} y a <span class="nowrap"><i>v</i> ${approx(v)}</span> por debajo, así que</p>`);
      html += `<p><span class="nowrap"><i>A</i> = <i>uv</i> ${approx(w[0])},</span> <span class="nowrap"><i>B</i> = (1 − <i>u</i>)<i>v</i> ${approx(w[1])},</span> <span class="nowrap"><i>C</i> = <i>u</i>(1 − <i>v</i>) ${approx(w[2])},</span> <span class="nowrap"><i>D</i> = (1 − <i>u</i>)(1 − <i>v</i>) ${approx(w[3])}</span></p>`;
      html += `<p class="eq"><span class="nowrap"><i>I</i> = <i>A</i>&thinsp;${I(4)} + <i>B</i>&thinsp;${I(3)} + <i>C</i>&thinsp;${I(2)} + <i>D</i>&thinsp;${I(1)}</span> <span class="nowrap">${w.some(rounded) ? "≈" : "="} ${fmt(w[0])}·${vals[3]} + ${fmt(w[1])}·${vals[2]}</span> <span class="nowrap">+ ${fmt(w[2])}·${vals[1]} + ${fmt(w[3])}·${vals[0]}</span> <span class="nowrap">${approx(value)}</span></p>`;
    }
    out.innerHTML = html;
  }

  makeDraggable(h, {
    move: (s) => {
      st.j = Math.max(0, Math.min(N - 1, Math.floor((s.x - X0[1]) / CELL)));
      st.i = Math.max(0, Math.min(N - 1, Math.floor((s.y - Y0) / CELL)));
      render();
    },
    // Rows count downward, so the up arrow moves to the row above.
    step: ([dx, dy]) => {
      st.j = Math.max(0, Math.min(N - 1, st.j + dx));
      st.i = Math.max(0, Math.min(N - 1, st.i - dy));
      render();
    },
  });
  const press = modeButtons(group, (mode) => { st.mode = mode; render(); });
  document.getElementById("fig-warp-reset")?.addEventListener("click", () => { st = { ...initial }; press(st.mode); render(); });
  render();
}

fourKinds();
warping();
