import { el, tr } from "../../plane.js";

/* ---------- Section 2: Q-learning on a small grid with a cliff, stepped through like slides ---------- */

// The world: 6 columns (A to F) and 4 rows (1 at the bottom), with cells numbered from 0 at the top left, row by row.
// The agent starts in A1, and reaching F1 ends the episode. B1 to E1 are the cliff: a step into it gives −100 and
// sends the agent back to A1. Every other move gives −1, and a move into a wall leaves the agent where it is.
const W = 6, H = 4, START = 18, GOAL = 23;
// Learning: α = 0.5, γ = 1 and ε = 0.1, with ties broken at random. With this seed the best moves settle on the
// shortest path, 7 moves, in episode 19; the figure shows 30 episodes, under a thousand moves in all.
const ALPHA = 0.5, EPS = 0.1, SEED = 817, EPISODES = 30, OPT = 7;
const ACTS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const NAME = [tr("up", "arriba"), tr("right", "derecha"), tr("down", "abajo"), tr("left", "izquierda")];
const isCliff = (s) => Math.floor(s / W) === H - 1 && s % W > 0 && s % W < W - 1;
const cellName = (s) => "ABCDEF"[s % W] + (H - Math.floor(s / W));
function stepEnv(s, a) {
  const x = s % W, y = Math.floor(s / W);
  const n = Math.min(H - 1, Math.max(0, y + ACTS[a][1])) * W + Math.min(W - 1, Math.max(0, x + ACTS[a][0]));
  if (isCliff(n)) return { s2: START, r: -100, fell: n, done: false };
  return { s2: n, r: -1, fell: null, done: n === GOAL };
}
// mulberry32, a small seeded generator, so that every reader sees the same run.
function rngFrom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// The whole run, computed once: every move, with what its update used.
const steps = [];
{
  const rnd = rngFrom(SEED), Q = Array.from({ length: W * H }, () => [0, 0, 0, 0]);
  let s = START, ep = 1, t = 0;
  while (ep <= EPISODES) {
    let a, explored = false;
    if (rnd() < EPS) { a = Math.floor(rnd() * 4); explored = true; }
    else { const m = Math.max(...Q[s]); const best = [0, 1, 2, 3].filter((b) => Q[s][b] === m); a = best[Math.floor(rnd() * best.length)]; }
    const o = stepEnv(s, a), maxNext = o.done ? 0 : Math.max(...Q[o.s2]);
    const old = Q[s][a], nu = old + ALPHA * (o.r + maxNext - old);
    Q[s][a] = nu;
    steps.push({ ep, t: ++t, s, a, ...o, explored, old, nu, maxNext, target: o.r + maxNext });
    if (o.done) { s = START; ep++; t = 0; } else s = o.s2;
  }
}
// The table after the first n moves.
const qAfter = (n) => { const Q = Array.from({ length: W * H }, () => [0, 0, 0, 0]); for (let i = 0; i < n; i++) Q[steps[i].s][steps[i].a] = steps[i].nu; return Q; };
// The cells the best moves lead through from A1, or null when they do not reach the goal.
function greedyPath(Q) {
  let s = START; const path = [s], seen = new Set([s]);
  for (let k = 0; k < W * H; k++) {
    const m = Math.max(...Q[s]); const a = Q[s].indexOf(m); const o = stepEnv(s, a);
    if (o.fell !== null) return null; s = o.s2; path.push(s);
    if (s === GOAL) return path; if (seen.has(s)) return null; seen.add(s);
  }
  return null;
}

// Moments of the run: the falls, when every move has been tried, when the best moves first reach the goal, and when
// they settle on the shortest path for good.
const last = steps.length, X = (n) => steps[n - 1], epEnd = (e) => steps.findIndex((x) => x.ep === e && x.done) + 1;
const falls = steps.map((x, i) => (x.fell !== null ? i + 1 : null)).filter((x) => x !== null);
let allTried = null, connect = null, learned = null;
{
  const tried = new Set(), pairs = (W * H - 5) * 4, Q = qAfter(0);
  for (let n = 1; n <= last; n++) {
    const x = X(n); Q[x.s][x.a] = x.nu;
    tried.add(x.s * 4 + x.a);
    if (allTried === null && tried.size === pairs) allTried = n;
    const p = greedyPath(Q);
    if (connect === null && p) connect = n;
    if (p && p.length - 1 === OPT) { if (learned === null) learned = n; } else learned = null;
  }
}
const fallAfter = falls.find((n) => n > learned);
const fallsIn = (a, b) => falls.filter((n) => n > a && n <= b).length;

/* ---------- Text ---------- */

const num = (v) => String(Math.round(v * 100) / 100).replace("-", "−");
const par = (v) => (v < 0 ? `(${num(v)})` : num(v));
const eqv = (v) => (Math.abs(Math.round(v * 100) / 100 - v) > 1e-9 ? "≈ " : "= ") + num(v);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// A list in running text: "up and left", "up, right, and left"; in Spanish "arriba y derecha", with "e" before an i.
function listAnd(xs) {
  const end = xs[xs.length - 1], and = tr("and", /^i/.test(end) ? "e" : "y");
  return xs.length === 2 ? `${xs[0]} ${and} ${end}` : `${xs.slice(0, -1).join(", ")}${tr(",", "")} ${and} ${end}`;
}
// A symbol with its time index, such as S with t = 0: S₀.
const sym = (L, t) => `<i>${L}</i><sub>${t}</sub>`;
const status = (x, time) => (x ? tr(`Episode ${x.ep}, move ${x.t}`, `Episodio ${x.ep}, movimiento ${x.t}`) : tr("Episode 1, before the first move", "Episodio 1, antes del primer movimiento")) + ` · <i>t</i> = ${time}`;

// The three builds of a detailed move: why this move (at time t), then its target and the update (at time t + 1).
function moveBuilds(n) {
  const x = X(n), Qpre = qAfter(n - 1), pre = Qpre[x.s], m = Math.max(...pre), c = cellName(x.s), go = NAME[x.a];
  const t = x.t - 1, S0 = sym("S", t), A0 = sym("A", t), R1 = sym("R", t + 1), S1 = sym("S", t + 1);
  const ties = [0, 1, 2, 3].filter((b) => pre[b] === m);
  let why = x.explored ? tr(`A random move, which happens one time in ten: ${A0} = ${go}.`, `Un movimiento al azar, algo que pasa una vez de cada diez: ${A0} = ${go}.`)
    : ties.length === 4 ? tr(`All four moves in ${S0} = ${c} are worth ${num(m)}, a tie, so the agent picks one at random: ${A0} = ${go}.`, `Los cuatro movimientos en ${S0} = ${c} valen ${num(m)}, un empate, así que el agente elige uno al azar: ${A0} = ${go}.`)
    : ties.length > 1 ? tr(`In ${S0} = ${c}, ${listAnd(ties.map((b) => NAME[b]))} tie for the best value, ${num(m)}, so the agent picks one of them at random: ${A0} = ${go}.`, `En ${S0} = ${c}, ${listAnd(ties.map((b) => NAME[b]))} empatan con el mejor valor, ${num(m)}, así que el agente elige uno de ellos al azar: ${A0} = ${go}.`)
    : tr(`The best move in ${S0} = ${c} is ${A0} = ${go}.`, `El mejor movimiento en ${S0} = ${c} es ${A0} = ${go}.`);
  why += x.fell !== null ? tr(` It steps off into the cliff: ${R1} = −100, and it is sent back to the start, so ${S1} = ${cellName(START)}.`, ` Cae al acantilado: ${R1} = −100, y vuelve al inicio, así que ${S1} = ${cellName(START)}.`)
    : x.s2 === x.s ? tr(` It hits the wall and stays where it is: ${R1} = −1 and ${S1} = ${c}.`, ` Choca con la pared y se queda donde está: ${R1} = −1 y ${S1} = ${c}.`)
    : tr(` It moves to ${S1} = ${cellName(x.s2)} and gets ${R1} = −1.`, ` Pasa a ${S1} = ${cellName(x.s2)} y recibe ${R1} = −1.`);
  const next = Qpre[x.s2], untried = next.filter((v) => v === 0).length;
  const where = next.every((v) => v === 0) ? tr(", where every move is still worth 0", ", donde todos los movimientos aún valen 0")
    : x.maxNext === 0 && untried ? tr(`, where ${untried === 1 ? "one move is" : `${untried} moves are`} untried and still worth 0`, `, donde ${untried === 1 ? "un movimiento sin probar aún vale 0" : `${untried} movimientos sin probar aún valen 0`}`) : "";
  const target = tr(`${R1} and ${S1} are known at <i>t</i> = ${t + 1}. The target adds ${R1} to the best value in ${S1}${where}.`, `${R1} y ${S1} se conocen en <i>t</i> = ${t + 1}. El objetivo suma ${R1} al mejor valor en ${S1}${where}.`);
  let update = tr(`Still at <i>t</i> = ${t + 1}, the value of the pair the agent just left, <i>Q</i>(${S0}, ${A0}), moves halfway toward the target, from ${num(x.old)} to ${num(x.nu)}.`, `Todavía en <i>t</i> = ${t + 1}, el valor del par que el agente acaba de dejar, <i>Q</i>(${S0}, ${A0}), avanza la mitad del camino hacia el objetivo, de ${num(x.old)} a ${num(x.nu)}.`);
  if (x.fell !== null) update += tr(" That is far below the other moves there, so the greedy choice avoids it from now on.", " Eso queda muy por debajo de los demás movimientos ahí, así que la elección greedy lo evita desde ahora.");
  else if (n === 3) update += tr(" Every move tried so far is now worth −0.5 and every untried one 0, so untried moves look better: at first, the agent tries everything.", " Cada movimiento probado hasta ahora vale −0.5 y cada uno sin probar vale 0, así que los que no se han probado parecen mejores: al principio, el agente lo prueba todo.");
  const tgtEq = `${tr("target", "objetivo")} = <span class="pt">${R1} + γ max<sub><i>a</i></sub> <i>Q</i>(${S1}, <i>a</i>) <span class="nowrap">= ${num(x.r)} + ${par(x.maxNext)}</span> <span class="nowrap">= ${num(x.target)}</span></span>`;
  const updEq = `<i>Q</i>(${S0}, ${A0}) <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${num(x.target)}</span> − ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`;
  const tags = [[x.s, t], [x.s2, t + 1]];
  return [
    { Q: Qpre, agent: x.fell !== null ? x.fell : x.s2, ring: x.fell, sel: x.s, line: why, bump: x.fell === null && x.s2 === x.s ? x.a : null, time: t, tags },
    { Q: Qpre, agent: x.s2, jump: x.fell !== null, ring: x.fell, sel: x.s2, src: true, line: target, eq: tgtEq, time: t + 1, tags },
    { Q: qAfter(n), agent: x.s2, sel: x.s, changed: [x.s, x.a], line: update, eq: updEq, time: t + 1, tags },
  ];
}
// A slide shown whole: the state after move n and, with withEq, the update that move made.
function wholeSlide(n, line, withEq) {
  const x = n ? X(n) : null, Q = qAfter(n), t = x ? x.t - 1 : 0, to = x ? (x.done ? GOAL : x.s2) : START;
  let eq = null, tags = x ? [[to, t + 1]] : [[START, 0]];
  if (withEq) {
    eq = `<i>Q</i>(${sym("S", t)}, ${sym("A", t)}) <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${x.done ? "−1" : `${num(x.r)} + ${par(x.maxNext)}`}</span> − ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`;
    tags = [[x.s, t], [to, t + 1]];
  }
  return [{ Q, agent: to, ring: withEq && x.fell !== null ? x.fell : null, sel: withEq ? x.s : START, line, eq, changed: withEq ? [x.s, x.a] : null, time: x ? t + 1 : 0, tags }];
}

const T1 = X(epEnd(1)).t, f1 = fallsIn(0, epEnd(1));
const firstPath = greedyPath(qAfter(connect)).length - 1;
const xa = X(fallAfter), At = sym("A", xa.t - 1), St = sym("S", xa.t - 1);
const finalValues = (() => { const Q = qAfter(last); return greedyPath(Q).slice(0, -1).map((s) => num(Math.max(...Q[s]))).join(", "); })();
const slides = [
  { n: 0, title: tr("The cliff", "El acantilado"), builds: wholeSlide(0, tr(
    `The agent starts at ${sym("S", 0)} = A1 and must reach the goal, F1. Every move costs 1; stepping into the cliff costs 100 and sends the agent back to A1. All values start at 0, and the agent picks moves ε-greedily with ε = ${EPS}.`,
    `El agente parte en ${sym("S", 0)} = A1 y debe llegar a la meta, F1. Cada movimiento cuesta 1; caer al acantilado cuesta 100 y devuelve al agente a A1. Todos los valores parten en 0, y el agente elige sus movimientos de forma ε-greedy, con ε = ${EPS}.`)) },
  { n: 1, title: tr("Move 1", "Movimiento 1"), builds: moveBuilds(1) },
  { n: 2, title: tr("Move 2", "Movimiento 2"), builds: moveBuilds(2) },
  { n: 3, title: tr("Move 3", "Movimiento 3"), builds: moveBuilds(3) },
  { n: falls[0], title: tr("The first fall", "La primera caída"), builds: moveBuilds(falls[0]) },
  { n: epEnd(1), title: tr("Episode 1 ends", "Termina el episodio 1"), builds: wholeSlide(epEnd(1), tr(
    `The agent reaches the goal after ${T1} moves, with ${count(f1, "fall", "falls")} on the way. The episode ends at <i>T</i> = ${T1}: no value follows the goal, so the target of the last move is just ${sym("R", T1)} = −1.`,
    `El agente llega a la meta después de ${T1} movimientos, con ${count(f1, "caída", "caídas")} en el camino. El episodio termina en <i>T</i> = ${T1}: después de la meta no viene ningún valor, así que el objetivo del último movimiento es solo ${sym("R", T1)} = −1.`), true) },
  { n: allTried, title: tr("Every move tried", "Todos los movimientos probados"), builds: wholeSlide(allTried, tr(
    `After ${allTried} moves in all, every move in every cell has been tried at least once. From here on the agent's choices rest on real estimates, not on untried zeros.`,
    `Tras ${allTried} movimientos en total, cada movimiento de cada celda se ha probado al menos una vez. Desde aquí, las elecciones del agente se basan en estimaciones reales, no en ceros sin probar.`)) },
  { n: connect, title: tr("A first way through", "Un primer camino"), builds: wholeSlide(connect, tr(
    `In episode ${X(connect).ep}, following the best move from each cell first leads from A1 to the goal: ${firstPath} moves, not yet the shortest route. The dashed line follows it.`,
    `En el episodio ${X(connect).ep}, seguir el mejor movimiento de cada celda lleva por primera vez de A1 a la meta: ${firstPath} movimientos, todavía no la ruta más corta. La línea punteada la sigue.`)) },
  { n: learned, title: tr("The shortest path", "El camino más corto"), builds: wholeSlide(learned, tr(
    `In episode ${X(learned).ep}, the best moves settle on the shortest path, ${OPT} moves, right along the edge of the cliff. They stay there for the rest of the run.`,
    `En el episodio ${X(learned).ep}, los mejores movimientos se asientan en el camino más corto, de ${OPT} movimientos, justo por el borde del acantilado. Ahí se quedan hasta el final.`)) },
  { n: fallAfter, title: tr("Exploration still costs", "Explorar sigue costando"), builds: wholeSlide(fallAfter, tr(
    `${At} is a random move, which happens one time in ten, and takes the agent from ${St} = ${cellName(xa.s)} into the cliff, although its best moves avoid it. Only the value of that move changes; the best values along the edge stay as they are, since Q-learning's target uses the best next move, not the random one. The agent keeps the edge path, and keeps paying for exploring.`,
    `${At} es un movimiento al azar, algo que pasa una vez de cada diez, y lleva al agente de ${St} = ${cellName(xa.s)} al acantilado, aunque sus mejores movimientos lo evitan. Solo cambia el valor de ese movimiento; los mejores valores a lo largo del borde siguen iguales, porque el objetivo de Q-learning usa el mejor movimiento siguiente, no el que se eligió al azar. El agente mantiene el camino por el borde, y sigue pagando por explorar.`), true) },
  { n: last, title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: wholeSlide(last, tr(
    `Along the path, the best values are ${finalValues}: about minus the number of moves left. The agent fell ${falls.length} times, ${fallsIn(learned, last)} of them after it had learned the path.`,
    `A lo largo del camino, los mejores valores son ${finalValues}: cerca de −1 por cada movimiento que falta. El agente cayó ${falls.length} veces, ${fallsIn(learned, last)} de ellas después de haber aprendido el camino.`)) },
];
// How far each slide jumps ahead of the one before it, when it skips moves.
for (let i = 1; i < slides.length; i++) {
  const from = slides[i - 1].n, to = slides[i].n, moves = to - from;
  if (moves <= 1) continue;
  const epFrom = from ? X(from).ep + (X(from).done ? 1 : 0) : 1, epTo = X(to).ep;
  slides[i].skip = { from, to, moves, text: tr(`${moves} moves later`, `${moves} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "") };
}

/* ---------- Drawing ---------- */

const C = 60, ML = 26, MT = 10, MB = 24;
const x0 = (s) => ML + (s % W) * C, y0 = (s) => MT + Math.floor(s / W) * C, mid = (s) => [x0(s) + C / 2, y0(s) + C / 2];
// An arrow for the values readout, drawn rather than typed so that it looks the same in every font.
const arr = (a) => `<svg class="arr" viewBox="0 0 12 12" aria-hidden="true" style="--r: ${[-90, 0, 90, 180][a]}deg"><path d="M1.5 6 H10 M6.5 2.5 L10 6 L6.5 9.5"/></svg><span class="sr-only">${NAME[a]}</span>`;
const svg = document.getElementById("fig-cliff"), fig = svg.closest(".fig");
const out = document.getElementById("fig-cliff-out"), live = document.getElementById("fig-cliff-live");
const nextBtn = document.getElementById("fig-cliff-next"), backBtn = document.getElementById("fig-cliff-back");
const resetBtn = document.getElementById("fig-cliff-reset"), countEl = document.getElementById("fig-cliff-count");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// The slide, the build within it, and the cell the reader pressed (null: the slide picks the cell to show).
let k = 0, b = 0, pinned = null;

svg.setAttribute("viewBox", `0 0 ${ML + W * C + 8} ${MT + H * C + MB}`);
for (let s = 0; s < W * H; s++) {
  const g = el("g", { class: "gw-cell", tabindex: isCliff(s) ? "-1" : "0", role: "button", "aria-label": tr(`Cell ${cellName(s)}`, `Celda ${cellName(s)}`) }, svg);
  el("rect", { class: isCliff(s) ? "gw-cliff" : "gw-floor", x: x0(s), y: y0(s), width: C, height: C }, g);
  el("rect", { class: "gw-focus", x: x0(s) + 6, y: y0(s) + 6, width: C - 12, height: C - 12, rx: 3 }, g);
  if (!isCliff(s)) {
    const pick = () => { if (ff) finishFF(true, ff.prevAgent); pinned = pinned === s ? null : s; render(false); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  }
}
for (let i = 1; i < H; i++) el("line", { class: "gw-line", x1: ML, y1: MT + i * C, x2: ML + W * C, y2: MT + i * C }, svg);
for (let i = 1; i < W; i++) el("line", { class: "gw-line", x1: ML + i * C, y1: MT, x2: ML + i * C, y2: MT + (H - 1) * C }, svg);
el("rect", { class: "gw-frame", x: ML, y: MT, width: W * C, height: H * C }, svg);
el("text", { class: "gw-lab", x: ML + 3 * C, y: MT + (H - 0.5) * C + 5, "text-anchor": "middle" }, svg).textContent = tr("cliff", "acantilado");
for (let i = 0; i < W; i++) el("text", { class: "gw-axis", x: ML + i * C + C / 2, y: MT + H * C + 17, "text-anchor": "middle" }, svg).textContent = "ABCDEF"[i];
for (let j = 0; j < H; j++) el("text", { class: "gw-axis", x: ML - 10, y: MT + j * C + C / 2 + 4, "text-anchor": "middle" }, svg).textContent = String(H - j);
el("text", { class: "gw-sg", x: x0(START) + 6, y: y0(START) + 16 }, svg).textContent = tr("start", "inicio");
el("text", { class: "gw-sg", x: x0(GOAL) + 6, y: y0(GOAL) + 16 }, svg).textContent = tr("goal", "meta");
const dyn = el("g", {}, svg);
const selRect = el("rect", { class: "gw-sel", width: C - 6, height: C - 6, rx: 4 }, svg);
const agentG = el("g", { class: "gw-agent-g" }, svg);
const agentDot = el("circle", { class: "gw-agent", cx: 0, cy: 0, r: 8 }, agentG);

function drawGrid(g, animate) {
  const { Q, agent, ring, tags, bump, sel, src, jump, showPath } = g;
  dyn.replaceChildren();
  const p = showPath ? greedyPath(Q) : null;
  if (p) el("polyline", { class: "gw-path", points: p.map((c) => mid(c).join(",")).join(" ") }, dyn);
  // The best move in each cell, where one move beats the others.
  for (let c = 0; c < W * H; c++) {
    if (isCliff(c) || c === GOAL) continue;
    const m = Math.max(...Q[c]); if (Q[c].filter((v) => v === m).length > 1) continue;
    const a = Q[c].indexOf(m), [dx, dy] = ACTS[a], [cx, cy] = mid(c);
    el("line", { class: "gw-best", x1: cx + dx * 9, y1: cy + dy * 9, x2: cx + dx * 19, y2: cy + dy * 19 }, dyn);
    el("polygon", { class: "gw-head", points: `${cx + dx * 26},${cy + dy * 26} ${cx + dx * 18 - dy * 5},${cy + dy * 18 + dx * 5} ${cx + dx * 18 + dy * 5},${cy + dy * 18 - dx * 5}` }, dyn);
  }
  // Time tags: S_t on the cell the agent left, S_t+1 on the cell it is in now (one tag when they are the same cell).
  const byCell = new Map();
  for (const [c, tt] of tags || []) byCell.set(c, [...(byCell.get(c) || []), tt]);
  for (const [c, ts] of byCell) {
    const tx = el("text", { class: "gw-tag", x: x0(c) + C - 9, y: y0(c) + C - 12, "text-anchor": "end" }, dyn);
    ts.forEach((tt, i) => {
      el("tspan", i ? { dy: -3 } : {}, tx).textContent = i ? ", S" : "S";
      el("tspan", { class: "sub", dy: 3 }, tx).textContent = String(tt);
    });
  }
  if (ring !== null && ring !== undefined) { const [fx, fy] = mid(ring); el("circle", { class: "gw-fall", cx: fx, cy: fy, r: 13 }, dyn); }
  selRect.style.display = sel === null ? "none" : "";
  if (sel !== null) { selRect.setAttribute("x", x0(sel) + 3); selRect.setAttribute("y", y0(sel) + 3); }
  selRect.classList.toggle("tg", !!src);
  const [ax, ay] = mid(agent);
  agentG.classList.toggle("jump", !animate || !!jump);
  agentG.style.transform = `translate(${ax}px, ${ay}px)`;
  // A wall hit: mark the stretch of wall, and nudge the agent toward it and back.
  if (bump !== null && bump !== undefined) {
    const [dx, dy] = ACTS[bump], [cx, cy] = mid(agent), h = C / 2, ex = cx + dx * h, ey = cy + dy * h;
    el("line", { class: "gw-wall", x1: ex - dy * (h - 12), y1: ey - dx * (h - 12), x2: ex + dy * (h - 12), y2: ey + dx * (h - 12) }, dyn);
    if (animate && !reducedMotion.matches)
      agentDot.animate([{ transform: "translate(0px, 0px)" }, { transform: `translate(${dx * 16}px, ${dy * 16}px)`, offset: 0.4 }, { transform: "translate(0px, 0px)" }], { duration: 360, easing: "ease-out" });
  }
}

function render(animate) {
  const sl = slides[k], bd = sl.builds[b], x = sl.n ? X(sl.n) : null, Q = bd.Q;
  const sel = pinned ?? bd.sel;
  drawGrid({ Q, agent: bd.agent, ring: bd.ring, tags: bd.tags, bump: bd.bump, sel, src: !pinned && bd.src, jump: bd.jump, showPath: !!sl.n }, animate);

  // Readout: status and title, then one block per press so far, each a sentence with its calculation below it.
  // New blocks only ever appear at the bottom; earlier ones stay above, dimmed.
  const shown = sl.builds.slice(0, b + 1), enter = animate && b === 0 ? " enter" : "";
  let html = `<p class="lbl">${status(x, bd.time)}</p>${sl.skip ? `<p class="later${enter}">${sl.skip.text}</p>` : ""}<p class="slide${enter}">${sl.title}</p>`;
  html += `<div class="lines">${shown.map((d, i) => `<div class="${i < shown.length - 1 ? "old" : animate ? (b === 0 ? "enter after-title" : "enter") : ""}"><p>${d.line}</p>${d.eq ? `<div class="eq">${d.eq}</div>` : ""}</div>`).join("")}</div>`;
  // The values of the selected cell: the best in blue, the one just updated underlined.
  const q = Q[sel], m = Math.max(...q), best = q.filter((v) => v === m).length === 1;
  const cls = (a) => { const c = []; if (best && q[a] === m) c.push("best"); if (!pinned && bd.changed && bd.changed[0] === sel && bd.changed[1] === a) c.push("changed"); return c.length ? ` class="${c.join(" ")}"` : ""; };
  const v = (a) => `<span${cls(a)}>${arr(a)} ${num(q[a])}</span>`;
  html += sel === GOAL ? `<p class="lbl">${tr("F1, the goal", "F1, la meta")}</p><p>${tr("The episode ends here, so this cell has no values.", "El episodio termina aquí, así que esta celda no tiene valores.")}</p>`
    : `<p class="lbl">${tr(`Values in ${cellName(sel)}`, `Valores en ${cellName(sel)}`)}${pinned === null ? "" : tr(" (press it again to follow the slides)", " (presiónala de nuevo para seguir las diapositivas)")}</p>
      <div class="qv"><span></span>${v(0)}<span></span>${v(3)}<span class="mid">${cellName(sel)}</span>${v(1)}<span></span>${v(2)}<span></span></div>`;
  out.innerHTML = html;
  if (animate) live.textContent = shown[shown.length - 1].line.replace(/<[^>]+>/g, "");
  countEl.textContent = tr(`${k + 1} of ${slides.length}`, `${k + 1} de ${slides.length}`);
  backBtn.disabled = k === 0 && b === 0;
  nextBtn.disabled = k === slides.length - 1 && b === slides[k].builds.length - 1;
  resetBtn.hidden = k !== slides.length - 1;
}

/* ---------- Sound ---------- */

// Made in the browser: a short woody click for a move, a duller one for a wall hit, a falling tone for a fall, and a
// rising chime when the run ends. They play only after Next or the right arrow key, and a button turns them off.
let audioCtx = null, soundOn = true;
const ac = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());
function click(pitch = 1, level = 1) {
  const a = ac(), t = a.currentTime + 0.01;
  const len = Math.floor(a.sampleRate * 0.045), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700 * pitch; bp.Q.value = 2.5;
  const g = a.createGain(); g.gain.setValueAtTime(0.55 * level, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(bp).connect(g).connect(a.destination); src.start(t);
  const o = a.createOscillator(); o.frequency.setValueAtTime(230 * pitch, t); o.frequency.exponentialRampToValueAtTime(150 * pitch, t + 0.07);
  const g2 = a.createGain(); g2.gain.setValueAtTime(0.3 * level, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g2).connect(a.destination); o.start(t); o.stop(t + 0.12);
}
function fallSound() {
  const a = ac(), t = a.currentTime + 0.01;
  const o = a.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.5);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.6);
  const th = a.createOscillator(); th.frequency.setValueAtTime(95, t + 0.46); th.frequency.exponentialRampToValueAtTime(55, t + 0.62);
  const g2 = a.createGain(); g2.gain.setValueAtTime(0.0001, t + 0.45); g2.gain.exponentialRampToValueAtTime(0.35, t + 0.47); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.66);
  th.connect(g2).connect(a.destination); th.start(t + 0.45); th.stop(t + 0.7);
}
function chime() {
  const a = ac(), t = a.currentTime + 0.01;
  [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
    const o = a.createOscillator(); o.type = "triangle"; o.frequency.value = fr;
    const g = a.createGain(), st = t + i * 0.12;
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.16, st + 0.02); g.gain.exponentialRampToValueAtTime(0.001, st + (i === 3 ? 1.1 : 0.5));
    o.connect(g).connect(a.destination); o.start(st); o.stop(st + 1.2);
  });
}
function playFor(prevAgent) {
  if (!soundOn) return;
  const bd = slides[k].builds[b];
  if (k === slides.length - 1) chime();
  else if (b === 0 && bd.ring !== null && bd.ring !== undefined) fallSound();
  else if (bd.bump !== null && bd.bump !== undefined) click(0.55, 0.8);
  else if (bd.agent !== prevAgent && !bd.jump) click();
}

/* ---------- Controls ---------- */

// Fast-forward: when Next skips moves, the grid plays them quickly (1 to 2 seconds) while the status line counts up.
// Next during it jumps to the end, Back cancels it; with reduced motion there is none, and the skip note says how far it went.
let ff = null;
function fastForward(skip, prevAgent) {
  const Q = qAfter(skip.from), dur = Math.min(2200, 900 + skip.moves * 4);
  let done = skip.from, shown = -1;
  const start = performance.now();
  const frame = (now) => {
    const m = Math.min(skip.to - 1, skip.from + Math.max(1, Math.floor((skip.moves * (now - start)) / dur)));
    while (done < m) { const st = steps[done]; Q[st.s][st.a] = st.nu; done++; }
    if (m !== shown) {
      shown = m;
      const st = X(m);
      drawGrid({ Q, agent: st.done ? GOAL : st.s2, ring: st.fell, sel: null, jump: true, showPath: true }, false);
      out.innerHTML = `<p class="lbl">${status(st, st.t)}</p><p class="slide ff">${tr("Skipping ahead", "Adelantando")}</p><p class="muted">${tr(`${skip.moves} moves go by. Press Next to jump to the end.`, `Pasan ${skip.moves} movimientos. Presiona Siguiente para saltar al final.`)}</p>`;
    }
    if (now - start >= dur) finishFF(true, prevAgent);
    else ff.raf = requestAnimationFrame(frame);
  };
  ff = { raf: requestAnimationFrame(frame), prevAgent };
}
function finishFF(show, prevAgent) {
  if (!ff) return;
  cancelAnimationFrame(ff.raf); ff = null;
  if (show) { render(true); playFor(prevAgent); }
}
function next() {
  if (ff) { finishFF(true, ff.prevAgent); return; }
  const prevAgent = slides[k].builds[b].agent;
  if (b < slides[k].builds.length - 1) b++;
  else if (k < slides.length - 1) { k++; b = 0; }
  else return;
  const skip = b === 0 ? slides[k].skip : null;
  if (skip && !reducedMotion.matches) fastForward(skip, prevAgent);
  else { render(true); playFor(prevAgent); }
}
function back() {
  if (ff) finishFF(false);
  if (b > 0) b--;
  else if (k > 0) { k--; b = slides[k].builds.length - 1; }
  else return;
  render(false);
}
nextBtn.addEventListener("click", next);
backBtn.addEventListener("click", back);
// Reset: back to the first slide with nothing selected; focus moves to Next, since Reset itself disappears.
resetBtn.addEventListener("click", () => {
  finishFF(false);
  k = 0; b = 0; pinned = null;
  render(false);
  nextBtn.focus();
});
document.getElementById("fig-cliff-sound").addEventListener("click", (e) => {
  soundOn = !soundOn;
  e.currentTarget.setAttribute("aria-pressed", String(soundOn));
  e.currentTarget.textContent = soundOn ? tr("Sound on", "Con sonido") : tr("Sound off", "Sin sonido");
});
fig.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
});
render(false);
