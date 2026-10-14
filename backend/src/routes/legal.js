'use strict';

const express = require('express');
const { MANDATORY_LEGAL_DISCLAIMER } = require('../services/aiBridge');

const router = express.Router();

const POLICY = {
  title: 'ExportReady Legal Disclaimers, Data Privacy & Non-Disclosure Policy',
  last_updated: '2026-10-15',
  version: '2.0.0',
  sections: [
    {
      id: 'decision_support',
      title: 'Decision-Support Nature (Not Legal Advice)',
      content: MANDATORY_LEGAL_DISCLAIMER,
    },
    {
      id: 'accuracy_of_rule_base',
      title: 'Accuracy of Statutory Rule Base',
      content:
        'Rules summarise official public sources (21 CFR Parts 801/807/820/830, FDA Import Alert 76-01, QMSR / ISO 13485:2016 ' +
        'preamble references, ASTM F899 and ASTM A967 citations). Statutory citations are pointers; official government texts ' +
        'govern all border releases. Estimated repair-effort days are planning benchmarks, not contractual guarantees.',
    },
    {
      id: 'ai_assisted_features',
      title: 'AI-Assisted Features & Human-in-the-Loop Safeguards',
      content:
        'OCR extraction, buyer-condition clause matching, and the RAG Compliance Copilot are automated decision-support aids. ' +
        'They are non-authoritative and never alter a factory compliance verdict on their own. All extracted data and matched ' +
        'clauses require human verification before becoming factory records. The Copilot strictly cites public regulatory ' +
        'documents and declines speculative or legal advice queries.',
    },
    {
      id: 'data_privacy_and_nda',
      title: 'Multi-Tenant Confidentiality & Non-Disclosure Guarantees',
      content:
        'Factory profile data, purchase orders, customer contract text, evidence documents, and assessment findings belong ' +
        'strictly to the individual manufacturing tenant. ExportReady guarantees zero cross-tenant sharing, zero commercialization ' +
        'or third-party sale of tenant data, and encrypted tenant data isolation enforced by cryptographic tokens and ' +
        'Row-Level Security controls. Tenants may request full export or permanent cryptographic deletion of their records at any time.',
    },
    {
      id: 'limitation_of_liability',
      title: 'Limitation of Liability & Academic Research Context',
      content:
        'ExportReady is an academic decision-support prototype developed at the Department of Computer Science, UMT Sialkot. ' +
        'The software is provided "as is" without warranty of any kind. The authors, advisors, and University of Management and ' +
        'Technology are not liable for direct, indirect, incidental, or consequential damages resulting from reliance on the system.',
    },
  ],
};

router.get('/policy', (req, res) => {
  return res.json(POLICY);
});

router.get('/disclaimer', (req, res) => {
  return res.json({
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
  });
});

module.exports = router;
