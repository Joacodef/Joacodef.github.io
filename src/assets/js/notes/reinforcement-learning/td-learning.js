import { tr } from "../../plane.js";
import { START, GOAL, NAME, cellName, stepEnv, rngFrom, freshQ, epsGreedy, greedyPath, num, par, eqv, count, sym, reason, takeText, slideshow } from "./gridworld.js";

/* ---------- Section 5: Sarsa on the cliff, one line of the algorithm per press ---------- */

// One-step Sarsa with α = 0.5, γ = 1 and ε = 0.1, with ties broken at random. Its target uses the move picked next, so
// with a step this large each exploring fall shakes the values, and the best moves keep changing for many episodes.
// This seed shows what the note describes: the same fall twice at the start, a first route along the edge in episode 8
// that a random move breaks two moves later, and the route one row up at the end.
const ALPHA = 0.5, EPS = 0.1, SEED = 9902, EPISODES = 30;

// The whole run, computed once: for each move, the values it was chosen from (qAt), the values before and after its
// update (pre, post), and the next move A′, chosen from pre before the update.
const steps = [];
{
  const rnd = rngFrom(SEED), Q = freshQ(), copy = (M) => M.map((r) => r.slice());
  for (let ep = 1; ep <= EPISODES; ep++) {
    let s = START, qAt = copy(Q), c = epsGreedy(Q, s, EPS, rnd), t = 0;
    while (true) {
      const o = stepEnv(s, c.a), pre = copy(Q);
      const next = o.done ? null : epsGreedy(Q, o.s2, EPS, rnd);
      const boot = next ? Q[o.s2][next.a] : 0, target = o.r + boot;
      Q[s][c.a] += ALPHA * (target - Q[s][c.a]);
      steps.push({ ep, t, s, a: c.a, explored: c.explored, ...o, next, boot, target, old: pre[s][c.a], nu: Q[s][c.a], qAt, pre, post: copy(Q) });
      if (o.done) break;
      qAt = pre; s = o.s2; c = next; t++;
    }
  }
}
const X = (i) => steps[i], last = steps.length - 1;
const pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });

/* ---------- Builds: one line of the algorithm per press ---------- */

const pairOf = (t) => `<i>Q</i>(${sym("S", t)}, ${sym("A", t)})`;
// The move A′ whose value the target uses, outlined in red; none after the goal.
const tgMark = (x) => (x.next ? [{ c: x.s2, a: x.next.a, kind: "tg" }] : []);

// Choose A: the move turns yellow before the agent moves.
function chooseBuild(i, lead) {
  const x = X(i);
  return { ...pos(i), time: x.t, Q: x.qAt, agent: x.s, pick: [x.s, x.a], line: `${lead} ${reason(x.qAt[x.s], x.explored, x.s, x.a, x.t)}` };
}
// Take A: the agent moves along the yellow move and sees R and S′.
function takeBuild(i) {
  const x = X(i), bump = x.fell === null && x.s2 === x.s ? x.a : null;
  return { ...pos(i), time: x.t, Q: x.pre, agent: x.fell !== null ? x.fell : x.s2, ring: x.fell, pick: [x.s, x.a], bump, sound: x.fell !== null ? "fall" : bump !== null ? "wall" : undefined,
    line: takeText({ s: x.s, a: x.a, t: x.t, s2: x.s2, fell: x.fell }) };
}
// Choose A′ in S′, before any update, from the table as it stands.
const nextLead = tr("Before any update, it chooses its next move.", "Antes de cualquier actualización, elige su siguiente movimiento.");
function chooseNextBuild(i, extra = "", lead = nextLead) {
  const x = X(i);
  return { ...pos(i), time: x.t + 1, Q: x.pre, agent: x.s2, jump: x.fell !== null, ring: x.fell, pick: [x.s2, x.next.a],
    line: `${lead} ${reason(x.pre[x.s2], x.next.explored, x.s2, x.next.a, x.t + 1)}${extra}` };
}
// The target: R plus the value of A′, in red.
function targetBuild(i, line) {
  const x = X(i), t = x.t;
  const eq = `${tr("target", "objetivo")} = <span class="pt">${sym("R", t + 1)} + γ${pairOf(t + 1)} <span class="nowrap">= ${num(x.r)} + ${par(x.boot)}</span> <span class="nowrap">= ${num(x.target)}</span></span>`;
  return { ...pos(i), time: t + 1, Q: x.pre, agent: x.s2, ring: x.fell, marks: tgMark(x), line, eq };
}
// The update of the pair just left, in green.
function updateBuild(i, line) {
  const x = X(i), t = x.t;
  const eq = `${pairOf(t)} <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${num(x.target)}</span> − ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`;
  return { ...pos(i), time: t + 1, Q: x.post, agent: x.s2, ring: x.fell, marks: [...tgMark(x), { c: x.s, a: x.a, kind: "upd" }], line, eq };
}
const targetLine = (i) => {
  const x = X(i), t = x.t + 1, R = sym("R", t), S = sym("S", t), A = sym("A", t);
  return tr(`${R}, ${S} and ${A} are known at <i>t</i> = ${t}. The target adds ${R} to the value of the move just chosen, outlined in red: ${num(x.boot)}.`,
    `${R}, ${S} y ${A} se conocen en <i>t</i> = ${t}. El objetivo suma ${R} al valor del movimiento recién elegido, con borde rojo: ${num(x.boot)}.`);
};
const updateLine = (i) => {
  const x = X(i), t = x.t;
  return tr(`Still at <i>t</i> = ${t + 1}, the value of the pair the agent just left, ${pairOf(t)}, moves halfway toward the target, from ${num(x.old)} to ${num(x.nu)}.`,
    `Todavía en <i>t</i> = ${t + 1}, el valor del par que el agente acaba de dejar, ${pairOf(t)}, avanza la mitad del camino hacia el objetivo, de ${num(x.old)} a ${num(x.nu)}.`);
};
// A slide shown whole: the state after move i, with A′ in yellow and, with withEq, the update that move made, in green.
function wholeBuild(i, line, withEq) {
  const x = X(i), eq = withEq ? updateBuild(i, "").eq : null;
  return { ...pos(i), time: x.t + 1, Q: x.post, agent: x.s2, pick: x.next ? [x.s2, x.next.a] : undefined, marks: withEq ? [{ c: x.s, a: x.a, kind: "upd" }] : [], line, eq };
}

/* ---------- Moments of the run ---------- */

const A2 = 12, UP = 0, RIGHT = 1;
const falls = steps.filter((x) => x.fell !== null);
const firstFall = steps.findIndex((x) => x.fell !== null);
// Right after the first fall, the agent picks the same move again, from the same cell: its update has not happened yet.
const again = X(firstFall).next.a === X(firstFall).a && X(firstFall).s2 === X(firstFall).s;
const ep1End = steps.findIndex((x) => x.done);
// The first time the best moves lead from the start to the goal.
const firstRoute = steps.findIndex((x) => greedyPath(x.post));
// The update after which the step from A2 onto the edge stays below the step up: a random move into the cliff, chosen
// as A′ in B2, enters the target of A2's move right.
let pull = null;
steps.forEach((x, i) => { const below = x.post[A2][RIGHT] < x.post[A2][UP], was = i ? X(i - 1).post[A2][RIGHT] < X(i - 1).post[A2][UP] : false; if (below && !was) pull = i; });

/* ---------- Slides ---------- */

const slides = [];
slides.push({ title: tr("Sarsa on the cliff", "Sarsa en el acantilado"), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: freshQ(), agent: START, line: tr(
  `All values start at 0 again, with the agent at ${sym("S", 0)} = A1.`,
  `Todos los valores vuelven a partir en 0, con el agente en ${sym("S", 0)} = A1.`) }] });
// Moves 1 to 3: every line of the algorithm.
for (let i = 0; i < 3; i++) {
  const b = [];
  if (i === 0) b.push(chooseBuild(0, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")));
  b.push(takeBuild(i));
  b.push(i === 0 ? chooseNextBuild(0, "", tr("Before any update, it chooses its next move, whose value the target needs.", "Antes de cualquier actualización, elige su siguiente movimiento, cuyo valor necesita el objetivo.")) : chooseNextBuild(i));
  b.push(targetBuild(i, targetLine(i)));
  b.push(updateBuild(i, updateLine(i) + (i === 2 ? tr(" Every move tried so far is now worth −0.5 and every untried one 0, so untried moves look better: at first, the agent tries everything.", " Cada movimiento probado hasta ahora vale −0.5 y cada uno sin probar vale 0, así que los que no se han probado parecen mejores: al principio, el agente lo prueba todo.") : "")));
  slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: b });
}
{
  const i = firstFall, x = X(i), t = x.t, m = NAME[x.a], c = cellName(x.s);
  const b = [takeBuild(i)];
  if (i > 3) b.unshift(chooseBuild(i, tr("Its move from here was chosen at the end of the last step.", "Su movimiento desde aquí se eligió al final del paso anterior.")));
  b.push(
    chooseNextBuild(i, again ? tr(` ${m[0].toUpperCase() + m.slice(1)} is still worth 0: the update that counts the fall comes after this choice.`, ` ${m[0].toUpperCase() + m.slice(1)} todavía vale 0: la actualización que cuenta la caída viene después de esta elección.`) : ""),
    targetBuild(i, again
      ? tr(`The target adds ${sym("R", t + 1)} to the value of the move just chosen, outlined in red: ${m} in ${c} again, still worth ${num(x.boot)}.`, `El objetivo suma ${sym("R", t + 1)} al valor del movimiento recién elegido, con borde rojo: otra vez ${m} en ${c}, que todavía vale ${num(x.boot)}.`)
      : targetLine(i)),
    updateBuild(i, again
      ? tr(`Still at <i>t</i> = ${t + 1}, ${pairOf(t)}, ${m} in ${c}, moves halfway toward the target, from ${num(x.old)} to ${num(x.nu)}, far below the other moves there. But the next move, ${m} again, was chosen before this update.`,
        `Todavía en <i>t</i> = ${t + 1}, ${pairOf(t)}, ${m} en ${c}, avanza la mitad del camino hacia el objetivo, de ${num(x.old)} a ${num(x.nu)}, muy por debajo de los demás movimientos ahí. Pero el siguiente movimiento, otra vez ${m}, se eligió antes de esta actualización.`)
      : updateLine(i) + tr(" That is far below the other moves there, so the greedy choice avoids it from now on.", " Eso queda muy por debajo de los demás movimientos ahí, así que la elección greedy lo evita desde ahora.")),
  );
  slides.push({ title: tr("The first fall", "La primera caída"), builds: b });
  if (again) {
    const j = i + 1;
    slides.push({ title: tr("The same fall again", "La misma caída otra vez"), builds: [takeBuild(j), chooseNextBuild(j), targetBuild(j, targetLine(j)), updateBuild(j, updateLine(j) + tr(
      " Choosing the next move before the update cost a second fall.", " Elegir el siguiente movimiento antes de la actualización le costó una segunda caída."))] });
  }
}
{
  const x = X(ep1End), T = x.t + 1, f = falls.filter((y) => y.ep === 1).length;
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [wholeBuild(ep1End, tr(
    `The agent reaches the goal after ${T} moves, with ${count(f, "fall", "falls")} on the way. The episode ends at <i>T</i> = ${T}: no move follows the goal, so the target of the last move is just ${sym("R", T)} = −1.`,
    `El agente llega a la meta después de ${T} movimientos, con ${count(f, "caída", "caídas")} en el camino. El episodio termina en <i>T</i> = ${T}: después de la meta no viene ningún movimiento, así que el objetivo del último movimiento es solo ${sym("R", T)} = −1.`), true)] });
}
{
  // The state one move before the pull: the route along the edge, which the agent is following.
  const i = pull - 1, x = X(i), route = greedyPath(x.post), len = route.length - 1;
  slides.push({ title: tr("A first way through", "Un primer camino"), builds: [{ ...wholeBuild(i, tr(
    `In episode ${X(firstRoute).ep}, the best moves first lead from A1 to the goal: along the edge, ${len} moves, the shortest route. The agent is in ${cellName(x.s2)}, and its next move, ${NAME[x.next.a]}, follows it.`,
    `En el episodio ${X(firstRoute).ep}, los mejores movimientos llevan por primera vez de A1 a la meta: por el borde, ${len} movimientos, la ruta más corta. El agente está en ${cellName(x.s2)}, y su siguiente movimiento, ${NAME[x.next.a]}, la sigue.`)), route }] });
}
{
  const i = pull, x = X(i), t = x.t, c = cellName(x.s);
  slides.push({ title: tr("The edge pays for exploring", "El borde paga por explorar"), builds: [
    takeBuild(i),
    chooseNextBuild(i, tr(` That is a step into the cliff, worth ${num(x.boot)} after earlier falls from ${cellName(x.s2)}.`, ` Es un paso al acantilado, que vale ${num(x.boot)} después de caídas anteriores desde ${cellName(x.s2)}.`)),
    targetBuild(i, tr(`The target adds ${sym("R", t + 1)} to the value of that move, outlined in red: ${num(x.boot)}.`, `El objetivo suma ${sym("R", t + 1)} al valor de ese movimiento, con borde rojo: ${num(x.boot)}.`)),
    updateBuild(i, tr(
      `Still at <i>t</i> = ${t + 1}, ${pairOf(t)}, ${NAME[x.a]} in ${c}, drops halfway toward it, from ${num(x.old)} to ${num(x.nu)}, far below ${NAME[UP]} in ${c}, at ${num(x.post[x.s][UP])}. The route along the edge is gone: Sarsa's target uses the move actually made next, and next to the edge, that is sometimes a fall.`,
      `Todavía en <i>t</i> = ${t + 1}, ${pairOf(t)}, ${NAME[x.a]} en ${c}, baja la mitad del camino hacia él, de ${num(x.old)} a ${num(x.nu)}, muy por debajo de ${NAME[UP]} en ${c}, que vale ${num(x.post[x.s][UP])}. La ruta por el borde desaparece: el objetivo de Sarsa usa el movimiento que de verdad se hace después, y junto al borde, a veces es una caída.`)),
    takeBuild(i + 1),
  ] });
}
{
  const Qf = X(last).post, route = greedyPath(Qf), vals = route.slice(0, -1).map((s) => num(Math.max(...Qf[s]))).join(", ");
  slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...wholeBuild(last, tr(
    `The best moves now run one row up, ${route.length - 1} moves, with values ${vals}: about minus the number of moves left. In A2, up is worth ${num(Qf[A2][UP])} and right, onto the edge, ${num(Qf[A2][RIGHT])}. The agent fell ${falls.length} times, the last time in episode ${falls.at(-1).ep}.`,
    `Los mejores movimientos ahora van una fila más arriba, ${route.length - 1} movimientos, con valores ${vals}: cerca de −1 por cada movimiento que falta. En A2, arriba vale ${num(Qf[A2][UP])} y derecha, hacia el borde, ${num(Qf[A2][RIGHT])}. El agente cayó ${falls.length} veces, la última en el episodio ${falls.at(-1).ep}.`)), route }] });
}
// How far each slide jumps ahead of the one before it, counting moves in the whole run.
for (let i = 1; i < slides.length; i++) {
  const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
  if (gap <= 1) continue;
  const epFrom = from >= 0 ? X(from).ep + (X(from).done ? 1 : 0) : 1, epTo = X(to).ep;
  slides[i].skip = { from, to, moves: gap, text: tr(`${gap} moves later`, `${gap} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "") };
}

slideshow({
  svg: document.getElementById("fig-sarsa"),
  slides,
  // The state after move m of the whole run, for the frames of a skip: the move just updated in green, A′ in yellow.
  frame: (m) => {
    const x = X(m);
    return { Q: x.post, agent: x.done ? GOAL : x.s2, ring: x.fell, ep: x.ep, move: x.t + 1, time: x.t + 1, marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: x.next ? [x.s2, x.next.a] : undefined };
  },
});
