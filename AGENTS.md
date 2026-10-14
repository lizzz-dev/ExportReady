# AGENTS.md — ExportReady Agent Instructions

> `CLAUDE.md` carries identical content. If you edit one, edit the other in the same turn.

## Project context

**ExportReady — A Decision Support System for Export Compliance Readiness in Medical Device Manufacturing.**
Final Year Project, Department of Computer Science, UMT Sialkot (Session 2026-2027), advisor Sir Talha Mughal.

The system tells a Sialkot surgical-instrument manufacturer, *per export order*, whether the factory's current
compliance evidence is enough to ship to the US (FDA Import Alert 76-01, 21 CFR Part 820 / QMSR incorporating
ISO 13485:2016, ASTM F899 / A967), and if not, what the minimum fix plan is.

| Layer | Folder | Tech | Port |
|---|---|---|---|
| Presentation | `frontend/` | Web SPA (React + Vite assumed) | 5173 |
| Business API | `backend/` | Node.js + Express | 3000 |
| AI service | `ai-service/` | Python + FastAPI (OCR, NLP, RAG) | 8000 |
| Data | `database/` | PostgreSQL 13+ (+ pgvector for RAG) | 5432 |
| Knowledge / docs | `brain/` | Markdown + JSON (SSOT) | – |

## MANDATORY LIVING DOCUMENTATION RULE

`brain/` is the **Single Source of Truth (SSOT)**.

Whenever any code, database table/column, rule, algorithm, API route, or UI workflow is **created, updated,
or modified anywhere in the project**, you MUST **simultaneously** update the corresponding files in `brain/`
(including `PROPOSAL_AND_METHODOLOGY_V2.md`, `DATA_DICTIONARY.md`, `REST_API_ENDPOINTS.md`, etc.) **in the
exact same turn**, so documentation and code never drift apart.

### Change → document mapping

| If you change… | You must also update… |
|---|---|
| `database/schema.sql` | `brain/02_architecture/DATA_DICTIONARY.md` |
| `brain/03_rules_knowledge_base/rules_master_25.json` | `RULES_STATUTORY_MAPPING.md`, `REGULATORY_SOURCES_DIR.md` (if sources change), rule count/effort figures in `PROPOSAL_AND_METHODOLOGY_V2.md` |
| Any Express / FastAPI route | `brain/09_api_contracts/REST_API_ENDPOINTS.md` |
| Decision engine / time / knapsack code | the matching spec in `brain/04_engine_and_algorithms/` |
| OCR / NLP / RAG code | the matching spec in `brain/05_ai_and_nlp_pipelines/` |
| Workflow or lifecycle behaviour | `brain/06_workflows_and_lifecycle/` |
| Auth, RBAC, tenancy, legal text | `brain/07_security_and_compliance/` |
| Evaluation method or metrics | `brain/08_testing_and_evaluation/EVALUATION_METRICS.md` |
| Any feature F1–F16 | `FEATURE_CATALOG_F1_F16.md`, `PRD.md`, and `PROPOSAL_AND_METHODOLOGY_V2.md` |
| Folder layout / setup commands | `README.md` |

### Rules of engagement

1. Read the relevant `brain/` file **before** coding; if code and doc disagree, stop and resolve it — do not silently pick one.
2. Docs describe *specified* vs *implemented* state honestly (each spec carries a status line). Never mark something implemented that is not.
3. `DATA_DICTIONARY.md` must match `database/schema.sql` exactly. Planned-but-unbuilt tables live only in its "Planned extensions" section.
4. Statutory text: link to official sources; never paste copyrighted standard text (ASTM, ISO) — see `REGULATORY_SOURCES_DIR.md`.
5. The system is a **decision-support aid, not legal advice or a certification** — preserve the disclaimers in `LEGAL_DISCLAIMERS.md`.
6. Never commit secrets (`.env`), uploaded evidence files, or real factory data.
7. Every PR/commit that touches code should list the `brain/` files updated in its message.
