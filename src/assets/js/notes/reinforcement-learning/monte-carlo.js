import { tr } from "../../plane.js";
import { cookie, NAME, rngFrom, epsGreedy, num, eqv, listAnd, listOr, sym, slideshow, shake } from "./gridworld.js";

/* ---------- Section 1: first-visit Monte Carlo prediction on the cookie grid ---------- */

// The policy picks each of the four moves at random; γ = 0.9, every estimate 0 at first, each estimate the average of
// its first-visit returns. The seed is that of the TD(0) figure in the next note, so both figures learn from the same
// 30 episodes. Episode 1 takes 5 moves and hits the wall in A2, so the agent is in A2 twice; in episode 2 the first
// visit to C2 comes before a detour; episode 3 wanders for 41 moves. Inside this block, names are the figure's own.
{
  const GAMMA = 0.9, SEED = 15395, EPISODES = 30;
  const { START, GOAL, cellName, stepEnv, takeText, randomPick, randomTake, valuePath } = cookie;
  const CELLS = [...Array(9).keys()].filter((s) => s !== GOAL);

  // The whole run, computed once, as a list of events: the moves of an episode, then each step of its sweep back. Every
  // event keeps the estimates after it (moves leave them as they were); a step of the sweep also keeps the return G it
  // computed, whether its cell was updated (its first visit) or skipped, and the returns its cell holds.
  const events = [], episodes = [];
  {
    const rnd = rngFrom(SEED), V = Array(9).fill(0), returns = Array.from({ length: 9 }, () => []);
    for (let ep = 1; ep <= EPISODES; ep++) {
      const moves = []; let s = START;
      while (true) {
        const a = Math.floor(rnd() * 4), o = stepEnv(s, a);
        const m = { kind: "move", ep, t: moves.length, s, a, ...o, first: !moves.some((y) => y.s === s), V: V.slice() };
        moves.push(m); events.push(m);
        if (o.done) break;
        s = o.s2;
      }
      let G = 0;
      for (let t = moves.length - 1; t >= 0; t--) {
        const m = moves[t], prevG = G, old = V[m.s];
        G = GAMMA * G + m.r;
        if (m.first) { returns[m.s].push(G); V[m.s] = returns[m.s].reduce((p, q) => p + q, 0) / returns[m.s].length; }
        events.push({ kind: "sweep", ep, t, s: m.s, r: m.r, prevG, G, first: m.first, earlier: moves.findIndex((y) => y.s === m.s), old, nu: V[m.s], rets: returns[m.s].slice(), V: V.slice() });
      }
      episodes.push({ moves });
    }
  }
  // The true values of the random policy, from its Bellman equation, for the last slide.
  const vpi = Array(9).fill(0);
  for (let k = 0; k < 300; k++) for (const s of CELLS) vpi[s] = [0, 1, 2, 3].reduce((acc, a) => { const o = stepEnv(s, a); return acc + (o.r + GAMMA * (o.done ? 0 : vpi[o.s2])) / 4; }, 0);
  const X = (i) => events[i], epOf = (i) => episodes[X(i).ep - 1], last = events.length - 1;
  const find = (ep, kind, t) => events.findIndex((x) => x.ep === ep && x.kind === kind && x.t === t);
  const Vof = (t) => `<i>V</i>(${sym("S", t)})`, nw = (x) => `<span class="nowrap">${x}</span>`;

  // The cells the agent has left during an episode, before time to, outlined in dashed blue: the part not yet swept.
  // And the first visits from time from on, which the sweep has updated, outlined in green.
  const trail = (e, to) => e.moves.slice(0, to).map((m) => ({ c: m.s, kind: "step" }));
  const swept = (e, from) => e.moves.slice(from).filter((m) => m.first).map((m) => ({ c: m.s, kind: "upd" }));
  // The state after event i: after a move, the agent where it went and the next move in yellow; in a sweep, the agent at
  // the cookie, the rest of the episode in blue and what the sweep has updated in green.
  function after(i) {
    const x = X(i), e = epOf(i), y = X(i + 1);
    if (x.kind === "move") return { ep: x.ep, move: x.t + 1, time: x.t + 1, at: i, V: x.V, agent: x.s2, marks: trail(e, x.t + 1), pick: y && y.kind === "move" ? [y.s, y.a] : undefined };
    return { ep: x.ep, time: x.t, stage: "after", at: i, V: x.V, agent: GOAL, marks: [...trail(e, x.t), ...swept(e, x.t)] };
  }

  /* Builds: one line of the algorithm per press */

  const pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });
  // Choose: the policy's random pick turns yellow before the agent moves.
  function chooseBuild(i) {
    const x = X(i);
    return { ...pos(i), time: x.t, V: x.V, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], marks: trail(epOf(i), x.t), line: randomPick(x) };
  }
  // Take: the agent moves along the yellow move; no estimate changes. After the first move, choosing and taking share
  // one press.
  function takeBuild(i, withChoice, extra = "") {
    const x = X(i), bump = x.s2 === x.s ? x.a : null;
    return { ...pos(i), time: x.t, V: x.V, agent: x.s2, taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, marks: trail(epOf(i), x.t), line: (withChoice ? randomTake(x) : takeText(x)) + extra };
  }
  const gEq = (x) => `<span class="pt"><i>G</i> ${nw(`← γ<i>G</i> + ${sym("R", x.t + 1)}`)} ${nw(`= 0.9 · ${num(x.prevG)} + ${num(x.r)}`)} ${nw(eqv(x.G))}</span>`;
  // The average of a cell's returns, written out: the return itself while it is the only one.
  const vEq = (x) => (x.rets.length === 1 ? `<span class="upd">${Vof(x.t)}</span> ${nw(`← <span class="pt"><i>G</i></span> ${eqv(x.G)}`)}`
    : `<span class="upd">${Vof(x.t)}</span> ${nw(`← (${x.rets.map((r) => `<span class="pt">${num(r)}</span>`).join(" + ")})/${x.rets.length}`)} ${nw(eqv(x.nu))}`);
  // A step of the sweep that updates its cell: the estimate, in green, takes G as it is computed, in red, or, with
  // earlier returns, their average.
  const upEq = (x) => (x.rets.length > 1 ? vEq(x)
    : `<span class="upd">${Vof(x.t)}</span> ${nw(`← <span class="pt"><i>G</i> = 0.9 · ${num(x.prevG)} + ${num(x.r)}</span>`)} <span class="nowrap pt">${eqv(x.G)}</span>`);
  // A step of the sweep, before its update: its cell still in the blue part, with G computed.
  function gBuild(i, line) {
    const x = X(i), e = epOf(i);
    return { ep: x.ep, time: x.t, stage: "after", at: i, V: X(i - 1).V, agent: GOAL, marks: [...trail(e, x.t + 1), ...swept(e, x.t + 1)], line, eq: gEq(x) };
  }
  // A step of the sweep, after its update: its cell green when this was its first visit.
  const stepBuild = (i, line, eq) => ({ ...after(i), line, eq });

  /* Moments of the run */

  const e1 = episodes[0], T1 = e1.moves.length;
  // The step of episode 1's sweep that skips a cell visited earlier in the episode, and that cell's first visit.
  const skipStep = events.findIndex((x) => x.ep === 1 && x.kind === "sweep" && !x.first);
  const firstVisit = find(1, "sweep", X(skipStep).earlier);
  // Episode 2 reaches the cookie from a cell it first visited earlier: the step of its sweep at that first visit.
  const e2 = episodes[1], e2end = e2.moves.at(-1), e2first = find(2, "sweep", e2.moves.findIndex((m) => m.s === e2end.s));
  // The first long episode, and the last step of its sweep, at A1.
  const longEp = episodes.findIndex((e) => e.moves.length > 30) + 1, longEnd = find(longEp, "sweep", 0);

  /* Slides */

  const slides = [];
  slides.push({ title: tr("Monte Carlo prediction on the cookie grid", "Predicción Monte Carlo en la grilla de la galleta"), builds: [{ ep: 1, move: null, at: -1, time: 0, V: Array(9).fill(0), agent: START, line: tr(
    `All estimates start at 0, with the agent at ${sym("S", 0)} = A1.`,
    `Todas las estimaciones parten en 0, con el agente en ${sym("S", 0)} = A1.`) }] });
  slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
    chooseBuild(0),
    takeBuild(0, false, tr(" No estimate changes: the returns are known only when the episode ends.", " Ninguna estimación cambia: los retornos se conocen solo cuando termina el episodio.")),
  ] });
  // Every move of episode 1, one slide each, choosing and taking in one press.
  for (let t = 1; t < T1 - 1; t++) slides.push({ title: tr(`Move ${t + 1}`, `Movimiento ${t + 1}`), builds: [takeBuild(t, true)] });
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [takeBuild(T1 - 1, true, tr(
    ` The episode ends at <i>T</i> = ${T1}, and no estimate has changed. Now the returns can be computed, from the last move back, starting with <i>G</i> ← 0.`,
    ` El episodio termina en <i>T</i> = ${T1}, y ninguna estimación ha cambiado. Ahora se pueden calcular los retornos, desde el último movimiento hacia atrás, partiendo con <i>G</i> ← 0.`))] });
  {
    const i = find(1, "sweep", T1 - 1), x = X(i), j = find(1, "sweep", T1 - 2), y = X(j);
    slides.push({ title: tr("Back from the cookie", "De vuelta desde la galleta"), builds: [
      gBuild(i, tr(`The sweep starts at <i>t</i> = ${x.t}, in ${cellName(x.s)}, with the move into the cookie.`, `El recorrido parte en <i>t</i> = ${x.t}, en ${cellName(x.s)}, con el movimiento hacia la galleta.`)),
      stepBuild(i, tr(
        `${cellName(x.s)} appears nowhere earlier in the episode, so <i>G</i> is its first return, and its estimate becomes the average of its returns, so far just this one.`,
        `${cellName(x.s)} no aparece antes en el episodio, así que <i>G</i> es su primer retorno, y su estimación pasa a ser el promedio de sus retornos, por ahora solo este.`), vEq(x)),
      stepBuild(j, tr(
        `One step back, <i>t</i> = ${y.t}, ${cellName(y.s)}: <i>G</i> ${eqv(y.G)}, its first return, so its estimate is ${num(y.nu)}.`,
        `Un paso atrás, <i>t</i> = ${y.t}, ${cellName(y.s)}: <i>G</i> ${eqv(y.G)}, su primer retorno, así que su estimación es ${num(y.nu)}.`), upEq(y)),
    ] });
  }
  {
    const x = X(skipStep), f = X(firstVisit), c = cellName(x.s), wall = e1.moves[f.t].s2 === x.s && e1.moves[f.t].s === x.s;
    slides.push({ title: tr("A cell visited twice", "Una celda visitada dos veces"), builds: [
      gBuild(skipStep, tr(
        `At <i>t</i> = ${x.t}, ${c}: <i>G</i> ${eqv(x.G)}. But the agent was in ${c} at <i>t</i> = ${f.t} too${wall ? ", before it hit the wall" : ""}, and first-visit Monte Carlo counts a state only at its first visit in an episode, so this return is skipped.`,
        `En <i>t</i> = ${x.t}, ${c}: <i>G</i> ${eqv(x.G)}. Pero el agente también estuvo en ${c} en <i>t</i> = ${f.t}${wall ? ", antes de chocar con la pared" : ""}, y first-visit Monte Carlo cuenta un estado solo en su primera visita del episodio, así que este retorno se salta.`)),
      stepBuild(firstVisit, tr(
        `<i>t</i> = ${f.t}, ${c} at its first visit: <i>G</i> ${eqv(f.G)}, and that becomes its estimate, not the ${num(x.G)} of <i>t</i> = ${x.t}. Every-visit Monte Carlo would average both.`,
        `<i>t</i> = ${f.t}, ${c} en su primera visita: <i>G</i> ${eqv(f.G)}, y esa pasa a ser su estimación, no el ${num(x.G)} de <i>t</i> = ${x.t}. Every-visit Monte Carlo promediaría ambos.`), upEq(f)),
    ] });
  }
  {
    const i = find(1, "sweep", 0), x = X(i);
    slides.push({ title: tr("Only at the end", "Solo al final"), builds: [stepBuild(i, tr(
      `The sweep reaches <i>t</i> = 0, ${cellName(x.s)}: <i>G</i> ${eqv(x.G)}. The estimates changed only now, after the episode, and all at once: each cell visited holds the return of its first visit, smaller the more moves it was from the cookie. The cells the agent never entered keep 0.`,
      `El recorrido llega a <i>t</i> = 0, ${cellName(x.s)}: <i>G</i> ${eqv(x.G)}. Las estimaciones cambiaron solo ahora, después del episodio, y todas de una vez: cada celda visitada guarda el retorno de su primera visita, menor mientras más movimientos estaba de la galleta. Las celdas donde el agente nunca entró siguen en 0.`), upEq(x))] });
  }
  {
    // Episode 2, played like episode 1: a skip of a few moves would land in the middle of this short episode.
    const m0 = find(2, "move", 0), T2 = e2.moves.length, c0 = chooseBuild(m0);
    slides.push({ title: tr("Episode 2", "Episodio 2"), builds: [{ ...c0, line: tr("A new episode starts at A1. ", "Un nuevo episodio parte en A1. ") + c0.line }, takeBuild(m0, false)] });
    for (let t = 1; t < T2 - 1; t++) slides.push({ title: tr(`Move ${t + 1}`, `Movimiento ${t + 1}`), builds: [takeBuild(find(2, "move", t), true)] });
    slides.push({ title: tr("Episode 2 ends", "Termina el episodio 2"), builds: [takeBuild(find(2, "move", T2 - 1), true, tr(
      ` The episode ends at <i>T</i> = ${T2}, and the sweep back begins.`, ` El episodio termina en <i>T</i> = ${T2}, y empieza el recorrido hacia atrás.`))] });
    // The sweep down to the first visit of the cell the episode ended from: later visits skipped, first visits updated.
    const back = [];
    for (let t = T2 - 1; t > X(e2first).t; t--) {
      const k = find(2, "sweep", t), y = X(k), c = cellName(y.s);
      back.push(!y.first ? gBuild(k, tr(`<i>t</i> = ${y.t}, ${c}: <i>G</i> ${eqv(y.G)}, skipped, since the agent was first in ${c} at <i>t</i> = ${y.earlier}.`, `<i>t</i> = ${y.t}, ${c}: <i>G</i> ${eqv(y.G)}, que se salta, porque el agente estuvo en ${c} por primera vez en <i>t</i> = ${y.earlier}.`))
        : stepBuild(k, y.rets.length === 1 ? tr(`<i>t</i> = ${y.t}, ${c} at its first visit: <i>G</i> ${eqv(y.G)}, its first return.`, `<i>t</i> = ${y.t}, ${c} en su primera visita: <i>G</i> ${eqv(y.G)}, su primer retorno.`)
          : tr(`<i>t</i> = ${y.t}, ${c} at its first visit: <i>G</i> ${eqv(y.G)}, averaged with its other returns.`, `<i>t</i> = ${y.t}, ${c} en su primera visita: <i>G</i> ${eqv(y.G)}, promediado con sus otros retornos.`), upEq(y)));
    }
    slides.push({ title: tr("Back from the cookie, again", "De vuelta desde la galleta, otra vez"), builds: back });
    const x = X(e2first), c = cellName(x.s), away = [...new Set(e2.moves.slice(x.t, -1).map((m) => m.s2).filter((s) => s !== e2end.s))].map(cellName);
    slides.push({ title: tr("A second return", "Un segundo retorno"), builds: [stepBuild(e2first, tr(
      `<i>t</i> = ${x.t}, ${c} at its first visit, before the detour through ${listAnd(away)}: <i>G</i> ${eqv(x.G)}, ${c}'s second return, and its estimate is now the average of the two.`,
      `<i>t</i> = ${x.t}, ${c} en su primera visita, antes del desvío por ${listAnd(away)}: <i>G</i> ${eqv(x.G)}, el segundo retorno de ${c}, y su estimación es ahora el promedio de ambos.`), vEq(x))] });
  }
  {
    const x = X(longEnd), n = episodes[longEp - 1].moves.length;
    slides.push({ title: tr("A long episode", "Un episodio largo"), builds: [stepBuild(longEnd, tr(
      `Episode ${longEp} wanders for ${n} moves before reaching the cookie, so its returns are small: ${cellName(x.s)}'s is only about ${num(x.G)}, and its average falls from ${num(x.old)} to ${num(x.nu)}. Single returns vary a lot, and an average needs many of them to settle.`,
      `El episodio ${longEp} deambula ${n} movimientos antes de llegar a la galleta, así que sus retornos son pequeños: el de ${cellName(x.s)} es de apenas unos ${num(x.G)}, y su promedio baja de ${num(x.old)} a ${num(x.nu)}. Los retornos sueltos varían mucho, y un promedio necesita muchos para asentarse.`), vEq(x))] });
  }
  {
    const x = X(last), Vf = x.V, gap = (s) => Math.abs(Vf[s] - vpi[s]), c = CELLS.reduce((m, s) => (gap(s) > gap(m) ? s : m));
    const counts = Array(9).fill(0), n = (s) => counts[s];
    events.forEach((y) => { if (y.kind === "sweep" && y.first) counts[y.s]++; });
    const fewest = CELLS.reduce((m, s) => (n(s) < n(m) ? s : m)), moves = events.filter((y) => y.kind === "move").length;
    // The route the estimates lead along from A1, drawn as a band.
    const route = valuePath(Vf, GAMMA), len = route ? route.length - 1 : 0;
    const band = !route ? "" : tr(` The band follows the estimates from A1, taking in each cell the move with the largest reward plus 0.9 times the next cell's estimate: ${len} moves to the cookie${len === 4 ? ", the shortest route" : ""}.`,
      ` La banda sigue las estimaciones desde A1, tomando en cada celda el movimiento con la mayor recompensa más 0.9 veces la estimación de la celda siguiente: ${len} movimientos hasta la galleta${len === 4 ? ", la ruta más corta" : ""}.`);
    slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...stepBuild(last, tr(
      `After ${moves} moves, each estimate is the average of its cell's first-visit returns: ${n(START)} for A1, one from every episode, and ${n(fewest)} for ${cellName(fewest)}, the fewest. They still miss the random policy's true values by up to ${num(gap(c))}, in ${cellName(c)}: ${num(Vf[c])} against ${num(vpi[c])}.`,
      `Tras ${moves} movimientos, cada estimación es el promedio de los retornos first-visit de su celda: ${n(START)} para A1, uno de cada episodio, y ${n(fewest)} para ${cellName(fewest)}, la que menos tiene. Todavía se alejan de los valores verdaderos de la política al azar hasta en ${num(gap(c))}, en ${cellName(c)}: ${num(Vf[c])} contra ${num(vpi[c])}.`) + band), eq: null, marks: [], route }] });
  }
  // How far each slide jumps ahead of the one before it: the moves it skips, or the steps of a sweep.
  for (let i = 1; i < slides.length; i++) {
    const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
    if (gap <= 1) continue;
    // The events skipped, counting the one the slide shows, as the control figure below counts them.
    const between = events.slice(from + 1, to + 1), sm = between.filter((x) => x.kind === "move").length, ss = between.length - sm;
    const epFrom = from >= 0 ? X(from).ep + (X(from).kind === "sweep" && X(from).t === 0 ? 1 : 0) : 1, epTo = X(to).ep;
    const text = sm ? tr(`${sm} moves later`, `${sm} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "")
      : tr(`The sweep goes on to <i>t</i> = ${X(to).t}`, `El recorrido sigue hasta <i>t</i> = ${X(to).t}`);
    const oneEp = between.every((x) => x.ep === between[0].ep);
    const note = sm && ss ? (oneEp ? tr(`${sm} moves go by, then the sweep back begins.`, `Pasan ${sm} movimientos, y luego empieza el recorrido hacia atrás.`) : tr(`${sm} moves go by, each episode followed by its sweep back.`, `Pasan ${sm} movimientos, cada episodio seguido de su recorrido hacia atrás.`))
      : sm ? tr(`${sm} moves go by, and no estimate changes.`, `Pasan ${sm} movimientos, y ninguna estimación cambia.`)
      : tr(`The sweep goes back ${ss} steps.`, `El recorrido retrocede ${ss} pasos.`);
    slides[i].skip = { from, to, moves: gap, text, note };
  }

  slideshow({ svg: document.getElementById("fig-pred"), slides, frame: (m) => ({ ...after(m), bumpPose: shake(X(m), m) }), world: cookie, perCell: true });
}

/* ---------- Section 4: on-policy first-visit Monte Carlo control on the cookie grid ---------- */

// ε = 0.1 and γ = 0.9, every value 0 at first, ties broken at random, each value the average of its first-visit
// returns. With this seed, episode 1 wanders 8 moves with a loop; after its sweep the best moves already reach the cookie
// in 6 moves, and in episode 9 a random first move finds the shortest route, 4 moves, which they keep to the end.
const EPS = 0.1, GAMMA = 0.9, SEED = 28869, EPISODES = 30;
const { START, GOAL, cellName, moveName, stepEnv, freshQ, reason, takeText, chooseTakeText } = cookie;
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
  return { ...pos(i), time: x.t, Q: x.Q, agent: x.s2, taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, marks: trail(epOf(i), x.t), line: takeText(x) + extra };
}
// Choose and take in one press, for the moves of episode 1 after the second.
const moveBuild = (i, extra = "") => { const x = X(i); return { ...takeBuild(i), line: chooseTakeText(x.Q[x.s], x.explored, x) + extra }; };
const gEq = (x) => `<span class="pt"><i>G</i> <span class="nowrap">← γ<i>G</i> + ${sym("R", x.t + 1)}</span> <span class="nowrap">= 0.9 · ${num(x.prevG)} + ${num(x.r)}</span> <span class="nowrap">${eqv(x.G)}</span></span>`;
const qEq = (x) => `<span class="upd"><i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)})</span> <span class="nowrap">← ${num(x.old)} + [<span class="pt">${num(x.G)}</span> − ${num(x.old)}]/${x.n}</span> <span class="nowrap">${eqv(x.nu)}</span>`;
// A step of the sweep that updates its pair with a first return: the value, in green, takes G as it is computed, in red.
const upEq = (x) => (x.n > 1 ? qEq(x)
  : `<span class="upd"><i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)})</span> <span class="nowrap">← <span class="pt"><i>G</i> = 0.9 · ${num(x.prevG)} + ${num(x.r)}</span></span> <span class="nowrap pt">${eqv(x.G)}</span>`);
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
// The step after which the best moves reach the cookie in 4 moves, and the move of that episode that made it possible.
let shortcut = null;
events.forEach((x, i) => { if (x.kind === "sweep") { const p = route(x.Q); if (p && p.length === 5 && !(route(X(i - 1).Q)?.length === 5)) shortcut = i; } });
const sc = X(shortcut), scFirstMove = find(sc.ep, "move", 0);

/* ---------- Slides ---------- */

const slides = [];
slides.push({ title: tr("Monte Carlo control on the cookie grid", "Control Monte Carlo en la grilla de la galleta"), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: freshQ(), agent: START, line: tr(
  `All values start at 0. The agent stands at ${sym("S", 0)} = A1.`,
  `Todos los valores parten en 0. El agente está en ${sym("S", 0)} = A1.`) }] });
slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
  chooseBuild(0, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")),
  takeBuild(0),
] });
slides.push({ title: tr("Move 2", "Movimiento 2"), builds: [
  chooseBuild(1, tr("It chooses its next move from the same table.", "Elige su siguiente movimiento con la misma tabla.")),
  takeBuild(1),
] });
// The other moves of episode 1, one slide each, choosing and taking in one press.
for (let t = 2; t < T1 - 1; t++) slides.push({ title: tr(`Move ${t + 1}`, `Movimiento ${t + 1}`), builds: [moveBuild(t)] });
slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [moveBuild(T1 - 1, tr(
  ` The episode ends at <i>T</i> = ${T1}, and the sweep back begins, now updating the value of each move.`,
  ` El episodio termina en <i>T</i> = ${T1}, y empieza el recorrido hacia atrás, que ahora actualiza el valor de cada movimiento.`))] });
{
  const i = find(1, "sweep", T1 - 1), x = X(i), j = find(1, "sweep", T1 - 2), y = X(j);
  slides.push({ title: tr("Back from the cookie", "De vuelta desde la galleta"), builds: [
    stepBuild(i, tr(
      `The sweep starts at <i>t</i> = ${x.t}, with the move into the cookie, ${moveName(x.s, x.a)}: its first return, <i>G</i> = 1, enters its average, computed as you go.`,
      `El recorrido parte en <i>t</i> = ${x.t}, con el movimiento hacia la galleta, ${moveName(x.s, x.a)}: su primer retorno, <i>G</i> = 1, entra en su promedio, calculado sobre la marcha.`), qEq(x)),
    stepBuild(j, tr(
      `One step back, <i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, its first return, so its value is ${num(y.nu)}.`,
      `Un paso atrás, <i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, su primer retorno, así que su valor es ${num(y.nu)}.`), upEq(y)),
  ] });
}
{
  const x = X(skipStep), f = X(firstVisit), mid = [];
  for (let t = x.t - 1; t > f.t; t--) mid.push(find(1, "sweep", t));
  slides.push({ title: tr("A move made twice", "Un movimiento repetido"), builds: [
    gBuild(skipStep, tr(
      `At <i>t</i> = ${x.t}, ${moveName(x.s, x.a)}: <i>G</i> ${eqv(x.G)}. The agent made this same move at <i>t</i> = ${f.t}, and a pair, like a state, counts only at its first visit, so this return is skipped.`,
      `En <i>t</i> = ${x.t}, ${moveName(x.s, x.a)}: <i>G</i> ${eqv(x.G)}. El agente hizo este mismo movimiento en <i>t</i> = ${f.t}, y un par, igual que un estado, cuenta solo en su primera visita, así que este retorno se salta.`)),
    ...mid.map((i) => { const y = X(i); return stepBuild(i, tr(
      `<i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, its first return.`,
      `<i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, su primer retorno.`), upEq(y)); }),
    stepBuild(firstVisit, tr(
      `<i>t</i> = ${f.t}, ${moveName(f.s, f.a)} at its first visit: <i>G</i> ${eqv(f.G)}, and that is its value, not the ${num(x.G)} of <i>t</i> = ${x.t}.`,
      `<i>t</i> = ${f.t}, ${moveName(f.s, f.a)} en su primera visita: <i>G</i> ${eqv(f.G)}, y ese es su valor, no el ${num(x.G)} de <i>t</i> = ${x.t}.`), upEq(f)),
  ] });
}
{
  const i = find(1, "sweep", 0), Q = X(i).Q, p = route(Q), loop = e1.moves.find((m) => !m.first), c = loop.s2;
  const best = Q[c].indexOf(Math.max(...Q[c])), others = [0, 1, 2, 3].filter((a) => a !== best && Q[c][a] > 0);
  const vs = others.map((a) => `${NAME[a]} (${num(Q[c][a])})`), rest = [];
  // The steps between the pair's first visit and t = 0, one press each.
  for (let t = X(firstVisit).t - 1; t > 0; t--) { const k = find(1, "sweep", t), y = X(k); rest.push(stepBuild(k, tr(
    `<i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, its first return.`,
    `<i>t</i> = ${y.t}, ${moveName(y.s, y.a)}: <i>G</i> ${eqv(y.G)}, su primer retorno.`), upEq(y))); }
  slides.push({ title: tr("The loop is cut", "Se corta el bucle"), builds: [...rest, { ...stepBuild(i, tr(
    `The sweep reaches <i>t</i> = 0, and each move of the episode holds its return. In ${cellName(c)}, ${NAME[best]} (${num(Q[c][best])}) beats ${listAnd(vs)}, so the best moves cut out the loop and reach the cookie from A1 in ${p.length - 1} moves.`,
    `El recorrido llega a <i>t</i> = 0, y cada movimiento del episodio tiene su retorno. En ${cellName(c)}, ${NAME[best]} (${num(Q[c][best])}) le gana a ${listAnd(vs)}, así que los mejores movimientos cortan el bucle y llegan a la galleta desde A1 en ${p.length - 1} movimientos.`), upEq(X(i))), route: p }] });
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

slideshow({ svg: document.getElementById("fig-mc"), slides, frame: (m) => ({ ...after(m), bumpPose: shake(X(m), m) }), world: cookie });
