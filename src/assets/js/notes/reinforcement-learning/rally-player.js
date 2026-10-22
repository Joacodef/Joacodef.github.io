import { tr } from "../../plane.js";
import { createFrame, schedule, motionAllowed, reducedMotion, fades, lerpState, HIT, MISS } from "./rally.js";

// The rally player, the one figure kind of the DDPG note: it plays recorded frames of the rally (rally.js) at 6 frames a
// second (or faster: fps), the ball and the paddle gliding between them. Between two episodes of a reel, and at its end
// before it serves again, it takes a break (the ball runs on as the frame dims out, then the field stays empty). Its
// stops freeze the play on their frame and show a card beside the frame (below it on phones), Continue stepping through
// the stop's cards; "Replay with notes" restarts the reel from its first frame with its stops armed again.
//
// At the top of the right-hand column, the live panel: a gauge of the speed taken this frame, from −1 (up) to 1 (down),
// and the five numbers the agent reads, both updated at every frame, so that input and output show while it plays.
//
// When it plays: while the reader wants it (at once without reduced motion, after Play otherwise), at least half of the
// frame is on screen, the tab is visible, no card is open and no try is playing. While a card is open, Play/Pause reads
// "Play" and is disabled; Continue (or Enter) goes on. A stop on a reel's first frame opens when the play starts.
//
// createRallyPlayer(fig, { frames, starts, stops, allCards, fps, onFrame, onDraw, onReplay, onKey })
//   frames    [bx, by, dx, dy, py, a, r, ev, …] per frame, a the speed taken from it, ev 1 hit, −1 miss, 2 serve;
//   starts    the frames where a new episode begins (a break before each), besides 0;
//   stops     [{ t, cards: [{ title, html (string or function), mu, draw(), enter(), leave(), extraSample }] }];
//             mu shows the actor's own speed as a dashed arrow, and draw() replaces the frame's drawing while the card
//             is open;
//   allCards  every card the figure can show, in any of its modes, for the height its column keeps at desktop width;
//   fps       frames a second (6 by default);
//   onFrame(t) at each recorded frame landed on; onDraw(t, u) at every drawing, u the share of the way to frame t + 1.
// load({ frames, starts, stops, armed }) swaps the reel (a mode button): the play restarts from its first frame, with
// the stops in armed (indices) armed.

const MINUS = "−";
const sgn = (v) => (v < 0 ? MINUS : "") + Math.abs(v);

// The live panel: the speed gauge (an SVG, −1 at the top, 1 at the bottom, the speed taken as a yellow bar from 0 with
// an ink mark at its end, its value in words under it) and the five numbers the agent reads.
function createLive(parent) {
  const box = document.createElement("div");
  box.className = "rl-live";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", tr("The speed the agent takes at this frame, and the five numbers it reads, updated at every frame", /* ES-TODO */ "La velocidad que el agente toma en este cuadro y los cinco números que lee, en cada cuadro"));
  const G0 = 12, G1 = 108, GM = (G0 + G1) / 2, gy = (a) => GM + a * ((G1 - G0) / 2);
  const ticks = [-1, -0.5, 0, 0.5, 1].map((v) => `<line class="rl-lg-tick" x1="24" x2="30" y1="${gy(v)}" y2="${gy(v)}"/>`).join("");
  const lab = (v, s) => `<text class="rl-lg-lab" x="46" y="${gy(v) + 4}">${s}</text>`;
  box.innerHTML = `<div class="rl-live-speed"><p class="rl-live-h">${tr("Speed taken", /* ES-TODO */ "Velocidad tomada")}</p>`
    + `<svg class="rl-lgauge" viewBox="0 0 96 120" aria-hidden="true"><rect class="rl-lg-track" x="30" y="${G0}" width="10" height="${G1 - G0}" rx="2"/>${ticks}`
    + `<rect class="rl-lg-bar" x="30" width="10" y="${GM}" height="0"/><line class="rl-lg-mark" x1="25" x2="45" y1="${GM}" y2="${GM}"/>`
    + `${lab(-1, tr(`${MINUS}1 up`, `${MINUS}1 arriba`))}${lab(0, "0")}${lab(1, tr("1 down", "1 abajo"))}</svg>`
    + `<p class="rl-live-v"></p></div>`
    + `<div class="rl-live-read"><p class="rl-live-h">${tr("What the agent reads", "Lo que lee el agente")}</p><table class="rl-inputs"><tbody>`
    + [tr("ball across", /* ES-TODO */ "pelota, a lo ancho"), tr("ball down", /* ES-TODO */ "pelota, hacia abajo"), tr("moving across", /* ES-TODO */ "va a lo ancho"), tr("moving up or down", /* ES-TODO */ "va arriba o abajo"), tr("paddle top", "borde superior de la paleta")]
      .map((n) => `<tr><th scope="row">${n}</th><td></td></tr>`).join("")
    + `</tbody></table></div>`;
  parent.prepend(box);
  const bar = box.querySelector(".rl-lg-bar"), mark = box.querySelector(".rl-lg-mark"), val = box.querySelector(".rl-live-v");
  const cells = [...box.querySelectorAll(".rl-inputs td")];
  const across = (d) => (d > 0 ? tr("1, right", "1, derecha") : tr(`${MINUS}1, left`, `${MINUS}1, izquierda`));
  const upDown = (d) => (d > 0 ? tr("1, down", "1, abajo") : tr(`${MINUS}1, up`, `${MINUS}1, arriba`));
  const text = (i, s) => { if (cells[i].textContent !== s) cells[i].textContent = s; };
  return {
    // s: a state of the game (or null), a: the speed taken from it (null: none, at an episode's last frame)
    set(s, a) {
      const has = a !== null && a !== undefined;
      const y = has ? gy(Math.max(-1, Math.min(1, a))) : GM;
      bar.setAttribute("y", Math.min(y, GM).toFixed(2)); bar.setAttribute("height", Math.abs(y - GM).toFixed(2));
      mark.setAttribute("y1", y.toFixed(2)); mark.setAttribute("y2", y.toFixed(2));
      mark.style.visibility = has ? "" : "hidden";
      const v = has ? (Math.abs(a).toFixed(2) === "0.00" ? tr("0.00, still", "0.00, quieta") : `${Math.abs(a).toFixed(2)} ${a > 0 ? tr("down", "abajo") : tr("up", "arriba")}`) : tr("none, the episode ends", /* ES-TODO */ "ninguna, el episodio termina");
      if (val.textContent !== v) val.textContent = v;
      if (!s || s.bx === null || s.bx === undefined) { for (let i = 0; i < 4; i++) text(i, "–"); }
      else { text(0, sgn(s.bx)); text(1, sgn(s.by)); text(2, s.dx === undefined ? "–" : across(s.dx)); text(3, s.dy === undefined ? "–" : upDown(s.dy)); }
      text(4, s ? s.py.toFixed(2) : "–");
    },
  };
}

export function createRallyPlayer(fig, { frames, starts = [], stops, allCards, fps = 6, onFrame, onDraw, onReplay, onKey }) {
  const T = 1000 / fps, DIM = Math.min(150, 4 * T), EMPTY = Math.min(150, 3 * T);
  const svg = fig.querySelector("svg.rl-frame"), ctl = fig.querySelector(".rl-ctl"), box = fig.querySelector(".rl-card");
  const right = box.parentElement;
  const live = createLive(right);
  const frame = createFrame(svg, { onShow: (s, a) => live.set(s, a) });
  let F = frames, S = new Set(starts), ST = stops;
  const stateOf = (t) => ({ bx: F[t][0], by: F[t][1], dx: F[t][2], dy: F[t][3], py: F[t][4] });
  // The frame after t in the same episode, or null at an episode's last frame.
  const nextOf = (t) => (t + 1 < F.length && !S.has(t + 1) ? t + 1 : null);
  const speedOf = (t) => (nextOf(t) === null ? null : F[t][5]);

  // The controls row: Play/Pause, then Replay with notes once the last card is continued.
  const playBtn = document.createElement("button");
  playBtn.type = "button"; playBtn.className = "btn rl-play";
  const replayBtn = document.createElement("button");
  replayBtn.type = "button"; replayBtn.className = "rl-replay"; replayBtn.hidden = true;
  replayBtn.textContent = tr("Replay with notes", "Repetir con notas");
  ctl.append(playBtn, replayBtn);

  // The card: a title, the text, a line under it for extras (a try's outcome), Continue.
  box.innerHTML = '<p class="rl-card-title"></p><div class="rl-card-body"></div><p class="rl-card-extra"></p><button type="button" class="btn rl-continue"></button>';
  const [titleEl, bodyEl, extraEl, contBtn] = box.children;
  contBtn.textContent = tr("Continue", "Continuar");
  const html = (c) => (typeof c.html === "function" ? c.html() : c.html);
  function render(c, extra = "") {
    box.classList.toggle("empty", !c);
    titleEl.hidden = !c?.title;
    titleEl.textContent = c?.title ?? "";
    bodyEl.innerHTML = c ? html(c) : "";
    extraEl.innerHTML = extra;
    extraEl.hidden = !extra;
    contBtn.hidden = !c;
  }
  // Each card takes its own text's height. At desktop width the column beside the frame keeps the height of its
  // tallest state, so the page below never jumps when a card changes; in one column (below 840 px) nothing is reserved,
  // so no empty block pushes a chart or Continue off screen.
  const cardsToFit = allCards ?? stops.flatMap((s) => s.cards);
  const wide = matchMedia("(min-width: 840px)");
  function fit() {
    right.style.minHeight = "";
    if (!wide.matches) return;
    const keep = { c: current(), extra: extraEl.innerHTML };
    let tallest = 0;
    for (const c of cardsToFit) { render(c, c.extraSample ?? ""); tallest = Math.max(tallest, right.offsetHeight); }
    right.style.minHeight = `${tallest}px`;
    render(keep.c, keep.extra);
  }
  // A card that opens, or changes, out of view is brought into view: at desktop width the card; in one column the
  // chart (or pseudocode) above it and the card together, below the live panel. Only the least scroll that shows it,
  // and smooth only without reduced motion.
  function reveal() {
    let top, bottom;
    const rb = box.getBoundingClientRect();
    if (wide.matches) { top = rb.top; bottom = rb.bottom; }
    else {
      top = rb.top; bottom = rb.bottom;
      for (const e of right.children) {
        if (e === box || e.classList.contains("rl-live")) continue;
        const r = e.getBoundingClientRect();
        if (r.height > 0) top = Math.min(top, r.top);
      }
    }
    if (top >= 0 && bottom <= window.innerHeight) return;
    const d = bottom - top > window.innerHeight || top < 0 ? top - 8 : bottom - window.innerHeight + 8;
    window.scrollBy({ top: d, behavior: fades() ? "smooth" : "auto" });
  }

  let t = 0, u = 0, want = motionAllowed(), visible = false, busy = false, on = false, unschedule = null;
  let acc = 0, brk = null, brkTo = 0; // brk: the time into a break, or null; brkTo: the frame after it
  let armed = new Set(ST.map((_, i) => i)), stop = -1, card = -1, done = false;
  const current = () => (stop >= 0 && card >= 0 ? ST[stop].cards[card] : null);

  // The frame at t, a share v of the way to the next frame of its episode.
  function draw(v = 0) {
    const c = current();
    // A card may draw the frame itself (a remembered step, a speed taken a frame earlier).
    if (c?.draw) { c.draw(); return; }
    const n = nextOf(t), w = n === null ? 0 : v;
    if (w > 0) frame.show(lerpState(stateOf(t), stateOf(n), w), { a: speedOf(t), mu: c?.mu ?? null, between: true });
    else frame.show(stateOf(t), { a: speedOf(t), mu: c?.mu ?? null });
    u = w;
    onDraw?.(t, w);
  }
  function land(nt, { stops: check = true } = {}) {
    t = nt; u = 0;
    draw(0);
    const ev = F[t][7];
    if (ev === HIT || ev === MISS) frame.score(ev === HIT ? "+1" : "−1", { fade: true });
    else if (!fades() || S.has(t) || t === 0) frame.score("");
    onFrame?.(t);
    if (!check) return;
    const k = ST.findIndex((s, i) => armed.has(i) && s.t === t);
    if (k >= 0) openStop(k);
  }
  // A break after an episode's last frame: the ball runs on along its direction as the frame dims out.
  function breakDraw() {
    const s = stateOf(t), run = Math.min(1.5, brk / T);
    if (s.bx !== null) { s.bx += s.dx * run; s.by += s.dy * run; }
    frame.show(s, { between: true });
    frame.dim(brk < DIM ? (fades() ? 1 - brk / DIM : 0) : 0);
  }
  function tick(dt) {
    if (!on) return false;
    if (brk !== null) {
      brk += dt;
      if (brk < DIM + EMPTY) breakDraw();
      else { brk = null; acc = 0; land(brkTo); }
      return on;
    }
    acc += dt;
    while (on && acc >= T && brk === null) {
      acc -= T;
      const nt = t + 1 < F.length ? t + 1 : 0;
      if (nt === 0 || S.has(nt)) { brk = 0; brkTo = nt; frame.score(""); }
      else land(nt);
    }
    if (on && brk === null && nextOf(t) !== null) draw(acc / T);
    return on;
  }
  // While a card is open, Play/Pause reads "Play" and is disabled: Continue is the one way on.
  function label() {
    playBtn.textContent = current() || !want ? tr("Play", "Reproducir") : tr("Pause", "Pausar");
    playBtn.setAttribute("aria-disabled", String(busy || !!current()));
  }
  function sync() {
    const go = want && visible && !busy && !current() && !document.hidden;
    if (go && !on) {
      // A stop on the frame the play starts from (a reel's first frame) opens before anything moves.
      const k = ST.findIndex((s, i) => armed.has(i) && s.t === t);
      if (k >= 0 && brk === null && acc === 0) { openStop(k); return; }
      on = true; unschedule = schedule(tick);
    } else if (!go && on) {
      on = false; unschedule?.();
      if (brk !== null) { brk = null; acc = 0; land(brkTo); }
    }
    label();
  }
  function focusInside() { return fig.contains(document.activeElement) && document.activeElement !== document.body; }
  function showCard(k) {
    current()?.leave?.();
    card = k;
    const c = current();
    render(c);
    c?.enter?.();
    draw(0);
  }
  function openStop(k) {
    const inside = focusInside();
    armed.delete(k);
    stop = k;
    acc = 0;
    showCard(0);
    sync();
    if (inside) contBtn.focus({ preventScroll: true });
    reveal();
  }
  function cont() {
    if (!current()) return;
    endTry?.();
    const s = ST[stop];
    if (card + 1 < s.cards.length) { const inside = focusInside(); showCard(card + 1); if (inside) contBtn.focus({ preventScroll: true }); reveal(); return; }
    const inside = focusInside();
    current()?.leave?.();
    card = -1; render(null); draw(0);
    if (stop === ST.length - 1 || !armed.size) { done = true; replayBtn.hidden = false; }
    stop = -1;
    acc = 0;
    sync();
    if (inside) playBtn.focus();
  }
  function closeCard() {
    if (!current()) return;
    current()?.leave?.();
    card = -1; stop = -1; render(null);
  }
  let endTry = null; // set by a try in progress: ends it at once
  playBtn.addEventListener("click", () => {
    if (busy || current()) return;
    want = !want; sync();
  });
  // Enter continues an open card in view even when nothing on the page has focus (an automatic pause never moves the
  // focus).
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !current() || busy || e.defaultPrevented) return;
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement) return;
    const r = box.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return;
    e.preventDefault();
    cont();
  });
  contBtn.addEventListener("click", cont);
  function restart(armAll) {
    endTry?.();
    closeCard();
    if (armAll) armed = new Set(ST.map((_, i) => i));
    done = !armed.size && ST.length > 0;
    replayBtn.hidden = !done;
    if (on) { on = false; unschedule?.(); }
    brk = null; acc = 0;
    frame.score("");
    land(0, { stops: false });
  }
  replayBtn.addEventListener("click", () => {
    restart(true);
    onReplay?.();
    want = true; sync();
    playBtn.focus();
  });
  fig.addEventListener("keydown", (e) => {
    if (onKey?.(e)) return;
    if (e.key === " " && e.target === svg) { e.preventDefault(); playBtn.click(); }
    else if (e.key === "Enter" && current() && !e.target.closest("button, [role=slider]")) { e.preventDefault(); cont(); }
  });
  new IntersectionObserver((es) => { for (const e of es) visible = e.intersectionRatio >= 0.5; sync(); }, { threshold: [0, 0.5, 1] }).observe(svg);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) { want = false; sync(); } });

  render(null);
  fit();
  document.fonts?.ready.then(fit);
  let width = window.innerWidth;
  window.addEventListener("resize", () => { if (window.innerWidth !== width) { width = window.innerWidth; fit(); } });
  land(0, { stops: false });
  label();

  return {
    frame, stateOf, live,
    get frames() { return F; },
    get t() { return t; },
    get u() { return u; },
    get card() { return current(); },
    get playing() { return on; },
    get done() { return done; },
    get armed() { return new Set(armed); },
    // Swap the reel (a mode or stage button): restart from its first frame with the stops in `armed` armed.
    load({ frames: f, starts: st = [], stops: sp, armed: a }) {
      endTry?.();
      closeCard();
      F = f; S = new Set(st); ST = sp;
      armed = new Set(a ?? sp.map((_, i) => i));
      restart(false);
      sync();
    },
    // A try takes the frame over: busy freezes the player and disables Play/Pause; end() ends it at once.
    setBusy(b, end = null) { busy = b; endTry = b ? end : null; sync(); },
    extra(h) { extraEl.innerHTML = h; extraEl.hidden = !h; },
    redraw: () => draw(0),
    refit: fit,
    cont,
  };
}
