import * as esbuild from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs";

export default function (eleventyConfig) {
  // Static assets (CSS, JS, images, CV) are copied as-is.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/apple-touch-icon.png": "apple-touch-icon.png" });

  // The layouts link stylesheets and scripts with a short hash of their contents (`/assets/css/notes.css?v=1a2b3c4d`).
  // GitHub Pages lets browsers keep a file for 10 minutes, so without it a deploy could pair a new page with an old
  // stylesheet still in the cache. Modules that a script imports keep their plain URLs.
  eleventyConfig.addFilter("versioned", (url) => {
    const file = String(url).startsWith("/assets/") ? `src${url}` : null;
    if (!file || !fs.existsSync(file)) return url;
    return `${url}?v=${crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 8)}`;
  });

  // The 3D lung volume imports three.js from npm. esbuild bundles only the
  // parts of three.js it actually uses, so the homepage stays light.
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    await esbuild.build({
      entryPoints: ["scripts/lung-volume.js"],
      bundle: true,
      minify: true,
      format: "esm",
      target: "es2020",
      outfile: `${dir.output}/assets/js/lung-volume.js`,
      logLevel: "warning",
    });
  });
  eleventyConfig.addWatchTarget("scripts/");

  // Notes: every page inside a course folder under src/notes/.
  eleventyConfig.addCollection("notes", (api) =>
    api
      .getFilteredByGlob("src/notes/*/**/*.{html,md,njk}")
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
  );
  // Their Spanish versions, under src/es/notes/, in the same order.
  eleventyConfig.addCollection("notesEs", (api) =>
    api
      .getFilteredByGlob("src/es/notes/*/**/*.{html,md,njk}")
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
  );

  // The courses of a list of notes, in the order set by `courseOrder` in each course folder's JSON file.
  const courseNames = (notes) => {
    const order = new Map();
    for (const n of notes) if (!order.has(n.data.course)) order.set(n.data.course, n.data.courseOrder ?? Infinity);
    return [...order].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([course]) => course);
  };
  eleventyConfig.addFilter("courses", courseNames);
  // The notes of one course, in reading order.
  eleventyConfig.addFilter("byCourse", (notes, course) => notes.filter((n) => n.data.course === course));
  // The notes of one course in runs that share a module, for the notes index: each run with its module and the number
  // of its first note in the course.
  eleventyConfig.addFilter("moduleGroups", (notes) => {
    const groups = [];
    notes.forEach((note, i) => {
      const last = groups.at(-1);
      if (last && last.module === note.data.module) last.notes.push(note);
      else groups.push({ module: note.data.module, start: i + 1, notes: [note] });
    });
    return groups;
  });
  // Up to `count` notes for the homepage: the first note of each course, then the second of each, and so on.
  eleventyConfig.addFilter("firstNotes", (notes, count) => {
    const courses = courseNames(notes).map((c) => notes.filter((n) => n.data.course === c));
    const out = [];
    for (let i = 0; out.length < count && courses.some((c) => i < c.length); i++)
      for (const c of courses) if (i < c.length && out.length < count) out.push(c[i]);
    return out;
  });
  // Where the note at `url` sits in its course: its number, how many notes the course has, and the notes before and after it.
  eleventyConfig.addFilter("noteSequence", (notes, url) => {
    const note = notes.find((n) => n.url === url);
    if (!note) return null;
    const course = notes.filter((n) => n.data.course === note.data.course);
    const i = course.indexOf(note);
    return { number: i + 1, total: course.length, prev: course[i - 1] ?? null, next: course[i + 1] ?? null };
  });

  // The URL of the same page in the other language (/es/notes/… for /notes/…, and back), or null when it has none.
  eleventyConfig.addFilter("otherLanguage", (url, all) => {
    if (!url) return null;
    const other = url.startsWith("/es/") ? url.slice(3) : `/es${url}`;
    return all.some((p) => p.url === other) ? other : null;
  });

  // Marks the site owner inside author lists.
  eleventyConfig.addFilter("isMe", (author) => String(author).includes("De Ferrari"));

  // Publications of one type, newest first.
  eleventyConfig.addFilter("byType", (pubs, type) =>
    pubs.filter((p) => p.type === type).sort((a, b) => b.year - a.year)
  );

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "html", "md"],
  };
}
