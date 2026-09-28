import { createSpace, makeHandle, makeDraggable, apply, matMul, transpose, dot, rotX, rotY, rotZ, rotation3d, fmt, T, sym, col, mat, frac, modeButtons, wholeNumberInput, mathLabel, markBox, placeClear, stepRange, clampTo, tr } from "../plane.js";

const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const times = (v, k) => v.map((x) => x * k);
const clamp = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x));
// Whether fmt(n, d) has to round n; readouts then write ≈ instead of =.
const rounded = (n, d = 2) => Math.abs(n * 10 ** d - Math.round(n * 10 ** d)) > 1e-6;
const f4 = (n) => fmt(n, 4);
const list = (v, f = fmt) => v.map((x) => f(x)).join(", ");
// Entries that are zero up to rounding error, such as cos 90°, are set to 0.
const tidy = (A) => A.map((r) => r.map((v) => (Math.abs(v) < 1e-12 ? 0 : v)));
const show = (els, on) => els.forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));

const AX = ["X", "Y", "Z"];
const R_ = (a) => `<i>R</i><sub><i>${a}</i></sub>`;
const w_ = (a) => `ω<sub><i>${a}</i></sub>`;
const Mh = sym("M", "", "pt"), MPh = '<span class="pt"><i>M</i>′</span>', mh = sym("m", "", "pt");

/* Figure 1: a point in two coordinate systems of space. The box is attached to the new axes X′, Y′, Z′, turned from
   X, Y, Z first about Z, then Y, then X, with the new origin at t′. The corner M′ = (2, 1, 1) is found at M = R′M′ + t′. */
function twoFrames() {
  const svg = document.getElementById("fig-frames");
  const out = document.getElementById("fig-frames-out");
  const wIn = ["x", "y", "z"].map((k) => document.getElementById(`fig-frames-w${k}`));
  const tIn = ["x", "y", "z"].map((k) => document.getElementById(`fig-frames-t${k}`));
  if (!svg || !out || [...wIn, ...tIn].some((i) => !i)) return;
  // A true view, with no stretch, since the figure is about angles. Everything drawn stays inside the region
  // [LO, HI] of space, and every view of that region fits the figure: a view never draws two points farther
  // apart than they are.
  const VIEW = [-32, 20];
  const S = createSpace(svg, { scale: 44, pivot: [2, 2, 1.5], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-150, 60] });
  const LO = [-1, -1, -1], HI = [5, 5, 4];
  // The box is 2 × 1 × 1 along X′, Y′ and Z′, and M′ = (2, 1, 1) is its far corner. The primed axes reach past it.
  // tp is t′, the new origin written in the old system.
  const SIZE = [2, 1, 1], AXIS = [2.8, 1.8, 1.8], MP = [2, 1, 1];
  const initial = { w: [15, 10, 0], tp: [1, 3, 2] };
  let st = structuredClone(initial);
  let refused = "";   // why the last change was not made, if it was not

  // Layers, back to front: the world axes, the far side of the box, its near side, the primed axes and M, labels, handles.
  const world = S.el("g"), back = S.el("g"), front = S.el("g"), marks = S.el("g"), labels = S.el("g"), handles = S.el("g");
  const worldAxes = S.el("g", { class: "axes" }, world);
  const ENDS = [[4.5, 0, 0], [0, 4.5, 0], [0, 0, 3.5]];
  ENDS.forEach((e) => S.line(worldAxes, [0, 0, 0], e));
  S.dot(world, [0, 0, 0], 3, "origin");
  const fixed = ENDS.map((e, a) => S.pin(mathLabel(labels, "axl", [[AX[a], true]]), e, e, 14));

  // The faces of the box, by the axis they are perpendicular to and their side, and its edges, by the axis they
  // run along and the two faces they join. Corners are indexed [i, j, k] in {0, 1}³.
  const FACES = [], EDGES = [];
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, c = (a + 2) % 3;
    const at = (va, vb, vc) => { const x = []; x[a] = va; x[b] = vb; x[c] = vc; return x; };
    for (const s of [0, 1]) FACES.push({ a, s, corners: [at(s, 0, 0), at(s, 1, 0), at(s, 1, 1), at(s, 0, 1)] });
    for (const u of [0, 1]) for (const v of [0, 1]) EDGES.push({ from: at(0, u, v), to: at(1, u, v), faces: [[b, u], [c, v]] });
  }
  const tLine = S.el("line", { class: "ext" }, back);
  const faceEls = FACES.map(() => S.el("polygon", { class: "fan" }, back));
  const edgeEls = EDGES.map(() => S.el("line", null, back));
  const axisExt = [0, 1, 2].map(() => S.el("line", { class: "ln-path" }, marks));
  const dotM = S.el("circle", { r: 7, class: "pt-dot" }, marks);
  const axisLabs = AX.map((n) => mathLabel(labels, "ln-lab", [[n, true], ["′"]]));
  const labT = mathLabel(labels, "ln-lab", [["t", true], ["′"]]);
  const labM = mathLabel(labels, "pt-lab", [["M", true]]);
  const hT = makeHandle(handles, "grip");

  // R gives new coordinates from old ones, so its rows are the new axes written in the old system, and
  // R′ = Rᵀ takes a point of the box back to the old system.
  function geometry(s) {
    const R = tidy(rotation3d(...s.w.map(rad))), Rp = transpose(R);
    const corner = (ix) => add(s.tp, apply(Rp, ix.map((v, i) => v * SIZE[i])));
    const axisEnd = (a) => add(s.tp, times(R[a], AXIS[a]));
    return { R, Rp, corner, axisEnd };
  }
  const inside = (p) => p.every((v, i) => v > LO[i] - 1e-9 && v < HI[i] + 1e-9);
  function fits(s) {
    const { corner, axisEnd } = geometry(s);
    const pts = [0, 1, 2].map(axisEnd);
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) pts.push(corner([i, j, k]));
    return pts.every(inside);
  }

  // A change is made only if the whole box stays in the drawn region; otherwise msg says why not.
  function tryState(next, msg = "") {
    if (fits(next)) { st = next; refused = ""; } else refused = msg;
    render();
  }
  const keep = (name, v, old, unit) => tr(`With ${name} = ${fmt(v)}${unit}, part of the box would leave the drawn space, so the figure keeps ${name} = ${fmt(old)}${unit}.`, `Con ${name} = ${fmt(v)}${unit}, parte de la caja saldría del espacio dibujado, así que la figura mantiene ${name} = ${fmt(old)}${unit}.`);
  const showW = wIn.map((inp, i) => wholeNumberInput(inp, {
    min: -180, max: 180, get: () => st.w[i],
    set: (v) => { const w = [...st.w]; w[i] = v; tryState({ ...st, w }, keep(w_(AX[i]), v, st.w[i], "°")); },
  }));
  const showT = tIn.map((inp, i) => wholeNumberInput(inp, {
    min: LO[i], max: HI[i], get: () => st.tp[i],
    set: (v) => { const tp = [...st.tp]; tp[i] = v; tryState({ ...st, tp }, keep(`<i>t</i>′<sub><i>${AX[i]}</i></sub>`, v, st.tp[i], "")); },
  }));

  function render() {
    showW.forEach((sh, i) => sh(st.w[i]));
    showT.forEach((sh, i) => sh(st.tp[i]));
    const { R, Rp, corner, axisEnd } = geometry(st);
    const axes = R;   // the unit vectors of X′, Y′ and Z′, written in X, Y, Z

    // A face whose outward normal points at the reader is in front; an edge between two faces that both point
    // away is hidden, and dashed. The three edges from the primed origin lie on the primed axes.
    const view = S.toward();
    const facing = axes.map((u) => { const d = dot(u, view); return [d < 0, d > 0]; });
    FACES.forEach(({ a, s, corners }, n) => {
      S.setPoly(faceEls[n], corners.map(corner));
      (facing[a][s] ? front : back).appendChild(faceEls[n]);
    });
    EDGES.forEach(({ from, to, faces }, n) => {
      const hidden = faces.every(([b, u]) => !facing[b][u]);
      const onAxis = from.every((v) => v === 0);
      edgeEls[n].setAttribute("class", `${onAxis ? "ln-path" : "fan-edge"}${hidden ? " dash" : ""}`);
      S.setLine(edgeEls[n], corner(from), corner(to));
      (hidden ? back : front).appendChild(edgeEls[n]);
    });
    axes.forEach((u, a) => {
      S.setLine(axisExt[a], add(st.tp, times(u, SIZE[a])), axisEnd(a));
      const o = S.offset(u);
      S.placeLabel(axisLabs[a], axisEnd(a), Math.hypot(...o) > 8 ? o : [1, -1], 15);
    });

    // M, drawn behind the near faces when all three faces around it point away.
    const M = corner([1, 1, 1]);
    (facing.every((f) => !f[1]) ? back : marks).appendChild(dotM);
    const [mx, my] = S.project(M);
    dotM.setAttribute("cx", mx); dotM.setAttribute("cy", my);
    S.placeLabel(labM, M, S.offset(sub(M, corner([0.5, 0.5, 0.5]))), 20);

    const zero = st.tp.every((v) => v === 0);
    show([tLine, labT], !zero);
    if (!zero) {
      S.setLine(tLine, [0, 0, 0], st.tp);
      placeClear(S, labT, times(st.tp, 0.5), 16, S.offset(st.tp), [...fixed, labM].map((l) => l.getBBox()));
    }
    S.place(hT, st.tp);
    hT.setAttribute("aria-label", tr(`Origin of the box's coordinate system at t′ = (${list(st.tp)}). Use the arrow keys to move it across the level plane Z = ${fmt(st.tp[2])}.`, `Origen del sistema de coordenadas de la caja en t′ = (${list(st.tp)}). Usa las flechas del teclado para moverlo por el plano horizontal Z = ${fmt(st.tp[2])}.`));

    // The readout, with the numbers shown to 4 decimals.
    const RpM = apply(Rp, MP), Mv = add(RpM, st.tp);
    const approxR = R.flat().some((v) => rounded(v, 4)) ? "≈" : "=";
    const approxM = [...RpM, ...Mv].some((v) => rounded(v, 4)) ? "≈" : "=";
    let html = `<span class="lbl">${tr("The rotation", "La rotación")}</span>`;
    html += `<p class="eq"><span class="nowrap"><i>R</i> = ${R_("X")}${R_("Y")}${R_("Z")}</span> <span class="nowrap">${approxR} ${mat(R, "", f4)}</span></p>`;
    if (Math.abs(st.w[1]) === 90) {
      const only = st.w[1] > 0 ? tr(`their difference, ${w_("X")} − ${w_("Z")}`, `su diferencia, ${w_("X")} − ${w_("Z")}`) : tr(`their sum, ${w_("X")} + ${w_("Z")}`, `su suma, ${w_("X")} + ${w_("Z")}`);
      html += `<p class="muted">${tr(`At ${w_("Y")} = ${fmt(st.w[1])}°, the turn about <i>Y</i> lays the <i>X</i> axis along the <i>Z</i> axis, so the turns by ${w_("Z")} and by ${w_("X")} happen about the same line, and only ${only}, matters: a change in one can be undone by the other. This is called gimbal lock.`, `Con ${w_("Y")} = ${fmt(st.w[1])}°, el giro en torno a <i>Y</i> deja el eje <i>X</i> sobre el eje <i>Z</i>, así que los giros por ${w_("Z")} y por ${w_("X")} ocurren en torno a la misma recta, y solo importa ${only}: un cambio en uno se puede deshacer con el otro. Esto se llama bloqueo del cardán (<i lang="en">gimbal lock</i>).`)}</p>`;
    }
    html += `<span class="lbl">${tr("The red corner, in <i>X</i>, <i>Y</i> and <i>Z</i>", "La esquina roja, en <i>X</i>, <i>Y</i> y <i>Z</i>")}</span>`;
    html += `<p class="eq"><span class="nowrap">${Mh} = <i>R</i>′${MPh} + <i>t</i>′</span> <span class="nowrap">${approxM} ${col(RpM, "", f4)} + ${col(st.tp)}</span> <span class="nowrap">${approxM} ${col(Mv, "pt", f4)}</span></p>`;
    html += tr(`<p>Here <span class="nowrap"><i>R</i>′ = <i>R</i>${T}</span>: its columns are the blue axes, and it takes the box's coordinates back to <i>X</i>, <i>Y</i> and <i>Z</i>.</p>`, `<p>Aquí <span class="nowrap"><i>R</i>′ = <i>R</i>${T}</span>: sus columnas son los ejes azules, y lleva las coordenadas de la caja de vuelta a <i>X</i>, <i>Y</i> y <i>Z</i>.</p>`);
    html += `<span class="lbl">${tr("Lengths are kept", "Las longitudes se conservan")}</span>`;
    html += `<p><span class="nowrap">‖${Mh} − <i>t</i>′‖ ≈ ${f4(Math.hypot(...RpM))},</span> ${tr("the same as", "igual que")} <span class="nowrap">‖${MPh}‖ = √6 ≈ ${f4(Math.sqrt(6))}</span> <span class="ok">✓</span></p>`;

    // The same angles applied in the other order: first X, then Y, then Z.
    const R2 = matMul(matMul(rotZ(rad(st.w[2])), rotY(rad(st.w[1]))), rotX(rad(st.w[0])));
    const M2 = add(apply(transpose(R2), MP), st.tp);
    const same = M2.every((v, i) => Math.abs(v - Mv[i]) < 5e-5);
    const turns = st.w.filter((v) => v % 360 !== 0).length;
    const Rzyx = `<span class="nowrap"><i>R</i> = ${R_("Z")}${R_("Y")}${R_("X")}</span>`;
    const other = tr(`Turning first about <i>X</i>, then <i>Y</i>, then <i>Z</i>, so that ${Rzyx},`, `Girar primero en torno a <i>X</i>, luego <i>Y</i> y luego <i>Z</i>, de modo que ${Rzyx},`);
    html += `<span class="lbl">${tr("In the other order", "En el otro orden")}</span>`;
    if (same) html += `<p>${other} ${turns <= 1 ? tr("puts the corner in the same place: with only one turn, there is no order to change.", "deja la esquina en el mismo lugar: con un solo giro, no hay orden que cambiar.") : tr("puts the corner in the same place here.", "deja la esquina en el mismo lugar en este caso.")}</p>`;
    else {
      const at = `<span class="nowrap">${M2.some((v) => rounded(v, 4)) ? "≈ " : ""}<span class="pt">(${list(M2, f4)})</span></span>`;
      html += `<p>${other} ${tr(`would put the corner at ${at} instead.`, `pondría la esquina en ${at}.`)}</p>`;
    }
    if (refused) html += `<p class="muted">${refused}</p>`;
    out.innerHTML = html;
  }

  // The new origin moves across its level plane, one unit per arrow key in the direction that looks closest.
  const LEVEL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  makeDraggable(hT, {
    move: (s) => { const p = S.onPlane(s, st.tp[2]); tryState({ ...st, tp: [Math.round(p.x), Math.round(p.y), st.tp[2]] }); },
    step: (d) => tryState({ ...st, tp: add(st.tp, S.closest(LEVEL, d)) }),
  });
  S.turnable(render);
  document.getElementById("fig-frames-reset")?.addEventListener("click", () => { st = structuredClone(initial); refused = ""; S.setView(...VIEW); render(); });
  render();
}

/* Figure 2: perspective projection, λm = PM. The ray from C through M meets the image plane at m */
function projection() {
  const svg = document.getElementById("fig-project");
  const out = document.getElementById("fig-project-out");
  const group = document.getElementById("fig-project-modes");
  const inY = document.getElementById("fig-project-y");
  const inF = document.getElementById("fig-project-f");
  if (!svg || !out || !group || !inY || !inF) return;
  // Camera coordinates [X, Y, Z] (X right, Y down, Z forward) are drawn as the space coordinates [Z, −X, −Y].
  // That turns the axes without mirroring them, so the optical axis runs level and Y points down.
  const toS = ([X, Y, Z]) => [Z, -X, -Y];
  // The default view looks over the camera's shoulder, so the image plane is seen as the camera sees it.
  const VIEW = [35, 20];
  const S = createSpace(svg, { height: 380, scale: 38, pivot: [3, 0, 0], at: [225, 205], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-180, 180] });
  const XR = [-3, 3], YR = [-3, 3], ZR = [-2, 8], FR = [1, 3], W = 3, H = 2, STEP = 0.5;
  const initial = { X: 2, Y: -2, Z: 4, f: 2, k: 1.5, mode: "front" };
  let st = { ...initial };

  // Layers, back to front: what lies on the far side of the image plane, the plane, what is drawn on it,
  // what lies on the reader's side, labels, handles. Render moves each piece to the side it is on.
  const back = S.el("g"), panelG = S.el("g"), onPanel = S.el("g"), front = S.el("g"), labels = S.el("g"), handles = S.el("g");
  const backAxes = S.el("g", { class: "axes" }, back), frontAxes = S.el("g", { class: "axes" }, front);
  const optical = [0, 1].map(() => S.el("line", null, backAxes));
  const camAxes = [0, 1].map(() => S.el("line", null, backAxes));
  const dotC = S.el("circle", { r: 3.5, class: "origin" }, back);
  const panel = S.el("polygon", { class: "panel clear" }, panelG);
  const grid = S.el("g", { class: "grid" }, panelG);
  const gridX = [-2, -1, 1, 2].map((x) => ({ x, l: S.el("line", null, grid) }));
  const gridY = [-1, 1].map((y) => ({ y, l: S.el("line", null, grid) }));
  const imgAxes = S.el("g", { class: "axes" }, onPanel);
  const [axX, axY] = [0, 1].map(() => S.el("line", null, imgAxes));
  const rays = [0, 1].map(() => S.el("line", { class: "ray" }, back));
  const dotm = S.el("circle", { r: 6, class: "pt-dot" }, onPanel);
  const ring = S.el("circle", { r: 11, class: "pt-ring" }, front);
  const dotM = S.el("circle", { r: 8, class: "pt-dot" }, front);

  const Z_END = 9, CAM = 1.3;
  const fixedLabs = [
    S.pin(mathLabel(labels, "axl", [["Z", true]]), toS([0, 0, Z_END]), toS([0, 0, 1]), 14),
    S.pin(mathLabel(labels, "axl", [["X", true]]), toS([CAM, 0, 0]), toS([1, 0, 0]), 13),
    S.pin(mathLabel(labels, "axl", [["Y", true]]), toS([0, CAM, 0]), toS([0, 1, 0]), 13),
    S.pin(mathLabel(labels, "axl", [["C", true]]), [0, 0, 0], [-1, -0.5], 16),
  ];
  const labx = mathLabel(labels, "axl", [["x", true]]), laby = mathLabel(labels, "axl", [["y", true]]);
  const labPlane = mathLabel(labels, "plane-lab", [["Z", true], [" = "], ["f", true]]);
  const labPlaneBehind = mathLabel(labels, "plane-lab", [["Z", true], [" = −"], ["f", true]]);
  const labm = mathLabel(labels, "pt-lab", [["m", true]]);
  const labM = mathLabel(labels, "pt-lab", [["M", true]]);
  const labK = mathLabel(labels, "pt-lab", [["k", true], ["M", true]]);
  const hM = makeHandle(handles, "none"), hK = makeHandle(handles, "none", 16);

  // Puts label t just past point p along the camera direction axis, or beside p if that spot overlaps an obstacle.
  const overlaps = (b, list) => list.some((o) => b.x < o.x + o.width && o.x < b.x + b.width && b.y < o.y + o.height && o.y < b.y + b.height);
  function pastEnd(t, p, axis, obstacles) {
    const o = S.offset(toS(axis));
    S.placeLabel(t, p, Math.hypot(...o) > 4 ? o : [1, 0], 14);
    if (overlaps(t.getBBox(), obstacles)) placeClear(S, t, p, 16, o, obstacles);
  }

  // k moves in steps of 0.5 along the ray, as far as kM stays inside the figure.
  const kRange = (Ms) => stepRange(S, Ms, STEP, STEP, 3);

  const showY = wholeNumberInput(inY, { min: YR[0], max: YR[1], get: () => st.Y, set: (v) => { st.Y = v; render(); } });
  const showF = wholeNumberInput(inF, { min: FR[0], max: FR[1], get: () => st.f, set: (v) => { st.f = v; render(); } });

  function render() {
    showY(st.Y); showF(st.f);
    const { X, Y, Z, f, mode } = st;
    const sign = mode === "front" ? 1 : -1, pf = sign * f;   // the image plane is Z = pf
    const M = [X, Y, Z], Ms = toS(M);
    // Which side of the image plane a depth Z lies on, as seen by the reader.
    const vs = S.toward()[0];
    const near = (z) => (z - pf) * vs >= 0;
    const put = (e, z, backG = back, frontG = front) => (near(z) ? frontG : backG).appendChild(e);

    // The image plane, its grid and its axes x and y, parallel to X and Y.
    const P3 = (x, y) => toS([x, y, pf]);
    S.setPoly(panel, [P3(-W, -H), P3(W, -H), P3(W, H), P3(-W, H)]);
    gridX.forEach(({ x, l }) => S.setLine(l, P3(x, -H), P3(x, H)));
    gridY.forEach(({ y, l }) => S.setLine(l, P3(-W, y), P3(W, y)));
    S.setLine(axX, P3(-W, 0), P3(W, 0));
    S.setLine(axY, P3(0, -H), P3(0, H));
    // The labels x and y go past the ends of their axes, or beside them when a fixed label is in the way.
    const fixedBoxes = fixedLabs.map((l) => l.getBBox());
    pastEnd(labx, P3(W, 0), [1, 0, 0], fixedBoxes);
    pastEnd(laby, P3(0, H), [0, 1, 0], [...fixedBoxes, labx.getBBox()]);
    show([labPlane], sign > 0); show([labPlaneBehind], sign < 0);
    placeClear(S, sign > 0 ? labPlane : labPlaneBehind, P3(-W, -H), 14, S.offset(toS([1, 0, 0])), fixedLabs.map((l) => l.getBBox()), true);

    // The optical axis, split where it passes through the plane, the camera's X and Y axes, and C.
    const zStart = sign > 0 ? -1 : -f - 1;
    S.setLine(optical[0], toS([0, 0, zStart]), toS([0, 0, pf]));
    S.setLine(optical[1], toS([0, 0, pf]), toS([0, 0, Z_END]));
    put(optical[0], (zStart + pf) / 2, backAxes, frontAxes);
    put(optical[1], (pf + Z_END) / 2, backAxes, frontAxes);
    S.setLine(camAxes[0], [0, 0, 0], toS([CAM, 0, 0]));
    S.setLine(camAxes[1], [0, 0, 0], toS([0, CAM, 0]));
    camAxes.forEach((l) => put(l, 0, backAxes, frontAxes));
    const [cx, cy] = S.project([0, 0, 0]);
    dotC.setAttribute("cx", cx); dotC.setAttribute("cy", cy);
    put(dotC, 0);

    // The ray from C through M, drawn to the edge of the figure. Behind C it starts at m, on the far side of C.
    // It is split where it crosses the image plane, at k = pf / Z along M.
    const atC = X === 0 && Y === 0 && Z === 0;
    const kEnd = atC ? 0 : Math.max(1, S.span([0, 0, 0], Ms, 8)?.[1] ?? 1);
    const kStart = sign < 0 && Z > 0 ? pf / Z : 0;
    const cuts = [kStart, kEnd];
    if (Z !== 0 && pf / Z > kStart && pf / Z < kEnd) cuts.splice(1, 0, pf / Z);
    rays.forEach((l, n) => {
      const on = !atC && n < cuts.length - 1;
      show([l], on);
      if (!on) return;
      S.setLine(l, times(Ms, cuts[n]), times(Ms, cuts[n + 1]));
      put(l, ((cuts[n] + cuts[n + 1]) / 2) * Z);
    });

    // M, kM and m.
    const [mx, my] = S.project(Ms);
    dotM.setAttribute("cx", mx); dotM.setAttribute("cy", my);
    put(dotM, Z);
    S.place(hM, Ms);
    hM.setAttribute("aria-label", tr(`Point M at (${list(M)}). Use the arrow keys to move it sideways or in depth.`, `Punto M en (${list(M)}). Usa las flechas del teclado para moverlo hacia los lados o en profundidad.`));
    const seen = Z > 0;
    const range = seen ? kRange(Ms) : [1, 0];
    const hasK = range[0] <= range[1];
    const K = hasK ? clampTo(st.k, range, STEP) : 1;
    const KMs = times(Ms, K);
    show([ring, labK], hasK); hK.style.display = hasK ? "" : "none";
    if (hasK) {
      const [kx, ky] = S.project(KMs);
      ring.setAttribute("cx", kx); ring.setAttribute("cy", ky);
      put(ring, K * Z);
      S.place(hK, KMs);
      hK.setAttribute("aria-label", tr(`Point kM with k = ${fmt(K)}, on the ray through C and M. Use the arrow keys to slide it along the ray.`, `Punto kM con k = ${fmt(K)}, sobre el rayo que pasa por C y M. Usa las flechas del teclado para deslizarlo por el rayo.`));
    }
    const x = (sign * f * X) / Z, y = (sign * f * Y) / Z;
    const onPlane = seen && Math.abs(x) <= W + 1e-9 && Math.abs(y) <= H + 1e-9;
    show([dotm, labm], onPlane);
    const mS = P3(x, y);
    if (onPlane) { const [px, py] = S.project(mS); dotm.setAttribute("cx", px); dotm.setAttribute("cy", py); }

    // Labels keep clear of the fixed labels, the other marks and the ray itself, sampled every 12 units of screen.
    const ray = S.offset(Ms), dk = 12 / (Math.hypot(...ray) || 1);
    const rayBoxes = (k0) => [-3, -2, -1, 1, 2, 3].map((n) => markBox(S.project(times(Ms, k0 + n * dk)), 3));
    const boxes = [...fixedLabs, labx, laby].map((l) => l.getBBox());
    placeClear(S, labM, Ms, 22, ray, [...boxes, ...rayBoxes(1), ...(hasK ? [markBox(S.project(KMs), 13)] : [])]);
    if (hasK) placeClear(S, labK, KMs, 26, ray, [...boxes, ...rayBoxes(K), markBox([mx, my], 10), labM.getBBox()]);
    if (onPlane) placeClear(S, labm, mS, 18, ray, [...boxes, ...rayBoxes(pf / Z), labM.getBBox(), ...(hasK ? [labK.getBBox()] : [])]);

    // The readout.
    const P = [[sign * f, 0, 0, 0], [0, sign * f, 0, 0], [0, 0, 1, 0]];
    const PM = apply(P, [...M, 1]);
    let html = `<span class="lbl">${tr("Projecting <i>M</i>", "Proyección de <i>M</i>")}</span>`;
    html += `<p class="eq"><span class="nowrap">λ${mh} = <i>P</i>${Mh}</span> <span class="nowrap">= ${mat(P)}${col([...M, 1], "pt")}</span> <span class="nowrap">= ${col(PM)}</span></p>`;
    if (atC) {
      html += `<p class="muted">${tr(`${Mh} is the optical center itself. <i>P</i>${Mh} is the zero vector, which stands for no point: every ray starts at <i>C</i>, so <i>C</i> has no image.`, `${Mh} es el propio centro óptico. <i>P</i>${Mh} es el vector cero, que no representa ningún punto: todos los rayos parten de <i>C</i>, así que <i>C</i> no tiene imagen.`)}</p>`;
    } else if (Z === 0) {
      html += `<p class="muted">${tr(`Here λ = <i>Z</i> = 0: ${Mh} is level with <i>C</i>, so its ray runs parallel to the image plane and never meets it. There is nothing to divide by, and ${Mh} has no image.`, `Aquí λ = <i>Z</i> = 0: ${Mh} está a la altura de <i>C</i>, así que su rayo corre paralelo al plano de imagen y nunca lo corta. No hay nada por lo cual dividir, y ${Mh} no tiene imagen.`)}</p>`;
    } else {
      const eq = rounded(x) || rounded(y) ? "≈" : "=";
      html += `<p>${tr("Dividing by", "Al dividir por")} λ = <i>Z</i> = ${fmt(Z)}: <span class="nowrap">(${frac(fmt(PM[0]), fmt(Z))}, ${frac(fmt(PM[1]), fmt(Z))})</span> <span class="nowrap">${eq} <span class="pt">(${fmt(x)}, ${fmt(y)})</span>.</span></p>`;
      if (!seen) html += `<p class="muted">${tr(`But ${Mh} is behind the camera (<i>Z</i> &lt; 0), and no ray from it reaches the image through <i>C</i>. The division still gives numbers, but the camera does not see ${Mh}.`, `Pero ${Mh} está detrás de la cámara (<i>Z</i> &lt; 0), y ningún rayo suyo llega a la imagen a través de <i>C</i>. La división igual da números, pero la cámara no ve ${Mh}.`)}</p>`;
      else {
        if (sign < 0) html += `<p class="muted">${tr("Behind <i>C</i>, <i>P</i> has −<i>f</i>, so both coordinates change sign: the image is upside down.", "Detrás de <i>C</i>, <i>P</i> tiene −<i>f</i>, así que ambas coordenadas cambian de signo: la imagen queda invertida.")}</p>`;
        if (!onPlane) html += `<p class="muted">${tr(`${mh} lies outside the part of the image plane that is drawn.`, `${mh} queda fuera de la parte dibujada del plano de imagen.`)}</p>`;
        if (hasK) {
          const KM = times(M, K), PKM = times(PM, K);
          html += `<span class="lbl">${tr("Every point of the ray", "Todos los puntos del rayo")}</span>`;
          const kM = `<span class="nowrap"><i>k</i>${Mh} = <span class="pt">(${list(KM)})</span></span>`;
          const PkM = `<span class="nowrap"><i>P</i>(<i>k</i>${Mh}) = ${fmt(K)}&thinsp;<i>P</i>${Mh}</span> <span class="nowrap">= ${col(PKM)}.</span>`;
          html += tr(`<p>With <i>k</i> = ${fmt(K)}, ${kM} and ${PkM} Dividing by its third component, ${fmt(K * Z)}, gives the same ${mh}: the image cannot tell ${Mh} from <i>k</i>${Mh}.</p>`, `<p>Con <i>k</i> = ${fmt(K)}, ${kM} y ${PkM} Al dividir por su tercera componente, ${fmt(K * Z)}, se obtiene el mismo ${mh}: la imagen no distingue ${Mh} de <i>k</i>${Mh}.</p>`);
        }
      }
    }
    out.innerHTML = html;
  }

  // M moves across its level plane Y = const: sideways (X) and in depth (Z), one unit per arrow key in the
  // direction that looks closest.
  const LEVEL = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const moveM = ([X, , Z]) => { st.X = clamp(X, XR); st.Z = clamp(Z, ZR); render(); };
  makeDraggable(hM, {
    move: (s) => { const p = S.onPlane(s, -st.Y); moveM([Math.round(-p.y), st.Y, Math.round(p.x)]); },
    step: (d) => { const dir = S.closest(LEVEL.map(toS), d); moveM(add([st.X, st.Y, st.Z], [-dir[1], -dir[2], dir[0]])); },
  });
  // st.k keeps the k the reader chose; when M moves somewhere that k would leave the figure, the drawing clamps it.
  makeDraggable(hK, {
    move: (s) => { const Ms = toS([st.X, st.Y, st.Z]); st.k = clampTo(S.along([0, 0, 0], Ms, s), kRange(Ms), STEP); render(); },
    step: ([dx, dy]) => {
      const range = kRange(toS([st.X, st.Y, st.Z]));
      st.k = clampTo(clampTo(st.k, range, STEP) + STEP * (dx + dy), range, STEP);
      render();
    },
  });
  const press = modeButtons(group, (mode) => { st.mode = mode; render(); });
  S.turnable(render);
  document.getElementById("fig-project-reset")?.addEventListener("click", () => { st = { ...initial }; press(st.mode); S.setView(...VIEW); render(); });
  render();
}

twoFrames();
projection();
