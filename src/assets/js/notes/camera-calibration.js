import { createSpace, el, makeHandle, makeDraggable, apply, solve, dot, transpose, fmt, fmtSig, mat, modeButtons, mathLabel, placeClear, projectionMatrix, opticalCenter, decomposeCamera, anglesOf, tr } from "../plane.js";

const add = (a, b) => a.map((x, i) => x + b[i]);
const times = (v, k) => v.map((x) => x * k);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const deg = (r) => (r * 180) / Math.PI;
const list = (v, f = fmt) => v.map((x) => f(x)).join(", ");
const show = (els, on) => els.forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));
// Whether fmt(n, d) has to round n; readouts then write ≈ instead of =.
const rounded = (n, d = 2) => Math.abs(n * 10 ** d - Math.round(n * 10 ** d)) > 1e-6;
const approx = (...vs) => (vs.flat().some((v) => rounded(v)) ? "≈" : "=");

/* The table: 800 mm deep along X′ (from the back legs toward the camera), 1250 mm wide along Y′ (to the right) and
   900 mm tall along Z′ (up), with its origin at the bottom of the back left leg. Its eight corners, the ends of its
   legs, and the pixels where they were clicked in an image of 1842 × 1408 pixels. */
const CORNERS = [[800, 0, 0], [800, 0, 900], [0, 0, 900], [0, 0, 0], [800, 1250, 0], [800, 1250, 900], [0, 1250, 900], [0, 1250, 0]];
const CLICKS = [[268, 1178], [166, 294], [412, 328], [470, 940], [1654, 1118], [1704, 246], [1426, 304], [1420, 900]];
const EDGES = [[0, 1], [3, 2], [4, 5], [7, 6], [0, 3], [1, 2], [4, 7], [5, 6], [0, 4], [1, 5], [2, 6], [3, 7]];
const ALL = CORNERS.map((_, i) => i);
// TOL is RANSAC's tolerance in pixels. With only eight clicked corners, a camera fitted to seven of them predicts the
// eighth 7 to 24 pixels off even when every click is right, so a tighter tolerance would call good corners outliers.
const W = 1842, H = 1408, TOL = 20, STEP = 10;
// Every set of eight, seven or six corners (1 + 8 + 28 = 37), largest first.
const SETS = [ALL, ...ALL.map((a) => ALL.filter((i) => i !== a))];
for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) SETS.push(ALL.filter((i) => i !== a && i !== b));

const wh = sym("w"), what = sym("ŵ");
function sym(name) { return `<span class="pt"><i>${name}</i><sub><i>i</i></sub></span>`; }

/* The camera found from the clicks. In least-squares mode, A is fitted to all eight corners. In RANSAC mode, the
   figure looks for the consensus that RANSAC samples for, exhaustively: it fits A to every set of eight, seven or six
   corners and keeps the largest set whose corners all land within TOL pixels of the fit to them. A random sample of
   six would say little here, since A fits almost any six corners closely (twelve equations, eleven unknowns). With
   eight corners and eleven parameters, a moved corner can sometimes be explained as well by leaving out a neighbor
   and bending the camera's intrinsic parameters, so ties go to the most plausible camera: principal point nearest
   the center of the image, and least skew. */
function project(A, X) {
  const p = apply(A, [...X, 1]);
  return { u: p[0] / p[2], v: p[1] / p[2], lambda: p[2] };
}
function errors(A, w) {
  return CORNERS.map((X, i) => { const p = project(A, X); return p.lambda > 0 ? Math.hypot(p.u - w[i][0], p.v - w[i][1]) : Infinity; });
}
const fitTo = (idx, w) => projectionMatrix(idx.map((i) => [CORNERS[i], w[i]]));
function fit(w, mode) {
  const A = fitTo(ALL, w);
  if (mode !== "ransac") return { A, used: ALL };
  // How far a camera is from a typical one: its principal point's distance from the center of the image, plus |γ|.
  const oddness = (M) => { const D = decomposeCamera(M); return D && !D.mirror ? Math.hypot(D.u0 - W / 2, D.v0 - H / 2) + Math.abs(D.gamma) : Infinity; };
  let best = null;
  for (const s of SETS) {
    if (best && s.length < best.used.length) break;
    const As = fitTo(s, w);
    if (!As) continue;
    const e = errors(As, w);
    if (!s.every((i) => e[i] < TOL)) continue;
    const odd = oddness(As);
    if (!best || odd < best.odd) best = { A: As, used: s, odd };
  }
  return best ? { A: best.A, used: best.used } : { A, used: ALL, failed: true };
}

function calibration() {
  const svgI = document.getElementById("fig-calib-image");
  const svgS = document.getElementById("fig-calib-space");
  const out = document.getElementById("fig-calib-out");
  const group = document.getElementById("fig-calib-modes");
  if (!svgI || !svgS || !out || !group) return;
  const initial = { w: CLICKS.map((p) => [...p]), mode: "lsq" };
  let st = structuredClone(initial);

  /* ---------- The image: u to the right, v down, from the top left corner ---------- */
  const SC = 0.217, OX = 55, OY = 30;
  svgI.setAttribute("viewBox", `0 0 460 ${Math.ceil(OY + H * SC + 8)}`);
  const IX = (u) => OX + SC * u, IY = (v) => OY + SC * v;
  const clip = el("clipPath", { id: "fig-calib-clip" }, el("defs", null, svgI));
  el("rect", { x: OX, y: OY, width: W * SC, height: H * SC }, clip);
  el("rect", { x: OX, y: OY, width: W * SC, height: H * SC, class: "px-frame" }, svgI);
  const ticks = el("g", { class: "axes" }, svgI);
  for (const u of [0, 500, 1000, 1500]) {
    el("line", { x1: IX(u), y1: OY, x2: IX(u), y2: OY - 5 }, ticks);
    el("text", { x: IX(u), y: OY - 9, "text-anchor": "middle", class: "tick" }, svgI).textContent = u;
  }
  for (const v of [500, 1000]) {
    el("line", { x1: OX, y1: IY(v), x2: OX - 5, y2: IY(v) }, ticks);
    el("text", { x: OX - 9, y: IY(v) + 5, "text-anchor": "end", class: "tick" }, svgI).textContent = v;
  }
  mathLabel(svgI, "axl", [["u", true]]).setAttribute("transform", `translate(${IX(W) - 8},${OY - 9})`);
  mathLabel(svgI, "axl", [["v", true]]).setAttribute("transform", `translate(${OX - 22},${IY(H) - 4})`);

  const drawn = el("g", { "clip-path": "url(#fig-calib-clip)" }, svgI);
  const edgeEls = EDGES.map(() => el("line", { class: "edge" }, drawn));
  const errEls = ALL.map(() => el("line", { class: "err" }, drawn));
  const ringEls = ALL.map(() => el("circle", { r: 10, class: "reproj" }, drawn));
  const numEls = ALL.map((i) => { const t = el("text", { class: "corner-lab", "text-anchor": "middle" }, svgI); t.textContent = i; return t; });
  const handleG = el("g", null, svgI);
  const handles = ALL.map((i) => {
    const h = makeHandle(handleG, "point");
    makeDraggable(h, {
      move: (s) => setClick(i, [(s.x - OX) / SC, (s.y - OY) / SC]),
      step: ([dx, dy]) => setClick(i, [st.w[i][0] + STEP * dx, st.w[i][1] - STEP * dy]),
    });
    return h;
  });
  function setClick(i, [u, v]) {
    st.w[i] = [clamp(Math.round(u), 0, W), clamp(Math.round(v), 0, H)];
    render();
  }

  /* ---------- Space: the table's own coordinates, with Z′ up ---------- */
  const VIEW = [-35, 34];
  const S = createSpace(svgS, { height: 380, scale: 0.155, pivot: [1300, 650, 420], at: [236, 208], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-180, 180], pitchRange: [4, 75] });
  // Layers: the far side of the camera's image (the table and the rays beyond the image), the image itself, and the
  // camera's side of it (C, its axes and the rays up to the image). Render stacks them by which side faces the reader.
  const far = S.el("g"), panelG = S.el("g"), near = S.el("g"), labels = S.el("g");
  const tableAxes = S.el("g", { class: "axes" }, far);
  const AXIS_END = [[1150, 0, 0], [0, 1750, 0], [0, 0, 1200]];
  AXIS_END.forEach((e) => S.line(tableAxes, [0, 0, 0], e));
  const fixedLabs = AXIS_END.map((e, a) => S.pin(mathLabel(labels, "axl", [["XYZ"[a], true], ["′"]]), e, e, 14));
  EDGES.forEach(([a, b]) => S.line(far, CORNERS[a], CORNERS[b], "edge"));
  const rayFar = ALL.map(() => S.el("line", { class: "ray thin" }, far));
  CORNERS.forEach((X) => S.dot(far, X, 4.5, "pt-dot"));
  const panel = S.el("polygon", { class: "panel clear" }, panelG);
  const pixDots = ALL.map(() => S.el("circle", { r: 2.6, class: "pt-dot" }, panelG));
  const rayNear = ALL.map(() => S.el("line", { class: "ray thin" }, near));
  const camAxes = [0, 1, 2].map(() => S.el("line", { class: "cam-axis" }, near));
  const dotC = S.el("circle", { r: 4, class: "origin" }, near);
  const camLabs = "XYZ".split("").map((n) => mathLabel(labels, "axl", [[n, true]]));
  const labC = mathLabel(labels, "axl", [["C", true]]);
  const CAM_AXIS = 360;

  // The ray through pixel w leaves C along B⁻¹w, the direction whose points s·B⁻¹w + C have λ = s.
  function drawSpace(A, C, D, used) {
    const ok = A && C && D && !D.mirror;
    show([...rayFar, ...rayNear, ...pixDots, panel, dotC, labC, ...camAxes, ...camLabs], !!ok);
    if (!ok) return true;
    const B = A.map((r) => r.slice(0, 3));
    const dir = (u, v) => solve(B, [u, v, 1]);
    const zc = D.Rp[2];   // the camera's Z axis, its viewing direction
    // The image is drawn at a quarter of the depth of the table's origin: λ = 0.25.
    const S_PANEL = 0.25;
    S.setPoly(panel, [[0, 0], [W, 0], [W, H], [0, H]].map(([u, v]) => add(C, times(dir(u, v), S_PANEL))));
    ALL.forEach((i) => {
      const d = dir(...st.w[i]);
      const onPanel = add(C, times(d, S_PANEL));
      const reach = Math.max(S_PANEL, project(A, CORNERS[i]).lambda * 1.04);
      const [px, py] = S.project(onPanel);
      pixDots[i].setAttribute("cx", px); pixDots[i].setAttribute("cy", py);
      S.setLine(rayNear[i], C, onPanel);
      S.setLine(rayFar[i], onPanel, add(C, times(d, reach)));
      const inlier = used.includes(i);
      rayNear[i].setAttribute("class", `ray thin${inlier ? "" : " dash"}`);
      rayFar[i].setAttribute("class", `ray thin${inlier ? "" : " dash"}`);
    });
    D.Rp.forEach((axis, a) => {
      const end = add(C, times(axis, CAM_AXIS));
      S.setLine(camAxes[a], C, end);
      const o = S.offset(axis);
      S.placeLabel(camLabs[a], end, Math.hypot(...o) > 6 ? o : [1, -1], 12);
    });
    const [cx, cy] = S.project(C);
    dotC.setAttribute("cx", cx); dotC.setAttribute("cy", cy);
    placeClear(S, labC, C, 16, S.offset(zc), [...fixedLabs, ...camLabs].map((l) => l.getBBox()));
    // The side of the image the reader is on is drawn last.
    const readerAhead = dot(S.toward(), zc) > 0;
    (readerAhead ? [near, panelG, far] : [far, panelG, near]).forEach((g) => svgS.insertBefore(g, labels));
    return cx >= 0 && cx <= S.width && cy >= 0 && cy <= S.height;
  }

  /* ---------- Render ---------- */
  function render() {
    const { A, used, failed } = fit(st.w, st.mode);
    const C = A && opticalCenter(A);
    const D = A && decomposeCamera(A);
    const e = A ? errors(A, st.w) : ALL.map(() => NaN);
    const lambdas = A ? CORNERS.map((X) => project(A, X).lambda) : [];

    // The image: projected edges, reprojections, clicks and their numbers.
    const cen = [0, 1].map((k) => st.w.reduce((s, p) => s + p[k], 0) / 8);
    ALL.forEach((i) => {
      const [u, v] = st.w[i];
      handles[i].setAttribute("transform", `translate(${IX(u)},${IY(v)})`);
      const inlier = used.includes(i);
      handles[i].classList.toggle("out", !inlier);
      handles[i].setAttribute("aria-label", tr(`Corner ${i}, clicked at pixel (${u}, ${v})${inlier ? "" : ", left out by RANSAC as an outlier"}. Use the arrow keys to move it 10 pixels.`, `Esquina ${i}, marcada en el píxel (${u}, ${v})${inlier ? "" : ", que RANSAC deja fuera como valor atípico"}. Usa las flechas del teclado para moverla 10 píxeles.`));
      // Front corners are labeled outside the table, back corners inside its back face, clear of the edges.
      const side = CORNERS[i][0] > 0 ? 1 : -1;
      const d = [side * (u - cen[0]), side * (v - cen[1])], n = Math.hypot(...d) || 1;
      numEls[i].setAttribute("x", IX(u) + (d[0] / n) * 20);
      numEls[i].setAttribute("y", IY(v) + (d[1] / n) * 20 + 5);
      const p = A && project(A, CORNERS[i]);
      const seen = p && p.lambda > 0;
      show([ringEls[i], errEls[i]], !!seen);
      if (seen) {
        ringEls[i].setAttribute("cx", IX(p.u)); ringEls[i].setAttribute("cy", IY(p.v));
        errEls[i].setAttribute("x1", IX(u)); errEls[i].setAttribute("y1", IY(v));
        errEls[i].setAttribute("x2", IX(p.u)); errEls[i].setAttribute("y2", IY(p.v));
      }
    });
    EDGES.forEach(([a, b], n) => {
      const pa = A && project(A, CORNERS[a]), pb = A && project(A, CORNERS[b]);
      const on = pa && pb && pa.lambda > 0 && pb.lambda > 0;
      show([edgeEls[n]], on);
      if (on) { edgeEls[n].setAttribute("x1", IX(pa.u)); edgeEls[n].setAttribute("y1", IY(pa.v)); edgeEls[n].setAttribute("x2", IX(pb.u)); edgeEls[n].setAttribute("y2", IY(pb.v)); }
    });
    const inView = drawSpace(A, C, D, used);

    // The readout.
    const n = used.length;
    let html = `<span class="lbl">${tr("Fitting <i>A</i>", "El ajuste de <i>A</i>")}</span>`;
    if (!A) {
      html += `<p class="muted">${tr("With these clicks, the equations do not fix the eleven entries of <i>A</i>, so there is no camera to show.", "Con estos clics, las ecuaciones no determinan las once entradas de <i>A</i>, así que no hay cámara que mostrar.")}</p>`;
      out.innerHTML = html;
      return;
    }
    if (st.mode === "ransac" && !failed) {
      const outliers = ALL.filter((i) => !used.includes(i));
      const how = tr(`The figure fitted <i>A</i> to every set of eight, seven or six corners and kept the largest set whose own fit puts each of its corners within ${TOL} pixels of its click.`, `La figura ajustó <i>A</i> a cada conjunto de ocho, siete o seis esquinas y se quedó con el conjunto más grande cuyo propio ajuste deja cada una de sus esquinas a menos de ${TOL} píxeles de su clic.`);
      html += outliers.length
        ? `<p>${how} ${tr(`That set has ${n} of the 8 corners, corners ${used.join(", ")}:`, `Ese conjunto tiene ${n} de las 8 esquinas, las esquinas ${used.join(", ")}:`)}</p>`
        : `<p>${how} ${tr("That set is all 8 corners, so the fit is the least-squares fit:", "Ese conjunto son las 8 esquinas, así que el ajuste es el de mínimos cuadrados:")}</p>`;
    } else {
      if (failed) html += `<p class="muted">${tr(`No set of six or more corners lands within ${TOL} pixels of the fit to it, so there is no consensus, and the figure shows the least-squares fit.`, `Ningún conjunto de seis o más esquinas cae a menos de ${TOL} píxeles de su propio ajuste, así que no hay consenso, y la figura muestra el ajuste por mínimos cuadrados.`)}</p>`;
      html += `<p>${tr(`The 8 corners give 16 equations for the 11 unknowns of <i>A</i>, solved by least squares with <i>a</i><sub>34</sub> = 1:`, `Las 8 esquinas dan 16 ecuaciones para las 11 incógnitas de <i>A</i>, resueltas por mínimos cuadrados con <i>a</i><sub>34</sub> = 1:`)}</p>`;
    }
    html += `<p class="eq fit"><i>A</i> ≈ ${mat(A, "", (x) => fmtSig(x, 3))}</p>`;

    html += `<span class="lbl">${tr("How far off", "Qué tan lejos")}</span>`;
    const shown = ALL.map((i) => (Number.isFinite(e[i]) ? fmt(e[i]) : "∞"));
    html += `<p>${tr(`Distance from each reprojection ${what} to its click ${wh}, corners 0 to 7, in pixels:`, `Distancia de cada reproyección ${what} a su clic ${wh}, esquinas 0 a 7, en píxeles:`)} ${shown.join(", ")}.</p>`;
    const sum = used.reduce((s, i) => s + e[i], 0);
    if (Number.isFinite(sum)) {
      const over = n === 8 ? "" : tr(` over the ${n} inliers`, ` sobre las ${n} esquinas consistentes`);
      html += `<p class="eq"><span class="nowrap"><i>J</i> ${approx(sum)} ${fmt(sum)} / ${n}</span> <span class="nowrap">${approx(sum / n)} ${fmt(sum / n)}</span></p>`;
      if (over) html += `<p>${tr(`That is the average${over}.`, `Ese es el promedio${over}.`)} ${ALL.filter((i) => !used.includes(i)).map((i) => tr(`Corner ${i} is an outlier, ${fmt(e[i])} pixels off.`, `La esquina ${i} es un valor atípico, a ${fmt(e[i])} píxeles.`)).join(" ")}</p>`;
    }
    const behind = ALL.filter((i) => !(lambdas[i] > 0));
    if (behind.length) html += `<p class="muted">${tr(`With this <i>A</i>, corner${behind.length > 1 ? "s" : ""} ${behind.join(", ")} would be behind the camera (λ ≤ 0), so no real camera sees the table this way.`, `Con esta <i>A</i>, ${behind.length > 1 ? "las esquinas" : "la esquina"} ${behind.join(", ")} ${behind.length > 1 ? "quedarían" : "quedaría"} detrás de la cámara (λ ≤ 0), así que ninguna cámara real ve la mesa de esta forma.`)}</p>`;

    html += `<span class="lbl">${tr("Where the camera is, in millimeters", "Dónde está la cámara, en milímetros")}</span>`;
    if (!C || !D) {
      html += `<p class="muted">${tr("The left 3 × 3 block <i>B</i> of <i>A</i> is singular, so the camera would have its optical center at infinity.", "El bloque izquierdo <i>B</i> de 3 × 3 de <i>A</i> es singular, así que la cámara tendría su centro óptico en el infinito.")}</p>`;
      out.innerHTML = html;
      return;
    }
    html += `<p class="eq"><span class="nowrap"><i>C</i> = −<i>B</i><sup class="t">−1</sup><i>b</i></span> <span class="nowrap">${approx(C)} (${list(C)})</span></p>`;
    if (!inView) html += `<p class="muted">${tr("The camera lies outside the drawn part of space.", "La cámara queda fuera de la parte dibujada del espacio.")}</p>`;

    html += `<span class="lbl">${tr("Its eleven parameters", "Sus once parámetros")}</span>`;
    if (D.mirror) {
      html += `<p class="muted">${tr("No real camera gives these clicks: <i>A</i> only splits into a mirror image of a camera, with det <i>R</i>′ = −1, as if the image had been flipped.", "Ninguna cámara real da estos clics: <i>A</i> solo se descompone en la imagen especular de una cámara, con det <i>R</i>′ = −1, como si la imagen se hubiera volteado.")}</p>`;
    } else {
      const w = anglesOf(transpose(D.Rp)).map(deg);
      const intr = [["α", D.alpha], ["β", D.beta], ["γ", D.gamma], ["<i>u</i><sub>0</sub>", D.u0], ["<i>v</i><sub>0</sub>", D.v0]];
      html += `<p class="eq">${intr.map(([s, x]) => `<span class="nowrap">${s} ${approx(x)} ${fmt(x)}</span>`).join(",&ensp; ")}</p>`;
      html += `<p class="eq"><span class="nowrap">ω ${approx(w)} (${w.map((x) => `${fmt(x)}°`).join(", ")}),</span>&ensp; <span class="nowrap"><i>t</i>′ ${approx(D.tp)} (${list(D.tp)})</span></p>`;
    }
    out.innerHTML = html;
  }

  const press = modeButtons(group, (mode) => { st.mode = mode; render(); });
  S.turnable(render);
  document.getElementById("fig-calib-reset")?.addEventListener("click", () => { st = structuredClone(initial); press(st.mode); S.setView(...VIEW); render(); });
  render();
}

calibration();
