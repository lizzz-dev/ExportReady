# Evaluation Metrics & Methodology

Status: Specified. No evaluation has been run yet; no results are claimed in this repository.

## 1. Test scenario set (30–40 Sialkot scenarios)
Each scenario = a synthetic-but-realistic factory evidence profile + order (+ optional buyer contract text) + **ground-truth verdicts for all 25 rules**.

Coverage matrix (target counts, total 30–40):

| Type | Count | Purpose |
|---|---|---|
| Fully ready factory | 4–5 | all MET → READY |
| Gap-only (no absolute failures) | 8–10 | GAP mix, effort sums |
| Absolute blocker (no Green List / no FEI / no 510(k) status) | 6–8 | BLOCKER dominance |
| Expired / soon-expiring evidence | 5–6 | expiry vs shipment deadline |
| Self-declared-heavy | 3–4 | tier-3 behaviour |
| Buyer-condition-rich contracts | 4–5 | NLP + confirmation |
| Deadline edge cases (AT_RISK boundaries) | 3–4 | feasibility maths |
| Portfolio sets (3–8 orders) | 3–4 | knapsack Greedy vs Exact |

Scenarios are stored under `brain/08_testing_and_evaluation/` fixtures (to be added) and used by automated tests.

## 2. Ground truth & inter-rater agreement (Fleiss' Kappa)
`n` independent raters (≥ 3: e.g. a quality professional, a regulatory-knowledgeable advisor, a team member) label each (scenario, rule) verdict
∈ {MET, GAP, BLOCKER} from the evidence description, **blind to the system output**. Disagreements are resolved by discussion → ground truth.

Fleiss' Kappa over `N` subjects (scenario–rule items), `n` raters, `k` categories:
```
n_ij = raters assigning item i to category j
P_i  = ( Σ_j n_ij² − n ) / ( n (n − 1) )
P̄   = (1/N) Σ_i P_i
p_j  = (1/(N n)) Σ_i n_ij
P_e  = Σ_j p_j²
κ    = ( P̄ − P_e ) / ( 1 − P_e )
```
Interpretation (Landis & Koch): < 0.40 poor/fair, 0.41–0.60 moderate, 0.61–0.80 substantial, > 0.80 almost perfect. Report κ; if κ < 0.6,
refine rule wording/rubrics before treating labels as ground truth.

## 3. Decision-engine metrics (vs ground truth)
Confusion matrix over {MET, GAP, BLOCKER}; accuracy; per-class precision/recall.

Asymmetric safety metrics (the key result):
- **Missed Blocker** — truth = BLOCKER, system ≠ BLOCKER. `MBR = missed / true blockers`. **Target = 0.** Any miss is a defect to be root-caused.
- **False Blocker** — system = BLOCKER, truth ≠ BLOCKER. `FBR = false / system blockers`. Over-caution; reported, tolerated.
- Also **Missed Gap** (truth GAP, system MET) — reported as an optimism error.

Because the engine is deterministic, disagreement with ground truth indicates a rule/semantics issue, not randomness.

## 4. Proof-grade sensitivity testing
For each scenario, systematically perturb: proof grade (tier up/down per rule), expiry dates (±N days around the shipment deadline), absolute-rule evidence on/off.
Assert: (a) **monotonicity** — upgrading evidence never worsens a verdict; (b) **boundary exactness** — `expiry_date = shipment_deadline` is valid, `expiry_date = shipment_deadline − 1 day` is expired; (c) the order-level verdict changes exactly when specified
by the rules; (d) `UPGRADE_FACTOR` sweep (0.25–0.75) effect on feasibility classification. Output: sensitivity table.

## 5. Time feasibility
Unit tests from the example table in [TIME_FEASIBILITY_SPEC.md](../04_engine_and_algorithms/TIME_FEASIBILITY_SPEC.md) + randomized property tests (`buffered ≥ required`, classification monotone in `days_left`).

## 6. Knapsack
Compare Greedy vs Exact on portfolio scenarios: `optimality_gap = (V_exact − V_greedy)/V_exact`, runtime, constraint satisfaction. Verify union semantics with shared-fix cases.

## 7. NLP matcher
Label buyer-contract sentences with correct rule(s). Report precision, recall, F1 at 0.65 and a threshold sweep (0.5–0.8) with PR curve.

## 8. OCR
Field-level accuracy (heat number, grade, Cr, C, Ni, hardness) on a set of real/synthetic MTCs; flag precision/recall for `GRADE_MISMATCH` (including the 420-vs-304 cases).

## 9. RAG Copilot
Question set (in-scope and out-of-scope). Metrics: answer groundedness (claims supported by cited chunks), citation correctness, refusal rate on out-of-scope (should be high), hallucination count (target 0). Manual review by raters.

## 10. Reporting
All numbers with scenario counts and confidence intervals where applicable; limitations stated (synthetic data, small N, estimates of effort days). No claim of regulatory validation.
