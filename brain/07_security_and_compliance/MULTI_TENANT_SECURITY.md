# Multi-Tenant Security

Status: Implemented and verified in database schema (`database/schema.sql`) and backend application middleware (`backend/src/middleware/auth.js`) with 100% tenant isolation test pass.

## 1. Tenancy model
- Tenant = `factories` row. `users`, `factory_evidence`, `orders` carry `factory_id`; `order_rules` and `assessment_findings` inherit via `order_id → orders.factory_id`. `rules` is global (shared, read-only for tenants).
- A `factory_user` always has a `factory_id` (DB check `users_factory_user_has_factory`). `admin` may have none.

## 2. Defence in depth
| Layer | Control |
|---|---|
| Application | JWT carries `factory_id`; every query adds `WHERE factory_id = $1`; ids from clients are never trusted for tenancy; resource lookups use `(id, factory_id)` (`uq_orders_id_factory`) |
| Database | Row-Level Security enabled on `factory_evidence`, `orders`, `order_rules`, `assessment_findings`; policy compares to `current_setting('app.current_factory_id')` |
| Connection | Per request, inside a transaction: `SET LOCAL app.current_factory_id = '<uuid>'` |
| Roles | App connects as a **non-owner, non-superuser** role (owners/superusers bypass RLS unless `FORCE ROW LEVEL SECURITY`). Admin/rule-management uses a separate BYPASSRLS role limited to the `rules` operations |
| AI service | Receives only the data needed for the call; never exposed publicly; `X-Service-Token` required |

> ⚠ RLS policies are defined on 4 tables; `users` and `factories` rely on application scoping. `RLS` on `users`/`factories` is a candidate hardening item.

## 3. Authentication
- Passwords hashed with bcrypt (cost ≥ 12) → `users.password_hash`; never logged or returned.
- JWT (short-lived access, e.g. 15 min; refresh token rotation), signed with `JWT_SECRET` from environment.
- Rate limiting and lockout on login; generic error messages (no user enumeration).
- HTTPS/TLS required in any non-local deployment.

## 4. Input & file safety
Parameterised SQL only; schema validation on every payload; uploads: MIME + magic-byte check, max 10 MB, random file names, per-tenant prefix, no execution, antivirus scan if available; OCR service processes files in an isolated temp dir.

## 5. Data protection
Secrets only in environment variables; `.env` is git-ignored; no real factory data in the repo; backups encrypted; data export and deletion on request (cascade deletes via `ON DELETE CASCADE`).

## 6. Audit logging (planned `audit_log`)
Log: login/logout, evidence create/update/delete, order create/evaluate/archive, rule changes by admin, data export/delete. Immutable, tenant-scoped, admin-viewable.

## 7. Tenant isolation tests (required)
User A cannot read/update/delete any B resource via any endpoint (direct id guess, list, search, dossier, copilot context); verified at both app and DB (RLS) layers.
