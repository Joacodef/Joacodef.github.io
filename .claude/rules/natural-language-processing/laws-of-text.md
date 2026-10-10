---
paths:
  - "src/notes/natural-language-processing/laws-of-text.html"
  - "src/es/notes/natural-language-processing/laws-of-text.html"
  - "src/assets/js/notes/natural-language-processing/laws-of-text.js"
  - "src/assets/js/notes/natural-language-processing/laws-of-text-data.js"
---

# Note 1, the laws of text: its figures and numbers

- Its charts: `logAxes` (plane.js's `logChart` from 0.6 on both axes, so that a count of 1 sits above the axis line, labeled at the powers of ten, plus the axes' names) and `linChart` (linear axes, the y axis's name raised above its top label). Its classes in `notes.css` start with `lt-`; its data module, both books, is 43 KB.
- **The books' counts** (*Don Quijote*, tokenized as `notes-natural-language-processing.md` says). English: 404,923 tokens, 14,921 different words, 5,473 seen once (36.7%); top words the 20,747, and 16,917, to 13,261; the ten most frequent are 25.1% of the tokens. Spanish: 376,597 tokens, 22,605 words, 11,003 seen once (48.7%); que 20,416, y 17,987, de 17,953; ten words 28.7%.
- Rank × frequency, ranks 3 to 1,000: median 41,124 (English) and 38,423 (Spanish); from rank 2 until it drops below 30,000 (the tail), every product lies between half and twice 40,000 (33,834 to 75,850 in English, the highest 75,850 at "which", rank 41; 34,965 to 56,553 in Spanish); rank 1 gives about half (20,747; 20,416). The product first drops below 30,000 at rank 2,662 (English) and 2,123 (Spanish). Figure 1 starts at rank 10 (“it” 5,282; «se» 4646).
- Least squares on (log₁₀ r, log₁₀ f_r), ranks 1 to 1,000: English α̂ = 1.111, Ĉ = 81,653, least sum of squared errors 1.290 (4.192 for α = 1 and C = 40,000, figure 2's start); Spanish α̂ = 1.046, Ĉ = 50,973, 0.362 (0.914). The line gives 38 at rank 1,000 (“required” 37; Spanish 37 against «ausencia» 35). Figure 2's grips sit at ranks 10 and 1,000, since the best line passes 81,653 at rank 1, above the chart. With α = 1, C = n/H_V(1): ln V + γ = 10.19 and C ≈ 39,700 (English), 10.60 and 35,500 (Spanish).
- Heaps by least squares on (log₁₀ n, log₁₀ V), every 1,000 tokens: English β = 0.521, k = 18.48, 2^β = 1.435; Spanish β = 0.619, k = 8.12, 2^β = 1.536. V(2n)/V(n) from 10,000 tokens on: 1.34 to 1.57 (English), 1.44 to 1.65 (Spanish); at n = 100,000: 10,630/7,672 ≈ 1.39 and 15,484/10,308 ≈ 1.50. With β fixed at 0.5 the best k is 23.69 (English) and 33.38 (Spanish).
- Words seen once, of those met: English 77% after 1,000 tokens, 46% after 100,000 (3,498 of 7,672), 37% at the end; Spanish 75%, 55%, 49%. New words in the 10,000 tokens before token 100,000: 315 and 552; in the last 10,000: 155 and 296.
- Computed by `nlp/laws.mjs` (the counts), `nlp/fig-data.mjs` (the data module and the opening pictures), `nlp/facts234.mjs`, `nlp/rf.mjs`, `nlp/spread.mjs` and `nlp/rate.mjs` in the scratchpad of the session `d233705d-e3b6-468a-9327-4afb1b365bc6`, from the texts in its `dl/gutenberg/`. Recompute them after any change.
