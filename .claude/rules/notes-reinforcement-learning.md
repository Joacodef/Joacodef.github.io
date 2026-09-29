---
paths:
  - "src/notes/reinforcement-learning/**"
  - "src/es/notes/reinforcement-learning/**"
  - "src/assets/js/notes/reinforcement-learning/**"
---

# Reinforcement Learning notes

What holds only for the notes of Prof. Rodrigo Toro's Reinforcement Learning course (IIC3675) at UC Chile, on top of `notes.md`.

## Sources

- The course README, `course-materials/reinforcement-learning/README.md`, has the syllabus and note status (with the sections still missing a figure), the notation and glossary tables, and how to read the PDFs.
- The course follows Sutton and Barto, *Reinforcement Learning: An Introduction* (2nd ed., 2020), and its readings are the book's chapters. They are saved in `course-materials/reinforcement-learning/`, grouped by exam rather than by chapter. The book is the reference for theory and formula notation. Its PDFs lose Greek letters and formulas in `pdftotext`, so render the pages with formulas to read them (the course README says how).
- The first exam's study guide and the class slides (in Spanish) give the sections each exam covers and the course's Spanish terms. When the slides cover more of a chapter than its PDF, as class 11 does for chapter 12 (up to tabular Sarsa(λ)), the note follows the slides' scope with the book's formulas.
- Never reuse the book's examples or the study guide's exercises: not the cliff, the windy gridworld, the random walk, driving home, blackjack, Jack's car rental, the gambler, tic-tac-toe, the maximization bias MDP with states A and B, or the 10-armed testbed, and not the exercises of the study guide (the sushi cart, the cave) or of the slides. Design each note's own worlds and numbers, and compute every number the page quotes with a script.
- Exception, decided by Joaquín on 29 Sep 2026: the interactive figures use the professor's 3 × 3 cookie grid and the cliff, the worlds he uses across several classes, so the figures look like what the class shows. The notes' text keeps its own examples.

## Interactive figures

- A figure is a guided run that the reader steps through like slides, with Next and Back; the cliff figure in the Q-learning note (`q-learning.js`) sets the pattern, and each new figure still starts with a mockup. The first moves come one part at a time, each a sentence with its calculation: the move at time t, then the target and the update at t + 1, with t shown next to the episode and move. After that, Next skips to the moments where something new is learned, such as the first fall, the end of the first episode, the first greedy path to the goal and the shortest path. It plays the skipped moves quickly and says how many it skipped. On any slide, pressing a cell shows its values, and the last slide adds Reset.
- The grid marks each cell's best move with a blue arrow, and the path the best moves take with a dashed blue line. The cell whose values a target uses is outlined in carmine; everything else, the agent and a fall included, is ink.
- The controls sit right under the grid, with Back and Next first, so that they never move as the text grows: readers press Next quickly. New text appears only below the old, which dims.
- Sounds made in the browser (a click for a move, a duller one for a wall, a falling tone for a fall, a chime at the end) play only after Next or the right arrow key, and a button turns them off.
- Figures must stay light on any reader's device. The run behind a figure is small and computed once, from a fixed seed, so every reader sees the same run: the cliff's 30 episodes are 789 moves and take a few milliseconds when the page loads. Animations play only after a press, last at most about two seconds and stop by themselves; with reduced motion they are replaced by an immediate change. Nothing runs in the background.

## Temporary exception: notes without interactive figures

- From 29 Sep 2026, while the course runs, a note of this course may ship with no interactive figures, or with figures in only some of its sections, although `notes.md` asks for one in every numbered section. Static diagrams (inline SVG in a `figure.diagram`) and tables stand in for them.
- Every section still missing its figure is listed in the course README's note status. Figures are added later, one note at a time, starting where a figure helps most, each after its mockup is approved.

## Notation

- The book's symbols, as the course README's notation table lists them: `S_t`, `A_t`, `R_{t+1}`, `G_t`, `γ`, `π`, `b`, `v_π`, `q_π`, `q_*`, `V`, `Q`, `α`, `ε`, `G_{t:t+n}`, `ρ_{t:h}`, `V̄`, and for chapter 12 `λ`, `G_t^λ` and `z_t`.
- In HTML, write time indices as subscripts with italic letters (`<i>S</i><sub><i>t</i>+1</sub>`), the optimal values as `<i>q</i><sub>*</sub>`, the update arrow as `←`, and a maximum as `max<sub><i>a</i></sub>`. Write state and action names upright: `<i>Q</i>(start, bridge)`. Stack a superscript over a subscript with `.ss` (`<i>G</i><span class="ss"><span>λ</span><span><i>t</i></span></span>` for G_t^λ), the limits of a sum or product with `.lims`, an expected value's bar with `.ovl` (V̄), and the book's bold vectors with `<b class="vec">w</b>`. The eligibility trace is z, as in the book's 2nd edition; the notes mention that it is also written e, as in the slides.
- In code snippets, name variables after the symbols: `q`, `q1`, `q2`, `alpha`, `gamma`, `eps`, `pi`, `g` (a return or a target), `rho`, `z`, `lam` (λ; `lambda` is a Python keyword), `s_next`, `a_next`.
- Spanish terms come from the study guide and the slides, which keep many terms in English: greedy, ε-greedy, bandit, Sarsa, Q-values, value iteration, first-visit, every-visit, baseline, n-step TD, n-step Sarsa, 4-step Sarsa, TD error, eligibility traces, λ-return. The Spanish notes keep those in English too, as well as Q-learning, Expected Sarsa, Double Q-learning, on-policy, off-policy, bootstrapping, afterstates, forward view and backward view (glossed as vista hacia adelante and hacia atrás). The rest follows the glossary in the course README: retorno, retorno de n pasos, recompensa, política, política de comportamiento, política objetivo, objetivo (of an update), estado terminal, episodio, tamaño de paso α, descuento γ, sesgo de maximización, razón de muestreo por importancia.

## Ink

- Blue ink (`.ln`, `.ln-path`): routes, the paths an agent takes through a world, and the transitions they are made of.
- Carmine (`.pt`, `.pt-dot`): the target of an update, the value an estimate moves toward, and the TD error that carries it back. In formulas, the target is wrapped in `.pt`; in backup diagrams, the nodes the target is built from are carmine; in timelines, the estimate a target bootstraps from.
- Everything else, including states, the pair being updated and the edges of backup diagrams, is drawn in ink.
- Backup diagrams follow the book: an open circle is a state, a small filled dot an action, and an arc across branches a maximum. The pair being updated is at the top.

## The notes' own examples

- **Monte Carlo and TD: the wandering home.** Kitchen, hallway, study and charger (terminal), γ = 1, −1 per move. The robot's random policy: kitchen → hallway always; hallway → study or kitchen, ½ each; study → charger or hallway, ½ each. Its values are −9, −8 and −5; q_π(study, charger) = −1, q_π(study, hallway) = −9, q_π(hallway, study) = −6, q_π(hallway, kitchen) = −10. Two trips, kitchen-hallway-study and kitchen-hallway-kitchen-hallway-study-hallway-study, give first-visit estimates −5, −4, −2 and every-visit −5, −3.5, −1.67; after 10,000 simulated trips both are within 0.1 of the true values. The greedy policy is optimal (−3, −2, −1); ε-greedy around it with ε = 0.2 has values −3.47, −2.47, −1.25; in the study, Σπ′q_π = 0.9(−1) + 0.1(−9) = −1.8 ≥ −5. TD(0) with α = 0.5 from −5, −4, −2 on the trip kitchen-hallway-kitchen-hallway-study-charger: TD errors 0, −2, −1, 2, 1, table −5.5, −4, −1.5 (constant-α Monte Carlo: −4, −3, −1.5); with the table fixed the TD errors are 0, −2, 0, 1, 1 and add up to G_0 − V(kitchen) = 0. Batch example: hallway −1 → study once (charger taken, 0), study +1 three times and 0 once: V(study) = 0.6 for both, V(hallway) = −1 for batch Monte Carlo and −0.4 for batch TD(0). Sarsa escaping the shuttle: Q(hallway, kitchen) = 0.5(−1 + 0 − 0) = −0.5.
- **Q-learning: the garden.** A robot crosses a garden to its charger. From the start, the action *bridge* crosses a pond on a narrow bridge (2 steps) and *around* takes the long way (3 steps, one action per state after the first). On the bridge, *ahead* reaches the charger and *side* drops the robot into the pond, which gives −20 and ends the episode. Every other step gives −1, and γ = 1. So q_*(bridge, ahead) = −1, q_*(bridge, side) = −20, q_*(start, bridge) = −2 and q_*(start, around) = −3. With ε-greedy behavior at ε = 0.2 (probability 0.9 for the greedy action of two), Sarsa converges to q_π(start, bridge) = −3.9 and goes around, and the average return per episode is −3.81 for Q-learning's agent and −3.09 for Sarsa's. Sarsa takes the bridge for ε < 2/19 ≈ 0.105.
- **The one-step example:** Q(start, bridge) = −2.5, Q(bridge, ahead) = −1, Q(bridge, side) = −10, α = 0.5, ε = 0.2. Targets: Q-learning −2, Sarsa −2 or −11, Expected Sarsa −2.9; Q-learning's new value is −2.25.
- **Maximization bias:** six actions worth 0, each paying +1 or −1 with equal chance and estimated from three payments. The largest estimate is 1 with probability 0.551, 1/3 with 0.433, and averages 0.690. The page's draw: 1/3, −1/3, 1, −1/3, 1/3, −1, with Q₂ of the chosen action −1/3.
- **Afterstates:** two-pile Nim, where whoever takes the last stick wins. Piles (3, 2) and (2, 3) with different moves both leave (2, 2).
- **n-step bootstrapping and eligibility traces: the hallway.** A robot goes home from the kitchen through the hallway and the study to its charger (terminal): rewards 0, 0, +10, γ = 0.9, true values 8.1, 9, 10, and a poor table 2, 4, 6. From the kitchen: G_{0:1} = 3.6, G_{0:2} = 4.86, G_{0:3} = G_0 = 8.1. n-step TD with n = 2, α = 0.5 gives 3.43, 6.5, 8 (one-step TD: 2.8, 4.7, 8). TD errors with the table fixed: 1.6, 1.4, 4. λ-return with λ = 0.5: 5.04, 7.2, 10 (λ = 0.8: 6.68 from the kitchen); the off-line λ-return algorithm and Sarsa(λ) with λ = 0.5, α = 0.5 both give 3.52, 5.6, 8, because no TD error of this episode uses an already updated value.
- **The room.** A 5 × 4 room, a first episode of nine moves (cells (0,3), (1,3), (1,2), (0,2), (0,1), (1,1), (2,1), (2,0), (3,0), (4,0), row 0 at the top), reward +1 only on reaching the charger, all values 0, γ = 1, α = 0.5. One-step Sarsa raises the last move to 0.5, 4-step Sarsa the last four, and Sarsa(λ) with λ = 0.9 every move, to 0.5 · 0.9^k for the move k steps before the end (0.5 down to 0.22).
- The scripts that check these numbers are not in the repository; recompute them after any change.
