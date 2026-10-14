'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/rules
 * List all compliance rules in the catalogue (including inactive if requested).
 */
router.get('/rules', (req, res) => {
  const { category, active } = req.query;
  const rules = memoryStore.getRules({ category, active });
  return res.json(rules);
});

/**
 * POST /api/admin/rules
 * Creates a new compliance rule in the catalogue.
 */
router.post('/rules', (req, res) => {
  const { rule_code, title, description, is_absolute, default_effort_days, cfr_section, fda_source_section, iso_clause_number, category, metadata } =
    req.body || {};

  if (!rule_code || !title || !description) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'rule_code, title, and description are required fields.',
      },
    });
  }

  try {
    const newRule = memoryStore.createRule({
      rule_code,
      title,
      description,
      is_absolute: Boolean(is_absolute),
      default_effort_days: parseInt(default_effort_days || 0, 10),
      cfr_section,
      fda_source_section,
      iso_clause_number,
      category,
      metadata,
    });
    return res.status(201).json(newRule);
  } catch (err) {
    return res.status(409).json({
      error: {
        code: 'RULE_EXISTS',
        message: err.message,
      },
    });
  }
});

/**
 * PUT /api/admin/rules/:ruleCode (and PATCH)
 * Updates an existing rule; increments `version` if substantive fields change.
 */
function updateRuleHandler(req, res) {
  const ruleCode = req.params.ruleCode;
  const existing = memoryStore.getRuleByCode(ruleCode);
  if (!existing) {
    return res.status(404).json({
      error: {
        code: 'RULE_NOT_FOUND',
        message: `Rule '${ruleCode}' not found.`,
      },
    });
  }

  const updated = memoryStore.updateRule(ruleCode, req.body || {});
  return res.json(updated);
}

router.put('/rules/:ruleCode', updateRuleHandler);
router.patch('/rules/:ruleCode', updateRuleHandler);

/**
 * POST /api/admin/rules/:ruleCode/deactivate
 */
router.post('/rules/:ruleCode/deactivate', (req, res) => {
  const ruleCode = req.params.ruleCode;
  const updated = memoryStore.updateRule(ruleCode, { active: false });
  if (!updated) {
    return res.status(404).json({
      error: {
        code: 'RULE_NOT_FOUND',
        message: `Rule '${ruleCode}' not found.`,
      },
    });
  }
  return res.json(updated);
});

module.exports = router;
