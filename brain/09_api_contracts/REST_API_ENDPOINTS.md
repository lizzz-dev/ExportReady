# REST API Endpoints

Status: **Specified contract — nothing here is implemented yet.** Update this file in the same turn as any route change.

Conventions: JSON; auth `Authorization: Bearer <JWT>`; ids are UUIDs; timestamps ISO-8601; dates `YYYY-MM-DD`.
Errors: `{"error":{"code":"VALIDATION_ERROR","message":"…","details":[{"field":"quantity","issue":"must be > 0"}]}}`
with HTTP 400/401/403/404/409/422/429/500/503. Role column: `U` = factory_user, `A` = admin, `P` = public.

## Part A — Express API (`backend`, `:3000`, prefix `/api/v1`)

### A1. Auth (F1)
| Method | Path | Role | Description |
|---|---|---|---|
| POST | /auth/register | P | Create factory + first user |
| POST | /auth/login | P | Issue tokens |
| POST | /auth/refresh | P | Rotate access token |
| POST | /auth/logout | U/A | Revoke refresh token |
| GET | /auth/me | U/A | Current user |

`POST /auth/register`
```json
{ "email":"owner@factory.pk", "password":"min 12 chars",
  "factory":{"legal_name":"Alpha Surgical Pvt Ltd","chamber_registration_number":"SCCI-1234","fda_establishment_number":"3001234567"} }
```
→ `201 { "user":{"id","email","role":"factory_user","factory_id"}, "access_token":"…", "refresh_token":"…" }`
Errors: 409 `EMAIL_TAKEN` | `FACTORY_NUMBER_TAKEN`.

`POST /auth/login` `{ "email","password" }` → `200 { "access_token","refresh_token","user":{…} }` | 401 `INVALID_CREDENTIALS`.

### A2. Factory (F2)
| Method | Path | Role |
|---|---|---|
| GET | /factory | U |
| PATCH | /factory | U |

`PATCH /factory` `{ "legal_name"?, "chamber_registration_number"?, "fda_establishment_number"?, "fda_green_list_status"? }` → `200 Factory`.
`Factory = { id, legal_name, chamber_registration_number, fda_establishment_number, fda_green_list_status, created_at }`

### A3. Rules (read) & admin (F15)
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /rules?category=&active= | U/A | List rules |
| GET | /rules/:ruleCode | U/A | One rule |
| POST | /admin/rules | A | Create rule |
| PATCH | /admin/rules/:ruleCode | A | Update; bumps `version` if substantive |
| POST | /admin/rules/:ruleCode/deactivate | A | `active=false` |

`Rule = { id, rule_code, title, description, is_absolute, default_effort_days, fda_source_section, cfr_section, iso_clause_number, version, active, category, metadata, updated_at }`

### A4. Evidence vault (F3)
| Method | Path | Role |
|---|---|---|
| GET | /evidence | U |
| PUT | /evidence/:ruleCode | U (upsert) |
| DELETE | /evidence/:ruleCode | U |
| POST | /evidence/:ruleCode/file | U (multipart `file`) |

`PUT /evidence/:ruleCode`
```json
{ "proof_grade":"document_backed","file_url":"…","issue_date":"2026-01-10","expiry_date":"2027-01-09","notes":"…" }
```
→ `200 Evidence` where `Evidence = { id, rule_code, proof_grade, effective_grade, file_url, issue_date, expiry_date, notes, updated_at }`.
Errors: 422 `EXPIRY_BEFORE_ISSUE`.

### A5. Orders (F5)
| Method | Path | Role |
|---|---|---|
| POST | /orders | U |
| GET | /orders?status= | U |
| GET | /orders/:id | U |
| PATCH | /orders/:id | U |
| POST | /orders/:id/archive | U |

`POST /orders`
```json
{ "product_name":"Mosquito forceps 12cm","product_code":"HRQ","quantity":5000,"shipment_deadline":"2027-03-01",
  "financial_value_usd":42000.00,"buyer_contract_text":"…" }
```
→ `201 Order` = `{ id, factory_id, product_name, product_code, quantity, shipment_deadline, financial_value_usd, buyer_contract_text, status, created_at }`

### A6. Buyer conditions (F6)
| Method | Path | Role |
|---|---|---|
| POST | /orders/:id/buyer-conditions/analyze | U |
| GET | /orders/:id/rules | U |
| PATCH | /orders/:id/rules/:ruleCode | U (`{confirmed:true}`) |
| DELETE | /orders/:id/rules/:ruleCode | U (reject) |

`POST …/analyze` → `200 { "candidates":[{"rule_code":"ER-MAT-005","score":0.78,"sentence":"…"}] }`
`GET /orders/:id/rules` → `[{ "rule_code","source_type","confirmed_by_user" }]`

### A7. Evaluation (F7, F8)
| Method | Path | Role |
|---|---|---|
| POST | /orders/:id/evaluate | U |
| GET | /orders/:id/findings | U (latest evaluation) |
| GET | /orders/:id/findings/history | U |
| GET | /orders/:id/feasibility | U |

`POST …/evaluate` → `200`
```json
{ "order_id":"…","evaluated_at":"…","order_verdict":"BLOCKED",
  "summary":{"met":18,"gap":6,"blocker":1,"total_effort_days":225},
  "findings":[{"rule_code":"ER-REG-001","verdict_status":"blocker","assigned_effort_days":180,"rule_version":1,"reason":"missing"}] }
```
`GET …/feasibility?buffer=0.15&parallel=1` → `{ "required_days":225,"buffered_days":259,"days_left":90,"status":"NOT_FEASIBLE","slack_days":-169 }`

### A8. Planner (F9)
`POST /planner/optimize` `{ "capacity_days":60, "solver":"greedy"|"exact"|"both" }` →
```json
{ "solver":"exact","selected_order_ids":["…"],"fix_rules":[{"rule_code":"ER-PAS-009","days":45}],
  "total_days":52,"capacity":60,"saved_value_usd":80000,"unrescued_value_usd":40000,"optimality_gap":0.0 }
```

### A9. Analytics (F10)
`GET /analytics/dashboard` → `{ "radar":[{"category","readiness_pct"}], "risk_matrix":[{"order_id","value_usd","risk","days_left"}], "pareto":[{"rule_code","blocked_value_usd"}], "expiry_timeline":[{"rule_code","expiry_date","days_to_expiry"}] }`

### A10. AI proxies (F4, F11)
| Method | Path | Role |
|---|---|---|
| POST | /ocr/inspect | U (multipart) → proxies FastAPI `/ocr/inspect` |
| POST | /ocr/:extractionId/confirm | U |
| POST | /copilot/ask | U → FastAPI `/rag/ask` |

### A11. Gatekeeper & dossier (F13, F14)
| Method | Path | Role |
|---|---|---|
| POST | /orders/:id/invoice-check | U |
| GET | /orders/:id/dossier.pdf | U |

`POST …/invoice-check` `{ "manufacturer_name","manufacturer_address","fei_number","product_code","quantity","declared_value_usd","ship_date" }` →
`{ "result":"BLOCK","checks":[{"id":"G2","severity":"BLOCK","passed":false,"message":"…"}] }`

### A12. Admin / policy (F15, F16)
| Method | Path | Role |
|---|---|---|
| GET | /admin/audit-log | A |
| POST | /me/data-export | U |
| DELETE | /me/account | U |
| GET | /policy/:doc (`disclaimer|privacy|terms`) | P |
| GET | /health | P |

## Part B — FastAPI (`ai-service`, `:8000`, internal only; header `X-Service-Token`)

| Method | Path | Description |
|---|---|---|
| POST | /ocr/inspect | MTC extraction |
| POST | /nlp/match | Buyer-condition matching |
| POST | /rag/ask | Grounded Q&A |
| POST | /rag/ingest | (admin job) corpus ingestion |
| GET | /health | Liveness |

`POST /ocr/inspect` (multipart `file`, form `declared_grade?`) →
```json
{ "extraction_id":"…","fields":{"heat_number":{"value":"H12345","confidence":0.93},"grade":{"value":"420","confidence":0.9},
  "chemistry":{"Cr":{"value":13.1,"confidence":0.88}}},
  "flags":[{"code":"GRADE_MISMATCH","severity":"high","message":"MTC grade 304 vs declared 420"}],
  "suggested_proof_grade":"document_backed" }
```
`POST /nlp/match` `{ "text":"…","rules":[{"rule_code","title","description"}],"threshold":0.65 }` →
`{ "candidates":[{"rule_code","score","sentence"}] }`
`POST /rag/ask` `{ "question":"…","context":{"rule_codes":["ER-PAS-009"]} }` →
`{ "answer":"… [S1]","citations":[{"id":"S1","section_ref":"21 CFR 820.75","url":"https://www.ecfr.gov/…"}],"refused":false }`

## Authorisation summary
Public: register, login, refresh, policy, health. Admin-only: `/admin/*`. Everything else requires `U` (tenant-scoped) unless noted `U/A`.
