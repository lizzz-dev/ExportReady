# Product Requirements Document (PRD)

Status: Specified. Implementation state: database layer only (see [README](../../README.md)).

## 1. Purpose
Give Sialkot surgical-instrument manufacturers an affordable, explainable readiness verdict per US export order,
replacing guesswork and expensive consultant-only assessments.

## 2. Personas

| Persona | Description | Goals | Pain |
|---|---|---|---|
| **Factory Owner / Export Manager** (primary) | Runs a small/medium Sialkot workshop; decides which orders to accept | Know if an order can ship on time; prioritise fixes; avoid detention | No in-house regulatory expertise; consultant cost |
| **Quality / Compliance Officer** | Maintains QMS records | Keep evidence organised and non-expired; prepare for audits | Scattered files, expiring certificates |
| **Platform Admin** (staff) | Maintains the rule base | Keep rules current with QMSR; version changes safely | Regulatory drift |
| **Academic Evaluator** (secondary) | Advisor/examiners | Reproducible, measurable results | Black-box systems |

## 3. User stories (representative)

| ID | As a… | I want… | So that… | Feature |
|---|---|---|---|---|
| US-01 | factory user | to register my factory and log in | my data is private | F1, F2 |
| US-02 | compliance officer | to record evidence with a proof grade and expiry per rule | readiness reflects reality | F3 |
| US-03 | compliance officer | to upload a steel MTC and have fields pre-filled | I save time but still control the record | F4 |
| US-04 | export manager | to enter an order with deadline and value | the system evaluates it | F5 |
| US-05 | export manager | the system to read the buyer contract and propose extra rules, which I confirm | nothing is applied without my say | F6 |
| US-06 | export manager | a rule-by-rule MET/GAP/BLOCKER view | I know exactly what is wrong | F7 |
| US-07 | export manager | to know if the fixes fit before the deadline | I can accept/decline the order | F8 |
| US-08 | owner | to choose which orders to rescue with limited capacity | I maximise saved revenue | F9 |
| US-09 | owner | an executive dashboard | I see portfolio risk at a glance | F10 |
| US-10 | any user | to ask compliance questions with cited answers | I trust the answer | F11 |
| US-11 | owner | a path to ISO 13485 and registrar list | I can plan certification | F12 |
| US-12 | export manager | invoice checks before shipping | paperwork doesn't contradict my profile | F13 |
| US-13 | compliance officer | an audit dossier PDF | I can show buyers/auditors | F14 |
| US-14 | admin | to edit rules with versioning | past verdicts stay reproducible | F15 |
| US-15 | any user | clear legal disclaimers and tenant isolation | I understand the limits and my data is safe | F16 |

## 4. Functional requirements
FR-1…FR-16 correspond one-to-one with F1–F16 in [FEATURE_CATALOG_F1_F16.md](FEATURE_CATALOG_F1_F16.md). Cross-cutting:

- FR-X1 Verdicts are deterministic and reproducible; every finding stores `rule_version`.
- FR-X2 AI output (OCR, NLP) never changes a verdict without explicit human confirmation.
- FR-X3 Every verdict is explainable down to the rule, the evidence record and the date comparison used.
- FR-X4 All tenant data access is scoped by `factory_id`.
- FR-X5 `assessment_findings` is append-only; re-evaluation inserts new rows.

## 5. Non-functional requirements

| Category | Requirement |
|---|---|
| Security | Hashed passwords, JWT sessions, RBAC, RLS defence-in-depth, file-type/size validation on upload |
| Privacy | Per-tenant isolation; no cross-tenant analytics; data export/delete on request |
| Performance | Evaluate an order with 25 rules < 2 s (excluding AI); OCR page < 15 s |
| Reliability | Idempotent schema/seed scripts; transactional evaluation writes |
| Explainability | No black-box verdicts; AI components limited to extraction/retrieval |
| Usability | English UI; desktop-first responsive; plain-language rule explanations |
| Maintainability | `brain/` SSOT kept in sync with code (CLAUDE.md rule) |
| Accuracy (evaluation targets) | Missed Blockers = 0 on the test set; NLP precision/recall reported; Fleiss' κ reported |

## 6. Scope boundaries

**In scope:** US export of hand-held surgical instruments (Class I-oriented); 25-rule base; evidence grading; per-order verdicts; feasibility; planning; analytics; guided copilot; roadmap; dossier.

**Out of scope (explicit):**
- Legal advice, certification, or any guarantee of FDA clearance/Green List admission.
- Direct integration with FDA submission systems (FURLS, GUDID) — links only.
- EU MDR / other markets (rule base is US-specific in V2).
- Powered, implantable or sterile-supplied devices requiring full premarket pathways (flagged by ER-REG-003, not modelled).
- Automatic live verification of Green List status (manual confirmation with retrieval date; openFDA/Import Alert lookup is a possible extension).
- Timeline/project-schedule management.
- Mobile native apps.

## 7. Assumptions & risks

| Item | Note |
|---|---|
| Rule base correctness | Rules reflect public sources as of authoring; admin versioning handles drift; not legally validated |
| Effort days | `default_effort_days` are planning estimates, configurable per rule |
| Self-declared evidence | Treated as insufficient for MET by policy (conservative) |
| Single market | US only |
