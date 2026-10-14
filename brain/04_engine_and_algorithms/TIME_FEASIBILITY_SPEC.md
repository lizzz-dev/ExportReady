# Time Feasibility Specification (F8)

Status: Specified, not implemented. Lives in `backend/`. Consumes the latest findings of
[DECISION_ENGINE_SPEC.md](DECISION_ENGINE_SPEC.md).

## 1. Definitions
- `E` = set of findings with `verdict_status IN ('gap','blocker')`, each with `assigned_effort_days` `e_i`.
- `days_left = shipment_deadline − today` (calendar days; ≤ 0 means already late).
- `P` = parallel capacity (concurrent workstreams), default **1** (conservative, sequential).
- `β` = safety buffer, default **0.15** (15 %), configurable.

## 2. Computation
```
required = max( max_i e_i , CEIL( Σ e_i / P ) )        # 0 if E is empty
buffered = CEIL( required * (1 + β) )
```
With `P = 1` this reduces to `required = Σ e_i`.

## 3. Classification

| Condition | Result |
|---|---|
| `E` empty | **FEASIBLE** (nothing to fix) |
| `buffered ≤ days_left` | **FEASIBLE** |
| `required ≤ days_left < buffered` | **AT_RISK** (fits only without buffer) |
| `required > days_left` | **NOT_FEASIBLE** |

BLOCKER efforts are included in `E`. An unresolved BLOCKER is never ignored: the order is shippable only after
its effort completes, so a 180-day Green List blocker with 90 days left is NOT_FEASIBLE.

## 4. Outputs
`{ required_days, buffered_days, days_left, status, slack_days = days_left − buffered }` (not persisted in V2;
recomputed on demand from findings + today).

## 5. Worked examples (P = 1, β = 0.15)

| Findings (days) | required | buffered | days_left | Result |
|---|---|---|---|---|
| none | 0 | 0 | 60 | FEASIBLE |
| 45 + 7 + 7 | 59 | 68 | 90 | FEASIBLE |
| 45 + 7 + 7 | 59 | 68 | 60 | AT_RISK |
| 45 + 60 | 105 | 121 | 90 | NOT_FEASIBLE |
| 180 (blocker) | 180 | 207 | 120 | NOT_FEASIBLE |

Full 25-rule gap: Σ = 722 days → buffered 831.

## 6. Notes & limitations
- Effort days are planning estimates, not guarantees; the model ignores inter-task dependencies beyond `P`.
- Calendar vs working days: V2 uses calendar days; change here and in the UI together if switched.
