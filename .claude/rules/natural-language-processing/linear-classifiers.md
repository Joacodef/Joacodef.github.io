---
paths:
  - "src/notes/natural-language-processing/linear-classifiers.html"
  - "src/es/notes/natural-language-processing/linear-classifiers.html"
  - "src/assets/js/notes/natural-language-processing/linear-classifiers.js"
  - "src/assets/js/notes/natural-language-processing/linear-classifiers-data.js"
---

# Note 4, linear classifiers: its figures and numbers

## Figures

- Its class colors are in `notes-natural-language-processing.md`. No mark in one speaker's color sits beside a word that names or pushes toward the other: the opening and the plane of section 2 use the forms of address, worship and thou (merced and tú), not sancho, which Don Quixote is the one to say, and a sentence before figure 1 explains why sancho pushes toward Don Quixote.
- Few, uniform controls (Joaquín found a plane with a dot to drag, an arrow to turn and piles to click too complex): figure 2 is two rows of mode buttons, the direction of w (three presets) and the bias (three values), with a readout of the score's formula and one tally; gradient descent steps with Back and Next, as the reinforcement learning figures do, its learning rate on mode buttons.
- The planes' key to the speakers' colors sits beside the y axis's name. A value read off a function is a dot in the color of what it names (the step's decision in the speaker's, the loss in the color of whoever spoke); a handle that sets Sancho's probability stays carmine, on its own axis.
- Its classes in `notes.css` start with `lc-`; its data module, both books, is 7 KB.

## Numbers

- **Who is speaking, Don Quixote or Sancho?** The speeches the book attributes to one of them, 1,232 in Ormsby's translation (Sancho 608, Don Quixote 624) and 1,089 in the original (544, 545), as bags of words tokenized as in note 1. Every fifth chapter in reading order (5, 10, …) is held out: 886 English speeches to train and 346 to test, 800 and 289 Spanish. Logistic regression by gradient descent (6,000 steps, η = 0.05, L2 10⁻³), its weights rounded to two decimals, as the page shows them: 2,541 and 2,544 words plus the bias; 286 of the 346 held-out speeches right (82.7%), 221 of 289 (76.5%).
- Figure 1's six held-out speeches, the same lines in both books (`note4/lc-hand.json`): Sancho's "Sinner that I am!" (I.X), Don Quixote's "It makes it worse to stir it, friend Sancho" (I.XX), Sancho's "I don't believe my master lies" (II.XXIII), Don Quixote's "Why dost thou say that, Sancho?" (I.XXX), Sancho's "May God hear and sin be deaf" (II.LVIII), and Sancho's line about the cabbages and the baskets (II.III), which the model gives to Don Quixote.
- The plane: worship and thou, weights 1.75 and −1.59 (merced and tú, 0.97 and −1.07); the best line leaves 820 of the 1,232 speeches on their speaker's side (686 of 1,089). Figure 5 descends from w = 0 with η = 0.5, 5 and 16 for thirty steps: the lowest loss is 0.538 (0.615); η = 5 comes within 0.01 of it at step 7 (13); η = 16 jumps past it back and forth, its loss up to 1.281 (1.923).
- Section 6's third voice is the narrator's sentences without dialogue marks, as many as Don Quixote's speeches (624 and 545): 338 of the 445 held-out lines right (76.0%), 289 of 381 (75.9%). Figure 6's lines: the narrator's "When Don Quixote perceived what it was" (I.XX), Don Quixote's "What wouldst thou, brother Sancho?" (I.XV), Sancho's "Sinner that I am!" (I.X) and Don Quixote's "Then you knew her?" (I.XX), which the model gives to the narrator.
- Computed by `note4/speeches.mjs` (the speeches and the narrator's sentences), `note4/lc-data.mjs` (the models and the data module) and `note4/lc-facts.mjs` and `note4/check-claims-5.mjs` (the numbers the text quotes), in the scratchpad of session `a9b07105-3845-4107-8a8b-b935b89b4dcf`.
