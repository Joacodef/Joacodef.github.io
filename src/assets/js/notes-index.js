// The notes index: every course starts closed on each visit, and opens and closes on its own. A link to a course
// (#its-name, as on the page) opens it. Without this script, every course still starts closed and opens and closes.
const courses = [...document.querySelectorAll("details.course")];

// Earlier versions kept the open courses in localStorage; drop what they left.
try { localStorage.removeItem("notes-open-en"); localStorage.removeItem("notes-open-es"); } catch { /* nothing to drop */ }

const openFromHash = () => {
  const target = courses.find((c) => `#${c.id}` === location.hash);
  if (target) { target.open = true; target.scrollIntoView(); }
};
openFromHash();
window.addEventListener("hashchange", openFromHash);
