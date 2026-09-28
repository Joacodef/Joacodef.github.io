import { createSpace, el, apply, dot, solve, fmt, col, mat, modeButtons, mathLabel, pixelFrame, opticalCenter, reconstruct, xrayCamera, tr } from "../plane.js";

const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const times = (v, k) => v.map((x) => x * k);
const lerp = (p, q, t) => p.map((x, i) => x + t * (q[i] - x));
const unit = (v) => times(v, 1 / Math.hypot(...v));
const cart = (v) => [v[0] / v[2], v[1] / v[2]];
const show = (els, on) => els.forEach((e) => e.setAttribute("visibility", on ? "visible" : "hidden"));
const list = (v, f = fmt) => v.map((x) => f(x)).join(", ");
// Whether fmt(n, d) has to round n; readouts then write ≈ instead of =.
const rounded = (n, d = 2) => Math.abs(n * 10 ** d - Math.round(n * 10 ** d)) > 1e-6;
const approx = (...vs) => (vs.flat().some((v) => rounded(v)) ? "≈" : "=");

const project = (A, X) => cart(apply(A, [...X, 1]));
const depth = (A, X) => apply([A[2]], [...X, 1])[0];
// The direction of the ray through pixel w of camera A, scaled so that C + s·dir is the point of the ray at depth s.
const rayDir = (A, w) => solve(A.map((r) => r.slice(0, 3)), [w[0], w[1], 1]);
// The point of the ray C + s·d closest to X.
const closestOnRay = (C, d, X) => add(C, times(d, dot(sub(X, C), d) / dot(d, d)));

/* The views: images 1, 40 and 90 of the X-ray series, whose sources sit at 2°, 80° and 180° around the object.
   The two ends of an object were clicked by hand in each, as pixels [u, v]: CLICKS[view][end], upper end first. */
const VIEWS = [1, 40, 90];
const CAMS = VIEWS.map(xrayCamera), CENTERS = CAMS.map(opticalCenter);
const CLICKS = [[[1012, 919], [1081, 1271]], [[833, 910], [839, 1283]], [[1687, 907], [1603, 1298]]];
const SETS = { all: [0, 1, 2], "1-40": [0, 1], "40-90": [1, 2], "1-90": [0, 2] };

const sb = (name, i, cls = "") => `<span class="${cls}"><i>${name}</i><sub>${i}</sub></span>`;
const T_ = '<sup class="t">T</sup>', INV = '<sup class="t">−1</sup>';
// A letter with a hat, for an estimate (see .hat in notes.css).
const hat = (c) => `<span class="hat${c === c.toLowerCase() ? " lo" : ""}"><i>${c}</i></span>`;
const Mh = `<span class="pt">${hat("M")}</span>`;
const XYZ = `[${hat("X")}&ensp;${hat("Y")}&ensp;${hat("Z")}]${T_}`;

function rays() {
  const svgI = document.getElementById("fig-rays-images"), svgS = document.getElementById("fig-rays-space");
  const out = document.getElementById("fig-rays-out");
  const viewsG = document.getElementById("fig-rays-views"), zoomG = document.getElementById("fig-rays-zoom");
  if (!svgI || !svgS || !out || !viewsG || !zoomG) return;
  const initial = { views: "all", zoom: "whole" };
  let st = { ...initial };

  /* Close-ups of the three images around the object: 200 × 460 pixels each, with a grid every 50 pixels */
  const WIN = [200, 460], SC = 0.62, TOP = 50, PX = [48, 190, 332];
  const FROM = [[960, 880], [740, 880], [1560, 880]];
  svgI.setAttribute("viewBox", `0 0 460 ${Math.ceil(TOP + WIN[1] * SC + 12)}`);
  const panels = VIEWS.map((k, i) => {
    const [u0, v0] = FROM[i], u1 = Math.ceil(u0 / 100) * 100;
    const f = pixelFrame(svgI, {
      W: WIN[0], H: WIN[1], scale: SC, ox: PX[i], oy: TOP, id: `fig-rays-clip${i}`, from: FROM[i],
      uTicks: [u1, u1 + 100], vTicks: i === 0 ? [900, 1000, 1100, 1200, 1300] : [], axisNames: i === 0,
    });
    const grid = el("g", { class: "grid" }, f.inside);
    for (let u = Math.ceil(u0 / 50) * 50; u < u0 + WIN[0]; u += 50) el("line", { x1: f.X(u), x2: f.X(u), y1: TOP, y2: f.Y(v0 + WIN[1]) }, grid);
    for (let v = Math.ceil(v0 / 50) * 50; v < v0 + WIN[1]; v += 50) el("line", { y1: f.Y(v), y2: f.Y(v), x1: PX[i], x2: f.X(u0 + WIN[0]) }, grid);
    const title = el("text", { x: PX[i], y: 20, class: "panel-lab" }, svgI);
    title.textContent = `${tr("Image", "Imagen")} ${k}`;
    // For each end: the line from the click to where M̂ projects, that point, and the click.
    const marks = [0, 1].map(() => ({
      gap: el("line", { class: "gap" }, f.inside),
      ring: el("circle", { r: 6, class: "reproj" }, f.inside),
      dot: el("circle", { r: 4.2 }, f.inside),
      far: el("text", { class: "pt-lab lab-sm" }, svgI),
    }));
    return { ...f, u0, v0, marks };
  });
  const inWindow = (p, [u, v]) => u >= p.u0 && u <= p.u0 + WIN[0] && v >= p.v0 && v <= p.v0 + WIN[1];
  // Where the segment from a (inside the window) toward b leaves the window, in pixels.
  function exitPoint(p, a, b) {
    let t = 1;
    const d = sub(b, a);
    [[0, p.u0], [0, p.u0 + WIN[0]], [1, p.v0], [1, p.v0 + WIN[1]]].forEach(([i, edge]) => {
      if (Math.abs(d[i]) > 1e-9) { const s = (edge - a[i]) / d[i]; if (s > 0 && s < t) t = s; }
    });
    return add(a, times(d, t));
  }

  function drawImages(used, Ms) {
    panels.forEach((p, i) => {
      const on = used.includes(i);
      p.marks.forEach((mk, e) => {
        const c = CLICKS[i][e], m = project(CAMS[i], Ms[e]);
        mk.dot.setAttribute("class", on ? "pt-dot" : "pt-ring thin");
        mk.dot.setAttribute("cx", p.X(c[0])); mk.dot.setAttribute("cy", p.Y(c[1]));
        const inside = inWindow(p, m);
        show([mk.ring], inside);
        if (inside) { mk.ring.setAttribute("cx", p.X(m[0])); mk.ring.setAttribute("cy", p.Y(m[1])); }
        const q = inside ? m : exitPoint(p, c, m);
        mk.gap.setAttribute("x1", p.X(c[0])); mk.gap.setAttribute("y1", p.Y(c[1]));
        mk.gap.setAttribute("x2", p.X(q[0])); mk.gap.setAttribute("y2", p.Y(q[1]));
        // A projection outside the close-up: its distance from the click, written where the line leaves the window.
        show([mk.far], !inside);
        if (!inside) {
          const d = Math.hypot(...sub(m, c)), right = q[0] > p.u0 + WIN[0] / 2;
          mk.far.textContent = `${fmt(d, 0)} px`;
          mk.far.setAttribute("text-anchor", right ? "end" : "start");
          mk.far.setAttribute("x", p.X(q[0]) + (right ? -4 : 4));
          mk.far.setAttribute("y", Math.min(Math.max(p.Y(q[1]) - 12, TOP + 18), p.Y(p.v0 + WIN[1]) - 6));
        }
      });
    });
  }

  /* Space, in the object's coordinates, with Z up */
  // Close to the object, the scale fits its two ends in about 200 units, and at most 4.5 units per millimeter.
  const VIEW = [32, 26], WHOLE = { scale: 0.2, pivot: [0, 0, -40] }, CLOSE = 4.5, KEEP = 1300;
  const S = createSpace(svgS, { height: 320, scale: WHOLE.scale, pivot: WHOLE.pivot, at: [230, 160], yaw: VIEW[0], pitch: VIEW[1], yawRange: [-180, 180], pitchRange: [4, 80] });
  const gBack = S.el("g"), gRays = S.el("g"), gGaps = S.el("g"), gObj = S.el("g"), labels = S.el("g");
  const ORBIT_N = 120;
  const orbitEls = Array.from({ length: ORBIT_N }, () => S.el("line", { class: "guide" }, gBack));
  const AXIS = [[0, 0, -160], [0, 0, 260]];
  const axisEl = S.el("line", { class: "axis3" }, gBack), labZ = mathLabel(labels, "axl", [["Z", true]]);
  const srcEls = CENTERS.map(() => S.el("circle", { r: 4 }, gBack));
  const srcLabs = VIEWS.map((_, i) => mathLabel(labels, "axl", [["C", true], [String(i + 1), false, "sub"]]));
  const rayEls = VIEWS.map(() => [0, 1].map(() => S.el("line", { class: "ray thin" }, gRays)));
  const gapEls = VIEWS.map(() => [0, 1].map(() => S.el("line", { class: "gap" }, gGaps)));
  const objEl = S.el("line", { class: "ray" }, gObj);
  const mEls = [0, 1].map(() => S.el("circle", { class: "pt-dot" }, gObj));
  const setLab = (t, [x, y]) => { t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", "middle"); };
  // M̂ with a subscript. The hat is a text of its own, set over the M wherever the label goes (see .hat in notes.css).
  const mLabs = [1, 2].map((e) => {
    const t = mathLabel(labels, "pt-lab lab-sm", [["M", true], [String(e), false, "sub"]]);
    const h = el("text", { class: "pt-lab lab-sm", "text-anchor": "middle" }, labels);
    h.textContent = String.fromCharCode(0x2c6);
    return { t, h };
  });
  // [x, y] is where the label starts, on its baseline.
  function placeM({ t, h }, [x, y]) {
    t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", "start");
    const size = parseFloat(getComputedStyle(t).fontSize);
    h.setAttribute("x", x + t.getSubStringLength(0, 1) * 0.62);
    h.setAttribute("y", y - size * 0.2);
  }

  function drawSpace(used, Ms) {
    const close = st.zoom === "close";
    const len = Math.hypot(...sub(Ms[0], Ms[1]));
    S.setScale(close ? Math.min(CLOSE, 200 / len) : WHOLE.scale, close ? lerp(Ms[0], Ms[1], 0.5) : WHOLE.pivot);
    // The circle of source positions and the axis the object turns about: in the whole setup only.
    const R0 = Math.hypot(CENTERS[0][0], CENTERS[0][1]), Z0 = CENTERS[0][2];
    orbitEls.forEach((e, n) => {
      const t0 = (2 * Math.PI * n) / ORBIT_N, t1 = (2 * Math.PI * (n + 1)) / ORBIT_N;
      S.setLine(e, [R0 * Math.cos(t0), R0 * Math.sin(t0), Z0], [R0 * Math.cos(t1), R0 * Math.sin(t1), Z0]);
    });
    S.setLine(axisEl, ...AXIS);
    S.placeLabel(labZ, AXIS[1], [0, -1], 12);
    show([...orbitEls, axisEl, labZ], !close);

    VIEWS.forEach((_, i) => {
      const on = used.includes(i), C = CENTERS[i];
      srcEls[i].setAttribute("class", on ? "origin" : "guide");
      const [x, y] = S.project(C);
      srcEls[i].setAttribute("cx", x); srcEls[i].setAttribute("cy", y);
      show([srcEls[i]], !close);
      const ends = [];
      [0, 1].forEach((e) => {
        const d = rayDir(CAMS[i], CLICKS[i][e]);
        // Whole setup: from the source to KEEP mm deep, past the object. Close to the object: the part in the figure.
        let span = close ? S.span(C, d, 4) : [0, KEEP];
        if (span) span = [Math.max(span[0], 0), Math.min(span[1], KEEP)];
        const vis = on && span && span[0] < span[1];
        show([rayEls[i][e]], vis);
        if (vis) { S.setLine(rayEls[i][e], add(C, times(d, span[0])), add(C, times(d, span[1]))); ends.push(S.project(add(C, times(d, span[0])))); }
        // Close to the object: the gap from each M̂ to each ray, which the fit could not close.
        const g = gapEls[i][e];
        show([g], close && on);
        if (close && on) S.setLine(g, Ms[e], closestOnRay(C, d, Ms[e]));
      });
      // A source's name: next to it in the whole setup; close to the object, between its two rays where they come in.
      const lab = srcLabs[i];
      if (!close) { show([lab], true); S.placeLabel(lab, C, S.offset([C[0], C[1], 0]), 20); }
      else if (ends.length === 2) {
        const mid = lerp(ends[0], ends[1], 0.5), dir = unit(S.offset(rayDir(CAMS[i], CLICKS[i][0])));
        show([lab], true); setLab(lab, [mid[0] + dir[0] * 18, mid[1] + dir[1] * 18 + 7]);
      } else show([lab], false);
    });

    // The two ends found, and the object between them.
    S.setLine(objEl, Ms[0], Ms[1]);
    mEls.forEach((c, e) => { const [x, y] = S.project(Ms[e]); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", close ? 3.6 : 3.2); });
    // Their names, close to the object: right of each end, the upper end's above it and the lower end's below it.
    // The offsets are fixed on screen, so the names never jump from one side to the other as the view turns.
    show(mLabs.flatMap(({ t, h }) => [t, h]), close);
    if (close) mLabs.forEach((lab, e) => { const [x, y] = S.project(Ms[e]); placeM(lab, [x + 11, e === 0 ? y - 8 : y + 24]); });
  }

  function render() {
    const used = SETS[st.views];
    const fits = [0, 1].map((e) => reconstruct(used.map((i) => CLICKS[i][e]), used.map((i) => CAMS[i])));
    const Ms = fits.map((f) => f.M);
    drawImages(used, Ms);
    drawSpace(used, Ms);

    const n = used.length;
    const where = (m) => `(${list(m)})`;
    let html = `<span class="lbl">${tr("Two equations per view", "Dos ecuaciones por vista")}</span>`;
    html += `<p>${tr(`With ${n} images, <i>Q</i> is ${2 * n} × 3 and <i>r</i> has ${2 * n} entries. For the upper end:`, `Con ${n} imágenes, <i>Q</i> es de ${2 * n} × 3 y <i>r</i> tiene ${2 * n} componentes. Para el extremo superior:`)}</p>`;
    const { Q, r } = fits[0];
    html += `<p class="eq fit"><span class="nowrap"><i>Q</i> ≈ ${mat(Q, "", (x) => fmt(x, 1))}</span>&ensp; <span class="nowrap"><i>r</i> ≈ ${col(r, "", (x) => fmt(x, 0))}</span></p>`;
    html += `<p class="eq"><span class="nowrap">${XYZ} = (<i>Q</i>${T_}<i>Q</i>)${INV}<i>Q</i>${T_}<i>r</i></span> <span class="nowrap">${approx(Ms[0])} ${where(Ms[0])}</span></p>`;
    html += `<p>${tr(`The lower end: <span class="nowrap">${Mh} ${approx(Ms[1])} ${where(Ms[1])}.</span>`, `El extremo inferior: <span class="nowrap">${Mh} ${approx(Ms[1])} ${where(Ms[1])}.</span>`)}</p>`;
    const len = Math.hypot(...sub(Ms[0], Ms[1]));
    html += `<p class="eq"><span class="nowrap">${tr("Length", "Largo")} ${approx(len)} ${fmt(len)} mm</span></p>`;

    html += `<span class="lbl">${tr("Reprojection errors, in pixels", "Errores de reproyección, en píxeles")}</span>`;
    const errs = VIEWS.map((_, i) => [0, 1].map((e) => Math.hypot(...sub(project(CAMS[i], Ms[e]), CLICKS[i][e]))));
    const items = VIEWS.map((k, i) => used.includes(i)
      ? tr(`image ${k}: ${fmt(errs[i][0])} and ${fmt(errs[i][1])}`, `imagen ${k}: ${fmt(errs[i][0])} y ${fmt(errs[i][1])}`)
      : tr(`image ${k}, left out: ${Mh} lands ${fmt(errs[i][0])} and ${fmt(errs[i][1])} pixels from its clicks`, `imagen ${k}, sin usar: ${Mh} cae a ${fmt(errs[i][0])} y ${fmt(errs[i][1])} píxeles de sus clics`));
    html += `<p>${tr("For the upper and the lower end", "Para el extremo superior y el inferior")}, ${items.join("; ")}.</p>`;
    // The first row of QM̂ − r, as a depth times a pixel error.
    const i0 = used[0], lam = depth(CAMS[i0], Ms[0]), dx = CLICKS[i0][0][0] - project(CAMS[i0], Ms[0])[0];
    const dxs = fmt(dx, Math.abs(dx) < 1 ? 3 : 2);
    html += `<p>${tr(`Each row of <i>Q</i>${Mh} − <i>r</i> is a depth times a pixel error. The first one, for image ${VIEWS[i0]}:`, `Cada fila de <i>Q</i>${Mh} − <i>r</i> es una profundidad por un error en píxeles. La primera, para la imagen ${VIEWS[i0]}:`)}</p>`;
    html += `<p class="eq"><span class="nowrap">λ(<i>x</i> − ${hat("x")}) ≈ ${fmt(lam)} · ${dx < 0 ? `(${dxs})` : dxs}</span> <span class="nowrap">≈ ${fmt(lam * dx, 1)}</span></p>`;

    // Two images whose rays are nearly one line: the fit cannot tell how far along them the point is.
    if (n === 2) {
      const [a, b] = used;
      const ang = (Math.acos(Math.min(1, dot(unit(sub(Ms[0], CENTERS[a])), unit(sub(Ms[0], CENTERS[b]))))) * 180) / Math.PI;
      if (180 - ang < 15) html += `<p class="muted">${tr(`The rays of images ${VIEWS[a]} and ${VIEWS[b]} meet at ${fmt(ang)}°, only ${fmt(180 - ang)}° from being one line: their sources face each other across the object. A few pixels of error then move ${Mh} far along the rays, and the object comes out ${fmt(len)} mm long.`, `Los rayos de las imágenes ${VIEWS[a]} y ${VIEWS[b]} se cortan en ${fmt(ang)}°, a solo ${fmt(180 - ang)}° de ser una misma recta: sus fuentes están enfrentadas, a ambos lados del objeto. Unos pocos píxeles de error mueven entonces ${Mh} lejos a lo largo de los rayos, y el objeto resulta de ${fmt(len)} mm de largo.`)}</p>`;
    }
    out.innerHTML = html;
  }

  const pressViews = modeButtons(viewsG, (mode) => { st.views = mode; render(); });
  const pressZoom = modeButtons(zoomG, (mode) => { st.zoom = mode; render(); });
  S.turnable(render);
  document.getElementById("fig-rays-reset")?.addEventListener("click", () => {
    st = { ...initial }; pressViews(st.views); pressZoom(st.zoom); S.setView(...VIEW); render();
  });
  render();
}

rays();
