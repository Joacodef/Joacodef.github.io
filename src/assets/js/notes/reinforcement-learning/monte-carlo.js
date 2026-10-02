import { tr } from "../../plane.js";
import { cookie, NAME, rngFrom, epsGreedy, num, eqv, listAnd, listOr, sym, slideshow } from "./gridworld.js";

/* ---------- Section 4: on-policy first-visit Monte Carlo control on the cookie grid ---------- */

// ε = 0.1 and γ = 0.9, every value 0 at first, ties broken at random, each value the average of its first-visit
// returns. With this seed, episode 1 wanders 8 moves with a loop; after its sweep the best moves already reach the cookie
// in 6 moves, and in episode 9 a random first move finds the shortest route, 4 moves, which they keep to the end.
const EPS = 0.1, GAMMA = 0.9, SEED = 28869, EPISODES = 30;
const { START, GOAL, cellName, moveName, stepEnv, freshQ, reason, takeText } = cookie;
const UP = 0, RIGHT = 1;

// The whole run, computed once, as a list of events: the moves of an episode, then each step of its sweep back, from
// its last move to its first. Every event keeps the table after it (moves leave it as it was); a step of the sweep also
// keeps the return G it computed and whether its pair was updated (its first visit) or skipped.
const events = [], episodes = [];
{
  const rnd = rngFrom(SEED), Q = freshQ(), N = freshQ(), copy = (M) => M.map((r) => r.slice());
  for (let ep = 1; ep <= EPISODES; ep++) {
    const moves = []; let s = START;
    while (true) {
      const c = epsGreedy(Q, s, EPS, rnd), o = stepEnv(s, c.a);
      const m = { kind: "move", ep, t: moves.length, s, a: c.a, explored: c.explored, ...o, Q: copy(Q) };
      m.first = !moves.some((y) => y.s === s && y.a === c.a);
      moves.push(m); events.push(m);
      if (o.done) break;
      s = o.s2;
    }
    let G = 0;
    for (let t = moves.length - 1; t >= 0; t--) {
      const m = moves[t], prevG = G, old = Q[m.s][m.a];
      G = GAMMA * G + m.r;
      if (m.first) { N[m.s][m.a]++; Q[m.s][m.a] = old + (G - old) / N[m.s][m.a]; }
      const earlier = moves.findIndex((y) => y.s === m.s && y.a === m.a);
      events.push({ kind: "sweep", ep, t, s: m.s, a: m.a, r: m.r, prevG, G, first: m.first, earlier, old, nu: Q[m.s][m.a], n: N[m.s][m.a], Q: copy(Q) });
    }
    episodes.push({ moves });
  }
}
const X = (i) => events[i], epOf = (i) => episodes[X(i).ep - 1], last = events.length - 1;
const find = (ep, kind, t) => events.findIndex((x) => x.ep === ep && x.kind === kind && x.t === t);

// The moves of an episode before time to, outlined in dashed blue: the part not yet swept. And the first visits from
// time from on, which the sweep has updated, outlined in green.
const trail = (e, to) => e.moves.slice(0, to).map((m) => ({ c: m.s, a: m.a, kind: "step" }));
const swept = (e, from) => e.moves.slice(from).filter((m) => m.first).map((m) => ({ c: m.s, a: m.a, kind: "upd" }));
// The state after event i: after a move, the agent where it went and the next move in yellow; in a sweep, the agent at
// the cookie, the rest of the episode in blue and what the sweep has updated in green.
function after(i) {
  const x = X(i), e = epOf(i), y = X(i + 1);
  if (x.kind === "move") return { ep: x.ep, move: x.t + 1, time: x.t + 1, at: i, Q: x.Q, agent: x.s2, marks: trail(e, x.t + 1), pick: y && y.kind === "move" ? [y.s, y.a] : undefined };
  return { ep: x.ep, time: x.t, stage: "after", at: i, Q: x.Q, agent: GOAL, marks: [...trail(e, x.t), ...swept(e, x.t)] };
}
// The cells the best moves lead through from A1 while each cell has a tried move, worth more than 0, or null.
function route(Q) {
  let s = START; const p = [s];
  for (let k = 0; k < 9; k++) {
    const m = Math.max(...Q[s]); if (m <= 0) return null;
    const n = stepEnv(s, Q[s].indexOf(m)).s2; if (n === s || p.includes(n)) return null;
    p.push(n); if (n === GOAL) return p; s = n;
  }
  return null;
}

/* ---------- Builds: one line of the algorithm per press ---------- */

const pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });
// Choose A: the move turns yellow before the agent moves, from the table as it stood when the episode began.
function chooseBuild(i, lead, extra = "") {
  const x = X(i);
  return { ...pos(i), time: x.t, Q: x.Q, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], marks: trail(epOf(i), x.t), line: `${lead} ${reason(x.Q[x.s], x.explored, x.s, x.a, x.t)}${extra}` };
}
// Take A: the agent moves along the yellow move; no value changes.
function takeBuild(i, extra = "") {
  const x = X(i), bump = x.s2 === x.s ? x.a : null;
  return { ...pos(i), time: x.t, Q: x.Q, agent: x.s2, pick: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, marks: trail(epOf(i), x.t), line: takeText(x) + extra };
}
const gEq = (x) => `<i>G</i> <span class="nowrap">← γ<i>G</i> + ${sym("R", x.t + 1)}</span> <span class="nowrap">= 0.9 · ${num(x.prevG)} + ${num(x.r)}</span> <span class="nowrap">${eqv(x.G)}</span>`;
const qEq = (x) => `<i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) <span class="nowrap">← ${num(x.old)} + [${num(x.G)} − ${num(x.old)}]/${x.n}</span> <span class="nowrap">${eqv(x.nu)}</span>`;
// A step of the sweep, before its update: its move still in the blue part, with G computed.
function gBuild(i, line) {
  const x = X(i), e = epOf(i);
  return { ep: x.ep, time: x.t, stage: "after", at: i, Q: X(i - 1).Q, agent: GOAL, marks: [...trail(e, x.t + 1), ...swept(e, x.t + 1)], line, eq: gEq(x) };
}
// A step of the sweep, after its update: its pair green when this was its first visit.
const stepBuild = (i, line, eq) => ({ ...after(i), line, eq });

/* ---------- Moments of the run ---------- */

const e1 = episodes[0], T1 = e1.moves.length;
// The first step of episode 1's sweep that skips a pair seen earlier in the episode, and that pair's first visit.
const skipStep = events.findIndex((x) => x.ep === 1 && x.kind === "sweep" && !x.first);
const firstVisit = find(1, "sweep", X(skipStep).earlier);
// Episode 2's sweep step for that same pair: its second return.
const second = events.findIndex((x) => x.ep === 2 && x.kind === "sweep" && x.s === X(skipStep).s && x.a === X(skipStep).a);
// The step after which the best moves reach the cookie in 4 moves, and the move of that episode that made it possible.
let shortcut = null;
events.forEach((x, i) => { if (x.kind === "sweep") { const p = route(x.Q); if (p && p.length === 5 && !(route(X(i - 1).Q)?.length === 5)) shortcut = i; } });
const sc = X(shortcut), scFirstMove = find(sc.ep, "move", 0);

/* ---------- Slides ---------- */

const slides = [];
slides.push({ title: tr("Monte Carlo on the cookie grid", "Monte Carlo en la grilla de la galleta"), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: freshQ(), agent: START, line: tr(
  `All values start at 0. The agent stands at ${sym("S", 0)} = A1.`,
  `Todos los valores parten en 0. El agente está en ${sym("S", 0)} = A1.`) }] });
slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
  chooseBuild(0, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")),
  takeBuild(0, tr(" No value changes: the returns are known only when the episode ends.", " Ningún valor cambia: los retornos se conocen solo cuando termina el episodio.")),
] });
slides.push({ title: tr("Move 2", "Movimiento 2"), builds: [
  chooseBuild(1, tr("It chooses its next move from the same table.", "Elige su siguiente movimiento con la misma tabla.")),
  takeBuild(1),
] });
{
  const i = T1 - 1;
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [stepBuild(i, tr(
    `The agent reaches the cookie after ${T1} moves: ${sym("R", T1)} = 1, and the episode ends at <i>T</i> = ${T1}. No value has changed. Now the returns can be computed, from the last move back, starting with <i>G</i> ← 0.`,
    `El agente llega a la galleta después de ${T1} movimientos: ${sym("R", T1)} = 1, y el episodio termina en <i>T</i> = ${T1}. Ningún valor ha cambiado. Ahora se pueden calcular los retornos, desde el último movimiento hacia atrás, partiendo con <i>G</i> ← 0.`))] });
}
{
  const i = find(1, "sweep", T1 - 1), x = X(i), j = find(1, "sweep", T1 - 2), y = X(j);
  slides.push({ title: tr("Back from the cookie", "De vuelta desde la galleta"), builds: [
    gBuild(i, tr(`The sweep starts at <i>t</i> = ${x.t}, with the move into the cookie, ${moveName(x.s, x.a)}.`, `El recorrido parte en <i>t</i> = ${x.t}, con el movimiento hacia la galleta, ${moveName(x.s, x.a)}.`)),
    stepBuild(i, tr(
      `${moveName(x.s, x.a)} appears nowhere earlier in the episode, so <i>G</i> is its first return, and its value is their average, computed as you go.`,
      `${moveName(x.s, x.a)} no aparece antes en el episodio, así que <i>G</i> es su primer retorno, y su valor es el promedio de sus retornos, calculado sobre la marcha.`), qEq(x)),
    stepBuild(j, tr(
      `One step back, <i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, its first return, so its value is ${num(y.nu)}.`,
      `Un paso atrás, <i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, su primer retorno, así que su valor es ${num(y.nu)}.`), gEq(y)),
  ] });
}
{
  const x = X(skipStep), f = X(firstVisit), mid = [];
  for (let t = x.t - 1; t > f.t; t--) mid.push(find(1, "sweep", t));
  slides.push({ title: tr("A move made twice", "Un movimiento repetido"), builds: [
    gBuild(skipStep, tr(
      `At <i>t</i> = ${x.t}, ${moveName(x.s, x.a)}: <i>G</i> ${eqv(x.G)}. But the agent also took this move at <i>t</i> = ${f.t}, and first-visit Monte Carlo counts a pair only at its first visit in an episode, so this return is skipped.`,
      `En <i>t</i> = ${x.t}, ${moveName(x.s, x.a)}: <i>G</i> ${eqv(x.G)}. Pero el agente también hizo este movimiento en <i>t</i> = ${f.t}, y first-visit Monte Carlo cuenta un par solo en su primera visita del episodio, así que este retorno se salta.`)),
    ...mid.map((i) => { const y = X(i); return stepBuild(i, tr(
      `<i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, its first return.`,
      `<i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, su primer retorno.`), gEq(y)); }),
    stepBuild(firstVisit, tr(
      `<i>t</i> = ${f.t}, ${moveName(f.s, f.a)} at its first visit: <i>G</i> ${eqv(f.G)}, and that is its value, not the ${num(x.G)} of <i>t</i> = ${x.t}. Every-visit Monte Carlo would average both.`,
      `<i>t</i> = ${f.t}, ${moveName(f.s, f.a)} en su primera visita: <i>G</i> ${eqv(f.G)}, y ese es su valor, no el ${num(x.G)} de <i>t</i> = ${x.t}. Every-visit Monte Carlo promediaría ambos.`), gEq(f)),
  ] });
}
{
  const i = find(1, "sweep", 0), Q = X(i).Q, p = route(Q), loop = e1.moves.find((m) => !m.first), c = loop.s2;
  const best = Q[c].indexOf(Math.max(...Q[c])), others = [0, 1, 2, 3].filter((a) => a !== best && Q[c][a] > 0);
  const vs = others.map((a) => `${NAME[a]} (${num(Q[c][a])})`);
  slides.push({ title: tr("The loop is cut", "Se corta el bucle"), builds: [{ ...stepBuild(i, tr(
    `The sweep reaches <i>t</i> = 0, and only now has the table changed: each move of the episode holds its return, 0.9 for each move farther from the cookie. In ${cellName(c)}, ${NAME[best]} (${num(Q[c][best])}) beats ${listAnd(vs)}, so the best moves cut out the loop and reach the cookie from A1 in ${p.length - 1} moves.`,
    `El recorrido llega a <i>t</i> = 0, y solo ahora cambió la tabla: cada movimiento del episodio tiene su retorno, 0.9 por cada movimiento más lejos de la galleta. En ${cellName(c)}, ${NAME[best]} (${num(Q[c][best])}) le gana a ${listAnd(vs)}, así que los mejores movimientos cortan el bucle y llegan a la galleta desde A1 en ${p.length - 1} movimientos.`)), route: p }] });
}
{
  const x = X(second), T2 = episodes[1].moves.length, f = X(firstVisit);
  slides.push({ title: tr("A second return", "Un segundo retorno"), builds: [stepBuild(second, tr(
    `Episode 2 follows the best moves, ${T2} moves, and its sweep adds a second return to each of them. For ${moveName(x.s, x.a)}, the first was ${num(f.G)} and this one is ${num(x.G)}; its value is now their average.`,
    `El episodio 2 sigue los mejores movimientos, ${T2} movimientos, y su recorrido le agrega un segundo retorno a cada uno. Para ${moveName(x.s, x.a)}, el primero fue ${num(f.G)} y este es ${num(x.G)}; su valor es ahora el promedio de ambos.`), qEq(x))] });
}
{
  const m = X(scFirstMove), before = m.Q[m.s], best = before.indexOf(Math.max(...before));
  slides.push({ title: tr("A random first move", "Un primer movimiento al azar"), builds: [
    chooseBuild(scFirstMove, tr("The agent chooses its first move.", "El agente elige su primer movimiento."), tr(
      ` ${NAME[m.a][0].toUpperCase() + NAME[m.a].slice(1)} has never been tried in ${cellName(m.s)}: at 0, it looks worse than ${NAME[best]}, ${num(before[best])}, so only a random move can try it.`,
      ` ${NAME[m.a][0].toUpperCase() + NAME[m.a].slice(1)} nunca se ha probado en ${cellName(m.s)}: con 0, parece peor que ${NAME[best]}, ${num(before[best])}, así que solo un movimiento al azar puede probarlo.`)),
    takeBuild(scFirstMove),
  ] });
}
{
  const up = sc.Q[sc.s][UP], other = sc.a === RIGHT ? UP : RIGHT;
  slides.push({ title: tr("A shortcut", "Un atajo"), builds: [{ ...stepBuild(shortcut, tr(
    `The sweep reaches <i>t</i> = 0: <i>G</i> ${eqv(sc.G)} is the first return of ${moveName(sc.s, sc.a)}, above ${NAME[other]}'s average, ${num(sc.Q[sc.s][other])}, which holds the long route's returns. The best move in ${cellName(sc.s)} becomes ${NAME[sc.a]}, and the best moves reach the cookie in 4 moves, the shortest route. They keep it to the end.`,
    `El recorrido llega a <i>t</i> = 0: <i>G</i> ${eqv(sc.G)} es el primer retorno de ${moveName(sc.s, sc.a)}, más que el promedio de ${NAME[other]}, ${num(sc.Q[sc.s][other])}, que guarda los retornos de la ruta larga. El mejor movimiento en ${cellName(sc.s)} pasa a ser ${NAME[sc.a]}, y los mejores movimientos llegan a la galleta en 4 movimientos, la ruta más corta. Ahí se quedan hasta el final.`), qEq(sc)), route: route(sc.Q) }] });
}
{
  const Q = X(last).Q, p = route(Q), n = p.length - 1, vals = p.slice(0, -1).map((s) => num(Math.max(...Q[s]))).join(", ");
  // The returns of the shortest trip, one per move of the route: 0.9 to the power of the moves still to come.
  const shortest = p.slice(0, -1).map((_, j) => num(GAMMA ** (n - 1 - j))).join(", ");
  const a1 = Q[START], off = a1.indexOf(Math.max(...a1)) === RIGHT ? UP : RIGHT;
  const never = [...Array(9).keys()].filter((s) => s !== GOAL && Q[s].every((v) => v === 0)).map(cellName);
  slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...stepBuild(last, tr(
    `Along the route the values are ${vals}, a little below the shortest trip's returns, ${shortest}, where early trips and exploring moves are still in the averages. ${NAME[off][0].toUpperCase() + NAME[off].slice(1)} in A1 keeps ${num(a1[off])} from the long route.${never.length ? ` The agent never visited ${listOr(never)}, so their moves have no values.` : ""}`,
    `A lo largo de la ruta, los valores son ${vals}, un poco por debajo de los retornos del viaje más corto, ${shortest}, donde los viajes del principio y los movimientos de exploración siguen en los promedios. ${NAME[off][0].toUpperCase() + NAME[off].slice(1)} en A1 conserva ${num(a1[off])} de la ruta larga.${never.length ? ` El agente nunca visitó ${listOr(never)}, así que sus movimientos no tienen valores.` : ""}`)), route: p }] });
}
// How far each slide jumps ahead of the one before it: the moves it skips, or the steps of a sweep.
for (let i = 1; i < slides.length; i++) {
  const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
  if (gap <= 1) continue;
  // The events skipped, counting the one the slide shows, as the cliff figures count moves.
  const between = events.slice(from + 1, to + 1), sm = between.filter((x) => x.kind === "move").length, ss = between.length - sm;
  const epFrom = from >= 0 ? X(from).ep + (X(from).kind === "sweep" && X(from).t === 0 ? 1 : 0) : 1, epTo = X(to).ep;
  const text = sm ? tr(`${sm} moves later`, `${sm} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "")
    : tr(`The sweep goes on to <i>t</i> = ${X(to).t}`, `El recorrido sigue hasta <i>t</i> = ${X(to).t}`);
  const oneEp = between.every((x) => x.ep === between[0].ep);
  const note = sm && ss ? (oneEp ? tr(`${sm} moves go by, then the sweep back begins.`, `Pasan ${sm} movimientos, y luego empieza el recorrido hacia atrás.`) : tr(`${sm} moves go by, each episode followed by its sweep back.`, `Pasan ${sm} movimientos, cada episodio seguido de su recorrido hacia atrás.`))
    : sm ? tr(`${sm} moves go by, and no value changes.`, `Pasan ${sm} movimientos, y ningún valor cambia.`)
    : tr(`The sweep goes back ${ss} steps.`, `El recorrido retrocede ${ss} pasos.`);
  slides[i].skip = { from, to, moves: gap, text, note };
}

slideshow({ svg: document.getElementById("fig-mc"), slides, frame: after, world: cookie });
