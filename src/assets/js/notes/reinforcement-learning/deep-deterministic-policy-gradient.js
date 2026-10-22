import { el, tr, lang, svgPoint, localNum, modeButtons, roving } from "../../plane.js";
import { schedule, fades, speedWords, lerpState } from "./rally.js";
import { createRallyPlayer } from "./rally-player.js";
import { DATA } from "./deep-deterministic-policy-gradient-data.js?v=9e1cc21b";

// The note on "Continuous control with deep reinforcement learning" (Lillicrap et al., ICLR 2016), DDPG, on the rally
// with any speed (rally.js). Every section has one rally player (rally-player.js): the game plays, stops at chosen
// frames with a short card and Continue, and, where a section compares runs, mode buttons above the frame pick the run.
// Section 1 adds the one other interaction of the page: picking a point on the critic's curve tries that speed.
// Every number drawn or written comes from deep-deterministic-policy-gradient-data.js, written by the note's scripts
// (outside the repository; see the note's rules file): the page computes nothing but the drawing.
//
// Strings marked ES-TODO still carry their English text in the Spanish slot, for the Spanish pass.

const warn = (ok, what) => { if (!ok) console.warn(`DDPG figures: ${what}`); };
const L = (o) => o[lang] ?? o.en;
const MINUS = "−";
const num = (x, d = 2) => (x < 0 && Math.abs(x).toFixed(d) !== (0).toFixed(d) ? MINUS : "") + Math.abs(x).toFixed(d);
const S = DATA.speeds, TR = DATA.train, R = TR.reels;
const r2 = (n) => Math.round(n * 100) / 100;

/* ---------- Formulas, as the prose writes them ---------- */
const Q_THETA = "θ<sup><i>Q</i></sup>", MU_THETA = "θ<sup>μ</sup>";
const F_TARGET = `<i>y</i><sub><i>i</i></sub> <span class="nowrap">= <span class="pt"><i>r</i><sub><i>i</i></sub> + γ<i>Q</i>′(<i>s</i>′<sub><i>i</i></sub>,</span></span> <span class="nowrap pt">μ′(<i>s</i>′<sub><i>i</i></sub> | θ<sup>μ′</sup>) | θ<sup><i>Q</i>′</sup>)</span>`;
const F_LOSS = `<i>L</i> <span class="nowrap">= <span class="frac"><span>1</span><span><i>N</i></span></span> Σ<span class="lims"><span>&nbsp;</span><span><i>i</i></span></span>(<span class="pt"><i>y</i><sub><i>i</i></sub></span></span> <span class="nowrap">− <i>Q</i>(<i>s</i><sub><i>i</i></sub>, <i>a</i><sub><i>i</i></sub> | ${Q_THETA}))<sup>2</sup></span>`;
const F_SOFT = `θ′ <span class="nowrap">← τθ + (1 − τ)θ′</span>`;
const F_SOFT2 = `<span class="nowrap">θ<sup><i>Q</i>′</sup> ← τθ<sup><i>Q</i></sup> + (1 − τ)θ<sup><i>Q</i>′</sup>,</span> <span class="nowrap">θ<sup>μ′</sup> ← τθ<sup>μ</sup> + (1 − τ)θ<sup>μ′</sup></span>`;
const F_NOISY = `<i>a</i><sub><i>t</i></sub> <span class="nowrap">= μ(<i>s</i><sub><i>t</i></sub> | ${MU_THETA}) + 𝒩<sub><i>t</i></sub></span>`;

/* ---------- Charts ---------- */
// A chart of the note (viewBox 0 0 440 H): plot x 70-412, y 16-186, its axes named in words with their symbols. Each
// name is a list of [text, class] runs: "sym" sets a symbol in the serif's italic, "up" upright, "sup" raised.
const X0 = 70, X1 = 412, Y0 = 16, Y1 = 186;
function nameRuns(t, runs) {
  for (const [s, cls] of runs) {
    if (!cls) { t.append(s); continue; }
    const k = cls.split(" ");
    const span = el("tspan", { class: k.map((c) => ({ sym: "rl-sym", up: "rl-sym up", sup: "rl-sym rl-sup" })[c]).join(" ") }, t);
    span.textContent = s;
  }
  return t;
}
function axes(svg, { x: [x0, x1], y: [y0, y1], xTicks, yTicks, xFmt, yFmt, xName, yName, xEnds, nameY = Y1 + 46 }) {
  const X = (v) => X0 + ((v - x0) / (x1 - x0)) * (X1 - X0), Y = (v) => Y1 - ((v - y0) / (y1 - y0)) * (Y1 - Y0);
  const g = el("g", {}, svg);
  const text = (cls, x, y, s, anchor = "middle") => { const t = el("text", { class: cls, x, y, "text-anchor": anchor }, g); t.textContent = s; return t; };
  el("line", { class: "rl-axis", x1: X0, y1: Y1, x2: X1, y2: Y1 }, g);
  el("line", { class: "rl-axis", x1: X0, y1: Y0, x2: X0, y2: Y1 }, g);
  for (const v of xTicks) { el("line", { class: "rl-axis", x1: X(v), y1: Y1, x2: X(v), y2: Y1 + 5 }, g); text("rl-tick", X(v), Y1 + 21, xFmt(v)); }
  for (const v of yTicks) {
    el("line", { class: "rl-axis", x1: X0 - 5, y1: Y(v), x2: X0, y2: Y(v) }, g);
    if (Math.abs(v) < 1e-9) el("line", { class: "rl-zero", x1: X0, y1: Y(v), x2: X1, y2: Y(v) }, g);
    text("rl-tick", X0 - 9, Y(v) + 5, yFmt(v), "end");
  }
  nameRuns(text("rl-axname", (X0 + X1) / 2, nameY, ""), xName);
  if (xEnds) { text("rl-axname", X0 - 6, nameY, xEnds[0], "start"); text("rl-axname", X1 + 6, nameY, xEnds[1], "end"); }
  nameRuns(el("text", { class: "rl-axname", x: 0, y: 0, "text-anchor": "middle", transform: `translate(20 ${(Y0 + Y1) / 2}) rotate(-90)` }, g), yName);
  return { X, Y, g };
}
const pathOf = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${r2(x)},${r2(y)}`).join(" ");
const SPEED_NAME = [[tr("speed ", "velocidad ")], ["a", "sym"]];
const SPEED_ENDS = [tr("← up", "← arriba"), tr("down →", "abajo →")];
const Q_NAME = [[tr("value ", "valor ")], ["Q", "sym"], ["(", "up"], ["s", "sym"], [", ", "up"], ["a", "sym"], [" | θ", "up"], ["Q", "sym sup"], [")", "up"]];

/* ---------- Status lines ---------- */
// Above the frame, "Training, step 2,013" or "After 20,000 steps of training"; under it, the memory's size.
function statusLines(fig) {
  const status = fig.querySelector(".rl-status"), memory = fig.querySelector(".rl-memory");
  return {
    set(s, m) { if (status) status.innerHTML = s ?? ""; if (memory) { memory.textContent = m ?? ""; memory.hidden = !m; } },
  };
}
const trainingLine = (t) => tr(`Training, step ${localNum(t)}`, `Entrenamiento, paso ${localNum(t)}`);
const memoryLine = (t) => tr(`Memory: ${localNum(t)} steps`, `Memoria: ${localNum(t)} pasos`);
const trainedLine = () => tr(`After ${localNum(20000)} steps of training`, `Tras ${localNum(20000)} pasos de entrenamiento`);

// A reel made of several training episodes, played one after another with a break between them.
function chain(ids) {
  const frames = [], starts = [], at = {};
  for (const id of ids) { at[id] = frames.length; if (frames.length) starts.push(frames.length); frames.push(...R[id].frames); }
  return { frames, starts, at, mu: ids.flatMap((id) => [...(R[id].mu ?? []), null]), noise: ids.flatMap((id) => [...(R[id].noise ?? []), null]) };
}

// Mode buttons above a player: the pressed mode's reel plays; a mode's stops are armed the first time it is shown.
function modes(fig, show) {
  const group = fig.querySelector(".modes");
  const buttons = [...group.querySelectorAll("button[data-mode]")];
  const press = modeButtons(group, show);
  roving(buttons, (i) => { press(buttons[i].dataset.mode); show(buttons[i].dataset.mode); });
  return press;
}

/* ---------- The opening ---------- */
function opening() {
  const fig = document.getElementById("fig-open");
  if (!fig) return;
  const D = DATA.open, [p1, p2] = D.pause;
  const player = createRallyPlayer(fig, {
    frames: D.frames,
    stops: [
      { t: p1, cards: [{ html: L(D.cards.p1), arrow: true }] },
      { t: p2, cards: [{ html: L(D.cards.p2), enter: () => player.frame.score("+1"), leave: () => player.frame.score("") }] },
    ],
  });
}

/* ---------- Section 1: the actor and the critic ---------- */
// The chart (viewBox 0 0 440 250): Q(s, a | θ^Q) over a from −1 to 1 for the frame where the play stopped. The y axis is
// that curve's own range, rounded out to 0.05, with ticks. Under the curve, each try leaves a mark at its speed.
const MARK_Y = Y1 - 10;
function createCurveChart(svg, { yRange, speeds }) {
  const [q0, q1] = yRange;
  const whole = (x) => Math.abs(x - Math.round(x)) < 1e-6;
  const step = [0.05, 0.1, 0.2, 0.5, 1].find((s) => (q1 - q0) / s <= 5 + 1e-9 && whole((q1 - q0) / s) && whole(q0 / s)) ?? (q1 - q0) / 4;
  const dec = step < 0.1 - 1e-9 ? 2 : 1;
  const yTicks = [];
  for (let k = 0; q0 + k * step <= q1 + 1e-9; k++) yTicks.push(Math.round((q0 + k * step) * 100) / 100);
  const { X, Y } = axes(svg, { x: [-1, 1], y: yRange, xTicks: [-1, -0.5, 0, 0.5, 1], yTicks, xFmt: (a) => num(a, a % 1 ? 1 : 0), yFmt: (q) => num(q, dec), xName: SPEED_NAME, xEnds: SPEED_ENDS, yName: Q_NAME });
  const marks = el("g", {}, svg);
  const curve = el("path", { class: "rl-curve" }, svg);
  const up = el("g", { class: "rl-uphill", display: "none" }, svg);
  const upShaft = el("path", {}, up), upHead = el("polygon", {}, up);
  const dot = el("circle", { class: "rl-dot", r: 6 }, svg);
  const hover = el("g", { class: "rl-hover", display: "none" }, svg);
  el("circle", { r: 11 }, hover);
  const hoverText = el("text", { y: -18, "text-anchor": "middle" }, hover);
  const hit = el("rect", { class: "rl-hit", x: X0 - 12, y: Y0 - 8, width: X1 - X0 + 24, height: Y1 - Y0 + 16, display: "none" }, svg);
  const handle = el("g", { class: "rl-handle", role: "slider", tabindex: "-1", "aria-valuemin": -1, "aria-valuemax": 1, display: "none" }, svg);
  el("circle", { class: "rl-handle-hit", r: 20 }, handle);
  el("circle", { class: "rl-handle-ring", r: 11 }, handle);
  let row = null;
  return {
    X, Y, hit, handle,
    show(qs, mu, muQ) {
      row = qs;
      curve.setAttribute("d", pathOf(qs.map((q, j) => [X(speeds[j]), Y(q)])));
      dot.setAttribute("cx", r2(X(mu))); dot.setAttribute("cy", r2(Y(muQ)));
    },
    // The uphill arrow, along the curve's slope at the dot, toward the side the slope rises to: from the dot, len in a
    // (0.15). When the data clips len at the end of the speeds (the dot is near it), the arrow runs beside the curve
    // instead, 15 units below it and parallel to its slope at the dot, from 0.25 back to the end of the speeds: it never
    // points past the speeds a paddle can take.
    uphill(mu, muQ, slope, dir, len) {
      if (!dir) { up.setAttribute("display", "none"); return; }
      const clipped = len < 0.15 - 1e-9;
      const a1 = mu + dir * len, a0 = clipped ? mu - dir * 0.25 : mu;
      let x0 = X(a0), y0 = Y(muQ + slope * (a0 - mu)), x1 = X(a1), y1 = Y(muQ + slope * (a1 - mu));
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      if (clipped) { const nx = -uy * dir, ny = ux * dir, k = ny < 0 ? -15 : 15; x0 += nx * k; y0 += ny * k; x1 += nx * k; y1 += ny * k; }
      const lead = clipped ? 0 : 7, sx = x0 + ux * lead, sy = y0 + uy * lead, hx = x1 - ux * 9, hy = y1 - uy * 9;
      upShaft.setAttribute("d", `M${r2(sx)},${r2(sy)} L${r2(hx)},${r2(hy)}`);
      upHead.setAttribute("points", `${r2(x1)},${r2(y1)} ${r2(hx - uy * 5.5)},${r2(hy + ux * 5.5)} ${r2(hx + uy * 5.5)},${r2(hy - ux * 5.5)}`);
      up.removeAttribute("display");
    },
    place(j) { handle.setAttribute("transform", `translate(${r2(X(speeds[j]))} ${r2(Y(row[j]))})`); },
    hoverAt(j, label) {
      if (j === null) { hover.setAttribute("display", "none"); return; }
      hover.setAttribute("transform", `translate(${r2(X(speeds[j]))} ${r2(Y(row[j]))})`);
      hoverText.textContent = label;
      // above the ring, or below it near the plot's top; kept inside the viewBox at either end
      hoverText.setAttribute("y", Y(row[j]) < Y0 + 30 ? 31 : -18);
      const x = X(speeds[j]);
      hoverText.setAttribute("text-anchor", x < X0 + 50 ? "start" : x > X1 - 50 ? "end" : "middle");
      hoverText.setAttribute("x", x < X0 + 50 ? -10 : x > X1 - 50 ? 10 : 0);
      hover.removeAttribute("display");
    },
    mark(j, outcome) {
      marks.querySelector(`[data-j="${j}"]`)?.remove();
      el("circle", { class: `rl-mark ${outcome === 1 ? "hit" : "miss"}`, "data-j": j, cx: r2(X(speeds[j])), cy: MARK_Y, r: 4.2 }, marks);
    },
    clearMarks() { marks.replaceChildren(); },
    interactive(on) { for (const e of [hit, handle]) e.setAttribute("display", on ? "inline" : "none"); handle.setAttribute("tabindex", on ? "0" : "-1"); if (!on) hover.setAttribute("display", "none"); },
  };
}

function actorCritic() {
  const fig = document.getElementById("fig-ac");
  if (!fig) return;
  const D = DATA.ac, ts = D.tStar, C = D.cards;
  const chartSvg = fig.querySelector("svg.rl-chart"), chartWrap = fig.querySelector(".rl-chart-wrap"), chartNote = fig.querySelector(".rl-chart-note");
  const chart = createCurveChart(chartSvg, { yRange: D.yRange, speeds: S });
  chart.show(D.curve[ts], D.mu, D.muQ[ts]);
  let chartOn = false, cardKey = null;
  // Once play goes on, the chart keeps the stopped frame's curve and says so.
  const syncNote = () => { chartNote.hidden = !(chartOn && player && player.t !== ts); };
  const setChart = (on) => { chartOn = on; chartWrap.classList.toggle("off", !on); syncNote(); };

  // The try handle: one of the 41 speeds, from the actor's own speed rounded to the grid.
  const own = Math.round((D.mu + 1) * 20);
  let j = own, tryRun = null;
  const valueText = (k) => `${speedWords(S[k])}, ${tr("value", "valor")} ${num(D.curve[ts][k])}`;
  const placeHandle = () => {
    chart.place(j);
    chart.handle.setAttribute("aria-valuenow", S[j]);
    chart.handle.setAttribute("aria-valuetext", valueText(j));
    chart.handle.setAttribute("aria-label", tr("Speed to try on the critic's curve", "Velocidad a probar en la curva del crítico"));
  };
  // A try: from the paused frame, the tapped speed for one frame and then the actor, the ball's next frames to its
  // arrival at 6 frames a second (its last frame at once with reduced motion), the outcome held 1.5 s, then the break
  // back to the paused frame. The dashed outline follows the actor's own paddle over the same frames.
  function endTry() {
    if (!tryRun) return;
    tryRun.stop();
    tryRun = null;
    player.frame.ghost(null); player.frame.score("");
    player.setBusy(false);
    player.redraw();
  }
  function runTry(k) {
    endTry();
    j = k; placeHandle();
    const tr_ = D.tries.oneFrame[k], F = player.frames, n = tr_.tops.length;
    // State i of the try: i = −1 the paused frame, 0 .. n − 1 the frames after it; the speed taken from state i is
    // acts[i + 1] (the tapped speed from the paused frame), none from the arrival.
    const stateAt = (i) => (i < 0 ? player.stateOf(ts) : { bx: F[ts + 1 + i][0], by: F[ts + 1 + i][1], dx: F[ts + 1 + i][2], dy: F[ts + 1 + i][3], py: tr_.tops[i] });
    const actAt = (i) => (i + 1 < n ? tr_.acts[i + 1] : null);
    const ghostAt = (i, w = 0) => player.frame.ghost(F[ts + 1 + i][4] + (w ? (F[ts + 2 + i][4] - F[ts + 1 + i][4]) * w : 0));
    player.setBusy(true, endTry);
    player.frame.ghost(F[ts][4]);
    player.extra("");
    const STEP = 1000 / 6, HOLD = 1500, DIM = 150, EMPTY = 150, still = !fades();
    let time = 0, finished = false, shownI = -1;
    // The outcome, its mark and its line under the card land with the arrival, not before.
    const finish = () => {
      finished = true;
      player.frame.show(stateAt(n - 1)); ghostAt(n - 1);
      player.frame.score(tr_.outcome === 1 ? "+1" : "−1");
      player.extra(L(tr_.line));
      chart.mark(k, tr_.outcome);
    };
    if (still) { finish(); time = n * STEP; }
    else player.frame.show(stateAt(-1), { a: actAt(-1) });
    const unschedule = schedule((dt) => {
      if (!tryRun) return false;
      time += dt;
      if (!finished) {
        // the ball and both paddles glide between the try's frames; the numbers beside the frame change at each frame
        const p = time / STEP, i = Math.floor(p) - 1, w = p - Math.floor(p);
        if (i + 1 >= n) finish();
        else {
          if (i > shownI) { shownI = i; player.frame.show(stateAt(i), { a: actAt(i) }); }
          player.frame.show(lerpState(stateAt(i), stateAt(i + 1), w), { a: actAt(i), between: true });
          ghostAt(i, w);
        }
      }
      const end = n * STEP + HOLD;
      if (time >= end) {
        const u = time - end;
        if (u < DIM && !still) player.frame.dim(1 - u / DIM);
        else if (u < DIM + EMPTY && !still) player.frame.dim(0);
        else { endTry(); return false; }
      }
      return true;
    });
    tryRun = { stop: unschedule };
  }

  // The longest line card (c) can carry under its text, for the column's reserved height.
  const longest = [L(C.c.hint), ...D.tries.oneFrame.map((t) => L(t.line))].sort((a, b) => b.length - a.length)[0];
  const cards = [
    { title: L(C.a.title), arrow: true, html: () => `<p>${L(C.a)}</p><p class="rl-eq">${C.a.formula}</p>`, enter: () => { cardKey = "a"; setChart(false); } },
    { title: L(C.b.title), arrow: true, html: () => `<p>${L(C.b)}</p>`, enter: () => { cardKey = "b"; setChart(true); } },
    {
      title: L(C.c.title), arrow: true, html: () => `<p>${L(C.c.oneFrame)}</p>`,
      extraSample: longest,
      enter: () => { cardKey = "c"; setChart(true); j = own; chart.interactive(true); placeHandle(); player.extra(L(C.c.hint)); },
      leave: () => { endTry(); chart.interactive(false); player.extra(""); },
    },
    {
      title: L(C.d.title), arrow: true,
      html: () => `<p>${L(C.d)}</p><p class="disp fit">${C.d.formula}</p><p>${L(C.d.after)}</p>`,
      enter: () => { cardKey = "d"; setChart(true); chart.uphill(D.mu, D.muQ[ts], D.slope[ts], C.d.uphill, C.d.arrowLength); },
      leave: () => { cardKey = null; chart.uphill(0, 0, 0, 0, 0); },
    },
  ];
  var player = createRallyPlayer(fig, {
    frames: D.frames,
    stops: [{ t: ts, cards }],
    onFrame: () => syncNote(),
    onReplay: () => { setChart(false); chart.clearMarks(); },
    onKey(e) {
      if (cardKey !== "c") return false;
      const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (k) { e.preventDefault(); j = Math.max(0, Math.min(S.length - 1, j + k)); placeHandle(); if (e.target !== chart.handle) chart.handle.focus(); return true; }
      if (e.key === "Home" || e.key === "End") { e.preventDefault(); j = e.key === "Home" ? 0 : S.length - 1; placeHandle(); chart.handle.focus(); return true; }
      if (e.key === "Enter" && e.target === chart.handle) { e.preventDefault(); runTry(j); return true; }
      return false;
    },
  });
  // A tap or click on the chart snaps to the nearest of the 41 speeds and tries it; with a mouse, a faint ring and the
  // speed follow the pointer along the curve first.
  const nearest = (e) => { const p = svgPoint(chartSvg, e); return Math.round((Math.max(-1, Math.min(1, ((p.x - X0) / (X1 - X0)) * 2 - 1)) + 1) * 20); };
  chartSvg.addEventListener("pointerdown", (e) => {
    if (cardKey !== "c") return;
    e.preventDefault();
    chart.hoverAt(null);
    runTry(nearest(e));
  });
  chartSvg.addEventListener("pointermove", (e) => {
    if (cardKey !== "c" || e.pointerType === "touch") return;
    const k = nearest(e);
    chart.hoverAt(k === j ? null : k, speedWords(S[k]));
  });
  chartSvg.addEventListener("pointerleave", () => chart.hoverAt(null));
  setChart(false);
}

/* ---------- Section 2: teaching the critic ---------- */
// The reel: training from the episode running at step 1,000 to the one where pause B falls (episodes 40 to 78 of seed
// 3), played ten times as fast as the other players. Beside it, the critic's curve for one remembered frame (the step
// card two shows) is redrawn at every frame from the critic of that step (recorded every 8 steps, eased between), so
// the reader watches about a thousand updates move it. Pause A, at the frame of step 2,000, opens three cards: the
// memory, that remembered step and its target, the update. Pause B shows the game's own value of each speed against
// the critic's curve for its own frame; after it the curve of the remembered frame comes back.
const FAST = 10;
function teachCritic() {
  const fig = document.getElementById("fig-critic");
  if (!fig) return;
  const D = TR.s2, M = D.remembered, B = D.pauseB, N = TR.s6.batch, FF = D.ff;
  const reel = chain([...D.lead, ...D.seq]);
  const tA = reel.at[D.pauseA.reel] + D.pauseA.frame, tB = reel.at[B.reel] + B.frame;
  warn(reel.frames[tA][8] === D.pauseA.t, "pause A is not the frame of its step");
  warn(B.hits >= 5 && 41 - B.hits >= 5, "pause B's tries are not mixed");
  warn(M.toward, "the remembered value did not move toward its target, as card three says");
  warn(B.curve.every((q, j) => !j || q >= B.curve[j - 1]), "pause B's curve does not rise at every speed, as card four says");
  warn(FF.k === M.k && FF.rows.every((r) => r.length === 21) && FF.from <= reel.frames[0][8] && FF.to >= reel.frames.at(-1)[8], "the fast-forward's curves do not cover its reel");
  const lines = statusLines(fig);
  let remembered = false;
  // The remembered step on the frame: its ball and paddle, and the next frame's ball, faint.
  const showRemembered = () => player.frame.show({ bx: M.s[0], by: M.s[1], dx: M.s[2], dy: M.s[3], py: M.s[4], faint: [M.s2[0], M.s2[1]] }, { a: M.a });
  const showStatus = (t) => {
    if (remembered) { lines.set(tr(`From memory: step ${localNum(M.k)}`, `De la memoria: paso ${localNum(M.k)}`), memoryLine(reel.frames[tA][8])); return; }
    const f = reel.frames[t];
    lines.set(tr(`Training, step ${localNum(f[8])}, played ${FAST} times as fast`, /* ES-TODO */ `Entrenamiento, paso ${localNum(f[8])}, ${FAST} veces más rápido`), memoryLine(f[8]));
  };

  // The critic's curve for the remembered frame at a step (fractional between two frames): the recorded curves of the
  // steps around it, eased linearly, at the 21 speeds −1, −0.9, …, 1.
  const S21 = S.filter((_, j) => j % 2 === 0);
  function curveAt(step) {
    const p = Math.max(0, Math.min(FF.rows.length - 1, (step - FF.from) / FF.every)), i = Math.floor(p), w = p - i;
    const r0 = FF.rows[i], r1 = FF.rows[Math.min(i + 1, FF.rows.length - 1)];
    return r0.map((q, j) => (q + (r1[j] - q) * w) / 1000);
  }

  // The chart, viewBox 0 0 440 344: a header (y 0-60) with a small drawing of the frame whose values the curve shows
  // and its name, then the plot, moved down 64 units. Live: the curve on an axis that fits the fast-forward's curves
  // (rounded out to 0.1), so its rise shows; cards two and three widen the axis to FF.yRange, which holds the target,
  // and add the target, the value and, under the plot, the gauge. Pause B: the game's values and the critic's curve for
  // its own frame.
  const chartSvg = fig.querySelector("svg.rl-chart");
  chartSvg.setAttribute("viewBox", "0 0 440 344");
  fig.querySelector(".rl-chart-wrap").classList.remove("off");
  const DY = 64;
  let built = null, X = null, Y = null, liveCurve = null, overlay = null, dots = null;
  const ticksOf = ([a, b], step) => { const out = []; for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(Math.round(v * 10) / 10); return out; };
  const all = FF.rows.flat();
  const LIVE = [Math.floor(Math.min(...all) / 100) / 10, Math.ceil(Math.max(...all) / 100) / 10];
  // The header: the frame (4 units to a game unit), its next ball faint when given, and two lines naming it.
  function header(s, s2, line1, line2) {
    const ix = 72, iy = 6, k = 4, g = el("g", { class: "rl-inset" }, chartSvg);
    el("rect", { class: "rl-field", x: ix, y: iy, width: 16 * k, height: 12 * k }, g);
    if (s2) el("circle", { class: "rl-ball faint", cx: ix + (s2[0] + 0.5) * k, cy: iy + (s2[1] + 0.5) * k, r: 0.5 * k }, g);
    el("circle", { class: "rl-ball", cx: ix + (s[0] + 0.5) * k, cy: iy + (s[1] + 0.5) * k, r: 0.5 * k }, g);
    el("rect", { class: "rl-paddle", x: ix + 15 * k, y: r2(iy + s[4] * k), width: 0.6 * k, height: 3 * k, rx: 1 }, g);
    el("rect", { class: "px-frame", x: ix, y: iy, width: 16 * k, height: 12 * k }, g);
    for (const [i, s_] of [line1, line2].entries()) { const t = el("text", { class: "rl-tick", x: ix + 16 * k + 12, y: iy + 19 + i * 20 }, g); t.textContent = s_; }
  }
  const plot = (range, ticks) => {
    const g = el("g", { transform: `translate(0 ${DY})` }, chartSvg);
    const ax = axes(g, { x: [-1, 1], y: range, xTicks: [-1, -0.5, 0, 0.5, 1], yTicks: ticks, xFmt: (a) => num(a, a % 1 ? 1 : 0), yFmt: (q) => num(q, 1), xName: SPEED_NAME, xEnds: SPEED_ENDS, yName: Q_NAME, nameY: Y1 + 42 });
    return { g, X: ax.X, Y: ax.Y };
  };
  function buildLive(wide = false) {
    chartSvg.replaceChildren();
    header(M.s, M.s2, tr("The critic’s value of each speed", /* ES-TODO */ "El valor que el crítico da a cada velocidad"), tr(`for this frame, from step ${localNum(M.k)}`, /* ES-TODO */ `en este cuadro, del paso ${localNum(M.k)}`));
    const p = wide ? plot(FF.yRange, ticksOf(FF.yRange, 0.2)) : plot(LIVE, ticksOf(LIVE, 0.1));
    ({ X, Y } = p);
    overlay = el("g", {}, p.g);
    liveCurve = el("path", { class: "rl-curve" }, p.g);
    dots = el("g", {}, p.g);
    built = wide ? "wide" : "live";
  }
  const pathQ = (qs, sp) => pathOf(qs.map((q, j) => [X(sp[j]), Y(q)]));
  // At every drawing while no card holds the chart: the curve of the step the frame is at.
  let held = false;
  const drawLive = (t, u) => {
    if (held) return;
    if (built !== "live") buildLive();
    liveCurve.setAttribute("d", pathQ(curveAt(reel.frames[t][8] + u), S21));
  };
  function drawA(after) {
    held = true;
    buildLive(true);
    if (after) el("path", { class: "rl-old", d: pathQ(M.curveBefore, S) }, overlay);
    liveCurve.setAttribute("d", pathQ(after ? M.curveAfter : M.curveBefore, S));
    el("circle", { class: "rl-target", cx: r2(X(M.a)), cy: r2(Y(M.y)), r: 6 }, overlay);
    el("circle", { class: after ? "rl-upd" : "rl-est", cx: r2(X(M.a)), cy: r2(Y(after ? M.qAfter : M.qBefore)), r: 6 }, dots);
    if (!after) return;
    // The gauge: from the value before the update (blue end) to the target (red end); the share the update covered
    // is filled green.
    const gx0 = X0, gx1 = X1, gy = 244, share = (M.qAfter - M.qBefore) / (M.y - M.qBefore);
    el("rect", { class: "rl-gauge", x: gx0, y: gy, width: gx1 - gx0, height: 12, rx: 3 }, overlay);
    el("rect", { class: "rl-gauge-done", x: gx0, y: gy, width: Math.max(1.5, r2((gx1 - gx0) * share)), height: 12 }, overlay);
    el("rect", { class: "rl-gauge-est", x: gx0 - 2, y: gy - 3, width: 4, height: 18 }, overlay);
    el("rect", { class: "rl-gauge-tg", x: gx1 - 2, y: gy - 3, width: 4, height: 18 }, overlay);
    const lab = (x, anchor, s) => { const t = el("text", { class: "rl-tick", x, y: gy + 30, "text-anchor": anchor }, overlay); t.textContent = s; };
    lab(gx0, "start", tr(`value before, ${num(M.qBefore, 3)}`, /* ES-TODO */ `value before, ${num(M.qBefore, 3)}`));
    lab(gx1, "end", tr(`target, ${num(M.y, 3)}`, /* ES-TODO */ `target, ${num(M.y, 3)}`));
  }
  // Back to the live curve on its own axis.
  function release() {
    held = false;
    drawLive(player.t, player.u);
  }
  function drawB() {
    held = true;
    built = "B";
    chartSvg.replaceChildren();
    const f = reel.frames[tB];
    header(f, null, tr("The game’s value and the critic’s", /* ES-TODO */ "El valor del juego y el del crítico"), tr(`for this frame, step ${localNum(B.t)}`, /* ES-TODO */ `en este cuadro, paso ${localNum(B.t)}`));
    const { g, X, Y } = plot(B.yRange, [-1, -0.5, 0, 0.5]);
    // The game's value: a line through the speeds of each outcome, and a jump where the outcome changes.
    const pts = [];
    B.trueValue.forEach((v, j) => {
      if (j && B.tries[j] !== B.tries[j - 1]) { const xm = (X(S[j - 1]) + X(S[j])) / 2; pts.push([xm, Y(B.trueValue[j - 1])], [xm, Y(v)]); }
      pts.push([X(S[j]), Y(v)]);
    });
    el("path", { class: "rl-true", d: pathOf(pts) }, g);
    el("path", { class: "rl-curve", d: pathOf(B.curve.map((q, j) => [X(S[j]), Y(q)])) }, g);
    // The speed taken (with noise) on the critic's curve.
    const k = Math.min(39, Math.floor((B.a + 1) * 20)), u = (B.a - S[k]) / 0.05, qa = B.curve[k] + u * (B.curve[k + 1] - B.curve[k]);
    el("circle", { class: "rl-dot", cx: r2(X(B.a)), cy: r2(Y(qa)), r: 6 }, g);
  }
  const cards = [
    {
      title: tr("Into the memory", "A la memoria"),
      html: () => `<p>${tr(`While it trains, the agent keeps every step it plays in a memory: the frame, the speed it took, the reward, and the next frame. By now there are ${localNum(D.pauseA.mLen)}. At every step the critic learns from ${N} of them drawn at random, so the steps it learns from together come from many rallies, not from one moment of one rally.`,
        /* ES-TODO */ `While it trains, the agent keeps every step it plays in a memory: the frame, the speed it took, the reward, and the next frame. By now there are ${localNum(D.pauseA.mLen)}. At every step the critic learns from ${N} of them drawn at random, so the steps it learns from together come from many rallies, not from one moment of one rally.`)}</p>`,
    },
    {
      title: tr("One remembered step", "Un paso recordado"),
      html: () => {
        const out = M.done ? "" : M.r > 0 ? tr("returned the ball, +1", "devolvió la pelota, +1") : M.r < -0.5 ? tr("the ball got past, −1", "la pelota se escapó, −1") : tr("nothing happened yet", "todavía no pasó nada");
        return `<p>${tr(`One of the ${N}, from step ${localNum(M.k)}, the frame whose curve you watched: the paddle took ${speedWords(M.a)}, and ${out}. Its target, the red dot, is the reward plus the discounted value of the next frame, drawn faint, valued with the speed the actor would take there:`,
          /* ES-TODO */ `One of the ${N}, from step ${localNum(M.k)}, the frame whose curve you watched: the paddle took ${speedWords(M.a)}, and ${out}. Its target, the red dot, is the reward plus the discounted value of the next frame, drawn faint, valued with the speed the actor would take there:`)}</p>
<p class="disp fit">${F_TARGET}</p>
<p>${tr("<i>Q</i>′ and μ′ are slow copies of the critic and the actor (section 3). The blue dot is the critic’s value now.", /* ES-TODO */ "<i>Q</i>′ and μ′ are slow copies of the critic and the actor (section 3). The blue dot is the critic’s value now.")}</p>`;
      },
      draw: () => showRemembered(),
      enter: () => { remembered = true; showStatus(); drawA(false); },
      leave: () => { remembered = false; showStatus(player.t); release(); },
    },
    {
      title: tr("The critic moves toward it", "El crítico se acerca"),
      html: () => `<p>${tr(`The update lowers the squared gap between targets and values, averaged over the ${N}:`, /* ES-TODO */ `The update lowers the squared gap between targets and values, averaged over the ${N}:`)}</p>
<p class="disp fit">${F_LOSS}</p>
<p>${tr(`Here the value moved ${num(M.qAfter - M.qBefore, 3)} toward the red dot, ${num(M.pct1, 1)}% of the gap: the green sliver under the plot. Each update moves it a little; the change you watched took ${localNum(FF.steps)} of them.`,
        /* ES-TODO */ `Here the value moved ${num(M.qAfter - M.qBefore, 3)} toward the red dot, ${num(M.pct1, 1)}% of the gap: the green sliver under the plot. Each update moves it a little; the change you watched took ${localNum(FF.steps)} of them.`)}</p>`,
      draw: () => showRemembered(),
      enter: () => { remembered = true; showStatus(); drawA(true); },
      leave: () => { remembered = false; showStatus(player.t); release(); },
    },
  ];
  const cardB = {
    title: tr("A slope, not a step", "Una pendiente, no un escalón"),
    html: () => `<p>${tr(`In red, what each speed is really worth at this frame by the game’s rules, if the actor of this moment plays on after it: the ball is either returned or not, so the value jumps. The critic’s blue curve for this frame is smooth. Here it rises only from ${num(B.curve[0], 3)} to ${num(B.curve[40], 3)}, but it rises at every speed toward the ones that hit, and the actor climbs it (section 1). That is why the trained paddle chases the ball instead of moving just enough: after ${localNum(20000)} steps it moves ${num(D.speeds.absA)} pixels a frame on average, where just enough would be ${num(D.speeds.floorA)}.`,
      /* ES-TODO */ `In red, what each speed is really worth at this frame by the game’s rules, if the actor of this moment plays on after it: the ball is either returned or not, so the value jumps. The critic’s blue curve for this frame is smooth. Here it rises only from ${num(B.curve[0], 3)} to ${num(B.curve[40], 3)}, but it rises at every speed toward the ones that hit, and the actor climbs it (section 1). That is why the trained paddle chases the ball instead of moving just enough: after ${localNum(20000)} steps it moves ${num(D.speeds.absA)} pixels a frame on average, where just enough would be ${num(D.speeds.floorA)}.`)}</p>`,
    enter: () => drawB(),
    leave: () => release(),
  };
  var player = createRallyPlayer(fig, {
    frames: reel.frames, starts: reel.starts, fps: 6 * FAST,
    stops: [{ t: tA, cards }, { t: tB, cards: [cardB] }],
    onFrame: (t) => showStatus(t),
    onDraw: (t, u) => drawLive(t, u),
  });
  drawLive(player.t, 0);
}

/* ---------- Section 3: targets that drift slowly ---------- */
function targets() {
  const fig = document.getElementById("fig-targets");
  if (!fig) return;
  const D = TR.s3, Rw = R[D.with.reel], Ro = R[D.without.reel];
  warn(D.counts.with.end === 6 && D.counts.without.end === 0 && D.counts.full.end === 8 && D.counts.noTarget.end === 8, "section 3's ten-seed counts changed");
  warn(D.without.meanQ.every((q) => q === null || Math.abs(q) <= Math.abs(D.without.peakAbs.q)), "section 3's largest value is not the peak the card names");
  const lines = statusLines(fig);
  lines.set(trainedLine());
  const chartSvg = fig.querySelector("svg.rl-chart"), chartWrap = fig.querySelector(".rl-chart-wrap");
  const setChart = (on) => chartWrap.classList.toggle("off", !on);
  // The chart: the critic's average value at each check, one point per 1,000 steps, the axis clipped to −2..2 so that
  // the With run stays readable; the Without run's values beyond it are named at the edge.
  const YR = [-2, 2];
  const { X, Y } = axes(chartSvg, { x: [0, 20000], y: YR, xTicks: [0, 5000, 10000, 15000, 20000], yTicks: [-2, -1, 0, 1, 2], xFmt: (v) => localNum(v), yFmt: (v) => num(v, 0), xName: [[tr("training step", "paso de entrenamiento")]], yName: [[tr("mean value ", "valor medio ")], ["Q", "sym"]] });
  const clipId = "ddpg-targets-clip";
  const defs = el("defs", {}, chartSvg), cp = el("clipPath", { id: clipId }, defs);
  el("rect", { x: X0, y: Y0 - 4, width: X1 - X0, height: Y1 - Y0 + 8 }, cp);
  for (const [q, s] of [[D.qMax, tr("upper bound", /* ES-TODO */ "upper bound")], [D.qMin, tr("lower bound", /* ES-TODO */ "lower bound")]]) {
    el("line", { class: "rl-bound", x1: X0, x2: X1, y1: r2(Y(q)), y2: r2(Y(q)) }, chartSvg);
    const t = el("text", { class: "rl-tick", x: X1 - 4, y: r2(Y(q) + (q > 0 ? -6 : 16)), "text-anchor": "end" }, chartSvg);
    t.textContent = `${s}, ${num(q)}`;
  }
  const series = (mq) => mq.map((q, i) => (q === null ? null : [X(D.checksT[i]), Y(q)])).filter(Boolean);
  const lineW = el("path", { class: "rl-run", d: pathOf(series(D.with.meanQ)), "clip-path": `url(#${clipId})` }, chartSvg);
  const lineO = el("path", { class: "rl-run", d: pathOf(series(D.without.meanQ)), "clip-path": `url(#${clipId})` }, chartSvg);
  // A point at each check; a value beyond the axis is a triangle at its edge, pointing the way the value lies.
  const points = (mq) => {
    const g = el("g", { class: "rl-runpts" }, chartSvg);
    mq.forEach((q, i) => {
      if (q === null) return;
      const x = r2(X(D.checksT[i]));
      if (q >= YR[0] && q <= YR[1]) { el("circle", { cx: x, cy: r2(Y(q)), r: 2.6 }, g); return; }
      const e = q > YR[1] ? Y0 : Y1, d = q > YR[1] ? -1 : 1;
      el("polygon", { points: `${x - 5},${e} ${x + 5},${e} ${x},${e + d * 7}` }, g);
    });
    return g;
  };
  const ptsW = points(D.with.meanQ), ptsO = points(D.without.meanQ);
  // The two values of the Without run the card names, beyond the axis: beside their triangles.
  for (const p of [D.without.peakLow, D.without.peakHigh]) {
    if (p.q >= YR[0] && p.q <= YR[1]) continue;
    // The low value's label sits past the next check, clear of the two steep lines on either side of its triangle.
    const x = p.q < 0 ? X(p.t + 1000) + 8 : X(p.t) + 9;
    const t = el("text", { class: "rl-tick rl-off", x: r2(x), y: p.q < 0 ? Y1 - 8 : Y0 + 14, "text-anchor": "start" }, chartSvg);
    t.textContent = `${num(p.q)}`;
  }
  const pick = (mode) => { for (const [e, m] of [[lineW, "with"], [ptsW, "with"], [lineO, "without"], [ptsO, "without"]]) e.classList.toggle("on", mode === m); };

  const cardsWith = [
    {
      title: tr("Slow copies set the targets", "Copias lentas fijan los objetivos"), arrow: true,
      html: () => `<p>${tr("A target network is a slow copy that computes the targets, so a target does not jump each time the network chasing it is updated. After every step, each copy moves a small share τ of the way to its network:", /* ES-TODO */ "A target network is a slow copy that computes the targets, so a target does not jump each time the network chasing it is updated. After every step, each copy moves a small share τ of the way to its network:")}</p>
<p class="disp">${F_SOFT}</p><p class="disp rl-small">${F_SOFT2}</p>
<p>${tr(`With τ = ${D.tau}, a copy covers half the distance in about ${D.halfWords} steps.`, /* ES-TODO */ `With τ = ${D.tau}, a copy covers half the distance in about ${D.halfWords} steps.`)}</p>`,
      enter: () => { setChart(true); pick("with"); },
    },
    {
      title: tr("A faster critic", "Un crítico más rápido"), arrow: true,
      html: () => `<p>${tr(`This run’s critic learns at the paper’s rate, ${D.lrCritic}, more than three times the rest of this note’s, because at the note’s own rate the copies made no difference here: with or without them, ${D.counts.full.end} of 10 seeds ended perfect, returning the ball ten times from each of the 24 serves. At this faster rate they matter: with the copies, ${D.counts.with.end} of 10 seeds end perfect. The average value of this run stays between ${num(D.with.qLo)} and ${num(D.with.qHi)}, the blue line.`,
        /* ES-TODO */ `This run’s critic learns at the paper’s rate, ${D.lrCritic}, more than three times the rest of this note’s, because at the note’s own rate the copies made no difference here: with or without them, ${D.counts.full.end} of 10 seeds ended perfect, returning the ball ten times from each of the 24 serves. At this faster rate they matter: with the copies, ${D.counts.with.end} of 10 seeds end perfect. The average value of this run stays between ${num(D.with.qLo)} and ${num(D.with.qHi)}, the blue line.`)}</p>`,
      enter: () => { setChart(true); pick("with"); },
    },
  ];
  const cardsWithout = [
    {
      title: tr("Without the copies", "Sin las copias"),
      html: () => `<p>${tr(`Without them, the critic computes its own targets, so every update also moves what it chases. With this fast critic its values ran away: their average fell to ${num(D.without.peakLow.q)} by step ${localNum(D.without.peakLow.t)} and stood at ${num(D.without.peakHigh.q)} at step ${localNum(D.without.peakHigh.t)}, though every frame of the rally is worth between ${num(D.qMin)} and ${num(D.qMax)}. After ${localNum(20000)} steps the paddle plays none of the 24 serves to the tenth hit, and none of 10 seeds ends perfect.`,
        /* ES-TODO */ `Without them, the critic computes its own targets, so every update also moves what it chases. With this fast critic its values ran away: their average fell to ${num(D.without.peakLow.q)} by step ${localNum(D.without.peakLow.t)} and stood at ${num(D.without.peakHigh.q)} at step ${localNum(D.without.peakHigh.t)}, though every frame of the rally is worth between ${num(D.qMin)} and ${num(D.qMax)}. After ${localNum(20000)} steps the paddle plays none of the 24 serves to the tenth hit, and none of 10 seeds ends perfect.`)}</p>`,
      enter: () => { setChart(true); pick("without"); },
    },
  ];
  const reels = {
    with: { frames: Rw.frames, stops: [{ t: D.with.tStar, cards: cardsWith }] },
    without: { frames: Ro.frames, stops: [{ t: D.without.missFrame, cards: cardsWithout }] },
  };
  const seen = new Set(["with"]);
  let mode = "with";
  const player = createRallyPlayer(fig, { ...reels.with, allCards: [...cardsWith, ...cardsWithout], onReplay: () => {} });
  pick("with");
  setChart(false);
  modes(fig, (m) => {
    if (m === mode) return;
    mode = m;
    pick(m);
    player.load({ ...reels[m], armed: seen.has(m) ? [] : [0] });
    seen.add(m);
  });
}

/* ---------- Section 4: exploring with noise ---------- */
function noise() {
  const fig = document.getElementById("fig-noise");
  if (!fig) return;
  const D = TR.s4, lines = statusLines(fig);
  warn(TR.s4.counts.ou038.end === 8 && TR.s4.counts.gauss038.end === 9 && TR.s4.counts.ou020.end === 5 && TR.s4.counts.gauss020.end === 2, "section 4's ten-seed counts changed");
  const M = { "0.38": D.modes["0.38"], "0.2": D.modes["0.2"] };
  const chartSvg = fig.querySelector("svg.rl-chart"), chartWrap = fig.querySelector(".rl-chart-wrap");
  const setChart = (on) => chartWrap.classList.toggle("off", !on);
  let mode = "0.38", shown = false, trace = null, X = null, Y = null;
  const reelOf = (m) => R[M[m].reel];
  function drawChart(m) {
    chartSvg.replaceChildren();
    const n = reelOf(m).noise.length;
    const xTicks = [0, 10, 20, 30, 40, 50, 60, 70].filter((v) => v <= n);
    ({ X, Y } = axes(chartSvg, { x: [0, n], y: [-1.2, 1.2], xTicks, yTicks: [-1, 0, 1], xFmt: (v) => String(v), yFmt: (v) => num(v, 0), xName: [[tr("frame", "cuadro")]], yName: [[tr("noise ", "ruido ")], ["𝒩", "up"]] }));
    for (const s of [M[m].spread, -M[m].spread]) el("line", { class: "rl-bound", x1: X0, x2: X1, y1: r2(Y(s)), y2: r2(Y(s)) }, chartSvg);
    const t = el("text", { class: "rl-tick", x: X1 - 4, y: r2(Y(M[m].spread) - 6), "text-anchor": "end" }, chartSvg);
    t.textContent = tr(`± spread, ${num(M[m].spread)}`, /* ES-TODO */ `± spread, ${num(M[m].spread)}`);
    trace = el("path", { class: "rl-noise" }, chartSvg);
  }
  // The noise of this episode up to frame t: an ink line that grows as the play goes on after the first pause.
  function grow(t) {
    if (!shown || !trace) return;
    const nz = reelOf(mode).noise, pts = [];
    for (let i = 0; i <= Math.min(t, nz.length - 1); i++) pts.push([X(i), Y(nz[i])]);
    trace.setAttribute("d", pts.length > 1 ? pathOf(pts) : "");
  }
  const cardE = (m) => {
    const E = M[m].atE, sp = m === "0.38" ? tr(`Its spread is ${num(M[m].spread)}.`, /* ES-TODO */ `Its spread is ${num(M[m].spread)}.`) : tr(`Its spread is ${num(M[m].spread, 1)}, about half.`, /* ES-TODO */ `Its spread is ${num(M[m].spread, 1)}, about half.`);
    const clip = E.clipped ? tr("The game clips it to the fastest speed. ", /* ES-TODO */ "The game clips it to the fastest speed. ") : "";
    const nW = speedWords(E.noise);
    return {
      title: tr("The actor’s speed plus noise", "La velocidad del actor más ruido"), arrow: true, mu: E.mu,
      html: () => `<p>${tr(`The actor asks for ${speedWords(E.mu)}, the dashed arrow; the noise adds ${nW}; the paddle takes ${speedWords(E.a)}, the yellow arrow:`, /* ES-TODO */ `The actor asks for ${speedWords(E.mu)}, the dashed arrow; the noise adds ${nW}; the paddle takes ${speedWords(E.a)}, the yellow arrow:`)}</p>
<p class="disp">${F_NOISY}</p>
<p>${clip}${tr(`The noise is an Ornstein–Uhlenbeck process: each frame it keeps ${Math.round(D.keep * 100)}% of its last value and adds a fresh random nudge, so it wanders and drifts back to 0. ${sp}`, /* ES-TODO */ `The noise is an Ornstein–Uhlenbeck process: each frame it keeps ${Math.round(D.keep * 100)}% of its last value and adds a fresh random nudge, so it wanders and drifts back to 0. ${sp}`)}</p>`,
      enter: () => { shown = true; setChart(true); grow(player.t); },
    };
  };
  const C = D.counts, s3 = D.seed3;
  const cardF = (m) => ({
    title: tr("How the run went", "Cómo le fue a la corrida"),
    html: () => `<p>${m === "0.38"
      ? tr(`With this spread, this run first played all 24 serves perfectly at step ${localNum(s3.full.firstPerfect)} and kept it. Over 10 seeds, ${C.ou038.end} of 10 ended perfect at step ${localNum(20000)}. Gaussian noise of the same spread, which jumps instead of drifting: ${C.gauss038.end} of 10.`,
        /* ES-TODO */ `With this spread, this run first played all 24 serves perfectly at step ${localNum(s3.full.firstPerfect)} and kept it. Over 10 seeds, ${C.ou038.end} of 10 ended perfect at step ${localNum(20000)}. Gaussian noise of the same spread, which jumps instead of drifting: ${C.gauss038.end} of 10.`)
      : tr(`With half the spread, the same seed first played perfectly only at step ${localNum(s3.ou020.firstPerfect)}, lost it, and ended keeping ${s3.ou020.final} of 24 serves. Over 10 seeds, ${C.ou020.end} of 10 ended perfect. Gaussian noise of this spread: ${C.gauss020.end} of 10.`,
        /* ES-TODO */ `With half the spread, the same seed first played perfectly only at step ${localNum(s3.ou020.firstPerfect)}, lost it, and ended keeping ${s3.ou020.final} of 24 serves. Over 10 seeds, ${C.ou020.end} of 10 ended perfect. Gaussian noise of this spread: ${C.gauss020.end} of 10.`)}</p>`,
  });
  warn(s3.full.kept && !s3.ou020.kept, "section 4's seed-3 words (kept it, lost it) no longer hold");
  const cards = { "0.38": [cardE("0.38"), cardF("0.38")], "0.2": [cardE("0.2"), cardF("0.2")] };
  const reel = (m) => ({ frames: reelOf(m).frames, stops: [{ t: M[m].pauseE, cards: [cards[m][0]] }, { t: M[m].pauseF, cards: [cards[m][1]] }] });
  const showStatus = (t) => { const f = reelOf(mode).frames[t]; lines.set(trainingLine(f[8])); };
  drawChart(mode);
  const player = createRallyPlayer(fig, {
    ...reel(mode),
    allCards: [...cards["0.38"], ...cards["0.2"]],
    onFrame: (t) => { showStatus(t); grow(t); },
    onReplay: () => { shown = false; setChart(false); },
  });
  setChart(false);
  const seen = new Set([mode]);
  modes(fig, (m) => {
    if (m === mode) return;
    mode = m;
    shown = false; setChart(false); drawChart(m);
    player.load({ ...reel(m), armed: seen.has(m) ? [] : [0, 1] });
    seen.add(m);
  });
}

/* ---------- Section 5: batch normalization ---------- */
function batchNorm() {
  const fig = document.getElementById("fig-bn");
  if (!fig) return;
  const D = TR.s5, lines = statusLines(fig);
  lines.set(trainedLine());
  warn(D.counts.on.end === 8 && D.counts.off.end === 1 && D.counts.off.reach === 2 && D.counts.handScaled.reach === 0, "section 5's ten-seed counts changed");
  const names = [tr("ball column", "columna de la pelota"), tr("ball row", "fila de la pelota"), tr("across", /* ES-TODO */ "across"), tr("up or down", /* ES-TODO */ "up or down"), tr("paddle top", "borde superior de la paleta")];
  const table = () => `<div class="tbl rl-tbl"><table><thead><tr><th scope="col">${tr("input", "entrada")}</th><th scope="col">${tr("in the game", "en el juego")}</th><th scope="col">${tr("after normalizing", /* ES-TODO */ "after normalizing")}</th></tr></thead><tbody>${D.inputs.rows.map((r, i) => `<tr><th scope="row">${names[i]}</th><td>${num(r.x)}</td><td>${num(r.out)}</td></tr>`).join("")}</tbody></table></div>`;
  const cardG = {
    title: tr("What the actor reads", "Lo que lee el actor"), arrow: true,
    html: () => `<p>${tr("The actor’s first layer rescales the five numbers by their mean and spread over training, and every hidden layer does the same with its own values. During play it uses averages kept while training, as the paper does.", /* ES-TODO */ "The actor’s first layer rescales the five numbers by their mean and spread over training, and every hidden layer does the same with its own values. During play it uses averages kept while training, as the paper does.")}</p>${table()}`,
  };
  const cardH = {
    title: tr("Without it", "Sin ella"),
    html: () => `<p>${tr(`After ${localNum(20000)} steps without batch normalization, this seed plays none of the 24 serves to the tenth hit. Over 10 seeds, ${D.counts.on.end} of 10 end perfect with it and ${D.counts.off.end} of 10 without; ${D.counts.off.reach} of 10 are ever perfect at a check, every ${localNum(1000)} steps.`,
      /* ES-TODO */ `After ${localNum(20000)} steps without batch normalization, this seed plays none of the 24 serves to the tenth hit. Over 10 seeds, ${D.counts.on.end} of 10 end perfect with it and ${D.counts.off.end} of 10 without; ${D.counts.off.reach} of 10 are ever perfect at a check, every ${localNum(1000)} steps.`)}</p>`,
  };
  const reels = {
    with: { frames: R[D.with.reel].frames, stops: [{ t: D.with.tStar, cards: [cardG] }] },
    without: { frames: R[D.without.reel].frames, stops: [{ t: D.without.missFrame, cards: [cardH] }] },
  };
  let mode = "with";
  const seen = new Set([mode]);
  const player = createRallyPlayer(fig, { ...reels.with, allCards: [cardG, cardH] });
  modes(fig, (m) => {
    if (m === mode) return;
    mode = m;
    player.load({ ...reels[m], armed: seen.has(m) ? [] : [0] });
    seen.add(m);
  });
}

/* ---------- Section 6: the whole algorithm ---------- */
// Algorithm 1 beside the run. Lines (0-based in LINES): the color each takes when lit, as the RL notes' ink rules say:
// choosing yellow, playing gray, the memory blue, the target red, the updates green.
function algorithm() {
  const fig = document.getElementById("fig-algo");
  if (!fig) return;
  const D = TR.s6, N = D.batch, lines = statusLines(fig);
  const i = (s) => `<i>${s}</i>`, sb = (a, b) => `${a}<sub>${b}</sub>`;
  const LINES = [
    { k: "plain", html: tr(`Start the critic ${i("Q")}(${i("s")}, ${i("a")} | ${Q_THETA}) and the actor μ(${i("s")} | ${MU_THETA}) with random weights`, /* ES-TODO */ `Start the critic ${i("Q")}(${i("s")}, ${i("a")} | ${Q_THETA}) and the actor μ(${i("s")} | ${MU_THETA}) with random weights`) },
    { k: "plain", html: tr(`Copy them: θ<sup>${i("Q")}′</sup> ← ${Q_THETA}, θ<sup>μ′</sup> ← ${MU_THETA}`, /* ES-TODO */ `Copy them: θ<sup>${i("Q")}′</sup> ← ${Q_THETA}, θ<sup>μ′</sup> ← ${MU_THETA}`) },
    { k: "model", html: tr(`Start an empty memory ${i("R")}`, /* ES-TODO */ `Start an empty memory ${i("R")}`) },
    { head: true, html: tr("for each episode:", "para cada episodio:") },
    { k: "plain", ind: 1, html: tr(`start the noise 𝒩; read the first frame ${sb(i("s"), "1")}`, /* ES-TODO */ `start the noise 𝒩; read the first frame ${sb(i("s"), "1")}`) },
    { head: true, ind: 1, html: tr(`for each frame ${i("t")}:`, `para cada cuadro ${i("t")}:`) },
    { k: "pick", ind: 2, html: tr(`choose ${sb(i("a"), i("t"))} = μ(${sb(i("s"), i("t"))} | ${MU_THETA}) + ${sb("𝒩", i("t"))}`, /* ES-TODO */ `choose ${sb(i("a"), i("t"))} = μ(${sb(i("s"), i("t"))} | ${MU_THETA}) + ${sb("𝒩", i("t"))}`) },
    { k: "take", ind: 2, html: tr(`play ${sb(i("a"), i("t"))}; read ${sb(i("r"), i("t"))} and ${sb(i("s"), `${i("t")}+1`)}`, /* ES-TODO */ `play ${sb(i("a"), i("t"))}; read ${sb(i("r"), i("t"))} and ${sb(i("s"), `${i("t")}+1`)}`) },
    { k: "model", ind: 2, html: tr(`store (${sb(i("s"), i("t"))}, ${sb(i("a"), i("t"))}, ${sb(i("r"), i("t"))}, ${sb(i("s"), `${i("t")}+1`)}) in ${i("R")}`, /* ES-TODO */ `store (${sb(i("s"), i("t"))}, ${sb(i("a"), i("t"))}, ${sb(i("r"), i("t"))}, ${sb(i("s"), `${i("t")}+1`)}) in ${i("R")}`) },
    { k: "model", ind: 2, wait: true, html: tr(`draw ${i("N")} steps (${sb(i("s"), i("i"))}, ${sb(i("a"), i("i"))}, ${sb(i("r"), i("i"))}, ${i("s")}′${"<sub><i>i</i></sub>"}) from ${i("R")} at random`, /* ES-TODO */ `draw ${i("N")} steps (${sb(i("s"), i("i"))}, ${sb(i("a"), i("i"))}, ${sb(i("r"), i("i"))}, ${i("s")}′${"<sub><i>i</i></sub>"}) from ${i("R")} at random`) },
    { k: "target", ind: 2, wait: true, html: `${i("y")}<sub>${i("i")}</sub> <span class="nowrap">= ${i("r")}<sub>${i("i")}</sub> + γ${i("Q")}′(${i("s")}′<sub>${i("i")}</sub>,</span> <span class="nowrap">μ′(${i("s")}′<sub>${i("i")}</sub> | θ<sup>μ′</sup>) | θ<sup>${i("Q")}′</sup>)</span>` },
    { k: "update", ind: 2, wait: true, html: `${tr("update the critic: lower", /* ES-TODO */ "update the critic: lower")} <span class="nowrap">${i("L")} = <span class="frac"><span>1</span><span>${i("N")}</span></span> Σ<sub>${i("i")}</sub>(${i("y")}<sub>${i("i")}</sub></span> <span class="nowrap">− ${i("Q")}(${sb(i("s"), i("i"))}, ${sb(i("a"), i("i"))} | ${Q_THETA}))<sup>2</sup></span>` },
    { k: "update", ind: 2, wait: true, html: `${tr("update the actor:", /* ES-TODO */ "update the actor:")} <span class="nowrap">∇<sub>θ<sup>μ</sup></sub>${i("J")} ≈ <span class="frac"><span>1</span><span>${i("N")}</span></span> Σ<sub>${i("i")}</sub></span> <span class="nowrap">∇<sub>${i("a")}</sub>${i("Q")}(${i("s")}, ${i("a")} | ${Q_THETA})|<sub>${i("s")} = ${sb(i("s"), i("i"))}, ${i("a")} = μ(${sb(i("s"), i("i"))})</sub></span> <span class="nowrap">∇<sub>θ<sup>μ</sup></sub>μ(${i("s")} | ${MU_THETA})|<sub>${sb(i("s"), i("i"))}</sub></span>` },
    { k: "update", ind: 2, wait: true, html: `${tr("move the copies:", /* ES-TODO */ "move the copies:")} <span class="nowrap">θ′ ← τθ + (1 − τ)θ′</span>` },
  ];
  // Line numbers as the panel shows them (the loops' headers are not numbered), for the comments below.
  const panel = fig.querySelector(".pcode");
  panel.innerHTML = `<p class="pc-title">${tr("Algorithm 1, as this note writes it", /* ES-TODO */ "Algorithm 1, as this note writes it")}</p><ol class="pc" aria-label="${tr("Algorithm 1, the line being played highlighted", /* ES-TODO */ "Algorithm 1, the line being played highlighted")}">${LINES.map((l, n) => `<li data-line="${n}" class="${l.head ? "head" : "k-" + l.k}${l.ind ? " ind" + l.ind : ""}">${l.html}${l.wait ? `<span class="rl-wait">${tr(` (waits for ${N} steps)`, /* ES-TODO */ ` (waits for ${N} steps)`)}</span>` : ""}</li>`).join("")}</ol>`;
  const lis = [...panel.querySelectorAll("li[data-line]")];
  const LOOP = [6, 7, 8, 9, 10, 11, 12, 13], LEARN = [9, 10, 11, 12, 13];
  let timer = null;
  // light(lit, { running, waiting }): the lines in lit are lit in their color; running lines are lit faintly
  // (the loop playing frame after frame), waiting lines dimmed and marked as waiting for a full minibatch.
  function light(lit, { running = [], waiting = false } = {}) {
    const on = new Set(lit), run = new Set(running);
    lis.forEach((li, n) => {
      li.classList.toggle("on", on.has(n));
      li.classList.toggle("run", !on.has(n) && run.has(n));
      li.classList.toggle("waits", waiting && LEARN.includes(n));
      if (on.has(n)) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }
  // Lines lit one after another, about 0.7 s each, staying on the last (at once with reduced motion).
  function inTurn(seq) {
    clearTimeout(timer);
    if (!fades()) { light([seq.at(-1)]); return; }
    let k = 0;
    const next = () => { light([seq[k]]); if (++k < seq.length) timer = setTimeout(next, 700); };
    next();
  }
  const stages = {
    start: chain(D.stages.start),
    2000: chain(D.stages["2000"]), 5000: chain(D.stages["5000"]), 20000: chain(D.stages["20000"]),
  };
  let stage = "start", inCard = false;
  const st = stages.start;
  const tP1 = st.at[D.pauses.P1.reel] + D.pauses.P1.frame, tP2 = st.at[D.pauses.P2.reel] + D.pauses.P2.frame, tP3 = st.at[D.pauses.P3.reel] + D.pauses.P3.frame;
  warn(st.frames[tP3][8] === D.learnStart, "pause P3 is not the frame of the first update");
  const leave = () => { inCard = false; clearTimeout(timer); };
  const cards = [
    {
      title: tr("Before the first frame", "Antes del primer cuadro"),
      html: () => `<p>${tr("Both networks start random, with the actor’s output near 0, and each gets a slow copy. The memory is empty. Each episode starts a fresh noise.", /* ES-TODO */ "Both networks start random, with the actor’s output near 0, and each gets a slow copy. The memory is empty. Each episode starts a fresh noise.")}</p>`,
      enter: () => { inCard = true; clearTimeout(timer); light([0, 1, 2, 4]); lines.set(trainingLine(0), memoryLine(0)); }, leave,
    },
    {
      title: tr("Choose, play, store", "Elegir, jugar, guardar"), arrow: true,
      html: () => `<p>${tr(`The paddle takes the actor’s speed plus noise, ${speedWords(D.pauses.P2.a)}, and the step goes into the memory. The rally starts learning once the memory holds a full minibatch of ${N}; the paper’s Algorithm 1 does not say when to start.`, /* ES-TODO */ `The paddle takes the actor’s speed plus noise, ${speedWords(D.pauses.P2.a)}, and the step goes into the memory. The rally starts learning once the memory holds a full minibatch of ${N}; the paper’s Algorithm 1 does not say when to start.`)}</p>`,
      enter: () => { inCard = true; inTurn([6, 7, 8]); }, leave,
    },
    {
      title: tr("Teach the critic", "Enseñar al crítico"),
      html: () => `<p>${tr(`From here on, every frame also draws ${N} remembered steps, builds their targets with the slow copies, and moves the critic toward them, as in section 2.`, /* ES-TODO */ `From here on, every frame also draws ${N} remembered steps, builds their targets with the slow copies, and moves the critic toward them, as in section 2.`)}</p>`,
      enter: () => { inCard = true; inTurn([9, 10, 11]); }, leave,
    },
    {
      title: tr("Move the actor and the copies", "Mover al actor y las copias"),
      html: () => `<p>${tr("Then the actor moves uphill on the critic’s curve, as in section 1, and both copies move τ of the way to their networks, as in section 3. Pick a later stage to see the same loop after more training.", /* ES-TODO */ "Then the actor moves uphill on the critic’s curve, as in section 1, and both copies move τ of the way to their networks, as in section 3. Pick a later stage to see the same loop after more training.")}</p>`,
      enter: () => { inCard = true; inTurn([12, 13]); }, leave,
    },
  ];
  // P2's speed is the one taken from the serve, the frame the card shows the arrow on.
  warn(Math.abs(st.frames[tP1][5] - D.pauses.P2.a) < 1e-12, "card P2's speed is not the first speed taken");
  const reelOf = (s) => ({ frames: stages[s].frames, starts: stages[s].starts, stops: s === "start" ? [{ t: tP1, cards: [cards[0]] }, { t: tP2, cards: [cards[1]] }, { t: tP3, cards: [cards[2], cards[3]] }] : [] });
  const showFrame = (t) => {
    const f = stages[stage].frames[t];
    lines.set(trainingLine(f[8]), memoryLine(f[8]));
    if (!inCard) light([], { running: LOOP, waiting: f[8] < D.learnStart });
  };
  // Card P2 stops after the first move: its arrow is the speed that move took, from the serve.
  cards[1].arrow = false;
  cards[1].draw = () => player.frame.show(player.stateOf(tP2), { a: st.frames[tP1][5] });
  const player = createRallyPlayer(fig, {
    ...reelOf("start"),
    allCards: cards,
    onFrame: (t) => showFrame(t),
  });
  light([], { running: LOOP, waiting: true });
  modes(fig, (s) => {
    if (s === stage) return;
    stage = s;
    clearTimeout(timer); inCard = false;
    player.load({ ...reelOf(s), armed: [] });
  });
}

opening();
actorCritic();
teachCritic();
targets();
noise();
batchNorm();
algorithm();
