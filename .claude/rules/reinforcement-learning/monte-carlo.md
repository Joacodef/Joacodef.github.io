---
paths:
  - "src/notes/reinforcement-learning/monte-carlo.html"
  - "src/es/notes/reinforcement-learning/monte-carlo.html"
  - "src/assets/js/notes/reinforcement-learning/monte-carlo.js"
---

# The Monte Carlo note: its runs and numbers

Its text's example, the wandering home, is in `wandering-home.md`.

- **Section 1: the prediction figure.** First-visit Monte Carlo prediction for the random policy (each move ¼), every V at 0, seed 15395 (the TD(0) figure's, so the two learn from the same episodes), 30 episodes, 702 moves. Episode 1: 5 moves, A1 up, A2 left into the wall, A2 right, B2 right, C2 up; its sweep gives C2 1, B2 0.9, skips A2's 0.81 at t = 2 and gives A2 0.73 from its first visit, and A1 0.66. Episode 2: 7 moves, A1 right, B1 up, B2 right, C2 down, C1 down into the wall, C1 up, C2 up; its sweep skips C2 at t = 6 and C1 at t = 5, gives C1 0.81, and gives C2 its second return, 0.73, for an average of (1 + 0.73)/2 ≈ 0.86. Episode 3 takes 41 moves: A1's return is about 0.015, and its average falls from 0.59 to 0.40. After 30 episodes the averages are 0.37 0.55 · / 0.34 0.45 0.62 / 0.27 0.26 0.44, all above v_π and at most 0.13 from it, in C1, which has the fewest returns (15; A1 has 30); they swap the order of A1 and B1. The route the estimates lead along is A1 A2 B2 C2 C3, the shortest. The TD note's batch figure replays these 30 episodes; its batch Monte Carlo counts every visit, so it ends on other averages than these first-visit ones.
- **Section 4: the control figure.** On-policy first-visit Monte Carlo control with ε = 0.1, values from 0, seed 28869, 30 episodes, 148 moves. Episode 1: 8 moves, A1 up, A2 right, B2 down, B1 right, C1 left, B1 right (random), C1 up, C2 up; its sweep gives returns 1, 0.9, (0.81 skipped: B1 right was first made at t = 3), 0.73, 0.66, 0.59, 0.53, 0.48, and the best moves then cut out the loop (in C1, up 0.9 beats left 0.73): 6 moves. Episode 2 averages Q(B1, right) to (0.66 + 0.81)/2 = 0.73. In episode 9 a random first move, right from A1, returns 0.73, above Q(A1, up) = 0.53, and the route becomes the 4-move A1 B1 C1 C2 C3 for good. At the end: 0.73, 0.79, 0.89, 1 along the route (the shortest trip's returns are 0.73, 0.81, 0.9, 1), Q(A1, up) = 0.54, and A3 and B3 never visited.
