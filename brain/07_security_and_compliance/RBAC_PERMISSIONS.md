# RBAC Permissions

Roles come from ENUM `user_role`: `factory_user`, `admin`. Status: Implemented and tested in `backend/src/middleware/auth.js` (`requireAuth`, `requireFactoryTenant`, `requireAdmin`).

## Permission matrix

| Capability | factory_user | admin |
|---|---|---|
| Register / log in | ✔ | ✔ |
| View/edit own factory profile (F2) | ✔ (own tenant) | ✘ (no tenant data by default) |
| Evidence vault CRUD (F3, F4) | ✔ own | ✘ |
| Orders CRUD, evaluate, planner, dashboard, dossier (F5–F10, F13, F14) | ✔ own | ✘ |
| NLP confirm/reject (F6) | ✔ own | ✘ |
| Copilot (F11), roadmap (F12) | ✔ | ✔ |
| Read rules catalogue | ✔ | ✔ |
| Create/edit/activate rules (F15) | ✘ | ✔ |
| View audit log | ✘ (own activity only) | ✔ (rule/admin events; tenant events metadata only) |
| Manage users / admin accounts | ✘ | ✔ |
| Read another tenant's business data | ✘ | ✘ unless an explicit, logged support-access procedure is approved |

## Enforcement
1. Middleware order: authenticate → authorise role → set tenant (`SET LOCAL app.current_factory_id`) → handler.
2. `factory_id` always comes from the token, never from the request body/params.
3. Admin accounts are created only by existing admins or by a seed/CLI — public registration always creates `factory_user`.
4. Role changes are audit-logged.
5. Endpoint-level role requirements are listed in [REST_API_ENDPOINTS.md](../09_api_contracts/REST_API_ENDPOINTS.md).
