import { el, tr } from "../../plane.js";

// The DDPG note's game, the rally with any speed: a field 16 units wide and 12 tall (x = 0 the left column, y = 0 the
// top row), a ball moving one unit diagonally per frame, and a paddle 3 tall at the right edge whose top is a real
// number that moves by the speed the agent picks, from −1 (up) to 1 (down) units a frame. This module draws the game
// and runs the one requestAnimationFrame that every player on the page shares; rally-player.js plays recorded frames
// on it. It computes nothing but the drawing.
//
// The agent reads five numbers, never pixels, so the game is drawn continuous (Joaquín's decision of 21 Oct 2026): a
// plain field in --img-lo, the ball a round dot and the paddle a bar in --img-hi, both at the positions the player
// passes, which it interpolates between recorded frames, so they glide at any frame rate. The ball's centre is the
// middle of its unit (bx + 0.5, by + 0.5) and its radius 0.4 units; the paddle covers py to py + 3 down the right
// column, its face at x = 15, so a hit (the ball's centre row inside [py, py + 3] as it reaches column 14) is drawn
// touching it. Beside the paddle, outside the field, the speed taken this frame as a yellow arrow from the paddle's
// middle (56 units at |a| = 1, none at 0), and, at a card, the actor's own speed as a dashed outline arrow. Marks on
// the field use --img-hi only (the dashed outline of the actor's paddle during a try, a faint next ball).

export const W = 16, H = 12, P = 3;
export const HIT = 1, MISS = -1, SERVE = 2;
const BALL_R = 0.4, PAD_W = 0.6, ARROW_X = 419, ARROW_LEN = 56;

export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// A player may start by itself only when the system does not ask for reduced motion (Joaquín's exception to the site's
// rule that nothing moves unless the reader starts it: the game plays when it comes into view).
export const motionAllowed = () => !reducedMotion.matches;
export const fades = () => !reducedMotion.matches;

// One requestAnimationFrame for every player on the page: each registered tick(dt) runs while it returns true.
const ticks = new Set();
let rafId = 0, lastNow = 0;
function loop(now) {
  const dt = Math.min(100, now - lastNow); lastNow = now;
  for (const t of [...ticks]) if (!t(dt)) ticks.delete(t);
  rafId = ticks.size ? requestAnimationFrame(loop) : 0;
}
export function schedule(tick) {
  ticks.add(tick);
  if (!rafId) { lastNow = performance.now(); rafId = requestAnimationFrame(loop); }
  return () => ticks.delete(tick);
}

// A state between two recorded ones: the ball and the paddle a share u of the way (both move in straight lines within a
// frame: a bounce happens exactly at a recorded frame).
export function lerpState(s0, s1, u) {
  if (!s1 || u <= 0) return s0;
  const m = (a, b) => a + (b - a) * u;
  return { ...s0, bx: s0.bx === null ? null : m(s0.bx, s1.bx), by: s0.by === null ? null : m(s0.by, s1.by), py: m(s0.py, s1.py) };
}

let clipN = 0;
// The game in svg (viewBox 0 0 440 330): the field at 24 units per game unit from (16, 26), the top, bottom and left
// walls 4 units outside it, the right edge thin; the speed arrows at x 406-432; the outcome over the paddle's column.
export function createFrame(svg, { x = 16, y = 26, scale = 24, onShow = null } = {}) {
  const R = x + W * scale, B = y + H * scale, o = 4;
  const X = (u) => x + u * scale, Y = (v) => y + v * scale;
  el("path", { class: "pg-wall", d: `M${R},${y - o} H${x - o} V${B + o} H${R}` }, svg);
  el("rect", { class: "rl-field", x, y, width: W * scale, height: H * scale }, svg);
  const id = `rl-field-clip-${++clipN}`;
  const cp = el("clipPath", { id }, el("defs", {}, svg));
  el("rect", { x, y, width: W * scale, height: H * scale }, cp);
  const live = el("g", { "clip-path": `url(#${id})` }, svg);
  const faint = el("circle", { class: "rl-ball faint", r: BALL_R * scale, display: "none" }, live);
  const ball = el("circle", { class: "rl-ball", r: BALL_R * scale, display: "none" }, live);
  const paddle = el("rect", { class: "rl-paddle", x: X(W - 1), width: PAD_W * scale, height: P * scale, rx: 3, display: "none" }, live);
  const ghost = el("rect", { class: "pg-unseen", x: X(W - 1) + 1, y: 0, width: PAD_W * scale - 2, height: P * scale - 2, rx: 3, display: "none" }, svg);
  el("rect", { class: "px-frame", x, y, width: W * scale, height: H * scale }, svg);
  const arrowMu = el("polygon", { class: "rl-speed-mu", display: "none" }, svg);
  const arrowP = el("polygon", { class: "rl-speed", display: "none" }, svg);
  const outcome = el("text", { class: "rl-outcome", x: X(W - 1 + PAD_W / 2), y: 18, "text-anchor": "middle" }, svg);
  let fadeAnim = null, cur = null;
  const r2 = (n) => Math.round(n * 100) / 100;
  const show1 = (node, on) => (on ? node.removeAttribute("display") : node.setAttribute("display", "none"));

  // A speed arrow from the paddle's middle, ARROW_LEN·|a| long, pointing down for a > 0; none at a = 0.
  function arrow(node, a, py) {
    const L = a === null || a === undefined || py === undefined ? 0 : ARROW_LEN * Math.abs(a);
    if (L < 0.5) { show1(node, false); return; }
    const cx = ARROW_X, y0 = Y(py + P / 2), d = a > 0 ? 1 : -1, y1 = y0 + d * L, hl = Math.min(11, L), yh = y1 - d * hl, hw = 4 + 4 * (hl / 11);
    const pts = L > hl ? [[cx - 3, y0], [cx + 3, y0], [cx + 3, yh], [cx + hw, yh], [cx, y1], [cx - hw, yh], [cx - 3, yh]] : [[cx + hw, yh], [cx, y1], [cx - hw, yh]];
    node.setAttribute("points", pts.map(([px, pyy]) => `${r2(px)},${r2(pyy)}`).join(" "));
    show1(node, true);
  }
  // The outcome over the paddle's column: "+1" or "−1"; fade true fades it out over 600 ms (shown at once with reduced
  // motion, then cleared by the next frame).
  function score(text, { fade = false } = {}) {
    fadeAnim?.cancel(); fadeAnim = null;
    outcome.textContent = text || "";
    outcome.style.opacity = "";
    if (text && fade && fades()) fadeAnim = outcome.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 600, fill: "forwards" });
  }
  return {
    // A state of the game: { bx, by, py, dx?, dy?, faint? } (bx, by and py may lie between recorded frames; bx null:
    // no ball), or null for an empty field. a, the speed taken from this frame, for the yellow arrow; mu, the actor's
    // own speed, for the outline arrow, or null. between: a state drawn between two recorded frames, which the
    // numbers beside the frame (onShow) do not take.
    show(s, { a = null, mu = null, between = false } = {}) {
      cur = s;
      live.style.opacity = "";
      const hasBall = !!s && s.bx !== null && s.bx !== undefined;
      show1(ball, hasBall); show1(paddle, !!s);
      if (hasBall) { ball.setAttribute("cx", r2(X(s.bx + 0.5))); ball.setAttribute("cy", r2(Y(s.by + 0.5))); }
      if (s) paddle.setAttribute("y", r2(Y(s.py)));
      const fz = s?.faint;
      show1(faint, !!fz);
      if (fz) { faint.setAttribute("cx", r2(X(fz[0] + 0.5))); faint.setAttribute("cy", r2(Y(fz[1] + 0.5))); }
      arrow(arrowP, s ? a : null, s?.py); arrow(arrowMu, s ? mu : null, s?.py);
      if (!between) onShow?.(s, a);
    },
    // Fade the ball and paddle to u (1 shown, 0 gone); the arrows go at once.
    dim(u) { live.style.opacity = String(Math.max(0, u)); if (u < 1) { arrow(arrowP, null); arrow(arrowMu, null); } },
    ghost(py) { if (py === null || py === undefined) show1(ghost, false); else { ghost.setAttribute("y", r2(Y(py) + 1)); show1(ghost, true); } },
    score,
    get state() { return cur; },
  };
}

// The words of a speed: "0.42 down" / "0.42 hacia abajo" (down is a > 0, since y grows downward).
export function speedWords(a) {
  const v = Math.abs(a).toFixed(2);
  if (v === "0.00") return tr("0.00, still", "0.00, quieta");
  return a > 0 ? tr(`${v} down`, `${v} hacia abajo`) : tr(`${v} up`, `${v} hacia arriba`);
}
