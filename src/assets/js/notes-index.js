// The notes index: each course opens and closes on its own. The courses a reader leaves open are open again on their
// next visit, kept per language in localStorage, and a link to a course (#its-name, as on the page) opens it. Without
// storage or without this script, every course starts closed and still opens and closes.
const courses = [...document.querySelectorAll("details.course")];
const key = `notes-open-${document.documentElement.lang || "en"}`;
let saved = [];
try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch { saved = []; }

const openFromHash = () => {
  const target = courses.find((c) => `#${c.id}` === location.hash);
  if (target) { target.open = true; target.scrollIntoView(); }
};
for (const c of courses) {
  if (saved.includes(c.id)) c.open = true;
  c.addEventListener("toggle", () => {
    try { localStorage.setItem(key, JSON.stringify(courses.filter((x) => x.open).map((x) => x.id))); } catch { /* kept for this visit only */ }
  });
}
openFromHash();
window.addEventListener("hashchange", openFromHash);
