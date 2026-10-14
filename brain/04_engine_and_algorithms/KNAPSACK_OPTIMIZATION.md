# Set Union Knapsack Optimization (F9)

Status: Specified, not implemented. Lives in `backend/`.

## 1. Problem
The factory has limited remediation capacity `C` (days of fix work available) and several evaluated orders.
Orders share rule fixes (e.g. passivation validation serves every order). Which orders should be "rescued" to
maximise saved revenue, counting each shared fix **once**?

This is a **Set Union Knapsack Problem (SUKP)**.

## 2. Formulation
- Orders `j ∈ J` with profit `v_j = financial_value_usd` (NULL → 0).
- Rule universe `R`; each order needs the fix set `S_j ⊆ R` = rules with GAP/BLOCKER in its latest findings.
- Rule weight `w_r` = fix effort days. Because `assigned_effort_days` can differ per order (self_declared discount),
  use `w_r = max over orders of assigned_effort_days for r` (one fix satisfies all).
- Decision `x_j ∈ {0,1}`.

```
maximize   Σ_j v_j · x_j
subject to Σ_{r ∈ ∪_{j: x_j=1} S_j} w_r  ≤  C
           x_j ∈ {0,1}
```
Eligibility pre-filter: drop order `j` if it is individually NOT_FEASIBLE by its own deadline
([TIME_FEASIBILITY_SPEC.md](TIME_FEASIBILITY_SPEC.md)), or if any `r ∈ S_j` is an unattainable absolute blocker flagged by the user.
Orders with `S_j = ∅` are already ready: always selected, cost 0.

## 3. Greedy solver (fast, approximate)
```
U = ∅ (union of chosen fix rules); chosen = []
repeat:
    for each unchosen order j: marginal_j = Σ_{r ∈ S_j \ U} w_r
    candidates = {j : cost(U ∪ S_j) ≤ C}
    if none: stop
    pick j* maximising v_j / max(marginal_j, ε)   (marginal 0 → ratio ∞)
    chosen += j*; U = U ∪ S_j*
return chosen, U, Σ v, cost(U)
```
Complexity `O(|J|² · |R|)`. Not optimal in general.

## 4. Exact solver (optimal)
Dynamic programming over reachable union-masks (bitmask of ≤ 25 rules):
```
best = { 0 : (value 0, chosen []) }          # mask -> best (value, set)
for each order j (mask m_j):
    for each (mask, (val, set)) in snapshot(best):
        new = mask | m_j
        if cost(new) ≤ C and val + v_j > best[new].val: best[new] = (val+v_j, set+[j])
answer = argmax value over best
```
The state count is bounded by `2^|R|` but in practice by the number of distinct unions; practical for ≤ ~20 orders.
Prune states with `cost > C`. For larger inputs, fall back to Greedy and report that optimality is not guaranteed.

## 5. Output
`{ solver, selected_order_ids[], fix_rules[] (with days), total_days, capacity, saved_value_usd, unrescued_value_usd, optimality_gap? }`
where `optimality_gap = (exact − greedy) / exact` when both are run.

## 6. Why a union?
A per-order additive knapsack would charge the passivation validation (45 d) separately to every order and
wrongly reject viable portfolios. The union formulation models real shared effort.

## 7. Tiny example
`C = 60`. A (v=\$50k, needs {PAS-009:45}), B (v=\$30k, needs {PAS-009:45, PAS-011:7}), D (v=\$40k, needs {DOC-013:60}).
Additive: A+B = 97 > 60. Union: A+B = 52 ≤ 60 → \$80k. D alone = \$40k. Optimal = {A,B}.
