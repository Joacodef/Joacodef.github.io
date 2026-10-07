import { el, tr, fmt } from "../../plane.js";
import { rngFrom } from "./gridworld.js";

// The cart-pole of the approximation notes, the classic one (Barto, Sutton and Anderson, 1983): a cart of 1 kg on a
// track of ±2.4 m carries a pole of 0.1 kg and 1 m on a hinge; each step pushes the cart left or right with 10 N for
// 0.02 s (an Euler step), and the episode ends when the pole leans past 12° or the cart leaves the track. The reward is
// +1 per step and γ = 1, so a state's value is the number of steps to expect before the pole falls.
const G = 9.8, M_CART = 1, M_POLE = 0.1, M = M_CART + M_POLE, HALF = 0.5, PML = M_POLE * HALF, FORCE = 10;
export const TAU = 0.02, TH_MAX = (12 * Math.PI) / 180, X_MAX = 2.4;
// A state is [x, ẋ, θ, θ̇]: the cart's position and velocity, and the pole's angle (positive when it leans right) and
// angular velocity; a is 0 for a push to the left and 1 for one to the right.
export function stepCP([x, xd, th, thd], a) {
  const f = a === 1 ? FORCE : -FORCE, c = Math.cos(th), s = Math.sin(th);
  const temp = (f + PML * thd * thd * s) / M;
  const thacc = (G * s - c * temp) / (HALF * (4 / 3 - (M_POLE * c * c) / M));
  const xacc = temp - (PML * thacc * c) / M;
  const n = [x + TAU * xd, xd + TAU * xacc, th + TAU * thd, thd + TAU * thacc];
  return { s: n, done: Math.abs(n[0]) > X_MAX || Math.abs(n[2]) > TH_MAX };
}
export const deg = (r) => (r * 180) / Math.PI;
// The one feature of the notes' estimate: the pole's angle, cut into 6 ranges of 4° from −12° to 12° (state
// aggregation: a range's weight is the estimate of every state in it). Range 0 is −12° to −8°, range 5 is 8° to 12°.
export const NB = 6;
export const rangeOf = (s) => Math.min(NB - 1, Math.max(0, Math.floor(((s[2] + TH_MAX) / (2 * TH_MAX)) * NB)));
export const rangeName = (c) => tr(`${(4 * c - 12).toString().replace("-", "−")}° to ${(4 * c - 8).toString().replace("-", "−")}°`, `${(4 * c - 12).toString().replace("-", "−")}° a ${(4 * c - 8).toString().replace("-", "−")}°`);
// Episodes under the random policy: four random numbers for the start state (each number within ±0.05), then one per
// push, left or right with equal chance. The first `keep` episodes keep their states and pushes; every episode keeps its
// length T, the range of each state (the last one past the failure included) and the state it fell in.
export function simulate(seed, n, keep = 2) {
  const rnd = rngFrom(seed), eps = [];
  for (let k = 0; k < n; k++) {
    let s = [0, 1, 2, 3].map(() => (rnd() - 0.5) * 0.1);
    const ranges = [rangeOf(s)], states = k < keep ? [s] : null, pushes = k < keep ? [] : null;
    for (;;) {
      const a = rnd() < 0.5 ? 0 : 1, o = stepCP(s, a);
      if (pushes) { pushes.push(a); states.push(o.s); }
      ranges.push(rangeOf(o.s));
      s = o.s;
      if (o.done) break;
    }
    eps.push({ T: ranges.length - 1, ranges: Uint8Array.from(ranges), last: s, states, pushes });
  }
  return eps;
}

/* ---------- Drawing ---------- */

// The estimate as six bars, one per range of the pole's angle, on an axis of the steps to expect before the pole falls,
// with a small cart and pole under each range, drawn at its middle angle. A bar is blue, the estimate, with its value
// above it, and blank while its weight has never been set. Red marks what the estimates aim for: dots for the true
// values of states (in the figures that show them), short lines for each range's long-run average. Outlines mark the
// range updated (green) and the range whose estimate a target borrows (red); a dot on the axis marks the current angle.
const X0 = 72, X1 = 420, XW = (X1 - X0) / NB, TOP_V = 25;
const ax = (degrees) => X0 + ((degrees + 12) / 24) * (X1 - X0);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
export function angleChart(svg, { top = 20, height = 230, dots = null, labelLift = 7 } = {}) {
  const y0 = top + height, ay = (v) => y0 - (Math.max(0, Math.min(TOP_V + 1, v)) / TOP_V) * height;
  const g = el("g", {}, svg);
  // Axes, ticks and names.
  const axes = el("g", { class: "axes" }, g);
  el("line", { x1: X0, y1: y0, x2: X1, y2: y0 }, axes);
  el("line", { x1: X0, y1: y0, x2: X0, y2: top - 4 }, axes);
  for (let v = 5; v <= TOP_V; v += 5) {
    el("line", { x1: X0 - 5, y1: ay(v), x2: X0, y2: ay(v) }, axes);
    el("line", { class: "cp-grid", x1: X0, y1: ay(v), x2: X1, y2: ay(v) }, g);
  }
  for (let v = 0; v <= TOP_V; v += 5) el("text", { class: "tick", x: X0 - 10, y: ay(v) + 5, "text-anchor": "end" }, g).textContent = String(v);
  for (let c = 0; c <= NB; c++) {
    el("line", { x1: X0 + c * XW, y1: y0, x2: X0 + c * XW, y2: y0 + 5 }, axes);
    el("text", { class: "gw-axis", x: X0 + c * XW, y: y0 + 18, "text-anchor": "middle" }, g).textContent = `${String(4 * c - 12).replace("-", "−")}°`;
  }
  // A small cart and pole under each range, at the range's middle angle.
  for (let c = 0; c < NB; c++) {
    const mx = X0 + (c + 0.5) * XW, by = y0 + 40, a = ((4 * c - 10) * Math.PI) / 180;
    el("line", { class: "cp-track", x1: mx - 14, y1: by + 6, x2: mx + 14, y2: by + 6 }, g);
    el("rect", { class: "cp-cart sm", x: mx - 8, y: by, width: 16, height: 6, rx: 1.5 }, g);
    el("line", { class: "cp-pole sm", x1: mx, y1: by, x2: mx + 24 * Math.sin(a), y2: by - 24 * Math.cos(a) }, g);
  }
  el("text", { class: "gw-sg", x: (X0 + X1) / 2, y: y0 + 66, "text-anchor": "middle" }, g).textContent = tr("angle of the pole", "ángulo del péndulo");
  const midY = (top + y0) / 2;
  el("text", { class: "gw-sg", x: 24, y: midY, "text-anchor": "middle", transform: `rotate(-90 24 ${midY})` }, g).textContent = tr("steps until the pole falls", "pasos hasta que el péndulo cae");
  // The true values of states, as the policy visits them.
  if (dots) {
    const dg = el("g", { class: "cp-dots" }, g);
    for (const [a, v] of dots) el("circle", { class: "cp-dot", cx: ax(a).toFixed(1), cy: ay(v).toFixed(1), r: 2.1 }, dg);
  }
  const marks = el("g", {}, g), bars = el("g", {}, g), refs = el("g", {}, g), labels = el("g", {}, g);
  const barTop = Array(NB).fill(null);
  // w: the six weights; shown: the ranges whose weight has been set (all when not given); ref: the long-run averages,
  // as short red lines; upd and tg: ranges outlined in green and red.
  function draw({ w, shown, ref, upd, tg }) {
    for (const x of [marks, bars, refs, labels]) x.replaceChildren();
    const outlined = new Map();
    for (const [kind, c] of [["upd", upd], ["tg", tg]]) {
      if (c === undefined || c === null) continue;
      const n = outlined.get(c) || 0, d = 2 + 4 * n;
      outlined.set(c, n + 1);
      el("rect", { class: `gw-mark ${kind}`, x: X0 + c * XW + d, y: top - 2 + d, width: XW - 2 * d, height: height + 2 - 2 * d }, marks);
    }
    for (let c = 0; c < NB; c++) {
      if (shown && !shown.has(c)) continue;
      const x = X0 + c * XW + 9, wd = XW - 18, y = ay(w[c]);
      el("rect", { class: "cp-bar", x, y, width: wd, height: y0 - y }, bars);
      el("line", { class: "cp-bar-top", x1: x, y1: y, x2: x + wd, y2: y }, bars);
      el("text", { class: "dg-lab ln cp-val", x: x + wd / 2, y: y - labelLift, "text-anchor": "middle" }, labels).textContent = fmt1(w[c]);
      barTop[c] = y;
    }
    if (ref) ref.forEach((v, c) => el("line", { class: "cp-ref", x1: X0 + c * XW + 4, y1: ay(v), x2: X0 + (c + 1) * XW - 4, y2: ay(v) }, refs));
  }
  return { draw, ay, y0, top, ax, barX: (c) => X0 + (c + 0.5) * XW };
}

// The cart and pole on their track, at the top of a figure: place(s) puts the cart, the pole and its hinge where the
// state s has them, and push(s, a) draws a push (0 left, 1 right) as an arrow beside the cart, yellow for the push just
// chosen, or blue (best) for the push the estimates prefer.
const TRACK_Y = 116, TX0 = 40, TX1 = 400, tx = (x) => TX0 + ((x + X_MAX) / (2 * X_MAX)) * (TX1 - TX0), POLE = 80;
export const HINGE_Y = TRACK_Y - 22;
export function cartStage(svg) {
  el("line", { class: "cp-track", x1: TX0 - 14, y1: TRACK_Y, x2: TX1 + 14, y2: TRACK_Y }, svg);
  for (const x of [TX0, TX1]) el("line", { class: "cp-track", x1: x, y1: TRACK_Y - 7, x2: x, y2: TRACK_Y + 7 }, svg);
  const pushG = el("g", {}, svg);
  const cart = el("rect", { class: "cp-cart", width: 46, height: 20, rx: 3 }, svg);
  const pole = el("line", { class: "cp-pole" }, svg);
  const hinge = el("circle", { class: "cp-hinge", r: 3.2 }, svg);
  return {
    place(s) {
      const x = tx(s[0]), hy = HINGE_Y;
      cart.setAttribute("x", x - 23); cart.setAttribute("y", TRACK_Y - 21);
      pole.setAttribute("x1", x); pole.setAttribute("y1", hy);
      pole.setAttribute("x2", x + POLE * Math.sin(s[2])); pole.setAttribute("y2", hy - POLE * Math.cos(s[2]));
      hinge.setAttribute("cx", x); hinge.setAttribute("cy", hy);
    },
    push(s, a, best = false) {
      pushG.replaceChildren();
      if (a === 0 || a === 1) {
        const x = tx(s[0]), y = TRACK_Y - 11, dir = a === 1 ? 1 : -1, b = x - dir * 27, e = b - dir * 22;
        el("polygon", { class: best ? "cp-push best" : "cp-push", points: `${b},${y} ${b - dir * 9},${y - 7} ${b - dir * 9},${y - 2.6} ${e},${y - 2.6} ${e},${y + 2.6} ${b - dir * 9},${y + 2.6} ${b - dir * 9},${y + 7}` }, pushG);
      }
    },
    tipX: (s) => tx(s[0]) + POLE * Math.sin(s[2]), tipY: (s) => HINGE_Y - POLE * Math.cos(s[2]), hingeX: (s) => tx(s[0]),
  };
}
// Moves a drawing from the state shown last to the next one, gliding for 260 ms, or at once when there is nothing to
// glide from, the build says jump, or the reader asked for reduced motion.
function glider(place) {
  let drawn = null, anim = null;
  return (s, animate, jump) => {
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    if (!animate || jump || !drawn || reducedMotion.matches) place(s);
    else {
      const from = drawn, start = performance.now(), dur = 260;
      const tick = (now) => {
        const u = Math.min(1, (now - start) / dur), e = 1 - (1 - u) ** 2;
        place(from.map((v, i) => v + (s[i] - v) * e));
        anim = u < 1 ? requestAnimationFrame(tick) : null;
      };
      anim = requestAnimationFrame(tick);
    }
    drawn = s.slice();
  };
}

// The figures' view for slideshow(): the cart and pole on their track at the top, and the six bars below. A build or
// frame gives w and shown (the weights), s (the state drawn, which also sets the dot on the angle axis), push (0 or 1,
// the push just chosen, as a yellow arrow beside the cart), upd and tg (ranges outlined), ref (the long-run averages)
// jump (place the state without gliding to it) and hideDot (no dot on the angle axis, on a slide that sums up episodes).
export function createCartPole(svg) {
  const chart0 = { top: 152, height: 220 };
  svg.setAttribute("viewBox", `0 0 440 ${chart0.top + chart0.height + 76}`);
  const stage = cartStage(svg);
  const chart = angleChart(svg, chart0);
  const dot = el("circle", { class: "gw-agent", r: 5.5 }, svg);
  const go = glider((s) => {
    stage.place(s);
    dot.setAttribute("cx", chart.ax(Math.max(-13, Math.min(13, deg(s[2]))))); dot.setAttribute("cy", chart.y0);
  });
  function draw(g, animate) {
    const { s, push: a, jump, hideDot } = g;
    dot.style.visibility = hideDot ? "hidden" : "";
    chart.draw(g);
    stage.push(s, a);
    go(s, animate, jump);
  }
  // The bars carry the values, so there is no heatmap to turn on or off.
  return { draw, setHeat() {}, noHeat: true };
}

/* ---------- The control note: values of pushes ---------- */

// The control note's agent tells twelve situations apart: the pole's angle in the six ranges, and which way the pole
// swings, left (θ̇ ≤ 0) or right. Situation k = 2 · range + swing, and the pair of a situation and a push, left (0) or
// right (1), is p = 2k + a, the index of its weight in the scripts. The figures number the weights panel by panel,
// swinging left first, so that w1 to w12 run left to right along the top panel and w13 to w24 along the bottom one.
export const swingOf = (s) => (s[3] > 0 ? 1 : 0);
export const sitOf = (s) => 2 * rangeOf(s) + swingOf(s);
export const featNo = (p) => 12 * ((p >> 1) & 1) + 2 * (p >> 2) + (p & 1) + 1;
// A curved arrow beside a pole's tip, around its hinge (cx, cy) at radius r, from the pole's angle a (degrees) in the
// direction it swings (sw 1 right, 0 left): the path of the arc and the triangle of its head.
export function swingArc(cx, cy, r, a, sw, from = 5, to = 26) {
  const d = sw ? 1 : -1, rad = (v) => (v * Math.PI) / 180, P = (v) => [cx + r * Math.sin(rad(v)), cy - r * Math.cos(rad(v))];
  const [x1, y1] = P(a + d * from), [x2, y2] = P(a + d * to), t = rad(a + d * to);
  // Tangent along the swing and the normal at the head.
  const ux = d * Math.cos(t), uy = d * Math.sin(t), nx = -uy, ny = ux, L = r / 7, W = r / 12;
  return {
    arc: `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 ${sw ? 1 : 0} ${x2.toFixed(1)},${y2.toFixed(1)}`,
    head: `${(x2 + ux * L).toFixed(1)},${(y2 + uy * L).toFixed(1)} ${(x2 + nx * W).toFixed(1)},${(y2 + ny * W).toFixed(1)} ${(x2 - nx * W).toFixed(1)},${(y2 - ny * W).toFixed(1)}`,
  };
}
// The values of pushes as bars, in two panels, the pole swinging left above and swinging right below, each with the
// six ranges of the angle and, in each range, a bar for a push to the left and one for a push to the right, marked
// under the bars by small arrows. Under each range, a small cart and pole at the range's middle angle, with a curved
// arrow for the way it swings and, when one push is worth more, a small blue arrow for that push. The axis runs from
// vmin to vmax with a label every step; with vmin below 0, bars grow down from a line at 0.
const BW = 20, BX = (c, a) => X0 + c * XW + 7 + a * 24, PH = 88, PGAP = 80;
const fmtV = (v, d) => { const r = Math.round(v * 10 ** d) / 10 ** d; return (r < 0 ? "−" : "") + Math.abs(r).toFixed(d); };
export function pushChart(svg, { top, vmin = 0, vmax, step, axisName, decimals = 1 }) {
  const span = vmax - vmin, pTop = (sw) => top + sw * (PH + PGAP), pBot = (sw) => pTop(sw) + PH;
  const ay = (sw, v) => pTop(sw) + ((vmax - Math.max(vmin, Math.min(vmax, v))) / span) * PH;
  const g = el("g", {}, svg), axes = el("g", { class: "axes" }, g);
  for (const sw of [0, 1]) {
    const t = pTop(sw), b = pBot(sw);
    el("text", { class: "gw-sg", x: X0, y: t - 10 }, g).textContent = sw ? tr("Swinging right", "Girando hacia la derecha") : tr("Swinging left", "Girando hacia la izquierda");
    el("line", { x1: X0, y1: b, x2: X0, y2: t - 4 }, axes);
    el("line", { x1: X0, y1: b, x2: X1, y2: b }, axes);
    for (let i = 0; vmin + i * step <= vmax + 1e-9; i++) {
      const v = vmin + i * step, y = ay(sw, v);
      el("line", { x1: X0 - 5, y1: y, x2: X0, y2: y }, axes);
      if (Math.abs(v) > 1e-9 || vmin === 0) { if (v > vmin + 1e-9) el("line", { class: "cp-grid", x1: X0, y1: y, x2: X1, y2: y }, g); }
      el("text", { class: "tick", x: X0 - 10, y: y + 5, "text-anchor": "end" }, g).textContent = fmt(v, 2);
    }
    if (vmin < 0) el("line", { class: "cp-zero", x1: X0, y1: ay(sw, 0), x2: X1, y2: ay(sw, 0) }, g);
    for (let c = 0; c <= NB; c++) {
      el("line", { x1: X0 + c * XW, y1: b, x2: X0 + c * XW, y2: b + 5 }, axes);
      // The angles, once, under the lower panel's small poles.
      if (sw) el("text", { class: "gw-axis", x: X0 + c * XW, y: b + 68, "text-anchor": "middle" }, g).textContent = `${String(4 * c - 12).replace("-", "−")}°`;
    }
    for (let c = 0; c < NB; c++) {
      // The pushes under their bars.
      for (const a of [0, 1]) {
        const cx = BX(c, a) + BW / 2, d = a ? 1 : -1;
        el("path", { class: "cp-tick-push", d: `M${cx - d * 4},${b + 8} L${cx + d * 4},${b + 8} M${cx + d * 1.5},${b + 5.5} L${cx + d * 4},${b + 8} L${cx + d * 1.5},${b + 10.5}` }, g);
      }
      // The situation: a small cart and pole at the range's middle angle, swinging left or right.
      const mx = X0 + (c + 0.5) * XW, by = b + 44, ang = 4 * c - 10, rad = (ang * Math.PI) / 180;
      el("line", { class: "cp-track", x1: mx - 14, y1: by + 6, x2: mx + 14, y2: by + 6 }, g);
      el("rect", { class: "cp-cart sm", x: mx - 8, y: by, width: 16, height: 6, rx: 1.5 }, g);
      el("line", { class: "cp-pole sm", x1: mx, y1: by, x2: mx + 24 * Math.sin(rad), y2: by - 24 * Math.cos(rad) }, g);
      const sa = swingArc(mx, by, 28, ang, sw, 6, 30);
      el("path", { class: "cp-swing", d: sa.arc }, g);
      el("polygon", { class: "cp-swing-head", points: sa.head }, g);
    }
  }
  const midY = (pTop(0) + pBot(1)) / 2;
  el("text", { class: "gw-sg", x: 24, y: midY, "text-anchor": "middle", transform: `rotate(-90 24 ${midY})` }, g).textContent = axisName;
  el("text", { class: "gw-sg", x: (X0 + X1) / 2, y: pBot(1) + 90, "text-anchor": "middle" }, g).textContent = tr("angle of the pole", "ángulo del péndulo");
  const marks = el("g", {}, g), bars = el("g", {}, g), best = el("g", {}, g), labels = el("g", {}, g);
  // w: the 24 weights by pair; shown: the pairs whose bar is drawn (all when not given); pick: the pair just chosen
  // (yellow); upd and tg: pairs outlined in green and red; win: pairs outlined in dashed blue (an n-step window);
  // sel: a situation whose two bars are framed; labeled: pairs whose value is written by their bar; noBest: no blue
  // arrows.
  function draw({ w, shown, pick, upd, tg, win, sel, labeled, noBest }) {
    for (const x of [marks, bars, best, labels]) x.replaceChildren();
    const col = (p) => ({ sw: (p >> 1) & 1, x: BX(p >> 2, p & 1) });
    if (sel !== undefined && sel !== null) el("rect", { class: "cp-sel", x: BX(sel >> 1, 0) - 5, y: pTop(sel & 1) - 6, width: 2 * BW + 14, height: PH + 12, rx: 3 }, marks);
    if (pick !== undefined && pick !== null) { const { sw, x } = col(pick); el("rect", { class: "gw-pick", x: x - 2, y: pTop(sw) - 2, width: BW + 4, height: PH + 4 }, marks); }
    const nested = new Map();
    const outline = (kind, p) => {
      const n = nested.get(p) || 0, d = 2 * n, { sw, x } = col(p);
      nested.set(p, n + 1);
      el("rect", { class: `gw-mark ${kind}`, x: x - 3 + d, y: pTop(sw) - 3 + d, width: BW + 6 - 2 * d, height: PH + 6 - 2 * d }, marks);
    };
    for (const p of win || []) outline("step", p);
    for (const [kind, p] of [["upd", upd], ["tg", tg]]) if (p !== undefined && p !== null) outline(kind, p);
    for (let p = 0; p < 24; p++) {
      if (shown && !shown.has(p)) continue;
      const { sw, x } = col(p), y = ay(sw, w[p]), base = ay(sw, Math.max(vmin, 0));
      el("rect", { class: "cp-bar", x, y: Math.min(y, base), width: BW, height: Math.abs(base - y) }, bars);
      el("line", { class: "cp-bar-top", x1: x, y1: y, x2: x + BW, y2: y }, bars);
      if (labeled && labeled.includes(p)) el("text", { class: "cp-q", x: x + BW / 2, y: w[p] >= 0 ? y - 6 : y + 15, "text-anchor": "middle" }, labels).textContent = fmtV(w[p], decimals);
    }
    if (!noBest) for (let k = 0; k < 12; k++) {
      const p = 2 * k, seen = !shown || (shown.has(p) && shown.has(p + 1));
      if (!seen || w[p] === w[p + 1]) continue;
      const a = w[p + 1] > w[p] ? 1 : 0, d = a ? 1 : -1, c = k >> 1, sw = k & 1, mx = X0 + (c + 0.5) * XW, y = pBot(sw) + 47, b0 = mx - d * 11, e0 = mx - d * 22;
      el("polygon", { class: "cp-push best", points: `${b0},${y} ${b0 - d * 5},${y - 4} ${b0 - d * 5},${y - 1.4} ${e0},${y - 1.4} ${e0},${y + 1.4} ${b0 - d * 5},${y + 1.4} ${b0 - d * 5},${y + 4}` }, best);
    }
  }
  return { draw, ay, pTop, pBot, ax, height: pBot(1) + 98 };
}

// The control note's slide view: the cart and pole on their track, with a curved arrow at the pole's tip for the way it
// swings, and the two panels of bars below, with a dot on the angle axis of the panel of the pole's swing. A build or
// frame gives s, push, jump and hideDot as in createCartPole, and the chart's w, shown, pick, upd, tg, win and labeled.
export function createPushView(svg, opts) {
  const stage = cartStage(svg);
  const swing = el("path", { class: "cp-swing" }, svg), head = el("polygon", { class: "cp-swing-head" }, svg);
  const chart = pushChart(svg, { top: 168, ...opts });
  svg.setAttribute("viewBox", `0 0 440 ${chart.height}`);
  const dot = el("circle", { class: "gw-agent", r: 5.5 }, svg);
  const go = glider((s) => {
    stage.place(s);
    const sa = swingArc(stage.hingeX(s), HINGE_Y, POLE + 10, deg(s[2]), swingOf(s), 4, 20);
    swing.setAttribute("d", sa.arc); head.setAttribute("points", sa.head);
    // A pole past 12° has fallen: its dot stays at the end of the axis, clear of the tick labels.
    dot.setAttribute("cx", chart.ax(Math.max(-12, Math.min(12, deg(s[2]))))); dot.setAttribute("cy", chart.pBot(swingOf(s)));
  });
  function draw(g, animate) {
    const { s, push: a, jump, hideDot } = g;
    dot.style.visibility = hideDot ? "hidden" : "";
    swing.style.visibility = head.style.visibility = hideDot ? "hidden" : "";
    chart.draw(g);
    stage.push(s, a);
    go(s, animate, jump);
  }
  return { draw, setHeat() {}, noHeat: true, chart };
}
