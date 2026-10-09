---
paths:
  - "src/notes/reinforcement-learning/n-step-bootstrapping.html"
  - "src/es/notes/reinforcement-learning/n-step-bootstrapping.html"
  - "src/assets/js/notes/reinforcement-learning/n-step-bootstrapping.js"
---

# The n-step bootstrapping note: its run and numbers

Its text's example, the hallway, is in `hallway.md`.

- **Section 3: the 4-step Sarsa figure.** n = 4, α = 0.5, γ = 1, ε = 0.1, seed 2606746, 30 episodes, 913 moves. Episode 1, played move by move: 18 moves, A1 left twice and down (random) into the wall, up to A2, right to B2 (moves 1 to 3 wait for rewards, move 4 makes the first update, Q(A1, left) 0 → −2), then the first fall at move 6, down from B2, which enters the target of A1 down from τ = 2 (0 → −51.5); over the next three moves the fall reaches back into A1 up, A2 right and B2 down, each to −51.5, and the agent goes on through row 3 to the goal. With a short first episode, a fall that lands in a path move's target after the path settles is very rare (1 seed in 300,000), so the figure's "A good move pays for a fall" may come before the settling: here in episode 28 (A1 up, A2 down at random, A1 right at random, and a fall), which drops A1 up from −12.16 to −63.5 while the best moves follow the top row, and leaves them without a route for a while. The best moves settle on the top row (11 moves) in episode 29; 13 falls, none after; the final values along it are −18.08, −12.04, −10, −8.86, −10.27, −7.01, −5.5, −4, −3, −2, −1, all at or below minus the moves left.
