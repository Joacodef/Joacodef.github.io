import { el, tr, fmt, makeHandle, makeDraggable, modeButtons } from "../../plane.js";
import { slideshow, num, eqv, rngFrom } from "./gridworld.js";
import { stepCP, X_MAX, deg, cartStage, swingArc, pushChart, createPushView, sitOf, swingOf, featNo, HINGE_Y } from "./cartpole.js";

// The control note's agent sees twelve situations of the cart-pole, the pole's angle in six ranges of 4° and the way it
// swings, and keeps a weight for each situation and push (cartpole.js numbers them w1 to w24, swinging left first).
const n1 = (v) => fmt(v, 1);
// A count: 2,000 in English, and 2000 in Spanish, which writes four digits without a separator.
const kn = (k) => tr(k.toLocaleString("en"), String(k));
const warn = (ok, what) => { if (!ok) console.warn(`control figures: ${what}`); };
const left = tr("left", "izquierda"), right = tr("right", "derecha"), pushName = (a) => (a ? right : left);
const qh = `<span class="hat lo"><i>q</i></span>`, wv = `<b class="vec">w</b>`, RB = `<span class="ovl"><i>R</i></span>`;
const wi = (p) => `<i>w</i><sub>${featNo(p)}</sub>`;
// Where a situation's pole leans, and whether it is falling (swinging toward its lean) or swinging back.
const range = (k) => k >> 2, sw = (k) => k & 1;
function leanWords(k) {
  const c = k >> 1, side = c >= 3 ? right : left, near = c === 2 || c === 3, far = c === 0 || c === 5;
  return near ? tr(`less than 4° to the ${side}`, `a menos de 4° a la ${side}`)
    : far ? tr(`8° to 12° to the ${side}`, `entre 8° y 12° a la ${side}`) : tr(`4° to 8° to the ${side}`, `entre 4° y 8° a la ${side}`);
}
const falling = (k) => ((k >> 1) >= 3) === ((k & 1) === 1);
const sitWords = (k) => tr(`${leanWords(k)}, ${falling(k) ? "falling" : "swinging back"}`, `${leanWords(k)}, ${falling(k) ? "cayendo" : "volviendo"}`);

/* ---------- Section 1: values of pushes ---------- */

// The random policy's values (rl/ctl-fig1.mjs): each pair's average return over 400,000 episodes (seed 424242), every
// visit, left and right made symmetric, in the order w1 to w24. A pair's weight at this average is where gradient Monte
// Carlo settles; q̂(s, a, w) is then how many more steps the pole stays up after push a, with random pushes afterwards.
const RANDOM_W = [4.87, 2.66, 12.66, 7.49, 20.28, 15.02, 22.28, 19.82, 20.4, 22.23, 14.68, 21.52, 21.52, 14.68, 22.23, 20.4, 19.82, 22.28, 15.02, 20.28, 7.49, 12.66, 2.66, 4.87];
const QR = Array.from({ length: 24 }, (_, p) => RANDOM_W[featNo(p) - 1]);
// The reader drags the pole's tip, or uses the arrow keys: the angle moves in steps of 1° between the middles of
// 1° slices (±0.5° to ±11.5°), so that it never sits on a range's edge, and the pole swings the way it last moved.
{
  const svg = document.getElementById("fig-q"), out = document.getElementById("fig-q-out");
  if (svg) {
    const stage = cartStage(svg);
    const swingP = el("path", { class: "cp-swing" }, svg), swingH = el("polygon", { class: "cp-swing-head" }, svg);
    const chart = pushChart(svg, { top: 168, vmax: 25, step: 5, axisName: tr("steps until the pole falls", "pasos hasta que el péndulo cae") });
    svg.setAttribute("viewBox", `0 0 440 ${chart.height}`);
    const dot = el("circle", { class: "gw-agent", r: 5.5 }, svg);
    const h = makeHandle(svg, "grip");
    let ang = 6.5, swing = 1;
    const set = (v) => {
      v = Math.max(-11.5, Math.min(11.5, v));
      if (v === ang) return;
      swing = v > ang ? 1 : 0; ang = v; render();
    };
    function render() {
      const s = [0, 0, (ang * Math.PI) / 180, swing ? 1 : -1], k = sitOf(s), pL = 2 * k, pR = pL + 1, better = QR[pR] > QR[pL] ? 1 : 0;
      stage.place(s);
      stage.push(s, better, true);
      const sa = swingArc(stage.hingeX(s), HINGE_Y, 90, ang, swing, 4, 20);
      swingP.setAttribute("d", sa.arc); swingH.setAttribute("points", sa.head);
      chart.draw({ w: QR, labeled: [pL, pR], sel: k });
      dot.setAttribute("cx", chart.ax(ang)); dot.setAttribute("cy", chart.pBot(swing));
      h.setAttribute("transform", `translate(${stage.tipX(s).toFixed(1)} ${stage.tipY(s).toFixed(1)})`);
      const side = ang > 0 ? right : left, swingSide = swing ? right : left;
      h.setAttribute("aria-label", tr(`The pole, leaning ${Math.abs(ang)}° to the ${side} and swinging ${swingSide}`, `El péndulo, inclinado ${Math.abs(ang)}° a la ${side} y girando hacia la ${swingSide}`));
      const hi = Math.max(QR[pL], QR[pR]), lo = Math.min(QR[pL], QR[pR]);
      out.innerHTML = `<p class="eq"><span class="nowrap">${qh}(<i>s</i>, left, ${wv}) = ${wi(pL)} ≈ ${n1(QR[pL])},</span> <span class="nowrap">${qh}(<i>s</i>, right, ${wv}) = ${wi(pR)} ≈ ${n1(QR[pR])}</span></p>`
        + `<p>${tr(`Leaning ${Math.abs(ang)}° to the ${side} and swinging ${swingSide}, ${falling(k) ? "falling" : "swinging back"}. Pushed ${pushName(better)}, and at random afterwards, the pole stays up ${n1(hi)} more steps on average; pushed ${pushName(1 - better)}, ${n1(lo)}.`,
          `Inclinado ${Math.abs(ang)}° a la ${side} y girando hacia la ${swingSide}, ${falling(k) ? "cayendo" : "volviendo"}. Empujado hacia la ${pushName(better)}, y al azar después, el péndulo se mantiene ${n1(hi)} pasos más en promedio; empujado hacia la ${pushName(1 - better)}, ${n1(lo)}.`)}</p>`;
      out.querySelector(".eq").innerHTML = out.querySelector(".eq").innerHTML.replaceAll(", left,", `, ${tr("left", "izquierda")},`).replaceAll(", right,", `, ${tr("right", "derecha")},`);
    }
    makeDraggable(h, {
      move: ({ x, y }) => { const a = (Math.atan2(x - stage.hingeX([0]), HINGE_Y - y) * 180) / Math.PI; set(Math.round(a - 0.5) + 0.5); },
      step: ([dx]) => { if (dx) set(ang + dx); },
    });
    render();
  }
}

/* ---------- Section 2: semi-gradient Sarsa on the cart-pole ---------- */

// 500 episodes from seed 4416: one-step semi-gradient Sarsa with ε = 0, every weight at 300 at the start (more than any
// episode of the run lasts: the longest, episode 100, takes 286 steps) and α = 0.1 throughout. Ties are broken at
// random, one random number each. runCtl(shown) keeps every step of the episodes in shown as frames, and the details of
// episodes 1 and 2. The figure runs it twice: first to find the episodes its slides stop at, then to keep their steps,
// so that a skip plays the episode it lands on, rather than the last states of the episodes it passes, which once the
// pole stays up all look alike.
function runCtl(shown) {
  const SEED = 4416, EPISODES = 500, ALPHA = 0.1, W0 = 300, DETAIL = 2;
  const rnd = rngFrom(SEED), w = Array(24).fill(W0), frames = [], eps = [], after = [];
  const choose = (k) => { const q0 = w[2 * k], q1 = w[2 * k + 1]; return q0 === q1 ? { a: rnd() < 0.5 ? 0 : 1, tie: true } : { a: q1 > q0 ? 1 : 0, tie: false }; };
  for (let e = 1; e <= EPISODES; e++) {
    const detail = e <= DETAIL, keep = shown.has(e), start = [0, 1, 2, 3].map(() => (rnd() - 0.5) * 0.1);
    let s = start, k = sitOf(s), c = choose(k), T = 0, end = null, side = 0;
    const steps = detail ? [] : null, first = c, th = [];
    const frameOf = (s1, push) => frames.push({ e, t: T, s: s1, w: w.slice(), push, agent: frames.length, label: tr(`Episode ${kn(e)}, step ${T}`, `Episodio ${kn(e)}, paso ${T}`) });
    for (;;) {
      const o = stepCP(s, c.a), i = 2 * k + c.a, from = w[i], before = detail ? w.slice() : null;
      T++; th.push(o.s[2]);
      if (o.done) {
        w[i] += ALPHA * (1 - from);
        end = Math.abs(o.s[0]) > X_MAX ? "cart" : "pole"; side = Math.sign(o.s[0]);
        if (detail) steps.push({ s0: s, k, a: c.a, tie: c.tie, s1: o.s, done: true, i, from, to: w[i], target: 1, before, after: w.slice() });
        if (keep) frameOf(o.s);
        s = o.s; break;
      }
      const k1 = sitOf(o.s), c1 = choose(k1), j = 2 * k1 + c1.a, target = 1 + w[j];
      w[i] += ALPHA * (target - from);
      if (detail) steps.push({ s0: s, k, a: c.a, tie: c.tie, s1: o.s, k1, a1: c1.a, tie1: c1.tie, i, j, from, to: w[i], target, boot: target - 1, before, after: w.slice() });
      if (keep) frameOf(o.s);
      s = o.s; k = k1; c = c1;
    }
    // The pole's mean lean over the second half of the episode.
    const half = th.slice(Math.floor(th.length / 2));
    eps.push({ T, end, side, last: s, start, steps, first, lean: half.reduce((a, b) => a + b, 0) / half.length });
    after.push(w.slice());
  }
  // The frame that ends episode e, for an episode whose steps are kept.
  const endOf = (e) => { let m = frames.length - 1; while (m > 0 && frames[m].e > e) m--; return m; };
  const frame = (m) => ({ ...frames[m], jump: true });
  return { eps, frames, frame, endOf, after, EPISODES, W0 };
}
const CTL = (() => {
  const pass = runCtl(new Set());
  const firstCart = pass.eps.findIndex((x) => x.end === "cart") + 1;
  let settled = 1; for (let e = pass.EPISODES; e >= 1; e--) if (pass.eps[e - 1].end !== "cart") { settled = e + 1; break; }
  const shown = new Set([...Array(firstCart).keys()].map((i) => i + 1).concat([100, settled, pass.EPISODES]));
  return { ...runCtl(shown), firstCart, settled };
})();

{
  const svg = document.getElementById("fig-sarsa-cp");
  if (svg) {
    const R = CTL, E1 = R.eps[0], S1 = E1.steps, F = R.frames, W0s = Array(24).fill(R.W0);
    const p = (k, a) => 2 * k + a;
    warn(E1.T === 9 && E1.end === "pole" && S1.map((x) => x.a).join("") === "000000001", "episode 1 is not the 9 steps the slides describe");
    warn([0, 1, 5, 6, 7].every((t) => S1[t].tie1) && [2, 3, 4].every((t) => !S1[t].tie1) && S1[0].tie, "episode 1's ties are not where the slides say");
    const ang = (s) => n1(Math.abs(deg(s[2]))), turnSide = (s) => (s[3] > 0 ? right : left);
    const tdEq = (x) => `<span class="nowrap">δ = <span class="pt">${x.done ? "1" : `1 + ${num(x.boot)}`}</span> − ${num(x.from)} ${eqv(x.target - x.from)}</span>`;
    const updEq = (x) => `<span class="nowrap"><span class="upd">${wi(x.i)}</span> ← ${num(x.from)} + 0.1 · ${x.target - x.from < 0 ? `(${num(x.target - x.from)})` : num(x.target - x.from)}</span> <span class="nowrap">${eqv(x.to)}</span>`;
    const lbl = (t) => tr(`Episode 1, step ${t}`, `Episodio 1, paso ${t}`);
    const x0 = S1[0], s0 = x0.s0;
    const slides = [
      { title: tr("Every push worth 300", "Todo empujón vale 300"), builds: [
        { s: s0, w: W0s, agent: -1, label: lbl(0), line: tr(`Every weight starts at 300: the agent expects any push to keep the pole up for 300 more steps, longer than any episode it will play. The pole starts ${ang(s0)}° to the right of upright, swinging ${turnSide(s0)}.`, `Todos los pesos parten en 300: el agente espera que cualquier empujón mantenga el péndulo 300 pasos más, más que cualquier episodio que jugará. El péndulo parte ${ang(s0)}° a la derecha de la vertical, girando hacia la ${turnSide(s0)}.`) },
        { s: s0, w: W0s, agent: -1, label: lbl(0), push: x0.a, pick: p(x0.k, x0.a), line: tr(`Both pushes are worth 300, a tie, broken at random: ${pushName(x0.a)}.`, `Los dos empujones valen 300, un empate, que se rompe al azar: hacia la ${pushName(x0.a)}.`) },
        { s: x0.s1, w: W0s, agent: 0, label: lbl(1), line: tr(`Pushed ${pushName(x0.a)}, the cart rolls ${pushName(x0.a)}, and the pole starts swinging ${turnSide(x0.s1)}: a new situation, in the lower row.`, `Empujado hacia la ${pushName(x0.a)}, el carro rueda hacia la ${pushName(x0.a)} y el péndulo empieza a girar hacia la ${turnSide(x0.s1)}: una situación nueva, en la fila de abajo.`) },
        { s: x0.s1, w: W0s, agent: 0, label: lbl(1), push: x0.a1, pick: x0.j, line: tr(`Before updating, the agent chooses its next push, A′, from the weights as they stand: a tie again, broken ${pushName(x0.a1)}.`, `Antes de actualizar, el agente elige su próximo empujón, A′, con los pesos tal como están: otro empate, que se rompe hacia la ${pushName(x0.a1)}.`) },
        { s: x0.s1, w: W0s, agent: 0, label: lbl(1), push: x0.a1, pick: x0.j, tg: x0.j, line: tr(`The target is the reward, 1, plus the value of that push, outlined in red: 301, one step more than expected.`, `El objetivo es la recompensa, 1, más el valor de ese empujón, con borde rojo: 301, un paso más de lo esperado.`), eq: tdEq(x0) },
        { s: x0.s1, w: x0.after, agent: 0, label: lbl(1), push: x0.a1, tg: x0.j, upd: x0.i, line: tr(`The weight of the push just made rises to ${num(x0.to)}: in its situation, the bar of a push to the ${pushName(x0.a)} is now the taller one.`, `El peso del empujón recién hecho sube a ${num(x0.to)}: en su situación, la barra de un empujón a la ${pushName(x0.a)} es ahora la más alta.`), eq: updEq(x0) },
      ] },
    ];
    // Steps 2 to 8: take the push chosen, choose the next one, update.
    const stepLine = (t) => {
      const x = S1[t], into = x.k1 !== x.k;
      if (t === 7) return tr(`${pushName(x.a)[0].toUpperCase() + pushName(x.a).slice(1)}: the pole passes 8°, into a new situation. A tie there, broken ${pushName(x.a1)}, at last. The weight of the push just made rises to ${num(x.to)}.`, `Hacia la ${pushName(x.a)}: el péndulo pasa los 8°, a una situación nueva. Ahí hay un empate, que se rompe hacia la ${pushName(x.a1)}, por fin. El peso del empujón recién hecho sube a ${num(x.to)}.`);
      if (into) return tr(`Left again: the pole passes 4°, into a new situation, where both pushes are worth 300, a tie, broken ${pushName(x.a1)}. The target borrows that 300, and the weight of the push just made rises to ${num(x.to)}.`, `Otra vez a la izquierda: el péndulo pasa los 4°, a una situación nueva, donde los dos empujones valen 300, un empate, que se rompe hacia la ${pushName(x.a1)}. El objetivo toma prestado ese 300, y el peso del empujón recién hecho sube a ${num(x.to)}.`);
      if (x.tie1) return tr(`Left again, and the pole swings right faster. Its next push is a tie again, broken ${pushName(x.a1)}, and the TD error is 1 again: the weight rises to ${num(x.to)}.`, `Otra vez a la izquierda, y el péndulo gira más rápido hacia la derecha. Su próximo empujón es otra vez un empate, que se rompe hacia la ${pushName(x.a1)}, y el TD error vuelve a ser 1: el peso sube a ${num(x.to)}.`);
      if (t === 2) return tr(`Left again. Now left is the taller bar, so the agent picks it without a tie, and its weight rises again, to ${num(x.to)}: a push that is raised gets repeated.`, `Otra vez a la izquierda. Ahora la izquierda es la barra más alta, así que el agente la elige sin empate, y su peso sube de nuevo, a ${num(x.to)}: un empujón que sube se repite.`);
      return tr(`Left again, the pole ${ang(x.s1)}° to the right and turning faster: ${num(x.to)}.`, `Otra vez a la izquierda, el péndulo a ${ang(x.s1)}° a la derecha y girando más rápido: ${num(x.to)}.`);
    };
    slides.push({ title: tr("A push that is raised gets repeated", "Un empujón que sube se repite"), builds: [1, 2, 3, 4, 5, 6, 7].map((t) => {
      const x = S1[t];
      return { s: x.s1, w: x.after, agent: t, label: lbl(t + 1), push: x.a1, pick: x.j, tg: x.j, upd: x.i, line: stepLine(t), eq: `${tdEq(x)}; ${updEq(x)}` };
    }) });
    const xf = S1[8];
    slides.push({ title: tr("The fall", "La caída"), builds: [{ s: xf.s1, w: xf.after, agent: 8, label: lbl(9), upd: xf.i, sound: "fall", line: tr(`Right, too late: the pole passes 12° and the episode ends after ${E1.T} steps. A fall has no next push, so the target is the reward alone, 1, far below 300, and the weight of that last push drops by about 30 at once.`, `Hacia la derecha, demasiado tarde: el péndulo pasa los 12° y el episodio termina tras ${E1.T} pasos. Una caída no tiene próximo empujón, así que el objetivo es solo la recompensa, 1, muy por debajo de 300, y el peso de ese último empujón baja de una vez cerca de 30.`), eq: `${tdEq(xf)}; ${updEq(xf)}` }] });
    // Later episodes.
    const E2 = R.eps[1], last2 = E2.steps.at(-1), w2 = R.after[1];
    warn(E2.T === 9 && E2.end === "pole" && last2.a === 0 && last2.k === xf.k && Math.abs(w2[xf.i] - xf.to) < 1e-9 && w2[last2.i] < R.W0, "episode 2 is not the one the slide describes");
    const sum = (e, extra) => ({ ...R.frame(R.endOf(e)), push: undefined, hideDot: true, label: tr(`Episode ${kn(e)}, after it ends`, `Episodio ${kn(e)}, después del final`), ...extra });
    const shows = (a, b) => tr(`Episodes ${a} to ${kn(b)} play, with an update at every step; the drawing shows the last of them.`, `Se juegan los episodios ${a} a ${b}, con una actualización en cada paso; el dibujo muestra el último.`);
    const skip = (from, to, text, note) => ({ from: R.endOf(from), to: R.endOf(to), moves: Math.max(1, R.endOf(to) - R.endOf(from)), text, note });
    slides.push({ title: tr("The other push", "El otro empujón"), skip: skip(1, 2, tr(`Episode 2: ${E2.T} steps`, `Episodio 2: ${E2.T} pasos`), tr("Episode 2 plays, with an update at every step.", "Se juega el episodio 2, con una actualización en cada paso.")),
      builds: [sum(2, { upd: last2.i, line: tr(`Episode 2 goes the same way: left again and again, and the pole falls right after ${E2.T} steps. But past 8°, right is now worth ${num(xf.to)}, so the agent tries left, still at 300, and it too drops, to ${num(last2.to)}. That is optimism at work: whatever the agent tries falls short of 300, so the push it has not tried looks better.`, `El episodio 2 va igual: izquierda una y otra vez, y el péndulo cae a la derecha tras ${E2.T} pasos. Pero pasado 8°, la derecha ahora vale ${num(xf.to)}, así que el agente prueba la izquierda, todavía en 300, y también baja, a ${num(last2.to)}. Es el optimismo en acción: todo lo que el agente prueba se queda corto de 300, así que el empujón que no ha probado parece mejor.`) })] });
    const firstCart = R.eps.findIndex((x) => x.end === "cart") + 1, eLong = R.eps[firstCart - 1];
    warn(firstCart === 8 && eLong.T === 173 && R.eps.slice(0, 7).every((x) => x.T < 30), "the first long episode is not episode 8, of 173 steps");
    slides.push({ title: tr("A first long episode", "Un primer episodio largo"), skip: skip(2, firstCart, tr(`Episodes 3 to ${firstCart}`, `Episodios 3 a ${firstCart}`), tr(`Episodes 3 to ${firstCart} play, with an update at every step.`, `Se juegan los episodios 3 a ${firstCart}, con una actualización en cada paso.`)),
      builds: [sum(firstCart, { line: tr(`Episodes 3 to ${firstCart - 1} last at most 24 steps. Episode ${firstCart} lasts ${eLong.T}, and ends not with the pole falling but with the cart leaving the track.`, `Los episodios 3 a ${firstCart - 1} duran a lo más 24 pasos. El episodio ${firstCart} dura ${eLong.T}, y no termina con el péndulo cayendo sino con el carro saliendo del riel.`) })] });
    // When every weight is below 300 for good.
    const last300 = R.after.reduce((m, w, i) => (w.some((v) => v >= R.W0) ? i + 1 : m), 0);
    const w100 = R.after[99], e100 = R.eps[99], falls50 = R.eps.slice(50, 100).filter((x) => x.end === "pole").length;
    warn(e100.T === Math.max(...R.eps.map((x) => x.T)) && e100.end === "cart" && falls50 >= 40, "episode 100 is not the longest of the run, ended by the cart, after mostly falls");
    warn(last300 === 81 && Math.max(...w100) < 280, "the weights do not all fall below 300 after episode 81, or are not below 280 after 100");
    slides.push({ title: tr("Optimism wears off", "El optimismo se gasta"), skip: skip(firstCart, 100, tr(`Episodes ${firstCart + 1} to 100`, `Episodios ${firstCart + 1} a 100`), shows(firstCart + 1, 100)),
      builds: [
        sum(100, { line: tr(`After 100 episodes no weight is above ${Math.ceil(Math.max(...w100))}. Some had first crept above 300, while a push kept the pole in the same situation and each step's target was 1 plus the very weight being updated; the last fell below 300 in episode ${last300}.`, `Tras 100 episodios ningún peso pasa de ${Math.ceil(Math.max(...w100))}. Algunos subieron primero sobre 300, mientras un empujón mantenía el péndulo en la misma situación y el objetivo de cada paso era 1 más el mismo peso que se actualizaba; el último bajó de 300 en el episodio ${last300}.`) }),
        sum(100, { line: tr(`Episode 100, the one just played, is the longest of the run, ${e100.T} steps, and ends with the cart off the track. But the pole fell in ${falls50} of the 50 episodes before it.`, `El episodio 100, el que se acaba de jugar, es el más largo de la corrida, ${e100.T} pasos, y termina con el carro fuera del riel. Pero el péndulo cayó en ${falls50} de los 50 episodios anteriores.`) }),
      ] });
    // From which episode every episode ends with the cart off the track.
    const settled = R.settled, later = R.eps.slice(settled - 1);
    warn(later.every((x) => x.end === "cart" && x.side > 0 && x.lean > 0), "once the pole stays up, an episode does not end with the cart off the right end, the pole leaning right over its second half");
    const Ls = R.eps.slice(settled - 1).map((x) => x.T), lo = Math.min(...Ls), hi = Math.max(...Ls), mean = Ls.reduce((a, b) => a + b, 0) / Ls.length;
    warn(settled === 207, "the pole does not stop falling at episode 207");
    slides.push({ title: tr("The pole stays up, but not the cart", "El péndulo se mantiene, pero no el carro"), skip: skip(100, settled, tr(`Episodes 101 to ${settled}`, `Episodios 101 a ${settled}`), shows(101, settled)),
      builds: [sum(settled, { line: tr(`From episode ${settled} on, the pole never falls again, but every episode still ends, after ${lo} to ${hi} steps: the pole settles a little to the right, and the cart speeds up to the right to stay under it, until it runs off the end of the track.`, `Desde el episodio ${settled}, el péndulo no vuelve a caer, pero cada episodio igual termina, tras ${lo} a ${hi} pasos: el péndulo se asienta un poco a la derecha, y el carro acelera hacia la derecha para seguir bajo él, hasta salir del riel por el extremo.`) })] });
    // What it learned.
    const wEnd = R.after[R.EPISODES - 1], gaps = [0, 2, 4, 7, 9, 11].map((k) => { const a = k & 1; return wEnd[2 * k + a] - wEnd[2 * k + 1 - a]; });
    warn(gaps.every((g) => g > 30), "after 500 episodes, a falling situation does not prefer the push the way it falls by more than 30 steps");
    const best = (k) => (wEnd[2 * k + 1] > wEnd[2 * k] ? 1 : 0), mirror = (k) => 2 * (5 - (k >> 1)) + (1 - (k & 1));
    warn([4, 5].some((k) => best(k) !== 1 - best(mirror(k))), "after 500 episodes, the pushes near upright are mirror images");
    const fin = sum(R.EPISODES, {});
    slides.push({ title: tr("What the agent learned", "Lo que aprendió el agente"), skip: skip(settled, R.EPISODES, tr(`Episodes ${settled + 1} to ${R.EPISODES}`, `Episodios ${settled + 1} a ${R.EPISODES}`), shows(settled + 1, R.EPISODES)),
      builds: [
        { ...fin, line: tr(`In the six situations where the pole is falling, leaning and swinging the same way, the agent pushes the way it falls, and the other push is worth ${Math.round(Math.min(...gaps))} to ${Math.round(Math.max(...gaps))} steps less: a push that way brings the cart back under the pole.`, `En las seis situaciones en que el péndulo cae, inclinado y girando hacia el mismo lado, el agente empuja hacia donde cae, y el otro empujón vale entre ${Math.round(Math.min(...gaps))} y ${Math.round(Math.max(...gaps))} pasos menos: un empujón hacia ese lado devuelve el carro bajo el péndulo.`) },
        { ...fin, line: tr(`Where the pole swings back, the two pushes are closer. Nothing in what the agent sees tells it where the cart is or how fast it moves, so it cannot stop the drift: the cart runs off the track after ${Math.round(mean)} steps on average. That it always goes right is an accident of this run: its pushes near upright are not mirror images of each other.`, `Donde el péndulo vuelve, los dos empujones están más cerca. Nada de lo que ve el agente le dice dónde está el carro ni qué tan rápido se mueve, así que no puede frenar la deriva: el carro sale del riel tras ${Math.round(mean)} pasos en promedio. Que siempre se vaya a la derecha es un accidente de esta corrida: sus empujones cerca de la vertical no son el reflejo unos de otros.`) },
      ] });
    slideshow({ svg, slides, frame: R.frame, view: createPushView(svg, { vmax: 300, step: 100, axisName: tr("steps until the episode ends", "pasos hasta que termina el episodio") }) });
  }
}

/* ---------- Section 3: n-step semi-gradient Sarsa ---------- */

// The length of each of the first 300 episodes, averaged over 200 agents (seeds 1 to 200), for n-step semi-gradient
// Sarsa with section 2's settings, ε = 0, every weight at 300 and α = 0.1 (rl/ctl-fig3.mjs). The curves average each
// episode with the 9 before it.
const CURVES = {
  1: [72.9, 53.2, 55.3, 58.2, 41.8, 40.1, 39.8, 39.9, 43.8, 46.3, 50.4, 55.2, 51.1, 54.9, 43.6, 40.9, 38.4, 38.2, 38.2, 33.7, 36.8, 34.7, 31.4, 33.1, 37.9, 40.9, 39, 38.9, 32.6, 30.8, 32.3, 30, 32.1, 27.6, 26.8, 25.3, 27.2, 24.8, 31.8, 32.1, 29, 30.4, 28.3, 33.9, 34.5, 42.6, 43.6, 37.6, 37, 37.1, 35.5, 34.9, 37.1, 41.9, 40.5, 44.9, 42.5, 44.6, 46.6, 49.4, 39.8, 43.6, 44.8, 40.3, 40.7, 51.8, 47.7, 47.7, 51.7, 50.2, 48.7, 54.1, 53.4, 51.7, 52.1, 56, 50.2, 50.8, 52.5, 53.8, 50.7, 56.1, 59.3, 54.4, 54.4, 53.8, 58, 54.7, 60.5, 52.6, 56.1, 59.1, 56.1, 54.5, 59.3, 55.5, 56.8, 65.5, 63.5, 56.1, 65.8, 65.6, 70.2, 62.6, 58.6, 64.8, 55.1, 61.2, 61.1, 52.6, 52.1, 55.9, 61.9, 55.5, 53.2, 60.5, 57.7, 56.4, 60.1, 56.5, 51.7, 56.6, 49.6, 56.8, 60.4, 60.5, 53.9, 65.4, 62.1, 65.1, 65.2, 60.7, 58.7, 68.1, 58.9, 61.6, 67.6, 63.2, 62.5, 68.1, 64.4, 58.4, 72.3, 71.7, 66.4, 64.8, 62.6, 68.8, 59, 62, 61.3, 51, 56.6, 60.7, 57.1, 60.8, 61.9, 64.8, 65.1, 60.8, 58.8, 57.5, 60.9, 65.5, 65.1, 66.2, 65.1, 63, 69.3, 66.2, 63.7, 70.8, 69.6, 59.8, 65.8, 66.2, 68.7, 66.1, 65.1, 61.7, 71.3, 70.5, 68.2, 69.7, 71.8, 68.5, 74.4, 70.7, 66.6, 63, 70.8, 69.7, 66.3, 72, 74.6, 74.3, 82.6, 79.2, 77.7, 72.1, 75.1, 76.7, 77.6, 82.6, 86.3, 84.4, 83.3, 78.4, 81.5, 84.5, 82.9, 91.5, 85.9, 83.2, 80.4, 86.3, 85.6, 85.2, 91.7, 87.1, 87.8, 91.2, 87.9, 96.4, 90.5, 89, 98.2, 94.3, 92.8, 93.2, 97.8, 101, 97.3, 91.8, 96.6, 91.8, 91.3, 90.7, 96.9, 99.1, 91.3, 98.5, 102.1, 103.3, 100.7, 109.6, 101.7, 106.9, 110.4, 106.3, 111.3, 106.6, 110.7, 113.9, 115.3, 113.5, 114.2, 117.5, 123.1, 120.6, 122.6, 121.8, 122.7, 127.4, 127.1, 130.4, 127.2, 128.3, 127.6, 132.5, 131.5, 127.1, 135.8, 137.6, 133.1, 131.5, 131.8, 132.8, 133.7, 133.4, 136.2, 136.8, 144.9, 140.1, 143.2, 140.9, 140.2, 150.4, 148.3, 152.8, 147.5, 144.1, 143.9, 148.3, 148.6, 144.2, 146.3, 151.6, 151.7, 154.6],
  4: [75.9, 78.4, 88.4, 91.2, 97.4, 84.7, 75.3, 63.9, 65.9, 56.6, 50.2, 64, 59.2, 69.2, 78.3, 84.4, 75.9, 85.8, 84.7, 83.7, 83.8, 91.2, 84.4, 97, 85.6, 95.6, 88.8, 96.5, 95.6, 107.4, 101.2, 106.6, 103.8, 94.9, 98.5, 94, 95.2, 100.3, 99.7, 100.9, 106.7, 105.3, 100.6, 104.7, 105.3, 107.3, 114.3, 108.7, 110, 110.3, 111.7, 108.2, 112.8, 119.2, 119.7, 104.5, 106.2, 109.5, 122.4, 117.8, 122.8, 119, 134.7, 122.9, 126.5, 117.9, 119.7, 126.4, 123.7, 134, 123.1, 130.4, 129.3, 135.2, 138.1, 133.2, 138.2, 132.4, 135.2, 139.1, 141.2, 138.7, 138.9, 140, 144.1, 151.3, 144.4, 142.7, 143.4, 147.9, 152.1, 160, 158, 155.6, 152.4, 145.8, 150.3, 153, 154, 154.1, 156, 158.9, 156.6, 157.6, 165.7, 162.5, 159.4, 162.5, 159.6, 166.2, 165, 161.2, 171.2, 166.1, 163.1, 169.3, 163.5, 165.6, 166.9, 167.5, 166.6, 170.7, 176, 175.2, 173.6, 173.9, 170.5, 173.8, 175.2, 174.5, 171.1, 174.3, 176.5, 175.7, 176.1, 172.9, 172.5, 176.2, 173, 179.6, 178.1, 180.7, 177.3, 174.9, 173.4, 178.8, 176, 171.4, 177.9, 174.9, 181.4, 180, 179.2, 179.4, 181.9, 178.9, 181.3, 178.3, 180.9, 182.3, 180.3, 182.5, 185.1, 179.9, 183.6, 175, 179.7, 181.1, 184, 182.9, 179.9, 181.2, 182.9, 181.4, 179.2, 177.5, 176.8, 182.1, 177.5, 178.7, 181.8, 178.3, 181.5, 184.7, 185.2, 184.2, 181.5, 180.1, 184.9, 181, 183.4, 181.9, 179.2, 182.1, 180.3, 182.3, 181.6, 179.7, 183.5, 183.2, 180.9, 183.8, 182.1, 178.8, 184.7, 182.4, 181.1, 183.8, 180.4, 178.1, 178.1, 183.8, 184.1, 182.9, 179.3, 181.8, 183.5, 179.8, 183.5, 177, 177.7, 182.8, 180.5, 181.2, 183, 181.2, 178.2, 183.9, 182.4, 181.5, 180.2, 186.5, 183.8, 183.2, 185.1, 183.7, 182.7, 182.1, 186.9, 183, 183.1, 180.8, 181.7, 180.5, 179.8, 178.7, 181.9, 180.3, 183.6, 183.8, 182.5, 184.5, 187.5, 184.6, 185.5, 183.3, 183.1, 181.4, 182, 187.8, 182.5, 183.9, 186.8, 181.5, 182.9, 181.9, 184.7, 185.6, 181.1, 181.1, 181.9, 180.2, 181.6, 181.9, 179.7, 180.5, 175.9, 184.2, 182.7, 182.7, 182.8, 178.2, 181.8, 185.8, 183.6, 183.5, 186, 179.5, 181.6, 185.7, 184.1, 184.6, 184.7, 182.7, 183, 186.3, 179.8, 179.2, 180.3, 184],
  16: [31.7, 43.4, 76.3, 84.1, 78.3, 75.9, 80.6, 91, 98.1, 100.9, 97.5, 107.3, 105.5, 117.1, 105.9, 112.5, 132.1, 127.7, 129.3, 133, 127.5, 143.1, 141.9, 139.4, 148.9, 142.5, 146.9, 151.8, 152, 154.4, 155.1, 159.9, 163.8, 158.3, 163.8, 171.5, 172.9, 180.4, 177, 178.9, 180.7, 178.4, 173.2, 180.1, 175.9, 178.9, 180, 182.2, 180.7, 181.6, 176.3, 176.4, 179.4, 186.2, 178.4, 183.2, 186, 183.1, 183.3, 179, 179, 179.4, 186, 183.1, 186.9, 186.3, 183.7, 185.3, 189.2, 186.8, 185.4, 187.4, 183.4, 180.2, 183.1, 186.6, 186.7, 181, 187.8, 183.3, 187.7, 188, 188.4, 186.5, 185.9, 191, 183.8, 187.5, 184, 187.9, 192.4, 183.9, 187.8, 186.9, 190.7, 183.5, 189.2, 189, 186.7, 180.8, 191.7, 188.1, 192.2, 184.5, 184.9, 186.2, 186.8, 188.7, 185, 186.9, 189.5, 190.1, 185.8, 185.4, 187.5, 182.8, 184.9, 185.2, 187.1, 181.6, 181.9, 184.9, 185.8, 187.6, 189.8, 186.4, 184.3, 186.4, 186.1, 188.6, 185.2, 186.1, 189.4, 189.5, 187.1, 185.6, 186.6, 184.9, 186.6, 187.8, 191.7, 187.4, 187.5, 188.5, 186.7, 185.3, 190.8, 187.2, 184.2, 188.3, 188, 185.8, 189.3, 186.2, 185.3, 187, 186, 187.4, 187.5, 187.1, 189.6, 188.1, 187.1, 193.2, 185.3, 187.1, 186.5, 187.5, 188.1, 185.5, 188.3, 191, 187, 189.6, 188.2, 188.5, 185, 187.7, 187.1, 183.3, 186.7, 189.4, 187.3, 187.4, 188.3, 188, 186.1, 191.1, 190.4, 188.8, 184.9, 187, 187.6, 185.4, 184.6, 187.6, 185, 189.3, 188, 186.8, 187.2, 188.8, 188, 186, 188.6, 187.3, 187.9, 187.2, 185.7, 183.5, 185, 189.3, 188.4, 187.8, 188.5, 182.5, 187.7, 187.5, 185.9, 184.8, 189.1, 187.1, 190.1, 187.4, 186.1, 189.6, 190.8, 189.4, 185.1, 184.5, 186.8, 183.4, 187, 181.5, 187.5, 185.4, 187.2, 191.4, 184.8, 188.7, 182.7, 185.1, 188, 186.5, 183.6, 192.6, 186.8, 185.5, 188.2, 187.9, 189.4, 184.2, 184.5, 188, 189.1, 185, 187.9, 186.5, 189.9, 187.4, 186.3, 185.6, 188.4, 187.7, 186.7, 190.7, 189.3, 188.1, 188.3, 184.9, 192.3, 185.8, 185.9, 189.5, 187.7, 189.1, 186.4, 186.8, 187.9, 187.3, 189.5, 188.2, 185.9, 189, 188.9, 186.3, 188.8, 188.3, 185, 188.8, 186.1, 188.1, 189.4, 184.6, 184, 190, 184.2, 185.8, 186.7, 185],
  64: [21.9, 19.4, 70.4, 69.9, 68.8, 49.9, 50.4, 39.9, 31.6, 27.5, 21.5, 28.1, 21.5, 26, 30.4, 32.4, 40.8, 50.3, 60.2, 66, 62.4, 85.8, 88, 101.8, 103.8, 107, 115.8, 121.2, 136.8, 137.9, 145.3, 152.6, 156.7, 159.5, 161.4, 161.3, 169.6, 174.4, 169.6, 173.3, 178.1, 174.4, 173.8, 179.4, 179.7, 171.4, 180.8, 179.3, 185.5, 178.7, 180.8, 182.4, 183.8, 177.5, 181.7, 180.3, 182.6, 183.3, 182.6, 178.6, 179.9, 179.2, 181.7, 180.8, 181.9, 180.9, 180, 182.5, 182, 184.2, 184, 180.7, 181.5, 184, 182.8, 185.8, 182.4, 182.4, 183.3, 186.3, 178.7, 180.9, 182.9, 181.9, 181.3, 186.9, 180.9, 184.3, 182.2, 183.5, 182.8, 183.4, 180.4, 184.8, 179.5, 183.6, 180.2, 181.6, 186.1, 182.4, 183.4, 181.5, 177.5, 182.1, 180.9, 182, 184.4, 185.3, 181.3, 186, 180.8, 181, 182.2, 186.2, 182.2, 182.7, 184.1, 182.4, 181, 185.4, 180.3, 183.7, 183.4, 177.3, 183.4, 184.1, 188.8, 184.9, 182.7, 180.1, 183.2, 180.4, 181.4, 180.7, 184.8, 184.6, 178.4, 184.4, 180.2, 184.1, 180.5, 182.4, 184.2, 183.9, 180.3, 177.8, 184.4, 183.6, 180.7, 181.8, 182.5, 183.5, 180, 181.9, 185.6, 183.2, 181.9, 182.6, 181.7, 183.2, 185, 183.8, 182.4, 185.1, 184.7, 180.5, 184.7, 183.1, 182.2, 182.2, 182.2, 178.6, 184.4, 181.5, 182, 185.3, 181.3, 187.2, 184.8, 182.2, 184.2, 179.7, 184.3, 187.1, 183.9, 183.6, 183.9, 180.8, 182.7, 181.4, 181.2, 180.4, 183.9, 182.3, 182.5, 184.8, 183, 182.6, 184.8, 182.9, 184.7, 184.2, 180.7, 184.2, 184, 181.4, 184.7, 180.5, 180.4, 183.5, 182.8, 183.6, 183.5, 184.6, 181.8, 184.2, 180.4, 183.5, 183.7, 181, 184.5, 181.6, 178.8, 183.4, 183.6, 183.2, 185.1, 183.6, 183.1, 182.7, 180.6, 184.2, 183.9, 183.6, 179.6, 182.9, 182.6, 181.1, 181.3, 183.2, 182.5, 182.5, 181.2, 182.4, 182.8, 179, 184.6, 183.8, 183.8, 184.3, 183.7, 182.7, 174.9, 184.8, 179.3, 181.2, 183.8, 183.9, 182.4, 182.5, 182.3, 181.5, 184.9, 180.6, 185.5, 180.1, 186.3, 186.5, 184.8, 185, 181.6, 183.6, 184.7, 183, 183.5, 182.8, 182.7, 181.5, 183.6, 180.3, 183.8, 183.3, 183.4, 184.1, 183.6, 184.3, 183.4, 181.2, 181.7, 181.4, 184.2, 182.6, 186.4, 181.2, 184.2, 184.8, 181.3, 184.9, 181.7, 179.7],
};
{
  const svg = document.getElementById("fig-nstep-cp"), out = document.getElementById("fig-nstep-cp-out");
  if (svg) {
    const E = 300, VMAX = 200, top = 22, H = 230, y0 = top + H, XA = 72, XB = 420;
    svg.setAttribute("viewBox", `0 0 440 ${y0 + 60}`);
    const ex = (e) => XA + ((e - 1) / (E - 1)) * (XB - XA), ey = (v) => y0 - (Math.min(VMAX, v) / VMAX) * H;
    const axes = el("g", { class: "axes" }, svg);
    el("line", { x1: XA, y1: y0, x2: XB, y2: y0 }, axes);
    el("line", { x1: XA, y1: y0, x2: XA, y2: top - 4 }, axes);
    for (let v = 0; v <= VMAX; v += 50) {
      el("line", { x1: XA - 5, y1: ey(v), x2: XA, y2: ey(v) }, axes);
      if (v) el("line", { class: "cp-grid", x1: XA, y1: ey(v), x2: XB, y2: ey(v) }, svg);
      el("text", { class: "tick", x: XA - 10, y: ey(v) + 5, "text-anchor": "end" }, svg).textContent = String(v);
    }
    for (let e = 0; e <= E; e += 50) {
      const x = ex(Math.max(1, e));
      el("line", { x1: x, y1: y0, x2: x, y2: y0 + 5 }, axes);
      el("text", { class: "gw-axis", x, y: y0 + 20, "text-anchor": "middle" }, svg).textContent = String(e || 1);
    }
    el("text", { class: "gw-sg", x: (XA + XB) / 2, y: y0 + 44, "text-anchor": "middle" }, svg).textContent = tr("episode", "episodio");
    const midY = (top + y0) / 2;
    el("text", { class: "gw-sg", x: 24, y: midY, "text-anchor": "middle", transform: `rotate(-90 24 ${midY})` }, svg).textContent = tr("steps per episode, 200 agents", "pasos por episodio, 200 agentes");
    const smooth = (a) => a.map((_, i) => { const s = a.slice(Math.max(0, i - 9), i + 1); return s.reduce((x, y) => x + y, 0) / s.length; });
    const lines = {}, sm = {};
    for (const n of [1, 4, 16, 64]) { sm[n] = smooth(CURVES[n]); lines[n] = el("polyline", { class: "cp-curve", points: sm[n].map((v, i) => `${ex(i + 1).toFixed(1)},${ey(v).toFixed(1)}`).join(" ") }, svg); }
    const mean50 = (n) => CURVES[n].slice(0, 50).reduce((x, y) => x + y, 0) / 50;
    warn(mean50(1) < mean50(4) && mean50(4) < mean50(16) && mean50(64) < mean50(16) && mean50(64) > mean50(4), "the first 50 episodes do not rank n = 1 < 4 < 64 < 16");
    const S = (t) => `<i>S</i><sub>${t}</sub>`, Aa = (t) => `<i>A</i><sub>${t}</sub>`;
    function show(mode) {
      const n = Number(mode), tn = n === 1 ? "<i>t</i>+1" : `<i>t</i>+${n}`;
      for (const k in lines) lines[k].setAttribute("class", Number(k) === n ? "ln-path" : "cp-curve");
      svg.appendChild(lines[n]);
      const m = mean50(n), end = sm[n][E - 1];
      const reach = sm[n].findIndex((v) => v >= 175) + 1;
      const say = {
        1: tr(`and only by episode 300 does the pole stay up ${Math.round(end)} steps.`, `y solo hacia el episodio 300 el péndulo se mantiene ${Math.round(end)} pasos.`),
        4: tr(`and from episode ${reach} on, about as long as the cart stays on the track.`, `y desde el episodio ${reach}, más o menos lo que el carro dura en el riel.`),
        16: tr(`the fastest of the four.`, `el más rápido de los cuatro.`),
        64: tr(`fewer than with 16: early episodes are shorter than 64 steps, so most of its targets are whole returns, which vary more.`, `menos que con 16: los primeros episodios duran menos de 64 pasos, así que la mayoría de sus objetivos son retornos completos, que varían más.`),
      }[n];
      out.innerHTML = `<p class="eq"><span class="nowrap"><i>G</i><sub><i>t</i>:${tn}</sub> = ${n} + ${qh}(${S(tn)}, ${Aa(tn)}, ${wv})</span></p><p>${tr(`With <i>n</i> = ${n}, the first 50 episodes last ${n1(m)} steps on average, ${say}`, `Con <i>n</i> = ${n}, los primeros 50 episodios duran ${n1(m)} pasos en promedio, ${say}`)}</p>`;
      svg.setAttribute("aria-label", tr(`Four curves of the steps per episode over 300 episodes, averaged over 200 agents, for n-step semi-gradient Sarsa with n = 1, 4, 16 and 64; the one for n = ${n} is highlighted, ${n1(m)} steps on average over the first 50 episodes.`, `Cuatro curvas de los pasos por episodio a lo largo de 300 episodios, promediados sobre 200 agentes, para n-step semi-gradient Sarsa con n = 1, 4, 16 y 64; la de n = ${n} está destacada, ${n1(m)} pasos en promedio en los primeros 50 episodios.`));
    }
    modeButtons(document.getElementById("fig-nstep-cp-modes"), show);
    show("1");
  }
}

/* ---------- Sections 4 and 5: the continuing cart-pole ---------- */

// Differential semi-gradient n-step Sarsa (10.5's algorithm) on the continuing cart-pole, 100,000 steps from seed 904:
// n = 4, α = 0.1, β = 0.0001, ε = 0, every weight and R̄ at 0. A failure, the pole past 12° or the cart off the track,
// gives −1 and starts the cart and pole afresh; every other step gives 0. runDiff(windows) keeps the details of the
// first 13 steps and a frame for every step inside the windows, [first, last] steps. The figure runs it twice: first to
// find the pole's last fall, then to keep the last 200 steps before each step its slides stop at, which its skips play.
function runDiff(windows) {
  const SEED = 904, STEPS = 100000, N = 4, ALPHA = 0.1, BETA = 0.0001, DETAIL = 13;
  const rnd = rngFrom(SEED), w = Array(24).fill(0), M = N + 1, S = [], K = [], A = [], R = [];
  let rbar = 0, fails = 0, poles = 0;
  const choose = (k) => { const q0 = w[2 * k], q1 = w[2 * k + 1]; return q0 === q1 ? { a: rnd() < 0.5 ? 0 : 1, tie: true } : { a: q1 > q0 ? 1 : 0, tie: false }; };
  const start = () => [0, 1, 2, 3].map(() => (rnd() - 0.5) * 0.1);
  S[0] = start(); K[0] = sitOf(S[0]); R[0] = 0;
  const c0 = choose(K[0]); A[0] = c0.a;
  const steps = [], frames = [], failAt = [], inWindow = (t) => windows.some(([a, b]) => t >= a && t <= b);
  const label = (t, rb) => `${tr(`Step ${kn(t)}`, `Paso ${kn(t)}`)} · <span class="ovl"><i>R</i></span> = ${fmt(rb, 4)}`;
  for (let t = 0; t < STEPS; t++) {
    const sNow = S[t % M], aNow = A[t % M], kNow = K[t % M], o = stepCP(sNow, aNow);
    let r = 0, s2 = o.s, fell = null, by = null;
    if (o.done) { r = -1; fails++; by = Math.abs(o.s[0]) > X_MAX ? "cart" : "pole"; if (by === "pole") poles++; fell = o.s; s2 = start(); failAt.push({ t: t + 1, by, side: Math.sign(o.s[0]) }); }
    R[(t + 1) % M] = r; S[(t + 1) % M] = s2; K[(t + 1) % M] = sitOf(s2);
    const c = choose(K[(t + 1) % M]); A[(t + 1) % M] = c.a;
    const tau = t - N + 1;
    let up = null;
    if (tau >= 0) {
      const iu = 2 * K[tau % M] + A[tau % M], ib = 2 * K[(tau + N) % M] + A[(tau + N) % M], rs = [];
      for (let i = tau + 1; i <= tau + N; i++) rs.push(R[i % M]);
      const rb0 = rbar, from = w[iu], boot = w[ib];
      const d = rs.reduce((x, y) => x + y - rb0, 0) + boot - from;
      rbar += BETA * d;
      w[iu] += ALPHA * d;
      if (t < DETAIL) up = { tau, iu, ib, rs, d, rb0, rb1: rbar, from, to: w[iu], boot, win: Array.from({ length: N }, (_, i) => 2 * K[(tau + i) % M] + A[(tau + i) % M]) };
    }
    if (t < DETAIL) steps.push({ t, s0: sNow, k: kNow, a: aNow, s1: fell ?? s2, fell: !!fell, r, a1: c.a, tie1: c.tie, p1: 2 * K[(t + 1) % M] + c.a, up, w: w.slice(), rbar, label: label(t + 1, rbar) });
    if (inWindow(t + 1)) frames.push({ t: t + 1, s: fell ?? s2, w: w.slice(), rbar, fails, poles, by, agent: frames.length, label: label(t + 1, rbar) });
  }
  const at = (t) => frames.findIndex((f) => f.t === t);
  const frame = (m) => ({ ...frames[m], jump: true });
  return { steps, frames, frame, at, failAt, w, rbar, N, S0: steps[0].s0, a0: c0, label };
}
const DIFF = (() => {
  const SHOW = 200, STOPS = [1000, 10000, 100000];
  const pass = runDiff([]);
  const lastPole = pass.failAt.filter((f) => f.by === "pole").at(-1).t, before = pass.failAt.filter((f) => f.t < lastPole).at(-1)?.t ?? 0;
  const windows = [[Math.max(before + 1, lastPole - SHOW + 1), lastPole], ...STOPS.map((s) => [s - SHOW + 1, s])];
  return { ...runDiff(windows), lastPole, windows };
})();

// Section 4: 1,100 steps of the agent section 5 trains, with its policy after 100,000 steps, from a fresh start
// (rl/ctl-fig5-facts.mjs, seed 27): the cart leaves the track 6 times, at these steps, and every other step gives 0.
// The reader drags the end of the running sum of R − R̄ (arrow keys too), which sets R̄ in steps of 0.0005.
const STRETCH = { steps: 1100, fails: [173, 335, 509, 671, 882, 1050] };
{
  const svg = document.getElementById("fig-avg"), out = document.getElementById("fig-avg-out");
  if (svg) {
    const L = STRETCH.steps, FT = STRETCH.fails, nF = FT.length, top = 24, H = 240, mid = top + H / 2, VM = 8, XA = 72, XB = 404;
    svg.setAttribute("viewBox", `0 0 440 ${top + H + 58}`);
    const sx = (t) => XA + (t / L) * (XB - XA), sy = (v) => mid - (Math.max(-VM, Math.min(VM, v)) / VM) * (H / 2);
    const axes = el("g", { class: "axes" }, svg);
    el("line", { x1: XA, y1: top + H, x2: XB, y2: top + H }, axes);
    el("line", { x1: XA, y1: top + H, x2: XA, y2: top - 4 }, axes);
    for (let v = -VM; v <= VM; v += 4) {
      el("line", { x1: XA - 5, y1: sy(v), x2: XA, y2: sy(v) }, axes);
      if (v && v !== -VM) el("line", { class: "cp-grid", x1: XA, y1: sy(v), x2: XB, y2: sy(v) }, svg);
      el("text", { class: "tick", x: XA - 10, y: sy(v) + 5, "text-anchor": "end" }, svg).textContent = fmt(v, 0);
    }
    el("line", { class: "zero", x1: XA, y1: mid, x2: XB, y2: mid }, svg);
    for (let t = 0; t <= L; t += 200) {
      el("line", { x1: sx(t), y1: top + H, x2: sx(t), y2: top + H + 5 }, axes);
      el("text", { class: "gw-axis", x: sx(t), y: top + H + 20, "text-anchor": "middle" }, svg).textContent = kn(t);
    }
    for (const f of FT) el("line", { class: "cp-fail", x1: sx(f), y1: top + H - 7, x2: sx(f), y2: top + H }, svg);
    el("text", { class: "gw-sg", x: (XA + XB) / 2, y: top + H + 44, "text-anchor": "middle" }, svg).textContent = tr("step (the cart leaves the track at the marks)", "paso (el carro sale del riel en las marcas)");
    {
      const yl = el("text", { class: "gw-sg", x: 24, y: mid, "text-anchor": "middle", transform: `rotate(-90 24 ${mid})` }, svg);
      yl.append(tr("sum of R − ", "suma de R − "));
      el("tspan", { class: "ovl-t" }, yl).textContent = "R";
      yl.append(tr(" so far", " hasta ahí"));
    }
    const path = el("path", { class: "cp-sum" }, svg);
    const h = makeHandle(svg, "grip");
    let rb = 0;
    const endOf = (r) => -nF - L * r;
    function render() {
      let d = "M" + sx(0) + "," + sy(0), before = 0;
      for (const f of FT) { const v = -before - f * rb; d += ` L${sx(f).toFixed(1)},${sy(v).toFixed(1)} L${sx(f).toFixed(1)},${sy(v - 1).toFixed(1)}`; before++; }
      const e = endOf(rb);
      d += ` L${sx(L).toFixed(1)},${sy(e).toFixed(1)}`;
      path.setAttribute("d", d);
      h.setAttribute("transform", `translate(${sx(L).toFixed(1)} ${sy(e).toFixed(1)})`);
      const rbS = fmt(rb, 4), level = Math.abs(rb + nF / L) < 0.00025;
      h.setAttribute("aria-label", tr(`The end of the sum after ${kn(L)} steps: ${fmt(e, 2)}, with the estimate of the average reward at ${rbS}`, `El final de la suma tras ${kn(L)} pasos: ${fmt(e, 2)}, con la estimación de la recompensa promedio en ${rbS}`));
      const say = rb === 0 ? tr(`With ${RB} = 0, the sum drops by 1 at every failure and never climbs back: in a task that never ends it would fall without limit, as a return that adds every reward would.`, `Con ${RB} = 0, la suma baja 1 en cada falla y nunca vuelve a subir: en una tarea que no termina caería sin límite, como lo haría un retorno que suma todas las recompensas.`)
        : level ? tr(`${RB} matches the rate of failures, ${nF} in ${kn(L)} steps: the sum climbs ${fmt(-rb, 4)} a step and drops 1 at each failure, and stays level. What remains are its rises and falls.`, `${RB} coincide con la tasa de fallas, ${nF} en ${kn(L)} pasos: la suma sube ${fmt(-rb, 4)} por paso y baja 1 en cada falla, y se mantiene a nivel. Lo que queda son sus subidas y bajadas.`)
        : rb > -nF / L ? tr(`${RB} is above the rate of failures, so the sum still drifts down: in the long run it would fall without limit.`, `${RB} está sobre la tasa de fallas, así que la suma todavía baja: a la larga caería sin límite.`)
        : tr(`${RB} is below the rate of failures, so the sum drifts up: in the long run it would grow without limit.`, `${RB} está bajo la tasa de fallas, así que la suma sube: a la larga crecería sin límite.`);
      const rbP = rb < 0 ? `(${rbS})` : rbS;
      out.innerHTML = `<p class="eq"><span class="nowrap">Σ<span class="lims"><span>${L}</span><span><i>t</i>=1</span></span>(<i>R</i><sub><i>t</i></sub> − <span class="ovl"><i>R</i></span>)</span> <span class="nowrap">= −${nF} − ${L} · ${rbP}</span> <span class="nowrap">${eqv(e)}</span></p><p>${say}</p>`;
    }
    const setR = (v) => { rb = Math.max(-0.0115, Math.min(0.0015, Math.round(v / 0.0005) * 0.0005)); if (Math.abs(rb) < 1e-12) rb = 0; render(); };
    makeDraggable(h, {
      move: ({ y }) => { const e = ((mid - y) / (H / 2)) * VM; setR(-(e + nF) / L); },
      step: ([dx, dy]) => setR(rb - 0.0005 * (dy || dx)),
    });
    render();
  }
}

// Section 5: the slides of the continuing run.
{
  const svg = document.getElementById("fig-diff");
  if (svg) {
    const D = DIFF, St = D.steps, first = D.failAt[0];
    const fail = St.find((x) => x.fell);
    warn(first.t === 10 && first.by === "pole" && fail && fail.t === 9 && St.slice(3, 9).every((x) => x.up && x.up.d === 0), "the first failure is not the pole's, at step 10, after steps whose TD errors are all 0");
    warn(St.slice(9, 13).every((x) => x.up && x.up.rs.includes(-1) && x.up.d < -0.99), "the four updates after the first failure do not all carry its −1");
    const turnSide = (s) => (s[3] > 0 ? right : left), ang = (s) => n1(Math.abs(deg(s[2]))), side = (s) => (s[2] > 0 ? right : left);
    const zero = Array(24).fill(0), lbl0 = D.label(0, 0);
    const rS = (v) => (v < 0 ? `(${fmt(v, 4)})` : fmt(v, 4));
    const dEq = (u) => {
      const sumR = u.rs.reduce((x, y) => x + y, 0);
      return `<span class="nowrap">δ = <span class="pt">${sumR < 0 ? `(${fmt(sumR, 0)})` : fmt(sumR, 0)} − 4 · ${rS(u.rb0)} + ${num(u.boot)}</span> − ${num(u.from)}</span> <span class="nowrap">${eqv(u.d).replace("= 0", "= 0")}</span>`;
    };
    const uEq = (u) => `${dEq(u)}; <span class="nowrap"><span class="ovl"><i>R</i></span> ← ${fmt(u.rb1, 4)}</span>, <span class="nowrap"><span class="upd">${wi(u.iu)}</span> ← ${num(u.from)} + 0.1 · ${u.d < 0 ? `(${num(u.d)})` : num(u.d)} ${eqv(u.to)}</span>`;
    const s0 = D.S0;
    const slides = [
      { title: tr("Expecting no failures", "Sin esperar fallas"), builds: [
        { s: s0, w: zero, agent: -1, label: lbl0, line: tr(`Every weight starts at 0, and so does ${RB}, the estimate of the average reward: the agent expects no failures at all. The pole starts ${ang(s0)}° to the ${side(s0)}, swinging ${turnSide(s0)}.`, `Todos los pesos parten en 0, y también ${RB}, la estimación de la recompensa promedio: el agente no espera ninguna falla. El péndulo parte ${ang(s0)}° a la ${side(s0)}, girando hacia la ${turnSide(s0)}.`) },
        { s: s0, w: zero, agent: -1, label: lbl0, push: D.a0.a, pick: 2 * sitOf(s0) + D.a0.a, line: tr(`Both pushes are worth 0, a tie, broken at random: ${pushName(D.a0.a)}.`, `Los dos empujones valen 0, un empate, que se rompe al azar: hacia la ${pushName(D.a0.a)}.`) },
      ] },
    ];
    // Steps 1 to 9: no reward but 0; the first update waits for four rewards, then each has δ = 0.
    const quietBuilds = St.slice(0, 9).map((x) => {
      const b = { s: x.s1, w: x.w, agent: x.t, label: x.label, push: x.a1, pick: x.p1 };
      if (!x.up) return { ...b, line: x.t === 0 ? tr(`Taken: the reward is 0. With n = 4, the first update waits until four rewards have come in.`, `Hecho: la recompensa es 0. Con n = 4, la primera actualización espera a que lleguen cuatro recompensas.`) : tr(`Step ${x.t + 1}: reward 0, and still no update.`, `Paso ${x.t + 1}: recompensa 0, y todavía ninguna actualización.`) };
      const u = x.up;
      return { ...b, win: u.win, tg: u.ib, upd: u.iu, line: x.t === 3 ? tr(`The first update, for the push of step 1, with the four steps of its window in dashed blue. The four rewards are 0, as ${RB} expected, and both weights are 0: δ = 0, and nothing changes.`, `La primera actualización, para el empujón del paso 1, con los cuatro pasos de su ventana en azul punteado. Las cuatro recompensas son 0, como esperaba ${RB}, y los dos pesos valen 0: δ = 0, y nada cambia.`) : tr(`Step ${x.t + 1}: no failure, and δ = 0 again.`, `Paso ${x.t + 1}: ninguna falla, y δ = 0 otra vez.`), eq: dEq(u) };
    });
    slides[0].builds.push(...quietBuilds);
    const fBuilds = St.slice(9, 13).map((x, i) => {
      const u = x.up, b = { s: x.s1, w: x.w, agent: x.t, label: x.label, win: u.win, tg: u.ib, upd: u.iu, push: x.a1, pick: x.p1, eq: uEq(u), fit: true };
      if (i === 0) return { ...b, sound: "fall", push: undefined, pick: undefined, line: tr(`The pole passes 12° to the ${side(x.s1)}: a failure, and a reward of −1. It enters the window of the push of step ${u.tau + 1}: δ = −1, so ${RB} drops a little and that push's weight by 0.1.`, `El péndulo pasa los 12° a la ${side(x.s1)}: una falla, y una recompensa de −1. Entra en la ventana del empujón del paso ${u.tau + 1}: δ = −1, así que ${RB} baja un poco y el peso de ese empujón, 0.1.`) };
      if (i === 1) return { ...b, jump: true, line: tr(`The cart and pole start afresh, and the task goes on. The next update, for step ${u.tau + 1}, still has the −1 in its window.`, `El carro y el péndulo parten de nuevo, y la tarea sigue. La siguiente actualización, del paso ${u.tau + 1}, todavía tiene el −1 en su ventana.`) };
      return { ...b, line: tr(`The −1 is still in the window of step ${u.tau + 1}${i === 3 ? ", the last it reaches: four pushes before the failure have each dropped by 0.1" : ""}.`, `El −1 sigue en la ventana del paso ${u.tau + 1}${i === 3 ? ", la última que alcanza: cuatro empujones antes de la falla bajaron 0.1 cada uno" : ""}.`) };
    });
    slides.push({ title: tr("A failure", "Una falla"), builds: fBuilds });
    // Later stops.
    const F = D.frames, stop = (t) => D.at(t), lastPole = D.failAt.filter((f) => f.by === "pole").at(-1);
    const sk = (a, b, text, note) => ({ from: a, to: b, moves: Math.max(1, b - a), text, note });
    const lastN = (t) => { const w = D.windows.find(([, e]) => e === t); return w[1] - w[0] + 1; };
    const showsSteps = (a, b) => tr(`Steps ${kn(a)} to ${kn(b)} play, with an update at each; the drawing shows the last ${lastN(b)}.`, `Se juegan los pasos ${a} a ${b}, con una actualización en cada uno; el dibujo muestra los últimos ${lastN(b)}.`);
    const sumF = (m) => ({ ...F[m], hideDot: true });
    const f1k = sumF(stop(1000)), fLP = sumF(stop(lastPole.t)), f10k = sumF(stop(10000)), fEnd = sumF(stop(100000));
    warn(lastPole.t === 1509 && D.failAt.filter((f) => f.t > lastPole.t).every((f) => f.by === "cart" && f.side > 0), "the pole's last fall is not at step 1,509, or a later failure is not the cart leaving at the right end");
    slides.push({ title: tr("Failures come often", "Las fallas son frecuentes"), skip: sk(-1, stop(1000), tr("Steps 14 to 1,000", "Pasos 14 a 1000"), showsSteps(14, 1000)),
      builds: [{ ...f1k, line: tr(`After 1,000 steps the cart and pole have failed ${f1k.fails} times, the pole falling ${f1k.poles} of them. ${RB} is ${fmt(f1k.rbar, 4)}: β is small, so it moves only a little at each step.`, `Tras 1000 pasos el carro y el péndulo han fallado ${f1k.fails} veces, ${f1k.poles} de ellas con el péndulo cayendo. ${RB} vale ${fmt(f1k.rbar, 4)}: β es pequeño, así que se mueve solo un poco en cada paso.`) }] });
    slides.push({ title: tr("The pole's last fall", "La última caída del péndulo"), skip: sk(stop(1000), stop(lastPole.t), tr(`Steps 1,001 to ${kn(lastPole.t)}`, `Pasos 1001 a ${kn(lastPole.t)}`), showsSteps(1001, lastPole.t)),
      builds: [{ ...fLP, line: tr(`At step ${kn(lastPole.t)} the pole falls for the last time: of the ${fLP.fails} failures so far, ${fLP.poles} were the pole falling. From here on, every failure is the cart leaving the track at its right end, as in section 2.`, `En el paso ${kn(lastPole.t)} el péndulo cae por última vez: de las ${fLP.fails} fallas hasta ahí, ${fLP.poles} fueron caídas del péndulo. Desde aquí, cada falla es el carro saliendo del riel por el extremo derecho, como en la sección 2.`) }] });
    slides.push({ title: tr("10,000 steps", "10000 pasos"), skip: sk(stop(lastPole.t), stop(10000), tr(`Steps ${kn(lastPole.t + 1)} to 10,000`, `Pasos ${lastPole.t + 1} a 10000`), showsSteps(lastPole.t + 1, 10000)),
      builds: [{ ...f10k, line: tr(`After 10,000 steps, ${f10k.fails} failures. ${RB} is ${fmt(f10k.rbar, 4)}: each failure lowers it a little, and the steps between raise it back.`, `Tras 10000 pasos, ${f10k.fails} fallas. ${RB} vale ${fmt(f10k.rbar, 4)}: cada falla lo baja un poco, y los pasos entre fallas lo vuelven a subir.`) }] });
    const late = D.failAt.filter((f) => f.t > 80000).length, wEnd = D.w;
    const gaps = [0, 2, 4, 7, 9, 11].map((k) => { const a = k & 1; return wEnd[2 * k + a] - wEnd[2 * k + 1 - a]; });
    warn(gaps.every((g) => g > 0.05), "after 100,000 steps, a falling situation does not prefer the push the way it falls");
    slides.push({ title: tr("100,000 steps", "100000 pasos"), skip: sk(stop(10000), stop(100000), tr("Steps 10,001 to 100,000", "Pasos 10001 a 100000"), showsSteps(10001, 100000)),
      builds: [
        { ...fEnd, line: tr(`After 100,000 steps, ${fEnd.fails} failures, ${late} of them in the last 20,000 steps: one every ${Math.round(20000 / late)} steps on average, a reward of −1/${Math.round(20000 / late)} ≈ ${fmt(-1 / Math.round(20000 / late), 4)} per step. ${RB} is ${fmt(fEnd.rbar, 4)}.`, `Tras 100000 pasos, ${fEnd.fails} fallas, ${late} de ellas en los últimos 20000 pasos: una cada ${Math.round(20000 / late)} pasos en promedio, una recompensa de −1/${Math.round(20000 / late)} ≈ ${fmt(-1 / Math.round(20000 / late), 4)} por paso. ${RB} vale ${fmt(fEnd.rbar, 4)}.`) },
        { ...fEnd, line: tr(`Where the pole is falling, the push the way it falls is worth more, by ${fmt(Math.min(...gaps), 1)} to ${fmt(Math.max(...gaps), 1)}: that many failures fewer in the long run. Only such differences mean something: adding the same number to every weight would change no TD error, so where the bars sit as a whole comes from where they started.`, `Donde el péndulo cae, el empujón hacia donde cae vale más, por ${fmt(Math.min(...gaps), 1)} a ${fmt(Math.max(...gaps), 1)}: esas fallas menos a la larga. Solo esas diferencias significan algo: sumar el mismo número a todos los pesos no cambiaría ningún TD error, así que dónde quedan las barras en conjunto depende de dónde partieron.`) },
      ] });
    slideshow({ svg, slides, frame: D.frame, view: createPushView(svg, { vmin: -1, vmax: 0.5, step: 0.5, decimals: 2, axisName: tr("value of a push, against the average", "valor de un empujón, frente al promedio") }) });
  }
}
