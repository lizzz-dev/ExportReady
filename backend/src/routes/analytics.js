'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireFactoryTenant } = require('../middleware/auth');
const { evaluateOrder } = require('../engine/decisionEngine');

const router = express.Router();

router.use(requireAuth);
router.use(requireFactoryTenant);

/**
 * GET /api/analytics/dashboard (Feature F10)
 * Aggregates:
 * 1. Compliance Subsystem Radar Heatmap
 * 2. Order Pipeline Risk Matrix
 * 3. Revenue Bottleneck Pareto Chart
 * 4. Calibration & Certificate Expiry Timeline
 */
router.get('/dashboard', (req, res) => {
  const factoryId = req.factoryId;
  const allRules = memoryStore.getRules({ active: true });
  const rawEvidence = memoryStore.getEvidenceByFactory(factoryId);
  const factoryOrders = memoryStore.getOrdersByFactory(factoryId);

  const evidenceMap = new Map();
  rawEvidence.forEach((e) => evidenceMap.set(e.rule_id, e));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr);

  // 1. Compliance Subsystem Radar Heatmap
  const categoryStats = {};
  allRules.forEach((rule) => {
    const cat = rule.category || 'general';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { category: cat, total_rules: 0, met_rules: 0 };
    }
    categoryStats[cat].total_rules += 1;

    const ev = evidenceMap.get(rule.id);
    const isExpired = ev && ev.expiry_date && ev.expiry_date < todayStr;
    const isMet = ev && !isExpired && (ev.proof_grade === 'third_party_verified' || ev.proof_grade === 'document_backed');

    if (isMet) {
      categoryStats[cat].met_rules += 1;
    }
  });

  const radar = Object.values(categoryStats).map((c) => ({
    category: c.category,
    total_rules: c.total_rules,
    met_rules: c.met_rules,
    readiness_pct: Math.round((c.met_rules / c.total_rules) * 100),
  }));

  // Ensure all orders are evaluated to compute accurate matrix & pareto
  const evaluatedOrders = factoryOrders.map((order) => {
    let latest = memoryStore.getLatestAssessment(order.id);
    if (!latest) {
      const orderRules = memoryStore.getOrderRules(order.id);
      const applicableRuleCodes = new Set(
        orderRules.filter((r) => r.source_type === 'system_inferred' || r.confirmed_by_user).map((r) => r.rule_code)
      );
      const applicableRules = allRules.filter((r) => applicableRuleCodes.has(r.rule_code));
      latest = evaluateOrder({
        order,
        applicableRules,
        evidenceByRuleId: evidenceMap,
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
    return { order, evaluation: latest };
  });

  // 2. Order Pipeline Risk Matrix
  const riskMatrix = evaluatedOrders.map(({ order, evaluation }) => {
    const diffMs = new Date(order.shipment_deadline) - todayDate;
    const availableDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const totalEffortDays = evaluation.summary.total_effort_days || 0;
    const blockers = evaluation.summary.blocker || 0;
    const gaps = evaluation.summary.gap || 0;

    let riskLevel = 'LOW';
    if (blockers > 0) {
      riskLevel = 'CRITICAL';
    } else if (gaps > 0) {
      riskLevel = totalEffortDays > availableDays ? 'CRITICAL' : totalEffortDays > availableDays - 5 ? 'HIGH' : 'MEDIUM';
    } else if (evaluation.summary.audit_risk > 0) {
      riskLevel = 'MEDIUM';
    }

    return {
      order_id: order.id,
      product_name: order.product_name,
      product_code: order.product_code,
      financial_value_usd: order.financial_value_usd,
      shipment_deadline: order.shipment_deadline,
      available_days: availableDays,
      total_effort_days: totalEffortDays,
      order_verdict: evaluation.order_verdict,
      risk_level: riskLevel,
    };
  });

  // 3. Revenue Bottleneck Pareto Chart
  const paretoByRule = new Map();
  evaluatedOrders.forEach(({ order, evaluation }) => {
    const orderVal = Number(order.financial_value_usd || 0);
    evaluation.findings.forEach((f) => {
      if (f.verdict_status === 'blocker' || f.verdict_status === 'gap') {
        const existing = paretoByRule.get(f.rule_code) || {
          rule_code: f.rule_code,
          title: f.title,
          category: allRules.find((r) => r.rule_code === f.rule_code)?.category || 'general',
          blocked_revenue_usd: 0,
          affected_orders_count: 0,
        };
        existing.blocked_revenue_usd += orderVal;
        existing.affected_orders_count += 1;
        paretoByRule.set(f.rule_code, existing);
      }
    });
  });

  const pareto = Array.from(paretoByRule.values()).sort(
    (a, b) => b.blocked_revenue_usd - a.blocked_revenue_usd
  );

  // 4. Calibration & Certificate Expiry Timeline
  const expiryTimeline = [];
  rawEvidence.forEach((ev) => {
    if (ev.expiry_date) {
      const expDate = new Date(ev.expiry_date);
      const daysToExpiry = Math.ceil((expDate - todayDate) / (1000 * 60 * 60 * 24));
      const status = daysToExpiry < 0 ? 'expired' : daysToExpiry <= 30 ? 'expiring_soon' : 'valid';

      expiryTimeline.push({
        rule_code: ev.rule_code,
        title: ev.rule ? ev.rule.title : ev.rule_code,
        issue_date: ev.issue_date,
        expiry_date: ev.expiry_date,
        days_to_expiry: daysToExpiry,
        status,
      });
    }
  });

  expiryTimeline.sort((a, b) => a.days_to_expiry - b.days_to_expiry);

  return res.json({
    radar,
    risk_matrix: riskMatrix,
    pareto,
    expiry_timeline: expiryTimeline,
  });
});

module.exports = router;
