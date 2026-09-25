// Loads the 3D volume only after the page has rendered, so text appears first.
const container = document.getElementById("lung-volume");

function load() {
  import("/assets/js/lung-volume.js")
    .then((m) => m.mount(container))
    .catch(() => { /* Keep the static placeholder if loading fails. */ });
}

if (container) {
  const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  if (document.readyState === "complete") whenIdle(load);
  else window.addEventListener("load", () => whenIdle(load), { once: true });
}
