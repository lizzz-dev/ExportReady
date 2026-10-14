'use strict';

const express = require('express');
const { memoryStore } = require('../db/store');
const { requireAuth, requireFactoryTenant } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireFactoryTenant);

const STAGES = [
  {
    stage: 1,
    name: 'Gap Analysis & Scoping',
    description: 'Gap report vs ISO 13485:2016 and 21 CFR 820; scope definition, product families, exclusions.',
    typical_outputs: ['Baseline gap analysis', 'QMS boundary definition', 'Device family classification matrix'],
    rule_codes: ['ER-REG-001', 'ER-REG-002', 'ER-REG-003', 'ER-QMS-004'],
  },
  {
    stage: 2,
    name: 'QMS Design & Documentation',
    description: 'Quality manual, standard operating procedures, DMR / Medical Device File, document control.',
    typical_outputs: ['Quality Manual SOP-QM-01', 'Device Master Records (DMR)', 'Document Control SOP-DOC-01'],
    rule_codes: ['ER-DOC-013', 'ER-DOC-015', 'ER-DOC-016'],
  },
  {
    stage: 3,
    name: 'Process Implementation & Controls',
    description: 'Operating processes, validated passivation/cleaning, calibration system, UDI labelling, personnel training.',
    typical_outputs: [
      'Passivation IQ/OQ/PQ reports',
      'Bioburden cleaning validation',
      'Traceable gauge calibration logs',
      'UDI direct part marking verification',
    ],
    rule_codes: [
      'ER-MAT-005',
      'ER-MAT-006',
      'ER-CLN-007',
      'ER-CLN-008',
      'ER-PAS-009',
      'ER-PAS-010',
      'ER-PAS-011',
      'ER-PAS-012',
      'ER-UDI-020',
      'ER-CAL-021',
      'ER-PKG-022',
      'ER-STR-023',
    ],
  },
  {
    stage: 4,
    name: 'Internal Audit & Management Review',
    description: 'Audit reports, CAPA logs, management review minutes, supplier evaluation.',
    typical_outputs: ['Full-scope internal audit report', 'Management review minutes', 'CAPA register with closed findings'],
    rule_codes: ['ER-DOC-017', 'ER-DOC-018', 'ER-DOC-019', 'ER-CAPA-024', 'ER-CAPA-025'],
  },
  {
    stage: 5,
    name: 'Certification Audit (Registrar)',
    description: 'Registrar Stage 1 (documentation) + Stage 2 (on-site implementation) audits, nonconformity closure, certificate issuance.',
    typical_outputs: ['Stage 1 audit clearance', 'Stage 2 on-site audit report', 'Accredited ISO 13485:2016 certificate'],
    rule_codes: ['ER-QMS-004'],
  },
  {
    stage: 6,
    name: 'Surveillance & FDA Green List Upkeep',
    description: 'Annual surveillance audits, recertification, FDA annual registration renewal, Green List maintenance.',
    typical_outputs: ['Annual surveillance reports', 'Annual FDA FURLS registration renewal', 'Commercial shipment proof files'],
    rule_codes: ['ER-REG-001', 'ER-REG-002', 'ER-REG-003'],
  },
];

const REGISTRARS = [
  { name: 'TÜV SÜD', website: 'https://www.tuvsud.com', region: 'Global / EU / USA', recognized: true },
  { name: 'SGS', website: 'https://www.sgs.com', region: 'Global / Pakistan presence', recognized: true },
  { name: 'BSI Group', website: 'https://www.bsigroup.com', region: 'Global / UK / USA', recognized: true },
  { name: 'DNV', website: 'https://www.dnv.com', region: 'Global / Norway / USA', recognized: true },
  { name: 'NSF International', website: 'https://www.nsf.org', region: 'USA / Global', recognized: true },
  { name: 'UL Solutions', website: 'https://www.ul.com', region: 'USA / Global', recognized: true },
  { name: 'Bureau Veritas', website: 'https://www.bureauveritas.com', region: 'Global / France / USA', recognized: true },
];

const REGISTRAR_DISCLAIMER =
  "Verify before engaging: a registrar's ISO 13485 accreditation scope varies by country and body. Confirm the " +
  'certificate issuer\'s accreditation through the national/IAF-recognised accreditation body (e.g. IAF CertSearch: ' +
  'https://www.iafcertsearch.org). The list is informational — not an endorsement, ranking or paid placement. Whether a ' +
  'given registrar audits in Pakistan must be confirmed directly. ExportReady is not an ISO registrar and does not issue ' +
  'certifications.';

/**
 * GET /api/iso-roadmap (Feature F12)
 * Returns the 6-stage ISO 13485 preparation roadmap mapped to factory progress.
 */
router.get('/', (req, res) => {
  const factoryId = req.factoryId;
  const rawEvidence = memoryStore.getEvidenceByFactory(factoryId);
  const evidenceMap = new Map();
  rawEvidence.forEach((e) => evidenceMap.set(e.rule_code, e));

  const todayStr = new Date().toISOString().slice(0, 10);

  const stagesWithProgress = STAGES.map((s) => {
    let metCount = 0;
    const ruleDetails = s.rule_codes.map((code) => {
      const ev = evidenceMap.get(code);
      const isExpired = ev && ev.expiry_date && ev.expiry_date < todayStr;
      const isMet =
        ev &&
        !isExpired &&
        (ev.proof_grade === 'third_party_verified' || ev.proof_grade === 'document_backed');

      if (isMet) metCount += 1;

      return {
        rule_code: code,
        status: isMet ? 'MET' : ev ? ev.proof_grade : 'MISSING',
        proof_grade: ev ? ev.proof_grade : 'self_declared',
      };
    });

    const completionPct = s.rule_codes.length > 0 ? Math.round((metCount / s.rule_codes.length) * 100) : 0;

    return {
      stage: s.stage,
      name: s.name,
      description: s.description,
      typical_outputs: s.typical_outputs,
      rules_total: s.rule_codes.length,
      rules_met: metCount,
      completion_pct: completionPct,
      rules: ruleDetails,
    };
  });

  return res.json({
    title: 'ISO 13485:2016 6-Stage Roadmap & Registrar Directory',
    stages: stagesWithProgress,
    accredited_registrars: REGISTRARS,
    disclaimer: REGISTRAR_DISCLAIMER,
  });
});

module.exports = router;
