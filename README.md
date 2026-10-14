# ExportReady

**A Decision Support System for Export Compliance Readiness in Medical Device Manufacturing**

Final Year Project — Department of Computer Science, UMT Sialkot, Pakistan (Session 2026-2027)
Advisor: Sir Talha Mughal

ExportReady helps Sialkot surgical-instrument manufacturers answer one question per export order:
*"Does our current compliance evidence let this shipment clear the US border — and if not, what is the cheapest
fix plan that still meets the deadline?"* It models each order against a 25-rule statutory base
(FDA Import Alert 76-01, 21 CFR 820 / QMSR + ISO 13485:2016, ASTM F899 / A967) and the factory's graded evidence.

> Decision-support aid only — not legal advice, not a certification. See
> [LEGAL_DISCLAIMERS.md](brain/07_security_and_compliance/LEGAL_DISCLAIMERS.md).

## Architecture (4 tiers)

```
 Browser ──► frontend (5173) ──► backend Express (3000) ──► PostgreSQL (5432)
                                        │                       ▲
                                        └──► ai-service FastAPI (8000) ──┘  (OCR · NLP · RAG / pgvector)
```

Details: [SYSTEM_ARCHITECTURE.md](brain/02_architecture/SYSTEM_ARCHITECTURE.md).

## Folder layout

| Path | Purpose | State |
|---|---|---|
| `brain/` | **Single Source of Truth** — specs, rules, algorithms, API contracts (9 numbered sections) | Populated |
| `database/` | `schema.sql` (7 tables, 5 ENUMs, RLS) and `seeds/seed_rules.js` | Implemented |
| `backend/` | Express REST API (`:3000`) + deterministic core engine (`src/engine/`: decision engine, time checker, SUKP fix planner) | Implemented + tested (40/40 tests pass: 30 engine + 10 E2E API integration) |
| `ai-service/` | FastAPI OCR / NLP / RAG service (`:8000`) with deterministic fallback | Implemented + tested (11/11 tests pass); dual-mode offline reliability |
| `frontend/` | Web UI | Not started |
| `CLAUDE.md` / `AGENTS.md` | Agent rules incl. the mandatory **Living Documentation Sync Rule** | Active |

Start reading at [`brain/01_prd_and_specs/PROPOSAL_AND_METHODOLOGY_V2.md`](brain/01_prd_and_specs/PROPOSAL_AND_METHODOLOGY_V2.md).

## Setup (database — the only implemented layer today)

Prerequisites: Node.js >= 18, PostgreSQL 13+.

```bash
# 1. Create the database
createdb exportready

# 2. Configure connection (never commit .env)
echo "DATABASE_URL=postgres://user:password@localhost:5432/exportready" > .env

# 3. Apply schema (idempotent)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql

# 4. Seed the 25 rules
cd database
npm install
npm run seed:rules:dry   # validate, rolls back
npm run seed:rules       # persist
```

PowerShell equivalent for step 2: `Set-Content .env "DATABASE_URL=postgres://user:password@localhost:5432/exportready"`.

## Run the backend tests (no external database needed)

```bash
cd backend
npm test                         # runs all 40 tests (30 engine + 10 E2E API integration)
npm start                        # starts Express API server on http://localhost:3000
```

The tests load the real `brain/03_rules_knowledge_base/rules_master_25.json`. Specs: `brain/04_engine_and_algorithms/` and `brain/09_api_contracts/REST_API_ENDPOINTS.md`.

## Run the AI microservice tests (no external downloads needed)

```bash
cd ai-service
python -m pytest tests/test_ai_service.py -v # 11 tests covering NLP, OCR, RAG & guardrails
```

The AI service automatically uses high-accuracy deterministic fallback matching if heavy transformer weights or Tesseract binaries are not installed.

Planned run commands (once the remaining layers exist; ports are the contract in `SYSTEM_ARCHITECTURE.md`):

```bash
cd backend    && npm install && npm run dev                              # :3000
cd ai-service && python -m venv .venv && pip install -r requirements.txt && uvicorn app.main:app --port 8000
cd frontend   && npm install && npm run dev                              # :5173
```

## Contributing rule

Any change to code, schema, rules, endpoints or workflows must update the matching `brain/` document in the same
commit. See [CLAUDE.md](CLAUDE.md).

## Team

Ume Habiba · Aleena Batool · Leeza Nawaz · Nayab Farooq
