// Figures of the word2vec note, on Sancho's line at the windmills in Don Quijote (chapter VIII of part I: the original
// on the Spanish page, Ormsby's translation on the English one): the order a bag of words loses and what n-grams keep
// of it; the skip-gram pairs of a target; the forward pass of a skip-gram model trained on the line's pairs; one
// example of negative sampling in two dimensions; and the distribution the negatives are drawn from, over the book.
// The target is carmine, the context words it was seen with green and the drawn words ink; lines and curves are blue.
import { el, tr, lang, modeButtons, roving, steadyHeight, logChart, stepLabels, localNum as fmt } from "../../plane.js";
import { DATA } from "./word2vec-data.js";

const D = DATA[lang];
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
// A number in a product: in parentheses when negative, as (−0.84).
const factor = (x) => (x < 0 ? `(${fmt(x, 2)})` : fmt(x, 2));
// A probability as the readouts write it: two decimals, or three when two would round it to 0 or 1.
const prob = (p) => fmt(p, p < 0.005 || p > 0.995 ? 3 : 2);
// An item of a key: a swatch of a class's color and the words that name the class, kept together.
const keyItem = (cls, text) => `<span class="w2v-ki"><span class="w2v-sw ${cls}"></span><span>${text}</span></span>`;
// A share of the draws in percent: one decimal from 1% up, otherwise two significant digits.
function pct(p) {
  const v = 100 * p;
  if (v >= 1) return `${fmt(v, 1)}%`;
  const d = Math.max(0, 1 - Math.floor(Math.log10(v)));
  return `${fmt(v, d)}%`;
}

/* ---------- Figure 1: order, and n-grams ---------- */

function orderFigure() {
  const panel = document.getElementById("fig-order");
  if (!panel) return;
  const out = document.getElementById("fig-order-out");
  const LINES = { sancho: D.line.sancho, dq: D.line.dq }, OTHER = { sancho: "dq", dq: "sancho" };
  const WHO = { sancho: tr("Sancho's line", "la línea de Sancho"), dq: tr("Don Quixote's reading", "la lectura de don Quijote") };
  const KIND = { 1: tr("Words", "Palabras"), 2: tr("Bigrams", "Bigramas"), 3: tr("Trigrams", "Trigramas") };
  const grams = (w, n) => w.slice(0, w.length - n + 1).map((_, i) => w.slice(i, i + n).join(" "));
  let orders = 1;
  for (let k = 2; k <= D.line.sancho.length; k++) orders *= k;
  let state = ["sancho", 1];
  function show([order, n]) {
    state = [order, n];
    const words = LINES[order], N = words.length, mine = grams(words, n), theirs = new Set(grams(LINES[OTHER[order]], n));
    panel.replaceChildren(h("p", "w2v-head", order === "sancho" ? tr("Sancho's line", "La línea de Sancho") : tr(`Don Quixote's reading, with ${q("giants")} and ${q("windmills")} swapped`, `La lectura de don Quijote, con ${q("gigantes")} y ${q("molinos de viento")} intercambiados`)));
    const line = h("div", "w2v-line");
    for (const w of words) line.append(h("span", "w2v-tok", w));
    panel.append(line);
    const chips = h("div", "w2v-chips");
    if (n === 1) {
      panel.append(h("p", "w2v-head", tr("Its counts, in alphabetical order", "Sus conteos, en orden alfabético")));
      for (const w of [...words].sort((a, b) => a.localeCompare(b, lang))) chips.append(h("span", "w2v-chip", `<span class="w2v-w">${w}</span><span class="w2v-n">1</span>`));
      panel.append(chips);
    } else {
      panel.append(h("p", "w2v-head", tr(`Its ${mine.length} ${n === 2 ? "bigrams" : "trigrams"}, in order`, `Sus ${mine.length} ${n === 2 ? "bigramas" : "trigramas"}, en orden`)));
      for (const g of mine) chips.append(h("span", `w2v-chip${theirs.has(g) ? "" : " only"}`, `<span class="w2v-w">${g}</span>`));
      panel.append(chips, h("p", "w2v-key", keyItem("only", tr("not in the other order", "no están en el otro orden"))));
    }
    const shared = mine.filter((g) => theirs.has(g)).length;
    const says = n === 1
      ? tr(`The two orders give the same ${N} counts, as do all ${fmt(orders)} orders of these words: a model that reads the counts cannot tell them apart.`,
        `Los dos órdenes dan los mismos ${N} conteos, como las ${fmt(orders)} maneras de ordenar estas palabras: un modelo que lee los conteos no puede distinguirlos.`)
      : tr(`Of them, ${shared} are also in ${WHO[OTHER[order]]}; the other ${mine.length - shared}, outlined, are the ones that tell the two orders apart.`,
        `De ellos, ${shared} también están en ${WHO[OTHER[order]]}; los otros ${mine.length - shared}, con borde, son los que separan los dos órdenes.`);
    out.innerHTML = `<p class="lbl">${tr(`${KIND[n]} of ${WHO[order]}`, `${KIND[n]} de ${WHO[order]}`)}</p>` +
      `<p class="eq"><span class="nowrap"><i>N</i> − <i>n</i> + 1</span> <span class="nowrap">= ${N} − ${n} + 1</span> <span class="nowrap">= ${N - n + 1}</span></p><p>${says}</p>`;
  }
  const states = ["sancho", "dq"].flatMap((o) => [1, 2, 3].map((n) => [o, n]));
  modeButtons(document.getElementById("fig-order-order"), (m) => show([m, state[1]]));
  modeButtons(document.getElementById("fig-order-n"), (m) => show([state[0], Number(m)]));
  show(state);
  steadyHeight(panel, states, show, () => state);
  steadyHeight(out, states, show, () => state);
}

/* ---------- Figure 2: skip-grams ---------- */

function pairsFigure() {
  const panel = document.getElementById("fig-pairs");
  if (!panel) return;
  const out = document.getElementById("fig-pairs-out");
  const words = D.line.sancho, N = words.length;
  let target = words.indexOf(D.ns.target), m = 2;
  panel.append(h("p", "w2v-head", tr("Sancho's line", "La línea de Sancho")));
  const line = h("div", "w2v-line");
  const buttons = words.map((w) => { const b = h("button", "w2v-tok", w); b.type = "button"; line.append(b); return b; });
  const head2 = h("p", "w2v-head"), chips = h("div", "w2v-chips");
  panel.append(line, h("p", "w2v-key", keyItem("tgt", tr("target", "objetivo")) + keyItem("ctx", tr("context", "contexto"))), head2, chips);
  const span = (i) => [Math.max(0, i - m), Math.min(N - 1, i + m)];
  function show([i, mm]) {
    target = i; m = mm;
    const [a, b] = span(i);
    buttons.forEach((btn, k) => {
      const role = k === i ? "tgt" : k >= a && k <= b ? "ctx" : "";
      btn.className = `w2v-tok${role ? ` ${role}` : ""}${k === i ? " on" : ""}`;
      btn.tabIndex = k === i ? 0 : -1;
      btn.setAttribute("aria-pressed", String(k === i));
      btn.setAttribute("aria-label", role === "tgt" ? tr(`${words[k]}, the target`, `${words[k]}, el objetivo`) : role === "ctx" ? tr(`${words[k]}, context, j = ${fmt(k - i)}`, `${words[k]}, contexto, j = ${fmt(k - i)}`) : words[k]);
    });
    const pairs = [];
    for (let j = -m; j <= m; j++) if (j && i + j >= 0 && i + j < N) pairs.push(j);
    head2.innerHTML = pairs.length === 1
      ? tr("Its one pair (<i>o</i>, <i>c</i>)", "Su único par (<i>o</i>, <i>c</i>)")
      : tr(`Its ${pairs.length} pairs (<i>o</i>, <i>c</i>)`, `Sus ${pairs.length} pares (<i>o</i>, <i>c</i>)`);
    chips.replaceChildren(...pairs.map((j) => h("span", "w2v-chip", `<span class="w2v-w">(<span class="tgt">${words[i]}</span>, <span class="ctx">${words[i + j]}</span>)</span><span class="w2v-n"><i>j</i> = ${fmt(j)}</span>`)));
    const per = words.map((_, k) => Math.min(m, k) + Math.min(m, N - 1 - k)), total = per.reduce((s, x) => s + x, 0);
    const terms = per.map((x, k) => (k === i ? `<span class="pt">${x}</span>` : `${x}`));
    const n = per[i], before = Math.min(m, i), after = Math.min(m, N - 1 - i), w = q(words[i]);
    // A target whose window runs past an end of the line: how many words it still has on that side.
    const side = before < m
      ? tr(before ? `only ${before} come${before === 1 ? "s" : ""} before it` : "nothing comes before it",
        before ? `solo ${before === 1 ? "una palabra la precede" : `${before} palabras la preceden`}` : "ninguna palabra la precede")
      : tr(after ? `only ${after} come${after === 1 ? "s" : ""} after it` : "nothing comes after it",
        after ? `solo ${after === 1 ? "una palabra la sigue" : `${after} palabras la siguen`}` : "ninguna palabra la sigue");
    const says = n === 2 * m
      ? (m === 1
        ? tr(`${w} pairs with the 2 words beside it, one on each side.`, `${w} forma un par con sus 2 palabras contiguas, una a cada lado.`)
        : tr(`${w} pairs with the ${n} words within ${m} of it, ${m} on each side; the pairs farther than 1 skip the words in between.`,
          `${w} forma un par con cada una de las ${n} palabras a ${m} posiciones o menos, ${m} a cada lado; los pares a más de 1 posición se saltan las palabras intermedias.`))
      : tr(`${w} pairs with ${n} word${n === 1 ? "" : "s"}: ${side}, at the ${before < m ? "start" : "end"} of the line.`,
        `${w} forma ${n === 1 ? "un solo par" : `${n} pares`}: ${side}, ${before < m ? "al comienzo" : "al final"} de la línea.`);
    out.innerHTML = `<p class="lbl">${tr(`Pairs of the line, <i>m</i> = ${m}`, `Pares de la línea, <i>m</i> = ${m}`)}</p>` +
      `<p class="eq"><span class="nowrap">|<i>S</i>|</span> <span class="nowrap">= ${terms[0]}</span> ${terms.slice(1).map((t) => `<span class="nowrap">+ ${t}</span>`).join(" ")} <span class="nowrap">= ${total}</span></p><p>${says}</p>`;
  }
  roving(buttons, (i) => show([i, m]));
  modeButtons(document.getElementById("fig-pairs-m"), (mm) => show([target, Number(mm)]));
  show([target, m]);
  const states = [1, 2, 3].flatMap((mm) => words.map((_, i) => [i, mm]));
  steadyHeight(panel, states, show, () => [target, m]);
  steadyHeight(out, states, show, () => [target, m]);
}

/* ---------- Figure 3: guessing the neighbors ---------- */

// A skip-gram model with the full softmax, d = 3, trained on the line's pairs (m = 2), its numbers rounded to two
// decimals as the tables show them; every score and probability is computed from those. The first table is W_in, a
// row v per word, whose rows are the buttons that pick the target; the second writes each column u of W_out across
// its word's row, with the word's score and probability as a context of the target.
function netFigure() {
  const panel = document.getElementById("fig-net");
  if (!panel) return;
  const out = document.getElementById("fig-net-out");
  const T = D.toy, V = T.vocab.length, words = D.line.sancho;
  // The words within 2 of each target in the line.
  const near = T.vocab.map((w) => {
    const s = new Set();
    words.forEach((x, i) => { if (x === w) for (let j = -2; j <= 2; j++) if (j && i + j >= 0 && i + j < words.length) s.add(words[i + j]); });
    return s;
  });
  const v = (o) => T.win[o], u = (c) => T.wout[c];
  // The score from the entries as printed, in whole hundredths so that it rounds as by hand (3.455 to 3.46).
  const score = (o, c) => {
    const e = u(c).reduce((s, x, k) => s + Math.round(x * 100) * Math.round(v(o)[k] * 100), 0);
    return (Math.sign(e) * Math.round(Math.abs(e) / 100)) / 100;
  };
  let target = T.vocab.indexOf(D.ns.target);
  panel.append(h("p", "w2v-head", tr(`A model trained on the line's ${T.pairs} pairs: <i>V</i> = ${V} words, <i>d</i> = 3`, `Un modelo entrenado con los ${T.pairs} pares de la línea: <i>V</i> = ${V} palabras, <i>d</i> = 3`)));
  panel.append(h("p", "w2v-step", tr(`<span class="w2v-stepn">1</span>Select: <i>x</i> is 1 at the target, so <i>W</i><sub>in</sub><sup class="t">T</sup><i>x</i> is its row`, `<span class="w2v-stepn">1</span>Seleccionar: <i>x</i> vale 1 en el objetivo, así que <i>W</i><sub>in</sub><sup class="t">T</sup><i>x</i> es su fila`)));
  const tabIn = h("div", "w2v-tab w2v-in");
  tabIn.append(h("div", "w2v-trow w2v-thead", `<span class="w2v-word">${tr("word", "palabra")}</span><span class="w2v-x"><i>x</i></span><span class="w2v-span3">${tr("row <i>v</i>", "fila <i>v</i>")}</span>`));
  const rowsIn = T.vocab.map((w, o) => {
    const b = h("button", "w2v-trow");
    b.type = "button";
    b.innerHTML = `<span class="w2v-word">${w}</span><span class="w2v-x"></span>${v(o).map((x) => `<span class="w2v-num">${fmt(x, 2)}</span>`).join("")}`;
    tabIn.append(b);
    return b;
  });
  panel.append(tabIn);
  panel.append(h("p", "w2v-step", tr(`<span class="w2v-stepn">2</span>Score each word <i>c</i> with its column <i>u</i> of <i>W</i><sub>out</sub>, <span class="nowrap"><span class="w2v-stepn">3</span>normalize</span>`, `<span class="w2v-stepn">2</span>Puntuar cada palabra <i>c</i> con su columna <i>u</i> de <i>W</i><sub>out</sub>, <span class="nowrap"><span class="w2v-stepn">3</span>normalizar</span>`)));
  const tabOut = h("div", "w2v-tab w2v-out");
  tabOut.append(h("div", "w2v-trow w2v-thead", `<span class="w2v-word">${tr("word", "palabra")}</span><span class="w2v-span3">${tr("column <i>u</i>", "columna <i>u</i>")}</span><span class="w2v-z"><i>z</i></span><span class="w2v-pbar">${tr("probability", "probabilidad")} <i>p</i>(<i>c</i> | <i>o</i>)</span>`));
  const rowsOut = T.vocab.map((w, c) => {
    const r = h("div", "w2v-trow");
    r.innerHTML = `<span class="w2v-word">${w}</span>${u(c).map((x) => `<span class="w2v-num">${fmt(x, 2)}</span>`).join("")}<span class="w2v-z"></span><span class="w2v-bartrack"><span class="w2v-bar"></span></span><span class="w2v-p"></span>`;
    tabOut.append(r);
    return r;
  });
  const key = h("p", "w2v-key");
  panel.append(tabOut, key);
  function show(o) {
    target = o;
    const z = T.vocab.map((_, c) => score(o, c)), top = Math.max(...z), e = z.map((x) => Math.exp(x - top)), sum = e.reduce((s, x) => s + x, 0), p = e.map((x) => x / sum);
    rowsIn.forEach((r, k) => {
      r.classList.toggle("tgt", k === o);
      r.classList.toggle("on", k === o);
      r.tabIndex = k === o ? 0 : -1;
      r.setAttribute("aria-pressed", String(k === o));
      r.querySelector(".w2v-x").textContent = k === o ? "1" : "0";
      r.setAttribute("aria-label", tr(`${T.vocab[k]}${k === o ? ", the target" : ""}: row ${fmt(v(k)[0], 2)}, ${fmt(v(k)[1], 2)}, ${fmt(v(k)[2], 2)}`, `${T.vocab[k]}${k === o ? ", el objetivo" : ""}: fila ${fmt(v(k)[0], 2)}, ${fmt(v(k)[1], 2)}, ${fmt(v(k)[2], 2)}`));
    });
    rowsOut.forEach((r, c) => {
      r.classList.toggle("ctx", near[o].has(T.vocab[c]));
      r.querySelector(".w2v-z").textContent = fmt(z[c], 2);
      r.querySelector(".w2v-bar").style.width = `${Math.min(100, 200 * p[c])}%`;
      r.querySelector(".w2v-p").textContent = prob(p[c]);
    });
    key.innerHTML = keyItem("ctx", tr(`the words around ${q(T.vocab[o])} in the line`, `las palabras alrededor de ${q(T.vocab[o])} en la línea`));
    // The readout follows the target's likeliest neighbor in the line.
    const nb = T.vocab.map((w, c) => c).filter((c) => near[o].has(T.vocab[c]));
    const c = nb.reduce((a, b) => (p[b] > p[a] ? b : a), nb[0]);
    const mass = nb.reduce((s, k) => s + p[k], 0);
    const terms = u(c).map((x, k) => `${factor(x)}·${factor(v(o)[k])}`);
    const ez = Math.exp(z[c]), all = z.reduce((s, x) => s + Math.exp(x), 0);
    out.innerHTML = `<p class="lbl">${tr(`The probability of ${q(T.vocab[c])} around ${q(T.vocab[o])}`, `La probabilidad de ${q(T.vocab[c])} alrededor de ${q(T.vocab[o])}`)}</p>` +
      `<p class="eq"><span class="nowrap"><i>z</i><sub><i>c</i></sub> = <i>u</i><sub><i>c</i></sub><sup class="t">T</sup><i>v</i><sub><i>o</i></sub></span> <span class="nowrap">= ${terms[0]}</span> <span class="nowrap">+ ${terms[1]}</span> <span class="nowrap">+ ${terms[2]}</span> <span class="nowrap">≈ ${fmt(z[c], 2)}</span><br>` +
      `<span class="nowrap"><i>p</i>(<i>c</i> | <i>o</i>) = <span class="frac"><span><i>e</i><sup>${fmt(z[c], 2)}</sup></span><span>∑<sub><i>w</i></sub> <i>e</i><sup><i>z</i><sub><i>w</i></sub></sup></span></span></span> <span class="nowrap">≈ <span class="frac"><span>${fmt(ez, 2)}</span><span>${fmt(all, 2)}</span></span></span> <span class="nowrap">≈ ${prob(p[c])}</span></p>` +
      `<p>${tr(`The ${nb.length} words around ${q(T.vocab[o])} in the line share ${prob(mass)} of the probability.`, `Las ${nb.length} palabras alrededor de ${q(T.vocab[o])} en la línea se reparten ${prob(mass)} de la probabilidad.`)}</p>`;
  }
  roving(rowsIn, show);
  show(target);
  steadyHeight(panel, T.vocab.map((_, o) => o), show, () => target);
  steadyHeight(out, T.vocab.map((_, o) => o), show, () => target);
}

/* ---------- Figure 4: negative sampling ---------- */

const sigma = (s) => 1 / (1 + Math.exp(-s));
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];

// One example of negative sampling, drawn on the plane of the vectors' two numbers: the target's vector v (a carmine
// arrow), the context vector u of the word seen with it (green) and those of three words drawn from the book (ink).
// Each step is one step of gradient descent on the four pairs' binary cross-entropy, moving all five vectors. The
// shaded side of the blue line through the origin, perpendicular to v, is where a context vector makes its pair's
// h larger than 0.5.
function nsFigure() {
  const svg = document.getElementById("fig-ns");
  if (!svg) return;
  const out = document.getElementById("fig-ns-out");
  const NS = D.ns, K = NS.steps, words = [NS.context, ...NS.drawn];
  // The steps, computed once: every gradient from the same state, then every vector moves. A step descends the sum of
  // the four pairs' losses with η = 0.3, which is the same step as η = 1.2 on ℒ, their mean.
  const hist = [{ v: NS.v0, us: NS.us0 }];
  for (let s = 0; s < K; s++) {
    const { v, us } = hist[s], hh = us.map((x) => sigma(dot2(x, v))), y = us.map((_, i) => (i === 0 ? 1 : 0));
    const gv = us.reduce((g, x, i) => [g[0] + (hh[i] - y[i]) * x[0], g[1] + (hh[i] - y[i]) * x[1]], [0, 0]);
    hist.push({ v: [v[0] - NS.eta * gv[0], v[1] - NS.eta * gv[1]], us: us.map((x, i) => [x[0] - NS.eta * (hh[i] - y[i]) * v[0], x[1] - NS.eta * (hh[i] - y[i]) * v[1]]) });
  }
  // The readout's ℒ is worked from the h values as it prints them, so that its terms add up by hand.
  for (const s of hist) {
    s.h = s.us.map((x) => sigma(dot2(x, s.v)));
    const shown = s.h.map((x) => Number(prob(x)));
    s.loss = -(Math.log(shown[0]) + shown.slice(1).reduce((a, x) => a + Math.log(1 - x), 0)) / shown.length;
  }

  // The plane runs from −1.8 to 1.8 on both axes: every vector stays inside it at every step (within −1.63 and 1.42).
  const L = 66, R = 434, T = 78, B = 446, LIM = 1.8, KEY_Y = 20;
  svg.setAttribute("viewBox", "0 0 460 504");
  const X = (x) => L + ((x + LIM) / (2 * LIM)) * (R - L), Y = (y) => B - ((y + LIM) / (2 * LIM)) * (B - T);
  const clipId = "fig-ns-clip";
  el("rect", { x: L, y: T, width: R - L, height: B - T }, el("clipPath", { id: clipId }, el("defs", null, svg)));
  const half = el("polygon", { class: "w2v-half", "clip-path": `url(#${clipId})` }, svg);
  const axes = el("g", { class: "axes" }, svg);
  el("rect", { x: L, y: T, width: R - L, height: B - T, class: "w2v-frame" }, svg);
  el("line", { x1: X(0), y1: T, x2: X(0), y2: B, class: "w2v-zero" }, axes);
  el("line", { x1: L, y1: Y(0), x2: R, y2: Y(0), class: "w2v-zero" }, axes);
  for (const t of [-1, 0, 1]) {
    el("line", { x1: X(t), y1: B, x2: X(t), y2: B + 6 }, axes);
    el("text", { x: X(t), y: B + 21, "text-anchor": "middle", class: "tick" }, svg).textContent = fmt(t);
    el("line", { x1: L, y1: Y(t), x2: L - 6, y2: Y(t) }, axes);
    el("text", { x: L - 10, y: Y(t) + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = fmt(t);
  }
  el("text", { x: R, y: B + 44, "text-anchor": "end", class: "w2v-axname" }, svg).textContent = tr("first number", "primer número");
  el("text", { x: L - 8, y: T - 16, "text-anchor": "start", class: "w2v-axname" }, svg).textContent = tr("second number", "segundo número");
  // The key, above the frame at the right, laid out from the words' widths (again once the fonts have arrived).
  const key = el("g", { class: "w2v-keyg" }, svg);
  const keyItems = [["tgt", tr("target", "objetivo")], ["ctx", tr("observed", "observada")], ["neg", tr("drawn", "sorteadas")]];
  function layoutKey() {
    key.replaceChildren();
    let kx = R;
    for (const [cls, text] of [...keyItems].reverse()) {
      const t = el("text", { x: kx, y: KEY_Y, "text-anchor": "end", class: "w2v-keytext" }, key);
      t.textContent = text;
      const sx = kx - t.getComputedTextLength() - 12;
      if (cls === "tgt") { el("line", { x1: sx - 14, y1: KEY_Y - 5, x2: sx + 4, y2: KEY_Y - 5, class: "w2v-v" }, key); el("path", { d: `M${sx + 7},${KEY_Y - 5} l-8,-4.5 v9 z`, class: "w2v-vhead" }, key); }
      else el("circle", { cx: sx, cy: KEY_Y - 5, r: 5.5, class: `w2v-pt ${cls}` }, key);
      kx = sx - 22;
    }
  }
  const bound = el("line", { class: "w2v-bound", "clip-path": `url(#${clipId})` }, svg);
  const trails = words.map((_, i) => el("polyline", { class: `w2v-trail ${i ? "neg" : "ctx"}` }, svg));
  const vTrail = el("polyline", { class: "w2v-trail tgt" }, svg);
  const dots = words.map((_, i) => el("circle", { r: 6, class: `w2v-pt ${i ? "neg" : "ctx"}` }, svg));
  const arrow = el("line", { class: "w2v-v" }, svg), head = el("path", { class: "w2v-vhead" }, svg);
  const labels = words.map((_, i) => el("text", { class: `w2v-lab ${i ? "neg" : "ctx"}` }, svg));
  const vLab = el("text", { class: "w2v-lab tgt" }, svg);
  const texts = (s) => [q(NS.target), ...words.map((w, i) => `${q(w)} ${prob(s.h[i])}`)];

  // Where a step draws things: the arrow's tip and direction, the context vectors' points, and points sampled along
  // the arrow and along the blue line, for placing the labels.
  function scene(s) {
    const [vx, vy] = s.v, tx = X(vx), ty = Y(vy), len = Math.hypot(tx - X(0), ty - Y(0)), cx = (tx - X(0)) / len, cy = (ty - Y(0)) / len;
    const arrowPts = [], linePts = [];
    for (let d = 0; d <= len; d += 3) arrowPts.push([X(0) + cx * d, Y(0) + cy * d]);
    for (let d = -300; d <= 300; d += 4) linePts.push([X(0) - cy * d, Y(0) + cx * d]);
    return { tx, ty, cx, cy, pts: s.us.map((x) => [X(x[0]), Y(x[1])]), arrowPts, linePts };
  }

  // Every step's label places, chosen together for all the steps by stepLabels (the target's label first), so that a
  // label keeps its side; Back and Next show the same places. They are worked out again when the fonts or the labels'
  // size change.
  let spots = [];
  function layoutLabels() {
    const scenes = hist.map(scene);
    spots = stepLabels({
      items: [{ el: vLab, text: (j) => texts(hist[j])[0], at: (j) => [scenes[j].tx, scenes[j].ty], dot: false },
        ...labels.map((t, i) => ({ el: t, text: (j) => texts(hist[j])[i + 1], at: (j) => scenes[j].pts[i], dot: true }))],
      steps: hist.length, frame: [L, R, T, B], zero: [X(0), Y(0)], arrows: (j) => scenes[j].arrowPts, lines: (j) => scenes[j].linePts,
    });
  }

  let k = 0, measuring = false;
  const $ = (s) => document.getElementById(`fig-ns-${s}`);
  const nextBtn = $("next"), backBtn = $("back"), resetBtn = $("reset"), count = $("count");
  function update() {
    const s = hist[k], g = scene(s);
    // The shaded side: the frame's corners where u·v > 0, with the line's crossings of the frame.
    const sq = [[-LIM, -LIM], [LIM, -LIM], [LIM, LIM], [-LIM, LIM]], f = (p) => dot2(p, s.v), poly = [];
    sq.forEach((p, i) => {
      const r = sq[(i + 1) % 4], fp = f(p), fr = f(r);
      if (fp > 0) poly.push(p);
      if ((fp > 0) !== (fr > 0)) { const t = fp / (fp - fr); poly.push([p[0] + t * (r[0] - p[0]), p[1] + t * (r[1] - p[1])]); }
    });
    half.setAttribute("points", poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(" "));
    const n = Math.hypot(s.v[0], s.v[1]), ux = -s.v[1] / n, uy = s.v[0] / n;
    bound.setAttribute("x1", X(-ux * 4)); bound.setAttribute("y1", Y(-uy * 4)); bound.setAttribute("x2", X(ux * 4)); bound.setAttribute("y2", Y(uy * 4));
    trails.forEach((t, i) => t.setAttribute("points", hist.slice(0, k + 1).map((p) => `${X(p.us[i][0]).toFixed(1)},${Y(p.us[i][1]).toFixed(1)}`).join(" ")));
    vTrail.setAttribute("points", hist.slice(0, k + 1).map((p) => `${X(p.v[0]).toFixed(1)},${Y(p.v[1]).toFixed(1)}`).join(" "));
    dots.forEach((d, i) => { d.setAttribute("cx", g.pts[i][0]); d.setAttribute("cy", g.pts[i][1]); });
    // The arrow stops short of its tip by the head's length.
    const { tx, ty, cx, cy } = g;
    arrow.setAttribute("x1", X(0)); arrow.setAttribute("y1", Y(0)); arrow.setAttribute("x2", tx - cx * 9); arrow.setAttribute("y2", ty - cy * 9);
    head.setAttribute("d", `M${tx},${ty} L${tx - cx * 13 - cy * 6},${ty - cy * 13 + cx * 6} L${tx - cx * 13 + cy * 6},${ty - cy * 13 - cx * 6} Z`);
    // Labels: the target's word at the arrow's tip, each context vector's word with its h, at this step's places.
    const tx2 = texts(s);
    [vLab, ...labels].forEach((t, i) => {
      t.textContent = tx2[i];
      t.setAttribute("x", spots[k][i].x); t.setAttribute("y", spots[k][i].y); t.setAttribute("text-anchor", "middle");
    });
    count.textContent = tr(`${k} of ${K} steps`, `${k} de ${K} pasos`);
    // The buttons follow the step, and focus moves off a button that gets disabled or hidden; but not while
    // steadyHeight runs through every step to measure the readout, which would leave focus on the page's body.
    if (!measuring) {
      const focused = document.activeElement;
      backBtn.disabled = k === 0;
      nextBtn.disabled = k === K;
      resetBtn.hidden = k !== K;
      if (focused === nextBtn && nextBtn.disabled) resetBtn.focus();
      if (focused === backBtn && backBtn.disabled) nextBtn.focus();
      if (focused === resetBtn && resetBtn.hidden) backBtn.focus();
    }
    const terms = [`ℒ = −¼[log ${prob(s.h[0])}`, ...s.h.slice(1).map((x) => `+ log(1 − ${prob(x)})`)];
    terms[terms.length - 1] += "]";
    const lossCalc = `${terms.map((t) => `<span class="nowrap">${t}</span>`).join(" ")} <span class="nowrap">≈ ${fmt(s.loss, 2)}</span>`;
    const inside = NS.drawn.filter((_, i) => s.h[i + 1] > 0.5);
    const says = k === 0
      ? tr(`With random starting vectors, ${q(NS.context)} lies outside the shaded side, where a pair looks real${inside.length ? `, and ${inside.map(q).join(" and ")} inside it` : ""}.`,
        `Con vectores iniciales al azar, ${q(NS.context)} queda fuera del lado sombreado, donde un par parece real${inside.length ? `, y ${inside.map(q).join(" y ")} dentro de él` : ""}.`)
      : tr(`The loss ℒ goes from ${fmt(hist[k - 1].loss, 2)} to ${fmt(s.loss, 2)}: the observed pair's <i>h</i> is ${prob(s.h[0])}, the drawn words' ${prob(Math.max(...s.h.slice(1)))} at most.`,
        `La pérdida ℒ va de ${fmt(hist[k - 1].loss, 2)} a ${fmt(s.loss, 2)}: la <i>h</i> del par observado es ${prob(s.h[0])}, y la de las sorteadas, ${prob(Math.max(...s.h.slice(1)))} a lo sumo.`);
    out.innerHTML = `<p class="lbl">${k ? tr(`Step ${k}: the loss of the four pairs`, `Paso ${k}: la pérdida de los cuatro pares`) : tr("At the start: the loss of the four pairs", "Al comienzo: la pérdida de los cuatro pares")}</p>` +
      `<p class="eq">${lossCalc}</p><p>${says}</p>`;
    svg.setAttribute("aria-label", tr(`The vectors of ${NS.target}, ${NS.context} and three drawn words, step ${k} of ${K}`, `Los vectores de ${NS.target}, ${NS.context} y tres palabras sorteadas, paso ${k} de ${K}`));
  }
  const go = (d) => { const j = Math.max(0, Math.min(K, k + d)); if (j !== k) { k = j; update(); } };
  nextBtn.addEventListener("click", () => go(1));
  backBtn.addEventListener("click", () => go(-1));
  resetBtn.addEventListener("click", () => { k = 0; update(); nextBtn.focus(); });
  svg.closest(".fig").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  const relayout = () => { layoutKey(); layoutLabels(); update(); };
  relayout();
  document.fonts.ready.then(relayout);
  matchMedia("(max-width: 560px)").addEventListener("change", relayout);
  steadyHeight(out, hist.map((_, i) => i), (i) => { measuring = true; k = i; update(); measuring = false; }, () => k);
}

/* ---------- Figure 5: where the negatives come from ---------- */

// The book's words by rank on log-log axes, each at its probability of being drawn, f(w)^β / Σ f(w′)^β; the curve for
// β = 1 (the book's frequencies) stays faint behind the others. Ten words drawn with the chosen β, from ten sets made
// offline with a seeded generator, so that every reader sees the same draws.
function drawFigure() {
  const svg = document.getElementById("fig-draw");
  if (!svg) return;
  const out = document.getElementById("fig-draw-out"), wordsBox = document.getElementById("fig-draw-words");
  const G = D.neg, BETAS = ["0", "0.75", "1"], LABEL = { 0: "0", 0.75: "¾", 1: "1" };
  // The ranks from 1 to a little past the last, and the probabilities from 10^−6.3 to 10%, on the log–log axes of the
  // first note (labeled ticks at the powers of ten, short ones at their multiples), the y axis in percent. X and Y
  // take the logarithms.
  const C = logChart(svg, { x: [1, 10 ** (Math.log10(G.V) + 0.08)], y: [10 ** -6.3, 0.1], box: [92, 440, 50, 356], size: [460, 420],
    yLabel: (p) => `${fmt(100 * p, Math.max(0, -Math.round(Math.log10(p)) - 2))}%` });
  const { L, R, T, B } = C, X = (lr) => C.X(10 ** lr), Y = (lp) => C.Y(10 ** lp);
  const nameX = el("text", { x: R, y: B + 46, "text-anchor": "end", class: "w2v-axname" }, svg);
  nameX.textContent = tr("rank", "rango");
  const nameY = el("text", { x: L - 10, y: T - 18, "text-anchor": "start", class: "w2v-axname" }, svg);
  nameY.innerHTML = `${tr("probability of being drawn", "probabilidad de ser sorteada")} <tspan class="m">P</tspan>(<tspan class="m">w</tspan>)`;
  const P = (c, b) => (b === 0 ? 1 / G.V : c ** b / G.Z[b]);
  const path = (b) => {
    let r = 1;
    const pts = [];
    for (const [c, n] of G.runs) {
      const y = Y(Math.log10(P(c, b)));
      pts.push(`${X(Math.log10(r)).toFixed(1)},${y.toFixed(1)}`);
      if (n > 1) pts.push(`${X(Math.log10(r + n - 1)).toFixed(1)},${y.toFixed(1)}`);
      r += n;
    }
    return pts.join(" ");
  };
  const faint = el("polyline", { class: "w2v-curve faint", points: path(1) }, svg);
  // The faint curve's name, under its tail at the right, the side away from the blue curve for β = 0 and β = ¾.
  const faintLab = el("text", { x: R - 2, y: B - 10, "text-anchor": "end", class: "w2v-faintlab" }, svg);
  faintLab.textContent = tr("β = 1, by frequency", "β = 1, según la frecuencia");
  const curve = el("polyline", { class: "w2v-curve" }, svg);
  // The most frequent word and the observed context word of figure 4, both quoted by the text.
  const MARKED = G.marked.filter(({ w }) => w !== D.ns.target);
  const marks = MARKED.map(() => el("circle", { r: 5, class: "w2v-mark" }, svg));
  const marklabs = MARKED.map(({ w }) => { const t = el("text", { class: "w2v-marklab" }, svg); t.textContent = q(w); return t; });
  const again = document.getElementById("fig-draw-again");
  let beta = 0.75, set = 0, drawnB = null;
  function show([b, sIdx]) {
    beta = b; set = sIdx;
    // The chart depends only on β: drawn again only when β changes.
    if (b !== drawnB) {
      drawnB = b;
      curve.setAttribute("points", path(b));
      faint.style.visibility = faintLab.style.visibility = b === 1 ? "hidden" : "visible";
      // Each marked word's label goes to the cheapest of 48 spots around its dot (16 directions, 3 distances) inside the
      // chart: a spot costs much for covering an axis's name, the faint curve's name or the other label, and for each
      // bit of a curve under it, and a little for being far from the dot or away from above and to its right, where the
      // falling curve has dropped away.
      const lines = [curve, ...(b === 1 ? [] : [faint])].flatMap((c) => {
        const v = c.getAttribute("points").trim().split(/\s+/).map((p) => p.split(",").map(Number)), o = [];
        for (let i = 1; i < v.length; i++) { const n = Math.max(1, Math.ceil(Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1]) / 2)); for (let s = 0; s <= n; s++) o.push([v[i - 1][0] + ((v[i][0] - v[i - 1][0]) * s) / n, v[i - 1][1] + ((v[i][1] - v[i - 1][1]) * s) / n]); }
        return o;
      });
      const dotAt = MARKED.map(({ r, f }) => [X(Math.log10(r)), Y(Math.log10(P(f, b)))]);
      const placed = [nameX.getBBox(), nameY.getBBox(), ...(b === 1 ? [] : [faintLab.getBBox()])];
      MARKED.forEach((_, i) => {
        const [cx, cy] = dotAt[i];
        marks[i].setAttribute("cx", cx); marks[i].setAttribute("cy", cy);
        const t = marklabs[i];
        const others = dotAt.filter((_, j) => j !== i).map(([x, y]) => ({ x: x - 7, y: y - 7, width: 14, height: 14 }));
        const blockers = [...placed, ...others];
        t.setAttribute("text-anchor", "middle"); t.setAttribute("x", 0); t.setAttribute("y", 0);
        const bb = t.getBBox(), w = bb.width, hh = bb.height, base = -bb.y;
        let best = { x: cx + 7, y: cy - 9 - hh, w, h: hh }, bestCost = Infinity;
        for (const dist of [6, 12, 20]) for (let k = 0; k < 16; k++) {
          const a = -Math.PI / 4 + (k * Math.PI) / 8, ca = Math.cos(a), sa = Math.sin(a);
          const reach = Math.min(Math.abs(ca) > 1e-6 ? (w / 2 + dist) / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-6 ? (hh / 2 + dist) / Math.abs(sa) : Infinity);
          const box = { x: cx + ca * reach - w / 2, y: cy + sa * reach - hh / 2, w, h: hh };
          // A spot a hair past the right edge slides back in; any other spot must lie right of the y axis and above
          // the x axis, clear of the ticks.
          if (box.x + w > 458 && box.x + w <= 461) box.x = 458 - w;
          if (box.x < L + 3 || box.y < 2 || box.x + w > 458 || box.y + hh > B - 3) continue;
          let cost = dist * 0.5 + Math.abs(Math.atan2(Math.sin(a + Math.PI / 4), Math.cos(a + Math.PI / 4))) * 3;
          for (const p of blockers) if (box.x < p.x + p.width && p.x < box.x + w && box.y < p.y + p.height && p.y < box.y + hh) cost += 500;
          cost += 15 * lines.filter(([x, y]) => x > box.x && x < box.x + w && y > box.y + 2 && y < box.y + hh - 2).length;
          if (cost < bestCost) { bestCost = cost; best = box; }
        }
        t.setAttribute("x", best.x + w / 2); t.setAttribute("y", best.y + base);
        placed.push({ x: best.x, y: best.y, width: w, height: hh });
      });
    }
    const [w0, , ] = G.marked, f0 = w0.f, Z = b === 0 ? G.V : G.Z[b];
    const top = b === 0 ? "1" : b === 1 ? fmt(f0) : fmt(f0 ** b, 0);
    const exp = b === 1 ? "" : `<sup>${LABEL[b]}</sup>`;
    // At β = ¾ the fraction's numbers are rounded; at β = 0 and 1 they are counts.
    const rel = b === 0.75 ? "≈" : "=";
    out.innerHTML = `<p class="lbl">${tr(`The chance of drawing ${q(w0.w)}, β&nbsp;=&nbsp;${LABEL[b]}`, `La probabilidad de sortear ${q(w0.w)}, β&nbsp;=&nbsp;${LABEL[b]}`)}</p>` +
      `<p class="eq"><span class="nowrap"><i>P</i>(${q(w0.w)}) = <span class="frac"><span>${fmt(f0)}${exp}</span><span>∑<sub><i>w</i>′</sub> <i>f</i>(<i>w</i>′)${exp}</span></span></span> <span class="nowrap">${rel} <span class="frac"><span>${top}</span><span>${fmt(Z, 0)}</span></span></span> <span class="nowrap">≈ ${pct(P(f0, b))}</span></p>` +
      `<p>${tr(`The ten most frequent words take ${pct(G.shares[b].top10)} of the draws, and the ${fmt(G.once)} words seen once, ${pct(G.shares[b].once)}.`, `Las diez palabras más frecuentes se llevan el ${pct(G.shares[b].top10)} de los sorteos, y las ${fmt(G.once)} vistas una vez, el ${pct(G.shares[b].once)}.`)}</p>`;
    wordsBox.replaceChildren(h("p", "w2v-head", tr(`Ten words drawn with β&nbsp;=&nbsp;${LABEL[b]}`, `Diez palabras sorteadas con β&nbsp;=&nbsp;${LABEL[b]}`)), h("div", "w2v-chips", G.draws[b][sIdx].map((w) => `<span class="w2v-chip neg"><span class="w2v-w">${w}</span></span>`).join("")));
    svg.setAttribute("aria-label", tr(`The probability of drawing each of the book's words against its rank, with β = ${LABEL[b]}`, `La probabilidad de sortear cada palabra del libro contra su rango, con β = ${LABEL[b]}`));
  }
  modeButtons(document.getElementById("fig-draw-beta"), (m) => show([Number(m), 0]));
  again.addEventListener("click", () => show([beta, (set + 1) % G.draws[beta].length]));
  show([beta, 0]);
  const states = BETAS.flatMap((b) => G.draws[b].map((_, i) => [Number(b), i]));
  steadyHeight(wordsBox, states, show, () => [beta, set]);
  steadyHeight(out, states, show, () => [beta, set]);
}

orderFigure();
pairsFigure();
netFigure();
nsFigure();
drawFigure();
