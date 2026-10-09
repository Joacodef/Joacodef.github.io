// Figures of the linear-classifiers note, on the speeches of Don Quixote and Sancho in Don Quijote (the original on
// the Spanish page, Ormsby's translation on the English one): a speech's words with the weights a logistic regression
// learned for them; the speeches piled on the plane of two words with a line between the two speakers; what three
// models make of a score; the loss of one speech; gradient descent on the plane; and a line's three voices.
// Sancho, the class y = 1, is carmine; Don Quixote, y = 0, is ink; lines and w are blue.
import { el, tr, lang, clipLine, modeButtons, makeHandle, makeDraggable, steadyHeight, localNum as fmt } from "../../plane.js";
import { DATA } from "./linear-classifiers-data.js";

const D = DATA[lang];
// A weight or a coordinate of the plane: whole numbers bare, halves with one decimal.
const num = (x) => fmt(x, Number.isInteger(x) ? 0 : 1);
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const NAME = { sancho: "Sancho", dq: tr("Don Quixote", "don Quijote") };

/* ---------- Figure 1: a weight per word ---------- */

function wordsFigure() {
  const panel = document.getElementById("fig-words");
  if (!panel) return;
  const out = document.getElementById("fig-words-out");
  // Each speech's words, once each, with their count and weight; words the model never met weigh 0 and share a row.
  const rowsOf = (S) => {
    const counts = new Map();
    for (const t of S.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    const known = [...counts].filter(([w]) => w in D.weights).map(([w, c]) => ({ w, c, v: Math.round(D.weights[w] * c * 100) / 100 }));
    known.sort((a, b) => b.v - a.v || a.w.localeCompare(b.w, lang));
    const unseen = [...counts.keys()].filter((w) => !(w in D.weights));
    return { known, unseen };
  };
  const scale = Math.max(...D.speeches.flatMap((S) => rowsOf(S).known.map((r) => Math.abs(r.v))), Math.abs(D.model.bias));
  let current = 0;
  const dropped = new Set();
  const bar = (v) => {
    const track = h("span", "lc-track"), b = h("span", `lc-bar ${v >= 0 ? "sp" : "dq"}`);
    const w = (50 * Math.abs(v)) / scale;
    b.style.left = `${v >= 0 ? 50 : 50 - w}%`;
    b.style.width = `${w}%`;
    track.append(b);
    return track;
  };
  function show(k) {
    current = k;
    const S = D.speeches[k], { known, unseen } = rowsOf(S);
    panel.replaceChildren(h("p", "lc-head", tr(`A speech from chapter ${S.label}`, `Un parlamento del capítulo ${S.label}`)), h("p", "lc-quote", lang === "es" ? `«${S.text}»` : `“${S.text}”`));
    const list = h("div", "lc-rows");
    // A key over the bars' column: the left half pushes toward Don Quixote, in ink, the right half toward Sancho, in
    // carmine.
    const key = h("div", "lc-row lc-keyrow");
    key.append(h("span", "lc-word", tr("word", "palabra")), h("span", "lc-keys", `<span><span class="lc-sw dq"></span>${tr("Don Quixote", "Don Quijote")}</span><span>Sancho<span class="lc-sw sp"></span></span>`), h("span", "lc-val", "<i>w</i><sub><i>i</i></sub><i>x</i><sub><i>i</i></sub>"));
    list.append(key);
    for (const r of known) {
      const b = h("button", "lc-row");
      b.type = "button";
      b.setAttribute("aria-pressed", String(!dropped.has(r.w)));
      b.append(h("span", "lc-word", r.c > 1 ? `${r.w} <span class="lc-times">×${r.c}</span>` : r.w), bar(r.v), h("span", "lc-val", fmt(r.v, 2)));
      b.setAttribute("aria-label", tr(`${r.w}, ${r.c > 1 ? `${r.c} times, ` : ""}${fmt(r.v, 2)}${dropped.has(r.w) ? ", taken out" : ""}`, `${r.w}, ${r.c > 1 ? `${r.c} veces, ` : ""}${fmt(r.v, 2)}${dropped.has(r.w) ? ", fuera" : ""}`));
      b.addEventListener("click", () => {
        if (dropped.has(r.w)) dropped.delete(r.w); else dropped.add(r.w);
        show(current);
        panel.querySelectorAll(".lc-row")[known.indexOf(r)]?.focus();
      });
      list.append(b);
    }
    if (unseen.length) {
      const u = h("div", "lc-row lc-still");
      u.append(h("span", "lc-word", unseen.join(", ")), h("span", "lc-note", tr("never met in training", unseen.length === 1 ? "no vista al entrenar" : "no vistas al entrenar")), h("span", "lc-val", "0"));
      list.append(u);
    }
    const bias = h("div", "lc-row lc-still lc-bias");
    bias.append(h("span", "lc-word", tr("bias", "sesgo") + ` <i>w</i><sub>0</sub>`), bar(D.model.bias), h("span", "lc-val", fmt(D.model.bias, 2)));
    list.append(bias);
    panel.append(list);
    // The score: the bias, then what pushes toward Sancho, then what pushes toward Don Quixote.
    const kept = known.filter((r) => !dropped.has(r.w));
    const pos = kept.filter((r) => r.v > 0).reduce((s, r) => s + r.v, 0), neg = kept.filter((r) => r.v < 0).reduce((s, r) => s + r.v, 0);
    const s = Math.round((D.model.bias + pos + neg) * 100) / 100;
    const term = (v) => `${v < 0 ? "−" : "+"} ${fmt(Math.abs(v), 2)}`;
    const says = s === 0
      ? tr("A score of 0: the model cannot tell the two apart.", "Una puntuación de 0: el modelo no distingue a los dos.")
      : (() => {
        const pred = s > 0 ? "sancho" : "dq", right = pred === S.who;
        return tr(`The bias and the weights toward each speaker add up to a ${s > 0 ? "positive" : "negative"} score: the model says ${NAME[pred]}, ${right ? "and" : "but"} ${NAME[S.who]} said it.`,
          `El sesgo y los pesos hacia cada uno suman una puntuación ${s > 0 ? "positiva" : "negativa"}: el modelo dice ${NAME[pred]}, ${right ? "y" : "pero"} lo dijo ${NAME[S.who]}.`);
      })();
    out.innerHTML = `<p class="lbl">${tr("The score", "La puntuación")}</p>` +
      `<p class="eq"><span class="nowrap"><i>s</i> = ${fmt(D.model.bias, 2)} ${term(pos)} ${term(neg)}</span> <span class="nowrap">= ${fmt(s, 2)}</span></p><p>${says}</p>`;
  }
  modeButtons(document.getElementById("fig-words-speeches"), (m) => { dropped.clear(); show(Number(m)); });
  show(0);
  steadyHeight(panel, D.speeches.map((_, k) => k), show, () => current);
}

/* ---------- Figure 2: a line between the two ---------- */

// A plane of counts: whole numbers from 0 to max on both axes, in a frame that starts a little below 0 and ends a
// little past max, so that the piles at 0 stand clear of the axes. Drawn 400 units wide, as createPlane draws, with
// the axes' names and a key to the two colors outside the frame, where neither the piles nor the line reach: the x
// axis's name under its numbers at the right, the y axis's above the axis at the left, and the key above the frame at
// the right. The drawing is PLANE_H units tall.
const PLANE_H = 500;
function countPlane(svg, max, [xName, yName]) {
  const lo = -0.6, hi = max + 0.4, S = 400 / (hi - lo), OX = 34, OY = 446;
  svg.setAttribute("viewBox", `0 0 460 ${PLANE_H}`);
  const X = (x) => OX + S * (x - lo), Y = (y) => OY - S * (y - lo);
  const g = el("g", { class: "axes" }, svg);
  el("line", { x1: OX, y1: OY, x2: X(hi), y2: OY }, g);
  el("line", { x1: OX, y1: OY, x2: OX, y2: Y(hi) }, g);
  for (let v = 0; v <= max; v++) {
    el("line", { x1: X(v), y1: OY, x2: X(v), y2: OY + 6 }, g);
    el("line", { x1: OX, y1: Y(v), x2: OX - 6, y2: Y(v) }, g);
    el("text", { x: X(v), y: OY + 21, "text-anchor": "middle", class: "tick" }, svg).textContent = v;
    el("text", { x: OX - 10, y: Y(v) + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = v;
  }
  axisName(svg, X(hi), OY + 43, "end", xName);
  axisName(svg, OX - 8, Y(hi) - 12, "start", yName);
  colorKey(svg, Y(hi) - 12);
  return { X, Y, lo, hi, el: (tag, attrs) => el(tag, attrs, svg) };
}
// The key: a swatch and a name for each speaker, in one row on the baseline y, at the right; each name has a slot wide
// enough for "Sancho" at the larger size labels take on phones.
function colorKey(svg, y) {
  const key = el("g", { class: "lc-key" }, svg);
  [["sp", "Sancho"], ["dq", tr("Don Quixote", "Don Quijote")]].forEach(([c, name], i) => {
    const x = 222 + 100 * i;
    el("rect", { class: `lc-pile-${c}`, x, y: y - 11, width: 12, height: 12, rx: 2 }, key);
    el("text", { class: "lc-keytext", x: x + 18, y }, key).textContent = name;
  });
}
// The two axes' names on the plane of the two words.
const planeNames = (a, b) => [[tr(`uses of ${q(a)}`, `usos de ${q(a)}`), "x", "1"], [tr(`uses of ${q(b)}`, `usos de ${q(b)}`), "x", "2"]];


// The plane of two words with a line between the two speakers, set by buttons: the direction of w (both words, or one
// of them alone) and the bias. Each pile of speeches is two bars, Sancho's and Don Quixote's; Sancho's side is shaded,
// and w is drawn from the line, perpendicular to it, toward that side.
const DIRS = { both: [1, -1], second: [0, -1], first: [1, 0] };
// An axis name: words in the sans, then a symbol in the serif with its subscript, as the laws-of-text note names its
// axes ("rank r").
function axisName(parent, x, y, anchor, [words, sym, sub]) {
  const t = el("text", { x, y, "text-anchor": anchor, class: "lc-axname" }, parent);
  el("tspan", {}, t).textContent = `${words} `;
  el("tspan", { class: "m" }, t).textContent = sym;
  el("tspan", { class: "m sub", dy: 5 }, t).textContent = sub;
  return t;
}

function lineFigure() {
  const svg = document.getElementById("fig-line");
  if (!svg) return;
  const out = document.getElementById("fig-line-out");
  const [a, b] = D.plane.words, piles = D.plane.piles, max = 7;
  const total = piles.reduce((s, [, , ns, nd]) => s + ns + nd, 0);
  const origin = piles.find(([x, y]) => !x && !y), atOrigin = origin[2] + origin[3];
  const P = countPlane(svg, max, planeNames(a, b));
  // Sancho's side, faintly carmine, under everything else.
  const region = el("polygon", { class: "lc-region" });
  svg.insertBefore(region, svg.firstChild);
  // The piles: two bars standing on the pile's point, Sancho's and Don Quixote's, by the square root of their count.
  const biggest = Math.max(...piles.flatMap(([, , ns, nd]) => [ns, nd]));
  const tall = (n) => (n ? Math.max(3, 44 * Math.sqrt(n / biggest)) : 0);
  const clipId = "fig-line-clip";
  el("rect", { x: P.X(P.lo), y: P.Y(P.hi), width: P.X(P.hi) - P.X(P.lo), height: P.Y(P.lo) - P.Y(P.hi) }, el("clipPath", { id: clipId }, el("defs", null, svg)));
  for (const [x, y, ns, nd] of piles) {
    const g = P.el("g", { class: "lc-pile" }), cx = P.X(x), cy = P.Y(y);
    el("rect", { class: "lc-pile-sp", x: cx - 11, y: cy - tall(ns), width: 10, height: tall(ns) }, g);
    el("rect", { class: "lc-pile-dq", x: cx + 1, y: cy - tall(nd), width: 10, height: tall(nd) }, g);
    el("line", { class: "lc-pile-base", x1: cx - 13, y1: cy, x2: cx + 13, y2: cy }, g);
  }
  const line = P.el("line", { class: "lc-boundary", "clip-path": `url(#${clipId})` });
  const wLine = P.el("line", { class: "lc-w" }), wHead = P.el("polygon", { class: "lc-w-head" });
  const wLab = P.el("text", { class: "lc-lab", "text-anchor": "middle" });
  let dir = "both", w0 = -0.5;
  // Sancho's side of the frame: the square cut by the half-plane s > 0.
  function sanchoSide(score) {
    const sq = [[P.lo, P.lo], [P.hi, P.lo], [P.hi, P.hi], [P.lo, P.hi]], poly = [];
    sq.forEach((p, i) => {
      const r = sq[(i + 1) % 4], fp = score(...p), fr = score(...r);
      if (fp > 0) poly.push(p);
      if ((fp > 0) !== (fr > 0)) { const t = fp / (fp - fr); poly.push([p[0] + t * (r[0] - p[0]), p[1] + t * (r[1] - p[1])]); }
    });
    return poly.map(([x, y]) => `${P.X(x)},${P.Y(y)}`).join(" ");
  }
  function update() {
    const [w1, w2] = DIRS[dir], score = (x, y) => w0 + w1 * x + w2 * y;
    const seg = clipLine([w1, w2, w0], P.lo, P.hi);
    line.setAttribute("x1", P.X(seg[0][0])); line.setAttribute("y1", P.Y(seg[0][1])); line.setAttribute("x2", P.X(seg[1][0])); line.setAttribute("y2", P.Y(seg[1][1]));
    region.setAttribute("points", sanchoSide(score));
    // w starts on the line, at the point nearest the middle of the frame, and points to Sancho's side; where the frame
    // ends first, the arrow slides back along itself so that its head stays inside.
    const c = (P.lo + P.hi) / 2, n2 = w1 * w1 + w2 * w2, t = -score(c, c) / n2;
    let x1 = P.X(c + t * w1), y1 = P.Y(c + t * w2);
    const n = Math.hypot(w1, w2), ux = w1 / n, uy = -w2 / n, L = 46;
    const room = Math.min(...[[ux, P.X(P.hi) - 10 - x1, x1 - P.X(P.lo) - 10], [uy, P.Y(P.lo) - 10 - y1, y1 - P.Y(P.hi) - 10]].map(([u, ahead, behind]) => (u > 1e-9 ? ahead / u : u < -1e-9 ? behind / -u : Infinity)));
    const back = Math.max(0, L - room);
    x1 -= back * ux; y1 -= back * uy;
    const x2 = x1 + L * ux, y2 = y1 + L * uy;
    wLine.setAttribute("x1", x1); wLine.setAttribute("y1", y1); wLine.setAttribute("x2", x2 - 9 * ux); wLine.setAttribute("y2", y2 - 9 * uy);
    wHead.setAttribute("points", `${x2},${y2} ${x2 - 13 * ux - 6 * uy},${y2 - 13 * uy + 6 * ux} ${x2 - 13 * ux + 6 * uy},${y2 - 13 * uy - 6 * ux}`);
    // Its label beside it, halfway along, or past the line when the arrow had to slide back across it.
    const along = Math.min(L - 6, Math.max(L / 2, back + 16)), mx = x1 + along * ux, my = y1 + along * uy;
    let lx = mx + 16 * uy, ly = my - 16 * ux;
    if (lx < P.X(P.lo) + 10 || lx > P.X(P.hi) - 10 || ly < P.Y(P.hi) + 14 || ly > P.Y(P.lo) - 10) { lx = mx - 16 * uy; ly = my + 16 * ux; }
    wLab.setAttribute("x", lx); wLab.setAttribute("y", ly + 5);
    wLab.textContent = "w";
    const right = piles.reduce((s, [x, y, ns, nd]) => { const v = score(x, y); return s + (v > 0 ? ns : v < 0 ? nd : 0); }, 0);
    // The score with the chosen weights: a weight of 0 drops its term, a weight of ±1 shows the word's count alone.
    const formula = (x1s, x2s) => {
      const parts = w0 ? [num(w0)] : [];
      for (const [wt, sym] of [[w1, x1s], [w2, x2s]]) if (wt) parts.push(parts.length ? `${wt < 0 ? "−" : "+"} ${sym}` : `${wt < 0 ? "−" : ""}${sym}`);
      return parts.join(" ");
    };
    const s = `<span class="nowrap"><i>s</i> = ${formula("<i>x</i><sub>1</sub>", "<i>x</i><sub>2</sub>")}</span>`;
    const where = w0 > 0 ? tr("on Sancho's side", "del lado de Sancho") : w0 < 0 ? tr("on Don Quixote's side", "del lado de don Quijote") : tr("on the line itself, on neither side", "sobre la recta misma, en ningún lado");
    out.innerHTML = `<p class="lbl">${tr("The score and its line", "La puntuación y su recta")}</p><p class="eq">${s}</p>` +
      `<p>${tr(`The line <span class="nowrap"><i>s</i> = 0</span> leaves ${fmt(right)} of the ${fmt(total)} speeches on their speaker's side, and the ${fmt(atOrigin)} with neither word, where <span class="nowrap"><i>s</i> = ${num(w0)}</span>, ${where}.`,
        `La recta <span class="nowrap"><i>s</i> = 0</span> deja ${fmt(right)} de los ${fmt(total)} parlamentos del lado de quien los dijo, y los ${fmt(atOrigin)} sin ninguna de las dos palabras, donde <span class="nowrap"><i>s</i> = ${num(w0)}</span>, ${where}.`)}</p>`;
    svg.setAttribute("aria-label", tr(`The speeches piled at their counts of ${q(a)} and ${q(b)}, and the line ${formula("x1", "x2")} = 0 between the two speakers`,
      `Los parlamentos amontonados según sus conteos de ${q(a)} y ${q(b)}, y la recta ${formula("x1", "x2")} = 0 entre los dos`));
  }
  modeButtons(document.getElementById("fig-line-dir"), (m) => { dir = m; update(); });
  modeButtons(document.getElementById("fig-line-bias"), (m) => { w0 = Number(m); update(); });
  update();
}

/* ---------- Charts for figures 3 to 5 ---------- */

const theta = (s) => 1 / (1 + Math.exp(-s));
// log(1 + e^z) without overflow: the loss of a score s is softplus(−s) for Sancho's speeches, softplus(s) for Don
// Quixote's.
const softplus = (z) => Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z)));
// A name in parts: words in the sans, and symbols in the serif, italic ("m"), upright ("r") or as an italic
// subscript ("sub"), as in "loss −log p".
function nameText(parent, x, y, anchor, parts, cls = "lc-axname") {
  const t = el("text", { x, y, "text-anchor": anchor, class: cls }, parent);
  let low = false;
  for (const [s, kind] of parts) {
    const a = kind ? { class: kind === "sub" ? "m sub" : kind } : {};
    if ((kind === "sub") !== low) { a.dy = kind === "sub" ? 5 : -5; low = !low; }
    el("tspan", a, t).textContent = s;
  }
  return t;
}
// A chart: data x from x0 to x1 and y from y0 to y1, in the SVG rectangle from L to R and from T to B, with its two
// axis lines; ticks are added one by one.
function chart(parent, { L, R, T, B, x0, x1, y0, y1 }) {
  const X = (x) => L + ((x - x0) / (x1 - x0)) * (R - L), Y = (y) => B - ((y - y0) / (y1 - y0)) * (B - T);
  const g = el("g", { class: "axes" }, parent);
  el("line", { x1: L, y1: B, x2: R, y2: B }, g);
  el("line", { x1: L, y1: T, x2: L, y2: B }, g);
  return {
    X, Y, L, R, T, B, x0, x1, y0, y1,
    xTick: (v, text = num(v)) => { el("line", { x1: X(v), y1: B, x2: X(v), y2: B + 6 }, g); el("text", { x: X(v), y: B + 21, "text-anchor": "middle", class: "tick" }, parent).textContent = text; },
    yTick: (v, text = num(v)) => { el("line", { x1: L, y1: Y(v), x2: L - 6, y2: Y(v) }, g); el("text", { x: L - 10, y: Y(v) + 4.5, "text-anchor": "end", class: "tick" }, parent).textContent = text; },
    toX: (sx) => x0 + ((sx - L) / (R - L)) * (x1 - x0),
  };
}
const curve = (C, f, from, to, n = 160) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n).map((x) => `${C.X(x).toFixed(1)},${C.Y(f(x)).toFixed(1)}`).join(" ");
// A probability as the readouts write it: two decimals, or three when two would round it to 0 or 1.
const prob = (p) => fmt(p, p < 0.005 || p > 0.995 ? 3 : 2);

/* ---------- Figure 3: from a score to a probability ---------- */

// Three charts over the same scores, from −6 to 6, stacked so that one vertical line crosses all three: the
// perceptron's step, linear regression's identity and the logistic curve. The red point rides the logistic; the step's
// value at the same score is drawn in the color of the speaker it names, the identity's in the blue of its line.
function thetaFigure() {
  const svg = document.getElementById("fig-theta");
  if (!svg) return;
  const out = document.getElementById("fig-theta-out");
  svg.setAttribute("viewBox", "0 0 460 500");
  const L = 70, R = 440, H = 84, T0 = 44, GAP = 142;
  const guide = el("line", { class: "lc-guide", y1: T0 - 6, y2: T0 + 2 * GAP + H }, svg);
  const PANELS = [
    { name: [[tr("Perceptron: decision", "Perceptrón: decisión")]], y0: 0, y1: 1, ticks: [0, 1], f: (s) => (s > 0 ? 1 : 0) },
    { name: [[tr("Linear regression: score ", "Regresión lineal: puntuación ")], ["s", "m"]], y0: -6, y1: 6, ticks: [-6, 0, 6], f: (s) => s },
    { name: [[tr("Logistic regression: probability ", "Regresión logística: probabilidad ")], ["h", "m"]], y0: 0, y1: 1, ticks: [0, 0.5, 1], f: theta },
  ];
  const charts = PANELS.map((p, i) => {
    const T = T0 + i * GAP, C = chart(svg, { L, R, T, B: T + H, x0: -6, x1: 6, y0: p.y0, y1: p.y1 });
    p.ticks.forEach((v) => C.yTick(v));
    nameText(svg, L - 8, T - 22, "start", p.name);
    return C;
  });
  const [step, ident, logi] = charts;
  // The step, as two flat pieces: Don Quixote's below 0, Sancho's above, each named.
  el("line", { class: "lc-fn", x1: step.X(-6), y1: step.Y(0), x2: step.X(0), y2: step.Y(0) }, svg);
  el("line", { class: "lc-fn", x1: step.X(0), y1: step.Y(1), x2: step.X(6), y2: step.Y(1) }, svg);
  el("text", { class: "lc-curvename", x: step.X(-5.6), y: step.Y(0) - 9 }, svg).textContent = tr("Don Quixote", "Don Quijote");
  el("text", { class: "lc-curvename", x: step.X(5.6), y: step.Y(1) + 21, "text-anchor": "end" }, svg).textContent = "Sancho";
  // The identity, with its 0 marked by a faint line.
  el("line", { class: "lc-zero", x1: ident.L, y1: ident.Y(0), x2: ident.R, y2: ident.Y(0) }, svg);
  el("polyline", { class: "lc-fn", points: curve(ident, (s) => s, -6, 6, 1) }, svg);
  el("polyline", { class: "lc-fn", points: curve(logi, theta, -6, 6) }, svg);
  for (let v = -6; v <= 6; v += 2) logi.xTick(v);
  nameText(svg, R, logi.B + 43, "end", [[tr("score ", "puntuación ")], ["s", "m"]]);
  const dots = [step, ident].map(() => el("circle", { class: "lc-out", r: 5 }, svg));
  const handle = makeHandle(svg, "point");
  let s = 2;
  const set = (v) => { s = Math.max(-6, Math.min(6, Math.round(v * 2) / 2)); update(); };
  makeDraggable(handle, { move: (p) => set(logi.toX(p.x)), step: ([dx, dy]) => set(s + (dx || dy) / 2) });
  function update() {
    const h = theta(s), x = logi.X(s);
    handle.setAttribute("transform", `translate(${x},${logi.Y(h)})`);
    guide.setAttribute("x1", x); guide.setAttribute("x2", x);
    [step, ident].forEach((C, i) => { dots[i].setAttribute("cx", x); dots[i].setAttribute("cy", C.Y(PANELS[i].f(s))); });
    dots[0].setAttribute("visibility", s === 0 ? "hidden" : "visible");
    dots[0].setAttribute("class", `lc-out ${s > 0 ? "sp" : "dq"}`);
    handle.setAttribute("aria-label", tr(`Score s = ${num(s)}. Use the arrow keys to move it.`, `Puntuación s = ${num(s)}. Usa las flechas para moverla.`));
    const says = s === 0
      ? tr("The step cannot decide, and the logistic gives each speaker 0.5.", "El escalón no puede decidir, y la logística le da 0.5 a cada uno.")
      : s > 0
        ? tr(`The step only says Sancho; the logistic gives him ${prob(h)}, and Don Quixote ${prob(1 - h)}.`, `El escalón solo dice Sancho; la logística le da ${prob(h)}, y a don Quijote ${prob(1 - h)}.`)
        : tr(`The step only says Don Quixote; the logistic gives him ${prob(1 - h)}, and Sancho ${prob(h)}.`, `El escalón solo dice don Quijote; la logística le da ${prob(1 - h)}, y a Sancho ${prob(h)}.`);
    out.innerHTML = `<p class="lbl">${tr("The probability of Sancho", "La probabilidad de Sancho")}</p>` +
      `<p class="eq"><span class="nowrap">θ(${num(s)}) = <span class="frac"><span>1</span><span>1 + <i>e</i><sup>${num(-s)}</sup></span></span></span> <span class="nowrap">≈ ${prob(h)}</span></p><p>${says}</p>`;
  }
  update();
}

/* ---------- Figure 4: how wrong a probability is ---------- */

// The loss of one speech, −log p, against the probability h that the model gives Sancho: for a speech of Sancho's,
// p = h (carmine); for one of Don Quixote's, p = 1 − h (ink). The red point sets h on its axis, as Sancho's
// probability; the loss it gives is the dot on the curve of whoever spoke, in that speaker's color.
function lossFigure() {
  const svg = document.getElementById("fig-loss");
  if (!svg) return;
  const out = document.getElementById("fig-loss-out");
  svg.setAttribute("viewBox", "0 0 460 400");
  const C = chart(svg, { L: 70, R: 440, T: 44, B: 350, x0: 0, x1: 1, y0: 0, y1: 4 });
  [0, 0.5, 1].forEach((v) => C.xTick(v));
  [0, 1, 2, 3, 4].forEach((v) => C.yTick(v));
  nameText(svg, C.R, C.B + 43, "end", [[tr("probability of Sancho ", "probabilidad de Sancho ")], ["h", "m"]]);
  nameText(svg, C.L - 8, C.T - 22, "start", [[tr("loss ", "pérdida ")], ["−log ", "r"], ["p", "m"]]);
  const guides = el("path", { class: "lc-guide" }, svg);
  // Each curve runs up to the top of the chart, a loss of 4, which it reaches at h = e^−4 from its steep end.
  const edge = Math.exp(-4);
  const curves = {
    sancho: el("polyline", { class: "lc-fn sp", points: curve(C, (h) => -Math.log(h), edge, 1) }, svg),
    dq: el("polyline", { class: "lc-fn dq", points: curve(C, (h) => -Math.log(1 - h), 0, 1 - edge) }, svg),
  };
  // Each curve's name sits beside its steep end, at a loss of 2.6.
  const at = Math.exp(-2.6);
  const names = {
    sancho: el("text", { class: "lc-curvename", x: C.X(at) + 14, y: C.Y(2.6) + 5 }, svg),
    dq: el("text", { class: "lc-curvename", x: C.X(1 - at) - 14, y: C.Y(2.6) + 5, "text-anchor": "end" }, svg),
  };
  names.sancho.textContent = tr("Sancho spoke", "Habló Sancho");
  names.dq.textContent = tr("Don Quixote spoke", "Habló don Quijote");
  const dot = el("circle", { class: "lc-out", r: 5.5 }, svg);
  const handle = makeHandle(svg, "point");
  let h = 0.8, who = "sancho";
  // h stays between 0.02 and 0.98, where both losses stay under the top of the chart.
  const set = (v) => { h = Math.max(0.02, Math.min(0.98, Math.round(v * 100) / 100)); update(); };
  makeDraggable(handle, { move: (p) => set(C.toX(p.x)), step: ([dx, dy]) => set(h + (dx || dy) / 100) });
  function update() {
    const p = who === "sancho" ? h : Math.round((1 - h) * 100) / 100, loss = -Math.log(p);
    for (const k of ["sancho", "dq"]) { curves[k].classList.toggle("faint", k !== who); names[k].classList.toggle("faint", k !== who); }
    const x = C.X(h), y = C.Y(loss);
    handle.setAttribute("transform", `translate(${x},${C.B})`);
    dot.setAttribute("cx", x); dot.setAttribute("cy", y);
    dot.setAttribute("class", `lc-out ${who === "sancho" ? "sp" : "dq"}`);
    guides.setAttribute("d", `M${x},${C.B} V${y} H${C.L}`);
    handle.setAttribute("aria-label", tr(`The model gives Sancho h = ${fmt(h, 2)}. Use the arrow keys to move it.`, `El modelo le da a Sancho h = ${fmt(h, 2)}. Usa las flechas para moverla.`));
    const says = p === 0.5
      ? tr("The model is undecided: the loss is log 2.", "El modelo está indeciso: la pérdida es log 2.")
      : p > 0.5
        ? tr("The model leans to whoever spoke; the surer it is, the closer the loss comes to 0.", "El modelo se inclina por quien habló; cuanto más seguro, más cerca de 0 queda la pérdida.")
        : tr("The model leans to the other speaker; the surer it is, the larger the loss, without bound.", "El modelo se inclina por el otro; cuanto más seguro, mayor la pérdida, sin límite.");
    out.innerHTML = `<p class="lbl">${who === "sancho" ? tr("Sancho spoke, so <i>p</i> = <i>h</i>", "Habló Sancho, así que <i>p</i> = <i>h</i>") : tr("Don Quixote spoke, so <i>p</i> = 1 − <i>h</i>", "Habló don Quijote, así que <i>p</i> = 1 − <i>h</i>")}</p>` +
      `<p class="eq"><span class="nowrap">−log <i>p</i> = −log ${fmt(p, 2)}</span> <span class="nowrap">≈ ${fmt(loss, 2)}</span></p><p>${says}</p>`;
  }
  modeButtons(document.getElementById("fig-loss-who"), (m) => { who = m; update(); });
  update();
}

/* ---------- Figure 5: learning the weights ---------- */

// Gradient descent on the plane of figure 2, from w = 0: the line after each step over the piles, and below them the
// loss step by step, with a dashed line at the lowest loss the plane allows. Each learning rate's thirty steps are
// computed when it is chosen, and the chart's height fits the highest loss among them, so it never rescales mid-run.
function descentFigure() {
  const svg = document.getElementById("fig-descent");
  if (!svg) return;
  const out = document.getElementById("fig-descent-out");
  const [a, b] = D.plane.words, piles = D.plane.piles, max = 7, STEPS = 30;
  const total = piles.reduce((s, [, , ns, nd]) => s + ns + nd, 0);
  const P = countPlane(svg, max, planeNames(a, b));
  // The loss chart's frame, under the plane.
  const LT = PLANE_H + 30, LB = LT + 90;
  svg.setAttribute("viewBox", `0 0 460 ${LB + 52}`);
  const region = el("polygon", { class: "lc-region" });
  svg.insertBefore(region, svg.firstChild);
  const biggest = Math.max(...piles.flatMap(([, , ns, nd]) => [ns, nd]));
  const tall = (n) => (n ? Math.max(3, 44 * Math.sqrt(n / biggest)) : 0);
  for (const [x, y, ns, nd] of piles) {
    const g = P.el("g", { class: "lc-pile" }), cx = P.X(x), cy = P.Y(y);
    el("rect", { class: "lc-pile-sp", x: cx - 11, y: cy - tall(ns), width: 10, height: tall(ns) }, g);
    el("rect", { class: "lc-pile-dq", x: cx + 1, y: cy - tall(nd), width: 10, height: tall(nd) }, g);
    el("line", { class: "lc-pile-base", x1: cx - 13, y1: cy, x2: cx + 13, y2: cy }, g);
  }
  const clipId = "fig-descent-clip";
  el("rect", { x: P.X(P.lo), y: P.Y(P.hi), width: P.X(P.hi) - P.X(P.lo), height: P.Y(P.lo) - P.Y(P.hi) }, el("clipPath", { id: clipId }, el("defs", null, svg)));
  const line = P.el("line", { class: "lc-boundary", "clip-path": `url(#${clipId})` });

  const loss = (w) => piles.reduce((L, [x, y, ns, nd]) => { const s = w[0] + w[1] * x + w[2] * y; return L + ns * softplus(-s) + nd * softplus(s); }, 0) / total;
  const grad = (w) => piles.reduce((g, [x, y, ns, nd]) => { const h = theta(w[0] + w[1] * x + w[2] * y), e = ns * (h - 1) + nd * h; return [g[0] + e / total, g[1] + (e * x) / total, g[2] + (e * y) / total]; }, [0, 0, 0]);
  const right = (w) => piles.reduce((s, [x, y, ns, nd]) => { const v = w[0] + w[1] * x + w[2] * y; return s + (v > 0 ? ns : v < 0 ? nd : 0); }, 0);
  // The lowest loss on these two words, reached by many small steps.
  let wBest = [0, 0, 0];
  for (let k = 0; k < 20000; k++) { const g = grad(wBest); wBest = wBest.map((v, i) => v - g[i]); }
  const lowest = loss(wBest);
  const runs = new Map();
  const run = (eta) => {
    if (!runs.has(eta)) {
      const ws = [[0, 0, 0]];
      for (let k = 1; k <= STEPS; k++) { const w = ws[k - 1], g = grad(w); ws.push(w.map((v, i) => v - eta * g[i])); }
      runs.set(eta, { ws, losses: ws.map(loss) });
    }
    return runs.get(eta);
  };
  // The loss chart, redrawn when the learning rate changes.
  const lossG = el("g", null, svg);
  let C, lossLine, lossDot;
  function lossChart(losses) {
    lossG.replaceChildren();
    const top = Math.max(0.8, Math.ceil(Math.max(...losses) * 10) / 10);
    C = chart(lossG, { L: 70, R: 440, T: LT, B: LB, x0: 0, x1: STEPS, y0: 0.4, y1: top });
    [0, 10, 20, 30].forEach((v) => C.xTick(v));
    [0.4, top].forEach((v) => C.yTick(v, fmt(v, 1)));
    nameText(lossG, C.R, C.B + 43, "end", [[tr("step", "paso")]]);
    nameText(lossG, C.L - 8, C.T - 18, "start", [[tr("loss ", "pérdida ")], ["ℒ", "r"]]);
    el("line", { class: "lc-lowest", x1: C.L, x2: C.R, y1: C.Y(lowest), y2: C.Y(lowest) }, lossG);
    const yl = C.Y(lowest), below = yl + 18 < C.B - 4;
    el("text", { class: "lc-curvename", x: C.R, y: below ? yl + 18 : yl - 7, "text-anchor": "end" }, lossG).textContent = tr(`lowest, ${fmt(lowest, 3)}`, `mínima, ${fmt(lowest, 3)}`);
    lossLine = el("polyline", { class: "lc-fn" }, lossG);
    lossDot = el("circle", { class: "lc-out", r: 4.5 }, lossG);
  }
  let eta = 5, k = 0;
  const $ = (s) => document.getElementById(`fig-descent-${s}`);
  const nextBtn = $("next"), backBtn = $("back"), resetBtn = $("reset"), count = $("count");
  function sanchoSide(w) {
    const sq = [[P.lo, P.lo], [P.hi, P.lo], [P.hi, P.hi], [P.lo, P.hi]], f = ([x, y]) => w[0] + w[1] * x + w[2] * y, poly = [];
    sq.forEach((p, i) => {
      const r = sq[(i + 1) % 4], fp = f(p), fr = f(r);
      if (fp > 0) poly.push(p);
      if ((fp > 0) !== (fr > 0)) { const t = fp / (fp - fr); poly.push([p[0] + t * (r[0] - p[0]), p[1] + t * (r[1] - p[1])]); }
    });
    return poly.map(([x, y]) => `${P.X(x)},${P.Y(y)}`).join(" ");
  }
  function update() {
    const { ws, losses } = run(eta), w = ws[k];
    const seg = w[1] || w[2] ? clipLine([w[1], w[2], w[0]], P.lo, P.hi) : null;
    line.setAttribute("visibility", seg ? "visible" : "hidden");
    if (seg) { line.setAttribute("x1", P.X(seg[0][0])); line.setAttribute("y1", P.Y(seg[0][1])); line.setAttribute("x2", P.X(seg[1][0])); line.setAttribute("y2", P.Y(seg[1][1])); }
    region.setAttribute("points", k ? sanchoSide(w) : "");
    lossLine.setAttribute("points", losses.slice(0, k + 1).map((L, i) => `${C.X(i).toFixed(1)},${C.Y(L).toFixed(1)}`).join(" "));
    lossDot.setAttribute("cx", C.X(k)); lossDot.setAttribute("cy", C.Y(losses[k]));
    // The controls, as in the site's other step-by-step figures: Back and Next stop at the ends, Reset appears at the
    // last step. A button that gets disabled hands the focus on, to Reset at the end and to Next at the start.
    count.textContent = tr(`${k} of ${STEPS} steps`, `${k} de ${STEPS} pasos`);
    const focused = document.activeElement;
    backBtn.disabled = k === 0;
    nextBtn.disabled = k === STEPS;
    resetBtn.hidden = k !== STEPS;
    if (focused === nextBtn && nextBtn.disabled) resetBtn.focus();
    if (focused === backBtn && backBtn.disabled) nextBtn.focus();
    if (!k) {
      out.innerHTML = `<p class="lbl">${tr(`The weights at the start, η = ${num(eta)}`, `Los pesos al empezar, η = ${num(eta)}`)}</p><p class="eq"><span class="nowrap"><i>w</i> = (0, 0, 0)</span></p>` +
        `<p>${tr(`The loss starts at log 2 ≈ ${fmt(losses[0], 3)}.`, `La pérdida parte en log 2 ≈ ${fmt(losses[0], 3)}.`)}</p>`;
      return;
    }
    const vec = `(${w.map((v) => fmt(Math.round(v * 100) / 100 + 0, 2)).join(", ")})`;
    const [was, now] = [losses[k - 1], losses[k]].map((L) => fmt(L, 3)), kept = tr(`the line leaves ${fmt(right(w))} of the ${fmt(total)} speeches on their speaker's side`, `la recta deja ${fmt(right(w))} de los ${fmt(total)} parlamentos del lado de quien los dijo`);
    out.innerHTML = `<p class="lbl">${tr(`Step ${k}, η = ${num(eta)}`, `Paso ${k}, η = ${num(eta)}`)}</p>` +
      `<p class="eq"><span class="nowrap"><i>w</i> ← <i>w</i> − η∇ℒ(<i>w</i>)</span> <span class="nowrap">= ${vec}</span></p>` +
      `<p>${losses[k] > losses[k - 1] && was !== now
        ? tr(`The loss goes up, from ${was} to ${now}: the step went past the minimum.`, `La pérdida sube, de ${was} a ${now}: el paso pasó de largo el mínimo.`)
        : was === now
          ? tr(`The loss stays at ${now}, and ${kept}.`, `La pérdida se queda en ${now}, y ${kept}.`)
          : tr(`The loss goes from ${was} to ${now}, and ${kept}.`, `La pérdida va de ${was} a ${now}, y ${kept}.`)}</p>`;
  }
  const go = (d) => { const j = Math.max(0, Math.min(STEPS, k + d)); if (j !== k) { k = j; update(); } };
  nextBtn.addEventListener("click", () => go(1));
  backBtn.addEventListener("click", () => go(-1));
  resetBtn.addEventListener("click", () => { k = 0; update(); nextBtn.focus(); });
  svg.closest(".fig").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  modeButtons($("eta"), (m) => { eta = Number(m); k = 0; lossChart(run(eta).losses); update(); });
  lossChart(run(eta).losses);
  update();
}

/* ---------- Figure 6: three voices ---------- */

// A line's three scores and the probabilities the softmax makes of them, one row per voice: the narrator's bar is
// green, Don Quixote's ink and Sancho's carmine.
function voicesFigure() {
  const panel = document.getElementById("fig-voices");
  if (!panel) return;
  const out = document.getElementById("fig-voices-out");
  const V = D.voices, K = V.classes;
  const NAMES = { narrator: tr("Narrator", "Narrador"), dq: tr("Don Quixote", "Don Quijote"), sancho: "Sancho" };
  // Each voice as the readout names it; Spanish needs it after "de" and "a" too, where "el narrador" contracts.
  const WHO = { narrator: tr("the narrator", "el narrador"), dq: NAME.dq, sancho: "Sancho" };
  const OF = { narrator: "del narrador", dq: "de don Quijote", sancho: "de Sancho" }, TO = { narrator: "al narrador", dq: "a don Quijote", sancho: "a Sancho" };
  const CLS = { narrator: "nr", dq: "dq", sancho: "sp" };
  let current = 0;
  function show(i) {
    current = i;
    const L = V.lines[i], counts = new Map();
    for (const t of L.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    // Each score to two decimals, as the readout writes it, and the probabilities from those.
    const s = K.map((_, k) => Math.round((V.bias[k] + [...counts].reduce((acc, [w, c]) => acc + (V.weights[w]?.[k] ?? 0) * c, 0)) * 100) / 100);
    const top = Math.max(...s), e = s.map((v) => Math.exp(v - top)), z = e.reduce((x, y) => x + y, 0), p = e.map((v) => v / z);
    panel.replaceChildren(h("p", "lc-head", tr(`A line from chapter ${L.label}`, `Una línea del capítulo ${L.label}`)), h("p", "lc-quote", lang === "es" ? `«${L.text}»` : `“${L.text}”`));
    const rows = h("div", "lc-vrows");
    const head = h("div", "lc-vrow lc-vhead");
    head.append(h("span", "lc-vname", tr("voice", "voz")), h("span", "lc-vs", `${tr("score", "puntuación")} <i>s</i><sub><i>k</i></sub>`), h("span", "lc-vtrack", tr("probability", "probabilidad")), h("span", "lc-vp", "<i>p</i><sub><i>k</i></sub>"));
    rows.append(head);
    K.forEach((c, k) => {
      const r = h("div", "lc-vrow"), track = h("span", "lc-vtrack"), bar = h("span", `lc-vbar ${CLS[c]}`);
      bar.style.width = `${100 * p[k]}%`;
      track.append(bar);
      r.append(h("span", "lc-vname", `<span class="lc-sw ${CLS[c]}"></span>${NAMES[c]}`), h("span", "lc-vs", fmt(s[k], 2)), track, h("span", "lc-vp", prob(p[k])));
      rows.append(r);
    });
    panel.append(rows);
    const best = p.indexOf(Math.max(...p)), sum = s.map((v) => `<i>e</i><sup>${fmt(v, 2)}</sup>`).join(" + ");
    const said = K[best] === L.who
      ? tr(`The model says ${WHO[K[best]]}, and rightly.`, `El modelo se la atribuye ${TO[K[best]]}, y acierta.`)
      : tr(`The model says ${WHO[K[best]]}, but ${WHO[L.who]} said it.`, `El modelo se la atribuye ${TO[K[best]]}, pero la dijo ${WHO[L.who]}.`);
    out.innerHTML = `<p class="lbl">${tr(`The probability of ${WHO[K[best]]}`, `La probabilidad ${OF[K[best]]}`)}</p>` +
      `<p class="eq"><span class="nowrap"><i>p</i> = <span class="frac"><span><i>e</i><sup>${fmt(s[best], 2)}</sup></span><span>${sum}</span></span></span> <span class="nowrap">≈ ${prob(p[best])}</span></p><p>${said}</p>`;
  }
  modeButtons(document.getElementById("fig-voices-lines"), (m) => show(Number(m)));
  show(0);
  steadyHeight(panel, V.lines.map((_, i) => i), show, () => current);
}

wordsFigure();
lineFigure();
thetaFigure();
lossFigure();
descentFigure();
voicesFigure();
