# Time Feasibility Specification (F8)

Status: **Implemented** (core, pure function) in [`backend/src/engine/timeChecker.js`](../../backend/src/engine/timeChecker.js),
tested by [`backend/tests/engine.test.js`](../../backend/tests/engine.test.js). Not yet exposed over HTTP.
Consumes the findings of [DECISION_ENGINE_SPEC.md](DECISION_ENGINE_SPEC.md).

> Revision note: the earlier draft used a 15 % multiplicative buffer, a parallel-capacity parameter, and let a blocker's effort
> decide feasibility. Superseded by the flat-day buffer and the blocker rule below.

## 1. API
```js
checkTimeFeasibility({ findings, shipmentDeadline, evaluationDate, safetyBufferDays = 5 }) -> {
  verdict,             // 'FEASIBLE' | 'AT_RISK' | 'NOT_FEASIBLE'
  available_days,      // shipmentDeadline − evaluationDate (calendar days; negative = deadline passed)
  total_effort_days,   // Σ assigned_effort_days over GAP and BLOCKER findings (sequential, conservative)
  safety_buffer_days,
  margin_days,         // available_days − total_effort_days − safety_buffer_days
  counts: { met, gap, blocker },
  rationale            // human-readable explanation
}
```
`evaluationDate` here is **today** (the day planning happens), not the evidence-validity date used by the decision engine.
`safetyBufferDays` must be a non-negative integer. Dates: `'YYYY-MM-DD'` or `Date`; invalid → error.

## 2. Verdict rules (top-down, first match wins)

| # | Condition | Verdict |
|---|---|---|
| 1 | `counts.blocker > 0` | **NOT_FEASIBLE** — regardless of how much time is left |
| 2 | `total_effort_days = 0` and `available_days ≥ 0` | **FEASIBLE** (nothing to fix) |
| 3 | `total_effort_days = 0` and `available_days < 0` | **NOT_FEASIBLE** (deadline already passed) |
| 4 | `total_effort_days + safety_buffer_days ≤ available_days` | **FEASIBLE** |
| 5 | `total_effort_days ≤ available_days` | **AT_RISK** (fits only without the buffer) |
| 6 | otherwise | **NOT_FEASIBLE** |

**Why a blocker is always NOT_FEASIBLE:** a blocker is either an absolute rule (Green List, FDA registration, premarket status),
which workshop days cannot buy, or expired evidence, which the shipment's validity depends on. The order cannot be called
shippable until each blocker is cleared, so the checker reports NOT_FEASIBLE and the rationale states whether the remaining effort
would otherwise have fit. Blocker effort is still included in `total_effort_days` for reporting and for the planner.

## 3. Worked examples (buffer = 5)

| Findings | total effort | available | Result | margin |
|---|---|---|---|---|
| none | 0 | 60 | FEASIBLE | 55 |
| ER-PAS-011 (7) + ER-PAS-012 (7) | 14 | 30 | FEASIBLE | 11 |
| same | 14 | 19 | FEASIBLE (boundary) | 0 |
| same | 14 | 17 | AT_RISK | −2 |
| same | 14 | 14 | AT_RISK (boundary) | −5 |
| ER-PAS-009 (45) + ER-DOC-013 (60) | 105 | 90 | NOT_FEASIBLE (time) | −20 |
| ER-REG-002 missing (blocker, 14) | 14 | 365 | NOT_FEASIBLE (blocker) | 346 |

## 4. Notes & limitations
- Effort days are planning estimates (`rules.default_effort_days`), summed sequentially; no parallel-workstream model in V2.
- Calendar days, not working days.
- Results are computed on demand from the latest findings; not persisted.
