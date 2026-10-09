---
paths:
  - "src/notes/reinforcement-learning/n-step-bootstrapping.html"
  - "src/es/notes/reinforcement-learning/n-step-bootstrapping.html"
  - "src/notes/reinforcement-learning/eligibility-traces.html"
  - "src/es/notes/reinforcement-learning/eligibility-traces.html"
---

# The hallway (n-step bootstrapping and eligibility traces notes)

- A robot goes home from the kitchen through the hallway and the study to its charger (terminal): rewards 0, 0, +10, γ = 0.9, true values 8.1, 9, 10, and a poor table 2, 4, 6. From the kitchen: G_{0:1} = 3.6, G_{0:2} = 4.86, G_{0:3} = G_0 = 8.1. n-step TD with n = 2, α = 0.5 gives 3.43, 6.5, 8 (one-step TD: 2.8, 4.7, 8). TD errors with the table fixed: 1.6, 1.4, 4. λ-return with λ = 0.5: 5.04, 7.2, 10 (λ = 0.8: 6.68 from the kitchen); the off-line λ-return algorithm and Sarsa(λ) with λ = 0.5, α = 0.5 both give 3.52, 5.6, 8, because no TD error of this episode uses an already updated value.
