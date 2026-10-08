// Figures of the words-and-wordnet note, on Don Quijote (the Spanish page) and Ormsby's translation (the English page):
// the forms of a word, stems against lemmas, parts of speech and named entities, WordNet's kinds and parts, and the
// senses of one spelling. These figures are made of words, so they are HTML, which wraps to the screen's width; each
// item the reader can pick is a button, and the arrow keys move between them.
import { tr, lang, modeButtons } from "../../plane.js";
import { DATA } from "./words-and-wordnet-data.js";

const other = lang === "es" ? "en" : "es";
const num = (n) => (lang === "es" ? (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") : String(n)) : n.toLocaleString("en-US"));
const q = (w) => (lang === "es" ? `«${w}»` : `“${w}”`);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// Arrow keys move the focus between the buttons of a list, which a click or Enter selects.
function roving(buttons, select, { grid } = {}) {
  buttons.forEach((b, i) => {
    b.addEventListener("click", () => select(i));
    b.addEventListener("keydown", (e) => {
      const step = grid ? grid(i, e.key) : { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
      if (step === undefined || step === null) return;
      e.preventDefault();
      const j = Math.max(0, Math.min(buttons.length - 1, step));
      buttons[j].focus();
      select(j);
    });
  });
}

/* ---------- Figure 1: the forms of a word ---------- */

// A form as a chip: the part its word's forms share (the lexeme) in ink, the ending in carmine, and its count.
function chip(w, count, cut, cls = "") {
  const c = h("span", `wd-chip ${cls}`), word = h("span", "wd-w");
  word.append(h("span", "wd-lex", w.slice(0, cut)));
  if (cut < w.length) word.append(h("span", "wd-end", w.slice(cut)));
  c.append(word, h("span", "wd-n", num(count)));
  return c;
}
// A panel whose content changes with its mode keeps the height of its tallest mode, so the page below never jumps.
// The height is measured again when the fonts arrive and when the window changes width.
function steadyHeight(panel, modes, show, current) {
  const fit = () => {
    const now = current();
    panel.style.minHeight = "";
    let tallest = 0;
    for (const m of modes) { show(m); tallest = Math.max(tallest, panel.offsetHeight); }
    panel.style.minHeight = `${tallest}px`;
    show(now);
  };
  fit();
  document.fonts?.ready.then(fit);
  let width = window.innerWidth;
  window.addEventListener("resize", () => { if (window.innerWidth !== width) { width = window.innerWidth; fit(); } });
}
const PAIRS = { decir: "say", hablar: "speak", caballero: "knight", hermoso: "fair", con: "with" };
const PAIR_OF = Object.fromEntries(Object.entries(PAIRS).flatMap(([es, en]) => [[es, en], [en, es]]));
const FORM_SAYS = {
  decir: ["An irregular verb changes its lexeme too: dec-, dic-, dig-, dij-, dir-, dich-, di.", "Un verbo irregular cambia también su lexema: dec-, dic-, dig-, dij-, dir-, dich-, di."],
  hablar: ["A regular verb keeps its lexeme, habl-, and changes only its ending.", "Un verbo regular conserva su lexema, habl-, y solo cambia la terminación."],
  caballero: ["A noun varies in number, and sometimes in gender: caballera.", "Un sustantivo varía en número, y a veces en género: caballera."],
  hermoso: ["An adjective agrees with its noun in gender and number.", "Un adjetivo concuerda con su sustantivo en género y número."],
  con: ["One form, ranked 11th among the book's words.", "Una sola forma, en el rango 11 entre las palabras del libro."],
  say: ["Said is irregular: the whole form changes, not only its ending.", "Said es irregular: cambia la forma entera, no solo la terminación."],
  speak: ["Spoke and spoken change the lexeme's vowel.", "Spoke y spoken cambian la vocal del lexema."],
  knight: ["A noun varies in number; knighting is a form of the verb to knight, which shares the lemma.", "Un sustantivo varía en número; knighting es una forma del verbo to knight, que comparte el lema."],
  fair: ["An English adjective varies only in degree: fair, fairer, fairest.", "Un adjetivo inglés varía solo en grado: fair, fairer, fairest."],
  with: ["One form, ranked 15th among the book's words.", "Una sola forma, en el rango 15 entre las palabras del libro."],
};
function formsFigure() {
  const panel = document.getElementById("fig-forms");
  if (!panel) return;
  const out = document.getElementById("fig-forms-out");
  let current;
  function show(word) {
    current = word;
    const mine = DATA.forms[lang][word], pair = PAIR_OF[word], theirs = DATA.forms[other][pair];
    panel.replaceChildren();
    const block = (w, forms, faint) => {
      const head = h("p", `wd-head${faint ? " faint" : ""}`, lang === "es"
        ? (faint ? `${q(w)}, en la traducción inglesa` : `${q(w)}, en el original`)
        : (faint ? `${q(w)}, in the Spanish original` : `${q(w)}, in the translation`));
      const row = h("div", `wd-chips${faint ? " faint" : ""}`);
      forms.forEach(([f, c, cut]) => row.append(chip(f, c, cut)));
      panel.append(head, row);
    };
    block(word, mine, false);
    block(pair, theirs, true);
    panel.setAttribute("aria-label", tr(`The ${mine.length} forms of ${q(word)} in the book, and the ${theirs.length} of ${q(pair)} in the other`, `Las ${mine.length} formas de ${q(word)} en el libro, y las ${theirs.length} de ${q(pair)} en el otro`));
    out.innerHTML = `<p class="lbl">${tr("Forms in the book", "Formas en el libro")}</p>` +
      `<p class="eq"><span class="nowrap"><i>${word}</i> ${mine.length}</span> · <span class="nowrap"><i>${pair}</i> ${theirs.length}</span></p>` +
      `<p>${tr(...FORM_SAYS[word])}</p>`;
  }
  const first = Object.keys(DATA.forms[lang])[0];
  const press = modeButtons(document.getElementById("fig-forms-modes"), show);
  press(first);
  show(first);
  steadyHeight(panel, Object.keys(DATA.forms[lang]), show, () => current);
}

/* ---------- Figure 2: stems against lemmas ---------- */

const GROUP_SAYS = {
  dijo: ["El stem deja fuera las formas de decir que cambian su lexema, como dice y digo, y suma dijes, que es otra palabra: adornos.", "es"],
  hablaba: ["Aquí el stem acierta más: suma hablarle o hablándole, formas con un pronombre pegado que la lista de lemas no trae.", "es"],
  caballeros: ["Aquí el stem y el lema coinciden.", "es"],
  universidad: ["El stem junta universidad con universo, otra palabra; el lema no.", "es"],
  fue: ["Fue es forma de ir y de ser, y solo la oración decide: «Fue luego a ver su rocín» (ir), «lo primero que hizo fue limpiar unas armas» (ser).", "es"],
  said: ["The stem keeps said apart from say, says and saying; the lemma joins all four.", "en"],
  speaking: ["The stem misses spoke and spoken, whose form changes.", "en"],
  knights: ["The stem also joins knightly, another word, and the possessive knight's.", "en"],
  university: ["The stem joins university with universe and universal, different words.", "en"],
  saw: ["The stem joins saw with saws, proverbs, as in “the silly sayings of the rich pass for saws”; the lemma list makes saw a form of see.", "en"],
};
function groupsFigure() {
  const panel = document.getElementById("fig-stems");
  if (!panel) return;
  const out = document.getElementById("fig-stems-out");
  const MAX = 9;
  const list = (title, words, cls, inBoth) => {
    const box = h("div", `wd-box ${cls}`);
    box.append(h("p", "wd-box-head", title));
    const row = h("div", "wd-chips");
    words.slice(0, MAX).forEach(([w, c]) => row.append(chip(w, c, w.length, inBoth?.has(w) ? "" : "odd")));
    if (words.length > MAX) row.append(h("span", "wd-more", tr(`and ${words.length - MAX} more`, `y ${words.length - MAX} más`)));
    box.append(row);
    return box;
  };
  let current;
  function show(word) {
    current = word;
    const g = DATA.groups[lang][word];
    panel.replaceChildren();
    const stemSet = new Set(g.stemWords.map(([w]) => w));
    const lemmaSets = g.lemmas.map((l) => new Set(l.words.map(([w]) => w)));
    const union = new Set(lemmaSets.flatMap((s) => [...s]));
    const both = new Set([...stemSet].filter((w) => union.has(w)));
    const boxes = h("div", "wd-boxes");
    boxes.append(list(tr(`Same stem, ${q(g.stem)}: ${g.stemWords.length}`, `Mismo stem, ${q(g.stem)}: ${g.stemWords.length}`), g.stemWords, "stem", both));
    g.lemmas.forEach((l) => boxes.append(list(tr(`Same lemma, ${q(l.lemma)}: ${l.words.length}`, `Mismo lema, ${q(l.lemma)}: ${l.words.length}`), l.words, "lemma", both)));
    panel.append(boxes);
    panel.setAttribute("aria-label", tr(`The book's words that share the stem of ${q(word)}, and those that share its lemma`, `Las palabras del libro que comparten el stem de ${q(word)}, y las que comparten su lema`));
    const lem = g.lemmas.map((l) => `<span class="nowrap">${tr("lemma", "lema")} <i>${l.lemma}</i>: ${l.words.length}</span>`).join(" · ");
    out.innerHTML = `<p class="lbl">${tr(`Words of the book grouped with ${q(word)}`, `Palabras del libro agrupadas con ${q(word)}`)}</p>` +
      `<p class="eq"><span class="nowrap">stem <i>${g.stem}</i>: ${g.stemWords.length}</span> · ${lem}</p><p>${GROUP_SAYS[word][0]}</p>`;
  }
  const first = Object.keys(DATA.groups[lang])[0];
  const press = modeButtons(document.getElementById("fig-stems-modes"), show);
  press(first);
  show(first);
  steadyHeight(panel, Object.keys(DATA.groups[lang]), show, () => current);

  // How far each book's vocabulary shrinks: words, stems and lemmas, this page's book first.
  const bars = document.getElementById("fig-stems-bars");
  if (!bars) return;
  const max = Math.max(DATA.totals.es.words, DATA.totals.en.words);
  for (const l of [lang, other]) {
    const t = DATA.totals[l];
    const grp = h("div", `wd-bars${l === lang ? "" : " faint"}`);
    grp.append(h("p", "wd-head", l === "es" ? tr("The Spanish original", "El original") : tr("The translation", "La traducción inglesa")));
    for (const [k, en, es] of [["words", "different words", "palabras distintas"], ["stems", "stems", "stems"], ["lemmas", "lemmas", "lemas"]]) {
      const row = h("div", "wd-bar-row");
      row.append(h("span", "wd-bar-name", tr(en, es)));
      const track = h("span", "wd-bar-track");
      const bar = h("span", `wd-bar ${k}`);
      bar.style.width = `${(100 * t[k]) / max}%`;
      track.append(bar);
      row.append(track, h("span", "wd-bar-n", num(t[k])));
      grp.append(row);
    }
    bars.append(grp);
  }
}

/* ---------- Figure 3: parts of speech and named entities ---------- */

function tagsFigure() {
  const panel = document.getElementById("fig-tags");
  if (!panel) return;
  const out = document.getElementById("fig-tags-out");
  const T = DATA.tags, sents = T[lang];
  const buttons = [], where = [];
  sents.forEach((s, si) => {
    panel.append(h("p", "wd-head", tr(`From ${s.from}`, `De ${s.from}`.replace(/^De el /, "Del "))));
    const row = h("div", "wd-tokens");
    let i = 0;
    while (i < s.tokens.length) {
      const ent = s.ents.find(([a]) => a === i);
      const holder = ent ? h("span", `wd-ent ${ent[2].toLowerCase()}`) : row;
      const last = ent ? ent[1] : i;
      for (; i <= last; i++) {
        const b = h("button", "wd-tok");
        b.type = "button";
        b.append(h("span", "wd-pos", s.pos[i]), h("span", "wd-word", s.tokens[i]));
        holder.append(b);
        buttons.push(b);
        where.push([si, i, ent]);
      }
      if (ent) { holder.append(h("span", "wd-ent-lab", tr(...T.entNames[ent[2]]))); row.append(holder); }
    }
    panel.append(row);
  });
  function select(k) {
    buttons.forEach((b, j) => { b.classList.toggle("on", j === k); b.tabIndex = j === k ? 0 : -1; b.setAttribute("aria-pressed", String(j === k)); });
    const [si, i, ent] = where[k], s = sents[si], pos = s.pos[i];
    const posName = tr(...T.posNames[pos]);
    const entText = ent
      ? tr(`part of ${q(s.tokens.slice(ent[0], ent[1] + 1).join(" "))}, ${T.entNames[ent[2]][0]}`, `parte de ${q(s.tokens.slice(ent[0], ent[1] + 1).join(" "))}, ${T.entNames[ent[2]][1]}`)
      : tr("outside any entity", "fuera de toda entidad");
    out.innerHTML = `<p class="lbl">${tr("Part of speech and entity", "Categoría gramatical y entidad")}</p>` +
      `<p class="eq">${q(s.tokens[i])}: ${posName} <span class="nowrap">(${pos})</span></p><p>${entText[0].toUpperCase() + entText.slice(1)}.</p>`;
  }
  buttons.forEach((b, j) => { const [si, i] = where[j]; b.setAttribute("aria-label", `${sents[si].tokens[i]}, ${tr(...T.posNames[sents[si].pos[i]])}`); });
  roving(buttons, select);
  // The start: Mancha in the first sentence, a place.
  const start = where.findIndex(([si, i]) => si === 0 && sents[0].tokens[i] === "Mancha");
  select(start);
}

/* ---------- Figure 4: WordNet's kinds and parts ---------- */

function wordnetFigure() {
  const panel = document.getElementById("fig-wordnet");
  if (!panel) return;
  const out = document.getElementById("fig-wordnet-out");
  const W = DATA.wordnet;
  const chain = W.kinds.slice(0, 11), below = W.kinds.slice(11);
  const name = (n, l = lang) => n[l];
  let buttons = [], items = [];
  function kinds() {
    panel.replaceChildren();
    const col = h("div", "wd-tree");
    items = [];
    chain.forEach((n, i) => items.push({ n, depth: i, kind: "chain" }));
    below.forEach((n) => items.push({ n, depth: chain.length, kind: "below" }));
    buttons = items.map(({ n, kind }) => { const b = h("button", `wd-node ${kind}`); b.type = "button"; b.textContent = name(n); return b; });
    chain.forEach((n, i) => { const r = h("div", "wd-level"); r.append(buttons[i]); col.append(r); });
    const list = h("div", "wd-part-list");
    buttons.slice(chain.length).forEach((b) => list.append(b));
    col.append(list);
    panel.append(col);
    roving(buttons, select);
  }
  function parts() {
    panel.replaceChildren();
    items = [{ n: W.whole, kind: "whole" }, ...W.parts.map((n) => ({ n, kind: "part" }))];
    buttons = items.map(({ n, kind }) => { const b = h("button", `wd-node ${kind}`); b.type = "button"; b.textContent = name(n); return b; });
    const col = h("div", "wd-parts");
    const top = h("div", "wd-level"); top.append(buttons[0]); col.append(top);
    const list = h("div", "wd-part-list");
    buttons.slice(1).forEach((b) => list.append(b));
    col.append(list);
    panel.append(col);
    roving(buttons, select);
  }
  let mode = "kinds";
  function select(k) {
    buttons.forEach((b, j) => { b.classList.toggle("on", j === k); b.tabIndex = j === k ? 0 : -1; b.setAttribute("aria-pressed", String(j === k)); });
    const { n, depth, kind } = items[k];
    // In kinds, the chain from the node picked up to entity is drawn in blue.
    if (mode === "kinds") buttons.forEach((b, j) => b.classList.toggle("path", j !== k && items[j].kind === "chain" && (kind === "below" || j < k)));
    const otherName = `<span class="wd-other">${tr("in Spanish", "en inglés")}: ${name(n, other)}</span>`;
    let rel;
    if (mode === "kinds") {
      if (depth === 0) rel = tr("The root: every noun's chain of kinds ends here.", "La raíz: aquí termina la cadena de clases de todo sustantivo.");
      else {
        const up = kind === "below" ? chain[chain.length - 1] : chain[depth - 1];
        rel = tr(`A kind of ${name(up)}: ${depth} steps up to ${name(chain[0])}.`, `Una clase de ${name(up)}: ${depth} pasos hasta ${name(chain[0])}.`);
      }
    } else rel = kind === "whole"
      ? tr(`WordNet lists ${W.suitParts} parts of it; ten are shown, from head to foot.`, `WordNet le da ${W.suitParts} partes; aquí van diez, de la cabeza a los pies.`)
      : tr(`Part of a ${name(W.whole)}.`, `Parte de una ${name(W.whole)}.`);
    out.innerHTML = `<p class="lbl">${tr("Synset", "Synset")}</p><p class="eq"><span class="nowrap">${name(n)}</span> ${otherName}</p><p>${tr(...n.def)} ${rel}</p>`;
  }
  const show = (m) => {
    mode = m;
    if (m === "kinds") { kinds(); select(chain.length - 1); } else { parts(); select(8); }
  };
  const press = modeButtons(document.getElementById("fig-wordnet-modes"), show);
  press("kinds");
  show("kinds");
  steadyHeight(panel, ["kinds", "parts"], show, () => mode);
}

/* ---------- Figure 5: the senses of one spelling ---------- */

function sensesFigure() {
  const panel = document.getElementById("fig-senses");
  if (!panel) return;
  const out = document.getElementById("fig-senses-out");
  const S = DATA.senses[lang];
  const max = Math.max(...Object.values(S.counts));
  const buttons = [], keys = [];
  const cols = h("div", "wd-origins");
  for (const o of S.origins) {
    const col = h("div", "wd-origin");
    col.append(h("p", "wd-origin-head", tr(...o.name)));
    for (const k of o.senses) {
      const b = h("button", "wd-sense");
      b.type = "button";
      b.append(h("span", "wd-sense-name", tr(...S.senses[k].name)));
      const track = h("span", "wd-bar-track");
      const bar = h("span", "wd-bar");
      bar.style.width = `${(100 * S.counts[k]) / max}%`;
      track.append(bar);
      b.append(track, h("span", "wd-bar-n", num(S.counts[k])));
      col.append(b);
      buttons.push(b);
      keys.push([o, k]);
    }
    cols.append(col);
  }
  panel.append(cols);
  function select(i) {
    buttons.forEach((b, j) => { b.classList.toggle("on", j === i); b.tabIndex = j === i ? 0 : -1; b.setAttribute("aria-pressed", String(j === i)); });
    const [, k] = keys[i], c = S.counts[k];
    const pct = Math.round((100 * c) / S.total);
    out.innerHTML = `<p class="lbl">${q(S.word)}, ${tr(...S.senses[k].name)}</p>` +
      `<p class="eq"><span class="nowrap">${c} / ${S.total}</span> <span class="nowrap">≈ ${pct}%</span></p>` +
      `<p class="wd-line">${S.senses[k].line}</p>`;
  }
  roving(buttons, select);
  select(0);
}

formsFigure();
groupsFigure();
tagsFigure();
wordnetFigure();
sensesFigure();
