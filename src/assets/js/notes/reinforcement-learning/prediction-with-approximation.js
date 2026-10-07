import { el, tr, fmt, makeHandle, makeDraggable, modeButtons } from "../../plane.js";
import { slideshow, num, eqv } from "./gridworld.js";
import { simulate, angleChart, createCartPole, rangeName, deg, NB } from "./cartpole.js";

// The cart-pole under the random policy, with the pole's angle as the only feature: 6 ranges of 4°, one weight each.
// Long-run references from 400,000 episodes (rl/cp-angle-data.mjs), left and right ranges averaged since everything is
// symmetric: the share of the time spent in each range (μ), each range's average return (the least VE, where gradient
// Monte Carlo settles), the spread of the true values inside each range (their variance, from 1,000 states valued by
// rollouts), and where TD(0) and n-step TD settle (the weights at which their expected updates are 0).
const MU = [0.0823, 0.1236, 0.2941, 0.2941, 0.1236, 0.0823];
const AVG = [4.76, 11.81, 18.9, 18.9, 11.81, 4.76];
const SPREAD = [28.4, 37.15, 15.19, 15.19, 37.15, 28.4];
const SETTLE = {
  1: [3.91, 10.7, 22.28, 22.28, 10.7, 3.91],
  2: [3.46, 10.12, 21.78, 21.78, 10.12, 3.46],
  4: [3.49, 10.05, 20.78, 20.78, 10.05, 3.49],
  8: [4.08, 10.85, 19.55, 19.55, 10.85, 4.08],
  mc: AVG,
};
// VE splits in two: the spread inside the ranges, which no weights can remove (the least VE), and how far each weight is
// from its range's average, weighed by the share of time.
const LEAST = MU.reduce((a, m, c) => a + m * SPREAD[c], 0);
const extraVE = (w) => MU.reduce((a, m, c) => a + m * (w[c] - AVG[c]) ** 2, 0);
// 500 states drawn as the random policy visits them, as [angle in degrees, true value], valued by 400 rollouts each.
const DOTS = (() => { const f = [
    2.02, 11, -1.42, 17.8, -4.07, 12.5, 1.53, 22.4, -4.85, 11.9, 10.4, 2, -0.25, 15.5, 1.57, 19.7, 1.37, 22.3, -6.91, 20, -2.06, 21.7, 7.64, 6.7,
    11.41, 1, 3.84, 7.2, -4.62, 21.7, -3.44, 22.2, 1.13, 19.7, 0.67, 14.3, 0.23, 22.6, 0.35, 12.1, -0.69, 22.1, 5.16, 14.8, 0.45, 21.8, 9.66, 2.5,
    -1, 18.9, -0.9, 20.6, 9.23, 2, -0.08, 22.8, -7.68, 9.5, -3.98, 11.8, 2.24, 22.1, -1.32, 21.7, 8.89, 2.5, 1.93, 19.4, -8.7, 19.7, -2.74, 11.1,
    1.66, 16.1, -0.72, 21.1, -3.66, 22.2, -1.5, 23.2, -7.59, 7.1, 3.94, 22.1, -7.63, 10.3, 1.66, 21.4, -10.34, 11.8, 8.58, 20.4, -10.16, 11.5, 2.33, 22.2,
    -11.22, 1, -2.79, 21.1, 0.63, 21.8, -1.91, 21.6, 5.52, 13.3, 9.9, 2.5, 1.77, 17.3, -7.12, 3.7, 4.6, 5.9, -2.6, 19.1, -9.89, 4.5, 1.04, 21.4,
    4.16, 20.3, -3.19, 10.8, 1.95, 19.5, 1.08, 22.1, 10.57, 1, 8.07, 3, 1.98, 12.5, 1.05, 17.7, 0.05, 20.7, -6.49, 21.8, 0.88, 14.4, 1.18, 17.3,
    4.32, 19.8, 8.14, 18.5, -1.45, 22.9, -7.81, 3.8, 4.9, 13.5, 0.02, 22.6, 1.57, 17.1, -1.68, 22.1, 5.87, 7.1, 1.05, 17.3, 2.42, 19.4, 11.63, 1,
    -5.61, 14.4, 0.01, 21.7, 7.1, 11.4, -4.65, 18.4, -5.78, 9.6, -0.49, 22.4, -3.84, 16.9, -0.7, 15, -1.52, 14.3, -0.95, 22.5, -5.76, 19.5, 8.04, 2.5,
    5.56, 4.5, 2.76, 16.4, 0.08, 12.9, 3.53, 8.8, 3.47, 21.7, 10.7, 2, -0.17, 22, -3.57, 14.4, -9.33, 6.8, -2.73, 21, 6.5, 11, -0.45, 14.1,
    -3.39, 22.3, -4.87, 9.6, -4.45, 9.6, -0.09, 18.1, -1.85, 20.3, -3.87, 21.9, 6.06, 17.5, -10.44, 10.5, -10.35, 2, 2.79, 19.2, 9.55, 11.1, -10.12, 3.5,
    3.31, 13.1, 4.26, 19.1, 4.69, 12.3, 2.61, 20.4, 1.47, 22, -8.85, 2.5, 1.68, 19.4, 0.57, 18.1, 6.24, 3.2, -0.19, 20.7, 3.34, 11.2, 11.96, 1,
    1.95, 23.4, -4.04, 20.3, 8.43, 6.9, -1.9, 19.3, 1.92, 20.2, 3.92, 23.4, 4.99, 15.9, -5.48, 8, -8.08, 2.5, -3.07, 20.7, -7.25, 8.4, 3.62, 21.9,
    -2.21, 19.8, 3.31, 17, 0.75, 19.4, -1.18, 22.4, 2.93, 22.3, -9.99, 2.6, -4.98, 12.2, -2.39, 18.8, 1.8, 19.4, 3.74, 20.4, 1.31, 13.7, 3.96, 21,
    -4.63, 12.4, 1.6, 17.7, -2.52, 12.5, 3.16, 19.5, 5.34, 7.4, 1.25, 22.9, -0.55, 15.6, 1.08, 21.9, -2.04, 22.3, 6.57, 4.5, 0.64, 20.8, 10.22, 1,
    -2.27, 23.1, 0.04, 21.1, 1.37, 20.3, 1.19, 22.2, 6.62, 7.2, -3.47, 13.3, 5.93, 5.1, 6.83, 4.2, 1.58, 21.9, 3.21, 21, -4.58, 12.2, -6.49, 6.3,
    1.39, 22.1, -1.81, 17.7, 2.16, 22.4, 3.19, 9.6, 7.98, 8.3, 2.52, 13.8, -3.63, 18.2, 0.31, 20.8, 0.37, 12.4, -1.7, 23.2, 0.43, 20, 5.48, 4.3,
    -5.05, 6.6, 1.81, 13.7, 4.4, 6.9, 2.24, 20.8, 6.01, 13.9, 11.99, 1, -3.68, 19.3, -10.18, 1, 4.77, 5.7, -10.72, 19.7, -0.1, 22.8, -0.91, 21.3,
    10.73, 1, -1.59, 23.2, -1.27, 13.2, -0.21, 12.6, -2.23, 22.2, -0.61, 13.7, -3.44, 10.9, 1.9, 22, 3.8, 13.2, 8.76, 13.1, -5.7, 8.5, -0.02, 22.6,
    3.05, 12.6, 0.99, 22.5, -4.33, 6.7, -7.48, 3.3, -11.36, 1, -0.49, 22.7, -2.11, 21.8, -11.48, 1, 8.04, 9.2, -5.19, 22, -0.02, 20.9, -8.49, 4,
    -2.67, 11, 11.03, 1, -2.37, 16.4, 5.96, 16.3, 3.7, 17.1, 6.08, 4.9, 9.71, 14.3, -7.21, 2.6, -1.56, 20.4, 3.2, 21.4, 0.17, 22.2, -9.61, 2,
    11.89, 1, -0.55, 18.7, -2.02, 17.3, 4.82, 6.2, 0.83, 22.7, -3.38, 14.5, 1, 17.9, 1.73, 22.9, 4.77, 18.1, 3.41, 18.3, 0.43, 22, -8.1, 3.3,
    0.26, 22.5, -2.01, 18.5, 5.59, 13.6, 3.63, 17.4, 3.19, 15.7, 3.61, 4.9, -1.83, 16, -1.82, 22.8, 0.14, 23.1, -8.73, 3.3, 0.28, 24.4, -1.02, 20.6,
    2.32, 22.2, 8.99, 12.8, -6.82, 3.5, 2.78, 22.3, 9.64, 3.7, 3.29, 22.4, -1.76, 16.6, 6.97, 6.1, 0.72, 23.1, 1.07, 19.1, 1.38, 22.4, 2.99, 22,
    0.69, 22.3, 3.58, 22.5, 9.22, 2, 10.43, 5.5, -3.88, 7.4, -5.23, 4.7, -0.08, 22.8, 0.66, 22, 3.28, 22.5, 2.42, 22.8, 1.16, 22.4, 11.55, 1,
    0.89, 21.5, -1.7, 22, 4.2, 10.4, -11.56, 1, 10.94, 1, 3.55, 17.9, -6.58, 14.1, 7.82, 2, -1.83, 22.1, 7.49, 6, -9.39, 4.1, -2.68, 12.4,
    0.28, 16, -5.39, 14, -4.9, 5, -3.16, 6.8, -7.53, 11.6, -0.98, 22.7, -1.64, 23.1, 0.24, 15.6, 1.61, 16.4, -0.14, 22.4, 7.48, 3.7, -6.6, 6.7,
    -11.48, 1, -8.05, 2.5, 10.28, 3.8, -2.66, 9.6, -8, 20.8, -3.95, 17.8, 2.03, 22.2, -2.29, 16.3, -8.14, 7, -1.6, 22.8, -9.69, 5.1, 9.46, 22.7,
    -4.66, 10.3, -0.68, 19.8, -1.58, 20, -2.67, 22.3, -11.85, 1, -2.35, 21.9, 0.31, 22.5, 1.29, 21.6, 2.03, 21.5, 3.41, 22.1, 0.41, 20.8, 2.77, 22.4,
    -2.32, 18.9, -0.41, 16.2, 1.2, 21.8, 6.77, 11.1, -7.8, 3.3, -6.58, 8.9, -2.88, 18.3, -7.53, 18, -1.65, 22.4, 9.24, 10.1, -2.43, 20.4, 7.74, 3.3,
    5.95, 14.3, 1.43, 19.4, 6.14, 4.7, -7.92, 3.3, 9.33, 2, 1.62, 17.6, -10.4, 2.5, 8.93, 2, 2.82, 22.8, -1.3, 9.9, 3.21, 20.6, 7.61, 16,
    1.28, 14.8, -8.68, 2, -0.1, 20.6, -0.93, 21.5, -2.88, 23.2, 1.48, 20.1, 3.51, 18.3, -5.08, 13.6, -0.44, 15.7, 10.06, 4.7, 6.94, 3.5, 8.99, 13.1,
    3.93, 16.5, -1.28, 22, -0.91, 22.6, -3.59, 16.9, 2.56, 21.6, -10.27, 2.5, -6.56, 13.1, 1.52, 17.5, 1.94, 12.9, 1.01, 20.2, -5.03, 9.9, -2.31, 19.4,
    -7.48, 8.5, 11.07, 1, -5.07, 10.3, 10.19, 5.6, -2.59, 18.3, -2.35, 19.2, -2.51, 19.2, -1.51, 19.4, -2.6, 20.9, 5.43, 8.2, -3.74, 23.4, -4.29, 20.3,
    -1.9, 19.4, 0.64, 21.3, 6.9, 4.4, 4.81, 9.9, -2.58, 14.9, 1.65, 22.8, 0.05, 20.4, -6.59, 21.3, 0.45, 21.4, -2.06, 21.5, -2.61, 22, 9.29, 2,
    2.64, 14.3, 4.18, 18.7, -0.28, 17.4, 0.02, 21.6, 1.32, 20.2, -6.49, 3.3, 2.25, 23.5, -1.02, 10.5, 9.98, 11.5, 4.61, 8.6, -1.56, 10.4, 8.96, 3.3,
    -10.44, 2, -1.8, 15.7, -2.31, 16.9, 2.45, 21.8, 2.45, 22.3, 1.47, 22.5, -2.39, 22, 0.02, 20.7, -1.54, 12.6, -0.72, 21.8, -8.29, 21.8, 1.39, 19.9,
    -8.72, 2, 1.35, 10.7, -1.48, 21.8, 2.65, 19.4, 2.85, 22.1, -2.53, 22, -8.26, 2, 5.07, 3.9, -10.29, 6.6, 2.25, 18.9, 2.58, 21.3, -7.32, 11.1,
    11.45, 1, -6.8, 6.1, -1.54, 22.2, 11.98, 1, 5.36, 16.5, -2.76, 22.4, 2.62, 22.4, 1.98, 13.7, -7.67, 3, 3.25, 20.6, -1.83, 13.7, -5.73, 9.2,
    2.54, 15.2, 5.88, 8, 1.44, 19.4, -11.91, 13.7, -0.81, 18.7, 6.55, 21.2, 5.64, 4.6, 2.17, 21.8, -5.71, 7.6, -1.03, 22.4, -2.54, 19.2, -8.93, 2,
    -10.65, 6.9, -0.89, 21.9, 1.84, 22.6, 10.01, 2, -8.23, 2.5, -1.27, 15, 3.81, 13.6, -1.26, 16, 3.71, 14, -2.26, 21.9, 3.02, 16.4, 0.58, 20.3,
    6.73, 14.4, 6.51, 9, -0.27, 17.6, 0.02, 22, -10.84, 1, 6.37, 4.1, -7.52, 13.5, -0.36, 19.9, -4.89, 15.8, -2.09, 19.7, -0.95, 20.6, -3.46, 8.7,
    -1.66, 20.5, -6.71, 8.8, 5.2, 4.6, 2.78, 21.8, -1.52, 12.9, -2.07, 16.7, -3.72, 22.3, -1.41, 20.5,
  ]; const out = []; for (let i = 0; i < f.length; i += 2) out.push([f[i], f[i + 1]]); return out; })();
const n1 = (v) => fmt(v, 1);
// A count of episodes: 2,000 in English, and 2000 in Spanish, which writes four digits without a separator.
const kn = (k) => tr(k.toLocaleString("en"), String(k));
const veEq = (w) => {
  const x = extraVE(w), tot = LEAST + x;
  return `<span class="ovl">VE</span> <span class="nowrap">≈ ${n1(LEAST)} + ${n1(x)}</span> <span class="nowrap">≈ ${n1(tot)}</span>`;
};

/* ---------- Section 2: which errors matter ---------- */

// The reader drags the six bars (arrow keys: 0.5 steps) over the true values of states visited by the random policy,
// from all at 12; VE is least, 22.8, with every bar at its range's average.
{
  const svg = document.getElementById("fig-ve"), out = document.getElementById("fig-ve-out");
  if (svg) {
    svg.setAttribute("viewBox", "0 0 440 340");
    const chart = angleChart(svg, { top: 26, height: 230, dots: DOTS, labelLift: 22 });
    const w = Array(NB).fill(12);
    const handles = [...Array(NB).keys()].map(() => makeHandle(svg, "grip"));
    function render() {
      chart.draw({ w });
      handles.forEach((h, c) => {
        h.setAttribute("transform", `translate(${chart.barX(c)} ${chart.ay(w[c])})`);
        h.setAttribute("aria-label", tr(`The weight of the range ${rangeName(c)}: ${n1(w[c])} steps`, `El peso del rango ${rangeName(c)}: ${n1(w[c])} pasos`));
      });
      const x = extraVE(w);
      // The bar farthest from its range's average, by its share of VE.
      let far = 0;
      for (let c = 1; c < NB; c++) if (MU[c] * (w[c] - AVG[c]) ** 2 > MU[far] * (w[far] - AVG[far]) ** 2) far = c;
      const say = x < 0.1
        ? tr("The least VE: every bar at its range's average. What remains is the spread inside the ranges, which no weights can remove.", "El menor VE: cada barra en el promedio de su rango. Lo que queda es la dispersión dentro de los rangos, que ningún peso puede quitar.")
        : tr(`${n1(LEAST)} comes from the spread inside the ranges, which no weights can remove; the rest from the bars' distance to their ranges' averages, most from the range ${rangeName(far)}.`, `${n1(LEAST)} viene de la dispersión dentro de los rangos, que ningún peso puede quitar; el resto, de la distancia de las barras a los promedios de sus rangos, sobre todo en el rango ${rangeName(far)}.`);
      out.innerHTML = `<p class="eq">${veEq(w)}</p><p>${say}</p>`;
    }
    handles.forEach((h, c) => makeDraggable(h, {
      move: ({ y }) => { const v = Math.round(((chart.y0 - y) / (chart.y0 - chart.top)) * 25 * 10) / 10; w[c] = Math.max(0, Math.min(25, v)); render(); },
      step: ([dx, dy]) => { w[c] = Math.max(0, Math.min(25, Math.round((w[c] + 0.5 * (dy || dx)) * 10) / 10)); render(); },
    }));
    // The handles above the bars and dots.
    for (const h of handles) svg.appendChild(h);
    render();
  }
}

/* ---------- Sections 3 and 4: learning on the cart-pole ---------- */

// 2,000 episodes from seed 214, the same for both methods. α shrinks after every episode, α = 0.1 · 20/(k + 19) in
// episode k (0.1 in episode 1, 0.01 by episode 181), so that the weights settle, as the convergence of these methods
// asks; with α constant, a single long episode moves a range's weight by several steps. Episode 1 takes 8 steps: the pole
// starts 2.8° to the right, the policy pushes left six times in a row, and the pole falls to the right; episode 2 takes
// 20 steps and the pole falls to the left.
const CP = (() => {
  const SEED = 214, EPISODES = 2000, alpha = (k) => (0.1 * 20) / (k + 19);
  const eps = simulate(SEED, EPISODES, 2);
  // Each method's frames: one per press-sized step of episodes 1 and 2 (their moves, and for gradient Monte Carlo the
  // updates after each), then one per later episode, with the weights after it.
  function makeRun(method) {
    const w = Array(NB).fill(0), set = new Set(), frames = [], after = [];
    const snap = (extra) => frames.push({ w: w.slice(), shown: new Set(set), ...extra });
    eps.forEach((ep, i) => {
      const k = i + 1, a = alpha(k), rs = ep.ranges, detail = k <= 2;
      const stateAt = (t) => (detail ? ep.states[t] : ep.last);
      const label = (t) => tr(`Episode ${k}, step ${t}`, `Episodio ${k}, paso ${t}`), ended = tr(`Episode ${k}, after it ends`, `Episodio ${k}, después del final`);
      if (method === "mc") {
        if (detail) for (let t = 0; t < ep.T; t++) snap({ k, t, kind: "move", s: stateAt(t + 1), label: label(t + 1), agent: frames.length });
        for (let t = 0; t < ep.T; t++) {
          const c = rs[t], g = ep.T - t, from = w[c];
          w[c] += a * (g - from); set.add(c);
          if (detail) snap({ k, t, kind: "upd", s: stateAt(t), upd: c, g, from, to: w[c], a, label: ended, agent: frames.length - 1 - t });
        }
      } else {
        for (let t = 0; t < ep.T; t++) {
          const c = rs[t], end = t === ep.T - 1, next = end ? null : rs[t + 1], wNext = end ? 0 : w[next], from = w[c];
          w[c] += a * (1 + wNext - from); set.add(c);
          if (detail) snap({ k, t, kind: "td", s: stateAt(t + 1), upd: c, next, wNext, delta: 1 + wNext - from, from, to: w[c], a, label: label(t + 1), agent: frames.length });
        }
      }
      if (!detail) snap({ k, s: ep.last, hideDot: true, label: tr(`Episode ${kn(k)}, after it ends`, `Episodio ${kn(k)}, después del final`), agent: frames.length });
      after.push(w.slice());
    });
    // The frame that ends episode k, and the weights after it.
    const endOf = (k) => { let m = frames.length - 1; while (frames[m].k > k) m--; return m; };
    const frame = (m) => ({ ...frames[m], path: undefined, jump: true });
    return { frames, frame, endOf, after, alpha };
  }
  return { eps, mc: makeRun("mc"), td: makeRun("td"), alpha, EPISODES };
})();
// An angle in degrees, to one decimal, or "just under" a range boundary it would round to, so that 3.97° in the range
// 0° to 4° does not read as 4°.
const cpAngle = (s) => { const a = Math.abs(deg(s[2])), r = Math.round(a * 10) / 10; return r % 4 === 0 && a < r && r > 0 ? tr(`just under ${r}`, `apenas menos de ${r}`) : n1(a); }, cpTurn = (s) => fmt(Math.abs(s[3]), 2);
const cpSide = (s) => (s[2] > 0 ? tr("right", "derecha") : tr("left", "izquierda"));
const cpMid = (w) => (w[2] + w[3]) / 2;
const cpWarn = (ok, what) => { if (!ok) console.warn(`cart-pole figures: ${what}`); };
const cpSkip = (from, to, text, note) => ({ from, to, moves: Math.max(1, to - from), text, note });
// A slide that sums up some episodes: the weights, and the pole as it last fell, without marks.
const cpSum = (f) => ({ ...f, upd: undefined, tg: undefined, hideDot: true });
const cpStart = (extra) => {
  const s = CP.eps[0].states[0];
  return { w: Array(NB).fill(0), shown: new Set(), s, label: tr("Episode 1, step 0", "Episodio 1, paso 0"), agent: -1, ...extra };
};
const left = tr("left", "izquierda"), right = tr("right", "derecha");
const ep1 = CP.eps[0], S1 = ep1.states, R1 = ep1.ranges, T1 = ep1.T;
cpWarn(T1 === 8 && ep1.pushes.join("") === "00000010" && R1.join("") === "333344555", "episode 1 is not the 8 steps the slides describe");
// The words for a move of episode 1: a push, and where the pole goes.
function moveLine(t) {
  const s = S1[t + 1], into = R1[t + 1] !== R1[t] && t < T1 - 1;
  if (t === T1 - 1) return tr(`Left: the pole passes 12°, and the episode ends after ${T1} steps. Each step paid +1, so the return from each state is the number of steps left: ${T1} from the start, down to 1.`, `A la izquierda: el péndulo pasa los 12° y el episodio termina tras ${T1} pasos. Cada paso pagó +1, así que el retorno desde cada estado es el número de pasos que quedaban: ${T1} desde el inicio, hasta 1.`);
  if (ep1.pushes[t] === 1) return tr(`Right at last: the turn slows to ${cpTurn(s)} rad/s, too late.`, `Por fin a la derecha: el giro baja a ${cpTurn(s)} rad/s, demasiado tarde.`);
  return into ? tr(`Left again: ${cpAngle(s)}° to the right, into the range ${rangeName(R1[t + 1])}.`, `Otra vez a la izquierda: ${cpAngle(s)}° a la derecha, en el rango ${rangeName(R1[t + 1])}.`)
    : tr(`Left again: ${cpAngle(s)}° to the right, turning at ${cpTurn(s)} rad/s.`, `Otra vez a la izquierda: ${cpAngle(s)}° a la derecha, girando a ${cpTurn(s)} rad/s.`);
}

// Section 3: gradient Monte Carlo.
{
  const svg = document.getElementById("fig-gmc");
  if (svg) {
    const R = CP.mc, F = R.frames;
    const slides = [
      { title: tr("A first episode", "Un primer episodio"), builds: [
        cpStart({ line: tr(`Episode 1 starts with the pole ${cpAngle(S1[0])}° to the right of upright, in the range ${rangeName(R1[0])}. Every weight is 0, so no range has a bar yet.`, `El episodio 1 empieza con el péndulo ${cpAngle(S1[0])}° a la derecha de la vertical, en el rango ${rangeName(R1[0])}. Todos los pesos valen 0, así que ningún rango tiene barra todavía.`) }),
        cpStart({ push: ep1.pushes[0], line: tr("The random policy picks a push: left.", "La política al azar elige un empujón: hacia la izquierda.") }),
        { ...F[0], line: tr(`Pushed left, the cart rolls left and the pole tips further right: it now turns at ${cpTurn(S1[1])} rad/s.`, `Empujado a la izquierda, el carro rueda hacia la izquierda y el péndulo se inclina más a la derecha: ahora gira a ${cpTurn(S1[1])} rad/s.`) },
      ] },
      { title: tr("Pushed the wrong way", "Empujado para el lado equivocado"), builds: [...Array(T1 - 1).keys()].map((i) => ({ ...F[i + 1], push: ep1.pushes[i + 1], line: moveLine(i + 1), ...(i + 1 === T1 - 1 ? { sound: "fall" } : {}) })) },
      { title: tr("Learning from the returns", "Aprender de los retornos"), builds: [...Array(T1).keys()].map((t) => {
        const f = F[T1 + t], same = t > 0 && R1[t] === R1[t - 1];
        const line = t === 0 ? tr(`The episode over, gradient Monte Carlo updates its steps in order. From the start the return is ${f.g}, and the weight of its range, outlined in green, moves a tenth of the way to it.`, `Terminado el episodio, gradient Monte Carlo actualiza sus pasos en orden. Desde el inicio el retorno es ${f.g}, y el peso de su rango, con borde verde, avanza un décimo del camino hacia él.`)
          : same ? tr(`State ${t + 1} leans within the same range, so its return, ${f.g}, moves the same weight.`, `El estado ${t + 1} se inclina dentro del mismo rango, así que su retorno, ${f.g}, mueve el mismo peso.`)
          : tr(`State ${t + 1} leans within a new range, whose weight moves from 0 toward ${f.g}.`, `El estado ${t + 1} se inclina dentro de un rango nuevo, cuyo peso pasa de 0 hacia ${f.g}.`);
        cpWarn(same || t === 0 || f.from === 0, `episode 1, update ${t}: a new range whose weight is not 0`);
        return { ...f, line, eq: `<span class="nowrap"><span class="pt"><i>G</i><sub>${t}</sub> = ${f.g}</span>:</span> <span class="nowrap"><span class="upd"><i>w</i></span> ← ${num(f.from)} + 0.1 · (<span class="pt">${f.g}</span> − ${num(f.from)})</span> <span class="nowrap">${eqv(f.to)}</span>` };
      }) },
    ];
    // Episode 2, and later episodes.
    const e2 = CP.eps[1], m1 = R.endOf(1), m2 = R.endOf(2), w2 = R.after[1], r2 = e2.ranges[0];
    cpWarn(e2.T === 20 && e2.last[2] < 0 && [...e2.ranges.slice(0, 11)].every((c) => c === r2) && w2[r2] > 9, "episode 2 is not the 20 steps the slide describes");
    slides.push({ title: tr("A second episode", "Un segundo episodio"), skip: cpSkip(m1, m2, tr(`Episode 2: ${e2.T} steps, then their updates`, `Episodio 2: ${e2.T} pasos, y después sus actualizaciones`), tr(`Episode 2 plays, then its ${e2.T} updates.`, `Se juega el episodio 2, y después sus ${e2.T} actualizaciones.`)),
      builds: [{ ...cpSum(F[m2]), line: tr(`Episode 2 lasts ${e2.T} steps, and the pole falls to the ${cpSide(e2.last)}. Its first 11 states are in the range ${rangeName(r2)}, with 20 to 10 steps left, so that range's weight rises to ${n1(w2[r2])}.`, `El episodio 2 dura ${e2.T} pasos, y el péndulo cae a la ${cpSide(e2.last)}. Sus primeros 11 estados están en el rango ${rangeName(r2)}, con 20 a 10 pasos por delante, así que el peso de ese rango sube a ${n1(w2[r2])}.`) }] });
    const later = [[10, 2], [100, 10], [CP.EPISODES, 100]];
    for (const [k, prev] of later) {
      const wk = R.after[k - 1], m = R.endOf(k), last = k === CP.EPISODES;
      const lines = {
        10: tr(`After 10 episodes the two middle ranges hold ${n1(wk[2])} and ${n1(wk[3])}: a pole near upright lasts about 20 more steps. The outer ranges, visited little, hold less.`, `Tras 10 episodios los dos rangos del centro tienen ${n1(wk[2])} y ${n1(wk[3])}: un péndulo cerca de la vertical dura unos 20 pasos más. Los rangos de afuera, poco visitados, tienen menos.`),
        100: tr(`After 100 episodes every range has a bar, and they fall away from the middle: ${wk.map(n1).join(", ")}. α is now ${fmt(CP.alpha(k), 3)}, so each return moves its weight less.`, `Tras 100 episodios cada rango tiene una barra, y bajan hacia los lados: ${wk.map(n1).join(", ")}. α ahora es ${fmt(CP.alpha(k), 3)}, así que cada retorno mueve menos su peso.`),
      };
      if (!last) { slides.push({ title: tr(`${k} episodes`, `${k} episodios`), skip: cpSkip(R.endOf(prev), m, tr(`Episodes ${prev + 1} to ${k}`, `Episodios ${prev + 1} a ${k}`), tr(`Episodes ${prev + 1} to ${k} play, each followed by its updates.`, `Se juegan los episodios ${prev + 1} a ${k}, cada uno seguido de sus actualizaciones.`)), builds: [{ ...cpSum(F[m]), line: lines[k] }] }); continue; }
      const gap = Math.max(...wk.map((v, c) => Math.abs(v - AVG[c])));
      cpWarn(gap < 1, "after 2,000 episodes, a weight is not within 1 of its range's average");
      const sum = { ...cpSum(F[m]), ref: AVG };
      slides.push({ title: tr(`${kn(k)} episodes`, `${kn(k)} episodios`), skip: cpSkip(R.endOf(prev), m, tr(`Episodes ${prev + 1} to ${kn(k)}`, `Episodios ${prev + 1} a ${kn(k)}`), tr(`Episodes ${prev + 1} to ${kn(k)} play, each followed by its updates.`, `Se juegan los episodios ${prev + 1} a ${kn(k)}, cada uno seguido de sus actualizaciones.`)), builds: [
        { ...sum, line: tr(`After ${kn(k)} episodes the bars are ${wk.map(n1).join(", ")}, within ${n1(gap)} of each range's long-run average, the short red lines: that average is where gradient Monte Carlo settles.`, `Tras ${kn(k)} episodios las barras son ${wk.map(n1).join(", ")}, a menos de ${n1(gap)} del promedio de largo plazo de cada rango, las líneas rojas cortas: ese promedio es donde termina gradient Monte Carlo.`) },
        { ...sum, line: tr("This is what the agent has learned: within 4° of upright a pole lasts about 18 more steps, from 4° to 8° about 12, past 8° about 5. It cannot tell a pole swinging back from one falling over, so each bar is the average of both, weighed by how often each comes.", "Esto es lo que aprendió el agente: a menos de 4° de la vertical un péndulo dura unos 18 pasos más, de 4° a 8° unos 12, pasado 8° unos 5. No puede distinguir un péndulo que vuelve de uno que se cae, así que cada barra es el promedio de ambos, ponderado por cuán seguido aparece cada uno.") },
      ] });
    }
    slideshow({ svg, slides, frame: R.frame, view: createCartPole(svg) });
  }
}

// Section 4: semi-gradient TD(0), on the same episodes.
{
  const svg = document.getElementById("fig-sgtd");
  if (svg) {
    const R = CP.td, F = R.frames, M = CP.mc;
    const tdEq = (f) => `<span class="nowrap">δ = <span class="pt">1 + ${num(f.wNext)}</span> − ${num(f.from)} ${eqv(f.delta)}</span>`;
    const updEq = (f) => `<span class="nowrap"><span class="upd"><i>w</i></span> ← ${num(f.from)} + 0.1 · ${num(f.delta)}</span> <span class="nowrap">${eqv(f.to)}</span>`;
    const f0 = F[0], f1 = F[1];
    cpWarn(R1[0] === R1[1] && R1[1] === R1[2] && f0.delta === 1 && Math.abs(f1.delta - 1) < 1e-12, "episode 1 does not stay in one range at steps 1 and 2");
    const before = (f, w, shown) => ({ ...f, w, shown, upd: undefined });
    const slides = [
      { title: tr("The first step", "El primer paso"), builds: [
        cpStart({ line: tr("The same first episode, now with semi-gradient TD(0): every weight is 0, and each step will update one.", "El mismo primer episodio, ahora con semi-gradient TD(0): todos los pesos valen 0, y cada paso actualizará uno.") }),
        cpStart({ push: ep1.pushes[0], line: tr("The random policy picks a push: left.", "La política al azar elige un empujón: hacia la izquierda.") }),
        { ...before(f0, Array(NB).fill(0), new Set()), line: tr(`Pushed left, the pole tips further right, turning at ${cpTurn(S1[1])} rad/s, still in the range ${rangeName(R1[1])}.`, `Empujado a la izquierda, el péndulo se inclina más a la derecha, girando a ${cpTurn(S1[1])} rad/s, todavía en el rango ${rangeName(R1[1])}.`) },
        { ...before(f0, Array(NB).fill(0), new Set()), tg: f0.next, line: tr("The target is the reward, 1, plus the estimate of the new state: the weight of its range, outlined in red, which is the very weight being updated, still 0.", "El objetivo es la recompensa, 1, más la estimación del estado nuevo: el peso de su rango, con borde rojo, que es justo el peso que se actualiza, todavía 0."), eq: tdEq(f0) },
        { ...f0, tg: f0.next, line: tr(`The update raises that weight to ${num(f0.to)}, and with it the estimate the target borrowed.`, `La actualización sube ese peso a ${num(f0.to)}, y con él la estimación que tomó prestada el objetivo.`), eq: updEq(f0) },
      ] },
      { title: tr("A target that moves", "Un objetivo que se mueve"), builds: [
        { ...before(f1, f0.w, f0.shown), push: ep1.pushes[1], line: tr("Left again, and the pole is still in the same range.", "Otra vez a la izquierda, y el péndulo sigue en el mismo rango.") },
        { ...f1, tg: f1.next, line: tr(`The target rose with the estimate, so the TD error is ${num(f1.delta)} again: as long as the pole stays in one range, it stays 1, whatever the weight, and every step there adds 0.1.`, `El objetivo subió con la estimación, así que el TD error vuelve a ser ${num(f1.delta)}: mientras el péndulo se quede en un rango, se queda en 1, valga lo que valga el peso, y cada paso ahí suma 0.1.`), eq: `${tdEq(f1)}; ${updEq(f1)}` },
      ] },
      { title: tr("To the fall", "Hasta la caída"), builds: [...Array(T1 - 2).keys()].map((i) => {
        const t = i + 2, f = F[t], same = f.next === f.upd, end = t === T1 - 1;
        const line = end ? tr(`The pole falls: the target is the last reward alone, 1, and the weight rises to ${num(f.to)}. After one episode, TD's tallest bar is ${num(Math.max(...R.after[0]))}, against ${num(Math.max(...M.after[0]))} for gradient Monte Carlo: each step passes its news back only one step.`, `El péndulo cae: el objetivo es solo la última recompensa, 1, y el peso sube a ${num(f.to)}. Tras un episodio, la barra más alta de TD es ${num(Math.max(...R.after[0]))}, frente a ${num(Math.max(...M.after[0]))} de gradient Monte Carlo: cada paso pasa su noticia solo un paso hacia atrás.`)
          : same ? tr(`${ep1.pushes[t] === 1 ? "Right at last" : "Left again"}, still in the same range: the TD error is ${num(f.delta)} once more.`, `${ep1.pushes[t] === 1 ? "Por fin a la derecha" : "Otra vez a la izquierda"}, todavía en el mismo rango: el TD error vuelve a ser ${num(f.delta)}.`)
          : tr(`${ep1.pushes[t] === 1 ? "Right" : "Left again"}, into the range ${rangeName(f.next)}, whose weight is still 0: the TD error is ${num(f.delta)}, and the weight of the range left behind becomes ${num(f.to)}.`, `${ep1.pushes[t] === 1 ? "A la derecha" : "Otra vez a la izquierda"}, al rango ${rangeName(f.next)}, cuyo peso todavía es 0: el TD error es ${num(f.delta)}, y el peso del rango que queda atrás pasa a ${num(f.to)}.`);
        cpWarn(end || same || f.wNext === 0, `episode 1, step ${t + 1}: the new range's weight is not 0`);
        return { ...f, push: ep1.pushes[t], ...(end ? { sound: "fall" } : { tg: f.next }), line, eq: `${tdEq(f)}; ${updEq(f)}` };
      }) },
    ];
    const e2 = CP.eps[1], m1 = R.endOf(1), m2 = R.endOf(2);
    const same2 = [...e2.ranges.slice(0, e2.T)].filter((c, t) => t + 1 < e2.T && c === e2.ranges[t + 1]).length;
    slides.push({ title: tr("A second episode", "Un segundo episodio"), skip: cpSkip(m1, m2, tr(`Episode 2: ${e2.T} steps`, `Episodio 2: ${e2.T} pasos`), tr("Episode 2 plays, with an update at every step.", "Se juega el episodio 2, con una actualización en cada paso.")),
      builds: [{ ...cpSum(F[m2]), line: tr(`Episode 2 lasts ${e2.T} steps, and ${same2} of them stay in the range they start in, each adding a step's α to its weight. The tallest bar is now ${n1(Math.max(...R.after[1]))}.`, `El episodio 2 dura ${e2.T} pasos, y ${same2} de ellos se quedan en el rango donde empiezan, cada uno sumando el α del paso a su peso. La barra más alta es ahora ${n1(Math.max(...R.after[1]))}.`) }] });
    // Later episodes: the two middle ranges against gradient Monte Carlo's after the same episodes.
    let gapPrev = Infinity;
    for (const [k, prev] of [[10, 2], [100, 10], [500, 100]]) {
      const t = cpMid(R.after[k - 1]), m = cpMid(M.after[k - 1]);
      const lines = {
        10: tr(`After 10 episodes the two middle ranges average ${n1(t)}, where gradient Monte Carlo's averaged ${n1(m)} after the same episodes. Most steps stay in their range, where the TD error is 1 whatever the weight, so a weight climbs by about α per step, while a return brings a whole episode's worth at once.`, `Tras 10 episodios los dos rangos del centro promedian ${n1(t)}, donde los de gradient Monte Carlo promediaban ${n1(m)} tras los mismos episodios. La mayoría de los pasos se quedan en su rango, donde el TD error es 1 valga lo que valga el peso, así que un peso sube cerca de α por paso, mientras que un retorno trae de una vez lo que vale un episodio entero.`),
        100: tr(`After 100 episodes: ${n1(t)}, against ${n1(m)}. TD is catching up.`, `Tras 100 episodios: ${n1(t)}, frente a ${n1(m)}. TD se va acercando.`),
        500: tr(`After 500 episodes: ${n1(t)}, against ${n1(m)}. TD has caught up.`, `Tras 500 episodios: ${n1(t)}, frente a ${n1(m)}. TD lo alcanzó.`),
      };
      if (k < 500) { cpWarn(t < m && m - t < gapPrev, `after ${k} episodes, TD's middle ranges are not below gradient Monte Carlo's, or the gap has not shrunk`); gapPrev = m - t; }
      else cpWarn(Math.abs(t - m) < 1.5, "after 500 episodes, TD's middle ranges are not within 1.5 of gradient Monte Carlo's");
      slides.push({ title: tr(`${k} episodes`, `${k} episodios`), skip: cpSkip(R.endOf(prev), R.endOf(k), tr(`Episodes ${prev + 1} to ${k}`, `Episodios ${prev + 1} a ${k}`), tr(`Episodes ${prev + 1} to ${k} play, with an update at every step.`, `Se juegan los episodios ${prev + 1} a ${k}, con una actualización en cada paso.`)), builds: [{ ...cpSum(F[R.endOf(k)]), line: lines[k] }] });
    }
    const kEnd = CP.EPISODES, wEnd = R.after[kEnd - 1], mEnd = R.endOf(kEnd), sum = { ...cpSum(F[mEnd]), ref: AVG };
    cpWarn(cpMid(wEnd) > AVG[2] + 1 && wEnd[0] < AVG[0] && wEnd[5] < AVG[5] && wEnd[1] < AVG[1] && wEnd[4] < AVG[4], "after 2,000 episodes, TD's bars are not above the averages in the middle and below them outside");
    slides.push({ title: tr(`${kn(kEnd)} episodes`, `${kn(kEnd)} episodios`), skip: cpSkip(R.endOf(500), mEnd, tr(`Episodes 501 to ${kn(kEnd)}`, `Episodios 501 a ${kn(kEnd)}`), tr(`Episodes 501 to ${kn(kEnd)} play, with an update at every step.`, `Se juegan los episodios 501 a ${kn(kEnd)}, con una actualización en cada paso.`)), builds: [
      { ...sum, line: tr(`After ${kn(kEnd)} episodes TD's bars are ${wEnd.map(n1).join(", ")}: above the long-run averages in the middle (${n1(cpMid(wEnd))} against ${n1(AVG[2])}), and below them in the outer ranges.`, `Tras ${kn(kEnd)} episodios las barras de TD son ${wEnd.map(n1).join(", ")}: sobre los promedios de largo plazo en el centro (${n1(cpMid(wEnd))} frente a ${n1(AVG[2])}), y bajo ellos en los rangos de afuera.`) },
      { ...sum, line: tr(`They are still moving, toward ${n1(SETTLE[1][2])} in the middle: TD does not settle on the averages, as gradient Monte Carlo does, but at a point of its own, which section 5 finds.`, `Todavía se mueven, hacia ${n1(SETTLE[1][2])} en el centro: TD no termina en los promedios, como gradient Monte Carlo, sino en un punto propio, que encuentra la sección 5.`) },
    ] });
    slideshow({ svg, slides, frame: R.frame, view: createCartPole(svg) });
  }
}

/* ---------- Section 5: where each method settles ---------- */

// TD(0), n-step TD for n = 2, 4 and 8, and Monte Carlo, each at the weights where its expected update is 0, over the true
// values of the visited states, with the long-run averages as short red lines.
{
  const svg = document.getElementById("fig-settle"), out = document.getElementById("fig-settle-out");
  if (svg) {
    svg.setAttribute("viewBox", "0 0 440 340");
    const chart = angleChart(svg, { top: 26, height: 230, dots: DOTS });
    svg.querySelector(".cp-dots")?.classList.add("faint");
    const name = (mode) => (mode === "mc" ? "Monte Carlo" : mode === "1" ? "TD(0)" : tr(`${mode}-step TD`, `n-step TD con n = ${mode}`));
    function show(mode) {
      const w = SETTLE[mode];
      chart.draw({ w, ref: AVG });
      const above = cpMid(w) - AVG[2], below = AVG[1] - w[1];
      const say = mode === "mc"
        ? tr("Monte Carlo settles on each range's average: the least VE, all of it the spread inside the ranges.", "Monte Carlo termina en el promedio de cada rango: el menor VE, todo él la dispersión dentro de los rangos.")
        : tr(`${name(mode)} settles ${n1(above)} above the averages in the middle ranges and ${n1(below)} below them in the ranges from 4° to 8°.`, `${name(mode)} termina ${n1(above)} sobre los promedios en los rangos del centro y ${n1(below)} bajo ellos en los rangos de 4° a 8°.`);
      out.innerHTML = `<p class="eq">${veEq(w)}</p><p>${say}</p>`;
      svg.setAttribute("aria-label", tr(`Six bars, one per range of the pole's angle, where ${name(mode)} settles: ${w.map(n1).join(", ")} steps, over the true values of states visited by the random policy, with each range's average marked.`, `Seis barras, una por rango del ángulo del péndulo, donde termina ${name(mode)}: ${w.map(n1).join(", ")} pasos, sobre los valores verdaderos de estados que visita la política al azar, con el promedio de cada rango marcado.`));
    }
    modeButtons(document.getElementById("fig-settle-modes"), show);
    show("1");
  }
}
