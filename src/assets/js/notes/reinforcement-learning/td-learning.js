import { tr } from "../../plane.js";
import { cookie, START, GOAL, NAME, cellName, moveName, stepEnv, rngFrom, freshQ, epsGreedy, greedyPath, num, par, eqv, count, sym, reason, takeText, chooseTakeText, slideshow, shake } from "./gridworld.js";

/* ---------- Section 1: TD(0) on the cookie grid, one line of the algorithm per press ---------- */

// The policy picks each of the four moves at random; γ = 0.9, α = 0.5, every estimate 0 at first. The seed is that of
// the Monte Carlo note's first figure, so both figures learn from the same 30 episodes. Episode 1 takes 5 moves and
// only its last TD error is not 0; in episode 2 a target first borrows that estimate, from B2 into C2, and the next
// move, from C2 down to C1, lowers C2's estimate in mid-episode. Inside this block the cookie grid's names replace the
// cliff's, which the Sarsa figure below uses.
{
  const ALPHA = 0.5, GAMMA = 0.9, SEED = 15395, EPISODES = 30;
  const { START, GOAL, cellName, stepEnv, takeText, randomPick, randomTake, valuePath } = cookie;
  const CELLS = [...Array(9).keys()].filter((s) => s !== GOAL);

  // The whole run, computed once: for each move, the estimates before and after its update (pre, post), the estimate
  // its target borrows (boot, 0 at the cookie) and its TD error.
  const steps = [];
  {
    const rnd = rngFrom(SEED), V = Array(9).fill(0);
    for (let ep = 1; ep <= EPISODES; ep++) {
      let s = START, t = 0;
      while (true) {
        const a = Math.floor(rnd() * 4), o = stepEnv(s, a), pre = V.slice();
        const boot = o.done ? 0 : V[o.s2], delta = o.r + GAMMA * boot - V[s];
        V[s] += ALPHA * delta;
        steps.push({ ep, t, s, a, ...o, boot, delta, old: pre[s], nu: V[s], pre, post: V.slice() });
        if (o.done) break;
        s = o.s2; t++;
      }
    }
  }
  // The true values of the random policy, from its Bellman equation, for the last slide.
  const vpi = Array(9).fill(0);
  for (let k = 0; k < 300; k++) for (const s of CELLS) vpi[s] = [0, 1, 2, 3].reduce((acc, a) => { const o = stepEnv(s, a); return acc + (o.r + GAMMA * (o.done ? 0 : vpi[o.s2])) / 4; }, 0);
  // The first-visit returns of each episode, last visit first, and their averages over the run: what the Monte Carlo
  // note's first figure learns from the same episodes.
  const firstReturns = (ep) => {
    const e = steps.filter((x) => x.ep === ep), out = []; let G = 0;
    for (let t = e.length - 1; t >= 0; t--) { G = GAMMA * G + e[t].r; if (!e.slice(0, t).some((y) => y.s === e[t].s)) out.push({ s: e[t].s, G }); }
    return out;
  };
  const mcV = Array(9).fill(0);
  {
    const rets = Array.from({ length: 9 }, () => []);
    for (let ep = 1; ep <= EPISODES; ep++) for (const { s, G } of firstReturns(ep)) rets[s].push(G);
    rets.forEach((r, s) => { if (r.length) mcV[s] = r.reduce((p, q) => p + q, 0) / r.length; });
  }
  const X = (i) => steps[i], last = steps.length - 1, pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });
  const Vof = (t) => `<i>V</i>(${sym("S", t)})`, nw = (x) => `<span class="nowrap">${x}</span>`;

  /* Builds: one line of the algorithm per press */

  // Choose: the policy's random pick turns yellow before the agent moves.
  function chooseBuild(i) {
    const x = X(i);
    return { ...pos(i), time: x.t, V: x.pre, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], line: randomPick(x) };
  }
  // Take: the agent moves along the yellow move. After the first move, choosing and taking share one press.
  function takeBuild(i, withChoice) {
    const x = X(i), bump = x.s2 === x.s ? x.a : null;
    return { ...pos(i), time: x.t, V: x.pre, agent: x.s2, taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, line: withChoice ? randomTake(x) : takeText(x) };
  }
  // The estimate the target borrows, outlined in red; none at the cookie, whose estimate is 0.
  const tgMark = (x) => (x.done ? [] : [{ c: x.s2, kind: "tg" }]);
  // The TD error, with its target in red.
  function deltaBuild(i, line) {
    const x = X(i), t = x.t;
    const eq = `δ<sub>${t}</sub> ${nw(`= <span class="pt">${sym("R", t + 1)} + γ${Vof(t + 1)}</span> − ${Vof(t)}`)} ${nw(`= <span class="pt">${num(x.r)} + 0.9 · ${num(x.boot)}</span> − ${num(x.old)}`)} <span class="nowrap pt">${eqv(x.delta)}</span>`;
    return { ...pos(i), time: t + 1, V: x.pre, agent: x.s2, marks: tgMark(x), line, eq };
  }
  // The update of the cell just left, in green.
  function updateBuild(i, line) {
    const x = X(i), t = x.t;
    const eq = `<span class="upd">${Vof(t)}</span> ${nw(`← ${num(x.old)} + ${ALPHA} · <span class="pt">${par(x.delta)}</span>`)} ${nw(eqv(x.nu))}`;
    return { ...pos(i), time: t + 1, V: x.post, agent: x.s2, marks: [...tgMark(x), { c: x.s, kind: "upd" }], line, eq };
  }

  /* Moments of the run */

  // The move into the cookie that ends episode 1, the first TD error that is not 0.
  const news = steps.findIndex((x) => x.delta !== 0);
  // The first target that borrows an estimate above 0, and the first TD error below 0.
  const spread = steps.findIndex((x) => !x.done && x.boot > 0), drop = steps.findIndex((x) => x.delta < 0);
  // The move after which every estimate is above 0.
  const reached = steps.findIndex((x) => CELLS.every((s) => x.post[s] > 0));

  /* Slides */

  const slides = [];
  slides.push({ title: tr("TD(0) on the cookie grid", "TD(0) en la grilla de la galleta"), builds: [{ ep: 1, move: null, at: -1, time: 0, V: Array(9).fill(0), agent: START, line: tr(
    `All estimates start at 0, with the agent at ${sym("S", 0)} = A1.`,
    `Todas las estimaciones parten en 0, con el agente en ${sym("S", 0)} = A1.`) }] });
  slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
    chooseBuild(0),
    takeBuild(0),
    deltaBuild(0, tr(
      `${sym("R", 1)} and ${sym("S", 1)} are known at <i>t</i> = 1, so the TD error can be computed. Its target uses the estimate of ${sym("S", 1)}, outlined in red.`,
      `${sym("R", 1)} y ${sym("S", 1)} se conocen en <i>t</i> = 1, así que se puede calcular el TD error. Su objetivo usa la estimación de ${sym("S", 1)}, con borde rojo.`)),
    updateBuild(0, tr(
      `Still at <i>t</i> = 1, ${Vof(0)} moves by α times the TD error, that is, not at all: with no reward yet and every estimate at 0, there is nothing to learn.`,
      `Todavía en <i>t</i> = 1, ${Vof(0)} se mueve α veces el TD error, o sea, nada: sin recompensa todavía y con todas las estimaciones en 0, no hay nada que aprender.`)),
  ] });
  // A move and its TD error of 0 in one press: nothing changes. With withChoice, the line also says how it was chosen.
  function quietBuild(i, again, withChoice = true) {
    const x = X(i), b = takeBuild(i, withChoice);
    return { ...b, time: x.t + 1, eq: deltaBuild(i, "").eq, line: b.line + (again
      ? tr(` The TD error is 0 again, so ${Vof(x.t)} stays at ${num(x.old)}.`, ` El TD error vuelve a ser 0, así que ${Vof(x.t)} sigue en ${num(x.old)}.`)
      : tr(` The TD error is 0, so ${Vof(x.t)} stays at ${num(x.old)}.`, ` El TD error es 0, así que ${Vof(x.t)} sigue en ${num(x.old)}.`)) };
  }
  // The other moves of episode 1 before its last, one press each.
  for (let i = 1; i < news; i++) slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [quietBuild(i, true)] });
  {
    // The returns Monte Carlo gave this episode's cells, from the cell nearest the cookie to the first one.
    const i = news, x = X(i), T = x.t + 1, mc = firstReturns(x.ep), near = mc[0], far = mc.at(-1);
    slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [
      takeBuild(i, true),
      deltaBuild(i, tr(
        `The cookie ends the episode at <i>T</i> = ${T}, and the estimate of a terminal state is 0, so the target is just ${sym("R", T)} = 1.`,
        `La galleta termina el episodio en <i>T</i> = ${T}, y la estimación de un estado terminal es 0, así que el objetivo es solo ${sym("R", T)} = 1.`)),
      updateBuild(i, tr(
        `Still at <i>t</i> = ${T}, ${Vof(x.t)} moves halfway toward the target, from 0 to ${num(x.nu)}: the first estimate to change. On this same episode, the previous note's first figure gave each cell of the episode its return at the end, from ${num(near.G)} in ${cellName(near.s)} down to ${num(far.G)} in ${cellName(far.s)}. TD(0) has already updated each one right after its move, and only this last move brought news.`,
        `Todavía en <i>t</i> = ${T}, ${Vof(x.t)} avanza la mitad del camino hacia el objetivo, de 0 a ${num(x.nu)}: la primera estimación que cambia. En este mismo episodio, la primera figura del apunte anterior le dio a cada celda del episodio su retorno al final, desde ${num(near.G)} en ${cellName(near.s)} hasta ${num(far.G)} en ${cellName(far.s)}. TD(0) ya actualizó cada una justo después de su movimiento, y solo este último movimiento trajo novedades.`)),
    ] });
  }
  // Episode 2 up to that moment, one press per move: a skip of a few moves would land in the middle of this short episode.
  {
    const first = news + 1, c = chooseBuild(first);
    slides.push({ title: tr("Episode 2", "Episodio 2"), builds: [{ ...c, line: tr("A new episode starts at A1. ", "Un nuevo episodio parte en A1. ") + c.line }, quietBuild(first, false, false)] });
    for (let i = first + 1; i < spread; i++) slides.push({ title: tr(`Move ${X(i).t + 1}`, `Movimiento ${X(i).t + 1}`), builds: [quietBuild(i, true)] });
  }
  {
    const i = spread, x = X(i), t = x.t, S1 = `${sym("S", t + 1)} = ${cellName(x.s2)}`;
    slides.push({ title: tr("The news travels back", "La noticia viaja hacia atrás"), builds: [
      takeBuild(i, true),
      deltaBuild(i, tr(
        `There is no reward, but the target uses the estimate of ${S1}, outlined in red, now ${num(x.boot)}: the TD error is positive.`,
        `No hay recompensa, pero el objetivo usa la estimación de ${S1}, con borde rojo, que ahora es ${num(x.boot)}: el TD error es positivo.`)),
      updateBuild(i, tr(
        `Still at <i>t</i> = ${t + 1}, ${Vof(t)} moves halfway toward the target, from ${num(x.old)} to ${num(x.nu)}. ${cellName(x.s)} learns from the estimate of ${cellName(x.s2)}, itself a guess: the cookie's reward has moved back one cell, in the middle of an episode.`,
        `Todavía en <i>t</i> = ${t + 1}, ${Vof(t)} avanza la mitad del camino hacia el objetivo, de ${num(x.old)} a ${num(x.nu)}. ${cellName(x.s)} aprende de la estimación de ${cellName(x.s2)}, que también es una conjetura: la recompensa de la galleta retrocedió una celda, en medio de un episodio.`)),
    ] });
  }
  {
    const i = drop, x = X(i), t = x.t, S1 = `${sym("S", t + 1)} = ${cellName(x.s2)}`;
    slides.push({ title: tr("Bad news", "Una mala noticia"), builds: [
      takeBuild(i, true),
      deltaBuild(i, tr(
        `The target uses the estimate of ${S1}, outlined in red, still ${num(x.boot)}, while ${Vof(t)} is ${num(x.old)}: the TD error is negative.`,
        `El objetivo usa la estimación de ${S1}, con borde rojo, que sigue en ${num(x.boot)}, mientras que ${Vof(t)} es ${num(x.old)}: el TD error es negativo.`)),
      updateBuild(i, tr(
        `Still at <i>t</i> = ${t + 1}, ${Vof(t)} drops halfway toward the target, from ${num(x.old)} to ${num(x.nu)}. Stepping to a cell estimated at ${num(x.boot)} is bad news, and TD(0) lowers the estimate of ${cellName(x.s)} at once, with the episode still going.`,
        `Todavía en <i>t</i> = ${t + 1}, ${Vof(t)} baja la mitad del camino hacia el objetivo, de ${num(x.old)} a ${num(x.nu)}. Pasar a una celda estimada en ${num(x.boot)} es una mala noticia, y TD(0) baja la estimación de ${cellName(x.s)} de inmediato, con el episodio todavía en curso.`)),
    ] });
  }
  {
    const i = reached, x = X(i);
    // No equation here: the TD error is a few hundredths, and two decimals would not show it.
    slides.push({ title: tr("Every cell reached", "Todas las celdas alcanzadas"), builds: [{ ...updateBuild(i, tr(
      `In episode ${x.ep}, after ${i + 1} moves in all, the last estimate still at 0, that of ${cellName(x.s)}, rises above it, borrowing from ${cellName(x.s2)}. The cookie's reward has now reached every cell, carried back one cell at a time by the targets. No estimate can drop back to 0: each update keeps at least half of it.`,
      `En el episodio ${x.ep}, tras ${i + 1} movimientos en total, la última estimación que seguía en 0, la de ${cellName(x.s)}, sube, tomando prestada la de ${cellName(x.s2)}. La recompensa de la galleta ya llegó a todas las celdas, llevada hacia atrás una celda a la vez por los objetivos. Ninguna estimación puede volver a 0: cada actualización conserva al menos la mitad.`)), eq: null }] });
  }
  {
    const x = X(last), Vf = x.post, gap = (s) => Math.abs(Vf[s] - vpi[s]), c = CELLS.reduce((m, s) => (gap(s) > gap(m) ? s : m));
    const mcGap = Math.max(...CELLS.map((s) => Math.abs(mcV[s] - vpi[s])));
    // The route the estimates lead along from A1, as in the Monte Carlo note's first figure, drawn as a band.
    const route = valuePath(Vf, GAMMA), len = route ? route.length - 1 : 0, sh = len === 4;
    const lead = route ? tr(`, and followed from A1 they lead to it in ${len} moves${sh ? ", the shortest route" : ""}`, `, y seguidas desde A1 llevan a ella en ${len} movimientos${sh ? ", la ruta más corta" : ""}`) : "";
    slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...pos(last), time: x.t + 1, V: Vf, agent: GOAL, route, line: tr(
      `After ${last + 1} moves, the estimates rank the cells as the random policy's true values do, higher nearer the cookie${lead}. But they miss those values by up to ${num(gap(c))}, in ${cellName(c)}: ${num(Vf[c])} against ${num(vpi[c])}. With ${nw("α = 0.5")}, each update moves an estimate halfway toward its target, so it mostly reflects the last few moves from its cell. The Monte Carlo averages of these same episodes, which weigh every return alike, missed by at most ${num(mcGap)}.`,
      `Tras ${last + 1} movimientos, las estimaciones ordenan las celdas igual que los valores verdaderos de la política al azar, más altas cerca de la galleta${lead}. Pero se alejan de esos valores hasta en ${num(gap(c))}, en ${cellName(c)}: ${num(Vf[c])} contra ${num(vpi[c])}. Con ${nw("α = 0.5")}, cada actualización mueve una estimación la mitad del camino hacia su objetivo, así que refleja sobre todo los últimos movimientos desde su celda. Los promedios de Monte Carlo de estos mismos episodios, que pesan igual todos los retornos, se alejaban a lo más ${num(mcGap)}.`) }] });
  }
  // How far each slide jumps ahead of the one before it, counting moves in the whole run. When every TD error skipped
  // is 0, the note says so.
  for (let i = 1; i < slides.length; i++) {
    const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
    if (gap <= 1) continue;
    const epFrom = from >= 0 ? X(from).ep + (X(from).done ? 1 : 0) : 1, epTo = X(to).ep, quiet = steps.slice(from + 1, to).every((x) => x.delta === 0);
    slides[i].skip = { from, to, moves: gap, text: tr(`${gap} moves later`, `${gap} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : ""),
      note: !quiet ? undefined : gap === 2 ? tr("1 move goes by, with a TD error of 0.", "Pasa 1 movimiento, con un TD error de 0.")
        : tr(`${gap - 1} moves go by, each with a TD error of 0.`, `Pasan ${gap - 1} movimientos, cada uno con un TD error de 0.`) };
  }

  slideshow({
    svg: document.getElementById("fig-td0"),
    slides,
    world: cookie,
    perCell: true,
    // The state after move m of the whole run, for the frames of a skip: the cell just updated in green, the next move in yellow.
    frame: (m) => {
      const x = X(m), y = X(m + 1);
      return { V: x.post, agent: x.s2, ep: x.ep, move: x.t + 1, time: x.t + 1, bumpPose: shake(x, m), marks: [{ c: x.s, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
    },
  });
}

/* ---------- Section 5: Sarsa on the cliff, one line of the algorithm per press ---------- */

// One-step Sarsa with α = 0.5, γ = 1 and ε = 0.1, with ties broken at random. Its target uses the move picked next, so
// with a step this large each exploring fall shakes the values, and the best moves keep changing for many episodes.
// This seed has a short first episode, 14 moves, which the figure plays move by move, with the same fall twice in it.
// Later the best moves run along the edge until a random move into the cliff, picked as A′ in B2, breaks that route for
// good in episode 24, and at the end they run one row up.
const ALPHA = 0.5, EPS = 0.1, SEED = 557070, EPISODES = 30;

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
  return { ...pos(i), time: x.t, Q: x.pre, agent: x.fell !== null ? x.fell : x.s2, ring: x.fell, taken: [x.s, x.a], bump, sound: x.fell !== null ? "fall" : bump !== null ? "wall" : undefined,
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
  const eq = `<span class="upd">${pairOf(t)}</span> <span class="nowrap">← ${num(x.old)} + ${ALPHA}[<span class="pt">${num(x.target)}</span> − ${par(x.old)}]</span> <span class="nowrap">${eqv(x.nu)}</span>`;
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
// The other moves of episode 1, one press each: why the move was chosen and where it led, then its update, with A′ in
// yellow and outlined in red, and the pair updated in green.
// When the slide before already explained why this move was chosen (chosen), the press says only where it led.
function moveBuild(i, extra, chosen = false) {
  const x = X(i), t = x.t, bump = x.fell === null && x.s2 === x.s ? x.a : null;
  const rest = extra ?? tr(`It chooses its next move, in yellow, and ${pairOf(t)} moves halfway toward the target.`, `Elige su siguiente movimiento, en amarillo, y ${pairOf(t)} avanza la mitad del camino hacia el objetivo.`);
  return { ...wholeBuild(i, `${chosen ? takeText(x) : chooseTakeText(x.qAt[x.s], x.explored, x)} ${rest}`, true), marks: [...tgMark(x), { c: x.s, a: x.a, kind: "upd" }], taken: [x.s, x.a], ring: x.fell, jump: x.fell !== null, bump,
    sound: x.fell !== null ? "fall" : bump !== null ? "wall" : undefined };
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
  const twice = i > 0 && X(i - 1).s === X(i).s && X(i - 1).a === X(i).a ? tr(` It is the same pair as at <i>t</i> = ${i - 1}, ${moveName(X(i).s, X(i).a)}, updated a second time.`, ` Es el mismo par que en <i>t</i> = ${i - 1}, ${moveName(X(i).s, X(i).a)}, actualizado por segunda vez.`) : "";
  b.push(updateBuild(i, updateLine(i) + twice + (i === 2 ? tr(" Every move tried so far is now below 0 and every untried one still 0, so untried moves look better: at first, the agent tries everything.", " Cada movimiento probado hasta ahora queda bajo 0 y cada uno sin probar sigue en 0, así que los que no se han probado parecen mejores: al principio, el agente lo prueba todo.") : "")));
  slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: b });
}
// Any moves between move 3 and the first fall, one press each.
for (let i = 3; i < firstFall; i++) slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [moveBuild(i)] });
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
// The rest of episode 1, one press per move, then its last move.
for (let i = firstFall + (again ? 2 : 1); i < ep1End; i++) slides.push({ title: tr(`Move ${X(i).t + 1}`, `Movimiento ${X(i).t + 1}`), builds: [moveBuild(i, undefined, i === firstFall + (again ? 2 : 1))] });
{
  const x = X(ep1End), T = x.t + 1, f = falls.filter((y) => y.ep === 1).length;
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [moveBuild(ep1End, tr(
    `The episode ends at <i>T</i> = ${T}, after ${count(f, "fall", "falls")}: no move follows the goal, so the target of the last move is just ${sym("R", T)} = −1.`,
    `El episodio termina en <i>T</i> = ${T}, después de ${count(f, "caída", "caídas")}: después de la meta no viene ningún movimiento, así que el objetivo del último movimiento es solo ${sym("R", T)} = −1.`))] });
}
{
  // The state one move before the pull: the route along the edge, which the agent is following.
  // When the first route of all was not the edge, the slide says so: the best moves kept changing before reaching it.
  const i = pull - 1, x = X(i), route = greedyPath(x.post), len = route.length - 1, key = route.join();
  const firstEdge = steps.findIndex((y) => greedyPath(y.post)?.join() === key), firstLen = greedyPath(X(firstRoute).post).length - 1;
  const here = tr(`The agent is in ${cellName(x.s2)}, and its next move, ${NAME[x.next.a]}, follows it.`, `El agente está en ${cellName(x.s2)}, y su siguiente movimiento, ${NAME[x.next.a]}, la sigue.`);
  slides.push({ title: firstEdge === firstRoute ? tr("A first way through", "Un primer camino") : tr("Along the edge", "Por el borde"), builds: [{ ...wholeBuild(i, firstEdge === firstRoute ? tr(
    `In episode ${X(firstRoute).ep}, the best moves first lead from A1 to the goal: along the edge, ${len} moves, the shortest route. ${here}`,
    `En el episodio ${X(firstRoute).ep}, los mejores movimientos llevan por primera vez de A1 a la meta: por el borde, ${len} movimientos, la ruta más corta. ${here}`) : tr(
    `The best moves first led from A1 to the goal in episode ${X(firstRoute).ep}, in ${firstLen} moves, and have kept changing since. In episode ${X(firstEdge).ep} they first ran along the edge, ${len} moves, the shortest route, and they do now. ${here}`,
    `Los mejores movimientos llevaron por primera vez de A1 a la meta en el episodio ${X(firstRoute).ep}, en ${firstLen} movimientos, y han seguido cambiando. En el episodio ${X(firstEdge).ep} fueron por primera vez por el borde, ${len} movimientos, la ruta más corta, y ahora van por ahí. ${here}`)), route }] });
}
{
  const i = pull, x = X(i), t = x.t, c = cellName(x.s);
  // How many times that step into the cliff was taken before, which gave it its value.
  const before = steps.slice(0, i).filter((y) => y.s === x.s2 && y.a === x.next.a).length;
  slides.push({ title: tr("The edge pays for exploring", "El borde paga por explorar"), builds: [
    takeBuild(i),
    chooseNextBuild(i, before === 1 ? tr(` That is a step into the cliff, worth ${num(x.boot)} after an earlier fall from ${cellName(x.s2)}.`, ` Es un paso al acantilado, que vale ${num(x.boot)} después de una caída anterior desde ${cellName(x.s2)}.`)
      : tr(` That is a step into the cliff, worth ${num(x.boot)} after ${before} earlier falls from ${cellName(x.s2)}.`, ` Es un paso al acantilado, que vale ${num(x.boot)} después de ${before} caídas anteriores desde ${cellName(x.s2)}.`)),
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
    return { Q: x.post, agent: x.done ? GOAL : x.s2, ring: x.fell, ep: x.ep, move: x.t + 1, time: x.t + 1, bumpPose: shake(x, m), marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: x.next ? [x.s2, x.next.a] : undefined };
  },
});
