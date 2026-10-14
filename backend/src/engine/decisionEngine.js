'use strict';
/**
 * ExportReady :: Decision Engine (F7)
 * Spec: brain/04_engine_and_algorithms/DECISION_ENGINE_SPEC.md
 *
 * Pure and deterministic: no I/O, no clock, no randomness, inputs are never mutated.
 * Same input -> byte-identical output (findings are sorted by rule_code).
 */

const { toDayNumber, dayNumberToIso } = require('./dates');

const VERDICT = Object.freeze({ MET: 'met', GAP: 'gap', BLOCKER: 'blocker' });
const PROOF_GRADES = Object.freeze([
  'third_party_verified',
  'document_backed',
  'self_declared',
  'expired',
]);

function lookupEvidence(evidenceByRuleId, ruleId) {
  if (!evidenceByRuleId) return undefined;
  if (evidenceByRuleId instanceof Map) return evidenceByRuleId.get(ruleId) ?? undefined;
  return Object.prototype.hasOwnProperty.call(evidenceByRuleId, ruleId)
    ? evidenceByRuleId[ruleId] ?? undefined
    : undefined;
}

function assertRule(rule) {
  if (!rule || typeof rule !== 'object') throw new TypeError('applicableRules must contain rule objects');
  if (rule.id === undefined || rule.id === null || rule.id === '') {
    throw new TypeError(`rule ${rule.rule_code ?? '?'} is missing "id"`);
  }
  if (typeof rule.rule_code !== 'string' || rule.rule_code === '') {
    throw new TypeError(`rule ${rule.id} is missing "rule_code"`);
  }
  if (typeof rule.is_absolute !== 'boolean') {
    throw new TypeError(`${rule.rule_code}: "is_absolute" must be boolean`);
  }
  if (!Number.isInteger(rule.default_effort_days) || rule.default_effort_days < 0) {
    throw new TypeError(`${rule.rule_code}: "default_effort_days" must be a non-negative integer`);
  }
}

function buildFinding(rule, verdict, assignedEffortDays, auditRisk, reason) {
  return {
    rule_id: rule.id,
    rule_code: rule.rule_code,
    title: rule.title,
    verdict_status: verdict,
    assigned_effort_days: assignedEffortDays,
    audit_risk: auditRisk,
    is_absolute: rule.is_absolute,
    reason,
    citations: {
      fda_source_section: rule.fda_source_section ?? null,
      cfr_section: rule.cfr_section ?? null,
      iso_clause_number: rule.iso_clause_number ?? null,
    },
    rule_version: rule.version ?? 1,
  };
}

function evaluateRule(rule, evidence, refDay) {
  const effort = rule.default_effort_days;
  const absoluteNote = rule.is_absolute
    ? ' This is an absolute rule: no remediation plan or buyer waiver substitutes for it.'
    : '';

  // Missing evidence or self-declared only: absolute -> blocker, otherwise gap.
  const unproven = (why) =>
    rule.is_absolute
      ? buildFinding(rule, VERDICT.BLOCKER, effort, false, `${why}${absoluteNote}`)
      : buildFinding(rule, VERDICT.GAP, effort, false, why);

  if (!evidence) return unproven('No evidence on file for this rule.');

  if (!PROOF_GRADES.includes(evidence.proof_grade)) {
    throw new TypeError(`${rule.rule_code}: unknown proof_grade '${evidence.proof_grade}'`);
  }

  // Expired proof is always a blocker (stored grade 'expired' or expiry before the evaluation date).
  if (evidence.proof_grade === 'expired') {
    return buildFinding(rule, VERDICT.BLOCKER, effort, false, `Evidence is marked expired.${absoluteNote}`);
  }
  if (evidence.expiry_date !== undefined && evidence.expiry_date !== null) {
    const expiryDay = toDayNumber(evidence.expiry_date, `${rule.rule_code}.expiry_date`);
    if (expiryDay < refDay) {
      return buildFinding(
        rule,
        VERDICT.BLOCKER,
        effort,
        false,
        `Evidence expired on ${dayNumberToIso(expiryDay)}, before the evaluation date ${dayNumberToIso(refDay)}.${absoluteNote}`
      );
    }
  }

  switch (evidence.proof_grade) {
    case 'third_party_verified':
      return buildFinding(rule, VERDICT.MET, 0, false, 'Third-party verified evidence on file.');
    case 'document_backed':
      return buildFinding(
        rule,
        VERDICT.MET,
        0,
        true,
        'Document-backed evidence on file, not third-party verified: met, but carries audit risk.'
      );
    default: // 'self_declared'
      return unproven('Evidence is self-declared only; no supporting proof on file.');
  }
}

/**
 * @param {object}  args
 * @param {{id?:string, order_id?:string, shipment_deadline?:string|Date}} args.order
 * @param {object[]} args.applicableRules  rules that apply to the order (system-inferred + CONFIRMED buyer conditions);
 *        each needs id, rule_code, title, is_absolute, default_effort_days (+ optional version, active, citations)
 * @param {Object<string,object>|Map<string,object>} args.evidenceByRuleId  rule id -> factory_evidence row
 * @param {string|Date} [args.evaluationDate]  date evidence must be valid on; defaults to order.shipment_deadline
 */
function evaluateOrder({ order, applicableRules, evidenceByRuleId, evaluationDate } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('order is required');
  if (!Array.isArray(applicableRules)) throw new TypeError('applicableRules must be an array');

  const refDay = toDayNumber(evaluationDate ?? order.shipment_deadline, 'evaluationDate');

  const seen = new Set();
  const findings = [];
  for (const rule of applicableRules) {
    if (rule && rule.active === false) continue; // inactive rules are never evaluated
    assertRule(rule);
    if (seen.has(rule.rule_code)) throw new TypeError(`duplicate rule_code in applicableRules: ${rule.rule_code}`);
    seen.add(rule.rule_code);
    findings.push(evaluateRule(rule, lookupEvidence(evidenceByRuleId, rule.id), refDay));
  }
  findings.sort((a, b) => (a.rule_code < b.rule_code ? -1 : a.rule_code > b.rule_code ? 1 : 0));

  const summary = { total_rules: findings.length, met: 0, gap: 0, blocker: 0, audit_risk: 0, total_effort_days: 0 };
  for (const f of findings) {
    summary[f.verdict_status] += 1;
    if (f.audit_risk) summary.audit_risk += 1;
    summary.total_effort_days += f.assigned_effort_days;
  }

  const orderVerdict = summary.blocker > 0 ? 'BLOCKED' : summary.gap > 0 ? 'CONDITIONAL' : 'READY';

  return {
    order_id: order.id ?? order.order_id ?? null,
    evaluation_date: dayNumberToIso(refDay),
    order_verdict: orderVerdict,
    summary,
    findings,
  };
}

module.exports = { evaluateOrder, VERDICT, PROOF_GRADES };
