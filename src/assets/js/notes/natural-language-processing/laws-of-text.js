// Figures of the laws-of-text note, on the words of Don Quijote: rank times frequency (Zipf's law), the least squares
// line in log–log, the vocabulary as the book goes on (Heaps' law), and the words seen once. The English page counts
// John Ormsby's translation and the Spanish page the original; laws-of-text-data.js holds both.
import { el, tr, lang, makeHandle, makeDraggable, logChart, linChart } from "../../plane.js";
import { BOOKS } from "./laws-of-text-data.js";

const book = BOOKS[lang];
const other = BOOKS[lang === "es" ? "en" : "es"];
const WORDS = book.words.split(" ");
const TOP = WORDS.length;

/* ---------- Numbers and words ---------- */

// Thousands with a comma in English; in Spanish, a non-breaking space from five digits on (10 000) and none below.
const num = (n) => (lang === "es" ? (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") : String(n)) : n.toLocaleString("en-US"));
const dec = (x, d = 2) => x.toFixed(d).replace("-", "−");
const quote = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const hat = (s) => `<span class="hat${s === "α" ? " lo" : ""}"><i>${s}</i></span>`;

// The run of equal frequency that holds a rank: [frequency, first rank, last rank], and its index.
function runOf(r) {
  let lo = 0, hi = book.runs.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (book.runs[m][2] < r) lo = m + 1; else hi = m; }
  return lo;
}
const freq = (r) => book.runs[runOf(r)][0];
// Past the top ranks the page knows only the run, so a word there stands for all the words of its run.
function wordAt(r) {
  if (r <= TOP) return WORDS[r - 1];
  const i = runOf(r), first = book.runs.findIndex(([, a]) => a > TOP);
  return book.examples[i - first];
}

/* ---------- Charts ---------- */

// An axis name: a word in the sans and its symbol in the serif, with an optional subscript.
function axisName(svg, x, y, anchor, [word, sym, sub]) {
  const t = el("text", { x, y, "text-anchor": anchor, class: "lt-axname" }, svg);
  el("tspan", {}, t).textContent = `${word} `;
  el("tspan", { class: "m" }, t).textContent = sym;
  if (sub) el("tspan", { class: "m sub", dy: 5 }, t).textContent = sub;
}
function clipTo(svg, id, L, R, T, B) {
  const cp = el("clipPath", { id }, el("defs", {}, svg));
  el("rect", { x: L, y: T, width: R - L, height: B - T }, cp);
  return `url(#${id})`;
}

// Both axes run from 0.6 to `max` on a logarithmic scale (plane.js's logChart), labeled at the powers of ten from 1,
// with short ticks at their multiples. Starting a little below 1 keeps the words seen once off the axis line.
function logAxes(svg, { max, xName, yName }) {
  const C = logChart(svg, { x: [0.6, max], y: [0.6, max], box: [64, 446, 22, 390], size: [460, 440], xLabel: num, yLabel: num });
  axisName(svg, C.R, C.B + 43, "end", xName);
  axisName(svg, C.L - 8, C.T - 6, "start", yName);
  return C;
}

// Linear axes from 0 to xMax and yMax, with labeled ticks every xStep and yStep. The top tick sits at the top of the
// plot, so the y axis's name goes higher than on the log charts, clear of its label.
function linAxes(svg, { xMax, yMax, xStep, yStep, xName, yName, height = 440 }) {
  const C = linChart(svg, { x: [0, xMax], y: [0, yMax], step: [xStep, yStep], box: [70, 440, 44, height - 50], size: [460, height], xLabel: num, yLabel: num });
  axisName(svg, C.R, C.B + 43, "end", xName);
  axisName(svg, C.L - 8, C.T - 22, "start", yName);
  return C;
}

const RANK = () => [tr("rank", "rango"), "r"];
const FREQ = () => [tr("frequency", "frecuencia"), "f", "r"];

/* ---------- Figure 1: rank times frequency ---------- */

function zipfFigure() {
  const svg = document.getElementById("fig-zipf");
  if (!svg) return;
  const out = document.getElementById("fig-zipf-out");
  const C = logAxes(svg, { max: 30000, xName: RANK(), yName: FREQ() });

  // Every word of the book: one point per rank where words differ, one flat stretch per run of equal frequency.
  const pts = [];
  for (const [f, a, b] of book.runs) { pts.push(`${C.X(a).toFixed(1)},${C.Y(f).toFixed(1)}`); if (b > a) pts.push(`${C.X(b).toFixed(1)},${C.Y(f).toFixed(1)}`); }
  el("polyline", { class: "lt-data", points: pts.join(" ") }, svg);

  const guides = el("path", { class: "lt-guide" }, svg);
  const label = el("text", { class: "lt-lab" }, svg);
  const h = makeHandle(svg, "point");

  // Ranks the arrow keys step through: every rank up to 10, then about 1, 1.5, 2, 3, … 9 times each power of ten.
  const stops = [...new Set([...Array(10).keys()].map((i) => i + 1).concat(
    [1, 2, 3, 4].flatMap((k) => [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => Math.round(m * 10 ** k)))))]
    .filter((r) => r <= book.V).concat(book.V);

  let rank = 10;
  function set(r) {
    rank = Math.max(1, Math.min(book.V, Math.round(r)));
    const f = freq(rank), x = C.X(rank), y = C.Y(f), w = wordAt(rank);
    h.setAttribute("transform", `translate(${x},${y})`);
    guides.setAttribute("d", `M${x},${y} V${C.B} M${x},${y} H${C.L}`);
    const [, a, b] = book.runs[runOf(rank)], many = rank > TOP && b > a;
    label.textContent = many ? tr(`${quote(w)}, one of ${num(b - a + 1)}`, `${quote(w)}, una de ${num(b - a + 1)}`) : quote(w);
    // The label sits above the dot, to its right, and to its left near the right edge.
    const left = x > 300;
    label.setAttribute("x", left ? x - 12 : x + 12);
    label.setAttribute("y", y - 14);
    label.setAttribute("text-anchor", left ? "end" : "start");
    h.setAttribute("aria-label", many
      ? tr(`Rank ${num(rank)}: one of ${num(b - a + 1)} words with frequency ${num(f)}, such as ${quote(w)}`, `Rango ${num(rank)}: una de ${num(b - a + 1)} palabras con frecuencia ${num(f)}, como ${quote(w)}`)
      : tr(`${quote(w)}: rank ${num(rank)}, frequency ${num(f)}`, `${quote(w)}: rango ${num(rank)}, frecuencia ${num(f)}`));
    const p = rank * f;
    let says;
    // From rank 2 until the tail (where the product drops below 30,000), every product in both books lies between half
    // and twice 40,000: 33,834 to 75,850 in English, 34,965 to 56,567 in Spanish (nlp/spread.mjs); rank 1 gives about
    // half of it, 20,747 and 20,416.
    if (rank === 1) says = tr("About half of 40,000: the first word is rarer than the rest of the list suggests.", "Cerca de la mitad de 40\u00a0000: la primera palabra es menos frecuente de lo que sugiere el resto de la lista.");
    else if (p >= 30000) says = tr("Between half and twice 40,000, like most of the list.", "Entre la mitad y el doble de 40\u00a0000, como casi toda la lista.");
    else if (f === 1) says = tr(`Lower: here ${num(b - a + 1)} words appear only once.`, `Más bajo: aquí ${num(b - a + 1)} palabras aparecen una sola vez.`);
    else says = tr(`Lower: here ${num(b - a + 1)} words share frequency ${num(f)}.`, `Más bajo: aquí ${num(b - a + 1)} palabras comparten la frecuencia ${num(f)}.`);
    out.innerHTML = `<p class="eq"><span class="nowrap"><i>r</i> × <i>f</i><sub><i>r</i></sub></span> <span class="nowrap">= ${num(rank)} × ${num(f)}</span> <span class="nowrap">= ${num(p)}</span></p><p>${says}</p>`;
  }

  makeDraggable(h, {
    move: (s) => set(C.toX(Math.max(C.L, Math.min(C.R, s.x)))),
    step: ([dx, dy]) => {
      const up = dx > 0 || dy > 0;
      const next = up ? stops.find((r) => r > rank) : [...stops].reverse().find((r) => r < rank);
      if (next) set(next);
    },
  });
  document.getElementById("fig-zipf-reset")?.addEventListener("click", () => set(10));
  set(10);
}

/* ---------- Figure 2: the least squares line ---------- */

function fitFigure() {
  const svg = document.getElementById("fig-fit");
  if (!svg) return;
  const out = document.getElementById("fig-fit-out");
  const C = logAxes(svg, { max: 30000, xName: RANK(), yName: FREQ() });
  const clip = clipTo(svg, "fig-fit-clip", C.L, C.R, C.T, C.B);

  // The points fitted, ranks 1 to 1000, in ink of their own; the rest of the list faint.
  const F = Array.from({ length: TOP }, (_, k) => freq(k + 1));
  const pts = [], fitted = [];
  for (const [f, a, b] of book.runs) {
    pts.push(`${C.X(a).toFixed(1)},${C.Y(f).toFixed(1)}`);
    if (b > a) pts.push(`${C.X(b).toFixed(1)},${C.Y(f).toFixed(1)}`);
    if (a <= TOP) { fitted.push(`${C.X(a).toFixed(1)},${C.Y(f).toFixed(1)}`); if (b > a) fitted.push(`${C.X(Math.min(b, TOP)).toFixed(1)},${C.Y(f).toFixed(1)}`); }
  }
  el("polyline", { class: "lt-data faint", points: pts.join(" ") }, svg);
  const res = el("path", { class: "lt-res", "clip-path": clip }, svg);
  el("polyline", { class: "lt-data", points: fitted.join(" ") }, svg);
  const line = el("line", { class: "ln-path", "clip-path": clip }, svg);

  // The line is held by two grips, at ranks 10 and 1000; their heights, in log10, fix α and C.
  const R1 = 10, R2 = TOP, gap = Math.log10(R2) - Math.log10(R1);
  const grips = [makeHandle(svg, "grip"), makeHandle(svg, "grip")];
  const best = book.zipf;
  let y1, y2; // log10 of the line at ranks 10 and 1000

  const params = () => { const alpha = (y1 - y2) / gap; return { alpha, logC: y1 + alpha * Math.log10(R1) }; };
  const xs = F.map((_, k) => Math.log10(k + 1)), ys = F.map((f) => Math.log10(f));
  const sseOf = ({ alpha, logC }) => xs.reduce((s, x, i) => s + (ys[i] - (logC - alpha * x)) ** 2, 0);

  function draw() {
    const { alpha, logC } = params(), at = (r) => C.Y(10 ** (logC - alpha * Math.log10(r)));
    line.setAttribute("x1", C.X(0.6)); line.setAttribute("y1", at(0.6));
    line.setAttribute("x2", C.X(30000)); line.setAttribute("y2", at(30000));
    let d = "";
    for (let k = 1; k <= TOP; k++) d += `M${C.X(k).toFixed(1)},${C.Y(F[k - 1]).toFixed(1)}V${at(k).toFixed(1)}`;
    res.setAttribute("d", d);
    grips[0].setAttribute("transform", `translate(${C.X(R1)},${C.Y(10 ** y1)})`);
    grips[1].setAttribute("transform", `translate(${C.X(R2)},${C.Y(10 ** y2)})`);
    const e = sseOf({ alpha, logC }), atBest = Math.abs(e - best.sse) < 0.0005;
    const cTxt = num(Math.round(10 ** logC));
    for (const [g, r, y] of [[grips[0], R1, y1], [grips[1], R2, y2]])
      g.setAttribute("aria-label", tr(`Grip of the blue line at rank ${num(r)}, at frequency ${num(Math.round(10 ** y))}`, `Asa de la recta azul en el rango ${num(r)}, a frecuencia ${num(Math.round(10 ** y))}`));
    const sum = `Σ<span class="lims"><span>${num(TOP)}</span><span><i>r</i>=1</span></span>`;
    const says = atBest
      ? tr(`For ${hat("α")} = ${dec(alpha)} and ${hat("C")} = ${cTxt}, the least it can be.`, `Para ${hat("α")} = ${dec(alpha)} y ${hat("C")} = ${cTxt}, lo más bajo posible.`)
      : tr(`For α = ${dec(alpha)} and <i>C</i> = ${cTxt}. Least squares brings it down to ${dec(best.sse)}.`, `Para α = ${dec(alpha)} y <i>C</i> = ${cTxt}. Mínimos cuadrados lo baja a ${dec(best.sse)}.`);
    out.innerHTML = `<p class="eq"><span class="nowrap">${sum} (<i>y</i><sub><i>r</i></sub> − log <i>C</i> + α<i>x</i><sub><i>r</i></sub>)<sup>2</sup></span> <span class="nowrap">= ${dec(e)}</span></p><p>${says}</p>`;
  }
  const lo = Math.log10(0.6), hi = Math.log10(30000), clampY = (v) => Math.max(lo, Math.min(hi, v));
  grips.forEach((g, i) => makeDraggable(g, {
    move: (s) => { const v = clampY(C.toLogY(s.y)); if (i) y2 = v; else y1 = v; draw(); },
    step: ([dx, dy]) => { const d = 0.02 * (dy || dx); if (i) y2 = clampY(y2 + d); else y1 = clampY(y1 + d); draw(); },
  }));
  // The start is section 1's guess, α = 1 and C = 40,000.
  const start = () => { y1 = Math.log10(40000) - Math.log10(R1); y2 = Math.log10(40000) - Math.log10(R2); draw(); };
  document.getElementById("fig-fit-lsq")?.addEventListener("click", () => {
    y1 = best.logC - best.alpha * Math.log10(R1); y2 = best.logC - best.alpha * Math.log10(R2); draw();
  });
  document.getElementById("fig-fit-reset")?.addEventListener("click", start);
  start();
}

/* ---------- Figure 3: the vocabulary as the book goes on ---------- */

function heapsFigure() {
  const svg = document.getElementById("fig-heaps");
  if (!svg) return;
  const out = document.getElementById("fig-heaps-out");
  const C = linAxes(svg, { xMax: 420000, yMax: 25000, xStep: 100000, yStep: 5000, xName: [tr("tokens read", "tokens leídos"), "n"], yName: [tr("different words", "palabras distintas"), "V"] });
  const poly = (b) => [[0, 0], ...b.vocab].map(([t, v]) => `${C.X(t).toFixed(1)},${C.Y(v).toFixed(1)}`).join(" ");

  // The other language's book, faint, named 60% of the way along, on the side away from this page's curve: above and to
  // the left of the Spanish original, which runs higher, and below and to the right of the English translation, which
  // runs lower. The curve rises, so it falls away from the label on that side.
  el("polyline", { class: "lt-faint", points: poly(other) }, svg);
  const [ot, ov] = other.vocab.reduce((best, p) => (Math.abs(p[0] - 0.6 * other.n) < Math.abs(best[0] - 0.6 * other.n) ? p : best));
  const higher = other.V > book.V;
  const oLab = el("text", { class: "lt-lab faint", x: C.X(ot) + (higher ? -8 : 8), y: C.Y(ov) + (higher ? -10 : 24), "text-anchor": higher ? "end" : "start" }, svg);
  oLab.textContent = tr("Spanish original", "traducción inglesa");
  // Heaps' law fitted to this page's book, in blue, and the counts in red.
  const { beta, logk } = book.heaps, k = 10 ** logk;
  const fit = [];
  for (let i = 0; i <= 84; i++) { const t = (book.n * i) / 84; fit.push(`${C.X(t).toFixed(1)},${C.Y(k * t ** beta).toFixed(1)}`); }
  el("polyline", { class: "ln-path thin", points: fit.join(" ") }, svg);
  el("polyline", { class: "lt-data", points: poly(book) }, svg);

  const at = new Map(book.vocab.map(([t, v]) => [t, v]));
  const maxN = Math.floor(book.n / 2000) * 1000;
  const guides = el("path", { class: "lt-guide" }, svg);
  const ring = el("circle", { class: "lt-ring", r: 6.5 }, svg);
  const h = makeHandle(svg, "point");
  let n = 100000;
  function set(t) {
    n = Math.max(1000, Math.min(maxN, Math.round(t / 1000) * 1000));
    const v1 = at.get(n), v2 = at.get(2 * n);
    const p1 = [C.X(n), C.Y(v1)], p2 = [C.X(2 * n), C.Y(v2)];
    h.setAttribute("transform", `translate(${p1[0]},${p1[1]})`);
    ring.setAttribute("cx", p2[0]); ring.setAttribute("cy", p2[1]);
    guides.setAttribute("d", `M${p1[0]},${p1[1]}H${C.L}M${p1[0]},${p1[1]}V${C.B}M${p2[0]},${p2[1]}H${C.L}M${p2[0]},${p2[1]}V${C.B}`);
    h.setAttribute("aria-label", tr(`After ${num(n)} tokens, ${num(v1)} different words; after ${num(2 * n)}, ${num(v2)}`, `Tras ${num(n)} tokens, ${num(v1)} palabras distintas; tras ${num(2 * n)}, ${num(v2)}`));
    const q = v2 / v1, pct = Math.round(100 * (q - 1));
    out.innerHTML = `<p class="eq"><span class="nowrap"><i>V</i>(2<i>n</i>) / <i>V</i>(<i>n</i>)</span> <span class="nowrap">= ${num(v2)} / ${num(v1)}</span> <span class="nowrap">≈ ${dec(q)}</span></p>` +
      `<p>${tr(`Twice the text, from ${num(n)} to ${num(2 * n)} tokens, brings ${pct}% more words; the fit says 2<sup>β</sup> ≈ ${dec(2 ** beta)}.`,
        `El doble de texto, de ${num(n)} a ${num(2 * n)} tokens, trae un ${pct}% más de palabras; el ajuste dice 2<sup>β</sup> ≈ ${dec(2 ** beta)}.`)}</p>`;
  }
  makeDraggable(h, {
    move: (s) => set(C.toX(s.x)),
    step: ([dx, dy]) => set(Math.round((n + 5000 * (dx || dy)) / 5000) * 5000),
  });
  document.getElementById("fig-heaps-reset")?.addEventListener("click", () => set(100000));
  set(100000);
}

/* ---------- Figure 4: the words seen once ---------- */

function tailFigure() {
  const svg = document.getElementById("fig-tail");
  if (!svg) return;
  const out = document.getElementById("fig-tail-out");
  svg.setAttribute("viewBox", "0 0 460 250");
  const L = 34, R = 426, W = R - L, Vmax = book.V;
  // The vocabulary so far as one bar, its length the words met (the whole width is the book's vocabulary), split by
  // how often each word has been seen.
  el("text", { x: L, y: 34, class: "lt-axname" }, svg).textContent = tr("Different words met so far", "Palabras distintas encontradas hasta aquí");
  el("rect", { x: L, y: 48, width: W, height: 40, class: "lt-slot" }, svg);
  const segs = ["lt-once", "lt-twice", "lt-more"].map((c) => el("rect", { y: 48, height: 40, class: c }, svg));
  const vLab = el("text", { y: 107, class: "lt-axname" }, svg);
  // Their names, as a legend.
  const names = [tr("seen once", "vistas una vez"), tr("twice", "dos veces"), tr("three or more times", "tres o más")];
  let lx = L;
  ["lt-once", "lt-twice", "lt-more"].forEach((c, i) => {
    el("rect", { x: lx, y: 124, width: 13, height: 13, class: c }, svg);
    const t = el("text", { x: lx + 19, y: 135, class: "lt-key" }, svg);
    t.textContent = names[i];
    lx += 19 + t.getComputedTextLength() + 22;
  });
  // The book as a track, read from 0 to its last token.
  const TY = 196, X = (t) => L + (W * t) / book.n;
  el("line", { x1: L, y1: TY, x2: R, y2: TY, class: "lt-track" }, svg);
  for (let t = 0; t <= book.n; t += 100000) {
    el("line", { x1: X(t), y1: TY, x2: X(t), y2: TY + 6, class: "lt-track thin" }, svg);
    el("text", { x: X(t), y: TY + 24, "text-anchor": "middle", class: "tick" }, svg).textContent = num(t);
  }
  const readLine = el("line", { y1: TY, y2: TY, class: "lt-read" }, svg);
  const h = makeHandle(svg, "point");
  const marks = book.vocab.map(([t]) => t);
  let i = marks.indexOf(100000);
  function set(j) {
    i = Math.max(0, Math.min(marks.length - 1, j));
    const [t, v, o, w] = book.vocab[i];
    let x = L;
    [o, w, v - o - w].forEach((c, s) => { const wd = (W * c) / Vmax; segs[s].setAttribute("x", x); segs[s].setAttribute("width", wd); x += wd; });
    vLab.setAttribute("x", Math.min(x, R)); vLab.setAttribute("text-anchor", x > R - 60 ? "end" : "middle");
    vLab.textContent = num(v);
    readLine.setAttribute("x1", L); readLine.setAttribute("x2", X(t));
    h.setAttribute("transform", `translate(${X(t)},${TY})`);
    h.setAttribute("aria-label", tr(`After ${num(t)} tokens: ${num(v)} different words, ${num(o)} of them seen once`, `Tras ${num(t)} tokens: ${num(v)} palabras distintas, ${num(o)} vistas una vez`));
    const back = t - 10000, before = back <= 0 ? 0 : back === book.n - 10000 ? book.vBack10k : book.vocab.find(([s]) => s === back)[1];
    const says = back <= 0
      ? tr(`All ${num(v)} were new in these first ${num(t)} tokens.`, `Las ${num(v)} fueron nuevas en estos primeros ${num(t)} tokens.`)
      : tr(`In the last 10,000 tokens, ${num(v - before)} words were new.`, `En los últimos 10\u00a0000 tokens aparecieron ${num(v - before)} palabras nuevas.`);
    out.innerHTML = `<p class="lbl">${tr("Seen once, of the words met", "Vistas una vez, de las encontradas")}</p><p class="eq"><span class="nowrap">${num(o)} / ${num(v)}</span> <span class="nowrap">≈ ${Math.round((100 * o) / v)}%</span></p><p>${says}</p>`;
  }
  makeDraggable(h, {
    move: (s) => { const t = ((s.x - L) * book.n) / W; let j = 0; marks.forEach((m, k) => { if (Math.abs(m - t) < Math.abs(marks[j] - t)) j = k; }); set(j); },
    step: ([dx, dy]) => { const d = dx || dy, t = marks[i] + 5000 * d, target = Math.round(t / 5000) * 5000; const j = marks.findIndex((m) => m >= Math.min(target, book.n)); set(j === -1 ? marks.length - 1 : j); },
  });
  document.getElementById("fig-tail-reset")?.addEventListener("click", () => set(marks.indexOf(100000)));
  set(i);
}

zipfFigure();
fitFigure();
heapsFigure();
tailFigure();
