import { tr, localNum, makeHandle, makeDraggable, modeButtons, steadyHeight } from "../../plane.js";
import { slideshow } from "./gridworld.js";
import { createGame, createPongView, MOVES, valueText } from "./pong.js";
import { DATA } from "./deep-q-networks-data.js?v=11b3607f";

// The note on "Playing Atari with Deep Reinforcement Learning" (Mnih et al. 2013), on the rally, the note's game
// (pong.js). Figure 1 lets the reader drag the ball over the trained network's values of the three moves; Figure 3 runs
// deep Q-learning with experience replay press by press. Both replay the runs of the note's offline script, shipped in
// deep-q-networks-data.js, whose header documents every field: the page computes nothing but the drawing. Figures 2, 4,
// 5 and 6 are static drawings in the page for now. warn() checks that the shipped data still says what the readouts'
// words claim, as the control note's figures do.

const warn = (ok, what) => { if (!ok) console.warn(`DQN figures: ${what}`); };
// A count as the text writes it: 4,854 and 10,000 in English; 4854 and 10 000 in Spanish.
const kn = (n) => localNum(n);
// Values ship in thousandths. Figure 3 shows them with three decimals; Figure 1 with two, rounded from the thousandths
// half away from zero (the data module's rule), so that its readout, its bars and its tie rule agree.
const h2 = (v) => Math.sign(v) * Math.floor((Math.abs(v) + 5) / 10);
const q2 = (v) => h2(v) / 100, q3 = (v) => v / 1000;
const f2 = (v) => valueText(q2(v), 2), f3 = (v) => valueText(q3(v), 3);
const and = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${tr("and", "y")} ${xs.at(-1)}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// The moves as the sentences do them: "only moving up hits it", "solo subir la devuelve".
const DOING = [tr("moving up", "subir"), tr("staying", "quedarse"), tr("moving down", "bajar")];
// Q(φ, up; θ), with the move's name as the bars write it (subir, quedarse, bajar in Spanish).
const Qf = (phi, a) => `<i>Q</i>(${phi}, ${a}; θ)`;
const sub = (s, i) => `${s}<sub>${i}</sub>`;
// The moves tied for the largest value at the shown precision, named in a sentence of their own.
const tieLine = (best, d) => (best.length > 1 ? ` ${tr(`${cap(and(best.map((a) => MOVES[a])))} are equal to ${d === 2 ? "two" : "three"} decimals.`, `${cap(and(best.map((a) => MOVES[a])))} son iguales con ${d === 2 ? "dos" : "tres"} decimales.`)}` : "");
const bestOf = (h) => { const m = Math.max(...h); return [0, 1, 2].filter((a) => h[a] === m); };

/* ---------- Figure 1: what the network sees, and what it says ---------- */

// The states the drag can show (the paddle on rows 2 and 3): the ball at column bx and row by of the later screen,
// moving dx (−1 left, 1 right) and dy (−1 rising, 1 falling), so that it was at (bx − dx, by − dy) a step before. At
// column 0 it moves left and at row 0 rises, at row 5 falls (the walls' bounces), and it enters column 5 only moving
// right: 100 states. Each has the two-screen network's values, the exact ones and the steps until the ball arrives.
const F1 = DATA.fig1;
const keyOf = (bx, by, dx, dy) => (bx * 6 + by) * 4 + (dx > 0 ? 2 : 0) + (dy > 0 ? 1 : 0);
const STATES = [];
for (let bx = 0; bx < 6; bx++) for (let by = 0; by < 6; by++) for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
  const e = F1.key[keyOf(bx, by, dx, dy)];
  if (e < 0) continue;
  const star = F1.star[e], mx = Math.max(...star), mn = Math.min(...star);
  // The kind of screen: exact values all equal (too late when negative, far or moving away when positive), or else the
  // ball one step away or two or three, with moves that differ.
  const kind = mx === mn ? (mx < 0 ? "late" : "far") : F1.k[e] === 1 ? "one" : "steps";
  STATES.push({ bx, by, dx, dy, e, kind, k: F1.k[e], two: F1.two[e].map(h2), one: F1.one[bx * 6 + by].map(h2), star, right: [0, 1, 2].filter((a) => star[a] === mx) });
}
const stateAt = (bx, by, dx, dy) => STATES.find((s) => s.bx === bx && s.by === by && s.dx === dx && s.dy === dy);
const ALIAS = new Set(F1.alias.map(([x, y]) => x * 6 + y));
{
  const n = (k) => STATES.filter((s) => s.kind === k).length;
  warn(STATES.length === 100 && n("one") === 8 && n("steps") === 8 && n("far") === 82 && n("late") === 2, "Figure 1's states are not the 100 the readout describes (8 one step away, 8 two or three, 82 far, 2 too late)");
  // The lead-in: where the move decides a hit, the best move hits and is within 0.43 of its red line.
  const dec = STATES.filter((s) => s.kind === "one" || s.kind === "steps");
  warn(dec.length === 16 && dec.every((s) => bestOf(s.two).every((a) => s.right.includes(a) && Math.abs(s.two[a] * 10 - s.star[a]) <= 435)), "on a frame where the move decides a hit, the network's best move does not hit, or its value is far from its red line");
  const d = stateAt(5, 2, 1, -1);
  warn(d && d.two.join() === "152,-2,-154" && d.one.join() === "-24,-9,-7", "Figure 1's default values are not 1.52, −0.02, −1.54 (one frame: −0.24, −0.09, −0.07)");
  warn(STATES.filter((s) => s.kind === "late").every((s) => s.star.every((v) => v === -1000)), "a frame too late to hit has an exact value other than −1");
}
// The readout's calculation and sentence for a state, in a mode ("two" or "one").
function readout(s, mode) {
  const h = mode === "one" ? s.one : s.two, best = bestOf(h);
  const eq = `<p class="eq">${[0, 1, 2].map((a) => `<span class="nowrap">${Qf("φ", MOVES[a])} ≈ ${valueText(h[a] / 100, 2)}${a < 2 ? "," : ""}</span>`).join(" ")}</p>`;
  const names = and(best.map((a) => MOVES[a]));
  let say;
  if (mode === "one") {
    // With one screen, the four directions of a ball are one input. Where no move is right both for a rising and a
    // falling ball moving toward the paddle, the sentence says so, and which of the two its best move gets right.
    const rise = stateAt(s.bx, s.by, 1, -1), fall = stateAt(s.bx, s.by, 1, 1);
    const one = best.length === 1 ? best[0] : null, alias = ALIAS.has(s.bx * 6 + s.by) && s.dx > 0 && rise && fall && one !== null;
    const okRise = alias && rise.right.includes(one), okFall = alias && fall.right.includes(one);
    if (alias && okRise !== okFall) {
      const [good, bad] = okFall ? [tr("falling", "baja"), tr("rising", "sube")] : [tr("rising", "sube"), tr("falling", "baja")];
      say = s.bx === 5
        ? tr(`With one frame, a rising and a falling ball are the same input, so the network gives them the same values, and here no move hits both: its best move, ${MOVES[one]}, hits the ${good} ball and misses the ${bad} one.`,
          `Con un cuadro, una pelota que sube y una que baja son la misma entrada, así que la red les da los mismos valores, y aquí ningún movimiento devuelve las dos: su mejor movimiento, ${MOVES[one]}, devuelve la que ${good} y deja escapar la que ${bad}.`)
        : tr(`With one frame, a rising and a falling ball are the same input, so the network gives them the same values, and here no move keeps a hit possible for both: its best move, ${MOVES[one]}, does for the ${good} ball, not for the ${bad} one.`,
          `Con un cuadro, una pelota que sube y una que baja son la misma entrada, así que la red les da los mismos valores, y aquí ningún movimiento mantiene posible la devolución de las dos: su mejor movimiento, ${MOVES[one]}, la mantiene para la que ${good}, no para la que ${bad}.`);
    } else say = tr("With one frame the network cannot tell which way the ball moves: dragging it the other way moves the red lines, not the bars.", "Con un cuadro la red no distingue hacia dónde se mueve la pelota: arrastrarla en la otra dirección mueve las líneas rojas, no las barras.");
  } else if (s.kind === "one") {
    const dir = s.by === 0 ? tr("after bouncing off the top wall", "tras rebotar en la pared de arriba") : s.by === 5 ? tr("after bouncing off the bottom wall", "tras rebotar en la pared de abajo") : s.dy < 0 ? tr("rising", "subiendo") : tr("falling", "bajando");
    const hits = s.right.length === 1 ? tr(`only ${DOING[s.right[0]]} hits it`, `solo ${DOING[s.right[0]]} la devuelve`) : tr(`${and(s.right.map((a) => DOING[a]))} hit it`, `${and(s.right.map((a) => DOING[a]))} la devuelven`);
    say = tr(`The ball arrives beside the paddle next step, ${dir}: ${hits}, and the network values ${names} most.`, `La pelota llega junto a la paleta en el próximo paso, ${dir}: ${hits}, y la red le da el mayor valor a ${names}.`);
  } else if (s.kind === "steps") {
    const keep = s.right.length === 1 ? tr(`only ${DOING[s.right[0]]} keeps`, `solo ${DOING[s.right[0]]} mantiene`) : tr(`${and(s.right.map((a) => DOING[a]))} keep`, `${and(s.right.map((a) => DOING[a]))} mantienen`);
    say = tr(`The ball arrives in ${s.k} steps: ${keep} a hit possible, and the network values ${names} most.`, `La pelota llega en ${s.k} pasos: ${keep} posible la devolución, y la red le da el mayor valor a ${names}.`);
  } else if (s.kind === "far") {
    const spread = (Math.max(...h) - Math.min(...h)) / 100;
    const tail = spread < 0.05 ? tr("the network's nearly agree", "los de la red casi coinciden")
      : tr(`the network's differ by ${localNum(spread, 2)}, since it learns little about moves it seldom makes in such places`, `los de la red difieren en ${localNum(spread, 2)}, porque aprende poco de los movimientos que casi no hace en esos lugares`);
    say = tr(`Every move still leaves time to reach the ball, so their exact values are equal; ${tail}.`, `Todo movimiento deja todavía tiempo para alcanzar la pelota, así que sus valores exactos son iguales; ${tail}.`);
  } else {
    const above = [0, 1, 2].filter((a) => h[a] > 0);
    warn(h.every((v) => v !== 0), "a value of a frame too late to hit shows as 0.00");
    say = above.length === 0
      ? tr("Whatever the paddle does now, the ball arrives out of its reach: every exact value is −1, and the network's are all below 0.", "Haga lo que haga la paleta ahora, la pelota llega fuera de su alcance: cada valor exacto es −1, y los de la red están todos bajo 0.")
      : tr(`Whatever the paddle does now, the ball arrives out of its reach: every exact value is −1, but the network still values ${and(above.map((a) => DOING[a]))} above 0.`, `Haga lo que haga la paleta ahora, la pelota llega fuera de su alcance: cada valor exacto es −1, pero la red todavía le da un valor sobre 0 a ${and(above.map((a) => DOING[a]))}.`);
  }
  return `${eq}<p>${say}${tieLine(best, 2)}</p>`;
}
{
  const svg = document.getElementById("fig-screen"), out = document.getElementById("fig-screen-out");
  if (svg) {
    svg.setAttribute("viewBox", "0 0 440 200");
    const game = createGame(svg, { decimals: 2 }), screen = game.screen;
    // The ball's handle: its hit area and focus ring only, the lit pixel being its look; the ring is drawn in --img-hi,
    // which shows on an unlit pixel in both themes.
    const handle = makeHandle(svg, "none", 15);
    handle.classList.add("on-screen");
    let s = stateAt(5, 2, 1, -1), mode = "two";
    // A move of the ball to (nx, ny): its direction on each axis is the way it last moved along that axis, except at
    // the walls, where the bounces set it, and in column 5, which it enters only moving right.
    function moveTo(nx, ny) {
      nx = Math.max(0, Math.min(5, nx)); ny = Math.max(0, Math.min(5, ny));
      if (nx === s.bx && ny === s.by) return false;
      let dx = nx === s.bx ? s.dx : Math.sign(nx - s.bx), dy = ny === s.by ? s.dy : Math.sign(ny - s.by);
      if (nx === 0) dx = -1;
      if (nx === 5) dx = 1;
      if (ny === 0) dy = -1;
      if (ny === 5) dy = 1;
      const next = stateAt(nx, ny, dx, dy);
      warn(!!next, `the drag reached a state Figure 1 has no values for: (${nx}, ${ny}), ${dx}, ${dy}`);
      if (!next) return false;
      s = next;
      return true;
    }
    // The ball follows the pointer pixel by pixel, with hysteresis: it moves into the next pixel only once the pointer
    // is HYST of a pixel into it, so that a pointer resting on an edge never flips the ball, its direction and the bars
    // back and forth.
    const HYST = 0.3;
    const snap = (f, b) => (f >= b + 1 + HYST ? Math.floor(f - HYST) : f <= b - HYST ? Math.ceil(f + HYST) - 1 : b);
    function render(animate = false) {
      game.draw({ s: { ball: [s.bx, s.by], prev: [s.bx - s.dx, s.by - s.dy], paddle: 2 }, q: (mode === "one" ? s.one : s.two).map((v) => v / 100), exact: s.star.map(q3), oneScreen: mode === "one" }, animate);
      handle.setAttribute("transform", `translate(${screen.cx(s.bx)} ${screen.cy(s.by)})`);
      const toward = s.dx > 0;
      handle.setAttribute("aria-label", tr(`The ball, at column ${s.bx}, row ${s.by}, ${s.dy < 0 ? "rising" : "falling"} ${toward ? "toward" : "away from"} the paddle`,
        `La pelota, en la columna ${s.bx}, fila ${s.by}, ${s.dy < 0 ? "subiendo" : "bajando"} ${toward ? "hacia la paleta" : "y alejándose de la paleta"}`));
      out.innerHTML = readout(s, mode);
    }
    makeDraggable(handle, {
      move: (p) => { const [fx, fy] = screen.toPixel(p); if (moveTo(snap(fx, s.bx), snap(fy, s.by))) render(); },
      // makeDraggable sends ArrowUp as [0, 1]; on the screen, up is a smaller row.
      step: ([dx, dy]) => { if (moveTo(s.bx + dx, s.by - dy)) render(); },
    });
    modeButtons(document.getElementById("fig-screen-modes"), (m) => { mode = m; render(true); });
    // The readout keeps the height of its tallest state, over every state and both modes. As a flow root it holds its
    // last paragraph's bottom margin, which steadyHeight's measure (offsetHeight) would otherwise leave out, so that the
    // tallest sentence cannot push the page down by that margin.
    out.style.display = "flow-root";
    const all = [...new Set(STATES.flatMap((x) => [readout(x, "two"), readout(x, "one")]))];
    steadyHeight(out, all, (html) => { out.innerHTML = html; }, () => readout(s, mode));
    render();
  }
}

/* ---------- Figure 3: deep Q-learning, press by press ---------- */

// Seed 48, α = 0.1, γ = 0.9, a memory of 10,000, minibatches of 32 (the data module's header). Episode 1 is played in
// full, step 1 through every line of the algorithm and steps 2 to 6 in two presses each (choose, take and store; draw,
// target and step); episode 2 one press per step up to its first hit, whose learning gets a press of its own. Then
// three skips, each playing the episode it lands on. Transitions are numbered by the run's steps, as the memory's cells
// are; from episode 2 on, the readouts write φ_j for the pair of screens of the transition drawn.
{
  const svg = document.getElementById("fig-dqn");
  if (svg) {
    const F = DATA.fig3, S = F.steps, st = (t) => S[t - 1], CAP = 10000, GAMMA = "0.9";
    // A pair of screens as the data writes it, [pbx, pby, ppy, bx, by, py], as pong.js draws it; at a serve the two
    // screens are the same, and the earlier ball is not drawn.
    const pair = (p) => ({ ball: [p[3], p[4]], prev: p[0] === p[3] && p[1] === p[4] ? null : [p[0], p[1]], paddle: p[5], prevPaddle: p[2] });
    // The pair in view after step t's move, and the new screen alone, before it is stacked with the one before.
    const next = (x) => ({ ball: [x.s1[0], x.s1[1]], prev: [x.s[3], x.s[4]], paddle: x.s1[2], prevPaddle: x.s[5] });
    const alone = (x) => ({ ball: [x.s1[0], x.s1[1]], prev: null, paddle: x.s1[2] });
    const xy = (b) => `(${b[0]}, ${b[1]})`;
    const qs = (q) => q.map(q3);
    // ε at step t: from 1 down to 0.1 over the first 10,000 steps, then 0.1; written with ≈ where it is rounded.
    const epsAt = (t) => (t <= CAP ? 1 - (0.9 * (t - 1)) / CAP : 0.1);
    const epsText = (t) => {
      const e = epsAt(t), r = Math.round(e * 100) / 100, s = localNum(r, 2).replace(/0+$/, "").replace(/\.$/, "");
      return `ε ${Math.abs(r - e) > 1e-9 ? "≈" : "="} ${s}`;
    };
    const label = (ep, t) => tr(`Episode ${kn(ep)}, step ${kn(t)} · ${epsText(t)}`, `Episodio ${kn(ep)}, paso ${kn(t)} · ${epsText(t)}`);
    // The memory: the first transitions as cells, each drawn one outlined in green with its count; or, from slide 5, a
    // strip of the transitions stored, with a tick for each slot drawn (transition j sits in slot j − (t − size + 1)).
    const counts = (draws) => { const c = new Map(); for (const j of draws) c.set(j, (c.get(j) || 0) + 1); return c; };
    const cells = (n, draws) => ({ size: n, capacity: CAP, cells: S.slice(0, n).map((x) => ({ a: x.a, r: x.r })), strip: null, counts: draws ? [...counts(draws)].map(([j, k]) => ({ cell: j - 1, n: k })) : [] });
    const strip = (t, size, draws = []) => ({ size, capacity: CAP, cells: null, strip: { filled: size, ticks: draws.map((j) => j - (t - size + 1)) }, counts: null });
    // The bars a target borrows: those equal to the largest value of the next pair at three decimals.
    const borrowed = (x) => (x.qn ? [0, 1, 2].filter((a) => x.qn[a] === x.m) : []);
    // Region B: transition t, from its pair of screens to the next (or "end"), its value before and after the step and
    // its target. In episode 1 the pairs are named by their step, φ_1 and φ_2; from episode 2 on, φ_j and φ_j+1.
    const learnOf = (t, after = true) => {
      const x = st(t);
      return { j: t, ...(x.ep === 1 ? { sub: t } : {}), from: pair(x.s), to: x.r === -1 ? "end" : next(x), a: x.a, r: x.r, value: q3(x.v0), target: q3(x.y), ...(after ? { next: q3(x.v1) } : {}) };
    };
    // The readouts' equations: the values of a pair; a target, red, its largest value with four decimals where three
    // would not give the target's three; and an update, the value updated green and its target red.
    const yj = `<i>y</i><sub><i>j</i></sub>`, rj = `<i>r</i><sub><i>j</i></sub>`;
    const valuesEq = (phi, q) => `<span class="nowrap">${Qf(phi, "·")} ≈ (${q.map(f3).join(", ")})</span>`;
    const targetEq = (x) => (x.r === -1 ? `<span class="nowrap pt">${yj} = ${rj} = −1</span>`
      : `<span class="pt">${yj} <span class="nowrap">≈ ${localNum(x.r)} + ${GAMMA} · ${x.m4 ? localNum(x.m4 / 10000, 4) : f3(x.m)}</span> <span class="nowrap">≈ ${f3(x.y)}</span></span>`);
    // The value updated and its change are one piece, so that a line never breaks between a value's name and its numbers.
    const updEq = (phi, x, toward = true) => `<span class="nowrap"><span class="upd">${Qf(phi, MOVES[x.a])}</span>: ${f3(x.v0)} → ${f3(x.v1)}${toward ? "," : ""}</span>${toward ? ` <span class="nowrap">${tr("toward", "hacia")} <span class="pt">${f3(x.y)}</span></span>` : ""}`;
    // Every equation of the figure takes one size at each width: the readout's, and on screens under 360 px, where the
    // widest of them (the values of a pair, and an update with its numbers in one piece) would not fit a 320 px phone,
    // a smaller one (.eq-xs). A long equation set smaller on some presses only would change size from press to press.
    const xs = (html) => `<span class="eq-xs">${html}</span>`;
    const drawn = (x, t) => counts(x.draws).get(t) || 0;
    const times = (n) => (n === 1 ? tr("once", "una vez") : tr(`${kn(n)} times`, `${kn(n)} veces`));

    /* Checks: the words of the presses against the run. */
    const E1 = S.slice(0, 6), E2 = S.slice(6, 12);
    warn(E1.every((x) => x.ep === 1 && x.rnd === 1) && E1.map((x) => x.a).join("") === "120011" && E1.map((x) => x.r).join() === "0,0,0,0,0,-1", "episode 1 is not the six random moves stay, down, up, up, stay, stay, ending in a miss");
    warn(E1.map((x) => xy(x.s1)).join(" ") === "(1, 1) (2, 2) (3, 3) (4, 4) (5, 5) (6, 4)" && xy([E1[0].s[3], E1[0].s[4]]) === "(0, 0)", "the ball's path in episode 1 is not the one the presses describe");
    warn(E1.map((x) => x.s1[2]).join("") === "232111", "the paddle's rows in episode 1 are not the ones the presses describe");
    warn(E1.map((x) => x.pct).join() === "71,23,13,14,10,10" && E1.every((x) => (x.v1 - x.v0) * (x.y - x.v0) > 0 && Math.abs(x.v1 - x.v0) < Math.abs(x.y - x.v0)), "an update of episode 1 does not move its transition part of the way toward its target, as the presses say");
    warn(st(1).qn[1] === st(1).qn[2] && st(1).qn[1] > st(1).qn[0] && st(1).qa[1] > st(1).qa[2] && st(1).q[2] > st(1).q[1], "step 1's values are not the tie the presses describe (stay and down equal in φ_2, staying best after the step, down best in φ_1)");
    warn(drawn(st(1), 1) === 32 && drawn(st(2), 1) === 18 && drawn(st(2), 2) === 14 && [3, 4, 5].map((t) => drawn(st(t), t)).join() === "8,5,4" && st(2).pct >= 20 && st(2).pct < 30, "episode 1's draws are not the counts the presses give");
    warn(E2.every((x) => x.ep === 2 && x.rnd === 1) && E2.map((x) => x.a).join("") === "120002" && E2.map((x) => x.r).join() === "0,0,0,0,0,1", "episode 2 is not the random moves stay, down, up, up, up, down, ending in the first hit");
    warn(xy([E2[0].s[3], E2[0].s[4]]) === "(0, 3)" && E2.map((x) => xy(x.s1)).join(" ") === "(1, 4) (2, 5) (3, 4) (4, 3) (5, 2) (6, 1)" && E2.map((x) => x.s1[2]).join("") === "232101", "the path of episode 2 is not the one the presses describe");
    warn(E2.map((x, i) => drawn(x, i + 7)).join() === "3,5,4,1,5,1" && E2.slice(0, 5).map((x) => x.pct).join() === "79,5,14,9,24" && E2.every((x) => (x.v1 - x.v0) * (x.y - x.v0) > 0), "episode 2's draws or shares of the way are not the ones the presses give");
    warn(st(12).life === 243 && st(12).y === 1160, "transition 12 is not drawn 243 times, or its target is not 1.160");

    const kept = (t) => ({ memory: cells(t), agent: t, label: label(st(t).ep, t) });
    // The pseudocode beside the run: the note's steps, numbered by the panel. Lines (data-line): 0 the start, 2 a new
    // episode's first pair, 4 choose, 5 take, 6 store, 7 draw the minibatch, 8 its targets, 9 the gradient step.
    const Lt = (s) => `${s}<sub><i>t</i></sub>`, Lt1 = (s) => `${s}<sub><i>t</i>+1</sub>`, Lj = (s) => `${s}<sub><i>j</i></sub>`, Lj1 = (s) => `${s}<sub><i>j</i>+1</sub>`;
    const at = Lt("<i>a</i>"), rt = Lt("<i>r</i>"), phiT = Lt("φ"), phiT1 = Lt1("φ"), phiJ1 = Lj1("φ");
    const tuple = (f) => `<span class="nowrap">(${f("φ")}, ${f("<i>a</i>")}, ${f("<i>r</i>")}, ${f === Lt ? phiT1 : phiJ1})</span>`;
    const qJ = `<i>Q</i>(${Lj("φ")}, ${Lj("<i>a</i>")}; θ)`;
    const CODE = {
      title: tr("Deep Q-learning with experience replay", "Deep Q-learning con experience replay"),
      lines: [
        { kind: "plain", html: tr(`<span class="nowrap">𝒟 ← empty,</span> with room for <i>N</i>; <span class="nowrap">θ ← random</span>`, `<span class="nowrap">𝒟 ← vacío,</span> con espacio para <i>N</i>; <span class="nowrap">θ ← al azar</span>`) },
        { head: true, html: tr("For each episode:", "En cada episodio:") },
        { kind: "plain", ind: 1, html: tr(`Observe <i>x</i><sub>1</sub>; <span class="nowrap"><i>s</i><sub>1</sub> = <i>x</i><sub>1</sub>,</span> <span class="nowrap">φ<sub>1</sub> = φ(<i>s</i><sub>1</sub>)</span>`, `Observar <i>x</i><sub>1</sub>; <span class="nowrap"><i>s</i><sub>1</sub> = <i>x</i><sub>1</sub>,</span> <span class="nowrap">φ<sub>1</sub> = φ(<i>s</i><sub>1</sub>)</span>`) },
        { head: true, ind: 1, html: tr(`For each step <i>t</i>, until ${phiT1} is terminal or the rally reaches the cut:`, `En cada paso <i>t</i>, hasta que ${phiT1} sea terminal o el peloteo llegue al corte:`) },
        { kind: "pick", ind: 2, html: tr(`${at} ← random with probability ε, else <span class="nowrap">argmax<sub><i>a</i></sub> <i>Q</i>(${phiT}, <i>a</i>; θ)</span>`, `${at} ← al azar con probabilidad ε; si no, <span class="nowrap">argmax<sub><i>a</i></sub> <i>Q</i>(${phiT}, <i>a</i>; θ)</span>`) },
        { kind: "take", ind: 2, html: tr(`Take ${at}; observe ${rt} and ${Lt1("<i>x</i>")}; <span class="nowrap">${Lt1("<i>s</i>")} = ${Lt("<i>s</i>")}, ${at}, ${Lt1("<i>x</i>")};</span> <span class="nowrap">${phiT1} = φ(${Lt1("<i>s</i>")})</span>`, `Tomar ${at}; observar ${rt} y ${Lt1("<i>x</i>")}; <span class="nowrap">${Lt1("<i>s</i>")} = ${Lt("<i>s</i>")}, ${at}, ${Lt1("<i>x</i>")};</span> <span class="nowrap">${phiT1} = φ(${Lt1("<i>s</i>")})</span>`) },
        { kind: "model", ind: 2, html: tr(`Store ${tuple(Lt)} in 𝒟, dropping the oldest once it holds <i>N</i>`, `Guardar ${tuple(Lt)} en 𝒟, y descartar la más antigua cuando ya tiene <i>N</i>`) },
        { kind: "model", ind: 2, html: tr(`Draw 32 transitions ${tuple(Lj)} from 𝒟 at random`, `Sacar al azar 32 transiciones ${tuple(Lj)} de 𝒟`) },
        { kind: "target", ind: 2, html: tr(`<span class="nowrap">${yj} ← <span class="pt">${rj}</span></span> if ${phiJ1} is terminal, else <span class="nowrap"><span class="pt">${rj} + γ max<sub><i>a</i>′</sub> <i>Q</i>(${phiJ1}, <i>a</i>′; θ)</span></span>`, `<span class="nowrap">${yj} ← <span class="pt">${rj}</span></span> si ${phiJ1} es terminal; si no, <span class="nowrap"><span class="pt">${rj} + γ max<sub><i>a</i>′</sub> <i>Q</i>(${phiJ1}, <i>a</i>′; θ)</span></span>`) },
        { kind: "update", ind: 2, html: `<span class="nowrap"><span class="upd">θ</span> ← θ + α · <sup>1</sup>⁄<sub>32</sub> Σ<sub><i>j</i></sub>[<span class="pt">${yj}</span></span> <span class="nowrap">− ${qJ}]</span> <span class="nowrap">∇<sub>θ</sub>${qJ}</span>` },
      ],
    };
    // A press that plays several lines draws each as it lights (playPhases): the choice in yellow on the old pair, the
    // move taken, the transition stored; then the draws, the target's borrowed bars and the step. A line listed twice
    // holds its phase for two beats (150 ms each), so that the glides and fades it starts (260 to 400 ms) end before
    // the next phase or the final draw of the build cuts them.
    const x0 = (t) => st(t), lab = (t) => label(st(t).ep, t);
    const pickDraw = (t) => ({ s: pair(x0(t).s), q: qs(x0(t).q), pick: x0(t).a, memory: cells(t - 1), agent: t - 1, label: lab(t) });
    const takeDraw = (t) => ({ s: next(x0(t)), q: x0(t).r === -1 ? null : qs(x0(t).qn), taken: x0(t).a, memory: cells(t - 1), agent: t, label: lab(t) });
    const storeDraw = (t) => ({ ...takeDraw(t), taken: null, memory: cells(t) });
    const drawDraw = (t) => ({ ...storeDraw(t), memory: cells(t, x0(t).draws) });
    const targetDraw = (t) => ({ ...drawDraw(t), tg: borrowed(x0(t)), learn: learnOf(t, false) });
    const actPhases = (t) => [{ slow: true, lines: [4], draw: pickDraw(t) }, { slow: true, lines: [5, 5], draw: takeDraw(t) }, { slow: true, lines: [6], draw: storeDraw(t) }];
    const learnPhases = (t, b) => [{ slow: true, lines: [7], draw: drawDraw(t) }, { slow: true, lines: [8], draw: targetDraw(t) }, { slow: true, lines: [9, 9, 9], draw: b }];
    const slides = [];
    // Slide 1: step 1, line by line.
    {
      const x = st(1), phi1 = sub("φ", 1), phi2 = sub("φ", 2), lab = label(1, 1);
      // φ_2's tie, named where its bars first show it (press 5) and borrowed by the target at press 8.
      const tied = bestOf(x.qn);
      warn(tied.join() === "1,2", "φ_2's largest values are not staying and moving down, tied");
      slides.push({ title: tr("An empty memory, random weights", "Una memoria vacía, pesos al azar"), builds: [
        { code: [0], s: null, memory: cells(0), agent: 0, label: tr(`Before episode 1 · ${epsText(1)}`, `Antes del episodio 1 · ${epsText(1)}`),
          line: tr("The memory is empty and the weights are random.", "La memoria está vacía y los pesos son al azar.") },
        { code: [2], s: pair(x.s), q: qs(x.q), memory: cells(0), agent: 0, label: lab, eq: valuesEq(phi1, x.q),
          line: tr(`Episode 1 starts with a serve from the top left corner; at the serve, ${phi1} holds this first frame twice. The random weights give the moves small values.`, `El episodio 1 parte con un saque desde la esquina superior izquierda; en el saque, ${phi1} tiene este primer cuadro dos veces. Los pesos al azar dan valores pequeños a los movimientos.`) },
        { code: [4], s: pair(x.s), q: qs(x.q), pick: x.a, memory: cells(0), agent: 0, label: lab,
          line: tr(`With ε = 1 the move is random: ${MOVES[x.a]}.`, `Con ε = 1 el movimiento es al azar: ${MOVES[x.a]}.`) },
        { code: [5], s: alone(x), q: qs(x.q), taken: x.a, memory: cells(0), agent: 1, label: lab,
          line: tr(`The paddle stays, the ball bounces off the top wall to ${xy(x.s1)}, and the reward ${sub("<i>r</i>", 1)} is 0.`, `La paleta se queda, la pelota rebota en la pared de arriba hacia ${xy(x.s1)}, y la recompensa ${sub("<i>r</i>", 1)} es 0.`) },
        { code: [5], s: next(x), q: qs(x.qn), memory: cells(0), agent: 1, label: lab, eq: valuesEq(phi2, x.qn),
          line: tr(`${phi2} holds the last two frames; the faint ball shows which way it moves. ${cap(and(tied.map((a) => DOING[a])))} are equal to three decimals, so there is no blue arrow.`, `${phi2} tiene los dos últimos cuadros; la pelota tenue muestra hacia dónde se mueve. ${cap(and(tied.map((a) => DOING[a])))} son iguales con tres decimales, así que no hay flecha azul.`) },
        { code: [6], s: next(x), q: qs(x.qn), memory: cells(1), agent: 1, label: lab,
          line: tr(`The transition (${phi1}, ${MOVES[x.a]}, 0, ${phi2}) is the memory's first.`, `La transición (${phi1}, ${MOVES[x.a]}, 0, ${phi2}) es la primera de la memoria.`) },
        { code: [7], s: next(x), q: qs(x.qn), memory: cells(1, x.draws), agent: 1, label: lab,
          line: tr(`The minibatch draws 32 times at random from the memory, with repeats: here, the only transition, ${kn(drawn(x, 1))} times.`, `El minibatch saca 32 veces al azar de la memoria, con repetición: aquí, la única transición, ${kn(drawn(x, 1))} veces.`) },
        { code: [8], s: next(x), q: qs(x.qn), tg: borrowed(x), memory: cells(1, x.draws), learn: learnOf(1, false), agent: 1, label: lab, eq: targetEq(x),
          line: tr(`Its target is the reward plus γ times the largest value of the next pair of frames, the one in view, which ${and(tied.map((a) => DOING[a]))} share.`, `Su objetivo es la recompensa más γ veces el mayor valor del siguiente par de cuadros, el que se ve, que comparten ${and(tied.map((a) => DOING[a]))}.`) },
        { code: [9], s: next(x), q: qs(x.qa), tg: borrowed(x), memory: cells(1, x.draws), learn: learnOf(1), agent: 1, label: lab, eq: updEq(phi1, x),
          line: tr(`One gradient step, the first of section 2's figure: the value of staying in ${phi1} rises from ${f3(x.v0)} to ${f3(x.v1)}, ${x.pct}% of the way. The same step raised the value of staying in ${phi2}, the pair in view, to ${f3(x.qa[1])}.`, `Un paso de gradiente, el primero de la figura de la sección 2: el valor de quedarse en ${phi1} sube de ${f3(x.v0)} a ${f3(x.v1)}, un ${x.pct}% del camino. El mismo paso subió el valor de quedarse en ${phi2}, el par que se ve, a ${f3(x.qa[1])}.`) },
      ] });
    }
    // Steps 2 to 5: choose, take and store in one press; draw, target and step in the next.
    const act = (t, en, es) => ({ code: [4, 5, 6], phases: actPhases(t), s: next(st(t)), q: qs(st(t).qn), taken: st(t).a, ...kept(t), line: tr(en, es) });
    const learnPress = (t, en, es, eq) => { const b = { code: [7, 8, 9], s: next(st(t)), q: qs(st(t).qa), tg: borrowed(st(t)), ...kept(t), memory: cells(t, st(t).draws), learn: learnOf(t), eq, line: tr(en, es) }; b.phases = learnPhases(t, b); return b; };
    {
      const [x2, x3, x4, x5] = [2, 3, 4, 5].map(st), c2 = counts(x2.draws);
      slides.push({ title: tr("Random moves, a growing memory", "Movimientos al azar, una memoria que crece"), builds: [
        act(2, `Random again: ${MOVES[x2.a]}. The paddle moves down and the ball to ${xy(x2.s1)}; reward 0. The memory holds two transitions.`, `Otra vez al azar: ${MOVES[x2.a]}. La paleta baja y la pelota va a ${xy(x2.s1)}; recompensa 0. La memoria tiene dos transiciones.`),
        learnPress(2, `Of the 32 draws, ${kn(c2.get(1))} fall on transition 1 and ${kn(c2.get(2))} on transition 2, whose value moves a quarter of the way to its target.`, `De los 32 sorteos, ${kn(c2.get(1))} caen en la transición 1 y ${kn(c2.get(2))} en la transición 2, cuyo valor avanza un cuarto del camino hacia su objetivo.`, `${targetEq(x2)}; ${updEq(sub("φ", 2), x2, false)}`),
        act(3, `Random: ${MOVES[x3.a]}. The ball moves to ${xy(x3.s1)}; reward 0.`, `Al azar: ${MOVES[x3.a]}. La pelota va a ${xy(x3.s1)}; recompensa 0.`),
        learnPress(3, `Transition 3, drawn ${times(drawn(x3, 3))}, moves ${x3.pct}% of the way to its target.`, `La transición 3, sacada ${times(drawn(x3, 3))}, avanza un ${x3.pct}% del camino hacia su objetivo.`, updEq(sub("φ", 3), x3)),
        act(4, `Random: ${MOVES[x4.a]}. The ball moves to ${xy(x4.s1)}; the paddle now covers rows ${x4.s1[2]} and ${x4.s1[2] + 1}.`, `Al azar: ${MOVES[x4.a]}. La pelota va a ${xy(x4.s1)}; la paleta cubre ahora las filas ${x4.s1[2]} y ${x4.s1[2] + 1}.`),
        learnPress(4, `Transition 4, drawn ${times(drawn(x4, 4))}: ${x4.pct}% of the way.`, `La transición 4, sacada ${times(drawn(x4, 4))}: un ${x4.pct}% del camino.`, updEq(sub("φ", 4), x4)),
        act(5, `Random: ${MOVES[x5.a]}. The ball reaches the bottom wall, at ${xy(x5.s1)}.`, `Al azar: ${MOVES[x5.a]}. La pelota llega a la pared de abajo, en ${xy(x5.s1)}.`),
        learnPress(5, `Transition 5, drawn ${times(drawn(x5, 5))}: ${x5.pct}% of the way.`, `La transición 5, sacada ${times(drawn(x5, 5))}: un ${x5.pct}% del camino.`, updEq(sub("φ", 5), x5)),
      ] });
    }
    // Slide 3: the miss, and the target that ends the episode.
    {
      const x = st(6), end = next(x), p = x.s1[2];
      slides.push({ title: tr("The miss", "La pelota se escapa"), builds: [
        { code: [4, 5, 6], phases: actPhases(6), s: end, q: null, taken: x.a, ...kept(6), sound: "fall",
          line: tr(`Random: ${MOVES[x.a]}. The ball bounces to ${xy(x.s1)}, beside the paddle's column, while the paddle covers rows ${p} and ${p + 1}: a miss, ${sub("<i>r</i>", 6)} = −1, and the episode ends.`, `Al azar: ${MOVES[x.a]}. La pelota rebota hacia ${xy(x.s1)}, junto a la columna de la paleta, mientras la paleta cubre las filas ${p} y ${p + 1}: se escapa, ${sub("<i>r</i>", 6)} = −1, y el episodio termina.`) },
        { code: [7, 8, 9], s: end, q: null, ...kept(6), memory: cells(6, x.draws), learn: learnOf(6), eq: `${targetEq(x)}; ${updEq(sub("φ", 6), x, false)}`,
          line: tr(`Transition 6 ends the episode, so its target is the reward alone, which no step can move. The step lowers the value of staying in ${sub("φ", 6)} from ${f3(x.v0)} to ${f3(x.v1)}.`, `La transición 6 termina el episodio, así que su objetivo es solo la recompensa, que ningún paso puede mover. El paso baja el valor de quedarse en ${sub("φ", 6)} de ${f3(x.v0)} a ${f3(x.v1)}.`) },
      ] });
      const lb = slides.at(-1).builds[1];
      lb.phases = learnPhases(6, lb);
    }
    // Slide 4: episode 2, one press per step, up to its first hit.
    {
      const phiJ = sub("φ", "<i>j</i>");
      // A whole step in one press: choose, take, store, draw, target and the gradient step, each drawn as its line lights;
      // the episode's first step starts from its serve, the new pair φ_1.
      const step = (t, en, es) => {
        const b = { s: next(st(t)), q: qs(st(t).qa), taken: st(t).a, tg: borrowed(st(t)), ...kept(t), memory: cells(t, st(t).draws), learn: learnOf(t), eq: updEq(phiJ, st(t)), line: tr(en, es) };
        const serve = st(t - 1).r === -1 ? [{ slow: true, lines: [2], draw: { s: pair(st(t).s), q: qs(st(t).q), memory: cells(t - 1), agent: t - 1 } }] : [];
        b.phases = [...serve, ...actPhases(t), ...learnPhases(t, { ...b, taken: null })];
        b.code = b.phases.flatMap((ph) => ph.lines).filter((l, i, a) => l !== a[i - 1]);
        return b;
      };
      const [x7, x8, x9, x10, x11, x12] = [7, 8, 9, 10, 11, 12].map(st), share = (x, t) => [times(drawn(x, t)), x.pct];
      const serveRow = x7.s[4];
      slides.push({ title: tr("A first hit", "Una primera devolución"), builds: [
        step(7, `Episode 2: the serve comes from the left wall on row ${serveRow}, falling. Random: ${MOVES[x7.a]}; the ball moves to ${xy(x7.s1)}. Transition 7, drawn ${share(x7, 7)[0]}, moves ${x7.pct}% of the way to its target.`,
          `Episodio 2: el saque sale de la pared izquierda en la fila ${serveRow}, bajando. Al azar: ${MOVES[x7.a]}; la pelota va a ${xy(x7.s1)}. La transición 7, sacada ${share(x7, 7)[0]}, avanza un ${x7.pct}% del camino hacia su objetivo.`),
        step(8, `Random: ${MOVES[x8.a]}; the ball moves to ${xy(x8.s1)}, on the bottom wall. Transition 8, drawn ${share(x8, 8)[0]}: ${x8.pct}% of the way.`, `Al azar: ${MOVES[x8.a]}; la pelota va a ${xy(x8.s1)}, en la pared de abajo. La transición 8, sacada ${share(x8, 8)[0]}: un ${x8.pct}% del camino.`),
        step(9, `Random: ${MOVES[x9.a]}; the ball bounces up to ${xy(x9.s1)}. Transition 9, drawn ${share(x9, 9)[0]}: ${x9.pct}% of the way.`, `Al azar: ${MOVES[x9.a]}; la pelota rebota hacia arriba, a ${xy(x9.s1)}. La transición 9, sacada ${share(x9, 9)[0]}: un ${x9.pct}% del camino.`),
        step(10, `Random: ${MOVES[x10.a]}; the ball moves to ${xy(x10.s1)}. Transition 10, drawn ${share(x10, 10)[0]}: ${x10.pct}% of the way.`, `Al azar: ${MOVES[x10.a]}; la pelota va a ${xy(x10.s1)}. La transición 10, sacada ${share(x10, 10)[0]}: un ${x10.pct}% del camino.`),
        step(11, `Random: ${MOVES[x11.a]}; the paddle reaches the top, rows 0 and 1, and the ball moves to ${xy(x11.s1)}. Transition 11, drawn ${share(x11, 11)[0]}: ${x11.pct}% of the way.`, `Al azar: ${MOVES[x11.a]}; la paleta llega arriba, filas 0 y 1, y la pelota va a ${xy(x11.s1)}. La transición 11, sacada ${share(x11, 11)[0]}: un ${x11.pct}% del camino.`),
        { code: [4, 5, 6], phases: actPhases(12), s: next(x12), q: qs(x12.qn), taken: x12.a, ...kept(12), sound: "wall",
          line: tr(`Random: ${MOVES[x12.a]}. The paddle covers rows ${x12.s1[2]} and ${x12.s1[2] + 1} as the ball arrives at row ${x12.s1[1]}: a hit, ${sub("<i>r</i>", 12)} = +1, and the ball turns back.`, `Al azar: ${MOVES[x12.a]}. La paleta cubre las filas ${x12.s1[2]} y ${x12.s1[2] + 1} cuando la pelota llega a la fila ${x12.s1[1]}: la devuelve, ${sub("<i>r</i>", 12)} = +1, y la pelota se vuelve.`) },
        { code: [7, 8, 9], s: next(x12), q: qs(x12.qa), tg: borrowed(x12), ...kept(12), memory: cells(12, x12.draws), learn: learnOf(12), eq: `${targetEq(x12)}; ${updEq(phiJ, x12, false)}`,
          line: tr(`Transition 12 is drawn once among the 32, so it gets one 32nd of the step: its value moves from ${f3(x12.v0)} to ${f3(x12.v1)}, though its target is far above. It will stay in the memory for ${kn(CAP)} steps and be drawn ${kn(x12.life)} times in all.`, `La transición 12 sale una vez entre las 32, así que le toca una de las 32 partes del paso: su valor va de ${f3(x12.v0)} a ${f3(x12.v1)}, aunque su objetivo está mucho más arriba. Se quedará en la memoria ${kn(CAP)} pasos y saldrá ${kn(x12.life)} veces en total.`) },
      ] });
      const lb = slides.at(-1).builds.at(-1);
      lb.phases = learnPhases(12, lb);
    }

    // The skips' frames: every step of the three episodes the later slides land on, the pair of screens in view when the
    // move is chosen, its values, the move in yellow, and the memory's strip as it fills. A move into the top or bottom
    // wall leaves the paddle in place; every other frame such a move draws it pressed into the wall.
    // One pass of the loop per frame: choose to the gradient step, from the new pair φ_1 at an episode's first frame.
    const FF = [[4, 5, 6, 7, 8, 9], [2, 4, 5, 6, 7, 8, 9]];
    const FR = [], first = {}, presses = {};
    for (const L of F.landings) {
      first[L.slide] = FR.length; presses[L.slide] = 0;
      L.frames.forEach((f, n) => {
        const t = L.from + n, m = FR.length, wall = (f[9] === 0 && f[5] === 0) || (f[9] === 2 && f[5] === 4);
        if (wall) presses[L.slide]++;
        FR.push({ s: pair(f), q: f.slice(6, 9).map(q3), pick: f[9], nudge: wall && m % 2 === 0 ? (f[9] === 0 ? -1 : 1) : 0, memory: strip(t, Math.min(t, CAP)), agent: t, label: label(L.ep, t), line: "", code: FF[n === 0 ? 1 : 0] });
      });
    }
    const L5 = F.landings.find((l) => l.slide === 5), L6 = F.landings.find((l) => l.slide === 6), L7 = F.landings.find((l) => l.slide === 7);
    const T5 = F.stops.find((s) => s.slide === 5), T6 = F.stops.find((s) => s.slide === 6), T7 = F.stops.find((s) => s.slide === 7);
    const lastOf = (L) => L.from + L.frames.length - 1, hitsIn = (L) => L.frames.filter((f) => f[11] === 1).length;
    const skip = (L, played, text, note) => ({ from: first[L.slide] - 1, to: first[L.slide] + played, moves: played, text, note });
    const wallNote = (n) => tr(`, in which the paddle pushes against the top or bottom wall ${kn(n)} times, a move that leaves it in place`, `, en el que la paleta empuja ${kn(n)} veces contra la pared de arriba o la de abajo, un movimiento que la deja en su lugar`);
    const plays = (a, b, eps, shown) => tr(`Steps ${kn(a)} to ${kn(b)} play, ${eps}, each with its minibatch step; the drawing shows ${shown}`, `Se juegan los pasos ${kn(a)} a ${kn(b)}, ${eps}, cada uno con su paso de minibatch; el dibujo muestra ${shown}`);
    const episode = (e) => tr(`episode ${kn(e)}`, `el episodio ${kn(e)}`);

    // Slide 5: the last step of episode 335, where the network values right the move that hits, but a random move misses.
    {
      const f = L5.frames.at(-1), t = lastOf(L5), right = T5.right, all = T5.decisive, c = T5.check;
      warn(L5.ep === 335 && L5.from === 4777 && t === 4854 && L5.frames.length === 78 && hitsIn(L5) === 6, "slide 5 does not land on the last step of episode 335 (steps 4,777 to 4,854, 6 hits)");
      warn(f[3] === 5 && f[4] === 4 && f[1] === 3 && f[5] === 3 && f[8] > f[7] && f[8] > f[6] && f[9] === 1 && f[10] === 1 && f[11] === -1, "slide 5's last step is not the ball one step away, falling, the paddle on rows 3 and 4, down valued most and a random stay that misses");
      warn(T5.window.join() === "4501,5000" && right === 30 && all === 30 && c.t === 5000 && c.perfect === 0 && c.missed === 12 && c.certain === 12, "slide 5's claims about steps 4,501 to 5,000 and the check at step 5,000 do not hold");
      // "Around this episode" and "just after this episode": the window holds the episode, and the check comes after it.
      warn(T5.window[0] <= L5.from && t <= T5.window[1] && t < c.t, "slide 5's episode is not inside its window, or the check is not after it");
      slides.push({ title: tr("The right last move", "El último movimiento, bien elegido"),
        skip: skip(L5, L5.frames.length - 1, tr(`Steps 13 to ${kn(t)}`, `Pasos 13 a ${kn(t)}`), `${plays(13, t, tr(`the rest of episode 2 and episodes 3 to ${kn(L5.ep)}`, `el resto del episodio 2 y los episodios 3 a ${kn(L5.ep)}`), episode(L5.ep))}${wallNote(presses[5])}.`),
        builds: [
          { code: [4], s: pair(f), q: f.slice(6, 9).map(q3), pick: f[9], memory: strip(t, T5.size, T5.draws), agent: t, sound: "fall", label: label(L5.ep, t), eq: valuesEq("φ", f.slice(6, 9)),
            line: tr(`In steps ${kn(T5.window[0])} to ${kn(T5.window[1])}, around this episode, whenever the ball was one step away and the move decided a hit, the network valued most a move that hits: ${right} times out of ${all}. Here it prefers ${MOVES[2]}, the one move that hits, but most moves are still random, and this one is: the paddle stays, and the ball will be missed.`,
              `Entre los pasos ${kn(T5.window[0])} y ${kn(T5.window[1])}, alrededor de este episodio, cada vez que la pelota estaba a un paso y el movimiento decidía la devolución, la red valoró más un movimiento que la devuelve: ${right} veces de ${all}. Aquí prefiere ${MOVES[2]}, el único movimiento que la devuelve, pero la mayoría de los movimientos todavía son al azar, y este lo es: la paleta se queda, y la pelota se escapará.`) },
          { s: pair(f), q: f.slice(6, 9).map(q3), pick: f[9], memory: strip(t, T5.size, T5.draws), agent: t, label: label(L5.ep, t),
            line: tr(`A check plays each of the 12 serves with no random moves. At the check of step ${kn(c.t)}, just after this episode, every serve still ends in a miss, and every miss was certain before the last move: the network knows the last move, not yet how to bring the paddle there in time.`,
              `Una prueba juega cada uno de los 12 saques sin movimientos al azar. En la prueba del paso ${kn(c.t)}, justo después de este episodio, cada saque todavía termina con la pelota escapándose, y cada vez eso era seguro antes del último movimiento: la red sabe el último movimiento, pero todavía no cómo llevar la paleta a tiempo.`) },
        ] });
    }
    // Slide 6: episode 471, the first rally to reach the cut of ten hits.
    {
      const t = lastOf(L6), e = L6.end, last = L6.frames.at(-1);
      warn(L6.ep === 471 && L6.from === 7981 && t === 8094 && L6.frames.length === 114 && hitsIn(L6) === 10 && last[11] === 1, "slide 6 does not land on episode 471, the first rally of ten hits, steps 7,981 to 8,094");
      warn(T6.t === t && T6.age === 4216 && T6.differ === 23 && T6.random === 22 && Math.abs(epsAt(t) - 0.27) < 0.01, "slide 6's counts at step 8,094 are not 4,216, 23 and 22, or ε is not about 0.27");
      slides.push({ title: tr("Ten hits in a row", "Diez devoluciones seguidas"),
        skip: skip(L6, L6.frames.length, tr(`Steps ${kn(lastOf(L5) + 1)} to ${kn(t)}`, `Pasos ${kn(lastOf(L5) + 1)} a ${kn(t)}`), `${plays(lastOf(L5) + 1, t, tr(`episodes ${kn(L5.ep + 1)} to ${kn(L6.ep)}`, `los episodios ${kn(L5.ep + 1)} a ${kn(L6.ep)}`), episode(L6.ep))}${wallNote(presses[6])}.`),
        builds: [
          { code: [5], s: pair(e), q: e.slice(6, 9).map(q3), memory: strip(t, T6.size, T6.draws), agent: t, sound: "wall", label: label(L6.ep, t),
            line: tr(`Episode ${kn(L6.ep)} is the first rally to reach the cut of ten hits, at step ${kn(t)}, while about one move in four is still random.`, `El episodio ${kn(L6.ep)} es el primer peloteo que llega al corte de diez devoluciones, en el paso ${kn(t)}, cuando todavía cerca de un movimiento de cada cuatro es al azar.`) },
          { code: [7, 8], s: pair(e), q: e.slice(6, 9).map(q3), memory: strip(t, T6.size, T6.draws), agent: t, label: label(L6.ep, t),
            line: tr(`Of the 32 transitions drawn at this step, made ${kn(T6.age)} steps ago on average, ${T6.differ} hold a move that the network would not choose now, and ${T6.random} a random move. Each target still uses the best move of its next pair of frames.`, `De las 32 transiciones sacadas en este paso, hechas hace ${kn(T6.age)} pasos en promedio, ${T6.differ} tienen un movimiento que la red no elegiría ahora, y ${T6.random} un movimiento al azar. Cada objetivo usa igual el mejor movimiento de su siguiente par de cuadros.`) },
        ] });
    }
    // Slide 7: the end of the run.
    {
      const t = lastOf(L7), e = L7.end;
      warn(t === 20000 && L7.frames.length === 38 && T7.t === t && T7.size === CAP && T7.full === CAP && T7.stable === 8250 && epsAt(t) === 0.1, "slide 7's claims (the memory full from step 10,000, ε at 0.1, every check perfect from step 8,250) do not hold");
      slides.push({ title: tr("What it learned", "Lo que aprendió"),
        skip: skip(L7, L7.frames.length, tr(`Steps ${kn(lastOf(L6) + 1)} to ${kn(t)}`, `Pasos ${kn(lastOf(L6) + 1)} a ${kn(t)}`), `${plays(lastOf(L6) + 1, t, tr(`episodes ${kn(L6.ep + 1)} to ${kn(L7.ep)}`, `los episodios ${kn(L6.ep + 1)} a ${kn(L7.ep)}`), tr(`the last one, episode ${kn(L7.ep)}, which the run's end leaves unfinished`, `el último, el episodio ${kn(L7.ep)}, que el final de la corrida deja sin terminar`))}${wallNote(presses[7])}.`),
        builds: [
          { s: pair(e), q: e.slice(6, 9).map(q3), memory: strip(t, T7.size, T7.draws), agent: t, label: label(L7.ep, t),
            line: tr(`Step ${kn(t)}. The memory has been full since step ${kn(T7.full)}, so each transition stays there for ${kn(CAP)} steps, and ε has stayed at 0.1. From step ${kn(T7.stable)} on, every check hit the ball ten times from every serve. In plain words: the agent moves the paddle to where the ball will arrive.`,
              `Paso ${kn(t)}. La memoria está llena desde el paso ${kn(T7.full)}, así que cada transición se queda ahí ${kn(CAP)} pasos, y ε se ha mantenido en 0.1. Desde el paso ${kn(T7.stable)}, cada prueba devolvió la pelota diez veces desde cada saque. En palabras simples: el agente lleva la paleta adonde llegará la pelota.`) },
        ] });
    }
    // Short texts: with the pseudocode beside the run the readout shows only the current press, so a text that leaned on
    // an earlier press, or said what its lit line says, gets one that stands alone, with the same cells and numbers.
    {
      const [b1, b2] = [slides[0].builds, slides[1].builds], b4 = slides[3].builds, x1 = st(1), x2 = st(2), tied = bestOf(x1.qn);
      const way = (t) => tr(`Transition ${kn(t)}, drawn ${times(drawn(st(t), t))}, moves ${st(t).pct}% of the way to its target.`, `La transición ${kn(t)}, sacada ${times(drawn(st(t), t))}, avanza un ${st(t).pct}% del camino hacia su objetivo.`);
      b1[6].short = tr(`The draws are with repeats, so the memory's only transition is drawn all ${kn(drawn(x1, 1))} times.`, `Los sorteos son con repetición, así que la única transición de la memoria sale las ${kn(drawn(x1, 1))} veces.`);
      b1[7].short = tr(`The next pair of frames of transition 1 is ${sub("φ", 2)}, the one in view, whose largest value ${and(tied.map((a) => DOING[a]))} share.`, `El siguiente par de cuadros de la transición 1 es ${sub("φ", 2)}, el que se ve, cuyo mayor valor comparten ${and(tied.map((a) => DOING[a]))}.`);
      b1[8].short = tr(`The first step of section 2's figure: the value of staying in ${sub("φ", 1)} rises from ${f3(x1.v0)} to ${f3(x1.v1)}, ${x1.pct}% of the way. The same step raised the value of staying in ${sub("φ", 2)}, the pair in view, to ${f3(x1.qa[1])}.`, `El primer paso de la figura de la sección 2: el valor de quedarse en ${sub("φ", 1)} sube de ${f3(x1.v0)} a ${f3(x1.v1)}, un ${x1.pct}% del camino. El mismo paso subió el valor de quedarse en ${sub("φ", 2)}, el par que se ve, a ${f3(x1.qa[1])}.`);
      b2[0].short = tr(`Random: ${MOVES[x2.a]}. The paddle moves down and the ball to ${xy(x2.s1)}; reward 0. The memory holds two transitions.`, `Al azar: ${MOVES[x2.a]}. La paleta baja y la pelota va a ${xy(x2.s1)}; recompensa 0. La memoria tiene dos transiciones.`);
      b2[5].short = way(4);
      b2[7].short = way(5);
      const tail = [[8, tr(`the ball moves to ${xy(st(8).s1)}, on the bottom wall`, `la pelota va a ${xy(st(8).s1)}, en la pared de abajo`)], [9, tr(`the ball bounces up to ${xy(st(9).s1)}`, `la pelota rebota hacia arriba, a ${xy(st(9).s1)}`)],
        [10, tr(`the ball moves to ${xy(st(10).s1)}`, `la pelota va a ${xy(st(10).s1)}`)], [11, tr(`the paddle reaches the top, rows 0 and 1, and the ball moves to ${xy(st(11).s1)}`, `la paleta llega arriba, filas 0 y 1, y la pelota va a ${xy(st(11).s1)}`)]];
      tail.forEach(([t, what], i) => { b4[i + 1].short = `${tr(`Random: ${MOVES[st(t).a]}; ${what}.`, `Al azar: ${MOVES[st(t).a]}; ${what}.`)} ${way(t)}`; });
    }
    for (const sl of slides) for (const b of sl.builds) if (b.eq) b.eq = xs(b.eq);
    warn(slides.reduce((n, sl) => n + sl.builds.length, 0) === 31, "Figure 3 does not have the 31 presses the plan sets");
    slideshow({ svg, slides, frame: (m) => FR[m], view: createPongView(svg), code: CODE });
  }
}
