---
paths:
  - "src/notes/reinforcement-learning/eligibility-traces.html"
  - "src/es/notes/reinforcement-learning/eligibility-traces.html"
  - "src/assets/js/notes/reinforcement-learning/eligibility-traces.js"
---

# The eligibility traces note: its examples, run and numbers

Its first example, the hallway, is in `hallway.md`.

- **The room.** A 5 × 4 room, a first episode of nine moves (cells (0,3), (1,3), (1,2), (0,2), (0,1), (1,1), (2,1), (2,0), (3,0), (4,0), row 0 at the top), reward +1 only on reaching the charger, all values 0, γ = 1, α = 0.5. One-step Sarsa raises the last move to 0.5, 4-step Sarsa the last four, and Sarsa(λ) with λ = 0.9 every move, to 0.5 · 0.9^k for the move k steps before the end (0.5 down to 0.22).
- **Section 5: the Sarsa(λ) figure.** Accumulating traces, α = 0.1, λ = 0.9, γ = 1, ε = 0.1, seed 757123, 30 episodes, 643 moves. Episode 1, played move by move: 19 moves, A1 down twice into the wall (move 2 the second visit, z = 1.9), A1 up, A2 left into the wall, A2 down, A1 left twice into the wall, the first fall at move 8 (right from A1: all 6 traced moves drop at once, each by its trace, A1 left most, −17.1, then A1 down, −10.1), the same fall at move 9 (right chosen before the update counted the first one, δ = −101.06), A1 down at random, A1 up, and along row 2 to the goal. The best moves settle one row up (9 moves, the Sarsa figure's route) in episode 14; final values −11.45, −10.33, −8.9, −7.83, −6.06, −4.98, −3.62, −2.27, −0.96; 6 falls, none after settling.
