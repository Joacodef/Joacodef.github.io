// Figures of the note on sequence labeling, on Don Quijote (the original on the Spanish page, Ormsby's translation on
// the English one): a phrase's labels in BIO and the names they give; the scores of a head on the book's word vectors,
// trained alone; a labeling scored with the tagger's head and its table of transitions; the forward sums and Z; an HMM's
// chain of tags, counted on the treebanks; and Viterbi's best chain against choosing one tag at a time.
// Figures 2 to 6 share one grid: a column per token and a row per label, P drawn on its side.
// Carmine is a name (its underline) and the labeling or chain asked about (its path); blue is scores and what flows
// (a box's share, the table's cells, the forward recursion's edges, back-pointers); ink the box picked; faint the rest.
import { el, tr, lang, modeButtons, roving, steadyHeight, localNum } from "../../plane.js";
import { DATA } from "./sequence-labeling-data.js";

const D = DATA[lang];
const L = ["O", "B-PER", "I-PER", "B-LOC", "I-LOC"];
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const code = (s) => `<span class="sl-code">${s}</span>`;
const n2 = (x) => localNum(x, 2);
const MINUS = "−";
// Terms of a sum, each with its sign: "−1.81 + 0.95 − 0.86".
const terms = (xs) => xs.map((x, i) => (i ? (x < 0 ? ` ${MINUS} ` : " + ") + n2(Math.abs(x)) : n2(x))).join("");
// The same terms in parentheses, each in a piece of its own that keeps together: "+ (−1.81", "+ 0.95", "− 0.86)".
const termPieces = (lead, xs) => xs.map((x, i) => `<span class="nowrap">${i ? (x < 0 ? MINUS : "+") : `${lead} (`}${i ? " " + n2(Math.abs(x)) : n2(x)}${i === xs.length - 1 ? ")" : ""}</span>`).join(" ");
const dotKey = () => `<span class="sl-ki"><span class="sl-sw dot"></span><span>${tr("the start, before the first word", "el inicio, antes de la primera palabra")}</span></span>`;
const r2 = (x) => Math.round(x * 100) / 100;
const sub = (i) => `<sub>${i}</sub>`;

/* ---------- Names from labels ---------- */

// The names a labeling gives: a B- opens one, an I- of the same kind continues it, anything else closes it; an I- that
// continues nothing is broken (it opens no name here, so the figure can show it).
function readNames(y) {
  const names = [], broken = [];
  let cur = null;
  y.forEach((lab, i) => {
    if (lab.startsWith("I-") && cur && cur.kind === lab.slice(2)) cur.end = i + 1;
    else if (lab.startsWith("B-")) { cur = { start: i, end: i + 1, kind: lab.slice(2) }; names.push(cur); }
    else { cur = null; if (lab.startsWith("I-")) broken.push(i); }
  });
  return { names, broken };
}
// How many of the K^N labelings of N tokens follow the scheme: an I-X only after B-X or I-X.
function validCount(N) {
  let c = L.map((lab) => (lab.startsWith("I-") ? 0 : 1));
  for (let i = 1; i < N; i++) c = L.map((lab) => (lab.startsWith("I-") ? c[L.indexOf("B-" + lab.slice(2))] + c[L.indexOf(lab)] : c.reduce((a, b) => a + b, 0)));
  return c.reduce((a, b) => a + b, 0);
}
const kindName = (k) => (k === "PER" ? tr("person", "persona") : tr("place", "lugar"));
// "a person, “Don Quixote”, and a place, “La Mancha”"; "4 persons: “Don Gaiferos”, …"
function describeNames(toks, y) {
  const { names } = readNames(y);
  const txt = (n) => q(toks.slice(n.start, n.end).join(" ").replace(/ ,/g, ","));
  const one = (n) => (n.kind === "PER" ? tr(`a person, ${txt(n)}`, `una persona, ${txt(n)}`) : tr(`a place, ${txt(n)}`, `un lugar, ${txt(n)}`));
  const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${tr("and", "y")} ${xs[xs.length - 1]}`);
  if (!names.length) return tr("no names", "ningún nombre");
  if (names.length === 1) return one(names[0]);
  if (names.length === 2) return `${one(names[0])}, ${tr("and", "y")} ${one(names[1])}`;
  const kinds = new Set(names.map((n) => n.kind));
  const head = kinds.size === 1 ? (names[0].kind === "PER" ? tr(`${names.length} persons`, `${names.length} personas`) : tr(`${names.length} places`, `${names.length} lugares`)) : tr(`${names.length} names`, `${names.length} nombres`);
  return `${head}: ${list(names.map(txt))}`;
}

/* ---------- A phrase as words with their labels ---------- */

// The words of a phrase in a row, each with its label small above it and the names underlined in carmine with their
// kind after them; a broken I- gets a faint dashed underline. With buttons, each word is a button.
function wordLine(box, toks, y, { buttons = false, picked = -1 } = {}) {
  box.replaceChildren();
  const { names, broken } = readNames(y), inName = toks.map(() => null);
  names.forEach((n) => { for (let i = n.start; i < n.end; i++) inName[i] = { n, last: i === n.end - 1 }; });
  return toks.map((t, i) => {
    const w = h(buttons ? "button" : "span", `sl-w${inName[i] ? " in" : ""}${broken.includes(i) ? " broken" : ""}${inName[i] && !inName[i].last ? " cont" : ""}`);
    if (buttons) { w.type = "button"; w.tabIndex = i === picked ? 0 : -1; w.setAttribute("aria-label", `${t}: ${y[i]}`); }
    w.innerHTML = `<span class="sl-tag${y[i] === "O" ? " o" : ""}">${y[i]}</span><span class="sl-word">${t}</span>${inName[i]?.last ? `<span class="sl-kind">${kindName(inName[i].n.kind)}</span>` : ""}`;
    box.append(w);
    return w;
  });
}

/* ---------- Figure 1: a label for every token ---------- */

function bioFigure() {
  const panel = document.getElementById("fig-bio");
  if (!panel) return;
  const out = document.getElementById("fig-bio-out"), reset = document.getElementById("fig-bio-reset");
  const line = h("div", "sl-line");
  panel.append(h("p", "sl-head", tr("The phrase, a label above each word", "La frase, con una etiqueta sobre cada palabra")), line);
  let preset = 0, y = D.bio[0].y.slice(), focus = 0;
  const cycle = (i) => { y[i] = L[(L.indexOf(y[i]) + 1) % L.length]; focus = i; show(); line.children[i].focus(); };
  function show() {
    const toks = D.bio[preset].toks;
    const items = wordLine(line, toks, y, { buttons: true, picked: focus });
    items.forEach((b, i) => {
      b.addEventListener("click", () => cycle(i));
      b.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(i); return; }
        const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        focus = Math.max(0, Math.min(toks.length - 1, j));
        items.forEach((x, k) => (x.tabIndex = k === focus ? 0 : -1));
        items[focus].focus();
      });
    });
    const N = toks.length, { broken } = readNames(y);
    let says;
    if (broken.length) {
      const i = broken[0], where = i ? tr(`after ${code(y[i - 1])}`, `después de ${code(y[i - 1])}`) : tr("at the start", "al comienzo");
      says = tr(`${code(y[i])} ${where}: an ${code("I-")} must continue a name of its own kind.`, `${code(y[i])} ${where}: una ${code("I-")} debe continuar un nombre de su tipo.`);
    } else if (preset === 1 && y.some((l, i) => i > 0 && l.startsWith("I-") && D.bio[1].y[i].startsWith("B-"))) says = tr(`Without the ${code("B-")}, two names that touch merge into one.`, `Sin la ${code("B-")}, dos nombres que se tocan se funden en uno.`);
    else says = tr(`Of the 5${sup(N)} = ${localNum(5 ** N)} ways to label these ${N} tokens, ${localNum(validCount(N))} follow the scheme.`, `De las 5${sup(N)} = ${localNum(5 ** N)} maneras de etiquetar estos ${N} tokens, ${localNum(validCount(N))} siguen el esquema.`);
    out.innerHTML = `<p class="lbl">${tr("The names the labels give", "Los nombres que dan las etiquetas")}</p><p class="sl-codes">${y.map((l) => code(l)).join(" ")}</p><p>${describeNames(toks, y)}.</p><p>${says}</p>`;
    const changed = y.join(" ") !== D.bio[preset].y.join(" ");
    if (!changed && document.activeElement === reset) line.children[focus].focus();
    reset.hidden = !changed;
    panel.setAttribute("aria-label", tr(`${toks.join(" ")}, labeled ${y.join(" ")}`, `${toks.join(" ")}, con las etiquetas ${y.join(" ")}`));
  }
  const press = modeButtons(document.getElementById("fig-bio-mode"), (m) => { preset = +m; y = D.bio[preset].y.slice(); focus = 0; show(); });
  reset.addEventListener("click", () => { y = D.bio[preset].y.slice(); show(); line.children[focus].focus(); });
  show();
  // Heights kept: each preset as given and with a broken label, the readout's tallest states.
  const set = (st) => { preset = st.p; y = st.y.slice(); show(); };
  const broken = (p) => { const z = D.bio[p].y.slice(); z[2] = "I-LOC"; return z; };
  const states = [0, 1].flatMap((p) => [{ p, y: D.bio[p].y }, { p, y: broken(p) }]);
  steadyHeight(panel, states, set, () => ({ p: preset, y: y.slice() }));
  steadyHeight(out, states, set, () => ({ p: preset, y: y.slice() }));
  press(String(preset));
}
const sup = (s) => `<sup>${s}</sup>`;

/* ---------- The grid of figures 2 to 6 ---------- */

// A column per token and a row per label, each box a button. kind "pick": the arrow keys and clicks pick any box;
// kind "path": each column is a group of radio buttons, up and down set its label, left and right move between columns.
// cell(i, k) gives a box's { text, cls, shade } or null where there is none; extra adds a box at the right (Z, or the
// best chain's end); edges() lists the lines to draw between boxes; tags(i) the label shown above each word.
function makeGrid(panel, { words, rows, cell, kind, onPick, extra = null, edges = () => [], tags = null, underline = null, start = true, below = null }) {
  const wrap = h("div", "sl-gridwrap"), grid = h("div", `sl-grid${extra ? " has-extra" : ""}`), svg = el("svg", { class: "sl-edges", "aria-hidden": "true" }, null);
  wrap.append(grid, svg); panel.append(wrap);
  const N = words.length, K = rows.length;
  grid.style.setProperty("--n", N); grid.style.setProperty("--k", K);
  const narrow = matchMedia("(max-width: 480px)");
  // The extra box sits beside the grid, or under its last column on phones.
  const columns = () => {
    grid.style.gridTemplateColumns = `max-content repeat(${N}, minmax(0, 1fr))${extra && !narrow.matches ? " max-content" : ""}`;
    if (xbox) { xbox.style.gridColumn = String(narrow.matches ? N + 1 : N + 2); xbox.style.gridRow = narrow.matches ? String(K + 2) : `2 / span ${K}`; xcorner.hidden = narrow.matches; }
  };
  narrow.addEventListener("change", () => { columns(); requestAnimationFrame(draw); });
  grid.append(h("span", "sl-corner"));
  const heads = words.map((w, i) => { const c = h("span", "sl-colhead"); c.innerHTML = `<span class="sl-tag"></span><span class="sl-word">${w}</span>`; grid.append(c); return c; });
  const xcorner = extra ? h("span", "sl-corner") : null;
  if (xcorner) grid.append(xcorner);
  const boxes = rows.map((r, k) => {
    grid.append(h("span", "sl-rowhead", code(r)));
    return words.map((_, i) => { const b = h("button", "sl-box"); b.type = "button"; b.dataset.i = i; b.dataset.k = k; grid.append(b); return b; });
  });
  let xbox = null;
  if (extra) { xbox = h("button", "sl-box sl-extra"); xbox.type = "button"; grid.append(xbox); }
  columns();
  let belowRow = null;
  if (below) { grid.append(h("span", "sl-rowhead sl-belowhead", below.label)); belowRow = words.map(() => { const c = h("span", "sl-below"); grid.append(c); return c; }); }
  let picked = [0, 0];
  const exists = (i, k) => cell(i, k) !== null;
  function paint() {
    rows.forEach((_, k) => words.forEach((_, i) => {
      const b = boxes[k][i], c = cell(i, k);
      b.className = "sl-box";
      if (!c) { b.classList.add("none"); b.textContent = ""; b.tabIndex = -1; b.disabled = true; b.setAttribute("aria-hidden", "true"); return; }
      b.disabled = false; b.removeAttribute("aria-hidden");
      b.innerHTML = c.text;
      if (c.cls) b.classList.add(...c.cls.split(" "));
      b.style.setProperty("--a", c.shade ?? 0);
      b.classList.toggle("picked", picked[0] === i && picked[1] === k);
      b.tabIndex = picked[0] === i && picked[1] === k ? 0 : -1;
      b.setAttribute("aria-label", c.label);
      if (kind === "path") b.setAttribute("aria-pressed", String(!!c.on));
    }));
    if (xbox) {
      const c = extra();
      xbox.innerHTML = c.text; xbox.setAttribute("aria-label", c.label);
      xbox.classList.toggle("picked", picked[0] === N);
      xbox.tabIndex = picked[0] === N ? 0 : -1;
    }
    if (tags) heads.forEach((c, i) => { const t = tags(i); const s = c.querySelector(".sl-tag"); s.textContent = t ?? ""; s.classList.toggle("o", t === "O"); });
    if (belowRow) belowRow.forEach((c, i) => { c.innerHTML = below.text(i); });
    requestAnimationFrame(draw);
  }
  // Lines between boxes, in the layer over the grid, measured from the boxes.
  function draw() {
    const W = wrap.clientWidth, H = wrap.clientHeight, at = wrap.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.replaceChildren();
    const rect = (b) => { const r = b.getBoundingClientRect(); return { l: r.left - at.left, r: r.right - at.left, t: r.top - at.top, b: r.bottom - at.top, m: (r.top + r.bottom) / 2 - at.top }; };
    const first = rect(boxes[0][0]), last = rect(boxes[K - 1][0]);
    // The start dot halfway between the row names' text and the first column.
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 12, pad = parseFloat(getComputedStyle(grid.querySelector(".sl-rowhead")).paddingRight) || 0;
    const sx = first.l - (gap + pad) / 2, sy = (first.t + last.b) / 2;
    const end = (p, side) => {
      if (p === "start") return [sx, sy];
      if (p === "extra") { const r = rect(xbox); return narrow.matches ? [r.r, r.m] : [r.l, r.m]; }
      const r = rect(boxes[p[1]][p[0]]); return side === "out" ? [r.r, r.m] : [r.l, r.m];
    };
    // On phones the extra box sits under the last column: a line into it leaves its box to the right, runs down the
    // margin beside the column and comes back in from the right, so it crosses no box.
    const padR = parseFloat(getComputedStyle(wrap.closest(".sl-panel") ?? wrap).paddingRight) || 0;
    const margin = narrow.matches && xbox ? Math.min(Math.max(rect(boxes[0][N - 1]).r, rect(xbox).r) + 5, W + padR - 3) : 0;
    for (const e of edges()) {
      const [x1, y1] = end(e.from, "out"), [x2, y2] = end(e.to, "in");
      const attrs = { class: `sl-edge ${e.cls ?? ""}`, "stroke-width": e.width ?? null };
      if (e.to === "extra" && narrow.matches) el("polyline", { ...attrs, points: `${x1},${y1} ${margin},${y1} ${margin},${y2} ${x2},${y2}` }, svg);
      else el("line", { x1, y1, x2, y2, ...attrs }, svg);
    }
    if (start) el("circle", { cx: sx, cy: sy, r: gap < 4 ? 2 : gap < 8 ? 2.5 : 3.5, class: "sl-start" }, svg);
    if (underline) {
      const { names, broken } = readNames(underline());
      const span = (i) => { const r = heads[i].querySelector(".sl-word").getBoundingClientRect(); return { l: r.left - at.left, r: r.right - at.left, b: r.bottom - at.top }; };
      for (const n of names) { const a = span(n.start), z = span(n.end - 1); el("line", { x1: a.l, y1: a.b + 2, x2: z.r, y2: a.b + 2, class: "sl-uline" }, svg); }
      for (const i of broken) { const a = span(i); el("line", { x1: a.l, y1: a.b + 2, x2: a.r, y2: a.b + 2, class: "sl-uline broken" }, svg); }
    }
  }
  // Keyboard: the nearest box in the arrow's direction.
  function move(i, k, di, dk) {
    if (kind === "path" && dk) { let kk = k + dk; while (kk >= 0 && kk < K && !exists(i, kk)) kk += dk; return kk >= 0 && kk < K ? [i, kk] : null; }
    if (di) {
      const ni = i + di;
      if (extra && ni === N) return [N, 0];
      if (ni < 0 || ni >= N) return null;
      if (kind === "path") return [ni, onPick.current ? onPick.current(ni) : k];
      let best = null; for (let kk = 0; kk < K; kk++) if (exists(ni, kk) && (best === null || Math.abs(kk - k) < Math.abs(best - k))) best = kk;
      return best === null ? null : [ni, best];
    }
    let kk = k + dk; while (kk >= 0 && kk < K && !exists(i, kk)) kk += dk;
    if (kk >= K && extra && narrow.matches && i === N - 1) return [N, 0];
    return kk >= 0 && kk < K ? [i, kk] : null;
  }
  const focusBox = (i, k) => (i === N ? xbox : boxes[k][i]).focus();
  function handle(i, k) { picked = [i, k]; onPick(i, k); }
  boxes.forEach((row, k) => row.forEach((b, i) => {
    b.addEventListener("click", () => { handle(i, k); focusBox(i, k); });
    b.addEventListener("keydown", (e) => {
      const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const to = move(i, k, d[0], d[1]);
      if (to) { handle(to[0], to[1]); focusBox(to[0], to[1]); }
    });
  }));
  if (xbox) {
    xbox.addEventListener("click", () => { handle(N, 0); xbox.focus(); });
    xbox.addEventListener("keydown", (e) => {
      const up = e.key === "ArrowUp" && narrow.matches;
      if (e.key !== "ArrowLeft" && !up) return;
      e.preventDefault();
      // Up, on phones, goes to the box just above; left to the chain's end, or the column's first box.
      let best = 0; for (let kk = 0; kk < K; kk++) if (exists(N - 1, kk)) { best = kk; if (!up) break; }
      const k0 = !up && onPick.lastRow ? onPick.lastRow() : best;
      handle(N - 1, k0); focusBox(N - 1, k0);
    });
  }
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(wrap);
  document.fonts.ready.then(() => requestAnimationFrame(draw));
  return { paint, setPicked: (i, k) => { picked = [i, k]; }, picked: () => picked, wrap };
}
// A blue share in [0, 1] for each box of a column: the token's softmax over its scores.
const softmax = (v) => { const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const argmax = (v) => v.indexOf(Math.max(...v));

/* ---------- Figure 2: one encoder, many heads ---------- */

// Both phrases' grids are built once; the mode shows one.
function headFigure() {
  const panel = document.getElementById("fig-head");
  if (!panel) return;
  const out = document.getElementById("fig-head-out");
  let key = "village";
  panel.append(h("p", "sl-head", tr("Scores <i>P</i>, a column per token", "Puntuaciones <i>P</i>, una columna por token")));
  const grids = {};
  for (const m of ["village", "don"]) {
    const holder = h("div", "sl-holder"), P = D.head[m].P, toks = D.head[m].toks;
    panel.append(holder);
    grids[m] = makeGrid(holder, {
      words: toks, rows: L, kind: "pick", start: false,
      cell: (i, k) => { const p = softmax(P[i]); return { text: n2(P[i][k]), shade: p[k], label: `${toks[i]}, ${L[k]}: ${n2(P[i][k])}, ${tr("share", "parte")} ${localNum(p[k], 2)}` }; },
      tags: (i) => L[argmax(P[i])],
      underline: () => P.map((r) => L[argmax(r)]),
      onPick: () => show(),
    });
    grids[m].setPicked(toks.length - 1, argmax(P[toks.length - 1]));
    grids[m].holder = holder;
  }
  panel.append(h("p", "sl-key", `<span class="sl-ki"><span class="sl-sw blue"></span><span>${tr("share of the token's probability", "parte de la probabilidad del token")}</span></span>`));
  function show() {
    for (const m of ["village", "don"]) grids[m].holder.hidden = m !== key;
    const g = grids[key], P = D.head[key].P, toks = D.head[key].toks, [i, k] = g.picked(), row = P[i], p = softmax(row);
    const frac = `<span class="frac"><span><i>e</i><sup>${n2(row[k])}</sup></span><span>${row.map((x) => `<span class="nowrap"><i>e</i><sup>${n2(x)}</sup></span>`).join(" + ")}</span></span>`;
    const w = toks[i], shared = i >= toks.length - 3;
    const says = shared
      ? tr(`${q(w)} has this same column in both phrases: the head reads each word alone, and gives it ${code(L[argmax(row)])}.`, `${q(w)} tiene esta misma columna en las dos frases: el cabezal lee cada palabra sola, y le da ${code(L[argmax(row)])}.`)
      : tr(`Each token takes its highest: ${q(w)} takes ${code(L[argmax(row)])}.`, `Cada token se queda con la más alta: ${q(w)} se queda con ${code(L[argmax(row)])}.`);
    out.innerHTML = `<p class="lbl">${tr(`${q(w)} as ${code(L[k])}, by the head alone`, `${q(w)} como ${code(L[k])}, según el cabezal por sí solo`)}</p>` +
      `<p class="eq"><span class="nowrap"><i>p</i>(<i>y</i>${sub(i + 1)} = ${code(L[k])} | <i>x</i>)</span> <span class="nowrap">= ${frac}</span> <span class="nowrap">≈ ${localNum(p[k], 2)}</span></p><p>${says}</p>`;
    g.paint();
  }
  show();
  // A new phrase keeps the box picked counted from the end, so "of La Mancha" stays under the reader's eye.
  modeButtons(document.getElementById("fig-head-mode"), (m) => { const [i, k] = grids[key].picked(), fromEnd = D.head[key].toks.length - i; key = m; grids[m].setPicked(Math.max(0, D.head[m].toks.length - fromEnd), k); show(); });
  const states = ["village", "don"].flatMap((m) => D.head[m].P.flatMap((r, i) => L.map((_, k) => [m, i, k])));
  steadyHeight(panel, ["village", "don"], (m) => { key = m; show(); }, () => key);
  steadyHeight(out, states, ([m, i, k]) => { key = m; grids[m].setPicked(i, k); show(); }, () => [key, ...grids[key].picked()]);
}

/* ---------- Figure 3: the transition matrix and a labeling's score ---------- */

function scoreFigure() {
  const panel = document.getElementById("fig-score");
  if (!panel) return;
  const out = document.getElementById("fig-score-out"), reset = document.getElementById("fig-score-reset");
  const { A, start } = D.crf;
  const startPath = (m) => D.head[m].P.map((r) => argmax(r));
  let key = "village";
  const paths = { village: startPath("village"), don: startPath("don") };
  panel.append(h("p", "sl-head", tr("Scores <i>P</i> of the tagger's head, and a labeling", "Puntuaciones <i>P</i> del cabezal del etiquetador, y una secuencia de etiquetas")));
  const grids = {};
  for (const m of ["village", "don"]) {
    const holder = h("div", "sl-holder"), P = D.crf.phrases[m].P, toks = D.crf.phrases[m].toks;
    panel.append(holder);
    grids[m] = makeGrid(holder, {
      words: toks, rows: L, kind: "path",
      cell: (i, k) => ({ text: n2(P[i][k]), cls: paths[m][i] === k ? "on" : "", on: paths[m][i] === k, label: `${toks[i]}, ${L[k]}: ${n2(P[i][k])}` }),
      tags: (i) => L[paths[m][i]],
      underline: () => paths[m].map((k) => L[k]),
      edges: () => paths[m].map((k, i) => ({ from: i ? [i - 1, paths[m][i - 1]] : "start", to: [i, k], cls: "path" })),
      onPick: Object.assign((i, k) => { paths[m][i] = k; show(); }, { current: (i) => paths[m][i] }),
    });
    grids[m].setPicked(toks.length - 1, paths[m][toks.length - 1]);
    grids[m].holder = holder;
  }
  const tableHead = h("p", "sl-head sl-thead", tr("The table <i>A</i>: previous label down, next label across", "La tabla <i>A</i>: la etiqueta anterior hacia abajo, la siguiente hacia el lado"));
  const table = h("div", "sl-table");
  const tkey = h("p", "sl-key", `<span class="sl-ki"><span class="sl-sw blue"></span><span>${tr("follows easily", "sigue con facilidad")}</span></span><span class="sl-ki"><span class="sl-sw faint"></span><span>${tr("rarely or never", "rara vez o nunca")}</span></span><span class="sl-ki"><span class="sl-sw used"></span><span>${tr("a step of the labeling", "un paso de la secuencia")}</span></span>${dotKey()}`);
  panel.append(tableHead, table, tkey);
  // The table's shading: its highest cell full blue, its lowest faint.
  const all = [...start, ...A.flat()], lo = Math.min(...all), hi = Math.max(...all), shade = (x) => (x - lo) / (hi - lo);
  table.style.gridTemplateColumns = `max-content repeat(${L.length}, minmax(0, 1fr))`;
  table.append(h("span", "sl-corner"));
  L.forEach((l) => table.append(h("span", "sl-tcol", code(l))));
  const tcells = [];
  [tr("start", "inicio"), ...L].forEach((r, j) => {
    table.append(h("span", "sl-rowhead", j ? code(r) : `<span class="sl-start-name">${r}</span>`));
    tcells.push(L.map((_, k) => { const v = j ? A[j - 1][k] : start[k], c = h("span", "sl-tcell", n2(v)); c.style.setProperty("--a", shade(v)); table.append(c); return c; }));
  });
  // The readout for a phrase and a labeling.
  const bests = { village: bestLabeling(D.crf.phrases.village.P, A, start), don: bestLabeling(D.crf.phrases.don.P, A, start) };
  function readout(m, path) {
    const P = D.crf.phrases[m].P, N = P.length;
    const tokPart = path.map((k, i) => P[i][k]), stepPart = path.map((k, i) => (i ? A[path[i - 1]][k] : start[k]));
    const a = r2(tokPart.reduce((s, x) => s + x, 0)), b = r2(stepPart.reduce((s, x) => s + x, 0)), sc = r2(a + b);
    const { y: best, s: bs } = bests[m], isBest = best.join() === path.join();
    const worst = stepPart.indexOf(Math.min(...stepPart)), from = worst ? code(L[path[worst - 1]]) : tr("the start", "el inicio");
    const says = isBest
      ? tr(`The highest of the ${localNum(5 ** N)} labelings.`, `La más alta de las ${localNum(5 ** N)} secuencias de etiquetas.`)
      : tr(`Its weakest step is ${from} → ${code(L[path[worst]])}, ${n2(stepPart[worst])}; the highest of the ${localNum(5 ** N)} labelings, ${best.map((k) => code(L[k])).join(" ")}, scores ${n2(bs)}.`,
        `Su paso más débil es ${from} → ${code(L[path[worst]])}, ${n2(stepPart[worst])}; la más alta de las ${localNum(5 ** N)} secuencias, ${best.map((k) => code(L[k])).join(" ")}, puntúa ${n2(bs)}.`);
    return `<p class="lbl">${tr("The labeling", "La secuencia")} ${path.map((k) => code(L[k])).join(" ")}</p>` +
      `<p class="eq"><span class="nowrap"><i>s</i>(<i>x</i>, <i>y</i>)</span> ${termPieces("=", tokPart)} ${termPieces("+", stepPart)} <span class="nowrap">= ${n2(a)} ${b < 0 ? MINUS : "+"} ${n2(Math.abs(b))}</span> <span class="nowrap">= ${n2(sc)}</span></p><p>${says}</p>`;
  }
  function show() {
    for (const m of ["village", "don"]) grids[m].holder.hidden = m !== key;
    const g = grids[key], path = paths[key];
    out.innerHTML = readout(key, path);
    tcells.forEach((row, j) => row.forEach((c, k) => c.classList.toggle("used", path.some((pk, i) => pk === k && (i ? path[i - 1] + 1 : 0) === j))));
    const changed = path.join() !== startPath(key).join();
    if (!changed && document.activeElement === reset) { const [pi] = g.picked(); g.wrap.querySelector(`.sl-box[data-i="${pi}"][data-k="${path[pi]}"]`).focus(); }
    reset.hidden = !changed;
    g.paint();
  }
  show();
  modeButtons(document.getElementById("fig-score-mode"), (m) => { key = m; show(); });
  reset.addEventListener("click", () => { paths[key] = startPath(key); const g = grids[key], [i] = g.picked(); g.setPicked(i, paths[key][i]); show(); g.wrap.querySelector(`.sl-box[data-i="${i}"][data-k="${paths[key][i]}"]`).focus(); });
  // Heights kept over the labelings one token away from the starting one and from the best one, those with one label
  // throughout, and those whose readout runs longest (capitals counted wider): of all 5^N, the 60 longest in all and
  // the 30 longest in the sum and in the sentence below it.
  const near = (pp) => [pp, ...pp.flatMap((_, i) => L.map((_, k) => pp.map((x, j) => (j === i ? k : x))))];
  const text = (html) => [...html.replace(/<[^>]+>/g, "")].reduce((n, c) => n + (/[A-Z]/.test(c) ? 1.5 : 1), 0);
  const states = ["village", "don"].flatMap((m) => {
    const N = D.crf.phrases[m].P.length, all = Array.from({ length: 5 ** N }, (_, n) => Array.from({ length: N }, (_, i) => Math.floor(n / 5 ** (N - 1 - i)) % 5));
    const sized = all.map((pp) => { const [, , eq, says] = readout(m, pp).split(/<p[^>]*>/); return { pp, eq: text(eq), says: text(says) }; });
    const top = (f, n) => sized.slice().sort((x, y) => f(y) - f(x)).slice(0, n).map((x) => x.pp);
    return [...near(startPath(m)), ...near(bests[m].y), ...L.map((_, k) => Array(N).fill(k)), ...top((x) => x.eq + x.says, 60), ...top((x) => x.eq, 30), ...top((x) => x.says, 30)].map((pp) => ({ m, pp }));
  });
  steadyHeight(panel, ["village", "don"], (m) => { key = m; show(); }, () => key);
  steadyHeight(out, states, (st) => { out.innerHTML = readout(st.m, st.pp); }, () => ({ m: key, pp: paths[key].slice() }));
}

/* ---------- Figure 4: Z and the forward recursion ---------- */

// The best of the K^N labelings by brute force (625 or 3,125), with its score.
function bestLabeling(P, A, start) {
  const N = P.length, y = Array(N).fill(0);
  let best = null, bs = -Infinity;
  while (true) {
    const v = y.reduce((acc, k, i) => acc + P[i][k] + (i ? A[y[i - 1]][k] : start[k]), 0);
    if (v > bs + 1e-9) { bs = v; best = y.slice(); }
    let i = N - 1; while (i >= 0 && ++y[i] === 5) { y[i] = 0; i--; }
    if (i < 0) break;
  }
  return { y: best, s: r2(bs) };
}

// α to read: four significant digits in a readout, whole numbers in a box from 100 on, two decimals below that, and
// "< 0.01" for less.
const fmtBox = (x) => (x >= 99.5 ? localNum(Math.round(x)) : x >= 0.005 ? localNum(x, 2) : "< 0.01");
// A result in a readout: as its box shows it, or, below 0.005, to three significant digits.
const fmtRes = (x) => (x >= 0.005 ? fmtBox(x) : fmtSig(x, 3));
function fmtSig(x, s = 4) {
  if (x >= 10 ** (s - 1)) return localNum(Math.round(x));
  if (x < 1e-3) { const e = Math.floor(Math.log10(x)), m = x / 10 ** e; return `${localNum(m, s - 1)}·10<sup>${MINUS}${-e}</sup>`; }
  const d = Math.max(0, s - 1 - Math.floor(Math.log10(x)));
  return localNum(x, d);
}
function forwardFigure() {
  const panel = document.getElementById("fig-forward");
  if (!panel) return;
  const out = document.getElementById("fig-forward-out");
  const { A, start } = D.crf, ph = D.crf.phrases.village, P = ph.P, toks = ph.toks, N = toks.length;
  const al = [start.map((s, k) => Math.exp(s + P[0][k]))];
  for (let i = 1; i < N; i++) al.push(L.map((_, k) => al[i - 1].reduce((s, a, j) => s + a * Math.exp(r2(A[j][k] + P[i][k])), 0)));
  const Z = al[N - 1].reduce((a, b) => a + b, 0);
  panel.append(h("p", "sl-head", tr("Forward sums α for", "Sumas hacia adelante α para") + ` ${q(toks.join(" "))}`));
  const holder = h("div", ""); panel.append(holder);
  panel.append(h("p", "sl-key", `<span class="sl-ki"><span class="sl-sw bluel"></span><span>${tr("what flows into the box picked, as wide as its share", "lo que entra a la casilla elegida, tan ancho como su parte")}</span></span>${dotKey()}`));
  const g = makeGrid(holder, {
    words: toks, rows: L, kind: "pick",
    cell: (i, k) => ({ text: fmtBox(al[i][k]), label: `α${i + 1}(${L[k]}) ${fmtBox(al[i][k])}` }),
    extra: () => ({ text: `<span class="sl-xname"><i>Z</i></span>${fmtBox(Z)}`, label: `Z ${fmtBox(Z)}` }),
    edges: () => {
      const [pi, pk] = g ? g.picked() : [N - 1, 4], es = [];
      for (let i = 1; i < N; i++) L.forEach((_, j) => L.forEach((_, k) => { if (!(i === pi && k === pk)) es.push({ from: [i - 1, j], to: [i, k], cls: "faint" }); }));
      L.forEach((_, k) => { if (!(pi === 0 && pk === k)) es.push({ from: "start", to: [0, k], cls: "faint" }); });
      if (pi === N) L.forEach((_, k) => es.push({ from: [N - 1, k], to: "extra", cls: "flow", width: 0.6 + 4 * (al[N - 1][k] / Z) }));
      else {
        L.forEach((_, k) => { if (pi !== N) es.push({ from: [N - 1, k], to: "extra", cls: "faint" }); });
        if (pi === 0) es.push({ from: "start", to: [0, pk], cls: "flow", width: 4.6 });
        else { const parts = L.map((_, j) => al[pi - 1][j] * Math.exp(r2(A[j][pk] + P[pi][pk]))), tot = parts.reduce((a, b) => a + b, 0); L.forEach((_, j) => es.push({ from: [pi - 1, j], to: [pi, pk], cls: "flow", width: 0.6 + 4 * (parts[j] / tot) })); }
      }
      return es;
    },
    onPick: () => show(),
  });
  function show() {
    const [i, k] = g.picked();
    let eq, says, lbl;
    if (i === N) {
      const { y: best, s: sb } = bestLabeling(P, A, start);
      lbl = tr("The normalizer, the sum of the last column", "El normalizador, la suma de la última columna");
      eq = `<span class="nowrap"><i>Z</i>(<i>x</i>)</span> ${al[N - 1].map((a, j) => `<span class="nowrap">${j ? "+" : "="} ${fmtSig(a, 5)}</span>`).join(" ")} <span class="nowrap">≈ ${fmtRes(Z)}</span>`;
      says = tr(`${N * 5} boxes instead of ${localNum(5 ** N)} labelings; the best, ${best.map((kk) => code(L[kk])).join(" ")}, gets <span class="nowrap"><i>p</i> = <i>e</i><sup>${n2(r2(sb))}</sup> / ${fmtRes(Z)} ≈ ${localNum(Math.exp(r2(sb)) / Z, 2)}</span>.`,
        `${N * 5} casillas en vez de ${localNum(5 ** N)} secuencias; la mejor, ${best.map((kk) => code(L[kk])).join(" ")}, tiene <span class="nowrap"><i>p</i> = <i>e</i><sup>${n2(r2(sb))}</sup> / ${fmtRes(Z)} ≈ ${localNum(Math.exp(r2(sb)) / Z, 2)}</span>.`);
    } else if (i === 0) {
      lbl = tr(`The first token as ${code(L[k])}`, `El primer token como ${code(L[k])}`);
      eq = `<span class="nowrap">α${sub(1)}(${code(L[k])}) = <i>e</i><sup><i>A</i><sub><i>y</i><sub>0</sub>,${code(L[k])}</sub> + <i>P</i><sub>1,${code(L[k])}</sub></sup></span> <span class="nowrap">= <i>e</i><sup>${terms([start[k], P[0][k]])}</sup></span> <span class="nowrap">≈ ${fmtRes(al[0][k])}</span>`;
      says = tr("Only the start label stands before the first token.", "Antes del primer token solo está la etiqueta de inicio.");
    } else {
      const ex = L.map((_, j) => r2(A[j][k] + P[i][k])), parts = L.map((_, j) => al[i - 1][j] * Math.exp(ex[j])), top = argmax(parts);
      lbl = tr(`Token ${i + 1}, ${q(toks[i])}, as ${code(L[k])}`, `El token ${i + 1}, ${q(toks[i])}, como ${code(L[k])}`);
      eq = `<span class="nowrap">α${sub(i + 1)}(${code(L[k])})</span> ${L.map((_, j) => `<span class="nowrap">${j ? "+" : "="} ${fmtSig(al[i - 1][j], 5)} · <i>e</i><sup>${n2(ex[j])}</sup></span>`).join(" ")} <span class="nowrap">≈ ${fmtRes(al[i][k])}</span>`;
      const share = parts[top] / parts.reduce((a, b) => a + b, 0);
      says = share >= 0.9995 ? tr(`More than 99.9% of it comes from ${code(L[top])} at ${q(toks[i - 1])}.`, `Más del 99.9% viene de ${code(L[top])} en ${q(toks[i - 1])}.`)
        : tr(`${localNum(100 * share, 1)}% of it comes from ${code(L[top])} at ${q(toks[i - 1])}.`, `El ${localNum(100 * share, 1)}% viene de ${code(L[top])} en ${q(toks[i - 1])}.`);
    }
    out.innerHTML = `<p class="lbl">${lbl}</p><p class="eq">${eq}</p><p>${says}</p>`;
    g.paint();
  }
  g.setPicked(N - 1, 4);
  show();
  const states = [[N, 0], ...al.flatMap((c, i) => L.map((_, k) => [i, k]))];
  steadyHeight(out, states, ([i, k]) => { g.setPicked(i, k); show(); }, () => g.picked());
}

/* ---------- Figures 5 and 6: the hidden Markov model ---------- */

const H = D.hmm, R = H.rows, NW = H.words.length;
const LT = (j, k) => H.trans[j + 1][k].lp, LE = (i, k) => (H.emit[i][k] ? H.emit[i][k].lp : null);
const chainLog = (path) => r2(path.reduce((s, k, i) => s + LT(i ? path[i - 1] : -1, k) + LE(i, k), 0));
const tagAt = (i, k) => `${q(H.words[i])} ${tr("as", "como")} ${code(R[k])}`;
// Every chain on offer, best first.
const CHAINS = (() => { const out = []; (function rec(i, p) { if (i === NW) { out.push({ p, v: chainLog(p) }); return; } R.forEach((_, k) => { if (LE(i, k) !== null) rec(i + 1, [...p, k]); }); })(0, []); return out.sort((a, b) => b.v - a.v); })();
const logFrac = (x) => `log(${localNum(x.n)} / ${localNum(x.d)})`;

function hmmFigure() {
  const panel = document.getElementById("fig-hmm");
  if (!panel) return;
  const out = document.getElementById("fig-hmm-out"), reset = document.getElementById("fig-hmm-reset");
  // Each word's most frequent tag: the start.
  const startPath = H.words.map((_, i) => { let best = null; R.forEach((_, k) => { if (H.emit[i][k] && (best === null || H.emit[i][k].n > H.emit[i][best].n)) best = k; }); return best; });
  let path = startPath.slice();
  panel.append(h("p", "sl-head", tr("log P(<i>x</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i></sub>) for each word and tag, a chain, and under it each step's log P(<i>h</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i>−1</sub>)", "log P(<i>x</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i></sub>) para cada palabra y etiqueta, una cadena y, debajo, el log P(<i>h</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i>−1</sub>) de cada paso")));
  const holder = h("div", ""); panel.append(holder);
  panel.append(h("p", "sl-key", `<span class="sl-ki"><span class="sl-sw path"></span><span>${tr("the chain", "la cadena")}</span></span>${dotKey()}`), h("p", "sl-gloss", glossLine()));
  const g = makeGrid(holder, {
    words: H.words, rows: R, kind: "path",
    cell: (i, k) => (LE(i, k) === null ? null : { text: n2(LE(i, k)), cls: path[i] === k ? "on" : "", on: path[i] === k, label: `${H.words[i]}, ${R[k]}: ${n2(LE(i, k))}` }),
    tags: (i) => R[path[i]],
    edges: () => path.map((k, i) => ({ from: i ? [i - 1, path[i - 1]] : "start", to: [i, k], cls: "path" })),
    below: { label: tr("step", "paso"), text: (i) => n2(LT(i ? path[i - 1] : -1, path[i])) },
    onPick: Object.assign((i, k) => { path[i] = k; show(); }, { current: (i) => path[i] }),
  });
  function show() {
    const [i] = g.picked(), k = path[i], prev = i ? path[i - 1] : -1;
    const tv = LT(prev, k), ev = LE(i, k), sum = r2(tv + ev), total = chainLog(path), best = CHAINS[0];
    const prevName = i ? code(R[prev]) : tr("start", "inicio");
    out.innerHTML = `<p class="lbl">${tagAt(i, k)}${i ? tr(`, after ${code(R[prev])}`, `, después de ${code(R[prev])}`) : tr(", at the start", ", al comienzo")}</p>` +
      `<p class="eq"><span class="nowrap">log P(${code(R[k])} | ${prevName})</span> <span class="nowrap">+ log P(${H.words[i].toLowerCase()} | ${code(R[k])})</span> <span class="nowrap">= ${logFrac(H.trans[prev + 1][k])}</span> <span class="nowrap">+ ${logFrac(H.emit[i][k])}</span> <span class="nowrap">≈ ${terms([tv, ev])}</span> <span class="nowrap">= ${n2(sum)}</span></p>` +
      `<p>${best.p.join() === path.join()
        ? tr(`The whole chain: <span class="nowrap">log P(<i>x</i>, <i>h</i>) = ${n2(total)}</span>, the highest of the ${CHAINS.length} chains on offer.`, `La cadena entera: <span class="nowrap">log P(<i>x</i>, <i>h</i>) = ${n2(total)}</span>, la más alta de las ${CHAINS.length} cadenas de la cuadrícula.`)
        : tr(`The whole chain: <span class="nowrap">log P(<i>x</i>, <i>h</i>) = ${n2(total)}</span>; the highest of the ${CHAINS.length} chains on offer reaches ${n2(best.v)}.`, `La cadena entera: <span class="nowrap">log P(<i>x</i>, <i>h</i>) = ${n2(total)}</span>; la más alta de las ${CHAINS.length} cadenas de la cuadrícula llega a ${n2(best.v)}.`)}</p>`;
    const changed = path.join() !== startPath.join();
    if (!changed && document.activeElement === reset) g.wrap.querySelector(`.sl-box[data-i="${i}"][data-k="${path[i]}"]`).focus();
    reset.hidden = !changed;
    g.paint();
  }
  // Start at the word whose tag the next word decides.
  const pick0 = lang === "es" ? 0 : 2;
  g.setPicked(pick0, path[pick0]);
  show();
  reset.addEventListener("click", () => { path = startPath.slice(); const [i] = g.picked(); g.setPicked(i, path[i]); show(); g.wrap.querySelector(`.sl-box[data-i="${i}"][data-k="${path[i]}"]`).focus(); });
  const states = CHAINS.flatMap((c) => H.words.map((_, i) => [c.p, i]));
  steadyHeight(out, states, ([p, i]) => { path = p.slice(); g.setPicked(i, path[i]); show(); }, () => [path.slice(), g.picked()[0]]);
}
function glossLine() {
  const G = { PART: tr("particle", "partícula"), ADP: tr("preposition", "preposición"), DET: tr("determiner", "determinante"), PRON: tr("pronoun", "pronombre"), PROPN: tr("proper noun", "nombre propio"), NOUN: tr("noun", "sustantivo"), VERB: tr("verb", "verbo") };
  return R.map((t) => `${code(t)} ${G[t]}`).join(", ");
}

function viterbiFigure() {
  const panel = document.getElementById("fig-viterbi");
  if (!panel) return;
  const out = document.getElementById("fig-viterbi-out");
  // log δ and back-pointers, from the two-decimal logs.
  const d = [R.map((_, k) => (LE(0, k) === null ? null : r2(LT(-1, k) + LE(0, k))))], b = [R.map(() => null)];
  for (let i = 1; i < NW; i++) {
    const di = [], bi = [];
    R.forEach((_, k) => {
      if (LE(i, k) === null) { di.push(null); bi.push(null); return; }
      let bv = -Infinity, bj = null;
      R.forEach((_, j) => { if (d[i - 1][j] === null) return; const v = r2(d[i - 1][j] + LT(j, k)); if (v > bv) { bv = v; bj = j; } });
      di.push(r2(bv + LE(i, k))); bi.push(bj);
    });
    d.push(di); b.push(bi);
  }
  const last = d[NW - 1].map((x) => (x === null ? -Infinity : x)), endK = argmax(last), chain = [endK];
  for (let i = NW - 1; i > 0; i--) chain.unshift(b[i][chain[0]]);
  // Greedy: each column's candidates given its own previous choice.
  const gc = []; let prev = -1;
  for (let i = 0; i < NW; i++) { const cand = R.map((_, k) => (LE(i, k) === null ? null : r2(LT(prev, k) + LE(i, k)))); const pick = argmax(cand.map((x) => (x === null ? -Infinity : x))); gc.push({ cand, pick, prev }); prev = pick; }
  const gchain = gc.map((x) => x.pick);
  let mode = "viterbi";
  panel.append(h("p", "sl-head", ""));
  const head = panel.lastChild;
  const holder = h("div", ""); panel.append(holder);
  const key = h("p", "sl-key"); panel.append(key);
  const g = makeGrid(holder, {
    words: H.words, rows: R, kind: "pick",
    cell: (i, k) => {
      if (LE(i, k) === null) return null;
      if (mode === "viterbi") return { text: n2(d[i][k]), cls: chain[i] === k ? "on" : "", label: `log δ${i + 1}(${R[k]}) ${n2(d[i][k])}` };
      return { text: n2(gc[i].cand[k]), cls: gchain[i] === k ? "on filled" : "", label: `${H.words[i]}, ${R[k]}: ${n2(gc[i].cand[k])}` };
    },
    tags: (i) => R[mode === "viterbi" ? chain[i] : gchain[i]],
    extra: () => {
      const v = n2(mode === "viterbi" ? d[NW - 1][endK] : chainLog(gchain));
      return mode === "viterbi" ? { text: `<span class="sl-xname">${tr("best", "mejor")}</span>${v}`, label: tr(`the best chain's log, ${v}`, `el log de la mejor cadena, ${v}`) }
        : { text: `<span class="sl-xname">${tr("total", "total")}</span>${v}`, label: tr(`the log of the chain chosen one tag at a time, ${v}`, `el log de la cadena con las etiquetas elegidas una por una, ${v}`) };
    },
    edges: () => {
      const es = [];
      if (mode === "viterbi") {
        for (let i = 1; i < NW; i++) R.forEach((_, k) => { if (b[i][k] !== null && chain[i] !== k) es.push({ from: [i - 1, b[i][k]], to: [i, k], cls: "back" }); });
        chain.forEach((k, i) => es.push({ from: i ? [i - 1, chain[i - 1]] : "start", to: [i, k], cls: "path" }));
        es.push({ from: [NW - 1, endK], to: "extra", cls: "path" });
      } else {
        gchain.forEach((k, i) => es.push({ from: i ? [i - 1, gchain[i - 1]] : "start", to: [i, k], cls: "path" }));
        es.push({ from: [NW - 1, gchain[NW - 1]], to: "extra", cls: "path" });
      }
      return es;
    },
    onPick: Object.assign(() => show(), { lastRow: () => (mode === "viterbi" ? endK : gchain[NW - 1]) }),
  });
  function show() {
    head.innerHTML = mode === "viterbi" ? tr("log δ at each box, its back-pointer, and the chain read back", "log δ en cada casilla, su puntero hacia atrás, y la cadena leída de vuelta") : tr("log P(<i>h</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i>−1</sub>) + log P(<i>x</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i></sub>) for each tag, given the one chosen before it", "log P(<i>h</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i>−1</sub>) + log P(<i>x</i><sub><i>i</i></sub> | <i>h</i><sub><i>i</i></sub>) para cada etiqueta, dada la elegida antes");
    panel.setAttribute("aria-label", mode === "viterbi" ? tr("The best chain's log probability at each box, with its back-pointer, and the chain read back", "El log de la probabilidad de la mejor cadena en cada casilla, con su puntero hacia atrás, y la cadena leída de vuelta")
      : tr("Each word's tags, scored given the tag chosen before it, and the chain chosen one tag at a time", "Las etiquetas de cada palabra, puntuadas dada la etiqueta elegida antes, y la cadena con las etiquetas elegidas una por una"));
    key.innerHTML = mode === "viterbi" ? `<span class="sl-ki"><span class="sl-sw back"></span><span>${tr("back-pointer", "puntero hacia atrás")}</span></span><span class="sl-ki"><span class="sl-sw path"></span><span>${tr("the best chain", "la mejor cadena")}</span></span>${dotKey()}` : `<span class="sl-ki"><span class="sl-sw path"></span><span>${tr("the chain chosen one tag at a time", "la cadena con las etiquetas elegidas una por una")}</span></span>${dotKey()}`;
    const [i, k] = g.picked();
    let lbl, eq, says;
    if (mode === "viterbi") {
      if (i === NW) {
        lbl = tr("The best chain's end", "El final de la mejor cadena");
        eq = `<span class="nowrap">max<sub><i>k</i></sub> log δ${sub(NW)}(<i>k</i>) = log δ${sub(NW)}(${code(R[endK])})</span> <span class="nowrap">= ${n2(d[NW - 1][endK])}</span>`;
        says = tr(`Read back along the back-pointers: ${chain.map((kk) => code(R[kk])).join(" ")}.`, `Leída de vuelta por los punteros hacia atrás: ${chain.map((kk) => code(R[kk])).join(" ")}.`);
      } else if (i === 0) {
        lbl = tagAt(0, k);
        eq = `<span class="nowrap">log δ${sub(1)}(${code(R[k])}) = log P(${code(R[k])} | ${tr("start", "inicio")}) + log P(${H.words[0].toLowerCase()} | ${code(R[k])})</span> <span class="nowrap">= ${terms([LT(-1, k), LE(0, k)])}</span> <span class="nowrap">= ${n2(d[0][k])}</span>`;
        const other = R.findIndex((_, kk) => kk !== k && d[0][kk] !== null);
        says = other < 0 ? tr("Only this tag is on offer here.", "Aquí solo se ofrece esta etiqueta.") : d[0][k] > d[0][other]
          ? tr(`It leads the first column, ${n2(d[0][k])} against ${n2(d[0][other])} for ${code(R[other])}.`, `Encabeza la primera columna, ${n2(d[0][k])} contra ${n2(d[0][other])} para ${code(R[other])}.`)
          : tr(`It trails ${code(R[other])}, ${n2(d[0][other])}, in the first column, but the next word may change that.`, `Va detrás de ${code(R[other])}, ${n2(d[0][other])}, en la primera columna, pero la palabra siguiente puede cambiarlo.`);
      } else {
        const js = R.map((_, j) => j).filter((j) => d[i - 1][j] !== null);
        lbl = tagAt(i, k);
        eq = `<span class="nowrap">log δ${sub(i + 1)}(${code(R[k])})</span> ${js.map((j, n) => `<span class="nowrap">${n ? "" : "= max("}${terms([d[i - 1][j], LT(j, k)])}${n === js.length - 1 ? ")" : ","}</span>`).join(" ")} <span class="nowrap">${LE(i, k) < 0 ? MINUS : "+"} ${n2(Math.abs(LE(i, k)))}</span> <span class="nowrap">= ${n2(d[i][k])}</span>`;
        const leader = js.reduce((a, j) => (d[i - 1][j] > d[i - 1][a] ? j : a), js[0]);
        says = js.length < 2 ? tr(`Its back-pointer points to ${code(R[b[i][k]])}, the only tag in the column before.`, `Su puntero hacia atrás apunta a ${code(R[b[i][k]])}, la única etiqueta de la columna anterior.`)
          : b[i][k] === leader ? tr(`Its back-pointer points to ${code(R[b[i][k]])}, which also led the column before.`, `Su puntero hacia atrás apunta a ${code(R[b[i][k]])}, que también encabezaba la columna anterior.`)
          : tr(`${code(R[leader])} led the column before, but ${code(R[k])} follows ${code(R[b[i][k]])} far more often, so its back-pointer points to ${code(R[b[i][k]])}.`, `${code(R[leader])} encabezaba la columna anterior, pero ${code(R[k])} sigue a ${code(R[b[i][k]])} mucho más a menudo, así que su puntero hacia atrás apunta a ${code(R[b[i][k]])}.`);
      }
    } else {
      const ii = Math.min(i, NW - 1), kk = i === NW ? gchain[NW - 1] : k, pv = gc[ii].prev;
      if (i === NW) {
        lbl = tr("The chain chosen one tag at a time", "La cadena con las etiquetas elegidas una por una");
        const ratio = Math.exp(r2(d[NW - 1][endK] - chainLog(gchain)));
        eq = `<span class="nowrap">log P(<i>x</i>, <i>h</i>) = ${n2(chainLog(gchain))}</span>`;
        says = gchain.join() === chain.join() ? tr("The same chain as Viterbi's.", "La misma cadena que la de Viterbi.")
          : tr(`${gchain.map((t) => code(R[t])).join(" ")}: <span class="nowrap"><i>e</i><sup>${n2(r2(d[NW - 1][endK] - chainLog(gchain)))}</sup> ≈ ${localNum(ratio, 0)}</span> times less likely than Viterbi's.`, `${gchain.map((t) => code(R[t])).join(" ")}: <span class="nowrap"><i>e</i><sup>${n2(r2(d[NW - 1][endK] - chainLog(gchain)))}</sup> ≈ ${localNum(ratio, 0)}</span> veces menos probable que la de Viterbi.`);
      } else {
        lbl = tagAt(ii, kk) + (ii ? tr(`, after ${code(R[pv])}`, `, después de ${code(R[pv])}`) : tr(", at the start", ", al comienzo"));
        eq = `<span class="nowrap">log P(${code(R[kk])} | ${ii ? code(R[pv]) : tr("start", "inicio")}) + log P(${H.words[ii].toLowerCase()} | ${code(R[kk])})</span> <span class="nowrap">= ${terms([LT(pv, kk), LE(ii, kk)])}</span> <span class="nowrap">= ${n2(gc[ii].cand[kk])}</span>`;
        const others = R.map((_, t) => t).filter((t) => t !== gc[ii].pick && gc[ii].cand[t] !== null);
        says = others.length ? tr(`It takes ${code(R[gc[ii].pick])} here, ${n2(gc[ii].cand[gc[ii].pick])} against ${others.map((t) => `${n2(gc[ii].cand[t])} for ${code(R[t])}`).join(", ")}, and never looks back.`, `Aquí toma ${code(R[gc[ii].pick])}, ${n2(gc[ii].cand[gc[ii].pick])} contra ${others.map((t) => `${n2(gc[ii].cand[t])} para ${code(R[t])}`).join(", ")}, y nunca vuelve atrás.`)
          : tr(`Only ${code(R[gc[ii].pick])} is on offer here.`, `Aquí solo se ofrece ${code(R[gc[ii].pick])}.`);
      }
    }
    out.innerHTML = `<p class="lbl">${lbl}</p><p class="eq">${eq}</p><p>${says}</p>`;
    g.paint();
  }
  g.setPicked(1, chain[1]);
  show();
  modeButtons(document.getElementById("fig-viterbi-mode"), (m) => { mode = m; show(); });
  const states = ["viterbi", "greedy"].flatMap((m) => [[m, NW, 0], ...H.words.flatMap((_, i) => R.map((_, k) => [m, i, k]).filter(([, , k2]) => LE(i, k2) !== null))]);
  steadyHeight(out, states, ([m, i, k]) => { mode = m; g.setPicked(i, k); show(); }, () => [mode, ...g.picked()]);
  steadyHeight(panel, ["viterbi", "greedy"], (m) => { mode = m; show(); }, () => mode);
}

bioFigure();
headFigure();
scoreFigure();
forwardFigure();
hmmFigure();
viterbiFigure();
