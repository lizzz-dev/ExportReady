# ExportReady — Proposal & Detailed Methodology (V2)

**Title:** ExportReady — A Decision Support System for Export Compliance Readiness in Medical Device Manufacturing
**Advisor:** Sir Talha Mughal
**Submitted by:** Ume Habiba (23009105050), Aleena Batool (230091050), Leeza Nawaz (230091050), Nayab Farooq (23009105019)
**Department:** Computer Science, UMT Sialkot, Pakistan — **Session:** 2026-2027

> Status: V2 — no timelines/semester schedules by design. Living document: per the sync rule in
> [CLAUDE.md](../../CLAUDE.md), update this file whenever code, schema, rules, endpoints or workflows change.
>
> **Items marked ⚠ CITE are figures supplied by the team that must carry a verifiable source before submission.**

---

## 1. Problem Statement & Sialkot Industrial Reality

### 1.1 Context
Sialkot is Pakistan's surgical-instrument hub. The industry is commonly reported to supply a dominant share of the
world's hand-held surgical instruments (team figure: **70–80% global share** ⚠ CITE), mostly through small and
medium workshops that depend on export orders, chiefly to the US and EU.

### 1.2 The five structural problems

1. **OEM middleman trap.** Many workshops manufacture for intermediaries/OEM brand owners. The factory has no
   direct view of the buyer's regulatory requirements, and the compliance burden is pushed down informally.
2. **FDA Import Alert 76-01 — automatic DWPE.** Surgical/medical instruments from Pakistan are subject to
   *Detention Without Physical Examination* at the US port of entry unless the manufacturing firm **and address**
   is on the **Green List**. A shipment from an unlisted firm is detained automatically.
3. **Green List audit barrier.** Admission and retention require a third-party QSR/QMSR audit evidencing a working
   quality system, material control (steel chemistry/chromium variability was a stated rationale for the alert),
   validated passivation, calibration, traceability and CAPA.
4. **Regulatory change — QMSR.** FDA's Quality Management System Regulation amends 21 CFR Part 820 to incorporate
   **ISO 13485:2016** by reference, **effective 2 February 2026**. Legacy QSR section citations (820.50, 820.75, …)
   now map to ISO 13485 clauses; factories and consultants trained on the old structure face a moving target.
5. **Cost and guesswork.** Compliance consultancy is expensive (team estimate **USD 10,000–30,000** per
   engagement ⚠ CITE), so most SMEs decide go/no-go on guesswork, and wrong guesses cost a detained or refused
   shipment, storage/demurrage, re-export or destruction, and lost buyers.

### 1.3 Gap addressed
No affordable tool answers, **per order and per deadline**: *which rules apply, which are met by evidence the factory
actually holds, which are gaps vs. hard blockers, how many days the fixes need, and which fixes to buy first when
capacity is limited.* ExportReady fills that gap.

---

## 2. Project Description & 3-Dimensional Modeling Paradigm

ExportReady evaluates **readiness**, not "compliance" in a legal sense. Every verdict is computed from three
dimensions that meet at the *order*:

| Dimension | Entity | Source of truth |
|---|---|---|
| **D1 — Order** | product, quantity, shipment deadline, value, buyer contract text | `orders`, `order_rules` |
| **D2 — Graded Factory Evidence Vault** | what the factory can prove, per rule, with a proof grade and expiry | `factory_evidence` |
| **D3 — 25-Rule Statutory Base** | versioned rules with CFR/ISO/FDA citations, `is_absolute`, effort days | `rules` (`rules_master_25.json`) |

`verdict(order, rule) = f(rule, evidence(factory, rule), order.shipment_deadline)` →
`MET | GAP | BLOCKER`, stored append-only in `assessment_findings` with the pinned `rule_version`.

The 25 rules span 9 categories: regulatory status (3), quality management (1), raw material (4), passivation (4),
documentation & records (5), calibration (2), UDI & labeling (3), cleaning & bioburden (2), CAPA (1).
Three rules are **absolute** (ER-REG-001/002/003) — no remediation plan or buyer waiver substitutes for them.
If every rule were a full gap, the summed default effort is **722 days**.

---

## 3. Feature Specification F1–F16

Full inputs/processing/outputs/wireframes: [FEATURE_CATALOG_F1_F16.md](FEATURE_CATALOG_F1_F16.md).

| # | Feature | Summary |
|---|---|---|
| F1 | **Auth & RBAC** | Email/password, hashed credentials, roles `factory_user` and `admin`; every request tenant-scoped. |
| F2 | **Multi-Tenant Factory Profile** | Legal name, chamber registration no., FDA establishment no. (FEI), Green List status; strict per-factory isolation. |
| F3 | **4-Tier Evidence Vault** | Per-rule evidence with proof grade `third_party_verified` > `document_backed` > `self_declared` > `expired`, file link, issue/expiry dates. |
| F4 | **Smart OCR Document Inspector** | Extracts fields from Mill Test Certificates; flags grade/chemistry mismatches (e.g. AISI 420 declared vs 304 on MTC); Assisted Review — human confirms before it touches the vault. |
| F5 | **Order Intake** | Product, code, quantity, deadline, value, buyer contract text; baseline rules inferred automatically. |
| F6 | **NLP Buyer Condition Matcher** | Maps contract sentences to rules (spaCy + all-MiniLM-L6-v2, cosine ≥ 0.65); candidates require **human confirmation**. |
| F7 | **Deterministic Decision Engine** | Rule-by-rule MET / GAP / BLOCKER with no ML in the verdict path. |
| F8 | **Time Feasibility Checker** | Effort sum + safety buffer vs. days to deadline → FEASIBLE / AT_RISK / NOT_FEASIBLE. |
| F9 | **Set Union Knapsack Fix Planner** | Chooses which orders to rescue under limited remediation days, counting shared rule fixes once. |
| F10 | **Executive Analytics Dashboard** | Radar Heatmap (category readiness), Pipeline Risk Matrix (value × risk), Revenue Bottleneck Pareto, Expiry Timeline. |
| F11 | **Grounded RAG Compliance Copilot** | pgvector retrieval over official sources, temperature 0.1, citation-or-refuse. |
| F12 | **ISO 13485 6-Stage Roadmap & Registrar Directory** | Guided path to certification + accredited registrars (TÜV SÜD, SGS, BSI, DNV, NSF, UL, Bureau Veritas). |
| F13 | **Export Document Gatekeeper** | Blocks/warns on commercial-invoice data that contradicts the factory profile or an unresolved BLOCKER. |
| F14 | **Audit Dossier PDF Generator** | One-click PDF: findings, evidence index, rule versions, disclaimers. |
| F15 | **Admin Rule Versioning Manager** | Admin edits/activates rules; each change bumps `version`; historical findings stay pinned. |
| F16 | **Multi-Tenant Security & Legal Policy Hub** | Tenant isolation (app + RLS), audit logging, disclaimers, privacy/terms, data-export/delete. |

---

## 4. End-to-End Operational Lifecycle & Workflows

Detailed flows: [ORDER_LIFECYCLE.md](../06_workflows_and_lifecycle/ORDER_LIFECYCLE.md),
[EVIDENCE_VAULT_FLOW.md](../06_workflows_and_lifecycle/EVIDENCE_VAULT_FLOW.md),
[INVOICE_GATEKEEPER.md](../06_workflows_and_lifecycle/INVOICE_GATEKEEPER.md),
[ISO_13485_6STAGE_ROADMAP.md](../06_workflows_and_lifecycle/ISO_13485_6STAGE_ROADMAP.md).

| Phase | Name | What happens |
|---|---|---|
| 1 | **Onboard** | Register user + factory (F1, F2). Admin has seeded the 25 rules (F15). |
| 2 | **Build evidence** | Upload documents; OCR assisted review; assign proof grade and expiry (F3, F4). |
| 3 | **Intake order** | Enter order; system infers baseline rules; NLP proposes buyer-condition rules; user confirms (F5, F6). |
| 4 | **Evaluate** | Engine → findings; feasibility; portfolio planner; dashboard (F7–F10). Order → `evaluated`. |
| 5 | **Act & ship** | Fix gaps, re-evaluate, run Gatekeeper on invoice, generate dossier, archive order (F13, F14). Copilot and roadmap are available throughout (F11, F12). |

---

## 5. In-Depth Engineering Methodology

### 5.1 Four-tier architecture
Presentation (`frontend`, :5173) → Business API (`backend` Express, :3000) → AI service (`ai-service` FastAPI, :8000)
→ Data (PostgreSQL 13+, :5432, pgvector). The Express API owns authentication, tenancy, the decision engine,
the planner and persistence. The AI service is **stateless w.r.t. verdicts**: it only extracts, matches and
retrieves; it never decides MET/GAP/BLOCKER. See [SYSTEM_ARCHITECTURE.md](../02_architecture/SYSTEM_ARCHITECTURE.md).

### 5.2 Multi-tenant schema
Tenant root `factories`; `users`, `factory_evidence`, `orders` carry `factory_id`; `order_rules` and
`assessment_findings` inherit tenancy via `order_id`. Application-layer scoping plus PostgreSQL Row-Level
Security (`app.current_factory_id`). `rules` is global/shared. Exact definitions:
[DATA_DICTIONARY.md](../02_architecture/DATA_DICTIONARY.md).

### 5.3 OCR pipeline & Assisted Review pattern
`pdfplumber` for text PDFs, `pytesseract` for scans → regex/layout parser for MTC fields (heat no., grade,
Cr/C/Ni %, hardness/standard) → validators against the ASTM F899 limits recorded in the rule metadata
(Cr 11.5–13.5 % for 410, 12.0–14.0 % for 420). **AISI 420 vs 304 check:** 304 is austenitic (≈18–20 % Cr, ≈8–10.5 % Ni)
and cannot be hardened by heat treatment, so an MTC showing 304 for a product declared as hardened 420 is flagged.
OCR output is a *suggestion*: nothing enters the vault until a human confirms (Assisted Review).
See [OCR_DOCUMENT_INSPECTOR.md](../05_ai_and_nlp_pipelines/OCR_DOCUMENT_INSPECTOR.md).

### 5.4 NLP buyer-condition matching
spaCy sentence segmentation + obligation-cue filtering → `all-MiniLM-L6-v2` (384-d) embeddings → cosine similarity
against rule title+description embeddings; matches ≥ **0.65** become `order_rules` rows with
`source_type='buyer_condition'`, `confirmed_by_user=false`. Only confirmed rows reach the engine.
See [NLP_CONDITION_MATCHER.md](../05_ai_and_nlp_pipelines/NLP_CONDITION_MATCHER.md).

### 5.5 Deterministic decision engine
For each applicable rule, take the evidence's *effective grade on the shipment deadline*
(expired if `expiry_date < shipment_deadline`):

| Effective evidence | Rule `is_absolute` | Verdict |
|---|---|---|
| third_party_verified or document_backed | any | **MET** |
| self_declared, missing, or expired | false | **GAP** |
| self_declared, missing, or expired | true | **BLOCKER** |

Same inputs → same output; fully unit-testable. See [DECISION_ENGINE_SPEC.md](../04_engine_and_algorithms/DECISION_ENGINE_SPEC.md).

### 5.6 Time feasibility
`required = Σ assigned_effort_days` over GAP/BLOCKER findings (÷ parallel capacity, default 1);
`buffered = ⌈required × 1.15⌉`; `days_left = shipment_deadline − today`.
FEASIBLE if `buffered ≤ days_left`; AT_RISK if `required ≤ days_left < buffered`; NOT_FEASIBLE if `required > days_left`.
See [TIME_FEASIBILITY_SPEC.md](../04_engine_and_algorithms/TIME_FEASIBILITY_SPEC.md).

### 5.7 Set Union Knapsack fix planner
Orders are items with profit = `financial_value_usd`; rules are elements with weight = effort days. Selecting a
set of orders costs the **union** of their required fixes — shared fixes are paid once. Solvers: marginal-ratio
**Greedy** (fast, approximate) and **Exact** DP over union-masks (optimal for ≤ ~20 orders). See
[KNAPSACK_OPTIMIZATION.md](../04_engine_and_algorithms/KNAPSACK_OPTIMIZATION.md).

### 5.8 pgvector RAG Copilot
Official sources are chunked, embedded with `all-MiniLM-L6-v2`, stored in `rag_chunks (vector(384))`.
Query → top-k retrieval → LLM at **temperature 0.1** with a guardrail prompt: answer only from retrieved chunks,
cite each claim, refuse otherwise, never assert legal compliance. See [RAG_COPILOT_PIPELINE.md](../05_ai_and_nlp_pipelines/RAG_COPILOT_PIPELINE.md).

### 5.9 Six-stage ISO 13485 roadmap
Gap analysis → QMS design → implementation & training → internal audit & management review → registrar
certification audit (Stage 1/Stage 2) → surveillance & FDA/QMSR maintenance, with a directory of accredited
registrars. See [ISO_13485_6STAGE_ROADMAP.md](../06_workflows_and_lifecycle/ISO_13485_6STAGE_ROADMAP.md).

---

## 6. Verified Statutory Sources & Official Links
Authoritative list with usage/copyright rules: [REGULATORY_SOURCES_DIR.md](../03_rules_knowledge_base/REGULATORY_SOURCES_DIR.md).
Primary: FDA Import Alert 76-01 (FDA Import Alerts database); 21 CFR Parts 801, 807, 820, 830, 878 (eCFR);
QMSR final rule (89 FR 7496, 2 Feb 2024; effective 2 Feb 2026); openFDA device APIs; ASTM F899 and A967 (paid
standards — cited, not reproduced); ISO 13485:2016 (paid — cited, not reproduced).

---

## 7. Academic Evaluation Methodology
Full spec: [EVALUATION_METRICS.md](../08_testing_and_evaluation/EVALUATION_METRICS.md).

- **30–40 Sialkot test scenarios** — realistic factory/order profiles (mix of ready, gap-only, blocker, expired evidence, buyer-condition-heavy), each with a ground-truth verdict set.
- **Inter-rater agreement** — independent expert labelling of ground truth; agreement measured with **Fleiss' Kappa**.
- **Asymmetric errors** — **Missed Blockers** (system says OK, truth is blocker; safety-critical, target 0) tracked separately from **False Blockers** (over-caution; costs time, not shipments).
- **Proof-grade sensitivity testing** — systematically downgrade/upgrade evidence grades and expiry dates and verify verdicts change exactly as the rules dictate (monotonicity), demonstrating the engine's behaviour is explainable and deterministic.
- Component metrics: OCR field accuracy, NLP precision/recall at the 0.65 threshold, planner optimality gap (Greedy vs Exact), RAG groundedness (citation correctness).
