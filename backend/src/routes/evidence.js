'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireFactoryTenant } = require('../middleware/auth');
const aiBridge = require('../services/aiBridge');

const router = express.Router();

router.use(requireAuth);
router.use(requireFactoryTenant);

/**
 * GET /api/evidence
 * Retrieves the 4-tier evidence vault for the tenant factory.
 */
router.get('/', (req, res) => {
  const factoryId = req.factoryId;
  const rawList = memoryStore.getEvidenceByFactory(factoryId);
  const allRules = memoryStore.getRules({ active: true });

  const evidenceMap = new Map();
  rawList.forEach((item) => {
    evidenceMap.set(item.rule_code, item);
  });

  const todayIso = new Date().toISOString().slice(0, 10);

  // Return vault entries for all 25 rules (populated or default self_declared)
  const vault = allRules.map((rule) => {
    const ev = evidenceMap.get(rule.rule_code);
    let proofGrade = ev ? ev.proof_grade : 'self_declared';
    let effectiveGrade = proofGrade;

    if (ev && ev.expiry_date && ev.expiry_date < todayIso) {
      effectiveGrade = 'expired';
    }

    return {
      id: ev ? ev.id : null,
      factory_id: factoryId,
      rule_id: rule.id,
      rule_code: rule.rule_code,
      title: rule.title,
      category: rule.category,
      is_absolute: rule.is_absolute,
      default_effort_days: rule.default_effort_days,
      proof_grade: proofGrade,
      effective_grade: effectiveGrade,
      file_url: ev ? ev.file_url : null,
      issue_date: ev ? ev.issue_date : null,
      expiry_date: ev ? ev.expiry_date : null,
      notes: ev ? ev.notes : '',
      cfr_section: rule.cfr_section,
      fda_source_section: rule.fda_source_section,
      iso_clause_number: rule.iso_clause_number,
      updated_at: ev ? ev.updated_at : null,
    };
  });

  return res.json(vault);
});

/**
 * PUT /api/evidence/:ruleId
 * Upserts evidence for a specific compliance rule.
 */
router.put('/:ruleId', (req, res) => {
  const factoryId = req.factoryId;
  const ruleParam = req.params.ruleId;
  const body = req.body || {};

  const rule = memoryStore.getRuleById(ruleParam) || memoryStore.getRuleByCode(ruleParam);
  if (!rule) {
    return res.status(404).json({
      error: {
        code: 'RULE_NOT_FOUND',
        message: `Compliance rule '${ruleParam}' not found.`,
      },
    });
  }

  // Validate dates: issue_date and expiry_date
  if (body.issue_date && body.expiry_date) {
    if (body.expiry_date < body.issue_date) {
      return res.status(422).json({
        error: {
          code: 'EXPIRY_BEFORE_ISSUE',
          message: `Expiry date (${body.expiry_date}) cannot be earlier than issue date (${body.issue_date}).`,
        },
      });
    }
  }

  const validGrades = ['third_party_verified', 'document_backed', 'self_declared', 'expired'];
  if (body.proof_grade && !validGrades.includes(body.proof_grade)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PROOF_GRADE',
        message: `proof_grade must be one of: ${validGrades.join(', ')}`,
      },
    });
  }

  try {
    const updated = memoryStore.upsertEvidence(factoryId, rule.id, body);
    return res.json({
      ...updated,
      rule_code: rule.rule_code,
      title: rule.title,
    });
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  }
});

/**
 * POST /api/evidence/inspect-ocr
 * Inspects uploaded MTC or certificate text for discrepancies (e.g. AISI 304).
 */
router.post('/inspect-ocr', async (req, res) => {
  try {
    const { rawText, text, declared_instrument_type, filename } = req.body || {};
    const contentToInspect = rawText || text || '';

    if (!contentToInspect && !req.body.file) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either text/rawText content or a document file is required for OCR inspection.',
        },
      });
    }

    const result = await aiBridge.inspectOcrDocument({
      rawText: contentToInspect,
      declaredInstrumentType: declared_instrument_type || 'cutting',
      fileName: filename || 'document.pdf',
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'OCR_PROCESSING_FAILED',
        message: err.message,
      },
    });
  }
});

module.exports = router;
