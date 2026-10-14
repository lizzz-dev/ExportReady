# Decision Engine Specification (F7)

Status: Specified, not implemented. Lives in `backend/` (Express). **Pure, deterministic, no ML.**

## 1. Inputs
- `order` (`id`, `factory_id`, `shipment_deadline`, `status`)
- Applicable rules = `order_rules` rows where `source_type = 'system_inferred'` **OR** (`source_type = 'buyer_condition'` AND `confirmed_by_user = TRUE`), joined to `rules` where `rules.active`.
- `factory_evidence` for the order's factory (0..1 row per rule).

## 2. Effective grade
Reference date `D = order.shipment_deadline` (evidence must be valid on the day of shipment).

```
effective_grade(e):
    if e is NULL                               -> 'missing'
    if e.expiry_date IS NOT NULL and e.expiry_date < D -> 'expired'
    if e.proof_grade = 'expired'               -> 'expired'
    else                                       -> e.proof_grade
```

## 3. Verdict function

| effective_grade | `is_absolute = false` | `is_absolute = true` |
|---|---|---|
| `third_party_verified` | MET | MET |
| `document_backed` | MET | MET |
| `self_declared` | GAP | BLOCKER |
| `expired` | GAP | BLOCKER |
| `missing` | GAP | BLOCKER |

Rationale: absolute rules (ER-REG-001/002/003) are statutory preconditions; no remediation or buyer waiver can
substitute for them on a shipment, so an unmet one blocks. Self-declaration is conservatively insufficient.

## 4. Assigned effort
```
MET     -> 0
GAP / BLOCKER, missing or expired -> rule.default_effort_days
GAP / BLOCKER, self_declared      -> CEIL(rule.default_effort_days * UPGRADE_FACTOR)   # default 0.5
```
`UPGRADE_FACTOR` (default **0.5**, configurable) reflects that evidence already exists and only needs upgrading;
this is a planning assumption to be validated in evaluation (see sensitivity tests).

## 5. Outputs
- Insert one `assessment_findings` row per rule: `(order_id, rule_id, verdict_status, assigned_effort_days, rule_version = rules.version)`. Never update or delete older rows.
- Set `orders.status = 'evaluated'`.
- Order-level verdict (derived, not stored): **BLOCKED** if any `blocker`; else **CONDITIONAL** if any `gap`; else **READY**.
- All findings of one evaluation share the same transaction and `evaluated_at`.

## 6. Latest-evaluation rule
Consumers read the findings with the greatest `evaluated_at` per order (`idx_findings_order_evaluated`).

## 7. Properties (tested in evaluation)
1. **Determinism:** same inputs → identical findings.
2. **Monotonicity:** upgrading a proof grade or extending an expiry never worsens a verdict.
3. **Absolute dominance:** order is never READY while an absolute rule is not MET.
4. **Explainability:** each finding is reproducible from (rule, evidence row, deadline).

## 8. Worked example
Deadline 2027-03-01. ER-REG-001 (absolute, 180d): no evidence → **BLOCKER**, 180d.
ER-PAS-009 (45d): `document_backed`, expiry 2027-02-10 → effective `expired` → **GAP**, 45d.
ER-MAT-005 (5d): `third_party_verified`, expiry 2028-01-01 → **MET**, 0d.
Order verdict: **BLOCKED**; effort total = 225d.
