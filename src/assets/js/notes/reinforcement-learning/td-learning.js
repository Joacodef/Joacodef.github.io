import { tr, modeButtons } from "../../plane.js";
import { cookie, START, GOAL, NAME, cellName, moveName, stepEnv, rngFrom, freshQ, epsGreedy, greedyPath, num, par, eqv, count, listAnd, sym, reason, takeText, chooseTakeText, slideshow, shake } from "./gridworld.js";

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

/* ---------- Section 4: batch updating on the same 30 episodes, one line of the algorithm per press ---------- */

// The 702 moves of the first figure's 30 episodes are a fixed batch, replayed at every pass with the table held fixed.
// Batch TD(0) adds up the TD errors of each cell's moves, and batch Monte Carlo the errors of their returns, G − V(S),
// at every visit, as the book's batch updating does; each estimate then changes once, by α times its cell's sum. With
// α = 0.005 no estimate overshoots (176 of the moves start in A1), and in both runs no estimate ever drops. Batch TD(0)
// carries the cookie's reward one move further back at each pass and settles on the values of the model the moves
// suggest; batch Monte Carlo moves every estimate at once and settles on the average return of every visit. The agent
// stands in A1 throughout: nothing acts, the moves are only replayed. Inside this block the cookie grid's names replace
// the cliff's.
{
  const ALPHA = 0.005, GAMMA = 0.9, SEED = 15395, EPISODES = 30, PASSES = 400;
  const { START, GOAL, cellName, stepEnv, valuePath } = cookie;
  const CELLS = [...Array(9).keys()].filter((s) => s !== GOAL), [A3, B3, B2, C2, C1] = [0, 1, 4, 5, 8];
  // The batch: the moves of the 30 episodes, drawn as the first figure draws them, each with the return that follows it.
  const moves = [];
  {
    const rnd = rngFrom(SEED);
    for (let ep = 1; ep <= EPISODES; ep++) {
      const e = []; let s = START;
      while (true) { const a = Math.floor(rnd() * 4), o = stepEnv(s, a); e.push({ s, a, ...o }); if (o.done) break; s = o.s2; }
      let G = 0;
      for (let t = e.length - 1; t >= 0; t--) { G = GAMMA * G + e[t].r; e[t].G = G; }
      moves.push(...e);
    }
  }
  // A run: the table after each pass, V[p] (V[0] all 0), and each cell's sum of increments in that pass, sum[p].
  function run(increment) {
    const V = [Array(9).fill(0)], sum = [null];
    for (let p = 1; p <= PASSES; p++) {
      const S = Array(9).fill(0);
      for (const m of moves) S[m.s] += increment(m, V[p - 1]);
      sum.push(S); V.push(V[p - 1].map((v, s) => v + ALPHA * S[s]));
    }
    return { V, sum };
  }
  const td = run((m, V) => m.r + GAMMA * (m.done ? 0 : V[m.s2]) - V[m.s]), mc = run((m, V) => m.G - V[m.s]);
  // The true values of the random policy, and where the first figure's online TD(0), with α = 0.5, ended.
  const vpi = Array(9).fill(0);
  for (let k = 0; k < 300; k++) for (const s of CELLS) vpi[s] = [0, 1, 2, 3].reduce((acc, a) => { const o = stepEnv(s, a); return acc + (o.r + GAMMA * (o.done ? 0 : vpi[o.s2])) / 4; }, 0);
  const online = Array(9).fill(0);
  for (const m of moves) online[m.s] += 0.5 * (m.r + GAMMA * (m.done ? 0 : online[m.s2]) - online[m.s]);
  // The estimates a pass changes at two decimals, as the grid shows them, and the first pass from which no pass changes
  // any. Every estimate a pass changes at all is outlined in green.
  const shown = (v) => Math.round(v * 100);
  const changed = (R, p) => CELLS.filter((s) => shown(R.V[p][s]) !== shown(R.V[p - 1][s]));
  const settle = (R) => { let p = PASSES; while (p > 1 && !changed(R, p).length) p--; return p + 1; };
  const tdEnd = settle(td), mcEnd = settle(mc);
  const from = (s) => moves.filter((m) => m.s === s), sumG = (s) => from(s).reduce((acc, m) => acc + m.G, 0);
  // The cell where a table misses the true values most.
  const worst = (V) => CELLS.reduce((w, s) => (Math.abs(V[s] - vpi[s]) > Math.abs(V[w] - vpi[w]) ? s : w));
  const miss = (V) => Math.abs(V[worst(V)] - vpi[worst(V)]).toFixed(2), n3 = (v) => String(Math.round(v * 1000) / 1000);
  const nw = (x) => `<span class="nowrap">${x}</span>`, pt = (x) => `<span class="pt">${x}</span>`;
  const Vof = (c) => `<i>V</i>(${c})`, St = `<i>S</i><sub><i>t</i></sub>`;
  const label = (p) => (p ? tr(`Pass ${p}`, `Pasada ${p}`) : tr("Before the first pass", "Antes de la primera pasada"));
  const greens = (R, p) => CELLS.filter((s) => R.V[p][s] !== R.V[p - 1][s]).map((c) => ({ c, kind: "upd" }));
  // The table after pass p, with the agent in A1; a frame of a skip outlines what its pass changed.
  const at = (R, p, rest) => ({ V: R.V[p], agent: START, label: label(p), ...rest });
  const frameOf = (R) => (p) => at(R, p, { marks: greens(R, p) });
  const skipTo = (p, q) => ({ from: p, to: q, moves: q - p, text: tr(`${q - p} passes later`, `${q - p} pasadas después`),
    note: tr(`${q - p} passes go by, and the estimates keep rising.`, `Se hacen ${q - p} pasadas más, y las estimaciones siguen subiendo.`) });

  /* Batch TD(0) */

  const tdSlides = [];
  const toCookie = (s) => from(s).filter((m) => m.done).length, nC2 = from(C2).length;
  tdSlides.push({ title: tr("Batch TD(0)", "TD(0) por lotes"), builds: [at(td, 0, { line: tr("All estimates start at 0.", "Todas las estimaciones parten en 0.") })] });
  {
    // Pass 1: with the table at 0, only the moves into the cookie have a TD error that is not 0, and it is 1.
    const k = toCookie(C2), k3 = toCookie(B3);
    tdSlides.push({ title: tr("The first pass", "La primera pasada"), builds: [
      at(td, 0, { label: label(1), line: tr(
        `With the table held at 0, each TD error is just the move's reward: 0, except for the ${k + k3} moves into the cookie, ${k3} from B3 and ${k} from C2. The TD errors of the ${nC2} moves from C2 add up to ${k}.`,
        `Con la tabla fija en 0, cada TD error es solo la recompensa del movimiento: 0, salvo en los ${k + k3} movimientos que llegan a la galleta, ${k3} desde B3 y ${k} desde C2. Los TD errors de los ${nC2} movimientos desde C2 suman ${k}.`),
        eq: `Σ δ<sub><i>t</i></sub> ${nw(`= ${k} · (${pt("1 + 0.9 · 0")} − 0)`)} ${nw(`= ${pt(num(td.sum[1][C2]))}`)}` }),
      at(td, 1, { marks: greens(td, 1), line: tr(
        "Each estimate changes once, by α times the sum of its TD errors: those of B3 and C2 rise, and every other one stays at 0.",
        "Cada estimación cambia una sola vez, α veces la suma de sus TD errors: suben las de B3 y C2, y las demás siguen en 0."),
        eq: `<span class="upd">${Vof("C2")}</span> ${nw(`← 0 + ${ALPHA} · ${pt(num(td.sum[1][C2]))}`)} ${nw(`= ${n3(td.V[1][C2])}`)}` }),
    ] });
  }
  {
    // Pass 2: the targets of the moves into B3 and C2 borrow their estimates, and the cells one move from them rise.
    const n = from(B2).filter((m) => m.s2 === B3 || m.s2 === C2).length, red = [{ c: B3, kind: "tg" }, { c: C2, kind: "tg" }];
    tdSlides.push({ title: tr("One move further back", "Un movimiento más atrás"), builds: [
      at(td, 1, { label: label(2), marks: red, line: tr(
        `The batch is replayed with the new table. The targets of the moves into B3 and C2 now borrow their estimates, outlined in red: ${n} of the ${from(B2).length} moves from B2 go there, and the others still have a TD error of 0.`,
        `El lote se repasa con la tabla nueva. Los objetivos de los movimientos hacia B3 y C2 ahora toman prestadas sus estimaciones, con borde rojo: ${n} de los ${from(B2).length} movimientos desde B2 van ahí, y los demás siguen con un TD error de 0.`),
        eq: `Σ δ<sub><i>t</i></sub> ${nw(`= ${n} · (${pt(`0 + 0.9 · ${n3(td.V[1][C2])}`)} − 0)`)} ${nw(`= ${pt(num(td.sum[2][B2]))}`)}` }),
      at(td, 2, { marks: [...red, ...greens(td, 2)], line: tr(
        "B2 rises above 0, and so do A3 and C1, the other cells one move from B3 or C2: the cookie's reward has moved back one more move, and each pass carries it one move further. B3 and C2 rise again.",
        "B2 sube de 0, y también A3 y C1, las otras celdas a un movimiento de B3 o C2: la recompensa de la galleta retrocedió un movimiento más, y cada pasada la lleva un movimiento más allá. B3 y C2 vuelven a subir."),
        eq: `<span class="upd">${Vof("B2")}</span> ${nw(`← 0 + ${ALPHA} · ${pt(num(td.sum[2][B2]))}`)} ${nw(eqv(td.V[2][B2]))}` }),
    ] });
  }
  {
    // Settled: from tdEnd on, no pass changes an estimate at two decimals. Each estimate is then the average target of
    // its cell's moves; C2's is written out with the values shown, by where its moves led, in the order of the moves.
    const V = td.V[tdEnd], r2 = (v) => Math.round(v * 100) / 100;
    const dest = [0, 1, 2, 3].map((a) => ({ a, n: from(C2).filter((m) => m.a === a).length, o: stepEnv(C2, a) })).filter((x) => x.n);
    const ends = dest.filter((x) => !x.o.done);
    const where = dest.map((x) => (x.o.done ? tr(`${x.n} into the cookie`, `${x.n} a la galleta`) : x.o.s2 === C2 ? tr(`${x.n} into the wall`, `${x.n} contra la pared`)
      : tr(`${x.n} to ${cellName(x.o.s2)}`, `${x.n} a ${cellName(x.o.s2)}`)));
    const avg = dest.reduce((acc, x) => acc + x.n * (x.o.done ? 1 : GAMMA * r2(V[x.o.s2])), 0) / nC2;
    if (shown(avg) !== shown(V[C2])) console.warn("Batch figure: C2's average target, from the values shown, does not round to its estimate");
    // The average written out, in pieces that break before a plus sign: the moves into the cookie, then the others.
    const terms = ends.map((x) => `${x.n} · ${num(V[x.o.s2])}`);
    const sum = `${nw(`= (${pt(`${dest.find((x) => x.o.done).n} · 1`)}`)} ${nw(pt(`+ 0.9 · (${terms[0]}`))} ${terms.slice(1, -1).map((x) => nw(pt(`+ ${x}`))).join(" ")} ${nw(`${pt(`+ ${terms.at(-1)})`)})/${nC2}`)}`;
    tdSlides.push({ title: tr(`After ${tdEnd} passes`, `Después de ${tdEnd} pasadas`), skip: skipTo(2, tdEnd), builds: [at(td, tdEnd, { marks: ends.map((x) => ({ c: x.o.s2, kind: "tg" })), fit: true, line: tr(
      `From this pass on, replaying the batch changes no estimate at two decimals. Each one has settled where the TD errors of its cell's moves add up to about 0, which makes it the average target of those moves: from C2, ${listAnd(where)}.`,
      `Desde esta pasada, repasar el lote ya no cambia ninguna estimación en dos decimales. Cada una se asentó donde los TD errors de los movimientos de su celda suman cerca de 0, así que es el promedio de los objetivos de esos movimientos: desde C2, ${listAnd(where)}.`),
      eq: `${Vof("C2")} ${sum} ${nw(eqv(avg))}` })] });
  }
  {
    const V = td.V[tdEnd], route = valuePath(V, GAMMA), w = worst(V), k = toCookie(C2);
    if (w !== C2) console.warn("Batch figure: batch TD(0) should miss the true values most in C2");
    tdSlides.push({ title: tr("What batch TD(0) converges to", "A qué converge TD(0) por lotes"), builds: [at(td, tdEnd, { route, line: tr(
      `These are the values of the model the moves suggest, the certainty-equivalence estimate, and followed from A1 they lead to the cookie in ${route.length - 1} moves. They miss the random policy's true values by up to ${miss(V)}, in C2: ${num(V[C2])} against ${num(vpi[C2])}, because C2's own moves were lucky: ${k} of its ${nC2} moves reached the cookie, where a random move does so one time in four. Online, with ${nw("α = 0.5")}, the first figure ended at ${num(online[C2])} there.`,
      `Son los valores del modelo que sugieren los movimientos, la estimación de equivalencia de certeza, y seguidas desde A1 llevan a la galleta en ${route.length - 1} movimientos. Se alejan de los valores verdaderos de la política al azar hasta en ${miss(V)}, en C2: ${num(V[C2])} contra ${num(vpi[C2])}, porque los movimientos desde C2 tuvieron suerte: ${k} de sus ${nC2} movimientos llegaron a la galleta, cuando un movimiento al azar lo hace una vez de cada cuatro. En línea, con ${nw("α = 0.5")}, la primera figura terminó en ${num(online[C2])} ahí.`) })] });
  }

  /* Batch Monte Carlo */

  const mcSlides = [];
  mcSlides.push({ title: tr("Batch Monte Carlo", "Monte Carlo por lotes"), builds: [at(mc, 0, { line: tr(
    "All estimates start at 0 again. The increment of each visit is now its return minus the estimate, and the returns are the same at every pass.",
    "Todas las estimaciones vuelven a partir en 0. El incremento de cada visita es ahora su retorno menos la estimación, y los retornos son los mismos en cada pasada.") })] });
  {
    const n = from(START).length;
    if (CELLS.some((s) => from(s).length > n)) console.warn("Batch figure: A1 should be the cell visited most");
    mcSlides.push({ title: tr("The first pass", "La primera pasada"), builds: [
      at(mc, 0, { label: label(1), line: tr(
        `With the table at 0, each increment is just a return. A1, the cell visited most, has ${n} returns, which add up to ${num(sumG(START))}.`,
        `Con la tabla en 0, cada incremento es solo un retorno. A1, la celda más visitada, tiene ${n} retornos, que suman ${num(sumG(START))}.`),
        eq: `Σ (${pt(`<i>G</i><sub><i>t</i></sub>`)} − <i>V</i>(${St})) ${nw(`= ${pt(num(sumG(START)))} − ${n} · 0`)} ${nw(`= ${pt(num(mc.sum[1][START]))}`)}` }),
      at(mc, 1, { marks: greens(mc, 1), line: tr(
        "Every estimate changes at once, none waiting for another: a return does not depend on any estimate.",
        "Todas las estimaciones cambian a la vez, sin esperar a ninguna otra: un retorno no depende de ninguna estimación."),
        eq: `<span class="upd">${Vof("A1")}</span> ${nw(`← 0 + ${ALPHA} · ${pt(num(mc.sum[1][START]))}`)} ${nw(eqv(mc.V[1][START]))}` }),
    ] });
  }
  {
    const g = sumG(C2);
    mcSlides.push({ title: tr(`After ${mcEnd} passes`, `Después de ${mcEnd} pasadas`), skip: skipTo(1, mcEnd), builds: [at(mc, mcEnd, { line: tr(
      `From this pass on, nothing changes at two decimals: each estimate has settled on the average return of all the visits to its cell, ${nC2} for C2. The Monte Carlo note's figure averaged only the first visit in each episode.`,
      `Desde esta pasada, nada cambia en dos decimales: cada estimación se asentó en el retorno promedio de todas las visitas a su celda, ${nC2} en C2. La figura del apunte de Monte Carlo promediaba solo la primera visita de cada episodio.`),
      eq: `${Vof("C2")} ${nw(`≈ ${pt(num(g))}/${nC2}`)} ${nw(eqv(g / nC2))}` })] });
  }
  {
    // Compared where both runs end up, the last pass computed: at two decimals, the same as the tables shown.
    const V = mc.V[PASSES], T = td.V[PASSES], route = valuePath(mc.V[mcEnd], GAMMA), w = worst(V);
    const far = CELLS.reduce((x, s) => (Math.abs(T[s] - V[s]) > Math.abs(T[x] - V[x]) ? s : x));
    if (!(Math.abs(V[w] - vpi[w]) < Math.abs(T[worst(T)] - vpi[worst(T)]))) console.warn("Batch figure: batch Monte Carlo should miss the true values by less than batch TD(0) on this batch");
    // Over 10,000 other batches of 30 episodes (seeds 1 to 10,000), batch TD(0)'s largest miss was the smaller one in
    // 7,908: computed offline, since it would be too heavy to compute here.
    mcSlides.push({ title: tr("What batch Monte Carlo converges to", "A qué converge Monte Carlo por lotes"), builds: [at(mc, mcEnd, { route, line: tr(
      `On the same batch, batch TD(0) ends farthest from these averages in ${cellName(far)}: ${num(T[far])} against ${num(V[far])}. Here the averages miss the true values by a little less than batch TD(0) does: up to ${miss(V)}, in ${cellName(w)}, against ${miss(T)}. But over 10,000 other batches of 30 episodes, batch TD(0)'s largest miss was the smaller one about 4 times in 5.`,
      `En el mismo lote, TD(0) por lotes termina más lejos de estos promedios en ${cellName(far)}: ${num(T[far])} contra ${num(V[far])}. Aquí los promedios se alejan de los valores verdaderos un poco menos que TD(0) por lotes: hasta ${miss(V)}, en ${cellName(w)}, contra ${miss(T)}. Pero en otros 10 000 lotes de 30 episodios, la mayor distancia de TD(0) por lotes fue menor que la de los promedios cerca de 4 de cada 5 veces.`) })] });
  }

  // The claims of the slides, checked: pass 1 changes only B3 and C2, pass 2 also the cells one move from them, each
  // cell leaves 0 at the pass of its distance from the cookie, and in both runs no estimate drops or overshoots.
  const dist = (s) => Math.abs((s % 3) - 2) + Math.floor(s / 3);
  if (changed(td, 1).join() !== [B3, C2].join() || changed(td, 2).join() !== [A3, B3, B2, C2, C1].join()) console.warn("Batch figure: passes 1 and 2 should change B3 and C2, then also A3, B2 and C1");
  if (!CELLS.every((s) => td.V.findIndex((V) => V[s] > 0) === dist(s))) console.warn("Batch figure: a cell should leave 0 at the pass of its distance from the cookie");
  for (const R of [td, mc]) if (!R.V.every((V, p) => !p || CELLS.every((s) => V[s] >= R.V[p - 1][s] - 1e-12 && V[s] <= R.V[PASSES][s] + 1e-9))) console.warn("Batch figure: an estimate drops or overshoots");

  const fig = slideshow({ svg: document.getElementById("fig-batch"), slides: tdSlides, frame: frameOf(td), world: cookie, perCell: true });
  modeButtons(document.getElementById("fig-batch-modes"), (mode) => (mode === "mc" ? fig.show(mcSlides, frameOf(mc)) : fig.show(tdSlides, frameOf(td))));
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
