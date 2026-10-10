// Figures of the note on what word vectors capture, on vectors trained on Don Quijote (the original on the Spanish page,
// Ormsby's translation on the English one) by skip-gram with negative sampling, d = 100: the angles between a word and
// every other word, against a bag of words; two targets that a shared context word pulls together, in a designed
// example of two numbers per vector; the odd one out of a list; analogies; the same words in vectors trained on the
// web (fastText); and two short texts pooled into one vector each.
// Carmine marks what is asked about or looked for, blue the vectors compared and the scores; green is the context
// word of figure 2 and ink the drawn words, as in the word2vec note.
import { el, tr, lang, modeButtons, roving, steadyHeight, stepLabels, localNum as fmt } from "../../plane.js";
import { DATA } from "./word-vectors-data.js";

const D = DATA[lang];
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const deg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
// A number in a product or a sum: in parentheses when negative, as (−0.84).
const factor = (x, d = 2) => (x < 0 ? `(${fmt(x, d)})` : fmt(x, d));
// An ordinal rank: 1st, 2nd, 408th; 1.ª in Spanish, which writes the ordinal of a word with a feminine º.
const ord = (n) => tr(`${fmt(n)}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`, `${fmt(n)}.ª`);
// Words quoted in a list: “a”, “b” and “c”; in Spanish, «a», «b» y «c», with e before a word that starts with the sound i.
const listOf = (ws) => (ws.length < 2 ? ws.map(q).join("") : `${ws.slice(0, -1).map(q).join(", ")}${tr(" and ", /^h?[ií](?![aeoáéó])/.test(ws.at(-1)) ? " e " : " y ")}${q(ws.at(-1))}`);
// int8 vectors in base64, times their scale.
const decode = (s, scale) => Array.from(atob(s), (c) => ((c.charCodeAt(0) << 24) >> 24) * scale);
// A row of buttons that pick one item, which the arrow keys move along; the item picked is outlined.
function picks(box, labels, onPick) {
  const buttons = labels.map((html) => { const b = h("button", "wv-pick", html); b.type = "button"; box.append(b); return b; });
  const mark = (i) => buttons.forEach((b, k) => { b.classList.toggle("on", k === i); b.tabIndex = k === i ? 0 : -1; b.setAttribute("aria-pressed", String(k === i)); });
  roving(buttons, (i) => { mark(i); onPick(i); });
  return mark;
}
// A bar's track and fill, with its value, in a figure made of words.
const bar = (frac, cls) => `<span class="wv-track"><span class="wv-bar${cls ? ` ${cls}` : ""}" style="width:${(100 * Math.max(0, Math.min(1, frac))).toFixed(1)}%"></span></span>`;

/* ---------- Figure 1: a word's vector and the closest words ---------- */

// The dial: the picked word's vector along 0°, its closest word's at their true angle and relative length (the two
// span a plane, where the angle is exact), and every other word of the vocabulary counted by its angle from the picked
// word, a faint bar per degree outside the rim. Under it, the two vectors' 100 numbers as bars above and below 0. As
// bags of words, all the other words sit at 90°, and each vector is a single 1 among the vocabulary's coordinates.
function dialFigure() {
  const svg = document.getElementById("fig-dial");
  if (!svg) return;
  const out = document.getElementById("fig-dial-out");
  const W = 460, H = 520, OX = 230, OY = 236, RIM = 124, HB = 150, HM = 50, A = 96;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const P = (r, a) => [OX + r * Math.cos((a * Math.PI) / 180), OY - r * Math.sin((a * Math.PI) / 180)];
  // The histogram's scale: the most words in one degree, over every chip, fills HM.
  const top = Math.max(...D.dial.flatMap((c) => c.hist.n));
  const g = el("g", { class: "axes" }, svg);
  el("path", { d: `M${OX - RIM},${OY} A${RIM},${RIM} 0 0 1 ${OX + RIM},${OY}`, class: "wv-rim" }, g);
  el("line", { x1: OX - RIM, y1: OY, x2: OX + RIM, y2: OY, class: "wv-rim" }, g);
  for (let a = 0; a <= 180; a += 30) { const [x1, y1] = P(RIM, a), [x2, y2] = P(RIM + 6, a); el("line", { x1, y1, x2, y2 }, g); }
  // The ends and the top of the rim, with their cosines.
  const fixed = [];
  const tick = (x, y, anchor, angle, cos) => {
    const t = el("text", { x, y, "text-anchor": anchor, class: "wv-tick" }, svg); t.textContent = `${angle}°`;
    const c = el("text", { x, y, dy: "1.2em", "text-anchor": anchor, class: "wv-tick faint" }, svg); c.textContent = `cos ${cos}`;
    fixed.push(t, c);
  };
  tick(OX + RIM + 10, OY + 5, "start", 0, "1");
  tick(OX - RIM - 10, OY + 5, "end", 180, fmt(-1));
  tick(OX + 6, OY - RIM + 18, "start", 90, "0");
  const histG = el("g", { class: "wv-hist" }, svg);
  const spikeLab = el("text", { x: OX, y: OY - HB - HM - 8, "text-anchor": "middle", class: "wv-lab faint" }, svg);
  // The bars' name, left of their top; the angle's, under the rim's diameter.
  const histName = el("text", { x: OX - 52, y: 62, "text-anchor": "end", class: "wv-axname" }, svg);
  histName.textContent = tr("words per degree", "palabras por grado");
  const angName = el("text", { x: OX, y: OY + 46, "text-anchor": "middle", class: "wv-axname" }, svg);
  const arc = el("path", { class: "wv-arc" }, svg), arcLab = el("text", { class: "wv-arclab", "text-anchor": "middle" }, svg);
  const vA = el("line", { class: "wv-v red" }, svg), hA = el("path", { class: "wv-head red" }, svg);
  const vB = el("line", { class: "wv-v blue" }, svg), hB = el("path", { class: "wv-head blue" }, svg);
  const labA = el("text", { class: "wv-lab red", "text-anchor": "end" }, svg), labB = el("text", { class: "wv-lab blue", "text-anchor": "end" }, svg);
  // The strips: 100 bars, 4 units apart, from x = 30, above and below a midline, 40 units per unit of value (the largest
  // number of any strip, 1.06, reaches 42).
  // Each strip names its two ways, + above the midline and − below it.
  const SX = 46, SW = 4, SH = 40, MID = [358, 470];
  const stripName = MID.map((m) => el("text", { x: SX - 4, y: m - 48, class: "wv-axname" }, svg));
  MID.forEach((m) => {
    el("line", { x1: SX - 4, y1: m, x2: SX + 100 * SW + 4, y2: m, class: "wv-mid" }, svg);
    el("text", { x: SX - 14, y: m - 8, "text-anchor": "middle", class: "wv-tick" }, svg).textContent = "+";
    el("text", { x: SX - 14, y: m + 18, "text-anchor": "middle", class: "wv-tick" }, svg).textContent = "−";
  });
  const strips = MID.map((_, k) => el("g", { class: `wv-strip ${k ? "blue" : "red"}` }, svg));
  const arrow = (line, head, a, len) => {
    const [tx, ty] = P(len, a), [bx, by] = P(len - 9, a), c = Math.cos((a * Math.PI) / 180), s = -Math.sin((a * Math.PI) / 180);
    line.setAttribute("x1", OX); line.setAttribute("y1", OY); line.setAttribute("x2", bx); line.setAttribute("y2", by);
    head.setAttribute("d", `M${tx},${ty} L${tx - c * 13 - s * 6},${ty - s * 13 + c * 6} L${tx - c * 13 + s * 6},${ty - s * 13 - c * 6} Z`);
    return [tx, ty];
  };
  let chip = 0, mode = "emb";
  function show([ci, m]) {
    chip = ci; mode = m;
    const c = D.dial[ci], b = c.top[0], emb = m === "emb";
    // The cosine as the readout writes it, from the printed dot product and lengths.
    const cos = emb ? b.dot / (b.len * c.len) : 0, theta = emb ? deg(Number(cos.toFixed(2))) : 90;
    histG.replaceChildren();
    if (emb) {
      c.hist.n.forEach((n, i) => {
        if (!n) return;
        const a = c.hist.from + i + 0.5, [x1, y1] = P(HB, a), [x2, y2] = P(HB + (HM * n) / top, a);
        el("line", { x1, y1, x2, y2 }, histG);
      });
      spikeLab.textContent = "";
    } else {
      // Every other word at 90°, clipped.
      el("line", { x1: OX, y1: OY - HB, x2: OX, y2: OY - HB - HM, class: "spike" }, histG);
      spikeLab.textContent = tr(`all ${fmt(D.V - 1)} other words`, `las otras ${fmt(D.V - 1)} palabras`);
    }
    angName.textContent = tr(`angle from ${q(c.w)}`, `ángulo desde ${q(c.w)}`);
    const lenB = emb ? A * Math.min(1.25, b.len / c.len) : A;
    const [ax, ay] = arrow(vA, hA, 0, A), [bx, by] = arrow(vB, hB, theta, lenB);
    labA.textContent = q(c.w); labA.setAttribute("x", ax - 4); labA.setAttribute("y", ay + 22);
    // The arc, and two labels placed each at the first of its places that covers no other text and no arrow: the
    // angle's inside the angle, or just beyond the blue arrow when the angle is narrow, then the closest word's around
    // its arrow's tip (above it to the left, to the left, beyond the tip, above it to the right, to the right).
    const r = 34, [x0, y0] = P(r, 0), [x1, y1] = P(r, theta);
    arc.setAttribute("d", `M${x0},${y0} A${r},${r} 0 0 0 ${x1},${y1}`);
    labB.textContent = q(b.w); arcLab.textContent = `${fmt(theta, 0)}°`;
    const onArrow = (bb, [tx, ty]) => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].some((f) => { const px = OX + (tx - OX) * f, py = OY + (ty - OY) * f; return px > bb.x - 2 && px < bb.x + bb.width + 2 && py > bb.y - 2 && py < bb.y + bb.height + 2; });
    const place = (t, spots, others) => {
      const boxes = others.map((o) => o.getBBox());
      const hits = () => { const bb = t.getBBox(); return boxes.some((o) => bb.x < o.x + o.width + 2 && o.x < bb.x + bb.width + 2 && bb.y < o.y + o.height + 2 && o.y < bb.y + bb.height + 2) || onArrow(bb, [ax, ay]) || onArrow(bb, [bx, by]) || bb.x < 2 || bb.x + bb.width > W - 2; };
      const put = ([anchor, x, y]) => { t.setAttribute("text-anchor", anchor); t.setAttribute("x", x); t.setAttribute("y", y); };
      for (const sp of spots) { put(sp); if (!hits()) return; }
      put(spots[0]);
    };
    const ux = Math.cos((theta * Math.PI) / 180), uy = -Math.sin((theta * Math.PI) / 180);
    const inside = [58, 68, 78].map((rr) => { const [x, y] = P(rr, theta / 2); return ["middle", x, y + 5]; });
    const beyond = [[60, 16], [70, 20], [80, 24]].map(([rr, da]) => { const [x, y] = P(rr, theta + da); return ["middle", x, y + 5]; });
    labB.setAttribute("x", -999);
    place(arcLab, theta >= 30 ? [...inside, ...beyond] : [...beyond, ...inside], [...fixed, labA]);
    place(labB, [["end", bx - 6, by - 9], ["end", bx - 10, by + 5], ["middle", bx + ux * 18, by + uy * 18 + 5], ["start", bx + 6, by - 9], ["start", bx + 10, by + 5]], [...fixed, labA, arcLab]);
    // The strips.
    const vecs = [decode(c.strips[0], D.dialScale), decode(c.strips[1], D.dialScale)];
    [c, b].forEach((x, k) => {
      const g2 = strips[k];
      g2.replaceChildren();
      if (emb) {
        stripName[k].innerHTML = tr(`the 100 numbers of ${q(x.w)}`, `los 100 números de ${q(x.w)}`);
        vecs[k].forEach((v, j) => {
          const y = MID[k] - v * SH;
          el("rect", { x: SX + j * SW + 0.4, y: Math.min(y, MID[k]), width: SW - 0.8, height: Math.max(0.6, Math.abs(y - MID[k])) }, g2);
        });
      } else {
        stripName[k].innerHTML = tr(`${q(x.w)}: a 1 at place ${fmt(x.rank)} of ${fmt(D.V)}`, `${q(x.w)}: un 1 en el lugar ${fmt(x.rank)} de ${fmt(D.V)}`);
        const x0s = SX + ((x.rank - 1) / (D.V - 1)) * 100 * SW;
        el("rect", { x: x0s - 1.2, y: MID[k] - 30, width: 2.4, height: 30 }, g2);
      }
    });
    const [b2, b3] = c.top.slice(1).map((t) => q(t.w));
    out.innerHTML = emb
      ? `<p class="lbl">${tr(`The angle between ${q(c.w)} and its closest word`, `El ángulo entre ${q(c.w)} y su palabra más cercana`)}</p>` +
        `<p class="eq"><span class="nowrap">cos θ = <span class="frac"><span><i>v</i><sub><i>w</i></sub><sup class="t">T</sup><i>v</i><sub><i>w</i>′</sub></span><span>‖<i>v</i><sub><i>w</i></sub>‖ ‖<i>v</i><sub><i>w</i>′</sub>‖</span></span></span> <span class="nowrap">= <span class="frac"><span>${fmt(b.dot, 2)}</span><span>${fmt(c.len, 2)} · ${fmt(b.len, 2)}</span></span></span> <span class="nowrap">≈ ${fmt(cos, 2)},</span> <span class="nowrap">θ ≈ ${fmt(theta, 0)}°</span></p>` +
        `<p>${tr(`${q(b.w)} is the closest of the other ${fmt(D.V - 1)} words, then ${b2} and ${b3}; half of them lie more than ${c.median}° away.`, `${q(b.w)} es la más cercana de las otras ${fmt(D.V - 1)} palabras, y le siguen ${b2} y ${b3}; la mitad está a más de ${c.median}°.`)}</p>`
      : `<p class="lbl">${tr(`${q(c.w)} and ${q(b.w)} as bags of words`, `${q(c.w)} y ${q(b.w)} como bolsas de palabras`)}</p>` +
        `<p class="eq"><span class="nowrap">cos θ = <span class="frac"><span>0</span><span>1 · 1</span></span></span> <span class="nowrap">= 0,</span> <span class="nowrap">θ = 90°</span></p>` +
        `<p>${tr("Two different words share no coordinate: as bags of words, every word sits at 90° from every other.", "Dos palabras distintas no comparten ninguna coordenada: como bolsas de palabras, cada palabra está a 90° de todas las demás.")}</p>`;
    svg.setAttribute("aria-label", emb
      ? tr(`The vectors of ${c.w} and ${b.w}, ${fmt(theta, 0)}° apart, and the angles of all the other words from ${c.w}`, `Los vectores de ${c.w} y ${b.w}, a ${fmt(theta, 0)}°, y los ángulos de todas las demás palabras desde ${c.w}`)
      : tr(`${c.w} and ${b.w} as bags of words, at 90°, like every other word`, `${c.w} y ${b.w} como bolsas de palabras, a 90°, como todas las demás`));
  }
  const mark = picks(document.getElementById("fig-dial-words"), D.dial.map((c) => c.w), (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-dial-mode"), (m) => show([chip, m]));
  mark(0);
  show([0, "emb"]);
  steadyHeight(out, D.dial.flatMap((_, i) => [[i, "emb"], [i, "bow"]]), show, () => [chip, mode]);
}

/* ---------- Figure 2: words that fill the same blanks ---------- */

const sigma = (s) => 1 / (1 + Math.exp(-s));
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];

// A designed example in two numbers per vector: two targets (carmine arrows), a context word both are seen with
// (green), and one word drawn from the book for each target (ink). Each step is a step of gradient descent on the four
// pairs' mean binary cross-entropy, moving every vector. In the second mode the second target is seen instead with a
// word of its own. A blue arc marks the angle between the two targets.
function blankFigure() {
  const svg = document.getElementById("fig-blank");
  if (!svg) return;
  const out = document.getElementById("fig-blank-out");
  const T = D.toy, K = T.steps;
  // The context vectors: 0 the shared word, 1 and 2 the drawn words of the first and second target, 3 the second
  // target's own word (in the second mode only). Pairs: [target, context, y].
  const PAIRS = { shared: [[0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 2, 0]], own: [[0, 0, 1], [1, 3, 1], [0, 1, 0], [1, 2, 0]] };
  const run = (pairs) => {
    const hist = [{ v: T.v0, u: T.u0 }];
    for (let s = 0; s < K; s++) {
      const { v, u } = hist[s], gv = v.map(() => [0, 0]), gu = u.map(() => [0, 0]);
      for (const [o, c, y] of pairs) { const e = (sigma(dot2(v[o], u[c])) - y) / pairs.length; for (let j = 0; j < 2; j++) { gv[o][j] += e * u[c][j]; gu[c][j] += e * v[o][j]; } }
      hist.push({ v: v.map((x, i) => [x[0] - T.eta * gv[i][0], x[1] - T.eta * gv[i][1]]), u: u.map((x, i) => [x[0] - T.eta * gu[i][0], x[1] - T.eta * gu[i][1]]) });
    }
    return hist;
  };
  const HIST = { shared: run(PAIRS.shared), own: run(PAIRS.own) };
  // Which context vectors each mode draws: the second target's own word only in the second.
  const SHOWN = { shared: [0, 1, 2], own: [0, 3, 1, 2] };
  const WORD = [T.shared, T.drawn[0], T.drawn[1], T.own], KIND = ["ctx", "neg", "neg", "ctx"];

  // The plane runs from −1.8 to 1.8 on both axes: every vector stays inside it at every step, in both modes (within
  // −1.69 and 1.69).
  const L = 66, R = 434, TOP = 78, B = 446, LIM = 1.8, KEY_Y = 20;
  svg.setAttribute("viewBox", "0 0 460 504");
  const X = (x) => L + ((x + LIM) / (2 * LIM)) * (R - L), Y = (y) => B - ((y + LIM) / (2 * LIM)) * (B - TOP);
  const axes = el("g", { class: "axes" }, svg);
  el("rect", { x: L, y: TOP, width: R - L, height: B - TOP, class: "wv-frame" }, svg);
  el("line", { x1: X(0), y1: TOP, x2: X(0), y2: B, class: "wv-zero" }, axes);
  el("line", { x1: L, y1: Y(0), x2: R, y2: Y(0), class: "wv-zero" }, axes);
  for (const t of [-1, 0, 1]) {
    el("line", { x1: X(t), y1: B, x2: X(t), y2: B + 6 }, axes);
    el("text", { x: X(t), y: B + 21, "text-anchor": "middle", class: "tick" }, svg).textContent = fmt(t);
    el("line", { x1: L, y1: Y(t), x2: L - 6, y2: Y(t) }, axes);
    el("text", { x: L - 10, y: Y(t) + 4.5, "text-anchor": "end", class: "tick" }, svg).textContent = fmt(t);
  }
  el("text", { x: R, y: B + 44, "text-anchor": "end", class: "wv-axname" }, svg).textContent = tr("first number", "primer número");
  el("text", { x: L - 8, y: TOP - 16, "text-anchor": "start", class: "wv-axname" }, svg).textContent = tr("second number", "segundo número");
  // The key, above the frame at the right, laid out from the words' widths (again once the fonts have arrived).
  const key = el("g", { class: "wv-keyg" }, svg);
  const keyItems = [["tgt", tr("targets", "objetivos")], ["ctx", tr("observed", "observadas")], ["neg", tr("drawn", "sorteadas")]];
  function layoutKey() {
    key.replaceChildren();
    let kx = R;
    for (const [cls, text] of [...keyItems].reverse()) {
      const t = el("text", { x: kx, y: KEY_Y, "text-anchor": "end", class: "wv-keytext" }, key);
      t.textContent = text;
      const sx = kx - t.getComputedTextLength() - 12;
      if (cls === "tgt") { el("line", { x1: sx - 14, y1: KEY_Y - 5, x2: sx + 4, y2: KEY_Y - 5, class: "wv-v red" }, key); el("path", { d: `M${sx + 7},${KEY_Y - 5} l-8,-4.5 v9 z`, class: "wv-head red" }, key); }
      else el("circle", { cx: sx, cy: KEY_Y - 5, r: 5.5, class: `wv-pt ${cls}` }, key);
      kx = sx - 22;
    }
  }
  const arc = el("path", { class: "wv-arc" }, svg);
  const trails = WORD.map((_, i) => el("polyline", { class: `wv-trail ${KIND[i]}` }, svg));
  const vTrails = [0, 1].map(() => el("polyline", { class: "wv-trail tgt" }, svg));
  const dots = WORD.map((_, i) => el("circle", { r: 6, class: `wv-pt ${KIND[i]}` }, svg));
  const arrows = [0, 1].map(() => [el("line", { class: "wv-v red" }, svg), el("path", { class: "wv-head red" }, svg)]);
  const labels = WORD.map((w, i) => { const t = el("text", { class: `wv-plab ${KIND[i]}` }, svg); t.textContent = q(w); return t; });
  const vLabs = T.targets.map((w) => { const t = el("text", { class: "wv-plab tgt" }, svg); t.textContent = q(w); return t; });

  const tipOf = (v) => [X(v[0]), Y(v[1])];
  // Points sampled along both arrows, for placing the labels.
  const arrowPts = (s) => s.v.flatMap((v) => {
    const [tx, ty] = tipOf(v), len = Math.hypot(tx - X(0), ty - Y(0)), pts = [];
    for (let d = 0; d <= len; d += 3) pts.push([X(0) + ((tx - X(0)) * d) / len, Y(0) + ((ty - Y(0)) * d) / len]);
    return pts;
  });
  const spots = {};
  function layoutLabels() {
    // A hidden label measures as empty: every label is shown while the places are worked out, and update() hides
    // again the ones the mode on show does not draw.
    for (const t of labels) t.style.display = "";
    for (const m of ["shared", "own"]) {
      const hist = HIST[m], shown = SHOWN[m];
      spots[m] = stepLabels({
        items: [...[0, 1].map((i) => ({ el: vLabs[i], text: () => q(T.targets[i]), at: (j) => tipOf(hist[j].v[i]), dot: false })),
          ...shown.map((c) => ({ el: labels[c], text: () => q(WORD[c]), at: (j) => tipOf(hist[j].u[c]), dot: true }))],
        steps: K + 1, frame: [L, R, TOP, B], zero: [X(0), Y(0)], arrows: (j) => arrowPts(hist[j]), lines: () => [],
      });
    }
  }

  let k = 0, mode = "shared", measuring = false;
  const $ = (s) => document.getElementById(`fig-blank-${s}`);
  const nextBtn = $("next"), backBtn = $("back"), resetBtn = $("reset"), count = $("count");
  // The angle between the two targets, from their coordinates as the readout prints them.
  const printed = (v) => v.map((x) => Number(x.toFixed(2)));
  const angleOf = (s) => {
    const [a, b] = s.v.map(printed), n = (x) => Number(Math.hypot(...x).toFixed(2));
    const c = (a[0] * b[0] + a[1] * b[1]) / (n(a) * n(b));
    return { a, b, na: n(a), nb: n(b), cos: c, theta: deg(Number(c.toFixed(2))) };
  };
  function update() {
    const hist = HIST[mode], s = hist[k], shown = SHOWN[mode];
    WORD.forEach((_, i) => {
      const on = shown.includes(i);
      for (const e of [dots[i], trails[i], labels[i]]) e.style.display = on ? "" : "none";
      if (!on) return;
      const [x, y] = tipOf(s.u[i]);
      dots[i].setAttribute("cx", x); dots[i].setAttribute("cy", y);
      trails[i].setAttribute("points", hist.slice(0, k + 1).map((p) => `${X(p.u[i][0]).toFixed(1)},${Y(p.u[i][1]).toFixed(1)}`).join(" "));
    });
    s.v.forEach((v, i) => {
      vTrails[i].setAttribute("points", hist.slice(0, k + 1).map((p) => `${X(p.v[i][0]).toFixed(1)},${Y(p.v[i][1]).toFixed(1)}`).join(" "));
      const [tx, ty] = tipOf(v), len = Math.hypot(tx - X(0), ty - Y(0)), cx = (tx - X(0)) / len, cy = (ty - Y(0)) / len;
      const [line, head] = arrows[i];
      line.setAttribute("x1", X(0)); line.setAttribute("y1", Y(0)); line.setAttribute("x2", tx - cx * 9); line.setAttribute("y2", ty - cy * 9);
      head.setAttribute("d", `M${tx},${ty} L${tx - cx * 13 - cy * 6},${ty - cy * 13 + cx * 6} L${tx - cx * 13 + cy * 6},${ty - cy * 13 - cx * 6} Z`);
    });
    // The arc between the two targets, the short way round, 30 units from the origin.
    const a0 = Math.atan2(s.v[0][1], s.v[0][0]), a1 = Math.atan2(s.v[1][1], s.v[1][0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const r = 30, p0 = [X(0) + r * Math.cos(a0), Y(0) - r * Math.sin(a0)], p1 = [X(0) + r * Math.cos(a0 + da), Y(0) - r * Math.sin(a0 + da)];
    arc.setAttribute("d", `M${p0[0]},${p0[1]} A${r},${r} 0 0 ${da > 0 ? 0 : 1} ${p1[0]},${p1[1]}`);
    const sp = spots[mode][k], items = [...vLabs, ...shown.map((c) => labels[c])];
    items.forEach((t, i) => { t.setAttribute("x", sp[i].x); t.setAttribute("y", sp[i].y); t.setAttribute("text-anchor", "middle"); });
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
    const A0 = angleOf(hist[0]), An = angleOf(s), [wa, wb] = T.targets.map(q);
    const eq = `<span class="nowrap">cos θ</span> <span class="nowrap">= <span class="frac"><span>${factor(An.a[0])}·${factor(An.b[0])} + ${factor(An.a[1])}·${factor(An.b[1])}</span><span>${fmt(An.na, 2)} · ${fmt(An.nb, 2)}</span></span></span> <span class="nowrap">≈ ${fmt(An.cos, 2)},</span> <span class="nowrap">θ ≈ ${fmt(An.theta, 0)}°</span>`;
    const says = k === 0
      ? (mode === "shared"
        ? tr(`At the start, ${wa} and ${wb} are ${fmt(A0.theta, 0)}° apart. They never form a pair, but both are seen with ${q(T.shared)}.`, `Al comienzo, ${wa} y ${wb} están a ${fmt(A0.theta, 0)}°. Nunca forman un par, pero las dos aparecen con ${q(T.shared)}.`)
        : tr(`At the start, ${wa} and ${wb} are ${fmt(A0.theta, 0)}° apart. ${wa} is seen with ${q(T.shared)}, and ${wb} with ${q(T.own)}.`, `Al comienzo, ${wa} y ${wb} están a ${fmt(A0.theta, 0)}°. ${wa} aparece con ${q(T.shared)}, y ${wb} con ${q(T.own)}.`))
      : (mode === "shared"
        ? tr(`${wa} and ${wb} never formed a pair: ${fmt(A0.theta, 0)}° apart at the start, ${fmt(An.theta, 0)}° now.`, `${wa} y ${wb} nunca formaron un par: a ${fmt(A0.theta, 0)}° al comienzo, a ${fmt(An.theta, 0)}° ahora.`)
        : tr(`${fmt(A0.theta, 0)}° apart at the start, ${fmt(An.theta, 0)}° now: nothing pulls the two targets together.`, `A ${fmt(A0.theta, 0)}° al comienzo, a ${fmt(An.theta, 0)}° ahora: nada acerca a los dos objetivos.`));
    out.innerHTML = `<p class="lbl">${k ? tr(`Step ${k}: the angle between the two targets`, `Paso ${k}: el ángulo entre los dos objetivos`) : tr("At the start: the angle between the two targets", "Al comienzo: el ángulo entre los dos objetivos")}</p>` +
      `<p class="eq">${eq}</p><p>${says}</p>`;
    svg.setAttribute("aria-label", tr(`The vectors of ${T.targets.join(" and ")}, ${fmt(An.theta, 0)}° apart, with the words they were seen with and two drawn words, step ${k} of ${K}`, `Los vectores de ${T.targets.join(" y ")}, a ${fmt(An.theta, 0)}°, con las palabras con que aparecieron y dos palabras sorteadas, paso ${k} de ${K}`));
  }
  const go = (d) => { const j = Math.max(0, Math.min(K, k + d)); if (j !== k) { k = j; update(); } };
  nextBtn.addEventListener("click", () => go(1));
  backBtn.addEventListener("click", () => go(-1));
  resetBtn.addEventListener("click", () => { k = 0; update(); nextBtn.focus(); });
  svg.closest(".fig").addEventListener("keydown", (e) => {
    if (e.target.closest(".modes")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  // A new mode starts again from the first step.
  modeButtons(document.getElementById("fig-blank-mode"), (m) => { mode = m; k = 0; update(); });
  const relayout = () => { layoutKey(); layoutLabels(); update(); };
  relayout();
  document.fonts.ready.then(relayout);
  matchMedia("(max-width: 560px)").addEventListener("change", relayout);
  const states = ["shared", "own"].flatMap((m) => HIST[m].map((_, i) => [m, i]));
  steadyHeight(out, states, ([m, i]) => { measuring = true; mode = m; k = i; update(); measuring = false; }, () => [mode, k]);
}

/* ---------- Figure 3: the odd one out ---------- */

// Sixteen words in four rows the reader picks from; for the list picked, the length of the sum of the others' vectors
// without each word, from the two-decimal cosines and lengths, on vectors scaled to length 1 or as trained. The
// longest sum, and the word left out of it, are carmine; sums within 0.01 of the longest are a tie, carmine too.
function oddFigure() {
  const panel = document.getElementById("fig-odd");
  if (!panel) return;
  const out = document.getElementById("fig-odd-out");
  const O = D.odd, n = O.words.length;
  const cosAt = (i, j) => (i === j ? 1 : O.cos[i < j ? (i * (2 * n - i - 1)) / 2 + (j - i - 1) : (j * (2 * n - j - 1)) / 2 + (i - j - 1)]);
  const sumLen = (idx, unit) => Math.sqrt(idx.reduce((s, i) => s + idx.reduce((t, j) => t + (unit ? 1 : O.lens[i] * O.lens[j]) * cosAt(i, j), 0), 0));
  let picked = new Set(O.start.map((w) => O.words.indexOf(w))), mode = "unit";
  panel.append(h("p", "wv-head", tr("Pick three to six words", "Elige de tres a seis palabras")));
  const grid = h("div", "wv-grid");
  const buttons = O.words.map((w) => { const b = h("button", "wv-pick", w); b.type = "button"; grid.append(b); return b; });
  panel.append(grid);
  const measure = h("p", "wv-measure"), rows = h("div", "wv-rows");
  panel.append(measure, rows);
  let focusAt = 0;
  roving(buttons, (i) => { focusAt = i; buttons.forEach((b, k) => (b.tabIndex = k === i ? 0 : -1)); });
  buttons.forEach((b, i) => b.addEventListener("click", () => {
    if (picked.has(i)) picked.delete(i);
    else if (picked.size < 6) picked.add(i);
    show([[...picked].sort((a, c) => a - c), mode]);
  }));
  buttons.forEach((b, k) => (b.tabIndex = k === focusAt ? 0 : -1));
  // The sum may break before each plus sign on narrow screens.
  const vsum = (ws) => ws.map((w, k) => `<span class="nowrap">${k ? "+ " : "‖"}<i>v</i><sub>${w}</sub>${k === ws.length - 1 ? "‖" : ""}</span>`).join(" ");
  function show([list, m]) {
    picked = new Set(list); mode = m;
    const unit = m === "unit";
    buttons.forEach((b, i) => { b.classList.toggle("in", picked.has(i)); b.setAttribute("aria-pressed", String(picked.has(i))); b.setAttribute("aria-disabled", String(!picked.has(i) && picked.size >= 6)); });
    if (list.length < 3) {
      measure.textContent = "";
      rows.replaceChildren();
      out.innerHTML = `<p class="lbl">${tr("The odd one out", "El cuarto excluido")}</p><p>${tr(list.length ? `Pick at least three words: the list has ${list.length}.` : "Pick at least three words.", list.length ? `Elige al menos tres palabras: la lista tiene ${list.length}.` : "Elige al menos tres palabras.")}</p>`;
      return;
    }
    const lens = list.map((i) => sumLen(list.filter((j) => j !== i), unit)), shown = lens.map((x) => Math.round(x * 100));
    const best = Math.max(...shown), winners = list.filter((_, k) => shown[k] >= best - 1);
    const max = Math.max(...lens);
    measure.textContent = tr("length of the sum without it", "largo de la suma sin ella");
    rows.replaceChildren(...list.map((i, k) => {
      const win = winners.includes(i);
      const r = h("div", `wv-row${win ? " win" : ""}`, `<span class="wv-word">${O.words[i]}</span>${bar(lens[k] / max, win ? "red" : "")}<span class="wv-val">${fmt(lens[k], 2)}</span>`);
      return r;
    }));
    const wi = list[shown.indexOf(best)], others = list.filter((j) => j !== wi);
    const second = list.filter((j) => j !== wi).reduce((a, j) => (lens[list.indexOf(j)] > lens[list.indexOf(a)] ? j : a), others[0]);
    const names = others.map((j) => O.words[j]);
    let eq;
    if (unit) {
      const cs = []; others.forEach((a, x) => others.slice(x + 1).forEach((b) => cs.push(cosAt(a, b))));
      const total = cs.reduce((s, c) => s + c, 0);
      eq = others.length === 3
        ? `${vsum(names)} <span class="nowrap">= √(3 + 2(${cs.map((c) => fmt(c, 2)).join(" + ")}))</span> <span class="nowrap">≈ ${fmt(lens[list.indexOf(wi)], 2)}</span>`
        : `${vsum(names)} <span class="nowrap">= √(${others.length} + 2 · ${fmt(total, 2)})</span> <span class="nowrap">≈ ${fmt(lens[list.indexOf(wi)], 2)}</span>`;
      if (others.length === 2) eq += `</p><p class="wv-note">${tr(`${fmt(total, 2)} is the cosine between ${listOf(names)}.`, `${fmt(total, 2)} es el coseno entre ${listOf(names)}.`)}`;
      else if (others.length > 3) eq += `</p><p class="wv-note">${tr(`${fmt(total, 2)} is the sum of the ${cs.length} cosines between the ${others.length} words.`, `${fmt(total, 2)} es la suma de los ${cs.length} cosenos entre las ${others.length} palabras.`)}`;
    } else eq = `${vsum(names)} <span class="nowrap">≈ ${fmt(lens[list.indexOf(wi)], 2)}</span>`;
    const shortest = list.reduce((a, j) => (O.lens[j] < O.lens[a] ? j : a), list[0]);
    let says;
    if (winners.length > 1) says = tr(`No word stands out: the sums without ${listOf(winners.map((j) => O.words[j]))} are within 0.01 of each other.`, `Ninguna palabra sobresale: las sumas sin ${listOf(winners.map((j) => O.words[j]))} están a menos de 0.01 entre sí.`);
    else if (!unit && wi === shortest) says = tr(`${q(O.words[wi])}, the shortest vector of the list (${fmt(O.lens[wi], 2)}), takes least away when left out.`, `${q(O.words[wi])}, el vector más corto de la lista (${fmt(O.lens[wi], 2)}), es el que menos resta al quedar fuera.`);
    else says = tr(`Without ${q(O.words[wi])} the sum is longest, so ${q(O.words[wi])} is the odd one out; the next longest sum, without ${q(O.words[second])}, is ${fmt(lens[list.indexOf(second)], 2)}.`, `Sin ${q(O.words[wi])} la suma es la más larga, así que ${q(O.words[wi])} es el cuarto excluido; la siguiente, sin ${q(O.words[second])}, mide ${fmt(lens[list.indexOf(second)], 2)}.`);
    out.innerHTML = `<p class="lbl">${winners.length > 1 ? tr("The longest sums", "Las sumas más largas") : tr(`The longest sum, without ${q(O.words[wi])}`, `La suma más larga, sin ${q(O.words[wi])}`)}</p><p class="eq">${eq}</p><p>${says}</p>`;
  }
  modeButtons(document.getElementById("fig-odd-mode"), (m) => show([[...picked].sort((a, c) => a - c), m]));
  const start = () => [[...picked].sort((a, c) => a - c), mode];
  show(start());
  // The tallest states, found by measuring every list of 3 to 6 words in both modes at every 20 px from 320 to 1280 in
  // both languages (oddsweep.mjs and pick-tall.mjs, in the course's private materials): the first six words for the
  // panel, and ten lists that hold a tallest readout at every width, in both modes; and the start.
  const TALL = [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 6, 13], [0, 1, 2, 3, 11, 15], [0, 1, 2, 10, 13, 15], [0, 10, 11, 13, 14, 15], [0, 1, 2, 4, 5, 15],
    [0, 2, 3, 10, 13, 14], [0, 1, 2, 12, 13, 15], [0, 11, 15], [0, 2, 3, 10, 11, 13], [8, 9, 11, 13, 14, 15]];
  const states = [start(), ...TALL.flatMap((l) => [[l, "unit"], [l, "raw"]])];
  steadyHeight(panel, states, show, start);
  steadyHeight(out, states, show, start);
}

/* ---------- Figure 4: analogies ---------- */

// Four analogies the reader picks from; for each, the words closest to b − a + a* (or to b alone), on vectors scaled to
// length 1, with their cosines as blue bars. The given words stay in the list at their rank, faint and struck through;
// the first other word is the answer, carmine, also written in the "?" tile.
function analogyFigure() {
  const panel = document.getElementById("fig-analogy");
  if (!panel) return;
  const out = document.getElementById("fig-analogy-out");
  const AN = D.analogies;
  let pick = 0, mode = "diff";
  const tiles = h("div", "wv-tiles"), measure = h("p", "wv-measure"), rows = h("div", "wv-rows");
  panel.append(tiles, measure, rows);
  const asText = (a) => `${a.q[0]} : ${a.q[1]} :: ${a.q[2]} : ?`;
  function show([p, m]) {
    pick = p; mode = m;
    const a = AN[p], M = a.modes[m], [wa, was, wb, want] = a.q;
    const answer = M.list.find((x) => !x.given);
    tiles.innerHTML = [wa, ":", was, "::", wb, ":"].map((x) => (x.includes(":") ? `<span class="wv-sep">${x}</span>` : `<span class="wv-tile">${x}</span>`)).join("") + `<span class="wv-tile ans">${answer.w}</span>`;
    measure.innerHTML = m === "diff" ? tr("cosine with <i>b</i> − <i>a</i> + <i>a</i>*", "coseno con <i>b</i> − <i>a</i> + <i>a</i>*") : tr("cosine with <i>b</i>", "coseno con <i>b</i>");
    rows.replaceChildren(...M.list.map((x) => {
      const cls = x.given ? " given" : x === answer ? " win" : "";
      return h("div", `wv-row${cls}`, `<span class="wv-word"><span class="wv-w">${x.w}</span>${x.given ? ` <span class="wv-tag">${tr("given", "dada")}</span>` : ""}</span>${bar(x.cos, x === answer ? "red" : x.given ? "faint" : "")}<span class="wv-val">${fmt(x.cos, 3)}</span>`);
    }));
    const rank = M.rank, given = M.list.filter((x) => x.given && x.cos > (M.list.find((y) => y.w === want)?.cos ?? M.cosWant));
    let eq, says;
    if (m === "diff") {
      const [cb, ca, cas] = M.partsWant;
      // The terms have four decimals, so that the fraction gives the listed cosine.
      eq = `<span class="nowrap">cos(<i>v</i><sub>${want}</sub>, <i>t</i>)</span> <span class="nowrap">= <span class="frac"><span>${fmt(cb, 4)} − ${fmt(ca, 4)} + ${fmt(cas, 4)}</span><span>${fmt(a.tn, 4)}</span></span></span> <span class="nowrap">≈ ${fmt(M.cosWant, 3)}</span>`;
      const bRank = a.modes.b.rank;
      if (rank > 1) says = tr(`${q(want)} comes only ${ord(rank)}: the book uses ${q(want)} only ${a.counts[3]} times, too few to learn the step.`, `${q(want)} llega apenas en el lugar ${fmt(rank)}: el libro usa ${q(want)} solo ${a.counts[3]} veces, muy pocas para aprender el paso.`);
      else if (bRank === 1) says = tr(`${q(want)} comes first, but it was already the closest word to ${q(wb)}; ${given.length ? `${given.map((x) => q(x.w)).join(" and ")} itself would score ${fmt(given[0].cos, 3)}, which is why the given words are left out` : "the step adds little"}.`, `${q(want)} llega primera, pero ya era la palabra más cercana a ${q(wb)}; ${given.length ? `${given.map((x) => q(x.w)).join(" y ")} misma tendría ${fmt(given[0].cos, 3)}, y por eso se dejan fuera las palabras dadas` : "el paso agrega poco"}.`);
      else if (given.length) says = tr(`${q(want)} comes first once the given words are left out: ${given.map((x) => q(x.w)).join(" and ")}, a given word, scores ${fmt(given[0].cos, 3)}.`, `${q(want)} llega primera al dejar fuera las palabras dadas: ${given.map((x) => q(x.w)).join(" y ")}, una palabra dada, tiene ${fmt(given[0].cos, 3)}.`);
      else says = tr(`${q(want)} comes first; on its own it is only the ${ord(bRank)} closest word to ${q(wb)}.`, `${q(want)} llega primera; por sí sola es apenas la ${ord(bRank)} palabra más cercana a ${q(wb)}.`);
    } else {
      eq = `<span class="nowrap">cos(<i>v</i><sub>${want}</sub>, <i>v</i><sub>${wb}</sub>)</span> <span class="nowrap">≈ ${fmt(M.cosWant, 3)}</span>`;
      const dRank = a.modes.diff.rank;
      says = rank === 1
        ? tr(`${q(want)} is already the closest word to ${q(wb)}: the step adds little.`, `${q(want)} ya es la palabra más cercana a ${q(wb)}: el paso agrega poco.`)
        : tr(`${q(want)} is the ${ord(rank)} closest word to ${q(wb)}; with the step it comes ${dRank === 1 ? "first" : ord(dRank)}.`, `${q(want)} es la ${ord(rank)} palabra más cercana a ${q(wb)}; con el paso llega ${dRank === 1 ? "primera" : `en el lugar ${fmt(dRank)}`}.`);
    }
    const tDef = `<span class="nowrap"><i>t</i> = <i>v</i><sub><i>b</i></sub> − <i>v</i><sub><i>a</i></sub> + <i>v</i><sub><i>a</i>*</sub></span>`;
    out.innerHTML = `<p class="lbl">${m === "diff" ? tr(`Where ${q(want)} comes, with ${tDef}`, `Dónde llega ${q(want)}, con ${tDef}`) : tr(`Where ${q(want)} comes, closest to ${q(wb)} alone`, `Dónde llega ${q(want)}, más cercana a ${q(wb)} sola`)}</p><p class="eq">${eq}</p><p>${says}</p>`;
    panel.setAttribute("aria-label", tr(`${wa} is to ${was} as ${wb} is to ${answer.w}, by the closest word to ${m === "diff" ? "b − a + a*" : "b"}`, `${wa} es a ${was} como ${wb} es a ${answer.w}, según la palabra más cercana a ${m === "diff" ? "b − a + a*" : "b"}`));
  }
  const mark = picks(document.getElementById("fig-analogy-picks"), AN.map(asText), (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-analogy-mode"), (m) => show([pick, m]));
  mark(0);
  show([0, "diff"]);
  const states = AN.flatMap((_, i) => [[i, "diff"], [i, "b"]]);
  steadyHeight(panel, states, show, () => [pick, mode]);
  steadyHeight(out, states, show, () => [pick, mode]);
}

/* ---------- Figure 5: the book and the web ---------- */

// Eight words the reader picks from; for each, its five closest words in the book's vectors or in fastText's vectors
// trained on the web, with their cosines as blue bars.
function webFigure() {
  const panel = document.getElementById("fig-web");
  if (!panel) return;
  const out = document.getElementById("fig-web-out");
  const WB = D.web;
  let pick = 0, mode = "book";
  const head = h("p", "wv-picked"), measure = h("p", "wv-measure"), rows = h("div", "wv-rows");
  panel.append(head, measure, rows);
  function show([p, m]) {
    pick = p; mode = m;
    const c = WB[p], list = c[m], [dot, l1, l2] = c.calc[m], d = m === "web" ? 3 : 2;
    head.innerHTML = `<span class="wv-picked-w">${c.w}</span> <span class="wv-picked-in">${m === "book" ? tr("trained on the book", "entrenado con el libro") : tr("trained on the web", "entrenado con la web")}</span>`;
    measure.innerHTML = tr(`cosine with ${q(c.w)}`, `coseno con ${q(c.w)}`);
    rows.replaceChildren(...list.map((x) => h("div", "wv-row", `<span class="wv-word">${x.w}</span>${bar(x.cos)}<span class="wv-val">${fmt(x.cos, 2)}</span>`)));
    const b = c.book[0], w = c.web[0];
    out.innerHTML = `<p class="lbl">${m === "book" ? tr(`The closest word to ${q(c.w)} in the book's vectors`, `La palabra más cercana a ${q(c.w)} en los vectores del libro`) : tr(`The closest word to ${q(c.w)} in the web's vectors`, `La palabra más cercana a ${q(c.w)} en los vectores de la web`)}</p>` +
      `<p class="eq"><span class="nowrap">cos θ = <span class="frac"><span><i>v</i><sub>${c.w}</sub><sup class="t">T</sup><i>v</i><sub>${list[0].w}</sub></span><span>‖<i>v</i><sub>${c.w}</sub>‖ ‖<i>v</i><sub>${list[0].w}</sub>‖</span></span></span> <span class="nowrap">= <span class="frac"><span>${fmt(dot, d)}</span><span>${fmt(l1, d)} · ${fmt(l2, d)}</span></span></span> <span class="nowrap">≈ ${fmt(list[0].cos, 2)}</span></p>` +
      `<p>${tr(`On the book, ${q(c.w)} sits by ${q(b.w)} (${fmt(b.cos, 2)}); on the web, by ${q(w.w)} (${fmt(w.cos, 2)}).`, `En el libro, ${q(c.w)} queda junto a ${q(b.w)} (${fmt(b.cos, 2)}); en la web, junto a ${q(w.w)} (${fmt(w.cos, 2)}).`)}</p>`;
    panel.setAttribute("aria-label", tr(`The five closest words to ${c.w} in the vectors trained on the ${m === "book" ? "book" : "web"}: ${list.map((x) => x.w).join(", ")}`, `Las cinco palabras más cercanas a ${c.w} en los vectores entrenados con ${m === "book" ? "el libro" : "la web"}: ${list.map((x) => x.w).join(", ")}`));
  }
  const mark = picks(document.getElementById("fig-web-words"), WB.map((c) => c.w), (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-web-mode"), (m) => show([pick, m]));
  mark(0);
  show([0, "book"]);
  const states = WB.flatMap((_, i) => [[i, "book"], [i, "web"]]);
  steadyHeight(panel, states, show, () => [pick, mode]);
  steadyHeight(out, states, show, () => [pick, mode]);
}

/* ---------- Figure 6: pooling ---------- */

// Four pairs of short texts the reader picks from; for each text, its words as tiles, and a strip of its words' 100
// numbers as faint dots, with the pooled vector over them as bars (the mean, or the maximum, which is the dots' upper
// edge): carmine for the first text, blue for the second. The readout gives the cosine of the two pooled vectors,
// computed live from the embedded vectors.
function poolFigure() {
  const panel = document.getElementById("fig-pool");
  if (!panel) return;
  const out = document.getElementById("fig-pool-out");
  const PL = D.pool, vec = Object.fromEntries(Object.entries(PL.vecs).map(([w, s]) => [w, decode(s, PL.scale)]));
  const NAMES = [null, null, null, [tr("Sancho's line", "La línea de Sancho"), tr("Don Quixote's reading", "La lectura de don Quijote")]];
  let pick = 0, mode = "mean";
  const pool = (words, m) => vec[words[0]].map((_, j) => (m === "mean" ? words.reduce((s, w) => s + vec[w][j], 0) / words.length : Math.max(...words.map((w) => vec[w][j]))));
  const dotv = (a, b) => a.reduce((s, x, j) => s + x * b[j], 0), norm = (a) => Math.sqrt(dotv(a, a));
  const bagCos = (x, y) => { const c = (ws) => ws.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map()), X = c(x), Y = c(y); let s = 0; for (const [w, n] of X) s += n * (Y.get(w) ?? 0); return s / (norm([...X.values()]) * norm([...Y.values()])); };
  const blocks = [0, 1].map((k) => {
    const name = h("p", "wv-head"), tilesBox = h("div", "wv-tiles small");
    const svg = el("svg", { viewBox: "0 0 412 92", class: "wv-pstrip", role: "img" });
    const mid = 46;
    el("line", { x1: 2, y1: mid, x2: 410, y2: mid, class: "wv-mid" }, svg);
    const dotsG = el("g", { class: "wv-pdots" }, svg), barsG = el("g", { class: `wv-strip ${k ? "blue" : "red"}` }, svg);
    panel.append(name, tilesBox, svg);
    return { name, tilesBox, svg, dotsG, barsG, mid };
  });
  const key = h("p", "wv-head wv-pkey");
  panel.append(key);
  const S = 40;
  function show([p, m]) {
    pick = p; mode = m;
    const texts = PL.pairs[p].map((s) => s.split(" "));
    const pooled = texts.map((ws) => pool(ws, m));
    blocks.forEach((b, k) => {
      b.name.textContent = NAMES[p] ? NAMES[p][k] : tr(k ? "Second text" : "First text", k ? "Segundo texto" : "Primer texto");
      b.tilesBox.innerHTML = texts[k].map((w) => `<span class="wv-tile">${w}</span>`).join("");
      b.dotsG.replaceChildren(); b.barsG.replaceChildren();
      for (const w of texts[k]) vec[w].forEach((v, j) => el("circle", { cx: 6 + j * 4 + 2, cy: b.mid - v * S, r: 1.25 }, b.dotsG));
      pooled[k].forEach((v, j) => {
        const y = b.mid - v * S;
        el("rect", { x: 6 + j * 4 + 0.5, y: Math.min(y, b.mid), width: 3, height: Math.max(0.6, Math.abs(y - b.mid)) }, b.barsG);
      });
      b.svg.setAttribute("aria-label", tr(`The ${texts[k].length} words' numbers and their ${m === "mean" ? "mean" : "maximum"}`, `Los números de las ${texts[k].length} palabras y su ${m === "mean" ? "media" : "máximo"}`));
    });
    key.innerHTML = m === "mean"
      ? tr("Dots: the words' 100 numbers, above and below 0. Bars: their mean, number by number.", "Puntos: los 100 números de las palabras, sobre y bajo 0. Barras: su media, número a número.")
      : tr("Dots: the words' 100 numbers, above and below 0. Bars: their maximum, number by number.", "Puntos: los 100 números de las palabras, sobre y bajo 0. Barras: su máximo, número a número.");
    const [x, y] = pooled, dt = dotv(x, y), nx = norm(x), ny = norm(y), cos = dt / (nx * ny);
    const bag = bagCos(...texts);
    // Pair 2 without its function words, pooled as the mode pools.
    const FUNCTION = new Set(["the", "and", "el", "la", "y"]), content = PL.pairs[1].map((s) => s.split(" ").filter((w) => !FUNCTION.has(w)));
    const [c0, c1] = content.map((ws) => pool(ws, m)), contentCos = dotv(c0, c1) / (norm(c0) * norm(c1));
    const says = [
      tr("The two texts share no word, so as bags of words their cosine is 0.", "Los dos textos no comparten ninguna palabra, así que como bolsas de palabras su coseno es 0."),
      tr(`As bags of words their cosine is ${fmt(bag, 2)}, from ${q("the")} and ${q("and")} alone; the ${m === "mean" ? "means" : "maxima"} of the other words alone, ${q(content[0].join(" "))} and ${q(content[1].join(" "))}, give ${fmt(contentCos, 2)}.`, `Como bolsas de palabras su coseno es ${fmt(bag, 2)}, solo por ${q("y")}; ${m === "mean" ? "las medias" : "los máximos"} de las demás palabras solas, ${q(content[0].join(" "))} y ${q(content[1].join(" "))}, dan ${fmt(contentCos, 2)}.`),
      tr(`One word differs, and the two pool almost to the same vector, since ${q("quest")} and ${q("search")} are close (section 2).`, `Cambia una palabra, y los dos dan casi el mismo vector, porque ${q("asno")} y ${q("jumento")} están cerca (sección 2).`),
      tr("The same words in another order give the same vector, as they gave the same bag of words.", "Las mismas palabras en otro orden dan el mismo vector, como daban la misma bolsa de palabras."),
    ][p];
    out.innerHTML = `<p class="lbl">${tr(`The cosine of the two ${m === "mean" ? "means" : "maxima"}`, `El coseno de ${m === "mean" ? "las dos medias" : "los dos máximos"}`)}</p>` +
      `<p class="eq"><span class="nowrap">cos θ = <span class="frac"><span><i>x</i><sup class="t">T</sup><i>x</i>′</span><span>‖<i>x</i>‖ ‖<i>x</i>′‖</span></span></span> ${Math.abs(cos - 1) < 1e-9 ? `<span class="nowrap">= 1,</span> <span class="nowrap">${tr("since", "porque")} <i>x</i>′ = <i>x</i></span>` : `<span class="nowrap">= <span class="frac"><span>${fmt(dt, 3)}</span><span>${fmt(nx, 3)} · ${fmt(ny, 3)}</span></span></span> <span class="nowrap">≈ ${fmt(cos, 2)}</span>`}</p><p>${says}</p>`;
  }
  const label = (pair, i) => (i === 3 ? tr("Sancho's line and Don Quixote's reading", "La línea de Sancho y la lectura de don Quijote") : pair.map(q).join(tr(" and ", " y ")));
  const mark = picks(document.getElementById("fig-pool-picks"), PL.pairs.map(label), (i) => show([i, mode]));
  modeButtons(document.getElementById("fig-pool-mode"), (m) => show([pick, m]));
  mark(0);
  show([0, "mean"]);
  const states = PL.pairs.flatMap((_, i) => [[i, "mean"], [i, "max"]]);
  steadyHeight(panel, states, show, () => [pick, mode]);
  steadyHeight(out, states, show, () => [pick, mode]);
}

dialFigure();
blankFigure();
oddFigure();
analogyFigure();
webFigure();
poolFigure();
