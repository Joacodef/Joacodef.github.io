// Figures of the vector-space-model note, on the 126 chapters of Don Quijote (the original on the Spanish page,
// Ormsby's translation on the English one): the pipeline on chapter I's first line, the chapters as points in the
// plane of two words, a chapter's heaviest words under four weightings, a query ranked against the chapters by angle
// or by distance, and a search over all the chapters by cosine or by BM25.
import { el, tr, lang, createPlane, svgPoint, modeButtons, roving, localNum as fmt } from "../../plane.js";
import { DATA } from "./vector-space-model-data.js";

const D = DATA[lang];
const N = D.N;
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const label = (j) => D.chapters[j][0];
const title = (j) => D.chapters[j][1];
const chapterName = (j) => tr(`Chapter ${label(j)}`, `Capítulo ${label(j)}`);
const chapterMid = (j) => tr(`chapter ${label(j)}`, `capítulo ${label(j)}`);
const idf = (n) => Math.log10(N / n);
const ltf = (f) => (f > 0 ? 1 + Math.log10(f) : 0);

/* ---------- Figure 1: the pipeline ---------- */

function pipelineFigure() {
  const panel = document.getElementById("fig-pipe");
  if (!panel) return;
  const out = document.getElementById("fig-pipe-out");
  const P = D.pipeline, on = { lc: false, st: false, lm: false };
  const buttons = [...document.querySelectorAll("#fig-pipe-steps button")];
  let last = null;
  const state = (o) => P.states[`${+o.lc}${+o.st}${+o.lm}`];
  // The sentence says what the last step switched did, measured on the whole book.
  function says() {
    if (!last) return tr("Every step is off: the line as the tokenizer leaves it, capitals and all.", "Todos los pasos están desactivados: la línea como la deja el tokenizador, con mayúsculas y todo.");
    const now = state(on), before = state({ ...on, [last]: !on[last] });
    const fewer = Math.abs(before[1] - now[1]);
    if (last === "lc") return on.lc
      ? tr(`Lowercasing joins “In” and “in”: ${fmt(fewer)} fewer different words.`, `Las minúsculas juntan «En» y «en»: ${fmt(fewer)} palabras distintas menos.`)
      : tr("With capitals, “In” and “in” are two different words.", "Con mayúsculas, «En» y «en» son dos palabras distintas.");
    if (last === "st") return on.st
      ? tr(`Dropping the ${P.stopIn} stopwords found in the book removes ${fmt(100 - (100 * now[0]) / before[0])}% of its tokens.`, `Quitar las ${P.stopIn} stopwords que hay en el libro elimina el ${fmt(100 - (100 * now[0]) / before[0])}% de sus tokens.`)
      : tr("With the stopwords back, every token counts.", "Con las stopwords de vuelta, todo token cuenta.");
    if (!on.lm) return tr("Without lemmas, every form is a word of its own.", "Sin lemas, cada forma es una palabra propia.");
    return tr(`Lemmas join a word's forms, so “lived” counts as “live”: ${fmt(fewer)} fewer different words.`, `Los lemas juntan las formas de cada palabra: ${fmt(fewer)} palabras distintas menos, aunque sin la categoría gramatical la lista vuelve verbos «Mancha» y «nombre».`);
  }
  function show() {
    panel.replaceChildren(h("p", "vs-head", tr("The first line of chapter I", "La primera línea del capítulo primero")));
    const row = h("div", "vs-tokens");
    for (const [w, stop, lemma] of P.line) {
      let t = on.lm ? lemma : w;
      if (on.lc) t = t.toLowerCase();
      const gone = on.st && stop;
      row.append(h("span", `vs-tok${gone ? " gone" : ""}${on.lm && lemma !== w && !gone ? " changed" : ""}`, t));
    }
    panel.append(row);
    const [tok, voc] = state(on);
    out.innerHTML = `<p class="lbl">${tr("The book after these steps", "El libro tras estos pasos")}</p>` +
      `<p class="eq"><span class="nowrap">${fmt(tok)} tokens</span> · <span class="nowrap">${fmt(voc)} ${tr("different words", "palabras distintas")}</span></p><p>${says()}</p>`;
  }
  for (const b of buttons) b.addEventListener("click", () => {
    const k = b.dataset.step;
    on[k] = !on[k];
    last = k;
    b.setAttribute("aria-pressed", String(on[k]));
    show();
  });
  show();
}

/* ---------- The plane of two words, for figures 2 and 4 ---------- */

// Draws the chapters as points with coordinates their counts of two words, on a square plane just large enough, or,
// with zoom 3, a close-up of its corner at the origin, a third of each axis, where most chapters lie; the axis letters
// are replaced by the two words. The points, and whatever a figure adds to `inside`, are clipped to the plane, so a
// chapter beyond a close-up is cut off at its edge. Returns the plane, the points' coordinates, their circles and that
// group, the axis names, and the chapters grouped by point (several share one where their counts are equal), each
// group in the book's order.
function wordPlane(svg, [a, b], zoom = 1) {
  svg.replaceChildren();
  const xs = D.plane.counts[a], ys = D.plane.counts[b];
  const max = Math.ceil(Math.max(...xs, ...ys) / 10) * 10 / zoom;
  const P = createPlane(svg, max > 20 ? { max, tick: 5, labelStep: 10 } : { max, tick: 1, labelStep: max > 10 ? 5 : 2 });
  svg.querySelectorAll(".axl").forEach((t) => t.remove());
  const names = [P.el("text", { x: P.X(max), y: P.Y(0) - 10, "text-anchor": "end", class: "vs-axname" }), P.el("text", { x: P.X(0) + 10, y: P.Y(max) + 5, class: "vs-axname" })];
  names[0].textContent = q(a);
  names[1].textContent = q(b);
  const clip = el("clipPath", { id: `${svg.id}-clip` }, el("defs", null, svg));
  el("rect", { x: P.X(0) - 5, y: P.Y(max) - 5, width: P.X(max) - P.X(0) + 10, height: P.Y(0) - P.Y(max) + 10 }, clip);
  const inside = el("g", { "clip-path": `url(#${svg.id}-clip)` }, svg);
  const pts = xs.map((x, j) => ({ x, y: ys[j] }));
  const dots = pts.map((p) => el("circle", { cx: P.X(p.x), cy: P.Y(p.y), r: 4, class: "vs-doc" }, inside));
  const byPoint = new Map();
  pts.forEach((p, j) => { const key = `${p.x},${p.y}`; if (!byPoint.has(key)) byPoint.set(key, { p, js: [] }); byPoint.get(key).js.push(j); });
  return { P, pts, dots, max, inside, names, groups: [...byPoint.values()] };
}
const arrowTo = (P, line, p) => { line.setAttribute("x1", P.X(0)); line.setAttribute("y1", P.Y(0)); line.setAttribute("x2", P.X(p.x)); line.setAttribute("y2", P.Y(p.y)); };

// Puts label t next to point p, in the first of dirs (directions in the plane's units, tried in order, then the eight
// of the compass) where the whole label lies inside the plane, off the axis lines and clear of the axis names and of
// the boxes in `avoid`. A direction picks one of eight places around the point: centered above, below or beside it, or
// in a corner; each is tried just clear of the dot, then twice farther out. Where none is clear, as in a crowded
// corner, the label takes the place inside the plane that overlaps the others least. Returns the label's box, in SVG
// units, for the next label to avoid.
function placeLabel(W, t, p, dirs, avoid = []) {
  const { P } = W, fs = parseFloat(getComputedStyle(t).fontSize), w = t.getComputedTextLength(), h = 0.8 * fs;
  // The axis names keep a wider berth, so a label beside one does not read as part of it.
  const named = W.names.map((e) => { const b = e.getBBox(); return { x: b.x - 12, y: b.y, width: b.width + 24, height: b.height }; });
  const x0 = P.X(p.x), y0 = P.Y(p.y), shun = [...named, ...avoid];
  const boxAt = ([dx, dy], gap) => {
    const n = Math.hypot(dx, dy), sx = Math.abs(dx / n) < 0.38 ? 0 : Math.sign(dx), sy = Math.abs(dy / n) < 0.38 ? 0 : -Math.sign(dy);
    const g = sx && sy ? 0.7 * gap : gap;
    return { x: x0 + sx * (g + w / 2) - w / 2, y: y0 + sy * (g + h / 2) - h / 2, width: w, height: h };
  };
  const apart = (s, o) => s.x + s.width + 2 < o.x || o.x + o.width + 2 < s.x || s.y + s.height + 2 < o.y || o.y + o.height + 2 < s.y;
  const covers = (s, o) => Math.max(0, Math.min(s.x + s.width, o.x + o.width) - Math.max(s.x, o.x)) * Math.max(0, Math.min(s.y + s.height, o.y + o.height) - Math.max(s.y, o.y));
  const inFrame = (s) => s.x >= P.X(0) + 4 && s.x + s.width <= P.X(P.max) + 20 && s.y >= P.Y(P.max) - 14 && s.y + s.height <= P.Y(0) - 4;
  const ways = [...dirs, [0, 1], [1, 1], [1, 0], [-1, 1], [-1, 0], [1, -1], [0, -1], [-1, -1]].filter(([dx, dy]) => dx || dy);
  const tries = [9, 22, 40].flatMap((gap) => ways.map((d) => boxAt(d, gap)));
  const cost = (s) => shun.reduce((sum, o) => sum + covers(s, o), 0);
  const s = tries.find((c) => inFrame(c) && shun.every((o) => apart(c, o))) ?? tries.filter(inFrame).sort((a, b) => cost(a) - cost(b))[0] ?? tries[0];
  t.setAttribute("x", s.x + w / 2); t.setAttribute("y", s.y + 0.76 * fs); t.setAttribute("text-anchor", "middle");
  return s;
}

/* ---------- Figure 2: the chapters in the plane of two words ---------- */

function planeFigure() {
  const svg = document.getElementById("fig-plane");
  if (!svg) return;
  const out = document.getElementById("fig-plane-out");
  let pair = 0, sel = D.chapters.findIndex(([l]) => l === "I.VIII"), W;
  let vec, lab;
  function draw() {
    W = wordPlane(svg, D.plane.pairs[pair]);
    vec = W.P.el("line", { class: "vs-vec" });
    lab = W.P.el("text", { class: "vs-lab" });
    select(sel);
  }
  function select(j) {
    sel = j;
    const p = W.pts[j], [a, b] = D.plane.pairs[pair];
    W.dots.forEach((d, k) => d.classList.toggle("on", k === j));
    arrowTo(W.P, vec, p);
    lab.textContent = label(j);
    placeLabel(W, lab, p, [p.x || p.y ? [p.x, p.y] : [1, 1]]);
    svg.setAttribute("aria-label", tr(`Every chapter as a point by its counts of ${q(a)} and ${q(b)}; chapter ${label(j)}, at (${p.x}, ${p.y}), is chosen. Use the arrow keys to move to another chapter.`, `Cada capítulo como un punto según sus conteos de ${q(a)} y ${q(b)}; está elegido el capítulo ${label(j)}, en (${p.x}, ${p.y}). Usa las flechas para pasar a otro capítulo.`));
    out.innerHTML = `<p class="lbl">${chapterName(j)}</p>` +
      `<p class="eq"><span class="nowrap">(<i>f</i><sub>${a}</sub>, <i>f</i><sub>${b}</sub>) = (${p.x}, ${p.y})</span></p><p class="vs-title">${title(j)}</p>`;
  }
  svg.setAttribute("tabindex", "0");
  svg.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    select((sel + step + N) % N);
  });
  svg.addEventListener("pointerdown", (e) => {
    const s = svgPoint(svg, e);
    let best = 0, bd = Infinity;
    W.pts.forEach((p, j) => { const d = Math.hypot(W.P.X(p.x) - s.x, W.P.Y(p.y) - s.y); if (d < bd) { bd = d; best = j; } });
    if (bd < 30) select(best);
  });
  modeButtons(document.getElementById("fig-plane-modes"), (m) => { pair = Number(m); draw(); });
  draw();
}

/* ---------- Figure 3: weights ---------- */

const WEIGHT = {
  f: { value: (w) => w.f, digits: 0 },
  tf: { value: (w, max) => w.f / max, digits: 2 },
  log: { value: (w) => ltf(w.f), digits: 2 },
  tfidf: { value: (w) => ltf(w.f) * idf(w.n), digits: 2 },
};
function weightsFigure() {
  const panel = document.getElementById("fig-weights");
  if (!panel) return;
  const out = document.getElementById("fig-weights-out");
  let ci = 0, mode = "f", rows = [];
  function show() {
    const C = D.weights[ci], max = C.max, W = WEIGHT[mode];
    rows = C.words.map(([w, f, n]) => ({ w, f, n, v: W.value({ f, n }, max) }))
      .sort((x, y) => y.v - x.v || x.w.localeCompare(y.w)).slice(0, 10);
    const top = rows[0].v || 1;
    panel.replaceChildren(h("p", "vs-head", `${chapterName(C.j)}: ${title(C.j)}`));
    // What the bars measure: the words' weight under the weighting picked, named as its button is.
    const weighting = { f: tr("count", "conteo"), tf: "tf", log: tr("log tf", "tf logarítmico"), tfidf: "tf-idf" }[mode];
    panel.append(h("p", "vs-measure", tr(`weight: ${weighting}`, `peso: ${weighting}`)));
    const list = h("div", "vs-rows");
    const buttons = rows.map((r) => {
      const b = h("button", "vs-row");
      b.type = "button";
      const track = h("span", "vs-track"), bar = h("span", "vs-bar");
      bar.style.width = `${(100 * r.v) / top}%`;
      track.append(bar);
      b.append(h("span", "vs-word", r.w), track, h("span", "vs-val", fmt(r.v, W.digits)));
      b.setAttribute("aria-label", `${r.w}, ${fmt(r.v, W.digits)}`);
      list.append(b);
      return b;
    });
    panel.append(list);
    roving(buttons, (i) => select(buttons, i));
    select(buttons, 0);
  }
  function select(buttons, i) {
    buttons.forEach((b, k) => { b.classList.toggle("on", k === i); b.tabIndex = k === i ? 0 : -1; b.setAttribute("aria-pressed", String(k === i)); });
    const r = rows[i], C = D.weights[ci], max = C.max;
    const eq = {
      f: `<i>f</i> = ${r.f}`,
      tf: `<span class="nowrap"><i>f</i> / max <i>f</i> = ${r.f} / ${max}</span> <span class="nowrap">≈ ${fmt(r.f / max, 2)}</span>`,
      log: `<span class="nowrap">1 + log<sub>10</sub> ${r.f}</span> <span class="nowrap">≈ ${fmt(ltf(r.f), 2)}</span>`,
      tfidf: `<span class="nowrap">(1 + log<sub>10</sub> ${r.f}) · log<sub>10</sub>(${N}/${r.n})</span> <span class="nowrap">≈ ${fmt(ltf(r.f), 2)} · ${fmt(idf(r.n), 2)}</span> <span class="nowrap">≈ ${fmt(ltf(r.f) * idf(r.n), 2)}</span>`,
    }[mode];
    const says = {
      f: tr(`${q(r.w)} is used ${r.f} ${r.f === 1 ? "time" : "times"} in this chapter.`, `${q(r.w)} se usa ${r.f} ${r.f === 1 ? "vez" : "veces"} en este capítulo.`),
      tf: tr("Dividing by the chapter's top count keeps the order.", "Dividir por el mayor conteo del capítulo mantiene el orden."),
      log: tr("The logarithm narrows the gaps but keeps the order.", "El logaritmo acorta las distancias pero mantiene el orden."),
      tfidf: tr(`${q(r.w)} is in ${r.n} of the ${N} chapters.`, `${q(r.w)} está en ${r.n} de los ${N} capítulos.`),
    }[mode];
    out.innerHTML = `<p class="lbl">${q(r.w)}, ${chapterMid(C.j)}</p><p class="eq">${eq}</p><p>${says}</p>`;
  }
  modeButtons(document.getElementById("fig-weights-chapters"), (m) => { ci = Number(m); show(); });
  modeButtons(document.getElementById("fig-weights-modes"), (m) => { mode = m; show(); });
  show();
}

/* ---------- Figure 4: ranking by angle or by distance ---------- */

function angleFigure() {
  const svg = document.getElementById("fig-angle");
  if (!svg) return;
  const out = document.getElementById("fig-angle-out");
  let pair = 0, mode = "angle", zoom = 3, W, qv, handle, best = [], labs = [], arc;
  const query = { x: 6, y: 2 };
  function draw() {
    W = wordPlane(svg, D.plane.pairs[pair], zoom);
    best = [0, 1, 2].map(() => el("line", { class: "vs-vec" }, W.inside));
    arc = W.P.el("path", { class: "vs-arc" });
    labs = [0, 1, 2].map(() => W.P.el("text", { class: "vs-lab" }));
    qv = W.P.el("line", { class: "vs-q" });
    handle = W.P.handle("point");
    W.P.draggable(handle, () => ({ ...query }), (p) => { query.x = p.x; query.y = p.y; update(); });
    query.x = Math.min(query.x, W.max); query.y = Math.min(query.y, W.max);
    update();
  }
  const cosOf = (p) => (p.x || p.y ? (query.x * p.x + query.y * p.y) / (Math.hypot(query.x, query.y) * Math.hypot(p.x, p.y)) : 0);
  const distOf = (p) => Math.hypot(query.x - p.x, query.y - p.y);
  const inView = (p) => p.x <= W.max && p.y <= W.max;
  function update() {
    const [a, b] = D.plane.pairs[pair];
    W.P.place(handle, query);
    arrowTo(W.P, qv, query);
    handle.setAttribute("aria-label", tr(`Query at (${query.x}, ${query.y}): ${q(a)} ${query.x}, ${q(b)} ${query.y}. Use the arrow keys to move it.`, `Consulta en (${query.x}, ${query.y}): ${q(a)} ${query.x}, ${q(b)} ${query.y}. Usa las flechas para moverla.`));
    const zero = !query.x && !query.y;
    // The points ranked by angle (a point with neither word has no direction) or by distance, the chapters that share
    // a point sharing its rank, ties going to the point whose first chapter comes first in the book. The three closest
    // points get lines, and those of them tied with the closest a label each: their first chapter, and how many more
    // share the point.
    const score = (p) => (mode === "angle" ? -cosOf(p) : distOf(p));
    const all = W.groups.filter((g) => mode === "dist" || g.p.x || g.p.y).map((g) => ({ ...g, s: score(g.p) }))
      .sort((x, y) => x.s - y.s || x.js[0] - y.js[0]);
    const ranked = all.slice(0, 3), tied = all.filter((g) => g.s - all[0].s < 1e-9);
    const lit = new Set(zero ? [] : ranked.flatMap((g) => g.js));
    W.dots.forEach((d, k) => d.classList.toggle("on", lit.has(k)));
    const placed = [{ x: W.P.X(query.x) - 11, y: W.P.Y(query.y) - 11, width: 22, height: 22 }];
    best.forEach((line, i) => {
      const { p, js } = ranked[i];
      line.setAttribute("visibility", zero ? "hidden" : "visible");
      if (mode === "angle") { arrowTo(W.P, line, p); line.classList.remove("dash"); }
      else { line.setAttribute("x1", W.P.X(query.x)); line.setAttribute("y1", W.P.Y(query.y)); line.setAttribute("x2", W.P.X(p.x)); line.setAttribute("y2", W.P.Y(p.y)); line.classList.add("dash"); }
      // A label sits beside its point, clear of the arrows that run on in nearly the same direction, or past it, away
      // from the query; a point beyond the close-up has none.
      const shown = !zero && i < tied.length && inView(p);
      labs[i].textContent = shown ? `${label(js[0])}${js.length > 1 ? ` +${js.length - 1}` : ""}` : "";
      if (shown) placed.push(placeLabel(W, labs[i], p, mode === "angle" ? [[-p.y, p.x], [p.y, -p.x]] : [[p.x - query.x, p.y - query.y]], placed));
    });
    // The angle between the query and the closest chapter, as an arc near the origin.
    const { p } = ranked[0];
    if (mode === "angle" && !zero) {
      const r = 40, a1 = Math.atan2(query.y, query.x), a2 = Math.atan2(p.y, p.x);
      const pt = (t) => `${W.P.X(0) + r * Math.cos(t)},${W.P.Y(0) - r * Math.sin(t)}`;
      arc.setAttribute("d", `M${pt(a1)} A${r},${r} 0 0 ${a2 > a1 ? 0 : 1} ${pt(a2)}`);
      arc.setAttribute("visibility", "visible");
    } else arc.setAttribute("visibility", "hidden");
    if (zero) { out.innerHTML = `<p class="lbl">${tr("The query", "La consulta")}</p><p>${tr("At the origin the query has no words: move it.", "En el origen la consulta no tiene palabras: muévela.")}</p>`; return; }
    // The readout's chapter is the first of the closest point; the others tied with it are named, or counted.
    const j = ranked[0].js[0], others = tied.flatMap((g) => g.js).filter((k) => k !== j);
    const tie = !others.length ? "" : others.length > 2
      ? tr(`, tied with ${others.length} more`, `, empatado con ${others.length} más`)
      : tr(`, tied with ${others.map(label).join(" and ")}`, `, empatado con ${others.map(label).join(" y ")}`);
    const eq = mode === "angle"
      ? `<span class="nowrap">cos = <span class="frac"><span>${query.x}·${p.x} + ${query.y}·${p.y}</span><span>${fmt(Math.hypot(query.x, query.y), 2)} · ${fmt(Math.hypot(p.x, p.y), 2)}</span></span></span> <span class="nowrap">≈ ${fmt(cosOf(p), 3)}</span>`
      : `<span class="nowrap">‖<i>q</i> − <i>d</i>‖ = √((${query.x} − ${p.x})<sup>2</sup> + (${query.y} − ${p.y})<sup>2</sup>)</span> <span class="nowrap">≈ ${fmt(distOf(p), 2)}</span>`;
    // The sentence reads the two points as counts of the two words: by angle the chapter's are in the query's
    // proportion, by distance they are about as many.
    const off = !inView(p), c = `(${p.x}, ${p.y})`, cq = `(${query.x}, ${query.y})`;
    const says = mode === "angle"
      ? (p.x * query.y === p.y * query.x
        ? tr(`Its counts, ${c}, are in the same proportion as the query's, ${cq}, whatever their size${off ? "; its arrow runs off the close-up" : ""}.`, `Sus conteos, ${c}, están en la misma proporción que los de la consulta, ${cq}, sea cual sea su tamaño${off ? "; su flecha se sale de la vista" : ""}.`)
        : tr(`Its counts, ${c}, are in nearly the same proportion as the query's, ${cq}, whatever their size${off ? "; its arrow runs off the close-up" : ""}.`, `Sus conteos, ${c}, están casi en la misma proporción que los de la consulta, ${cq}, sea cual sea su tamaño${off ? "; su flecha se sale de la vista" : ""}.`))
      : tr(`Its counts, ${c}, are close to the query's, ${cq}, whatever their proportion${off ? "; its point lies just off the close-up" : ""}.`, `Sus conteos, ${c}, se parecen a los de la consulta, ${cq}, sea cual sea su proporción${off ? "; su punto queda justo fuera de la vista" : ""}.`);
    out.innerHTML = `<p class="lbl">${tr("Closest", "Más cercano")}: ${chapterMid(j)}${tie}</p><p class="eq">${eq}</p><p>${says}</p>`;
  }
  modeButtons(document.getElementById("fig-angle-pairs"), (m) => { pair = Number(m); draw(); });
  modeButtons(document.getElementById("fig-angle-modes"), (m) => { mode = m; update(); });
  modeButtons(document.getElementById("fig-angle-zoom"), (m) => { zoom = Number(m); draw(); });
  draw();
}

/* ---------- Figure 5: search ---------- */

function searchFigure() {
  const panel = document.getElementById("fig-search");
  if (!panel) return;
  const out = document.getElementById("fig-search-out");
  const params = document.getElementById("fig-search-params");
  const S = D.search, chosen = new Set([S.chips[0]]);
  let mode = "bm25", k1 = 1.2, b = 0.75;
  const fOf = (w, j) => (S.post[w].find(([k]) => k === j) ?? [j, 0])[1];
  const len = (j) => D.chapters[j][2];
  const bmW = (w, j) => { const f = fOf(w, j); return (f * (k1 + 1)) / (k1 * (1 - b + (b * len(j)) / D.lavg) + f) * idf(S.df[w]); };
  const score = (j) => {
    const ws = [...chosen];
    if (mode === "bm25") return ws.reduce((s, w) => s + bmW(w, j), 0);
    const qn = Math.sqrt(ws.reduce((s, w) => s + idf(S.df[w]) ** 2, 0));
    return ws.reduce((s, w) => s + idf(S.df[w]) * ltf(fOf(w, j)) * idf(S.df[w]), 0) / (qn * S.norm[j]);
  };
  const chips = h("div", "vs-chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", tr("Query words", "Palabras de la consulta"));
  for (const w of S.chips) {
    const c = h("button", "vs-chip", w);
    c.type = "button";
    c.setAttribute("aria-pressed", String(chosen.has(w)));
    c.addEventListener("click", () => {
      if (chosen.has(w)) chosen.delete(w); else chosen.add(w);
      c.setAttribute("aria-pressed", String(chosen.has(w)));
      update();
    });
    chips.append(c);
  }
  const results = h("ol", "vs-results");
  // What the bars measure: the chapter's score under the ranking picked.
  const measure = h("p", "vs-measure");
  panel.append(h("p", "vs-head", tr("Query", "Consulta")), chips, h("p", "vs-head", tr("The first five chapters", "Los cinco primeros capítulos")), measure, results);
  function update() {
    params.style.visibility = mode === "bm25" ? "visible" : "hidden";
    measure.textContent = mode === "bm25" ? tr("BM25 score", "puntuación BM25") : tr("cosine", "coseno");
    results.replaceChildren();
    if (!chosen.size) {
      out.innerHTML = `<p class="lbl">${tr("The query", "La consulta")}</p><p>${tr("Pick a word for the query.", "Elige una palabra para la consulta.")}</p>`;
      return;
    }
    const ranked = D.chapters.map((_, j) => [score(j), j]).sort((x, y) => y[0] - x[0] || x[1] - y[1]).slice(0, 5);
    const top = ranked[0][0] || 1;
    for (const [s, j] of ranked) {
      const li = h("li", "vs-res");
      const bar = h("span", "vs-res-bar");
      bar.style.width = `${(100 * s) / top}%`;
      const track = h("span", "vs-res-track");
      track.append(bar);
      li.append(h("span", "vs-res-lab", label(j)), h("span", "vs-res-title", title(j)), track, h("span", "vs-res-n", fmt(s, mode === "bm25" ? 2 : 3)));
      results.append(li);
    }
    const [s0, j] = ranked[0], ws = [...chosen];
    let eq;
    if (mode === "bm25") {
      if (ws.length === 1) {
        const w = ws[0], f = fOf(w, j);
        eq = `<span class="nowrap"><span class="frac"><span>${f} · ${fmt(k1 + 1, 1)}</span><span>${fmt(k1, 1)} · (${fmt(1 - b, 2)} + ${fmt(b, 2)} · ${fmt(len(j) / D.lavg, 2)}) + ${f}</span></span></span> <span class="nowrap">· log<sub>10</sub>(${N}/${S.df[w]})</span> <span class="nowrap">≈ ${fmt(s0, 2)}</span>`;
      } else eq = `<span class="nowrap">${ws.map((w) => fmt(bmW(w, j), 2)).join(" + ")}</span> <span class="nowrap">≈ ${fmt(s0, 2)}</span>`;
    } else {
      const qn = Math.sqrt(ws.reduce((s, w) => s + idf(S.df[w]) ** 2, 0));
      const dot = ws.reduce((s, w) => s + idf(S.df[w]) * ltf(fOf(w, j)) * idf(S.df[w]), 0);
      eq = `<span class="nowrap">cos = <span class="frac"><span>${fmt(dot, 2)}</span><span>${fmt(qn, 2)} · ${fmt(S.norm[j], 2)}</span></span></span> <span class="nowrap">≈ ${fmt(s0, 3)}</span>`;
    }
    const says = mode === "bm25"
      ? tr("Each use adds less than the one before, and a long chapter needs more of them.", "Cada uso suma menos que el anterior, y un capítulo largo necesita más.")
      : tr("Dividing by the length of the chapter's whole vector favors short chapters.", "Dividir por el largo del vector completo del capítulo favorece a los capítulos cortos.");
    out.innerHTML = `<p class="lbl">${tr("First", "Primero")}: ${chapterMid(j)}</p><p class="eq">${eq}</p><p>${says}</p>`;
  }
  modeButtons(document.getElementById("fig-search-modes"), (m) => { mode = m; update(); });
  modeButtons(document.getElementById("fig-search-k1"), (m) => { k1 = Number(m); update(); });
  modeButtons(document.getElementById("fig-search-b"), (m) => { b = Number(m); update(); });
  update();
}

pipelineFigure();
planeFigure();
weightsFigure();
angleFigure();
searchFigure();
