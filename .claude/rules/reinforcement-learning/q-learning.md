---
paths:
  - "src/notes/reinforcement-learning/q-learning.html"
  - "src/es/notes/reinforcement-learning/q-learning.html"
  - "src/assets/js/notes/reinforcement-learning/q-learning.js"
---

# The Q-learning note: its examples, run and numbers

- **The cliff (text and figure).** The 4 × 6 cliff of the figures, γ = 1. q* counts moves: v*(A1) = −7, q*(A2, right) = −6, q*(A2, up) = −8, q*(B2, ·) = up −7, right −5, down −107, left −7, so q*(A2, right) = −1 + max(−7, −5, −107, −7) = −6. Section 2's update: Q(A2, right) = −8, B2 at up −7, right −5, down −60, left −7, α = 0.5: target −6, new value −7. With ε = 0.1 (greedy move 0.925, each other 0.025), Sarsa converges to the best ε-greedy policy, which takes the route one row up (A1 A2 A3 … F3 F2 F1, 9 moves), with q_π(A2, right) = −12.01 and q_π(A2, up) = −9.39; Q-learning keeps the edge (7 moves, −7 per trip once exploring stops). Expected return per episode while exploring: −21.77 for Q-learning's behavior, −13.36 for Sarsa's. Sarsa keeps to the edge for ε below ≈ 0.0197 and moves to the top row from ε ≈ 0.26.
- **The figure:** Q-learning with α = 0.5, ε = 0.1, seed 499916, 30 episodes, 808 moves. Episode 1, played move by move: 12 moves with no random move, A1 down and left into the wall, up to A2 and back down, the first fall at move 5 (right from A1, Q(A1, right) 0 → −50), then up, chosen after the update that left right at −50 (where Sarsa fell a second time), and along row 2 to the goal. Every move is tried after 201 moves, in episode 2; the best moves first reach the goal in episode 12 (9 moves) and settle on the edge at move 735, in episode 23, for good. "Exploration still costs" is move 771, episode 26: the agent steps right from A2 to B2, whose update targets −1 + max(B2) = −1 + (−4.97) with right in red, then chooses down in B2 at random (worth −77.62, which Sarsa's target would have used) and falls: Q(B2, down) −77.62 → −92.25. 10 falls, 1 after the edge is learned; at the end the values along the edge are −6.98, −5.99, −5, −4, −3, −2, −1.
- **Section 4's targets** for the step A2 → B2 with B2 at q*: Q-learning −6; Sarsa −6 (0.925), −8 (0.05) or −108 (0.025); Expected Sarsa −8.65; from Q(A2, right) = −6 with α = 0.5 the new values are −6; −6, −7 or −57; and ≈ −7.33.
- **Maximization bias:** six actions worth 0, each paying +1 or −1 with equal chance and estimated from three payments. The largest estimate is 1 with probability 0.551, 1/3 with 0.433, and averages 0.690. The page's draw: 1/3, −1/3, 1, −1/3, 1/3, −1, with Q₂ of the chosen action −1/3.
- **Afterstates:** two-pile Nim, where whoever takes the last stick wins. Piles (3, 2) and (2, 3) with different moves both leave (2, 2).
