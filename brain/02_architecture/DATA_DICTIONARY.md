# Data Dictionary

**Source of truth for structure:** [`database/schema.sql`](../../database/schema.sql) (PostgreSQL 13+).
Sections 1–4 mirror the schema exactly. Section 5 lists **planned** objects that are *not* in `schema.sql` yet.
Update this file in the same turn as any schema change.

Extension: `pgcrypto`. Shared trigger function `set_updated_at()` (sets `NEW.updated_at := NOW()`).

## 1. ENUM types

| Type | Values | Meaning |
|---|---|---|
| `user_role` | `factory_user`, `admin` | RBAC role |
| `proof_grade` | `third_party_verified`, `document_backed`, `self_declared`, `expired` | Evidence tiers 1–4 |
| `order_status` | `pending`, `evaluated`, `archived` | Order lifecycle |
| `order_rule_source` | `system_inferred`, `buyer_condition` | Why a rule applies to an order |
| `verdict_status` | `met`, `gap`, `blocker` | Engine verdict |

## 2. Tables

### 2.1 `factories` (tenant root)
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| legal_name | VARCHAR(255) | NOT NULL | | CHECK `btrim(legal_name) <> ''` |
| chamber_registration_number | VARCHAR(100) | NULL | | Unique when not null (`uq_factories_chamber_reg`) |
| fda_establishment_number | VARCHAR(50) | NULL | | FEI/registration no.; unique when not null (`uq_factories_fda_est`) |
| fda_green_list_status | BOOLEAN | NOT NULL | FALSE | Indexed `idx_factories_green_list` |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` | |

### 2.2 `users`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| factory_id | UUID | NULL | | FK → factories(id) ON DELETE CASCADE; indexed |
| email | VARCHAR(320) | NOT NULL | | Unique case-insensitively (`uq_users_email_lower` on `lower(email)`) |
| password_hash | VARCHAR(255) | NOT NULL | | |
| role | user_role | NOT NULL | `factory_user` | |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` | |

Constraint `users_factory_user_has_factory`: `role = 'admin' OR factory_id IS NOT NULL`.

### 2.3 `rules` (global catalogue; seeded from `rules_master_25.json`)
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| rule_code | VARCHAR(64) | NOT NULL | | UNIQUE, e.g. `ER-REG-001` |
| title | VARCHAR(255) | NOT NULL | | |
| description | TEXT | NOT NULL | | |
| is_absolute | BOOLEAN | NOT NULL | FALSE | Absolute rules → BLOCKER when unmet. Partial index `idx_rules_is_absolute` |
| default_effort_days | INT | NOT NULL | 0 | CHECK `>= 0` |
| fda_source_section | VARCHAR(255) | NULL | | |
| cfr_section | VARCHAR(255) | NULL | | |
| iso_clause_number | VARCHAR(100) | NULL | | |
| version | INT | NOT NULL | 1 | CHECK `>= 1`; bumped by seed on content change |
| active | BOOLEAN | NOT NULL | TRUE | |
| category | VARCHAR(64) | NULL | | Grouping; `idx_rules_active_category` |
| metadata | JSONB | NOT NULL | `'{}'` | astm_reference, qmsr_note, evidence_required[], verification_method, failure_consequence; GIN index `idx_rules_metadata_gin` |
| updated_at | TIMESTAMPTZ | NOT NULL | `NOW()` | trigger `trg_rules_updated_at` |

### 2.4 `factory_evidence`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| factory_id | UUID | NOT NULL | | FK → factories ON DELETE CASCADE |
| rule_id | UUID | NOT NULL | | FK → rules ON DELETE RESTRICT |
| proof_grade | proof_grade | NOT NULL | `self_declared` | |
| file_url | TEXT | NULL | | |
| issue_date | DATE | NULL | | |
| expiry_date | DATE | NULL | | CHECK `expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date` |
| notes | TEXT | NULL | | |
| updated_at | TIMESTAMPTZ | NOT NULL | `NOW()` | trigger `trg_factory_evidence_updated_at` |

UNIQUE `(factory_id, rule_id)` (`uq_factory_evidence_factory_rule`). Indexes: factory, rule, partial `(factory_id, expiry_date) WHERE expiry_date IS NOT NULL`. RLS enabled.

### 2.5 `orders`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| factory_id | UUID | NOT NULL | | FK → factories ON DELETE CASCADE |
| product_name | VARCHAR(255) | NOT NULL | | |
| product_code | VARCHAR(100) | NULL | | |
| quantity | INT | NOT NULL | | CHECK `> 0` |
| shipment_deadline | DATE | NOT NULL | | |
| buyer_contract_text | TEXT | NULL | | |
| financial_value_usd | NUMERIC(14,2) | NULL | | CHECK `>= 0` |
| status | order_status | NOT NULL | `pending` | |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` | |

Indexes: `(factory_id, status)`, `(factory_id, shipment_deadline)`, unique `(id, factory_id)` (`uq_orders_id_factory`). RLS enabled.

### 2.6 `order_rules`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| order_id | UUID | NOT NULL | | FK → orders ON DELETE CASCADE |
| rule_id | UUID | NOT NULL | | FK → rules ON DELETE RESTRICT |
| source_type | order_rule_source | NOT NULL | `system_inferred` | |
| confirmed_by_user | BOOLEAN | NOT NULL | FALSE | Buyer-condition rows count only when TRUE |

UNIQUE `(order_id, rule_id)`. Indexes on `order_id`, `rule_id`. RLS enabled (via `orders`).

### 2.7 `assessment_findings` (append-only)
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | UUID | PK | `gen_random_uuid()` | |
| order_id | UUID | NOT NULL | | FK → orders ON DELETE CASCADE |
| rule_id | UUID | NOT NULL | | FK → rules ON DELETE RESTRICT |
| verdict_status | verdict_status | NOT NULL | | |
| assigned_effort_days | INT | NOT NULL | 0 | CHECK `>= 0` |
| rule_version | INT | NOT NULL | | CHECK `>= 1`; pinned at evaluation |
| evaluated_at | TIMESTAMPTZ | NOT NULL | `NOW()` | |

Indexes: `(order_id, evaluated_at DESC)`, `(rule_id)`, `(order_id, verdict_status)`. RLS enabled (via `orders`).

## 3. Relationships
```
factories 1──* users
factories 1──* factory_evidence *──1 rules
factories 1──* orders 1──* order_rules *──1 rules
                      orders 1──* assessment_findings *──1 rules
```

## 4. Row-Level Security
`app.current_factory_id` (set per request with `SET LOCAL`) drives policy `tenant_isolation` on `factory_evidence` and `orders` (`factory_id = NULLIF(current_setting('app.current_factory_id', TRUE), '')::uuid`). On `order_rules` and `assessment_findings` the policy is `EXISTS (SELECT 1 FROM orders o WHERE o.id = <child>.order_id)` — it inherits `orders` visibility. Table owners/superusers bypass RLS unless `FORCE` is applied; admin access should use a dedicated BYPASSRLS role.

## 5. Planned extensions — **NOT in schema.sql yet**

| Planned object | Purpose | Feature |
|---|---|---|
| `CREATE EXTENSION vector` | pgvector | F11, F6 |
| `rag_chunks(id, source_id, content, embedding vector(384), citation_url, section_ref)` | RAG corpus | F11 |
| `ocr_extractions(id, factory_id, file_url, parsed jsonb, flags jsonb, status, confirmed_by, created_at)` | Assisted Review staging | F4 |
| `rule_history(id, rule_id, version, snapshot jsonb, changed_by, changed_at)` | Full rule version snapshots (today only the integer `version` exists) | F15 |
| `audit_log(id, user_id, factory_id, action, entity, entity_id, at)` | Security audit trail | F16 |
| `invoice_checks(id, order_id, payload jsonb, result, created_at)` | Gatekeeper results | F13 |
| `order_rules.match_score NUMERIC`, `order_rules.source_sentence TEXT` | NLP provenance | F6 |
| `factory_evidence` `ocr_extraction_id` link | Traceability | F4 |

When any of these is implemented, move it into sections 1–4 in the same commit as the SQL change.
