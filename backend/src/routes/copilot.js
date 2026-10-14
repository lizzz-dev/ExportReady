'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const aiBridge = require('../services/aiBridge');

const router = express.Router();

router.use(requireAuth);

/**
 * POST /api/copilot/query (or /api/copilot/ask)
 * Feature F11: Grounded RAG Compliance Copilot with statutory citations & SOP outline.
 */
async function copilotQueryHandler(req, res) {
  try {
    const { query, question, context_rule_codes, context } = req.body || {};
    const promptQuery = query || question;

    if (!promptQuery) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'query or question is required.',
        },
      });
    }

    const ruleCodes = context_rule_codes || (context && context.rule_codes) || [];

    const result = await aiBridge.queryRag({
      query: promptQuery,
      contextRuleCodes: Array.isArray(ruleCodes) ? ruleCodes : [],
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'COPILOT_FAILED',
        message: err.message,
      },
    });
  }
}

router.post('/query', copilotQueryHandler);
router.post('/ask', copilotQueryHandler);

module.exports = router;
