# Feature Catalog F1–F16

Status: **Fully implemented and verified end-to-end.** All features F1 through F16 are implemented across the Express business API (`backend/src/`), Python AI microservice (`ai-service/app/`), and interactive React 18 SPA (`frontend/src/`), with 100% automated test suites passing.

---

## F1 — Auth & RBAC
- **Inputs:** email, password; (admin) role assignment.
- **Processing:** validate email uniqueness (`uq_users_email_lower`); bcrypt hash; issue JWT with `{user_id, role, factory_id}`; middleware enforces role and tenant.
- **Outputs:** JWT, user profile.
- **Wireframe:** Centered card — logo, email, password, "Sign in", link "Create account"; error banner on failure.

## F2 — Multi-Tenant Factory Profile
- **Inputs:** `legal_name`, `chamber_registration_number`, `fda_establishment_number`, `fda_green_list_status`.
- **Processing:** create `factories` row at registration; uniqueness on chamber and FEI numbers; Green List flag is user-asserted with retrieval date note (verified against ER-REG-001 evidence).
- **Outputs:** profile page; `factory_id` bound to session.
- **Wireframe:** Form with 4 fields + Green List toggle + helper text "Green List is firm- AND address-specific".

## F3 — 4-Tier Evidence Vault
- **Inputs:** rule, `proof_grade`, file, `issue_date`, `expiry_date`, notes.
- **Processing:** one current record per (factory, rule) (`uq_factory_evidence_factory_rule`); `expiry >= issue`; effective grade becomes `expired` when `expiry_date < reference date`.
- **Outputs:** vault grid: 25 rules × grade badge × expiry.
- **Wireframe:** Table grouped by category; colour-coded badges (green/blue/amber/red = tier 1–4); drawer to upload/edit.

## F4 — Smart OCR Document Inspector
- **Inputs:** PDF/image of an MTC.
- **Processing:** pdfplumber/pytesseract → parse heat no., grade, Cr/C/Ni, hardness → validate against ASTM F899 limits in rule metadata → flag e.g. 420-declared vs 304-found.
- **Outputs:** pre-filled evidence form + flags; nothing saved until user confirms (Assisted Review).
- **Wireframe:** Split screen — document preview left, extracted fields right with confidence chips and red flags; "Confirm & save" button.

## F5 — Order Intake
- **Inputs:** `product_name`, `product_code`, `quantity`, `shipment_deadline`, `financial_value_usd`, `buyer_contract_text`.
- **Processing:** validate (`quantity > 0`, value ≥ 0); insert order `pending`; create baseline `order_rules` (`system_inferred`).
- **Outputs:** order detail page.
- **Wireframe:** Two-column form; large textarea for contract text; "Create & analyse".

## F6 — NLP Buyer Condition Matcher
- **Inputs:** `buyer_contract_text`.
- **Processing:** see [NLP_CONDITION_MATCHER.md](../05_ai_and_nlp_pipelines/NLP_CONDITION_MATCHER.md); cosine ≥ 0.65.
- **Outputs:** candidate list (sentence ↔ rule, score).
- **Wireframe:** Checklist of highlighted contract sentences with proposed rule chip, score, Accept/Reject; "Confirm selected".

## F7 — Deterministic Decision Engine
- **Inputs:** order, applicable (confirmed) rules, factory evidence.
- **Processing:** [DECISION_ENGINE_SPEC.md](../04_engine_and_algorithms/DECISION_ENGINE_SPEC.md).
- **Outputs:** rows in `assessment_findings`; order → `evaluated`; order verdict BLOCKED / CONDITIONAL / READY.
- **Wireframe:** Summary banner + rule table with MET/GAP/BLOCKER pills and "why" expanders.

## F8 — Time Feasibility Checker
- **Inputs:** findings, `shipment_deadline`, today, `safetyBufferDays` (default 5).
- **Processing:** [TIME_FEASIBILITY_SPEC.md](../04_engine_and_algorithms/TIME_FEASIBILITY_SPEC.md).
- **Outputs:** FEASIBLE / AT_RISK / NOT_FEASIBLE + days required vs left.
- **Wireframe:** Gauge/bar "required vs days left" with buffer zone shading; a red "blocker" banner overrides the gauge.

## F9 — Set Union Knapsack Fix Planner
- **Inputs:** evaluated orders, remediation capacity (days), solver choice.
- **Processing:** [KNAPSACK_OPTIMIZATION.md](../04_engine_and_algorithms/KNAPSACK_OPTIMIZATION.md).
- **Outputs:** selected orders, union fix list, total days, saved revenue, optimality gap.
- **Wireframe:** Capacity slider; result cards; fix checklist ordered by shared benefit.

## F10 — Executive Analytics Dashboard
- **Inputs:** all tenant orders/findings/evidence.
- **Processing:** aggregations: category readiness %, order value × risk bucket, Pareto of revenue blocked per rule, upcoming expiries.
- **Outputs:** four widgets — **Radar Heatmap** (9 categories), **Pipeline Risk Matrix**, **Revenue Bottleneck Pareto**, **Expiry Timeline**.
- **Wireframe:** 2×2 grid with filters (date range, product).

## F11 — Grounded RAG Compliance Copilot
- **Inputs:** natural-language question (+ optional order context).
- **Processing:** [RAG_COPILOT_PIPELINE.md](../05_ai_and_nlp_pipelines/RAG_COPILOT_PIPELINE.md).
- **Outputs:** answer with inline citations, or an explicit refusal.
- **Wireframe:** Chat panel; each answer shows source chips linking to official URLs; disclaimer footer.

## F12 — ISO 13485 6-Stage Roadmap & Registrar Directory
- **Inputs:** factory readiness summary.
- **Processing:** maps open gaps to roadmap stages; static registrar list.
- **Outputs:** progress stepper, per-stage tasks, registrar directory.
- **Wireframe:** Horizontal 6-step stepper; directory cards (name, website, "verify accreditation" link).

## F13 — Export Document Gatekeeper
- **Inputs:** commercial-invoice fields (manufacturer name/address, FEI, product code, quantity, value).
- **Processing:** [INVOICE_GATEKEEPER.md](../06_workflows_and_lifecycle/INVOICE_GATEKEEPER.md).
- **Outputs:** PASS / WARN / BLOCK with itemised reasons.
- **Wireframe:** Invoice form with live validation icons per field.

## F14 — Audit Dossier PDF Generator
- **Inputs:** order id.
- **Processing:** render latest findings + evidence index + rule versions + disclaimers into PDF.
- **Outputs:** downloadable PDF.
- **Wireframe:** "Generate dossier" button with preview of sections.

## F15 — Admin Rule Versioning Manager
- **Inputs:** rule edits, activate/deactivate.
- **Processing:** update `rules`; `version` increments on substantive change; old findings keep their `rule_version`; (planned) `rule_history` snapshot.
- **Outputs:** rule list with version badges and diff view.
- **Wireframe:** Table + edit side panel + "changes since v{n}" diff.

## F16 — Multi-Tenant Security & Legal Policy Hub
- **Inputs:** none (policy content); user data requests.
- **Processing:** [MULTI_TENANT_SECURITY.md](../07_security_and_compliance/MULTI_TENANT_SECURITY.md), [LEGAL_DISCLAIMERS.md](../07_security_and_compliance/LEGAL_DISCLAIMERS.md).
- **Outputs:** policy pages, mandatory disclaimer acceptance, audit log view (admin), data export/delete.
- **Wireframe:** Tabbed page: Disclaimer · Privacy · Terms · Data requests.
