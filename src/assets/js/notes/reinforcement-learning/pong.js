import { el, tr, localNum, shade } from "../../plane.js";

// The DQN note's game, as its figures draw it: the screen the agent sees, the values of its three moves as bars, the
// replay memory and one transition being learned from. Figures 1 and 6 draw region A (createGame); Figure 3 hands
// createPongView to slideshow() as its view, regions A, M and B stacked in a 440 × 410 viewBox; Figure 2 draws its two
// small screens with createScreen.
//
// THE GAME. A screen of W × H = 8 × 6 pixels, x = 0 the left column and y = 0 the top row. The ball is one pixel, in
// columns 0 to 6; the paddle is two pixels in column 7. The moves are 0 up, 1 stay and 2 down.
//
// A STATE is what φ shows, the last two screens:
//   { ball: [x, y], prev: [x, y] | null, paddle: top, prevPaddle: top }
//   ball        the ball on the later screen, drawn lit (gray value 255);
//   prev        the ball on the earlier screen, drawn faint (FAINT, about 100), or null at a serve, where both screens
//               are the same;
//   paddle      the paddle's top row on the later screen, 0 to 4 (it covers top and top + 1), drawn lit;
//   prevPaddle  optional: the paddle's top row on the earlier screen; where it differs, its pixels are drawn faint
//               too. Left out, the paddle is taken not to have moved.
//
// A BUILD, for createPongView(svg).draw(build, animate), and for createGame(svg).draw(build, animate), which reads the
// fields of region A only:
//   s          the state on the screen, or null for an empty screen (before the first one);
//   q          the three values [up, stay, down] of the screen in view, drawn as bars; null after a terminal step,
//              where the bars give way to the word "end"; left out before there is a screen (rows without bars);
//   exact      [up, stay, down] exact values, short red lines across the rows, or null;
//   pick       the move just chosen, a yellow fill of its row, or null;
//   taken      the move being taken: its yellow fades out while the step animates, and is gone without animation;
//   tg         a move, or an array of moves, whose bars a target borrows: red outlines;
//   upd        a move, or an array of moves, whose bar is updated: green outlines (a red one on the same bar goes
//              inside the green, as in pushChart);
//   best       optional: the move worth most, an array of moves tied for it, or null for none; left out, the view
//              takes the moves whose values are equal to the largest at the shown precision (the tie rule). Their
//              values are in bold, and the small blue arrow beside the paddle points to the best move when it is one;
//   oneScreen  the earlier ball is drawn as a dashed outline, where it was, which a network that sees only the later
//              screen cannot see (Figure 1's One frame mode);
//   nudge      in the frames of a skip, −1 or 1: the paddle pressed against the top or bottom wall, drawn pushed
//              into it;
//   memory     region M, the replay memory (createPongView): { size, capacity, cells, strip, counts }
//                size, capacity  the transitions stored and N, named in the region's label ("6 of 10,000");
//                cells   the stored transitions in order, [{ a, r }] (move and reward), up to 12, for the cell view; or null;
//                strip   { filled, ticks } for the strip view, or null: filled is the number of transitions the strip
//                        stands for, drawn across the whole width (the memory's filled part, or the whole memory once
//                        full), oldest at the left; ticks are the slots of the 32 draws, counted from the oldest (0)
//                        to the newest (filled − 1);
//                counts  in the cell view, [{ cell, n }]: each cell drawn (its index in cells, from 0) and how many of
//                        the 32 draws fell on it, outlined in green with "×n" above it;
//   learn      region B, one drawn transition being learned from (createPongView), or null to hide it:
//                { j, from, to, a, r, value, target, next, sub }
//                j       the transition's number, its step in the run, named in the region's label;
//                from, to  the states of φ_j and φ_j+1, or to = "end" when φ_j+1 is terminal;
//                a, r    the move and the reward, written on the arrow between the two;
//                value, target  the gauge's two ends: Q(φ_j, a_j; θ) before the step, in blue, and y_j, in red;
//                next    the value after the step, where the green marker slides; left out before the step;
//                sub     the subscript of the first pair's name, "j" unless given (1 writes φ_1 and φ_2);
//   jump       draw without animating (the frames of a skip); region B is hidden.
// The slideshow's own fields (label, line, eq, fit, sound, agent) pass through unread.
//
// ANIMATION, after Next (animate true, and no jump): pixels that light switch at once, as on a screen, and those that
// dim (the earlier screen's) fade over 260 ms; bars glide over 260 ms; the gauge's marker slides over 400 ms. With
// reduced motion everything is immediate.

export const W = 8, H = 6;
// The earlier screen's gray value: faint, but visible against an unlit pixel in both themes.
export const FAINT = 100;
export const MOVES = [tr("up", "subir"), tr("stay", "quedarse"), tr("down", "bajar")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const list = (x) => (x === null || x === undefined ? [] : [].concat(x));
// A value as the bars write it, with d decimals, a real minus sign and never −0.
export const valueText = (v, d) => localNum(Math.round(v * 10 ** d) / 10 ** d || 0, d);
// The tie rule: the moves whose values are equal to the largest at the precision shown.
export function bestMoves(q, d) {
  const k = q.map((v) => Math.round(v * 10 ** d)), m = Math.max(...k);
  return [0, 1, 2].filter((a) => k[a] === m);
}
// A reward as the figures write it: 0, +1, −1.
export const rewardText = (r) => (r > 0 ? `+${localNum(r)}` : localNum(r));

// Runs step(e) with e easing from 0 to 1 over ms milliseconds; returns a function that stops it.
function tween(ms, step) {
  const start = performance.now();
  let id = requestAnimationFrame(function frame(now) {
    const u = Math.min(1, Math.max(0, (now - start) / ms));
    step(1 - (1 - u) ** 2);
    id = u < 1 ? requestAnimationFrame(frame) : 0;
  });
  return () => cancelAnimationFrame(id);
}
const text = (parent, attrs, s) => { const t = el("text", attrs, parent); t.textContent = s; return t; };
// Shows or hides a part of the drawing with display, which hides all of it (a child's visibility can override its
// group's).
const show = (e, on) => e.setAttribute("display", on ? "inline" : "none");
// Text with italic parts, such as Q(φ, a; θ): parts are [string, italic].
function mathText(t, parts) {
  for (const [s, italic] of parts) {
    if (italic) el("tspan", { "font-style": "italic" }, t).textContent = s;
    else t.append(document.createTextNode(s));
  }
  return t;
}

// A move's glyph: a triangle pointing up or down, or a short dash for staying, size units wide, centered on (cx, cy).
export function moveGlyph(parent, a, cx, cy, size, cls) {
  const w = size / 2;
  if (a === 1) return el("rect", { class: cls, x: cx - w, y: cy - size * 0.15, width: size, height: size * 0.3, rx: size * 0.12 }, parent);
  const d = a === 0 ? -1 : 1, h = size * 0.45;
  return el("polygon", { class: cls, points: `${cx},${cy + d * h} ${cx - w},${cy - d * h} ${cx + w},${cy - d * h}` }, parent);
}

/* ---------- The screen ---------- */

// The screen of a state at `scale` units per pixel, its top left corner at (x, y): each pixel a rect filled with its
// gray value through shade() (unlit 0, the later screen 255, the earlier one FAINT), faint lines between the pixels,
// the frame (.px-frame), and the top, bottom and left walls in a stronger ink just outside it, with the right edge,
// behind the paddle, left thin. In the light theme an unlit pixel is the ink itself, so nothing on the screen is drawn
// in ink: its one mark, the dashed earlier ball of a one-screen network, is in --img-hi, and so is the focus ring of a
// handle on it (.handle.on-screen). The paddle is drawn over its column, so that the frames of a skip can push it into a
// wall. Returns draw(s, { animate, oneScreen, nudge }) and the screen's geometry: cx(x) and cy(y), the middle of a
// pixel, toPixel(point), the pixel under a point of the drawing (fractional), and its edges.
export function createScreen(parent, { x = 12, y = 18, scale = 24 } = {}) {
  const g = el("g", { class: "pg-screen" }, parent);
  // The walls' middle line, o units outside the screen: a gap of a little over a unit, then the wall's stroke.
  const small = scale < 20, o = small ? 2.75 : 4, R = x + W * scale, B = y + H * scale;
  el("path", { class: small ? "pg-wall sm" : "pg-wall", d: `M${R},${y - o} H${x - o} V${B + o} H${R}` }, g);
  const px = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) px.push(el("rect", { x: x + c * scale, y: y + r * scale, width: scale, height: scale, style: `fill: ${shade(0)}` }, g));
  const paddle = el("g", { display: "none" }, g);
  const pads = [0, 1].map(() => el("rect", { x: R - scale, y, width: scale, height: scale, style: `fill: ${shade(255)}` }, paddle));
  const grid = el("g", { class: "pg-grid" }, g);
  for (let c = 1; c < W; c++) el("line", { x1: x + c * scale, y1: y, x2: x + c * scale, y2: B }, grid);
  for (let r = 1; r < H; r++) el("line", { x1: x, y1: y + r * scale, x2: R, y2: y + r * scale }, grid);
  el("rect", { class: "px-frame", x, y, width: W * scale, height: H * scale }, g);
  const marks = el("g", {}, g);
  // The brightness each pixel shows, the paddle's included, so that a step fades only what dims.
  let shown = new Array(W * H).fill(0), stop = null;
  const fill = (i, v) => { px[i].style.fill = shade(v); };
  function draw(s, { animate = false, oneScreen = false, nudge = 0 } = {}) {
    stop?.(); stop = null;
    const v = new Array(W * H).fill(0), lit = new Set();
    if (s) {
      if (!oneScreen && s.prev) v[s.prev[1] * W + s.prev[0]] = FAINT;
      if (!oneScreen && s.prevPaddle !== undefined && s.prevPaddle !== null) for (const r of [s.prevPaddle, s.prevPaddle + 1]) v[r * W + W - 1] = FAINT;
      v[s.ball[1] * W + s.ball[0]] = 255;
      for (const r of [s.paddle, s.paddle + 1]) lit.add(r * W + W - 1);
      pads.forEach((p, k) => p.setAttribute("y", y + (s.paddle + k) * scale));
      paddle.setAttribute("transform", nudge ? `translate(0 ${nudge * Math.round(scale * 0.18 * 10) / 10})` : "");
    }
    show(paddle, !!s);
    const now = v.map((b, i) => (lit.has(i) ? 255 : b)), dim = [];
    const fade = animate && !reducedMotion.matches;
    for (let i = 0; i < W * H; i++) {
      if (fade && now[i] < shown[i]) { dim.push([i, shown[i], v[i]]); fill(i, shown[i]); }
      else fill(i, v[i]);
    }
    if (dim.length) stop = tween(260, (e) => dim.forEach(([i, a, b]) => fill(i, a + (b - a) * e)));
    shown = now;
    marks.replaceChildren();
    if (s && oneScreen && s.prev) {
      const d = Math.round(scale * 0.14);
      el("rect", { class: "pg-unseen", x: x + s.prev[0] * scale + d, y: y + s.prev[1] * scale + d, width: scale - 2 * d, height: scale - 2 * d }, marks);
    }
  }
  return {
    g, draw, x, y, scale, right: R, bottom: B,
    cx: (c) => x + (c + 0.5) * scale, cy: (r) => y + (r + 0.5) * scale,
    toPixel: (p) => [(p.x - x) / scale, (p.y - y) / scale],
  };
}

/* ---------- The values of the three moves ---------- */

// Region A's bars, right of the screen. Each move has a row: its name at the left and its value at the right, on one
// line, and its bar below them, on one axis of values from −2 to 2.5 shared by every row and by Figures 1, 3 and 6.
// Bars grow from 0, solid blue, the ink of the network's estimates (BAR_FILL, over the cart-pole's paler .cp-bar); the
// bar of a value outside the axis stops at its end with a notch. Under the axis, its two ways and its name. The marks
// are pushChart's: the move just chosen fills its bar's row in yellow, and the bars updated and borrowed by a target are
// outlined in green and red, a second outline inside the first. An exact value's short red line crosses its row over a
// halo of the card's color, so that it stands apart from a solid bar under it; the halo is narrow (0.9 unit on each side),
// so that a bar it crosses still reads as one piece.
const VMIN = -2, VMAX = 2.5, AX0 = 236, AX1 = 434;
// The bars' fill and the halo of an exact value's red line, both from the color tokens.
const BAR_FILL = "fill: var(--blue)", REF_HALO = "stroke: color-mix(in srgb, var(--blue) 40%, var(--card)); stroke-width: 4.2; stroke-linecap: round";
// The x of a value on the axis, kept on the axis.
export const vx = (v) => AX0 + ((Math.max(VMIN, Math.min(VMAX, v)) - VMIN) / (VMAX - VMIN)) * (AX1 - AX0);
// The top of row k's bar, the bar's height, the line of the row's name and value, and the axis.
const TT = (k) => 25 + 35 * k, TH = 9, LINE = -8.5, AXIS_Y = 109;
export function valueBars(parent, { decimals = 2 } = {}) {
  const g = el("g", { class: "pg-bars" }, parent);
  const frame = el("g", {}, g), axes = el("g", { class: "axes" }, frame);
  el("line", { x1: AX0, y1: AXIS_Y, x2: AX1, y2: AXIS_Y }, axes);
  for (let v = VMIN; v <= 2; v++) {
    el("line", { x1: vx(v), y1: AXIS_Y, x2: vx(v), y2: AXIS_Y + 3 }, axes);
    text(frame, { class: "pg-lab", x: vx(v), y: AXIS_Y + 16.5, "text-anchor": "middle" }, localNum(v));
    // Within each row, a short faint line at each tick, and a stronger one at 0, where the bars start.
    for (let k = 0; k < 3; k++) el("line", { class: v === 0 ? "cp-zero" : "cp-grid", x1: vx(v), y1: TT(k) - 3, x2: vx(v), y2: TT(k) + TH + 3 }, frame);
  }
  // The two ways along the axis, each at its end and on a line of its own (on one line, "← a miss ahead hits ahead →"
  // read as one phrase on phones, and the Spanish ones do not fit), then the axis's name.
  text(frame, { class: "pg-ax", x: AX0, y: AXIS_Y + 34.5 }, tr("← a miss ahead", "← la pelota se escapará"));
  text(frame, { class: "pg-ax", x: AX1, y: AXIS_Y + 50.5, "text-anchor": "end" }, tr("hits ahead →", "vienen devoluciones →"));
  const name = text(frame, { class: "pg-ax", x: 333, y: AXIS_Y + 65, "text-anchor": "middle" }, tr("value of the move, ", "valor del movimiento, "));
  mathText(el("tspan", { class: "m" }, name), [["Q", true], ["(φ, ", false], ["a", true], ["; θ)", false]]);
  const marks = el("g", {}, g), bars = el("g", {}, g), exactG = el("g", {}, g), labels = el("g", {}, g);
  MOVES.forEach((m, k) => text(labels, { class: "pg-lab", x: AX0, y: TT(k) + LINE }, m));
  const vals = [0, 1, 2].map((k) => text(labels, { class: "pg-val", x: 436, y: TT(k) + LINE, "text-anchor": "end" }, ""));
  const rects = [0, 1, 2].map(() => el("rect", { class: "cp-bar", height: TH, style: BAR_FILL }, bars));
  const ends = [0, 1, 2].map(() => el("path", { class: "cp-bar-top pg-end-line" }, bars));
  const endWord = text(g, { class: "pg-end", x: (AX0 + AX1) / 2, y: 71, "text-anchor": "middle", display: "none" }, tr("end", "fin"));
  // Bars at the values qs: from 0 to the value, or to the axis's end with a notch.
  let placed = null, stop = null;
  function place(qs) {
    qs.forEach((v, k) => {
      const x0 = vx(0), x1 = Math.round(vx(v) * 100) / 100, t = TT(k), out = v < VMIN ? -1 : v > VMAX ? 1 : 0;
      rects[k].setAttribute("x", Math.min(x0, x1)); rects[k].setAttribute("y", t); rects[k].setAttribute("width", Math.abs(x1 - x0));
      ends[k].setAttribute("d", out ? `M${x1},${t - 1.5} L${x1 - 4 * out},${t + 2} L${x1},${t + 4.5} L${x1 - 4 * out},${t + 7} L${x1},${t + TH + 1.5}` : `M${x1},${t - 1.5} V${t + TH + 1.5}`);
    });
    placed = qs.slice();
  }
  // Draws a build's q, exact, pick, taken, tg, upd and best; returns the moves worth most (none after the end).
  function draw(b, animate) {
    stop?.(); stop = null;
    const { q, exact, pick, taken } = b, end = q === null, none = q === undefined;
    show(frame, !end); show(labels, !end); show(endWord, end); show(bars, !end && !none);
    marks.replaceChildren(); exactG.replaceChildren();
    if (end) { placed = null; return []; }
    const row = (k) => ({ x: AX0 - 2, y: TT(k) - 2, width: AX1 - AX0 + 4, height: TH + 4 });
    if (pick !== null && pick !== undefined) el("rect", { class: "gw-pick", ...row(pick) }, marks);
    if (taken !== null && taken !== undefined && animate && !reducedMotion.matches)
      el("rect", { class: "gw-pick", ...row(taken) }, marks).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in", fill: "forwards" });
    const nested = [0, 0, 0];
    for (const [kind, ms] of [["upd", b.upd], ["tg", b.tg]]) for (const k of list(ms)) {
      const d = 2 * nested[k]++;
      el("rect", { class: `gw-mark ${kind}`, x: AX0 - 3 + d, y: TT(k) - 3 + d, width: AX1 - AX0 + 6 - 2 * d, height: TH + 6 - 2 * d }, marks);
    }
    const best = b.best !== undefined ? list(b.best) : none ? [] : bestMoves(q, decimals);
    vals.forEach((t, k) => { t.textContent = none ? "" : valueText(q[k], decimals); t.setAttribute("class", best.includes(k) ? "pg-val best" : "pg-val"); });
    if (exact) exact.forEach((v, k) => {
      const at = { x1: vx(v), y1: TT(k) - 3, x2: vx(v), y2: TT(k) + TH + 3 };
      el("line", { ...at, style: REF_HALO }, exactG);
      el("line", { class: "cp-ref", ...at }, exactG);
    });
    if (none) { placed = null; return best; }
    if (animate && placed && !reducedMotion.matches) {
      const from = placed.slice();
      stop = tween(260, (e) => place(from.map((v, k) => v + (q[k] - v) * e)));
    } else place(q);
    return best;
  }
  return { draw, g };
}

/* ---------- Region A: the game ---------- */

// The screen at 24 units per pixel (x 12–204, y 18–162), the small blue arrow of the best move beside the paddle
// (x 208–222), and the bars, in y 0 to 176 of a viewBox 440 wide (Figure 1's coordinates, shared by Figures 3 and 6).
// The arrow points up or down, or is a short dash for staying; there is none on a tie, before the first screen and after
// the end.
export function createGame(svg, { decimals = 2 } = {}) {
  const screen = createScreen(svg, { x: 12, y: 18, scale: 24 });
  const arrow = el("g", {}, svg);
  const bars = valueBars(svg, { decimals });
  function draw(b, animate) {
    const s = b.s ?? null, anim = !!animate && !b.jump;
    screen.draw(s, { animate: anim, oneScreen: !!b.oneScreen, nudge: b.nudge || 0 });
    const best = bars.draw(b, anim);
    arrow.replaceChildren();
    if (s && best.length === 1) moveGlyph(arrow, best[0], 215, screen.cy(s.paddle) + 12, 13, "pg-best");
    return best;
  }
  return { draw, screen, bars };
}

/* ---------- Region M: the replay memory ---------- */

// Its label, "Replay memory 𝒟: 6 of 10,000", then either up to 12 numbered cells, one per stored transition, each with
// its move's glyph and its reward when not 0, the cells drawn outlined in green with how many of the 32 draws fell on
// them above; or a strip of the transitions stored, oldest at the left, with a green tick above each slot drawn,
// taller where several draws fall together.
const CW = 32, CH = 30, CP = 35.6, SX0 = 12, SX1 = 428;
function memoryView(svg, top) {
  const g = el("g", { class: "pg-memory" }, svg);
  const label = el("text", { class: "pg-lab", x: 12, y: top + 13 }, g);
  const body = el("g", {}, g);
  function draw(m) {
    show(g, !!m);
    if (!m) return;
    label.replaceChildren(tr("Replay memory ", "Memoria de replay "));
    el("tspan", { class: "pg-cal" }, label).textContent = "𝒟";
    label.append(tr(`: ${localNum(m.size)} of ${localNum(m.capacity)}`, `: ${localNum(m.size)} de ${localNum(m.capacity)}`));
    body.replaceChildren();
    if (m.cells) {
      const cy = top + 36.5, cx = (i) => 12 + i * CP + CW / 2;
      for (let i = 0; i < 12; i++) {
        const c = m.cells[i];
        el("rect", { class: c ? "pg-cell" : "pg-cell empty", x: cx(i) - CW / 2, y: cy, width: CW, height: CH, rx: 3 }, body);
        if (!c) continue;
        // A cell with a reward: a smaller glyph near the top and the reward low in the cell, apart enough that a dash
        // over a minus sign does not read as "=".
        moveGlyph(body, c.a, cx(i), c.r ? cy + 6.5 : cy + CH / 2, c.r ? 9 : 11, "pg-glyph");
        if (c.r) text(body, { class: "pg-lab ink", x: cx(i), y: cy + CH - 2.5, "text-anchor": "middle" }, rewardText(c.r));
        text(body, { class: "pg-lab faint", x: cx(i), y: cy + CH + 17.5, "text-anchor": "middle" }, localNum(i + 1));
      }
      for (const { cell, n } of m.counts || []) {
        el("rect", { class: "gw-mark upd", x: cx(cell) - CW / 2 - 2, y: cy - 2, width: CW + 4, height: CH + 4, rx: 4 }, body);
        text(body, { class: "pg-count", x: cx(cell), y: cy - 6, "text-anchor": "middle" }, `×${localNum(n)}`);
      }
    } else if (m.strip) {
      const { filled, ticks } = m.strip, sy = top + 46, sh = 14;
      el("rect", { class: "pg-strip", x: SX0, y: sy, width: SX1 - SX0, height: sh }, body);
      // Draws closer than 2.5 units share one tick, as tall as their number.
      const xs = (ticks || []).map((t) => SX0 + ((t + 0.5) / filled) * (SX1 - SX0)).sort((a, b) => a - b), groups = [];
      for (const x of xs) {
        const last = groups.at(-1);
        if (last && x - last.x0 < 2.5) { last.n++; last.sum += x; } else groups.push({ x0: x, n: 1, sum: x });
      }
      for (const { n, sum } of groups) {
        const x = Math.round((sum / n) * 10) / 10;
        el("line", { class: "pg-draw", x1: x, y1: sy - 1.5, x2: x, y2: sy - 1.5 - Math.min(22, 7 + 4 * (n - 1)) }, body);
      }
      text(body, { class: "pg-lab faint", x: SX0, y: sy + sh + 17 }, tr("oldest", "más antigua"));
      text(body, { class: "pg-lab faint", x: SX1, y: sy + sh + 17, "text-anchor": "end" }, tr("newest", "más reciente"));
    }
  }
  return { draw, g };
}

/* ---------- Region B: learning from one transition ---------- */

// Its label, "Learning from transition 12", the two pairs of screens of the transition at 12 units per pixel, φ_j and
// φ_j+1 (or "end"), named under them, with the move and the reward on the arrow between them; and beside them a short
// gauge from the value before the step (blue) to its target (red), each named and written at its end, on which a
// green-outlined marker slides to the value after the step. The gauge shows the share of the gap one step closes,
// which on the bars' axis would be a pixel or two.
// The two small screens sit at x 12 and 214, the arrow between them leaving room for its longest label ("quedarse, −1"),
// and the gauge runs from GX0 to GX1, its labels hanging inward from its ends.
const GX0 = 324, GX1 = 432;
function learnView(svg, { top, decimals }) {
  const g = el("g", { class: "pg-learn", display: "none" }, svg);
  const label = el("text", { class: "pg-lab", x: 12, y: top + 14 }, g);
  const ty = top + 24, my = ty + 36;
  const one = createScreen(g, { x: 12, y: ty, scale: 12 }), two = createScreen(g, { x: 214, y: ty, scale: 12 });
  const endWord = text(g, { class: "pg-end", x: 262, y: my + 6, "text-anchor": "middle" }, tr("end", "fin"));
  el("line", { class: "pg-step", x1: 112, y1: my, x2: 199, y2: my }, g);
  el("polygon", { class: "pg-step-head", points: `${206},${my} ${197},${my - 4.5} ${197},${my + 4.5}` }, g);
  const stepLab = el("text", { class: "pg-lab", x: 159.5, y: my - 10, "text-anchor": "middle" }, g);
  const phi = (cx) => el("text", { class: "pg-math", x: cx, y: ty + 92, "text-anchor": "middle" }, g);
  const phi1 = phi(60), phi2 = phi(262);
  const gauge = el("g", {}, g);
  const line = el("line", { class: "pg-gauge", y1: my, y2: my }, gauge);
  const vTick = el("line", { class: "pg-gv", y1: my - 9, y2: my + 9 }, gauge), tTick = el("line", { class: "pg-gt", y1: my - 9, y2: my + 9 }, gauge);
  const vName = el("text", { class: "pg-lab ln", y: my - 18 }, gauge), tName = el("text", { class: "pg-lab tg", y: my - 18 }, gauge);
  const vNum = el("text", { class: "pg-lab ln", y: my + 28 }, gauge), tNum = el("text", { class: "pg-lab tg", y: my + 28 }, gauge);
  const marker = el("rect", { class: "pg-marker", y: my - 11, width: 9, height: 22, rx: 2.5 }, gauge);
  let stop = null;
  const name = (t, sub) => { t.replaceChildren(); mathText(t, [["φ", false]]); const s = el("tspan", { class: "pg-sub", dy: "0.32em" }, t); mathText(s, sub); };
  function draw(l, animate) {
    stop?.(); stop = null;
    show(g, !!l);
    if (!l) return;
    label.textContent = tr(`Learning from transition ${localNum(l.j)}`, `Aprender de la transición ${localNum(l.j)}`);
    one.draw(l.from);
    const end = l.to === "end";
    show(two.g, !end); show(endWord, end);
    if (!end) two.draw(l.to);
    stepLab.textContent = `${MOVES[l.a]}, ${rewardText(l.r)}`;
    const sub = l.sub ?? "j", num = typeof sub === "number";
    name(phi1, num ? [[localNum(sub), false]] : [[sub, true]]);
    show(phi2, !end);
    name(phi2, num ? [[localNum(sub + 1), false]] : [[sub, true], ["+1", false]]);
    // The gauge runs from the smaller of value and target to the larger (the new value kept inside it).
    const has = l.next !== undefined && l.next !== null, vs = [l.value, l.target, ...(has ? [l.next] : [])];
    const lo = Math.min(...vs), hi = Math.max(...vs), gx = (v) => (hi > lo ? GX0 + ((v - lo) / (hi - lo)) * (GX1 - GX0) : (GX0 + GX1) / 2);
    line.setAttribute("x1", gx(lo)); line.setAttribute("x2", gx(hi));
    for (const [tick, nm, nb, v, word] of [[vTick, vName, vNum, l.value, tr("value", "valor")], [tTick, tName, tNum, l.target, tr("target", "objetivo")]]) {
      const x = gx(v), left = v <= (lo + hi) / 2, tx = left ? x - 4 : x + 4, anchor = left ? "start" : "end";
      tick.setAttribute("x1", x); tick.setAttribute("x2", x);
      for (const t of [nm, nb]) { t.setAttribute("x", tx); t.setAttribute("text-anchor", anchor); }
      nm.textContent = word; nb.textContent = valueText(v, decimals);
    }
    show(marker, has);
    if (!has) return;
    const at = (v) => marker.setAttribute("x", gx(v) - 4.5);
    if (animate && !reducedMotion.matches) { at(l.value); stop = tween(400, (e) => at(l.value + (l.next - l.value) * e)); }
    else at(l.next);
  }
  return { draw, g };
}

/* ---------- Figure 3's view ---------- */

// The view slideshow() takes for the guided run of deep Q-learning, a 440 × 410 viewBox: region A, the game (y 0–176);
// region M, the replay memory (y 182–266); region B, learning from one transition (y 276–410), shown only on the presses
// that learn. The regions keep their places, so nothing moves as the readout grows. The bars carry the values, so there
// is no heatmap: the settings offer the sound alone.
export function createPongView(svg, { decimals = 3 } = {}) {
  svg.setAttribute("viewBox", "0 0 440 410");
  const game = createGame(svg, { decimals });
  for (const y of [180, 271]) el("line", { class: "rule-line", x1: 12, y1: y, x2: 428, y2: y }, svg);
  const memory = memoryView(svg, 182), learn = learnView(svg, { top: 276, decimals });
  function draw(b, animate) {
    const anim = !!animate && !b.jump;
    game.draw(b, anim);
    memory.draw(b.memory ?? null);
    learn.draw(b.jump ? null : b.learn ?? null, anim);
  }
  return { draw, setHeat() {}, noHeat: true, game, memory, learn };
}
