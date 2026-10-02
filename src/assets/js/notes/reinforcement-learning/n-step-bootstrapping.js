import { tr } from "../../plane.js";
import { START, NAME, cellName, moveName, stepEnv, rngFrom, freshQ, epsGreedy, greedyPath, num, par, eqv, count, listAnd, sym, reason, takeText, chooseTakeText, slideshow } from "./gridworld.js";

/* ---------- Section 3: 4-step Sarsa on the cliff, stepped through like slides ---------- */

// 4-step Sarsa with α = 0.5, γ = 1 and ε = 0.1, as in the Q-learning figure, with ties broken at random. This seed has a
// short first episode, 18 moves with one fall at move 6, which the figure plays move by move; a random fall in episode 28
// pushes the first step of the top row off the route for a while, and the best moves settle on the top row in episode
// 29. The figure shows 30 episodes, under a thousand moves in all.
const N = 4, ALPHA = 0.5, EPS = 0.1, SEED = 2606746, EPISODES = 30;

// The whole run, computed once, as in the book's n-step Sarsa: take A_t, observe R_t+1 and S_t+1, pick A_t+1, then
// update the pair from τ = t − n + 1. After the goal, the last n − 1 pairs are updated with the rewards left.
// moves[i].qAt is how many updates had been made when its action was picked; upd lists the updates made right after it.
const moves = [], updates = [], episodes = [];
{
  const rnd = rngFrom(SEED), Q = freshQ();
  for (let ep = 1; ep <= EPISODES; ep++) {
    const S = [START], A = [], R = [null], first = moves.length;
    let c = epsGreedy(Q, START, EPS, rnd); A.push(c.a);
    const picks = [{ explored: c.explored, at: updates.length }];
    let T = Infinity;
    for (let t = 0; ; t++) {
      if (t < T) {
        const o = stepEnv(S[t], A[t]); R.push(o.r); S.push(o.s2);
        moves.push({ ep, t, s: S[t], a: A[t], explored: picks[t].explored, qAt: picks[t].at, ...o, upd: [] });
        if (o.done) T = t + 1;
        else { const at = updates.length; c = epsGreedy(Q, o.s2, EPS, rnd); A.push(c.a); picks.push({ explored: c.explored, at }); }
      }
      const tau = t - N + 1;
      if (tau >= 0) {
        const rs = R.slice(tau + 1, Math.min(tau + N, T) + 1);
        const boot = tau + N < T ? Q[S[tau + N]][A[tau + N]] : null;
        const G = rs.reduce((x, y) => x + y, 0) + (boot ?? 0);
        const old = Q[S[tau]][A[tau]], nu = old + ALPHA * (G - old);
        Q[S[tau]][A[tau]] = nu;
        updates.push({ ep, tau, s: S[tau], a: A[tau], rs, boot, G, old, nu });
        moves[moves.length - 1].upd.push(updates.length - 1);
      }
      if (tau === T - 1) break;
    }
    episodes.push({ S, A, T, first });
  }
}
// The table after the first k updates; the updates made up to and including move i, and before it.
const qAfter = (k) => { const Q = freshQ(); for (let i = 0; i < k; i++) Q[updates[i].s][updates[i].a] = updates[i].nu; return Q; };
const doneAt = [];
{ let k = 0; moves.forEach((m, i) => { k += m.upd.length; doneAt[i] = k; }); }
const doneBefore = (i) => doneAt[i] - moves[i].upd.length;
const moveOf = (u) => moves.findIndex((m) => m.upd.includes(u));
const epOf = (i) => episodes[moves[i].ep - 1];
const U = (ep, tau) => updates.findIndex((u) => u.ep === ep && u.tau === tau);

// Moments of the run: the first fall, the end of episode 1, the update after which the best moves settle on their
// final path, and a later fall that lands in the target of a move on that path.
const falls = moves.filter((m) => m.fell !== null), firstFall = moves.indexOf(falls[0]);
const ep1 = episodes[0], ep1Last = ep1.first + ep1.T - 1;
let settleU = null;
{
  const Q = freshQ(); let last = null;
  updates.forEach((u, i) => { Q[u.s][u.a] = u.nu; const p = greedyPath(Q), key = p ? p.join() : ""; if (key !== last) { settleU = p ? i : null; last = key; } });
}
const finalQ = qAfter(updates.length), finalPath = greedyPath(finalQ);
const onPath = new Set(finalPath.slice(0, -1).map((s) => s * 4 + finalQ[s].indexOf(Math.max(...finalQ[s]))));
// A fall that lands in the target of a move on that path: after the settling or, failing that, after the path first
// appeared, while the best moves follow it.
let luckU = updates.findIndex((u, i) => i > settleU && u.rs.includes(-100) && onPath.has(u.s * 4 + u.a));
if (luckU < 0) {
  const Q = freshQ(); let firstFinal = null;
  updates.forEach((u, i) => { Q[u.s][u.a] = u.nu; if (firstFinal === null && greedyPath(Q)?.join() === finalPath.join()) firstFinal = i; });
  luckU = updates.findIndex((u, i) => i > firstFinal && u.rs.includes(-100) && onPath.has(u.s * 4 + u.a));
}

/* ---------- Builds: one line of the algorithm per press ---------- */

const Gsym = (a, b) => `<i>G</i><sub>${a}:${b}</sub>`;
const pairOf = (t) => `<i>Q</i>(${sym("S", t)}, ${sym("A", t)})`;
// A sum of rewards as it reads: −1 − 1 − 100 − 1.
const sumText = (rs) => rs.map((r, i) => (i === 0 ? num(r) : `− ${num(-r)}`)).join(" ");
// Where a build stands: at is the move's place in the whole run, for the skip notes.
const at = (i) => ({ ep: moves[i].ep, move: moves[i].t + 1, at: i });
// The moves of episode e from time from to to − 1, outlined in blue: the steps of a window.
const steps = (e, from, to) => { const m = []; for (let j = from; j < to; j++) m.push({ c: e.S[j], a: e.A[j], kind: "step" }); return m; };
const ringsOf = (e, from, to) => { const r = []; for (let j = from; j < to; j++) { const f = moves[e.first + j].fell; if (f !== null) r.push(f); } return r; };
const winStart = (x) => Math.max(0, x.t - N + 1);

// Choose A_t: the move turns yellow before the agent moves. The episode's first choice, or one recalled after a skip.
function chooseBuild(i, lead) {
  const x = moves[i], e = epOf(i), Qc = qAfter(x.qAt);
  return { ...at(i), time: x.t, Q: Qc, agent: x.s, pick: [x.s, x.a], marks: steps(e, winStart(x), x.t), line: `${lead} ${reason(Qc[x.s], x.explored, x.s, x.a, x.t)}` };
}
// Take A_t: the agent moves along the yellow move; the window so far is outlined in blue.
function takeBuild(i, extra = "") {
  const x = moves[i], e = epOf(i), bump = x.fell === null && x.s2 === x.s ? x.a : null;
  return { ...at(i), time: x.t, Q: qAfter(doneBefore(i)), agent: x.fell !== null ? x.fell : x.s2, ring: x.fell, taken: [x.s, x.a], bump, sound: x.fell !== null ? "fall" : bump !== null ? "wall" : undefined,
    marks: steps(e, winStart(x), x.t), rings: ringsOf(e, winStart(x), x.t), line: takeText({ s: x.s, a: x.a, t: x.t, s2: x.s2, fell: x.fell }) + extra };
}
// Choose A_t+1 in S_t+1, before any update, from the table as it stands.
function chooseNextBuild(i, extra = "") {
  const x = moves[i], e = epOf(i), y = moves[i + 1], Qc = qAfter(y.qAt);
  return { ...at(i), time: x.t + 1, Q: Qc, agent: x.s2, jump: x.fell !== null, ring: x.fell, pick: [x.s2, y.a], marks: steps(e, winStart(x), x.t + 1), rings: ringsOf(e, winStart(x), x.t),
    line: tr("Before any update, it chooses its next move.", "Antes de cualquier actualización, elige su siguiente movimiento.") + " " + reason(Qc[x.s2], y.explored, x.s2, y.a, x.t + 1) + extra };
}
// What update u draws: the moves of its window in blue, the one it updates in green once updated, and in red the move
// picked after the window, whose value the target ends on (none when the window reaches the goal).
function windowMarks(u, updated) {
  const x = updates[u], e = epOf(moveOf(u)), end = Math.min(x.tau + N, e.T), m = [];
  for (let j = x.tau; j < end; j++) m.push({ c: e.S[j], a: e.A[j], kind: j === x.tau && updated ? "upd" : "step" });
  if (x.boot !== null) m.push({ c: e.S[x.tau + N], a: e.A[x.tau + N], kind: "tg" });
  return { marks: m, rings: ringsOf(e, x.tau, end) };
}
function targetBuild(u, line, eq) {
  const i = moveOf(u), mv = moves[i];
  return { ...at(i), time: mv.t + 1, Q: qAfter(u), agent: mv.s2, ...windowMarks(u, false), line, eq };
}
// fit sets a long equation, one with the rewards written out, smaller on phones.
function updateBuild(u, line, eq, fit = false) {
  const i = moveOf(u), mv = moves[i];
  return { ...at(i), time: mv.t + 1, Q: qAfter(u + 1), agent: mv.s2, ...windowMarks(u, true), line, eq, fit };
}
// A later move of episode 1 in one press: why it was chosen (unless the slide before said so, chosen) and where it led,
// the next move in yellow, and the update its move completes, if any: its window in blue, the pair in green, and the
// move the target ends on in red. more follows the first sentence.
function moveBuild(i, more = "", chosen = false) {
  const x = moves[i], tk = takeBuild(i), y = moves[i + 1], u = x.upd.length ? x.upd[0] : null;
  const w = u !== null ? windowMarks(u, true) : { marks: tk.marks, rings: tk.rings };
  const first = chosen ? tk.line : chooseTakeText(qAfter(x.qAt)[x.s], x.explored, { s: x.s, a: x.a, t: x.t, s2: x.s2, fell: x.fell });
  return { ...at(i), time: x.t + 1, Q: qAfter(doneAt[i]), agent: x.s2, jump: x.fell !== null, ring: x.fell, taken: [x.s, x.a], bump: tk.bump, sound: tk.sound,
    pick: y && y.ep === x.ep ? [y.s, y.a] : undefined, marks: w.marks, rings: w.rings, line: `${first}${more ? " " + more : ""}`, eq: u !== null ? updateEq(u, true) : null, fit: true };
}
const targetEq = (u) => { const x = updates[u]; return `${Gsym(x.tau, x.tau + N)} = <span class="pt">${x.rs.map((_, j) => sym("R", x.tau + 1 + j)).join(" + ")}${x.boot === null ? "" : ` + ${pairOf(x.tau + N)}`} <span class="nowrap">= ${sumText(x.rs)}${x.boot === null ? "" : ` + ${par(x.boot)}`}</span> <span class="nowrap">${eqv(x.G)}</span></span>`; };
// The update, with the target as a number, or with inline its rewards and the value it ends on. On a phone the line can
// break before the subtraction.
const updateEq = (u, inline) => { const x = updates[u]; const g = inline ? `(${sumText(x.rs)}${x.boot === null ? "" : ` + ${par(x.boot)}`})` : num(x.G); return `<span class="upd">${pairOf(x.tau)}</span> <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${g}</span></span> <span class="nowrap">− ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`; };

/* ---------- Slides ---------- */

const slides = [];
slides.push({ title: tr(`${N}-step Sarsa on the cliff`, `${N}-step Sarsa en el acantilado`), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: freshQ(), agent: START, line: tr(
  `All values start at 0 again, with the agent at ${sym("S", 0)} = A1. This time each move is updated ${N} moves after it is made, once the ${N} rewards that follow it are known.`,
  `Todos los valores vuelven a partir en 0, con el agente en ${sym("S", 0)} = A1. Esta vez cada movimiento se actualiza ${N} movimientos después de hacerlo, cuando ya se conocen las ${N} recompensas que lo siguen.`) }] });
// Moves 1 to 3: take, then choose the next move; no update yet.
for (let i = 0; i < N - 1; i++) {
  const wait = i === 0
    ? tr(` No update yet: the target of the first move needs ${N} rewards, ${sym("R", 1)} to ${sym("R", N)}.`, ` Aún no hay actualización: el objetivo del primer movimiento necesita ${N} recompensas, de ${sym("R", 1)} a ${sym("R", N)}.`)
    : tr(` Still no update: ${i + 1} of the ${N} rewards are in.`, ` Todavía no hay actualización: van ${i + 1} de las ${N} recompensas.`);
  const b = [takeBuild(i), chooseNextBuild(i, wait)];
  if (i === 0) b.unshift(chooseBuild(0, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")));
  slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: b });
}
{
  const u0 = U(1, 0);
  slides.push({ title: tr(`Move ${N}: the first update`, `Movimiento ${N}: la primera actualización`), builds: [
    takeBuild(N - 1, tr(" That is the fourth reward.", " Es la cuarta recompensa.")),
    chooseNextBuild(N - 1),
    targetBuild(u0, tr(
      `The target of the first move is now complete: its ${N} rewards, outlined in blue, plus the value of the move just chosen, outlined in red.`,
      `El objetivo del primer movimiento ya está completo: sus ${N} recompensas, con borde azul, más el valor del movimiento recién elegido, con borde rojo.`), targetEq(u0)),
    updateBuild(u0, tr(
      `Still at <i>t</i> = ${N}, the value of the first move, ${pairOf(0)}, moves halfway toward the target, from ${num(updates[u0].old)} to ${num(updates[u0].nu)}. It had to wait ${N} moves.`,
      `Todavía en <i>t</i> = ${N}, el valor del primer movimiento, ${pairOf(0)}, avanza la mitad del camino hacia el objetivo, de ${num(updates[u0].old)} a ${num(updates[u0].nu)}. Tuvo que esperar ${N} movimientos.`), updateEq(u0)),
  ] });
  // Moves 5 to 8, up to the first fall: take, choose, and the update of the move made N moves before.
  for (let i = N; i < Math.min(2 * N, firstFall); i++) {
    const u = U(1, i - N + 1), x = updates[u], t = i + 1, name = moveName(x.s, x.a), more = i === N;
    slides.push({ title: tr(`Move ${t}`, `Movimiento ${t}`), builds: [
      takeBuild(i),
      chooseNextBuild(i),
      updateBuild(u, tr(
        `${sym("R", t)} is the fourth reward after the move from τ = ${x.tau}, ${name}, so that move's target is complete: its four rewards plus the value of the move just chosen, outlined in red: ${num(x.boot)}. Its value moves halfway toward ${num(x.G)}, from ${num(x.old)} to ${num(x.nu)}.${more ? ` From now on, each move completes one window and updates the move made ${N} moves before it.` : ""}`,
        `${sym("R", t)} es la cuarta recompensa después del movimiento de τ = ${x.tau}, ${name}, así que el objetivo de ese movimiento está completo: sus cuatro recompensas más el valor del movimiento recién elegido, con borde rojo: ${num(x.boot)}. Su valor avanza la mitad del camino hacia ${num(x.G)}, de ${num(x.old)} a ${num(x.nu)}.${more ? ` Desde ahora, cada movimiento completa una ventana y actualiza el movimiento hecho ${N} movimientos antes.` : ""}`), updateEq(u, true), true),
    ] });
  }
}
{
  const f = moves[firstFall], tau = f.t - N + 1, u = U(f.ep, tau), e = epOf(firstFall), first = moveName(e.S[tau], e.A[tau]);
  for (let i = 2 * N; i < firstFall; i++) slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [moveBuild(i, tr("That completes the window of the move made 4 moves before, which moves halfway toward its target.", "Eso completa la ventana del movimiento hecho 4 movimientos antes, que avanza la mitad del camino hacia su objetivo."))] });
  slides.push({ title: tr("The first fall", "La primera caída"), builds: [
    ...(firstFall >= 2 * N ? [chooseBuild(firstFall, tr("Its move from here was chosen at the end of the last step.", "Su movimiento desde aquí se eligió al final del paso anterior."))] : []),
    takeBuild(firstFall),
    chooseNextBuild(firstFall),
    targetBuild(u, tr(
      `${sym("R", f.t + 1)} is the last of the ${N} rewards of the move from ${N} moves back, τ = ${tau}: ${first}. So the fall enters that move's target, although it came ${N - 1} moves later. The target ends on the value of the move just chosen, outlined in red.`,
      `${sym("R", f.t + 1)} es la última de las ${N} recompensas del movimiento de ${N} movimientos atrás, τ = ${tau}: ${first}. Así, la caída entra en el objetivo de ese movimiento, aunque llegó ${N - 1} movimientos después. El objetivo termina en el valor del movimiento recién elegido, con borde rojo.`), targetEq(u)),
    updateBuild(u, tr(
      `${pairOf(tau)}, ${first}, drops halfway toward it, from ${num(updates[u].old)} to ${num(updates[u].nu)}.`,
      `${pairOf(tau)}, ${first}, baja la mitad del camino hacia él, de ${num(updates[u].old)} a ${num(updates[u].nu)}.`), updateEq(u)),
  ] });
  // Over the next moves, one press each, the fall enters the targets of the other moves before it, down to the one that
  // stepped off.
  const off = moveName(e.S[f.t], e.A[f.t]);
  slides.push({ title: tr("The fall reaches back", "La caída llega hacia atrás"), builds: Array.from({ length: N - 1 }, (_, k) => {
    const j = tau + 1 + k, uj = updates[U(f.ep, j)], name = moveName(uj.s, uj.a), lastOne = j === f.t;
    return moveBuild(firstFall + 1 + k, tr(
      `The fall enters the target of the move from τ = ${j}, ${name}, which drops halfway toward it, from ${num(uj.old)} to ${num(uj.nu)}.${lastOne ? ` That is the move that stepped off: with one-step Sarsa, only it would have dropped.` : ""}`,
      `La caída entra en el objetivo del movimiento de τ = ${j}, ${name}, que baja la mitad del camino hacia él, de ${num(uj.old)} a ${num(uj.nu)}.${lastOne ? ` Ese es el movimiento con el que cayó: con Sarsa de un paso, solo él habría bajado.` : ""}`), k === 0);
  }) });
  // The rest of episode 1, one press per move, each completing the window of the move made N moves before.
  for (let i = firstFall + N; i < ep1Last; i++) {
    const uj = updates[moves[i].upd[0]], name = moveName(uj.s, uj.a);
    slides.push({ title: tr(`Move ${moves[i].t + 1}`, `Movimiento ${moves[i].t + 1}`), builds: [moveBuild(i, uj.rs.includes(-100)
      ? tr(`A fall is among the rewards of the move from τ = ${uj.tau}, ${name}, which drops halfway toward its target.`, `Una caída está entre las recompensas del movimiento de τ = ${uj.tau}, ${name}, que baja la mitad del camino hacia su objetivo.`)
      : tr(`That completes the window of the move from τ = ${uj.tau}, ${name}, which moves halfway toward its target.`, `Eso completa la ventana del movimiento de τ = ${uj.tau}, ${name}, que avanza la mitad del camino hacia su objetivo.`))] });
  }
}
{
  const T = ep1.T, uEnd = U(1, T - N), flush = [], last = ep1.first + T - 1;
  for (let j = T - N + 1; j < T; j++) flush.push(U(1, j));
  const nFalls = falls.filter((m) => m.ep === 1).length;
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [
    { ...takeBuild(last), line: chooseTakeText(qAfter(moves[last].qAt)[moves[last].s], moves[last].explored, { s: moves[last].s, a: moves[last].a, t: moves[last].t, s2: moves[last].s2, fell: moves[last].fell }) + tr(` The episode ends: <i>T</i> = ${T}.`, ` El episodio termina: <i>T</i> = ${T}.`) },
    updateBuild(uEnd, tr(
      `The agent reached the goal after ${T} moves and ${count(nFalls, "fall", "falls")}. The window of the move from τ = ${T - N} ends at the goal, and nothing after the goal needs estimating, so its target is just its ${N} rewards.`,
      `El agente llegó a la meta después de ${T} movimientos y ${count(nFalls, "caída", "caídas")}. La ventana del movimiento de τ = ${T - N} termina en la meta, y después de la meta no hay nada que estimar, así que su objetivo son solo sus ${N} recompensas.`), updateEq(uEnd, true), true),
    { ...updateBuild(flush[0], tr(
      `The last ${N - 1} moves are still waiting, and no more rewards will come, so they are updated right away, each toward the rewards left until the goal: ${listAnd(flush.map((u) => num(updates[u].G)))}. Halfway, that gives ${listAnd(flush.map((u) => num(updates[u].nu)))}.`,
      `Los últimos ${N - 1} movimientos siguen esperando, y no vendrán más recompensas, así que se actualizan de inmediato, cada uno hacia las recompensas que quedan hasta la meta: ${listAnd(flush.map((u) => num(updates[u].G)))}. A mitad de camino, quedan en ${listAnd(flush.map((u) => num(updates[u].nu)))}.`), updateEq(flush[0], true), true),
      Q: qAfter(flush[flush.length - 1] + 1), marks: flush.map((u) => ({ c: updates[u].s, a: updates[u].a, kind: "upd" })), time: T },
  ] });
}
let settleSlide;
{
  const i = moveOf(settleU), x = moves[i], len = finalPath.length - 1, top = Math.min(...finalPath.map((s) => Math.floor(s / 6))) === 0;
  const where = top ? tr("on the top row", "en la fila de arriba") : tr("one row up from the edge", "una fila más arriba del borde");
  settleSlide = { title: tr("A path away from the edge", "Un camino lejos del borde"), builds: [{ ...at(i), time: x.t + 1, Q: qAfter(settleU + 1), agent: x.s2, route: greedyPath(qAfter(settleU + 1)), line: tr(
    `In episode ${x.ep} the best moves settle ${where}, ${len} moves, and keep that route to the end. Like one-step Sarsa in the TD note, 4-step Sarsa keeps away from the edge.`,
    `En el episodio ${x.ep}, los mejores movimientos se asientan ${where}, ${len} movimientos, y mantienen esa ruta hasta el final. Como Sarsa de un paso en la nota de TD, 4-step Sarsa se aleja del borde.`) }] };
}
if (luckU > settleU) slides.push(settleSlide);
{
  const u = updates[luckU], i = moveOf(luckU), e = epOf(i), fallT = u.tau + u.rs.indexOf(-100), fi = e.first + fallT;
  // The fall at the episode's third move, after a random move back to the start: said as such; otherwise, simply.
  const twice = fallT === 2 && moves[fi - 1].explored && moves[fi - 1].s2 === START;
  const after = qAfter(luckU + 1)[u.s], stillBest = after.indexOf(Math.max(...after)) === u.a, path = moveName(u.s, u.a);
  // Before the settling, the route the best moves follow when the fall lands, drawn on the target's press, and where they
  // lead right after the update.
  const early = luckU < settleU, routeThen = greedyPath(qAfter(luckU)), routeAfter = greedyPath(qAfter(luckU + 1));
  const step = u.s === START ? tr("the first step", "el primer paso") : tr("a step", "un paso");
  const whose = early ? tr(`${step} of the route the best moves follow now, drawn in blue`, `${step} de la ruta que siguen ahora los mejores movimientos, dibujada en azul`) : tr(`${step} of the path`, `${step} del camino`);
  const then = stillBest ? tr(` ${NAME[u.a][0].toUpperCase() + NAME[u.a].slice(1)} is still the best move in ${cellName(u.s)}, and later trips pull it back up.`, ` ${NAME[u.a][0].toUpperCase() + NAME[u.a].slice(1)} sigue siendo el mejor movimiento en ${cellName(u.s)}, y los viajes siguientes lo vuelven a subir.`)
    : !early ? "" : routeAfter === null ? tr(" For now the best moves no longer reach the goal; later trips restore the route.", " Por ahora los mejores movimientos ya no llegan a la meta; los viajes siguientes restauran la ruta.")
    : tr(" For now the best moves take another route; later trips restore this one.", " Por ahora los mejores movimientos toman otra ruta; los viajes siguientes restauran esta.");
  const lead = twice
    ? tr(`In episode ${u.ep} the agent explores twice in a row: after its first move, a random move took it back to ${cellName(START)}, and its next move is random too.`, `En el episodio ${u.ep}, el agente explora dos veces seguidas: después de su primer movimiento, un movimiento al azar lo devolvió a ${cellName(START)}, y su siguiente movimiento también es al azar.`)
    : tr(`In episode ${u.ep} the agent makes a random move.`, `En el episodio ${u.ep}, el agente hace un movimiento al azar.`);
  slides.push({ title: tr("A good move pays for a fall", "Un buen movimiento paga por una caída"), builds: [
    { ...takeBuild(fi), line: `${lead} ${takeBuild(fi).line}` },
    ...(i > fi ? [takeBuild(i), chooseNextBuild(i)] : []),
    { ...targetBuild(luckU, tr(
      `The target of the episode's move from τ = ${u.tau} is now complete: ${path}, ${whose}. The fall is one of its ${N} rewards, and the target ends on the value outlined in red.`,
      `Ahora se completa el objetivo del movimiento de τ = ${u.tau} del episodio: ${path}, ${whose}. La caída es una de sus ${N} recompensas, y el objetivo termina en el valor con borde rojo.`),
      `${Gsym(u.tau, u.tau + N)} = <span class="pt">${sumText(u.rs)} + ${par(u.boot)} <span class="nowrap">${eqv(u.G)}</span></span>`), ...(early && routeThen ? { route: routeThen } : {}) },
    updateBuild(luckU, tr(
      `So ${path} drops halfway toward it, from ${num(u.old)} to ${num(u.nu)}, although it was the right move: a long return carries the luck of every move in it.${then}`,
      `Así, ${path} baja la mitad del camino hacia él, de ${num(u.old)} a ${num(u.nu)}, aunque era el movimiento correcto: un retorno largo arrastra la suerte de cada movimiento que contiene.${then}`), updateEq(luckU)),
  ] });
}
if (luckU < settleU) slides.push(settleSlide);
{
  const lastI = moves.length - 1, x = moves[lastI], settleMove = moveOf(settleU);
  const vals = finalPath.slice(0, -1).map((s) => num(Math.max(...finalQ[s]))).join(", "), n = finalPath.length - 1;
  const later = falls.filter((m) => moves.indexOf(m) > settleMove).length;
  const below = finalPath.slice(0, -1).every((s, k) => Math.max(...finalQ[s]) <= -(n - k) + 0.005);
  const how = below ? tr("at or below minus the number of moves left, since they count what exploring costs on the way", "iguales o por debajo de menos el número de movimientos que faltan, porque cuentan lo que cuesta explorar en el camino")
    : tr("about minus the number of moves left", "cerca de −1 por cada movimiento que falta");
  const afterIt = later === 0 ? tr("none of them after it had learned the path", "ninguna después de haber aprendido el camino") : tr(`${later} of them after it had learned the path`, `${later} de ellas después de haber aprendido el camino`);
  slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...at(lastI), time: x.t + 1, Q: finalQ, agent: x.s2, route: finalPath, line: tr(
    `Along the path, the best values are ${vals}: ${how}. The agent fell ${falls.length} times, ${afterIt}.`,
    `A lo largo del camino, los mejores valores son ${vals}: ${how}. El agente cayó ${falls.length} veces, ${afterIt}.`) }] });
}
// How far each slide jumps ahead of the one before it, counting moves in the whole run.
for (let i = 1; i < slides.length; i++) {
  const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
  if (gap <= 1) continue;
  const epFrom = from >= 0 ? moves[from].ep + (moves[from].done ? 1 : 0) : 1, epTo = moves[to].ep;
  slides[i].skip = { from, to, moves: gap, text: tr(`${gap} moves later`, `${gap} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "") };
}

slideshow({
  svg: document.getElementById("fig-nstep"),
  slides,
  // The state after move m of the whole run, for the frames of a skip: the move updated after it in green, four moves
  // behind the agent, and the next move in yellow.
  frame: (m) => {
    const x = moves[m], y = moves[m + 1];
    return { Q: qAfter(doneAt[m]), agent: x.s2, ring: x.fell, ep: x.ep, move: x.t + 1, time: x.t + 1,
      marks: x.upd.map((u) => ({ c: updates[u].s, a: updates[u].a, kind: "upd" })), pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
  },
});
