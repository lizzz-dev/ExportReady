# Set Union Knapsack Optimization (F9)

Status: **Implemented** (core, pure functions) in [`backend/src/engine/fixPlanner.js`](../../backend/src/engine/fixPlanner.js),
tested by [`backend/tests/engine.test.js`](../../backend/tests/engine.test.js) (including a brute-force cross-check on 300 seeded
random portfolios). Not yet exposed over HTTP.

## 1. Problem
The factory has limited remediation capacity `C` (days of preparation work) and several evaluated orders. Orders share repairs
(e.g. one passivation validation serves every order). Which orders should be unlocked to maximise revenue, counting each shared
repair **once**? This is a **Set Union Knapsack Problem (SUKP)**.

## 2. Formulation
- Orders `j` with profit `v_j = financial_value_usd` (NULL → 0; money handled in integer cents).
- Repair set `S_j` = rule codes of the order's `gap` findings **and non-absolute `blocker` findings** (expired evidence is repairable by renewal).
- Weight `w_r` = `assigned_effort_days` of repair `r` (max across orders; identical in practice because effort = `default_effort_days`).
- `x_j ∈ {0,1}`.

```
maximize   Σ_j v_j · x_j
subject to Σ_{r ∈ ∪_{j: x_j=1} S_j} w_r  ≤  C
```

## 3. Partitioning (before solving)

| Bucket | Rule | Treatment |
|---|---|---|
| `unfixable_orders` | has a `blocker` finding with `is_absolute = true` | Excluded. Workshop prep days cannot unlock an absolute rule (Green List, FDA registration, premarket status). Reported with `absolute_blockers`. Blocker findings **must** carry a boolean `is_absolute`, otherwise error. |
| `ready_orders` | no gap/blocker findings | Already shippable; cost 0; reported separately and **not** counted in unlocked revenue. |
| `infeasible_orders` | optional `available_days` given and the order's own repairs exceed it | Excluded; can never ship on time. |
| zero-value orders | `v_j = 0` | Never selected (listed under `not_selected_orders`). |
| candidates | everything else | Solved. |

## 4. Input / output
```js
solveGreedy({ orders, capacityDays })      // heuristic
solveExact({ orders, capacityDays, maxStates = 1_000_000 })   // optimal
compareFixPlans({ orders, capacityDays, maxStates })          // both + runtime + optimality
// order = { order_id, financial_value_usd, findings /* from evaluateOrder */, available_days? }
```
Solver result: `{ solver, capacity_days, unlocked_orders[], unlocked_revenue_usd, selected_gap_repairs:[{rule_code,title,effort_days}],
total_effort_days, remaining_capacity_days, ready_orders[], unfixable_orders[], infeasible_orders[], not_selected_orders[] }`
(`solveExact` adds `states_explored`). Everything is deterministic: ids sorted, ties broken by `order_id`.

`compareFixPlans` returns the exact plan's headline fields (or greedy's if exact is unavailable) plus
`greedy`, `exact` (each with `runtime_ms` from `performance.now()`), and
`optimality = { exact_available, greedy_revenue_usd, exact_revenue_usd, gap_usd, gap_ratio, greedy_is_optimal }`.
`runtime_ms` is the only non-deterministic field.

## 5. Greedy (order-grouped heuristic)
```
union = ∅; cost = 0
repeat:
    for each unchosen candidate: marginal = Σ w_r for r ∈ S_j \ union
    keep those with cost + marginal ≤ C
    pick max ratio v_j / marginal   (marginal = 0 → ratio ∞); ties: higher v_j, then order_id
    add it; union ∪= S_j; cost += marginal
```
Complexity `O(|J|² · |R|)`. Not optimal in general (see example below).

## 6. Exact (dynamic programming over union masks)
State = bitmask (BigInt, so >32 distinct repairs are fine) of the repairs paid so far → best `{value, cost, chosen}` for that union.
For each candidate order, extend every existing state: `new = mask | S_j`, `cost' = cost + w(S_j \ mask)`; drop if `> C`; keep the better
state per mask (value, then lower cost, then lexicographic order ids). Answer = best state. Optimal. If the number of reachable unions
exceeds `maxStates`, it throws `EXACT_STATE_LIMIT`; `compareFixPlans` then reports `exact: null, optimality.exact_available = false`
and falls back to the greedy plan rather than failing silently.

## 7. Examples (real rule efforts)
- **Union saving.** `C = 60`. A ($50k, PAS-009 45 d), B ($30k, PAS-009 + PAS-011 = 52 d), D ($40k, DOC-013 60 d). Additive A+B = 97 > 60; union = 52 → unlock A+B = **$80k** (greedy and exact agree).
- **Greedy suboptimal.** `C = 60`. P ($46k, PAS-009 45 d, 1022 $/day), Q ($30k, CAPA-025 30 d), R ($30k, MAT-008 30 d). Greedy takes P first (then nothing fits): **$46k**. Exact takes Q+R: **$60k**; gap $14k (23.3 %).
