import * as esbuild from "esbuild";

export default function (eleventyConfig) {
  // Static assets (CSS, JS, images, CV) are copied as-is.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/apple-touch-icon.png": "apple-touch-icon.png" });

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
