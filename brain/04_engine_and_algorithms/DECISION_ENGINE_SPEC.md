# Decision Engine Specification (F7)

Status: **Implemented** (core, pure function) in [`backend/src/engine/decisionEngine.js`](../../backend/src/engine/decisionEngine.js),
tested by [`backend/tests/engine.test.js`](../../backend/tests/engine.test.js). Not yet wired to HTTP routes or the database.
**Pure, deterministic, no ML.**

> Revision note: this spec was revised when the engine was implemented (expired → always BLOCKER; self-declared effort =
> full default effort; `audit_risk` added). The earlier draft (expired = GAP for non-absolute rules, `UPGRADE_FACTOR`
> discount) is superseded.

## 1. API
```js
evaluateOrder({ order, applicableRules, evidenceByRuleId, evaluationDate }) -> {
  order_id, evaluation_date, order_verdict,           // 'READY' | 'CONDITIONAL' | 'BLOCKED'
  summary: { total_rules, met, gap, blocker, audit_risk, total_effort_days },
  findings: [Finding]                                  // sorted by rule_code
}
```
- `order` — `{ id | order_id, shipment_deadline }`.
- `applicableRules` — rules that apply: `system_inferred` **plus buyer-condition rows with `confirmed_by_user = TRUE`** (the caller filters; unconfirmed rows must not be passed). Each needs `id`, `rule_code`, `title`, `is_absolute`, `default_effort_days`; optional `version` (default 1), `active` (`false` → skipped), citations. Duplicate `rule_code` → error.
- `evidenceByRuleId` — plain object or `Map`, rule id → `factory_evidence` row (`proof_grade`, `expiry_date`, …). No entry = missing.
- `evaluationDate` — the date evidence must be valid on. The backend passes the order's `shipment_deadline` (evidence must be valid on shipment day); if omitted it defaults to `order.shipment_deadline`. Dates are `'YYYY-MM-DD'` strings or `Date` (UTC calendar day is used); invalid dates throw.

## 2. Verdict function (evaluated top-down, first match wins)

| # | Condition | Verdict | `assigned_effort_days` | `audit_risk` |
|---|---|---|---|---|
| 1 | no evidence **and** `is_absolute` | **blocker** | `default_effort_days` | false |
| 2 | no evidence, not absolute | **gap** | `default_effort_days` | false |
| 3 | `proof_grade = 'expired'` **or** `expiry_date < evaluationDate` | **blocker** (absolute or not) | `default_effort_days` | false |
| 4 | `third_party_verified` | **met** | 0 | false |
| 5 | `document_backed` | **met** | 0 | **true** |
| 6 | `self_declared` and `is_absolute` | **blocker** | `default_effort_days` | false |
| 7 | `self_declared`, not absolute | **gap** | `default_effort_days` (no discount) | false |

- Unknown `proof_grade` → error (fail loudly).
- Expiry on the evaluation date itself is still valid (`expiry_date < evaluationDate` is the only expiry trigger).
- Rationale: absolute rules (ER-REG-001/002/003) are statutory preconditions — no remediation or buyer waiver substitutes for them. Expired proof is treated as a blocker regardless of rule class because the evidence the shipment relies on is no longer valid. `document_backed` counts as met but is flagged `audit_risk` because a buyer/FDA auditor may not accept the factory's own records without third-party backing.

## 3. Finding
```
{ rule_id, rule_code, title, verdict_status: 'met'|'gap'|'blocker', assigned_effort_days, audit_risk,
  is_absolute, reason, citations: { fda_source_section, cfr_section, iso_clause_number }, rule_version }
```
`is_absolute` is carried so the planner can tell an unfixable absolute blocker from a repairable expired-evidence blocker.
Persisted columns in `assessment_findings`: `rule_id`, `verdict_status`, `assigned_effort_days`, `rule_version` (others are derived at read time).

## 4. Order verdict & persistence
- `BLOCKED` if any blocker; else `CONDITIONAL` if any gap; else `READY`.
- Persistence (backend, to be built): one transaction inserts one `assessment_findings` row per finding with `rule_version = rules.version`, then sets `orders.status = 'evaluated'`. Never update/delete older rows. Consumers read the greatest `evaluated_at` per order.

## 5. Properties (all covered by tests)
1. **Determinism:** same input → identical output (50-run test); inputs never mutated; input order of rules irrelevant.
2. **Absolute dominance:** order is never READY while an absolute rule is not met.
3. **Explainability:** each finding carries a human-readable `reason` and citations.
4. Note: unlike the earlier draft, upgrading a grade is *not* strictly monotone across the expiry rule (a still-valid `self_declared` is a gap, while an expired `third_party_verified` is a blocker). The sensitivity tests in [EVALUATION_METRICS.md](../08_testing_and_evaluation/EVALUATION_METRICS.md) account for this.

## 6. Worked example (all 25 rules missing)
22 non-absolute gaps + 3 absolute blockers; `total_effort_days = 722`; order verdict `BLOCKED`.
Example single rules at evaluationDate 2027-03-01: ER-REG-001 no evidence → **blocker** (180 d); ER-PAS-009 `document_backed` expiring 2027-02-10 → **blocker** (45 d); ER-MAT-005 `third_party_verified` expiring 2028-01-01 → **met** (0 d).
