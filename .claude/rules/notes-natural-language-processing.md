---
paths:
  - "src/notes/natural-language-processing/**"
  - "src/es/notes/natural-language-processing/**"
  - "src/assets/js/notes/natural-language-processing/**"
---

# Natural Language Processing notes

What holds only for the notes of Prof. Marcelo Mendoza's Natural Language Processing course (IIC3670) at UC Chile (github.com/marcelomendoza/IIC3670), on top of `notes.md`. Each note's examples, the facts its scripts give and its figures' specifics are in its file in `natural-language-processing/`, which loads with its files.

## Sources

- The course README, `course-materials/natural-language-processing/README.md`, has the course's facts, the syllabus and note status, the notation's clashes and the glossary; its reference files hold a map of every deck slide by slide, the notation by unit, what each notebook and in-class activity shows, the slips found in the slides, and the slides' own examples, which the notes don't reuse.
- The slides, one deck per class in Spanish, are the reference for theory and formula notation; the course has no textbook. Each slide cites its sources, mostly the original papers and Jurafsky and Martin's *Speech and Language Processing*. Where a slide simplifies or slips, follow the cited original on what is true, keep the slides' notation, and point out the difference to Joaquín rather than resolving it silently.
- The notebooks and in-class activities show what the class computes. Their data, numbers and code are not reproduced.

## The course's notes

- One note per topic, in the slides' order (decided with Joaquín), so a topic split across classes is one note; the README's status table lists the notes planned through class 9, with the slides each covers.
- A note's `module` is its course unit, with the same name in every note of the unit: Laws of text, resources and NLP tasks (Leyes del texto, recursos y tareas de NLP); Text encoders (Encoders de texto); Text decoders (Decoders de texto); LLMs, SFT and alignment (LLMs, SFT y alineamiento); Advanced topics (Temas avanzados). No slide marks where unit 4 begins; the notes start it with the decoder that answers after a prefix and instruction tuning (class 8, slides 19 to 23).

## Examples and data

- The notes use their own examples, as `notes.md` asks (decided with Joaquín); unlike the Reinforcement Learning notes, they make no exception for the professor's examples. Sentences, corpora, vocabularies, model outputs and the data behind every figure are chosen to make each idea clear.
- Examples are in the page's language: an English sentence on the English page, a Spanish one on the Spanish page, each built to show the same thing. A figure's script holds both and picks with `tr`. Each version's numbers come from its own example, so the two pages may quote different numbers; compute both with the same script.
- Statistics of real language (word frequencies, vocabulary growth, merges, out-of-vocabulary rates) come from public-domain or openly licensed text chosen for the note, one per language, named on the page. A small corpus that a figure recomputes live is written for the note.
- Model outputs (masked-word predictions, next-token distributions, attention weights, rewards) come either from an open model run by our script on our own sentences, with the model named on the page, or from a distribution designed for the figure, which the page presents as an example and never attributes to a model.
- Never reproduce the slides' examples or data, which the README's reference list gives by class: not the Reuters counts and fits, the Shakespeare term-document matrix, the CoNLL-2002 or cess_esp numbers, the slides' sentences (the Neruda sentence, the green witch, "So long and thanks for all the", "The students opened their", "España venció a Argentina", "mermelada de damasco", "el banco de la plaza"), the measurements with bert-base-uncased, Mistral-7B, Qwen or Opus-MT, or the GSM8K problems; nor the notebooks' data and results or the activities' tasks.
- Benchmarks, data sets and published models (GLUE, SQuAD, STS-B, The Pile, FLAN, BERT's sizes) may be named where the theory needs them, as facts of the field checked against their original papers, not taken from the slides. The slides' tables of results are not reproduced.
- Compute every number a page or a figure quotes with a script, and record each note's examples and the facts its scripts give in its file in `natural-language-processing/`.
- Lexical resources a note uses (lemma lists, stemmers, WordNet, a wordnet in another language) are named with their licenses in one line after the summary, linked to their sources, as note 2 does. Their data is embedded small, never the whole resource.
- The notes on *Don Quijote* count Cervantes's original (Project Gutenberg #2000) on the Spanish page and John Ormsby's 1885 translation (#996) on the English page, both from chapter I of part I to the novel's last word, lowercase, in runs of letters, accented ones included (a to z and the lowercase letters of Latin-1, so señor, doña and fïel are one word each), English keeping inner apostrophes (don't), without the HTML edition's image captions. (An English tokenizer that knew only a to z once split señor into "se" and "or", and the counts were redone.)

## Links with the Reinforcement Learning notes

- Decided with Joaquín: the NLP notes are self-contained and link to the Reinforcement Learning notes for theory. The notes on reward models, RLHF and PPO and on DPO and GRPO (23 and 24 in the README's table) explain in LLM terms only what they need, so that a reader who never took RL can follow: a response's tokens are actions, a single reward comes at the end, the baseline b and the advantage A. They link to the RL notes for the general theory: the approximation note (`/notes/reinforcement-learning/prediction-with-approximation/`) for a value function fitted to returns by regression (PPO's value model is gradient Monte Carlo with the reward as the return), and the RL course's note on policy gradient methods (chapter 13 of its readings, not yet written) for REINFORCE with a baseline and actor-critic. That note links back to them as its main application.
- Each course keeps its notation. Clashes to name where a note links across: β is the KL penalty's weight here and the step size of R̄ in RL; b is the baseline here (as in Sutton and Barto's chapter 13) and the behavior policy b(a | s) in the RL notes so far; the value model is V_ψ(x, y_{<t}) here and v̂(s, w) there; α has several meanings here (see the README's clashes) and is the step size there.
- A Spanish page links to the Spanish notes (`/es/notes/reinforcement-learning/…`).

## Notation

- The slides' symbols, as the README's notation tables list them. The slides reuse letters across units (α, β, V, P, h, k, s, b): a note defines each symbol where it first uses it and gives it one meaning on that page.
- Vectors are italic lowercase letters and matrices italic capitals, never bold, as on the slides (`<i>v</i><sub><i>o</i></sub>`, `<i>W</i><sub>in</sub>`, `<i>W</i><sup>Q</sup>`): an index in a subscript is italic, a name upright. The slides' red and green highlights are emphasis, not notation. The loss is a script ℒ (`&#8466;`); L is the number of layers, and GPT-1's losses are L₁, L₂ and L₃, as on the slides.
- In code snippets, name variables after the symbols: `w_in`, `w_out`, `v_o`, `u_c`, `q`, `k`, `v`, `d_k`, `alpha`, `delta`, `tau`, `beta`.
- Spanish terms come from the slides, as the README's glossary lists them with the terms the notes settled; the terms the slides keep in English stay in English on the Spanish pages too.

## Figures

- Each figure starts with a plan and a mockup that Joaquín approves. What the approved notes settled holds for the later ones:
- Ink (note 1): what is counted in a text (a book's word counts, its vocabulary as it grows) is carmine, and a law or line fitted to it blue (`.ln-path`), as the note's legend says. The other language's text, drawn for comparison, is faint ink, named by a label on the side away from the page's own curve. The point the reader holds is a carmine handle (`makeHandle(svg, "point")`), a second point the figure derives from it a hollow carmine ring, and the grips of a line the reader moves blue (`"grip"`). Dashed ink guides drop from a held point to the axes. The misses of a fit are thin translucent carmine strokes from each point to the line. In a bar split by kind, the kind the section is about is full carmine, the next a paler carmine and the rest faint ink, so the strong color stays on what to look at.
- Charts: labels on the drawing carry a halo of the card's color. Charts name their axes outside the frame, the y axis's above it at the left and the x axis's under its numbers at the right, where neither the data nor a moving line can cross them (note 4: a sweep of every state found the line through names placed inside). Log–log axes are `logChart` in `plane.js`, moved there from note 1 for note 5's chart of the negatives, with a range and tick labels per axis; the labels of a plane of vectors stepped through with Back and Next are placed by `stepLabels` in `plane.js`, moved there from note 5's figure 4 for note 6's figure 2; note 1's `linChart` still lives in `laws-of-text.js` and moves the same way when a later note needs it, with snapshots of every figure first.
- Words in figures are quoted in the page's language (“the”, «que»). Where a figure stands for many words at once, it names one and says how many share its place ("“local”, one of 5,478").
- A readout's sentence may change with the stretch of the data the reader is on (the laws of text's figure 1 has three: the first word, the middle of the list, the tail).
- Logarithms in the fits are in base 10, like the axes; α and β do not depend on the base, and the text says so where it fits a line.
- Figures whose content is words (note 2: forms, groups of words, tagged sentences, synsets, senses) are HTML, not SVG, so they wrap to the screen: a panel on the card color (note 2's `.wd-panel`) in the drawing's place, the words in the serif and labels and counts in Public Sans; the item picked is outlined in ink, like a pressed mode button. Carmine marks what is counted or looked for: a form's ending (the lexeme in ink), a word in only one of two groups (outlined), a named entity (underlined across its words, its kind in small carmine after them), counts as bars. Blue marks relations: the lines between synsets, a synset's chain up to the root, the rule over each origin of a word's senses. The other book's data is faint, as in note 1.
- Parts of speech are Universal Dependencies' codes (PROPN, NOUN), as the class writes them, small in ink-3 above each word.
- Chapters (note 3): figures, readouts and the opening's pictures label chapters by part and number, I.VIII, II.XVII (Capítulo I.VIII on the Spanish page), with the chapter's title under the label (the translation's titles, printed in capitals, set in sentence case, keeping the capitals of the names the book capitalizes); the text says "chapter XVII of part II".
- Class colors (note 4): Sancho, y = 1, carmine; Don Quixote, y = 0, ink; the narrator, a third voice, green (`--ok`; Joaquín chose a color over an outline). Lines, w and every function drawn are blue.
- Class colors (note 5): a target word carmine; the context words it was seen with green (`--ok`); words drawn as negatives ink; lines and curves blue. The key of an n-gram that only one order has names no speaker ("not in the other order"), since carmine is Sancho's color in note 4.
- Note 6: carmine is what is asked about or looked for (the word picked, the targets, the odd one out, an analogy's answer, the first of two texts), blue the vectors compared and the scores (cosines and lengths as bars, arcs); note 5's green and ink keep their meaning for context and drawn words.
- Each note's classes in `notes.css` start with a prefix of its own: `lt-`, `wd-`, `vs-`, `lc-`, `w2v-`, `wv-`.
- Figures stay light on any reader's device. Data a figure needs (word counts, vectors, a model's distributions) is computed offline by our scripts and embedded small (notes 1 to 6's data modules are 7 to 43 KB, both books together); what a figure recomputes live (a tf-idf table, BPE's merges, a softmax) runs on a few hundred words at most.
