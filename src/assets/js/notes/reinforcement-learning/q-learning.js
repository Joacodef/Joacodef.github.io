import { tr } from "../../plane.js";
import { START, GOAL, W, H, cellName, stepEnv, rngFrom, freshQ, epsGreedy, greedyPath, num, par, eqv, count, sym, reason, takeText, slideshow } from "./gridworld.js";

/* ---------- Section 2: Q-learning on the cliff, stepped through like slides ---------- */

// Learning: α = 0.5, γ = 1 and ε = 0.1, with ties broken at random. With this seed the best moves settle on the
// shortest path, 7 moves, in episode 19; the figure shows 30 episodes, under a thousand moves in all.
const ALPHA = 0.5, EPS = 0.1, SEED = 817, EPISODES = 30, OPT = 7;

// The whole run, computed once: every move, with what its update used.
const steps = [];
{
  const rnd = rngFrom(SEED), Q = freshQ();
  let s = START, ep = 1, t = 0;
  while (ep <= EPISODES) {
    const { a, explored } = epsGreedy(Q, s, EPS, rnd);
    const o = stepEnv(s, a), maxNext = o.done ? 0 : Math.max(...Q[o.s2]);
    const old = Q[s][a], nu = old + ALPHA * (o.r + maxNext - old);
    Q[s][a] = nu;
    steps.push({ ep, t: ++t, s, a, ...o, explored, old, nu, maxNext, target: o.r + maxNext });
    if (o.done) { s = START; ep++; t = 0; } else s = o.s2;
  }
}
// The table after the first n moves.
const qAfter = (n) => { const Q = freshQ(); for (let i = 0; i < n; i++) Q[steps[i].s][steps[i].a] = steps[i].nu; return Q; };

// Moments of the run: the falls, when every move has been tried, when the best moves first reach the goal, and when
// they settle on the shortest path for good.
const last = steps.length, X = (n) => steps[n - 1], epEnd = (e) => steps.findIndex((x) => x.ep === e && x.done) + 1;
const falls = steps.map((x, i) => (x.fell !== null ? i + 1 : null)).filter((x) => x !== null);
let allTried = null, connect = null, learned = null;
{
  const tried = new Set(), pairs = (W * H - 5) * 4, Q = freshQ();
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

// The four builds of a detailed move, one per line of the algorithm: choose A (in yellow), take it, build the target
// from the best moves of the next state (in red), and update the pair just tried (in green).
function moveBuilds(n, lead) {
  const x = X(n), Qpre = qAfter(n - 1), t = x.t - 1, S0 = sym("S", t), A0 = sym("A", t), R1 = sym("R", t + 1), S1 = sym("S", t + 1);
  const next = Qpre[x.s2], untried = next.filter((v) => v === 0).length;
  const where = next.every((v) => v === 0) ? tr(", where every move is still worth 0", ", donde todos los movimientos aún valen 0")
    : x.maxNext === 0 && untried ? tr(`, where ${untried === 1 ? "one move is" : `${untried} moves are`} untried and still worth 0`, `, donde ${untried === 1 ? "un movimiento sin probar aún vale 0" : `${untried} movimientos sin probar aún valen 0`}`) : "";
  // What red marks: the best move or moves of the next state, whose value the target borrows.
  const top = Math.max(...next), tied = next.filter((v) => v === top).length;
  const which = tied === 4 && top === 0 ? tr("every move there is still worth 0, so all four tie for it and are outlined in red", "todos sus movimientos aún valen 0, así que los cuatro empatan y tienen borde rojo")
    : tied > 1 && top === 0 ? tr(`its ${tied} untried moves, still worth 0, tie for it and are outlined in red`, `sus ${tied} movimientos sin probar, que aún valen 0, empatan y tienen borde rojo`)
    : tied > 1 ? tr(`${tied} of its moves tie for it at ${num(top)} and are outlined in red`, `${tied} de sus movimientos empatan en ${num(top)} y tienen borde rojo`)
    : tr(`the move outlined in red, worth ${num(top)}`, `el movimiento con borde rojo, que vale ${num(top)}`);
  const target = tr(`${R1} and ${S1} are known at <i>t</i> = ${t + 1}. The target adds ${R1} to the best value in ${S1}: ${which}.`, `${R1} y ${S1} se conocen en <i>t</i> = ${t + 1}. El objetivo suma ${R1} al mejor valor en ${S1}: ${which}.`);
  const update = tr(`Still at <i>t</i> = ${t + 1}, the value of the pair the agent just left, <i>Q</i>(${S0}, ${A0}), moves halfway toward the target, from ${num(x.old)} to ${num(x.nu)}.`, `Todavía en <i>t</i> = ${t + 1}, el valor del par que el agente acaba de dejar, <i>Q</i>(${S0}, ${A0}), avanza la mitad del camino hacia el objetivo, de ${num(x.old)} a ${num(x.nu)}.`);
  const tgtEq = `${tr("target", "objetivo")} = <span class="pt">${R1} + γ max<sub><i>a</i></sub> <i>Q</i>(${S1}, <i>a</i>) <span class="nowrap">= ${num(x.r)} + ${par(x.maxNext)}</span> <span class="nowrap">= ${num(x.target)}</span></span>`;
  const updEq = `<i>Q</i>(${S0}, ${A0}) <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${num(x.target)}</span> − ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`;
  const bump = x.fell === null && x.s2 === x.s ? x.a : null, pos = { ep: x.ep, move: x.t }, pick = [x.s, x.a];
  // The target's moves: the best ones in the next state, from the values before the update.
  const tg = x.done ? [] : next.map((v, a) => (v === Math.max(...next) ? { c: x.s2, a, kind: "tg" } : null)).filter(Boolean);
  return [
    { ...pos, time: t, Q: Qpre, agent: x.s, pick, line: `${lead} ${reason(Qpre[x.s], x.explored, x.s, x.a, t)}` },
    { ...pos, time: t, Q: Qpre, agent: x.fell !== null ? x.fell : x.s2, ring: x.fell, pick, bump, sound: x.fell !== null ? "fall" : bump !== null ? "wall" : undefined, line: takeText({ s: x.s, a: x.a, t, s2: x.s2, fell: x.fell }) },
    { ...pos, time: t + 1, Q: Qpre, agent: x.s2, jump: x.fell !== null, ring: x.fell, marks: tg, line: target, eq: tgtEq },
    { ...pos, time: t + 1, Q: qAfter(n), agent: x.s2, ring: x.fell, marks: [...tg, { c: x.s, a: x.a, kind: "upd" }], line: update, eq: updEq },
  ];
}
// A slide shown whole: the state after move n and, with withEq, the update that move made, in green.
function wholeSlide(n, line, withEq) {
  const x = n ? X(n) : null, Q = qAfter(n), t = x ? x.t - 1 : 0, to = x ? (x.done ? GOAL : x.s2) : START;
  let eq = null;
  if (withEq) eq = `<i>Q</i>(${sym("S", t)}, ${sym("A", t)}) <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${x.done ? "−1" : `${num(x.r)} + ${par(x.maxNext)}`}</span> − ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`;
  const fell = withEq && x.fell !== null;
  return [{ ep: x ? x.ep : 1, move: x ? x.t : null, Q, agent: to, ring: fell ? x.fell : null, sound: fell ? "fall" : undefined, marks: withEq ? [{ c: x.s, a: x.a, kind: "upd" }] : [], line, eq, time: x ? t + 1 : 0 }];
}

// Q-learning chooses each move after the last update, from the table as it stands.
const nextLead = tr("It chooses its next move from the table as it stands, after the last update.", "Elige su siguiente movimiento con la tabla tal como está, después de la última actualización.");
const T1 = X(epEnd(1)).t, f1 = fallsIn(0, epEnd(1));
const firstPath = greedyPath(qAfter(connect)).length - 1;
const xa = X(fallAfter), At = sym("A", xa.t - 1), St = sym("S", xa.t - 1);
const finalValues = (() => { const Q = qAfter(last); return greedyPath(Q).slice(0, -1).map((s) => num(Math.max(...Q[s]))).join(", "); })();
const slides = [
  { n: 0, title: tr("Q-learning on the cliff", "Q-learning en el acantilado"), builds: wholeSlide(0, tr(
    `All values start at 0 again, with the agent at ${sym("S", 0)} = A1.`,
    `Todos los valores vuelven a partir en 0, con el agente en ${sym("S", 0)} = A1.`)) },
  { n: 1, title: tr("Move 1", "Movimiento 1"), builds: moveBuilds(1, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")) },
  { n: 2, title: tr("Move 2", "Movimiento 2"), builds: moveBuilds(2, nextLead) },
  { n: 3, title: tr("Move 3", "Movimiento 3"), builds: moveBuilds(3, nextLead) },
  { n: falls[0], title: tr("The first fall", "La primera caída"), builds: moveBuilds(falls[0], nextLead) },
  { n: epEnd(1), title: tr("Episode 1 ends", "Termina el episodio 1"), builds: wholeSlide(epEnd(1), tr(
    `The agent reaches the goal after ${T1} moves, with ${count(f1, "fall", "falls")} on the way.`,
    `El agente llega a la meta después de ${T1} movimientos, con ${count(f1, "caída", "caídas")} en el camino.`), true) },
  { n: allTried, title: tr("Every move tried", "Todos los movimientos probados"), builds: wholeSlide(allTried, tr(
    `After ${allTried} moves in all, every move in every cell has been tried at least once. From here on the agent's choices rest on real estimates, not on untried zeros.`,
    `Tras ${allTried} movimientos en total, cada movimiento de cada celda se ha probado al menos una vez. Desde aquí, las elecciones del agente se basan en estimaciones reales, no en ceros sin probar.`)) },
  { n: connect, title: tr("A first way through", "Un primer camino"), builds: wholeSlide(connect, tr(
    `In episode ${X(connect).ep}, following the best move from each cell first leads from A1 to the goal: ${firstPath} moves, not yet the shortest route.`,
    `En el episodio ${X(connect).ep}, seguir el mejor movimiento de cada celda lleva por primera vez de A1 a la meta: ${firstPath} movimientos, todavía no la ruta más corta.`)) },
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

slideshow({
  svg: document.getElementById("fig-cliff"),
  slides,
  // The state after m moves, for the frames of a skip: the move just updated in green, the next one in yellow.
  frame: (m) => {
    const x = X(m), y = m < last ? X(m + 1) : null;
    return { Q: qAfter(m), agent: x.done ? GOAL : x.s2, ring: x.fell, ep: x.ep, move: x.t, time: x.t,
      marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
  },
});
