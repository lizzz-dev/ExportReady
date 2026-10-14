-- =============================================================================
-- ExportReady :: PostgreSQL schema (PostgreSQL 13+)
-- Decision-support system for surgical instrument export compliance
-- (FDA Import Alert 76-01, 21 CFR 820 / QMSR / ISO 13485:2016, ASTM F899, A967)
--
-- Usage:   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
-- Idempotent: safe to re-run (enums/tables/indexes/triggers are guarded).
-- Multi-tenancy: every tenant-owned root table carries factory_id and is indexed
-- on it; child tables (order_rules, assessment_findings) inherit tenancy via
-- order_id -> orders.factory_id. Optional Row-Level Security is provided at the
-- bottom (enabled only when the app sets `app.current_factory_id`).
-- =============================================================================

BEGIN;

-- gen_random_uuid() is built in from PostgreSQL 13; pgcrypto covers 9.4-12.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- ENUM TYPES (guarded for idempotency)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('factory_user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE proof_grade AS ENUM
        ('third_party_verified', 'document_backed', 'self_declared', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'evaluated', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_rule_source AS ENUM ('system_inferred', 'buyer_condition');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE verdict_status AS ENUM ('met', 'gap', 'blocker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. FACTORIES  (tenant root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factories (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name                  VARCHAR(255) NOT NULL,
    chamber_registration_number VARCHAR(100),
    fda_establishment_number    VARCHAR(50),   -- FEI / registration number
    fda_green_list_status       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT factories_legal_name_not_blank CHECK (btrim(legal_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_factories_chamber_reg
    ON factories (chamber_registration_number)
    WHERE chamber_registration_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_factories_fda_est
    ON factories (fda_establishment_number)
    WHERE fda_establishment_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_factories_green_list
    ON factories (fda_green_list_status);

-- -----------------------------------------------------------------------------
-- 2. USERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id    UUID REFERENCES factories (id) ON DELETE CASCADE,
    email         VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role NOT NULL DEFAULT 'factory_user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- factory_user must belong to a tenant; admin (platform staff) may be tenant-less
    CONSTRAINT users_factory_user_has_factory
        CHECK (role = 'admin' OR factory_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_factory_id ON users (factory_id);

-- -----------------------------------------------------------------------------
-- 3. RULES  (global compliance rule catalogue; seeded from rules_master_25.json)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code           VARCHAR(64) NOT NULL UNIQUE,
    title               VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    is_absolute         BOOLEAN NOT NULL DEFAULT FALSE,
    default_effort_days INT NOT NULL DEFAULT 0 CHECK (default_effort_days >= 0),
    fda_source_section  VARCHAR(255),
    cfr_section         VARCHAR(255),
    iso_clause_number   VARCHAR(100),
    version             INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    -- Extensions beyond the base spec: grouping + free-form JSONB
    -- (ASTM references, expected evidence, QMSR notes, ...)
    category            VARCHAR(64),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rules_active_category ON rules (active, category);
CREATE INDEX IF NOT EXISTS idx_rules_is_absolute ON rules (is_absolute) WHERE is_absolute;
CREATE INDEX IF NOT EXISTS idx_rules_metadata_gin ON rules USING GIN (metadata jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_rules_updated_at ON rules;
CREATE TRIGGER trg_rules_updated_at BEFORE UPDATE ON rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. FACTORY_EVIDENCE  (one current evidence record per factory per rule)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factory_evidence (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id  UUID NOT NULL REFERENCES factories (id) ON DELETE CASCADE,
    rule_id     UUID NOT NULL REFERENCES rules (id) ON DELETE RESTRICT,
    proof_grade proof_grade NOT NULL DEFAULT 'self_declared',
    file_url    TEXT,
    issue_date  DATE,
    expiry_date DATE,
    notes       TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT factory_evidence_dates_ordered
        CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date),
    CONSTRAINT uq_factory_evidence_factory_rule UNIQUE (factory_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_evidence_factory ON factory_evidence (factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_evidence_rule ON factory_evidence (rule_id);
CREATE INDEX IF NOT EXISTS idx_factory_evidence_expiry
    ON factory_evidence (factory_id, expiry_date) WHERE expiry_date IS NOT NULL;

DROP TRIGGER IF EXISTS trg_factory_evidence_updated_at ON factory_evidence;
CREATE TRIGGER trg_factory_evidence_updated_at BEFORE UPDATE ON factory_evidence
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. ORDERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id         UUID NOT NULL REFERENCES factories (id) ON DELETE CASCADE,
    product_name       VARCHAR(255) NOT NULL,
    product_code       VARCHAR(100),
    quantity           INT NOT NULL CHECK (quantity > 0),
    shipment_deadline  DATE NOT NULL,
    buyer_contract_text TEXT,
    financial_value_usd NUMERIC(14, 2) CHECK (financial_value_usd >= 0),
    status             order_status NOT NULL DEFAULT 'pending',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_factory_status ON orders (factory_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_factory_deadline ON orders (factory_id, shipment_deadline);
-- Allows (order_id, factory_id) composite checks / RLS joins
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_id_factory ON orders (id, factory_id);

-- -----------------------------------------------------------------------------
-- 6. ORDER_RULES  (rules that apply to an order)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    rule_id           UUID NOT NULL REFERENCES rules (id) ON DELETE RESTRICT,
    source_type       order_rule_source NOT NULL DEFAULT 'system_inferred',
    confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_order_rules_order_rule UNIQUE (order_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_order_rules_order ON order_rules (order_id);
CREATE INDEX IF NOT EXISTS idx_order_rules_rule ON order_rules (rule_id);

-- -----------------------------------------------------------------------------
-- 7. ASSESSMENT_FINDINGS  (append-only evaluation history; rule_version pinned)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_findings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    rule_id              UUID NOT NULL REFERENCES rules (id) ON DELETE RESTRICT,
    verdict_status       verdict_status NOT NULL,
    assigned_effort_days INT NOT NULL DEFAULT 0 CHECK (assigned_effort_days >= 0),
    rule_version         INT NOT NULL CHECK (rule_version >= 1),
    evaluated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_order_evaluated
    ON assessment_findings (order_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_rule ON assessment_findings (rule_id);
CREATE INDEX IF NOT EXISTS idx_findings_order_verdict
    ON assessment_findings (order_id, verdict_status);

-- -----------------------------------------------------------------------------
-- OPTIONAL: Row-Level Security for tenant isolation (defence in depth)
-- The API must run `SET LOCAL app.current_factory_id = '<uuid>'` per request.
-- Table owners / superusers bypass RLS unless FORCE is applied; admin access
-- should use a dedicated role with BYPASSRLS. Policies are created only once.
-- -----------------------------------------------------------------------------
ALTER TABLE factory_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_findings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY tenant_isolation ON factory_evidence
        USING (factory_id = NULLIF(current_setting('app.current_factory_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation ON orders
        USING (factory_id = NULLIF(current_setting('app.current_factory_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation ON order_rules
        USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_rules.order_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation ON assessment_findings
        USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = assessment_findings.order_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
