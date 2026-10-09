---
paths:
  - "src/notes/reinforcement-learning/monte-carlo.html"
  - "src/es/notes/reinforcement-learning/monte-carlo.html"
  - "src/notes/reinforcement-learning/td-learning.html"
  - "src/es/notes/reinforcement-learning/td-learning.html"
  - "src/notes/reinforcement-learning/model-based.html"
  - "src/es/notes/reinforcement-learning/model-based.html"
---

# The wandering home (Monte Carlo, TD and model-based notes)

- **Monte Carlo and TD: the wandering home.** Kitchen, hallway, study and charger (terminal), γ = 1, −1 per move. The robot's random policy: kitchen → hallway always; hallway → study or kitchen, ½ each; study → charger or hallway, ½ each. Its values are −9, −8 and −5; q_π(study, charger) = −1, q_π(study, hallway) = −9, q_π(hallway, study) = −6, q_π(hallway, kitchen) = −10. Two trips, kitchen-hallway-study and kitchen-hallway-kitchen-hallway-study-hallway-study, give first-visit estimates −5, −4, −2 and every-visit −5, −3.5, −1.67; after 10,000 simulated trips both are within 0.1 of the true values. The greedy policy is optimal (−3, −2, −1); ε-greedy around it with ε = 0.2 has values −3.47, −2.47, −1.25; in the study, Σπ′q_π = 0.9(−1) + 0.1(−9) = −1.8 ≥ −5. TD(0) with α = 0.5 from −5, −4, −2 on the trip kitchen-hallway-kitchen-hallway-study-charger: TD errors 0, −2, −1, 2, 1, table −5.5, −4, −1.5 (constant-α Monte Carlo: −4, −3, −1.5); with the table fixed the TD errors are 0, −2, 0, 1, 1 and add up to G_0 − V(kitchen) = 0. Batch example: hallway −1 → study once (charger taken, 0), study +1 three times and 0 once: V(study) = 0.6 for both, V(hallway) = −1 for batch Monte Carlo and −0.4 for batch TD(0). Sarsa escaping the shuttle: Q(hallway, kitchen) = 0.5(−1 + 0 − 0) = −0.5.
- The model-based note builds on the batch example's five episodes: see `model-based.md`.
