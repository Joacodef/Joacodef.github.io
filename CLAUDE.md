# joaquindeferrari.com

Personal academic website of Joaquín De Ferrari, PhD student in Computer Science at UC Chile.
Built with Eleventy 3. Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.
Custom domain `joaquindeferrari.com`: DNS lives on Cloudflare as DNS-only records (never proxied), and the domain is set in the repo's Settings → Pages, so no `CNAME` file is needed.

## Commands

- `npm install`, then `npm start` for a live-reload server at http://localhost:8080
- `npm run build` writes the site to `_site/`. Run it before every commit and fix any error it reports.
- Check changes at desktop width and at 390px wide, in both light and dark mode, and for notes in both languages.

## Where content lives

- Tagline, "Currently" line, links, menu: `src/_data/site.json`
- Publications: `src/_data/publications.json` (`"selected": true` puts one on the homepage)
- Research lines: `src/_data/research.json`
- Notes: `src/notes/<course>/`, and their Spanish versions in `src/es/notes/<course>/`. The note layout's text in each language: `src/_data/i18n.json`.
- Prefer editing these JSON files over templates when the change is about content.

## Content rules

- The site is in English. The exception is the study notes: every note also has a Spanish version under `/es/notes/`, linked from the top of the page (see `.claude/rules/notes.md`). The rest of the site, including the header and footer, stays English-only.
- Never publish Joaquín's phone number. Public contact is the institutional email, GitHub, ORCID and LinkedIn.
- Publication and research facts must match his CV exactly. Never invent venues, metrics, rankings or claims. Mark equal contribution with `*` and keep every DOI.
- Positioning: the tagline describes a broad identity (machine learning for medical imaging and clinical language, learning from imperfect supervision). The specific current project belongs only in the "Currently" line.
- Notes keep the AI-assistance and "may contain errors" notice from `src/_includes/note.njk`.
- Credit course sources through the `source` field of each course folder's JSON file.

## Design system: "notebook"

- Fonts: Newsreader for headings, formulas and ledes; Public Sans for body text and UI; JetBrains Mono only for code.
- Colors come only from the tokens in `src/assets/css/site.css` (`--paper`, `--paper-2`, `--card`, `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--blue`, `--red`, `--ok`, and `--img-lo`/`--img-hi` for gray values in figures). Never hardcode hex values in components. Any new token needs both a light and a dark value.
- Semantic ink, one fixed color per concept across the whole site:
  - Blue ink: lines, links, anatomy.
  - Carmine (`--red`): points, findings, segmentation masks, "what we look for".
- Draw only what explains something. No decorative illustrations.
- Diagrams must be geometrically and anatomically correct. Medical images follow radiological convention (the patient's right appears on the viewer's left).
- Avoid: gradients, drop shadows, all-caps labels, small labels stacked above headings, emoji, arrows appended to links or buttons, animation that does not respond to the user.
- Accessibility: visible focus, keyboard support for anything draggable (arrow keys), `aria-label` on interactive SVG, and `prefers-reduced-motion` respected.

## Writing style

- Plain, specific, active voice. Name things by what the reader understands, not by how they are built.
- Sentence case for headings, buttons and labels.
- Explain the "why" behind formulas, not only the formulas.

## Dependencies

- three.js is installed from npm (pinned in `package.json`) and bundled by esbuild in the `eleventy.after` hook of `eleventy.config.js`. Do not load three.js from a CDN.
- Keep JavaScript as plain ES modules. No framework.
