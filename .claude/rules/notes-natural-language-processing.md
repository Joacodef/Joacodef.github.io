---
paths:
  - "src/notes/natural-language-processing/**"
  - "src/es/notes/natural-language-processing/**"
  - "src/assets/js/notes/natural-language-processing/**"
---

# Natural Language Processing notes

What holds only for the notes of Prof. Marcelo Mendoza's Natural Language Processing course (IIC3670) at UC Chile (github.com/marcelomendoza/IIC3670), on top of `notes.md`.

## Sources

- The course README, `course-materials/natural-language-processing/README.md`, has the course's facts, a map of every deck slide by slide, the syllabus and note status, the notation and its clashes, the glossary, what each notebook and in-class activity shows, the slips found in the slides, and the slides' own examples, which the notes don't reuse.
- The slides, one deck per class in Spanish, are the reference for theory and formula notation; the course has no textbook. Each slide cites its sources, mostly the original papers and Jurafsky and Martin's *Speech and Language Processing*. Where a slide simplifies or slips, follow the cited original on what is true, keep the slides' notation, and point out the difference to Joaquín rather than resolving it silently.
- The notebooks and in-class activities show what the class computes. Their data, numbers and code are not reproduced.

## The course's notes

- One note per topic, in the slides' order (decided with Joaquín on 7 Oct 2026). A topic split across classes is one note: word2vec spans classes 2 and 3, the CRF classes 3 and 4, BPE and WordPiece classes 5 and 6, BERT classes 5 and 6; class 7's first three slides join the encoder notes, and class 8's exponential smoothing joins the multilingual encoders. The README's status table lists the notes planned through class 9, with the slides each covers.
- A note's `module` is its course unit, with the same name in every note of the unit: Laws of text, resources and NLP tasks (Leyes del texto, recursos y tareas de NLP); Text encoders (Encoders de texto); Text decoders (Decoders de texto); LLMs, SFT and alignment (LLMs, SFT y alineamiento); Advanced topics (Temas avanzados). No slide marks where unit 4 begins; the notes start it with the decoder that answers after a prefix and instruction tuning (class 8, slides 19 to 23).

## Examples and data

- The notes use their own examples, as `notes.md` asks (decided with Joaquín on 7 Oct 2026); unlike the Reinforcement Learning notes, they make no exception for the professor's examples. Sentences, corpora, vocabularies, model outputs and the data behind every figure are chosen to make each idea clear.
- Examples are in the page's language: an English sentence on the English page, a Spanish one on the Spanish page, each built to show the same thing. A figure's script holds both and picks with `tr`. Each version's numbers come from its own example, so the two pages may quote different numbers; compute both with the same script.
- Statistics of real language (word frequencies, vocabulary growth, merges, out-of-vocabulary rates) come from public-domain or openly licensed text chosen for the note, one per language, named on the page. A small corpus that a figure recomputes live is written for the note.
- Model outputs (masked-word predictions, next-token distributions, attention weights, rewards) come either from an open model run by our script on our own sentences, with the model named on the page, or from a distribution designed for the figure, which the page presents as an example and never attributes to a model.
- Never reproduce the slides' examples or data, which the README lists by class: not the Reuters counts and fits, the Shakespeare term-document matrix, the CoNLL-2002 or cess_esp numbers, the slides' sentences (the Neruda sentence, the green witch, "So long and thanks for all the", "The students opened their", "España venció a Argentina", "mermelada de damasco", "el banco de la plaza"), the measurements with bert-base-uncased, Mistral-7B, Qwen or Opus-MT, or the GSM8K problems; nor the notebooks' data and results or the activities' tasks.
- Benchmarks, data sets and published models (GLUE, SQuAD, STS-B, The Pile, FLAN, BERT's sizes) may be named where the theory needs them, as facts of the field checked against their original papers, not taken from the slides. The slides' tables of results are not reproduced.
- Compute every number a page or a figure quotes with a script, and record here each note's examples and the facts its scripts give, as `notes-reinforcement-learning.md` does.

## Links with the Reinforcement Learning notes

- Decided with Joaquín on 7 Oct 2026: the NLP notes are self-contained and link to the Reinforcement Learning notes for theory. The notes on reward models, RLHF and PPO and on DPO and GRPO (23 and 24 in the README's table) explain in LLM terms only what they need, so that a reader who never took RL can follow: a response's tokens are actions, a single reward comes at the end, the baseline b and the advantage A. They link to the RL notes for the general theory: the approximation note (`/notes/reinforcement-learning/prediction-with-approximation/`) for a value function fitted to returns by regression (PPO's value model is gradient Monte Carlo with the reward as the return), and the RL course's note on policy gradient methods (chapter 13 of its readings, not yet written) for REINFORCE with a baseline and actor-critic. That note links back to them as its main application.
- Each course keeps its notation. Clashes to name where a note links across: β is the KL penalty's weight here and the step size of R̄ in RL; b is the baseline here (as in Sutton and Barto's chapter 13) and the behavior policy b(a | s) in the RL notes so far; the value model is V_ψ(x, y_{<t}) here and v̂(s, w) there; α has several meanings here (see the README's clashes) and is the step size there.
- A Spanish page links to the Spanish notes (`/es/notes/reinforcement-learning/…`).

## Notation

- The slides' symbols, as the README's notation tables list them. The slides reuse letters across units (α, β, V, P, h, k, s, b): a note defines each symbol where it first uses it and gives it one meaning on that page.
- Vectors are italic lowercase letters and matrices italic capitals, never bold, as on the slides (`<i>v</i><sub><i>o</i></sub>`, `<i>W</i><sub>in</sub>`, `<i>W</i><sup>Q</sup>`): an index in a subscript is italic, a name upright. The slides' red and green highlights are emphasis, not notation. The loss is a script ℒ (`&#8466;`); L is the number of layers, and GPT-1's losses are L₁, L₂ and L₃, as on the slides.
- In code snippets, name variables after the symbols: `w_in`, `w_out`, `v_o`, `u_c`, `q`, `k`, `v`, `d_k`, `alpha`, `delta`, `tau`, `beta`.

## Spanish version

- The course's Spanish terms come from the slides, which keep many terms in English: encoder, decoder, embedding, pooling, subwords, softmax, one-hot, stopwords, pipeline, stemming, synset, tf-idf, BM25, word2vec, fastText, OOV, CRF, HMM, Viterbi, RNN, LSTM, GRU, BPE, WordPiece, positional encoding, LayerNorm, feed-forward, masked language model, next sentence prediction, next token prediction, placeholder, zero-shot, logits, greedy decoding, beam search, top-k, top-p, cross-attention, span corruption, text infilling, post-training, continued pretraining, mid-training, replay, rejection sampling, value model, RLHF, PPO, DPO, GRPO, prompt and token. The Spanish notes keep those in English too. The rest follows the README's glossary: bolsa de palabras, regresión logística, entropía cruzada binaria, descenso de gradiente, tasa de aprendizaje, muestreo negativo, etiquetado de secuencias, matriz de transiciones, red recurrente, compuertas, atención, consulta, clave y valor, cabezal, ajuste supervisado, modelo de lenguaje, perplejidad, temperatura, corpus paralelo, ajuste con instrucciones, modelo de recompensa, política, línea base, ventaja, penalización KL, recompensas verificables, alineamiento.
- As in the other courses: numbers keep the decimal point (0.75); a number of five or more digits takes a non-breaking space in Spanish (10&nbsp;000) and a comma in English (10,000), and a four-digit number has no separator in Spanish (2000). A note is an apunte, and the reader is addressed with tú.

## Figures

- Nothing course-specific is settled yet. Each figure starts with a plan and a mockup that Joaquín approves; record here what the first notes settle, such as how text and tokens are drawn, which ink marks what (blue and carmine, as `CLAUDE.md` describes), and how distributions and matrices are shown.
- Figures stay light on any reader's device. Data a figure needs (word counts, vectors, a model's distributions) is computed offline by our scripts and embedded small; what a figure recomputes live (a tf-idf table, BPE's merges, a softmax) runs on a few hundred words at most.
