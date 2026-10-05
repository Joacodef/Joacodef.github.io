import { tr } from "../../plane.js";
import { cookie, NAME, rngFrom, epsGreedy, num, eqv, listAnd, sym, slideshow } from "./gridworld.js";

const { START, GOAL, W, H, cellName, moveName, stepEnv, freshQ, reason, takeText, chooseTakeText } = cookie;
const GAMMA = 0.9, CELLS = [...Array(W * H).keys()].filter((s) => s !== GOAL);
const copy = (M) => M.map((r) => r.slice());
// Moves as [cell, action] pairs, each once.
const uniq = (pairs) => [...new Map(pairs.map(([c, a]) => [c * 4 + a, [c, a]])).values()];
// Builds that skip moves say how many, counting moves in the whole run, as the other figures do.
function addSkips(slides, X) {
  for (let i = 1; i < slides.length; i++) {
    const from = slides[i - 1].builds.at(-1).at, to = slides[i].builds[0].at, gap = to - from;
    if (gap <= 1) continue;
    const epFrom = from >= 0 ? X(from).ep + (X(from).done ? 1 : 0) : 1, epTo = X(to).ep;
    slides[i].skip = { from, to, moves: gap, text: tr(`${gap} moves later`, `${gap} movimientos después`) + (epTo !== epFrom ? tr(`, in episode ${epTo}`, `, en el episodio ${epTo}`) : "") };
  }
}

/* ---------- Section 2: R-Max on the cookie grid ---------- */

// k = 1, since a move on the grid always does the same thing; Rmax = 1, the cookie's reward; γ = 0.9. The agent acts
// greedily on the values value iteration gives, ties broken at random. This seed's first episode makes 8 moves, the
// first into a wall; episodes 2 and 3 try every move still untried, and from episode 4 on every trip takes 4 moves.
{
  const K = 1, RMAX = 1, SEED = 210, EPISODES = 5;
  // The value of move a in s under V: an unknown move gives rmax and ends the episode; a known one leads to s′ with
  // reward r with probability N(s, a, s′, r)/N(s, a), the counts kept in Np[s][a] as "s′ r" → count.
  const moveValue = (N, Np, V, s, a, rmax) => {
    if (N[s][a] < K) return rmax;
    let v = 0;
    for (const [key, c] of Np[s][a]) { const [s2, r] = key.split(" ").map(Number); v += (c / N[s][a]) * (r + (s2 === GOAL ? 0 : GAMMA * V[s2])); }
    return v;
  };
  // Value iteration on that model, from V = 0 until no value changes, then the value of every move. Values are rounded
  // so that equal ones tie exactly. With rmax = 0, an untried move is worth nothing: the values of what is known.
  function solve(N, Np, rmax = RMAX) {
    let V = Array(W * H).fill(0);
    for (let sweep = 0; sweep < 1000; sweep++) {
      const V2 = V.map((_, s) => (s === GOAL ? 0 : Math.max(...[0, 1, 2, 3].map((a) => moveValue(N, Np, V, s, a, rmax)))));
      const still = V2.every((v, s) => Math.abs(v - V[s]) < 1e-12);
      V = V2;
      if (still) break;
    }
    const round = (v) => Math.round(v * 1e12) / 1e12;
    return { V: V.map(round), Q: Array.from({ length: W * H }, (_, s) => (s === GOAL ? [0, 0, 0, 0] : [0, 1, 2, 3].map((a) => round(moveValue(N, Np, V, s, a, rmax))))) };
  }
  const unknownOf = (N) => CELLS.flatMap((s) => [0, 1, 2, 3].filter((a) => N[s][a] < K).map((a) => [s, a]));

  // The whole run: for each move, the values it was chosen from (Q, V) and those value iteration gives once it is
  // counted (Q2, V2), with the moves unknown before and after; at the end of an episode, the values of known moves only.
  const steps = [];
  {
    const rnd = rngFrom(SEED), N = freshQ(), Np = Array.from({ length: W * H }, () => [0, 1, 2, 3].map(() => new Map()));
    let sol = solve(N, Np);
    for (let ep = 1; ep <= EPISODES; ep++) {
      let s = START, t = 0;
      while (true) {
        const q = sol.Q[s], m = Math.max(...q), ties = [0, 1, 2, 3].filter((b) => q[b] === m);
        const a = ties[Math.floor(rnd() * ties.length)], o = stepEnv(s, a), unknown = unknownOf(N);
        N[s][a]++;
        const key = `${o.s2} ${o.r}`;
        Np[s][a].set(key, (Np[s][a].get(key) || 0) + 1);
        const sol2 = solve(N, Np);
        steps.push({ ep, t, s, a, ...o, Q: sol.Q, V: sol.V, Q2: sol2.Q, V2: sol2.V, unknown, unknown2: unknownOf(N), newly: N[s][a] === K, known: o.done ? solve(N, Np, 0) : null });
        sol = sol2;
        if (o.done) break;
        s = o.s2; t++;
      }
    }
  }
  const X = (i) => steps[i], last = steps.length - 1, pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });
  const epStart = (e) => steps.findIndex((x) => x.ep === e), epLen = (e) => steps.filter((x) => x.ep === e).length;
  const T1 = epLen(1);
  const lastNew = steps.reduce((j, x, i) => (x.newly ? i : j), -1);

  // What value iteration changed after move i, in green: the move just counted, and every value that moved.
  const changed = (i) => { const x = X(i), out = []; for (const s of CELLS) for (let a = 0; a < 4; a++) if (x.Q2[s][a] !== x.Q[s][a] || (s === x.s && a === x.a)) out.push({ c: s, a, kind: "upd" }); return out; };
  // The best moves of the cell the counted move leads to, whose value its new value uses, in red.
  const usedBy = (i) => { const x = X(i); if (x.done) return []; const q = x.Q2[x.s2], m = Math.max(...q); return [0, 1, 2, 3].filter((a) => q[a] === m).map((a) => ({ c: x.s2, a, kind: "tg" })); };
  const nm = (x) => `${cellName(x.s)}, ${NAME[x.a]}`;
  // The new value of the move just counted: its reward plus 0.9 times the value of where it leads.
  const viEq = (x) => (x.done
    ? `<span class="upd"><i>Q</i>(${nm(x)})</span> <span class="nowrap">= <span class="pt">${num(x.r)}</span></span>`
    : `<span class="upd"><i>Q</i>(${nm(x)})</span> <span class="nowrap">= <span class="pt">${num(x.r)} + γ<i>V</i>(${cellName(x.s2)})</span></span> <span class="nowrap">= ${num(x.r)} + 0.9 · ${num(x.V2[x.s2])}</span> <span class="nowrap">${eqv(x.Q2[x.s][x.a])}</span>`);
  // Cells whose value value iteration lowered, as "V(A1) to 0.9".
  const drops = (x) => CELLS.filter((s) => x.V2[s] !== x.V[s]).map((s) => tr(`<i>V</i>(${cellName(s)}) to ${num(x.V2[s])}`, `<i>V</i>(${cellName(s)}) a ${num(x.V2[s])}`));
  // What value iteration gives the move just counted, in words: where it leads and what that cell is worth.
  function valueText(x) {
    if (x.done) return tr(`Now known, ${moveName(x.s, x.a)} is worth 1 for real: the cookie's reward, with nothing after it, no longer the 1 R-Max assumed.`, `Ahora <i>known</i>, ${moveName(x.s, x.a)} vale 1 de verdad: la recompensa de la galleta, sin nada después, y ya no el 1 que R-Max suponía.`);
    const untried = x.Q2[x.s2].some((v, a) => x.unknown2.some(([c, b]) => c === x.s2 && b === a) && v === x.V2[x.s2]);
    const there = untried ? tr(`still has untried moves, outlined in red, worth 1`, `todavía tiene movimientos sin probar, con borde rojo, que valen 1`) : tr(`is worth ${num(x.V2[x.s2])}, the value of its best moves, outlined in red`, `vale ${num(x.V2[x.s2])}, el valor de sus mejores movimientos, con borde rojo`);
    const d = drops(x);
    return tr(`Now known, ${moveName(x.s, x.a)} is valued by where it leads: ${x.s2 === x.s ? "back to " : ""}${cellName(x.s2)}, which ${there}.`, `Ahora <i>known</i>, ${moveName(x.s, x.a)} se valora según adónde lleva: ${x.s2 === x.s ? "de vuelta a " : ""}${cellName(x.s2)}, que ${there}.`)
      + (d.length ? tr(` Value iteration also lowers ${listAnd(d)}.`, ` Value iteration también baja ${listAnd(d)}.`) : "");
  }

  /* ---------- Builds: one line of the algorithm per press ---------- */

  // Choose A greedily from the values: the move turns yellow before the agent moves.
  const chooseBuild = (i, lead) => { const x = X(i); return { ...pos(i), time: x.t, Q: x.Q, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], unknown: x.unknown, line: `${lead} ${reason(x.Q[x.s], false, x.s, x.a, x.t)}` }; };
  // Take A, and see R and S′.
  const takeBuild = (i) => { const x = X(i), bump = x.s2 === x.s ? x.a : null; return { ...pos(i), time: x.t, Q: x.Q, agent: x.s2, taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, unknown: x.unknown, line: takeText(x) }; };
  // Count it: the move is outlined in green, still shaded until value iteration runs on the new model.
  const countBuild = (i, line, eq) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.Q, agent: x.s2, unknown: x.unknown, marks: [{ c: x.s, a: x.a, kind: "upd" }], line, eq }; };
  // Value iteration on the new model: the shade lifts from the move, and what changed is outlined in green.
  const viBuild = (i, line, eq) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.Q2, agent: x.s2, unknown: x.unknown2, marks: [...usedBy(i), ...changed(i)], line, eq: eq ?? viEq(x) }; };
  // A whole move in one press: chosen, taken, counted, and valued by value iteration.
  const moveBuild = (i, extra = "") => { const x = X(i), tk = takeBuild(i); return { ...viBuild(i, ""), taken: tk.taken, bump: tk.bump, sound: tk.sound, line: `${chooseTakeText(x.Q[x.s], false, x)} ${valueText(x)}${extra}` }; };
  const pEq = (x) => `<i>P</i>(${cellName(x.s2)}, ${num(x.r)} | ${nm(x)}) <span class="nowrap">= <span class="frac"><span><i>N</i>(${nm(x)}, ${cellName(x.s2)}, ${num(x.r)})</span><span><i>N</i>(${nm(x)})</span></span></span> <span class="nowrap">= <span class="frac"><span>1</span><span>1</span></span> = 1</span>`;

  /* ---------- Slides ---------- */

  const slides = [];
  slides.push({ title: tr("R-Max on the cookie grid", "R-Max en la grilla de la galleta"), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: X(0).Q, agent: START, unknown: X(0).unknown, line: tr(
    `Every count starts at 0, so every move is unknown, shaded, and value iteration gives each one <i>R</i><sub>max</sub> = 1, as much as the cookie. The agent stands at ${sym("S", 0)} = A1.`,
    `Todos los conteos parten en 0, así que todo movimiento es <i>unknown</i>, sombreado, y value iteration le da a cada uno <i>R</i><sub>max</sub> = 1, tanto como la galleta. El agente está en ${sym("S", 0)} = A1.`),
    eq: tr(`<i>Q</i>(<i>s</i>, <i>a</i>) = <i>R</i><sub>max</sub> = 1 for every move`, `<i>Q</i>(<i>s</i>, <i>a</i>) = <i>R</i><sub>max</sub> = 1 para todo movimiento`) }] });
  {
    const x = X(0);
    slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
      chooseBuild(0, tr("The agent chooses greedily from these values.", "El agente elige de forma greedy con estos valores.")),
      takeBuild(0),
      countBuild(0, tr(
        `It counts what happened: one visit to ${moveName(x.s, x.a)}, which led to ${cellName(x.s2)} with reward ${num(x.r)}. One visit is <i>k</i>, so the move is known now, and the model says where it leads, with probability 1.`,
        `Cuenta lo que pasó: una visita a ${moveName(x.s, x.a)}, que llevó a ${cellName(x.s2)} con recompensa ${num(x.r)}. Una visita es <i>k</i>, así que el movimiento ya es <i>known</i>, y el modelo dice adónde lleva, con probabilidad 1.`), pEq(x)),
      viBuild(0, tr(`Value iteration runs on the new model. ${valueText(x)}`, `Value iteration corre sobre el nuevo modelo. ${valueText(x)}`)),
    ] });
  }
  for (const i of [1, 2]) {
    const x = X(i);
    slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [
      chooseBuild(i, tr("It chooses its next move from the new values.", "Elige su siguiente movimiento con los nuevos valores.")),
      takeBuild(i),
      countBuild(i, tr(`It counts the move, which is known now: the model says it leads to ${cellName(x.s2)}, with reward ${num(x.r)}.`, `Cuenta el movimiento, que ya es <i>known</i>: el modelo dice que lleva a ${cellName(x.s2)}, con recompensa ${num(x.r)}.`),
        `<i>N</i>(${nm(x)}) = 1 = <i>k</i>`),
      viBuild(i, tr(`Value iteration runs again. ${valueText(x)}`, `Value iteration corre de nuevo. ${valueText(x)}`)),
    ] });
  }
  // The rest of episode 1, one press per move.
  for (let i = 3; i < T1 - 1; i++) slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [moveBuild(i)] });
  slides.push({ title: tr("Episode 1 ends", "Termina el episodio 1"), builds: [moveBuild(T1 - 1, tr(` The episode ends at <i>T</i> = ${T1}.`, ` El episodio termina en <i>T</i> = ${T1}.`))] });
  {
    // Episode 2's first move: a known way to the cookie, passed up for untried moves. The way's first move is valued
    // higher than the way itself, since the cell it leads to still has untried moves.
    const i = epStart(2), x = X(i), known = X(i - 1).known, kv = known.V[START], d = Math.round(Math.log(kv) / Math.log(GAMMA)) + 1;
    const unknownAt = (c, a) => x.unknown.some(([u, b]) => u === c && b === a);
    const open = [0, 1, 2, 3].filter((a) => unknownAt(START, a)).map((a) => NAME[a]);
    const first = [0, 1, 2, 3].filter((a) => !unknownAt(START, a)).reduce((b, a) => (known.Q[START][a] > known.Q[START][b] ? a : b));
    const next = stepEnv(START, first).s2, higher = x.Q[START][first] > kv && [0, 1, 2, 3].some((a) => unknownAt(next, a));
    const why = higher ? tr(` R-Max values ${NAME[first]} at ${num(x.Q[START][first])} instead, since it leads to ${cellName(next)}, which still has untried moves, and ${listAnd(open)} in A1 are untried themselves, worth 1.`,
      ` R-Max valora ${NAME[first]} en ${num(x.Q[START][first])}, en cambio, porque lleva a ${cellName(next)}, que todavía tiene movimientos sin probar, y ${listAnd(open)} en A1 siguen sin probar, y valen 1.`)
      : tr(` But ${listAnd(open)} in A1 are still untried, worth 1.`, ` Pero ${listAnd(open)} en A1 siguen sin probar, y valen 1.`);
    slides.push({ title: tr("The cookie can wait", "La galleta puede esperar"), builds: [
      chooseBuild(i, tr(`A new episode starts at A1. Through moves it already knows, the cookie is ${d} moves away, worth 0.9<sup>${d - 1}</sup> ${eqv(kv)}.${why}`,
        `Un nuevo episodio parte en A1. Por movimientos que ya conoce, la galleta está a ${d} movimientos, y vale 0.9<sup>${d - 1}</sup> ${eqv(kv)}.${why}`)),
      { ...moveBuild(i), line: `${takeText(x)} ${valueText(x)}` },
    ] });
  }
  {
    // The values along a shortest route from A1: 0.9 to the power of the moves still to come after each.
    const x = X(lastNew), along = [3, 2, 1, 0].map((k) => num(GAMMA ** k));
    if (Math.abs(x.V2[START] - GAMMA ** 3) > 1e-9) console.warn("R-Max figure: A1 is not at its optimal value once every move is known");
    slides.push({ title: tr("Nothing left untried", "Nada sin probar"), builds: [moveBuild(lastNew, tr(
      ` That was the last untried move. With every move known, the model is the grid itself, and value iteration gives the values of the best behavior: along every shortest route from A1, the moves are worth ${listAnd(along)}, the returns of the shortest trip.`,
      ` Ese era el último movimiento sin probar. Con todos los movimientos <i>known</i>, el modelo es la grilla misma, y value iteration da los valores de la mejor conducta: a lo largo de toda ruta más corta desde A1, los movimientos valen ${listAnd(along)}, los retornos del viaje más corto.`))] });
  }
  {
    // The route of the last episode, a shortest one; every episode after the last untried move takes as many moves.
    const e = X(last).ep, route = [...steps.filter((x) => x.ep === e).map((x) => x.s), GOAL], n = X(lastNew).ep;
    if (steps.some((x) => x.ep > n && x.done && x.t + 1 !== route.length - 1)) console.warn("R-Max figure: a trip after the last untried move is not a shortest one");
    const lens = Array.from({ length: n }, (_, j) => String(epLen(j + 1)));
    slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...pos(last), time: X(last).t + 1, Q: X(last).Q2, agent: GOAL, unknown: X(last).unknown2, route, line: tr(
      `Since episode ${n + 1}, every trip has taken ${route.length - 1} moves, a shortest route, and every later one would too: nothing is unknown, so R-Max never explores again. It took the first ${n} episodes, ${listAnd(lens)} moves long, to try all ${CELLS.length * 4} moves.`,
      `Desde el episodio ${n + 1}, cada viaje ha tomado ${route.length - 1} movimientos, una ruta más corta, y todo viaje posterior también lo haría: nada es <i>unknown</i>, así que R-Max no vuelve a explorar. Le tomó los primeros ${n} episodios, de ${listAnd(lens)} movimientos, probar los ${CELLS.length * 4} movimientos.`) }] });
  }
  addSkips(slides, X);

  slideshow({
    svg: document.getElementById("fig-rmax"),
    slides,
    world: cookie,
    // The state after move m, for the frames of a skip: the move just counted in green, the next one in yellow.
    frame: (m) => {
      const x = X(m), y = m < last ? X(m + 1) : null;
      return { Q: x.Q2, agent: x.done ? GOAL : x.s2, ep: x.ep, move: x.t + 1, time: x.t + 1, unknown: x.unknown2, marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
    },
  });
}

/* ---------- Section 3: Dyna-Q on the cookie grid ---------- */

// α = 0.5, ε = 0.1, γ = 0.9 and n = 10 planning steps after every move, ties broken at random; one random stream serves
// acting and planning. This seed's first episode wanders 8 moves, around a loop, to the cookie; the ten planning steps
// after its last move already give a shortest route from A1, which the best moves keep to the end of the run.
{
  const ALPHA = 0.5, EPS = 0.1, NPLAN = 10, SEED = 6350, EPISODES = 30;
  // The whole run: for each move, the values before it, after its direct update and after each planning step, and the
  // moves the model holds after it.
  const steps = [];
  {
    const rnd = rngFrom(SEED), Q = freshQ(), model = new Map(), seen = [], taken = new Map();
    for (let ep = 1; ep <= EPISODES; ep++) {
      let s = START, t = 0;
      while (true) {
        const pre = copy(Q), c = epsGreedy(Q, s, EPS, rnd), o = stepEnv(s, c.a);
        const maxNext = o.done ? 0 : Math.max(...Q[o.s2]), old = Q[s][c.a];
        Q[s][c.a] = old + ALPHA * (o.r + GAMMA * maxNext - old);
        const direct = { old, nu: Q[s][c.a], maxNext, Q: copy(Q) };
        model.set(s * 4 + c.a, { r: o.r, s2: o.s2, done: o.done });
        if (!taken.has(s)) { taken.set(s, []); seen.push(s); }
        if (!taken.get(s).includes(c.a)) taken.get(s).push(c.a);
        // Planning: a state seen before, a move taken there before, the model's answer, and the same update.
        const plans = [];
        for (let k = 0; k < NPLAN; k++) {
          const ps = seen[Math.floor(rnd() * seen.length)], acts = taken.get(ps), pa = acts[Math.floor(rnd() * acts.length)];
          const m = model.get(ps * 4 + pa), before = copy(Q), mx = m.done ? 0 : Math.max(...Q[m.s2]), po = Q[ps][pa];
          Q[ps][pa] = po + ALPHA * (m.r + GAMMA * mx - po);
          plans.push({ s: ps, a: pa, r: m.r, s2: m.s2, done: m.done, old: po, nu: Q[ps][pa], maxNext: mx, before, Q: copy(Q) });
        }
        steps.push({ ep, t, s, a: c.a, explored: c.explored, ...o, pre, direct, plans, inModel: new Set(model.keys()), post: copy(Q) });
        if (o.done) break;
        s = o.s2; t++;
      }
    }
  }
  const X = (i) => steps[i], last = steps.length - 1, pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i });
  const epStart = (e) => steps.findIndex((x) => x.ep === e), epEnd = (e) => steps.findIndex((x) => x.ep === e && x.done);
  const T1 = epEnd(1) + 1;
  const shownBefore = (i) => (i > 0 ? X(i - 1).inModel : new Set());
  const agentAfter = (x) => (x.done ? GOAL : x.s2);
  // The cells the best moves lead through from A1 while each cell has a move worth more than 0, or null.
  function route(Q) {
    let s = START; const p = [s];
    for (let k = 0; k < W * H; k++) {
      const m = Math.max(...Q[s]); if (m <= 0) return null;
      const n = stepEnv(s, Q[s].indexOf(m)).s2; if (n === s || p.includes(n)) return null;
      p.push(n); if (n === GOAL) return p; s = n;
    }
    return null;
  }
  // The best moves of the state a target looks at, from the values before the update, in red.
  const tgOf = (Q, s2, done) => { if (done) return []; const q = Q[s2], m = Math.max(...q); return [0, 1, 2, 3].filter((a) => q[a] === m).map((a) => ({ c: s2, a, kind: "tg" })); };
  // An update: the value in green moves halfway toward the target in red. On a phone the line can break before the
  // subtraction.
  const updEq = (lhs, r, mx, done, old, nu) => `<span class="upd">${lhs}</span> <span class="nowrap">← ${num(old)} + ${ALPHA}[<span class="pt">${num(r)}${done ? "" : ` + 0.9 · ${num(mx)}`}</span></span> <span class="nowrap">− ${num(old)}]</span> <span class="nowrap">${eqv(nu)}</span>`;
  const directEq = (x) => updEq(`<i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)})`, x.r, x.direct.maxNext, x.done, x.direct.old, x.direct.nu);
  const planEq = (p) => updEq(`<i>Q</i>(${cellName(p.s)}, ${NAME[p.a]})`, p.r, p.maxNext, p.done, p.old, p.nu);

  /* ---------- Builds: one line of the algorithm per press ---------- */

  const chooseBuild = (i, lead) => { const x = X(i); return { ...pos(i), time: x.t, Q: x.pre, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], shown: shownBefore(i), line: `${lead} ${reason(x.pre[x.s], x.explored, x.s, x.a, x.t)}`.trim() }; };
  const takeBuild = (i) => { const x = X(i), bump = x.s2 === x.s ? x.a : null; return { ...pos(i), time: x.t, Q: x.pre, agent: x.s2, taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, shown: shownBefore(i), line: takeText(x) }; };
  // The direct RL update, as in Q-learning: the best moves of S′ in red, the pair in green, its value shown even at 0.
  const updateBuild = (i, line) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.direct.Q, agent: agentAfter(x), shown: x.inModel, marks: [...tgOf(x.pre, x.s2, x.done), { c: x.s, a: x.a, kind: "upd" }], line, eq: directEq(x) }; };
  // The model remembers the move, outlined in blue.
  const modelBuild = (i, line) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.direct.Q, agent: agentAfter(x), shown: x.inModel, marks: [{ c: x.s, a: x.a, kind: "step" }], line,
    eq: `<i>Model</i>(${sym("S", x.t)}, ${sym("A", x.t)}) ← ${sym("R", x.t + 1)}, ${sym("S", x.t + 1)} <span class="nowrap">= ${num(x.r)}, ${cellName(x.s2)}</span>` }; };
  // Planning step k after move i: the move replayed in green, the best moves of where the model says it leads in red.
  const planBuild = (i, k, line, withRoute) => { const x = X(i), p = x.plans[k]; return { ...pos(i), time: x.t + 1, Q: p.Q, agent: agentAfter(x), shown: x.inModel, marks: [...tgOf(p.before, p.s2, p.done), { c: p.s, a: p.a, kind: "upd" }], line, eq: planEq(p), route: withRoute ? route(p.Q) : undefined }; };
  // All the planning steps after move i in one press, the moves they replayed in green.
  const plansBuild = (i, line) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.post, agent: agentAfter(x), shown: x.inModel, marks: uniq(x.plans.map((p) => [p.s, p.a])).map(([c, a]) => ({ c, a, kind: "upd" })), line, eq: planEq(x.plans[0]) }; };
  // A whole move in one press: chosen, taken, updated, remembered, and followed by its planning steps.
  const moveBuild = (i, rest, withRoute = false) => { const x = X(i), tk = takeBuild(i); return { ...pos(i), time: x.t + 1, Q: x.post, agent: agentAfter(x), taken: tk.taken, bump: tk.bump, sound: tk.sound, shown: x.inModel,
    marks: uniq([[x.s, x.a], ...x.plans.map((p) => [p.s, p.a])]).map(([c, a]) => ({ c, a, kind: "upd" })), route: withRoute ? route(x.post) : undefined, line: `${chooseTakeText(x.pre[x.s], x.explored, x)} ${rest}` }; };

  /* ---------- Slides ---------- */

  const slides = [];
  slides.push({ title: tr("Dyna-Q on the cookie grid", "Dyna-Q en la grilla de la galleta"), builds: [{ ep: 1, move: null, at: -1, time: 0, Q: freshQ(), agent: START, shown: new Set(), line: tr(
    `All values start at 0, and the model is empty. The agent stands at ${sym("S", 0)} = A1.`,
    `Todos los valores parten en 0, y el modelo está vacío. El agente está en ${sym("S", 0)} = A1.`) }] });
  {
    const x = X(0);
    slides.push({ title: tr("Move 1", "Movimiento 1"), builds: [
      chooseBuild(0, tr("The agent chooses its first move.", "El agente elige su primer movimiento.")),
      takeBuild(0),
      updateBuild(0, tr(
        `The direct update, as in Q-learning: the target adds ${sym("R", 1)} to 0.9 times the best value in ${sym("S", 1)}, where every move is still worth 0, outlined in red, and <i>Q</i>(${sym("S", 0)}, ${sym("A", 0)}) moves halfway toward it. It stays at 0, and the 0 now shows: the move has been tried.`,
        `La actualización directa, como en Q-learning: el objetivo suma ${sym("R", 1)} a 0.9 veces el mejor valor en ${sym("S", 1)}, donde todos los movimientos aún valen 0, con borde rojo, y <i>Q</i>(${sym("S", 0)}, ${sym("A", 0)}) avanza la mitad del camino hacia él. Se queda en 0, y ese 0 ahora se muestra: el movimiento ya se probó.`)),
      modelBuild(0, tr(
        `The model remembers what the move did, outlined in blue: ${NAME[x.a]} from ${cellName(x.s)} leads to ${cellName(x.s2)} with reward ${num(x.r)}. The moves with a value on the grid, 0 included, are the moves the model holds.`,
        `El modelo recuerda lo que hizo el movimiento, con borde azul: ${NAME[x.a]} desde ${cellName(x.s)} lleva a ${cellName(x.s2)} con recompensa ${num(x.r)}. Los movimientos con un valor en la grilla, 0 incluido, son los que guarda el modelo.`)),
      plansBuild(0, tr(
        `Then it plans, ${NPLAN} times: it picks a state it has been in and a move it has taken there, at random, asks the model what that move does, and applies the same update. The model holds only ${moveName(x.s, x.a)}, so every planning step replays it, and every target is 0 + 0.9 · 0 = 0: nothing changes. Until a reward appears, there is nothing to pass along.`,
        `Luego planea, ${NPLAN} veces: elige al azar un estado en el que ha estado y un movimiento que ha tomado ahí, le pregunta al modelo qué hace ese movimiento, y aplica la misma actualización. El modelo guarda solo ${moveName(x.s, x.a)}, así que cada paso de planning lo repite, y cada objetivo es 0 + 0.9 · 0 = 0: nada cambia. Mientras no aparezca una recompensa, no hay nada que propagar.`)),
    ] });
  }
  // The rest of episode 1 before the cookie, one press per move: nothing changes until a reward appears.
  for (let i = 1; i < T1 - 1; i++) slides.push({ title: tr(`Move ${i + 1}`, `Movimiento ${i + 1}`), builds: [moveBuild(i, i === 1
    ? tr(`Its update leaves the value at 0, the model remembers the move, and ${NPLAN} planning steps among the ${X(i).inModel.size} moves the model holds change nothing: every target is still 0.`,
      `Su actualización deja el valor en 0, el modelo recuerda el movimiento, y ${NPLAN} pasos de planning entre los ${X(i).inModel.size} movimientos que guarda el modelo no cambian nada: todo objetivo sigue siendo 0.`)
    : tr(`Update, model, ${NPLAN} planning steps: still nothing changes.`, `Actualización, modelo, ${NPLAN} pasos de planning: todavía nada cambia.`))] });
  {
    const i = T1 - 1, x = X(i);
    slides.push({ title: tr("The cookie", "La galleta"), builds: [
      chooseBuild(i, ""),
      takeBuild(i),
      updateBuild(i, tr(
        `Nothing follows the cookie, so the target is just ${sym("R", x.t + 1)} = ${num(x.r)}, and <i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) moves halfway toward it: from 0 to ${num(x.direct.nu)}. Q-learning would stop here: after the whole episode, this is the one move with a value.`,
        `Después de la galleta no viene nada, así que el objetivo es solo ${sym("R", x.t + 1)} = ${num(x.r)}, y <i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) avanza la mitad del camino hacia él: de 0 a ${num(x.direct.nu)}. Q-learning se detendría aquí: después de todo el episodio, este es el único movimiento con valor.`)),
      modelBuild(i, tr(
        `The model remembers it: ${NAME[x.a]} from ${cellName(x.s)} reaches the cookie, with reward ${num(x.r)}. It now holds ${x.inModel.size} moves, every move of the episode.`,
        `El modelo lo recuerda: ${NAME[x.a]} desde ${cellName(x.s)} llega a la galleta, con recompensa ${num(x.r)}. Ahora guarda ${x.inModel.size} movimientos, todos los del episodio.`)),
    ] });
    // The planning steps after the cookie, one slide each. The route of the best moves shows from the step that first
    // gives one.
    const first = x.plans.findIndex((p) => route(p.Q));
    // The route is not a stretch of the walk: the agent never went straight along it.
    const walk = [...steps.slice(0, T1).map((y) => y.s), GOAL].join(" "), laid = route(x.plans[first].Q).join(" ");
    if (` ${walk} `.includes(` ${laid} `)) console.warn("Dyna-Q figure: the route planning lays is a stretch of the walk");
    x.plans.forEach((p, k) => {
      const into = p.done ? tr(`reaches the cookie, with reward ${num(p.r)}`, `llega a la galleta, con recompensa ${num(p.r)}`) : tr(`leads to ${cellName(p.s2)}, with reward ${num(p.r)}`, `lleva a ${cellName(p.s2)}, con recompensa ${num(p.r)}`);
      const what = p.nu === p.old ? tr(` Its target is ${num(p.r)} + 0.9 · 0 = 0: nothing changes.`, ` Su objetivo es ${num(p.r)} + 0.9 · 0 = 0: nada cambia.`)
        : p.done ? tr(` Its target is ${num(p.r)}, and the value moves halfway toward it.`, ` Su objetivo es ${num(p.r)}, y el valor avanza la mitad del camino hacia él.`)
        : tr(` Its target adds 0.9 times the best value there, outlined in red, now ${num(p.maxNext)}.`, ` Su objetivo suma 0.9 veces el mejor valor ahí, con borde rojo, ahora ${num(p.maxNext)}.`);
      const pick = k === 0
        ? tr(`It picks ${cellName(p.s)}, a state it has been in, and ${NAME[p.a]}, a move it has taken there. The model says the move ${into}.`, `Elige ${cellName(p.s)}, un estado en el que ha estado, y ${NAME[p.a]}, un movimiento que ha tomado ahí. El modelo dice que el movimiento ${into}.`)
        : tr(`It replays ${moveName(p.s, p.a)}, which the model says ${into}.`, `Repite ${moveName(p.s, p.a)}, que según el modelo ${into}.`);
      const r = k >= first ? route(p.Q) : null;
      const extra = k === first ? tr(` Now the best moves lead from A1 to the cookie, in ${r.length - 1} moves: a route the agent never walked straight through.`, ` Ahora los mejores movimientos llevan de A1 a la galleta, en ${r.length - 1} movimientos: una ruta que el agente nunca recorrió de una vez.`)
        : k === NPLAN - 1 ? tr(` After one episode, Q-learning alone would have a value for ${moveName(x.s, x.a)} only; ${NPLAN} planning steps have carried the cookie's value back to A1.`, ` Después de un episodio, Q-learning solo tendría un valor para ${moveName(x.s, x.a)}; ${NPLAN} pasos de planning llevaron el valor de la galleta de vuelta hasta A1.`) : "";
      slides.push({ title: tr(`Planning step ${k + 1} of ${NPLAN}`, `Paso de planning ${k + 1} de ${NPLAN}`), builds: [planBuild(i, k, pick + what + extra, k >= first)] });
    });
  }
  {
    // Episode 2, one press per move, along the route.
    const a = epStart(2), b = epEnd(2);
    for (let i = a; i <= b; i++) {
      const x = X(i), top = x.plans.reduce((m, p) => (p.nu - p.old > m.nu - m.old ? p : m), x.plans[0]);
      const rest = tr(`Its update and ${NPLAN} planning steps change the values in green; the most, ${moveName(top.s, top.a)}, from ${num(top.old)} to ${num(top.nu)}.`,
        `Su actualización y ${NPLAN} pasos de planning cambian los valores en verde; el que más, ${moveName(top.s, top.a)}, de ${num(top.old)} a ${num(top.nu)}.`)
        + (x.done ? tr(` The agent followed the route planning laid out: ${x.t + 1} moves.`, ` El agente siguió la ruta que trazó el planning: ${x.t + 1} movimientos.`) : "");
      // The episode's first move in two presses, so that the agent is back at A1 before it moves.
      if (i === a) slides.push({ title: tr("Episode 2", "Episodio 2"), builds: [
        { ...chooseBuild(i, tr("A new episode starts at A1.", "Un nuevo episodio parte en A1.")), route: route(X(i - 1).post) },
        { ...moveBuild(i, rest, true), line: `${takeText(x)} ${rest}` },
      ] });
      else slides.push({ title: x.done ? tr("Episode 2 ends", "Termina el episodio 2") : tr(`Move ${x.t + 1}`, `Movimiento ${x.t + 1}`), builds: [moveBuild(i, rest, true)] });
    }
  }
  {
    // Every move tried after episode 1 for the first time came from a random move, or from a cell a random move had
    // led to, where every move was still worth 0; checked here, so that the last slide's sentence holds.
    const seenPairs = new Set(steps.slice(0, T1).map((x) => x.s * 4 + x.a));
    let offRoute = false;
    for (const x of steps.slice(T1)) {
      if (x.t === 0) offRoute = false;
      if (x.explored) offRoute = true;
      if (!seenPairs.has(x.s * 4 + x.a) && !offRoute) console.warn("Dyna-Q figure: a new move not after a random one", x);
      seenPairs.add(x.s * 4 + x.a);
    }
    const Q = X(last).post, p = route(Q), vals = p.slice(0, -1).map((s) => num(Math.max(...Q[s]))).join(", ");
    slides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...pos(last), time: X(last).t + 1, Q, agent: GOAL, shown: X(last).inModel, route: p, line: tr(
      `Along the route the values are ${vals}, the returns of the shortest trip. In ${steps.length} moves the agent tried only ${seenPairs.size} of the ${CELLS.length * 4} moves. Planning replays only moves already made, and after episode 1 every new move came from a random move, one time in ten, or from a cell a random move had led to.`,
      `A lo largo de la ruta, los valores son ${vals}, los retornos del viaje más corto. En ${steps.length} movimientos, el agente probó solo ${seenPairs.size} de los ${CELLS.length * 4} movimientos. El planning solo repite movimientos ya hechos, y después del episodio 1 cada movimiento nuevo vino de un movimiento al azar, una vez de cada diez, o de una celda adonde lo había llevado uno.`) }] });
  }
  addSkips(slides, X);

  slideshow({
    svg: document.getElementById("fig-dyna"),
    slides,
    world: cookie,
    // The state after move m, for the frames of a skip: the move just made in green, the next one in yellow.
    frame: (m) => {
      const x = X(m), y = m < last ? X(m + 1) : null;
      return { Q: x.post, agent: agentAfter(x), ep: x.ep, move: x.t + 1, time: x.t + 1, shown: x.inModel, marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
    },
  });
}
