'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireFactoryTenant } = require('../middleware/auth');
const { compareFixPlans } = require('../engine/fixPlanner');
const { evaluateOrder } = require('../engine/decisionEngine');

const router = express.Router();

router.use(requireAuth);
router.use(requireFactoryTenant);

/**
 * POST /api/fix-planner/optimize (Feature F9)
 * Executes Set Union Knapsack Problem (SUKP) optimizer comparing Greedy vs Exact.
 */
router.post('/optimize', (req, res) => {
  const capacityDays = req.body.capacity_days !== undefined ? parseFloat(req.body.capacity_days) : 60;
  if (isNaN(capacityDays) || capacityDays < 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'capacity_days must be a non-negative number.',
      },
    });
  }

  const factoryOrders = memoryStore.getOrdersByFactory(req.factoryId);
  const allRules = memoryStore.getRules({ active: true });
  const factoryEvidenceList = memoryStore.getEvidenceByFactory(req.factoryId);
  const evidenceByRuleId = new Map();
  factoryEvidenceList.forEach((ev) => evidenceByRuleId.set(ev.rule_id, ev));

  const today = new Date().toISOString().slice(0, 10);

  // Prepare order items with evaluated findings
  const plannerOrders = factoryOrders.map((order) => {
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

    // Calculate calendar days remaining
    const diffMs = new Date(order.shipment_deadline) - new Date(today);
    const availableDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      order_id: order.id,
      product_name: order.product_name,
      financial_value_usd: order.financial_value_usd || 0,
      available_days: availableDays,
      findings: latest.findings,
    };
  });

  const optimizationResult = compareFixPlans({
    orders: plannerOrders,
    capacityDays,
  });

  return res.json(optimizationResult);
});

module.exports = router;
