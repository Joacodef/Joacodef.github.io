import { el, tr, modeButtons, makeHandle, makeDraggable } from "../../plane.js";
import { cookie, cliff, NAME, rngFrom, epsGreedy, num, par, eqv, listAnd, sym, slideshow, shake } from "./gridworld.js";

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
// The best moves of the state a target looks at, from the values before the update, in red; none past the goal.
const tgOf = (Q, s2, done) => { if (done) return []; const q = Q[s2], m = Math.max(...q); return [0, 1, 2, 3].filter((a) => q[a] === m).map((a) => ({ c: s2, a, kind: "tg" })); };
// On the cookie grid, the cells the best moves lead through from A1 while each cell has a move worth more than 0, or null.
function route(Q) {
  let s = START; const p = [s];
  for (let k = 0; k < W * H; k++) {
    const m = Math.max(...Q[s]); if (m <= 0) return null;
    const n = stepEnv(s, Q[s].indexOf(m)).s2; if (n === s || p.includes(n)) return null;
    p.push(n); if (n === GOAL) return p; s = n;
  }
  return null;
}

/* ---------- Section 1: Q-planning on a model of the cookie grid ---------- */

// The model knows every move of the grid. Each step picks one of the 8 states and one of the 4 moves at random (one
// random number each), asks the model what the move does, and applies the Q-learning update with α = 1: a move on the
// grid always does the same thing, so there is nothing to average, and the update sets the value to its target; γ = 0.9.
// The agent never moves. This seed's first three picks are the last three moves of a way from A2 to the cookie, in the
// order the agent would walk them; A1 gets its value at step 30, and from step 95 on no step can change any value.
{
  const SEED = 5659, ALL = new Set(CELLS.flatMap((s) => [0, 1, 2, 3].map((a) => s * 4 + a)));
  // The target of move a in s: its reward plus 0.9 times the best value where it leads.
  const target = (Q, s, a) => { const o = stepEnv(s, a); return o.r + (o.done ? 0 : GAMMA * Math.max(...Q[o.s2])); };
  // Planning has nothing left to do once every value equals its target: these are the values of the best behavior.
  const settled = (Q) => CELLS.every((s) => [0, 1, 2, 3].every((a) => Math.abs(Q[s][a] - target(Q, s, a)) < 1e-12));
  const steps = [];
  {
    const rnd = rngFrom(SEED), Q = freshQ();
    while (!settled(Q) && steps.length < 1000) {
      const s = CELLS[Math.floor(rnd() * CELLS.length)], a = Math.floor(rnd() * 4), o = stepEnv(s, a), before = copy(Q);
      Q[s][a] = target(Q, s, a);
      steps.push({ s, a, ...o, before, Q: copy(Q), old: before[s][a], nu: Q[s][a], maxNext: o.done ? 0 : Math.max(...before[o.s2]) });
    }
  }
  // Step i, counted from 1.
  const n = steps.length, X = (i) => steps[i - 1], changed = (i) => X(i).nu !== X(i).old;
  const label = (i) => tr(`Planning step ${i}`, `Paso de planning ${i}`);
  const nm = (s, a) => `${cellName(s)}, ${NAME[a]}`;
  // The update with α = 1: the value in green takes its target, in red; the first one also in symbols.
  const updEq = (i, symbols = false) => {
    const x = X(i), lhs = `<span class="upd"><i>Q</i>(${nm(x.s, x.a)})</span>`;
    if (x.done) return `${lhs} <span class="nowrap">← <span class="pt">${num(x.r)}</span></span>`;
    const tg = symbols ? `<span class="pt"><i>R</i> + γ max<sub><i>a</i></sub> <i>Q</i>(${cellName(x.s2)}, <i>a</i>)</span></span> <span class="nowrap">= ${num(x.r)} + 0.9 · ${num(x.maxNext)}` : `<span class="pt">${num(x.r)} + 0.9 · ${num(x.maxNext)}</span>`;
    return `${lhs} <span class="nowrap">← ${tg}</span> <span class="nowrap">${eqv(x.nu)}</span>`;
  };
  const into = (x) => (x.done ? tr(`reaches the cookie, with reward ${num(x.r)}`, `llega a la galleta, con recompensa ${num(x.r)}`)
    : x.s2 === x.s ? tr(`hits the wall and stays in ${cellName(x.s)}`, `choca con la pared y se queda en ${cellName(x.s)}`) : tr(`leads to ${cellName(x.s2)}`, `lleva a ${cellName(x.s2)}`));
  const base = (i) => ({ label: label(i), at: i, agent: START, shown: ALL });
  // The faint copy of the agent plays step i: it appears in the state picked, the move's yellow fading, and glides where
  // the model says the move leads (a wall hit nudges it).
  const play = (i) => { const x = X(i); return { ghost: x.s2, ghostFrom: x.s, ghostBump: x.s2 === x.s ? x.a : undefined, taken: [x.s, x.a] }; };
  // Step i in one press: the move picked in green, the best moves where the model says it leads in red.
  const stepBuild = (i, line) => { const x = X(i); return { ...base(i), ...play(i), Q: x.Q, marks: [...tgOf(x.before, x.s2, x.done), { c: x.s, a: x.a, kind: "upd" }], line, eq: updEq(i) }; };

  /* ---------- Slides ---------- */

  const slides = [];
  slides.push({ title: tr("Planning on the cookie grid", "Planning en la grilla de la galleta"), builds: [{ label: tr("Before planning", "Antes de planear"), at: 0, Q: freshQ(), agent: START, shown: ALL, line: tr(
    `All 32 values start at 0. The agent stands at A1, and planning will not move it.`,
    `Los 32 valores parten en 0. El agente está en A1, y el planning no lo va a mover.`) }] });
  {
    const x = X(1);
    slides.push({ title: tr("Planning step 1", "Paso de planning 1"), builds: [
      { ...base(1), Q: x.before, pick: [x.s, x.a], ghost: x.s, line: tr(
        `It picks a state and a move at random: <span class="nowrap"><i>S</i> = ${cellName(x.s)}</span> and <span class="nowrap"><i>A</i> = ${NAME[x.a]}</span>.`,
        `Elige al azar un estado y un movimiento: <span class="nowrap"><i>S</i> = ${cellName(x.s)}</span> y <span class="nowrap"><i>A</i> = ${NAME[x.a]}</span>.`) },
      { ...base(1), Q: x.before, taken: [x.s, x.a], ghost: x.s2, ghostBump: x.s2 === x.s ? x.a : undefined, line: tr(
        `The model answers as the grid would: ${NAME[x.a]} from ${cellName(x.s)} ${into(x)}, so <span class="nowrap"><i>R</i> = ${num(x.r)}</span> and <span class="nowrap"><i>S</i>′ = ${cellName(x.s2)}</span>.`,
        `El modelo responde como lo haría la grilla: ${NAME[x.a]} desde ${cellName(x.s)} ${into(x)}, así que <span class="nowrap"><i>R</i> = ${num(x.r)}</span> y <span class="nowrap"><i>S</i>′ = ${cellName(x.s2)}</span>.`) },
      { ...base(1), Q: x.Q, ghost: x.s2, marks: [...tgOf(x.before, x.s2, x.done), { c: x.s, a: x.a, kind: "upd" }], line: tr(
        `The update sets <i>Q</i>(${nm(x.s, x.a)}) to its target: <i>R</i> plus 0.9 times the best value in ${cellName(x.s2)}, outlined in red. Every value there is still 0, so nothing changes.`,
        `La actualización le da a <i>Q</i>(${nm(x.s, x.a)}) el valor de su objetivo: <i>R</i> más 0.9 veces el mejor valor en ${cellName(x.s2)}, con borde rojo. Ahí todos los valores siguen en 0, así que nada cambia.`), eq: updEq(1, true) },
    ] });
  }
  // Every step up to the first value that is not 0, one press each.
  const first = steps.findIndex((x) => x.nu !== x.old) + 1;
  for (let i = 2; i < first; i++) {
    const x = X(i);
    slides.push({ title: label(i), builds: [stepBuild(i, tr(`It picks ${moveName(x.s, x.a)}, which the model says ${into(x)}. The target is ${num(x.r)} + 0.9 · ${num(x.maxNext)} = 0: nothing changes.`,
      `Elige ${moveName(x.s, x.a)}, que según el modelo ${into(x)}. El objetivo es ${num(x.r)} + 0.9 · ${num(x.maxNext)} = 0: nada cambia.`))] });
  }
  {
    // The first steps picked the last moves of a way to the cookie in the order the agent would walk them.
    const x = X(first), walk = first >= 2 && steps.slice(0, first - 1).every((y, j) => y.s2 === X(j + 2).s && y.s2 !== y.s);
    if (!x.done || !walk) console.warn("Q-planning figure: the first steps are not a walk to the cookie");
    slides.push({ title: tr("The first value", "El primer valor"), builds: [stepBuild(first, tr(
      `It picks ${moveName(x.s, x.a)}, which ${into(x)}: nothing follows, so the target is just 1. Steps 1 to ${first} picked the moves of a way from ${cellName(X(1).s)} to the cookie in the order the agent would walk them, so only the last one had something to pass on.`,
      `Elige ${moveName(x.s, x.a)}, que ${into(x)}: no viene nada después, así que el objetivo es solo 1. Los pasos 1 a ${first} eligieron los movimientos de un camino desde ${cellName(X(1).s)} hasta la galleta en el orden en que el agente los recorrería, así que solo el último tuvo algo que propagar.`))] });
  }
  {
    // A move picked before the first value, picked again once the value is there to pass back.
    const i = steps.findIndex((x, j) => j + 1 > first && x.nu !== x.old && steps.slice(0, first - 1).some((y) => y.s === x.s && y.a === x.a)) + 1, x = X(i);
    const at = steps.findIndex((y) => y.s === x.s && y.a === x.a) + 1;
    slides.push({ title: tr("Passed back", "De vuelta"), builds: [stepBuild(i, tr(
      `${moveName(x.s, x.a)}, which changed nothing at step ${at}, comes up again. Now the best value in ${cellName(x.s2)} is ${num(x.maxNext)}, outlined in red, so the target is ${num(x.r)} + 0.9 · ${num(x.maxNext)} = ${num(x.nu)}.`,
      `${moveName(x.s, x.a)}, que no cambió nada en el paso ${at}, vuelve a salir. Ahora el mejor valor en ${cellName(x.s2)} es ${num(x.maxNext)}, con borde rojo, así que el objetivo es ${num(x.r)} + 0.9 · ${num(x.maxNext)} = ${num(x.nu)}.`))] });
  }
  {
    // The step that gives A1 a value: the best moves now lead from A1 to the cookie, by a shortest route.
    const i = steps.findIndex((x) => Math.max(...x.Q[START]) > 0) + 1, x = X(i), r = route(x.Q);
    const zeros = CELLS.reduce((c, s) => c + x.Q[s].filter((v) => v === 0).length, 0);
    if (!r || r.length !== 5) console.warn("Q-planning figure: A1's first value does not come with a shortest route");
    slides.push({ title: tr("A way from A1", "Un camino desde A1"), builds: [{ ...stepBuild(i, tr(
      `${moveName(x.s, x.a)} gets its value, and the best moves now lead from A1 to the cookie in ${r.length - 1} moves, a shortest route. ${zeros} values are still 0, but had planning stopped here, the agent could already take it, without having moved.`,
      `${moveName(x.s, x.a)} recibe su valor, y los mejores movimientos ya llevan de A1 a la galleta en ${r.length - 1} movimientos, una ruta más corta. ${zeros} valores siguen en 0, pero si el planning se detuviera aquí, el agente ya podría tomarla, sin haberse movido.`)), route: r }] });
  }
  {
    // A value raised a second time: set earlier from the best value its next cell had then, which has since grown.
    const i = steps.findIndex((x) => x.old > 0 && x.nu !== x.old && x.s2 !== x.s) + 1, x = X(i);
    const setAt = steps.slice(0, i - 1).findLastIndex((y) => y.s === x.s && y.a === x.a && y.nu !== y.old) + 1;
    const b = x.before[x.s2].indexOf(x.maxNext), grew = steps.slice(0, i - 1).findLastIndex((y) => y.s === x.s2 && y.a === b && y.nu !== y.old) + 1;
    if (grew <= setAt) console.warn("Q-planning figure: the raised value's neighbor did not grow after it was set");
    slides.push({ title: tr("Raised again", "Sube de nuevo"), builds: [stepBuild(i, tr(
      `${moveName(x.s, x.a)} rises from ${num(x.old)} to ${num(x.nu)}: it was set at step ${setAt}, when the best value in ${cellName(x.s2)} was ${num(X(setAt).maxNext)}, and ${moveName(x.s2, b)} has since reached ${num(x.maxNext)}. A value set too early is fixed only when its move comes up again, which is why every pair must keep being picked.`,
      `${moveName(x.s, x.a)} sube de ${num(x.old)} a ${num(x.nu)}: se fijó en el paso ${setAt}, cuando el mejor valor en ${cellName(x.s2)} era ${num(X(setAt).maxNext)}, y desde entonces ${moveName(x.s2, b)} llegó a ${num(x.maxNext)}. Un valor fijado demasiado pronto se corrige solo cuando su movimiento vuelve a salir: por eso cada par debe seguir eligiéndose.`))] });
  }
  {
    // The end: no step can change any value; the values along every shortest route from A1.
    const x = X(n), along = [3, 2, 1, 0].map((k) => num(GAMMA ** k)), count = steps.filter((y) => y.nu !== y.old).length;
    if (!settled(x.Q) || Math.abs(Math.max(...x.Q[START]) - GAMMA ** 3) > 1e-9) console.warn("Q-planning figure: the values at the end are not the best behavior's");
    slides.push({ title: tr(`After ${n} planning steps`, `Después de ${n} pasos de planning`), builds: [{ ...stepBuild(n, tr(
      `That was the last change: every value now equals its target, so no step can change it. These are the values of the best behavior, ${listAnd(along)} along every shortest route from A1. Only ${count} of the ${n} steps changed a value; the others found nothing new to pass on.`,
      `Ese fue el último cambio: ahora cada valor es igual a su objetivo, así que ningún paso puede cambiarlo. Son los valores de la mejor conducta, ${listAnd(along)} a lo largo de toda ruta más corta desde A1. Solo ${count} de los ${n} pasos cambiaron un valor; los demás no encontraron nada nuevo que propagar.`)), route: route(x.Q) }] });
  }
  // Skips count planning steps.
  for (let k = 1; k < slides.length; k++) {
    const from = slides[k - 1].builds.at(-1).at, to = slides[k].builds[0].at, gap = to - from;
    if (gap > 1) slides[k].skip = { from, to, moves: gap, text: tr(`${gap} planning steps later`, `${gap} pasos de planning después`), note: tr(`${gap} planning steps go by.`, `Pasan ${gap} pasos de planning.`) };
  }

  slideshow({
    svg: document.getElementById("fig-qplan"),
    slides,
    world: cookie,
    // The values after step m, for the frames of a skip: the move just updated in green, the next one picked in yellow.
    frame: (m) => ({ label: label(m), Q: X(m).Q, agent: START, ghost: X(m).s2, shown: ALL, marks: [{ c: X(m).s, a: X(m).a, kind: "upd" }], pick: m < n ? [X(m + 1).s, X(m + 1).a] : undefined }),
  });
}

/* ---------- Section 2: is the untried door worth a look? ---------- */

// The robot's home, γ = 1: from the hallway, the move to the study (−1), where charging gives +1 three times in five,
// so the study route is worth −1 + 0.6 = −0.4; and a corridor of d known moves (−1 each, d from 0 to 3, set by
// dragging the door) that ends at the garage door, never tried. R-Max assumes that an untried move gives Rmax = 1 and
// ends the episode, so the door is worth −d + 1 from the hallway: worth a look up to one move away.
{
  const svg = document.getElementById("fig-look"), out = document.getElementById("fig-look-out");
  const STUDY_V = -1 + 0.6, R_MAX = 1, MAX_D = 3;
  // Laid out so that the labels, larger on phones, fit in Spanish too ("ocupado", "nunca probada").
  const HALL = [84, 100], STUDY = [212, 54], FREE = [348, 24], TAKEN = [348, 88], STEP = 68, P = (i) => [160 + STEP * i, 182];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  svg.setAttribute("viewBox", "0 0 440 232");
  el("path", { class: "head", d: "M0 0 L10 5 L0 10 z" }, el("marker", { id: "look-head", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, el("defs", {}, svg)));
  // An arrow from a to b, stopping short of both by the given gaps.
  const arrow = (a, b, g0, g1, cls, parent) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    return el("line", { class: cls, x1: a[0] + u[0] * g0, y1: a[1] + u[1] * g0, x2: b[0] - u[0] * g1, y2: b[1] - u[1] * g1, "marker-end": "url(#look-head)" }, parent);
  };
  const label = (x, y, text, parent, anchor = "middle") => { el("text", { class: "dg-lab", x, y, "text-anchor": anchor }, parent).textContent = text; };
  // The study's branch, as in the robot's model at the top of the page.
  const studyG = el("g", { class: "look-branch" }, svg);
  arrow(HALL, STUDY, 12, 13, "ln-path", studyG);
  arrow(STUDY, FREE, 12, 13, "ln-path", studyG);
  arrow(STUDY, TAKEN, 12, 13, "ln-path", studyG);
  el("circle", { class: "state", cx: STUDY[0], cy: STUDY[1], r: 10 }, studyG);
  for (const [x, y] of [FREE, TAKEN]) el("rect", { class: "state", x: x - 8, y: y - 8, width: 16, height: 16 }, studyG);
  const [m1, m2, m3] = [mid(HALL, STUDY), mid(STUDY, FREE), mid(STUDY, TAKEN)];
  label(m1[0] - 12, m1[1] - 13, tr("1 of 1, −1", "1 de 1, −1"), studyG);
  label(m2[0], m2[1] - 17, tr("3 of 5, +1", "3 de 5, +1"), studyG);
  label(m3[0] + 12, m3[1] + 35, tr("2 of 5, 0", "2 de 5, 0"), studyG);
  label(FREE[0] + 16, FREE[1] + 5, tr("free", "libre"), studyG, "start");
  label(TAKEN[0] + 16, TAKEN[1] + 5, tr("taken", "ocupado"), studyG, "start");
  label(STUDY[0], STUDY[1] + 32, tr("study", "estudio"), studyG);
  // The corridor's branch: its known moves and rooms, redrawn for each length, and the door, which the reader drags.
  const corridorG = el("g", { class: "look-branch" }, svg);
  el("circle", { class: "state", cx: HALL[0], cy: HALL[1], r: 10 }, svg);
  // The hallway's name to its left, clear of both branches.
  label(HALL[0] - 16, HALL[1] + 5, tr("hallway", "pasillo"), svg, "end");
  const door = makeHandle(svg, "none", 17);
  el("rect", { class: "state unk", x: -8, y: -8, width: 16, height: 16 }, door);
  el("text", { class: "ln-lab", x: 0, y: -16, "text-anchor": "middle" }, door).textContent = "?";
  let d = 0;
  function render() {
    corridorG.replaceChildren();
    const at = (i) => (i < 0 ? HALL : P(i));
    for (let i = 0; i <= d; i++) {
      const known = i < d;
      arrow(at(i - 1), at(i), 12, known ? 13 : 14, known ? "ln-path" : "ln-path dash", corridorG);
      if (known) {
        el("circle", { class: "state", cx: P(i)[0], cy: P(i)[1], r: 10 }, corridorG);
        const [ax, ay] = at(i - 1), [bx, by] = P(i);
        label((ax + bx) / 2 + (i === 0 ? 14 : 0), (ay + by) / 2 - (i === 0 ? 2 : 9), "−1", corridorG, i === 0 ? "start" : "middle");
      }
    }
    label(P(d)[0], P(d)[1] + 32, tr("never tried", "nunca probada"), corridorG);
    door.setAttribute("transform", `translate(${P(d)[0]} ${P(d)[1]})`);
    door.setAttribute("aria-label", d === 0 ? tr("The garage door, in the hallway", "La puerta del garaje, en el pasillo")
      : tr(`The garage door, at the end of a corridor of ${d} ${d === 1 ? "move" : "moves"}`, `La puerta del garaje, al final de un corredor de ${d} ${d === 1 ? "movimiento" : "movimientos"}`));
    // The door's value from the hallway: −1 for each move of the corridor, then the Rmax that R-Max assumes behind it.
    const value = -d + R_MAX, look = value > STUDY_V;
    studyG.classList.toggle("off", look);
    corridorG.classList.toggle("off", !look);
    const terms = [...Array(d).fill("−1"), "<i>R</i><sub>max</sub>"].join(" + ").replaceAll("+ −", "− ");
    out.innerHTML = `<p class="eq">${terms} <span class="nowrap">= ${num(value)} ${look ? "&gt;" : "&lt;"} −0.4</span></p><p>${
      look ? (d === 0 ? tr("More than the study's −0.4: <span class=\"nowrap\">R-Max</span> goes to look behind the door.", "Más que el −0.4 del estudio: <span class=\"nowrap\">R-Max</span> va a mirar detrás de la puerta.")
        : tr("Still more than the study's −0.4: <span class=\"nowrap\">R-Max</span> walks down the corridor to look.", "Todavía más que el −0.4 del estudio: <span class=\"nowrap\">R-Max</span> recorre el corredor para mirar."))
        : tr("Less than the study's −0.4: <span class=\"nowrap\">R-Max</span> goes to the study and never looks behind the door.", "Menos que el −0.4 del estudio: <span class=\"nowrap\">R-Max</span> va al estudio y nunca mira detrás de la puerta.")}</p>`;
  }
  const setD = (v) => { const n = Math.max(0, Math.min(MAX_D, v)); if (n !== d) { d = n; render(); } };
  makeDraggable(door, { move: ({ x }) => setD(Math.round((x - P(0)[0]) / STEP)), step: ([dx, dy]) => setD(d + dx + dy) });
  render();
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
      return { Q: x.Q2, agent: x.done ? GOAL : x.s2, ep: x.ep, move: x.t + 1, time: x.t + 1, unknown: x.unknown2, bumpPose: shake(x, m), marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
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
  const planBuild = (i, k, line, withRoute) => { const x = X(i), p = x.plans[k]; return { ...pos(i), time: x.t + 1, Q: p.Q, agent: agentAfter(x), shown: x.inModel, ghost: p.s2, ghostFrom: p.s, ghostBump: p.s2 === p.s ? p.a : undefined, taken: [p.s, p.a], marks: [...tgOf(p.before, p.s2, p.done), { c: p.s, a: p.a, kind: "upd" }], line, eq: planEq(p), route: withRoute ? route(p.Q) : undefined }; };
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
      return { Q: x.post, agent: agentAfter(x), ep: x.ep, move: x.t + 1, time: x.t + 1, shown: x.inModel, bumpPose: shake(x, m), marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
    },
  });
}

/* ---------- Section 4: a wall on the cliff, for R-Max and for Dyna-Q ---------- */

// Both methods on the cliff, γ = 1, for 30 episodes: before episode 11 a wall goes up between A2 and B2, across the edge,
// and before episode 21 it comes down. The figure starts after episode 10, when both follow the edge, and two buttons
// switch between the runs. R-Max (k = 1, Rmax = −1, the largest reward on the cliff) knows every move after its first
// episode and has gone right from A2 14 times by episode 10; it bumps into the wall 29 times before going around, and
// never tries right in A2 again. Dyna-Q (α = 0.5, ε = 0.1, n = 10) bumps into it 3 times, and a random move in episode
// 25 finds the edge open.
{
  const { START: S0, GOAL: G, W: CW, H: CH, isCliff, cellName: cn, freshQ: fresh } = cliff;
  const A2 = 12, B2 = 13, UP = 0, RIGHT = 1, WALL = [[A2, B2]], UP_EP = 11, DOWN_EP = 21, EPISODES = 30;
  const STATES = [...Array(CW * CH).keys()].filter((s) => !isCliff(s) && s !== G);
  const wallOn = (ep) => ep >= UP_EP && ep < DOWN_EP, wallsAt = (ep) => (wallOn(ep) ? WALL : undefined);
  // The cliff with the wall: while it stands, a move across it leaves the agent where it is, at the cost of a move.
  const stepW = (s, a, ep) => { const o = cliff.stepEnv(s, a); return wallOn(ep) && ((s === A2 && o.s2 === B2) || (s === B2 && o.s2 === A2)) ? { s2: s, r: -1, fell: null, done: false } : o; };
  const after = (x) => (x.done ? G : x.s2), nm = (s, a) => `${cn(s)}, ${NAME[a]}`;
  const frac = (p, q) => `<span class="frac"><span>${p}</span><span>${q}</span></span>`;
  const before = (ep) => `${tr(`Episode ${ep}, before the first move`, `Episodio ${ep}, antes del primer movimiento`)} · <i>t</i> = 0`;
  // The cells of an episode's trip, from A1 to the goal, as the agent entered them.
  const trip = (steps, e) => [S0, ...steps.filter((x) => x.ep === e && x.s2 !== x.s).map(after)];
  const lens = (steps) => { const L = {}; for (const x of steps) if (x.done) L[x.ep] = x.t + 1; return L; };
  // The skip over the training names its episodes.
  const learnSkip = (slide) => {
    slide.skip.text = tr(`${slide.skip.moves} moves later: episodes 1 to ${UP_EP - 1}`, `${slide.skip.moves} movimientos después: los episodios 1 a ${UP_EP - 1}`);
    slide.skip.note = tr(`Episodes 1 to ${UP_EP - 1} go by, ${slide.skip.moves} moves.`, `Pasan los episodios 1 a ${UP_EP - 1}, ${slide.skip.moves} movimientos.`);
  };
  // The skip into the slide where the wall comes down ends with episode 20, before the first move of episode 21.
  const downSkip = (slide) => { if (slide.skip) slide.skip.text = tr(`${slide.skip.moves} moves later, at the end of episode ${DOWN_EP - 1}`, `${slide.skip.moves} movimientos después, al final del episodio ${DOWN_EP - 1}`); };

  /* ---------- R-Max ---------- */

  const R = [];
  {
    const K = 1, RMAX = -1, SEED = 12, rnd = rngFrom(SEED), N = fresh(), Np = Array.from({ length: CW * CH }, () => [0, 1, 2, 3].map(() => new Map()));
    // The value of move a in s under V: Rmax for an unknown move; otherwise every outcome counted, by its fraction.
    const moveValue = (V, s, a) => { if (N[s][a] < K) return RMAX; let v = 0; for (const o of Np[s][a].values()) v += (o.c / N[s][a]) * (o.r + (o.s2 === G ? 0 : V[o.s2])); return v; };
    const round = (v) => Math.round(v * 1e9) / 1e9;
    let V = Array(CW * CH).fill(0);
    // Value iteration from the last values until no value changes. Values are rounded so that equal ones tie exactly.
    const solve = () => {
      for (let sweep = 0; sweep < 100000; sweep++) {
        const V2 = V.map((_, s) => (STATES.includes(s) ? Math.max(...[0, 1, 2, 3].map((a) => moveValue(V, s, a))) : 0));
        const still = V2.every((v, s) => Math.abs(v - V[s]) < 1e-13);
        V = V2;
        if (still) break;
      }
      return { V: V.map(round), Q: Array.from({ length: CW * CH }, (_, s) => (STATES.includes(s) ? [0, 1, 2, 3].map((a) => round(moveValue(V, s, a))) : [0, 0, 0, 0])) };
    };
    const untried = () => STATES.flatMap((c) => [0, 1, 2, 3].filter((b) => N[c][b] < K).map((b) => [c, b]));
    let sol = solve();
    for (let ep = 1; ep <= EPISODES; ep++) {
      let s = S0, t = 0;
      while (true) {
        const q = sol.Q[s], m = Math.max(...q), ties = [0, 1, 2, 3].filter((b) => q[b] === m);
        const a = ties[Math.floor(rnd() * ties.length)], o = stepW(s, a, ep), unknown = N[s][a] < K, unknownBefore = untried();
        N[s][a]++;
        const key = `${o.s2} ${o.r}`, rec = Np[s][a].get(key);
        if (rec) rec.c++; else Np[s][a].set(key, { s2: o.s2, r: o.r, c: 1 });
        // The model changes only when a move becomes known, or when a move with more than one outcome is counted.
        const sol2 = unknown || Np[s][a].size > 1 ? solve() : sol;
        R.push({ ep, t, s, a, ...o, ties, Q: sol.Q, Q2: sol2.Q, V2: sol2.V, n: N[s][a], outs: [...Np[s][a].values()].map((x) => ({ ...x })), newly: unknown, unknown: unknownBefore, unknown2: untried() });
        sol = sol2;
        if (o.done) break;
        s = o.s2; t++;
      }
    }
  }
  const rSlides = [], rX = (i) => R[i], rLast = R.length - 1;
  const rFrame = (m) => {
    const x = rX(m), y = m < rLast ? rX(m + 1) : null;
    return { Q: x.Q2, agent: after(x), ring: x.fell, ep: x.ep, move: x.t + 1, time: x.t + 1, walls: wallsAt(x.ep), unknown: x.unknown2, bumpPose: shake(x, m), marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
  };
  {
    const X = rX, pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i }), L = lens(R);
    const epEnd = (e) => R.findLastIndex((x) => x.ep === e), epStart = (e) => R.findIndex((x) => x.ep === e);
    const e10 = epEnd(UP_EP - 1), i11 = epStart(UP_EP), e11 = epEnd(UP_EP), e20 = epEnd(DOWN_EP - 1), i21 = epStart(DOWN_EP);
    const bumps = R.flatMap((x, i) => (x.ep === UP_EP && x.s === A2 && x.a === RIGHT && x.s2 === A2 ? [i] : []));
    const passes = R.filter((x, i) => i <= e10 && x.s === A2 && x.a === RIGHT).length;
    // Choose A greedily from the values: the move turns yellow before the agent moves.
    const chooseB = (i) => { const x = X(i); return { ...pos(i), time: x.t, Q: x.Q, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], walls: wallsAt(x.ep), line: cliff.reason(x.Q[x.s], false, x.s, x.a, x.t) }; };
    const takeB = (i) => { const x = X(i), bump = x.s2 === x.s ? x.a : null; return { ...pos(i), time: x.t, Q: x.Q, agent: after(x), taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, walls: wallsAt(x.ep), line: cliff.takeText(x) }; };
    const countB = (i, line, eq) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.Q, agent: after(x), walls: wallsAt(x.ep), marks: [{ c: x.s, a: x.a, kind: "upd" }], line, eq }; };
    // Value iteration on the new model: the move counted and every value that changed in green, the best moves of the
    // cells the move leads to in red.
    const moved = (i) => { const x = X(i); return STATES.flatMap((s) => [0, 1, 2, 3].filter((a) => x.Q2[s][a] !== x.Q[s][a]).map((a) => ({ c: s, a, kind: "upd" }))); };
    const viB = (i, line, eq) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.Q2, agent: after(x), walls: wallsAt(x.ep), marks: [...x.outs.flatMap((o) => tgOf(x.Q2, o.s2, o.s2 === G)), ...moved(i), { c: x.s, a: x.a, kind: "upd" }], line, eq, fit: true }; };
    // A whole move in one press: chosen, taken, counted, and valued by value iteration.
    const moveB = (i, extra, eq) => { const x = X(i), tk = takeB(i); return { ...viB(i, "", eq), taken: tk.taken, bump: tk.bump, sound: tk.sound, line: `${cliff.chooseTakeText(x.Q[x.s], false, x)}${extra}` }; };
    // What the model says right from A2 does, and the value value iteration gives it.
    const pEq = (i) => X(i).outs.map((o) => `<i>P</i>(${cn(o.s2)}, ${num(o.r)} | ${nm(A2, RIGHT)}) <span class="nowrap">= ${frac(o.c, X(i).n)}</span>`).join("<br>");
    const rightEq = (i) => {
      const x = X(i), V = x.V2, through = x.outs.find((o) => o.s2 === B2).c;
      return `<span class="upd"><i>Q</i>(${nm(A2, RIGHT)})</span> <span class="nowrap">= ${frac(through, x.n)} (<span class="pt">−1 − ${num(-V[B2])}</span>)</span> <span class="nowrap">+ ${frac(x.n - through, x.n)} (<span class="pt">−1 − ${num(-V[A2])}</span>)</span> <span class="nowrap">${eqv(x.Q2[A2][RIGHT])}</span>`;
    };
    const known = R.filter((x) => x.newly), knownEp = known.at(-1).ep;
    if (known.length !== STATES.length * 4 || knownEp >= UP_EP) console.warn("Wall figure: R-Max does not know every move before the wall");
    if (Object.entries(L).some(([e, l]) => +e > knownEp && +e < UP_EP && l !== 7)) console.warn("Wall figure: R-Max's trips before the wall do not all take the edge");
    const x0 = X(e10);
    rSlides.push({ title: tr("R-Max on the cliff", "R-Max en el acantilado"), builds: [{ label: before(1), ep: 1, at: -1, Q: X(0).Q, agent: S0, unknown: X(0).unknown, line: tr(
      `Every move starts unknown, shaded and worth <i>R</i><sub>max</sub> = −1, the largest reward on the cliff. Before the wall goes up, R-Max learns the cliff for ${UP_EP - 1} episodes.`,
      `Todo movimiento parte <i>unknown</i>, sombreado y con valor <i>R</i><sub>max</sub> = −1, la mayor recompensa en el acantilado. Antes de que se levante la pared, R-Max aprende el acantilado durante ${UP_EP - 1} episodios.`) }] });
    rSlides.push({ title: tr(`R-Max after ${UP_EP - 1} episodes`, `R-Max después de ${UP_EP - 1} episodios`), builds: [{ label: before(UP_EP), ep: UP_EP, at: e10, Q: x0.Q2, agent: S0, route: trip(R, UP_EP - 1), line: tr(
      `It has known every move since ${knownEp === 1 ? `its first episode, ${L[1]} moves long` : `episode ${knownEp}`}, and every trip since has taken the edge, 7 moves. Right from A2 has led to B2 all ${passes} times.`,
      `Conoce todos los movimientos desde ${knownEp === 1 ? `su primer episodio, de ${L[1]} movimientos` : `el episodio ${knownEp}`}, y desde entonces cada viaje ha tomado el borde, 7 movimientos. Derecha desde A2 ha llevado a B2 las ${passes} veces.`),
      eq: `<i>P</i>(B2, −1 | ${nm(A2, RIGHT)}) <span class="nowrap">= ${frac(`<i>N</i>(${nm(A2, RIGHT)}, B2, −1)`, `<i>N</i>(${nm(A2, RIGHT)})`)}</span> <span class="nowrap">= ${frac(passes, passes)} = 1</span>` }] });
    rSlides.push({ title: tr("A wall goes up", "Se levanta una pared"), builds: [
      { label: before(UP_EP), ep: UP_EP, at: e10, Q: x0.Q2, agent: S0, walls: WALL, line: tr(
        `Before episode ${UP_EP}, a wall goes up between A2 and B2, across the edge. Nothing in R-Max's model says so.`,
        `Antes del episodio ${UP_EP}, se levanta una pared entre A2 y B2, cruzando el borde. Nada en el modelo de R-Max lo dice.`) },
      moveB(i11, tr(` Counting it changes nothing: the move did what the model said.`, ` Contarlo no cambia nada: el movimiento hizo lo que decía el modelo.`)),
    ] });
    {
      // The first bump, one line of the algorithm per press. Value iteration lowers right by as much as every move that
      // leads to A2, or back to A1, loses: checked here.
      const i = bumps[0], x = X(i), loss = X(i - 1).Q2[A2][RIGHT] - x.Q2[A2][RIGHT];
      const moved = STATES.flatMap((s) => [0, 1, 2, 3].filter((a) => x.Q2[s][a] !== x.Q[s][a]).map((a) => [s, a]));
      if (moved.some(([s, a]) => Math.abs(x.Q[s][a] - x.Q2[s][a] - loss) > 1e-6 || ![A2, S0].includes(cliff.stepEnv(s, a).s2) && !(s === A2 && a === RIGHT))) console.warn("Wall figure: R-Max's first bump does not lower only the moves into A2 and A1, all by as much");
      rSlides.push({ title: tr("Into the wall", "Contra la pared"), builds: [
        chooseB(i),
        takeB(i),
        countB(i, tr(`It counts what happened: <i>N</i>(${nm(A2, RIGHT)}) = ${x.n}, and ${x.n - passes} of those ${x.n} tries led back to A2.`,
          `Cuenta lo que pasó: <i>N</i>(${nm(A2, RIGHT)}) = ${x.n}, y ${x.n - passes} de esos ${x.n} intentos llevó de vuelta a A2.`), pEq(i)),
        viB(i, tr(`Value iteration runs on the new model. Right still gets through ${passes} times in ${x.n}, so it loses only ${num(loss)}: it is worth ${num(x.Q2[A2][RIGHT])}, still the best move in A2. Every move that leads into A2, or back to A1, loses as much: the values outlined in green.`,
          `Value iteration corre sobre el nuevo modelo. Derecha todavía pasa ${passes} veces de ${x.n}, así que pierde solo ${num(loss)}: vale ${num(x.Q2[A2][RIGHT])}, y sigue siendo el mejor movimiento en A2. Todo movimiento que lleva a A2, o de vuelta a A1, pierde lo mismo: los valores con borde verde.`), rightEq(i)),
      ] });
    }
    {
      const i = bumps[1], x = X(i);
      rSlides.push({ title: tr("Again", "Otra vez"), builds: [moveB(i, tr(` Counting it lowers right to ${num(x.Q2[A2][RIGHT])}: it got through ${passes} times in ${x.n}.`, ` Contarlo baja derecha a ${num(x.Q2[A2][RIGHT])}: pasó ${passes} veces de ${x.n}.`), rightEq(i))] });
    }
    {
      // The bump after which right ties with up: the model expects as many tries to get through as cost the 2 moves that
      // going around adds.
      const i = bumps.find((j) => X(j).Q2[A2][RIGHT] === X(j).Q2[A2][UP]), x = X(i), m = x.n - passes;
      if (i === undefined || m !== 2 * passes) console.warn("Wall figure: R-Max's values tie after other than twice as many bumps as passes");
      rSlides.push({ title: tr("As costly as going around", "Tan caro como rodear"), builds: [moveB(i, tr(
        ` After ${m} bumps, the model expects ${x.n}/${passes} = ${x.n / passes} tries to get through, each costing a move: 2 more than before the wall, as many as going around adds. Right and up tie at ${num(x.Q2[A2][UP])}.`,
        ` Después de ${m} choques, el modelo espera ${x.n}/${passes} = ${x.n / passes} intentos para pasar, cada uno a costa de un movimiento: 2 más que antes de la pared, tantos como suma rodearla. Derecha y arriba empatan en ${num(x.Q2[A2][UP])}.`), rightEq(i))] });
    }
    {
      // The last bump: the tie broken toward the wall once more.
      const i = bumps.at(-1), x = X(i);
      if (!x.ties.includes(UP) || !(x.Q2[A2][RIGHT] < x.Q2[A2][UP]) || X(i + 1).a !== UP || moved(i).length !== 1) console.warn("Wall figure: R-Max's last bump is not a tie broken toward the wall, changing right alone");
      rSlides.push({ title: tr("One bump more", "Un choque más"), builds: [moveB(i, tr(` Now right is worth ${num(x.Q2[A2][RIGHT])}, below up: going around is cheaper. A2 keeps its ${num(x.Q2[A2][UP])} through up, so no other value changes.`, ` Ahora derecha vale ${num(x.Q2[A2][RIGHT])}, menos que arriba: rodear sale más barato. A2 conserva sus ${num(x.Q2[A2][UP])} por arriba, así que ningún otro valor cambia.`), rightEq(i))] });
    }
    {
      // Around the wall, to the end of the episode; every later trip while the wall stands goes around.
      const x = X(e11), later = Object.entries(L).filter(([e]) => +e > UP_EP && +e < DOWN_EP);
      if (later.some(([, l]) => l !== 9) || R.some((y) => y.ep > UP_EP && y.s2 === y.s && y.s === A2 && y.a === RIGHT)) console.warn("Wall figure: R-Max's trips with the wall do not all go around");
      rSlides.push({ title: tr("Around the wall", "Rodeando la pared"), builds: [{ ...pos(e11), time: x.t + 1, Q: x.Q2, agent: G, walls: WALL, route: trip(R, UP_EP), line: tr(
        `It went around the wall: episode ${UP_EP} took ${L[UP_EP]} moves, ${bumps.length} of them into the wall. While the wall stands, every trip goes around, 9 moves.`,
        `Rodeó la pared: el episodio ${UP_EP} tomó ${L[UP_EP]} movimientos, ${bumps.length} de ellos contra la pared. Mientras la pared siga en pie, cada viaje la rodea, 9 movimientos.`) }] });
    }
    {
      // The wall comes down; in A2, R-Max goes up.
      const x = X(e20), y = X(i21 + 1), o = y.Q[A2], through = R[bumps.at(-1)].outs.find((u) => u.s2 === B2).c, n = R[bumps.at(-1)].n;
      if (y.s !== A2 || y.a !== UP) console.warn("Wall figure: R-Max does not go up from A2 after the wall comes down");
      rSlides.push({ title: tr("The wall comes down", "Cae la pared"), builds: [
        { label: before(DOWN_EP), ep: DOWN_EP, at: e20, Q: x.Q2, agent: S0, line: tr(
          `Before episode ${DOWN_EP}, the wall comes down: the edge is open again. Nothing in R-Max's model says so.`,
          `Antes del episodio ${DOWN_EP}, cae la pared: el borde vuelve a estar abierto. Nada en el modelo de R-Max lo dice.`) },
        moveB(i21, tr(` Counting it changes nothing.`, ` Contarlo no cambia nada.`)),
        { ...chooseB(i21 + 1), line: `${cliff.reason(o, false, y.s, y.a, y.t)} ${tr(`Right is worth ${num(o[RIGHT])}: the model says it gets through only ${through} times in ${n}.`, `Derecha vale ${num(o[RIGHT])}: el modelo dice que pasa solo ${through} veces de ${n}.`)}`,
          eq: `<i>P</i>(B2, −1 | ${nm(A2, RIGHT)}) <span class="nowrap">= ${frac(through, n)}</span>` },
      ] });
    }
    {
      // The end: R-Max never tries right in A2 again, so its values never change again.
      const x = X(rLast), around = Object.entries(L).filter(([e]) => +e > UP_EP), through = R[bumps.at(-1)].outs.find((u) => u.s2 === B2).c, n = R[bumps.at(-1)].n;
      if (around.some(([, l]) => l !== 9) || R.some((y) => y.ep > UP_EP && y.s === A2 && y.a === RIGHT) || JSON.stringify(X(epEnd(UP_EP + 1)).V2) !== JSON.stringify(x.V2)) console.warn("Wall figure: R-Max's model or trips change after the wall comes down");
      rSlides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...pos(rLast), time: x.t + 1, Q: x.Q2, agent: G, route: trip(R, EPISODES), line: tr(
        `Every trip since episode ${UP_EP + 1} has gone around, 9 moves, though the edge has been open since episode ${DOWN_EP}. R-Max would learn that only by trying right in A2, and its values, which say right gets through ${through} times in ${n}, never call for it: they cannot change unless it does.`,
        `Cada viaje desde el episodio ${UP_EP + 1} ha rodeado, 9 movimientos, aunque el borde está abierto desde el episodio ${DOWN_EP}. R-Max solo lo sabría probando derecha en A2, y sus valores, que dicen que derecha pasa ${through} veces de ${n}, nunca lo piden: no pueden cambiar mientras no lo haga.`) }] });
    }
    addSkips(rSlides, X);
    learnSkip(rSlides[1]);
    // The skip over R-Max's bumps says what the agent does while the move count climbs.
    {
      const sl = rSlides.find((x) => x.skip && x.builds[0].at === bumps.find((j) => X(j).Q2[A2][RIGHT] === X(j).Q2[A2][UP]));
      sl.skip.text = tr(`${sl.skip.moves} bumps later`, `${sl.skip.moves} choques después`);
      sl.skip.note = tr(`The agent hits the wall again and again, and stays in A2: ${sl.skip.moves} moves go by.`, `El agente choca con la pared una y otra vez, y se queda en A2: pasan ${sl.skip.moves} movimientos.`);
    }
  }

  /* ---------- Dyna-Q ---------- */

  const NPLAN = 10, D = [];
  {
    const ALPHA = 0.5, EPS = 0.1, SEED = 92461, rnd = rngFrom(SEED), Q = fresh(), model = new Map(), seen = [], taken = new Map();
    for (let ep = 1; ep <= EPISODES; ep++) {
      let s = S0, t = 0;
      while (true) {
        const pre = copy(Q), c = epsGreedy(Q, s, EPS, rnd), o = stepW(s, c.a, ep);
        const maxNext = o.done ? 0 : Math.max(...Q[o.s2]), old = Q[s][c.a];
        Q[s][c.a] = old + ALPHA * (o.r + maxNext - old);
        const direct = { old, nu: Q[s][c.a], maxNext, Q: copy(Q) };
        model.set(s * 4 + c.a, { r: o.r, s2: o.s2, done: o.done });
        if (!taken.has(s)) { taken.set(s, []); seen.push(s); }
        if (!taken.get(s).includes(c.a)) taken.get(s).push(c.a);
        const plans = [];
        for (let k = 0; k < NPLAN; k++) {
          const ps = seen[Math.floor(rnd() * seen.length)], acts = taken.get(ps), pa = acts[Math.floor(rnd() * acts.length)];
          const m = model.get(ps * 4 + pa), mx = m.done ? 0 : Math.max(...Q[m.s2]), po = Q[ps][pa];
          Q[ps][pa] = po + ALPHA * (m.r + mx - po);
          plans.push({ s: ps, a: pa, old: po, nu: Q[ps][pa] });
        }
        D.push({ ep, t, s, a: c.a, explored: c.explored, ...o, pre, direct, plans, inModel: new Set(model.keys()), post: copy(Q) });
        if (o.done) break;
        s = o.s2; t++;
      }
    }
  }
  const dSlides = [], dX = (i) => D[i], dLast = D.length - 1;
  const dFrame = (m) => {
    const x = dX(m), y = m < dLast ? dX(m + 1) : null;
    return { Q: x.post, agent: after(x), ring: x.fell, ep: x.ep, move: x.t + 1, time: x.t + 1, walls: wallsAt(x.ep), bumpPose: shake(x, m), shown: x.inModel, marks: [{ c: x.s, a: x.a, kind: "upd" }], pick: y && y.ep === x.ep ? [y.s, y.a] : undefined };
  };
  {
    const X = dX, pos = (i) => ({ ep: X(i).ep, move: X(i).t + 1, at: i }), L = lens(D);
    const epEnd = (e) => D.findLastIndex((x) => x.ep === e), epStart = (e) => D.findIndex((x) => x.ep === e);
    const e10 = epEnd(UP_EP - 1), i11 = epStart(UP_EP), e11 = epEnd(UP_EP), e20 = epEnd(DOWN_EP - 1), i21 = epStart(DOWN_EP);
    const bumps = D.flatMap((x, i) => (x.ep === UP_EP && x.s === A2 && x.a === RIGHT && x.s2 === A2 ? [i] : []));
    const back = D.findIndex((x) => x.ep >= DOWN_EP && x.s === A2 && x.a === RIGHT);
    const shownBefore = (i) => (i > 0 ? X(i - 1).inModel : new Set());
    const directEq = (x) => `<span class="upd"><i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)})</span> <span class="nowrap">← ${num(x.direct.old)} + 0.5[<span class="pt">${num(x.r)}${x.done ? "" : ` + ${par(x.direct.maxNext)}`}</span></span> <span class="nowrap">− ${par(x.direct.old)}]</span> <span class="nowrap">${eqv(x.direct.nu)}</span>`;
    const chooseB = (i) => { const x = X(i); return { ...pos(i), time: x.t, Q: x.pre, agent: x.s, jump: x.t === 0, pick: [x.s, x.a], shown: shownBefore(i), walls: wallsAt(x.ep), line: cliff.reason(x.pre[x.s], x.explored, x.s, x.a, x.t) }; };
    const takeB = (i) => { const x = X(i), bump = x.s2 === x.s ? x.a : null; return { ...pos(i), time: x.t, Q: x.pre, agent: after(x), taken: [x.s, x.a], bump, sound: bump !== null ? "wall" : undefined, shown: shownBefore(i), walls: wallsAt(x.ep), line: cliff.takeText(x) }; };
    // The direct update, as in Q-learning: the best moves of S′ in red, the pair in green.
    const updateB = (i, line) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.direct.Q, agent: after(x), shown: x.inModel, walls: wallsAt(x.ep), marks: [...tgOf(x.pre, x.s2, x.done), { c: x.s, a: x.a, kind: "upd" }], line, eq: directEq(x), fit: true }; };
    // The model remembers the move, outlined in blue.
    const modelB = (i, line) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.direct.Q, agent: after(x), shown: x.inModel, walls: wallsAt(x.ep), marks: [{ c: x.s, a: x.a, kind: "step" }], line,
      eq: `<i>Model</i>(${sym("S", x.t)}, ${sym("A", x.t)}) ← ${sym("R", x.t + 1)}, ${sym("S", x.t + 1)} <span class="nowrap">= ${num(x.r)}, ${cn(x.s2)}</span>` }; };
    // The planning steps after move i, the moves they replayed in green.
    const plansB = (i, line) => { const x = X(i); return { ...pos(i), time: x.t + 1, Q: x.post, agent: after(x), shown: x.inModel, walls: wallsAt(x.ep), marks: uniq(x.plans.map((p) => [p.s, p.a])).map(([c, a]) => ({ c, a, kind: "upd" })), line }; };
    // A whole move in one press: chosen, taken, updated, remembered, and followed by its planning steps.
    const moveB = (i, rest) => { const x = X(i), tk = takeB(i); return { ...pos(i), time: x.t + 1, Q: x.post, agent: after(x), taken: tk.taken, bump: tk.bump, sound: tk.sound, shown: x.inModel, walls: wallsAt(x.ep),
      marks: uniq([[x.s, x.a], ...x.plans.map((p) => [p.s, p.a])]).map(([c, a]) => ({ c, a, kind: "upd" })), line: `${cliff.chooseTakeText(x.pre[x.s], x.explored, x)}${rest}` }; };
    const replays = (i) => X(i).plans.filter((p) => p.s === A2 && p.a === RIGHT).length;
    const x0 = X(e10), edge = cliff.greedyPath(x0.post);
    dSlides.push({ title: tr("Dyna-Q on the cliff", "Dyna-Q en el acantilado"), builds: [{ label: before(1), ep: 1, at: -1, Q: fresh(), agent: S0, shown: new Set(), line: tr(
      `All values start at 0, and the model is empty. Before the wall goes up, Dyna-Q learns the cliff for ${UP_EP - 1} episodes.`,
      `Todos los valores parten en 0, y el modelo está vacío. Antes de que se levante la pared, Dyna-Q aprende el acantilado durante ${UP_EP - 1} episodios.`) }] });
    if (x0.inModel.size !== STATES.length * 4 || !edge || edge.length !== 8) console.warn("Wall figure: Dyna-Q does not hold every move and follow the edge before the wall");
    dSlides.push({ title: tr(`Dyna-Q after ${UP_EP - 1} episodes`, `Dyna-Q después de ${UP_EP - 1} episodios`), builds: [{ label: before(UP_EP), ep: UP_EP, at: e10, Q: x0.post, agent: S0, shown: x0.inModel, route: edge, line: tr(
      `Its model holds all ${STATES.length * 4} moves, and its best moves follow the edge, 7 moves. The model says right from A2 leads to B2.`,
      `Su modelo guarda los ${STATES.length * 4} movimientos, y sus mejores movimientos siguen el borde, 7 movimientos. El modelo dice que derecha desde A2 lleva a B2.`),
      eq: `<i>Model</i>(${nm(A2, RIGHT)}) = −1, B2` }] });
    dSlides.push({ title: tr("A wall goes up", "Se levanta una pared"), builds: [
      { label: before(UP_EP), ep: UP_EP, at: e10, Q: x0.post, agent: S0, shown: x0.inModel, walls: WALL, line: tr(
        `Before episode ${UP_EP}, a wall goes up between A2 and B2, across the edge. Nothing in Dyna-Q's model says so.`,
        `Antes del episodio ${UP_EP}, se levanta una pared entre A2 y B2, cruzando el borde. Nada en el modelo de Dyna-Q lo dice.`) },
      moveB(i11, tr(` Then its update, the model and ${NPLAN} planning steps.`, ` Luego su actualización, el modelo y ${NPLAN} pasos de planning.`)),
    ] });
    {
      const i = bumps[0], x = X(i), k = replays(i);
      dSlides.push({ title: tr("Into the wall", "Contra la pared"), builds: [
        chooseB(i),
        takeB(i),
        updateB(i, tr(`The target is −1 plus the best value in A2, where the agent still stands, outlined in red: right itself, ${num(x.direct.maxNext)}. <i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) moves halfway toward ${num(x.r + x.direct.maxNext)}: ${num(x.direct.nu)}.`,
          `El objetivo es −1 más el mejor valor en A2, donde el agente sigue, con borde rojo: derecha misma, ${num(x.direct.maxNext)}. <i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) avanza la mitad del camino hacia ${num(x.r + x.direct.maxNext)}: ${num(x.direct.nu)}.`)),
        modelB(i, tr(`The model keeps only the last outcome: from now on it says right from A2 hits the wall, outlined in blue, and every planning step that replays the move replays a bump.`,
          `El modelo guarda solo el último resultado: desde ahora dice que derecha desde A2 choca con la pared, con borde azul, y cada paso de planning que repite el movimiento repite un choque.`)),
        plansB(i, tr(`Then ${NPLAN} planning steps, on moves picked at random, in green${k ? `; ${k === 1 ? "one replays" : `${k} replay`} right from A2` : ""}.`,
          `Luego ${NPLAN} pasos de planning, en movimientos elegidos al azar, en verde${k ? `; ${k === 1 ? "uno repite" : `${k} repiten`} derecha desde A2` : ""}.`)),
      ] });
    }
    for (const [j, i] of bumps.slice(1).entries()) {
      const x = X(i), lastBump = j === bumps.length - 2;
      if (lastBump && !(x.post[A2][RIGHT] < x.post[A2][UP] && X(i + 1).a === UP)) console.warn("Wall figure: Dyna-Q's last bump does not leave up better than right");
      dSlides.push({ title: lastBump ? tr("Up is better now", "Ahora arriba es mejor") : tr("Again", "Otra vez"), builds: [moveB(i, lastBump
        ? tr(` Right falls to ${num(x.post[A2][RIGHT])}, below up's ${num(x.post[A2][UP])}.`, ` Derecha baja a ${num(x.post[A2][RIGHT])}, menos que los ${num(x.post[A2][UP])} de arriba.`)
        : tr(` Right falls to ${num(x.post[A2][RIGHT])}.`, ` Derecha baja a ${num(x.post[A2][RIGHT])}.`))] });
    }
    {
      const x = X(e11);
      if (D.some((y) => y.ep > UP_EP && y.s2 === y.s && y.s === A2 && y.a === RIGHT && wallOn(y.ep))) console.warn("Wall figure: Dyna-Q hits the wall after episode 11");
      dSlides.push({ title: tr("Around the wall", "Rodeando la pared"), builds: [{ ...pos(e11), time: x.t + 1, Q: x.post, agent: G, shown: x.inModel, walls: WALL, route: trip(D, UP_EP), line: tr(
        `It went around the wall: episode ${UP_EP} took ${L[UP_EP]} moves, ${bumps.length} of them into the wall. While the wall stands, it never hits it again.`,
        `Rodeó la pared: el episodio ${UP_EP} tomó ${L[UP_EP]} movimientos, ${bumps.length} de ellos contra la pared. Mientras la pared siga en pie, no vuelve a chocar con ella.`) }] });
    }
    {
      const x = X(e20), y = X(i21 + 1), o = y.pre[A2];
      if (y.s !== A2 || y.a !== UP || y.explored || X(i21).explored) console.warn("Wall figure: Dyna-Q does not go up from A2 by choice after the wall comes down");
      dSlides.push({ title: tr("The wall comes down", "Cae la pared"), builds: [
        { label: before(DOWN_EP), ep: DOWN_EP, at: e20, Q: x.post, agent: S0, shown: x.inModel, line: tr(
          `Before episode ${DOWN_EP}, the wall comes down: the edge is open again. Nothing in Dyna-Q's model says so.`,
          `Antes del episodio ${DOWN_EP}, cae la pared: el borde vuelve a estar abierto. Nada en el modelo de Dyna-Q lo dice.`) },
        moveB(i21, tr(` Then its update, the model and ${NPLAN} planning steps.`, ` Luego su actualización, el modelo y ${NPLAN} pasos de planning.`)),
        { ...chooseB(i21 + 1), line: `${cliff.reason(o, false, y.s, y.a, y.t)} ${tr(`Right is worth ${num(o[RIGHT])}: the model says it hits the wall.`, `Derecha vale ${num(o[RIGHT])}: el modelo dice que choca con la pared.`)}`,
          eq: `<i>Model</i>(${nm(A2, RIGHT)}) = −1, A2` },
      ] });
    }
    {
      // A random move tries right in A2 again; until then, right was never the best move there.
      const i = back, x = X(i), from = D.findIndex((y) => y.ep >= DOWN_EP);
      if (i < 0 || !x.explored || D.slice(from, i).some((y) => y.s === A2 && y.pre[A2][RIGHT] >= Math.max(...y.pre[A2]))) console.warn("Wall figure: Dyna-Q finds the edge open other than by a random move");
      dSlides.push({ title: tr("A random move", "Un movimiento al azar"), builds: [
        chooseB(i),
        { ...takeB(i), line: `${cliff.takeText(x)} ${tr("The wall is gone.", "La pared ya no está.")}` },
        updateB(i, tr(`The target is −1 plus the best value in B2, outlined in red, ${num(x.direct.maxNext)}. <i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) moves halfway from ${num(x.direct.old)} toward ${num(x.r + x.direct.maxNext)}: ${num(x.direct.nu)}, above up's ${num(x.direct.Q[A2][UP])}.`,
          `El objetivo es −1 más el mejor valor en B2, con borde rojo, ${num(x.direct.maxNext)}. <i>Q</i>(${sym("S", x.t)}, ${sym("A", x.t)}) avanza la mitad del camino de ${num(x.direct.old)} hacia ${num(x.r + x.direct.maxNext)}: ${num(x.direct.nu)}, más que los ${num(x.direct.Q[A2][UP])} de arriba.`)),
        modelB(i, tr(`The model is rewritten: right from A2 leads to B2 again, outlined in blue.`, `El modelo se reescribe: derecha desde A2 vuelve a llevar a B2, con borde azul.`)),
        plansB(i, tr(`Then ${NPLAN} planning steps, in green.`, `Luego ${NPLAN} pasos de planning, en verde.`)),
      ] });
    }
    {
      // The end: from the episode of the random move on, every trip takes the edge.
      const x = X(dLast), e = X(back).ep, edgeEnd = cliff.greedyPath(x.post);
      if (Object.entries(L).some(([k, l]) => +k >= e && l !== 7) || !edgeEnd || edgeEnd.length !== 8) console.warn("Wall figure: Dyna-Q's trips after the random move do not all take the edge");
      dSlides.push({ title: tr(`After ${EPISODES} episodes`, `Después de ${EPISODES} episodios`), builds: [{ ...pos(dLast), time: x.t + 1, Q: x.post, agent: G, shown: x.inModel, route: edgeEnd, line: tr(
        `From episode ${e} on, every trip has taken the edge, 7 moves. Dyna-Q found it open by a random move in episode ${e}, when the wall had been gone for ${e - DOWN_EP} episodes: it moves at random one time in ten, and picks right one time in four, so it tries right in A2 on one visit in 40.`,
        `Desde el episodio ${e}, cada viaje ha tomado el borde, 7 movimientos. Dyna-Q lo encontró abierto con un movimiento al azar en el episodio ${e}, cuando ya llevaba ${e - DOWN_EP} episodios sin pared: se mueve al azar una vez de cada diez, y elige derecha una vez de cada cuatro, así que prueba derecha en A2 una vez de cada 40 visitas.`) }] });
    }
    addSkips(dSlides, X);
    learnSkip(dSlides[1]);
    downSkip(dSlides[dSlides.findIndex((s) => s.builds[0].label === before(DOWN_EP))]);
  }
  downSkip(rSlides[rSlides.findIndex((s) => s.builds[0].label === before(DOWN_EP))]);

  const fig = slideshow({ svg: document.getElementById("fig-wall"), slides: rSlides, frame: rFrame, world: cliff });
  modeButtons(document.getElementById("fig-wall-modes"), (mode) => (mode === "dyna" ? fig.show(dSlides, dFrame) : fig.show(rSlides, rFrame)));
}
