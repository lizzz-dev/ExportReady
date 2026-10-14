'use strict';
/**
 * Core engine tests (node:test). Uses the REAL rule catalogue:
 * brain/03_rules_knowledge_base/rules_master_25.json
 * Specs: brain/04_engine_and_algorithms/*.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { evaluateOrder, checkTimeFeasibility, solveGreedy, solveExact, compareFixPlans } = require('../src/engine');
const engineBarrel = require('../src/engine');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const RULES_FILE = path.resolve(__dirname, '..', '..', 'brain', '03_rules_knowledge_base', 'rules_master_25.json');
const RAW_RULES = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
// The JSON carries no DB ids/versions; the DB assigns them. Tests use rule_code as id and version 1.
const RULES = RAW_RULES.map((r) => ({ ...r, id: r.rule_code, version: 1 }));
const RULE = Object.fromEntries(RULES.map((r) => [r.rule_code, r]));

const TODAY = '2026-10-14';
const ORDER = { id: 'ORD-1', shipment_deadline: '2027-03-01' };
const REF = '2027-03-01'; // date evidence must be valid on

const ev = (grade, expiry = '2030-01-01') => ({
  proof_grade: grade,
  issue_date: '2025-01-01',
  expiry_date: expiry,
});

/** Evidence for every rule at `grade`; overrides: { RULE_CODE: evidenceObject | null(missing) }. */
function evidenceFor(grade, overrides = {}) {
  const out = {};
  for (const r of RULES) out[r.id] = ev(grade);
  for (const [code, value] of Object.entries(overrides)) {
    if (value === null) delete out[RULE[code].id];
    else out[RULE[code].id] = value;
  }
  return out;
}

function evaluate(evidenceByRuleId, extra = {}) {
  return evaluateOrder({
    order: ORDER,
    applicableRules: RULES,
    evidenceByRuleId,
    evaluationDate: REF,
    ...extra,
  });
}

const finding = (result, code) => result.findings.find((f) => f.rule_code === code);

/** Order whose only shortfalls are `gapCodes` (missing evidence); everything else third-party verified. */
function makeOrder(orderId, valueUsd, gapCodes = [], extra = {}) {
  const overrides = Object.fromEntries(gapCodes.map((c) => [c, null]));
  const res = evaluate(evidenceFor('third_party_verified', overrides));
  return { order_id: orderId, financial_value_usd: valueUsd, findings: res.findings, ...extra };
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const stripRuntime = (plan) => JSON.parse(JSON.stringify(plan, (k, v) => (k === 'runtime_ms' ? undefined : v)));

// ---------------------------------------------------------------------------
// Catalogue sanity
// ---------------------------------------------------------------------------
test('rule catalogue: 25 rules, 3 absolute, 722 summed effort days', () => {
  assert.equal(RULES.length, 25);
  assert.deepEqual(
    RULES.filter((r) => r.is_absolute).map((r) => r.rule_code),
    ['ER-REG-001', 'ER-REG-002', 'ER-REG-003']
  );
  assert.equal(RULES.reduce((a, r) => a + r.default_effort_days, 0), 722);
});

test('barrel exports all engine functions', () => {
  for (const name of ['evaluateOrder', 'checkTimeFeasibility', 'solveGreedy', 'solveExact', 'compareFixPlans']) {
    assert.equal(typeof engineBarrel[name], 'function', name);
  }
  assert.equal(typeof engineBarrel.decisionEngine.evaluateOrder, 'function');
  assert.equal(typeof engineBarrel.timeChecker.checkTimeFeasibility, 'function');
  assert.equal(typeof engineBarrel.fixPlanner.compareFixPlans, 'function');
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
test('determinism: identical output across 50 runs, inputs untouched, input order irrelevant', () => {
  const evidence = evidenceFor('document_backed', {
    'ER-REG-001': null,
    'ER-PAS-009': ev('self_declared'),
    'ER-MAT-005': ev('third_party_verified'),
    'ER-CAL-018': ev('expired'),
    'ER-DOC-013': ev('document_backed', '2027-02-01'),
  });
  const snapshot = JSON.stringify({ ORDER, RULES, evidence });
  const first = JSON.stringify(evaluate(evidence));
  for (let i = 0; i < 50; i += 1) assert.equal(JSON.stringify(evaluate(evidence)), first);
  assert.equal(JSON.stringify({ ORDER, RULES, evidence }), snapshot, 'inputs must not be mutated');

  const shuffled = [...RULES].reverse();
  const reordered = JSON.stringify(
    evaluateOrder({ order: ORDER, applicableRules: shuffled, evidenceByRuleId: evidence, evaluationDate: REF })
  );
  assert.equal(reordered, first, 'rule input order must not change the output');

  const findings = JSON.parse(first).findings;
  const t0 = JSON.stringify(checkTimeFeasibility({ findings, shipmentDeadline: '2027-03-01', evaluationDate: TODAY }));
  for (let i = 0; i < 50; i += 1) {
    assert.equal(
      JSON.stringify(checkTimeFeasibility({ findings, shipmentDeadline: '2027-03-01', evaluationDate: TODAY })),
      t0
    );
  }

  const orders = [makeOrder('A', 50000, ['ER-PAS-009']), makeOrder('B', 30000, ['ER-PAS-009', 'ER-PAS-011'])];
  const p0 = JSON.stringify(stripRuntime(compareFixPlans({ orders, capacityDays: 60 })));
  for (let i = 0; i < 50; i += 1) {
    assert.equal(JSON.stringify(stripRuntime(compareFixPlans({ orders, capacityDays: 60 }))), p0);
  }
});

// ---------------------------------------------------------------------------
// Decision engine: proof grades
// ---------------------------------------------------------------------------
test('third_party_verified -> met, audit_risk false, zero effort', () => {
  const r = evaluate(evidenceFor('third_party_verified'));
  assert.equal(r.order_verdict, 'READY');
  for (const f of r.findings) {
    assert.equal(f.verdict_status, 'met');
    assert.equal(f.audit_risk, false);
    assert.equal(f.assigned_effort_days, 0);
  }
  assert.deepEqual(r.summary, { total_rules: 25, met: 25, gap: 0, blocker: 0, audit_risk: 0, total_effort_days: 0 });
});

test('document_backed -> met with audit_risk true (still READY)', () => {
  const r = evaluate(evidenceFor('document_backed'));
  assert.equal(r.order_verdict, 'READY');
  for (const f of r.findings) {
    assert.equal(f.verdict_status, 'met');
    assert.equal(f.audit_risk, true);
    assert.equal(f.assigned_effort_days, 0);
  }
  assert.equal(r.summary.audit_risk, 25);
});

test('self_declared: non-absolute -> gap with full default effort; absolute -> blocker', () => {
  const r = evaluate(evidenceFor('self_declared'));
  const pas = finding(r, 'ER-PAS-009');
  assert.equal(pas.verdict_status, 'gap');
  assert.equal(pas.assigned_effort_days, RULE['ER-PAS-009'].default_effort_days); // 45, no discount
  assert.equal(pas.audit_risk, false);
  for (const code of ['ER-REG-001', 'ER-REG-002', 'ER-REG-003']) {
    const f = finding(r, code);
    assert.equal(f.verdict_status, 'blocker', code);
    assert.equal(f.assigned_effort_days, RULE[code].default_effort_days);
  }
  assert.equal(r.summary.blocker, 3);
  assert.equal(r.summary.gap, 22);
  assert.equal(r.order_verdict, 'BLOCKED');
});

test('missing evidence: non-absolute -> gap, absolute -> blocker; all missing sums to 722 days', () => {
  const r = evaluate({});
  assert.equal(finding(r, 'ER-MAT-005').verdict_status, 'gap');
  assert.equal(finding(r, 'ER-REG-001').verdict_status, 'blocker');
  assert.equal(r.summary.total_effort_days, 722);
  assert.equal(r.summary.met, 0);
  assert.equal(r.order_verdict, 'BLOCKED');
});

test('expired proof -> blocker even for a non-absolute rule (grade "expired")', () => {
  const r = evaluate(evidenceFor('third_party_verified', { 'ER-PAS-009': ev('expired') }));
  const f = finding(r, 'ER-PAS-009');
  assert.equal(RULE['ER-PAS-009'].is_absolute, false);
  assert.equal(f.verdict_status, 'blocker');
  assert.equal(f.assigned_effort_days, 45);
  assert.equal(f.audit_risk, false);
  assert.equal(r.order_verdict, 'BLOCKED');
});

test('expired proof -> blocker when expiry_date < evaluationDate, boundary exact', () => {
  const dayBefore = evaluate(evidenceFor('third_party_verified', { 'ER-CAL-018': ev('third_party_verified', '2027-02-28') }));
  assert.equal(finding(dayBefore, 'ER-CAL-018').verdict_status, 'blocker');
  assert.match(finding(dayBefore, 'ER-CAL-018').reason, /2027-02-28/);

  const onDay = evaluate(evidenceFor('third_party_verified', { 'ER-CAL-018': ev('third_party_verified', '2027-03-01') }));
  assert.equal(finding(onDay, 'ER-CAL-018').verdict_status, 'met', 'expiry on the evaluation date is still valid');

  const noExpiry = evaluate(evidenceFor('third_party_verified', { 'ER-CAL-018': { proof_grade: 'document_backed', expiry_date: null } }));
  assert.equal(finding(noExpiry, 'ER-CAL-018').verdict_status, 'met');
});

test('expired absolute rule is a blocker; expiry beats a strong stored grade', () => {
  const r = evaluate(evidenceFor('third_party_verified', { 'ER-REG-002': ev('third_party_verified', '2020-01-01') }));
  assert.equal(finding(r, 'ER-REG-002').verdict_status, 'blocker');
});

test('evaluationDate defaults to shipment_deadline and Date objects are accepted', () => {
  const evidence = evidenceFor('third_party_verified', { 'ER-CAL-018': ev('third_party_verified', '2027-02-28') });
  const a = evaluateOrder({ order: ORDER, applicableRules: RULES, evidenceByRuleId: evidence });
  assert.equal(a.evaluation_date, '2027-03-01');
  assert.equal(finding(a, 'ER-CAL-018').verdict_status, 'blocker');
  const b = evaluateOrder({
    order: ORDER,
    applicableRules: RULES,
    evidenceByRuleId: evidence,
    evaluationDate: new Date(Date.UTC(2027, 1, 20)),
  });
  assert.equal(finding(b, 'ER-CAL-018').verdict_status, 'met');
});

test('every finding has the full contract (ids, citations, version, reason)', () => {
  const r = evaluate(evidenceFor('document_backed', { 'ER-REG-001': null, 'ER-PAS-009': ev('self_declared') }));
  for (const f of r.findings) {
    assert.deepEqual(
      Object.keys(f).sort(),
      [
        'assigned_effort_days', 'audit_risk', 'citations', 'is_absolute', 'reason',
        'rule_code', 'rule_id', 'rule_version', 'title', 'verdict_status',
      ].sort()
    );
    assert.ok(['met', 'gap', 'blocker'].includes(f.verdict_status));
    assert.ok(f.reason.length > 0);
    assert.deepEqual(Object.keys(f.citations).sort(), ['cfr_section', 'fda_source_section', 'iso_clause_number']);
  }
  const reg = finding(r, 'ER-REG-001');
  assert.equal(reg.rule_id, 'ER-REG-001');
  assert.equal(reg.rule_version, 1);
  assert.equal(reg.title, RULE['ER-REG-001'].title);
  assert.equal(reg.citations.cfr_section, RULE['ER-REG-001'].cfr_section);
  assert.equal(reg.citations.iso_clause_number, '4.1.1');
  assert.equal(reg.citations.fda_source_section, RULE['ER-REG-001'].fda_source_section);
});

test('order verdicts: READY / CONDITIONAL / BLOCKED, inactive rules skipped, bad input rejected', () => {
  assert.equal(evaluate(evidenceFor('third_party_verified')).order_verdict, 'READY');
  const cond = evaluate(evidenceFor('third_party_verified', { 'ER-PAS-011': null }));
  assert.equal(cond.order_verdict, 'CONDITIONAL');
  assert.equal(cond.summary.total_effort_days, 7);

  const inactive = RULES.map((r) => (r.rule_code === 'ER-REG-001' ? { ...r, active: false } : r));
  const skipped = evaluateOrder({ order: ORDER, applicableRules: inactive, evidenceByRuleId: evidenceFor('third_party_verified', { 'ER-REG-001': null }), evaluationDate: REF });
  assert.equal(skipped.findings.length, 24);
  assert.equal(skipped.order_verdict, 'READY');

  assert.throws(() => evaluate(evidenceFor('third_party_verified', { 'ER-PAS-009': ev('platinum') })), /unknown proof_grade/);
  assert.throws(() => evaluate({}, { evaluationDate: 'tomorrow' }), /expected 'YYYY-MM-DD'/);
  assert.throws(() => evaluate({}, { evaluationDate: '2027-02-30' }), /not a real calendar date/);
  assert.throws(() => evaluateOrder({ order: ORDER, applicableRules: [RULES[0], RULES[0]], evidenceByRuleId: {}, evaluationDate: REF }), /duplicate rule_code/);
  assert.throws(() => evaluateOrder({ order: ORDER, applicableRules: 'x' }), /array/);
});

test('evidenceByRuleId may be a Map', () => {
  const map = new Map(Object.entries(evidenceFor('third_party_verified')));
  const r = evaluateOrder({ order: ORDER, applicableRules: RULES, evidenceByRuleId: map, evaluationDate: REF });
  assert.equal(r.order_verdict, 'READY');
});

// ---------------------------------------------------------------------------
// Time feasibility
// ---------------------------------------------------------------------------
function findingsWithGaps(...codes) {
  return evaluate(evidenceFor('third_party_verified', Object.fromEntries(codes.map((c) => [c, null])))).findings;
}

test('time: FEASIBLE when effort + buffer fits', () => {
  const findings = findingsWithGaps('ER-PAS-011', 'ER-PAS-012'); // 7 + 7 = 14
  const r = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 30), evaluationDate: TODAY });
  assert.equal(r.verdict, 'FEASIBLE');
  assert.equal(r.available_days, 30);
  assert.equal(r.total_effort_days, 14);
  assert.equal(r.safety_buffer_days, 5);
  assert.equal(r.margin_days, 11);
  assert.deepEqual(r.counts, { met: 23, gap: 2, blocker: 0 });
  assert.ok(r.rationale.length > 0);
});

test('time: boundaries - effort+buffer == available is FEASIBLE, effort == available is AT_RISK', () => {
  const findings = findingsWithGaps('ER-PAS-011', 'ER-PAS-012'); // 14
  const exact = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 19), evaluationDate: TODAY });
  assert.equal(exact.verdict, 'FEASIBLE');
  assert.equal(exact.margin_days, 0);
  const tight = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 14), evaluationDate: TODAY });
  assert.equal(tight.verdict, 'AT_RISK');
  assert.equal(tight.margin_days, -5);
});

test('time: AT_RISK when effort fits but the safety buffer does not', () => {
  const findings = findingsWithGaps('ER-PAS-011', 'ER-PAS-012'); // 14
  const r = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 17), evaluationDate: TODAY });
  assert.equal(r.verdict, 'AT_RISK');
  assert.equal(r.margin_days, -2);
});

test('time: NOT_FEASIBLE because effort exceeds available days', () => {
  const findings = findingsWithGaps('ER-PAS-009', 'ER-DOC-013'); // 45 + 60 = 105
  const r = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 90), evaluationDate: TODAY });
  assert.equal(r.verdict, 'NOT_FEASIBLE');
  assert.equal(r.total_effort_days, 105);
  assert.equal(r.counts.blocker, 0);
  assert.match(r.rationale, /cannot fit/);
});

test('time: NOT_FEASIBLE with ONE blocker despite ample time', () => {
  const findings = findingsWithGaps('ER-REG-002'); // absolute, 14 days
  assert.equal(findings.filter((f) => f.verdict_status === 'blocker').length, 1);
  const r = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 365), evaluationDate: TODAY });
  assert.equal(r.verdict, 'NOT_FEASIBLE');
  assert.ok(r.total_effort_days + r.safety_buffer_days < r.available_days, 'time alone would have been enough');
  assert.equal(r.counts.blocker, 1);
  assert.match(r.rationale, /ER-REG-002/);
});

test('time: expired non-absolute evidence (a blocker) also forces NOT_FEASIBLE', () => {
  const findings = evaluate(evidenceFor('third_party_verified', { 'ER-PAS-011': ev('expired') })).findings;
  const r = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 200), evaluationDate: TODAY });
  assert.equal(r.verdict, 'NOT_FEASIBLE');
});

test('time: no gaps -> FEASIBLE; passed deadline -> NOT_FEASIBLE; custom buffer; validation', () => {
  const clean = evaluate(evidenceFor('third_party_verified')).findings;
  assert.equal(checkTimeFeasibility({ findings: clean, shipmentDeadline: TODAY, evaluationDate: TODAY }).verdict, 'FEASIBLE');
  const late = checkTimeFeasibility({ findings: clean, shipmentDeadline: addDays(TODAY, -3), evaluationDate: TODAY });
  assert.equal(late.verdict, 'NOT_FEASIBLE');
  assert.equal(late.available_days, -3);

  const findings = findingsWithGaps('ER-PAS-011'); // 7
  const noBuf = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 8), evaluationDate: TODAY, safetyBufferDays: 0 });
  assert.equal(noBuf.verdict, 'FEASIBLE');
  assert.equal(noBuf.safety_buffer_days, 0);
  const bigBuf = checkTimeFeasibility({ findings, shipmentDeadline: addDays(TODAY, 8), evaluationDate: TODAY, safetyBufferDays: 10 });
  assert.equal(bigBuf.verdict, 'AT_RISK');

  assert.throws(() => checkTimeFeasibility({ findings, shipmentDeadline: TODAY, evaluationDate: TODAY, safetyBufferDays: -1 }), /safetyBufferDays/);
  assert.throws(() => checkTimeFeasibility({ findings: null, shipmentDeadline: TODAY, evaluationDate: TODAY }), /array/);
  assert.throws(() => checkTimeFeasibility({ findings, shipmentDeadline: 'x', evaluationDate: TODAY }), /shipmentDeadline/);
});

test('time: result shape is exactly the documented contract', () => {
  const r = checkTimeFeasibility({ findings: findingsWithGaps('ER-PAS-011'), shipmentDeadline: addDays(TODAY, 30), evaluationDate: TODAY });
  assert.deepEqual(
    Object.keys(r).sort(),
    ['available_days', 'counts', 'margin_days', 'rationale', 'safety_buffer_days', 'total_effort_days', 'verdict']
  );
});

// ---------------------------------------------------------------------------
// SUKP fix planner
// ---------------------------------------------------------------------------
test('planner: shared repairs are paid once (union), additive cost would reject A+B', () => {
  const orders = [
    makeOrder('A', 50000, ['ER-PAS-009']), // 45
    makeOrder('B', 30000, ['ER-PAS-009', 'ER-PAS-011']), // 45 + 7, shares PAS-009 with A
    makeOrder('D', 40000, ['ER-DOC-013']), // 60
  ];
  // additive cost of A+B would be 45 + 52 = 97 > 60; union cost is 52
  for (const solve of [solveGreedy, solveExact]) {
    const r = solve({ orders, capacityDays: 60 });
    assert.deepEqual(r.unlocked_orders, ['A', 'B'], r.solver);
    assert.equal(r.unlocked_revenue_usd, 80000, r.solver);
    assert.equal(r.total_effort_days, 52, r.solver);
    assert.equal(r.remaining_capacity_days, 8, r.solver);
    assert.deepEqual(r.selected_gap_repairs.map((x) => [x.rule_code, x.effort_days]), [['ER-PAS-009', 45], ['ER-PAS-011', 7]]);
    assert.deepEqual(r.not_selected_orders.map((o) => o.order_id), ['D']);
  }
});

test('planner: Greedy is suboptimal where Exact is optimal', () => {
  const orders = [
    makeOrder('P', 46000, ['ER-PAS-009']), // 45d, ratio ~1022 $/day -> greedy grabs it first
    makeOrder('Q', 30000, ['ER-CAPA-025']), // 30d, 1000 $/day
    makeOrder('R', 30000, ['ER-MAT-008']), // 30d, 1000 $/day
  ];
  const greedy = solveGreedy({ orders, capacityDays: 60 });
  assert.deepEqual(greedy.unlocked_orders, ['P']);
  assert.equal(greedy.unlocked_revenue_usd, 46000);

  const exact = solveExact({ orders, capacityDays: 60 });
  assert.deepEqual(exact.unlocked_orders, ['Q', 'R']);
  assert.equal(exact.unlocked_revenue_usd, 60000);
  assert.equal(exact.total_effort_days, 60);

  const cmp = compareFixPlans({ orders, capacityDays: 60 });
  assert.equal(cmp.optimality.exact_available, true);
  assert.equal(cmp.optimality.greedy_is_optimal, false);
  assert.equal(cmp.optimality.gap_usd, 14000);
  assert.ok(Math.abs(cmp.optimality.gap_ratio - 14000 / 60000) < 1e-12);
  assert.equal(cmp.unlocked_revenue_usd, 60000);
  assert.deepEqual(cmp.unlocked_orders, ['Q', 'R']);
  assert.deepEqual(cmp.selected_gap_repairs.map((r) => r.rule_code), ['ER-CAPA-025', 'ER-MAT-008']);
  assert.equal(typeof cmp.greedy.runtime_ms, 'number');
  assert.equal(typeof cmp.exact.runtime_ms, 'number');
  assert.ok(cmp.greedy.runtime_ms >= 0 && cmp.exact.runtime_ms >= 0);
});

test('planner: orders with absolute blockers are separated as unfixable', () => {
  const orders = [
    makeOrder('NOGREEN', 900000, ['ER-REG-001', 'ER-PAS-009']), // absolute blocker + a gap
    makeOrder('FIXABLE', 20000, ['ER-PAS-011']),
    makeOrder('READY', 15000, []),
  ];
  for (const solve of [solveGreedy, solveExact]) {
    const r = solve({ orders, capacityDays: 365 });
    assert.deepEqual(r.unfixable_orders.map((o) => o.order_id), ['NOGREEN'], r.solver);
    assert.deepEqual(r.unfixable_orders[0].absolute_blockers, ['ER-REG-001']);
    assert.equal(r.unfixable_orders[0].financial_value_usd, 900000);
    assert.deepEqual(r.ready_orders.map((o) => o.order_id), ['READY']);
    assert.deepEqual(r.unlocked_orders, ['FIXABLE']);
    assert.equal(r.unlocked_revenue_usd, 20000, 'unfixable and already-ready revenue is not counted as unlocked');
  }
});

test('planner: expired NON-absolute evidence is repairable (renewal), not unfixable', () => {
  const expired = evaluate(evidenceFor('third_party_verified', { 'ER-PAS-009': ev('expired') })).findings;
  const orders = [{ order_id: 'E', financial_value_usd: 10000, findings: expired }];
  const r = solveExact({ orders, capacityDays: 60 });
  assert.deepEqual(r.unfixable_orders, []);
  assert.deepEqual(r.unlocked_orders, ['E']);
  assert.deepEqual(r.selected_gap_repairs.map((x) => x.rule_code), ['ER-PAS-009']);
});

test('planner: capacity edge cases, per-order deadline filter, zero value, validation', () => {
  const orders = [makeOrder('A', 10000, ['ER-PAS-009'])];
  assert.deepEqual(solveGreedy({ orders, capacityDays: 44 }).unlocked_orders, []);
  assert.deepEqual(solveExact({ orders, capacityDays: 44 }).unlocked_orders, []);
  assert.deepEqual(solveExact({ orders, capacityDays: 45 }).unlocked_orders, ['A']);
  assert.deepEqual(solveGreedy({ orders, capacityDays: 0 }).unlocked_orders, []);

  const dated = [makeOrder('LATE', 10000, ['ER-PAS-009'], { available_days: 30 }), makeOrder('OK', 5000, ['ER-PAS-011'], { available_days: 30 })];
  const r = solveExact({ orders: dated, capacityDays: 100 });
  assert.deepEqual(r.infeasible_orders.map((o) => o.order_id), ['LATE']);
  assert.equal(r.infeasible_orders[0].required_days, 45);
  assert.deepEqual(r.unlocked_orders, ['OK']);

  const zero = solveExact({ orders: [makeOrder('Z', null, ['ER-PAS-009'])], capacityDays: 100 });
  assert.deepEqual(zero.unlocked_orders, []);
  assert.deepEqual(zero.not_selected_orders.map((o) => o.order_id), ['Z']);

  assert.throws(() => solveGreedy({ orders, capacityDays: -1 }), /capacityDays/);
  assert.throws(() => solveExact({ orders: [orders[0], orders[0]], capacityDays: 10 }), /duplicate order_id/);
  assert.throws(
    () => solveGreedy({ orders: [{ order_id: 'X', financial_value_usd: 1, findings: [{ rule_code: 'R', verdict_status: 'blocker', assigned_effort_days: 1 }] }], capacityDays: 5 }),
    /is_absolute/
  );
});

test('planner: exact solver equals brute force on 300 seeded random portfolios; greedy never beats exact', () => {
  const pool = ['ER-PAS-009', 'ER-PAS-010', 'ER-PAS-011', 'ER-PAS-012', 'ER-DOC-013', 'ER-DOC-014', 'ER-CAL-018', 'ER-CAPA-025', 'ER-MAT-008', 'ER-CLN-023'];
  let seed = 123456789;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const weight = Object.fromEntries(pool.map((c) => [c, RULE[c].default_effort_days]));
  let greedyStrictlyWorse = 0;

  for (let iter = 0; iter < 300; iter += 1) {
    const n = 2 + Math.floor(rnd() * 7); // 2..8 orders
    const orders = [];
    const needs = [];
    for (let i = 0; i < n; i += 1) {
      const codes = pool.filter(() => rnd() < 0.3);
      if (codes.length === 0) codes.push(pool[Math.floor(rnd() * pool.length)]);
      const value = 1000 * (1 + Math.floor(rnd() * 100));
      orders.push(makeOrder(`O${String(i).padStart(2, '0')}`, value, codes));
      needs.push({ codes, value });
    }
    const capacity = 20 + Math.floor(rnd() * 200);

    let bestValue = 0;
    for (let mask = 0; mask < 1 << n; mask += 1) {
      const union = new Set();
      let value = 0;
      for (let i = 0; i < n; i += 1) {
        if (mask & (1 << i)) {
          needs[i].codes.forEach((c) => union.add(c));
          value += needs[i].value;
        }
      }
      let cost = 0;
      union.forEach((c) => (cost += weight[c]));
      if (cost <= capacity && value > bestValue) bestValue = value;
    }

    const exact = solveExact({ orders, capacityDays: capacity });
    const greedy = solveGreedy({ orders, capacityDays: capacity });
    assert.equal(exact.unlocked_revenue_usd, bestValue, `iter ${iter}: exact must be optimal`);
    assert.ok(exact.total_effort_days <= capacity);
    assert.ok(greedy.total_effort_days <= capacity);
    assert.ok(greedy.unlocked_revenue_usd <= exact.unlocked_revenue_usd, `iter ${iter}: greedy cannot beat optimal`);
    if (greedy.unlocked_revenue_usd < exact.unlocked_revenue_usd) greedyStrictlyWorse += 1;
  }
  assert.ok(greedyStrictlyWorse > 0, 'random set should contain at least one instance where greedy is suboptimal');
});

test('planner: exact solver reports state-limit instead of silently degrading', () => {
  const pool = ['ER-PAS-009', 'ER-PAS-010', 'ER-PAS-011', 'ER-PAS-012', 'ER-DOC-013', 'ER-DOC-014'];
  const orders = pool.map((c, i) => makeOrder(`S${i}`, 1000 + i, [c]));
  assert.throws(() => solveExact({ orders, capacityDays: 1000, maxStates: 3 }), { code: 'EXACT_STATE_LIMIT' });
  const cmp = compareFixPlans({ orders, capacityDays: 1000, maxStates: 3 });
  assert.equal(cmp.exact, null);
  assert.equal(cmp.optimality.exact_available, false);
  assert.ok(cmp.greedy.unlocked_orders.length > 0);
});

test('end-to-end: evaluate -> time check -> plan on the real catalogue', () => {
  const evidence = evidenceFor('third_party_verified', {
    'ER-PAS-009': null,
    'ER-PAS-011': ev('self_declared'),
  });
  const result = evaluate(evidence);
  assert.equal(result.order_verdict, 'CONDITIONAL');
  assert.equal(result.summary.total_effort_days, 52);
  const time = checkTimeFeasibility({ findings: result.findings, shipmentDeadline: '2026-12-31', evaluationDate: TODAY });
  assert.equal(time.verdict, 'FEASIBLE'); // 78 days available, 52 + 5 needed
  const plan = compareFixPlans({
    orders: [{ order_id: 'ORD-1', financial_value_usd: 42000, findings: result.findings }],
    capacityDays: 60,
  });
  assert.deepEqual(plan.unlocked_orders, ['ORD-1']);
  assert.equal(plan.unlocked_revenue_usd, 42000);
  assert.equal(plan.optimality.greedy_is_optimal, true);
});
