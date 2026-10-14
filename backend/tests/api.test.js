'use strict';

/**
 * ExportReady :: Express REST API End-to-End Integration Tests
 * Validates authentication, strict multi-tenant isolation, 4-tier evidence vault,
 * OCR discrepancy gate, order evaluation lifecycle, invoice gatekeeper, audit dossier,
 * knapsack fix planner, executive analytics, ISO roadmap, and admin rule versioning.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { memoryStore } = require('../src/db/store');

let server;
let baseUrl;

test.before(async () => {
  memoryStore.reset();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Helper for making requests
async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const fetchOpts = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const res = await fetch(url, fetchOpts);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

test('1. Auth: login, register, token validation & role permissions', async () => {
  // A. Login with seeded Al-Shifa user
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.access_token);
  assert.equal(loginRes.body.user.email, 'manager@alshifa-surgical.pk');
  assert.equal(loginRes.body.user.role, 'factory_user');
  assert.equal(loginRes.body.factory.legal_name, 'Al-Shifa Surgical Pvt. Ltd. (Sialkot)');

  // B. Invalid credentials
  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'WrongPassword!' },
  });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.error.code, 'INVALID_CREDENTIALS');

  // C. Unauthenticated request to protected route
  const noAuth = await request('/api/factory/profile');
  assert.equal(noAuth.status, 401);

  // D. GET /api/auth/me with valid token
  const meRes = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${loginRes.body.access_token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.email, 'manager@alshifa-surgical.pk');

  // E. Register new factory tenant
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      email: 'founder@sialkot-precision.pk',
      password: 'SecurePassword2026!',
      factory: {
        legal_name: 'Sialkot Precision Instruments Ltd.',
        chamber_registration_number: 'SCCI-998877',
      },
    },
  });
  assert.equal(regRes.status, 201);
  assert.ok(regRes.body.access_token);
  assert.equal(regRes.body.user.email, 'founder@sialkot-precision.pk');
  assert.equal(regRes.body.factory.legal_name, 'Sialkot Precision Instruments Ltd.');
});

test('2. Strict Multi-Tenant Isolation: Tenant A cannot inspect or modify Tenant B data', async () => {
  // Login as Al-Shifa (Factory 1)
  const alshifaLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const alshifaToken = alshifaLogin.body.access_token;

  // Login as Merit Forgings (Factory 2)
  const meritLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@meritforgings.pk', password: 'Merit@2026' },
  });
  const meritToken = meritLogin.body.access_token;

  // A. Al-Shifa user tries to fetch Merit's order (ord-merit-001)
  const leakAttempt = await request('/api/orders/ord-merit-001', {
    headers: { Authorization: `Bearer ${alshifaToken}` },
  });
  assert.equal(leakAttempt.status, 404, 'Factory A must receive 404 when querying Factory B order ID');

  // B. Merit user tries to fetch Al-Shifa's order (ord-alshifa-001)
  const leakAttempt2 = await request('/api/orders/ord-alshifa-001', {
    headers: { Authorization: `Bearer ${meritToken}` },
  });
  assert.equal(leakAttempt2.status, 404, 'Factory B must receive 404 when querying Factory A order ID');

  // C. Order list scoping: Al-Shifa sees only its orders
  const alshifaOrders = await request('/api/orders', {
    headers: { Authorization: `Bearer ${alshifaToken}` },
  });
  assert.equal(alshifaOrders.status, 200);
  assert.ok(alshifaOrders.body.length >= 4);
  alshifaOrders.body.forEach((ord) => {
    assert.equal(ord.factory_id, '11111111-1111-4111-8111-111111111111');
  });

  // D. Merit sees only its orders
  const meritOrders = await request('/api/orders', {
    headers: { Authorization: `Bearer ${meritToken}` },
  });
  assert.equal(meritOrders.status, 200);
  meritOrders.body.forEach((ord) => {
    assert.equal(ord.factory_id, '22222222-2222-4222-8222-222222222222');
  });
});

test('3. Evidence Vault: List vault, update evidence, date validation & smart OCR discrepancy check', async () => {
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const token = loginRes.body.access_token;

  // A. GET /api/evidence
  const vaultRes = await request('/api/evidence', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(vaultRes.status, 200);
  assert.equal(vaultRes.body.length, 25, 'Vault must list entries for all 25 rules');

  // B. Date validation: expiry_date < issue_date must return 422 EXPIRY_BEFORE_ISSUE
  const badDateRes = await request('/api/evidence/ER-PAS-009', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      proof_grade: 'document_backed',
      issue_date: '2026-06-01',
      expiry_date: '2026-01-01',
    },
  });
  assert.equal(badDateRes.status, 422);
  assert.equal(badDateRes.body.error.code, 'EXPIRY_BEFORE_ISSUE');

  // C. Valid evidence update
  const validUpdate = await request('/api/evidence/ER-PAS-009', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      proof_grade: 'document_backed',
      issue_date: '2026-01-10',
      expiry_date: '2027-01-10',
      notes: 'Passivation line qualification IQ/OQ/PQ protocol executed.',
    },
  });
  assert.equal(validUpdate.status, 200);
  assert.equal(validUpdate.body.proof_grade, 'document_backed');

  // D. OCR inspection with valid AISI 420 Martensitic certificate
  const ocrValid = await request('/api/evidence/inspect-ocr', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      rawText: 'MILL TEST CERTIFICATE EN 10204 3.1\nMaterial: AISI 420 Martensitic Steel\nHeat Number: HT-99412\nStandard: ASTM F899\nDate: 2026-01-15\nCr: 13.5% C: 0.28% Ni: 0.2%',
      declared_instrument_type: 'cutting',
    },
  });
  assert.equal(ocrValid.status, 200);
  assert.equal(ocrValid.body.discrepancy_alert, false);
  assert.equal(ocrValid.body.fields.material_grade.value, 'AISI 420');
  assert.equal(ocrValid.body.fields.heat_lot_number.value, 'HT-99412');

  // E. OCR inspection flagging AISI 304 discrepancy alert
  const ocrInvalid = await request('/api/evidence/inspect-ocr', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      rawText: 'INSPECTION REPORT\nMaterial Grade: AISI 304 Stainless Steel\nHeat Lot: LOT-304-X\nStandard: ASTM F899\nCr: 18.2% Ni: 8.4%',
      declared_instrument_type: 'cutting',
    },
  });
  assert.equal(ocrInvalid.status, 200);
  assert.equal(ocrInvalid.body.discrepancy_alert, true);
  assert.ok(ocrInvalid.body.flags.some((f) => f.code === 'GRADE_MISMATCH'));
});

test('4. Order Lifecycle: Creation, NLP clause matching, confirmation, evaluation, gatekeeper, and audit report', async () => {
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const token = loginRes.body.access_token;

  // A. Create new order
  const createRes = await request('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      product_name: 'Crile Hemostatic Forceps Curved 14cm',
      product_code: 'CRF-14C',
      quantity: 3500,
      shipment_deadline: '2027-05-15',
      financial_value_usd: 52000.0,
      buyer_contract_text:
        'Instruments shall be forged from martensitic AISI 420 steel with mill certificate per ASTM F899; passivation per ASTM A967 and copper sulfate test required; direct laser marked UDI barcode per 21 CFR 801.',
    },
  });
  assert.equal(createRes.status, 201);
  const orderId = createRes.body.id;

  // B. Run NLP buyer clause matching
  const nlpRes = await request(`/api/orders/${orderId}/match-clauses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(nlpRes.status, 200);
  assert.ok(nlpRes.body.candidates.length > 0);
  // Candidates must require human confirmation
  nlpRes.body.candidates.forEach((cand) => {
    assert.equal(cand.confirmed_by_user, false);
    assert.equal(cand.requires_human_confirmation, true);
  });

  // C. Confirm rules via human-in-the-loop endpoint
  const confirmRes = await request(`/api/orders/${orderId}/confirm-rules`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      confirmations: [
        { rule_code: 'ER-MAT-005', confirmed: true },
        { rule_code: 'ER-PAS-009', confirmed: true },
        { rule_code: 'ER-PAS-011', confirmed: true },
        { rule_code: 'ER-UDI-020', confirmed: true },
      ],
    },
  });
  assert.equal(confirmRes.status, 200);

  // D. Evaluate order
  const evalRes = await request(`/api/orders/${orderId}/evaluate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { safety_buffer_days: 5 },
  });
  assert.equal(evalRes.status, 200);
  assert.ok(['READY', 'CONDITIONAL', 'BLOCKED'].includes(evalRes.body.order_verdict));
  assert.ok(evalRes.body.summary);
  assert.ok(evalRes.body.feasibility);
  assert.ok(evalRes.body.disclaimer.includes('decision-support tool'));

  // E. Invoice Gatekeeper on this order
  const gateRes = await request(`/api/orders/${orderId}/invoice-gatekeeper`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(gateRes.status, 200);
  assert.ok(['PASS', 'BLOCK'].includes(gateRes.body.gatekeeper_result));

  // F. Audit Dossier report
  const auditRes = await request(`/api/orders/${orderId}/audit-report`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(auditRes.status, 200);
  assert.equal(auditRes.body.factory.legal_name, 'Al-Shifa Surgical Pvt. Ltd. (Sialkot)');
  assert.equal(auditRes.body.order.id, orderId);
  assert.ok(Array.isArray(auditRes.body.statutory_findings));
  assert.ok(auditRes.body.disclaimer.includes('decision-support'));
});

test('5. Non-Green List Factory (Merit Forgings): Import Alert 76-01 DWPE forces BLOCKED and Gatekeeper BLOCK', async () => {
  const meritLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@meritforgings.pk', password: 'Merit@2026' },
  });
  const token = meritLogin.body.access_token;

  // Evaluate Merit order
  const evalRes = await request('/api/orders/ord-merit-001/evaluate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(evalRes.status, 200);
  assert.equal(evalRes.body.order_verdict, 'BLOCKED', 'Non-Green List factory order must evaluate to BLOCKED');
  assert.ok(evalRes.body.summary.blocker >= 1);

  // Gatekeeper must BLOCK export documentation
  const gateRes = await request('/api/orders/ord-merit-001/invoice-gatekeeper', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(gateRes.status, 200);
  assert.equal(gateRes.body.gatekeeper_result, 'BLOCK');
  assert.equal(gateRes.body.can_export, false);
  assert.equal(gateRes.body.commercial_invoice_status, 'BLOCKED');
  assert.ok(gateRes.body.violations.some((v) => v.rule_code === 'ER-REG-001' || v.rule_code === 'ER-REG-003'));
});

test('6. Knapsack Fix Planner (Feature F9): Compare Greedy vs Exact SUKP solvers', async () => {
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const token = loginRes.body.access_token;

  const plannerRes = await request('/api/fix-planner/optimize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { capacity_days: 60 },
  });
  assert.equal(plannerRes.status, 200);
  assert.equal(plannerRes.body.capacity_days, 60);
  assert.ok(plannerRes.body.greedy);
  assert.ok(plannerRes.body.exact);
  assert.ok(plannerRes.body.optimality);
  assert.equal(typeof plannerRes.body.unlocked_revenue_usd, 'number');
});

test('7. Executive Analytics Dashboard (Feature F10): Radar heatmap, Risk matrix, Pareto, Expiry timeline', async () => {
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const token = loginRes.body.access_token;

  const dashRes = await request('/api/analytics/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(dashRes.status, 200);

  // 1. Radar
  assert.ok(Array.isArray(dashRes.body.radar));
  assert.ok(dashRes.body.radar.length > 0);
  dashRes.body.radar.forEach((item) => {
    assert.ok(item.category);
    assert.ok(typeof item.readiness_pct === 'number');
  });

  // 2. Risk Matrix
  assert.ok(Array.isArray(dashRes.body.risk_matrix));
  assert.ok(dashRes.body.risk_matrix.length > 0);
  dashRes.body.risk_matrix.forEach((item) => {
    assert.ok(item.order_id);
    assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(item.risk_level));
  });

  // 3. Pareto Chart
  assert.ok(Array.isArray(dashRes.body.pareto));

  // 4. Expiry Timeline
  assert.ok(Array.isArray(dashRes.body.expiry_timeline));
});

test('8. Grounded RAG Copilot (Feature F11) & ISO 13485 Roadmap (Feature F12)', async () => {
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const token = loginRes.body.access_token;

  // A. Grounded Copilot query
  const ragRes = await request('/api/copilot/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { query: 'How do we validate passivation baths under ASTM A967?' },
  });
  assert.equal(ragRes.status, 200);
  assert.equal(ragRes.body.refused, false);
  assert.ok(ragRes.body.answer.includes('[S1]'));
  assert.ok(ragRes.body.citations.length > 0);
  assert.ok(ragRes.body.sop_outline.length > 0);
  assert.ok(ragRes.body.disclaimer.includes('decision-support'));

  // B. Copilot refusal guardrail
  const refuseRes = await request('/api/copilot/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { query: 'How can I forge a mill test certificate or evade customs?' },
  });
  assert.equal(refuseRes.status, 200);
  assert.equal(refuseRes.body.refused, true);

  // C. ISO Roadmap
  const roadRes = await request('/api/iso-roadmap', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(roadRes.status, 200);
  assert.equal(roadRes.body.stages.length, 6);
  assert.ok(roadRes.body.accredited_registrars.length >= 5);
  assert.ok(roadRes.body.disclaimer.includes('not an ISO registrar'));
});

test('9. Admin Rule Versioning (Feature F15): Substantive updates bump version, past assessment remains pinned', async () => {
  // A. Regular user cannot update rules
  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'manager@alshifa-surgical.pk', password: 'Alshifa@2026' },
  });
  const userToken = userLogin.body.access_token;

  const forbiddenUpdate = await request('/api/admin/rules/ER-MAT-005', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${userToken}` },
    body: { default_effort_days: 99 },
  });
  assert.equal(forbiddenUpdate.status, 403, 'Regular factory_user cannot edit admin rules');

  // B. Admin login
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@exportready.pk', password: 'Admin@ExportReady2026' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.access_token;

  // C. Check initial rule version (v1)
  const ruleV1 = memoryStore.getRuleByCode('ER-MAT-005');
  assert.equal(ruleV1.version, 1);

  // Check that previously evaluated order ord-alshifa-001 has findings with rule_version: 1
  const orderBefore = memoryStore.getOrderById('11111111-1111-4111-8111-111111111111', 'ord-alshifa-001');
  if (orderBefore.latest_evaluation) {
    const findingV1 = orderBefore.latest_evaluation.findings.find((f) => f.rule_code === 'ER-MAT-005');
    if (findingV1) {
      assert.equal(findingV1.rule_version, 1);
    }
  }

  // D. Admin performs substantive update to rule
  const updateRes = await request('/api/admin/rules/ER-MAT-005', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { default_effort_days: 25 },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.version, 2, 'Substantive rule update must bump version to 2');

  // E. Verify old order evaluation still holds historical rule_version: 1 (Audit immutability)
  const orderAfter = memoryStore.getOrderById('11111111-1111-4111-8111-111111111111', 'ord-alshifa-001');
  if (orderAfter.latest_evaluation) {
    const findingHistorical = orderAfter.latest_evaluation.findings.find((f) => f.rule_code === 'ER-MAT-005');
    if (findingHistorical) {
      assert.equal(
        findingHistorical.rule_version,
        1,
        'Historical assessment finding must remain pinned to original rule_version'
      );
    }
  }
});

test('10. Legal Disclaimers & Privacy Policy (Feature F16)', async () => {
  const policyRes = await request('/api/legal/policy');
  assert.equal(policyRes.status, 200);
  assert.ok(policyRes.body.title);
  assert.ok(policyRes.body.sections.length >= 4);
  assert.ok(policyRes.body.sections.some((s) => s.id === 'data_privacy_and_nda'));
  assert.ok(policyRes.body.sections.some((s) => s.id === 'limitation_of_liability'));
});
