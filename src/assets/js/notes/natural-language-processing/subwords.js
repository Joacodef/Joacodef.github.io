// Figures of the note on subwords and fastText, on Don Quijote (the original on the Spanish page, Ormsby's translation
// on the English one): the words with no vector as the book is read; a word's subwords; a word's vector built from them,
// against note 6's whole words; the words and subwords as the text grows; training with subwords, in a designed
// example of two numbers per vector; which side goes in by its subwords in fastText's two models; and a cosine split
// into the shared subwords' part and the rest.
// Carmine is what is counted or looked for (the curves of words with no vector, the target, a shared ending), blue the
// closest word and its shared subwords, green the words around a target, ink the drawn word and a shared lexeme.
import { el, tr, lang, makeHandle, makeDraggable, modeButtons, roving, steadyHeight, stepLabels, linChart, logChart, localNum as fmt } from "../../plane.js";
import { DATA } from "./subwords-data.js";

const D = DATA[lang], OTHER = DATA[lang === "es" ? "en" : "es"];
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (x, d = 1) => `${fmt(100 * x, d)}%`;
// The subwords of a word: every run of minn to maxn characters of "<word>", in order of position, then of length.
function ngrams(word, minn = 3, maxn = 6) {
  const s = [..."<" + word + ">"], out = [];
  for (let i = 0; i < s.length; i++) for (let n = minn; n <= maxn && i + n <= s.length; n++) out.push(s.slice(i, i + n).join(""));
  return out;
}
const len = (g) => [...g].length;
// A row of buttons that pick one item, which the arrow keys move along; the item picked is outlined.
function picks(box, labels, onPick) {
  const buttons = labels.map((html) => { const b = h("button", "sw-pick", html); b.type = "button"; box.append(b); return b; });
  const mark = (i) => buttons.forEach((b, k) => { b.classList.toggle("on", k === i); b.tabIndex = k === i ? 0 : -1; b.setAttribute("aria-pressed", String(k === i)); });
  roving(buttons, (i) => { mark(i); onPick(i); });
  return mark;
}
const bar = (frac, cls) => `<span class="sw-track"><span class="sw-bar${cls ? ` ${cls}` : ""}" style="width:${(100 * Math.max(0, Math.min(1, frac))).toFixed(1)}%"></span></span>`;
// A chart's name, in the sans, outside its frame.
const axisName = (svg, x, y, anchor, text) => { const t = el("text", { x, y, "text-anchor": anchor, class: "sw-axname" }, svg); t.textContent = text; return t; };
// A polyline's height at x, in SVG units, between its points (sorted by x).
function yAt(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
// Names each curve beside it: each label starts at the first x of its list, on the first of its sides ("above" or
// "below" the curve, hugging the curve along the label's length), where it keeps clear of every other curve (farther
// from the label than its own curve), of the boxes already taken and of the frame. The text's height is measured once
// shown. When no place is clear, the place on its sides that the fewest points of other curves enter. Labels are placed
// in order, each then taken; again when the fonts arrive and when the labels' size changes with the screen.
function curveLabels(svg, [L, R, T, B], curves, labels, taken = []) {
  const texts = labels.map((l) => { const t = el("text", { class: `sw-lab${l.cls ? ` ${l.cls}` : ""}`, x: 0, y: 0 }, svg); t.textContent = l.text; return t; });
  function place() {
    const boxes = [...taken];
    labels.forEach((l, i) => {
      const t = texts[i], own = curves[l.curve];
      t.setAttribute("x", 0); t.setAttribute("y", 0);
      const bb = t.getBBox(), w = bb.width, asc = -bb.y, desc = bb.y + bb.height;
      let pick = null, best = null;
      for (const side of typeof l.sides === "function" ? l.sides() : l.sides) {
        for (const x0 of l.xs) {
          const span = []; for (let x = x0 - 3; x <= x0 + w + 3; x += 2) span.push(x);
          const base = side === "above" ? Math.min(...span.map((x) => yAt(own, x))) - 6 - desc : Math.max(...span.map((x) => yAt(own, x))) + 6 + asc;
          const box = { x: x0, y: base - asc, w, h: asc + desc };
          if (box.x < L + 3 || box.x + w > R - 3 || box.y < T + 3 || box.y + box.h > B - 3) continue;
          let hits = 0;
          for (const [k, pts] of Object.entries(curves)) if (k !== l.curve) for (const x of span) { const y = yAt(pts, x); if (x >= pts[0][0] && x <= pts[pts.length - 1][0] && y > box.y - 7 && y < box.y + box.h + 7) hits++; }
          const covers = boxes.some((b) => b.x < box.x + box.w + 4 && box.x < b.x + b.w + 4 && b.y < box.y + box.h + 4 && box.y < b.y + b.h + 4);
          if (!hits && !covers) { pick = { box, base }; break; }
          if (!covers && (!best || hits < best.hits)) best = { box, base, hits };
        }
        if (pick) break;
      }
      pick ??= best ?? { box: { x: l.xs[0], y: yAt(own, l.xs[0]) - 8 - asc, w, h: asc + desc }, base: yAt(own, l.xs[0]) - 8 };
      t.setAttribute("x", pick.box.x); t.setAttribute("y", pick.base);
      boxes.push(pick.box);
    });
  }
  place();
  document.fonts.ready.then(place);
  matchMedia("(max-width: 560px)").addEventListener("change", place);
}
const range = (a, b, s) => { const out = []; for (let x = a; s > 0 ? x <= b : x >= b; x += s) out.push(x); return out; };

/* ---------- Figure 1: words with no vector ---------- */

// The table is trained on the book up to the handle (the words used at least five times there get a row); the curves
// count the tokens of the next tenth whose word has no row (full carmine) and whose word the first part never used
// (paler carmine); the other book's first curve stays faint.
function oovFigure() {
  const svg = document.getElementById("fig-oov");
  if (!svg) return;
  const out = document.getElementById("fig-oov-out");
  const C = linChart(svg, { x: [0, 100], y: [0, 30], step: [20, 10], box: [64, 428, 52, 370], size: [460, 430], xLabel: (v) => (v ? `${v}%` : ""), yLabel: (v) => `${v}%` });
  axisName(svg, C.R, C.B + 44, "end", tr("share of the book the table was trained on", "parte del libro con que se entrenó la tabla"));
  axisName(svg, C.L - 8, C.T - 22, "start", tr("tokens of the next tenth with no vector", "tokens de la décima siguiente sin vector"));
  // The curves from 5% of the book on, where the handle starts (with less, a third of the next tenth or more has no
  // vector, above the chart).
  const curve = (pts, k) => pts.filter((z) => z[0] >= 5).map(([p, n, none, never]) => [C.X(p), C.Y((100 * (k ? never : none)) / n)]);
  const curves = { other: curve(OTHER.oov.pts, 0), never: curve(D.oov.pts, 1), none: curve(D.oov.pts, 0) };
  const band = el("rect", { y: C.B - 7, height: 7, class: "sw-band" }, svg);
  const guides = el("path", { class: "sw-guide" }, svg);
  for (const [k, cls] of [["other", "faint"], ["never", "pale"], ["none", ""]]) el("polyline", { class: `sw-curve${cls ? ` ${cls}` : ""}`, points: curves[k].map((z) => z.map((c) => c.toFixed(1)).join(",")).join(" ") }, svg);
  // The curves' names, past the middle of the book where they run flat, or else where they keep clear of the others; the
  // other book's on the side of its curve away from this book's first curve, or on the other side where that one has no
  // room: on the Spanish page the English curve runs between this book's two, 3 points above the paler one, and its
  // short name fits below it on wide screens only.
  const right = range(C.X(62), C.X(86), 4), left = range(C.X(8), C.X(58), 4);
  const away = () => (yAt(curves.other, C.X(75)) < yAt(curves.none, C.X(75)) ? ["above", "below"] : ["below", "above"]);
  curveLabels(svg, [C.L, C.R, C.T, C.B], curves, [
    { curve: "none", text: tr("no vector", "sin vector"), sides: ["above", "below"], xs: [...right, ...left] },
    { curve: "never", cls: "pale", text: tr("never seen", "nunca vistas"), sides: ["above", "below"], xs: [...right, ...left] },
    { curve: "other", cls: "faint", text: tr("Spanish original", "inglés"), sides: away, xs: [...right, ...left] },
  ]);
  const handle = makeHandle(svg, "point");
  let p = 50;
  function set(x) {
    p = Math.max(5, Math.min(90, Math.round(x / 5) * 5));
    const [, n, none, never] = D.oov.pts.find((z) => z[0] === p);
    const y = (100 * none) / n, hx = C.X(p), hy = C.Y(y);
    handle.setAttribute("transform", `translate(${hx},${hy})`);
    guides.setAttribute("d", `M${hx},${hy}V${C.B}M${hx},${hy}H${C.L}`);
    band.setAttribute("x", hx); band.setAttribute("width", C.X(p + 10) - hx);
    handle.setAttribute("aria-label", tr(`Trained on the first ${p}% of the book: ${fmt(none)} of the next ${fmt(n)} tokens have no vector`, `Entrenada con el primer ${p}% del libro: ${fmt(none)} de los ${fmt(n)} tokens siguientes no tienen vector`));
    out.innerHTML = `<p class="lbl">${tr(`The table trained on the first ${p}% of the book`, `La tabla entrenada con el primer ${p}% del libro`)}</p>` +
      `<p class="eq"><span class="nowrap">${fmt(none)} / ${fmt(n)}</span> <span class="nowrap">≈ ${pct(none / n)}</span></p>` +
      `<p>${tr(`Of the next ${fmt(n)} tokens, ${fmt(none)} have no vector; ${fmt(never)} of them, ${pct(never / n)} of the tokens, belong to words the first ${p}% never used at all.`, `De los ${fmt(n)} tokens siguientes, ${fmt(none)} no tienen vector; ${fmt(never)} de ellos, el ${pct(never / n)} de los tokens, son de palabras que el primer ${p}% nunca usó.`)}</p>`;
  }
  makeDraggable(handle, { move: (s) => set(((s.x - C.L) * 100) / (C.R - C.L)), step: ([dx, dy]) => set(p + 5 * (dx || dy)) });
  set(50);
  steadyHeight(out, [5, 50, 90], set, () => p);
}

/* ---------- Figure 2: a word's subwords ---------- */

// The word with its marks, then its subwords as tiles, one row per length: in ink when some word with a vector contains
// the run, faint with a dashed edge when none does; the word's own row, when it has one, apart.
function subwordsFigure() {
  const panel = document.getElementById("fig-subwords");
  if (!panel) return;
  const out = document.getElementById("fig-subwords-out");
  const CH = D.chips2;
  let pick = 0, mode = "36";
  const head = h("p", "sw-marked"), rowsBox = h("div", "sw-nrows"), own = h("p", "sw-own"), key = h("p", "sw-key");
  panel.append(head, rowsBox, own, key);
  key.innerHTML = `<span class="sw-ki"><span class="sw-tile mini"></span><span>${tr("in some word that has a vector", "en alguna palabra que tiene vector")}</span></span><span class="sw-ki"><span class="sw-tile mini unknown"></span><span>${tr("in no word that has a vector", "en ninguna palabra que tenga vector")}</span></span>`;
  function show([i, m]) {
    pick = i; mode = m;
    const c = CH[i], w = c.w, maxn = m === "3" ? 3 : 6, subs = ngrams(w, 3, maxn), unknown = new Set(c.unknown);
    head.innerHTML = `${q(w)} ${tr("with its marks", "con sus marcas")}: <span class="sw-w">${esc("<" + w + ">")}</span>`;
    rowsBox.replaceChildren(...[3, 4, 5, 6].filter((n) => n <= maxn).map((n) => {
      const these = subs.filter((g) => len(g) === n);
      const r = h("div", "sw-nrow", `<span class="sw-nlab">${tr(`${n} characters`, `${n} caracteres`)}</span>`);
      const tiles = h("span", "sw-tiles");
      tiles.innerHTML = these.length ? these.map((g) => `<span class="sw-tile${unknown.has(g) ? " unknown" : ""}">${esc(g)}</span>`).join("") : `<span class="sw-none">${tr("none: the word is too short", "ninguno: la palabra es muy corta")}</span>`;
      r.append(tiles);
      return r;
    }));
    own.innerHTML = c.row
      ? tr(`${q(w)} itself: a row of its own (${fmt(c.uses)} uses)`, `La palabra ${q(w)} misma: una fila propia (${fmt(c.uses)} usos)`)
      : c.uses ? tr(`No row of its own: used ${c.uses === 1 ? "once" : `${c.uses} times`}`, `Sin fila propia: usada ${c.uses === 1 ? "una vez" : `${c.uses} veces`}`) : tr("No row of its own: never used", "Sin fila propia: nunca usada");
    const k = [...w].length, per = [3, 4, 5, 6].filter((n) => n <= maxn).map((n) => Math.max(0, k + 3 - n)), total = per.reduce((s, x) => s + x, 0);
    const unk = subs.filter((g) => unknown.has(g)).length, rep = [...new Set(subs.filter((g, j) => subs.indexOf(g) !== j))];
    const sum = per.filter((x) => x > 0).map((x) => fmt(x)).join(" + ");
    let eq = per.filter((x) => x > 0).length > 1 ? `<span class="nowrap">${sum}</span> <span class="nowrap">= ${fmt(total)}</span>` : `${fmt(total)}`;
    let says;
    if (k + 2 < 5 && m === "36") says = tr(`${q(w)} with its marks has ${k + 2} characters: no room for subwords of 5 or 6.`, `${q(w)} con sus marcas tiene ${k + 2} caracteres: no caben subwords de 5 ni de 6.`);
    else if (unk) says = tr(`${fmt(total - unk)} of them appear in words that have a vector; ${unk === 1 ? "one does" : `${unk} do`} not.`, `${fmt(total - unk)} de ellos aparecen en palabras que tienen vector; ${unk === 1 ? "uno no" : `${unk} no`}.`);
    else says = tr("All of them appear in words that have a vector.", "Todos aparecen en palabras que tienen vector.");
    if (rep.length) says += " " + tr(`${rep.map(q).join(" and ")} comes twice, so its row counts twice.`, `${rep.map(q).join(" y ")} aparece dos veces, así que su fila cuenta dos veces.`);
    if (c.row) says += " " + tr(`With its own row, the word has ${fmt(total + 1)} rows.`, `Con su fila propia, la palabra tiene ${fmt(total + 1)} filas.`);
    out.innerHTML = `<p class="lbl">${tr(`${q(w)}, ${k} characters: its subwords`, `${q(w)}, ${k} caracteres: sus subwords`)}</p><p class="eq">${eq} ${tr("subwords", "subwords")}</p><p>${says}</p>`;
    panel.setAttribute("aria-label", tr(`The ${total} subwords of ${w}`, `Los ${total} subwords de ${w}`));
  }
  const mark = picks(document.getElementById("fig-subwords-words"), CH.map((c) => c.w), (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-subwords-mode"), (m) => show([pick, m]));
  mark(0);
  show([0, "36"]);
  const states = CH.flatMap((_, i) => [[i, "3"], [i, "36"]]);
  steadyHeight(panel, states, show, () => [pick, mode]);
  steadyHeight(out, states, show, () => [pick, mode]);
}

/* ---------- Figure 3: a word as the sum of its subwords ---------- */

// The cosine of a word o with its closest word o′, from their dot product and lengths, in thousandths.
const cosEq = ([dot, l1, l2], cos) => `<span class="nowrap">cos θ = <span class="frac"><span><i>v</i><sub><i>o</i></sub><sup class="t">T</sup><i>v</i><sub><i>o</i>′</sub></span><span>‖<i>v</i><sub><i>o</i></sub>‖ ‖<i>v</i><sub><i>o</i>′</sub>‖</span></span></span> <span class="nowrap">= <span class="frac"><span>${fmt(dot, 3)}</span><span>${fmt(l1, 3)} · ${fmt(l2, 3)}</span></span></span> <span class="nowrap">≈ ${fmt(cos, 2)}</span>`;

// The word's subwords as tiles (blue when its closest word has the same subword, ink otherwise, faint with a dashed edge
// when no word with a vector uses the row), then its five closest words with their cosines as blue bars; in the other
// mode, the whole words of the note on word vectors, where a word with no row has no vector.
function sumFigure() {
  const panel = document.getElementById("fig-sum");
  if (!panel) return;
  const out = document.getElementById("fig-sum-out");
  const CH = D.chips3;
  let pick = 0, mode = "sub";
  const head = h("p", "sw-head"), tiles = h("div", "sw-tiles flow"), key = h("p", "sw-key"), measure = h("p", "sw-measure"), rows = h("div", "sw-rows");
  panel.append(head, tiles, key, measure, rows);
  function show([i, m]) {
    pick = i; mode = m;
    const c = CH[i], w = c.w;
    if (m === "sub") {
      head.innerHTML = tr(`The ${c.tiles.length} subwords of ${q(w)}${c.row ? ", and its own row" : ""}`, `Los ${c.tiles.length} subwords de ${q(w)}${c.row ? ", y su fila propia" : ""}`);
      tiles.innerHTML = c.tiles.map(([g, f]) => `<span class="sw-tile${f === 1 ? " shared" : f === 2 ? " unknown" : ""}">${esc(g)}</span>`).join("") + (c.row ? `<span class="sw-tile own">${esc(w)}</span>` : "");
      key.innerHTML = `<span class="sw-ki"><span class="sw-tile mini shared"></span><span>${tr(`also a subword of ${q(c.top[0].w)}`, `también subword de ${q(c.top[0].w)}`)}</span></span><span class="sw-ki"><span class="sw-tile mini unknown"></span><span>${tr("a row no word with a vector uses", "una fila que ninguna palabra con vector usa")}</span></span>`;
      measure.innerHTML = tr(`cosine with ${q(w)}`, `coseno con ${q(w)}`);
      rows.replaceChildren(...c.top.map((x, k) => h("div", `sw-row${k ? "" : " first"}`, `<span class="sw-word">${x.w}</span>${bar(x.cos)}<span class="sw-val">${fmt(x.cos, 2)}</span>`)));
      const [dot, l1, l2] = c.calc, w2 = c.top[0].w;
      out.innerHTML = `<p class="lbl">${tr(`${q(w)} (<i>o</i>) and its closest word, ${q(w2)} (<i>o</i>′), built from subwords`, `${q(w)} (<i>o</i>) y su palabra más cercana, ${q(w2)} (<i>o</i>′), armadas con subwords`)}</p>` +
        `<p class="eq">${cosEq(c.calc, c.top[0].cos)}</p>` +
        `<p>${c.row
          ? tr(`${c.shared} of its ${c.tiles.length} subwords are subwords of ${q(w2)}; its own row is 1 of its ${c.tiles.length + 1} rows.`, `${c.shared} de sus ${c.tiles.length} subwords son subwords de ${q(w2)}; su fila propia es 1 de sus ${c.tiles.length + 1} filas.`)
          : tr(`${c.shared} of its ${c.tiles.length} subwords are subwords of ${q(w2)}; ${c.trained} were trained inside some word.`, `${c.shared} de sus ${c.tiles.length} subwords son subwords de ${q(w2)}; ${c.trained} se entrenaron dentro de alguna palabra.`)}</p>`;
    } else {
      head.innerHTML = tr(`${q(w)} as a whole word, as in the note on word vectors`, `${q(w)} como palabra entera, como en el apunte de los vectores de palabras`);
      tiles.innerHTML = `<span class="sw-tile${c.whole ? "" : " unknown"}">${esc(w)}</span>`;
      key.innerHTML = "";
      if (c.whole) {
        measure.innerHTML = tr(`cosine with ${q(w)}`, `coseno con ${q(w)}`);
        rows.replaceChildren(...c.whole.top.map((x, k) => h("div", `sw-row${k ? "" : " first"}`, `<span class="sw-word">${x.w}</span>${bar(x.cos)}<span class="sw-val">${fmt(x.cos, 2)}</span>`)));
        const [dot, l1, l2] = c.whole.calc, w2 = c.whole.top[0].w;
        out.innerHTML = `<p class="lbl">${tr(`${q(w)} (<i>o</i>) and its closest word, ${q(w2)} (<i>o</i>′), with whole words only`, `${q(w)} (<i>o</i>) y su palabra más cercana, ${q(w2)} (<i>o</i>′), solo con palabras enteras`)}</p>` +
          `<p class="eq">${cosEq(c.whole.calc, c.whole.top[0].cos)}</p>` +
          `<p>${tr(`With whole words, ${q(w)} sits by ${q(w2)}; with subwords, by ${q(c.top[0].w)}.`, `Con palabras enteras, ${q(w)} queda junto a ${q(w2)}; con subwords, junto a ${q(c.top[0].w)}.`)}</p>`;
      } else {
        measure.innerHTML = "";
        rows.replaceChildren(h("p", "sw-norow", tr("No row: no vector, so no closest words.", "Sin fila: sin vector, así que sin palabras más cercanas.")));
        out.innerHTML = `<p class="lbl">${tr(`${q(w)} with whole words only`, `${q(w)} solo con palabras enteras`)}</p>` +
          `<p>${c.uses === 0
            ? tr(`The book never uses ${q(w)}, so the table of whole words has no row for it.`, `El libro nunca usa ${q(w)}, así que la tabla de palabras enteras no tiene fila para esa palabra.`)
            : tr(`The book uses ${q(w)} ${c.uses === 1 ? "once" : `${c.uses} times`}, fewer than five, so the table of whole words has no row for it.`, `El libro usa ${q(w)} ${c.uses === 1 ? "una vez" : `${c.uses} veces`}, menos de cinco, así que la tabla de palabras enteras no tiene fila para esa palabra.`)}</p>`;
      }
    }
    panel.setAttribute("aria-label", tr(`The closest words to ${w}, ${m === "sub" ? "built from subwords" : "with whole words only"}`, `Las palabras más cercanas a ${w}, ${m === "sub" ? "armadas con subwords" : "solo con palabras enteras"}`));
  }
  const mark = picks(document.getElementById("fig-sum-words"), CH.map((c) => c.w), (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-sum-mode"), (m) => show([pick, m]));
  mark(0);
  show([0, "sub"]);
  const states = CH.flatMap((_, i) => [[i, "sub"], [i, "whole"]]);
  steadyHeight(panel, states, show, () => [pick, mode]);
  steadyHeight(out, states, show, () => [pick, mode]);
}

/* ---------- Figure 4: few symbols, every word ---------- */

// On log–log axes, as the book is read: the different subwords of 3 characters (full carmine), of 3 to 6 (paler) and
// the different words (faint), with the ceiling of every subword of 3 characters that can occur. The handle sits on
// the first curve; a hollow ring marks ten times its text.
function catalogFigure() {
  const svg = document.getElementById("fig-catalog");
  if (!svg) return;
  const out = document.getElementById("fig-catalog-out");
  const G = D.growth, N = G[G.length - 1][0];
  const C = logChart(svg, { x: [1000, 10 ** 5.7], y: [100, 10 ** 5.3], box: [86, 440, 52, 370], size: [460, 430], yLabel: (p) => (p > 100 ? fmt(p) : "") });
  axisName(svg, C.R, C.B + 44, "end", tr("tokens read", "tokens leídos"));
  axisName(svg, C.L - 8, C.T - 22, "start", tr("different words or subwords", "palabras o subwords distintos"));
  const curve = (k) => G.map((g) => [C.X(g[0]), C.Y(g[k])]);
  // The ceiling, dashed, its number on the y axis beside the powers of ten.
  const cap = D.alphabet.possible, capY = C.Y(cap);
  const curves = { words: curve(1), g36: curve(3), g3: curve(2), cap: [[C.L, capY], [C.R, capY]] };
  el("line", { x1: C.L, y1: capY, x2: C.R, y2: capY, class: "sw-cap" }, svg);
  el("text", { x: C.L - 10, y: capY + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = fmt(cap);
  const guides = el("path", { class: "sw-guide" }, svg);
  for (const [k, cls] of [["words", "faint"], ["g36", "pale"], ["g3", ""]]) el("polyline", { class: `sw-curve${cls ? ` ${cls}` : ""}`, points: curves[k].map((z) => z.map((c) => c.toFixed(1)).join(",")).join(" ") }, svg);
  // The names, the ceiling's on its left end, the curves' from the left, where the handle's default leaves them clear.
  const xs = range(C.X(1100), C.X(60000), 6);
  curveLabels(svg, [C.L, C.R, C.T, C.B], curves, [
    { curve: "cap", cls: "faint", text: tr("possible subwords of 3", "subwords de 3 posibles"), sides: ["above"], xs: [C.L + 6] },
    { curve: "g36", cls: "pale", text: tr("subwords of 3 to 6", "subwords de 3 a 6"), sides: ["above", "below"], xs },
    { curve: "g3", text: tr("subwords of 3", "subwords de 3"), sides: ["above", "below"], xs },
    { curve: "words", cls: "faint", text: tr("different words", "palabras distintas"), sides: ["below", "above"], xs },
  ]);
  const ring = el("circle", { r: 6.5, class: "sw-ring" }, svg);
  const handle = makeHandle(svg, "point");
  // The handle stops at the counted points from about 1,000 tokens to a tenth of the book; the ring at ten times.
  let j = 16;
  function set(k) {
    j = Math.max(0, Math.min(16, k));
    const a = G[j], b = G[j + 10];
    const p1 = [C.X(a[0]), C.Y(a[2])], p2 = [C.X(b[0]), C.Y(b[2])];
    handle.setAttribute("transform", `translate(${p1[0]},${p1[1]})`);
    ring.setAttribute("cx", p2[0]); ring.setAttribute("cy", p2[1]);
    guides.setAttribute("d", `M${p1[0]},${p1[1]}V${C.B}M${p2[0]},${p2[1]}V${C.B}`);
    handle.setAttribute("aria-label", tr(`After ${fmt(a[0])} tokens, ${fmt(a[2])} different subwords of 3 characters; after ${fmt(b[0])}, ${fmt(b[2])}`, `Tras ${fmt(a[0])} tokens, ${fmt(a[2])} subwords distintos de 3 caracteres; tras ${fmt(b[0])}, ${fmt(b[2])}`));
    out.innerHTML = `<p class="lbl">${tr(`From ${fmt(a[0])} to ${fmt(b[0])} tokens, ten times the text`, `De ${fmt(a[0])} a ${fmt(b[0])} tokens, diez veces el texto`)}</p>` +
      `<p class="eq"><span class="nowrap">${fmt(b[2])} / ${fmt(a[2])}</span> <span class="nowrap">≈ ${fmt(b[2] / a[2], 2)}</span></p>` +
      `<p>${tr(`The subwords of 3 characters grew ${fmt(b[2] / a[2], 2)} times; the words ${fmt(b[1] / a[1], 2)} times, and the subwords of 3 to 6 characters ${fmt(b[3] / a[3], 2)} times.`, `Los subwords de 3 caracteres crecieron ${fmt(b[2] / a[2], 2)} veces; las palabras, ${fmt(b[1] / a[1], 2)} veces, y los subwords de 3 a 6 caracteres, ${fmt(b[3] / a[3], 2)} veces.`)}</p>`;
  }
  makeDraggable(handle, {
    move: (s) => { const t = Math.log10(C.toX(s.x)), off = (k) => Math.abs(Math.log10(G[k][0]) - t); let best = 0; for (let k = 1; k <= 16; k++) if (off(k) < off(best)) best = k; set(best); },
    step: ([dx, dy]) => set(j + (dx || dy)),
  });
  set(16);
  steadyHeight(out, [0, 8, 16], set, () => j);
}

/* ---------- Figure 5: training with subwords ---------- */

const sigma = (s) => 1 / (1 + Math.exp(-s));
const mean2 = (rs) => [rs.reduce((a, r) => a + r[0], 0) / rs.length, rs.reduce((a, r) => a + r[1], 0) / rs.length];

// A designed example in two numbers per vector, subwords of 3 characters only: the target's rows (its own row first,
// then its subwords; those the second word shares filled, the others hollow), the second word's rows of its own (faint),
// the target's vector (carmine arrow, the mean of its rows), the second word's (carmine arrow with a hollow ring at its
// tip, the mean of its rows), the context word seen with the target (green) and a drawn word (ink). Each step is one of
// gradient descent on the two pairs' mean binary cross-entropy; every row of the target takes the whole step.
function trainFigure() {
  const svg = document.getElementById("fig-train");
  if (!svg) return;
  const out = document.getElementById("fig-train-out");
  const T = D.toy, K = T.steps, [tw, sw, cw, dw] = T.words;
  const hist = [{ G: T.G, O: T.O, U: T.U }];
  for (let s = 0; s < K; s++) {
    const { G, O, U } = hist[s], v = mean2(G), gv = [0, 0], gu = U.map(() => [0, 0]);
    for (const [c, y] of [[0, 1], [1, 0]]) { const e = (sigma(v[0] * U[c][0] + v[1] * U[c][1]) - y) / 2; for (let j = 0; j < 2; j++) { gv[j] += e * U[c][j]; gu[c][j] += e * v[j]; } }
    hist.push({ G: G.map((r) => [r[0] - T.eta * gv[0], r[1] - T.eta * gv[1]]), O, U: U.map((u, i) => [u[0] - T.eta * gu[i][0], u[1] - T.eta * gu[i][1]]) });
  }
  const second = (st) => mean2([...st.G.slice(1, 1 + T.nS), ...st.O]);
  // The plane runs from −1.6 to 1.6 on both axes: every row and vector stays inside it at every step (within ±1.48).
  // Above it, the key takes up to three rows.
  const L = 66, R = 434, TOP = 100, B = 468, LIM = 1.6, KEY_Y = 20, KEY_ROW = 22;
  svg.setAttribute("viewBox", "0 0 460 526");
  const X = (x) => L + ((x + LIM) / (2 * LIM)) * (R - L), Y = (y) => B - ((y + LIM) / (2 * LIM)) * (B - TOP);
  const axes = el("g", { class: "axes" }, svg);
  el("rect", { x: L, y: TOP, width: R - L, height: B - TOP, class: "sw-frame" }, svg);
  el("line", { x1: X(0), y1: TOP, x2: X(0), y2: B, class: "sw-zero" }, axes);
  el("line", { x1: L, y1: Y(0), x2: R, y2: Y(0), class: "sw-zero" }, axes);
  for (const t of [-1, 0, 1]) {
    el("line", { x1: X(t), y1: B, x2: X(t), y2: B + 6 }, axes);
    el("text", { x: X(t), y: B + 21, "text-anchor": "middle", class: "tick" }, svg).textContent = fmt(t);
    el("line", { x1: L, y1: Y(t), x2: L - 6, y2: Y(t) }, axes);
    el("text", { x: L - 10, y: Y(t) + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = fmt(t);
  }
  axisName(svg, R, B + 44, "end", tr("first number", "primer número"));
  axisName(svg, L - 8, TOP - 16, "start", tr("second number", "segundo número"));
  // The key, above the frame: the rows both words have (filled), the target's alone (hollow), the second word's alone
  // (faint), then the observed and drawn words; its items fill rows from the top, each row ending at the frame's right,
  // laid out from the words' widths (again once the fonts have arrived).
  const key = el("g", {}, svg);
  const keyItems = [["shared", tr("shared rows", "filas en común")], ["hollow", tr(`only ${q(tw)}`, `solo ${q(tw)}`)], ["faint", tr(`only ${q(sw)}`, `solo ${q(sw)}`)], ["ctx", tr("observed", "observada")], ["neg", tr("drawn", "sorteada")]];
  function layoutKey() {
    key.replaceChildren();
    const items = keyItems.map(([cls, text]) => { const t = el("text", { y: 0, class: "sw-keytext" }, key); t.textContent = text; return { cls, t, w: 14 + t.getComputedTextLength() }; });
    const rows = [[]];
    let used = 0;
    for (const it of items) { if (rows[rows.length - 1].length && used + 18 + it.w > R - 4) { rows.push([]); used = 0; } used += (rows[rows.length - 1].length ? 18 : 0) + it.w; rows[rows.length - 1].push(it); }
    rows.forEach((row, r) => {
      const y = KEY_Y + r * KEY_ROW;
      let x = R - row.reduce((a, it) => a + it.w, 0) - 18 * (row.length - 1);
      for (const it of row) {
        if (it.cls === "ctx" || it.cls === "neg") el("circle", { cx: x + 5.5, cy: y - 5, r: 5.5, class: `sw-pt ${it.cls}` }, key);
        else el("circle", { cx: x + 5, cy: y - 5, r: 3.5, class: `sw-row-dot${it.cls === "shared" ? "" : ` ${it.cls}`}` }, key);
        it.t.setAttribute("x", x + 14); it.t.setAttribute("y", y);
        x += it.w + 18;
      }
    });
  }
  const tTrail = el("polyline", { class: "sw-trail tgt" }, svg), sTrail = el("polyline", { class: "sw-trail tgt" }, svg);
  const uTrails = [0, 1].map((i) => el("polyline", { class: `sw-trail ${i ? "neg" : "ctx"}` }, svg));
  const oDots = T.O.map(() => el("circle", { r: 3.5, class: "sw-row-dot faint" }, svg));
  const gDots = T.G.map((_, i) => el("circle", { r: 3.5, class: `sw-row-dot${i >= 1 && i <= T.nS ? "" : " hollow"}` }, svg));
  const uDots = [0, 1].map((i) => el("circle", { r: 6, class: `sw-pt ${i ? "neg" : "ctx"}` }, svg));
  const arrows = [0, 1].map(() => [el("line", { class: "sw-v" }, svg), el("path", { class: "sw-vhead" }, svg)]);
  const sRing = el("circle", { r: 6, class: "sw-ring" }, svg);
  const labs = [tw, sw, cw, dw].map((w, i) => { const t = el("text", { class: `sw-plab ${i < 2 ? "tgt" : i === 2 ? "ctx" : "neg"}` }, svg); t.textContent = q(w); return t; });
  const P = (p) => [X(p[0]), Y(p[1])];
  const shaft = (v) => { const [tx, ty] = P(v), n = Math.hypot(tx - X(0), ty - Y(0)), pts = []; for (let d = 0; d <= n; d += 3) pts.push([X(0) + ((tx - X(0)) * d) / n, Y(0) + ((ty - Y(0)) * d) / n]); return pts; };
  let spots = [];
  function layoutLabels() {
    spots = stepLabels({
      items: [
        { el: labs[0], text: () => q(tw), at: (j) => P(mean2(hist[j].G)), dot: false },
        { el: labs[1], text: () => q(sw), at: (j) => P(second(hist[j])), dot: false },
        { el: labs[2], text: () => q(cw), at: (j) => P(hist[j].U[0]), dot: true },
        { el: labs[3], text: () => q(dw), at: (j) => P(hist[j].U[1]), dot: true },
      ],
      steps: K + 1, frame: [L, R, TOP, B], zero: [X(0), Y(0)],
      arrows: (j) => [...shaft(mean2(hist[j].G)), ...shaft(second(hist[j]))], lines: () => [],
      others: (j) => [...hist[j].G, ...hist[j].O].map(P),
      dists: [9, 14, 22, 32, 44, 56],
    });
  }
  let k = 0, measuring = false;
  const $ = (s) => document.getElementById(`fig-train-${s}`);
  const nextBtn = $("next"), backBtn = $("back"), resetBtn = $("reset"), count = $("count");
  const arrowTo = ([line, head], v) => {
    const [tx, ty] = P(v), n = Math.hypot(tx - X(0), ty - Y(0)), cx = (tx - X(0)) / n, cy = (ty - Y(0)) / n;
    line.setAttribute("x1", X(0)); line.setAttribute("y1", Y(0)); line.setAttribute("x2", tx - cx * 9); line.setAttribute("y2", ty - cy * 9);
    head.setAttribute("d", `M${tx},${ty} L${tx - cx * 13 - cy * 6},${ty - cy * 13 + cx * 6} L${tx - cx * 13 + cy * 6},${ty - cy * 13 - cx * 6} Z`);
  };
  const cosv = (a, b) => (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
  function update() {
    const st = hist[k], vt = mean2(st.G), vs = second(st);
    st.G.forEach((r, i) => { const [x, y] = P(r); gDots[i].setAttribute("cx", x); gDots[i].setAttribute("cy", y); });
    st.O.forEach((r, i) => { const [x, y] = P(r); oDots[i].setAttribute("cx", x); oDots[i].setAttribute("cy", y); });
    st.U.forEach((u, i) => { const [x, y] = P(u); uDots[i].setAttribute("cx", x); uDots[i].setAttribute("cy", y); uTrails[i].setAttribute("points", hist.slice(0, k + 1).map((z) => P(z.U[i]).map((c) => c.toFixed(1)).join(",")).join(" ")); });
    tTrail.setAttribute("points", hist.slice(0, k + 1).map((z) => P(mean2(z.G)).map((c) => c.toFixed(1)).join(",")).join(" "));
    sTrail.setAttribute("points", hist.slice(0, k + 1).map((z) => P(second(z)).map((c) => c.toFixed(1)).join(",")).join(" "));
    arrowTo(arrows[0], vt); arrowTo(arrows[1], vs);
    const [rx, ry] = P(vs); sRing.setAttribute("cx", rx); sRing.setAttribute("cy", ry);
    labs.forEach((t, i) => { t.setAttribute("x", spots[k][i].x); t.setAttribute("y", spots[k][i].y); t.setAttribute("text-anchor", "middle"); });
    count.textContent = tr(`${k} of ${K} steps`, `${k} de ${K} pasos`);
    if (!measuring) {
      const focused = document.activeElement;
      backBtn.disabled = k === 0; nextBtn.disabled = k === K; resetBtn.hidden = k !== K;
      if (focused === nextBtn && nextBtn.disabled) resetBtn.focus();
      if (focused === backBtn && backBtn.disabled) nextBtn.focus();
      if (focused === resetBtn && resetBtn.hidden) backBtn.focus();
    }
    // The score and h from the vectors as the readout prints them, in hundredths.
    const s = Number((vt[0] * st.U[0][0] + vt[1] * st.U[0][1]).toFixed(2)), hh = sigma(s);
    const c0 = cosv(second(hist[0]), hist[0].U[0]), c = cosv(vs, st.U[0]);
    const n = T.nS + T.nO;
    const says = k === 0
      ? tr(`${q(sw)} is in no pair, but ${T.nS} of its ${n} rows are rows of ${q(tw)}; its cosine with ${q(cw)} is ${fmt(c0, 2)}.`, `${q(sw)} no está en ningún par, pero ${T.nS} de sus ${n} filas son filas de ${q(tw)}; su coseno con ${q(cw)} es ${fmt(c0, 2)}.`)
      : tr(`${q(sw)} is in no pair, but ${T.nS} of its ${n} rows are rows of ${q(tw)} and take each step, so its vector moves ${T.nS}/${n} as far; its cosine with ${q(cw)} went from ${fmt(c0, 2)} to ${fmt(c, 2)}.`, `${q(sw)} no está en ningún par, pero ${T.nS} de sus ${n} filas son filas de ${q(tw)} y dan cada paso, así que su vector avanza ${T.nS}/${n} de cada paso; su coseno con ${q(cw)} pasó de ${fmt(c0, 2)} a ${fmt(c, 2)}.`);
    out.innerHTML = `<p class="lbl">${k ? tr(`Step ${k}: the observed pair`, `Paso ${k}: el par observado`) : tr("At the start: the observed pair", "Al comienzo: el par observado")}</p>` +
      `<p class="eq"><span class="nowrap"><i>h</i> = σ(<i>u</i><sub>${cw}</sub><sup class="t">T</sup><i>v</i><sub>${tw}</sub>)</span> <span class="nowrap">= σ(${fmt(s, 2)})</span> <span class="nowrap">≈ ${fmt(hh, 2)}</span></p><p>${says}</p>`;
    svg.setAttribute("aria-label", tr(`The rows and vectors of ${tw} and ${sw}, and the context vectors of ${cw} and ${dw}, step ${k} of ${K}`, `Las filas y los vectores de ${tw} y ${sw}, y los vectores de contexto de ${cw} y ${dw}, paso ${k} de ${K}`));
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

/* ---------- Figure 6: which side goes in by its subwords ---------- */

// Sancho's line, as in the word2vec note, the target picked on its tiles; radius m = 2. The skip-gram of the paper sends
// the target in by its subwords of 3 to 6 and its own row, and each word around comes out whole; the CBOW of the web's
// tables sends the words around in by their subwords of 5 and their own rows, and the target comes out whole.
function sidesFigure() {
  const panel = document.getElementById("fig-sides");
  if (!panel) return;
  const out = document.getElementById("fig-sides-out");
  const LINE = lang === "es" ? ["aquellos", "que", "allí", "se", "parecen", "no", "son", "gigantes", "sino", "molinos", "de", "viento"] : ["what", "we", "see", "there", "are", "not", "giants", "but", "windmills"];
  const M = 2;
  let target = LINE.indexOf(lang === "es" ? "gigantes" : "giants"), mode = "sg";
  panel.append(h("p", "sw-head", tr("Sancho's line", "La línea de Sancho")));
  const line = h("div", "sw-line");
  const buttons = LINE.map((w) => { const b = h("button", "sw-tok", w); b.type = "button"; line.append(b); return b; });
  const inRow = h("div", "sw-side"), outRow = h("div", "sw-side");
  panel.append(line, inRow, outRow);
  const subsOf = (w, m) => (m === "sg" ? ngrams(w, 3, 6) : ngrams(w, 5, 5));
  function show([i, m]) {
    target = i; mode = m;
    const ctx = []; for (let j = Math.max(0, i - M); j <= Math.min(LINE.length - 1, i + M); j++) if (j !== i) ctx.push(j);
    buttons.forEach((b, j) => {
      const role = j === i ? "tgt" : ctx.includes(j) ? "ctx" : "";
      b.className = `sw-tok${role ? ` ${role}` : ""}${j === i ? " on" : ""}`;
      b.tabIndex = j === i ? 0 : -1; b.setAttribute("aria-pressed", String(j === i));
    });
    const w = LINE[i], tile = (g, cls) => `<span class="sw-tile ${cls}">${esc(g)}</span>`;
    const ownTile = (x, cls) => `<span class="sw-tile ${cls} own">${esc(x)}</span>`;
    let eq, says;
    if (m === "sg") {
      const subs = subsOf(w, "sg");
      inRow.innerHTML = `<p class="sw-sidelab">${tr("Goes in: rows of <i>W</i><sub>in</sub>, averaged", "Entra: filas de <i>W</i><sub>in</sub>, promediadas")}</p><div class="sw-tiles flow">${subs.map((g) => tile(g, "tgt")).join("")}${ownTile(w, "tgt")}</div>`;
      outRow.innerHTML = `<p class="sw-sidelab">${tr("Comes out: columns of <i>W</i><sub>out</sub>, whole, one pair each", "Sale: columnas de <i>W</i><sub>out</sub>, enteras, un par cada una")}</p><div class="sw-tiles flow">${ctx.map((j) => tile(LINE[j], "ctx")).join("")}</div>`;
      eq = `<span class="nowrap">${fmt(subs.length)} + 1</span> <span class="nowrap">= ${fmt(subs.length + 1)}</span>`;
      says = tr(`${q(w)} goes in by its ${subs.length} subwords of 3 to 6 characters and its own row: ${subs.length + 1} rows of <i>W</i><sub>in</sub>, averaged into <i>v</i><sub><i>o</i></sub>.`, `${q(w)} entra por sus ${subs.length} subwords de 3 a 6 caracteres y su fila propia: ${subs.length + 1} filas de <i>W</i><sub>in</sub>, promediadas en <i>v</i><sub><i>o</i></sub>.`);
    } else {
      const groups = ctx.map((j) => ({ w: LINE[j], subs: subsOf(LINE[j], "cbow") }));
      inRow.innerHTML = `<p class="sw-sidelab">${tr("Goes in: rows of <i>W</i><sub>in</sub>, averaged word by word, each word weighted by its place", "Entra: filas de <i>W</i><sub>in</sub>, promediadas palabra por palabra, cada palabra ponderada según su lugar")}</p><div class="sw-groups">${groups.map((g) => `<span class="sw-group">${g.subs.map((x) => tile(x, "ctx")).join("")}${ownTile(g.w, "ctx")}</span>`).join("")}</div>`;
      outRow.innerHTML = `<p class="sw-sidelab">${tr("Comes out: a column of <i>W</i><sub>out</sub>, whole", "Sale: una columna de <i>W</i><sub>out</sub>, entera")}</p><div class="sw-tiles flow">${tile(w, "tgt")}</div>`;
      const counts = groups.map((g) => g.subs.length + 1), total = counts.reduce((s, x) => s + x, 0);
      eq = `<span class="nowrap">${counts.map((x) => fmt(x)).join(" + ")}</span> <span class="nowrap">= ${fmt(total)}</span>`;
      const short = groups.filter((g) => !g.subs.length);
      says = tr(`${total} rows, from ${groups.map((g) => q(g.w)).join(", ")}: each word's rows are averaged, weighted by the word's place and combined to guess ${q(w)}.`, `${total} filas, de ${groups.map((g) => q(g.w)).join(", ")}: las filas de cada palabra se promedian, se ponderan según el lugar de la palabra y se combinan para adivinar ${q(w)}.`) +
        (short.length ? " " + tr(`${short.map((g) => q(g.w)).join(" and ")} ${short.length > 1 ? "have" : "has"} no subword of 5 characters; a word that short with no row would get the zero vector.`, `${short.map((g) => q(g.w)).join(" y ")} no ${short.length > 1 ? "tienen" : "tiene"} ningún subword de 5 caracteres; una palabra tan corta y sin fila recibiría el vector cero.`) : "");
    }
    out.innerHTML = `<p class="lbl">${m === "sg" ? tr(`Rows that go in for ${q(w)}`, `Filas que entran por ${q(w)}`) : tr(`Rows that go in around ${q(w)}`, `Filas que entran alrededor de ${q(w)}`)}</p><p class="eq">${eq}</p><p>${says}</p>`;
    panel.setAttribute("aria-label", tr(`Sancho's line with ${w} as the target, in the ${m === "sg" ? "skip-gram" : "CBOW"} model`, `La línea de Sancho con ${w} como objetivo, en el modelo ${m === "sg" ? "skip-gram" : "CBOW"}`));
  }
  roving(buttons, (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-sides-mode"), (m) => show([target, m]));
  show([target, mode]);
  const states = ["sg", "cbow"].flatMap((m) => LINE.map((_, i) => [i, m]));
  steadyHeight(panel, states, show, () => [target, mode]);
  steadyHeight(out, states, show, () => [target, mode]);
}

/* ---------- Figure 7: what subwords get right and wrong ---------- */

// A word with no vector, its closest word that shares its start (the shared start underlined in ink, as note 2 drew a
// lexeme) and its closest word that shares its end (underlined in carmine, as note 2 drew an ending); each cosine as a
// bar split into the shared subwords' part and the rest.
function splitFigure() {
  const panel = document.getElementById("fig-split");
  if (!panel) return;
  const out = document.getElementById("fig-split-out");
  const CH = D.chips7;
  let pick = 0;
  const head = h("p", "sw-picked"), measure = h("p", "sw-measure"), rows = h("div", "sw-rows split"), key = h("p", "sw-key");
  panel.append(head, measure, rows, key);
  key.innerHTML = `<span class="sw-ki"><span class="sw-sw start"></span><span>${tr("shared start", "inicio compartido")}</span></span><span class="sw-ki"><span class="sw-sw end"></span><span>${tr("shared end", "final compartido")}</span></span><span class="sw-ki"><span class="sw-sw rest"></span><span>${tr("the other subwords", "los demás subwords")}</span></span>`;
  const mark = (w, n, side) => side === "start" ? `<span class="sw-u start">${esc(w.slice(0, n))}</span>${esc(w.slice(n))}` : `${esc(w.slice(0, w.length - n))}<span class="sw-u end">${esc(w.slice(w.length - n))}</span>`;
  function show(i) {
    pick = i;
    const c = CH[i];
    head.innerHTML = `<span class="sw-picked-w">${c.w}</span> <span class="sw-picked-in">${tr(`no vector of its own, ${c.n} subwords`, `sin vector propio, ${c.n} subwords`)}</span>`;
    measure.innerHTML = tr(`cosine with ${q(c.w)}, by its subwords`, `coseno con ${q(c.w)}, según sus subwords`);
    const row = (p, side) => h("div", "sw-row split", `<span class="sw-word">${mark(p.w, side === "start" ? p.head : p.tail, side)}<span class="sw-k">${tr(`${p.k} shared`, `${p.k} compartidos`)}</span></span><span class="sw-track split"><span class="sw-bar ${side}" style="width:${(100 * Math.max(0, p.shared)).toFixed(1)}%"></span><span class="sw-bar rest" style="width:${(100 * Math.max(0, p.rest)).toFixed(1)}%"></span></span><span class="sw-val">${fmt(p.cos, 3)}</span>`);
    rows.replaceChildren(row(c.start, "start"), row(c.end, "end"));
    const win = c.end.cos > c.start.cos ? c.end : c.start, lose = win === c.end ? c.start : c.end, side = win === c.end ? "end" : "start";
    out.innerHTML = `<p class="lbl">${tr(`${q(c.w)} and the closer of the two, ${q(win.w)}`, `${q(c.w)} y la más cercana de las dos, ${q(win.w)}`)}</p>` +
      `<p class="eq"><span class="nowrap">cos θ = ${fmt(win.shared, 3)} + ${fmt(win.rest, 3)}</span> <span class="nowrap">≈ ${fmt(win.cos, 3)}</span></p>` +
      `<p>${tr(`The ${win.k} subwords shared with ${q(win.w)}, which shares its ${side}, give ${fmt(win.shared, 3)}; ${q(lose.w)} shares ${lose.k} and gets ${fmt(lose.shared, 3)} from them.`, `Los ${win.k} subwords compartidos con ${q(win.w)}, que comparte su ${side === "end" ? "final" : "inicio"}, dan ${fmt(win.shared, 3)}; ${q(lose.w)} comparte ${lose.k} y recibe ${fmt(lose.shared, 3)} de ellos.`)}</p>`;
    panel.setAttribute("aria-label", tr(`${c.w}: ${c.start.w}, sharing its start, ${fmt(c.start.cos, 3)}; ${c.end.w}, sharing its end, ${fmt(c.end.cos, 3)}`, `${c.w}: ${c.start.w}, que comparte su inicio, ${fmt(c.start.cos, 3)}; ${c.end.w}, que comparte su final, ${fmt(c.end.cos, 3)}`));
  }
  const markPick = picks(document.getElementById("fig-split-words"), CH.map((c) => c.w), show);
  markPick(0);
  show(0);
  steadyHeight(panel, CH.map((_, i) => i), show, () => pick);
  steadyHeight(out, CH.map((_, i) => i), show, () => pick);
}

oovFigure();
subwordsFigure();
sumFigure();
catalogFigure();
trainFigure();
sidesFigure();
splitFigure();
