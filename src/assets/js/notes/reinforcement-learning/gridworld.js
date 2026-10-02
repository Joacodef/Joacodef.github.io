import { el, tr } from "../../plane.js";

/* ---------- Grid worlds for the reinforcement learning figures ---------- */

// Shared by the figures that step through a run like slides, one line of their algorithm per press (Monte Carlo
// prediction and control and TD(0) on the cookie grid; Sarsa, Q-learning, n-step Sarsa and Sarsa(λ) on the cliff): the
// two worlds, the texts for choosing and taking a move, the grid of values, the sounds and the controls. Each figure
// computes its own run and its slides, and hands them to slideshow().

export const ACTS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const NAME = [tr("up", "arriba"), tr("right", "derecha"), tr("down", "abajo"), tr("left", "izquierda")];
// mulberry32, a small seeded generator, so that every reader sees the same run.
export function rngFrom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
// ε-greedy with ties broken at random; says whether the action was a random one.
export function epsGreedy(Q, s, eps, rnd) {
  if (rnd() < eps) return { a: Math.floor(rnd() * 4), explored: true };
  const m = Math.max(...Q[s]); const best = [0, 1, 2, 3].filter((b) => Q[s][b] === m);
  return { a: best[Math.floor(rnd() * best.length)], explored: false };
}

/* ---------- Text ---------- */

export const num = (v) => String(Math.round(v * 100) / 100).replace("-", "−");
export const par = (v) => (v < 0 ? `(${num(v)})` : num(v));
export const eqv = (v) => (Math.abs(Math.round(v * 100) / 100 - v) > 1e-9 ? "≈ " : "= ") + num(v);
export const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// A list in running text: "up and left", "up, right, and left"; in Spanish "arriba y derecha", with "e" before an i.
export function listAnd(xs) {
  if (xs.length === 1) return xs[0];
  const end = xs[xs.length - 1], and = tr("and", /^i/.test(end) ? "e" : "y");
  return xs.length === 2 ? `${xs[0]} ${and} ${end}` : `${xs.slice(0, -1).join(", ")}${tr(",", "")} ${and} ${end}`;
}
// The same after a negation: "A3 or B3"; in Spanish "A3 ni B3".
export function listOr(xs) {
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")}${xs.length > 2 ? tr(",", "") : ""} ${tr("or", "ni")} ${xs[xs.length - 1]}`;
}
// A symbol with its time index, such as S with t = 0: S₀.
export const sym = (L, t) => `<i>${L}</i><sub>${t}</sub>`;
// The status line: episode, move and time; after an episode ends, the steps of its sweep back (stage "after").
const status = (ep, move, time, stage) => (stage === "after" ? tr(`Episode ${ep}, after it ends`, `Episodio ${ep}, después del final`)
  : move ? tr(`Episode ${ep}, move ${move}`, `Episodio ${ep}, movimiento ${move}`) : tr("Episode 1, before the first move", "Episodio 1, antes del primer movimiento")) + ` · <i>t</i> = ${time}`;

/* ---------- Worlds ---------- */

// A grid world: W columns (A, B, …) and H rows (1 at the bottom), with cells numbered from 0 at the top left, row by
// row. The agent starts in start, and reaching goal ends the episode with goalReward; every other move gives step, a
// move into a wall leaves the agent where it is, and a step into a cliff cell gives fall and sends it back to start.
// cell is the size of a cell in the drawing, and decimals the most a value shows on a phone.
function makeWorld({ W, H, start, goal, cliff = [], step, goalReward = step, fall = -100, goalName = null, cell = 60, decimals = 1 }) {
  const isCliff = (s) => cliff.includes(s);
  const cellName = (s) => "ABCDEF"[s % W] + (H - Math.floor(s / W));
  const moveName = (s, a) => `${cellName(s)} ${NAME[a]}`;
  function stepEnv(s, a) {
    const x = s % W, y = Math.floor(s / W);
    const n = Math.min(H - 1, Math.max(0, y + ACTS[a][1])) * W + Math.min(W - 1, Math.max(0, x + ACTS[a][0]));
    if (isCliff(n)) return { s2: start, r: fall, fell: n, done: false };
    return { s2: n, r: n === goal ? goalReward : step, fell: null, done: n === goal };
  }
  const freshQ = () => Array.from({ length: W * H }, () => [0, 0, 0, 0]);
  // The cells the best moves lead through from the start, or null when they do not reach the goal.
  function greedyPath(Q) {
    let s = start; const path = [s], seen = new Set([s]);
    for (let k = 0; k < W * H; k++) {
      const m = Math.max(...Q[s]); const a = Q[s].indexOf(m); const o = stepEnv(s, a);
      if (o.fell !== null) return null; s = o.s2; path.push(s);
      if (s === goal) return path; if (seen.has(s)) return null; seen.add(s);
    }
    return null;
  }
  // The cells state values lead through from the start: in each cell, the move with the largest reward plus γ times the
  // next cell's value (0 at the goal), or null when they loop.
  function valuePath(V, gamma) {
    let s = start; const path = [s];
    for (let k = 0; k < W * H; k++) {
      const score = (a) => { const o = stepEnv(s, a); return o.fell !== null ? -Infinity : o.r + (o.done ? 0 : gamma * V[o.s2]); };
      const n = stepEnv(s, [0, 1, 2, 3].reduce((b, a) => (score(a) > score(b) ? a : b), 0)).s2;
      if (n === s || path.includes(n)) return null;
      path.push(n); if (n === goal) return path; s = n;
    }
    return null;
  }
  // Why a move was chosen in state s at time t, from the values pre it was chosen from: a random move, a tie, or the best.
  function reason(pre, explored, s, a, t) {
    const m = Math.max(...pre), A = sym("A", t), go = NAME[a], ties = [0, 1, 2, 3].filter((b) => pre[b] === m);
    const clause = explored ? tr(`it makes a random move, which happens one time in ten: ${A} = ${go}`, `hace un movimiento al azar, algo que pasa una vez de cada diez: ${A} = ${go}`)
      : ties.length === 4 ? tr(`all four moves are worth ${num(m)}, a tie, so it picks one at random: ${A} = ${go}`, `los cuatro movimientos valen ${num(m)}, un empate, así que elige uno al azar: ${A} = ${go}`)
      : ties.length > 1 ? tr(`${listAnd(ties.map((b) => NAME[b]))} tie for the best value, ${num(m)}, so it picks one of them at random: ${A} = ${go}`, `${listAnd(ties.map((b) => NAME[b]))} empatan con el mejor valor, ${num(m)}, así que elige uno de ellos al azar: ${A} = ${go}`)
      : tr(`its best move is ${A} = ${go}, worth ${num(m)}`, `su mejor movimiento es ${A} = ${go}, que vale ${num(m)}`);
    return tr(`In ${sym("S", t)} = ${cellName(s)}, ${clause}.`, `En ${sym("S", t)} = ${cellName(s)}, ${clause}.`);
  }
  // What happened when the move at time t was taken: from s with action a, to s2, maybe into the cliff or the goal.
  function takeText({ s, a, t, s2, fell }) {
    const nw = (x) => `<span class="nowrap">${x}</span>`, A = nw(`${sym("A", t)} = ${NAME[a]}`), r = num(stepEnv(s, a).r);
    const R = (v) => nw(`${sym("R", t + 1)} = ${v}`), S1 = (c) => nw(`${sym("S", t + 1)} = ${c}`);
    return fell !== null && fell !== undefined ? tr(`It takes ${A} and steps off into the cliff: ${R(r)}, and it is sent back to the start, so ${S1(cellName(start))}.`, `Toma ${A} y cae al acantilado: ${R(r)}, y vuelve al inicio, así que ${S1(cellName(start))}.`)
      : s2 === s ? tr(`It takes ${A}, hits the wall and stays where it is: ${R(r)} and ${S1(cellName(s))}.`, `Toma ${A}, choca con la pared y se queda donde está: ${R(r)} y ${S1(cellName(s))}.`)
      : s2 === goal && goalName ? tr(`It takes ${A} and reaches the ${goalName}: ${R(r)}.`, `Toma ${A} y llega a la ${goalName}: ${R(r)}.`)
      : tr(`It takes ${A} and moves to ${S1(cellName(s2))}: ${R(r)}.`, `Toma ${A} y pasa a ${S1(cellName(s2))}: ${R(r)}.`);
  }
  // Choosing and taking a move in one press, once the first moves have gone through every line: why the move was chosen,
  // from the values pre, then where it led.
  function chooseTakeText(pre, explored, { s, a, t, s2, fell }) {
    const nw = (x) => `<span class="nowrap">${x}</span>`, R = nw(`${sym("R", t + 1)} = ${num(stepEnv(s, a).r)}`), S1 = (c) => nw(`${sym("S", t + 1)} = ${c}`);
    const then = fell !== null && fell !== undefined ? tr(`It steps off into the cliff: ${R}, and it is sent back to the start, so ${S1(cellName(start))}.`, `Cae al acantilado: ${R}, y vuelve al inicio, así que ${S1(cellName(start))}.`)
      : s2 === s ? tr(`It hits the wall and stays where it is: ${R} and ${S1(cellName(s))}.`, `Choca con la pared y se queda donde está: ${R} y ${S1(cellName(s))}.`)
      : s2 === goal && goalName ? tr(`It reaches the ${goalName}: ${R}.`, `Llega a la ${goalName}: ${R}.`)
      : s2 === goal ? tr(`It reaches the goal: ${R}.`, `Llega a la meta: ${R}.`)
      : tr(`It moves to ${S1(cellName(s2))}: ${R}.`, `Pasa a ${S1(cellName(s2))}: ${R}.`);
    return `${reason(pre, explored, s, a, t)} ${then}`;
  }
  // The same for a policy that picks each move at random: the pick alone, and, once choosing and taking share a press,
  // the pick with what followed.
  function randomPick({ s, a, t }) {
    const A = `<span class="nowrap">${sym("A", t)} = ${NAME[a]}</span>`;
    return tr(`In ${sym("S", t)} = ${cellName(s)}, the policy picks one of the four moves at random: ${A}.`, `En ${sym("S", t)} = ${cellName(s)}, la política elige uno de los cuatro movimientos al azar: ${A}.`);
  }
  function randomTake({ s, a, t, s2 }) {
    const nw = (x) => `<span class="nowrap">${x}</span>`, S0 = `${sym("S", t)} = ${cellName(s)}`, A = nw(`${sym("A", t)} = ${NAME[a]}`);
    const R = nw(`${sym("R", t + 1)} = ${num(stepEnv(s, a).r)}`), S1 = nw(`${sym("S", t + 1)} = ${cellName(s2)}`);
    return s2 === goal && goalName ? tr(`In ${S0}, the policy picks ${A} at random, which reaches the ${goalName}: ${R}.`, `En ${S0}, la política elige al azar ${A}, que llega a la ${goalName}: ${R}.`)
      : s2 === s ? tr(`In ${S0}, the policy picks ${A} at random, into the wall, so the agent stays: ${R} and ${S1}.`, `En ${S0}, la política elige al azar ${A}, contra la pared, así que el agente se queda: ${R} y ${S1}.`)
      : tr(`In ${S0}, the policy picks ${A} at random, and the agent moves to ${S1}: ${R}.`, `En ${S0}, la política elige al azar ${A}, y el agente pasa a ${S1}: ${R}.`);
  }
  return { W, H, START: start, GOAL: goal, isCliff, cellName, moveName, stepEnv, freshQ, greedyPath, valuePath, reason, takeText, chooseTakeText, randomPick, randomTake, cell, decimals, goalName, goalReward };
}
// The cliff: 6 × 4, from A1 to F1, with the cliff from B1 to E1; every move gives −1.
export const cliff = makeWorld({ W: 6, H: 4, start: 18, goal: 23, cliff: [19, 20, 21, 22], step: -1 });
// The cookie grid: 3 × 3, from A1 to the cookie in C3, which gives +1; every other move gives 0.
export const cookie = makeWorld({ W: 3, H: 3, start: 6, goal: 2, step: 0, goalReward: 1, goalName: tr("cookie", "galleta"), cell: 120, decimals: 2 });
// The cliff's own names, which the cliff figures import.
export const { W, H, START, GOAL, isCliff, cellName, moveName, stepEnv, freshQ, greedyPath, reason, takeText, chooseTakeText } = cliff;

/* ---------- Drawing ---------- */

// Each cell the agent can stand on is split by its diagonals into four triangles, one per move (up, right, down, left,
// as in ACTS), each showing that move's value. The best value of a cell sits on a blue highlight, and an untried move,
// still at 0, is left blank unless a target uses it. On top of that a figure marks moves: the one just chosen in yellow
// (fading as the agent takes it), updated ones in green (as strong as their trace), the one a target uses in red, and the
// steps of an n-step window in blue.
// A figure that estimates the value of each cell instead (perCell) draws no diagonals and one value per cell, above
// the agent, and its green and red marks outline the whole cell; the move just chosen is still its triangle, in yellow.
const ML = 26, MT = 10, MB = 38;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// On a phone, at most the world's decimals (one on the cliff, whose cells are small), and whole numbers from 10 on, so
// that neighbors do not run together.
const narrow = matchMedia("(max-width: 560px)");
const qText = (v, decimals) => {
  const a = Math.abs(v), r = a < 1 && (!narrow.matches || decimals > 1) ? Math.round(v * 100) / 100 : a < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return r === 0 ? (v < 0 ? "−0" : "0") : String(r).replace("-", "−");
};
const pts = (p) => p.map((q) => q.join(",")).join(" ");
// A triangle shrunk toward its middle, so that outlines of neighboring triangles do not touch.
const shrink = (p, k) => { const gx = (p[0][0] + p[1][0] + p[2][0]) / 3, gy = (p[0][1] + p[1][1] + p[2][1]) / 3; return p.map(([x, y]) => `${gx + (x - gx) * k},${gy + (y - gy) * k}`).join(" "); };

function createGrid(svg, world, perCell) {
  const { W, H, START, GOAL, isCliff, cell: C, decimals } = world, k = C / 60;
  const x0 = (s) => ML + (s % W) * C, y0 = (s) => MT + Math.floor(s / W) * C, mid = (s) => [x0(s) + C / 2, y0(s) + C / 2];
  const triPts = (c) => { const X0 = x0(c), Y0 = y0(c), [cx, cy] = mid(c); return [[[X0, Y0], [X0 + C, Y0], [cx, cy]], [[X0 + C, Y0], [X0 + C, Y0 + C], [cx, cy]], [[X0 + C, Y0 + C], [X0, Y0 + C], [cx, cy]], [[X0, Y0 + C], [X0, Y0], [cx, cy]]]; };
  // A cell's outline, inset so that it clears the cell's sides; a second mark on the same cell goes inside the first.
  const square = (c, n) => { const d = C * (0.06 + 0.06 * n), X0 = x0(c) + d, Y0 = y0(c) + d, L = C - 2 * d; return pts([[X0, Y0], [X0 + L, Y0], [X0 + L, Y0 + L], [X0, Y0 + L]]); };
  const triText = (c, a) => { const [cx, cy] = mid(c); return [[cx, y0(c) + 12 * k], [x0(c) + C - 13 * k, cy + 3.5], [cx, y0(c) + C - 4 * k], [x0(c) + 13 * k, cy + 3.5]][a]; };
  const cliffCells = [...Array(W * H).keys()].filter(isCliff);
  svg.setAttribute("viewBox", `0 0 ${ML + W * C + 8} ${MT + H * C + MB}`);
  for (let s = 0; s < W * H; s++) el("rect", { class: isCliff(s) ? "gw-cliff" : "gw-floor", x: x0(s), y: y0(s), width: C, height: C }, svg);
  // Lines between cells. On the cliff, the vertical ones stop above the bottom row, where the shading marks its edges.
  const bottom = cliffCells.length ? H - 1 : H;
  for (let i = 1; i < H; i++) el("line", { class: "gw-line", x1: ML, y1: MT + i * C, x2: ML + W * C, y2: MT + i * C }, svg);
  for (let i = 1; i < W; i++) el("line", { class: "gw-line", x1: ML + i * C, y1: MT, x2: ML + i * C, y2: MT + bottom * C }, svg);
  for (let s = 0; s < W * H; s++) {
    if (isCliff(s) || s === GOAL || perCell) continue;
    el("line", { class: "gw-diag", x1: x0(s), y1: y0(s), x2: x0(s) + C, y2: y0(s) + C }, svg);
    el("line", { class: "gw-diag", x1: x0(s) + C, y1: y0(s), x2: x0(s), y2: y0(s) + C }, svg);
  }
  el("rect", { class: "gw-frame", x: ML, y: MT, width: W * C, height: H * C }, svg);
  if (cliffCells.length) {
    const cx = cliffCells.reduce((acc, s) => acc + mid(s)[0], 0) / cliffCells.length;
    el("text", { class: "gw-lab", x: cx, y: mid(cliffCells[0])[1] + 5, "text-anchor": "middle" }, svg).textContent = tr("cliff", "acantilado");
  }
  for (let i = 0; i < W; i++) el("text", { class: "gw-axis", x: ML + i * C + C / 2, y: MT + H * C + 17, "text-anchor": "middle" }, svg).textContent = "ABCDEF"[i];
  for (let j = 0; j < H; j++) el("text", { class: "gw-axis", x: ML - 10, y: MT + j * C + C / 2 + 4, "text-anchor": "middle" }, svg).textContent = String(H - j);
  el("text", { class: "gw-sg", x: x0(START) + C / 2, y: MT + H * C + 33, "text-anchor": "middle" }, svg).textContent = tr("start", "inicio");
  // The goal: on the cookie grid, a cookie in the middle of its cell, with its reward beside it; the agent eats it on
  // reaching it, and it is back for the next episode. On the cliff, the goal is named below the grid.
  let cookie = null;
  if (world.goalName) {
    const [gx, gy] = mid(GOAL), R = C * 0.19, g = cookie = el("g", { class: "gw-cookie-g" }, svg);
    el("title", {}, g).textContent = `${world.goalName}, +${world.goalReward}`;
    // A bite, up and to the right: a circle of radius rb centered just outside the rim. The outline runs the long way
    // around the cookie between the two points where the circles cross, then back along the bite.
    const ang = -Math.PI * 2 / 9, d = R * 1.08, rb = R * 0.42, phi = Math.acos((R * R + d * d - rb * rb) / (2 * R * d));
    const P = (t) => `${gx + R * Math.cos(t)} ${gy + R * Math.sin(t)}`;
    el("path", { class: "gw-cookie", d: `M${P(ang + phi)} A${R} ${R} 0 1 1 ${P(ang - phi)} A${rb} ${rb} 0 0 0 ${P(ang + phi)} Z` }, g);
    // The chips, as fractions of the radius: across and down from the middle, and size.
    for (const [u, v, r] of [[-0.5, -0.32, 0.13], [-0.08, -0.62, 0.11], [0.56, 0.22, 0.12], [-0.52, 0.36, 0.11], [0.1, 0.6, 0.13], [0.04, 0.02, 0.1]])
      el("circle", { class: "gw-chip", cx: gx + u * R, cy: gy + v * R, r: r * R }, g);
    el("text", { class: "gw-lab", x: x0(GOAL) + C * 0.86, y: gy + 5, "text-anchor": "middle" }, svg).textContent = `+${world.goalReward}`;
  } else el("text", { class: "gw-sg", x: x0(GOAL) + C / 2, y: MT + H * C + 33, "text-anchor": "middle" }, svg).textContent = tr("goal", "meta");
  // The arrowhead of a route, named after the figure so that two figures on a page keep their own.
  const head = el("marker", { id: `${svg.id}-head`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 1.7, markerHeight: 1.7, orient: "auto" }, el("defs", {}, svg));
  el("path", { class: "gw-head", d: "M0 0 L10 5 L0 10 z" }, head);
  const dyn = el("g", {}, svg);
  const agentG = el("g", { class: "gw-agent-g" }, svg);
  const agentDot = el("circle", { class: "gw-agent", cx: 0, cy: 0, r: 8 }, agentG);
  let drawnAt = START, eating = null;
  // The cookie is there unless the agent stands on the goal. When the agent has just glided onto it, it shrinks and
  // fades as the agent arrives; with reduced motion, or going back, it simply goes.
  function showCookie(there, animate) {
    if (!cookie) return;
    eating?.cancel(); eating = null;
    cookie.style.visibility = there ? "" : "hidden";
    if (there || !animate || reducedMotion.matches) return;
    cookie.style.visibility = "";
    eating = cookie.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.3)" }], { duration: 260, delay: 200, easing: "ease-in", fill: "forwards" });
    eating.onfinish = () => { cookie.style.visibility = "hidden"; eating.cancel(); eating = null; };
  }

  // g: Q (the values drawn) or, with perCell, V (one per cell), agent (its cell), jump (move it without gliding; it
  // never glides out of the cliff), pick ([cell, action] just chosen), taken ([cell, action] the agent is taking: its
  // yellow fades as the agent glides, and without animation it is gone), marks ([{ c, a, kind, w }] with kind "upd",
  // "tg" or "step", w a trace, and no a for a mark on a whole cell), maxOf (a cell whose best moves a target uses, marked
  // in red), ring or rings (cliff cells the agent fell into), bump (the action of a wall hit) and route (the cells the
  // best moves lead through, from the start to the goal).
  function draw(g, animate) {
    const { Q, V, agent, jump, pick, taken, marks, maxOf, ring, rings, bump, route } = g;
    dyn.replaceChildren();
    if (taken && animate && !reducedMotion.matches)
      el("polygon", { class: "gw-pick", points: pts(triPts(taken[0])[taken[1]]) }, dyn).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in", fill: "forwards" });
    if (pick) el("polygon", { class: "gw-pick", points: pts(triPts(pick[0])[pick[1]]) }, dyn);
    // A route: a light blue band through the middles of its cells, under the values, its arrowhead stopping short of
    // the goal's middle, where the agent may stand; on the cookie grid, just inside the goal, clear of its name and reward.
    if (route) {
      const p = route.map(mid), [ex, ey] = p.at(-1), [px, py] = p.at(-2), d = Math.hypot(ex - px, ey - py), cut = world.goalName ? C / 2 - 6 : C * 0.2;
      p[p.length - 1] = [ex - ((ex - px) / d) * cut, ey - ((ey - py) / d) * cut];
      el("polyline", { class: "gw-route", points: pts(p), "marker-end": `url(#${svg.id}-head)` }, dyn);
    }
    const all = [...(marks || [])], red = new Set();
    // The values a route's band runs over: the move it leaves each cell by, and the one back where it enters the next.
    const onRoute = new Set();
    for (let i = 0; route && i + 1 < route.length; i++) {
      const [s, n] = [route[i], route[i + 1]], a = ACTS.findIndex(([dx, dy]) => dx === (n % W) - (s % W) && dy === Math.floor(n / W) - Math.floor(s / W));
      onRoute.add(s * 4 + a).add(n * 4 + ((a + 2) % 4));
    }
    if (maxOf !== undefined && maxOf !== null && maxOf !== GOAL) { const m = Math.max(...Q[maxOf]); Q[maxOf].forEach((v, a) => { if (v === m) all.push({ c: maxOf, a, kind: "tg" }); }); }
    // Blue steps first, then green, then red, so that the stronger marks stay on top. A move with marks of two kinds,
    // such as a pair updated toward a target that uses its own value, shows both: the later one inside the earlier.
    const order = { step: 0, upd: 1, tg: 2 }, kindsAt = new Map();
    for (const { c, a, kind, w } of all.sort((p, q) => order[p.kind] - order[q.kind])) {
      const key = a === undefined ? -1 - c : c * 4 + a, kinds = kindsAt.get(key) || new Set();
      if (kinds.has(kind)) continue;
      const k = kinds.size; kinds.add(kind); kindsAt.set(key, kinds);
      const style = w === undefined ? {} : { style: `opacity: ${Math.max(0.15, Math.min(1, w))}; stroke-width: ${2.4 * Math.min(2, Math.max(1, w))}px` };
      el("polygon", { class: `gw-mark ${kind}`, points: a === undefined ? square(c, k) : shrink(triPts(c)[a], 0.8 - 0.22 * k), ...style }, dyn);
    }
    for (const { c, a, kind } of all) if (kind === "tg") red.add(c * 4 + a);
    for (let c = 0; c < W * H; c++) {
      if (isCliff(c) || c === GOAL) continue;
      // One value per cell, above the agent, with no best value to highlight. A route's band runs over it where it leaves
      // the cell upward or enters it from above (the cell's up entry in onRoute), and there it sits on the band's color.
      if (V) {
        const on = onRoute.has(c * 4), t = el("text", { class: `gw-v${on ? " on" : ""}`, x: mid(c)[0], y: y0(c) + C * 0.3, "text-anchor": "middle" }, dyn);
        t.textContent = qText(V[c], decimals);
        if (on) { const bb = t.getBBox(); dyn.insertBefore(el("rect", { class: "gw-qback", x: bb.x - 3, y: bb.y - 0.5, width: bb.width + 6, height: bb.height + 1, rx: 3 }), t); }
        continue;
      }
      const q = Q[c], m = Math.max(...q), best = q.filter((v) => v === m).length === 1 ? q.indexOf(m) : -1;
      for (let a = 0; a < 4; a++) {
        if (q[a] === 0 && !red.has(c * 4 + a)) continue;
        const [tx, ty] = triText(c, a), t = el("text", { class: `gw-q${a === best ? " best" : onRoute.has(c * 4 + a) ? " on" : ""}`, x: tx, y: ty, "text-anchor": "middle" }, dyn);
        t.textContent = qText(q[a], decimals);
        // The best value on a blue highlight; any other value on a route on the band's color, so that it sits on the band.
        if (a === best || onRoute.has(c * 4 + a)) { const bb = t.getBBox(); dyn.insertBefore(el("rect", { class: a === best ? "gw-qbest" : "gw-qback", x: bb.x - 2.5, y: bb.y - 0.5, width: bb.width + 5, height: bb.height + 1, rx: 3 }), t); }
      }
    }
    for (const f of [ring, ...(rings || [])]) if (f !== null && f !== undefined) { const [fx, fy] = mid(f); el("circle", { class: "gw-fall", cx: fx, cy: fy, r: 13 }, dyn); }
    const [ax, ay] = mid(agent);
    agentG.classList.toggle("jump", !animate || !!jump || isCliff(drawnAt));
    agentG.style.transform = `translate(${ax}px, ${ay}px)`;
    showCookie(agent !== GOAL, animate && !jump && drawnAt !== GOAL);
    drawnAt = agent;
    // A wall hit: mark the stretch of wall, and nudge the agent toward it and back.
    if (bump !== null && bump !== undefined) {
      const [dx, dy] = ACTS[bump], [cx, cy] = mid(agent), h = C / 2, ex = cx + dx * h, ey = cy + dy * h;
      el("line", { class: "gw-wall", x1: ex - dy * (h - 12), y1: ey - dx * (h - 12), x2: ex + dy * (h - 12), y2: ey + dx * (h - 12) }, dyn);
      if (animate && !reducedMotion.matches)
        agentDot.animate([{ transform: "translate(0px, 0px)" }, { transform: `translate(${dx * 16}px, ${dy * 16}px)`, offset: 0.4 }, { transform: "translate(0px, 0px)" }], { duration: 360, easing: "ease-out" });
    }
  }
  return { draw };
}

/* ---------- Sound ---------- */

// Made in the browser: a short woody click for a move, a duller one for a wall hit, a falling tone for a fall, a soft
// crunch for a cookie eaten, and a rising chime when the run ends. They play only after Next or the right arrow key,
// and a button turns them off.
let audioCtx = null;
const ac = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());
function click(pitch = 1, level = 1) {
  const a = ac(), t = a.currentTime + 0.01;
  const len = Math.floor(a.sampleRate * 0.045), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700 * pitch; bp.Q.value = 2.5;
  const g = a.createGain(); g.gain.setValueAtTime(0.55 * level, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(bp).connect(g).connect(a.destination); src.start(t);
  const o = a.createOscillator(); o.frequency.setValueAtTime(230 * pitch, t); o.frequency.exponentialRampToValueAtTime(150 * pitch, t + 0.07);
  const g2 = a.createGain(); g2.gain.setValueAtTime(0.3 * level, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g2).connect(a.destination); o.start(t); o.stop(t + 0.12);
}
function fallSound() {
  const a = ac(), t = a.currentTime + 0.01;
  const o = a.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.5);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.6);
  const th = a.createOscillator(); th.frequency.setValueAtTime(95, t + 0.46); th.frequency.exponentialRampToValueAtTime(55, t + 0.62);
  const g2 = a.createGain(); g2.gain.setValueAtTime(0.0001, t + 0.45); g2.gain.exponentialRampToValueAtTime(0.35, t + 0.47); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.66);
  th.connect(g2).connect(a.destination); th.start(t + 0.45); th.stop(t + 0.7);
}
// Three quiet crackles of filtered noise, each a little lower, as the agent arrives at the cookie.
function crunch() {
  const a = ac(), t0 = a.currentTime + 0.2;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.075, len = Math.floor(a.sampleRate * 0.05), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2) * (Math.random() < 0.3 ? 1 : 0.25);
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2800 - i * 600; bp.Q.value = 1.1;
    const g = a.createGain(); g.gain.value = 0.3 - i * 0.06;
    src.connect(bp).connect(g).connect(a.destination); src.start(t);
  }
}
function chime() {
  const a = ac(), t = a.currentTime + 0.01;
  [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
    const o = a.createOscillator(); o.type = "triangle"; o.frequency.value = fr;
    const g = a.createGain(), st = t + i * 0.12;
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.16, st + 0.02); g.gain.exponentialRampToValueAtTime(0.001, st + (i === 3 ? 1.1 : 0.5));
    o.connect(g).connect(a.destination); o.start(st); o.stop(st + 1.2);
  });
}

/* ---------- Slides ---------- */

// Runs a figure's slides. Its markup has the svg (id) and, by the same prefix, id-out, id-back, id-next, id-count,
// id-reset, id-sound and id-live.
// Each slide has a title, its builds (one per press) and, when it skips moves, skip = { from, to, moves, text, note },
// where moves is how many steps it skips and note, when given, replaces the line that counts them while they play.
// A build has what the grid's draw() takes, plus ep, move, time and stage ("after" in the sweep that follows an episode)
// for the status line, line and eq for its text, and sound ("fall" or "wall") when its move calls for one.
// frame(m) gives the state at step m of a skip, from + 1 to to − 1, with Q, agent, ring, ep, move, time and stage, and
// the marks of that step: pick (the move about to be taken) and marks (what was just updated).
// world is the cliff unless given; with perCell, builds and frames give V, one value per cell, instead of Q.
export function slideshow({ svg, slides, frame, world = cliff, perCell = false }) {
  const id = svg.id, $ = (s) => document.getElementById(`${id}-${s}`);
  const out = $("out"), live = $("live"), nextBtn = $("next"), backBtn = $("back"), resetBtn = $("reset"), countEl = $("count");
  let k = 0, b = 0, ff = null, soundOn = true;
  const grid = createGrid(svg, world, perCell);

  function render(animate) {
    const sl = slides[k], bd = sl.builds[b];
    grid.draw(bd, animate);
    // Readout: status and title, then one block per press so far, each a sentence with its calculation below it.
    // New blocks only ever appear at the bottom; earlier ones stay above, dimmed.
    const shown = sl.builds.slice(0, b + 1), enter = animate && b === 0 ? " enter" : "";
    let html = `<p class="lbl">${status(bd.ep, bd.move, bd.time, bd.stage)}</p>${sl.skip ? `<p class="later${enter}">${sl.skip.text}</p>` : ""}<p class="slide${enter}">${sl.title}</p>`;
    html += `<div class="lines">${shown.map((d, i) => `<div class="${i < shown.length - 1 ? "old" : animate ? (b === 0 ? "enter after-title" : "enter") : ""}"><p>${d.line}</p>${d.eq ? `<div class="eq">${d.eq}</div>` : ""}</div>`).join("")}</div>`;
    out.innerHTML = html;
    if (animate) live.textContent = shown[shown.length - 1].line.replace(/<[^>]+>/g, "");
    countEl.textContent = tr(`${k + 1} of ${slides.length}`, `${k + 1} de ${slides.length}`);
    backBtn.disabled = k === 0 && b === 0;
    nextBtn.disabled = k === slides.length - 1 && b === slides[k].builds.length - 1;
    resetBtn.hidden = k !== slides.length - 1;
  }
  function playFor(prevAgent) {
    if (!soundOn) return;
    const bd = slides[k].builds[b];
    if (k === slides.length - 1) chime();
    else if (bd.sound === "fall") fallSound();
    else if (bd.sound === "wall") click(0.55, 0.8);
    else if (bd.agent !== prevAgent && !bd.jump) (world.goalName && bd.agent === world.GOAL ? crunch : click)();
  }
  // Fast-forward: when Next skips moves, the grid plays them quickly while the status line counts up, each frame with
  // the marks of its move: yellow for the move about to be taken, green for what was just updated. A short skip plays
  // at about 150 ms a move; any skip lasts from 0.9 to 2.4 seconds. Next during it jumps to the end, Back cancels it;
  // with reduced motion there is none, and the skip note says how far it went.
  function fastForward(skip, prevAgent) {
    const dur = Math.min(2400, Math.max(900, skip.moves * 150)), start = performance.now();
    let shown = -1;
    const step = (now) => {
      const m = Math.min(skip.to - 1, skip.from + Math.max(1, Math.floor((skip.moves * (now - start)) / dur)));
      if (m !== shown) {
        shown = m;
        const f = frame(m);
        grid.draw({ Q: f.Q, V: f.V, agent: f.agent, ring: f.ring, jump: true, pick: f.pick, marks: f.marks }, false);
        out.innerHTML = `<p class="lbl">${status(f.ep, f.move, f.time, f.stage)}</p><p class="slide ff">${tr("Skipping ahead", "Adelantando")}</p><p class="muted">${skip.note ?? tr(`${skip.moves} moves go by.`, `Pasan ${skip.moves} movimientos.`)} ${tr("Press Next to jump to the end.", "Presiona Siguiente para saltar al final.")}</p>`;
      }
      if (now - start >= dur) finishFF(true, prevAgent);
      else ff.raf = requestAnimationFrame(step);
    };
    ff = { raf: requestAnimationFrame(step), prevAgent };
  }
  function finishFF(show, prevAgent) {
    if (!ff) return;
    cancelAnimationFrame(ff.raf); ff = null;
    if (show) { render(true); playFor(prevAgent); }
  }
  function next() {
    if (ff) { finishFF(true, ff.prevAgent); return; }
    const prevAgent = slides[k].builds[b].agent;
    if (b < slides[k].builds.length - 1) b++;
    else if (k < slides.length - 1) { k++; b = 0; }
    else return;
    const skip = b === 0 ? slides[k].skip : null;
    if (skip && !reducedMotion.matches) fastForward(skip, prevAgent);
    else { render(true); playFor(prevAgent); }
  }
  function back() {
    if (ff) finishFF(false);
    if (b > 0) b--;
    else if (k > 0) { k--; b = slides[k].builds.length - 1; }
    else return;
    render(false);
  }
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", back);
  // Reset: back to the first slide; focus moves to Next, since Reset itself disappears.
  resetBtn.addEventListener("click", () => { finishFF(false); k = 0; b = 0; render(false); nextBtn.focus(); });
  $("sound").addEventListener("click", (e) => {
    soundOn = !soundOn;
    e.currentTarget.setAttribute("aria-pressed", String(soundOn));
    e.currentTarget.textContent = soundOn ? tr("Sound on", "Con sonido") : tr("Sound off", "Sin sonido");
  });
  svg.closest(".fig").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  });
  render(false);
}
