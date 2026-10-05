import { tr } from "../../plane.js";
import { START, GOAL, NAME, moveName, stepEnv, rngFrom, freshQ, epsGreedy, greedyPath, num, par, count, listAnd, sym, reason, takeText, chooseTakeText, slideshow, shake } from "./gridworld.js";

/* ---------- Section 5: Sarsa(λ) on the cliff, one line of the algorithm per press ---------- */

// Tabular Sarsa(λ) with accumulating traces, as in the note, with α = 0.1, γ = 1, λ = 0.9 and ε = 0.1. (With α = 0.5, a
// move visited again and again builds a trace near 9, and the values overshoot to the hundreds.) This seed has a short
// first episode, 19 moves with the same fall twice, which the figure plays move by move; the best moves settle on the
// route one row up, 9 moves, in episode 14.
const ALPHA = 0.1, LAM = 0.9, EPS = 0.1, SEED = 757123, EPISODES = 30;

// The whole run: for each step, the values before and after its update, and the traces it used (after the +1 for the
// pair just visited, before they fade). qAt: the values its action was chosen from.
const steps = [], firstOf = [];
{
  const rnd = rngFrom(SEED), Q = freshQ(), copy = (M) => M.map((r) => r.slice());
  for (let ep = 1; ep <= EPISODES; ep++) {
    const Z = freshQ();
    let s = START, qAt = copy(Q), c = epsGreedy(Q, s, EPS, rnd), t = 0;
    firstOf.push(steps.length);
    while (true) {
      const o = stepEnv(s, c.a), pre = copy(Q);
      const n = o.done ? null : epsGreedy(Q, o.s2, EPS, rnd);
      const delta = o.r + (o.done ? 0 : Q[o.s2][n.a]) - Q[s][c.a];
      Z[s][c.a] += 1;
      const z = copy(Z);
      for (let i = 0; i < Q.length; i++) for (let a = 0; a < 4; a++) if (Z[i][a]) { Q[i][a] += ALPHA * delta * Z[i][a]; Z[i][a] *= LAM; }
      steps.push({ ep, t, s, a: c.a, explored: c.explored, ...o, next: n, delta, pre, post: copy(Q), z, qAt });
      if (o.done) break;
      qAt = pre; s = o.s2; c = n; t++;
    }
  }
}
const X = (i) => steps[i];

// The traced moves of step i's episode, in the order of their last visit, as green marks as strong as their traces:
// after (the traces step i updates with) or before (those left from the step before, faded), with the cliff cells of
// any falls among them.
function traced(i, after) {
  const x = X(i), first = firstOf[x.ep - 1], last = new Map();
  for (let j = first; j <= (after ? i : i - 1); j++) { const y = X(j); last.delete(y.s * 4 + y.a); last.set(y.s * 4 + y.a, y); }
  const Z = after ? x.z : i > first ? X(i - 1).z.map((r) => r.map((v) => v * LAM)) : null;
  const moves = [...last.values()];
  return { list: moves, marks: moves.map((y) => ({ c: y.s, a: y.a, kind: "upd", w: Z[y.s][y.a] })), rings: moves.filter((y) => y.fell !== null).map((y) => y.fell) };
}
const pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });
// Up to three decimals, for traces and the small amounts they give early on.
const n3 = (v) => String(Math.round(v * 1000) / 1000).replace("-", "−");

/* ---------- Builds: one line of the algorithm per press ---------- */

// Choose A: the move turns yellow before the agent moves.
function chooseBuild(i, lead) {
  const x = X(i), { marks, rings } = traced(i, false);
  return { ...pos(i), time: x.t, Q: x.qAt, agent: x.s, pick: [x.s, x.a], marks, rings, line: `${lead} ${reason(x.qAt[x.s], x.explored, x.s, x.a, x.t)}` };
}
// Take A: the agent moves along the yellow move and sees R and S′.
function takeBuild(i) {
  const x = X(i), bump = x.fell === null && x.s2 === x.s ? x.a : null, { marks, rings } = traced(i, false);
  return { ...pos(i), time: x.t, Q: x.pre, agent: x.fell !== null ? x.fell : x.s2, ring: x.fell, taken: [x.s, x.a], bump, sound: x.fell !== null ? "fall" : bump !== null ? "wall" : undefined, marks, rings,
    line: takeText({ s: x.s, a: x.a, t: x.t, s2: x.s2, fell: x.fell }) };
}
// Choose A′ in S′, before any update, from the table as it stands.
function chooseNextBuild(i) {
  const x = X(i), { marks, rings } = traced(i, false);
  return { ...pos(i), time: x.t + 1, Q: x.pre, agent: x.s2, jump: x.fell !== null, ring: x.fell, pick: [x.s2, x.next.a], marks, rings,
    line: tr("Before any update, it chooses its next move.", "Antes de cualquier actualización, elige su siguiente movimiento.") + " " + reason(x.pre[x.s2], x.next.explored, x.s2, x.next.a, x.t + 1) };
}
// The TD error, in red on the value it uses, and the trace of the move just made goes up by 1.
function deltaBuild(i, line) {
  const x = X(i), { marks, rings } = traced(i, true), boot = x.next ? [x.s2, x.next.a] : null;
  return { ...pos(i), time: x.t + 1, Q: x.pre, agent: x.s2, marks: [...marks, ...(boot ? [{ c: boot[0], a: boot[1], kind: "tg" }] : [])], rings, line, eq: deltaEq(i) };
}
// Every pair moves by αδz; then the traces fade.
function updateBuild(i, line) {
  const x = X(i), { marks, rings } = traced(i, true), boot = x.next ? [x.s2, x.next.a] : null;
  return { ...pos(i), time: x.t + 1, Q: x.post, agent: x.s2, marks: [...marks, ...(boot ? [{ c: boot[0], a: boot[1], kind: "tg" }] : [])], rings, line, eq: updEq(i) };
}
const deltaEq = (i) => { const x = X(i), t = x.t; return `δ<sub>${t}</sub> = <span class="pt">${sym("R", t + 1)}${x.next ? ` + γ<i>Q</i>(${sym("S", t + 1)}, ${sym("A", t + 1)})` : ""} − <i>Q</i>(${sym("S", t)}, ${sym("A", t)})</span> <span class="nowrap pt">= ${num(x.r)}${x.next ? ` + ${par(x.pre[x.s2][x.next.a])}` : ""} − ${par(x.pre[x.s][x.a])}</span> <span class="nowrap pt">= ${num(x.delta)}</span>`; };
const updEq = (i) => `<span class="upd"><i>Q</i>(<i>s</i>, <i>a</i>)</span> <span class="nowrap">← <i>Q</i>(<i>s</i>, <i>a</i>)</span> <span class="nowrap">+ ${ALPHA} · <span class="pt">${par(X(i).delta)}</span> · <i>z</i>(<i>s</i>, <i>a</i>)</span>`;
const zNow = (i) => { const x = X(i); return x.z[x.s][x.a]; };
const markText = (i) => {
  const x = X(i), z = zNow(i), m = moveName(x.s, x.a);
  return z > 1 ? tr(`The move just made, ${m}, gets 1 more on its trace: it was made before, so its trace is now ${n3(z - 1)} + 1 = ${n3(z)}.`, `El movimiento recién hecho, ${m}, suma 1 a su traza: ya se había hecho, así que su traza es ahora ${n3(z - 1)} + 1 = ${n3(z)}.`)
    : tr(`The move just made, ${m}, gets 1 more on its trace, which is now 1.`, `El movimiento recién hecho, ${m}, suma 1 a su traza, que ahora vale 1.`);
};
// The traced moves of step i with what each one moves by, most recent first.
const shares = (i, k) => { const x = X(i); return traced(i, true).list.slice().reverse().slice(0, k).map((y) => tr(`${moveName(y.s, y.a)} (<i>z</i> = ${n3(x.z[y.s][y.a])}) by ${n3(ALPHA * x.delta * x.z[y.s][y.a])}`, `${moveName(y.s, y.a)} (<i>z</i> = ${n3(x.z[y.s][y.a])}) en ${n3(ALPHA * x.delta * x.z[y.s][y.a])}`)); };
const amounts = (i) => { const x = X(i); return traced(i, true).list.slice().reverse().map((y) => n3(ALPHA * x.delta * x.z[y.s][y.a])); };
// What red marks at the TD error.
const usesRed = tr("The TD error uses the value of the move just chosen, outlined in red. ", "El TD error usa el valor del movimiento recién elegido, con borde rojo. ");
// The presses of a detailed move: take, choose the next move, the TD error, the update.
function moveBuilds(i, deltaLine, updateLine) {
  const x = X(i), b = [takeBuild(i)];
  if (x.next) b.push(chooseNextBuild(i));
  b.push(deltaBuild(i, deltaLine), updateBuild(i, updateLine));
  return b;
}

// A later move of episode 1 in one press: why it was chosen (unless the slide before said so, chosen) and where it led,
// the next move in yellow, and its TD error moving every traced move by its trace, in green. extra follows the first
// sentences, end closes the line.
function oneBuild(i, extra = "", chosen = false, end = "") {
  const x = X(i), tk = takeBuild(i), up = updateBuild(i, "");
  const first = chosen ? tk.line : chooseTakeText(x.qAt[x.s], x.explored, { s: x.s, a: x.a, t: x.t, s2: x.s2, fell: x.fell });
  const rest = tr(`Its TD error, ${num(x.delta)}, moves every traced move by α · δ · <i>z</i>.`, `Su TD error, ${num(x.delta)}, mueve cada movimiento con traza en α · δ · <i>z</i>.`);
  return { ...up, taken: [x.s, x.a], bump: tk.bump, sound: tk.sound, jump: x.fell !== null, ring: x.fell, pick: x.next ? [x.s2, x.next.a] : undefined, line: `${first}${extra} ${rest}${end}` };
}

/* ---------- Slides ---------- */

const slides = [];
slides.push({ title: tr("Sarsa(λ) on the cliff", "Sarsa(λ) en el acantilado"), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: freshQ(), agent: START, line: tr(
  `All values start at 0 again, with the agent at ${sym("S", 0)} = A1.`,
  `Todos los valores vuelven a partir en 0, con el agente en ${sym("S", 0)} = A1.`) }] });
{
  const x = X(0), m = moveName(x.s, x.a);
  slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
    chooseBuild(0, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")),
    ...moveBuilds(0,
      tr(`The TD error compares what the move earned, plus the value of the move just chosen, outlined in red, with what the move was worth. ${markText(0)}`, `El TD error compara lo que ganó el movimiento, más el valor del movimiento recién elegido, con borde rojo, con lo que valía el movimiento. ${markText(0)}`),
      tr(`Every pair moves by α · δ · <i>z</i>, and only ${m} has a trace: from 0 to ${num(x.post[x.s][x.a])}. Then every trace fades by γλ = ${LAM}.`, `Cada par se mueve α · δ · <i>z</i>, y solo ${m} tiene traza: de 0 a ${num(x.post[x.s][x.a])}. Luego todas las trazas se achican por el factor γλ = ${LAM}.`)),
  ] });
}
// Moves 2 to 6: each TD error updates every move made so far, by its trace.
for (let i = 1; i <= 5; i++) {
  const x = X(i), n = traced(i, true).list.length, z = zNow(i), m = moveName(x.s, x.a);
  const upd = i <= 2 ? tr(`One TD error, ${count(n, "update", "updates")}: ${listAnd(shares(i, n))}. Then the traces fade.`, `Un TD error, ${count(n, "actualización", "actualizaciones")}: ${listAnd(shares(i, n))}. Luego las trazas se achican.`)
    : z > 1 ? tr(`${m} has the largest trace, so it takes the largest share, ${n3(ALPHA * x.delta * z)}; the others: ${listAnd(shares(i, n).slice(1))}.`, `${m} tiene la traza más grande, así que se lleva la mayor parte, ${n3(ALPHA * x.delta * z)}; los demás: ${listAnd(shares(i, n).slice(1))}.`)
    : tr(`One TD error, ${count(n, "update", "updates")}, each by its trace: ${listAnd(amounts(i))}, newest first.`, `Un TD error, ${count(n, "actualización", "actualizaciones")}, cada una según su traza: ${listAnd(amounts(i))}, de la más reciente a la más antigua.`);
  slides.push({ title: z > 1 ? tr(`Move ${i + 1}: a second visit`, `Movimiento ${i + 1}: una segunda visita`) : tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: moveBuilds(i, usesRed + markText(i), upd) });
}
// The moves between move 6 and the first fall, one press each.
const fallI = steps.findIndex((y) => y.fell !== null);
for (let i = 6; i < fallI; i++) slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [oneBuild(i)] });
{
  const i = fallI, x = X(i), { list } = traced(i, true), first = list[0];
  const firstBy = n3(ALPHA * x.delta * x.z[first.s][first.a]);
  slides.push({ title: tr("The first fall", "La primera caída"), builds: [
    // Its choice is recalled only after a press that showed it without saying why.
    ...(i > 6 ? [chooseBuild(i, tr("Its move from here was chosen at the end of the last step.", "Su movimiento desde aquí se eligió al final del paso anterior."))] : []),
    ...moveBuilds(i,
      tr(`The fall makes the TD error large. ${usesRed}${markText(i)}`, `La caída hace grande el TD error. ${usesRed}${markText(i)}`),
      tr(`All ${list.length} traced moves drop at once, each by ${ALPHA} · ${par(x.delta)} · <i>z</i>: ${shares(i, 3).join(", ")}, and so on back to ${moveName(first.s, first.a)}, the episode's first move, by ${firstBy}. The whole path pays, each move by its trace: recent and repeated moves most.`,
        `Los ${list.length} movimientos con traza bajan a la vez, cada uno en ${ALPHA} · ${par(x.delta)} · <i>z</i>: ${shares(i, 3).join(", ")}, y así hasta ${moveName(first.s, first.a)}, el primer movimiento del episodio, en ${firstBy}. Paga todo el camino, cada movimiento según su traza: más los movimientos recientes y los repetidos.`)),
  ] });
}
// The rest of episode 1, one press per move. A fall repeated right after the first one, by the same move from the same
// cell, says why: that move was chosen before the update counted the first fall.
for (let i = fallI + 1; i < firstOf[1] - 1; i++) {
  const x = X(i), f0 = X(fallI), m = NAME[f0.a];
  const again = i === fallI + 1 && x.fell !== null && x.s === f0.s && x.a === f0.a ? tr(
    ` The same fall again: ${m} was chosen before the update counted the first one.`,
    ` La misma caída otra vez: ${m} se eligió antes de que la actualización contara la primera.`) : "";
  slides.push({ title: again ? tr("The same fall again", "La misma caída otra vez") : tr(`Move ${x.t + 1}`, `Movimiento ${x.t + 1}`), builds: [oneBuild(i, again, i === fallI + 1)] });
}
{
  const i = firstOf[1] - 1, x = X(i), nF = steps.filter((y) => y.ep === 1 && y.fell !== null).length;
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [oneBuild(i, "", false, tr(
    ` The episode ends at <i>T</i> = ${x.t + 1}, after ${count(nF, "fall", "falls")}. Every trace is set back to 0 before the next episode, so its TD errors reach only its own moves.`,
    ` El episodio termina en <i>T</i> = ${x.t + 1}, después de ${count(nF, "caída", "caídas")}. Todas las trazas vuelven a 0 antes del siguiente episodio, así que sus TD errors solo llegan a sus propios movimientos.`))] });
}
{
  let settle = null, lastKey = null;
  steps.forEach((y, i) => { const p = greedyPath(y.post), key = p ? p.join() : ""; if (key !== lastKey) { settle = p ? i : null; lastKey = key; } });
  const x = X(settle), len = greedyPath(x.post).length - 1;
  slides.push({ title: tr("A path one row up", "Un camino una fila más arriba"), builds: [{ ...pos(settle), time: x.t + 1, Q: x.post, agent: x.done ? GOAL : x.s2, route: greedyPath(x.post), line: tr(
    `In episode ${x.ep} the best moves settle on the route one row up, ${len} moves, the route of one-step Sarsa in the TD note, and keep it to the end.`,
    `En el episodio ${x.ep}, los mejores movimientos se asientan en la ruta una fila más arriba, ${len} movimientos, la ruta de Sarsa de un paso en la nota de TD, y la mantienen hasta el final.`) }] });
  const lastI = steps.length - 1, Qf = X(lastI).post, pf = greedyPath(Qf), falls = steps.filter((y) => y.fell !== null), later = falls.filter((y) => steps.indexOf(y) > settle).length;
  const vals = pf.slice(0, -1).map((s) => num(Math.max(...Qf[s]))).join(", ");
  slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...pos(lastI), time: X(lastI).t + 1, Q: Qf, agent: GOAL, route: pf, line: tr(
    `Along the path, the best values are ${vals}. Near the goal each is about minus the number of moves left; farther back they are lower, since they include what exploring costs over the rest of the trip, and at the start the cliff is one random move away. The agent fell ${falls.length} times, ${later ? `${later} of them after it had learned the path` : "none of them after it had learned the path"}.`,
    `A lo largo del camino, los mejores valores son ${vals}. Cerca de la meta, cada uno vale más o menos −1 por cada movimiento que falta; más atrás son más bajos, porque incluyen lo que cuesta explorar en el resto del viaje, y en el inicio el acantilado está a un movimiento al azar. El agente cayó ${falls.length} veces, ${later ? `${later} de ellas después de haber aprendido el camino` : "ninguna después de haber aprendido el camino"}.`) }] });
}
// How far each slide jumps ahead of the one before it, counting moves in the whole run.
for (let i = 1; i < slides.length; i++) {
  const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
  if (gap <= 1) continue;
  const epFrom = from >= 0 ? X(from).ep + (X(from).done ? 1 : 0) : 1, epTo = X(to).ep;
  slides[i].skip = { from, to, moves: gap, text: tr(`${gap} moves later`, `${gap} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "") };
}

slideshow({
  svg: document.getElementById("fig-lambda"),
  slides,
  // The state after step m of the whole run, for the frames of a skip: the trail of traces in green, the next move in
  // yellow.
  frame: (m) => {
    const x = X(m), { marks } = traced(m, true);
    return { Q: x.post, agent: x.done ? GOAL : x.s2, ring: x.fell, ep: x.ep, move: x.t + 1, time: x.t + 1, bumpPose: shake(x, m), marks, pick: x.next ? [x.s2, x.next.a] : undefined };
  },
});
