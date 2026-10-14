'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireFactoryTenant } = require('../middleware/auth');
const { evaluateOrder } = require('../engine/decisionEngine');
const { checkTimeFeasibility } = require('../engine/timeChecker');
const aiBridge = require('../services/aiBridge');

const router = express.Router();

router.use(requireAuth);
router.use(requireFactoryTenant);

/**
 * GET /api/orders
 * Returns all export orders belonging to the authenticated tenant.
 */
router.get('/', (req, res) => {
  const status = req.query.status;
  const orders = memoryStore.getOrdersByFactory(req.factoryId, status);
  return res.json(orders);
});

/**
 * POST /api/orders
 * Creates a new export order and auto-populates system-inferred rules.
 */
router.post('/', (req, res) => {
  const { product_name, product_code, quantity, shipment_deadline, financial_value_usd, buyer_contract_text } =
    req.body || {};

  if (!product_name || !quantity || !shipment_deadline) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'product_name, quantity, and shipment_deadline are required.',
      },
    });
  }

  const order = memoryStore.createOrder(req.factoryId, {
    product_name,
    product_code,
    quantity,
    shipment_deadline,
    financial_value_usd,
    buyer_contract_text,
  });

  return res.status(201).json(order);
});

/**
 * GET /api/orders/:id
 * Fetches order details, applicable rules, and latest evaluation.
 */
router.get('/:id', (req, res) => {
  const order = memoryStore.getOrderById(req.factoryId, req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: `Order '${req.params.id}' not found for authenticated factory.`,
      },
    });
  }

  const rules = memoryStore.getOrderRules(order.id);
  const latestEvaluation = memoryStore.getLatestAssessment(order.id);

  return res.json({
    ...order,
    rules,
    latest_evaluation: latestEvaluation,
  });
});

/**
 * POST /api/orders/:id/match-clauses (or /orders/:id/buyer-conditions/analyze)
 * Runs NLP clause matching against buyer contract text.
 */
async function matchClausesHandler(req, res) {
  const order = memoryStore.getOrderById(req.factoryId, req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.',
      },
    });
  }

  const contractText = req.body.buyer_contract_text || req.body.text || order.buyer_contract_text;
  if (!contractText) {
    return res.status(400).json({
      error: {
        code: 'NO_CONTRACT_TEXT',
        message: 'Order has no buyer_contract_text to analyze.',
      },
    });
  }

  const allRules = memoryStore.getRules({ active: true });
  const threshold = req.body.threshold ? parseFloat(req.body.threshold) : 0.65;

  const nlpResult = await aiBridge.matchBuyerConditions({
    text: contractText,
    threshold,
    rules: allRules,
  });

  // Persist candidate rules with confirmed_by_user = false
  const updatedOrderRules = memoryStore.addBuyerConditionCandidates(order.id, nlpResult.candidates);

  return res.json({
    order_id: order.id,
    total_clauses_evaluated: nlpResult.total_clauses_evaluated,
    candidates: nlpResult.candidates,
    order_rules: updatedOrderRules,
  });
}

router.post('/:id/match-clauses', matchClausesHandler);
router.post('/:id/buyer-conditions/analyze', matchClausesHandler);

/**
 * PUT /api/orders/:id/confirm-rules
 * Human-in-the-loop confirmation or rejection of matched buyer rules.
 */
router.put('/:id/confirm-rules', (req, res) => {
  const order = memoryStore.getOrderById(req.factoryId, req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.',
      },
    });
  }

  const { confirmations, rule_code, confirmed } = req.body || {};

  if (confirmations && Array.isArray(confirmations)) {
    confirmations.forEach((item) => {
      memoryStore.confirmOrderRule(order.id, item.rule_code || item.rule_id, item.confirmed);
    });
  } else if (rule_code !== undefined) {
    memoryStore.confirmOrderRule(order.id, rule_code, confirmed !== false);
  } else {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Expected confirmations array [{ rule_code, confirmed }] or { rule_code, confirmed }',
      },
    });
  }

  const updatedRules = memoryStore.getOrderRules(order.id);
  return res.json({
    order_id: order.id,
    rules: updatedRules,
  });
});

/**
 * POST /api/orders/:id/evaluate
 * Deterministic compliance evaluation + time feasibility check.
 */
router.post('/:id/evaluate', (req, res) => {
  const order = memoryStore.getOrderById(req.factoryId, req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.',
      },
    });
  }

  // 1. Gather applicable rules: active system-inferred + CONFIRMED buyer conditions
  const orderRules = memoryStore.getOrderRules(order.id);
  const applicableRuleCodes = new Set(
    orderRules.filter((r) => r.source_type === 'system_inferred' || r.confirmed_by_user).map((r) => r.rule_code)
  );

  const allRules = memoryStore.getRules({ active: true });
  const applicableRules = allRules.filter((r) => applicableRuleCodes.has(r.rule_code));

  // 2. Factory evidence map
  const factoryEvidenceList = memoryStore.getEvidenceByFactory(req.factoryId);
  const evidenceByRuleId = new Map();
  factoryEvidenceList.forEach((ev) => {
    evidenceByRuleId.set(ev.rule_id, ev);
  });

  const evaluationDate = req.body.evaluation_date || order.shipment_deadline;
  const safetyBufferDays = req.body.safety_buffer_days !== undefined ? parseInt(req.body.safety_buffer_days, 10) : 5;

  // 3. Run pure Decision Engine
  const evaluation = evaluateOrder({
    order,
    applicableRules,
    evidenceByRuleId,
    evaluationDate,
  });

  // 4. Run Time Feasibility
  const feasibility = checkTimeFeasibility({
    findings: evaluation.findings,
    shipmentDeadline: order.shipment_deadline,
    evaluationDate,
    safetyBufferDays,
  });

  // 5. Persist assessment findings pinned to rule_version
  memoryStore.saveAssessmentFindings(
    order.id,
    evaluation.findings,
    evaluation.evaluation_date,
    evaluation.summary,
    evaluation.order_verdict
  );

  return res.json({
    ...evaluation,
    feasibility,
    disclaimer: aiBridge.MANDATORY_LEGAL_DISCLAIMER,
  });
});

/**
 * GET /api/orders/:id/invoice-gatekeeper (Feature F13)
 * Blocks commercial invoice/packing list generation if compliance is incomplete.
 */
router.get('/:id/invoice-gatekeeper', (req, res) => {
  const order = memoryStore.getOrderById(req.factoryId, req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.',
      },
    });
  }

  // Check latest evaluation; if none exists, evaluate now
  let latest = memoryStore.getLatestAssessment(order.id);
  if (!latest) {
    const orderRules = memoryStore.getOrderRules(order.id);
    const applicableRuleCodes = new Set(
      orderRules.filter((r) => r.source_type === 'system_inferred' || r.confirmed_by_user).map((r) => r.rule_code)
    );
    const allRules = memoryStore.getRules({ active: true });
    const applicableRules = allRules.filter((r) => applicableRuleCodes.has(r.rule_code));
    const factoryEvidenceList = memoryStore.getEvidenceByFactory(req.factoryId);
    const evidenceByRuleId = new Map();
    factoryEvidenceList.forEach((ev) => evidenceByRuleId.set(ev.rule_id, ev));

    latest = evaluateOrder({
      order,
      applicableRules,
      evidenceByRuleId,
      evaluationDate: order.shipment_deadline,
    });
    memoryStore.saveAssessmentFindings(
      order.id,
      latest.findings,
      latest.evaluation_date,
      latest.summary,
      latest.order_verdict
    );
  }

  const violations = [];
  latest.findings.forEach((f) => {
    if (f.verdict_status === 'blocker') {
      violations.push({
        rule_code: f.rule_code,
        title: f.title,
        severity: 'BLOCKER',
        reason: f.reason,
        citations: f.citations,
      });
    } else if (f.verdict_status === 'gap') {
      violations.push({
        rule_code: f.rule_code,
        title: f.title,
        severity: 'GAP',
        reason: f.reason,
        citations: f.citations,
      });
    }
  });

  const canExport = latest.order_verdict === 'READY' && violations.length === 0;

  return res.json({
    order_id: order.id,
    product_name: order.product_name,
    order_verdict: latest.order_verdict,
    gatekeeper_result: canExport ? 'PASS' : 'BLOCK',
    can_export: canExport,
    commercial_invoice_status: canExport ? 'AUTHORIZED' : 'BLOCKED',
    packing_list_status: canExport ? 'AUTHORIZED' : 'BLOCKED',
    violations_count: violations.length,
    violations,
    audit_risk_count: latest.summary.audit_risk || 0,
    disclaimer: aiBridge.MANDATORY_LEGAL_DISCLAIMER,
  });
});

/**
 * GET /api/orders/:id/audit-report (Feature F14)
 * Generates structured, printable Audit Dossier report.
 */
router.get('/:id/audit-report', (req, res) => {
  const order = memoryStore.getOrderById(req.factoryId, req.params.id);
  if (!order) {
    return res.status(404).json({
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.',
      },
    });
  }

  const factory = memoryStore.getFactoryById(req.factoryId);
  const latest = memoryStore.getLatestAssessment(order.id);

  if (!latest) {
    return res.status(400).json({
      error: {
        code: 'NOT_EVALUATED',
        message: 'Order must be evaluated before an Audit Dossier can be generated.',
      },
    });
  }

  const dossier = {
    report_title: 'ExportReady :: US FDA Export Compliance Readiness Audit Dossier',
    generated_at: new Date().toISOString(),
    factory: {
      legal_name: factory.legal_name,
      chamber_registration: factory.chamber_registration_number,
      fda_establishment_number: factory.fda_establishment_number,
      fda_green_list_status: factory.fda_green_list_status,
    },
    order: {
      id: order.id,
      product_name: order.product_name,
      product_code: order.product_code,
      quantity: order.quantity,
      shipment_deadline: order.shipment_deadline,
      financial_value_usd: order.financial_value_usd,
      order_verdict: latest.order_verdict,
    },
    executive_summary: {
      total_rules_evaluated: latest.summary.total_rules,
      met: latest.summary.met,
      gap: latest.summary.gap,
      blocker: latest.summary.blocker,
      audit_risk_rules: latest.summary.audit_risk,
      total_repair_effort_days: latest.summary.total_effort_days,
    },
    statutory_findings: latest.findings.map((f) => ({
      rule_code: f.rule_code,
      title: f.title,
      verdict: f.verdict_status,
      assigned_effort_days: f.assigned_effort_days,
      audit_risk: f.audit_risk,
      reason: f.reason,
      citations: f.citations,
      rule_version: f.rule_version,
    })),
    disclaimer: aiBridge.MANDATORY_LEGAL_DISCLAIMER,
  };

  return res.json(dossier);
});

module.exports = router;
